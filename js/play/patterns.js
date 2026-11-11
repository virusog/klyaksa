// «Продолжи узор»: a row (later a square) of figures follows a rule and has
// blanks; she fills each blank by picking the right figure.
//
// The ladder (the keys patterns:1 … patterns:24 must never change):
//   1–4    one property repeats every 2 or 3 steps, one blank at the end
//   5–8    a repeat of 4 and mirrored rules (AABB, ABBA, ABCB), two blanks
//   9–12   two properties at once with different repeats, six choices
//   13–16  growing and turning: count, size, quarter turns; then with a
//          colour cycle, then backwards, then there and back again
//   17–20  blanks in the middle of two long rules, then three properties,
//          then three blanks
//   21–24  a 3 × 3 square where every row and column holds each shape and
//          each colour once; then sizes as well; then two empty cells on one
//          line, where every choice fits that line and only the crossing
//          lines tell them apart
import { h, svgEl, mulberry } from '../util.js';
import { topbar, speaker } from '../ui.js';
import { db } from '../store.js';
import { sfx } from '../audio.js';
import { levelScreen, finishLevel, isOpen } from './kit.js';

const MENU = '#/game/patterns';
const ASKS = 5;   // rows in one level

// A figure is { shape, color, size, turn, count }, each an entry of RANGE.
const PROPS = ['shape', 'color', 'size', 'turn', 'count'];
const RANGE = {
  shape: [0, 1, 2, 3, 4, 5, 6, 7],
  color: [0, 1, 2, 3, 4, 5],
  size: [0, 1, 2],
  turn: [0, 1, 2, 3],
  count: [1, 2, 3, 4],
};

// Outlines around the point 0,0, about 80 units across.
const OUTLINES = [
  'M-37 0a37 37 0 1 0 74 0a37 37 0 1 0-74 0z',                                              // circle
  'M-32-32h64v64h-64z',                                                                     // square
  'M0-37L40 31H-40z',                                                                       // triangle
  'M0-37L10.3-11.2 38-9.4 16.6 8.4 23.5 35.4 0 20.5-23.5 35.4-16.6 8.4-38-9.4-10.3-11.2z',  // star
  'M0 35C-46 6-40-33-19-33-9-33-2-27 0-19 2-27 9-33 19-33 40-33 46 6 0 35z',                // heart
  'M0-40L29 0 0 40-29 0z',                                                                  // diamond
  'M0-40C9-22 29-6 29 11a29 29 0 0 1-58 0C-29-6-9-22 0-40z',                                // drop
  'M0-40L33-5H14V38H-14V-5H-33z',                                                           // arrow
];
// Only these look different after every quarter turn.
const TURNING = [2, 4, 6, 7];
// The red leans to crimson, so that small red and orange figures stay apart.
const PAINT = ['#e62b3d', '#ff8c1a', '#ffd92e', '#3cc264', '#3b8df2', '#9b5cf6'];
// Each size is about two thirds of the next.
const SCALE = [0.46, 0.68, 1];
// Where the copies sit for a count of 1 to 4: x, y, and how much smaller.
const SPOTS = [
  [[0, 0, 1]],
  [[-23, 0, 0.5], [23, 0, 0.5]],
  [[0, -22, 0.48], [-24, 22, 0.48], [24, 22, 0.48]],
  [[-24, -24, 0.48], [24, -24, 0.48], [-24, 24, 0.48], [24, 24, 0.48]],
];

const turnOf = f => (TURNING.includes(f.shape) ? f.turn : 0);
// Two figures with the same key look the same.
const key = f => [f.shape, f.color, f.size, turnOf(f), f.count].join();
const round = v => Math.round(v * 100) / 100;

function figure(f) {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'patterns-fig' });
  const k = SCALE[f.size];
  for (const [x, y, m] of SPOTS[f.count - 1]) {
    svg.append(svgEl('path', {
      d: OUTLINES[f.shape],
      fill: PAINT[f.color],
      transform: `translate(${round(50 + x * k)} ${round(50 + y * k)}) rotate(${turnOf(f) * 90}) scale(${round(m * k)})`,
    }));
  }
  return svg;
}

