import { h, pick } from './util.js';
import { state, save, REWARDS, nextReward, askPersist, db } from './store.js';
import { studio } from './studio.js';
import { school, lessonIntro, lessonPlay } from './school.js';
import { coloringHub, coloringPlay } from './coloring.js';
import { worldView, creatureDraw } from './world.js';
import { gamesHub, gameRoute } from './games.js';
import { gallery, artView } from './gallery.js';
import { mascot, icon, topbar, btn, starBadge, toast, confirmBox, shareBlob, popover } from './ui.js';
import { ALL_LESSONS } from './lessons.js';
import moreIdeas from './content/ideas.js';
import moreIdeas2 from './content/ideas2.js';
import { sfx } from './audio.js';
import { t, N, lang, dir, appName, LANGS } from './i18n.js';
import { hello, me, setLang } from './hello.js';
import { rating } from './rating.js';
import { startSync, joinRating, leaveRating, classFromLink, cleanClass, newClassCode, inviteLink, setClass } from './player.js';

// The page speaks the chosen language: direction, title and the home-screen name.
document.documentElement.lang = lang;
document.documentElement.dir = dir;
document.title = appName;
document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', appName);

const IDEAS = [
  N('дом, в котором ты хотела бы жить'), N('самое вкусное мороженое на свете'), N('кот-супергерой'), N('чудовище, которое боится мышей'),
  N('твоя комната через сто лет'), N('город на спине черепахи'), N('портрет своего лучшего друга'), N('что снится твоей игрушке'),
  N('платье из цветов'), N('робот-няня'), N('необычная машина для мороженого'), N('планета, где всё розовое'), N('дерево, на котором растут конфеты'),
  N('твой самый счастливый день'), N('зверь, которого ещё никто не видел'), N('подводная школа'), N('замок из облаков'), N('рюкзак волшебника'),
  N('погода в твоём настроении'), N('семья ёжиков на пикнике'), N('летающий велосипед'),
];
IDEAS.push(...moreIdeas, ...moreIdeas2);

