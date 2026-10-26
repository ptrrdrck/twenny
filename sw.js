// Twenny service worker.
// GitHub Pages serves this repo as-is (no build step), so the worker spots new
// versions itself: when the page asks it to check, it downloads the app files
// again and compares them with the saved copy. If anything changed, it keeps the
// new set aside and the page shows "New version, tap to refresh". Until the
// guard taps, the saved copy keeps being served, online or off.
// Map tiles are cross-origin and always go to the network.
//
// Every file the page loads must be listed in ASSETS (test/offline.test.js checks).

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/theme.css',
  'css/app.css',
  'js/app.js',
  'js/fix.js',
  'js/map.js',
  'js/pwa.js',
  'js/speech.js',
  'js/twenny-core.js',
  'js/locate.js',
  'data/landmarks.js',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/leaflet.js',
  'fonts/archivo-latin-wght-normal.woff2',
  'fonts/barlow-condensed-latin-500-normal.woff2',
  'fonts/barlow-condensed-latin-600-normal.woff2',
  'fonts/barlow-condensed-latin-700-normal.woff2',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

const LIVE = 'twenny-live';   // what the app runs from
const NEXT = 'twenny-next';   // a newer version, waiting for the tap

// Fresh copies of every file, or an error if any is missing (offline, or caught
// mid-deploy), so a bad download never replaces a working copy.
function download() {
  return Promise.all(ASSETS.map(async url => {
    const r = await fetch(url, {cache: 'no-cache'});
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return {url, body: await r.arrayBuffer(), type: r.headers.get('content-type') || ''};
  }));
}

async function save(name, files) {
  await caches.delete(name);
  const c = await caches.open(name);
  await Promise.all(files.map(f => c.put(f.url, new Response(f.body, {headers: {'content-type': f.type}}))));
}

function same(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a), y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

async function changed(files) {
  const live = await caches.open(LIVE);
  for (const f of files) {
    const old = await live.match(f.url);
    if (!old || !same(await old.arrayBuffer(), f.body)) return true;
  }
  return false;
}

async function tellPages(msg) {
  for (const c of await self.clients.matchAll({type: 'window'})) c.postMessage(msg);
}

let checking = null;
function check() {
  checking = checking || (async () => {
    if (!(await caches.has(NEXT))) {
      const files = await download();
      if (!(await changed(files))) return;
      await save(NEXT, files);
    }
    await tellPages('update-ready');
  })().catch(() => {}).finally(() => { checking = null; });
  return checking;
}

let fingerprint = null;

// Make the waiting version the live one.
async function promote() {
  if (!(await caches.has(NEXT))) return;
  const next = await caches.open(NEXT);
  await caches.delete(LIVE);
  const live = await caches.open(LIVE);
  for (const req of await next.keys()) await live.put(req, await next.match(req));
  await caches.delete(NEXT);
  fingerprint = null;
}

// Short hash of the live files: the "Version" shown in Settings.
async function version() {
  if (!fingerprint) {
    const live = await caches.open(LIVE);
    const parts = [];
    for (const u of ASSETS) { const r = await live.match(u); parts.push(r ? await r.arrayBuffer() : ''); }
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await new Blob(parts).arrayBuffer()));
    fingerprint = [...hash.slice(0, 5)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return fingerprint;
}

// A new sw.js also waits for the tap (never skipWaiting on install); it brings
// its own fresh copy of the files and makes them live when it takes over.
self.addEventListener('install', e => e.waitUntil(download().then(files => save(NEXT, files))));

self.addEventListener('activate', e => e.waitUntil((async () => {
  await promote();
  // Caches left by older versions of this worker.
  for (const k of await caches.keys()) if (k !== LIVE && k !== NEXT) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  else if (e.data === 'check') e.waitUntil(check());
  else if (e.data === 'apply') e.waitUntil(promote().then(() => e.source.postMessage('applied')));
  else if (e.data === 'version') e.waitUntil(version().then(v => e.source.postMessage({version: v})));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(LIVE).then(async c =>
    (await c.match(req, {ignoreSearch: true})) ||
    (req.mode === 'navigate' && await c.match('./')) ||
    fetch(req)));
});