// Seeded helpers: a level is rebuilt from its seed when she comes back to it.
const any = (rnd, a) => a[Math.floor(rnd() * a.length)];
const mix = (rnd, a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const spin = (rnd, a) => {
  const k = Math.floor(rnd() * a.length);
  return [...a.slice(k), ...a.slice(0, k)];
};

// The shortest repeat of a list: the smallest p with s[i] = s[i + p] everywhere.
function repeatOf(s) {
  for (let p = 1; ; p++) if (s.every((v, i) => i + p >= s.length || v === s[i + p])) return p;
}

// A row is fair when, for every property, the right values of the blanks give
// a shorter repeat than any other values could, and the repeat can be seen at
// least twice in the cells that are not blank.
function fair(cells, holes) {
  const shown = i => !holes.includes(i);
  return PROPS.every(prop => {
    const s = cells.map(c => c[prop]);
    const p = repeatOf(s);
    if (p > 1 && s.filter((_, i) => i + p < s.length && shown(i) && shown(i + p)).length < 2) return false;
    const t = [...s];
    const rival = k => (k === holes.length
      ? t.some((v, i) => v !== s[i]) && repeatOf(t) <= p
      : RANGE[prop].some(v => { t[holes[k]] = v; return rival(k + 1); }));
    return !rival(0);
  });
}

// The choices for one blank. `used` lists the values each changing property
// takes in this question. The wrong figures that tempt most come first: the
// lures the caller names, then one changing property off, then two, then a
// value the question never shows, then a slip in a property that does not
// change at all.
function choices(rnd, right, used, n, lures = []) {
  const active = Object.keys(used);
  const others = (f, pool) => active.flatMap(p => (f[p] === right[p]
    ? pool(p).filter(v => v !== right[p]).map(v => ({ ...f, [p]: v }))
    : []));
  const near = others(right, p => used[p]);
  const far = near.flatMap(f => others(f, p => used[p]));
  const odd = others(right, p => RANGE[p].filter(v => !used[p].includes(v)));
  // Small copies of a small figure are too tiny to tell apart, so a row
  // that counts keeps its size.
  const spare = ['color', 'shape', 'turn', ...(used.count ? [] : ['size'])]
    .filter(p => !used[p])
    .flatMap(p => RANGE[p].filter(v => v !== right[p]).map(v => ({ ...right, [p]: v })));
  const seen = new Set([key(right)]);
  const wrong = [lures, near, far, odd, spare].flatMap(tier => mix(rnd, tier))
    .filter(f => !seen.has(key(f)) && seen.add(key(f)));
  return mix(rnd, [right, ...wrong.slice(0, n - 1)]);
}

// A rule gives, per property, the values of one repeat: letters stand for
// values drawn at random ('ABB'), a list is used as it is.
function rowOf(rnd, { rule, n, holes }, picks) {
  const tracks = {};
  for (const p of Object.keys(rule)) {
    const pool = mix(rnd, p === 'shape' && rule.turn ? TURNING : RANGE[p]);
    tracks[p] = typeof rule[p] === 'string' ? [...rule[p]].map(ch => pool[ch.charCodeAt(0) - 65]) : rule[p];
  }
  const base = { shape: any(rnd, rule.turn ? TURNING : RANGE.shape), color: any(rnd, RANGE.color), size: 2, turn: 0, count: 1 };
  const cells = Array.from({ length: n }, (_, i) => {
    const f = { ...base };
    for (const p of Object.keys(tracks)) f[p] = tracks[p][i % tracks[p].length];
    return f;
  });
  if (!fair(cells, holes)) return null;
  const used = {};
  for (const p of Object.keys(tracks)) used[p] = [...new Set(tracks[p])];
  return { square: false, cells, holes, sets: holes.map(i => choices(rnd, cells[i], used, picks)) };
}

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8]];

