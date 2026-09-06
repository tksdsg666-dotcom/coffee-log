/**
 * Service worker — what makes this installable and usable with no signal.
 *
 * Caching happens at runtime rather than from a precache list, because the
 * bundle filename carries a content hash that only exists after `expo export`;
 * a hard-coded list would have to be regenerated on every deploy and would
 * silently rot the first time someone forgot. The first online visit fills the
 * cache, and every visit after that works offline.
 *
 * Update strategy: navigations go to the network first, so a deploy is picked
 * up as soon as the phone has signal, and the new index.html references the new
 * hashed bundle. The worker itself skips waiting — the export is a single
 * bundle with no lazily-loaded chunks, so there is no half-old/half-new state
 * to protect against, and waiting would strand a home-screen app that is never
 * fully closed on an old version indefinitely.
 */
const VERSION = 'v1';
const CACHE = `coffee-log-${VERSION}`;
const SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      // A failed shell fetch must not abort the install; the first navigation
      // will cache it instead.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/** Hashed and immutable — safe to serve from cache without revalidating. */
const isImmutable = (url) =>
  url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/');

const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) void cache.put(request, response.clone());
  return response;
};

const networkFirst = async (request, fallback) => {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) void cache.put(fallback ?? request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(fallback ?? request);
    if (hit) return hit;
    throw error;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Someone else's server is not ours to cache, and range requests confuse the
  // Cache API badly enough to be worth stepping out of the way for.
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    // Every route is the same document; the server rewrites unknown paths to it
    // and so does this, which is what keeps a deep link working offline.
    event.respondWith(networkFirst(request, SHELL));
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
