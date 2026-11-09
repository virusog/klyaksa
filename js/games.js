// Short games that each train one thing an artist needs.
import { h, canvas, pick, shuffle, mulberry, samplePath, matchScore, starsFor, inkPoints, svgEl, sleep, clamp, lerp, rgbHex, outlineSvg, blobOf } from './util.js';
import { Painter } from './painter.js';
import { ALL_LESSONS, lessonById, allPaths } from './lessons.js';
import { state, save, award, awardOnce, db, newId } from './store.js';
import { topbar, btn, iconBtn, starBadge, paletteBar, sizeSlider, celebrate, speaker, toast, COLORS, mascot, autosaver, safeSave } from './ui.js';
import { saveArt } from './studio.js';
import { sfx } from './audio.js';

const GAMES = [
  { id: 'squiggle', title: 'Закорючка', text: 'Преврати каракулю в кого-нибудь', c: '#ffc83d', art: 'M30 70C10 20 60 10 60 45S20 90 55 75 100 20 85 55' },
  { id: 'dice', title: 'Кубики идей', text: 'Случайная тема для рисунка', c: '#ff85c0', art: 'M20 20h70v70H20zM40 40v.5M70 70v.5M55 55v.5' },
  { id: 'half', title: 'Половинка', text: 'Дорисуй вторую сторону', c: '#27c4a8', art: 'M55 10V100M55 25C20 10 10 50 20 60S45 75 55 70' },
  { id: 'lab', title: 'Цветолаб', text: 'Смешай точно такой же цвет', c: '#4aa8ff', art: 'M45 10h20v30l25 50a6 6 0 0 1-5 8H25a6 6 0 0 1-5-8l25-50z' },
  { id: 'pixels', title: 'Пиксели', text: 'Рисуй по клеточкам', c: '#8b5cf6', art: 'M15 15h25v25H15zM40 40h25v25H40zM65 15h25v25H65zM15 65h25v25H15zM65 65h25v25H65z' },
  { id: 'guess', title: 'Что рисует Клякса?', text: 'Угадай как можно раньше', c: '#ff6b5e', art: 'M55 95v.5M55 75c0-20 25-20 25-42S65 10 50 10 25 20 25 35' },
];

export function gamesHub(root) {
  root.append(h('div', { class: 'screen scroll hub' },
    topbar('Игры', { right: [starBadge()] }),
    h('div', { class: 'games-grid' }, GAMES.map(g =>
      h('a', { class: 'game-card', style: { '--c': g.c }, href: `#/game/${g.id}` },
        h('span', { class: 'game-art', html: `<svg viewBox="0 0 110 110"><path d="${g.art}"/></svg>` }),
        h('b', {}, g.title), h('small', {}, g.text),
      ))),
  ));
}

const drawLayout = (root, title, right, stageEl, foot, back = '#/games') => {
  root.append(h('div', { class: 'screen studio' },
    topbar(title, { back, right }),
    h('div', { class: 'studio-main' }, stageEl),
    foot,
  ));
};

const basicTools = p => {
  const size = sizeSlider(p);
  const pal = paletteBar(p, { onPick: () => size.sync() });
  return h('footer', { class: 'tools-foot' }, size, pal);
};

