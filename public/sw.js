importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log('Workbox is loaded successfully in NEXPOS SW.');

  const CACHE_VERSION = 'v=1.2.0';
  const ASSETS_CACHE = `nx-assets-${CACHE_VERSION}`;
  const METRICS_CACHE = `nx-metrics-${CACHE_VERSION}`;
  const PAGES_CACHE = `nx-pages-${CACHE_VERSION}`;

  // Forces new Service Worker to activate and take over immediately
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  // Purge old cache versions on activation
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== ASSETS_CACHE && name !== METRICS_CACHE && name !== PAGES_CACHE)
            .map((name) => caches.delete(name))
        );
      }).then(() => self.clients.claim())
    );
  });

  // Cache static assets (CSS, JS, Web Fonts, Local Images) using Cache-First strategy
  workbox.routing.registerRoute(
    ({ request }) =>
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'font' ||
      request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: ASSETS_CACHE,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 120,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days cache validity
        }),
      ],
    })
  );

  // Telemetry, dashboard, and metrics APIs use Network-First strategy
  workbox.routing.registerRoute(
    ({ url }) =>
      url.pathname.includes('/api/metrics') ||
      url.pathname.includes('/api/dashboard') ||
      url.pathname.includes('/api/telemetry') ||
      url.pathname.includes('/rest/v1/current_stock'), // Supabase view metrics
    new workbox.strategies.NetworkFirst({
      cacheName: METRICS_CACHE,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 24 * 60 * 60, // 1 Day
        }),
      ],
    })
  );

  // Navigation pages use Network-First to guarantee offline PWA Shell loading
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: PAGES_CACHE,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
        }),
      ],
    })
  );
} else {
  console.error('Workbox failed to load on the client.');
}
