const CACHE_NAME = 'gastos-app-v7';
const APP_ASSETS = [
  './?v=7',
  './index.html',
  './styles.css?v=7',
  './app.js?v=7',
  './manifest.webmanifest?v=7',
  './cache-reset.html',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        const requestUrl = new URL(event.request.url);

        if (requestUrl.origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }

        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => cached || caches.match('./index.html'));
    })
  );
});
