// Detailed ornamental coloring pages: the fun is in the patterns.
// Every piece is cut by code so that neighbours meet exactly. All art is original.
import { O, R, starD, heartD, cloudD, bg } from '../art.js';

const n1 = v => +v.toFixed(1);
const rad = a => (a * Math.PI) / 180;
const pt = p => `${n1(p[0])} ${n1(p[1])}`;
const poly = pts => `M${pts.map(pt).join('L')}Z`;
const line = pts => `M${pts.map(pt).join('L')}`;

// ---------- Point kit: every outline is a list of points ----------
// Dense points along a smooth curve through the given points.
function spl(pts, closed = true, seg = 10) {
  const n = pts.length;
  const g = i => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out = [];
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
// Moves, scales, turns and mirrors points.
function mv(pts, x, y, s = 1, rot = 0, flip = 1) {
  const a = rad(rot), c = Math.cos(a), si = Math.sin(a);
  return pts.map(([u, v]) => [x + u * s * flip * c - v * s * si, y + u * s * flip * si + v * s * c]);
}
function ell(cx, cy, rx, ry = rx, rot = 0, n = 48) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * 6.28318; out.push([Math.cos(t) * rx, Math.sin(t) * ry]); }
  return mv(out, cx, cy, 1, rot);
}
function arc(cx, cy, r, a0, a1, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = rad(a0 + ((a1 - a0) * i) / n); out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
const rc = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// Keeps the part of an outline where f is not positive.
function cut(pts, f) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const a = f(p), b = f(q);
    if (a <= 0) out.push(p);
    if ((a <= 0) !== (b <= 0)) { const t = a / (a - b); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
// The part of an outline that lies inside a convex outline.
function inter(pts, convex) {
  const n = convex.length;
  const cx = convex.reduce((a, p) => a + p[0], 0) / n, cy = convex.reduce((a, p) => a + p[1], 0) / n;
  let out = pts;
  for (let i = 0; i < n && out.length > 2; i++) {
    const a = convex[i], b = convex[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const side = ex * (cy - a[1]) - ey * (cx - a[0]) > 0 ? -1 : 1;
    out = cut(out, p => side * (ex * (p[1] - a[1]) - ey * (p[0] - a[0])));
  }
  return out;
}
// Cuts an outline into bands across the direction `deg`, at the given distances from `o`.
function bands(pts, o, deg, cuts) {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
  const pos = p => (p[0] - o[0]) * c + (p[1] - o[1]) * s;
  const edges = [-1e6, ...cuts, 1e6];
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const part = cut(cut(pts, p => edges[i] - pos(p)), p => pos(p) - edges[i + 1]);
    out.push(part);
  }
  return out;
}
const fillAll = (parts, cols) => parts.filter(p => p.length > 2).map((p, i) => [poly(p), cols[i % cols.length]]);
// A teardrop leaf or feather: blunt at the start, pointed at the far end.
function leaf(x, y, len, w, deg, a = 0.75, b = 1.25, n = 16) {
  const k = 1 / (Math.pow(a / (a + b), a) * Math.pow(b / (a + b), b));
  const up = [], dn = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, v = w * k * Math.pow(t, a) * Math.pow(1 - t, b);
    up.push([len * t, -v]);
    if (i > 0 && i < n) dn.unshift([len * t, v]);
  }
  return mv([...up, ...dn], x, y, 1, deg);
}
// A band of the given half-width along a centre line; returns its two edges.
function edges(c, hw) {
  const L = [], Rr = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const w = typeof hw === 'function' ? hw(i / (c.length - 1)) : hw;
    L.push([c[i][0] - (dy / d) * w, c[i][1] + (dx / d) * w]);
    Rr.push([c[i][0] + (dy / d) * w, c[i][1] - (dx / d) * w]);
  }
  return [L, Rr];
}
const ribbon = (c, hw, i0 = 0, i1 = c.length - 1) => {
  const [L, Rr] = edges(c, hw);
  return [...L.slice(i0, i1 + 1), ...Rr.slice(i0, i1 + 1).reverse()];
};

// A small butterfly seen from above: four wings and an ink body.
function bfly(x, y, k, rot, c1, c2) {
  const q = pts => mv(pts, x, y, k, rot);
  return [
    [poly(q(ell(-30, -16, 31, 24, 28, 24))), c1], [poly(q(ell(30, -16, 31, 24, -28, 24))), c1],
    [poly(q(ell(-25, 25, 24, 20, -24, 24))), c2], [poly(q(ell(25, 25, 24, 20, 24, 24))), c2],
    [line(q([[0, -26], [0, 30]])), null], [line(q([[-16, -52], [0, -28], [16, -52]])), null],
  ];
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// The middle point of an outline.
function mid(pts) {
  let a = 0, x = 0, y = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], c = p[0] * q[1] - q[0] * p[1]; a += c; x += (p[0] + q[0]) * c; y += (p[1] + q[1]) * c; });
  return [x / (3 * a), y / (3 * a)];
}
// A convex outline moved inwards by d on every side, corner for corner.
function inset(pts, d) {
  const n = pts.length, c = mid(pts);
  const nrm = i => {
    const a = pts[i], b = pts[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey);
    const sg = ex * (c[1] - a[1]) - ey * (c[0] - a[0]) > 0 ? 1 : -1;
    return [(-ey / len) * sg, (ex / len) * sg];
  };
  return pts.map((p, i) => {
    const a = nrm((i + n - 1) % n), b = nrm(i), k = d / (1 + a[0] * b[0] + a[1] * b[1]);
    return [p[0] + (a[0] + b[0]) * k, p[1] + (a[1] + b[1]) * k];
  });
}