function squiggle(root) {
  const stageEl = h('div', { class: 'stage-host' });
  const p = new Painter(stageEl, { w: 1200, h: 900, layers: 2, brush: 'marker', color: '#2a2140' });
  p.active = 1;
  p.size = 12;
  let artId = newId('art');
  const saver = autosaver(
    () => p.dirty && p.log.length >= 2,
    () => saveArt(p, { id: artId, kind: 'game', title: 'Закорючка', layersN: 2 }),
    () => p.isBusy(),
  );

  function makeSquiggle() {
    artId = newId('art');
    p.layers[0].ctx.clearRect(0, 0, 1200, 900);
    p.log.length = 0;
    p.undoStack.length = 0;
    const r = mulberry((Math.random() * 1e9) | 0);
    const col = pick(['#ff6b5e', '#2f93d6', '#8b5cf6', '#27c4a8', '#ff8a1f']);
    let x = 300 + r() * 600, y = 240 + r() * 420;
    let a = r() * 6.28;
    const pts = [[x, y]];
    const n = 90 + Math.floor(r() * 60);
    let bend = (r() - 0.5) * 0.5;
    for (let i = 0; i < n; i++) {
      if (i % 22 === 0) bend = (r() - 0.5) * 0.6;
      a += bend;
      x += Math.cos(a) * 9; y += Math.sin(a) * 9;
      if (x < 180 || x > 1020) a = Math.PI - a;
      if (y < 160 || y > 740) a = -a;
      pts.push([x, y]);
    }
    p.noHistory = true;
    p._strokeBegin({ b: 'marker', c: col, z: 14, l: 0, y: 'none', seed: 7 }, pts[0][0], pts[0][1], 0.7);
    for (const q of pts.slice(1)) p._strokePoint(q[0], q[1], 0.7);
    const e = p.stroke;
    const entry = { t: 's', b: 'marker', c: col, z: 14, l: 0, y: 'none', seed: 7, pts: e.pts };
    p._strokeEnd();
    p.noHistory = false;
    p.log.push(entry);
    p.dirty = false;
  }
  makeSquiggle();

  const done = btn('primary', 'Готово', async () => {
    if (p.log.length < 2) { toast('Дорисуй что-нибудь!'); return; }
    try { await safeSave(saver.flush); } catch { return; }
    const r = awardOnce('squiggle');
    celebrate({
      title: 'Вот это превращение!', text: 'Рисунок в галерее.', unlocked: r.unlocked,
      actions: [
        { label: 'Ещё закорючку', primary: true, fn: () => { makeSquiggle(); p.layers[1].ctx.clearRect(0, 0, 1200, 900); } },
        { label: 'К играм', fn: () => { location.hash = '#/games'; } },
      ],
    });
  });
  drawLayout(root, 'Что это может быть?', [
    iconBtn('undo', 'Отменить', () => { if (p.log.length > 1) p.undo(); }),
    btn('ghost', 'Другая', async () => {
      await saver.flush().catch(() => {});
      p.layers[1].ctx.clearRect(0, 0, 1200, 900);
      makeSquiggle();
    }),
    done,
  ], stageEl, basicTools(p));
  p.fit();
  return () => {
    saver.stop();
    safeSave(saver.flush).catch(() => {}).finally(() => p.destroy());
  };
}

const WHO = ['кот', 'дракон', 'робот', 'единорог', 'пингвин', 'фея', 'лиса', 'инопланетянин', 'бабушка', 'черепаха', 'волшебник', 'жираф', 'хомяк', 'принцесса', 'панда', 'улитка', 'осьминог', 'пират'];
const DOES = ['ест мороженое', 'катается на скейте', 'читает книгу', 'летит на шаре', 'печёт торт', 'танцует', 'играет на гитаре', 'спит в гамаке', 'ловит звезду', 'рисует картину', 'пьёт какао', 'строит замок', 'едет на велосипеде', 'поливает цветы', 'запускает змея'];
const WHERE = ['в космосе', 'под водой', 'на облаке', 'в лесу', 'на крыше', 'в пустыне', 'в школе', 'в замке', 'на Северном полюсе', 'в кондитерской', 'на Луне', 'в джунглях', 'на маяке', 'в метро'];

function dice(root) {
  const cells = [WHO, DOES, WHERE].map(() => h('div', { class: 'reel' }, '?'));
  let spinning = false;
  let closed = false;
  let idea = '';
  async function spin() {
    if (spinning) return;
    spinning = true;
    const lists = [WHO, DOES, WHERE];
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 9 + c * 5; i++) {
        if (closed) return;
        cells[c].textContent = pick(lists[c]);
        sfx.soft();
        await sleep(55 + i * 4);
      }
      if (closed) return;
      sfx.ding();
    }
    idea = cells.map(c => c.textContent).join(' ');
    drawBtn.disabled = false;
    spinning = false;
  }
  const drawBtn = btn('primary', 'Рисовать это!', () => {
    sessionStorage.setItem('prompt', idea);
    location.hash = '#/studio/new';
  }, { disabled: true });
  root.append(h('div', { class: 'screen scroll hub' },
    topbar('Кубики идей', { back: '#/games' }),
    h('div', { class: 'dice-body' },
      mascot('wow'),
      h('h2', {}, 'Не знаешь, что нарисовать?'),
      h('div', { class: 'reels' }, cells),
      h('div', { class: 'row' }, btn('accent', 'Крутить!', spin), drawBtn),
    ),
  ));
  spin();
  return () => { closed = true; };
}

