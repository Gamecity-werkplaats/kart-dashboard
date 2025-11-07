// simple update-friendly service worker
const VERSION = 'v20251107';
const CACHE_NAME = 'app-cache-' + VERSION;
const ASSETS_TO_CACHE = [
  // add any static assets you want to cache, or leave empty to rely on runtime fetches
];

// Install -> populate (optional)
self.addEventListener('install', (ev) => {
  self.skipWaiting(); // force the waiting worker to become active
  ev.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      if (ASSETS_TO_CACHE.length) return cache.addAll(ASSETS_TO_CACHE);
      return Promise.resolve();
    })
  );
});

// Activate -> cleanup old caches and take control
self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch -> default to network first, fallback to cache
self.addEventListener('fetch', (ev) => {
  // For navigation requests (HTML), prefer network so we get fresh index.html
  if (ev.request.mode === 'navigate') {
    ev.respondWith(
      fetch(ev.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other requests, try network then cache
  ev.respondWith(
    fetch(ev.request).then(res => {
      // optionally update cache for future
      if (res && res.status === 200 && ev.request.method === 'GET') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(ev.request, copy));
      }
      return res;
    }).catch(() => caches.match(ev.request))
  );
});


