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

  const row = {
    id: productId,
    name: project.name,
    cat: project.category || fp.productType || null,
    material: project.primary_material || fp.primaryMaterial || null,
    image: hero.url,
    description: project.notes || fp.summary || null,
    shape: fp.shape || null,
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
