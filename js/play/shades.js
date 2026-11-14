// «Оттенки»: a board of colour tiles makes a smooth gradient, the loose tiles
// are shuffled, and she swaps them (tap one, then another, or drag one onto
// another) until the gradient is whole again. Tiles with a dot never move.
// A tile that lands in its place gives no sign: she judges the whole picture.
//
// The ladder (the keys shades:1 … shades:20 must never change). The last
// number is how far apart the two closest tiles of a board are, see GAP:
//   1–4    one row of 5, 6, 7, 8 tiles with both ends fixed       .096 → .042
//   5–8    3×3, 4×3, 4×4, 5×4 with all four corners fixed         .079 → .044
//   9–12   5×4, 6×4, 6×5, 6×5 with two opposite corners fixed     .040 → .030
//   13–16  6×5, 6×5, 7×5, 7×5, two corners and closer colours     .025 → .020
//   17–20  7×6 with one fixed tile (corner, edge, then inside)
//          and corner colours near each other                     .019 → .016
//
// Stars count swaps against M, the number of loose tiles. The shuffle is one
// big cycle, so the shortest way home is always exactly M − 1 swaps: each
// swap puts a tile in its place and the last one puts two. A swap that sets
// her back (taking a move back, moving a tile that was already home) costs
// itself and one more to make up for it, so every solve takes M − 1 plus two
// per slip, never an odd swap more. Three stars allow one slip and another
// for every eight tiles: careful play, not a perfect one. Two stars allow a
// slip for every second tile, and never fewer than three. Anything slower
// still earns one, and a hint caps the level at two.
import { h, canvas, clamp, lerp, pick, shuffle, hexRgb, rgbHex } from '../util.js';
import { topbar, btn, speaker, confirmBox } from '../ui.js';
import { db } from '../store.js';
import { sfx } from '../audio.js';
import { levelScreen, finishLevel, isOpen } from './kit.js';
import { t, N, plural } from '../i18n.js';

const MENU = '#/game/shades';
// The least difference allowed between any two tiles of one board, measured
// in OKLab, a colour space where equal distances look equally different.
// Tiles this far apart still show a seam side by side; closer ones melt together.
const GAP = 0.015;
const CELL = 150;  // a tile never grows beyond this
const WAVE = 55;   // ms between neighbouring tiles in the finishing wave
const REST = 700;  // ms after which a finger that has not moved is resting, not tapping
const LOOK = N('Посмотри, как цвета перетекают друг в друга. Готова? Нажми «Перемешать»!');

// Which tiles carry a dot: slots counted row by row from the top left.
const FIXED = {
  ends: (cols, n) => [0, n - 1],                    // a row's ends, or two opposite corners
  cross: (cols, n) => [cols - 1, n - cols],         // the other two corners
  four: (cols, n) => [0, cols - 1, n - cols, n - 1],
};

