// Cloudflare Pages Function — POST /ai/quote-parse
// Quote Copilot: turns a raw customer message (WhatsApp text etc.) into
// structured quote line items matched against the Gharnish catalogue.
//
// Security: caller must send a valid Supabase access token (the admin/manager
// login session). The Anthropic key lives ONLY here, server-side.
//
// Required env (Pages -> Settings -> Variables and secrets):
//   ANTHROPIC_API_KEY   (secret)  — from console.anthropic.com
// Optional:
//   ANTHROPIC_MODEL     — default "claude-haiku-4-5"
//   SUPABASE_URL        — default project URL below

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const MODEL_DEFAULT = "claude-haiku-4-5";

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

async function verifySupabaseUser(env, token) {
  if (!token) return false;
  const base = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const key = env.SUPABASE_KEY || SUPABASE_KEY_DEFAULT;
  try {
    const r = await fetch(base + "/auth/v1/user", {
      headers: { apikey: key, Authorization: "Bearer " + token }
    });
    return r.ok;
  } catch (e) { return false; }
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
  if (!apiKey) {
    return json(500, { ok: false, error: "ANTHROPIC_API_KEY is not set. Add it in Cloudflare Pages -> Settings -> Variables and secrets, then redeploy." });
  }

  // --- auth: only signed-in Gharnish users may spend AI credits ---
  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const okUser = await verifySupabaseUser(env, token);
  if (!okUser) return json(401, { ok: false, error: "Not signed in. Refresh the admin and sign in again." });

  // --- input ---
  let body;
  try { body = await context.request.json(); } catch (e) { return json(400, { ok: false, error: "Bad JSON body" }); }
  const message = String(body && body.message || "").slice(0, 8000);
  const catalog = Array.isArray(body && body.catalog) ? body.catalog.slice(0, 1500) : [];
  if (!message.trim()) return json(400, { ok: false, error: "Empty message" });

  const catLines = catalog
    .map(p => (p && p.id ? (String(p.id) + " | " + String(p.name || "").slice(0, 90) + " | " + (Number(p.price) || 0)) : null))
    .filter(Boolean)
    .join("\n");

  const prompt =
    "You convert a furniture customer's raw message into quote line items for Gharnish (restaurant & residential furniture, India).\n\n" +
    "CATALOGUE (one per line: id | name | price INR):\n" + catLines + "\n\n" +
    "CUSTOMER MESSAGE:\n\"\"\"\n" + message + "\n\"\"\"\n\n" +
    "Rules:\n" +
    "- Match each requested item to the closest catalogue entry by meaning (handle plurals, colours, seater counts, 'same as last time' style phrasing cannot be resolved -> unmatched).\n" +
    "- qty: integer, default 1. rate: ONLY if the message states a price for that item, else null (the catalogue price will be used).\n" +
    "- If an item cannot be confidently matched, set pid to null and give a clear descriptive name.\n" +
    "- transport / labour: numbers only if the message mentions transport/delivery or loading/labour charges, else null.\n" +
    "- notes: one short sentence about anything ambiguous or assumed, else null.\n\n" +
    "Respond with ONLY this JSON, no other text:\n" +
    '{"items":[{"pid":"<catalogue id or null>","name":"<name>","qty":1,"rate":null}],"transport":null,"labour":null,"notes":null}';

  let up;
  try {
    up = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || MODEL_DEFAULT,
        max_tokens: 2000,
        temperature: 0,
        messages: [{ role: "user", content: prompt }]
      })
    });
  } catch (e) {
    return json(502, { ok: false, error: "Could not reach the AI service" });
  }

  const data = await up.json().catch(() => null);
  if (!up.ok) {
    const msg = (data && data.error && data.error.message) || ("AI error " + up.status);
    return json(502, { ok: false, error: msg });
  }

  const text = (data && data.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
  const parsed = extractJson(text);
  if (!parsed || !Array.isArray(parsed.items)) {
    return json(502, { ok: false, error: "AI returned an unreadable result — try again" });
  }

  // sanitise
  const items = parsed.items.slice(0, 40).map(it => ({
    pid: it && it.pid ? String(it.pid) : null,
    name: String((it && it.name) || "Item").slice(0, 140),
    qty: Math.max(1, Math.round(Number(it && it.qty) || 1)),
    rate: (it && it.rate != null && Number(it.rate) > 0) ? Number(it.rate) : null
  }));

  return json(200, {
    ok: true,
    data: {
      items,
      transport: (parsed.transport != null && Number(parsed.transport) > 0) ? Number(parsed.transport) : null,
      labour: (parsed.labour != null && Number(parsed.labour) > 0) ? Number(parsed.labour) : null,
      notes: parsed.notes ? String(parsed.notes).slice(0, 300) : null
    }
  });
}
