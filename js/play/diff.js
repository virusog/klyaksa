// «Найди отличия». Two versions of one coloring page; she taps what changed.
// The second version is made here from the page data: a shape gets another
// colour, or a small shape is left out. Every change is checked by pixels
// before it is used, so each one is a single spot she can see and tap.
//
// Ladder (20 levels, each on its own picture, the same every time):
//   1–4   3 differences: big areas, bold colours
//   5–8   4 differences: medium areas; new: one thing is missing
//   9–12  5 differences: small details, two things are missing
//  13–16  6 differences: smaller; new: three are only a nearby colour
//  17–20  7 differences: tiny, on the busiest pictures, four a nearby colour
import { h, canvas, clamp, mulberry, hexRgb, shade } from '../util.js';
import { topbar, btn, icon, speaker, confirmBox, COLORS } from '../ui.js';
import { levelScreen, finishLevel, isOpen } from './kit.js';
import { db } from '../store.js';
import { sfx } from '../audio.js';
import { PAGES } from '../pages.js';
import { drawPage } from '../coloring.js';

const MENU = '#/game/diff';
const W = 1200, H = 900;
// Changes are checked on a half-size drawing: quick, and close to what she sees.
const HW = W / 2, HH = H / 2;
const CELL = 4;         // half-size pixels; a gap thinner than an outline does not split a spot
const APART = 110;      // clear space between two differences, in picture units
const OUT_MAX = 0.015;  // only a small shape may vanish
const FAINT = 24;       // of 765: a pixel changed by less than this looks the same
const HOLD = 1500;      // ms; a touch that stays longer is a resting hand, not a tap
const RIM = 8;          // a ring keeps this far from the picture's edge, so its halo is whole
const NEAR_MIN = 0.003; // a nearby colour needs some area to be noticed at all
const NEAR_GROW = 1.6;  // and may be this much bigger than a bold change, being harder to see

// n differences, each covering lo..hi of the picture; `out` of them are shapes
// left out and `near` of them subtle colours. The upper limit falls with every
// step, so a later level never comes out with easier spots than an earlier one.
// `tip` tells her what is new.
const TIERS = [
  { n: 3, lo: 0.012, hi: 0.06, out: 0, near: 0, tip: 'Нажимай на любую из картинок.' },
  { n: 4, lo: 0.006, hi: 0.02, out: 1, near: 0, tip: 'Что-то могло и пропасть!' },
  { n: 5, lo: 0.003, hi: 0.01, out: 2, near: 0, tip: 'Теперь они мельче.' },
  { n: 6, lo: 0.002, hi: 0.008, out: 2, near: 3, tip: 'Цвет мог измениться совсем чуть-чуть.' },
  { n: 7, lo: 0.0015, hi: 0.005, out: 2, near: 4, tip: 'Они крошечные. Не спеши!' },
];

// Simple pictures first, crowded ones last. Each one was measured to give its
// level's differences from any seed, so the spare pictures are rarely needed.
// Ids, not positions: the list of pages grows, and a level must stay on its picture.
const PAGE_IDS = [
  'whale', 'sweets', 'space', 'owl',
  'castle', 'dragon', 'penguins-floe', 'nature-bees',
  'unicorn', 'kittens-yarn', 'world-train', 'world-room',
  'nature-summer', 'puppy-butterfly', 'world-lighthouse', 'nature-mountains',
  'fox-winter', 'dragon-treasure', 'world-bakery', 'sea-kingdom',
];
const pageOf = i => PAGES.find(p => p.id === PAGE_IDS[i]) || PAGES[i % PAGES.length];
const tierOf = i => TIERS[Math.floor(i / 4)];
const word = n => (n < 5 ? 'отличия' : 'отличий');

const LEVELS = PAGE_IDS.map((_, i) => ({
  key: `diff:${i + 1}`,
  name: pageOf(i).title,
  sub: `${tierOf(i).n} ${word(tierOf(i).n)}`,
  href: `${MENU}/${i + 1}`,
}));

// The page with the chosen changes applied.
const variant = (page, changes) => ({
  shapes: page.shapes.flatMap((s, i) => {
    const c = changes.find(x => x.i === i);
    return !c ? [s] : c.out ? [] : [[s[0], c.fill]];
  }),
});

function paint(ctx, page, scale) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  drawPage(ctx, page, true);
}

