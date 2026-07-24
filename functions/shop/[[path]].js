// Cloudflare Pages Function — GET /shop, /shop/residential, /shop/<category>
// Server-renders crawlable, SEO+GEO-optimized category & residential landing
// pages with descriptions, product grids, FAQs (FAQPage schema) and JSON-LD.
//
// Routes:
//   /shop                → all-categories hub
//   /shop/residential    → residential collection landing
//   /shop/<category>     → one category (chairs, tables, stools, booth, outdoor)

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT  = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const SITE_ORIGIN_DEFAULT   = "https://gharnish.app";
const LOGO = "data:image/webp;base64,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";

function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
async function sb(base,key,path){ const r=await fetch(base+"/rest/v1/"+path,{headers:{apikey:key,Authorization:"Bearer "+key,Accept:"application/json"}}); if(!r.ok) return []; return r.json().catch(()=>[]); }

function isResidential(p){ return !!(p && (p.section === "residential" || /^res-/.test(String(p.cat || "")))); }

// Category slugs MUST match sitemap.xml and product/[[path]].js catInfo().
const CATS = {
  "indoor-chair": {
    title: "Restaurant & Café Chairs", h1: "Indoor Restaurant & Café Chairs",
    match: p => /chair/i.test(p.cat||'') && !/outdoor/i.test(p.cat||'') && !isResidential(p),
    intro: "Commercial-grade indoor chairs for restaurants, cafés and bars - metal, PVC, wooden, cushioned and cane designs, all in ready stock for 2-7 day delivery across Hyderabad, Bangalore and pan-India.",
    body: "Gharnish stocks a wide range of hospitality chairs built for daily service: heavy-duty frames, commercial upholstery and finishes that last. From budget PVC stackables for QSRs to teak-and-cane statement chairs for fine-dine, every design ships from ready stock so you furnish in days, not months.",
    faqs: [["What are the best chairs for a restaurant in Hyderabad?", "For high-turnover cafés and QSRs, PVC and metal chairs offer the best durability-to-price ratio. For fine-dine and bars, cushioned, wooden and cane chairs add warmth. Gharnish stocks all of these in Hyderabad and Bangalore for 2-7 day delivery."], ["How much do commercial restaurant chairs cost?", "Gharnish restaurant chairs start from around ₹2,100 and go up to ₹9,000+ for premium teak and cane designs. Bulk pricing applies on orders of 10+ units."], ["Do you deliver restaurant chairs across India?", "Yes. In-stock chairs ship pan-India in 2-7 days from our Hyderabad and Bangalore hubs, with free installation and a 1-year service warranty."], ["Can I order chairs in bulk for a new outlet?", "Yes - bulk tiers unlock at 10, 25, 50 and 100 units. Share your outlet size on WhatsApp and we'll build a seating plan and quote."]]
  },
  "table": {
    title: "Restaurant Tables", h1: "Restaurant & Café Tables",
    match: p => /table/i.test(p.cat||'') && !/base/i.test(p.cat||'') && !isResidential(p),
    intro: "Café and restaurant table tops - ply-laminate, sintered-stone, marble and terrazzo - in round, square and rectangular sizes. Ready stock, delivered across Hyderabad, Bangalore and India in days. Pair with any Gharnish table base.",
    body: "Choose your top material and size independently, then pair with a matching base. 18mm ply-laminate tops come in hundreds of finishes; premium sintered-stone and marble suit fine-dine. Standard café sizes (2x2, 3 ft round) and fine-dine sizes (4x2.5, 6x2.5) are available, all commercial-weighted for daily service.",
    faqs: [["What table top material is best for a restaurant?", "Ply-laminate is the most popular for cafés - durable, low-maintenance and available in hundreds of finishes. For premium fine-dine, sintered stone and marble offer a luxury look with high heat and scratch resistance."], ["What size table do I need for 2 or 4 seaters?", "Cafés typically use 2x2 ft for 2-seaters and 3 ft round or 3x3 ft for 4-seaters. Fine-dine setups use larger 4x2.5 ft or 6x2.5 ft tables. We'll help you size to your covers."], ["Can I mix and match tops and bases?", "Yes. Gharnish table tops and bases are sold to be paired freely, so you can match any top to any base style for your venue."], ["How fast can restaurant tables be delivered in Bangalore?", "In-stock tables deliver in 2-7 days across Bangalore and pan-India, with free installation."]]
  },
  "table-base": {
    title: "Table Bases", h1: "Restaurant Table Bases",
    match: p => /base/i.test(p.cat||'') && !isResidential(p),
    intro: "Commercial-weighted table bases for cafés and restaurants - single-pillar and double-pillar cast iron, plus 4-leg MS frames - built for stability under heavy daily use. Ready stock across Hyderabad and Bangalore.",
    body: "Gharnish table bases are sold separately so you can pair any base with any top. Single-pillar cast iron suits 2-seaters; double-pillar and 4-leg MS frames support larger tops. All bases are powder-coated and weighted for commercial stability, in standard café and fine-dine heights.",
    faqs: [["Can I buy just the table base?", "Yes - Gharnish sells table bases separately so you can pair them with your choice of top, or replace a worn base without changing the top."], ["Which base do I need for my table size?", "Single-pillar cast iron bases suit 2x2 ft and round 2-seaters; double-pillar and 4-leg MS bases are recommended for 4x2 ft and larger tops. Share your top size and we'll recommend the right base."], ["Are the bases stable enough for commercial use?", "Yes - all bases are commercial-weighted and powder-coated, built to stay stable under daily restaurant service."]]
  },
  "bar-stool": {
    title: "Bar Stools", h1: "Bar & Counter Stools",
    match: p => /stool/i.test(p.cat||'') && !isResidential(p),
    intro: "Commercial bar and counter stools for cafés, breweries and bars - metal, wooden and cushioned designs at counter and bar heights. Ready stock, fast delivery across Hyderabad and Bangalore.",
    body: "Gharnish bar stools are built for hospitality: sturdy footrests, commercial upholstery and finishes matched to our chair range so you can coordinate seating across your venue. Available in counter and bar heights.",
    faqs: [["What height bar stool do I need?", "Counter-height stools (~24-26 in seat) suit counters around 36 in; bar-height stools (~28-30 in seat) suit bars around 40-42 in. Tell us your counter height and we'll recommend."], ["Are these stools suitable for commercial use?", "Yes - all Gharnish stools are commercial-grade with reinforced frames and footrests built for daily service."], ["How much do bar stools cost?", "Commercial bar stools start from around ₹3,000, with bulk pricing on 10+ units."]]
  },
  "booth": {
    title: "Booth & Sofa Seating", h1: "Restaurant Booth & Sofa Seating",
    match: p => /booth|sofa/i.test(p.cat||'') && !isResidential(p),
    intro: "Restaurant booth seating and banquette sofas - single and double-sided, custom upholstery, built for cafés, QSRs and fine-dine. Made to order with fast turnaround across Hyderabad and Bangalore.",
    body: "Booth and banquette seating maximises covers along walls and creates intimate zones. Gharnish builds single and double-sided booths in commercial upholstery and your choice of finish, sized to your floor plan.",
    faqs: [["How much space does booth seating need?", "Booths are space-efficient along walls, typically needing 24-30 in depth per side plus table clearance. We design to your floor plan."], ["Can booths be customised to my layout?", "Yes - booth and banquette seating is made to order in your dimensions, upholstery and finish."], ["What's the delivery time for booth seating?", "As made-to-order items, booths typically ship in a slightly longer window than ready-stock chairs; share your requirement on WhatsApp for a timeline."]]
  },
  "restaurant-set": {
    title: "Restaurant Sets", h1: "Complete Restaurant Table & Chair Sets",
    match: p => /set/i.test(p.cat||'') && !isResidential(p),
    intro: "Ready-matched restaurant table-and-chair sets - coordinated tops, bases and seating in one package. Furnish a section or a whole outlet fast, with ready-stock delivery across Hyderabad, Bangalore and pan-India.",
    body: "Gharnish restaurant sets pair our commercial tables with matching chairs in tested combinations, so you can furnish a full floor in a single order instead of sourcing pieces separately. Share your cover count on WhatsApp and we'll recommend the right sets and quantities.",
    faqs: [["What's included in a restaurant set?", "Each set pairs a Gharnish table (top and base) with a matched number of chairs - typically 2-seater and 4-seater configurations - chosen to work together in style and height."], ["Are sets cheaper than buying pieces separately?", "Sets are priced to furnish an outlet efficiently, and bulk tiers apply on 10+ units. Share your cover count and we'll build a quote."], ["Can I customise a set?", "Yes - swap the chair design, top material or size. Message us on WhatsApp and we'll tailor a set to your venue."]]
  },
  "outdoor-chair": {
    title: "Outdoor Furniture", h1: "Outdoor & Patio Chairs",
    match: p => /outdoor/i.test(p.cat||'') && !isResidential(p),
    intro: "Weather-resistant outdoor chairs for café patios, rooftops and garden dining - rope, PVC and WPC designs built to handle sun and rain. Ready stock across Hyderabad and Bangalore.",
    body: "Gharnish outdoor seating uses weather-resistant materials - rope weave, PVC and WPC - chosen for uncovered patios and rooftops. Pair with our tables for covered areas, or ask us about outdoor-rated tops for exposed settings.",
    faqs: [["Is outdoor furniture weatherproof?", "Yes - our outdoor range uses rope, PVC and WPC materials chosen for sun and rain resistance, suitable for uncovered patios and rooftops."], ["Do outdoor chairs need cushions?", "Our rope and WPC designs are comfortable without cushions and low-maintenance outdoors; optional weather-resistant cushions can be added for lounge areas."], ["Can outdoor furniture be delivered pan-India?", "Yes, in-stock outdoor furniture ships in 2-7 days across India."]]
  },
};