// ---------- 1. Patchwork quilt ----------
const Q = {
  floor: '#d9b48c', white: '#ffffff', cream: '#fff1cf', pink: '#ffa6c9', rose: '#ee5f85', peach: '#ffc48f',
  yellow: '#ffe066', mint: '#a9e8bf', green: '#55bf8b', sky: '#a9defc', blue: '#5a9fe6', lilac: '#cdb0f7',
  purple: '#8a66d1', cat: '#f6a445', catDark: '#d9742a',
};

function quilt() {
  const s = [bg(Q.floor)];
  const X0 = 100, Y0 = 96, PW = 250, PH = 236, BW = 44;
  const x1 = X0 + PW * 4, y1 = Y0 + PH * 3;
  // The lace frill around the edge.
  const fr = [];
  const side = (ax, ay, bx, by, nx, ny, n) => {
    const steps = n * 8;
    for (let i = 0; i < steps; i++) {
      const t = i / steps, d = 9 + 15 * Math.abs(Math.sin(Math.PI * n * t));
      fr.push([ax + (bx - ax) * t + nx * d, ay + (by - ay) * t + ny * d]);
    }
  };
  const ox0 = X0 - BW, oy0 = Y0 - BW, ox1 = x1 + BW, oy1 = y1 + BW;
  side(ox0, oy0, ox1, oy0, 0, -1, 16);
  side(ox1, oy0, ox1, oy1, 1, 0, 12);
  side(ox1, oy1, ox0, oy1, 0, 1, 16);
  side(ox0, oy1, ox0, oy0, -1, 0, 12);
  s.push([poly(fr), Q.white]);
  // The border band: pieces as long as the patches, and four corner squares.
  for (let i = 0; i < 4; i++) {
    s.push([R(X0 + PW * i, oy0, PW, BW), i % 2 ? Q.rose : Q.purple]);
    s.push([R(X0 + PW * i, y1, PW, BW), i % 2 ? Q.purple : Q.rose]);
  }
  for (let j = 0; j < 3; j++) {
    s.push([R(ox0, Y0 + PH * j, BW, PH), j % 2 ? Q.purple : Q.rose]);
    s.push([R(x1, Y0 + PH * j, BW, PH), j % 2 ? Q.rose : Q.purple]);
  }
  for (const [cx, cy] of [[ox0, oy0], [x1, oy0], [ox0, y1], [x1, y1]]) s.push([R(cx, cy, BW, BW), Q.yellow]);

  const P = (i, j) => [X0 + PW * i, Y0 + PH * j, PW, PH];
  const corner = (x, y, w, h, r, col) => {
    s.push([poly([[x, y], ...arc(x, y, r, 0, 90)]), col], [poly([[x + w, y], ...arc(x + w, y, r, 90, 180)]), col]);
    s.push([poly([[x + w, y + h], ...arc(x + w, y + h, r, 180, 270)]), col], [poly([[x, y + h], ...arc(x, y + h, r, 270, 360)]), col]);
  };
  const tri = (x, y, w, h, k, col) => {
    s.push([poly([[x, y], [x + k, y], [x, y + k]]), col], [poly([[x + w, y], [x + w - k, y], [x + w, y + k]]), col]);
    s.push([poly([[x + w, y + h], [x + w - k, y + h], [x + w, y + h - k]]), col], [poly([[x, y + h], [x + k, y + h], [x, y + h - k]]), col]);
  };

  // A. Slanted stripes.
  {
    const [x, y, w, h] = P(0, 0);
    const d = (w + h) / Math.SQRT2 / 6;
    s.push(...fillAll(bands(rc(x, y, w, h), [x, y], 45, [1, 2, 3, 4, 5].map(k => k * d)), [Q.blue, Q.yellow, Q.sky]));
  }
  // B. A heart in a heart.
  {
    const [x, y, w, h] = P(1, 0);
    s.push([R(x, y, w, h), Q.cream]);
    corner(x, y, w, h, 50, Q.mint);
    s.push([heartD(x + w / 2, y + h / 2 + 6, 88), Q.rose], [heartD(x + w / 2, y + h / 2 + 2, 50), Q.pink]);
  }
  // C. A pinwheel of eight triangles.
  {
    const [x, y, w, h] = P(2, 0);
    const c = [x + w / 2, y + h / 2];
    const ring = [[x, y], [x + w / 2, y], [x + w, y], [x + w, y + h / 2], [x + w, y + h], [x + w / 2, y + h], [x, y + h], [x, y + h / 2]];
    ring.forEach((p, i) => s.push([poly([c, p, ring[(i + 1) % 8]]), i % 2 ? Q.green : Q.yellow]));
  }
  // D. Big dots with a button middle.
  {
    const [x, y, w, h] = P(3, 0);
    s.push([R(x, y, w, h), Q.lilac]);
    for (const [u, v, col] of [[0.25, 0.26, Q.white], [0.75, 0.26, Q.pink], [0.5, 0.5, Q.white], [0.25, 0.74, Q.pink], [0.75, 0.74, Q.white]]) {
      s.push([O(x + w * u, y + h * v, 40), col], [O(x + w * u, y + h * v, 18), Q.purple]);
    }
  }
  // E. A flower with eight petals.
  {
    const [x, y, w, h] = P(0, 1);
    const cx = x + w / 2, cy = y + h / 2;
    s.push([R(x, y, w, h), Q.mint]);
    tri(x, y, w, h, 62, Q.green);
    for (let i = 0; i < 8; i++) s.push([poly(leaf(cx, cy, 104, 27, i * 45 + 22.5, 1, 0.8)), i % 2 ? Q.pink : Q.rose]);
    s.push([O(cx, cy, 30), Q.yellow]);
  }
  // F. A "log cabin": strips going round a middle.
  {
    const [x, y, w, h] = P(1, 1);
    const t = 31;
    const cols = [[Q.peach, Q.yellow], [Q.blue, Q.sky]];
    for (let k = 0; k < 2; k++) {
      const a = x + t * k, b = y + t * k, ww = w - 2 * t * k, hh = h - 2 * t * k;
      s.push([R(a, b, ww - t, t), cols[0][k]], [R(a + ww - t, b, t, hh - t), cols[1][k]]);
      s.push([R(a + t, b + hh - t, ww - t, t), cols[0][k]], [R(a, b + t, t, hh - t), cols[1][k]]);
    }
    s.push([R(x + 2 * t, y + 2 * t, w - 4 * t, h - 4 * t), Q.rose]);
    s.push([heartD(x + w / 2, y + h / 2 + 2, 38), Q.white]);
  }
  // G. The kitten's patch.
  {
    const [x, y, w, h] = P(2, 1);
    s.push([R(x, y, w, h), Q.sky]);
    corner(x, y, w, h, 50, Q.lilac);
  }
  // H. A star with eight points.
  {
    const [x, y, w, h] = P(3, 1);
    s.push([R(x, y, w, h), Q.purple]);
    tri(x, y, w, h, 58, Q.lilac);
    s.push([starD(x + w / 2, y + h / 2, 104, 52, 8), Q.yellow], [O(x + w / 2, y + h / 2, 34), Q.peach]);
  }
  // I. Waves.
  {
    const [x, y, w, h] = P(0, 2);
    const row = k => {
      const out = [];
      for (let i = 0; i <= 30; i++) out.push([x + (w * i) / 30, k === 0 || k === 5 ? y + (h * k) / 5 : y + (h * k) / 5 + 13 * Math.sin((i / 30) * 4 * Math.PI)]);
      return out;
    };
    const cols = [Q.blue, Q.white, Q.sky, Q.white, Q.blue];
    for (let k = 0; k < 5; k++) s.push([poly([...row(k), ...row(k + 1).reverse()]), cols[k]]);
  }
  // J. A diamond in a square, and a square in the diamond.
  {
    const [x, y, w, h] = P(1, 2);
    const cx = x + w / 2, cy = y + h / 2;
    s.push([R(x, y, w, h), Q.peach]);
    s.push([poly([[x, y], [cx, y], [x, cy]]), Q.rose], [poly([[x + w, y], [cx, y], [x + w, cy]]), Q.peach]);
    s.push([poly([[x + w, y + h], [cx, y + h], [x + w, cy]]), Q.rose], [poly([[x, y + h], [cx, y + h], [x, cy]]), Q.peach]);
    s.push([poly([[cx, y], [x + w, cy], [cx, y + h], [x, cy]]), Q.cream]);
    s.push([poly([[cx, y], [x + w * 0.75, y + h / 4], [x + w / 4, y + h / 4]]), Q.green], [poly([[cx, y + h], [x + w * 0.75, y + h * 0.75], [x + w / 4, y + h * 0.75]]), Q.green]);
    s.push([poly([[x, cy], [x + w / 4, y + h / 4], [x + w / 4, y + h * 0.75]]), Q.mint], [poly([[x + w, cy], [x + w * 0.75, y + h / 4], [x + w * 0.75, y + h * 0.75]]), Q.mint]);
    s.push([R(x + w / 4, y + h / 4, w / 2, h / 2), Q.yellow], [O(cx, cy, 34), Q.rose]);
  }
  // K. A fan.
  {
    const [x, y, w, h] = P(2, 2);
    const ox = x, oy = y + h;
    s.push([R(x, y, w, h), Q.cream]);
    const cols = [Q.pink, Q.lilac, Q.sky, Q.mint, Q.yellow];
    for (let i = 0; i < 5; i++) s.push([poly([...arc(ox, oy, 214, -90 + i * 18, -72 + i * 18, 6), ...arc(ox, oy, 70, -72 + i * 18, -90 + i * 18, 4)]), cols[i]]);
    s.push([poly([[ox, oy], ...arc(ox, oy, 70, -90, 0)]), Q.rose]);
  }
  // L. Zigzags.
  {
    const [x, y, w, h] = P(3, 2);
    const row = k => {
      const out = [];
      for (let i = 0; i <= 6; i++) out.push([x + (w * i) / 6, k === 0 || k === 5 ? y + (h * k) / 5 : y + (h * k) / 5 + (i % 2 ? 20 : -20)]);
      return out;
    };
    const cols = [Q.green, Q.yellow, Q.rose, Q.yellow, Q.green];
    for (let k = 0; k < 5; k++) s.push([poly([...row(k), ...row(k + 1).reverse()]), cols[k]]);
  }
  // Buttons where four patches meet.
  for (const [i, j] of [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2]]) {
    const bx = X0 + PW * i, by = Y0 + PH * j;
    if (i === 2 && j === 2) continue;
    s.push([O(bx, by, 22), i % 2 ? Q.white : Q.yellow]);
    for (const [u, v] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) s.push([O(bx + u, by + v, 1.2), null]);
  }

  // The kitten, curled up asleep with its tail tucked under its chin.
  const KX = 738, KY = 440, KA = 100, KB = 80;
  const onK = (deg, k = 1, add = 0) => [KX + Math.cos(rad(deg)) * (KA * k + add), KY + Math.sin(rad(deg)) * (KB * k + add)];
  const tail = spl([onK(-50, 0.86), onK(-18, 1, 4), onK(12, 1, 10), onK(40, 1, 11), onK(66, 1, 11), onK(90, 1, 11), [692, 534], [652, 531], [618, 520]], false, 8);
  const tw = t => 16 * Math.min(1, t * 4) * (t > 0.92 ? Math.sqrt(Math.max(0.03, (1 - t) / 0.08)) : 1);
  const cutI = Math.round(tail.length * 0.8);
  s.push([poly(ribbon(tail, tw, 0, cutI)), Q.cat], [poly(ribbon(tail, tw, cutI)), Q.cream]);
  s.push([poly(ell(KX, KY, KA, KB)), Q.cat]);
  for (const a of [-118, -84, -50]) s.push([poly([...arc(0, 0, 1, a - 8, a + 8, 4).map(([c, d]) => [KX + c * KA * 0.985, KY + d * KB * 0.985]), onK(a + 3, 0.52)]), Q.catDark]);
  s.push(['M772 506q-10 -40 36 -54', null]);
  s.push([poly([[630, 458], [624, 414], [662, 436]]), Q.cat], [poly([[680, 432], [708, 404], [716, 448]]), Q.cat]);
  s.push([poly(ell(668, 474, 53, 44, -6)), Q.cat]);
  s.push(['M642 472q9 8 18 0M678 468q9 8 18 0', null], ['M661 485l11 -1l-5 7Z', Q.rose]);
  s.push(['M667 491q-7 8 -14 2M667 491q7 8 14 1', null]);
  s.push(['M632 486l-24 -6M632 494l-24 6', null]);
  return { id: 'patterns-quilt', title: 'Лоскутное одеяло и котёнок', shapes: s };
}