// Apart from renaming the values, r + c and r + 2c (mod 3) are the only two
// ways to lay three values so that every row and column holds each once.
// Shapes take one, colours the other, so all nine figures differ. Sizes have
// to follow one of the two. A square with one or two cells missing always has
// a single answer: each missing cell sits in a row or a column that is
// otherwise complete.
//
// Two missing cells always share a line, and the wrong choices are then the
// mixes of the two missing figures: each of them fits that line, so she has
// to check the lines that cross it.
function squareOf(rnd, L) {
  const rows = mix(rnd, [0, 1, 2]), cols = mix(rnd, [0, 1, 2]);
  const used = {};
  for (const p of L.square) used[p] = mix(rnd, RANGE[p]).slice(0, 3);
  const way = { shape: 1, color: 2, size: any(rnd, [1, 2]) };
  const cells = [];
  for (const r of rows) {
    for (const c of cols) {
      const f = { size: 2, turn: 0, count: 1 };
      for (const p of L.square) f[p] = used[p][(r + way[p] * c) % 3];
      cells.push(f);
    }
  }
  const holes = L.gaps === 2
    ? mix(rnd, any(rnd, LINES)).slice(0, 2).sort((a, b) => a - b)
    : [Math.floor(rnd() * 9)];
  const sets = holes.map((i, k) => {
    const twin = cells[holes[1 - k]];
    const lures = twin
      ? L.square.reduce((list, p) => list.flatMap(f => [f, { ...f, [p]: twin[p] }]), [cells[i]]).slice(1)
      : [];
    return choices(rnd, cells[i], used, L.picks, lures);
  });
  return { square: true, cells, holes, sets };
}

const P3 = ['ABC', 'AAB', 'ABB'];
const P4 = ['AABB', 'ABBA', 'ABCB'];
const STEP = ['count', 'size', 'turn'];
const GROW = { count: [1, 2, 3, 4], size: [0, 1, 2], turn: [0, 1, 2, 3] };
const BACK = { count: [4, 3, 2, 1], size: [2, 1, 0], turn: [0, 3, 2, 1] };
const SWING = { count: [1, 2, 3, 2], size: [0, 1, 2, 1], turn: [0, 1, 2, 1] };
const DUOS = [['shape', 'color'], ['color', 'shape'], ['shape', 'size'], ['size', 'color'], ['color', 'size']];

// k blanks at the end of a row of n, or k blanks inside it.
const tail = (n, k) => Array.from({ length: k }, (_, i) => n - k + i);
const inner = (rnd, n, k) =>
  mix(rnd, Array.from({ length: n - 4 }, (_, i) => i + 2)).slice(0, k).sort((a, b) => a - b);

