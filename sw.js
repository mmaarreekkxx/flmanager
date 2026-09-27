const CACHE_NAME = 'fleet-panel-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (cacheName) {
              return cacheName !== CACHE_NAME;
            })
            .map(function (cacheName) {
              return caches.delete(cacheName);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Service Worker obsługuje tylko pliki z tego samego repozytorium.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Dokumenty HTML pobieramy najpierw z sieci, aby panel i aplikacje
  // mogły się aktualizować. Przy braku sieci używamy cache.
  if (
    request.destination === 'document' ||
    request.destination === 'manifest'
  ) {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match('./index.html');
          });
        })
    );

    return;
  }

  // Pozostałe zasoby: najpierw cache, potem sieć.
  event.respondWith(
    caches.match(request)
      .then(function (cached) {
        if (cached) {
          return cached;
        }

        return fetch(request).then(function (response) {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, copy);
            });
          }

          return response;
        });
      })
  );
});
