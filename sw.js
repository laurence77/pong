const CACHE_NAME = 'pong-cache-v3';
// Keep precache minimal to avoid install failures; icons cached on demand
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './pong.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './assets/sfx-sprite.mp3',
  './assets/sfx-sprite.wav'
];

// No optional assets currently
const OPTIONAL_ASSETS = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(ASSETS);
      await Promise.all(OPTIONAL_ASSETS.map(async (url) => {
        try {
          const resp = await fetch(url, { cache: 'no-store' });
          if (resp && resp.ok) {
            await cache.put(url, resp.clone());
          }
        } catch {
          // ignore missing optional assets
        }
      }));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // only cache GET
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
