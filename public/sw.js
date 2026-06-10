// Service Worker for Urdu Composer Pro PWA installability & caching
const CACHE_NAME = 'urdu-composer-pro-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-512.png'
];

// On install, precache core layout assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Clean up old caches on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler - intercepts requests, uses network-first strategy for smooth developer updates
self.addEventListener('fetch', (event) => {
  // Only intercept normal GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip intercepting API endpoints completely so voice streaming & PDF analysis are never stored
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip Hot-Module-Replacement web socket connections in dev environments
  if (url.pathname.includes('vite') || url.hostname === 'localhost' && url.port !== '3000') {
    return;
  }

  // Core Network-First fetch fallback strategy for assets to prevent stale state issues
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful responses for our precached assets or resources
        if (networkResponse.status === 200 && PRECACHE_ASSETS.includes(url.pathname)) {
          const cacheCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheCopy);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // fallback to index.html for virtual client routes if applicable
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
