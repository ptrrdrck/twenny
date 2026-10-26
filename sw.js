// Twenny service worker.
// scripts/build.mjs fills in VERSION (a hash of the site files) and ASSETS at
// deploy time, so every deploy that changes a file is a new worker. It waits
// until the page asks it to take over ("New version, tap to refresh").
// Map tiles are cross-origin and always go to the network.

const VERSION = 'dev';
const ASSETS = ['./'];
const CACHE = 'twenny-' + VERSION;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'})))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('twenny-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (VERSION === 'dev') {
    // Unbuilt local copy: always fresh, cache only as an offline fallback.
    e.respondWith(fetch(req).catch(() => caches.match(req, {ignoreSearch: true})));
    return;
  }
  // Serve only this version's cache so a page never mixes old and new files.
  e.respondWith(caches.open(CACHE).then(async c =>
    (await c.match(req, {ignoreSearch: true})) ||
    (req.mode === 'navigate' && await c.match('./')) ||
    fetch(req)));
});