const RES = {
  title: "Home & Residential Furniture", h1: "Residential Furniture Collection",
  intro: "Dining sets, tables and chairs, sofas, beds and centre & side tables for your home — the same ready-stock quality and fast delivery Gharnish is known for, now for residential spaces in Hyderabad and Bangalore.",
  body: "Gharnish brings its hospitality-grade craftsmanship home. Our residential range covers complete dining table sets, tables and chairs sold separately, living-room sofas, beds and occasional tables — built to last and available for quick delivery across Hyderabad, Bangalore and pan-India.",
  faqs: [["Does Gharnish sell furniture for homes?", "Yes. Alongside our restaurant range, Gharnish offers a residential collection of dining sets, sofas, beds and tables for homes in Hyderabad, Bangalore and across India."], ["Can I buy a dining table and chairs separately?", "Yes — dining tables and dining chairs are sold both as complete sets and separately, so you can mix and match to your space."], ["How fast is home furniture delivered?", "In-stock residential furniture ships in a few days across Hyderabad and Bangalore, with pan-India delivery available."], ["Is the residential furniture the same quality as commercial?", "Yes — our residential range is built to the same durable, commercial-grade standards that 300+ hospitality projects rely on."]]
};

/* ---------- shared shell ---------- */
function page({ title, desc, canonical, origin, jsonld, body }){
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="geo.region" content="IN-TG"><meta name="geo.placename" content="Hyderabad, Bengaluru">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index,follow,max-image-preview:large">
${jsonld ? '<script type="application/ld+json">'+jsonld+'</script>' : ''}
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@600;700;800&display=swap');
  :root{--bg:#FFFFFF;--bg2:#F4F6F8;--c1:#FFFFFF;--c2:#F2F4F6;--c3:#E9EDF1;--g:#C8860A;--gl:#E09A18;--gd:#8A5C07;--ink:#1A1510;--ink2:#6B5C40;--ink3:#A89070;--line:#E9EDF1;--dark:#1A1208;--nav:56px;--r2:16px;--r3:22px}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1160px;margin:0 auto;padding:0 22px}
  header.top{position:sticky;top:0;z-index:200;height:var(--nav);background:rgba(24,18,12,.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.08)}
  header.top .wrap{height:var(--nav);display:flex;align-items:center;gap:14px}
  header.top img.logo{height:34px;width:auto;display:block}
  header.top nav{margin-left:auto;display:flex;gap:2px}
  header.top nav a{color:rgba(255,255,255,.72);font-size:14px;font-weight:600;padding:8px 14px;border-radius:9px}
  header.top nav a:hover{color:#fff;background:rgba(255,255,255,.08)}
  header.top nav a.on{color:#fff;background:rgba(200,134,10,.22)}
  .eyebrow{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--g);font-weight:800}
  h1{font-family:Poppins,sans-serif;font-size:clamp(28px,5vw,44px);font-weight:800;letter-spacing:-.02em;margin:8px 0 12px;line-height:1.05}
  .hero{padding:42px 0 20px}
  .lead{font-size:17px;color:var(--ink2);max-width:720px}
  .body-copy{font-size:15.5px;color:var(--ink2);max-width:760px;margin:16px 0 6px}
  .crumb{font-size:13px;color:var(--ink3);margin:16px 0 -6px}
  .crumb a{color:var(--g);font-weight:600}
  .sec-h2{font-family:Poppins,sans-serif;font-size:22px;font-weight:800;margin:34px 0 14px}
  /* category hub cards */
  .cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;padding:8px 0 20px}
  .ccard{background:var(--c1);border:1px solid var(--line);border-radius:var(--r3);padding:22px;display:block;transition:transform .16s,box-shadow .16s}
  .ccard:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,.1)}
  .ccard h3{font-family:Poppins,sans-serif;font-size:19px;font-weight:800;margin:0 0 6px}
  .ccard p{font-size:13.5px;color:var(--ink2);margin:0 0 10px;line-height:1.5}
  .ccard .go{color:var(--g);font-weight:800;font-size:13.5px}
  .ccard .cnt{font-size:12px;color:var(--ink3);font-weight:700}
  /* product grid */
  .pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;padding:6px 0 10px}
  .pcard{background:var(--c1);border:1px solid var(--line);border-radius:var(--r2);overflow:hidden;transition:transform .16s,box-shadow .16s}
  .pcard:hover{transform:translateY(-3px);box-shadow:0 8px 22px rgba(0,0,0,.1)}
  .pc-ph{aspect-ratio:1/1;background-size:cover;background-position:center;background-color:var(--c2)}
  .pc-b{padding:11px 13px}
  .pc-n{font-size:13px;font-weight:700;line-height:1.3;min-height:34px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .pc-p{font-size:13.5px;font-weight:800;color:var(--g);margin-top:5px}
  /* FAQ */
  .faq{max-width:820px;margin:10px 0 30px}
  .faq details{border-bottom:1px solid var(--line);padding:16px 0}
  .faq summary{font-size:15.5px;font-weight:700;color:var(--ink);cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:16px}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:"+";color:var(--g);font-weight:800;font-size:20px}
  .faq details[open] summary::after{content:"\\2212"}
  .faq p{font-size:14.5px;color:var(--ink2);margin:12px 0 0}
  .cta{display:inline-flex;align-items:center;gap:9px;background:var(--g);color:#fff;font-weight:800;font-size:15px;padding:14px 28px;border-radius:999px;margin:24px 0 8px;box-shadow:0 8px 22px rgba(200,134,10,.3)}
  .cta:hover{background:var(--gl)}
  .wa{display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;margin-left:10px}
  footer{border-top:1px solid var(--line);padding:34px 0;color:var(--ink3);font-size:13.5px;margin-top:40px;background:var(--bg2)}
  footer a{color:var(--g);font-weight:700}
  @media(max-width:640px){header.top nav a{display:none}.hero{padding:30px 0 14px}}
</style>
</head>
<body>
<header class="top"><div class="wrap"><a href="${esc(origin)}/" aria-label="Gharnish home"><img class="logo" src="${LOGO}" alt="Gharnish"></a><nav><a href="${esc(origin)}/">Home</a><a href="${esc(origin)}/shop" class="on">Shop Furniture</a><a href="${esc(origin)}/shop/residential">Home Furniture</a><a href="${esc(origin)}/our-work">Our Work</a><a href="${esc(origin)}/estimate">Get an Estimate</a></nav></div></header>
${body}
<footer><div class="wrap">Gharnish — Restaurant &amp; café furniture, Hyderabad &amp; Bangalore. Ready stock, 2&ndash;7 day pan-India delivery. <a href="${esc(origin)}/">Explore the catalogue &rarr;</a></div></footer>
</body></html>`;
}

function prodCard(p, origin){
  const im = p.image ? `<div class="pc-ph" style="background-image:url('${esc(p.image)}')"></div>` : `<div class="pc-ph"></div>`;
  const price = p.price ? "&#8377;"+Number(p.price).toLocaleString("en-IN") : "";
  return `<a class="pcard" href="${esc(origin)}/?product=${esc(p.id)}">${im}<div class="pc-b"><div class="pc-n">${esc(p.name||"")}</div>${price?`<div class="pc-p">${price}</div>`:""}</div></a>`;
}
function faqBlock(faqs){
  if(!faqs||!faqs.length) return "";
  return `<div class="sec-h2">Frequently asked questions</div><div class="faq">`+
    faqs.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")+`</div>`;
}
function faqSchema(faqs){
  return JSON.stringify({ "@context":"https://schema.org","@type":"FAQPage",
    mainEntity: faqs.map(([q,a])=>({ "@type":"Question", name:q, acceptedAnswer:{ "@type":"Answer", text:a } })) });
}

/* ---------- /shop hub ---------- */
function renderHub(products, origin){
  const cards = Object.keys(CATS).map(k=>{
    const c=CATS[k]; const n=products.filter(c.match).length;
    return `<a class="ccard" href="${esc(origin)}/shop/${esc(k)}"><h3>${esc(c.title)}</h3><p>${esc(c.intro).slice(0,110)}&hellip;</p><span class="cnt">${n} products</span> &nbsp; <span class="go">Browse &rarr;</span></a>`;
  }).join("");
  const resCard = `<a class="ccard" href="${esc(origin)}/shop/residential"><h3>${esc(RES.title)}</h3><p>${esc(RES.intro).slice(0,110)}&hellip;</p><span class="go">Browse &rarr;</span></a>`;
  const jsonld = JSON.stringify({ "@context":"https://schema.org","@type":"CollectionPage",
    name:"Shop Furniture — Gharnish", url:origin+"/shop",
    description:"Browse commercial restaurant and residential furniture by category." });
  const body = `<main class="wrap">
    <section class="hero"><div class="eyebrow">Shop Furniture</div>
    <h1>Commercial &amp; home furniture, by category</h1>
    <p class="lead">Browse Gharnish's full range of restaurant, café and residential furniture &mdash; ready stock, 2&ndash;7 day delivery across Hyderabad, Bangalore and pan-India.</p></section>
    <div class="cgrid">${cards}${resCard}</div>
  </main>`;
  return page({ title:"Shop Restaurant & Home Furniture by Category | Gharnish",
    desc:"Browse commercial restaurant chairs, tables, bar stools, booths, outdoor & residential furniture. Ready stock, fast delivery in Hyderabad, Bangalore & across India.",
    canonical:origin+"/shop", origin, jsonld, body });
}

/* ---------- /shop/<category> ---------- */
function renderCategory(key, c, products, origin){
  const items = products.filter(c.match);
  const grid = items.length ? `<div class="pgrid">${items.map(p=>prodCard(p,origin)).join("")}</div>` : `<p class="body-copy">New stock arriving soon &mdash; message us on WhatsApp for current availability.</p>`;
  const jsonld = "["+JSON.stringify({ "@context":"https://schema.org","@type":"CollectionPage",
    name:c.h1+" — Gharnish", url:origin+"/shop/"+key, description:c.intro })+","+faqSchema(c.faqs)+"]";
  const body = `<main class="wrap">
    <div class="crumb"><a href="${esc(origin)}/shop">Shop</a> &rsaquo; ${esc(c.title)}</div>
    <section class="hero"><div class="eyebrow">${esc(c.title)}</div>
    <h1>${esc(c.h1)} in Hyderabad &amp; Bangalore</h1>
    <p class="lead">${esc(c.intro)}</p></section>
    <p class="body-copy">${esc(c.body)}</p>
    <div class="sec-h2">Browse ${esc(c.title)} (${items.length})</div>
    ${grid}
    <div><a class="cta" href="${esc(origin)}/?cat=${esc(key)}">See all in the app &rarr;</a><a class="wa" href="https://wa.me/919059276667">WhatsApp us</a></div>
    ${faqBlock(c.faqs)}
  </main>`;
  return page({ title:c.h1+" in Hyderabad & Bangalore | Ready Stock | Gharnish",
    desc:c.intro.slice(0,300), canonical:origin+"/shop/"+key, origin, jsonld, body });
}

/* ---------- /shop/residential ---------- */
function renderResidential(products, origin){
  const items = products.filter(isResidential);
  const grid = items.length ? `<div class="pgrid">${items.map(p=>prodCard(p,origin)).join("")}</div>` : `<p class="body-copy">Our residential range is expanding &mdash; message us on WhatsApp for the latest.</p>`;
  const jsonld = "["+JSON.stringify({ "@context":"https://schema.org","@type":"CollectionPage",
    name:RES.h1+" — Gharnish", url:origin+"/shop/residential", description:RES.intro })+","+faqSchema(RES.faqs)+"]";
  const body = `<main class="wrap">
    <div class="crumb"><a href="${esc(origin)}/shop">Shop</a> &rsaquo; Residential</div>
    <section class="hero"><div class="eyebrow">Home Furniture</div>
    <h1>${esc(RES.h1)} in Hyderabad &amp; Bangalore</h1>
    <p class="lead">${esc(RES.intro)}</p></section>
    <p class="body-copy">${esc(RES.body)}</p>
    <div class="sec-h2">Browse residential furniture (${items.length})</div>
    ${grid}
    <div><a class="cta" href="${esc(origin)}/?view=residential">Shop residential in the app &rarr;</a><a class="wa" href="https://wa.me/919059276667">WhatsApp us</a></div>
    ${faqBlock(RES.faqs)}
  </main>`;
  return page({ title:"Home & Residential Furniture in Hyderabad & Bangalore | Gharnish",
    desc:RES.intro.slice(0,300), canonical:origin+"/shop/residential", origin, jsonld, body });
}

/* ---------- handler ---------- */
export async function onRequestGet(context){
  const env = context.env||{};
  const base = (env.SUPABASE_URL||SUPABASE_URL_DEFAULT).replace(/\/+$/,"");
  const key  = env.SUPABASE_KEY||SUPABASE_KEY_DEFAULT;
  const origin = (env.SITE_ORIGIN||SITE_ORIGIN_DEFAULT).replace(/\/+$/,"");
  const parts = (context.params && context.params.path)||[];
  const slug = Array.isArray(parts) ? (parts[0]||"") : String(parts||"");

  let products = [];
  try {
    products = await sb(base, key, "gharnish_products?select=id,name,cat,price,image,bestseller,sort,hidden,internal,section&order=bestseller.desc,sort.asc");
    products = products.filter(p=>!p.hidden && !p.internal);
  } catch(e){ products = []; }

  let html;
  if(!slug){ html = renderHub(products, origin); }
  else if(slug==="residential"){ html = renderResidential(products, origin); }
  else if(CATS[slug]){ html = renderCategory(slug, CATS[slug], products, origin); }
  else { html = renderHub(products, origin); }

  return new Response(html, { headers:{ "Content-Type":"text/html; charset=utf-8", "Cache-Control":"public, max-age=1800" } });
}