// Where two half-size drawings differ: pixel count, bounding box, and whether
// it is one spot. Only edge pixels too faint to see do not count: a shape that
// also peeks out somewhere else would be a second, unfair difference.
function measure(a, b) {
  const cw = Math.ceil(HW / CELL), ch = Math.ceil(HH / CELL);
  const grid = new Uint8Array(cw * ch);
  let n = 0, cells = 0, first = -1, x0 = HW, y0 = HH, x1 = 0, y1 = 0;
  for (let y = 0, i = 0; y < HH; y++) {
    for (let x = 0; x < HW; x++, i += 4) {
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) < FAINT) continue;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const g = Math.floor(x / CELL) + Math.floor(y / CELL) * cw;
      if (!grid[g]) { grid[g] = 1; cells++; if (first < 0) first = g; }
    }
  }
  if (!n) return null;
  // Flood from one cell: if it reaches them all, the change is in one piece.
  let reached = 1;
  const stack = [first];
  grid[first] = 2;
  while (stack.length) {
    const g = stack.pop();
    const gx = g % cw, gy = (g - gx) / cw;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch || grid[nx + ny * cw] !== 1) continue;
        grid[nx + ny * cw] = 2;
        reached++;
        stack.push(nx + ny * cw);
      }
    }
  }
  return { n, x0, y0, x1, y1, single: reached === cells };
}

const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const PAINTS = COLORS.filter(c => c !== '#2a2140' && c !== '#6b7280').map(c => [c, hexRgb(c)]);

// A bold change jumps across the palette; a near one picks a neighbour.
function repaint(fill, near, rnd) {
  const from = hexRgb(fill);
  const pool = PAINTS.filter(([, rgb]) => {
    const d = far(from, rgb);
    return near ? d >= 60 && d <= 125 : d >= 170;
  });
  if (pool.length) return pool[Math.floor(rnd() * pool.length)][0];
  // No such neighbour in the palette: a darker or lighter shade of the same paint.
  const light = from[0] * 0.3 + from[1] * 0.59 + from[2] * 0.11 > 120;
  return shade(fill, light ? -0.3 : 0.35);
}

// Picks the differences for one page, or returns fewer than asked if the page
// cannot give enough. The first shape is the background and is never touched.
function choose(page, tier, seed) {
  const rnd = mulberry(seed);
  const ctx = canvas(HW, HH).getContext('2d', { willReadFrequently: true });
  const shot = p => { paint(ctx, p, 0.5); return ctx.getImageData(0, 0, HW, HH).data; };
  const base = shot(page);
  const order = page.shapes.map((_, i) => i).slice(1);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  // How much of a shape is hidden under the shapes drawn after it, 0..1.
  const hidden = i => {
    const alpha = shapes => {
      ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawPage(ctx, { shapes }, true);
      return ctx.getImageData(0, 0, HW, HH).data;
    };
    const own = alpha([page.shapes[i]]), over = alpha(page.shapes.slice(i + 1));
    let all = 0, under = 0;
    for (let k = 3; k < own.length; k += 4) {
      if (own[k] < 128) continue;
      all++;
      if (over[k] >= 128) under++;
    }
    return all ? under / all : 1;
  };

  const diffs = [];
  // The box of one change drawn alone, if it is a good, well-placed spot.
  const fits = c => {
    const m = measure(base, shot(variant(page, [c])));
    if (!m || !m.single) return null;
    const part = m.n / (HW * HH);
    if (part < (c.near ? Math.max(tier.lo, NEAR_MIN) : tier.lo)) return null;
    if (part > (c.out ? Math.min(tier.hi, OUT_MAX) : c.near ? tier.hi * NEAR_GROW : tier.hi)) return null;
    const box = { x: m.x0 * 2, y: m.y0 * 2, w: (m.x1 - m.x0 + 1) * 2, h: (m.y1 - m.y0 + 1) * 2 };
    // A thin, long or hollow change would leave most of its box, and her tap, empty.
    const short = Math.min(box.w, box.h), long = Math.max(box.w, box.h);
    if (short < 40 || long > 4 * short || long > 420 || m.n * 4 < 0.28 * box.w * box.h) return null;
    const clash = diffs.some(d => box.x < d.x + d.w + APART && d.x < box.x + box.w + APART
      && box.y < d.y + d.h + APART && d.y < box.y + box.h + APART);
    if (clash) return null;
    // Taking away a shape that carries details would leave them floating.
    return c.out && hidden(c.i) > 0.03 ? null : box;
  };
  const add = c => {
    const box = fits(c);
    if (box) diffs.push({ ...c, ...box });
    return !!box;
  };
  // Few shapes can vanish cleanly, so those are placed first. A page that has
  // too few of them gets more colour changes instead.
  let outs = tier.out;
  for (const i of order) {
    if (!outs) break;
    if (add({ i, out: true })) outs--;
  }
  let near = tier.near;
  for (const i of order) {
    if (diffs.length === tier.n) break;
    const fill = page.shapes[i][1];
    if (!fill || diffs.some(d => d.i === i)) continue;
    if (add({ i, fill: repaint(fill, near > 0, rnd), near: near > 0 }) && near) near--;
  }
  return diffs;
}

