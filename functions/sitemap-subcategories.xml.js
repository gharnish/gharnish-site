// Cloudflare Pages Function — GET /sitemap-subcategories.xml
// Live sitemap of every /shop/<parentKey>/<subcategory> landing page, read from
// app_settings.subcategories so new/renamed subcategories are discovered
// automatically — no manual sitemap edits.

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT  = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const SITE_ORIGIN_DEFAULT   = "https://gharnish.app";

function ghSlug(s) {
  return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function xmlEscape(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const base   = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const key    = env.SUPABASE_KEY || SUPABASE_KEY_DEFAULT;
  const origin = (env.SITE_ORIGIN || SITE_ORIGIN_DEFAULT).replace(/\/+$/, "");

  let subs = {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(base + "/rest/v1/app_settings?select=value&key=eq.subcategories", {
      headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (r.ok) {
      const data = await r.json().catch(() => []);
      const v = Array.isArray(data) && data[0] ? data[0].value : null;
      if (v && typeof v === "object") subs = v;
    }
  } catch (e) { /* emit whatever we have */ }

  const seen = {};
  const urls = [];
  Object.keys(subs).forEach(function (parentKey) {
    const list = subs[parentKey] || [];
    list.forEach(function (s) {
      if (!s || !s.name) return;
      const loc = origin + "/shop/" + parentKey + "/" + ghSlug(s.name);
      if (seen[loc]) return;
      seen[loc] = 1;
      urls.push(
        "  <url><loc>" + xmlEscape(loc) + "</loc>" +
        "<changefreq>weekly</changefreq><priority>0.8</priority></url>"
      );
    });
  });

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") + (urls.length ? "\n" : "") +
    "</urlset>\n";

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Subcategory-Count": String(urls.length)
    }
  });
}