const TILES = [
  { href: '#/studio/new', cls: 'studio', title: N('Мастерская'), sub: N('Рисуй что хочешь'),
    art: `<circle cx="66" cy="66" r="52" fill="#fff"/><circle cx="42" cy="50" r="11" fill="#ff6b5e"/><circle cx="72" cy="38" r="11" fill="#ffc83d"/><circle cx="97" cy="58" r="11" fill="#27c4a8"/><circle cx="88" cy="90" r="11" fill="#4aa8ff"/><circle cx="56" cy="92" r="9" fill="#2a2140"/><path d="M120 12L150 42 96 112c-10 12-30 14-40 8 6-8 6-22 14-32z" fill="#ff85c0"/>` },
  { href: '#/school', cls: 'school', title: N('Школа рисования'), sub: N('Шаг за шагом'),
    art: `<rect x="14" y="14" width="124" height="104" rx="8" fill="#fff"/><path d="M76 96c-24 0-40-14-40-32 0-8 3-14 8-20l-3-20 18 10c6-2 11-3 17-3s11 1 17 3l18-10-3 20c5 6 8 12 8 20 0 18-16 32-40 32z" fill="none" stroke="#2a2140" stroke-width="5" stroke-dasharray="9 8" stroke-linecap="round"/><circle cx="62" cy="62" r="5" fill="#2a2140"/><circle cx="90" cy="62" r="5" fill="#2a2140"/>` },
  { href: '#/coloring', cls: 'coloring', title: N('Раскраски'), sub: N('Кисть не вылезет за контур'),
    art: `<path d="M70 18c12 0 20 14 12 26 14-6 30 2 30 16s-16 22-30 16c8 12 0 26-12 26s-20-14-12-26c-14 6-30-2-30-16s16-22 30-16c-8-12 0-26 12-26z" fill="#fff" stroke="#2a2140" stroke-width="5"/><path d="M70 18c12 0 20 14 12 26 14-6 30 2 30 16s-16 22-30 16c8 12 0 26-12 26z" fill="#ff85c0" stroke="#2a2140" stroke-width="5"/><circle cx="70" cy="60" r="13" fill="#ffc83d" stroke="#2a2140" stroke-width="5"/>` },
  { href: '#/coloring/num', cls: 'num', title: N('По номерам'), sub: N('Спокойно и красиво'),
    art: `<rect x="16" y="16" width="52" height="52" rx="10" fill="#ffc83d"/><rect x="72" y="16" width="52" height="52" rx="10" fill="#fff"/><rect x="16" y="72" width="52" height="52" rx="10" fill="#fff"/><rect x="72" y="72" width="52" height="52" rx="10" fill="#ff6b5e"/><g font-size="30" font-weight="800" text-anchor="middle" fill="#2a2140" font-family="ui-rounded,system-ui"><text x="98" y="53">2</text><text x="42" y="109">3</text></g>` },
  { href: '#/world/sea', cls: 'world', title: N('Живой мир'), sub: N('Рисунки оживают!'),
    art: `<path d="M18 70C40 26 96 26 118 70 96 114 40 114 18 70z" fill="#ffc83d" stroke="#2a2140" stroke-width="5"/><path d="M116 70l28-26-6 26 6 26z" fill="#ff6b5e" stroke="#2a2140" stroke-width="5" stroke-linejoin="round"/><circle cx="46" cy="60" r="7" fill="#2a2140"/><circle cx="20" cy="30" r="7" fill="none" stroke="#fff" stroke-width="4"/><circle cx="36" cy="14" r="4" fill="none" stroke="#fff" stroke-width="3"/>` },
  { href: '#/games', cls: 'games', title: N('Игры'), sub: N('Пазлы, пары, мультики, пиксели'),
    art: `<rect x="20" y="24" width="88" height="88" rx="16" fill="#fff" stroke="#2a2140" stroke-width="5" transform="rotate(-12 64 68)"/><g fill="#2a2140"><circle cx="46" cy="52" r="8"/><circle cx="82" cy="46" r="8"/><circle cx="64" cy="68" r="8"/><circle cx="46" cy="90" r="8"/><circle cx="84" cy="84" r="8"/></g>` },
  { href: '#/rating', cls: 'rating', title: N('Рейтинг'), sub: N('Кто набрал больше звёзд'),
    art: `<rect x="56" y="34" width="44" height="86" rx="6" fill="#ffc83d" stroke="#2a2140" stroke-width="5"/><rect x="10" y="60" width="44" height="60" rx="6" fill="#fff" stroke="#2a2140" stroke-width="5"/><rect x="102" y="76" width="44" height="44" rx="6" fill="#ff85c0" stroke="#2a2140" stroke-width="5"/><path d="M78 6l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z" fill="#ffc83d" stroke="#2a2140" stroke-width="4" stroke-linejoin="round"/>` },
  { href: '#/gallery', cls: 'gallery', title: N('Галерея'), sub: N('Мои картины'),
    art: `<rect x="14" y="20" width="112" height="96" rx="6" fill="#fff" stroke="#2a2140" stroke-width="5"/><path d="M22 106l30-40 22 26 18-16 26 30z" fill="#27c4a8"/><circle cx="96" cy="44" r="12" fill="#ffc83d"/>` },
];

function langPop(anchor) {
  popover(anchor, h('div', { class: 'pop-list' }, Object.entries(LANGS).map(([code, L]) =>
    h('button', { class: `pick ${code === lang ? 'on' : ''}`, lang: code, dir: L.dir, onclick: () => setLang(code, '#/') }, L.name))));
}

