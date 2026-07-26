// Cloudflare Pages Function — POST /studio/generate
// Gharnish Studio: generate one studio view of a furniture product using
// OpenAI gpt-image-1, anchored to the LOCKED reference image (image-first —
// the real photo is the base, so the furniture is never redesigned).
//
// Security: caller must send a valid Supabase access token (admin/manager login).
// Keys live ONLY here, server-side.
//
// Required env (Pages -> Settings -> Variables and secrets):
//   OPENAI_API_KEY              (secret)
//   SUPABASE_SERVICE_ROLE_KEY   (secret)  — for storage upload + DB writes
// Optional:
//   OPENAI_IMAGE_MODEL          — default "gpt-image-1"
//   SUPABASE_URL                — default project URL below

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const IMAGE_MODEL_DEFAULT = "gpt-image-1";
const OUTPUTS_BUCKET = "studio-outputs";

const VIEW_LABELS = {
  hero: "Hero", front: "Front", back: "Back", side: "Side",
  top: "Top View", info_slide: "Information Slide",
};
const VIEW_CAMERA = {
  hero: "a premium 3/4 hero angle, slightly above eye level, showing the product's most flattering perspective",
  front: "a straight-on front elevation view",
  back: "a straight-on rear view showing the back of the product",
  side: "a straight-on side profile view",
  top: "a top-down (plan) view looking directly down at the product",
  info_slide: "a clean front-facing view suitable as the anchor image of a specification slide",
};

const RULES_PROMPT =
`NON-NEGOTIABLE PRODUCTION RULES:
- Preserve the EXACT uploaded furniture design. Never redesign, restyle, or alter the product's shape, proportions, materials, colors, stitching, legs, base, arms or any detail.
- Background: pure seamless white (#FFFFFF), no gradients, no props, no other objects.
- Product perfectly centered with a soft, natural floor contact shadow only.
- Product occupies the frame with ~12-15% empty margin on all sides. Do NOT let the product fill the entire frame.
- Lighting: soft, balanced, natural commercial studio lighting. No harsh highlights or colored casts.
- Camera: 50mm lens look, eye-level, consistent across all views.
- Output: square 1:1, premium e-commerce catalog quality.`;

function buildViewPrompt(view) {
  const label = VIEW_LABELS[view] || "product";
  const cam = VIEW_CAMERA[view] || VIEW_CAMERA.hero;
  return [
    `Reproduce the EXACT furniture shown in the provided reference image as a ${label} studio product photograph.`,
    `Do NOT redesign or alter the furniture in any way — keep the identical shape, proportions, materials, colours, stitching, legs, base, arms and every detail exactly as in the reference image. Only change the camera angle and the studio presentation.`,
    ``,
    `CAMERA FOR THIS VIEW: ${cam}.`,
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
    const r = await fetch(base + "/auth/v1/user", {
      headers: { apikey: key, Authorization: "Bearer " + token },
    });
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
  if (!(await verifySupabaseUser(env, token))) {
    return json(401, { ok: false, error: "Not signed in. Refresh and sign in again." });
  }

  let body;
  try { body = await context.request.json(); } catch (e) { return json(400, { ok: false, error: "Bad JSON body" }); }
  const projectId = String(body && body.projectId || "");
  const view = String(body && body.view || "hero");
  const referenceUrl = String(body && body.referenceUrl || "");
  if (!projectId || !referenceUrl) return json(400, { ok: false, error: "projectId and referenceUrl are required" });

  // 1) Fetch the locked reference image bytes.
  let refBlob;
  try {
    const rr = await fetch(referenceUrl);
    if (!rr.ok) throw new Error("reference fetch " + rr.status);
    refBlob = await rr.blob();
  } catch (e) { return json(400, { ok: false, error: "Could not load reference image" }); }

  // 2) Call OpenAI gpt-image-1 image edit (reference image = base).
  let b64;
  try {
    const fd = new FormData();
    fd.append("model", model);
    fd.append("prompt", buildViewPrompt(view));
    fd.append("size", "1024x1024");
    fd.append("n", "1");
    // gpt-image-1 compresses server-side — target small catalog files.
    fd.append("output_format", "webp");
    fd.append("output_compression", "60");
    fd.append("image", refBlob, "reference.png");

    const or = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: "Bearer " + openaiKey },
      body: fd,
    });
    const oj = await or.json().catch(() => null);
    if (!or.ok || !oj) return json(502, { ok: false, error: "OpenAI error: " + ((oj && oj.error && oj.error.message) || or.status) });
    b64 = oj.data && oj.data[0] && oj.data[0].b64_json;
    if (!b64) return json(502, { ok: false, error: "OpenAI returned no image" });
  } catch (e) { return json(502, { ok: false, error: "Generation failed: " + e.message }); }

  // 3) Upload to Supabase storage (service role), get public URL.
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `${projectId}/${view}-${Date.now()}.webp`;
  try {
    const up = await fetch(`${base}/storage/v1/object/${OUTPUTS_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + serviceKey,
        apikey: serviceKey,
        "Content-Type": "image/webp",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!up.ok) {
      const t = await up.text().catch(() => "");
      return json(502, { ok: false, error: "Storage upload failed: " + t.slice(0, 200) });
    }
  } catch (e) { return json(502, { ok: false, error: "Storage upload failed: " + e.message }); }

  const publicUrl = `${base}/storage/v1/object/public/${OUTPUTS_BUCKET}/${path}`;

  // 4) Record it (demote prior current version for this view, then insert).
  try {
    await fetch(`${base}/rest/v1/studio_generated_images?project_id=eq.${projectId}&view_type=eq.${view}&is_current=eq.true`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + serviceKey, apikey: serviceKey,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({ is_current: false }),
    });
    await fetch(`${base}/rest/v1/studio_generated_images`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + serviceKey, apikey: serviceKey,
        "Content-Type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify({
        project_id: projectId, view_type: view, status: "ready",
        url: publicUrl, thumb_url: publicUrl, bytes: bytes.length,
        model, is_current: true,
      }),
    });
  } catch (e) { /* image is generated + stored; recording is best-effort */ }

  return json(200, { ok: true, url: publicUrl, view, bytes: bytes.length });
}
