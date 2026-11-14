// Small DOM and maths helpers shared by every screen.
export const $ = (s, r = document) => r.querySelector(s);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const shuffle = a => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    // setProperty, since Object.assign skips custom properties such as '--c'.
    else if (k === 'style' && typeof v === 'object') for (const [p, x] of Object.entries(v)) el.style.setProperty(p.startsWith('--') ? p : p.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`), x);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter(x => x != null && x !== false));
  return el;
}

export function canvas(w, h2) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h2);
  return c;
}

const NS = 'http://www.w3.org/2000/svg';
export const svgEl = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

let sink;
function pathEl(d) {
  if (!sink) {
    sink = svgEl('svg', { width: 0, height: 0, style: 'position:absolute;visibility:hidden' });
    document.body.append(sink);
  }
  const p = svgEl('path', { d });
  sink.append(p);
  return p;
}

// Evenly spaced points along an SVG path.
export function samplePath(d, step = 10) {
  const p = pathEl(d);
  const len = p.getTotalLength();
  const out = [];
  for (let l = 0; l <= len; l += step) {
    const q = p.getPointAtLength(l);
    out.push([q.x, q.y]);
  }
  p.remove();
  return out;
}

export function pathLength(d) {
  const p = pathEl(d);
  const l = p.getTotalLength();
  p.remove();
  return l;
}

// An inline picture built from a list of path strings.
export function outlineSvg(paths, { w = 1000, h: ht = 750, cls = 'art', sw = 9 } = {}) {
  const s = svgEl('svg', { viewBox: `0 0 ${w} ${ht}`, class: cls });
  for (const d of paths) {
    s.append(svgEl('path', { d, fill: 'none', 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  }
  return s;
}

export const blobOf = (c, type = 'image/png', q = 0.92) =>
  new Promise(r => c.toBlob(r, type, q));

export function loadImg(src) {
  return new Promise((res, rej) => {
    const url = src instanceof Blob ? URL.createObjectURL(src) : src;
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbHex = (r, g, b) =>
  '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

export function shade(hex, amt) {
  const [r, g, b] = hexRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const a = Math.abs(amt);
  return rgbHex(lerp(r, t, a), lerp(g, t, a), lerp(b, t, a));
}

// How close the child's strokes are to a guide. Returns 0..1.
export function matchScore(guide, ink, { tol = 26, normalize = false } = {}) {
  if (!ink.length || !guide.length) return 0;
  let g = guide;
  let n = ink;
  if (normalize) {
    g = fitBox(guide);
    n = fitBox(ink);
  }
  const near = (a, b) => {
    const cell = tol;
    const grid = new Set();
    for (const [x, y] of b) {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) grid.add(`${cx + i},${cy + j}`);
    }
    let hit = 0;
    for (const [x, y] of a) if (grid.has(`${Math.floor(x / cell)},${Math.floor(y / cell)}`)) hit++;
    return hit / a.length;
  };
  return clamp(0.7 * near(g, n) + 0.3 * near(n, g), 0, 1);
}

function fitBox(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const s = 800 / Math.max(x1 - x0, y1 - y0, 1);
  return pts.map(([x, y]) => [(x - x0) * s, (y - y0) * s]);
}

export const starsFor = s => (s >= 0.72 ? 3 : s >= 0.45 ? 2 : 1);

// Collect stroke points from a painter log, converted to guide space.
export function inkPoints(log, from, scale) {
  const out = [];
  for (let i = from; i < log.length; i++) {
    const e = log[i];
    if (e.t !== 's' || e.b === 'eraser') continue;
    for (let j = 0; j < e.pts.length; j += 3) out.push([e.pts[j] / scale, e.pts[j + 1] / scale]);
  }
  return out;
}
