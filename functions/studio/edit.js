// Cloudflare Pages Function — POST /studio/edit
// Edit with AI: apply one instruction to an existing view. Returns the edited
// product ISOLATED on transparent background (base64); the client composites it
// onto pure white and stores it as a new version. Keeps the background strictly
// white and the furniture design intact.
//
// Security: caller must send a valid Supabase access token.
// Required env: OPENAI_API_KEY (secret). Optional: OPENAI_IMAGE_MODEL, SUPABASE_URL.

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const IMAGE_MODEL_DEFAULT = "gpt-image-1";

function buildEditPrompt(instruction) {
  return [
    `Apply ONLY this change to the furniture in the provided image: "${instruction}".`,
    `Keep the furniture design, materials, colours, proportions and every other detail exactly the same except for the requested change.`,
    `Show ONLY the furniture, fully isolated with NO background, NO floor and NO shadow (transparent background). Photorealistic, premium e-commerce catalog quality, full product in frame.`,
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
  const anonKey = env.SUPABASE_KEY || SUPABASE_KEY_DEFAULT;
  const openaiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_IMAGE_MODEL || IMAGE_MODEL_DEFAULT;
  if (!openaiKey) return json(500, { ok: false, error: "OPENAI_API_KEY is not set in Cloudflare." });

  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!(await verifySupabaseUser(env, token))) return json(401, { ok: false, error: "Not signed in." });

  let body;
  try { body = await context.request.json(); } catch (e) { return json(400, { ok: false, error: "Bad JSON body" }); }
  const imageId = String(body && body.imageId || "");
  const instruction = String(body && body.instruction || "").trim().slice(0, 500);
  if (!imageId || !instruction) return json(400, { ok: false, error: "imageId and instruction are required" });

  // Read the image record (RLS: authenticated select) using the caller's token.
  let img;
  try {
    const r = await fetch(`${base}/rest/v1/studio_generated_images?id=eq.${imageId}&select=url,view_type,project_id`, { headers: { apikey: anonKey, Authorization: "Bearer " + token } });
    const rows = await r.json(); img = rows && rows[0];
  } catch (e) { /* fall through */ }
  if (!img || !img.url) return json(404, { ok: false, error: "Image not found" });

  let baseBlob;
  try { const rr = await fetch(img.url); if (!rr.ok) throw new Error("img " + rr.status); baseBlob = await rr.blob(); }
  catch (e) { return json(400, { ok: false, error: "Could not load current image" }); }

  try {
    const fd = new FormData();
    fd.append("model", model);
    fd.append("prompt", buildEditPrompt(instruction));
    fd.append("size", "1024x1024");
    fd.append("n", "1");
    fd.append("quality", "high");
    fd.append("background", "transparent");
    fd.append("output_format", "png");
    fd.append("image", baseBlob, "base.png");

    const or = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + openaiKey }, body: fd });
    const oj = await or.json().catch(() => null);
    if (!or.ok || !oj) return json(502, { ok: false, error: "OpenAI error: " + ((oj && oj.error && oj.error.message) || or.status) });
    const b64 = oj.data && oj.data[0] && oj.data[0].b64_json;
    if (!b64) return json(502, { ok: false, error: "OpenAI returned no image" });
    return json(200, { ok: true, b64, view: img.view_type, projectId: img.project_id, parentId: imageId });
  } catch (e) { return json(502, { ok: false, error: "Edit failed: " + e.message }); }
}
