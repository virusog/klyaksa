import { h, pick } from './util.js';
import { state, save, REWARDS, nextReward, askPersist, db } from './store.js';
import { studio } from './studio.js';
import { school, lessonIntro, lessonPlay } from './school.js';
import { coloringHub, coloringPlay } from './coloring.js';
import { worldView, creatureDraw } from './world.js';
import { gamesHub, gameRoute } from './games.js';
import { gallery, artView } from './gallery.js';
import { mascot, icon, topbar, btn, starBadge, toast, confirmBox, shareBlob } from './ui.js';
import { ALL_LESSONS } from './lessons.js';
import moreIdeas from './content/ideas.js';
import { sfx } from './audio.js';

const IDEAS = [
  'дом, в котором ты хотела бы жить', 'самое вкусное мороженое на свете', 'кот-супергерой', 'чудовище, которое боится мышей',
  'твоя комната через сто лет', 'город на спине черепахи', 'портрет своего лучшего друга', 'что снится твоей игрушке',
  'платье из цветов', 'робот-няня', 'необычная машина для мороженого', 'планета, где всё розовое', 'дерево, на котором растут конфеты',
  'твой самый счастливый день', 'зверь, которого ещё никто не видел', 'подводная школа', 'замок из облаков', 'рюкзак волшебника',
  'погода в твоём настроении', 'семья ёжиков на пикнике', 'летающий велосипед',
];
IDEAS.push(...moreIdeas);

const TILES = [
  { href: '#/studio/new', cls: 'studio', title: 'Мастерская', sub: 'Рисуй что хочешь',
    art: `<circle cx="66" cy="66" r="52" fill="#fff"/><circle cx="42" cy="50" r="11" fill="#ff6b5e"/><circle cx="72" cy="38" r="11" fill="#ffc83d"/><circle cx="97" cy="58" r="11" fill="#27c4a8"/><circle cx="88" cy="90" r="11" fill="#4aa8ff"/><circle cx="56" cy="92" r="9" fill="#2a2140"/><path d="M120 12L150 42 96 112c-10 12-30 14-40 8 6-8 6-22 14-32z" fill="#ff85c0"/>` },
  { href: '#/school', cls: 'school', title: 'Школа рисования', sub: 'Шаг за шагом',
    art: `<rect x="14" y="14" width="124" height="104" rx="8" fill="#fff"/><path d="M76 96c-24 0-40-14-40-32 0-8 3-14 8-20l-3-20 18 10c6-2 11-3 17-3s11 1 17 3l18-10-3 20c5 6 8 12 8 20 0 18-16 32-40 32z" fill="none" stroke="#2a2140" stroke-width="5" stroke-dasharray="9 8" stroke-linecap="round"/><circle cx="62" cy="62" r="5" fill="#2a2140"/><circle cx="90" cy="62" r="5" fill="#2a2140"/>` },
  { href: '#/coloring', cls: 'coloring', title: 'Раскраски', sub: 'Кисть не вылезет за контур',
    art: `<path d="M70 18c12 0 20 14 12 26 14-6 30 2 30 16s-16 22-30 16c8 12 0 26-12 26s-20-14-12-26c-14 6-30-2-30-16s16-22 30-16c-8-12 0-26 12-26z" fill="#fff" stroke="#2a2140" stroke-width="5"/><path d="M70 18c12 0 20 14 12 26 14-6 30 2 30 16s-16 22-30 16c8 12 0 26-12 26z" fill="#ff85c0" stroke="#2a2140" stroke-width="5"/><circle cx="70" cy="60" r="13" fill="#ffc83d" stroke="#2a2140" stroke-width="5"/>` },
  { href: '#/coloring/num', cls: 'num', title: 'По номерам', sub: 'Спокойно и красиво',
    art: `<rect x="16" y="16" width="52" height="52" rx="10" fill="#ffc83d"/><rect x="72" y="16" width="52" height="52" rx="10" fill="#fff"/><rect x="16" y="72" width="52" height="52" rx="10" fill="#fff"/><rect x="72" y="72" width="52" height="52" rx="10" fill="#ff6b5e"/><g font-size="30" font-weight="800" text-anchor="middle" fill="#2a2140" font-family="ui-rounded,system-ui"><text x="98" y="53">2</text><text x="42" y="109">3</text></g>` },
  { href: '#/world/sea', cls: 'world', title: 'Живой мир', sub: 'Рисунки оживают!',
    art: `<path d="M18 70C40 26 96 26 118 70 96 114 40 114 18 70z" fill="#ffc83d" stroke="#2a2140" stroke-width="5"/><path d="M116 70l28-26-6 26 6 26z" fill="#ff6b5e" stroke="#2a2140" stroke-width="5" stroke-linejoin="round"/><circle cx="46" cy="60" r="7" fill="#2a2140"/><circle cx="20" cy="30" r="7" fill="none" stroke="#fff" stroke-width="4"/><circle cx="36" cy="14" r="4" fill="none" stroke="#fff" stroke-width="3"/>` },
  { href: '#/games', cls: 'games', title: 'Игры', sub: 'Закорючки, цвета, пиксели',
    art: `<rect x="20" y="24" width="88" height="88" rx="16" fill="#fff" stroke="#2a2140" stroke-width="5" transform="rotate(-12 64 68)"/><g fill="#2a2140"><circle cx="46" cy="52" r="8"/><circle cx="82" cy="46" r="8"/><circle cx="64" cy="68" r="8"/><circle cx="46" cy="90" r="8"/><circle cx="84" cy="84" r="8"/></g>` },
  { href: '#/gallery', cls: 'gallery', title: 'Галерея', sub: 'Мои картины',
    art: `<rect x="14" y="20" width="112" height="96" rx="6" fill="#fff" stroke="#2a2140" stroke-width="5"/><path d="M22 106l30-40 22 26 18-16 26 30z" fill="#27c4a8"/><circle cx="96" cy="44" r="12" fill="#ffc83d"/>` },
];

