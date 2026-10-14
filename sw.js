const CACHE = 'saveshelf-v5';
const SHARE_CACHE = 'saveshelf-share';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('saveshelf-v') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Receives what the Android share sheet sends: a link, a screenshot, or both.
// Text fields go to the page as query parameters. An image is parked in a cache for the page to pick up.
async function handleShare(request) {
  const home = new URL('./', self.registration.scope);
  try {
    const form = await request.formData();
    const params = new URLSearchParams();
    for (const key of ['title', 'text', 'url']) {
      const v = form.get(key);
      if (typeof v === 'string' && v) params.set(key, v);
    }
    const file = form.getAll('media').find(f => f && typeof f !== 'string' && f.size > 0);
    if (file) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put('shared-image', new Response(file, { headers: { 'Content-Type': file.type || 'image/jpeg' } }));
      params.set('shared', 'image');
    }
    home.search = params.toString();
  } catch (err) {
    // fall through to the home page
  }
  return Response.redirect(home.href, 303);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith(handleShare(req));
    return;
  }
  if (req.method !== 'GET') return;

  // Pages come from the network when online, from the cache when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match('./index.html')));
    return;
  }

  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
