// Пазл: a picture is cut into rectangular tiles and shuffled; she swaps tiles
// (tap one, then another, or drag one onto another) until it is whole again.
//
// The ladder, two pictures per step, each step with more tiles to tell apart:
//   1–2   3×2   6 tiles, the hint explains taps and drags
//   3–4   3×3   9
//   5–6   4×3  12
//   7–8   4×4  16
//   9–10  5×4  20
//  11–12  5×4  20, and about a third of the tiles are upside down
//  13–14  6×4  24, with turned tiles
//  15–16  6×5  30, with turned tiles
// Pictures also grow busier: the first seven are the simple early coloring
// pages, the rest are the detailed ones, where neighbouring tiles look alike.
//
// Stars count swaps against the number of tiles N. Putting one tile home per
// swap always finishes within N − 1, so 3 stars allow N swaps (one slip),
// 2 stars allow N + N/2 (a wrong try for every second tile), and anything
// slower still earns 1. Peeking at the picture caps the level at 2 stars.
import { h, canvas, shuffle, loadImg } from '../util.js';
import { topbar, btn, icon, speaker, toast, confirmBox, celebrate, mascot } from '../ui.js';
import { levelScreen, finishLevel, isOpen } from './kit.js';
import { award, db } from '../store.js';
import { sfx } from '../audio.js';
import { PAGES } from '../pages.js';
import { drawPage } from '../coloring.js';
import { t, dir } from '../i18n.js';

const MENU = '#/game/puzzle';
// "4×3" is columns × rows and reads left to right in Hebrew too; an isolate keeps
// the right-to-left text around it from turning it into "3×4".
const LRI = dir === 'rtl' ? '\u2066' : '', PDI = dir === 'rtl' ? '\u2069' : '';
const OWN = `${MENU}/own`;
const W = 1200, H = 900;

// [page id, columns, rows, turned]. Chosen so that no two tiles of a level are
// the same or nearly the same: every tile has exactly one home.
const LADDER = [
  ['whale', 3, 2], ['balloon', 3, 2],
  ['butterfly', 3, 3], ['castle', 3, 3],
  ['unicorn', 4, 3], ['sweets', 4, 3],
  ['owl', 4, 4], ['hedgehog-apple', 4, 4],
  ['puppy-butterfly', 5, 4], ['penguins-floe', 5, 4],
  ['magic-carriage', 5, 4, true], ['nature-spring', 5, 4, true],
  ['fairy-house', 6, 4, true], ['world-lighthouse', 6, 4, true],
  ['dragon-treasure', 6, 5, true], ['nature-autumn', 6, 5, true],
];

const LEVELS = LADDER.map(([id, cols, rows, turned = false], i) => {
  const page = PAGES.find(p => p.id === id) || PAGES[i];
  return {
    key: `puzzle:${i + 1}`, name: page.title, href: `${MENU}/${i + 1}`,
    sub: turned ? t('{cols}×{rows} · перевёртыши', { cols: LRI + cols, rows: rows + PDI }) : `${LRI}${cols}×${rows}${PDI}`,
    page, cols, rows, turned,
  };
});

// Sizes offered for a puzzle made of her own picture.
const OWN_SIZES = ['3x3', '4x3', '4x4', '5x4', '6x5'];

function pageCanvas(page, scale) {
  const c = canvas(W * scale, H * scale);
  const x = c.getContext('2d');
  x.scale(scale, scale);
  x.fillStyle = '#fff';
  x.fillRect(0, 0, W, H);
  drawPage(x, page, true, scale < 1 ? 9 : undefined);
  return c;
}

