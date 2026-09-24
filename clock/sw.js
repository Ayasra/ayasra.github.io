// Clock service worker — offline support for /clock/ only.
//
// The clock always runs from one consistent set of files. Each time it's opened with a
// network, the worker downloads every file fresh — past the browser's cache and
// Cloudflare's, which can hold old files for minutes after a deploy — and replaces its
// saved copy only if all of them arrive in time. The page and its scripts are then served
// from that copy, so a new page never meets an old script. Offline or on a slow network,
// the clock opens from the copy it already has. There's no version to bump on deploy.
//
// Cache storage is shared by every app on ayasra.com, so this worker only ever deletes
// caches whose names start with "clock-".

const CACHE = 'clock-v2';
const ASSETS = [
  './',
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
const WAIT_MS = 4000; // how long opening the clock waits for fresh files before using the saved copy

const here = (path) => new URL(path, self.location.href).href;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Every file, fresh from the server — or an error if any one of them doesn't arrive. */
function downloadAll() {
  const stamp = Date.now();
  return Promise.all(ASSETS.map(async (path) => {
    // A query the CDN has never seen can't be answered from its cache.
    const response = await fetch(`${here(path)}?fresh=${stamp}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    // Re-wrapped so the saved copy answers for the plain URL rather than the ?fresh= one.
    const body = await response.blob();
    const { status, statusText, headers } = response;
    return [here(path), new Response(body, { status, statusText, headers })];
  }));
}

async function saveAll(files) {
  const cache = await caches.open(CACHE);
  await Promise.all(files.map(([url, response]) => cache.put(url, response)));
  const keep = new Set(files.map(([url]) => url));
  for (const request of await cache.keys()) if (!keep.has(request.url)) await cache.delete(request);
}

self.addEventListener('install', (event) => {
  event.waitUntil(downloadAll().then(saveAll).then(() => self.skipWaiting()));
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
  event.respondWith(request.mode === 'navigate' ? openClock() : fromCopy(request));
});

/** Opening the clock: bring the whole saved copy up to date if that's quick, then serve the page from it. */
async function openClock() {
  let answered = false;
  let saving = null;
  const refresh = downloadAll().then((files) => {
    if (answered) return; // too late for this launch — the next one will fetch again
    saving = saveAll(files);
    return saving;
  });
  await Promise.race([refresh.catch(() => {}), delay(WAIT_MS)]);
  if (saving) await saving.catch(() => {}); // already saving: finish, so the copy is whole
  answered = true;
  const page = await (await caches.open(CACHE)).match(here('./'));
  return page || fetch(here('./'));
}

/** Everything else the page asks for comes from the same saved copy. */
async function fromCopy(request) {
  const saved = await (await caches.open(CACHE)).match(request, { ignoreSearch: true });
  return saved || fetch(request);
}