// make(rnd, q) describes row number q (0…4) of a level: the rule, the length
// and the blanks. q walks through the properties, so that one level never
// asks five times about the same thing.
const LEVELS = [
  // 1–4: one property, a short repeat, one blank at the end.
  {
    name: 'Раз-два', sub: 'чередование', picks: 4,
    hint: 'Фигурки идут по правилу. Какая будет дальше? Нажми на неё внизу.',
    make: (r, q) => {
      const n = 6 + (q % 2);
      return { rule: { [q % 2 ? 'color' : 'shape']: 'AB' }, n, holes: tail(n, 1) };
    },
  },
  {
    name: 'По кругу', sub: 'три по очереди', picks: 4,
    hint: 'Теперь по кругу идут три фигурки. Кто следующий?',
    make: (r, q) => {
      const n = any(r, [7, 8, 9]);
      return { rule: { [q % 2 ? 'shape' : 'color']: 'ABC' }, n, holes: tail(n, 1) };
    },
  },
  {
    name: 'Двойняшки', sub: 'двое подряд', picks: 4,
    hint: 'Смотри внимательно: кое-кто стоит два раза подряд.',
    make: (r, q) => {
      const n = any(r, [7, 8, 9]);
      return { rule: { [['shape', 'color', 'size'][q % 3]]: any(r, ['AAB', 'ABB']) }, n, holes: tail(n, 1) };
    },
  },
  {
    name: 'Новые признаки', sub: 'размер, поворот, счёт', picks: 4,
    hint: 'Меняться может не только форма: ещё размер, поворот и число фигурок.',
    make: (r, q) => {
      const n = any(r, [7, 8, 9]);
      return { rule: { [STEP[q % 3]]: any(r, ['AB', ...P3]) }, n, holes: tail(n, 1) };
    },
  },

  // 5–8: a repeat of four, two blanks at the end.
  {
    name: 'Парами', sub: 'два пропуска', picks: 4,
    hint: 'Правило стало длиннее, а пропусков два. Заполняй их по порядку.',
    make: (r, q) => {
      const n = any(r, [8, 9, 10]);
      return { rule: { [q % 2 ? 'color' : 'shape']: 'AABB' }, n, holes: tail(n, 2) };
    },
  },
  {
    name: 'Зеркало', sub: 'туда и обратно', picks: 4,
    hint: 'Узор как в зеркале: туда и обратно.',
    make: (r, q) => {
      const n = any(r, [8, 9, 10]);
      return { rule: { [q % 2 ? 'shape' : 'color']: 'ABBA' }, n, holes: tail(n, 2) };
    },
  },
  {
    name: 'С возвратом', sub: 'правило из четырёх', picks: 4,
    hint: 'В правиле четыре шага, и кто-то в нём встречается дважды.',
    make: (r, q) => {
      const n = any(r, [8, 9, 10]);
      return { rule: { [q % 2 ? 'color' : 'shape']: any(r, ['ABCB', 'AABC']) }, n, holes: tail(n, 2) };
    },
  },
  {
    name: 'Длинный узор', sub: 'хитрые признаки', picks: 4,
    hint: 'Длинное правило, а меняется размер, поворот или число. Не спеши.',
    make: (r, q) => {
      const n = any(r, [8, 9, 10]);
      const prop = ['size', 'count', 'turn', 'color', 'shape'][q];
      return { rule: { [prop]: any(r, [...P4, 'AABC']) }, n, holes: tail(n, 2) };
    },
  },

  // 9–12: two properties with different repeats; six choices from here on.
  {
    name: 'Форма и цвет', sub: 'два правила сразу', picks: 6,
    hint: 'Теперь меняются и форма, и цвет — каждый по своему правилу.',
    make: (r, q) => {
      const n = 8 + (q % 2);
      return { rule: { shape: 'AB', color: 'ABC' }, n, holes: tail(n, 1) };
    },
  },
  {
    name: 'Два правила', sub: 'разные признаки', picks: 6,
    hint: 'Два правила сразу. Разгадай сначала одно, потом другое.',
    make: (r, q) => {
      const n = any(r, [8, 9]);
      return { rule: { [DUOS[q][0]]: 'AB', [DUOS[q][1]]: any(r, P3) }, n, holes: tail(n, 1) };
    },
  },
  {
    name: 'Два и два', sub: 'по два пропуска', picks: 6,
    hint: 'Два правила и два пропуска. Проверь оба правила для каждого.',
    make: (r, q) => {
      const n = any(r, [9, 10]);
      return { rule: { [DUOS[q][0]]: 'AB', [DUOS[q][1]]: any(r, P3) }, n, holes: tail(n, 2) };
    },
  },
  {
    name: 'Три и четыре', sub: 'длинные правила', picks: 6,
    hint: 'Одно правило из трёх шагов, другое из четырёх. Следи за каждым отдельно.',
    make: (r, q) => ({ rule: { [DUOS[q][0]]: any(r, P3), [DUOS[q][1]]: any(r, P4) }, n: 10, holes: tail(10, 2) }),
  },

  // 13–16: rules that go by steps: more, bigger, a quarter turn.
  {
    name: 'Шаг за шагом', sub: 'растёт и вертится', picks: 6,
    hint: 'Фигурки растут, множатся или вертятся шаг за шагом. Что будет дальше?',
    make: (r, q) => {
      const p = STEP[q % 3];
      // The first three rows start from the beginning: one, small, upright.
      // The last two start anywhere and already alternate two colours.
      const rule = q < 3 ? { [p]: GROW[p] } : { [p]: spin(r, GROW[p]), color: 'AB' };
      return { rule, n: 8, holes: tail(8, 2) };
    },
  },
  {
    name: 'Шаг и цвет', sub: 'рост и цветной круг', picks: 6,
    hint: 'Фигурки меняются по шагам, а цвет идёт по своему кругу.',
    make: (r, q) => {
      const p = STEP[q % 3];
      const n = any(r, [8, 9]);
      return { rule: { [p]: spin(r, GROW[p]), color: any(r, ['AB', 'ABC']) }, n, holes: tail(n, 2) };
    },
  },
  {
    name: 'Задом наперёд', sub: 'убывает и вертится', picks: 6,
    hint: 'А теперь наоборот: фигурки убывают и крутятся в другую сторону.',
    make: (r, q) => {
      const p = STEP[q % 3];
      return { rule: { [p]: spin(r, BACK[p]), color: any(r, ['ABC', 'AAB']) }, n: 9, holes: tail(9, 2) };
    },
  },
  {
    name: 'Туда-сюда', sub: 'дошли и назад', picks: 6,
    hint: 'Туда и обратно: дошли до края — и назад.',
    make: (r, q) => {
      const p = STEP[q % 3];
      // The fourth row counts all the way to four and back: a repeat of six.
      const steps = q === 3 ? [1, 2, 3, 4, 3, 2] : SWING[p];
      return { rule: { [p]: spin(r, steps), color: any(r, ['AB', 'ABC']) }, n: 10, holes: tail(10, 2) };
    },
  },

  // 17–20: blanks inside the row, then three properties, then three blanks.
  {
    name: 'Дырки в ряду', sub: 'пропуски в середине', picks: 6,
    hint: 'Пропуски теперь в середине, а правил два, и оба длинные. Смотри и влево, и вправо.',
    make: (r, q) => ({ rule: { [DUOS[q][0]]: any(r, P3), [DUOS[q][1]]: any(r, P4) }, n: 10, holes: inner(r, 10, 2) }),
  },
  {
    name: 'Три правила', sub: 'форма, цвет и ещё', picks: 6,
    hint: 'Три правила сразу: форма, цвет и ещё размер или число.',
    make: (r, q) => {
      const rule = { shape: 'AB', color: any(r, ['ABC', 'AAB']), [q % 2 ? 'count' : 'size']: any(r, ['ABB', 'AABB', 'ABBA']) };
      return { rule, n: 10, holes: [...inner(r, 10, 1), 9] };
    },
  },
  {
    name: 'Три с шагом', sub: 'рост или поворот', picks: 6,
    hint: 'Три правила, и одно из них идёт по шагам: растёт или вертится.',
    make: (r, q) => {
      const p = STEP[q % 3];
      // Sizes repeat after three, so the colours there get a repeat of four.
      const rule = { shape: 'AB', color: any(r, p === 'size' ? P4 : P3), [p]: spin(r, GROW[p]) };
      return { rule, n: 10, holes: inner(r, 10, 2) };
    },
  },
  {
    name: 'Мастер рядов', sub: 'три пропуска', picks: 6,
    hint: 'Самые хитрые ряды: три правила и три пропуска. Проверяй каждое правило отдельно.',
    make: (r, q) => {
      const p = STEP[q % 3];
      const rule = { shape: any(r, ['AAB', 'ABBA']), color: any(r, ['ABC', 'ABCB']), [p]: spin(r, q % 2 ? SWING[p] : BACK[p]) };
      // One blank near the start, one in the middle, one near the end.
      return { rule, n: 10, holes: [any(r, [0, 1]), any(r, [3, 4, 5, 6]), any(r, [8, 9])] };
    },
  },

  // 21–24: the square.
  {
    name: 'Квадрат', sub: 'одна пустая клетка', picks: 6, square: ['shape', 'color'], gaps: 1,
    hint: 'В каждом ряду и в каждом столбике каждая форма и каждый цвет — по одному разу. Чего не хватает?',
  },
  {
    name: 'Ещё и размер', sub: 'три признака', picks: 6, square: ['shape', 'color', 'size'], gaps: 1,
    hint: 'Теперь и размеры: большая, средняя и маленькая — по одной в каждом ряду и столбике.',
  },
  {
    name: 'Две клетки', sub: 'обе на одной линии', picks: 6, square: ['shape', 'color'], gaps: 2,
    hint: 'Пустых клеток две, и обе на одной линии. Одной линии мало: проверяй и ряд, и столбик!',
  },
  {
    name: 'Суперквадрат', sub: 'всё сразу', picks: 6, square: ['shape', 'color', 'size'], gaps: 2,
    hint: 'Две пустые клетки, а признаков три: форма, цвет и размер. Проверяй и ряд, и столбик!',
  },
];