// ---------- 2. Stained glass with a bird ----------
const G = {
  wall: '#75699f', ruby: '#e8506c', amber: '#ffab3d', purple: '#8a66d1', sun: '#ffe066', light: '#d4eeff', sky: '#8fcaf6',
  lilac: '#bfaef2', blue: '#3f83dd', navy: '#2b5aa6', cream: '#fff1cf', green: '#4fbf7a', lime: '#b4e88e', wood: '#a86b3c', pink: '#ff9ec4',
};

function glass() {
  const s = [bg(G.wall)];
  const A = 30, B = 78, x1 = 1200 - B, y1 = 900 - B;
  // A border of little glass tiles.
  const tw = (x1 - B) / 8, th = (y1 - B) / 6;
  for (let i = 0; i < 8; i++) {
    s.push([R(B + tw * i, A, tw, B - A), i % 2 ? G.amber : G.ruby], [R(B + tw * i, y1, tw, B - A), i % 2 ? G.ruby : G.amber]);
  }
  for (let j = 0; j < 6; j++) {
    s.push([R(A, B + th * j, B - A, th), j % 2 ? G.amber : G.ruby], [R(x1, B + th * j, B - A, th), j % 2 ? G.ruby : G.amber]);
  }
  for (const [cx, cy] of [[A, A], [x1, A], [A, y1], [x1, y1]]) s.push([R(cx, cy, B - A, B - A), G.sun]);
  // The corners above the arch, each with a round jewel.
  s.push([R(B, B, x1 - B, y1 - B), G.purple]);
  s.push([O(B + 58, B + 58, 34), G.pink], [O(x1 - 58, B + 58, 34), G.pink]);
  // The arched window itself.
  const AY = 420;
  const win = [[B, y1], [B, AY], ...arc(600, AY, 1, 180, 360, 60).slice(1, -1).map(([c, d]) => [600 + (c - 600) * (x1 - 600), AY + (d - AY) * (AY - B)]), [x1, AY], [x1, y1]];
  s.push([poly(win), G.light]);
  // Rays of glass all around the sun.
  const SX = 868, SY = 262, NW = 12;
  const wedge = (i, r) => {
    const a0 = 360 / NW * i + 8, a1 = a0 + 360 / NW;
    const far = arc(SX, SY, r, a0, a1, 10);
    return inter([[SX, SY], ...far], win);
  };
  const cor = [G.amber, G.sun];
  for (let i = 0; i < NW; i++) s.push([poly(wedge(i, 1600)), i % 3 === 0 ? G.lilac : i % 3 === 1 ? G.sky : G.light]);
  for (let i = 0; i < NW; i++) { const w = wedge(i, 284); if (w.length > 2) s.push([poly(w), i % 3 === 0 ? G.light : i % 3 === 1 ? G.lilac : G.sky]); }
  for (let i = 0; i < NW; i++) s.push([poly(wedge(i, 104)), cor[i % 2]]);
  s.push([O(SX, SY, 56), G.sun]);
  // Hills at the bottom.
  s.push([poly(inter(spl([[B - 40, 716], [200, 700], [380, 740], [520, 800], [600, y1 + 60], [B - 40, y1 + 60]], true, 12), win)), G.green]);
  s.push([poly(inter(spl([[B - 40, 772], [200, 758], [360, 800], [450, y1 + 60], [B - 40, y1 + 60]], true, 12), win)), G.lime]);
  s.push([poly(inter(spl([[420, y1 + 60], [560, 770], [760, 716], [960, 700], [x1 + 60, 716], [x1 + 60, y1 + 60]], true, 12), win)), G.lime]);
  s.push([poly(inter(spl([[600, y1 + 60], [720, 800], [900, 762], [x1 + 60, 770], [x1 + 60, y1 + 60]], true, 12), win)), G.green]);

  // The branch with its leaves and flowers.
  const br = spl([[B - 30, 668], [230, 628], [430, 596], [620, 588], [800, 566], [930, 508], [990, 446]], false, 10);
  const twig = (pts, w0, w1) => poly(inter(ribbon(spl(pts, false, 8), t => w0 + (w1 - w0) * t), win));
  const leaf2 = (x, y, len, w, deg) => fillAll(bands(leaf(x, y, len, w, deg, 0.8, 1.1), [x, y], deg + 90, [0]), [G.green, G.lime]);
  s.push([twig([[300, 618], [330, 668], [380, 700]], 10, 8), G.wood], [twig([[690, 584], [720, 632], [780, 660]], 10, 8), G.wood], [twig([[770, 572], [770, 520], [742, 478]], 10, 8), G.wood]);
  s.push(...leaf2(136, 652, 84, 28, 74), ...leaf2(232, 622, 92, 28, -112), ...leaf2(382, 700, 92, 30, 20), ...leaf2(330, 668, 80, 26, 120));
  s.push(...leaf2(782, 660, 96, 30, 14), ...leaf2(722, 634, 84, 27, 112), ...leaf2(742, 478, 90, 28, -118), ...leaf2(772, 522, 84, 26, -24));
  s.push(...leaf2(884, 536, 92, 29, 62), ...leaf2(668, 588, 80, 26, -58));
  s.push([poly(inter(ribbon(br, t => 15 - 9 * t), win)), G.wood]);
  const bloom = (x, y, r, rot) => {
    for (let i = 0; i < 5; i++) { const a = rot + i * 72; s.push([poly(ell(x + Math.cos(rad(a)) * r * 0.82, y + Math.sin(rad(a)) * r * 0.82, r * 0.62, r * 0.5, a, 24)), i % 2 ? G.pink : G.cream]); }
    s.push([O(x, y, r * 0.42), G.sun]);
  };
  bloom(1000, 430, 44, -90);
  bloom(206, 716, 40, -60);
  bloom(880, 640, 40, -20);

  // A little butterfly in the corner of the sky.
  s.push(...bfly(262, 292, 1, -18, G.amber, G.ruby));

  // The bird.
  const BX = 504, BY = 418, BS = 1.08;
  const at = pts => mv(pts, BX, BY, BS);
  // tail feathers
  for (const [deg, len, c1, c2] of [[197, 232, G.navy, G.amber], [177, 250, G.blue, G.sun], [157, 232, G.navy, G.amber]]) {
    const f = inter(at(leaf(-118, 50, len, 30, deg, 0.5, 0.9)), win);
    s.push(...fillAll(bands(f, at([[-118, 50]])[0], deg, [len * 0.66 * BS]), [c1, c2]));
  }
  // crest
  for (const [deg, len] of [[-142, 70], [-112, 82], [-82, 70]]) s.push([poly(at(leaf(78, -150, len, 15, deg, 0.9, 0.9))), deg === -112 ? G.ruby : G.amber]);
  const body = at(spl([[128, -52], [136, 10], [108, 70], [40, 108], [-50, 104], [-126, 72], [-160, 34], [-126, -22], [-50, -72], [40, -110]], true, 10));
  s.push([poly(body), G.blue]);
  s.push([poly(inter(body, at(ell(60, 96, 150, 78, -8)))), G.cream]);
  s.push([poly(inter(body, at(ell(118, 4, 92, 104, 8)))), G.ruby]);
  // legs
  s.push([line(at([[4, 100], [6, 146]])), null], [line(at([[58, 96], [62, 142]])), null]);
  s.push([poly(at(ell(9, 152, 19, 10, -3, 24))), G.amber], [poly(at(ell(65, 148, 19, 10, -3, 24))), G.amber]);
  // head, cheek and beak
  s.push([poly(at([[142, -128], [214, -104], [146, -78]])), G.amber]);
  s.push([poly(at(ell(92, -104, 66, 62))), G.blue]);
  s.push([poly(at(ell(104, -96, 36, 30, -10))), G.cream], [O(BX + 114 * BS, BY - 102 * BS, 6), null], [O(BX + 114 * BS, BY - 102 * BS, 2.5), null]);
  // wing: a shoulder, a row of short feathers and three long ones
  const WD = 160, wo = at([[72, -34]])[0];
  const wing = at(leaf(72, -34, 244, 64, WD, 0.55, 1.0, 24));
  const parts = bands(wing, wo, WD, [80 * BS, 146 * BS]);
  s.push([poly(parts[0]), G.navy]);
  s.push(...fillAll(bands(parts[1], wo, WD + 90, [-22, 22]), [G.sun, G.amber, G.sun]));
  s.push(...fillAll(bands(parts[2], wo, WD + 90, [-17, 17]), [G.purple, G.pink, G.purple]));
  return { id: 'patterns-glass-bird', title: 'Витраж с птицей', shapes: s };
}

