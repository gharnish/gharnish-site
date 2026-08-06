/* Gharnish PWA service worker — network-first for fresh content, offline fallback */
var CACHE = 'gharnish-v113';
var SHELL = ['/', '/index.html', '/customers.html', '/table-estimator.html', '/space-planner.html', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ── Web Push: follow-up reminders ── */
self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (_) { data = { title: 'Gharnish', body: (e.data && e.data.text && e.data.text()) || '' }; }
  var title = data.title || 'Gharnish follow-up';
  var opts = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'gh-followup',
    renotify: true,
    requireInteraction: true,
    vibrate: [90, 40, 90],
    data: { url: data.url || '/customers.html' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) || '/customers.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cl) {
    for (var i = 0; i < cl.length; i++) {
      if (cl[i].url.indexOf('/customers') > -1 && 'focus' in cl[i]) {
        try { cl[i].navigate(target); } catch (_) {}
        return cl[i].focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  }));
});
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
