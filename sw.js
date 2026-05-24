const CACHE_VERSION = 'raycash-static-v5';
const APP_SHELL = [
  './',
  './index.html',
  './RayCash.html',
  './manifest.json',
  './sw.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', event => {
  console.log('[RayCash SW] Instalando service worker...', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[RayCash SW] Activando service worker...', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => {
            console.log('[RayCash SW] Eliminando cache antiguo:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[RayCash SW] Recibida orden de activar nueva version.');
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  event.respondWith(handleAssetRequest(request));
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cachedMatch =
    (await cache.match(request, { ignoreSearch: true })) ||
    (await cache.match('./RayCash.html')) ||
    (await cache.match('./index.html'));

  if (cachedMatch) {
    return cachedMatch;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[RayCash SW] Navegacion sin red; devolviendo shell en cache.', error);
    return cache.match('./RayCash.html');
  }
}

async function handleAssetRequest(request) {
  const cachedResponse = await caches.match(request, { ignoreSearch: true });
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[RayCash SW] Asset no disponible sin red:', request.url, error);
    if (request.destination === 'document') {
      const cache = await caches.open(CACHE_VERSION);
      return cache.match('./RayCash.html');
    }
    return Response.error();
  }
}