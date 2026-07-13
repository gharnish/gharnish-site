// Cloudflare Pages Function — GET /product/<slug>
// Server-renders a crawlable, SEO+GEO-optimized page for each product so Google
// and AI crawlers index the real product content (name, price, material, image,
// description) instead of the empty SPA shell. Human visitors get the content
// plus one-tap paths into the live app (add to quote / WhatsApp).
//
// URL: /product/<slug>   where slug = ghSlug(name + '-' + id)  (matches sitemap)

const SUPABASE_URL_DEFAULT = "https://djedmaezxvuzmwjnooel.supabase.co";
const SUPABASE_KEY_DEFAULT  = "sb_publishable_ZLUr4NQFTEN6qzVAYNL7CA_qocs1pQK";
const SITE_ORIGIN_DEFAULT   = "https://gharnish.app";
const WA = "919059276667";
const LOGO = "data:image/webp;base64,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";

function ghSlug(s){ return String(s==null?"":s).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
function prodSlug(p){ return ghSlug((p.name||"")+"-"+(p.id||"")); }
function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function inr(n){ return "\u20B9"+Number(n||0).toLocaleString("en-IN"); }
async function sb(base,key,path){ const r=await fetch(base+"/rest/v1/"+path,{headers:{apikey:key,Authorization:"Bearer "+key,Accept:"application/json"}}); if(!r.ok) return []; return r.json().catch(()=>[]); }

// human-readable category label + which /shop bucket it maps to
function catInfo(cat){
  cat = String(cat||"").toLowerCase();
  if(/stool/.test(cat)) return { label:"Bar Stools", shop:"stools" };
  if(/outdoor/.test(cat)) return { label:"Outdoor Furniture", shop:"outdoor" };
  if(/booth|sofa/.test(cat)) return { label:"Booth & Sofas", shop:"booth" };
  if(/table/.test(cat)) return { label:"Tables & Bases", shop:"tables" };
  if(/chair/.test(cat)) return { label:"Restaurant Chairs", shop:"chairs" };
  return { label:"Furniture", shop:"" };
}

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
<meta property="og:type" content="product"><meta property="og:title" content="${esc(title)}">
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
  .wrap{max-width:1100px;margin:0 auto;padding:0 22px}
  header.top{position:sticky;top:0;z-index:200;height:var(--nav);background:rgba(24,18,12,.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.08)}
  header.top .wrap{height:var(--nav);display:flex;align-items:center;gap:14px}
  header.top img.logo{height:34px;width:auto;display:block}
  header.top nav{margin-left:auto;display:flex;gap:2px}
  header.top nav a{color:rgba(255,255,255,.72);font-size:14px;font-weight:600;padding:8px 14px;border-radius:9px}
  header.top nav a:hover{color:#fff;background:rgba(255,255,255,.08)}
  .crumb{font-size:13px;color:var(--ink3);margin:18px 0 0}
  .crumb a{color:var(--g);font-weight:600}
  .pdp{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:38px;padding:22px 0 10px;align-items:start}
  .pdp-img{border-radius:var(--r3);overflow:hidden;background:var(--c2);aspect-ratio:1/1;display:flex;align-items:center;justify-content:center}
  .pdp-img img{width:100%;height:100%;object-fit:cover;display:block}
  .pdp-noimg{color:var(--ink3);font-size:52px}
  .eyebrow{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--g);font-weight:800}
  h1{font-family:Poppins,sans-serif;font-size:clamp(26px,4vw,38px);font-weight:800;letter-spacing:-.02em;margin:8px 0 10px;line-height:1.08}
  .price{font-size:28px;font-weight:800;color:var(--ink);margin:6px 0}
  .price small{font-size:14px;color:var(--ink3);font-weight:600}
  .stock{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#1B7A4D;background:rgba(27,122,77,.1);padding:5px 12px;border-radius:999px;margin:4px 0 14px}
  .specs{border-top:1px solid var(--line);margin-top:16px;padding-top:16px}
  .specrow{display:flex;gap:14px;padding:7px 0;font-size:14px}
  .specrow .k{color:var(--ink3);font-weight:700;min-width:110px}
  .specrow .v{color:var(--ink);font-weight:600}
  .desc{font-size:15.5px;color:var(--ink2);margin:16px 0;line-height:1.65}
  .cta{display:inline-flex;align-items:center;gap:9px;background:var(--g);color:#fff;font-weight:800;font-size:15px;padding:14px 26px;border-radius:999px;margin:8px 8px 8px 0;box-shadow:0 8px 22px rgba(200,134,10,.3)}
  .cta:hover{background:var(--gl)}
  .wa{display:inline-flex;align-items:center;gap:8px;background:#25D366;color:#fff;font-weight:700;font-size:14px;padding:13px 22px;border-radius:999px}
  .sec-h2{font-family:Poppins,sans-serif;font-size:22px;font-weight:800;margin:38px 0 14px}
  .pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}
  .pcard{background:var(--c1);border:1px solid var(--line);border-radius:var(--r2);overflow:hidden;transition:transform .16s,box-shadow .16s}
  .pcard:hover{transform:translateY(-3px);box-shadow:0 8px 22px rgba(0,0,0,.1)}
  .pc-ph{aspect-ratio:1/1;background-size:cover;background-position:center;background-color:var(--c2)}
  .pc-b{padding:11px 13px}
  .pc-n{font-size:13px;font-weight:700;line-height:1.3;min-height:34px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .pc-p{font-size:13.5px;font-weight:800;color:var(--g);margin-top:5px}
  .faq{max-width:820px;margin:10px 0 30px}
  .faq details{border-bottom:1px solid var(--line);padding:16px 0}
  .faq summary{font-size:15.5px;font-weight:700;cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:16px}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:"+";color:var(--g);font-weight:800;font-size:20px}
  .faq details[open] summary::after{content:"\\2212"}
  .faq p{font-size:14.5px;color:var(--ink2);margin:12px 0 0}
  footer{border-top:1px solid var(--line);padding:34px 0;color:var(--ink3);font-size:13.5px;margin-top:40px;background:var(--bg2)}
  footer a{color:var(--g);font-weight:700}
  @media(max-width:760px){.pdp{grid-template-columns:1fr;gap:22px}header.top nav a{display:none}}
</style>
</head>
<body>
<header class="top"><div class="wrap"><a href="${esc(origin)}/" aria-label="Gharnish home"><img class="logo" src="${LOGO}" alt="Gharnish"></a><nav><a href="${esc(origin)}/">Home</a><a href="${esc(origin)}/shop">Shop Furniture</a><a href="${esc(origin)}/shop/residential">Home Furniture</a><a href="${esc(origin)}/our-work">Our Work</a><a href="${esc(origin)}/estimate">Get an Estimate</a></nav></div></header>
${body}
<footer><div class="wrap">Gharnish — Restaurant &amp; café furniture, Hyderabad &amp; Bangalore. Ready stock, 2&ndash;7 day pan-India delivery. <a href="${esc(origin)}/">Explore the catalogue &rarr;</a></div></footer>
</body></html>`;
}

function prodCard(p, origin){
  const im = p.image ? `<div class="pc-ph" style="background-image:url('${esc(p.image)}')"></div>` : `<div class="pc-ph"></div>`;
  return `<a class="pcard" href="${esc(origin)}/product/${esc(prodSlug(p))}">${im}<div class="pc-b"><div class="pc-n">${esc(p.name||"")}</div>${p.price?`<div class="pc-p">${inr(p.price)}</div>`:""}</div></a>`;
}

function renderProduct(p, related, origin){
  const ci = catInfo(p.cat);
  const img = p.image
    ? `<div class="pdp-img"><img src="${esc(p.image)}" alt="${esc(p.name)} — ${esc(ci.label)} by Gharnish"></div>`
    : `<div class="pdp-img"><span class="pdp-noimg">\u25FB</span></div>`;
  const inStock = p.stock !== false;
  const specs = [
    p.material && ["Material", p.material],
    ci.label && ["Category", ci.label],
    p.seats && ["Seats", String(p.seats)],
    p.shape && ["Shape", p.shape],
    p.tier && ["Range", p.tier.charAt(0).toUpperCase()+p.tier.slice(1)],
  ].filter(Boolean).map(([k,v]) => `<div class="specrow"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");

  const descText = p.description || (p.name + (p.material ? " in " + p.material : "") + " — commercial-grade " + ci.label.toLowerCase() + " from Gharnish, available in ready stock for fast delivery across Hyderabad, Bangalore and pan-India.");

  const appUrl = origin + "/?product=" + esc(p.id);
  const waText = encodeURIComponent("Hi! I'm interested in the " + p.name + " (" + inr(p.price) + "). Please share pricing and availability.");

  // product FAQs (generic but useful + GEO)
  const faqs = [
    ["Is the " + p.name + " available in Hyderabad and Bangalore?", "Yes. This product is " + (inStock ? "in ready stock" : "made to order") + " and delivers across Hyderabad, Bangalore and pan-India" + (inStock ? " in 2–7 days" : "") + ", with free installation."],
    ["How much does the " + p.name + " cost?", "The " + p.name + " is priced at " + inr(p.price) + " per unit. Bulk pricing applies on orders of 10 or more units — message us for a quote."],
    ["Can I order this in bulk for my restaurant?", "Yes — bulk discounts unlock at 10, 25, 50 and 100 units. Share your quantity on WhatsApp and we'll build a quote and delivery timeline."],
    ["Is this suitable for commercial use?", "Yes. Gharnish " + ci.label.toLowerCase() + " are built to commercial-grade standards used across 300+ hospitality projects."],
  ];
  const faqHtml = `<div class="sec-h2">Frequently asked questions</div><div class="faq">` +
    faqs.map(([q,a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("") + `</div>`;

  const relHtml = related && related.length
    ? `<div class="sec-h2">Related ${esc(ci.label)}</div><div class="pgrid">${related.map(r=>prodCard(r,origin)).join("")}</div>`
    : "";

  const productLd = {
    "@context":"https://schema.org/","@type":"Product",
    name:p.name, sku:String(p.id), category:ci.label,
    description:descText,
    brand:{"@type":"Brand",name:"Gharnish"},
    offers:{ "@type":"Offer", priceCurrency:"INR", price:String(p.price||0),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      url: origin + "/product/" + prodSlug(p),
      areaServed:["Hyderabad","Bengaluru","India"] }
  };
  if(p.image) productLd.image = p.image;
  const breadcrumbLd = {
    "@context":"https://schema.org","@type":"BreadcrumbList",
    itemListElement:[
      {"@type":"ListItem",position:1,name:"Shop",item:origin+"/shop"},
      ci.shop ? {"@type":"ListItem",position:2,name:ci.label,item:origin+"/shop/"+ci.shop} : null,
      {"@type":"ListItem",position:ci.shop?3:2,name:p.name,item:origin+"/product/"+prodSlug(p)}
    ].filter(Boolean)
  };
  const faqLd = { "@context":"https://schema.org","@type":"FAQPage",
    mainEntity:faqs.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}})) };
  const jsonld = "[" + JSON.stringify(productLd) + "," + JSON.stringify(breadcrumbLd) + "," + JSON.stringify(faqLd) + "]";

  const body = `<main class="wrap">
    <div class="crumb"><a href="${esc(origin)}/shop">Shop</a>${ci.shop?` &rsaquo; <a href="${esc(origin)}/shop/${esc(ci.shop)}">${esc(ci.label)}</a>`:""} &rsaquo; ${esc(p.name)}</div>
    <div class="pdp">
      ${img}
      <div>
        <div class="eyebrow">${esc(ci.label)}</div>
        <h1>${esc(p.name)}</h1>
        <div class="price">${inr(p.price)} <small>/ unit</small></div>
        <div class="stock">${inStock ? "● In ready stock · 2–7 day delivery" : "● Made to order"}</div>
        <p class="desc">${esc(descText)}</p>
        <div class="specs">${specs}</div>
        <div style="margin-top:18px">
          <a class="cta" href="${esc(appUrl)}">✨ Add to quote</a>
          <a class="wa" href="https://wa.me/${WA}?text=${waText}">💬 WhatsApp us</a>
        </div>
      </div>
    </div>
    ${faqHtml}
    ${relHtml}
  </main>`;

  return page({
    title: p.name + " — " + ci.label + " · " + inr(p.price) + " | Gharnish Hyderabad",
    desc: (descText).slice(0,300),
    canonical: origin + "/product/" + prodSlug(p),
    origin, jsonld, body
  });
}

export async function onRequestGet(context){
  const env = context.env||{};
  const base = (env.SUPABASE_URL||SUPABASE_URL_DEFAULT).replace(/\/+$/,"");
  const key  = env.SUPABASE_KEY||SUPABASE_KEY_DEFAULT;
  const origin = (env.SITE_ORIGIN||SITE_ORIGIN_DEFAULT).replace(/\/+$/,"");
  const parts = (context.params && context.params.path)||[];
  const slug = Array.isArray(parts) ? (parts[0]||"") : String(parts||"");

  if(!slug){ return Response.redirect(origin + "/shop", 302); }

  // fetch all public products, match by slug
  let products = [];
  try {
    products = await sb(base, key, "gharnish_products?select=id,name,cat,price,image,material,description,seats,shape,tier,stock,bestseller,section,hidden,internal&order=bestseller.desc,sort.asc");
    products = products.filter(p=>!p.hidden && !p.internal);
  } catch(e){ products = []; }

  const p = products.find(x => prodSlug(x) === slug);
  if(!p){
    // Not found → send to the SPA which can resolve or 404 gracefully
    return new Response(page({ title:"Product not found | Gharnish", desc:"This product may have moved.", canonical:origin+"/shop", origin, jsonld:"", body:`<main class="wrap"><section style="padding:60px 0"><h1>Product not found</h1><p class="desc">This item may have moved or sold out. <a href="${origin}/shop" style="color:var(--g);font-weight:700">Browse all furniture →</a></p></section></main>` }), { status:404, headers:{ "Content-Type":"text/html; charset=utf-8" } });
  }

  // related: same category bucket, exclude self, cap 8
  const ci = catInfo(p.cat);
  const related = products.filter(x => x.id !== p.id && catInfo(x.cat).shop === ci.shop).slice(0,8);

  return new Response(renderProduct(p, related, origin), {
    headers:{ "Content-Type":"text/html; charset=utf-8", "Cache-Control":"public, max-age=1800" }
  });
}