function home(root) {
  const doy = Math.floor(Date.now() / 864e5);
  const idea = IDEAS[doy % IDEAS.length];
  const nr = nextReward();
  const lessonsDone = ALL_LESSONS.filter(l => state.best[`lesson:${l.id}:trace`]).length;
  root.append(h('div', { class: 'screen scroll home' },
    h('header', { class: 'home-top' },
      h('a', { class: 'mascot-wrap', href: '#/prizes', 'aria-label': t('Подарки') }, mascot('joy')),
      h('div', { class: 'hello' },
        h('h1', {}, h('a', { class: 'me-avatar', href: '#/me', 'aria-label': t('Мой профиль') }, state.avatar), t('Привет, {name}!', { name: state.name })),
        h('p', {}, h('span', {}, t('Идея дня:'), ' '), h('b', {}, t(idea))),
      ),
      h('button', {
        class: 'btn accent idea-go',
        onclick: () => { sfx.pop(); sessionStorage.setItem('prompt', idea); location.hash = '#/studio/new'; },
      }, t('Рисуем!')),
      starBadge(),
      h('button', { class: 'btn icon lang-btn', 'aria-label': t('Язык'), onclick: e => langPop(e.currentTarget) }, LANGS[lang].short),
      h('a', { class: 'btn icon', href: '#/parents', 'aria-label': t('Для родителей') }, icon('gear')),
    ),
    h('main', { class: 'tiles' }, TILES.map(tile => h('a', { class: `tile t-${tile.cls}`, href: tile.href },
      h('span', { class: 'tile-art', html: `<svg viewBox="0 0 160 136">${tile.art}</svg>` }),
      h('span', { class: 'tile-text' }, h('b', {}, t(tile.title)), h('small', {}, t(tile.sub))),
      tile.cls === 'school' && h('em', { class: 'tile-prog' }, t('{a} из {b}', { a: lessonsDone, b: ALL_LESSONS.length })),
    ))),
    nr && h('a', { class: 'next-gift', href: '#/prizes' }, t('Следующий подарок: {name} — ещё {n} ★', { name: t(nr.name), n: nr.at - state.stars })),
  ));
}

