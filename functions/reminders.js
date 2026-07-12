// Cloudflare Pages Function — POST /ai/reminders
// Collections Autopilot: drafts personalised, tone-graded WhatsApp payment
// reminders for a batch of delivered-but-unpaid orders.
//
// Security: requires a valid Supabase login token (same guard as other AI fns).
// Env: ANTHROPIC_API_KEY (secret); optional ANTHROPIC_MODEL.

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const MODEL_DEFAULT = "claude-haiku-4-5";

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
async function verifyUser(env, token) {
  if (!token) return false;
  const base = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const key = env.SUPABASE_KEY || SUPABASE_KEY_DEFAULT;
  try { const r = await fetch(base + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + token } }); return r.ok; }
  catch (e) { return false; }
}
function extractJson(text) {
  if (!text) return null;
  let t = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json(500, { ok: false, error: "ANTHROPIC_API_KEY is not set. Add it in Cloudflare Pages -> Settings -> Variables and secrets, then retry deployment." });

  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!(await verifyUser(env, token))) return json(401, { ok: false, error: "Not signed in" });

  let body;
  try { body = await context.request.json(); } catch (e) { return json(400, { ok: false, error: "Bad JSON body" }); }
  const orders = Array.isArray(body && body.orders) ? body.orders.slice(0, 40) : [];
  if (!orders.length) return json(400, { ok: false, error: "No pending orders provided" });

  const lines = orders.map((o, i) =>
    (i + 1) + ". id=" + (o.id || i) +
    " | name=" + String(o.name || "Customer").slice(0, 40) +
    " | order=" + String(o.title || "order").slice(0, 50) +
    " | pending=Rs." + Math.round(Number(o.pending) || 0) +
    " | total=Rs." + Math.round(Number(o.total) || 0) +
    " | days_overdue=" + (Number(o.daysOverdue) || 0)
  ).join("\n");

  const prompt =
    "You write short, warm, professional WhatsApp payment reminders for Gharnish, a premium furniture supplier in India. " +
    "The recipients are business customers (restaurant/cafe owners) whose orders were delivered but have a pending balance.\n\n" +
    "Tone by days_overdue: 0-7 very gentle & friendly; 8-21 polite but clearer; 22+ firm, still courteous and relationship-preserving. " +
    "Never threatening. Each message: greet by first name, state the exact pending amount and what it's for, one clear ask to arrange payment, warm close signed 'Team Gharnish'. " +
    "Keep to 2-4 short sentences, WhatsApp-friendly, plain text, Rupees as 'Rs.'. Indian business English.\n\n" +
    "ORDERS:\n" + lines + "\n\n" +
    "Respond with ONLY this JSON, no other text:\n" +
    '{"drafts":[{"id":"<order id>","message":"<the reminder>"}]}';

  let up;
  try {
    up = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: env.ANTHROPIC_MODEL || MODEL_DEFAULT, max_tokens: 3000, temperature: 0.3, messages: [{ role: "user", content: prompt }] })
    });
  } catch (e) { return json(502, { ok: false, error: "Could not reach the AI service" }); }

  const data = await up.json().catch(() => null);
  if (!up.ok) return json(502, { ok: false, error: (data && data.error && data.error.message) || ("AI error " + up.status) });

  const text = (data && data.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
  const parsed = extractJson(text);
  if (!parsed || !Array.isArray(parsed.drafts)) return json(502, { ok: false, error: "AI returned an unreadable result — try again" });

  const drafts = parsed.drafts.slice(0, 40).map(d => ({ id: d && d.id != null ? String(d.id) : "", message: String((d && d.message) || "").slice(0, 700) })).filter(d => d.id && d.message);
  return json(200, { ok: true, data: { drafts } });
}
