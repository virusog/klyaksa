// «Пары»: a memory game with the pixel pictures.
//
// The ladder (the keys pairs:1 … pairs:12 must never change):
//   1–6   plain pairs, 3 → 6 → 8 → 10 → 12 → 15, pictures from different sets
//   7–8   «Тени», 8 and 10 pairs: a picture pairs with its dark silhouette
//   9–10  «Похожие», 10 and 12 pairs: every picture comes from one theme
//   11    15 pairs: silhouettes and one theme at once
//   12    18 pairs of one theme: half picture + silhouette, half identical
import { h, canvas, shuffle, pick } from '../util.js';
import { topbar, btn, speaker, confirmBox } from '../ui.js';
import { db } from '../store.js';
import { sfx } from '../audio.js';
import { PIX, PIX_KEY, PIX_PACKS } from '../pix.js';
import { levelScreen, finishLevel, isOpen } from './kit.js';

const MENU = '#/game/pairs';
const INK = '#2a2140';
const CLOSED = 'Закрытая карточка';

// shadows: how many pairs are picture + silhouette. theme: 1 takes one pack,
// 2 takes a pair of related packs. thumb: what the level card shows.
const LEVELS = [
  { pairs: 3, title: 'Картинки', thumb: ['heart', 'heart'],
    hint: () => 'Открой две карточки. Одинаковые картинки — это пара!' },
  { pairs: 6, title: 'Картинки', thumb: ['cat', 'cat'],
    hint: () => 'Карточек стало больше. Запоминай, где какая лежит.' },
  { pairs: 8, title: 'Картинки', thumb: ['star', 'star'],
    hint: () => 'Не открывай наугад то, что уже видела: вспоминай.' },
  { pairs: 10, title: 'Картинки', thumb: ['butterfly', 'butterfly'],
    hint: () => 'Двадцать карточек. Попробуй запоминать по рядам.' },
  { pairs: 12, title: 'Картинки', thumb: ['panda', 'panda'],
    hint: () => 'Двенадцать пар. Называй картинки про себя — так легче помнить.' },
  { pairs: 15, title: 'Картинки', thumb: ['rocket', 'rocket'],
    hint: () => 'Пятнадцать пар из разных наборов. Нужна отличная память!' },
  { pairs: 8, shadows: 8, title: 'Тени', thumb: ['cat', '#cat'],
    hint: () => 'Тени! Пара — это картинка и её тёмная тень.' },
  { pairs: 10, shadows: 10, title: 'Тени', thumb: ['sea-whale', '#sea-whale'],
    hint: () => 'Теней стало больше. Смотри на форму, а не на цвет.' },
  { pairs: 10, theme: 1, title: 'Похожие', thumb: ['holidays-smile', 'holidays-smile-wink'],
    hint: t => `Все картинки из набора «${t}». Они похожи — смотри внимательно!` },
  { pairs: 12, theme: 2, title: 'Похожие', thumb: ['fruit-apple', 'fruit-tomato'],
    hint: t => `Все картинки на одну тему: ${t}. Не перепутай похожие!` },
  { pairs: 15, shadows: 15, theme: 2, title: 'Похожие тени', thumb: ['#fruit-pear', '#fruit-lemon'],
    hint: t => `Тени на одну тему: ${t}. Различай их по форме.` },
  { pairs: 18, shadows: 9, theme: 2, title: 'Всё сразу', thumb: ['magic-crown', '#magic-crown'],
    hint: () => 'Всё сразу! У одних картинок пара — тень, у других — такая же картинка.' },
];

// One pack holds 11 pictures, so the big look-alike levels take two packs
// that belong together.
const THEMES = [
  { packs: ['pets', 'wild'], name: 'звери' },
  { packs: ['food', 'fruit'], name: 'еда' },
  { packs: ['sea', 'nature'], name: 'море и природа' },
  { packs: ['magic', 'holidays'], name: 'сказка и праздники' },
  { packs: ['space', 'things'], name: 'машины и вещи' },
];

const plural = (n, one, few, many) => {
  const d = n % 10, t = n % 100;
  return d === 1 && t !== 11 ? one : d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
};

const LIST = LEVELS.map((L, i) => ({
  key: `pairs:${i + 1}`,
  name: `${L.pairs} ${plural(L.pairs, 'пара', 'пары', 'пар')}`,
  sub: L.title,
  href: `${MENU}/${i + 1}`,
}));

