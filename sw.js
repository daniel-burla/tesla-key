// Minimal offline shell. Network first so a stale cache never hides new data.
const CACHE = 'tesla-monitor-v8';
// app.js and render.js are loaded with a ?v= query, so they are not listed here:
// the fetch handler caches whatever URL is actually requested, which keeps the
// precache from pinning a stale unversioned copy.
const SHELL = ['./index.html', './styles.css?v=8', './config.js', './manifest.webmanifest',
               './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  // Never cache API traffic; only the static shell.
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    // Revalidate the HTTP cache too; otherwise "network first" can still return
    // an old HTML page for ten minutes after a GitHub Pages deployment.
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
