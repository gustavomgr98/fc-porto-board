// FC Porto Board — service worker
//
// Everything the app needs (HTML, CSS, JS, images) is inlined into a single
// index.html, so caching that one file is enough to run the whole app with
// no network at all. The only external resource is the Google Fonts
// stylesheet + font files, which are cached the first time they load
// successfully and reused after that.
//
// Strategy: stale-while-revalidate everywhere. Always answer instantly from
// cache when a cached copy exists (works with zero connectivity, e.g.
// pitch-side during a match), while quietly refreshing the cache in the
// background whenever there is a network connection — so the app picks up
// updates the next time it's opened, without ever requiring network to work.

const SHELL_CACHE = 'fcpb-shell-v1';
const FONT_CACHE = 'fcpb-fonts-v1';
const SHELL_URLS = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}) // still install even if the initial precache fails
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== FONT_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && (response.ok || response.type === 'opaque')) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = req.url;
  const isFont = url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com');
  const isShell = req.mode === 'navigate' || url.endsWith('/') || url.endsWith('index.html');

  if (isShell) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
  } else if (isFont) {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
  }
  // anything else (there isn't much — the app is self-contained) falls
  // through to the browser's normal network handling.
});
