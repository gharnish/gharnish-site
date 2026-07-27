// Cloudflare Pages Function — POST /studio/edit
// ASYNC edit: applies an instruction (and optional reference image) to a view in
// the background (context.waitUntil), returns 202 immediately, writes a new
// version (or a 'failed' marker) that the client polls for.
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
    `Apply the change clearly and realistically.` + (hasRef ? ` Use the ADDITIONAL reference image as the visual guide for the change (its colour, material, texture, finish or style).` : ``),
    `Keep the same product type and overall form; change only what the instruction asks.`,
    `Background: pure seamless solid WHITE (#FFFFFF) studio sweep, product centered ~12–15% margin, soft floor shadow, square 1:1, photorealistic, premium catalog quality.`,
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
async function record(base, serviceKey, row) {
  await fetch(`${base}/rest/v1/studio_generated_images`, { method: "POST", headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row) });
}

async function editAndStore(o) {
  const { base, serviceKey, openaiKey, model, imageId, instruction, refImageUrl } = o;
  let projectId = o.projectId, view = o.view;
  try {
    // Look up the source image
    const r = await fetch(`${base}/rest/v1/studio_generated_images?id=eq.${imageId}&select=url,view_type,project_id`, { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } });
    const rows = await r.json(); const img = rows && rows[0];
    if (!img || !img.url) throw new Error("image not found");
    projectId = img.project_id; view = img.view_type;

    const rr = await fetch(img.url); if (!rr.ok) throw new Error("img " + rr.status); const baseBlob = await rr.blob();
    let refBlob = null;
    if (refImageUrl) { try { const r2 = await fetch(refImageUrl); if (r2.ok) refBlob = await r2.blob(); } catch (e) {} }

    const fd = new FormData();
    fd.append("model", model);
    fd.append("prompt", buildEditPrompt(instruction, !!refBlob));
    fd.append("size", "1024x1024");
    fd.append("n", "1");
    fd.append("quality", "medium");
    fd.append("output_format", "webp");
    fd.append("output_compression", "80");
    fd.append("image", baseBlob, "base.webp");
    if (refBlob) fd.append("image", refBlob, "reference.png");

    const or = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + openaiKey }, body: fd });
    const oj = await or.json().catch(() => null);
    if (!or.ok || !oj) throw new Error("OpenAI " + ((oj && oj.error && oj.error.message) || or.status));
    const b64 = oj.data && oj.data[0] && oj.data[0].b64_json;
    if (!b64) throw new Error("no image returned");

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${projectId}/${view}-edit-${Date.now()}.webp`;
    const up = await fetch(`${base}/storage/v1/object/${OUTPUTS_BUCKET}/${path}`, { method: "POST", headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "image/webp", "x-upsert": "true" }, body: bytes });
    if (!up.ok) throw new Error("storage " + up.status);
    const publicUrl = `${base}/storage/v1/object/public/${OUTPUTS_BUCKET}/${path}`;

    await fetch(`${base}/rest/v1/studio_generated_images?project_id=eq.${projectId}&view_type=eq.${view}&is_current=eq.true`, { method: "PATCH", headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ is_current: false }) });
    await record(base, serviceKey, { project_id: projectId, view_type: view, status: "ready", url: publicUrl, thumb_url: publicUrl, bytes: bytes.length, model, prompt: instruction, parent_id: imageId, is_current: true });
  } catch (e) {
    if (projectId && view) { try { await record(base, serviceKey, { project_id: projectId, view_type: view, status: "failed", error: String((e && e.message) || e).slice(0, 300), is_current: false, model }); } catch (_) {} }
  }
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

  context.waitUntil(editAndStore({ base, serviceKey, openaiKey, model, imageId, instruction, refImageUrl }));
  return json(202, { ok: true, queued: true });
}
