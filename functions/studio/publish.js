// Cloudflare Pages Function — POST /studio/publish
// Publish a finished Studio project into the live catalog (gharnish_products).
// This is the "auto-move to product" integration.
//
// Required env:
//   SUPABASE_SERVICE_ROLE_KEY  (secret)
// Optional: SUPABASE_URL

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function verifySupabaseUser(env, token) {
  if (!token) return false;
  const base = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const key = env.SUPABASE_KEY || SUPABASE_KEY_DEFAULT;
  try {
    const r = await fetch(base + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + token } });
    return r.ok;
  } catch (e) { return false; }
}

async function sbGet(base, key, pathAndQuery) {
  const r = await fetch(`${base}/rest/v1/${pathAndQuery}`, {
    headers: { Authorization: "Bearer " + key, apikey: key },
  });
  if (!r.ok) throw new Error("db read " + r.status);
  return r.json();
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const base = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return json(500, { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set in Cloudflare." });

  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!(await verifySupabaseUser(env, token))) return json(401, { ok: false, error: "Not signed in." });

  let body;
  try { body = await context.request.json(); } catch (e) { return json(400, { ok: false, error: "Bad JSON body" }); }
  const projectId = String(body && body.projectId || "");
  if (!projectId) return json(400, { ok: false, error: "projectId required" });

  let project, images;
  try {
    const ps = await sbGet(base, serviceKey, `studio_projects?id=eq.${projectId}&select=*`);
    project = ps && ps[0];
    if (!project) return json(404, { ok: false, error: "Project not found" });
    images = await sbGet(base, serviceKey, `studio_generated_images?project_id=eq.${projectId}&is_current=eq.true&select=*`);
  } catch (e) { return json(502, { ok: false, error: "DB read failed: " + e.message }); }

  const hero = (images || []).find((i) => i.view_type === "hero") || (images || [])[0];
  if (!hero || !hero.url) return json(400, { ok: false, error: "No generated image to publish yet" });

  const fp = project.reference_fingerprint || {};
  const productId = project.published_product_id || ("gs_" + String(projectId).replace(/-/g, "").slice(0, 12));

  // Next sort value so it appears at the end of the catalog list.
  let nextSort = null;
  try {
    const sr = await fetch(`${base}/rest/v1/gharnish_products?select=sort&order=sort.desc.nullslast&limit=1`, {
      headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey },
    });
    const rows = await sr.json();
    nextSort = ((rows && rows[0] && Number(rows[0].sort)) || 0) + 1;
  } catch (e) { /* sort optional */ }

  const row = {
    id: productId,
    name: project.name,
    cat: project.category || fp.productType || null,
    material: project.primary_material || fp.primaryMaterial || null,
    image: hero.url,
    description: project.notes || fp.summary || null,
    shape: fp.shape || null,
    price: (project.price != null ? project.price : null),
    sort: nextSort,
    stock: true,
  };

  try {
    const up = await fetch(`${base}/rest/v1/gharnish_products?on_conflict=id`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + serviceKey, apikey: serviceKey,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!up.ok) {
      const t = await up.text().catch(() => "");
      return json(502, { ok: false, error: "Catalog upsert failed: " + t.slice(0, 200) });
    }
  } catch (e) { return json(502, { ok: false, error: "Catalog upsert failed: " + e.message }); }

  // Map the product into its category (app_settings.product_categories: id -> [catKeys])
  // so it shows in the admin/storefront category views, not just the flat list.
  if (project.category) {
    try {
      const gr = await fetch(`${base}/rest/v1/app_settings?key=eq.product_categories&select=value`, {
        headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey },
      });
      const rows = await gr.json();
      const val = (rows && rows[0] && rows[0].value) || {};
      if (!Array.isArray(val[productId])) val[productId] = [project.category];
      else if (!val[productId].includes(project.category)) val[productId].push(project.category);
      await fetch(`${base}/rest/v1/app_settings?key=eq.product_categories`, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ value: val }),
      });
    } catch (e) { /* category mapping best-effort */ }
  }

  // Push ALL generated views into the storefront gallery
  // (app_settings.gallery -> { items: { [id]: { images:[...] } } }).
  try {
    const order = { hero: 0, front: 1, back: 2, side: 3, top: 4, info_slide: 5 };
    const urls = (images || [])
      .slice()
      .sort((a, b) => ((order[a.view_type] != null ? order[a.view_type] : 9) - (order[b.view_type] != null ? order[b.view_type] : 9)))
      .map((i) => i.url)
      .filter(Boolean);
    const gr = await fetch(`${base}/rest/v1/app_settings?key=eq.gallery&select=value`, {
      headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey },
    });
    const rows = await gr.json();
    const cur = (rows && rows[0] && rows[0].value) || {};
    const items = cur.items || {};
    items[productId] = Object.assign({}, items[productId], { images: urls });
    await fetch(`${base}/rest/v1/app_settings?on_conflict=key`, {
      method: "POST",
      headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ key: "gallery", value: Object.assign({}, cur, { items }) }),
    });
  } catch (e) { /* gallery best-effort */ }

  try {
    await fetch(`${base}/rest/v1/studio_projects?id=eq.${projectId}`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + serviceKey, apikey: serviceKey,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({
        published: true, published_product_id: productId,
        published_at: new Date().toISOString(), status: "published",
      }),
    });
  } catch (e) { /* best-effort */ }

  return json(200, { ok: true, productId });
}