// [name, columns, rows, corner colours (left and right for a row; top left,
// top right, bottom left, bottom right for a grid), fixed tiles (a key of
// FIXED or one slot), what the mascot says].
const LADDER = [
  [N('Малина'), 5, 1, '#ffe0ea #a80f4c', 'ends',
    N('Расставь плитки от светлой к тёмной: нажми на одну, потом на другую — и они поменяются местами. Плитки с точкой уже на месте.')],
  [N('Закат'), 6, 1, '#ffdc4a #cf1a7c', 'ends',
    N('Жёлтый перетекает в малиновый. Плитку можно и перетащить пальцем прямо на другую.')],
  [N('Море'), 7, 1, '#a6ead4 #4a72c4', 'ends',
    N('Семь плиток от мятной до синей. Чем меньше ходов, тем больше звёзд!')],
  [N('Сирень'), 8, 1, '#d8c6f5 #835dd2', 'ends',
    N('Шаги стали мельче. Сравнивай плитку с её соседками.')],
  [N('Леденцы'), 3, 3, '#fff08a #ff8fb8 #ffa53d #8a3fd0', 'four',
    N('Теперь цвет меняется и вбок, и вниз. Четыре уголка стоят на месте — иди от них.')],
  [N('Волна'), 4, 3, '#f0ffd8 #62d6ff #7fe89a #3a5fd8', 'four',
    N('Собери сначала края между уголками, а потом серединку.')],
  [N('Ягоды'), 4, 4, '#ffb0d0 #a0e0ff #e0306a #2a6ae0', 'four',
    N('Шестнадцать плиток. Сверху светлые, снизу яркие.')],
  [N('Лето'), 5, 4, '#fff3b0 #ffb0c8 #40c8b0 #6a50d8', 'four',
    N('Двадцать плиток. Каждый ряд — своя дорожка цвета.')],
  [N('Мороженое'), 5, 4, '#ffe0a8 #ff7eb0 #8ae8d0 #6d6ff0', 'ends',
    N('На месте только два уголка. Плитки для двух других найди сама!')],
  [N('Лагуна'), 6, 4, '#aae9da #5996e0 #f5e9a2 #e89168', 'ends',
    N('Плиток больше. Сначала найди, какие цвета живут в углах.')],
  [N('Сумерки'), 6, 5, '#f9c7ff #7b8cff #ffb399 #c23f8b', 'ends',
    N('Тридцать плиток. Собирай по рядам, от края до края.')],
  [N('Луг'), 6, 5, '#fbe880 #72cf8e #f9a680 #4c9db0', 'cross',
    N('Точки теперь в других уголках. Не торопись!')],
  [N('Персик'), 6, 5, '#ffd3e3 #ffb177 #c7a0f3 #f06787', 'ends',
    N('Цвета стали ближе друг к другу. Ставь похожие плитки рядом и сравнивай.')],
  [N('Мята'), 6, 5, '#d2f6e0 #76cdf4 #faf692 #45af85', 'cross',
    N('Зелёные и голубые. Смотри, где светлее, а где темнее.')],
  [N('Осень'), 7, 5, '#fde4ac #fda89e #e8bf63 #cb6e5d', 'ends',
    N('Тридцать пять тёплых плиток. Смотри очень внимательно.')],
  [N('Небо'), 7, 5, '#dfedff #a9a5f9 #a9eddf #5081d6', 'cross',
    N('Одни голубые и синие. Ищи, какая плитка чуть светлее соседки.')],
  [N('Зефир'), 7, 6, '#ffd9ec #ffc989 #d5c0ff #ff96a4', 0,
    N('Только одна плитка стоит на месте — в углу. От неё и начинай.')],
  [N('Туман'), 7, 6, '#e9f8fc #a4b8f0 #c6f2c2 #75a1ab', 5,
    N('Одна точка, и она на краю. Сначала реши, какой цвет в каком углу.')],
  [N('Ракушка'), 7, 6, '#ffeed7 #f9aebb #f0dc96 #d48971', 15,
    N('Точка внутри поля, а цвета очень близкие. Сравнивай плитки по парам.')],
  [N('Жемчуг'), 7, 6, '#e6e2fe #acc6f3 #fdc8c3 #c895d8', 25,
    N('Самый тонкий уровень. Ты уже мастер оттенков — у тебя получится!')],
];