// A level is built once per visit to the app and is the same every time.
const made = new Map();
function makeLevel(index) {
  if (made.has(index)) return made.get(index);
  const tier = tierOf(index);
  // The picture gets three tries, each in another order. If it still cannot
  // give enough differences, one of the spare pictures does.
  const own = pageOf(index);
  const spare = PAGES.filter(p => !PAGE_IDS.includes(p.id));
  const pages = [own, own, own, ...spare.slice(index % (spare.length || 1)), ...spare];
  let best = null;
  for (const [k, page] of pages.entries()) {
    const diffs = choose(page, tier, 7001 + index * 131 + k);
    if (!best || diffs.length > best.diffs.length) best = { page, diffs };
    if (diffs.length === tier.n) break;
  }
  made.set(index, best);
  return best;
}

function thumb(page) {
  const c = canvas(220, 165);
  c.className = 'diff-thumb';
  paint(c.getContext('2d'), page, 220 / W);
  return c;
}

const pct = v => `${(v * 100).toFixed(2)}%`;

function play(root, index) {
  const saveId = `diff_${index + 1}`;
  let closed = false;
  let timer = 0;
  let level = null;
  let found = new Set();
  let mistakes = 0;
  let hinted = false;
  let done = false;

  const say = speaker('Готовлю картинки…');
  const count = h('b', { class: 'diff-count' });
  const miss = h('span', { class: 'diff-miss' });
  const pics = [0, 1].map(() => {
    const c = canvas(W, H);
    const marks = h('div', { class: 'diff-marks' });
    return { c, marks, el: h('div', { class: 'diff-pic' }, c, marks) };
  });
  const board = h('div', { class: 'diff-board' }, pics.map(p => p.el));

  const status = () => {
    count.textContent = `Найдено ${found.size} из ${level.diffs.length}`;
    miss.textContent = `Промахи: ${mistakes}`;
  };
  const keep = () => db.put('kv', { id: saveId, found: [...found], mistakes, hinted }).catch(() => {});

  // A ring around a difference on both pictures, kept inside the picture.
  // An oval has to be wider than the box it goes around, or it cuts the corners.
  const ring = (d, cls) => {
    const w = Math.max(d.w * 1.25 + 24, 104), ht = Math.max(d.h * 1.25 + 24, 104);
    const style = {
      left: pct(clamp(d.x + d.w / 2 - w / 2, RIM, W - w - RIM) / W),
      top: pct(clamp(d.y + d.h / 2 - ht / 2, RIM, H - ht - RIM) / H),
      width: pct(w / W),
      height: pct(ht / H),
    };
    return pics.map(p => {
      const el = h('i', { class: cls, style });
      p.marks.append(el);
      return el;
    });
  };
  const dropHint = () => board.querySelectorAll('.diff-hint').forEach(e => e.remove());

  function finish() {
    done = true;
    say.say('Все отличия найдены!');
    // Stars are paid when the dialog opens. Until then the finished level
    // stays saved, so leaving at this very moment loses nothing.
    keep();
    const stars = Math.min(hinted ? 2 : 3, mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1);
    const text = hinted && mistakes <= 3 ? 'С подсказкой выходит две звезды. В следующий раз попробуй сама!'
      : mistakes === 0 ? 'Ни одного промаха. Вот это глаз!'
        : `Все отличия найдены. Промахов: ${mistakes}. Чем их меньше, тем больше звёзд.`;
    // A moment to see the last ring before the dialog covers it.
    timer = setTimeout(() => {
      db.del('kv', saveId).catch(() => {});
      finishLevel({ levels: LEVELS, index, stars, text, menu: MENU, again: restart });
    }, 800);
  }

  function restart() {
    found = new Set();
    mistakes = 0;
    hinted = false;
    done = false;
    for (const p of pics) p.marks.textContent = '';
    status();
    say.say(`Найди ${level.diffs.length} ${word(level.diffs.length)} ещё раз!`);
  }

  function tap(pic, cx, cy, alone) {
    const r = pic.c.getBoundingClientRect();
    const x = (cx - r.left) / r.width * W;
    const y = (cy - r.top) / r.height * H;
    // A finger is wider than a small detail: about 26 screen points of grace,
    // but never so much that two differences answer to one tap.
    const m = clamp(26 * W / r.width, 30, APART / 2 - 2);
    const inside = d => x >= d.x - m && x <= d.x + d.w + m && y >= d.y - m && y <= d.y + d.h + m;
    const hit = level.diffs.find(inside);
    if (hit && found.has(hit.i)) return;
    if (hit) {
      found.add(hit.i);
      dropHint();
      ring(hit, 'diff-ring');
      sfx.ding();
      status();
      const left = level.diffs.length - found.size;
      if (left) { say.say(left === 1 ? 'Верно! Осталось одно.' : `Верно! Осталось ${left}.`); keep(); } else finish();
      return;
    }
    if (!alone) return;
    mistakes++;
    sfx.soft();
    // Kept whole inside the picture, even for a tap right on its edge.
    const spot = v => `clamp(20px, ${pct(v)}, calc(100% - 20px))`;
    const no = h('i', { class: 'diff-no', style: { left: spot(x / W), top: spot(y / H) } }, '×');
    no.addEventListener('animationend', () => no.remove());
    pic.marks.append(no);
    status();
    say.say('Здесь всё одинаково. Сравни внимательнее.');
    keep();
  }

  // A tap is a short touch that stays in place. A resting palm or a finger
  // sliding over the picture must not count as a mistake. Every finger is
  // followed on its own, so a thumb resting on a picture does not swallow the
  // taps of the other hand; but a miss is only counted for a finger that was
  // alone, because with two touches down one of them is likely an accident.
  const presses = new Map();
  board.addEventListener('pointerdown', e => {
    const pic = pics.find(p => p.el.contains(e.target));
    if (!pic) return;
    // A touch held this long is no tap any more, and one that left the board
    // without lifting would otherwise stay here for good.
    for (const [id, p] of presses) if (e.timeStamp - p.t >= HOLD) presses.delete(id);
    for (const p of presses.values()) p.alone = false;
    presses.set(e.pointerId, { pic, x: e.clientX, y: e.clientY, t: e.timeStamp, alone: presses.size === 0 });
  });
  board.addEventListener('pointercancel', e => presses.delete(e.pointerId));
  board.addEventListener('pointerup', e => {
    const p = presses.get(e.pointerId);
    presses.delete(e.pointerId);
    if (!p || !level || done) return;
    if (e.timeStamp - p.t < HOLD && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 16) tap(p.pic, p.x, p.y, p.alone);
  });

  async function hint() {
    if (!level || done) return;
    if (!hinted) {
      const yes = await confirmBox('Показать одно отличие? Тогда за уровень будет не больше двух звёзд.', 'Показать', 'Сама найду');
      if (!yes || closed || done) return;
      hinted = true;
      keep();
    }
    dropHint();
    const d = level.diffs.find(x => !found.has(x.i));
    for (const el of ring(d, 'diff-ring diff-hint')) el.addEventListener('animationend', () => el.remove());
    say.say('Смотри, где мигает!');
  }

  root.append(h('div', { class: 'screen' },
    topbar(`Найди отличия: уровень ${index + 1}`, { back: MENU, right: [btn('ghost', [icon('eye', 22), 'Подсказка'], hint)] }),
    h('div', { class: 'diff-status' }, say, h('div', { class: 'diff-score' }, count, miss)),
    board,
  ));

  // The picture check takes a moment, so the screen appears first.
  timer = setTimeout(async () => {
    const lv = makeLevel(index);
    const saved = await db.get('kv', saveId).catch(() => null);
    if (closed) return;
    level = lv;
    paint(pics[0].c.getContext('2d'), level.page, 1);
    paint(pics[1].c.getContext('2d'), variant(level.page, level.diffs), 1);
    if (saved) {
      found = new Set((saved.found || []).filter(i => level.diffs.some(d => d.i === i)));
      mistakes = saved.mistakes || 0;
      hinted = !!saved.hinted;
      for (const d of level.diffs) if (found.has(d.i)) ring(d, 'diff-ring');
    }
    status();
    const n = level.diffs.length;
    if (found.size === n) finish();
    else say.say(found.size ? `Продолжаем! Осталось найти: ${n - found.size}.` : `Найди ${n} ${word(n)}. ${tierOf(index).tip}`);
  }, 40);

  return () => { closed = true; clearTimeout(timer); };
}

export default function run(root, arg) {
  const index = Number(arg) - 1;
  if (LEVELS[index] && isOpen(LEVELS, index)) return play(root, index);
  levelScreen(root, {
    title: 'Найди отличия',
    hint: 'Две картинки почти одинаковые. Найди всё, чем они отличаются!',
    levels: LEVELS.map((L, i) => ({ ...L, thumb: thumb(pageOf(i)) })),
  });
  return () => {};
}
