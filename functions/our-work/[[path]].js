// Cloudflare Pages Function — GET /our-work  and  /our-work/<slug>
// Server-renders a crawlable HTML page for the projects portfolio (landing)
// and for each individual project (detail), so Google & AI crawlers index the
// real content instead of the empty SPA shell. Human visitors get the same
// content plus a link into the live app experience.
//
// Routes:
//   /our-work            → landing page listing all visible projects
//   /our-work/<slug>     → one project (slug = ghSlug(name + '-' + id))
//
// Env overrides (Pages → Settings → Variables), optional:
//   SUPABASE_URL, SUPABASE_KEY, SITE_ORIGIN

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT  = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const SITE_ORIGIN_DEFAULT   = "https://gharnish.app";

function ghSlug(s) {
  return String(s == null ? "" : s).toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function projSlug(p) { return ghSlug((p.name || "") + "-" + (p.id || "")); }
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function mediaKind(m) {
  m = String(m || "");
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(m)) return "video";
  if (/youtube|youtu\.be|vimeo/i.test(m)) return "embed";
  if (/^https?:\/\//i.test(m)) return "image";
  return "image";
}

async function sb(base, key, path) {
  const r = await fetch(base + "/rest/v1/" + path, {
    headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" }
  });
  if (!r.ok) return [];
  return r.json().catch(() => []);
}

/* ---------- shared shell ---------- */
function page({ title, desc, canonical, origin, jsonld, body }) {
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="robots" content="index,follow">
${jsonld ? '<script type="application/ld+json">' + jsonld + "</script>" : ""}
<style>
  :root{--ivory:#FAF7F1;--ink:#171310;--ink2:#6B5E4A;--ink3:#9C8F7A;--gold:#C8860A;--line:rgba(23,19,16,.09);--card:#fff}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ivory);color:var(--ink);font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.5}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1120px;margin:0 auto;padding:0 20px}
  header.top{background:#171310;color:#fff;padding:14px 0}
  header.top .wrap{display:flex;align-items:center;gap:14px}
  .brand{font-size:20px;font-weight:800;letter-spacing:-.01em}
  .brand span{color:var(--gold)}
  .top nav{margin-left:auto;display:flex;gap:20px;font-size:14px;font-weight:600}
  .top nav a{color:rgba(255,255,255,.82)}
  .hero{padding:48px 0 26px}
  .eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:800}
  h1{font-size:clamp(30px,5vw,46px);font-weight:800;letter-spacing:-.02em;margin:6px 0 12px;line-height:1.05}
  .lead{font-size:17px;color:var(--ink2);max-width:640px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px;padding:14px 0 60px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;display:block;transition:transform .15s,box-shadow .15s}
  .card:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(23,19,16,.08)}
  .card .ph{aspect-ratio:16/10;background-size:cover;background-position:center;position:relative}
  .card .ph .ov{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(23,19,16,.62))}
  .card .badge{position:absolute;top:12px;left:12px;background:rgba(23,19,16,.6);backdrop-filter:blur(6px);color:#fff;font-size:11px;font-weight:700;padding:4px 11px;border-radius:999px}
  .card .cn{position:absolute;left:14px;bottom:12px;right:14px;color:#fff}
  .card .cn h3{margin:0;font-size:21px;font-weight:800;letter-spacing:-.01em}
  .card .cn .loc{font-size:12.5px;opacity:.9;margin-top:2px}
  .card .meta{padding:14px;display:flex;gap:16px;color:var(--ink3);font-size:12.5px;font-weight:600}
  .card .meta b{color:var(--ink);font-weight:800}
  /* detail */
  .detail-hero{border-radius:22px;overflow:hidden;margin:8px 0 26px;position:relative;min-height:280px;background-size:cover;background-position:center;color:#fff;display:flex;flex-direction:column;justify-content:flex-end;padding:28px}
  .detail-hero .ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(23,19,16,.15),rgba(23,19,16,.72))}
  .detail-hero>*{position:relative}
  .facts{display:flex;flex-wrap:wrap;gap:14px 30px;margin:0 0 26px}
  .fact .l{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink3);font-weight:800}
  .fact .v{font-size:16px;font-weight:800}
  .sec-h{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);font-weight:800;margin:26px 0 12px}
  .fitems{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
  .fitem{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}
  .fitem img{width:52px;height:52px;border-radius:10px;object-fit:cover;flex:none;background:#eee}
  .fitem .nm{font-size:13.5px;font-weight:700}
  .fitem .qp{font-size:12px;color:var(--ink3)}
  .gal{display:flex;gap:12px;overflow-x:auto;padding-bottom:6px;margin-bottom:8px}
  .gal img{height:210px;border-radius:14px;flex:none}
  .cta{display:inline-flex;align-items:center;gap:9px;background:var(--gold);color:#fff;font-weight:800;font-size:15px;padding:14px 26px;border-radius:999px;margin:26px 0 10px}
  .backlink{display:inline-flex;align-items:center;gap:7px;color:var(--ink2);font-weight:600;font-size:14px;margin:24px 0 6px}
  footer{border-top:1px solid var(--line);padding:30px 0;color:var(--ink3);font-size:13px}
  @media(max-width:600px){.top nav{display:none}}
</style>
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="${esc(origin)}/">Gharnis<span>h</span></a>
<nav><a href="${esc(origin)}/our-work">Our Work</a><a href="${esc(origin)}/shop">Shop</a><a href="${esc(origin)}/estimate">Get an Estimate</a></nav></div></header>
${body}
<footer><div class="wrap">Gharnish — Restaurant &amp; café furniture, Hyderabad &amp; Bangalore. Ready stock, 2–7 day pan-India delivery. <a href="${esc(origin)}/" style="color:var(--gold);font-weight:700">Explore the catalogue →</a></div></footer>
</body></html>`;
}

/* ---------- landing ---------- */
function renderLanding(projects, origin) {
  const cards = projects.map(p => {
    const img = (p.media || []).filter(m => mediaKind(m) === "image")[0];
    const ph = img
      ? `style="background-image:url('${esc(img)}')"`
      : `style="background:linear-gradient(140deg,${esc(p.color || "#C8860A")},rgba(0,0,0,.5))"`;
    return `<a class="card" href="${esc(origin)}/our-work/${esc(projSlug(p))}">
      <div class="ph" ${ph}><div class="ov"></div>
        ${p.type ? `<span class="badge">${esc(p.type)}</span>` : ""}
        <div class="cn"><h3>${esc(p.name)}</h3>${p.loc ? `<div class="loc">${esc(p.loc)}</div>` : ""}</div>
      </div>
      <div class="meta">${p.covers ? `<span><b>${esc(p.covers)}</b> covers</span>` : ""}${p.year ? `<span><b>${esc(p.year)}</b></span>` : ""}${p.budget ? `<span>${esc(p.budget)}</span>` : ""}</div>
    </a>`;
  }).join("\n");

  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Our Work — Restaurant & Café Projects by Gharnish",
    description: "Completed restaurant, café and hospitality furniture projects across Hyderabad and Bangalore.",
    url: origin + "/our-work",
    hasPart: projects.map(p => ({
      "@type": "CreativeWork", name: p.name,
      about: (p.type || "") + (p.loc ? " in " + p.loc : ""),
      url: origin + "/our-work/" + projSlug(p)
    }))
  });

  const body = `<main class="wrap">
    <section class="hero">
      <div class="eyebrow">Our Work</div>
      <h1>Restaurants &amp; cafés we've furnished</h1>
      <p class="lead">Real hospitality spaces across Hyderabad and Bangalore — furnished from ready stock and delivered in days. Explore a project, then recreate its exact setup in one tap.</p>
    </section>
    <div class="grid">${cards}</div>
  </main>`;

  return page({
    title: "Our Work — Restaurant & Café Furniture Projects | Gharnish",
    desc: "Browse completed restaurant, café, bar and hotel furniture projects by Gharnish across Hyderabad & Bangalore. Recreate any setup and get a quote.",
    canonical: origin + "/our-work",
    origin, jsonld, body
  });
}

