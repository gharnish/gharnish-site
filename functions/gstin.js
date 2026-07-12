// Cloudflare Pages Function — GET /api/gstin?gstin=XXXXXXXXXXXXXXX
// Looks up a GSTIN in government records via a GSP provider and returns
// { legalName, tradeName, address, stateCode, status }.
//
// Security: requires a valid Supabase login token (same guard as /ai/quote-parse).
//
// Provider keys (Pages -> Settings -> Variables and secrets) — set ONE:
//   APPYFLOW_KEY     — free tier at appyflow.in (recommended to start)
//   GSTINCHECK_KEY   — sheet.gstincheck.co.in
//   GSTIN_API_URL    — advanced: any GET URL template containing {gstin}

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";

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
    const r = await fetch(base + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + token } });
    return r.ok;
  } catch (e) { return false; }
}

function joinAddr(parts) {
  return parts.map(x => (x == null ? "" : String(x).trim())).filter(Boolean).join(", ");
}

function normFromAppyflow(t) {
  const a = (t && t.pradr && t.pradr.addr) || {};
  return {
    legalName: t.lgnm || null,
    tradeName: t.tradeNam || null,
    address: joinAddr([a.flno, a.bno, a.bnm, a.st, a.loc, a.city, a.dst, a.stcd, a.pncd]) || null,
    status: t.sts || null
  };
}

function normGeneric(d) {
  // Best-effort mapping across common GSP response shapes
  const t = d.taxpayerInfo || d.data || d;
  if (!t || typeof t !== "object") return null;
  let address = null, status = t.sts || t.status || null;
  const pr = t.pradr || {};
  if (typeof pr.adr === "string") address = pr.adr;
  else if (pr.addr) address = joinAddr([pr.addr.flno, pr.addr.bno, pr.addr.bnm, pr.addr.st, pr.addr.loc, pr.addr.city, pr.addr.dst, pr.addr.stcd, pr.addr.pncd]);
  else if (typeof t.address === "string") address = t.address;
  return {
    legalName: t.lgnm || t.legalName || null,
    tradeName: t.tradeNam || t.tradeName || null,
    address: address || null,
    status
  };
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const url = new URL(context.request.url);
  const gstin = String(url.searchParams.get("gstin") || "").toUpperCase().trim();

  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return json(400, { ok: false, error: "Invalid GSTIN format" });
  }

  const auth = context.request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!(await verifySupabaseUser(env, token))) {
    return json(401, { ok: false, error: "Not signed in" });
  }

  let norm = null, provErr = null;
  try {
    if (env.APPYFLOW_KEY) {
      const r = await fetch("https://appyflow.in/api/verifyGST?gstNo=" + gstin + "&key_secret=" + encodeURIComponent(env.APPYFLOW_KEY));
      const d = await r.json().catch(() => null);
      if (d && d.taxpayerInfo) norm = normFromAppyflow(d.taxpayerInfo);
      else provErr = (d && (d.message || d.error)) || ("provider status " + r.status);
    } else if (env.GSTINCHECK_KEY) {
      const r = await fetch("https://sheet.gstincheck.co.in/check/" + encodeURIComponent(env.GSTINCHECK_KEY) + "/" + gstin);
      const d = await r.json().catch(() => null);
      if (d && (d.flag === true || d.data)) norm = normGeneric(d);
      else provErr = (d && d.message) || ("provider status " + r.status);
    } else if (env.GSTIN_API_URL) {
      const r = await fetch(String(env.GSTIN_API_URL).replace("{gstin}", gstin));
      const d = await r.json().catch(() => null);
      if (d) norm = normGeneric(d);
      else provErr = "provider status " + r.status;
    } else {
      return json(500, { ok: false, error: "No GST provider configured. Add APPYFLOW_KEY (free at appyflow.in) in Cloudflare Pages -> Settings -> Variables and secrets, then retry deployment." });
    }
  } catch (e) {
    return json(502, { ok: false, error: "GST provider unreachable" });
  }

  if (!norm || (!norm.legalName && !norm.tradeName && !norm.address)) {
    return json(502, { ok: false, error: provErr || "GSTIN not found in records" });
  }

  norm.stateCode = gstin.slice(0, 2);
  return json(200, { ok: true, data: norm });
}
