// Short games that each train one thing an artist needs.
import { h, canvas, pick, shuffle, mulberry, samplePath, matchScore, starsFor, inkPoints, svgEl, sleep, clamp, lerp, rgbHex, outlineSvg, blobOf } from './util.js';
import { Painter } from './painter.js';
import { ALL_LESSONS, allPaths } from './lessons.js';
import { state, save, award, awardOnce, db, newId } from './store.js';
import { topbar, btn, iconBtn, starBadge, paletteBar, sizeSlider, celebrate, speaker, toast, COLORS, mascot, autosaver, safeSave } from './ui.js';
import { saveArt } from './studio.js';
import { sfx } from './audio.js';
import moreLab from './content/lab.js';
import moreLab2 from './content/lab2.js';
import moreDice from './content/dice.js';
import moreDice2 from './content/dice2.js';
import { PIX_KEY, PIX_PACKS, PIX, packOf } from './pix.js';

export { PIX_KEY, PIX_PACKS, PIX };

const GAMES = [
  { id: 'squiggle', title: 'Закорючка', text: 'Преврати каракулю в кого-нибудь', c: '#ffc83d', art: 'M30 70C10 20 60 10 60 45S20 90 55 75 100 20 85 55' },
  { id: 'dice', title: 'Кубики идей', text: 'Случайная тема для рисунка', c: '#ff85c0', art: 'M20 20h70v70H20zM40 40v.5M70 70v.5M55 55v.5' },
  { id: 'half', title: 'Половинка', text: 'Дорисуй вторую сторону', c: '#27c4a8', art: 'M55 10V100M55 25C20 10 10 50 20 60S45 75 55 70' },
  { id: 'lab', title: 'Цветолаб', text: 'Смешай точно такой же цвет', c: '#4aa8ff', art: 'M45 10h20v30l25 50a6 6 0 0 1-5 8H25a6 6 0 0 1-5-8l25-50z' },
  { id: 'pixels', title: 'Пиксели', text: 'Рисуй по клеточкам', c: '#8b5cf6', art: 'M15 15h25v25H15zM40 40h25v25H40zM65 15h25v25H65zM15 65h25v25H15zM65 65h25v25H65z' },
  { id: 'guess', title: 'Что рисует Клякса?', text: 'Угадай как можно раньше', c: '#ff6b5e', art: 'M55 95v.5M55 75c0-20 25-20 25-42S65 10 50 10 25 20 25 35' },
];

// Newer games live in their own files under js/play and load when opened.
const PLAY = [
  { id: 'pairs', title: 'Пары', text: 'Найди одинаковые картинки', c: '#7fd1ff', art: 'M12 20h36v48H12zM62 42h36v48H62zM30 36v16M22 44h16M80 58v16M72 66h16' },
  { id: 'puzzle', title: 'Пазл', text: 'Собери картину из кусочков', c: '#ffb340', art: 'M15 15h35v12a8 8 0 1 0 0 16v12H38a8 8 0 1 1-16 0H15zM60 55h35v40H60V83a8 8 0 1 1 0-16z' },
  { id: 'diff', title: 'Найди отличия', text: 'Картинки не совсем одинаковые', c: '#a3e635', art: 'M10 20h40v60H10zM60 20h40v60H60zM30 40v.5M80 40v.5M22 62q8 8 16 0M72 66q8-8 16 0' },
  { id: 'dots', title: 'По точкам', text: 'Соедини точки по порядку', c: '#ff8fa3', art: 'M20 80v.5M35 40v.5M60 20v.5M85 45v.5M92 82v.5M20 80L35 40 60 20' },
  { id: 'dictation', title: 'Диктант по клеточкам', text: 'Рисуй линию по командам', c: '#c9a7ff', art: 'M15 85V55h20V35h20V15h20v40h20v30M15 55v.5M55 35v.5M95 55v.5' },
  { id: 'oneline', title: 'Одним росчерком', text: 'Обведи, не отрывая карандаша', c: '#27c4a8', art: 'M20 90V45L55 15 90 45V90H20L90 45H20L90 90' },
  { id: 'shades', title: 'Оттенки', text: 'Расставь цвета по порядку', c: '#ff85c0', art: 'M10 35h18v40H10zM33 35h18v40H33zM56 35h18v40H56zM79 35h18v40H79z' },
  { id: 'patterns', title: 'Продолжи узор', text: 'Найди правило', c: '#ffd447', art: 'M10 45h20v20H10zM50 43a12 12 0 1 0 .1 0zM72 45h20v20H72zM20 85v.5M50 85v.5M82 85v.5' },
  { id: 'anim', title: 'Мультик', text: 'Нарисуй кадры и оживи их', c: '#4aa8ff', art: 'M12 22h86v62H12zM12 36h86M26 22v14M44 22v14M62 22v14M80 22v14M46 50l22 12-22 12z' },
].map(g => ({ ...g, fresh: true, load: () => import(`./play/${g.id}.js`) }));