/* ---------- detail ---------- */
function renderDetail(p, links, origin) {
  const img = (p.media || []).filter(m => mediaKind(m) === "image")[0];
  const heroBg = img
    ? `background-image:url('${esc(img)}')`
    : `background:linear-gradient(140deg,${esc(p.color || "#C8860A")},rgba(0,0,0,.55))`;

  const facts = [
    p.loc && ["Location", p.loc],
    p.covers && ["Seating", p.covers + " covers"],
    p.budget && ["Budget", p.budget],
    p.timeline && ["Delivery", p.timeline],
    p.year && ["Year", String(p.year)],
  ].filter(Boolean).map(([l, v]) =>
    `<div class="fact"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`
  ).join("");

  const gallery = (p.media || []).filter(m => mediaKind(m) === "image").slice(0, 8)
    .map(m => `<img src="${esc(m)}" alt="${esc(p.name)}" loading="lazy" height="210">`).join("");

  let furniture = "";
  if (links && links.length) {
    furniture = `<div class="sec-h">Furniture used in this project</div><div class="fitems">` +
      links.map(l => {
        const pr = l._p || {};
        const im = pr.image ? `<img src="${esc(pr.image)}" alt="${esc(pr.name || "")}">` : `<div style="width:52px;height:52px;border-radius:10px;background:#eee;flex:none"></div>`;
        return `<div class="fitem">${im}<div><div class="nm">${esc(pr.name || l.product_id)}</div><div class="qp">${esc(l.default_qty || 1)} × ${pr.price ? "₹" + Number(pr.price).toLocaleString("en-IN") : ""}</div></div></div>`;
      }).join("") + `</div>`;
  } else if (p.products) {
    furniture = `<div class="sec-h">Furniture supplied</div><div class="fitems">` +
      String(p.products).split(",").map(t => t.trim()).filter(Boolean).map(t =>
        `<div class="fitem"><div style="width:52px;height:52px;border-radius:10px;background:#F2ECE1;flex:none"></div><div class="nm">${esc(t)}</div></div>`
      ).join("") + `</div>`;
  }

  const appUrl = origin + "/?p=" + esc(p.id);
  const jsonld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: p.name,
    description: (p.type || "Restaurant") + (p.loc ? " in " + p.loc : "") + " furnished by Gharnish" + (p.covers ? ", " + p.covers + " covers" : "") + ".",
    url: origin + "/our-work/" + projSlug(p),
    locationCreated: p.loc || undefined,
    dateCreated: p.year ? String(p.year) : undefined,
    creator: { "@type": "Organization", name: "Gharnish", url: origin },
    image: img || undefined
  });

  const body = `<main class="wrap">
    <a class="backlink" href="${esc(origin)}/our-work">← All projects</a>
    <div class="detail-hero" style="${heroBg}">
      <div class="ov"></div>
      ${p.type ? `<div class="eyebrow" style="color:#f0d9a8">${esc(p.type)}${p.year ? " · " + esc(p.year) : ""}</div>` : ""}
      <h1 style="color:#fff;margin:6px 0 4px">${esc(p.name)}</h1>
      ${p.loc ? `<div style="opacity:.9">${esc(p.loc)}</div>` : ""}
    </div>
    <div class="facts">${facts}</div>
    ${gallery ? `<div class="gal">${gallery}</div>` : ""}
    ${p.desc ? `<div class="sec-h">The brief</div><p style="max-width:680px;color:var(--ink2);font-size:15.5px">${esc(p.desc)}</p>` : ""}
    ${furniture}
    <div><a class="cta" href="${esc(appUrl)}">✨ Start With This Setup</a></div>
    <p style="color:var(--ink3);font-size:13px;margin-top:2px">Loads every piece into your quote. Adjust quantities, then request pricing.</p>
  </main>`;

  return page({
    title: p.name + " — " + (p.type || "Restaurant") + " Furniture" + (p.loc ? " · " + p.loc : "") + " | Gharnish",
    desc: (p.name + " — a " + (p.type || "restaurant") + (p.loc ? " in " + p.loc : "") + " furnished by Gharnish" + (p.covers ? " (" + p.covers + " covers)" : "") + ". See the furniture used and recreate the setup.").slice(0, 300),
    canonical: origin + "/our-work/" + projSlug(p),
    origin, jsonld, body
  });
}