function half(root) {
  const pool = ['butterfly', 'owl', 'fox', 'bunny'];
  const L = lessonById(pick(pool));
  const stageEl = h('div', { class: 'stage-host' });
  const p = new Painter(stageEl, { w: 1200, h: 900, layers: 1, brush: 'pencil', color: '#2a2140' });
  p.size = 9;
  let closed = false;
  const guide = svgEl('svg', { viewBox: '0 0 1000 750', class: 'guide' });
  const defs = svgEl('clipPath', { id: 'leftHalf' });
  defs.append(svgEl('rect', { x: 0, y: 0, width: 500, height: 750 }));
  guide.append(defs);
  const g = svgEl('g', { 'clip-path': 'url(#leftHalf)' });
  allPaths(L).forEach(d => g.append(svgEl('path', { d, class: 'g-solid' })));
  guide.append(g, svgEl('line', { x1: 500, y1: 0, x2: 500, y2: 750, class: 'g-axis' }));
  p.under.append(guide);

  const done = btn('primary', 'Проверить', async () => {
    const ink = inkPoints(p.log, 0, 1.2);
    if (!ink.length) { toast('Дорисуй правую сторону!'); return; }
    const right = allPaths(L).flatMap(d => samplePath(d, 10)).filter(([x]) => x > 503);
    const stars = starsFor(matchScore(right, ink, { tol: 42 }));
    const res = award(`half:${L.id}`, stars);
    defs.firstChild.setAttribute('width', 1000);
    await sleep(900);
    if (closed) return;
    celebrate({
      title: stars === 3 ? 'Как в зеркале!' : stars === 2 ? 'Очень похоже!' : 'Симметрия дело хитрое. Попробуем ещё?',
      stars, unlocked: res.unlocked,
      actions: [
        { label: 'Ещё половинку', primary: true, fn: () => { root.textContent = ''; cleanup(); cleanup = half(root); } },
        { label: 'К играм', fn: () => { location.hash = '#/games'; } },
      ],
    });
  });
  drawLayout(root, 'Дорисуй правую половину', [iconBtn('undo', 'Отменить', () => p.undo()), done], stageEl,
    h('footer', { class: 'tools-foot' }, speaker('Смотри на левую сторону: каждая точка отражается справа на том же расстоянии от линии.')));
  p.fit();
  let cleanup = () => p.destroy();
  return () => { closed = true; cleanup(); };
}

const RYB = [
  [1, 1, 1], [0.92, 0.13, 0.14], [1, 0.85, 0.12], [1, 0.5, 0.05],
  [0.16, 0.38, 0.78], [0.5, 0.1, 0.55], [0.1, 0.66, 0.25], [0.23, 0.13, 0.08],
];

function mixPaint({ r = 0, y = 0, b = 0, w = 0, k = 0 }) {
  const total = r + y + b + w + k;
  if (!total) return [255, 250, 240];
  const m = Math.max(r, y, b, 0.0001);
  const R = r / m, Y = y / m, B = b / m;
  const c = [0, 1, 2].map(i => {
    const ch = n => RYB[n][i];
    const a0 = lerp(lerp(ch(0), ch(1), R), lerp(ch(2), ch(3), R), Y);
    const a1 = lerp(lerp(ch(4), ch(5), R), lerp(ch(6), ch(7), R), Y);
    return lerp(a0, a1, B);
  });
  const hasHue = r + y + b;
  const base = hasHue ? c : [1, 1, 1];
  const wt = w / total, kt = k / total;
  return base.map(v => clamp(lerp(lerp(v, 1, wt), 0, kt) * 255, 0, 255));
}