function home(root) {
  const doy = Math.floor(Date.now() / 864e5);
  const idea = IDEAS[doy % IDEAS.length];
  const nr = nextReward();
  const lessonsDone = ALL_LESSONS.filter(l => state.best[`lesson:${l.id}:trace`]).length;
  root.append(h('div', { class: 'screen scroll home' },
    h('header', { class: 'home-top' },
      h('a', { class: 'mascot-wrap', href: '#/prizes', 'aria-label': 'Подарки' }, mascot('joy')),
      h('div', { class: 'hello' },
        h('h1', {}, `Привет, ${state.name}!`),
        h('p', {}, h('span', {}, 'Идея дня: '), h('b', {}, idea)),
      ),
      h('button', {
        class: 'btn accent idea-go',
        onclick: () => { sfx.pop(); sessionStorage.setItem('prompt', idea); location.hash = '#/studio/new'; },
      }, 'Рисуем!'),
      starBadge(),
      h('a', { class: 'btn icon', href: '#/parents', 'aria-label': 'Для родителей' }, icon('gear')),
    ),
    h('main', { class: 'tiles' }, TILES.map(t => h('a', { class: `tile t-${t.cls}`, href: t.href },
      h('span', { class: 'tile-art', html: `<svg viewBox="0 0 160 136">${t.art}</svg>` }),
      h('span', { class: 'tile-text' }, h('b', {}, t.title), h('small', {}, t.sub)),
      t.cls === 'school' && h('em', { class: 'tile-prog' }, `${lessonsDone} из ${ALL_LESSONS.length}`),
    ))),
    nr && h('a', { class: 'next-gift', href: '#/prizes' }, `Следующий подарок: ${nr.name} — ещё ${nr.at - state.stars} ★`),
  ));
}

function prizes(root) {
  root.append(h('div', { class: 'screen scroll hub' },
    topbar('Подарки за звёзды', { right: [starBadge()] }),
    h('div', { class: 'prize-list' }, REWARDS.map(r => {
      const open = state.stars >= r.at;
      return h('div', { class: `prize ${open ? 'open' : ''}` },
        h('span', { class: 'prize-at' }, open ? '✓' : `${r.at}★`),
        h('b', {}, r.name),
        h('small', {}, open ? 'Твоё!' : `Осталось ${r.at - state.stars} ★`),
      );
    })),
    h('p', { class: 'note' }, 'Звёзды нельзя потерять. Их дают за уроки, игры и рисунки.'),
  ));
}

async function walk(v, fn) {
  if (v instanceof Blob) return fn(v);
  if (Array.isArray(v)) {
    if (typeof v[0] === 'number') return v;
    return Promise.all(v.map(x => walk(x, fn)));
  }
  if (v && typeof v === 'object') {
    if (v.__b) return fn(v);
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = await walk(x, fn);
    return out;
  }
  return v;
}
const toB64 = b => new Promise(r => { const f = new FileReader(); f.onload = () => r({ __b: f.result }); f.readAsDataURL(b); });
const fromB64 = o => fetch(o.__b).then(r => r.blob());

