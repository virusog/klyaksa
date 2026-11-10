// Keeps the whole app available with no internet.
// deploy.sh replaces this name with the commit hash, so every deploy updates the app.
const CACHE = 'klyaksa-dev';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/main.js', 'js/util.js', 'js/store.js', 'js/audio.js', 'js/ui.js', 'js/art.js', 'js/brushes.js',
  'js/painter.js', 'js/studio.js', 'js/lessons.js', 'js/school.js', 'js/coloring.js', 'js/world.js',
  'js/games.js', 'js/gallery.js', 'js/pages.js',
  'js/content/lessons-warmup.js',
  'js/content/lessons-shapes-a.js',
  'js/content/lessons-shapes-b.js',
  'js/content/lessons-animals-a.js',
  'js/content/lessons-animals-b.js',
  'js/content/lessons-volume.js',
  'js/content/lessons-people.js',
  'js/content/pages-animals.js',
  'js/content/pages-fantasy.js',
  'js/content/pages-nature.js',
  'js/content/pages-world.js',
  'js/content/pixels.js',
  'js/content/pixels-pets.js',
  'js/content/pixels-wild.js',
  'js/content/pixels-sea.js',
  'js/content/pixels-nature.js',
  'js/content/pixels-food.js',
  'js/content/pixels-fruit.js',
  'js/content/pixels-magic.js',
  'js/content/pixels-space.js',
  'js/content/pixels-things.js',
  'js/content/pixels-holidays.js',
  'js/content/world-guides.js',
  'js/content/lab.js',
  'js/content/dice.js',
  'js/content/ideas.js',
  'js/content/stickers.js',
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