// Stars come from moves. Perfect memory needs about 1.6 moves per pair and
// never more than 2 × pairs − 1, so 1.7 × pairs + 1 leaves room for a slip or
// two. A simulated player who forgets 5% of what she saw with every move gets
// three stars 9 times out of 10 at 10 pairs and 4 out of 10 at 18; one who
// forgets 20% still gets two. Levels with a twist give one move more, because
// there she also has to recognise the pair, not only remember the place.
function goals(L) {
  const slack = L.shadows || L.theme ? 1 : 0;
  return { three: Math.round(L.pairs * 1.7) + 1 + slack, two: Math.round(L.pairs * 2.5) + slack };
}

// How many cells differ: by colour, or (shape) only painted against empty,
// which is what a silhouette shows.
function differ(a, b, shape) {
  const x = a.a.join(''), y = b.a.join('');
  if (x.length !== y.length) return Infinity;
  let d = 0;
  for (let i = 0; i < x.length; i++) {
    if (shape ? (x[i] === '.') !== (y[i] === '.') : x[i] !== y[i]) d++;
  }
  return d;
}

// Adds pictures to `out` until it holds `count`, taking from each list in
// turn so the sets are mixed evenly. `clash` vetoes a picture that is too
// close to one already taken.
function draw(lists, count, out, clash) {
  const queues = shuffle(lists).map(l => shuffle(l));
  for (let i = 0; out.length < count && queues.some(q => i < q.length); i++) {
    for (const q of queues) {
      const t = q[i];
      if (t && out.length < count && !out.some(o => o === t || clash(o, t))) out.push(t);
    }
  }
  return out;
}

// Picks the pictures of a level. Returns the shuffled deck as [picture,
// isShadow] pairs and the name of the theme for the levels that have one.
function deal(L) {
  const packs = PIX_PACKS.filter(p => p.list.length);
  // «Первые» is a mixed bag, not a theme.
  const themes = L.theme === 1
    ? packs.filter(p => p.id !== 'first').map(p => ({ name: p.name, lists: [p.list] }))
    : THEMES.map(t => ({ name: t.name, lists: packs.filter(p => t.packs.includes(p.id)).map(p => p.list) }));
  const fits = themes.filter(t => t.lists.flat().length >= L.pairs);
  const shadows = L.shadows || 0;
  // Two silhouettes in one game must differ in at least this many cells,
  // or she could not tell which shadow belongs to which picture.
  const gap = L.theme ? 16 : 24;
  let theme = null, pics = [];
  for (let tries = 0; tries < 30 && pics.length < L.pairs; tries++) {
    theme = L.theme && fits.length ? pick(fits) : null;
    const lists = theme ? theme.lists : packs.map(p => p.list);
    const shady = draw(lists, shadows, [], (o, t) => differ(o, t, true) < gap);
    if (shady.length < shadows) continue;
    // Plain pairs must stay clear of every shadow; without a theme they must
    // also be easy to tell from each other.
    pics = draw(lists, L.pairs, [...shady], (o, t) =>
      (shady.includes(o) ? differ(o, t, true) < gap : !theme && differ(o, t) < 40));
  }
  // Only if the picture sets change a lot: any different pictures will do.
  if (pics.length < L.pairs) { theme = null; pics = draw([PIX], L.pairs, [], () => false); }
  const deck = pics.flatMap((p, i) => [[p, false], [p, i < shadows]]);
  return { deck: shuffle(deck), about: theme ? theme.name : 'всякая всячина' };
}

// Draws a picture with `z` canvas pixels per cell.
function paint(cv, pic, shadow, z) {
  const cols = pic.a[0].length, rows = pic.a.length;
  cv.width = cols * z;
  cv.height = rows * z;
  const x = cv.getContext('2d');
  pic.a.forEach((row, yy) => [...row].forEach((ch, xx) => {
    if (!PIX_KEY[ch]) return;
    x.fillStyle = shadow ? INK : PIX_KEY[ch];
    x.fillRect(xx * z, yy * z, z, z);
  }));
  return cv;
}

function thumb(L) {
  return h('span', { class: 'pairs-thumb' }, L.thumb.map(code => {
    const id = code.replace('#', '');
    return paint(canvas(1, 1), PIX.find(p => p.id === id) || PIX[0], code !== id, 3);
  }));
}

function menu(root) {
  levelScreen(root, {
    title: 'Пары',
    hint: 'Найди все пары. Чем меньше ходов, тем больше звёзд!',
    levels: LIST.map((x, i) => ({ ...x, thumb: thumb(LEVELS[i]) })),
  });
}