// sRGB bytes → linear light → OKLab (Björn Ottosson's published matrices).
function oklab(rgb) {
  const [r, g, b] = rgb.map(v => (v <= 10 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

// Every tile of a board, row by row, blended from the corner colours.
function blend(cols, rows, [a, b, c = a, d = b]) {
  return Array.from({ length: cols * rows }, (_, p) => {
    const u = (p % cols) / (cols - 1);
    const v = rows > 1 ? Math.floor(p / cols) / (rows - 1) : 0;
    return [0, 1, 2].map(i => Math.round(lerp(lerp(a[i], b[i], u), lerp(c[i], d[i], u), v)));
  });
}

// The distance between the two most alike tiles. Every pair is compared, not
// only neighbours: two tiles that look the same would have two right places.
function closest(tiles) {
  const lab = tiles.map(oklab);
  let gap = Infinity;
  for (let i = 0; i < lab.length; i++) {
    for (let j = i + 1; j < lab.length; j++) {
      gap = Math.min(gap, Math.hypot(lab[i][0] - lab[j][0], lab[i][1] - lab[j][1], lab[i][2] - lab[j][2]));
    }
  }
  return gap;
}

// The colours of a board. Corner colours that are too alike are pushed away
// from their middle until every tile can be told from every other.
function tints(cols, rows, hues) {
  let corners = hues.map(hexRgb);
  for (let pass = 0; pass < 8; pass++) {
    const tiles = blend(cols, rows, corners);
    const gap = closest(tiles);
    if (gap >= GAP) return tiles.map(t => rgbHex(...t));
    const mid = [0, 1, 2].map(i => corners.reduce((s, c) => s + c[i], 0) / corners.length);
    const k = Math.min(2, (1.1 * GAP) / Math.max(gap, 1e-4));
    const wide = corners.map(c => c.map((v, i) => mid[i] + (v - mid[i]) * k));
    // Pale colours have no room above them (nor dark ones below), so the whole
    // set first slides back into range; cutting it off would bring tiles together again.
    const slide = [0, 1, 2].map(i => {
      const all = wide.map(c => c[i]);
      return Math.min(0, 255 - Math.max(...all)) || Math.max(0, -Math.min(...all));
    });
    corners = wide.map(c => c.map((v, i) => clamp(v + slide[i], 0, 255)));
  }
  throw new Error(`shades: the colours ${hues.join(' ')} cannot be told apart`);
}

// A mirrored gradient is just as smooth as the real one, so the fixed tiles
// must rule every mirror image out: each flip of the board has to move one.
function anchored(cols, rows, pinned) {
  const flips = [];
  if (cols > 1) flips.push((c, r) => [cols - 1 - c, r]);
  if (rows > 1) flips.push((c, r) => [c, rows - 1 - r]);
  if (cols > 1 && rows > 1) flips.push((c, r) => [cols - 1 - c, rows - 1 - r]);
  if (cols === rows) {
    flips.push((c, r) => [r, c], (c, r) => [rows - 1 - r, cols - 1 - c],
      (c, r) => [rows - 1 - r, c], (c, r) => [r, cols - 1 - c]);
  }
  return flips.every(flip => pinned.some(p => {
    const [c, r] = flip(p % cols, Math.floor(p / cols));
    return r * cols + c !== p;
  }));
}

const LEVELS = LADDER.map(([name, cols, rows, hues, fixed, tip], i) => {
  const n = cols * rows;
  const pinned = typeof fixed === 'number' ? [fixed] : FIXED[fixed](cols, n);
  if (!anchored(cols, rows, pinned)) throw new Error(`shades ${i + 1}: a mirrored board would look solved too`);
  const loose = n - pinned.length;
  return {
    key: `shades:${i + 1}`, name, href: `${MENU}/${i + 1}`,
    sub: rows > 1 ? `${cols}×${rows} · ` + plural(pinned.length, '{n} точка|{n} точки|{n} точек') : t('{n} в ряд', { n: cols }),
    cols, rows, n, pinned, loose, tip,
    colors: tints(cols, rows, hues.split(' ')),
    // The most swaps that still earn three and two stars: two swaps per slip.
    three: loose - 1 + 2 * (1 + Math.floor(loose / 8)),
    two: loose - 1 + 2 * Math.max(3, Math.ceil(loose / 2)),
    // A saved board is only good for the very same colours and dots.
    tag: `${cols}x${rows} ${hues} ${pinned}`,
  };
});

// The whole gradient in small, for the level card.
function thumb(L) {
  const w = Math.floor(Math.min(22, 88 / L.cols, 76 / L.rows));
  const ht = L.rows > 1 ? w : w * 2;
  // Drawn at twice the size, so the edges stay crisp on her screen.
  const c = canvas(w * L.cols * 2, ht * L.rows * 2);
  const x = c.getContext('2d');
  L.colors.forEach((color, p) => {
    x.fillStyle = color;
    x.fillRect((p % L.cols) * w * 2, Math.floor(p / L.cols) * ht * 2, w * 2, ht * 2);
  });
  c.className = 'shades-thumb';
  c.style.width = `${w * L.cols}px`;
  c.style.height = `${ht * L.rows}px`;
  return c;
}

function menu(root) {
  levelScreen(root, {
    title: t('Оттенки'),
    hint: t('Собери плавный переход цвета. Плитки с точкой стоят на месте. Чем меньше ходов, тем больше звёзд!'),
    levels: LEVELS.map(L => ({ ...L, name: t(L.name), thumb: thumb(L) })),
  });
}

function play(root, index) {
  const L = LEVELS[index];
  const { cols, rows, n } = L;
  const slots = Array.from({ length: n }, (_, i) => i);
  const saveId = `shades_${index + 1}`;

  let alive = true;
  let phase = 'look';              // look (the whole gradient) → play → done
  let order = slots.slice();       // order[slot] = tile; tile k belongs in slot k
  let fixed = new Set(L.pinned);   // the dots: the level's own and every hinted tile
  let swaps = 0, hinted = false;
  let sel = -1;                    // the slot she tapped first
  let hold = null;                 // the finger that is down: { p, id, x, y, t, moved, over }
  let cw = 0, ch = 0;
  let told = false;                // the dot has been explained once
  let winT = 0;
  let saving = Promise.resolve();

  const movesEl = h('b', {}, t('Ходы: {n}', { n: 0 }));
  const goalEl = h('small', {});
  const say = speaker('…');
  // A play surface keeps its left-to-right geometry in Hebrew too.
  const board = h('div', { class: 'shades-board', dir: 'ltr' });
  const stage = h('div', { class: 'shades-stage' }, board);
  const mixBtn = btn('primary', t('Перемешать!'), () => { if (phase === 'look') mix(); });
  const hintBtn = btn('ghost', t('Подсказка'), hint);
  const againBtn = btn('ghost', t('Заново'), restart);
  const screen = h('div', { class: 'screen shades-play' },
    topbar(`${index + 1}. ${t(L.name)}`, {
      back: MENU,
      right: [h('div', { class: 'shades-score' }, movesEl, goalEl), mixBtn, hintBtn, againBtn],
    }),
    say,
    stage,
  );
  root.append(screen);

  // Each tile knows its turn in the finishing wave, which runs corner to corner.
  const tiles = L.colors.map((color, k) => {
    const el = h('div', { class: 'shades-tile', style: { background: color } });
    el.style.setProperty('--d', `${((k % cols) + Math.floor(k / cols)) * WAVE}ms`);
    return el;
  });

  const solved = () => slots.every(p => order[p] === p);
  const starsNow = () => Math.min(hinted ? 2 : 3, swaps <= L.three ? 3 : swaps <= L.two ? 2 : 1);

  function render() {
    for (const p of slots) {
      const el = tiles[order[p]];
      el.style.setProperty('--x', `${(p % cols) * cw}px`);
      el.style.setProperty('--y', `${Math.floor(p / cols) * ch}px`);
      el.classList.toggle('sel', p === sel);
    }
    movesEl.textContent = t('Ходы: {n}', { n: swaps });
    const s = starsNow();
    const stars = '★'.repeat(s) + '☆'.repeat(3 - s);
    const goal = s === 3 ? L.three : s === 2 && swaps <= L.two ? L.two : 0;
    goalEl.textContent = goal ? t('{stars} до {n}', { stars, n: goal }) : stars;
  }

  // Whole pixels per tile, so the finished gradient has no hairlines in it.
  function layout() {
    const sw = stage.clientWidth - 8, sh = stage.clientHeight - 16;
    if (sw <= 0 || sh <= 0) return;
    cw = Math.floor(Math.min(CELL, sw / cols, rows > 1 ? sh / rows : CELL));
    // A single row would be a thin strip, so its tiles stand tall.
    ch = rows > 1 ? cw : Math.floor(Math.min(sh, cw * 1.6));
    Object.assign(board.style, {
      width: `${cw * cols}px`, height: `${ch * rows}px`,
      left: `${Math.round((stage.clientWidth - cw * cols) / 2)}px`,
      top: `${4 + Math.round((sh - ch * rows) / 2)}px`,
    });
    board.style.setProperty('--w', `${cw}px`);
    board.style.setProperty('--h', `${ch}px`);
    render();
  }
  const watcher = new ResizeObserver(layout);
  watcher.observe(stage);

  // Saves run one after another, so a late write can never undo a delete.
  const queue = job => { saving = saving.then(job).catch(() => {}); };
  const store = () => {
    const rec = {
      id: saveId, tag: L.tag, order: order.slice(), swaps, hinted,
      pins: [...fixed].filter(p => !L.pinned.includes(p)),
    };
    queue(() => db.put('kv', rec));
  };
  const forget = () => queue(() => db.del('kv', saveId));

  function buttons() {
    mixBtn.classList.toggle('hidden', phase !== 'look');
    hintBtn.classList.toggle('hidden', phase !== 'play');
    againBtn.classList.toggle('hidden', phase !== 'play');
  }

  // A saved board is used only if it is a real, unfinished board of this level.
  function revive(saved) {
    if (!saved || saved.tag !== L.tag || !Array.isArray(saved.order) || !Array.isArray(saved.pins)) return null;
    const o = saved.order;
    const whole = o.length === n && slots.every(k => o.includes(k));
    const dotsHome = [...L.pinned, ...saved.pins].every(p => o[p] === p);
    if (!whole || !dotsHome || slots.every(p => o[p] === p)) return null;
    return { order: o.slice(), pins: saved.pins, swaps: saved.swaps | 0, hinted: !!saved.hinted };
  }

  function start(saved) {
    clearTimeout(winT);
    drop();
    sel = -1;
    const game = revive(saved);
    order = game ? game.order : slots.slice();
    fixed = new Set(game ? [...L.pinned, ...game.pins] : L.pinned);
    swaps = game ? game.swaps : 0;
    hinted = game ? game.hinted : false;
    phase = game ? 'play' : 'look';
    board.classList.remove('done');
    tiles.forEach((el, k) => el.classList.toggle('fixed', fixed.has(k)));
    buttons();
    say.say(game ? t('Продолжаем! Плитки ждали тебя.') : t(LOOK));
    layout();
    // Tiles join the board already in place, so they do not fly in from a corner.
    if (!board.firstChild) board.append(...tiles);
  }

  function mix() {
    // One big cycle: every loose tile leaves its place, so the board is never
    // solved by chance, and the shortest solution always has the same length.
    const loose = shuffle(slots.filter(p => !fixed.has(p)));
    loose.forEach((p, i) => { order[p] = loose[(i + 1) % loose.length]; });
    phase = 'play';
    buttons();
    say.say(t(L.tip));
    render();
    store();
  }

  // Runs after every move. A tile that came home is deliberately not marked.
  function settle() {
    render();
    if (solved()) win(); else store();
  }

  function swap(p, q) {
    [order[p], order[q]] = [order[q], order[p]];
    swaps++;
    sel = -1;
    tiles[order[p]].classList.add('fly');
    tiles[order[q]].classList.add('fly');
    sfx.drop();
    settle();
  }

  function win() {
    phase = 'done';
    buttons();
    board.classList.add('done');
    sfx.ding();
    say.say(t('Готово! Все оттенки на своих местах.'));
    // The wave runs to the far corner before the dialog covers it. The saved
    // board goes only together with the stars: if she leaves during the wave,
    // the last move is still waiting for her.
    winT = setTimeout(() => {
      forget();
      const stars = starsNow();
      finishLevel({
        levels: LEVELS, index, stars, menu: MENU,
        text: stars === 3 ? t('Ходов: {n}. Глаз-алмаз!', { n: swaps })
          : swaps > L.three ? t('Ходов: {n}. Для трёх звёзд — не больше {max}.', { n: swaps, max: L.three })
          : t('Ходов: {n}. С подсказкой бывает не больше двух звёзд.', { n: swaps }),
        again: () => { if (alive) start(); },
      });
    }, (cols + rows - 2) * WAVE + 900);
  }

  // Puts one wrong tile home and gives it a dot, so the hint stays visible.
  async function hint() {
    if (phase !== 'play') return;
    if (!hinted && starsNow() === 3) {
      const yes = await confirmBox(t('Поставить одну плитку на место? Тогда за этот уровень будет не больше двух звёзд.'), t('Поставить'), t('Не надо'));
      if (!yes || !alive || phase !== 'play') return;
    }
    drop();
    // The wrong place nearest to a dot: what she knows for sure grows from there.
    const steps = (a, b) => Math.abs((a % cols) - (b % cols)) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols));
    const far = p => Math.min(...[...fixed].map(f => steps(p, f)));
    const wrong = slots.filter(p => order[p] !== p);
    const least = Math.min(...wrong.map(far));
    const p = pick(wrong.filter(w => far(w) === least));
    const q = order.indexOf(p);
    [order[p], order[q]] = [order[q], order[p]];
    swaps++;
    hinted = true;
    sel = -1;
    fixed.add(p);
    tiles[p].classList.add('fixed', 'fly', 'pin');
    tiles[order[q]].classList.add('fly');
    sfx.ding();
    settle();
    if (phase === 'play') say.say(t('Эта плитка теперь на своём месте. Видишь точку? Иди от неё дальше.'));
  }

  async function restart() {
    if (phase !== 'play') return;
    if (swaps && !(await confirmBox(t('Начать уровень заново? Ходы обнулятся.'), t('Заново'), t('Нет')))) return;
    if (!alive || phase !== 'play') return;
    forget();
    start();
  }

  const slotAt = e => {
    const r = board.getBoundingClientRect();
    const c = Math.floor((e.clientX - r.left) / cw), w = Math.floor((e.clientY - r.top) / ch);
    return c < 0 || w < 0 || c >= cols || w >= rows ? -1 : w * cols + c;
  };
  const markOver = q => {
    if (hold.over === q) return;
    if (hold.over >= 0) tiles[order[hold.over]].classList.remove('over');
    hold.over = q;
    if (q >= 0) tiles[order[q]].classList.add('over');
  };
  // Lets go of the tile under the finger without deciding anything.
  function drop() {
    if (!hold) return;
    markOver(-1);
    tiles[order[hold.p]].classList.remove('drag');
    hold = null;
  }
  // A tile with a dot shakes its head instead of moving.
  function refuse(p) {
    const el = tiles[order[p]];
    el.classList.remove('nope');
    void el.offsetWidth;
    el.classList.add('nope');
    sfx.soft();
    if (told) return;
    told = true;
    say.say(t('Плитка с точкой уже стоит на своём месте. Её двигать не нужно.'));
  }

  // A finger that went down and up without travelling.
  function tap(p) {
    if (sel < 0) {
      sel = p;
      sfx.pop();
      render();
    } else if (sel !== p) {
      swap(sel, p);
    } else {
      sel = -1;
      render();
    }
  }

  let penAt = -Infinity;
  board.addEventListener('pointerdown', e => {
    if (phase !== 'play') return;
    e.preventDefault();
    // The hand that holds the Pencil also touches the glass: ignore it.
    const pen = e.pointerType === 'pen';
    if (pen) penAt = e.timeStamp; else if (e.timeStamp - penAt < 1500) return;
    if (hold) {
      // A second finger never disturbs a drag. If the first finger only rests,
      // the new one takes over: a fresh touch counts as a tap right away, so two
      // quick hands swap two tiles, and a thumb left lying on the board is forgotten.
      // A palm under the Pencil is dropped without a tap, and so is a touch whose
      // end the system never reported.
      const palm = pen && hold.type !== 'pen';
      const gone = e.isPrimary && e.pointerType === hold.type;
      if (hold.moved && !palm && !gone) return;
      const { p, t, moved } = hold;
      drop();
      render();
      if (!palm && !moved && e.timeStamp - t < REST) tap(p);
      if (phase !== 'play') return;
    }
    const p = slotAt(e);
    if (p < 0) return;
    if (fixed.has(p)) { refuse(p); return; }
    hold = { p, id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, t: e.timeStamp, moved: false, over: -1 };
    try { board.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  });
  board.addEventListener('pointermove', e => {
    if (!hold || e.pointerId !== hold.id) return;
    const dx = e.clientX - hold.x, dy = e.clientY - hold.y;
    const el = tiles[order[hold.p]];
    if (!hold.moved) {
      // A finger never rests perfectly still, so a small wobble is still a tap.
      if (Math.hypot(dx, dy) < 12) return;
      hold.moved = true;
      sel = -1;
      render();
      el.classList.add('drag');
    }
    el.style.setProperty('--x', `${(hold.p % cols) * cw + dx}px`);
    el.style.setProperty('--y', `${Math.floor(hold.p / cols) * ch + dy}px`);
    const q = slotAt(e);
    markOver(q >= 0 && q !== hold.p && !fixed.has(q) ? q : -1);
  });
  const up = e => {
    if (!hold || e.pointerId !== hold.id) return;
    const { p, moved } = hold;
    drop();
    if (e.type === 'pointercancel') { render(); return; }
    if (!moved) { tap(p); return; }
    const q = slotAt(e);
    if (q >= 0 && q !== p && !fixed.has(q)) { swap(p, q); return; }
    tiles[order[p]].classList.add('fly');
    render();
    if (q >= 0 && q !== p) refuse(q);
  };
  // Heard on the window: a finger lifted outside the board must still let go
  // of its tile, or the board would wait for it forever.
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  // If the system takes the finger away without saying so, the tile must not stay stuck to it.
  board.addEventListener('lostpointercapture', e => {
    if (hold && e.pointerId === hold.id) { drop(); render(); }
  });
  // Flying tiles pass over the others, then settle back into the board.
  const landed = e => { if (e.propertyName === 'transform') e.target.classList.remove('fly'); };
  board.addEventListener('transitionend', landed);
  board.addEventListener('transitioncancel', landed);
  board.addEventListener('animationend', e => e.target.classList.remove('nope', 'pin'));
  stage.addEventListener('pointerdown', e => {
    if (e.target === stage && sel >= 0) { sel = -1; render(); }
  });

  db.get('kv', saveId).catch(() => null).then(saved => { if (alive) start(saved); });

  return () => {
    alive = false;
    watcher.disconnect();
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    clearTimeout(winT);
    screen.remove();
  };
}

export default function run(root, arg) {
  if (!arg) { menu(root); return undefined; }
  const index = Number(arg) - 1;
  if (!LEVELS[index] || !isOpen(LEVELS, index)) { location.hash = MENU; return undefined; }
  return play(root, index);
}
