/* Gharnish PWA service worker — network-first for fresh content, offline fallback */
var CACHE = 'gharnish-v70';
var SHELL = ['/', '/index.html', '/table-estimator.html', '/space-planner.html', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.pathname.indexOf('/api/') === 0 || url.host.indexOf('supabase') !== -1) return; // never cache API/data
  if (url.origin !== self.location.origin) return; // cross-origin (CDN product images, fonts, SDKs) load natively — never SW-cached
  if (req.mode === 'navigate') { // always try fresh HTML so prices/products stay current
    e.respondWith(
      fetch(req).then(function (r) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); return r; })
        .catch(function () { return caches.match(req).then(function (m) { return m || caches.match('/index.html'); }); })
    );
    return;
  }
  e.respondWith(caches.match(req).then(function (m) {
    // Network-first for CSS & JS so a new deploy always takes effect (cache is offline fallback only).
    if (req.destination === 'style' || req.destination === 'script') {
      return fetch(req).then(function (r) {
        if (r.ok) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
        return r;
      }).catch(function () { return m || Response.error(); });
    }
    // Cache-first for images & fonts (rarely change, best for speed).
    return m || fetch(req).then(function (r) {
      if (r.ok && (req.destination === 'image' || req.destination === 'font')) {
        var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); });
      }
      return r;
    }).catch(function () { return m || Response.error(); });
  }));
});
