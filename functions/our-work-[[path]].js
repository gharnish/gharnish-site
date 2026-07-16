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
function ytEmbed(u){
  const m = String(u||"").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/i);
  if(m) return "https://www.youtube-nocookie.com/embed/"+m[1]+"?rel=0&modestbranding=1";
  const v = String(u||"").match(/vimeo\.com\/(\d+)/i);
  if(v) return "https://player.vimeo.com/video/"+v[1];
  return "";
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap');
  :root{--bg:#FFFFFF;--bg2:#F4F6F8;--c1:#FFFFFF;--c2:#F2F4F6;--c3:#E9EDF1;--g:#C8860A;--gl:#E09A18;--gd:#8A5C07;--ink:#1A1510;--ink2:#6B5C40;--ink3:#A89070;--line:#E9EDF1;--dark:#1A1208;--nav:56px;--r2:16px;--r3:22px}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1160px;margin:0 auto;padding:0 22px}
  /* HEADER — matches the live app top-nav */
  header.top{position:sticky;top:0;z-index:200;height:var(--nav);background:rgba(24,18,12,.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.08)}
  header.top .wrap{height:var(--nav);display:flex;align-items:center;gap:14px;max-width:1160px}
  header.top img.logo{height:34px;width:auto;display:block}
  header.top nav{margin-left:auto;display:flex;gap:2px}
  header.top nav a{color:rgba(255,255,255,.72);font-size:14px;font-weight:600;padding:8px 14px;border-radius:9px;transition:color .15s,background .15s}
  header.top nav a:hover{color:#fff;background:rgba(255,255,255,.08)}
  header.top nav a.on{color:#fff;background:rgba(200,134,10,.22)}
  .eyebrow{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--g);font-weight:800}
  h1{font-family:Poppins,sans-serif;font-size:clamp(30px,5vw,46px);font-weight:800;letter-spacing:-.02em;margin:8px 0 12px;line-height:1.03}
  .hero{padding:46px 0 26px}
  .lead{font-size:17px;color:var(--ink2);max-width:660px;line-height:1.6}
  /* landing grid */
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;padding:16px 0 70px}
  .card{background:var(--c1);border:1px solid var(--line);border-radius:var(--r3);overflow:hidden;display:block;box-shadow:0 1px 2px rgba(0,0,0,.04),0 3px 18px rgba(0,0,0,.07);transition:transform .16s,box-shadow .16s}
  .card:hover{transform:translateY(-4px);box-shadow:0 2px 6px rgba(0,0,0,.06),0 10px 30px rgba(0,0,0,.12)}
  .card .ph{aspect-ratio:16/10;background-size:cover;background-position:center;position:relative;background-color:var(--c2)}
  .card .ph .ov{position:absolute;inset:0;background:linear-gradient(180deg,transparent 42%,rgba(23,19,16,.66))}
  .card .badge{position:absolute;top:13px;left:13px;background:rgba(24,18,12,.6);backdrop-filter:blur(6px);color:#fff;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.14)}
  .card .cn{position:absolute;left:16px;bottom:14px;right:16px;color:#fff}
  .card .cn h3{margin:0;font-family:Poppins,sans-serif;font-size:22px;font-weight:800;letter-spacing:-.01em}
  .card .cn .loc{font-size:12.5px;opacity:.92;margin-top:3px}
  .card .meta{padding:15px 16px;display:flex;gap:16px;align-items:center;color:var(--ink3);font-size:12.5px;font-weight:600}
  .card .meta b{color:var(--ink);font-weight:800}
  .card .meta .go{margin-left:auto;color:var(--g);font-weight:800}
  /* detail */
  .backlink{display:inline-flex;align-items:center;gap:7px;color:var(--ink2);font-weight:600;font-size:14px;margin:24px 0 4px}
  .backlink:hover{color:var(--ink)}
  .detail-hero{border-radius:var(--r3);overflow:hidden;margin:10px 0 28px;position:relative;min-height:clamp(300px,44vw,420px);background-size:cover;background-position:center;background-color:var(--c2);color:#fff;display:flex;flex-direction:column;justify-content:flex-end;padding:32px}
  .detail-hero .ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(23,19,16,.1) 0%,rgba(23,19,16,.35) 50%,rgba(23,19,16,.82) 100%)}
  .detail-hero>*{position:relative}
  .detail-hero h1{color:#fff;margin:8px 0 5px;max-width:760px}
  .facts{display:flex;flex-wrap:wrap;gap:16px 38px;margin:0 0 28px;padding-bottom:24px;border-bottom:1px solid var(--line)}
  .fact .l{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink3);font-weight:800;margin-bottom:2px}
  .fact .v{font-size:17px;font-weight:800}
  .sec-h{font-size:11.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--g);font-weight:800;margin:32px 0 14px}
  .brief{font-size:clamp(18px,2.2vw,22px);font-weight:500;line-height:1.5;color:var(--ink);max-width:720px}
  .fitems{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
  .fitem{display:flex;align-items:center;gap:12px;background:var(--c1);border:1px solid var(--line);border-radius:var(--r2);padding:12px}
  .fitem img{width:54px;height:54px;border-radius:11px;object-fit:cover;flex:none;background:var(--c2)}
  .fitem .ph{width:54px;height:54px;border-radius:11px;background:var(--c2);flex:none}
  .fitem .nm{font-size:13.5px;font-weight:700;line-height:1.25}
  .fitem .qp{font-size:12px;color:var(--ink3);margin-top:2px}
  .gal{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;margin-bottom:6px}
  .gal img{height:220px;border-radius:var(--r2);flex:none;object-fit:cover}
  .collage{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:6px 0 10px}
  .col-img,.col-vid{border-radius:var(--r2);overflow:hidden;background:var(--c2)}
  .col-img{aspect-ratio:1/1}
  .col-img img{width:100%;height:100%;object-fit:cover;display:block}
  .col-vid{grid-column:span 2;grid-row:span 2;aspect-ratio:1/1;background:#000}
  .col-vid iframe,.col-vid video{width:100%;height:100%;border:0;display:block;object-fit:cover}
  @media(max-width:560px){.collage{grid-template-columns:repeat(2,1fr)}.col-vid{grid-column:span 2;grid-row:span 1;aspect-ratio:16/10}}
  .cta{display:inline-flex;align-items:center;gap:9px;background:var(--g);color:#fff;font-weight:800;font-size:15px;padding:15px 30px;border-radius:999px;margin:32px 0 8px;box-shadow:0 8px 22px rgba(200,134,10,.3);transition:transform .16s,background .16s}
  .cta:hover{transform:translateY(-2px);background:var(--gl)}
  footer{border-top:1px solid var(--line);padding:34px 0;color:var(--ink3);font-size:13.5px;margin-top:36px;background:var(--bg2)}
  footer a{color:var(--g);font-weight:700}
  /* section headers */
  .sec-h2{font-family:Poppins,sans-serif;font-size:22px;font-weight:800;letter-spacing:-.01em;margin:18px 0 14px;color:var(--ink)}
  /* product browse */
  .pbrowse{margin:40px 0 20px;border-top:1px solid var(--line);padding-top:30px}
  .pb-row-h{display:flex;align-items:baseline;justify-content:space-between;margin:22px 0 12px}
  .pb-row-h h3{margin:0;font-size:16px;font-weight:800;color:var(--ink)}
  .pb-all{color:var(--g);font-weight:800;font-size:13px}
  .pb-row{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x proximity}
  .pcard{flex:none;width:168px;background:var(--c1);border:1px solid var(--line);border-radius:var(--r2);overflow:hidden;scroll-snap-align:start;transition:transform .16s,box-shadow .16s}
  .pcard:hover{transform:translateY(-3px);box-shadow:0 8px 22px rgba(0,0,0,.1)}
  .pc-ph{aspect-ratio:1/1;background-size:cover;background-position:center;background-color:var(--c2)}
  .pc-noimg{display:flex;align-items:center;justify-content:center;color:var(--ink3);font-size:34px}
  .pc-b{padding:11px 12px}
  .pc-n{font-size:13px;font-weight:700;line-height:1.3;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px}
  .pc-p{font-size:13.5px;font-weight:800;color:var(--g);margin-top:5px}
  .look-total{display:flex;align-items:center;justify-content:space-between;max-width:420px;margin:16px 0 4px;padding:14px 18px;background:var(--bg2);border:1px solid var(--line);border-radius:var(--r2);font-size:14px;color:var(--ink2)}
  .look-total b{font-size:19px;color:var(--ink);font-weight:800}
  @media(max-width:640px){header.top nav a{display:none}.hero{padding:34px 0 18px}}
</style>
</head>
<body>
<header class="top"><div class="wrap"><a href="${esc(origin)}/" aria-label="Gharnish home"><img class="logo" src="data:image/webp;base64,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" alt="Gharnish"></a><nav><a href="${esc(origin)}/">Home</a><a href="${esc(origin)}/shop">Shop Furniture</a><a href="${esc(origin)}/estimate">Get an Estimate</a><a href="${esc(origin)}/our-work" class="on">Our Work</a><a href="${esc(origin)}/guides">Guides</a></nav></div></header>
${body}
<footer><div class="wrap">Gharnish — Restaurant &amp; café furniture, Hyderabad &amp; Bangalore. Ready stock, 2–7 day pan-India delivery. <a href="${esc(origin)}/" style="color:var(--gold);font-weight:700">Explore the catalogue →</a></div></footer>
</body></html>`;
}

/* ---------- landing ---------- */
function renderLanding(projects, products, origin) {
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
      <div class="meta">${p.covers ? `<span><b>${esc(p.covers)}</b> covers</span>` : ""}${p.year ? `<span><b>${esc(p.year)}</b></span>` : ""}${p.budget ? `<span>${esc(p.budget)}</span>` : ""}<span class="go">Buy this look \u2192</span></div>
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

  // Product browse rows by category
  const prodSection = renderProductBrowse(products, origin);

  const body = `<main class="wrap">
    <section class="hero">
      <div class="eyebrow">Shop the Look</div>
      <h1>Browse real restaurant setups &amp; buy the look</h1>
      <p class="lead">Every space below is a real Gharnish project across Hyderabad and Bangalore. Open any look to see the exact furniture used — then add it all to your quote in one tap. Or browse the full catalogue further down.</p>
    </section>
    <div class="sec-h2">Buy the look — real projects</div>
    <div class="grid">${cards}</div>
    ${prodSection}
  </main>`;

  return page({
    title: "Our Work — Restaurant & Café Furniture Projects | Gharnish",
    desc: "Browse completed restaurant, café, bar and hotel furniture projects by Gharnish across Hyderabad & Bangalore. Recreate any setup and get a quote.",
    canonical: origin + "/our-work",
    origin, jsonld, body
  });
}

/* ---------- product browse (on landing) ---------- */
function catLabel(c){
  const map={ "chair":"Indoor Chairs","stool":"Bar Stools","outdoor-chair":"Outdoor Chairs",
    "table-round":"Tables","table-square":"Tables","table-rect":"Tables","restaurant-tables":"Restaurant Tables",
    "table-base":"Table Bases","booth":"Booth & Sofas","restaurant-set":"Restaurant Sets" };
  return map[c] || "Furniture";
}
function prodCard(p, origin){
  const im = p.image
    ? `<div class="pc-ph" style="background-image:url('${esc(p.image)}')"></div>`
    : `<div class="pc-ph pc-noimg">◻</div>`;
  const price = p.price ? "₹" + Number(p.price).toLocaleString("en-IN") : "";
  return `<a class="pcard" href="${esc(origin)}/?product=${esc(p.id)}">
    ${im}
    <div class="pc-b"><div class="pc-n">${esc(p.name || "")}</div>
    ${price ? `<div class="pc-p">${price}</div>` : ""}</div>
  </a>`;
}
function renderProductBrowse(products, origin){
  if(!products || !products.length) return "";
  // group into a few useful buckets
  const buckets = [
    { key:"chairs", label:"Restaurant Chairs", test:p => /chair/i.test(p.cat||"") && !/outdoor/i.test(p.cat||"") },
    { key:"tables", label:"Tables & Bases", test:p => /table/i.test(p.cat||"") },
    { key:"stools", label:"Bar Stools", test:p => /stool/i.test(p.cat||"") },
    { key:"booth",  label:"Booths & Sofas", test:p => /booth|sofa/i.test(p.cat||"") },
    { key:"outdoor",label:"Outdoor", test:p => /outdoor/i.test(p.cat||"") },
  ];
  let html = `<section class="pbrowse"><div class="sec-h2">Browse the full range</div>`;
  buckets.forEach(b => {
    const items = products.filter(b.test).slice(0, 10);
    if(!items.length) return;
    html += `<div class="pb-row-h"><h3>${esc(b.label)}</h3><a class="pb-all" href="${esc(origin)}/?cat=${esc(b.key)}">View all →</a></div>
      <div class="pb-row">${items.map(p => prodCard(p, origin)).join("")}</div>`;
  });
  html += `<div style="text-align:center;margin:30px 0 10px"><a class="cta" href="${esc(origin)}/?view=catalog">Browse full catalogue →</a></div></section>`;
  return html;
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

  const galImgs = (p.media || []).filter(m => mediaKind(m) === "image");
  const galVids = (p.media || []).filter(m => { const k = mediaKind(m); return k === "video" || k === "embed"; });
  let gallery = "";
  if (galImgs.length || galVids.length) {
    gallery = '<div class="collage">';
    galVids.forEach(m => {
      const emb = ytEmbed(m);
      if (emb) gallery += `<div class="col-vid"><iframe src="${esc(emb)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen title="${esc(p.name)} video"></iframe></div>`;
      else gallery += `<div class="col-vid"><video src="${esc(m)}" controls playsinline preload="metadata"></video></div>`;
    });
    galImgs.slice(0, 9).forEach(m => {
      gallery += `<div class="col-img"><img src="${esc(m)}" alt="${esc(p.name)}" loading="lazy"></div>`;
    });
    gallery += '</div>';
  }

  let furniture = "";
  if (links && links.length) {
    let total = 0;
    links.forEach(l => { const pr = l._p || {}; total += (Number(pr.price) || 0) * (Number(l.default_qty) || 1); });
    furniture = `<div class="sec-h">🛋 Buy this look</div>
      <p style="color:var(--ink2);font-size:14.5px;margin:-4px 0 16px;max-width:680px">The exact pieces used in ${esc(p.name)} — add them all to your quote in one tap, then adjust quantities.</p>
      <div class="fitems">` +
      links.map(l => {
        const pr = l._p || {};
        const im = pr.image ? `<img src="${esc(pr.image)}" alt="${esc(pr.name || "")}">` : `<div style="width:54px;height:54px;border-radius:11px;background:#eee;flex:none"></div>`;
        const line = (Number(pr.price)||0) * (Number(l.default_qty)||1);
        return `<a class="fitem" href="${esc(origin)}/?product=${esc(l.product_id)}">${im}<div style="flex:1"><div class="nm">${esc(pr.name || l.product_id)}</div><div class="qp">${esc(l.default_qty || 1)} × ${pr.price ? "₹" + Number(pr.price).toLocaleString("en-IN") : "—"}${line ? `  ·  <b style="color:var(--ink)">₹${line.toLocaleString("en-IN")}</b>` : ""}</div></div></a>`;
      }).join("") + `</div>` +
      (total ? `<div class="look-total"><span>Look total (indicative)</span><b>₹${total.toLocaleString("en-IN")}</b></div>` : "");
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
    ${gallery}
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
    // products for the browse section (exclude hidden/internal/residential)
    let products = [];
    try {
      products = await sb(base, key, "gharnish_products?select=id,name,cat,price,image,bestseller,sort,hidden,internal,section&order=bestseller.desc,sort.asc");
      products = products.filter(p => !p.hidden && !p.internal && p.section !== "residential");
    } catch (e) { products = []; }
    return new Response(renderLanding(projects, products, origin), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=1800" }
    });
  }

  // Detail — match by slug
  const p = projects.find(x => projSlug(x) === slug);
  if (!p) {
    return new Response(renderLanding(projects, [], origin), {
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
