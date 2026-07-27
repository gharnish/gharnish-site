// Cloudflare Pages Function — POST /studio/generate
// Generates one studio view of a furniture product with OpenAI gpt-image-1,
// directly on a pure WHITE background, anchored to the LOCKED reference photo.
// Uploads the result to studio-outputs and records it. Returns the public URL.
//
// Security: caller must send a valid Supabase access token.
// Required env: OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY (secrets).
// Optional: OPENAI_IMAGE_MODEL, SUPABASE_URL.

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const IMAGE_MODEL_DEFAULT = "gpt-image-1";
const OUTPUTS_BUCKET = "studio-outputs";

const VIEW_LABELS = { hero: "Hero", front: "Front", back: "Back", side: "Side", top: "Top View" };
const VIEW_CAMERA = {
  hero: "a premium 3/4 hero angle, slightly above eye level, showing the product's most flattering perspective",
  front: "a straight-on front elevation view",
  back: "a straight-on rear view showing the back of the product",
  side: "a straight-on side profile view",
  top: "a top-down (plan) view looking directly down at the product",
};

function buildViewPrompt(view) {
  const label = VIEW_LABELS[view] || "product";
  const cam = VIEW_CAMERA[view] || VIEW_CAMERA.hero;
  return [
    `Studio product photograph (${label} view) of the EXACT furniture shown in the provided reference image.`,
    `Preserve the furniture design precisely — same shape, proportions, materials, colours, stitching, legs, base, arms and every detail. Do not redesign it.`,
    `CAMERA: ${cam}.`,
    `BACKGROUND: pure seamless solid WHITE (#FFFFFF), a clean studio sweep — no props, no other objects, no colour tint, no gradient.`,
    `Product centered with roughly 12–15% empty margin on all sides (do not fill the whole frame), a soft natural floor contact shadow, soft balanced studio lighting, 50mm eye-level look, square 1:1, photorealistic, premium e-commerce catalog quality.`,
  ].join("\n");
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
async function verifySupabaseUser(env, token) {
  if (!token) return false;
  const base = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const key = env.SUPABASE_KEY || SUPABASE_KEY_DEFAULT;
  try { const r = await fetch(base + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + token } }); return r.ok; } catch (e) { return false; }
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const base = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_IMAGE_MODEL || IMAGE_MODEL_DEFAULT;
  if (!openaiKey) return json(500, { ok: false, error: "OPENAI_API_KEY is not set in Cloudflare." });
  if (!serviceKey) return json(500, { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set in Cloudflare." });

  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!(await verifySupabaseUser(env, token))) return json(401, { ok: false, error: "Not signed in. Refresh and sign in again." });

  let body;
  try { body = await context.request.json(); } catch (e) { return json(400, { ok: false, error: "Bad JSON body" }); }
  const projectId = String(body && body.projectId || "");
  const view = String(body && body.view || "hero");
  const referenceUrl = String(body && body.referenceUrl || "");
  if (!projectId || !referenceUrl) return json(400, { ok: false, error: "projectId and referenceUrl are required" });

  let refBlob;
  try { const rr = await fetch(referenceUrl); if (!rr.ok) throw new Error("ref " + rr.status); refBlob = await rr.blob(); }
  catch (e) { return json(400, { ok: false, error: "Could not load reference image" }); }

  let b64;
  try {
    const t = (refBlob.type || "").toLowerCase();
    const ext = t.includes("webp") ? "webp" : t.includes("jpeg") || t.includes("jpg") ? "jpg" : "png";
    const fd = new FormData();
    fd.append("model", model);
    fd.append("prompt", buildViewPrompt(view));
    fd.append("size", "1024x1024");
    fd.append("n", "1");
    fd.append("quality", "high");
    fd.append("output_format", "webp");
    fd.append("output_compression", "80");
    fd.append("image", refBlob, "reference." + ext);

    const or = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + openaiKey }, body: fd });
    const oj = await or.json().catch(() => null);
    if (!or.ok || !oj) return json(502, { ok: false, error: "OpenAI error: " + ((oj && oj.error && oj.error.message) || or.status) });
    b64 = oj.data && oj.data[0] && oj.data[0].b64_json;
    if (!b64) return json(502, { ok: false, error: "OpenAI returned no image" });
  } catch (e) { return json(502, { ok: false, error: "Generation failed: " + e.message }); }

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `${projectId}/${view}-${Date.now()}.webp`;
  try {
    const up = await fetch(`${base}/storage/v1/object/${OUTPUTS_BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "image/webp", "x-upsert": "true" },
      body: bytes,
    });
    if (!up.ok) { const tx = await up.text().catch(() => ""); return json(502, { ok: false, error: "Storage upload failed: " + tx.slice(0, 200) }); }
  } catch (e) { return json(502, { ok: false, error: "Storage upload failed: " + e.message }); }

  const publicUrl = `${base}/storage/v1/object/public/${OUTPUTS_BUCKET}/${path}`;
  try {
    await fetch(`${base}/rest/v1/studio_generated_images?project_id=eq.${projectId}&view_type=eq.${view}&is_current=eq.true`, {
      method: "PATCH", headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ is_current: false }),
    });
    await fetch(`${base}/rest/v1/studio_generated_images`, {
      method: "POST", headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ project_id: projectId, view_type: view, status: "ready", url: publicUrl, thumb_url: publicUrl, bytes: bytes.length, model, is_current: true }),
    });
  } catch (e) { /* best-effort */ }

  return json(200, { ok: true, url: publicUrl, view, bytes: bytes.length });
}
