// Coloring pages, paint-by-number, mandalas and photo-to-coloring.
import { h, canvas, shade, blobOf, loadImg, hexRgb, clamp, mulberry } from './util.js';
import { mandala } from './art.js';
import { PAGES } from './pages.js';
import { Painter } from './painter.js';
import { db, state, award, awardOnce, newId } from './store.js';
import { topbar, btn, iconBtn, starBadge, brushRail, paletteBar, sizeSlider, celebrate, toast, mascot, autosaver, safeSave } from './ui.js';
import { sfx } from './audio.js';

const W = 1200, H = 900;
const INK = '#2a2140';

export function drawPage(ctx, page, colored, lw = 5.5) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = lw;
  for (const [d, f] of page.shapes) {
    const p = new Path2D(d);
    if (f) { ctx.fillStyle = colored ? f : '#fff'; ctx.fill(p); }
    ctx.stroke(p);
  }
}

function thumbOf(page, colored) {
  const c = canvas(360, 270);
  const x = c.getContext('2d');
  x.scale(0.3, 0.3);
  x.fillStyle = '#fff';
  x.fillRect(0, 0, W, H);
  drawPage(x, page, colored, 8);
  return c;
}

// Finds every closed area of the picture, so taps and magic strokes know their region.
export function analyze(page) {
  const lineC = canvas(W, H);
  const lx = lineC.getContext('2d', { willReadFrequently: true });
  if (page.lineCanvas) {
    lx.drawImage(page.lineCanvas, 0, 0);
  } else {
    lx.fillStyle = '#fff';
    lx.fillRect(0, 0, W, H);
    drawPage(lx, page, false);
  }
  const img = lx.getImageData(0, 0, W, H);
  const d = img.data;
  const N = W * H;
  const lab = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    const v = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
    lab[i] = v < 150 ? -1 : 0;
    d[i * 4 + 3] = clamp((255 - v) * 1.35, 0, 255);
    d[i * 4] = 42; d[i * 4 + 1] = 33; d[i * 4 + 2] = 64;
  }
  lx.putImageData(img, 0, 0);

  const regions = [null];
  const stack = [];
  for (let s = 0; s < N; s++) {
    if (lab[s] !== 0) continue;
    const id = regions.length;
    const r = { id, n: 0, x0: W, y0: H, x1: 0, y1: 0, best: 0, px: 0, py: 0 };
    lab[s] = id;
    stack.push(s);
    while (stack.length) {
      const q = stack.pop();
      const x = q % W, y = (q - x) / W;
      r.n++;
      if (x < r.x0) r.x0 = x;
      if (x > r.x1) r.x1 = x;
      if (y < r.y0) r.y0 = y;
      if (y > r.y1) r.y1 = y;
      if (x > 0 && lab[q - 1] === 0) { lab[q - 1] = id; stack.push(q - 1); }
      if (x < W - 1 && lab[q + 1] === 0) { lab[q + 1] = id; stack.push(q + 1); }
      if (y > 0 && lab[q - W] === 0) { lab[q - W] = id; stack.push(q - W); }
      if (y < H - 1 && lab[q + W] === 0) { lab[q + W] = id; stack.push(q + W); }
    }
    regions.push(r);
  }

  // Distance to the nearest line: the farthest point is where a number fits best.
  const dist = new Int16Array(N);
  for (let i = 0; i < N; i++) dist[i] = lab[i] < 0 ? 0 : 3000;
  for (let i = 0; i < N; i++) {
    if (i % W > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1);
    if (i >= W) dist[i] = Math.min(dist[i], dist[i - W] + 1);
  }
  for (let i = N - 1; i >= 0; i--) {
    if (i % W < W - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
    if (i < N - W) dist[i] = Math.min(dist[i], dist[i + W] + 1);
    const l = lab[i];
    if (l <= 0) continue;
    // The sheet's edge counts as a line too, so a number never sits half off the page.
    const x = i % W, y = (i - x) / W;
    const room = Math.min(dist[i], x + 1, W - x, y + 1, H - y);
    if (room > regions[l].best) {
      regions[l].best = room;
      regions[l].px = x;
      regions[l].py = y;
    }
  }

  if (!page.lineCanvas) {
    const cc = canvas(W, H);
    const cx = cc.getContext('2d', { willReadFrequently: true });
    drawPage(cx, page, true);
    const px = cx.getImageData(0, 0, W, H).data;
    const fills = [...new Set(page.shapes.map(s => s[1]).filter(Boolean))].map(c => [c, hexRgb(c)]);
    for (const r of regions) {
      if (!r) continue;
      const i = (r.px + r.py * W) * 4;
      let best = fills[0], bd = 1e9;
      for (const f of fills) {
        const dd = Math.abs(f[1][0] - px[i]) + Math.abs(f[1][1] - px[i + 1]) + Math.abs(f[1][2] - px[i + 2]);
        if (dd < bd) { bd = dd; best = f; }
      }
      r.target = best[0];
    }
  }

  // Grow each region under the ink so colour tucks neatly beneath the lines.
  for (let pass = 0; pass < 5; pass++) {
    const prev = lab.slice();
    for (let i = 0; i < N; i++) {
      if (prev[i] !== -1) continue;
      const x = i % W;
      const n = (x > 0 && prev[i - 1] > 0 && prev[i - 1])
        || (x < W - 1 && prev[i + 1] > 0 && prev[i + 1])
        || (i >= W && prev[i - W] > 0 && prev[i - W])
        || (i < N - W && prev[i + W] > 0 && prev[i + W]);
      if (n) lab[i] = n;
    }
  }
  for (const r of regions) {
    if (!r) continue;
    r.x0 = Math.max(0, r.x0 - 6); r.y0 = Math.max(0, r.y0 - 6);
    r.x1 = Math.min(W - 1, r.x1 + 6); r.y1 = Math.min(H - 1, r.y1 + 6);
  }
  return { lab, regions, lineC };
}