const LAB = [
  { name: 'Оранжевый', mix: { r: 1, y: 1 }, fact: 'Красный + жёлтый = оранжевый. Это цвет апельсина и заката.' },
  { name: 'Зелёный', mix: { y: 1, b: 1 }, fact: 'Жёлтый + синий = зелёный. Основных цветов всего три!' },
  { name: 'Фиолетовый', mix: { r: 1, b: 1 }, fact: 'Красный + синий = фиолетовый. Его любят художники для теней.' },
  { name: 'Розовый', mix: { r: 1, w: 2 }, fact: 'Белая краска делает цвет нежнее. Такой цвет зовут пастельным.' },
  { name: 'Небесный', mix: { b: 1, w: 2 }, fact: 'Вдали всё становится голубее и светлее: так рисуют дальние горы.' },
  { name: 'Лаймовый', mix: { y: 2, b: 1 }, fact: 'Больше жёлтого — зелень теплее и веселее.' },
  { name: 'Морская волна', mix: { y: 1, b: 2 }, fact: 'Больше синего — зелень холоднее.' },
  { name: 'Мандариновый', mix: { r: 1, y: 2 }, fact: 'Доля каждой краски меняет оттенок.' },
  { name: 'Серый', mix: { w: 2, k: 1 }, fact: 'Серый бывает разным: добавь капельку синего, и он станет холодным.' },
  { name: 'Шоколадный', mix: { r: 1, y: 1, b: 1 }, fact: 'Все три основных цвета вместе дают тёмный коричневый.' },
  { name: 'Сирень', mix: { r: 1, b: 1, w: 2 }, fact: 'Смешиваем цвет, а потом осветляем.' },
  { name: 'Бордовый', mix: { r: 3, b: 1, k: 1 }, fact: 'Чёрного всегда нужно совсем чуть-чуть.' },
];

function lab(root) {
  let level = clamp(state.best['lab:level'] || 0, 0, LAB.length - 1);
  let drops = {};
  let history = [];
  const paints = [['r', 'Красная', '#e5252a'], ['y', 'Жёлтая', '#ffd21f'], ['b', 'Синяя', '#2861c7'], ['w', 'Белая', '#ffffff'], ['k', 'Чёрная', '#2a2140']];
  const target = h('div', { class: 'lab-circle' });
  const cup = h('div', { class: 'lab-circle cup' });
  const meter = h('div', { class: 'lab-meter' }, h('i'));
  const pct = h('b', {}, '0%');
  const name = h('h2', {});
  const say = speaker('Капай краски, чтобы получить такой же цвет!');
  const count = h('div', { class: 'tubes-count' });

  const similar = () => {
    const a = mixPaint(LAB[level].mix), b = mixPaint(drops);
    if (!Object.values(drops).some(Boolean)) return 0;
    return clamp(100 - (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 441) * 240, 0, 100);
  };
  function render() {
    const T = LAB[level];
    name.textContent = `${level + 1}. ${T.name}`;
    target.style.background = rgbHex(...mixPaint(T.mix));
    cup.style.background = rgbHex(...mixPaint(drops));
    const s = similar();
    meter.firstChild.style.width = `${s}%`;
    pct.textContent = `${Math.round(s)}%`;
    count.textContent = Object.entries(drops).filter(e => e[1]).map(([k, v]) => `${paints.find(q => q[0] === k)[1]} ×${v}`).join(' · ');
    if (s >= 97) win();
  }
  function add(k) {
    drops[k] = (drops[k] || 0) + 1;
    history.push(k);
    sfx.drop();
    cup.classList.remove('plop');
    void cup.offsetWidth;
    cup.classList.add('plop');
    render();
  }
  function win() {
    const T = LAB[level];
    const used = history.length;
    const best = Object.values(T.mix).reduce((a, b) => a + b);
    const stars = used <= best + 1 ? 3 : used <= best + 4 ? 2 : 1;
    const res = award(`lab:${level}`, stars);
    const prev = state.best['lab:level'] || 0;
    if (level + 1 > prev) { state.best['lab:level'] = Math.min(level + 1, LAB.length - 1); save(); }
    celebrate({
      title: `Получилось: ${T.name.toLowerCase()}!`, text: T.fact, stars, unlocked: res.unlocked,
      actions: [{
        label: level + 1 < LAB.length ? 'Следующий цвет' : 'Заново', primary: true,
        fn: () => { level = (level + 1) % LAB.length; drops = {}; history = []; render(); },
      }],
    });
  }
  root.append(h('div', { class: 'screen scroll lab' },
    topbar('Цветолаб', { back: '#/games', right: [starBadge()] }),
    h('div', { class: 'lab-body' },
      name,
      h('div', { class: 'lab-row' },
        h('figure', {}, target, h('figcaption', {}, 'Нужно')),
        h('div', { class: 'lab-match' }, pct, meter),
        h('figure', {}, cup, h('figcaption', {}, 'Моя краска')),
      ),
      count,
      h('div', { class: 'tubes' },
        paints.map(([k, n, c]) => h('button', { class: 'tube', style: { '--t': c }, onclick: () => add(k) }, h('i'), n)),
      ),
      h('div', { class: 'row' },
        btn('ghost', 'Убрать каплю', () => { const k = history.pop(); if (k) { drops[k]--; render(); } }),
        btn('ghost', 'Вылить', () => { drops = {}; history = []; render(); }),
      ),
      say,
    ),
  ));
  render();
}

