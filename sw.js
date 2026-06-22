/* ============================================================
   TRASLOCO SICURO — Service Worker
   Versione: 1.0
   Strategia: Cache-first per l'app shell, network-first per Firebase
   ============================================================ */

const CACHE_NAME   = 'trasloco-sicuro-v1';
const CACHE_ASSETS = [
  './trasloco-sicuro.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&display=swap',
];

// --- INSTALL: scarica e metti in cache i file principali
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_ASSETS).catch(err => {
        console.warn('[SW] Alcuni file non cachati:', err);
      });
    })
  );
});

// --- ACTIVATE: pulisce le cache vecchie
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// --- FETCH: strategia intelligente per ruolo del file
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase, Google APIs, CDN esterni → sempre da rete
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('googleapis.com') ||
    url.includes('anthropic.com') ||
    url.startsWith('chrome-extension')
  ) {
    return; // lascia passare senza intercettare
  }

  // Google Fonts CSS → network-first con fallback cache
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App shell (HTML, icone, manifest) → cache-first con aggiornamento in background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