const LIST = LEVELS.map((L, i) => ({
  key: `patterns:${i + 1}`,
  name: L.name,
  sub: L.sub,
  href: `${MENU}/${i + 1}`,
}));

function question(L, rnd, q) {
  if (L.square) return squareOf(rnd, L);
  // A draw that is not fair is thrown away and made again.
  for (;;) {
    const made = rowOf(rnd, L.make(rnd, q), L.picks);
    if (made) return made;
  }
}

// The five questions of level n for a seed, all different. Each is
// { square, cells, holes, sets }: sets[k] are the choices for blank holes[k],
// and the right one looks like cells[holes[k]]. Also used by the self-check.
export function makeQuiz(n, seed) {
  const rnd = mulberry(seed);
  const out = [];
  const seen = new Set();
  while (out.length < ASKS) {
    const made = question(LEVELS[n - 1], rnd, out.length);
    const id = `${made.cells.map(key).join(' ')}|${made.holes}`;
    if (!seen.has(id)) { seen.add(id); out.push(made); }
  }
  return out;
}

// A sample of the level for its card: the start of a row, or the square.
function thumb(n) {
  const made = question(LEVELS[n - 1], mulberry(n), 0);
  const gap = () => h('i', {}, '?');
  if (!made.square) return h('span', { class: 'patterns-thumb' }, made.cells.slice(0, 3).map(figure), gap());
  return h('span', { class: 'patterns-thumb patterns-thumb-sq' },
    made.cells.map((f, i) => (made.holes.includes(i) ? gap() : figure(f))));
}