const PIX_KEY = { '.': null, r: '#e5252a', p: '#ff85c0', o: '#ff8a1f', y: '#ffd447', g: '#46c257', b: '#2f93d6', v: '#8b5cf6', w: '#ffffff', k: '#2a2140', t: '#d9a273', n: '#8a5a35' };
const PIX = [
  { id: 'heart', name: 'Сердце', a: ['............', '..rr....rr..', '.rrrr..rrrr.', 'rrwrrrrrrrrr', 'rwrrrrrrrrrr', 'rrrrrrrrrrrr', '.rrrrrrrrrr.', '..rrrrrrrr..', '...rrrrrr...', '....rrrr....', '.....rr.....', '............'] },
  { id: 'shroom', name: 'Грибок', a: ['....rrrr....', '..rrwwrrrr..', '.rrrwwrrwrr.', '.rrrrrrrwrr.', 'rrwwrrrrrrrr', 'rrwwrrrrrwwr', 'rrrrrrrrrwwr', '.kkwwwwwwkk.', '...wkwwkw...', '...wwwwww...', '...wwwwww...', '....wwww....'] },
  { id: 'cat', name: 'Котик', a: ['.k........k.', '.kk......kk.', '.kokkkkkkok.', '.kooooooook.', 'kooooooooook', 'kokkookkookk', 'kookooookokk', 'kooooppooook', '.koookkookk.', '..kooooook..', '...kkkkkkk..', '............'] },
  { id: 'cream', name: 'Мороженое', a: ['....pppp....', '...pppppp...', '..ppwppppp..', '..pwpppppp..', '..pppppppp..', '..yyyyyyyy..', '..tntttntt..', '...ttnttn...', '...tntttt...', '....ttnt....', '....tnt.....', '.....t......'] },
  { id: 'flower', name: 'Цветок', a: ['....vvvv....', '...vvvvvv...', '.vvvvyyvvvv.', 'vvvvyyyyvvvv', 'vvvvyyyyvvvv', '.vvvvyyvvvv.', '...vvvvvv...', '....vvvv....', '.....gg..gg.', '.gg..gg.gg..', '..gggggg....', '.....gg.....'] },
  { id: 'star', name: 'Звезда', a: ['.....yy.....', '.....yy.....', '....yyyy....', 'yyyyyyyyyyyy', '.yyyyyyyyyy.', '..yykyykyy..', '..yyyyyyyy..', '.yyyyppyyyy.', '.yyyyyyyyyy.', '.yyy....yyy.', 'yyy......yyy', '............'] },
];