function parents(root) {
  const a = 6 + Math.floor(Math.random() * 4);
  const b = 6 + Math.floor(Math.random() * 4);
  const input = h('input', { type: 'number', inputmode: 'numeric', class: 'gate-input', 'aria-label': 'Ответ' });
  const gate = h('div', { class: 'gate' },
    h('h2', {}, `Для взрослых: сколько будет ${a} × ${b}?`),
    input,
    btn('primary', 'Войти', () => {
      if (+input.value === a * b) { gate.remove(); body.classList.remove('hidden'); } else toast('Неправильно');
    }),
  );
  const name = h('input', { value: state.name, class: 'field', 'aria-label': 'Имя' });
  name.addEventListener('change', () => { state.name = name.value.trim() || 'Настя'; save(); });
  const check = (label, k) => h('label', { class: 'set' }, h('span', {}, label), h('input', {
    type: 'checkbox', ...(state[k] ? { checked: true } : {}),
    onchange: e => { state[k] = e.target.checked; save(); },
  }));
  const brk = h('select', { class: 'field', 'aria-label': 'Напоминание' },
    [0, 20, 30, 45, 60].map(m => h('option', { value: m, ...(state.breakMin === m ? { selected: true } : {}) }, m ? `Каждые ${m} мин` : 'Не напоминать')));
  brk.addEventListener('change', () => { state.breakMin = +brk.value; save(); });

  const restore = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
  restore.addEventListener('change', async () => {
    const f = restore.files[0];
    if (!f || !(await confirmBox('Заменить данные из архива?', 'Заменить', 'Отмена'))) return;
    try {
      const data = JSON.parse(await f.text());
      for (const s of ['art', 'world', 'kv']) {
        for (const it of data[s] || []) await db.put(s, await walk(it, fromB64));
      }
      Object.assign(state, data.state);
      save();
      toast('Архив восстановлен');
    } catch (e) {
      console.error(e);
      toast('Не получилось прочитать архив');
    }
  });

  const body = h('div', { class: 'parents-body hidden' },
    h('section', {}, h('h3', {}, 'Настройки'),
      h('label', { class: 'set' }, h('span', {}, 'Имя'), name),
      check('Звуки', 'sound'),
      check('Клякса читает подсказки вслух', 'voice'),
      h('label', { class: 'set' }, h('span', {}, 'Напоминать об отдыхе глаз'), brk),
    ),
    h('section', {}, h('h3', {}, 'Сохранность рисунков'),
      h('p', {}, 'Рисунки хранятся только на этом iPad. Иногда скачивайте архив, чтобы они не потерялись при сбросе устройства.'),
      h('div', { class: 'row wrap' },
        btn('primary', 'Скачать архив', async () => {
          toast('Собираю архив…');
          const dump = { state };
          for (const s of ['art', 'world', 'kv']) dump[s] = await walk(await db.all(s), toB64);
          const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
          const name = `klyaksa-${new Date().toISOString().slice(0, 10)}.json`;
          // iPad only allows sharing right after a tap, so saving gets its own button.
          const o = h('div', { class: 'modal-back' }, h('div', { class: 'modal' },
            mascot('joy'),
            h('h2', {}, 'Архив готов'),
            h('p', {}, `Размер: ${(blob.size / 1e6).toFixed(1)} МБ`),
            h('div', { class: 'row' },
              btn('ghost', 'Отмена', () => o.remove()),
              btn('primary', 'Сохранить архив', () => { o.remove(); return shareBlob(blob, name); }),
            ),
          ));
          document.body.append(o);
        }),
        h('label', { class: 'btn ghost' }, restore, 'Восстановить'),
      ),
    ),
    h('section', {}, h('h3', {}, 'Как поставить на iPad'),
      h('ol', {},
        h('li', {}, 'Откройте эту страницу в Safari.'),
        h('li', {}, 'Нажмите «Поделиться», затем «На экран Домой».'),
        h('li', {}, 'Запускайте с иконки: так работает офлайн и на весь экран.'),
        h('li', {}, 'Если рисуете Apple Pencil: Настройки → Apple Pencil → выключите «От руки» (Scribble), чтобы система не перехватывала быстрые штрихи.'),
      ),
    ),
  );

  root.append(h('div', { class: 'screen scroll hub parents' }, topbar('Для родителей'), gate, body));
}

const routes = {
  '': home,
  studio,
  school,
  lesson: (r, id, m) => (m ? lessonPlay(r, id, m) : lessonIntro(r, id)),
  coloring: coloringHub,
  color: coloringPlay,
  world: worldView,
  creature: creatureDraw,
  games: gamesHub,
  game: gameRoute,
  gallery,
  art: artView,
  prizes,
  parents,
};

const root = document.getElementById('app');
let cleanup = null;
let token = 0;

async function go() {
  const my = ++token;
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  document.querySelectorAll('.pop,.modal-back,.toast').forEach(e => e.remove());
  root.textContent = '';
  const [name, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  const route = routes[name] || home;
  const c = await route(root, ...args.map(decodeURIComponent));
  if (my === token) cleanup = c || null;
  else c?.();
}

window.addEventListener('hashchange', go);
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('pointerdown', askPersist, { once: true });

// Gentle reminder to rest the eyes. It never locks anything.
let active = 0;
setInterval(() => {
  if (document.hidden || !state.breakMin) return;
  active += 1;
  if (active >= state.breakMin) {
    active = 0;
    if (document.querySelector('.modal-back')) return;
    const o = h('div', { class: 'modal-back' }, h('div', { class: 'modal' },
      mascot('happy'),
      h('h2', {}, 'Пусть глазки отдохнут!'),
      h('p', {}, pick(['Посмотри в окно на что-нибудь далёкое.', 'Покрути плечами и потряси кистями рук.', 'Поморгай быстро-быстро двадцать раз.'])),
      btn('primary', 'Сделала!', () => o.remove()),
    ));
    document.body.append(o);
  }
}, 60000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}

go();
