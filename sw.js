// Keeps the whole app available with no internet.
// deploy.sh replaces this name with the commit hash, so every deploy updates the app.
const CACHE = 'klyaksa-dev';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/main.js', 'js/util.js', 'js/store.js', 'js/audio.js', 'js/ui.js', 'js/art.js', 'js/brushes.js',
  'js/painter.js', 'js/studio.js', 'js/lessons.js', 'js/school.js', 'js/coloring.js', 'js/world.js',
  'js/games.js', 'js/gallery.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)),
  );
});
