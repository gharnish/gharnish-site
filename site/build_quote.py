# Generates quote.html — a mobile, quote-only build of admin.html.
# Rerun this after every admin.html change (same discipline as manager.html).
import re

src = open('admin.html', 'r', encoding='utf-8').read()
bn = re.findall(r'BUILD (\d+)', src)[0]

# ── Branding ──
for x, y in [
    ('<span class="login-logo-sub">Admin</span>', '<span class="login-logo-sub">Quotes</span>'),
    ('Sign in to manage your catalog', 'Sign in to build quotes'),
    ('<div class="sidebar-logo-sub">Product Admin</div>', '<div class="sidebar-logo-sub">Quotes</div>'),
    ('</span>Gharnish Admin', '</span>Gharnish Quotes'),
    ('placeholder="admin@gharnish.com"', 'placeholder="you@gharnish.com"'),
    ('BUILD ' + bn + '</span>', 'QUOTE \u00b7 ' + bn + '</span>'),
]:
    src = src.replace(x, y)

src = re.sub(r'<title>[^<]*</title>', '<title>Gharnish Quotes</title>', src, count=1)
src = src.replace('</head>',
    '<script>window.GH_QUOTE=true;</script>\n'
    '<link rel="manifest" href="/quote-manifest.json">\n'
    '<meta name="theme-color" content="#211b14">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
    '<meta name="apple-mobile-web-app-title" content="GH Quotes">\n'
    '</head>', 1)

# ── Mobile-first CSS: kill the chrome, make the builder one column ──
css = """<style>
  /* Quote app — mobile-first, single purpose */
  .sidebar{display:none!important}
  .mnav{display:none!important}
  .nav-section-label{display:none!important}
  .main{margin-left:0!important;padding-bottom:24px}
  .q-wrap,.q-grid{grid-template-columns:1fr!important;display:block!important}
  .q-prodgrid{grid-template-columns:repeat(auto-fill,minmax(108px,1fr))!important;max-height:none!important}
  .qa-topbar{position:sticky;top:0;z-index:60;background:var(--dark);color:#fff;
    display:flex;align-items:center;gap:10px;padding:11px 14px}
  .qa-topbar .t{font-family:Poppins,sans-serif;font-weight:800;font-size:15px;letter-spacing:-.01em;flex:1}
  .qa-topbar .b{background:rgba(255,255,255,.12);border:none;color:#fff;font-weight:700;font-size:12.5px;
    padding:7px 13px;border-radius:999px;cursor:pointer;font-family:inherit;flex:none}
  .qa-topbar .b.primary{background:var(--g)}
  @media(max-width:640px){
    .q-card{padding:13px;border-radius:12px;margin-bottom:11px}
    .page-hd{padding:12px 0 8px}
    .page-title{font-size:19px}
    .main{padding:0 12px 24px}
  }
  @media(min-width:900px){
    .main{max-width:900px;margin:0 auto!important}
  }

  /* Bottom nav — three columns, raised centre action */
  .qa-bnav{position:fixed;left:0;right:0;bottom:0;z-index:70;
    background:rgba(255,255,255,.96);backdrop-filter:blur(16px) saturate(1.3);
    -webkit-backdrop-filter:blur(16px) saturate(1.3);
    border-top:1px solid rgba(26,21,16,.08);
    display:grid;grid-template-columns:1fr 1fr 1fr;align-items:end;
    padding:0 4px calc(6px + env(safe-area-inset-bottom));height:auto}
  .qa-nav-item{background:none;border:none;cursor:pointer;font-family:inherit;
    display:flex;flex-direction:column;align-items:center;gap:4px;
    font-size:10.5px;font-weight:600;color:var(--ink3);padding:9px 0 4px;
    letter-spacing:.01em;transition:color .15s}
  .qa-nav-item svg{width:20px;height:20px;stroke-width:1.8}
  .qa-nav-item:active{color:var(--g)}
  .qa-fab-col{display:flex;flex-direction:column;align-items:center;gap:4px;padding-bottom:4px}
  .qa-fab{width:50px;height:50px;border-radius:50%;border:none;cursor:pointer;
    background:var(--g);color:#fff;display:flex;align-items:center;justify-content:center;
    box-shadow:0 5px 16px rgba(200,134,10,.4);margin-top:-19px;
    font-size:27px;font-weight:300;line-height:0;padding:0 0 3px;font-family:inherit;
    transition:transform .12s}
  .qa-fab:active{transform:scale(.94)}
  .qa-fab-col span{font-size:10.5px;font-weight:700;color:var(--g);letter-spacing:.01em}
  body{padding-bottom:74px}
</style>
"""
src = src.replace('</head>', css + '</head>', 1)