// ---------- 3. An owl made of patterns ----------
const W = {
  night: '#2f3b8f', dusk: '#4a58bd', haze: '#7566cc', moon: '#ffe066', body: '#f08c4a', rust: '#b9532f', cream: '#fff1cf', pink: '#ff9ec4',
  teal: '#3fc1b0', white: '#ffffff', amber: '#ffb238', pupil: '#3a2b6b', wood: '#8a5a35', green: '#4fbf7a', lime: '#aee88c', berry: '#e8506c',
};
const polyArea = pts => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

function owl() {
  const s = [bg(W.night)];
  const mir = pts => pts.map(([x, y]) => [1200 - x, y]);
  const both = (pts, col, col2 = col) => s.push([poly(pts), col], [poly(mir(pts)), col2]);
  // The night sky in three wavy layers, the moon and the stars.
  const skyRow = (y, amp, n, ph) => { const out = []; for (let i = 0; i <= 48; i++) out.push([-10 + (1220 * i) / 48, y + amp * Math.sin((i / 48) * n * Math.PI + ph)]); return out; };
  s.push([poly([...skyRow(300, 34, 5, 0.6), [1210, 910], [-10, 910]]), W.dusk]);
  s.push([poly([...skyRow(560, 30, 6, 2.2), [1210, 910], [-10, 910]]), W.haze]);
  s.push([poly(mv([...arc(0, 0, 78, 40, 320, 30), ...arc(45, 0, 52.2, 286.4, 73.6, 20)], 176, 150, 1, -24)), W.moon]);
  for (const [x, y, r, rot] of [[86, 372, 26, 0], [300, 250, 22, 0.4], [330, 70, 26, 0.2], [930, 96, 28, 0.5], [1090, 250, 24, 0], [1030, 440, 22, 0.3], [150, 560, 22, 0.6], [1120, 610, 20, 0.1], [840, 40, 0, 0]]) {
    if (r) s.push([starD(x, y, r, r * 0.46, 5, rot - Math.PI / 2), W.moon]);
  }
  for (const [x, y] of [[240, 420], [60, 250], [450, 90], [760, 80], [1150, 110], [960, 300], [1140, 380], [70, 660], [1000, 560], [250, 620]]) s.push([O(x, y, 3), null]);

  // Tail feathers hanging below the branch.
  for (const [deg, col] of [[112, W.rust], [68, W.rust], [90, W.body]]) s.push([poly(leaf(600, 742, 126, 30, deg, 0.9, 0.8)), col]);
  // The branch, its leaves and berries.
  const brC = spl([[-30, 770], [150, 752], [330, 768], [600, 772], [870, 768], [1050, 752], [1230, 770]], false, 10);
  const leaf2 = (x, y, len, w, deg) => fillAll(bands(leaf(x, y, len, w, deg, 0.8, 1.1), [x, y], deg + 90, [0]), [W.green, W.lime]);
  for (const [x, y, len, deg, side] of [[58, 756, 96, -82, 0], [188, 750, 102, -104, 1], [262, 764, 92, -50, 1], [120, 776, 92, 62, 0], [300, 782, 90, 112, 0]]) {
    if (side !== 2) s.push(...leaf2(x, y, len, 31, deg));
    if (side !== 1) s.push(...fillAll(bands(mir(leaf(x, y, len, 31, deg, 0.8, 1.1)), [1200 - x, y], 90 - deg, [0]), [W.lime, W.green]));
  }
  s.push([poly(ribbon(brC, 21)), W.wood]);
  for (const [x, y] of [[214, 812], [248, 838], [206, 850]]) both(ell(x, y, 19, 19, 0, 24), W.berry);
  s.push(['M228 790l-8 8M232 790l12 28', null], ['M972 790l8 8M968 790l-12 28', null]);

  // Ear tufts, then the body.
  bands([[418, 236], [392, 78], [552, 150]], [392, 78], 51, [46, 82]).forEach((p, i) => both(p, [W.rust, W.pink, W.rust][i]));
  const body = spl([[600, 136], [716, 152], [806, 236], [842, 390], [826, 560], [752, 700], [600, 752], [448, 700], [374, 560], [358, 390], [394, 236], [484, 152]], true, 12);
  s.push([poly(body), W.body]);
  for (const [x, y, r, col] of [[442, 230, 12.5, W.cream], [498, 194, 15, W.teal], [546, 176, 12.5, W.cream]]) both(ell(x, y, r, r, 0, 24), col);
  // Belly with rows of round feathers.
  const belly = ell(600, 598, 168, 178, 0, 60);
  s.push([poly(belly), W.cream]);
  const rows = [];
  for (let k = 1; k < 6; k++) {
    const y = 440 + 58 * k, odd = k % 2;
    for (let j = odd ? -2 : -1; j <= 1; j++) rows.push([600 + 92 * (j + (odd ? 0.5 : 0)), y, k]);
  }
  rows.sort((a, b) => b[2] - a[2]);
  const scaleCol = [W.cream, W.teal, W.pink];
  for (const [x, y, k] of rows) {
    const part = inter(ell(x, y, 46, 46, 0, 36), belly);
    if (part.length > 2 && polyArea(part) > 1500) s.push([poly(part), scaleCol[k % 3]]);
  }
  // A smooth chest over the top row, so the feathers peep out from under it.
  s.push([poly(inter(ell(600, 395, 215, 105, 0, 60), belly)), W.cream]);
  // Wings with stripes.
  const wingL = leaf(366, 446, 300, 62, 74, 0.6, 1.0, 24);
  const wparts = bands(wingL, [366, 446], 74, [62, 116, 170, 224]);
  const wcols = [W.rust, W.teal, W.cream, W.teal, W.rust];
  wparts.forEach((p, i) => both(p, wcols[i]));
  // The feather crown between the eyes.
  for (const [deg, len, col] of [[-140, 84, W.teal], [-40, 84, W.teal], [-115, 100, W.cream], [-65, 100, W.cream], [-90, 112, W.pink]]) s.push([poly(leaf(600, 272, len, 21, deg, 0.9, 0.9)), col]);
  // Big eyes with a ring of petals.
  for (const ex of [502, 698]) {
    const ey = 334;
    for (let i = 0; i < 10; i++) s.push([poly([...arc(ex, ey, 98, i * 36 - 90, i * 36 - 54, 8), ...arc(ex, ey, 66, i * 36 - 54, i * 36 - 90, 6)]), i % 2 ? W.pink : W.teal]);
    s.push([O(ex, ey, 66), W.white], [O(ex, ey, 44), W.amber], [O(ex, ey, 21), W.pupil], [O(ex - 8, ey - 8, 4), W.white]);
  }
  // Beak and feet.
  s.push([poly([[600, 352], [632, 406], [600, 464], [568, 406]]), W.amber]);
  for (const fx of [540, 660]) for (const d of [-30, 0, 30]) s.push([poly(ell(fx + d, 752, 14, 24, d * 0.5, 24)), W.amber]);
  // A baby owl on the branch.
  {
    const cx = 962, m = pts => pts.map(([x, y]) => [2 * cx - x, y]);
    const two = (pts, col) => s.push([poly(pts), col], [poly(m(pts)), col]);
    two([[912, 636], [904, 584], [948, 606]], W.rust);
    const b = ell(cx, 676, 64, 78, 0, 40);
    s.push([poly(b), W.teal]);
    s.push([poly(inter(ell(cx, 722, 44, 46, 0, 32), b)), W.cream]);
    s.push([heartD(cx, 728, 15), W.berry]);
    two(leaf(900, 664, 84, 21, 76, 0.7, 1), W.pink);
    two(ell(936, 652, 25, 25, 0, 28), W.white);
    s.push([O(940, 654, 5), null], [O(940, 654, 2), null], [O(984, 654, 5), null], [O(984, 654, 2), null]);
    s.push([poly([[cx, 664], [975, 680], [cx, 702], [949, 680]]), W.amber]);
    s.push(['M940 752v10m-8 -6l8 6l8 -6M984 752v10m-8 -6l8 6l8 -6', null]);
  }
  return { id: 'patterns-owl', title: 'Узорная сова и совёнок', shapes: s };
}

