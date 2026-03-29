const CACHE = 'yt-viewer-v2';
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── INSTALL EVENT ──
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        console.log('[SW] Precaching:', PRECACHE);
        return cache.addAll(PRECACHE);
      })
      .then(() => {
        console.log('✅ [SW] Install complete');
        return self.skipWaiting();
      })
      .catch(err => console.error('❌ [SW] Install failed:', err))
  );
});

// ── ACTIVATE EVENT ──
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys()
      .then(keys => {
        const oldCaches = keys.filter(k => k !== CACHE);
        if (oldCaches.length) {
          console.log('[SW] Cleaning old caches:', oldCaches);
          return Promise.all(oldCaches.map(k => caches.delete(k)));
        }
        return Promise.resolve();
      })
      .then(() => {
        console.log('✅ [SW] Activate complete');
        return self.clients.claim();
      })
      .catch(err => console.error('❌ [SW] Activate failed:', err))
  );
});

// ── FETCH EVENT ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  // Skip external APIs (YouTube, Google APIs)
  if (url.origin !== location.origin) {
    console.log('[SW] Skipping external:', url.hostname);
    return;
  }

  // Cache-first for same-origin assets
  e.respondWith(
    caches.match(e.request)
      .then(cached => {
        if (cached) {
          console.log('[SW] Cache hit:', e.request.url);
          return cached;
        }
        console.log('[SW] Fetching:', e.request.url);
        return fetch(e.request).then(response => {
          // Only cache successful responses
          if (response.ok && e.request.method === 'GET') {
            const cloned = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, cloned));
          }
          return response;
        });
      })
      .catch(err => {
        console.error('[SW] Fetch error:', err);
        // Return cached version if available, otherwise offline page
        return caches.match(e.request)
          .then(cached => cached || caches.match('./index.html'));
      })
  );

  // Phase 6: Background audio support via MediaSession
  // Service worker will log media events
  if (e.request.destination === 'audio' || e.request.destination === 'video') {
    console.log('[SW] Media request:', e.request.url);
  }
});