// How every tile looks, upright and upside down: the mean colour of each small
// cell of the tile. Tiles are told apart by look, not by exact pixels. Tiles she
// cannot tell apart (blank paper, plain sky, the faint fringe of a stroke that
// ends at the cut) must be interchangeable, otherwise a picture could look
// finished and still not be "solved". The rim is left out because a loose tile
// is shown with its edge clipped away.
const CELL = 10, RIM = 4, NEAR = 5;
function looks(pic, cols, rows) {
  const tw = pic.width / cols, th = pic.height / rows;
  const iw = tw - 2 * RIM, ih = th - 2 * RIM;
  const gx = Math.round(iw / CELL), gy = Math.round(ih / CELL), cells = gx * gy;
  // The cell of every column and row of a tile.
  const cx = Uint16Array.from({ length: iw }, (_, x) => Math.floor((x * gx) / iw));
  const cy = Uint16Array.from({ length: ih }, (_, y) => Math.floor((y * gy) / ih) * gx);
  const size = new Float32Array(cells);
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) size[cy[y] + cx[x]]++;
  const data = pic.getContext('2d').getImageData(0, 0, pic.width, pic.height).data;
  const faces = []; // faces[2k] is tile k upright, faces[2k + 1] is tile k turned
  for (let k = 0; k < cols * rows; k++) {
    const up = new Float32Array(cells * 3), down = new Float32Array(cells * 3);
    const x0 = (k % cols) * tw + RIM, y0 = Math.floor(k / cols) * th + RIM;
    for (let y = 0; y < ih; y++) {
      for (let x = 0; x < iw; x++) {
        const i = ((y0 + y) * pic.width + x0 + x) * 4;
        const a = (cy[y] + cx[x]) * 3, b = (cy[ih - 1 - y] + cx[iw - 1 - x]) * 3;
        for (let c = 0; c < 3; c++) {
          up[a + c] += data[i + c] / size[a / 3];
          down[b + c] += data[i + c] / size[b / 3];
        }
      }
    }
    faces.push(up, down);
  }
  // How many cells of two faces are visibly different.
  const differ = (a, b) => {
    let d = 0;
    for (let j = 0; j < a.length; j += 3) {
      if (Math.abs(a[j] - b[j]) > NEAR || Math.abs(a[j + 1] - b[j + 1]) > NEAR || Math.abs(a[j + 2] - b[j + 2]) > NEAR) d++;
    }
    return d;
  };
  // Faces that look the same share one kind.
  const kind = faces.map((_, i) => i);
  const root = i => (kind[i] === i ? i : (kind[i] = root(kind[i])));
  for (let i = 1; i < faces.length; i++) {
    for (let j = 0; j < i; j++) if (!differ(faces[i], faces[j])) kind[root(i)] = root(j);
  }
  return {
    kind: (k, turned) => root(2 * k + (turned ? 1 : 0)),
    // How much of tile k changes when it is turned, 0 to 1.
    lop: k => differ(faces[2 * k], faces[2 * k + 1]) / cells,
  };
}

