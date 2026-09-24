// Clock service worker — offline support for /clock/ only.
//
// Network first, so a deploy shows up on the next launch; the cache answers when the
// network doesn't, and the clock opens the same with Wi-Fi off.
//
// Cache storage is shared by every app on ayasra.com, so this worker only ever deletes
// caches whose names start with "clock-". Unlike the other apps' workers there's no need
// to bump CACHE on each deploy: files are revalidated with the server whenever online.

const CACHE = 'clock-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/main.js',
  'js/device.js',
  'js/format.js',
  'js/glyphs.js',
  'js/icons.js',
  'js/layout.js',
  'js/readout.js',
  'js/sheets.js',
  'js/sound.js',
  'js/store.js',
  'js/theme.js',
  'js/timers.js',
  'js/view.js',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
const NETWORK_WAIT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('clock-') && k !== CACHE).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    // "no-cache" revalidates with the server instead of trusting the browser's HTTP cache,
    // which Cloudflare lets hold scripts for hours — long enough to mix old and new modules.
    const response = await Promise.race([
      fetch(request, { cache: 'no-cache' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_WAIT_MS)),
    ]);
    // The app never uses query strings; skipping them keeps the cache to the files above.
    if (response.ok && !new URL(request.url).search) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return (await cache.match('./')) || Response.error();
    return Response.error();
  }
}
