// Cloudflare Pages Function — POST /studio/edit
// Edit with AI: apply a single instruction to an already-generated view while
// keeping the furniture design and studio rules intact. Creates a new version
// (parent_id lineage) and makes it the current image for that view.
//
// Required env: OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY (secrets)
// Optional: OPENAI_IMAGE_MODEL, SUPABASE_URL

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const IMAGE_MODEL_DEFAULT = "gpt-image-1";
const OUTPUTS_BUCKET = "studio-outputs";

const RULES_PROMPT =
`NON-NEGOTIABLE PRODUCTION RULES:
- Preserve the EXACT furniture design. Never redesign shape, proportions, materials, colors, stitching, legs, base or arms except where the instruction explicitly asks.
- Background: pure seamless white (#FFFFFF), no props.
- Product centered with a soft floor shadow, ~12-15% margin, not filling the frame.
- Soft, balanced studio lighting. 50mm eye-level look. Square 1:1, premium catalog quality.`;

function buildEditPrompt(instruction) {
  return [
    `Apply ONLY this change to the provided studio image: "${instruction}".`,
    `Keep the furniture design, materials, colours, proportions and every other detail exactly the same as the provided image, except for the requested change.`,
    ``,
    RULES_PROMPT,
  ].join("\n");
}

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
  if (!imageId || !instruction) return json(400, { ok: false, error: "imageId and instruction are required" });

  // Load the source image record.
  let img;
  try {
    const r = await fetch(`${base}/rest/v1/studio_generated_images?id=eq.${imageId}&select=*`, {
      headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey },
    });
    const rows = await r.json();
    img = rows && rows[0];
  } catch (e) { /* fall through */ }
  if (!img || !img.url) return json(404, { ok: false, error: "Image not found" });

  // Fetch current image bytes as the edit base.
  let baseBlob;
  try {
    const rr = await fetch(img.url);
    if (!rr.ok) throw new Error("img fetch " + rr.status);
    baseBlob = await rr.blob();
  } catch (e) { return json(400, { ok: false, error: "Could not load current image" }); }

  // Call OpenAI edit.
  let b64;
  try {
    const fd = new FormData();
    fd.append("model", model);
    fd.append("prompt", buildEditPrompt(instruction));
    fd.append("size", "1024x1024");
    fd.append("n", "1");
    fd.append("quality", "high");
    fd.append("output_format", "webp");
    fd.append("output_compression", "70");
    fd.append("image", baseBlob, "base.webp");

    const or = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: "Bearer " + openaiKey },
      body: fd,
    });
    const oj = await or.json().catch(() => null);
    if (!or.ok || !oj) return json(502, { ok: false, error: "OpenAI error: " + ((oj && oj.error && oj.error.message) || or.status) });
    b64 = oj.data && oj.data[0] && oj.data[0].b64_json;
    if (!b64) return json(502, { ok: false, error: "OpenAI returned no image" });
  } catch (e) { return json(502, { ok: false, error: "Edit failed: " + e.message }); }

  // Upload new version.
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `${img.project_id}/${img.view_type}-edit-${Date.now()}.webp`;
  try {
    const up = await fetch(`${base}/storage/v1/object/${OUTPUTS_BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "image/webp", "x-upsert": "true" },
      body: bytes,
    });
    if (!up.ok) { const t = await up.text().catch(() => ""); return json(502, { ok: false, error: "Storage upload failed: " + t.slice(0, 200) }); }
  } catch (e) { return json(502, { ok: false, error: "Storage upload failed: " + e.message }); }

  const publicUrl = `${base}/storage/v1/object/public/${OUTPUTS_BUCKET}/${path}`;

  // Demote previous current for this view, insert new current version.
  try {
    await fetch(`${base}/rest/v1/studio_generated_images?project_id=eq.${img.project_id}&view_type=eq.${img.view_type}&is_current=eq.true`, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ is_current: false }),
    });
    await fetch(`${base}/rest/v1/studio_generated_images`, {
      method: "POST",
      headers: { Authorization: "Bearer " + serviceKey, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        project_id: img.project_id, view_type: img.view_type, status: "ready",
        url: publicUrl, thumb_url: publicUrl, bytes: bytes.length, model,
        prompt: instruction, parent_id: imageId, is_current: true,
      }),
    });
  } catch (e) { /* best-effort recording */ }

  return json(200, { ok: true, url: publicUrl });
}