// ---------- 4. A big patterned kite with ribbons ----------
const K = {
  sky: '#bfe6ff', white: '#ffffff', sun: '#ffe066', amber: '#ffab3d', hill: '#b9ec8a', grass: '#6fcf6a', red: '#f25a6b', teal: '#3fc1b0',
  blue: '#4f9be8', purple: '#9a6fe0', pink: '#ff9ec4', skin: '#ffd9b8', hair: '#8a5a35', navy: '#3d4fa8',
};

function kite() {
  const s = [bg(K.sky)];
  // Sun, clouds and far birds.
  s.push([starD(118, 112, 88, 62, 12), K.amber], [O(118, 112, 52), K.sun]);
  s.push([cloudD(262, 150, 74), K.white], [cloudD(812, 118, 84), K.white], [cloudD(110, 262, 60), K.white]);
  s.push(['M420 70q14 -14 26 0q12 -14 26 0M880 300q12 -12 22 0q10 -12 22 0M770 650q12 -12 22 0q10 -12 22 0', null]);
  // Hills.
  const hillRow = (y, amp, n, ph) => { const out = []; for (let i = 0; i <= 48; i++) out.push([-10 + (1220 * i) / 48, y + amp * Math.sin((i / 48) * n * Math.PI + ph)]); return out; };
  s.push([poly([...hillRow(786, 22, 3, 0.4), [1210, 910], [-10, 910]]), K.hill]);
  s.push([poly([...hillRow(836, 18, 4, 2.6), [1210, 910], [-10, 910]]), K.grass]);

  // A bow for a kite tail.
  const bow = (x, y, sz, rot, c1, c2) => {
    const t = [[0, 0], [-sz, -sz * 0.62], [-sz, sz * 0.62]];
    s.push([poly(mv(t, x, y, 1, rot)), c1], [poly(mv(t, x, y, 1, rot, -1)), c1], [poly(ell(x, y, sz * 0.3, sz * 0.3, 0, 20)), c2]);
  };
  // A bow tied across a tail line, so the line and the bow never pinch a sliver of sky.
  const bowOn = (c, i, sz, tilt, c1, c2) => bow(c[i][0], c[i][1], sz, (Math.atan2(c[i + 1][1] - c[i - 1][1], c[i + 1][0] - c[i - 1][0]) * 180) / Math.PI + 90 + tilt, c1, c2);
  // Two little kites far away.
  const small = (x, y, k, rot, c, bows) => {
    const q = pts => mv(pts, x, y, k, rot);
    const tailC = spl(q([[0, 96], [-16, 130], [8, 166], [-10, 204], [6, 240]]), false, 8);
    s.push([line(tailC), null]);
    s.push([poly(q([[0, -70], [-52, -10], [0, -10]])), c[0]], [poly(q([[0, -70], [52, -10], [0, -10]])), c[1]]);
    s.push([poly(q([[-52, -10], [0, 96], [0, -10]])), c[2]], [poly(q([[52, -10], [0, 96], [0, -10]])), c[3]]);
    bows.forEach(([i, a], n) => bowOn(tailC, i, 30 * k, a, n % 2 ? c[0] : c[3], K.sun));
  };
  s.push(['M985 150Q1100 226 1210 262', null], ['M1118 420Q1166 470 1210 492', null]);
  small(985, 128, 1.0, -16, [K.purple, K.pink, K.sun, K.teal], [[14, 8], [28, -8]]);
  small(1118, 404, 0.84, 12, [K.red, K.amber, K.blue, K.sun], [[16, 8], [30, -8]]);

  // The big kite: a jewelled frame, a sunburst above the cross and rainbow arrows below it.
  const KX = 500, KY = 334, KS = 1.38, KR = 8;
  const outer = mv([[0, -170], [135, -40], [0, 270], [-135, -40]], KX, KY, KS, KR);
  const [T, Rt, Bm, L] = outer;
  const [Ti, Ri, Bi, Li] = inset(outer, 30);
  const C = lerp(Li, Ri, 0.5);
  const g = pts => mv(pts, 985, 852, 1.45);
  const hand = g([[-80, -183]])[0];
  s.push([`M${pt(C)}Q${pt([716, 566])} ${pt(hand)}`, null]);
  // The tail with bows.
  const tailC = spl([Bm, [428, 718], [380, 706], [312, 686], [240, 696], [172, 732], [104, 718]], false, 10);
  s.push([line(tailC), null]);
  [[18, 8, K.red], [28, -8, K.sun], [38, 6, K.teal], [48, -6, K.purple], [58, 8, K.pink]].forEach(([i, a, c]) => bowOn(tailC, i, 32, a, c, K.navy));
  // Two long striped ribbons that fly out from behind the side corners.
  const stream = (a, b, amp, f, cols, n) => {
    const c = [];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    for (let i = 0; i <= n * 6; i++) {
      const t = i / (n * 6), o = amp * Math.sin(t * f * 2 * Math.PI) * Math.min(1, t * 5);
      c.push([a[0] + dx * t - (dy / d) * o, a[1] + dy * t + (dx / d) * o]);
    }
    const [eL, eR] = edges(c, 19);
    for (let k = 0; k < n; k++) {
      const part = [...eL.slice(k * 6, k * 6 + 7), ...(k === n - 1 ? [[c[n * 6 - 3][0], c[n * 6 - 3][1]]] : []), ...eR.slice(k * 6, k * 6 + 7).reverse()];
      s.push([poly(part), cols[k % cols.length]]);
    }
  };
  stream(lerp(L, C, 0.12), [46, 462], 30, 2.25, [K.red, K.sun, K.teal, K.purple], 8);
  stream(lerp(Rt, C, 0.12), [912, 452], 28, 1.75, [K.blue, K.pink, K.sun, K.red], 6);
  // The frame, cut into pieces like beads.
  const frame = (a, b, bi, ai, n) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), cuts = [];
    for (let k = 1; k < n; k++) cuts.push((len * k) / n);
    s.push(...fillAll(bands([a, b, bi, ai], a, (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI, cuts), [K.navy, K.white]));
  };
  frame(T, L, Li, Ti, 2);
  frame(T, Rt, Ri, Ti, 2);
  frame(L, Bm, Bi, Li, 4);
  frame(Rt, Bm, Bi, Ri, 4);
  // Above the cross: rays that fan out from the middle.
  for (const side of [Li, Ri]) {
    const p1 = lerp(Ti, side, 0.356), p2 = lerp(Ti, side, 0.624);
    s.push([poly([C, Ti, p1]), K.sun], [poly([C, p1, p2]), K.pink], [poly([C, p2, side]), K.purple]);
  }
  // Below the cross: arrows in rainbow order, two of them with a white dot on each side.
  const lowCols = [K.red, K.amber, K.sun, K.teal, K.blue, K.purple];
  for (const [side, deg] of [[Li, KR + 60], [Ri, KR + 120]]) {
    const parts = bands([side, Bi, C], C, deg, [-14, 44, 102, 160, 218]);
    s.push(...fillAll(parts, lowCols));
    for (const k of [1, 3]) { const m = mid(parts[k]); s.push([O(n1(m[0]), n1(m[1]), 15), K.white]); }
  }
  // The flower in the middle.
  s.push([poly(ell(C[0], C[1], 53, 53, 0, 40)), K.white]);
  for (let i = 0; i < 6; i++) s.push([poly(leaf(C[0], C[1], 42, 14, KR + i * 60, 1, 0.8)), i % 2 ? K.pink : K.red]);
  s.push([O(n1(C[0]), n1(C[1]), 14), K.sun]);
  s.push(...bfly(236, 560, 0.95, 20, K.pink, K.purple), ...bfly(646, 700, 0.9, -24, K.sun, K.amber));

  // The girl who flies the kite.
  {
    const dress = g(spl([[-22, -150], [22, -150], [36, -104], [54, -58], [0, -52], [-54, -58], [-36, -104]], true, 8));
    s.push([poly(g(rc(-17, -62, 16, 56))), K.skin], [poly(g(rc(1, -62, 16, 56))), K.skin]);
    s.push([poly(g(ell(-15, -5, 15, 10, 0, 24))), K.red], [poly(g(ell(15, -5, 15, 10, 0, 24))), K.red]);
    s.push([poly(ribbon(spl([...g([[-18, -140], [-46, -160]]), hand], false, 6), 11)), K.skin]);
    s.push([poly(ribbon(spl(g([[18, -142], [35, -120], [46, -94]]), false, 6), 11)), K.skin]);
    s.push(...fillAll(bands(dress, g([[0, -150]])[0], 90, [44 * 1.45, 70 * 1.45]), [K.purple, K.sun, K.purple]));
    const h2 = g([[48, -87]])[0];
    s.push([O(n1(hand[0]), n1(hand[1]), 14), K.skin], [O(n1(h2[0]), n1(h2[1]), 14), K.skin]);
    s.push([poly(g(ell(-24, -212, 13, 13, 0, 20))), K.hair], [poly(g(ell(24, -212, 13, 13, 0, 20))), K.hair]);
    const head = g(ell(0, -182, 30, 30, 0, 40));
    s.push([poly(head), K.skin]);
    s.push([poly(inter(g(ell(0, -208, 36, 20, 0, 32)), head)), K.hair]);
    const e = g([[-11, -176], [11, -176], [0, -165]]);
    s.push([O(e[0][0], e[0][1], 2.5), null], [O(e[1][0], e[1][1], 2.5), null], [`M${pt([e[2][0] - 9, e[2][1]])}q9 9 18 0`, null]);
  }
  // Flowers in the grass.
  const daisy = (x, y, r, col) => {
    for (let i = 0; i < 6; i++) s.push([poly(leaf(x, y, r, r * 0.4, i * 60 + 30, 1, 0.8)), col]);
    s.push([O(x, y, r * 0.34), K.sun]);
  };
  daisy(120, 842, 40, K.pink);
  daisy(360, 852, 38, K.white);
  daisy(610, 846, 40, K.red);
  daisy(800, 856, 36, K.purple);
  return { id: 'patterns-kite', title: 'Узорный воздушный змей', shapes: s };
}

export default [quilt(), glass(), owl(), kite()];