function maskFor(an, id) {
  const r = an.regions[id];
  const w = r.x1 - r.x0 + 1, ht = r.y1 - r.y0 + 1;
  const c = canvas(w, ht);
  const x = c.getContext('2d');
  const img = x.createImageData(w, ht);
  for (let yy = 0; yy < ht; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (an.lab[r.x0 + xx + (r.y0 + yy) * W] === id) img.data[(xx + yy * w) * 4 + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

function tile(kind, color) {
  const c = canvas(56, 56);
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.fillRect(0, 0, 56, 56);
  x.fillStyle = shade(color, 0.6);
  if (kind === 'stripes') {
    x.fillRect(0, 0, 56, 28);
  }
  if (kind === 'dots') {
    for (const [a, b] of [[14, 14], [42, 42]]) { x.beginPath(); x.arc(a, b, 9, 0, 6.3); x.fill(); }
  }
  if (kind === 'hearts') {
    x.font = '24px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('♥', 14, 14); x.fillText('♥', 42, 42);
  }
  if (kind === 'stars') {
    x.font = '24px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('★', 14, 14); x.fillText('★', 42, 42);
  }
  return c;
}

function sourceFor(ctx, kind, color, r) {
  if (kind === 'grad') {
    const g = ctx.createLinearGradient(0, r.y0, 0, r.y1);
    g.addColorStop(0, shade(color, 0.55));
    g.addColorStop(1, color);
    return g;
  }
  if (kind !== 'solid') return ctx.createPattern(tile(kind, color), 'repeat');
  return color;
}

const pageCache = new Map();

async function getPage(id) {
  if (id.startsWith('mandala')) return mandala(+id.slice(7));
  if (id.startsWith('photo_')) {
    const rec = await db.get('kv', id);
    if (!rec) return null;
    const img = await loadImg(rec.lines);
    const c = canvas(W, H);
    c.getContext('2d').drawImage(img, 0, 0);
    return { id, title: 'Моё фото', lineCanvas: c, photo: true };
  }
  return PAGES.find(p => p.id === id);
}

function boxBlur(src, r) {
  const out = new Float32Array(src.length);
  const tmp = new Float32Array(src.length);
  const run = (from, to, step, lines, lineStep, len) => {
    for (let l = 0; l < lines; l++) {
      const o = l * lineStep;
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += from[o + clamp(i, 0, len - 1) * step];
      for (let i = 0; i < len; i++) {
        to[o + i * step] = sum / (2 * r + 1);
        sum += from[o + clamp(i + r + 1, 0, len - 1) * step] - from[o + clamp(i - r, 0, len - 1) * step];
      }
    }
  };
  run(src, tmp, 1, H, W, W);
  run(tmp, out, W, W, 1, H);
  return out;
}

// Turns a photo into line art with a difference of two blurs.
function photoToLines(img) {
  const c = canvas(W, H);
  const x = c.getContext('2d', { willReadFrequently: true });
  const s = Math.max(W / img.width, H / img.height);
  x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
  const data = x.getImageData(0, 0, W, H);
  const g = new Float32Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = data.data[i * 4] * 0.3 + data.data[i * 4 + 1] * 0.59 + data.data[i * 4 + 2] * 0.11;
  const a = boxBlur(g, 2);
  const b = boxBlur(g, 7);
  for (let i = 0; i < g.length; i++) {
    const v = clamp(255 + (a[i] - b[i] + 5) * 26, 0, 255);
    data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = v;
    data.data[i * 4 + 3] = 255;
  }
  x.putImageData(data, 0, 0);
  return c;
}

export function coloringHub(root, tabName = 'pages') {
  const grid = h('div', { class: 'pages-grid' });
  const tabs = [['pages', 'Раскраски'], ['num', 'По номерам'], ['math', 'По примерам'], ['mandala', 'Мандалы'], ['photo', 'Из фото']];
  const tabBar = h('div', { class: 'tabs' }, tabs.map(([k, v]) => h('a', { class: `tab ${k === tabName ? 'on' : ''}`, href: `#/coloring/${k}` }, v)));

  const card = (page, mode) => h('a', { class: 'page-card', href: `#/color/${page.id}/${mode}` },
    thumbOf(page, mode !== 'free'),
    h('b', {}, page.title),
    state.best[`col:${page.id}:${mode}`] && h('em', { class: 'done-mark' }, '✓'),
  );

  if (tabName === 'pages') grid.append(...PAGES.map(p => card(p, 'free')));
  if (tabName === 'num') grid.append(...PAGES.map(p => card(p, 'num')));
  if (tabName === 'math') grid.append(...PAGES.map(p => card(p, 'math')));
  if (tabName === 'mandala') {
    let seed = Number(sessionStorage.getItem('mandalaSeed') || 1);
    const fill = () => {
      grid.textContent = '';
      for (let i = 0; i < 12; i++) grid.append(card(mandala(seed + i), 'free'));
      grid.append(h('button', {
        class: 'page-card more',
        onclick: () => { seed += 12; sessionStorage.setItem('mandalaSeed', seed); fill(); },
      }, mascot('wow'), h('b', {}, 'Ещё мандалы!')));
    };
    fill();
  }
  if (tabName === 'photo') {
    const input = h('input', { type: 'file', accept: 'image/*', class: 'hidden' });
    input.addEventListener('change', async () => {
      const f = input.files[0];
      if (!f) return;
      toast('Превращаю фото в раскраску…');
      const img = await loadImg(f);
      const lines = photoToLines(img);
      const id = newId('photo');
      await db.put('kv', { id, lines: await blobOf(lines) });
      location.hash = `#/color/${id}/free`;
    });
    grid.append(h('label', { class: 'page-card more photo-card' }, input, mascot('joy'), h('b', {}, 'Выбрать фото или снять новое'),
      h('small', {}, 'Кот, мама, любимая игрушка: что угодно станет раскраской')));
    db.all('kv').then(list => {
      for (const r of list.filter(x => x.id.startsWith('photo_')).reverse()) {
        const c = h('a', { class: 'page-card', href: `#/color/${r.id}/free` }, h('img', { src: URL.createObjectURL(r.lines) }), h('b', {}, 'Моё фото'));
        grid.append(c);
      }
    });
  }

  root.append(h('div', { class: 'screen scroll hub' },
    topbar('Раскраски', { right: [starBadge()] }),
    tabBar, grid,
  ));
}

export async function coloringPlay(root, id, mode = 'free') {
  const page = await getPage(id);
  if (!page) { location.hash = '#/coloring'; return () => {}; }
  let an = pageCache.get(id);
  if (!an) {
    an = analyze(page);
    if (pageCache.size > 6) pageCache.clear();
    pageCache.set(id, an);
  }
  if (mode === 'num' || mode === 'math') return playNumbers(root, page, an, mode === 'math');
  return playFree(root, page, an);
}

function makeStage(an, opts) {
  const stageEl = h('div', { class: 'stage-host' });
  const p = new Painter(stageEl, { w: W, h: H, layers: 1, overlayCanvas: an.lineC, ...opts });
  an.lineC.className = 'layer line-art';
  p.over.append(an.lineC);
  return { stageEl, p };
}

function regionAt(an, x, y) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return 0;
  const id = an.lab[x + y * W];
  return id > 0 ? id : 0;
}

function spreadFill(p, an, id, x, y, src) {
  p.pendingFill?.();
  const r = an.regions[id];
  const w = r.x1 - r.x0 + 1, ht = r.y1 - r.y0 + 1;
  const t = canvas(w, ht);
  const c = t.getContext('2d');
  c.translate(-r.x0, -r.y0);
  c.fillStyle = src(c, r);
  c.fillRect(r.x0, r.y0, w, ht);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(maskFor(an, id), 0, 0);
  p.edit(0, r.x0, r.y0, w, ht, () => {});
  const L = p.layers[0].ctx;
  const reach = Math.hypot(Math.max(x - r.x0, r.x1 - x), Math.max(y - r.y0, r.y1 - y));
  const t0 = performance.now();
  const dur = clamp(reach * 1.1, 160, 420);
  let raf = 0;
  // Undo and saving can arrive mid-animation: this lands the fill at once.
  const finish = () => {
    cancelAnimationFrame(raf);
    L.drawImage(t, r.x0, r.y0);
    p.pendingFill = null;
  };
  const step = now => {
    const k = clamp((now - t0) / dur, 0, 1);
    if (k >= 1) { finish(); return; }
    L.save();
    L.beginPath();
    L.arc(x, y, reach * (1 - Math.pow(1 - k, 2.4)) + 2, 0, 6.3);
    L.clip();
    L.drawImage(t, r.x0, r.y0);
    L.restore();
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  p.pendingFill = finish;
}

function playFree(root, page, an) {
  let fillKind = 'solid';
  const clipC = canvas(W, H);
  const clipX = clipC.getContext('2d');
  const { stageEl, p } = makeStage(an, {
    brush: 'marker', color: '#ff6b5e',
    onTap: (x, y) => {
      const id = regionAt(an, x, y);
      if (!id) return;
      sfx.fill();
      spreadFill(p, an, id, x, y, (c, r) => sourceFor(c, fillKind, p.color, r));
      sync();
    },
    beforeStroke: (x, y) => {
      if (!magic || p.brushId === 'eraser') { p.clip = null; return; }
      const id = regionAt(an, x, y);
      if (!id) { p.clip = null; return; }
      const r = an.regions[id];
      clipX.clearRect(0, 0, W, H);
      clipX.drawImage(maskFor(an, id), r.x0, r.y0);
      p.clip = clipC;
    },
    onChange: () => sync(),
  });
  p.mode = 'tap';
  p.size = 26;
  let magic = true;

  const undoBtn = iconBtn('undo', 'Отменить', () => { p.undo(); sync(); });
  const redoBtn = iconBtn('redo', 'Вернуть', () => { p.redo(); sync(); });
  const fillBtn = btn('tool', 'Заливка', () => { p.mode = 'tap'; sync(); });
  const magicBtn = btn('tool', 'Не вылезать', () => { magic = !magic; sync(); });
  const kinds = [['solid', 'Цвет'], ['grad', 'Градиент'], ['stripes', 'Полоски'], ['dots', 'Горох'], ['hearts', 'Сердца'], ['stars', 'Звёзды']];
  const kindRow = h('div', { class: 'tabs small kinds' }, kinds.map(([k, v]) => h('button', {
    class: `tab ${k === fillKind ? 'on' : ''}`,
    onclick: e => {
      fillKind = k;
      p.mode = 'tap';
      [...kindRow.children].forEach(c => c.classList.toggle('on', c === e.currentTarget));
      sync();
    },
  }, v)));

  const rail = brushRail(p, ['marker', 'pencil', 'crayon', 'watercolor', 'chalk', 'spray', 'glitter', 'rainbow', 'eraser'], { onPick: () => sync() });
  const size = sizeSlider(p);
  const pal = paletteBar(p, { onPick: () => { rail.redraw(); sync(); } });

  function sync() {
    undoBtn.disabled = !p.undoStack.length;
    redoBtn.disabled = !p.redoStack.length;
    fillBtn.classList.toggle('on', p.mode === 'tap');
    magicBtn.classList.toggle('on', magic);
    rail.mark();
    size.sync();
  }

  const kvId = `col_${page.id}`;
  // Each new coloring of a page gets its own place in the gallery.
  let artId = newId('art');
  db.get('kv', kvId).then(async r => {
    if (!r?.layer || r.finished) return;
    artId = r.artId || artId;
    const img = await loadImg(r.layer);
    p.layers[0].ctx.drawImage(img, 0, 0);
    p.dirty = false;
  });

  async function persist() {
    p.pendingFill?.();
    p.dirty = false;
    try {
      await db.put('kv', { id: kvId, layer: await blobOf(p.layers[0].c), artId });
    } catch (e) {
      p.dirty = true;
      throw e;
    }
  }
  const saver = autosaver(() => p.dirty, persist, () => p.isBusy());

  const done = btn('primary', 'Готово', async () => {
    try {
      await safeSave(async () => {
        await saver.flush();
        await db.put('art', {
          id: artId, kind: 'coloring', title: page.title, created: Date.now(), updated: Date.now(),
          thumb: await blobOf(p.thumb()), full: await blobOf(p.flatten()),
        });
        await db.put('kv', { id: kvId, artId, finished: true });
      });
    } catch { return; }
    const r = award(`col:${page.id}:free`, 1);
    const day = r.gain ? r : awardOnce('color');
    celebrate({
      title: 'Какая раскраска!',
      text: 'Сохранена в галерее.',
      unlocked: day.unlocked,
      actions: [
        { label: 'Ещё покрашу' },
        { label: 'Другие раскраски', primary: true, fn: () => { location.hash = '#/coloring'; } },
      ],
    });
  });

  root.append(h('div', { class: 'screen studio' },
    topbar(page.title, { back: page.mandala ? '#/coloring/mandala' : page.photo ? '#/coloring/photo' : '#/coloring', right: [undoBtn, redoBtn, magicBtn, done] }),
    h('div', { class: 'studio-main' }, rail, stageEl),
    h('footer', { class: 'tools-foot col' },
      h('div', { class: 'row-tools' }, fillBtn, kindRow, size),
      pal),
  ));
  p.fit();
  sync();

  return () => {
    saver.stop();
    safeSave(saver.flush).catch(() => {}).finally(() => p.destroy());
  };
}

// A sum, difference, product or quotient whose answer is n.
function exprFor(n, rnd) {
  const kinds = [];
  if (n >= 2) kinds.push(() => { const a = 1 + Math.floor(rnd() * (n - 1)); return `${a}+${n - a}`; });
  kinds.push(() => { const b = 1 + Math.floor(rnd() * 9); return `${n + b}−${b}`; });
  const pairs = [];
  for (let a = 2; a * a <= n; a++) if (n % a === 0) pairs.push([a, n / a]);
  if (pairs.length) kinds.push(() => { const [a, b] = pairs[Math.floor(rnd() * pairs.length)]; return rnd() < 0.5 ? `${a}×${b}` : `${b}×${a}`; });
  kinds.push(() => { const d = 2 + Math.floor(rnd() * 4); return `${n * d}:${d}`; });
  return kinds[Math.floor(rnd() * kinds.length)]();
}

function playNumbers(root, page, an, math = false) {
  const { stageEl, p } = makeStage(an, {
    onTap: (x, y) => {
      const id = regionAt(an, x, y);
      if (!id) return;
      const r = an.regions[id];
      if (!r.num || filled.has(id)) return;
      if (r.num - 1 !== cur) {
        sfx.soft();
        toast(math ? 'Посчитай ещё раз!' : `Здесь номер ${r.num}`);
        return;
      }
      fillNum(id, x, y, true);
    },
  });
  p.mode = 'tap';
  // There is no undo here: a two-finger tap must not erase a finished area.
  p.noHistory = true;

  const palette = [...new Set(an.regions.filter(r => r && r.n > 90).map(r => r.target))];
  const regions = an.regions.filter(r => r && r.n > 90 && r.best >= 5);
  regions.forEach(r => { r.num = palette.indexOf(r.target) + 1; });
  const filled = new Set();
  let cur = 0;
  // In the arithmetic mode every area shows a small sum instead of its number.
  const labels = new Map();
  if (math) {
    const rnd = mulberry([...page.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7));
    for (const r of regions) labels.set(r.id, r.best >= 13 ? exprFor(r.num, rnd) : String(r.num));
  }

  const hi = canvas(W, H);
  hi.className = 'layer hi';
  const num = canvas(W, H);
  num.className = 'layer';
  p.over.insertBefore(hi, an.lineC);
  p.over.append(num);

  // Tiny slivers are painted for her so she only has to deal with real shapes.
  const L = p.layers[0].ctx;
  for (const r of an.regions) {
    if (!r || r.num) continue;
    if (r.target) L.fillStyle = r.target;
    if (r.target) L.drawImage(tinted(r), r.x0, r.y0);
  }
  function tinted(r) {
    const m = maskFor(an, r.id);
    const x = m.getContext('2d');
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = r.target;
    x.fillRect(0, 0, m.width, m.height);
    return m;
  }

  const paletteEl = h('div', { class: 'num-palette' });
  const chips = palette.map((c, i) => {
    const dark = hexRgb(c).reduce((a, b) => a + b) < 330;
    const chip = h('button', {
      class: 'num-chip', style: { background: c, color: dark ? '#fff' : INK },
      onclick: () => { sfx.drop(); select(i); },
    }, h('b', {}, String(i + 1)));
    paletteEl.append(chip);
    return chip;
  });

  function drawNums() {
    const x = num.getContext('2d');
    x.clearRect(0, 0, W, H);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = INK;
    for (const r of regions) {
      if (filled.has(r.id)) continue;
      const text = labels.get(r.id) || String(r.num);
      const fs = text.length > 2 ? clamp(r.best * (text.length > 4 ? 0.52 : 0.62), 11, 30) : clamp(r.best * 1.1, 13, 40);
      x.font = `800 ${fs}px ui-rounded, system-ui, sans-serif`;
      x.fillText(text, r.px, r.py);
    }
  }

  function drawHi() {
    const x = hi.getContext('2d');
    // With sums she has to find the right areas herself, so nothing is highlighted.
    if (math) { x.clearRect(0, 0, W, H); return; }
    const img = x.createImageData(W, H);
    const on = new Uint8Array(an.regions.length);
    for (const r of regions) if (r.num - 1 === cur && !filled.has(r.id)) on[r.id] = 1;
    for (let i = 0; i < W * H; i++) {
      const l = an.lab[i];
      if (l > 0 && on[l]) {
        img.data[i * 4] = 255; img.data[i * 4 + 1] = 214; img.data[i * 4 + 2] = 71; img.data[i * 4 + 3] = 120;
      }
    }
    x.putImageData(img, 0, 0);
  }

  function refreshChips() {
    chips.forEach((c, i) => {
      const left = regions.filter(r => r.num === i + 1 && !filled.has(r.id)).length;
      c.classList.toggle('on', i === cur);
      c.classList.toggle('complete', left === 0);
    });
  }

  function select(i) {
    cur = i;
    refreshChips();
    drawHi();
  }

  function fillNum(id, x, y, anim) {
    const r = an.regions[id];
    filled.add(id);
    if (anim) {
      sfx.fill();
      spreadFill(p, an, id, x, y, () => r.target);
      save();
    } else {
      L.drawImage(tinted(r), r.x0, r.y0);
    }
    drawNums();
    if (!anim) return;
    const left = regions.filter(q => q.num - 1 === cur && !filled.has(q.id)).length;
    if (left === 0) {
      const nextI = palette.findIndex((_, i) => regions.some(q => q.num === i + 1 && !filled.has(q.id)));
      if (nextI >= 0) select(nextI); else complete();
    } else {
      drawHi();
      refreshChips();
    }
  }

  const kv = `${math ? 'math' : 'num'}_${page.id}`;
  function save() { db.put('kv', { id: kv, filled: [...filled] }); }

  async function complete() {
    hi.getContext('2d').clearRect(0, 0, W, H);
    refreshChips();
    try {
      await safeSave(async () => {
        await db.put('art', {
          id: `art_${kv}`, kind: 'coloring', title: page.title, created: Date.now(), updated: Date.now(),
          thumb: await blobOf(p.thumb()), full: await blobOf(p.flatten()),
        });
      });
      // The finished picture lives in the gallery, so this page can be painted again.
      await db.del('kv', kv);
    } catch { return; }
    const res = award(`col:${page.id}:${math ? 'math' : 'num'}`, 3);
    celebrate({
      title: 'Картина готова!',
      text: 'Ты закрасила всё до последней клеточки.',
      stars: 3,
      unlocked: res.unlocked,
      actions: [{ label: 'Другие картины', primary: true, fn: () => { location.hash = `#/coloring/${math ? 'math' : 'num'}`; } }],
    });
  }

  root.append(h('div', { class: 'screen num' },
    topbar(page.title, { back: `#/coloring/${math ? 'math' : 'num'}` }),
    h('div', { class: 'num-main' }, stageEl),
    paletteEl,
  ));
  p.fit();

  db.get('kv', kv).then(r => {
    if (r?.filled) r.filled.forEach(id => { if (an.regions[id]?.num) fillNum(id, 0, 0, false); });
    const nextI = palette.findIndex((_, i) => regions.some(q => q.num === i + 1 && !filled.has(q.id)));
    drawNums();
    select(Math.max(0, nextI));
    // Fully painted but never stored, because the last save failed: finish it now.
    if (nextI < 0 && regions.length) complete();
  });

  return () => { an.regions.forEach(r => { if (r) delete r.num; }); p.destroy(); };
}
