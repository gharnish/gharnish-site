// Cloudflare Pages Function — POST /studio/edit
// Edit with AI: apply an instruction (and optionally a reference image) to an
// existing view. Generates on pure WHITE, uploads, and records a new version.
//
// Body: { imageId, instruction, refImageUrl? }
// Security: Supabase access token. Required env: OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const IMAGE_MODEL_DEFAULT = "gpt-image-1";
const OUTPUTS_BUCKET = "studio-outputs";

function buildEditPrompt(instruction, hasRef) {
  return [
    `Edit this furniture product photo. Requested change: "${instruction}".`,
    `Apply the requested change clearly and realistically.` + (hasRef ? ` Use the ADDITIONAL reference image as the visual guide for the change (e.g. its colour, material, texture, finish or style).` : ``),
    `Keep the same product type and overall form; change only what the instruction asks.`,
    `Background: pure seamless solid WHITE (#FFFFFF) studio sweep, product centered with ~12–15% margin, soft floor shadow, soft studio lighting, square 1:1, photorealistic, premium catalog quality.`,
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
  if (!(await verifySupabaseUser(env, token))) return json(401, { ok: false, error: "Not signed in." });

  let body;
  try { body = await context.request.json(); } catch (e) { return json(400, { ok: false, error: "Bad JSON body" }); }
  const imageId = String(body && body.imageId || "");
  const instruction = String(body && body.instruction || "").trim().slice(0, 500);
  const refImageUrl = String(body && body.refImageUrl || "");
  if (!imageId || !instruction) return json(400, { ok: false, error: "imageId and instruction are required" });

  let img;
  try {
    const r = await fetch(`${base}/rest/v1/studio_generated_images?id=eq.${imageId}&select=url,view_type,project_id`, { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } });
    const rows = await r.json(); img = rows && rows[0];
  } catch (e) { /* fall */ }
  if (!img || !img.url) return json(404, { ok: false, error: "Image not found" });

  let baseBlob, refBlob = null;
  try { const rr = await fetch(img.url); if (!rr.ok) throw new Error("img " + rr.status); baseBlob = await rr.blob(); }
  catch (e) { return json(400, { ok: false, error: "Could not load current image" }); }
  if (refImageUrl) { try { const r2 = await fetch(refImageUrl); if (r2.ok) refBlob = await r2.blob(); } catch (e) { /* ref optional */ } }

  let b64;
  try {
    const fd = new FormData();
    fd.append("model", model);
    fd.append("prompt", buildEditPrompt(instruction, !!refBlob));
    fd.append("size", "1024x1024");
    fd.append("n", "1");
    fd.append("quality", "medium"); // faster — avoids Cloudflare edge timeout (502)
    fd.append("output_format", "webp");
    fd.append("output_compression", "80");
    fd.append("image", baseBlob, "base.webp");
    if (refBlob) fd.append("image", refBlob, "reference.png");

    const or = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + openaiKey }, body: fd });
    const oj = await or.json().catch(() => null);
    if (!or.ok || !oj) return json(502, { ok: false, error: "OpenAI error: " + ((oj && oj.error && oj.error.message) || or.status) });
    b64 = oj.data && oj.data[0] && oj.data[0].b64_json;
    if (!b64) return json(502, { ok: false, error: "OpenAI returned no image" });
  } catch (e) { return json(502, { ok: false, error: "Edit failed: " + e.message }); }

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `${img.project_id}/${img.view_type}-edit-${Date.now()}.webp`;
  try {
    const up = await fetch(`${base}/storage/v1/object/${OUTPUTS_BUCKET}/${path}`, {
      method: "POST", headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "image/webp", "x-upsert": "true" }, body: bytes,
    });
    if (!up.ok) { const tx = await up.text().catch(() => ""); return json(502, { ok: false, error: "Storage upload failed: " + tx.slice(0, 200) }); }
  } catch (e) { return json(502, { ok: false, error: "Storage upload failed: " + e.message }); }

  const publicUrl = `${base}/storage/v1/object/public/${OUTPUTS_BUCKET}/${path}`;
  try {
    await fetch(`${base}/rest/v1/studio_generated_images?project_id=eq.${img.project_id}&view_type=eq.${img.view_type}&is_current=eq.true`, {
      method: "PATCH", headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ is_current: false }),
    });
    await fetch(`${base}/rest/v1/studio_generated_images`, {
      method: "POST", headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ project_id: img.project_id, view_type: img.view_type, status: "ready", url: publicUrl, thumb_url: publicUrl, bytes: bytes.length, model, prompt: instruction, parent_id: imageId, is_current: true }),
    });
  } catch (e) { /* best-effort */ }

  return json(200, { ok: true, url: publicUrl });
}
