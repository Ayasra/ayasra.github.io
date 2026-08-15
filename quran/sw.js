/* Qur'an section service worker — offline-first.
   Scope is /quran/ only; the athkar section keeps its own worker at
   /Thekr/sw.js and the two never see each other's caches.
   Bump CACHE when any precached file changes. */
const CACHE = 'quran-v1';

const PRECACHE = [
  './',
  'index.html',
  'surah.html',
  'plan.html',
  'hifz.html',
  'qiyam-40.html',
  'khatm-7.html',
  'manifest.webmanifest',
  'assets/base.css',
  'assets/quran.css',
  'assets/plan.css',
  'assets/hifz.css',
  'assets/session.css',
  'assets/test.css',
  'assets/program.css',
  'assets/quran.js',
  'assets/intros.js',
  'assets/tracker.js',
  'assets/plan.js',
  'assets/hifz.js',
  'assets/session.js',
  'assets/test.js',
  'assets/program.js',
  'assets/data/surahs.js',
  'assets/data/index.js',
  'assets/data/programs.js',
  /* Individual sūrahs, their tafsir and the 604 page fonts are deliberately
     NOT precached — that would be well over 100MB on first visit. They are
     cached as they are read, which is what makes a sūrah work offline
     afterwards. */
  'assets/icon.svg',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-512-maskable.png',
  'assets/fonts/amiri-quran-arabic.woff2',
  'assets/fonts/amiri-400-arabic.woff2',
  'assets/fonts/amiri-400-latin.woff2',
  'assets/fonts/amiri-700-arabic.woff2',
  'assets/fonts/amiri-700-latin.woff2',
  'assets/fonts/naskh-var-arabic.woff2',
  'assets/fonts/naskh-var-latin.woff2',
  'assets/fonts/sura-names.woff2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        /* addAll fails wholesale on a single 404 — add individually instead */
        return Promise.all(PRECACHE.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                               .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var isHTML = req.mode === 'navigate' ||
               (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isHTML) {
    /* network-first so edits show up straight away, cache as fallback */
    event.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('index.html');
          });
        })
    );
    return;
  }

  /* recitation audio: always straight to the network, never cached
     (hundreds of MB otherwise) */
  if (/everyayah\.com|\.mp3(\?|$)/i.test(req.url)) return;

  /* muṣḥaf page fonts are ~200KB each and there are 604 of them, so they
     are never precached — but once a page has been read its font is kept,
     which is what makes that page work offline afterwards. */

  /* everything else: cache-first, then network (and cache the result,
     including opaque cross-origin responses such as CDN scripts/fonts) */
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        return res;
      });
    })
  );
});