function prizes(root) {
  root.append(h('div', { class: 'screen scroll hub' },
    topbar(t('Подарки за звёзды'), { right: [starBadge()] }),
    h('div', { class: 'prize-list' }, REWARDS.map(r => {
      const open = state.stars >= r.at;
      return h('div', { class: `prize ${open ? 'open' : ''}` },
        h('span', { class: 'prize-at' }, open ? '✓' : `${r.at}★`),
        h('b', {}, t(r.name)),
        h('small', {}, open ? t('Твоё!') : t('Осталось {n} ★', { n: r.at - state.stars })),
      );
    })),
    h('p', { class: 'note' }, t('Звёзды нельзя потерять. Их дают за уроки, игры и рисунки.')),
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
  const input = h('input', { type: 'number', inputmode: 'numeric', class: 'gate-input', 'aria-label': t('Ответ') });
  const gate = h('div', { class: 'gate' },
    // The sum is isolated left to right, so in Hebrew it still reads "6 × 7", not "7 × 6".
    h('h2', {}, t('Для взрослых: сколько будет {a} × {b}?', { a: `⁦${a}`, b: `${b}⁩` })),
    input,
    btn('primary', t('Войти'), () => {
      if (+input.value === a * b) { gate.remove(); body.classList.remove('hidden'); } else toast(t('Неправильно'));
    }),
  );
  const name = h('input', { value: state.name, class: 'field', 'aria-label': t('Имя') });
  name.addEventListener('change', () => { state.name = name.value.replace(/\s+/g, ' ').trim().slice(0, 24) || state.name; name.value = state.name; save(); });
  const check = (label, k) => h('label', { class: 'set' }, h('span', {}, label), h('input', {
    type: 'checkbox', ...(state[k] ? { checked: true } : {}),
    onchange: e => { state[k] = e.target.checked; save(); },
  }));
  const brk = h('select', { class: 'field', 'aria-label': t('Напоминание') },
    [0, 20, 30, 45, 60].map(m => h('option', { value: m, ...(state.breakMin === m ? { selected: true } : {}) }, m ? t('Каждые {m} мин', { m }) : t('Не напоминать'))));
  brk.addEventListener('change', () => { state.breakMin = +brk.value; save(); });

  const restore = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden' });
  restore.addEventListener('change', async () => {
    const f = restore.files[0];
    if (!f || !(await confirmBox(t('Заменить данные из архива?'), t('Заменить'), t('Отмена')))) return;
    try {
      const data = JSON.parse(await f.text());
      for (const s of ['art', 'world', 'kv']) {
        for (const it of data[s] || []) await db.put(s, await walk(it, fromB64));
      }
      Object.assign(state, data.state);
      save();
      toast(t('Архив восстановлен'));
      // Starts again with everything from the archive: language, stars, prizes.
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      console.error(e);
      toast(t('Не получилось прочитать архив'));
    }
  });

  const body = h('div', { class: 'parents-body hidden' },
    h('section', {}, h('h3', {}, t('Настройки')),
      h('label', { class: 'set' }, h('span', {}, t('Имя')), name),
      check(t('Звуки'), 'sound'),
      check(t('Блобика читает подсказки вслух'), 'voice'),
      check(t('Открыть сразу все уровни в играх'), 'unlockAll'),
      h('label', { class: 'set' }, h('span', {}, t('Напоминать об отдыхе глаз')), brk),
    ),
    h('section', {}, h('h3', {}, t('Язык')),
      h('div', { class: 'row wrap parents-langs' }, Object.entries(LANGS).map(([code, L]) =>
        btn(code === lang ? 'primary' : 'ghost', L.name, () => setLang(code, '#/parents')))),
    ),
    h('section', {}, h('h3', {}, t('Рейтинг класса')),
      h('p', {}, t('В рейтинге видны только имя, значок и число звёзд, и только одноклассницам с тем же кодом класса. Если выключить, сервер забудет всё об этом игроке.')),
      classRow(),
      h('label', { class: 'set' }, h('span', {}, t('Участвовать в рейтинге')), h('input', {
        type: 'checkbox', ...(state.rated ? { checked: true } : {}),
        onchange: async e => {
          const on = e.target.checked;
          try {
            if (on) await joinRating(); else await leaveRating();
            toast(on ? t('Теперь она в рейтинге') : t('Убрали из рейтинга'));
          } catch {
            toast(t('Нет связи с интернетом. Попробуйте позже.'));
            state.rated = !on;
            e.target.checked = !on;
            save();
          }
        },
      })),
    ),
    h('section', {}, h('h3', {}, t('Сохранность рисунков')),
      h('p', {}, t('Рисунки хранятся только на этом iPad. Иногда скачивайте архив, чтобы они не потерялись при сбросе устройства.')),
      h('div', { class: 'row wrap' },
        btn('primary', t('Скачать архив'), async () => {
          toast(t('Собираю архив…'));
          const dump = { state };
          for (const s of ['art', 'world', 'kv']) dump[s] = await walk(await db.all(s), toB64);
          const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
          const name = `blobika-${new Date().toISOString().slice(0, 10)}.json`;
          // iPad only allows sharing right after a tap, so saving gets its own button.
          const o = h('div', { class: 'modal-back' }, h('div', { class: 'modal' },
            mascot('joy'),
            h('h2', {}, t('Архив готов')),
            h('p', {}, t('Размер: {n} МБ', { n: (blob.size / 1e6).toFixed(1) })),
            h('div', { class: 'row' },
              btn('ghost', t('Отмена'), () => o.remove()),
              btn('primary', t('Сохранить архив'), () => { o.remove(); return shareBlob(blob, name); }),
            ),
          ));
          document.body.append(o);
        }),
        h('label', { class: 'btn ghost' }, restore, t('Восстановить')),
      ),
    ),
    h('section', {}, h('h3', {}, t('Как поставить на iPad')),
      h('ol', {},
        h('li', {}, t('Откройте эту страницу в Safari.')),
        h('li', {}, t('Нажмите «Поделиться», затем «На экран Домой».')),
        h('li', {}, t('Запускайте с иконки: так работает офлайн и на весь экран.')),
        h('li', {}, t('Если рисуете Apple Pencil: Настройки → Apple Pencil → выключите «От руки» (Scribble), чтобы система не перехватывала быстрые штрихи.')),
      ),
    ),
  );

  // The old address keeps working, but its pictures and stars can move to blobika.com.
  if (/github\.io$/.test(location.hostname)) {
    body.prepend(h('section', { class: 'moved' }, h('h3', {}, t('Блобика переехала на blobika.com')),
      h('ol', {},
        h('li', {}, t('Здесь, ниже, нажмите «Скачать архив» и сохраните файл.')),
        h('li', {}, t('Откройте blobika.com в Safari и поставьте на экран Домой.')),
        h('li', {}, t('Там в разделе «Для родителей» нажмите «Восстановить» и выберите этот файл.')),
      ),
      h('a', { class: 'btn primary', href: 'https://blobika.com/' }, t('Открыть blobika.com'))));
  }
  root.append(h('div', { class: 'screen scroll hub parents' }, topbar(t('Для родителей')), gate, body));
}

// The class code: typed in, made anew, or shared with classmates as a link.
function classRow() {
  const field = h('input', { value: state.classCode, class: 'field', dir: 'ltr', autocapitalize: 'off', spellcheck: 'false', 'aria-label': t('Код класса') });
  const apply = async code => {
    const c = cleanClass(code);
    if (code && !c) { toast(t('Код — это от 4 до 24 латинских букв, цифр или чёрточек.')); field.value = state.classCode; return; }
    field.value = c;
    await setClass(c);
    toast(c ? t('Код класса сохранён') : t('Код класса убран'));
  };
  field.addEventListener('change', () => apply(field.value));
  return h('div', { class: 'class-row' },
    h('label', { class: 'set' }, h('span', {}, t('Код класса')), field),
    h('div', { class: 'row wrap' },
      btn('ghost', t('Новый класс'), () => apply(newClassCode())),
      btn('primary', t('Пригласить одноклассниц'), async () => {
        if (!state.classCode) { toast(t('Сначала задайте код класса.')); return; }
        const url = inviteLink(state.classCode);
        try {
          if (navigator.share) await navigator.share({ title: appName, text: t('Рисуем и соревнуемся вместе!'), url });
          else { await navigator.clipboard.writeText(url); toast(t('Ссылка скопирована')); }
        } catch (e) {
          if (e?.name !== 'AbortError') toast(url);
        }
      })),
  );
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
  hello,
  me,
  rating,
};

const root = document.getElementById('app');
let cleanup = null;
let token = 0;
let updateReady = false;
let updateTimer = 0;

// A new version switches in by itself, but never under her hands: only after she
// has rested on the home screen for a few seconds, so the picture she just left
// has finished saving.
function planUpdate() {
  clearTimeout(updateTimer);
  if (!updateReady) return;
  updateTimer = setTimeout(() => {
    const home = !location.hash.replace(/^#\/?/, '');
    if (home && !document.querySelector('.modal-back')) location.reload();
  }, 4000);
}

async function go() {
  const my = ++token;
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  document.querySelectorAll('.pop,.modal-back,.toast,.confetti').forEach(e => e.remove());
  root.textContent = '';
  let [name, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  // A new device first meets the player: language, name and avatar.
  if (!state.onboarded && name !== 'hello') {
    history.replaceState(null, '', '#/hello');
    [name, ...args] = ['hello'];
  }
  if (!name) planUpdate();
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
      h('h2', {}, t('Пусть глазки отдохнут!')),
      h('p', {}, t(pick([N('Посмотри в окно на что-нибудь далёкое.'), N('Покрути плечами и потряси кистями рук.'), N('Поморгай быстро-быстро двадцать раз.')]))),
      btn('primary', t('Сделала!'), () => o.remove()),
    ));
    document.body.append(o);
  }
}, 60000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // On the very first visit a worker also takes over, but that is not an update.
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadWorker || updateReady) return;
    updateReady = true;
    planUpdate();
  });
  navigator.serviceWorker.register('sw.js');
}

classFromLink();
startSync();
go();
