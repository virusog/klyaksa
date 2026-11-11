// Keeps the whole app available with no internet.
// deploy.sh replaces this name with the commit hash, so every deploy updates the app.
const CACHE = 'klyaksa-dev';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'css/play/pairs.css',
  'css/play/puzzle.css',
  'css/play/diff.css',
  'css/play/dots.css',
  'css/play/dictation.css',
  'css/play/oneline.css',
  'css/play/shades.css',
  'css/play/patterns.css',
  'css/play/anim.css',
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
  'js/pix.js',
  'js/play/kit.js',
  'js/play/pairs.js',
  'js/play/puzzle.js',
  'js/play/diff.js',
  'js/play/dots.js',
  'js/play/dictation.js',
  'js/play/oneline.js',
  'js/play/shades.js',
  'js/play/patterns.js',
  'js/play/anim.js',
  'js/content/pixels16-animals.js',
  'js/content/pixels16-fantasy.js',
  'js/content/pixels16-nature.js',
  'js/content/pixels16-food.js',
  'js/content/pixels16-things.js',
  'js/content/pixels16-heroes.js',
  'js/content/lessons2-warmup.js',
  'js/content/lessons2-shapes-a.js',
  'js/content/lessons2-shapes-b.js',
  'js/content/lessons2-animals-a.js',
  'js/content/lessons2-animals-b.js',
  'js/content/lessons2-volume.js',
  'js/content/lessons2-people.js',
  'js/content/lessons2-scenes.js',
  'js/content/pages2-animals.js',
  'js/content/pages2-fantasy.js',
  'js/content/pages2-nature.js',
  'js/content/pages2-world.js',
  'js/content/pages2-patterns.js',
  'js/content/lab2.js',
  'js/content/dice2.js',
  'js/content/ideas2.js',
  'js/content/stickers2.js',
  'js/content/world-guides2.js',
  'js/content/dots.js',
  'js/content/dictation.js',
  'js/content/oneline.js',
  'js/content/dots-a.js',
  'js/content/dots-b.js',
  'js/content/dictation-a.js',
  'js/content/dictation-b.js',
  'js/content/oneline-a.js',
  'js/content/oneline-b.js',
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
