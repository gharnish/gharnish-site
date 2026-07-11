// Cloudflare Pages Function — GET /sitemap-products.xml
// Generates a live sitemap of every product URL from Supabase so Google keeps
// discovering products as they're added/removed — no manual sitemap edits.

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT  = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const SITE_ORIGIN_DEFAULT   = "https://gharnish.app";
const PAGE_SIZE = 1000;   // Supabase default max rows per request
const MAX_PAGES = 8;      // safety cap (8k products)

function ghSlug(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function prodSlug(p) {
  return ghSlug((p.name || "") + "-" + (p.id || ""));
}
function xmlEscape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function isoDate(v) {
  if (!v) return null;
  var d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const base   = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const key    = env.SUPABASE_KEY || SUPABASE_KEY_DEFAULT;
  const origin = (env.SITE_ORIGIN || SITE_ORIGIN_DEFAULT).replace(/\/+$/, "");

  let rows = [];
  let selCols = "id,name,updated_at,internal,hidden";
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE, to = from + PAGE_SIZE - 1;
      const url = base + "/rest/v1/gharnish_products?select=" + selCols + "&order=name.asc";
      const r = await fetch(url, {
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          Accept: "application/json",
          Range: from + "-" + to,
          "Range-Unit": "items"
        }
      });
      if (!r.ok) {
        if (page === 0 && selCols !== "id,name,updated_at") { selCols = "id,name,updated_at"; page--; continue; }
        break;
      }
      const chunk = await r.json().catch(() => []);
      if (!Array.isArray(chunk) || !chunk.length) break;
      rows = rows.concat(chunk);
      if (chunk.length < PAGE_SIZE) break;
    }
  } catch (e) { /* fall through — emit whatever we have */ }

  const seen = {};
  const urls = [];
  for (const p of rows) {
    if (!p || (!p.name && !p.id)) continue;
    if (p.internal === true || p.hidden === true) continue;
    const slug = prodSlug(p);
    if (!slug || seen[slug]) continue;
    seen[slug] = 1;
    const lastmod = isoDate(p.updated_at);
    urls.push(
      "  <url><loc>" + xmlEscape(origin + "/product/" + slug) + "</loc>" +
      (lastmod ? "<lastmod>" + lastmod + "</lastmod>" : "") +
      "<changefreq>weekly</changefreq><priority>0.7</priority></url>"
    );
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") + (urls.length ? "\n" : "") +
    "</urlset>\n";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Product-Count": String(urls.length)
    }
  });
}