// One puzzle on the screen. cfg: { title, back, picture(), cols, rows, turned,
// saveId, tag, scored, teach, onWin(result), onBad() }. Returns the cleanup.
function game(root, cfg) {
  const { cols, rows, turned, scored } = cfg;
  const n = cols * rows;
  const ids = Array.from({ length: n }, (_, i) => i);
  const twoStars = n + Math.ceil(n / 2);

  let dead = false;
  let phase = 'load'; // load → look (whole picture) → play → done
  let pic, look, tiles;
  let order = ids.slice(); // order[slot] = tile
  let rot = ids.map(() => 0); // rot[tile] = 1 when upside down
  let mixed = null; // the shuffle that waits behind «Перемешать!»
  let swaps = 0, peeked = false, right = n;
  let sel = -1; // selected slot
  let hold = null; // the finger that is down: { p, id, type, first, x, y, moved, over }
  let cw = 0, ch = 0;
  let peekT = 0, winT = 0;
  let taught = !cfg.teach;

  const movesEl = h('b', {}, t('Ходы: {n}', { n: 0 }));
  const goalEl = h('small', {});
  const say = speaker(t('Достаю картину…'));
  const board = h('div', { class: 'puzzle-board' });
  // A play surface: tiles are placed and hit-tested from the left in every language.
  const stage = h('div', { class: 'puzzle-stage', dir: 'ltr' }, board);
  const mixBtn = btn('primary hidden', t('Перемешать!'), () => { if (phase === 'look') mix(); });
  const peekBtn = btn('ghost hidden', [icon('eye', 22), ' ', t('Подсмотреть')], peek);
  const screen = h('div', { class: 'screen puzzle-play' },
    topbar(cfg.title, { back: cfg.back, right: [h('div', { class: 'puzzle-score' }, movesEl, scored ? goalEl : null), mixBtn, peekBtn] }),
    say,
    stage,
  );
  root.append(screen);

  const isRight = p => look.kind(order[p], rot[order[p]]) === look.kind(p, 0);
  const countRight = () => ids.reduce((s, p) => s + isRight(p), 0);
  const starsNow = () => Math.min(peeked ? 2 : 3, swaps <= n ? 3 : swaps <= twoStars ? 2 : 1);

  function render() {
    right = 0;
    for (const p of ids) {
      const k = order[p], el = tiles[k], ok = isRight(p);
      el.style.setProperty('--x', `${(p % cols) * cw}px`);
      el.style.setProperty('--y', `${Math.floor(p / cols) * ch}px`);
      el.style.setProperty('--a', rot[k] ? '180deg' : '0deg');
      el.classList.toggle('ok', ok);
      el.classList.toggle('sel', p === sel);
      right += ok;
    }
    movesEl.textContent = t('Ходы: {n}', { n: swaps });
    const s = starsNow();
    goalEl.textContent = '★'.repeat(s) + '☆'.repeat(3 - s) + (s === 3 ? ' ' + t('до {n}', { n }) : s === 2 ? ' ' + t('до {n}', { n: twoStars }) : '');
  }

  // Whole pixels per tile, so finished tiles meet without a hairline between them.
  function layout() {
    const sw = stage.clientWidth - 8, sh = stage.clientHeight - 16;
    if (!tiles || sw <= 0 || sh <= 0) return;
    const s = Math.min(sw / pic.width, sh / pic.height);
    cw = Math.floor((pic.width * s) / cols);
    ch = Math.floor((pic.height * s) / rows);
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

  const save = () => db.put('kv', { id: cfg.saveId, tag: cfg.tag, order, rot, swaps, peeked }).catch(() => {});

  // The most scrambled of many shuffles; null when the picture has nothing to mix.
  function scramble() {
    const lopsided = ids.filter(k => look.lop(k) > 0.04);
    let best = null;
    for (let tries = 0; tries < 60 && (!best || best.right); tries++) {
      order = shuffle(ids);
      rot = ids.map(() => 0);
      // Only tiles that visibly change are turned: a turned patch of plain sky would be a trap.
      if (turned) for (const k of shuffle(lopsided).slice(0, Math.round(n / 3))) rot[k] = 1;
      const r = countRight();
      if (!best || r < best.right) best = { order, rot, right: r };
    }
    return best.right < n ? best : null;
  }

  function mix() {
    ({ order, rot } = mixed);
    for (const el of tiles) el.classList.add('fly');
    begin(turned
      ? t('Часть кусочков вверх ногами! Нажми на выбранный кусочек ещё раз — он перевернётся.')
      : cfg.teach ? t('Нажми на кусочек, потом на другой — они поменяются местами. Или перетащи пальцем.')
        : scored ? t('Собери картину! Три звезды — если ходов не больше {n}.', { n })
          : t('Собери свою картину обратно!'));
    save();
  }

  function begin(text) {
    phase = 'play';
    mixBtn.classList.add('hidden');
    peekBtn.classList.remove('hidden');
    say.say(text);
    render();
  }

  // Runs after every move: redraw, store, react.
  function settle() {
    const was = right;
    render();
    save();
    if (right === n) { win(); return; }
    if (right <= was) { sfx.drop(); return; }
    sfx.ding();
    if (!taught) {
      taught = true;
      say.say(t('Смотри: кусочек встал на место и прилип! Так ты видишь, что уже готово.'));
    }
  }

  function swap(p, q) {
    [order[p], order[q]] = [order[q], order[p]];
    swaps++;
    sel = -1;
    tiles[order[p]].classList.add('fly');
    tiles[order[q]].classList.add('fly');
    settle();
  }

  // The turned tile is let go: were it still selected, her next tap on another
  // tile would swap the two, and turning tiles one after another is what she does.
  function turn(p) {
    rot[order[p]] ^= 1;
    sel = -1;
    settle();
  }

  function win() {
    phase = 'done';
    peekBtn.classList.add('hidden');
    board.classList.add('done');
    sfx.ding();
    say.say(t('Готово! Картина снова целая.'));
    // A moment to admire the finished picture before the dialog covers it. The
    // saved board goes only together with the stars: if she leaves during this
    // moment, the finished picture and its stars wait for her here.
    winT = setTimeout(() => {
      db.del('kv', cfg.saveId).catch(() => {});
      cfg.onWin({ swaps, peeked, stars: starsNow(), n });
    }, 900);
  }

  async function peek() {
    if (phase !== 'play' || peekT) return;
    if (scored && !peeked && starsNow() === 3) {
      const yes = await confirmBox(t('Подсмотреть картину? Тогда за этот уровень будет не больше двух звёзд.'), t('Подсмотреть'), t('Не надо'));
      if (!yes || dead || phase !== 'play') return;
    }
    peeked = true;
    drop();
    sel = -1;
    render();
    save();
    say.say(t('Вот вся картина. Запоминай!'));
    board.append(pic);
    peekT = setTimeout(() => { pic.remove(); peekT = 0; }, 2000);
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

  let penAt = -Infinity;
  board.addEventListener('pointerdown', e => {
    if (phase !== 'play' || peekT) return;
    // The hand that holds the Pencil also touches the glass: ignore it.
    if (e.pointerType === 'pen') penAt = e.timeStamp;
    else if (e.timeStamp - penAt < 1500) return;
    // A finger that only rests gives way to the next touch, and the Pencil outranks a finger.
    // Two first fingers of one kind are never down together: the earlier one left without a word.
    if (hold && (!hold.moved || (e.pointerType === 'pen' && hold.type !== 'pen')
      || (hold.first && e.isPrimary && e.pointerType === hold.type))) { drop(); render(); }
    if (hold) return;
    e.preventDefault();
    const p = slotAt(e);
    // Tiles that are home stay put: she cannot spoil finished work by accident.
    if (p < 0 || isRight(p)) { sel = -1; render(); return; }
    hold = { p, id: e.pointerId, type: e.pointerType, first: e.isPrimary, x: e.clientX, y: e.clientY, moved: false, over: -1 };
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
    markOver(q >= 0 && q !== hold.p && !isRight(q) ? q : -1);
  });
  const up = e => {
    if (!hold || e.pointerId !== hold.id) return;
    const { p, moved } = hold;
    drop();
    if (e.type === 'pointercancel') { render(); return; }
    if (moved) {
      const q = slotAt(e);
      if (q >= 0 && q !== p && !isRight(q)) { swap(p, q); return; }
      if (q >= 0 && q !== p) sfx.soft();
      render();
    } else if (sel < 0) {
      sel = p;
      sfx.pop();
      render();
    } else if (sel !== p) {
      swap(sel, p);
    } else if (turned) {
      turn(p);
    } else {
      sel = -1;
      render();
    }
  };
  board.addEventListener('pointerup', up);
  board.addEventListener('pointercancel', up);
  // If the system takes the finger away without saying so, the tile must not stay stuck to it.
  board.addEventListener('lostpointercapture', e => {
    if (hold && e.pointerId === hold.id) { drop(); render(); }
  });
  // Flying tiles pass over the others, then settle back into the board.
  const landed = e => { if (e.propertyName === 'transform') e.target.classList.remove('fly'); };
  board.addEventListener('transitionend', landed);
  board.addEventListener('transitioncancel', landed);
  stage.addEventListener('pointerdown', e => {
    if (e.target === stage && sel >= 0) { sel = -1; render(); }
  });

  // A picture that cannot be read and a missing save both come back as null.
  const quiet = fn => Promise.resolve().then(fn).catch(() => null);
  Promise.all([quiet(cfg.picture), quiet(() => db.get('kv', cfg.saveId))]).then(([picture, saved]) => {
    if (dead) return;
    if (!picture) { cfg.onBad(); return; }
    pic = picture;
    pic.className = 'puzzle-peek';
    look = looks(pic, cols, rows);
    const tw = pic.width / cols, th = pic.height / rows;
    tiles = ids.map(k => {
      const c = canvas(tw, th);
      c.className = 'puzzle-face';
      c.getContext('2d').drawImage(pic, (k % cols) * tw, Math.floor(k / cols) * th, tw, th, 0, 0, tw, th);
      return h('div', { class: 'puzzle-tile ok' }, c);
    });
    board.append(...tiles);

    const fits = a => Array.isArray(a) && a.length === n;
    if (saved && saved.tag === cfg.tag && fits(saved.rot) && fits(saved.order) && ids.every(k => saved.order.includes(k))) {
      order = saved.order;
      rot = saved.rot.map(v => (v ? 1 : 0));
      swaps = saved.swaps || 0;
      peeked = !!saved.peeked;
      layout();
      if (countRight() === n) win();
      else begin(turned ? t('Продолжаем! Картина ждала тебя. Помни: второе нажатие переворачивает кусочек.') : t('Продолжаем! Картина ждала тебя.'));
      return;
    }
    mixed = scramble();
    if (!mixed) { cfg.onBad(); return; }
    order = ids.slice();
    rot = ids.map(() => 0);
    phase = 'look';
    mixBtn.classList.remove('hidden');
    say.say(t('Запомни картину! Когда будешь готова, нажми «Перемешать».'));
    layout();
  });

  return () => {
    dead = true;
    watcher.disconnect();
    clearTimeout(peekT);
    clearTimeout(winT);
    screen.remove();
  };
}

function levelList(root) {
  levelScreen(root, {
    title: t('Пазл'),
    hint: t('Собери картину из кусочков. Чем дальше, тем их больше — а потом они ещё и переворачиваются!'),
    levels: LEVELS.map(L => {
      const thumb = pageCanvas(L.page, 0.2);
      thumb.className = 'puzzle-thumb';
      return { ...L, name: t(L.name), thumb };
    }),
    extra: h('a', { class: 'puzzle-own', href: OWN },
      icon('brush', 34),
      h('span', {}, h('b', {}, t('Пазл из моего рисунка')), h('small', {}, t('Выбери свою картину и размер'))),
    ),
  });
}

function playLevel(root, index, again) {
  const L = LEVELS[index];
  return game(root, {
    title: `${index + 1}. ${t(L.name)}`, back: MENU,
    picture: () => pageCanvas(L.page, 1),
    cols: L.cols, rows: L.rows, turned: L.turned,
    saveId: `puzzle_${index + 1}`, tag: `${L.page.id}:${L.cols}x${L.rows}`,
    scored: true, teach: index < 2,
    onBad: () => { location.hash = MENU; },
    onWin: ({ swaps, peeked, stars, n }) => finishLevel({
      levels: LEVELS, index, stars, menu: MENU, again,
      text: peeked ? t('Ходов: {n}. С подсказкой бывает не больше двух звёзд.', { n: swaps })
        : stars < 3 ? t('Ходов: {n}. Для трёх звёзд — не больше {max}.', { n: swaps, max: n })
          : t('Ходов: {n}.', { n: swaps }),
    }),
  });
}

// Her own pictures and the size buttons.
function ownPicker(root) {
  let dead = false;
  const urls = [];
  const saved = sessionStorage.getItem('puzzleOwn') || '';
  let size = OWN_SIZES.includes(saved.replace('t', '')) ? saved.replace('t', '') : '4x3';
  let flip = saved.endsWith('t');

  const sizeTabs = OWN_SIZES.map(s => h('button', {
    class: 'tab', dir: 'ltr', onclick: () => { sfx.pop(); size = s; mark(); },
  }, s.replace('x', '×')));
  const flipTab = h('button', {
    class: 'tab puzzle-flip', onclick: () => { sfx.pop(); flip = !flip; mark(); },
  }, t('Перевёртыши'));
  function mark() {
    sizeTabs.forEach((b, i) => b.classList.toggle('on', OWN_SIZES[i] === size));
    flipTab.classList.toggle('on', flip);
    sessionStorage.setItem('puzzleOwn', size + (flip ? 't' : ''));
  }
  mark();

  const body = h('div', { class: 'puzzle-pics' });
  const tip = speaker(t('Выбери, на сколько кусочков резать, и нажми на свою картину.'));
  const sizes = h('div', { class: 'tabs puzzle-sizes' }, sizeTabs, flipTab);
  root.append(h('div', { class: 'screen scroll hub' }, topbar(t('Пазл из моего рисунка'), { back: MENU }), tip, sizes, body));

  db.all('art').catch(() => []).then(list => {
    if (dead) return;
    const mine = list.filter(r => r.full).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    if (!mine.length) {
      // With nothing to cut, sizes and a hint about tapping a picture would only puzzle her.
      tip.remove();
      sizes.remove();
      body.replaceWith(h('div', { class: 'empty' },
        mascot('wow'),
        h('p', {}, t('В галерее пока пусто. Нарисуй картину — и из неё получится пазл!')),
        h('a', { class: 'btn primary', href: '#/studio/new' }, t('Рисовать')),
      ));
      return;
    }
    for (const rec of mine) {
      const url = URL.createObjectURL(rec.thumb || rec.full);
      urls.push(url);
      body.append(h('button', {
        class: 'puzzle-pic',
        onclick: () => { sfx.pop(); location.hash = `${OWN}/${encodeURIComponent(rec.id)}/${size}${flip ? 't' : ''}`; },
      }, h('img', { src: url, alt: '' }), h('span', {}, rec.title ? t(rec.title) : t('Рисунок'))));
    }
  });

  return () => {
    dead = true;
    urls.forEach(u => URL.revokeObjectURL(u));
  };
}

// Her picture, scaled to fit the usual sheet and cut to whole pixels per tile.
async function ownPicture(artId, cols, rows) {
  const rec = await db.get('art', artId);
  if (!rec?.full) return null;
  const url = URL.createObjectURL(rec.full);
  try {
    const img = await loadImg(url);
    const s = Math.min(W / img.naturalWidth, H / img.naturalHeight);
    // A very long or very tall picture still gets tiles big enough to see.
    const side = (px, parts) => Math.max(40, Math.round((px * s) / parts)) * parts;
    const c = canvas(side(img.naturalWidth, cols), side(img.naturalHeight, rows));
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    // Pixel pictures are tiny and must stay crisp when enlarged.
    x.imageSmoothingEnabled = rec.kind !== 'pixel';
    x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function playOwn(root, artId, sizeText, again) {
  const m = /^(\d)x(\d)(t?)$/.exec(sizeText || '');
  if (!artId || !m || !OWN_SIZES.includes(`${m[1]}x${m[2]}`)) { location.hash = OWN; return null; }
  const cols = +m[1], rows = +m[2];
  return game(root, {
    title: t('Мой пазл'), back: OWN,
    picture: () => ownPicture(artId, cols, rows),
    cols, rows, turned: !!m[3],
    saveId: 'puzzle_own', tag: `${artId}:${sizeText}`,
    scored: false, teach: false,
    onBad: () => {
      // The router clears toasts when the address changes, so this one waits for that.
      window.addEventListener('hashchange', () => toast(t('Из этого рисунка пазл не получается. Выбери другой!')), { once: true });
      location.hash = OWN;
    },
    onWin: ({ swaps }) => {
      const res = award('puzzle:own', 1);
      celebrate({
        title: t('Твоя картина собрана!'),
        text: res.gain ? t('Ходов: {n}. За первый пазл из своего рисунка — звезда ★', { n: swaps }) : t('Ходов: {n}.', { n: swaps }),
        unlocked: res.unlocked,
        actions: [
          { label: t('Ещё раз'), fn: again },
          { label: t('Другой рисунок'), primary: true, fn: () => { location.hash = OWN; } },
        ],
      });
    },
  });
}

export default function run(root, arg, ...rest) {
  let stop = null;
  const open = () => {
    stop?.();
    root.textContent = '';
    if (!arg) stop = levelList(root);
    else if (arg === 'own') stop = rest.length ? playOwn(root, rest[0], rest[1], open) : ownPicker(root);
    else {
      const index = Number(arg) - 1;
      if (LEVELS[index] && isOpen(LEVELS, index)) stop = playLevel(root, index, open);
      else location.hash = MENU;
    }
  };
  open();
  return () => stop?.();
}