function pixels(root, tpl) {
  if (!tpl) return pixelsMenu(root);
  const T = PIX.find(x => x.id === tpl);
  const N = T ? 12 : 24;
  const grid = new Array(N * N).fill(null);
  let col = T ? '#e5252a' : '#ff6b5e';
  let tool = 'pen';
  const S = 40;
  const cv = canvas(N * S, N * S);
  cv.className = 'pix-canvas';
  const ctx = cv.getContext('2d');
  const paint = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < N * N; i++) {
      if (grid[i]) { ctx.fillStyle = grid[i]; ctx.fillRect((i % N) * S, Math.floor(i / N) * S, S, S); }
    }
    ctx.strokeStyle = '#e5ddd0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { ctx.moveTo(i * S, 0); ctx.lineTo(i * S, N * S); ctx.moveTo(0, i * S); ctx.lineTo(N * S, i * S); }
    ctx.stroke();
  };
  const setAt = e => {
    const r = cv.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * N);
    const y = Math.floor(((e.clientY - r.top) / r.height) * N);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const v = tool === 'erase' ? null : col;
    if (grid[x + y * N] !== v) { grid[x + y * N] = v; paint(); }
  };
  let down = false;
  cv.addEventListener('pointerdown', e => { e.preventDefault(); down = true; try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ } setAt(e); });
  cv.addEventListener('pointermove', e => { if (down) for (const ev of e.getCoalescedEvents?.() || [e]) setAt(ev); });
  cv.addEventListener('pointerup', () => { down = false; });
  cv.addEventListener('touchstart', e => e.preventDefault(), { passive: false });

  const eraseBtn = iconBtn('eraser', 'Ластик', () => { tool = tool === 'erase' ? 'pen' : 'erase'; eraseBtn.classList.toggle('on', tool === 'erase'); });
  const picker = {
    color: col,
    mode: 'draw',
  };
  const swatches = paletteBar(picker, {
    colors: T ? [...new Set(T.a.join('').split('').filter(c => c !== '.'))].map(c => PIX_KEY[c]) : COLORS,
    onPick: c => { col = c; tool = 'pen'; eraseBtn.classList.remove('on'); },
  });
  swatches.set(T ? PIX_KEY[T.a.join('').replace(/\./g, '')[0]] : col);
  col = picker.color;

  let ref = null;
  if (T) {
    ref = canvas(240, 240);
    const x = ref.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 240, 240);
    T.a.forEach((row, yy) => [...row].forEach((c, xx) => {
      if (PIX_KEY[c]) { x.fillStyle = PIX_KEY[c]; x.fillRect(xx * 20, yy * 20, 20, 20); }
    }));
    x.strokeStyle = '#e5ddd0';
    x.lineWidth = 1;
    x.beginPath();
    for (let i = 0; i <= 12; i++) { x.moveTo(i * 20, 0); x.lineTo(i * 20, 240); x.moveTo(0, i * 20); x.lineTo(240, i * 20); }
    x.stroke();
  }

  const done = btn('primary', 'Готово', async () => {
    const out = canvas(N * 40, N * 40);
    const x = out.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, out.width, out.height);
    grid.forEach((c, i) => { if (c) { x.fillStyle = c; x.fillRect((i % N) * 40, Math.floor(i / N) * 40, 40, 40); } });
    const blob = await blobOf(out);
    try {
      await safeSave(() => db.put('art', { id: newId('art'), kind: 'pixel', title: T ? T.name : 'Пиксели', created: Date.now(), updated: Date.now(), thumb: blob, full: blob }));
    } catch { return; }
    let stars = 1;
    let res;
    if (T) {
      let right = 0;
      T.a.forEach((row, yy) => [...row].forEach((c, xx) => { if ((PIX_KEY[c] || '#ffffff') === (grid[xx + yy * N] || '#ffffff')) right++; }));
      const k = right / (N * N);
      stars = k > 0.97 ? 3 : k > 0.85 ? 2 : 1;
      res = award(`pix:${T.id}`, stars);
    } else res = awardOnce('pixels');
    celebrate({
      title: 'Пиксель к пикселю!', text: 'Картинка в галерее.', stars: T ? stars : null, unlocked: res.unlocked,
      actions: [{ label: 'Ещё', primary: true, fn: () => { location.hash = '#/game/pixels'; } }],
    });
  });

  root.append(h('div', { class: 'screen scroll pix' },
    topbar(T ? `Повтори: ${T.name}` : 'Свободные пиксели', { back: '#/game/pixels', right: [eraseBtn, done] }),
    h('div', { class: 'pix-body' },
      ref && h('div', { class: 'pix-ref' }, ref, h('small', {}, 'Образец')),
      cv,
    ),
    h('footer', { class: 'tools-foot' }, swatches),
  ));
  paint();
}

