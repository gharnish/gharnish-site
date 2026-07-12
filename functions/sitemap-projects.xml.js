// Cloudflare Pages Function — GET /sitemap-projects.xml
// Live sitemap of every visible project URL (/our-work + /our-work/<slug>)
// so search engines discover and re-crawl completed projects automatically.

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT  = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const SITE_ORIGIN_DEFAULT   = "https://gharnish.app";

function ghSlug(s) {
  return String(s == null ? "" : s).toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function projSlug(p) { return ghSlug((p.name || "") + "-" + (p.id || "")); }
function xmlEscape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function isoDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const base   = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const key    = env.SUPABASE_KEY || SUPABASE_KEY_DEFAULT;
  const origin = (env.SITE_ORIGIN || SITE_ORIGIN_DEFAULT).replace(/\/+$/, "");

  let rows = [];
  try {
    const r = await fetch(base + "/rest/v1/projects?select=id,name,updated_at,visible&visible=eq.true&order=updated_at.desc", {
      headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" }
    });
    if (r.ok) rows = await r.json().catch(() => []);
  } catch (e) { /* emit landing only */ }

  const urls = [];
  urls.push("  <url><loc>" + xmlEscape(origin + "/our-work") + "</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>");
  const seen = {};
  for (const p of rows) {
    if (!p || (!p.name && !p.id)) continue;
    const slug = projSlug(p);
    if (!slug || seen[slug]) continue;
    seen[slug] = 1;
    const lastmod = isoDate(p.updated_at);
    urls.push(
      "  <url><loc>" + xmlEscape(origin + "/our-work/" + slug) + "</loc>" +
      (lastmod ? "<lastmod>" + lastmod + "</lastmod>" : "") +
      "<changefreq>monthly</changefreq><priority>0.7</priority></url>"
    );
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") + "\n</urlset>\n";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Project-Count": String(urls.length - 1)
    }
  });
}
