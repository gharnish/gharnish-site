// Cloudflare Pages Function — POST /studio/generate
// Generates one studio view of a furniture product with OpenAI gpt-image-1,
// anchored to the LOCKED reference image (image-first). The product is returned
// ISOLATED on a transparent background; the client then composites it onto
// guaranteed pure-white (#FFFFFF) with a soft shadow. Returns base64 (the client
// stores the final white image), so the background is strictly white every time.
//
// Security: caller must send a valid Supabase access token.
// Required env: OPENAI_API_KEY (secret). Optional: OPENAI_IMAGE_MODEL, SUPABASE_URL.

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const IMAGE_MODEL_DEFAULT = "gpt-image-1";

const VIEW_LABELS = { hero: "Hero", front: "Front", back: "Back", side: "Side", top: "Top View", info_slide: "Information Slide" };
const VIEW_CAMERA = {
  hero: "a premium 3/4 hero angle, slightly above eye level, showing the product's most flattering perspective",
  front: "a straight-on front elevation view",
  back: "a straight-on rear view showing the back of the product",
  side: "a straight-on side profile view",
  top: "a top-down (plan) view looking directly down at the product",
  info_slide: "a clean front-facing view",
};

function buildViewPrompt(view) {
  const label = VIEW_LABELS[view] || "product";
  const cam = VIEW_CAMERA[view] || VIEW_CAMERA.hero;
  return [
    `Reproduce the EXACT furniture shown in the provided reference image as a premium ${label} product shot.`,
    `Do NOT redesign or alter the furniture in any way — keep the identical shape, proportions, materials, colours, stitching, legs, base, arms and every detail exactly as in the reference image.`,
    `CAMERA: ${cam}.`,
    `Show ONLY the furniture, fully isolated with NO background, NO floor and NO shadow (transparent background). The entire product must be fully in frame, sharp, evenly lit with soft neutral studio lighting, photorealistic, premium e-commerce catalog quality.`,
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
  const openaiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_IMAGE_MODEL || IMAGE_MODEL_DEFAULT;
  if (!openaiKey) return json(500, { ok: false, error: "OPENAI_API_KEY is not set in Cloudflare." });

  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!(await verifySupabaseUser(env, token))) return json(401, { ok: false, error: "Not signed in. Refresh and sign in again." });

  let body;
  try { body = await context.request.json(); } catch (e) { return json(400, { ok: false, error: "Bad JSON body" }); }
  const view = String(body && body.view || "hero");
  const referenceUrl = String(body && body.referenceUrl || "");
  if (!referenceUrl) return json(400, { ok: false, error: "referenceUrl is required" });

  let refBlob;
  try { const rr = await fetch(referenceUrl); if (!rr.ok) throw new Error("ref " + rr.status); refBlob = await rr.blob(); }
  catch (e) { return json(400, { ok: false, error: "Could not load reference image" }); }

  try {
    const t = (refBlob.type || "").toLowerCase();
    const ext = t.includes("webp") ? "webp" : t.includes("jpeg") || t.includes("jpg") ? "jpg" : "png";
    const fd = new FormData();
    fd.append("model", model);
    fd.append("prompt", buildViewPrompt(view));
    fd.append("size", "1024x1024");
    fd.append("n", "1");
    fd.append("quality", "high");
    fd.append("background", "transparent");
    fd.append("output_format", "png");
    fd.append("image", refBlob, "reference." + ext);

    const or = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + openaiKey }, body: fd });
    const oj = await or.json().catch(() => null);
    if (!or.ok || !oj) return json(502, { ok: false, error: "OpenAI error: " + ((oj && oj.error && oj.error.message) || or.status) });
    const b64 = oj.data && oj.data[0] && oj.data[0].b64_json;
    if (!b64) return json(502, { ok: false, error: "OpenAI returned no image" });
    return json(200, { ok: true, b64, view });
  } catch (e) { return json(502, { ok: false, error: "Generation failed: " + e.message }); }
}