const GAP = 10;   // between cards
const LIFT = 5;   // the hard shadow under a card
const MAX = 200;  // a card never grows beyond this

const HOLD = 1500;      // ms; a touch that stays longer is a resting hand, not a tap
const PALM = 70;        // px; a contact wider than this is a palm, not a fingertip
const SLIDE = 30;       // px; a finger that travelled further was not tapping
const PEN_NEAR = 1500;  // ms; a touch that lands this soon after the Pencil is the hand holding it

// Rows and columns that give the largest square cards. Only full rectangles
// (a deck is always even, so there is one): a short last row is harder to
// keep in mind. Near ties go to the shape closest to the screen's.
function grid(n, W, H) {
  let best = null;
  for (let cols = 1; cols <= n; cols++) {
    if (n % cols) continue;
    const rows = n / cols;
    const s = Math.floor(Math.min(MAX, (W - GAP * (cols - 1)) / cols, (H - LIFT - (GAP + LIFT) * (rows - 1)) / rows));
    const score = s - Math.abs(Math.log(cols / rows / (W / H)));
    if (!best || score > best.score) best = { cols, s, score };
  }
  return best;
}

function play(root, n) {
  const index = n - 1;
  const L = LEVELS[index];
  const goal = goals(L);
  const saveId = `pairs_${n}`;
  let alive = true;
  let cards = [];
  let first = null;   // the card waiting for its mate
  let miss = null;    // two cards that did not match and will turn back
  let missT = 0, endT = 0;
  let moves = 0, left = 0, about = '';
  let saving = Promise.resolve();
  const presses = new Map();   // fingers that are down on a card
  let penAt = -Infinity;       // when the Pencil last landed

  const movesEl = h('b', {}, '0');
  const say = speaker('…');
  const board = h('div', { class: 'pairs-board' });
  const table = h('div', { class: 'pairs-table' }, board);
  root.append(h('div', { class: 'screen pairs-screen' },
    topbar(`Пары · уровень ${n}`, {
      back: MENU,
      right: [
        h('div', { class: 'pairs-chip' },
          h('span', {}, 'Ходы: ', movesEl),
          h('small', {}, h('i', {}, '★★★'), ` не больше ${goal.three}`)),
        btn('ghost', 'Заново', restart),
      ],
    }),
    say,
    table,
  ));

  // Saves run one after another, so a late write can never undo a delete.
  const queue = job => { saving = saving.then(job).catch(() => {}); };
  const store = () => {
    const rec = {
      id: saveId, moves, about,
      deck: cards.map(c => [c.pic.id, c.shadow]),
      found: cards.filter(c => c.done).map(c => c.pic.id),
    };
    queue(() => db.put('kv', rec));
  };
  const forget = () => queue(() => db.del('kv', saveId));

  function layout() {
    const g = grid(cards.length, table.clientWidth, table.clientHeight);
    if (!g || g.s < 1) return;
    board.style.setProperty('--s', `${g.s}px`);
    board.style.width = `${g.cols * g.s + (g.cols - 1) * GAP}px`;
    // A whole number of screen pixels per cell keeps the pixels crisp.
    const dpr = window.devicePixelRatio || 1;
    const room = (g.s - 6) * 0.8 * dpr;
    for (const c of cards) {
      const z = Math.max(1, Math.floor(room / Math.max(c.pic.a.length, c.pic.a[0].length)));
      if (c.face.width === c.pic.a[0].length * z) continue;
      paint(c.face, c.pic, c.shadow, z);
      c.face.style.width = `${c.face.width / dpr}px`;
      c.face.style.height = `${c.face.height / dpr}px`;
    }
  }
  const watcher = new ResizeObserver(layout);
  watcher.observe(table);

  function turn(card, open) {
    card.open = open;
    card.el.classList.toggle('open', open);
    card.el.classList.toggle('shut', !open);
    card.el.setAttribute('aria-label', open ? (card.shadow ? 'Тень: ' : '') + card.pic.name : CLOSED);
  }

  function settle() {
    clearTimeout(missT);
    for (const c of miss) turn(c, false);
    miss = null;
  }

  function tap(card) {
    if (card.done || !left) return;
    // She does not have to wait for the pause: the next tap ends it, even a
    // tap on one of the two cards that are about to turn back.
    if (miss) settle();
    if (card.open) return;
    turn(card, true);
    if (!first) { first = card; sfx.pop(); return; }
    const mate = first;
    first = null;
    moves++;
    movesEl.textContent = String(moves);
    if (mate.pic !== card.pic) {
      sfx.soft();
      miss = [mate, card];
      missT = setTimeout(settle, 1500);
      store();
      return;
    }
    for (const c of [mate, card]) { c.done = true; c.el.classList.add('done'); }
    left--;
    sfx.ding();
    // The last pair is not stored: if she leaves during the pause below, she
    // comes back to one pair left instead of losing the level.
    if (left) store(); else endT = setTimeout(finish, 900);
  }

  function finish() {
    forget();
    const stars = moves <= goal.three ? 3 : moves <= goal.two ? 2 : 1;
    finishLevel({
      levels: LIST, index, stars, menu: MENU,
      text: `Все пары за ${moves} ${plural(moves, 'ход', 'хода', 'ходов')}. `
        + (stars === 3 ? 'Вот это память!' : `Для трёх звёзд нужно не больше ${goal.three}.`),
      again: () => start(),
    });
  }

  // A saved game is used only if every picture in it still exists.
  function revive(saved) {
    if (!saved || !Array.isArray(saved.deck) || saved.deck.length !== L.pairs * 2) return null;
    const deck = saved.deck.map(([id, shadow]) => [PIX.find(p => p.id === id), !!shadow]);
    const found = new Set(saved.found);
    if (deck.some(([p]) => !p) || found.size >= L.pairs) return null;
    return { deck, found, moves: saved.moves | 0, about: saved.about || '' };
  }

  function start(saved) {
    clearTimeout(missT);
    clearTimeout(endT);
    first = miss = null;
    presses.clear();
    const game = revive(saved) || { ...deal(L), found: new Set(), moves: 0 };
    about = game.about;
    moves = game.moves;
    left = L.pairs - game.found.size;
    movesEl.textContent = String(moves);
    cards = game.deck.map(([pic, shadow]) => {
      const face = canvas(1, 1);
      const el = h('button', { class: 'pairs-card' },
        h('span', { class: 'pairs-body' }, h('span', { class: 'pairs-face' }, face)));
      const card = { pic, shadow, el, face, open: false, done: game.found.has(pic.id) };
      if (card.done) { turn(card, true); el.classList.add('done'); } else el.setAttribute('aria-label', CLOSED);
      return card;
    });
    board.replaceChildren(...cards.map(c => c.el));
    layout();
    say.say(game.found.size ? 'Продолжаем! Найденные пары уже открыты.' : L.hint(about));
  }

  async function restart() {
    // With the last pair found the finish dialog is on its way; it has «Ещё раз».
    if (!left) return;
    if (moves && !(await confirmBox('Начать уровень заново? Ходы обнулятся.', 'Заново', 'Нет'))) return;
    if (!alive) return;
    forget();
    start();
  }

  // The Pencil is exact and its taps are sloppy clicks, so it turns a card the
  // moment it lands. A finger counts when it lifts: a short press that ends
  // where it began. The hand resting beside the Pencil, a palm that stays
  // down and a finger sliding across the board must not cost her a move.
  board.addEventListener('pointerdown', e => {
    const card = cards.find(c => c.el === e.target.closest('.pairs-card'));
    if (e.pointerType === 'pen') {
      penAt = e.timeStamp;
      presses.clear();
      if (card) tap(card);
      return;
    }
    // A press that never lifted here (it slid off the board) is dropped.
    for (const [id, p] of presses) if (e.timeStamp - p.t >= HOLD) presses.delete(id);
    if (!card || e.timeStamp - penAt < PEN_NEAR || Math.max(e.width, e.height) > PALM) return;
    presses.set(e.pointerId, { card, x: e.clientX, y: e.clientY, t: e.timeStamp });
  });
  board.addEventListener('pointercancel', e => presses.delete(e.pointerId));
  board.addEventListener('pointerup', e => {
    const p = presses.get(e.pointerId);
    presses.delete(e.pointerId);
    if (p && e.timeStamp - p.t < HOLD && Math.hypot(e.clientX - p.x, e.clientY - p.y) < SLIDE) tap(p.card);
  });

  db.get('kv', saveId).catch(() => null).then(saved => { if (alive) start(saved); });

  return () => {
    alive = false;
    clearTimeout(missT);
    clearTimeout(endT);
    watcher.disconnect();
  };
}

export default function run(root, arg) {
  if (!arg) { menu(root); return undefined; }
  const n = Number(arg);
  if (!LEVELS[n - 1] || !isOpen(LIST, n - 1)) { location.hash = MENU; return undefined; }
  return play(root, n);
}
