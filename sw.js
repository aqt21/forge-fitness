// Offline support. App files are fetched network-first (so updates appear on the next
// open) and fall back to the cache when offline. Food-database requests are never cached.
const CACHE = 'forge-v2';
const APP = ['./', './index.html', './styles.css', './manifest.webmanifest', './icon.svg', './icon-192.png',
  './js/main.js', './js/store.js', './js/ui.js', './js/nutrition.js', './js/foodapi.js', './js/scanner.js',
  './js/train.js', './js/generator.js', './js/exercises.js', './js/progress.js', './js/settings.js'];
const SCANNER = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(APP);
    await c.add(SCANNER).catch(() => {}); // optional; scanning needs the network to look up foods anyway
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const mine = url.origin === location.origin || e.request.url === SCANNER;
  if (e.request.method !== 'GET' || !mine) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(e.request, { cache: 'no-cache' });
      if (r.ok) e.waitUntil(c.put(e.request, r.clone()));
      return r;
    } catch {
      return (await c.match(e.request, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error();
    }
  })());
});