# ── Override script: lock the app to quoting only ──
override = r"""<script>
(function(){
  var ALLOW=['quotations'];

  function strip(){
    // Nothing outside quoting should be reachable from the UI.
    document.querySelectorAll('.nav-item,.mnav-btn').forEach(function(el){
      var p=(el.dataset&&el.dataset.page)||null; if(p && ALLOW.indexOf(p)<0) el.remove();
    });
    var sb=document.querySelector('.sidebar'); if(sb) sb.style.display='none';
    var mn=document.querySelector('.mnav'); if(mn) mn.style.display='none';
  }

  // A slim top bar with the two actions that matter.
  function topbar(){
    if(document.getElementById('qa-topbar')) return;
    var mc=document.getElementById('main-content'); if(!mc||!mc.parentNode) return;
    var b=document.createElement('div');
    b.id='qa-topbar'; b.className='qa-topbar';
    b.innerHTML='<span class="t">Gharnish Quotes</span>';
    mc.parentNode.insertBefore(b, mc);
  }

  function bnav(){
    if(document.getElementById('qa-bnav')) return;
    var n=document.createElement('div');
    n.id='qa-bnav'; n.className='qa-bnav';
    n.innerHTML=
       '<button class="qa-nav-item" onclick="qaList()">'
      +'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
      +'<span>Quotes</span></button>'
      +'<div class="qa-fab-col">'
      +'<button class="qa-fab" onclick="qaAddProduct()" aria-label="Add product">+</button>'
      +'<span>Product</span></div>'
      +'<button class="qa-nav-item" onclick="qaNew()">'
      +'<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/></svg>'
      +'<span>New quote</span></button>';
    document.body.appendChild(n);
  }

  // The (+) works from anywhere — it creates the product, and only drops it on
  // the quote if a builder is actually open.
  window.qaAddProduct=function(){
    try{ if(typeof qNewProduct==='function'){ qNewProduct(); return; } }catch(e){}
    toast('Open a quote first','#C8860A');
  };

  window.qaList=function(){ try{ navigate('quotations'); }catch(e){} };
  window.qaNew=function(){
    try{ if(typeof qReset==='function') qReset(); if(typeof renderQuoteBuilder==='function'){ navigate('quotations'); setTimeout(renderQuoteBuilder,30); } }
    catch(e){ try{ navigate('quotations'); }catch(_){} }
  };

  // Any attempt to reach another section lands back on quotes.
  try{ var _nav=navigate; navigate=function(p){ if(ALLOW.indexOf(p)<0) p='quotations'; _nav(p); strip(); }; }catch(e){}

  // Neutralise every other page renderer.
  ['renderDashboard','renderProducts','renderCategories','renderHomepage','renderRecommended','renderProjects',
   'renderSettings','renderInventory','renderReviews','renderTablePricing','renderSales','renderVendors',
   'renderRunning','renderTransactions','renderAnalytics','renderLeads','renderCustomers'].forEach(function(fn){
    try{ window[fn]=function(){ try{ renderQuotations(); }catch(e){} }; }catch(e){}
  });

  try{ var _sa=showApp; showApp=async function(){ await _sa(); strip(); topbar(); bnav(); try{ navigate('quotations'); }catch(e){} }; }catch(e){}

  try{
    var mc=document.getElementById('main-content');
    if(mc && window.MutationObserver){ var t=null; new MutationObserver(function(){ clearTimeout(t); t=setTimeout(strip,90); }).observe(mc,{childList:true,subtree:true}); }
  }catch(e){}

  function signedIn(){
    var ls=document.getElementById('login-screen');
    return !!(ls && ls.style.display==='none');
  }
  function tick(){ if(!signedIn()) return; strip(); topbar(); bnav(); }
  document.addEventListener('DOMContentLoaded', tick);
  setInterval(tick, 800);
  setTimeout(tick, 300);
  if('serviceWorker' in navigator){ try{ navigator.serviceWorker.register('/service-worker.js'); }catch(e){} }
})();
</script>"""
src = src.replace('</body>', override + '\n</body>', 1)

open('quote.html', 'w', encoding='utf-8').write(src)
print("quote.html generated — QUOTE ·", bn)