function menu(root) {
  levelScreen(root, {
    title: 'Продолжи узор',
    hint: 'Разгадай правило и заполни пропуски. Без ошибок — три звезды!',
    levels: LIST.map((x, i) => ({ ...x, thumb: thumb(i + 1) })),
  });
}

// What to look at again, by the first property she got wrong.
const WHY = {
  shape: 'Не совсем. Присмотрись к форме.',
  color: 'Не совсем. Проследи за цветом.',
  size: 'Не совсем. Сравни размеры.',
  turn: 'Не совсем. Посмотри, куда повёрнута фигурка.',
  count: 'Не совсем. Сосчитай фигурки.',
};
const WHY_SQUARE = {
  shape: 'Не совсем. Проверь формы и в ряду, и в столбике.',
  color: 'Не совсем. Проверь цвета и в ряду, и в столбике.',
  size: 'Не совсем. Проверь размеры и в ряду, и в столбике.',
};
const PRAISE = ['Верно!', 'Точно!', 'Так и есть!', 'Отлично!', 'Умница!'];

function play(root, n) {
  const index = n - 1;
  const L = LEVELS[index];
  const saveId = `patterns_${n}`;
  let alive = true;
  let timer = 0;
  let saving = Promise.resolve();
  let seed = 0, quiz = [];
  let at = 0;            // the row she is on
  let filled = 0;        // blanks of this row already done
  let dead = new Set();  // wrong choices already tried for the current blank
  let mistakes = 0;
  let waiting = true;    // a finished row is on show: taps do nothing
  let calm = 0;          // until this moment new choices ignore taps
  let cellEls = [];

  const dots = h('div', { class: 'step-dots' }, Array.from({ length: ASKS }, () => h('i')));
  const say = speaker('…');
  const board = h('div', { class: L.square ? 'patterns-square' : 'patterns-row' });
  const tray = h('div', { class: 'patterns-tray' });
  // The desk sizes a cell from the number of cells in a line (--n) and the
  // number of choices (--k), and the choices take the very same size.
  const desk = h('div', { class: `patterns-desk ${L.square ? 'patterns-desk-sq' : ''}` }, board, tray);
  desk.style.setProperty('--k', L.picks);
  root.append(h('div', { class: 'screen patterns-screen' },
    topbar(`Узор · уровень ${n}`, { back: MENU, right: [dots] }),
    say, h('div', { class: 'patterns-stage' }, desk),
  ));

  // Saves run one after another, so a late write can never undo a delete.
  const queue = job => { saving = saving.then(job).catch(() => {}); };
  const store = () => {
    const rec = { id: saveId, seed, at, filled, dead: [...dead], mistakes };
    queue(() => db.put('kv', rec));
  };
  const forget = () => queue(() => db.del('kv', saveId));

  const isRight = (Q, f) => key(f) === key(Q.cells[Q.holes[filled]]);

  // The choices for the blank that is next. A tap that was already on its
  // way (a double tap on the right figure, an impatient tap while a finished
  // row was on show) must not land on a choice that has just appeared.
  function offer() {
    const Q = quiz[at];
    calm = performance.now() + 450;
    cellEls[Q.holes[filled]].classList.add('patterns-now');
    tray.replaceChildren(...Q.sets[filled].map((f, i) => {
      const b = h('button', { class: 'patterns-pick', 'aria-label': `Вариант ${i + 1}` }, figure(f));
      b.onclick = () => pick(i, b);
      if (dead.has(i)) { b.disabled = true; b.classList.add('patterns-off'); }
      return b;
    }));
  }

  function show() {
    const Q = quiz[at];
    waiting = false;
    [...dots.children].forEach((d, i) => { d.className = i < at ? 'done' : i === at ? 'on' : ''; });
    cellEls = Q.cells.map((f, i) => {
      const k = Q.holes.indexOf(i);
      return k < 0 || k < filled
        ? h('div', { class: 'patterns-cell' }, figure(f))
        : h('div', { class: 'patterns-cell patterns-hole' }, '?');
    });
    desk.style.setProperty('--n', Q.square ? 3 : Q.cells.length);
    board.replaceChildren(...cellEls);
    offer();
  }

  function pick(i, b) {
    if (waiting || performance.now() < calm) return;
    const Q = quiz[at];
    const f = Q.sets[filled][i];
    if (!isRight(Q, f)) {
      const right = Q.cells[Q.holes[filled]];
      mistakes++;
      dead.add(i);
      b.disabled = true;
      b.classList.add('patterns-off', 'patterns-no');
      sfx.soft();
      say.say((L.square ? WHY_SQUARE : WHY)[PROPS.find(p => f[p] !== right[p])]);
      store();
      return;
    }
    sfx.ding();
    const cell = cellEls[Q.holes[filled]];
    cell.className = 'patterns-cell patterns-got';
    cell.replaceChildren(figure(f));
    filled++;
    dead = new Set();
    if (filled < Q.holes.length) {
      say.say('Верно! Теперь следующий пропуск.');
      offer();
      store();
      return;
    }
    waiting = true;
    b.classList.add('patterns-yes');
    for (const x of tray.children) x.disabled = true;
    say.say(PRAISE[at]);
    if (at === quiz.length - 1) {
      // The last blank is not stored: if she leaves during this pause, she
      // comes back to one blank left instead of losing the level.
      timer = setTimeout(finish, 1000);
      return;
    }
    at++;
    filled = 0;
    store();
    timer = setTimeout(() => {
      say.say(L.square
        ? 'Следующий квадрат. В каждом ряду и столбике всё по одному разу.'
        : 'Следующий ряд. Какое тут правило?');
      show();
    }, 1000);
  }

  function finish() {
    forget();
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    finishLevel({
      levels: LIST, index, stars, menu: MENU,
      text: mistakes === 0
        ? 'Все правила разгаданы без единой ошибки!'
        : `Все узоры собраны. Ошибок: ${mistakes}. Три звезды дают за игру без ошибок.`,
      again: () => start(),
    });
  }

  // A saved game is used only if it still points at a blank that exists.
  function start(saved) {
    clearTimeout(timer);
    const kept = Number.isInteger(saved?.seed) && Number.isInteger(saved.at);
    seed = kept ? saved.seed : Math.floor(Math.random() * 2 ** 32);
    quiz = makeQuiz(n, seed);
    const Q = kept ? quiz[saved.at] : null;
    const ok = !!Q && Number.isInteger(saved.filled) && saved.filled >= 0 && saved.filled < Q.holes.length;
    at = ok ? saved.at : 0;
    filled = ok ? saved.filled : 0;
    mistakes = ok ? Math.max(0, saved.mistakes | 0) : 0;
    dead = new Set(ok && Array.isArray(saved.dead)
      ? saved.dead.filter(i => Q.sets[filled][i] && !isRight(Q, Q.sets[filled][i]))
      : []);
    say.say(at || filled || mistakes ? `Продолжаем! Узор ${at + 1} из ${ASKS}.` : L.hint);
    show();
  }

  db.get('kv', saveId).catch(() => null).then(saved => { if (alive) start(saved); });

  return () => {
    alive = false;
    clearTimeout(timer);
  };
}

export default function run(root, arg) {
  if (!arg) { menu(root); return undefined; }
  const n = Number(arg);
  if (!LEVELS[n - 1] || !isOpen(LIST, n - 1)) { location.hash = MENU; return undefined; }
  return play(root, n);
}
