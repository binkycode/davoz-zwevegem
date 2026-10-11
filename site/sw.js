// Service worker: keeps the site and the last loaded results available offline.
// Same-origin requests go to the network first (so results are always fresh when online)
// and fall back to the cache; Google Fonts are served from the cache once fetched.

const CACHE = 'davoz-v2';
const SHELL = ['./', 'index.html', 'app.js', 'styles.css', 'data.json', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];

// Bypass the browser's HTTP cache, otherwise an older copy of a file can end up in the offline cache.
const fresh = (request) => request.mode === 'navigate'
  ? fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
  : fetch(new Request(request, { cache: 'no-cache' }));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const url = (request) => { const u = new URL(request.url); u.search = ''; u.hash = ''; return u.href; };

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fresh(request);
    // Pages are stored under the bare URL, so '?v=…' or '#…' variants share one offline copy.
    if (response.ok) cache.put(request.mode === 'navigate' ? url(request) : request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request.mode === 'navigate' ? url(request) : request, { ignoreSearch: true })
      ?? (request.mode === 'navigate' ? await cache.match('./') : undefined);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Calendar feeds are fetched by calendar apps, never from this cache.
  if (url.pathname.endsWith('.ics')) return;
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') event.respondWith(cacheFirst(request));
});