export function gamesHub(root) {
  root.append(h('div', { class: 'screen scroll hub' },
    topbar('Игры', { right: [starBadge()] }),
    h('div', { class: 'games-grid' }, [...GAMES, ...PLAY].map(g =>
      h('a', { class: 'game-card', style: { '--c': g.c }, href: `#/game/${g.id}` },
        h('span', { class: 'game-art', html: `<svg viewBox="0 0 110 110"><path d="${g.art}"/></svg>` }),
        g.fresh && h('em', { class: 'tag fresh' }, 'Новое'),
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

// Nine kinds of starting scribble, so the game keeps surprising her.
function squigglePoints(r) {
  const kind = Math.floor(r() * 9);
  const cx = 400 + r() * 400, cy = 320 + r() * 260;
  const pts = [];
  if (kind === 0) {
    let x = cx, y = cy, a = r() * 6.28, bend = 0;
    const n = 90 + Math.floor(r() * 60);
    for (let i = 0; i < n; i++) {
      if (i % 22 === 0) bend = (r() - 0.5) * 0.6;
      a += bend;
      x += Math.cos(a) * 9; y += Math.sin(a) * 9;
      if (x < 180 || x > 1020) a = Math.PI - a;
      if (y < 160 || y > 740) a = -a;
      pts.push([x, y]);
    }
  } else if (kind === 1) {
    const turns = 2 + r() * 2, R = 90 + r() * 120, tilt = r() * 6.28;
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, a = tilt + t * turns * 6.283;
      pts.push([cx + Math.cos(a) * R * t, cy + Math.sin(a) * R * t * 0.8]);
    }
  } else if (kind === 2) {
    const n = 5 + Math.floor(r() * 5), step = 400 / n;
    for (let i = 0; i <= n; i++) pts.push([cx - 200 + i * step, cy + (i % 2 ? -1 : 1) * (50 + r() * 110)]);
    return pts.flatMap((q, i) => (i ? Array.from({ length: 12 }, (_, k) => {
      const p0 = pts[i - 1], t = (k + 1) / 12;
      return [p0[0] + (q[0] - p0[0]) * t, p0[1] + (q[1] - p0[1]) * t];
    }) : [q]));
  } else if (kind === 3) {
    const loops = 3 + Math.floor(r() * 3);
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, a = t * loops * 6.283;
      pts.push([cx - 240 + 480 * t + Math.sin(a) * 60, cy + Math.cos(a) * (60 + r() * 6)]);
    }
  } else if (kind === 5) {
    // A tilted figure-eight.
    const a = 140 + r() * 80, tilt = r() * 3.14;
    for (let i = 0; i <= 140; i++) {
      const t = (i / 140) * 6.283, q = 1 + Math.sin(t) ** 2;
      const u = (a * Math.cos(t)) / q, v = (a * Math.sin(t) * Math.cos(t)) / q;
      pts.push([cx + u * Math.cos(tilt) - v * Math.sin(tilt), cy + u * Math.sin(tilt) + v * Math.cos(tilt)]);
    }
  } else if (kind === 6) {
    // A square spiral.
    let x = cx, y = cy, len = 40;
    const turns = 7 + Math.floor(r() * 4), flip = r() < 0.5 ? 1 : -1;
    pts.push([x, y]);
    for (let i = 0; i < turns; i++) {
      const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][i % 4];
      for (let k = 0; k < len / 8; k++) { x += dx * 8 * flip; y += dy * 8; pts.push([x, y]); }
      len += 34;
    }
  } else if (kind === 7) {
    // A row of bumps, like the top of a cloud.
    const n = 3 + Math.floor(r() * 3), rr = 220 / n, up = r() < 0.5 ? 1 : -1;
    for (let b = 0; b < n; b++) {
      for (let i = 0; i <= 16; i++) {
        const t = Math.PI - (i / 16) * Math.PI;
        pts.push([cx - 220 + rr + b * rr * 2 + Math.cos(t) * rr, cy - Math.sin(t) * rr * (0.8 + (b % 2) * 0.5) * up]);
      }
    }
  } else if (kind === 8) {
    // A hook with a long tail.
    const rr = 80 + r() * 30, flip = r() < 0.5 ? 1 : -1;
    for (let i = 0; i <= 40; i++) {
      const t = Math.PI + (i / 40) * Math.PI * 1.5;
      pts.push([cx + Math.cos(t) * rr * flip, cy + Math.sin(t) * rr]);
    }
    for (let i = 1; i <= 16; i++) pts.push([cx, cy + rr + i * 9]);
  } else {
    const n = 3 + Math.floor(r() * 3), base = 130 + r() * 90;
    for (let i = 0; i <= 150; i++) {
      const a = (i / 150) * 6.283;
      const R = base * (0.72 + 0.28 * Math.sin(a * n));
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.9]);
    }
  }
  return pts;
}

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
    const pts = squigglePoints(r);
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

WHO.push(...moreDice.who, ...moreDice2.who);
DOES.push(...moreDice.does, ...moreDice2.does);
WHERE.push(...moreDice.where, ...moreDice2.where);

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
  const L = pick(ALL_LESSONS.filter(l => l.mirror));
  const stageEl = h('div', { class: 'stage-host' });
  const p = new Painter(stageEl, { w: 1200, h: 900, layers: 1, brush: 'pencil', color: '#2a2140' });
  p.size = 9;
  let closed = false;
  const guide = svgEl('svg', { viewBox: '0 0 1000 750', class: 'guide' });
  // Sometimes the left half is missing, which is harder for a right-hander.
  const side = Math.random() < 0.5 ? 'R' : 'L';
  const sideName = side === 'R' ? 'правую' : 'левую';
  const defs = svgEl('clipPath', { id: 'leftHalf' });
  defs.append(svgEl('rect', { x: side === 'R' ? 0 : 500, y: 0, width: 500, height: 750 }));
  guide.append(defs);
  const g = svgEl('g', { 'clip-path': 'url(#leftHalf)' });
  allPaths(L).forEach(d => g.append(svgEl('path', { d, class: 'g-solid' })));
  guide.append(g, svgEl('line', { x1: 500, y1: 0, x2: 500, y2: 750, class: 'g-axis' }));
  p.under.append(guide);

  const done = btn('primary', 'Проверить', async () => {
    const ink = inkPoints(p.log, 0, 1.2);
    if (!ink.length) { toast(`Дорисуй ${sideName} сторону!`); return; }
    const right = allPaths(L).flatMap(d => samplePath(d, 10)).filter(([x]) => (side === 'R' ? x > 503 : x < 497));
    const stars = starsFor(matchScore(right, ink, { tol: 42 }));
    const res = award(`half:${L.id}`, stars);
    defs.firstChild.setAttribute('x', 0);
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
  drawLayout(root, `Дорисуй ${sideName} половину`, [iconBtn('undo', 'Отменить', () => p.undo()), done], stageEl,
    h('footer', { class: 'tools-foot' }, speaker('Смотри на готовую сторону: каждая точка отражается на том же расстоянии от линии.')));
  p.fit();
  let cleanup = () => p.destroy();
  return () => { closed = true; cleanup(); };
}

const RYB = [
  [1, 1, 1], [0.92, 0.13, 0.14], [1, 0.85, 0.12], [1, 0.5, 0.05],
  [0.16, 0.38, 0.78], [0.5, 0.1, 0.55], [0.1, 0.66, 0.25], [0.23, 0.13, 0.08],
];

export function mixPaint({ r = 0, y = 0, b = 0, w = 0, k = 0 }) {
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

export const LAB = [
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

LAB.push(...moreLab, ...moreLab2);

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


function pixels(root, tpl) {
  if (!tpl) return pixelsMenu(root);
  const T = PIX.find(x => x.id === tpl);
  if (!T && tpl !== 'free') { location.hash = '#/game/pixels'; return undefined; }
  if (T) sessionStorage.setItem('pixPack', packOf(T.id).id);
  const N = T ? T.a.length : 24;
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
    const z = 240 / N;
    T.a.forEach((row, yy) => [...row].forEach((c, xx) => {
      if (PIX_KEY[c]) { x.fillStyle = PIX_KEY[c]; x.fillRect(xx * z, yy * z, z, z); }
    }));
    x.strokeStyle = '#e5ddd0';
    x.lineWidth = 1;
    x.beginPath();
    for (let i = 0; i <= N; i++) { x.moveTo(i * z, 0); x.lineTo(i * z, 240); x.moveTo(0, i * z); x.lineTo(240, i * z); }
    x.stroke();
  }

  const done = btn('primary', 'Готово', async () => {
    if (!grid.some(Boolean)) { toast('Сначала закрась клеточки!'); return; }
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
      // Only cells that are painted in the sample or by her count, so empty
      // background cannot earn stars. White equals empty: the board is white.
      let right = 0, all = 0;
      T.a.forEach((row, yy) => [...row].forEach((c, xx) => {
        const want = PIX_KEY[c] || '#ffffff';
        const got = grid[xx + yy * N] || '#ffffff';
        if (want === '#ffffff' && got === '#ffffff') return;
        all++;
        if (want === got) right++;
      }));
      const k = all ? right / all : 0;
      stars = k >= 0.94 ? 3 : k >= 0.75 ? 2 : 1;
      res = award(`pix:${T.id}`, stars);
    } else res = awardOnce('pixels');
    celebrate({
      title: 'Пиксель к пикселю!', text: 'Картинка в галерее.', stars: T ? stars : null, unlocked: res.unlocked,
      actions: [
        { label: 'К картинкам', primary: !next, fn: () => { location.hash = '#/game/pixels'; } },
        next && { label: `Дальше: ${next.name}`, primary: true, fn: () => { location.hash = `#/game/pixels/${next.id}`; } },
      ].filter(Boolean),
    });
  });

  // The next picture of the same set she has not finished yet.
  let next = null;
  if (T) {
    const list = packOf(T.id).list;
    const at = list.indexOf(T);
    const rest = [...list.slice(at + 1), ...list.slice(0, at)];
    next = rest.find(t => !state.best[`pix:${t.id}`]) || null;
  }

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
  const grid = h('div', { class: 'games-grid' });
  const tabs = h('div', { class: 'tabs small pix-tabs' });
  const sizes = h('div', { class: 'tabs pix-sizes' });
  const packs = PIX_PACKS.filter(p => p.list.length);
  const doneIn = p => p.list.filter(t => state.best[`pix:${t.id}`]).length;
  const show = id => {
    const pack = packs.find(p => p.id === id) || packs[0];
    sessionStorage.setItem('pixPack', pack.id);
    [...sizes.children].forEach(c => c.classList.toggle('on', (c.dataset.big === '1') === !!pack.big));
    tabs.textContent = '';
    for (const p of packs.filter(q => !!q.big === !!pack.big)) {
      const n = doneIn(p);
      tabs.append(h('button', {
        class: `tab ${p === pack ? 'on' : ''}`, 'data-k': p.id,
        onclick: () => { sfx.pop(); show(p.id); },
      }, p.name, h('i', { class: `pix-count ${n === p.list.length ? 'full' : ''}` }, n === p.list.length ? '✓' : `${n}/${p.list.length}`)));
    }
    grid.textContent = '';
    grid.append(
      h('a', { class: 'game-card', style: { '--c': '#ffc83d' }, href: '#/game/pixels/free' }, h('b', {}, 'Свободный режим'), h('small', {}, 'Большое поле 24×24')),
      ...pack.list.map(t => {
        const n = t.a.length;
        const c = canvas(n * 8, n * 8);
        const x = c.getContext('2d');
        t.a.forEach((row, yy) => [...row].forEach((ch, xx) => { if (PIX_KEY[ch]) { x.fillStyle = PIX_KEY[ch]; x.fillRect(xx * 8, yy * 8, 8, 8); } }));
        return h('a', { class: 'game-card pix-card', style: { '--c': '#fff' }, href: `#/game/pixels/${t.id}` }, c, h('b', {}, t.name), h('small', {}, '★'.repeat(state.best[`pix:${t.id}`] || 0) || 'Повтори по образцу'));
      }),
    );
  };
  if (packs.some(p => p.big)) {
    for (const [big, name] of [[false, 'Обычные 12×12'], [true, 'Сложные 16×16']]) {
      sizes.append(h('button', {
        class: 'tab', 'data-big': big ? '1' : '0',
        onclick: () => { sfx.pop(); show(packs.find(p => !!p.big === big).id); },
      }, name));
    }
  }
  root.append(h('div', { class: 'screen scroll hub' },
    topbar('Пиксели', { back: '#/games', right: [starBadge()] }),
    sizes.children.length ? sizes : null,
    tabs,
    grid,
  ));
  show(sessionStorage.getItem('pixPack'));
}

function guess(root) {
  const pool = ALL_LESSONS.filter(l => !l.noCopy && l.guess !== false);
  const rounds = shuffle(pool).slice(0, 12);
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
    // The second half of the game is harder: six answers and a faster hand.
    const hard = n >= 6;
    opts.style.gridTemplateColumns = `repeat(${hard ? 3 : 4}, minmax(150px, 1fr))`;
    const others = shuffle(pool.filter(x => x !== L)).slice(0, hard ? 5 : 3);
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
      await sleep(hard ? 750 : 1000);
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

export function gameRoute(root, id, arg, ...rest) {
  const extra = PLAY.find(x => x.id === id);
  if (extra) return extra.load().then(m => m.default(root, arg, ...rest));
  if (id === 'squiggle') return squiggle(root);
  if (id === 'dice') return dice(root);
  if (id === 'half') return half(root);
  if (id === 'lab') return lab(root);
  if (id === 'pixels') return pixels(root, arg);
  if (id === 'guess') return guess(root);
  location.hash = '#/games';
  return undefined;
}