/* ---------- handler ---------- */
export async function onRequestGet(context) {
  const env = context.env || {};
  const base   = (env.SUPABASE_URL || SUPABASE_URL_DEFAULT).replace(/\/+$/, "");
  const key    = env.SUPABASE_KEY || SUPABASE_KEY_DEFAULT;
  const origin = (env.SITE_ORIGIN || SITE_ORIGIN_DEFAULT).replace(/\/+$/, "");

  const parts = (context.params && context.params.path) || [];
  const slug = Array.isArray(parts) ? (parts[0] || "") : String(parts || "");

  const projects = await sb(base, key, "projects?select=*&visible=eq.true&order=updated_at.desc");

  // Landing
  if (!slug) {
    return new Response(renderLanding(projects, origin), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=1800" }
    });
  }

  // Detail — match by slug
  const p = projects.find(x => projSlug(x) === slug);
  if (!p) {
    return new Response(renderLanding(projects, origin), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // Joined furniture (with product details) for this project
  let links = [];
  try {
    const rows = await sb(base, key, "project_products?select=product_id,default_qty,sort&project_id=eq." + encodeURIComponent(p.id) + "&order=sort");
    if (rows.length) {
      const ids = rows.map(r => '"' + r.product_id + '"').join(",");
      const prods = await sb(base, key, "gharnish_products?select=id,name,price,image&id=in.(" + encodeURIComponent(ids) + ")");
      const byId = {};
      prods.forEach(pr => { byId[pr.id] = pr; });
      links = rows.map(r => ({ ...r, _p: byId[r.product_id] || {} }));
    }
  } catch (e) { /* fall back to text products */ }

  return new Response(renderDetail(p, links, origin), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=1800" }
  });
}