function pixelsMenu(root) {
  root.append(h('div', { class: 'screen scroll hub' },
    topbar('Пиксели', { back: '#/games', right: [starBadge()] }),
    h('div', { class: 'games-grid' },
      h('a', { class: 'game-card', style: { '--c': '#ffc83d' }, href: '#/game/pixels/free' }, h('b', {}, 'Свободный режим'), h('small', {}, 'Большое поле 24×24')),
      PIX.map(t => {
        const c = canvas(120, 120);
        const x = c.getContext('2d');
        t.a.forEach((row, yy) => [...row].forEach((ch, xx) => { if (PIX_KEY[ch]) { x.fillStyle = PIX_KEY[ch]; x.fillRect(xx * 10, yy * 10, 10, 10); } }));
        return h('a', { class: 'game-card pix-card', style: { '--c': '#fff' }, href: `#/game/pixels/${t.id}` }, c, h('b', {}, t.name), h('small', {}, '★'.repeat(state.best[`pix:${t.id}`] || 0) || 'Повтори по образцу'));
      }),
    ),
  ));
}

function guess(root) {
  const pool = ALL_LESSONS.filter(l => !l.noCopy && !['sphere', 'cube', 'road', 'eye'].includes(l.id));
  const rounds = shuffle(pool).slice(0, 5);
  let n = 0, total = 0, closed = false;
  const artBox = h('div', { class: 'guess-art' });
  const opts = h('div', { class: 'guess-opts' });
  const label = h('h2', {});
  root.append(h('div', { class: 'screen scroll guess' },
    topbar('Что рисует Клякса?', { back: '#/games' }),
    h('div', { class: 'guess-body' }, h('div', { class: 'guess-top' }, mascot('wow'), label), artBox, opts),
  ));

  async function round() {
    if (n >= rounds.length) return end();
    const L = rounds[n];
    label.textContent = `Картинка ${n + 1} из ${rounds.length}`;
    artBox.textContent = '';
    opts.textContent = '';
    const paths = allPaths(L);
    const art = outlineSvg(paths, { sw: 8 });
    [...art.children].forEach(e => { e.style.visibility = 'hidden'; });
    artBox.append(art);
    let shown = 0, solved = false, wrong = 0;
    const others = shuffle(pool.filter(x => x !== L)).slice(0, 3);
    shuffle([L, ...others]).forEach(o => {
      const b = btn('ghost', o.title, () => {
        if (solved) return;
        if (o !== L) { b.disabled = true; wrong++; sfx.soft(); return; }
        solved = true;
        b.classList.add('right');
        const k = shown / paths.length;
        const pts = Math.max(1, (k <= 0.45 ? 3 : k <= 0.75 ? 2 : 1) - wrong);
        total += pts;
        sfx.ding();
        [...art.children].forEach(e => { e.style.visibility = 'visible'; });
        setTimeout(() => { n++; if (!closed) round(); }, 1200);
      });
      opts.append(b);
    });
    for (const e of art.children) {
      if (solved || closed) return;
      e.style.visibility = 'visible';
      shown++;
      await sleep(1000);
    }
  }

  function end() {
    const stars = Math.round(total / rounds.length);
    const res = award(`guess:${new Date().toISOString().slice(0, 10)}`, clamp(stars, 1, 3));
    celebrate({
      title: 'Зоркий глаз!', text: 'Чем раньше угадываешь форму, тем лучше видишь как художник.', stars, unlocked: res.unlocked,
      actions: [{ label: 'К играм', primary: true, fn: () => { location.hash = '#/games'; } }],
    });
  }
  round();
  return () => { closed = true; };
}

export function gameRoute(root, id, arg) {
  if (id === 'squiggle') return squiggle(root);
  if (id === 'dice') return dice(root);
  if (id === 'half') return half(root);
  if (id === 'lab') return lab(root);
  if (id === 'pixels') return pixels(root, arg);
  if (id === 'guess') return guess(root);
  location.hash = '#/games';
  return undefined;
}
