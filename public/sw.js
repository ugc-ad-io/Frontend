/* UGCad.io service worker.
 *
 * What it does (and deliberately does NOT do):
 *  - Precaches the offline page + install icons so they are available with no network. The offline
 *    page is fully self-contained (inline CSS and JS), so it is the whole "shell" an offline user needs;
 *    the React app itself needs the API, so it is not served from cache.
 *  - Page navigations are NETWORK-FIRST. If the network is down, the user gets /offline.html
 *    (with a working "Try again"), never a browser error page and never a stale, logged-in app
 *    screen full of failing API calls.
 *  - /static/* (CRA fingerprints these, so a URL never changes content) is cache-first.
 *  - Same-origin images/fonts are stale-while-revalidate, capped so the cache cannot grow forever.
 *  - NEVER touched, always straight to the network: every non-GET request, every cross-origin
 *    request (the API, Cloudinary, Google fonts/sign-in, Razorpay), anything under /api or /auth,
 *    anything carrying an Authorization header, Range requests (video seeking) and video/audio.
 *    So no API or auth response is ever stored here.
 *
 * Update flow: bump VERSION to ship a new worker. The new worker installs and WAITS; the page
 * (src/index.js) shows "A new version is available - Refresh". Tapping it posts SKIP_WAITING,
 * the worker activates, old caches are deleted, and the page reloads once.
 */
const VERSION = 'v2';
const SHELL_CACHE = 'ugcad-shell-' + VERSION;
const RUNTIME_CACHE = 'ugcad-runtime-' + VERSION;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-180.png',
];
const RUNTIME_MAX_ENTRIES = 120;
const ASSET_RE = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('ugcad-') && k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function trimCache(cacheName, max) {
  return caches.open(cacheName).then((cache) =>
    cache.keys().then((keys) => {
      if (keys.length <= max) return undefined;
      return Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
    })
  );
}

function cacheFirst(request) {
  return caches.match(request).then((hit) => {
    if (hit) return hit;
    return fetch(request).then((res) => {
      // Never store the SPA's index.html that a host answers with for a missing chunk: it would
      // be served as JS/CSS forever (the URL is fingerprinted, so it is never re-requested).
      const type = (res && res.headers.get('content-type')) || '';
      if (res && res.ok && res.type === 'basic' && type.indexOf('text/html') === -1) {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
      }
      return res;
    });
  });
}

function staleWhileRevalidate(request, event) {
  return caches.open(RUNTIME_CACHE).then((cache) =>
    cache.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            cache.put(request, res.clone()).then(() => trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES));
          }
          return res;
        })
        .catch(() => hit || Response.error());
      if (hit) { event.waitUntil(network); return hit; }
      return network;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;               // API, CDNs, Google, Razorpay

  // Page loads (including the /auth SPA route): network-first, offline page on failure.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error()))
    );
    return;
  }

  if (/^\/(?:api|auth)(?:\/|$)/.test(url.pathname)) return;       // never cache API/auth data
  if (request.headers.has('authorization')) return;
  if (request.headers.has('range')) return;                       // video seeking
  if (request.destination === 'video' || request.destination === 'audio') return;

  if (url.pathname.startsWith('/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (PRECACHE.indexOf(url.pathname) !== -1) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
    return;
  }

  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
