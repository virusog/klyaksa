// Detailed coloring pages about nature: whole scenes with a main subject, a rich
// background and many small things to find. All art is original, drawn in code.
import { O, R, starD, cloudD, petal, bg } from '../art.js';

const n1 = v => +v.toFixed(1);
const rad = a => (a * Math.PI) / 180;
const pt = p => `${n1(p[0])} ${n1(p[1])}`;

// ---------- Path kit ----------
// A smooth curve through the given points, written as cubic curves.
function curve(pts, closed = true) {
  const n = pts.length;
  const g = i => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(g(0))}`;
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    d += `C${pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${pt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}
const poly = pts => `M${pts.map(pt).join('L')}Z`;

// Moves, scales, turns and mirrors a path made only of absolute M, L, C, Q and Z.
function tf(d, x, y, s = 1, rot = 0, flip = 1) {
  const a = rad(rot), c = Math.cos(a), si = Math.sin(a);
  return d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (m, u, v) => {
    const px = +u * s * flip, py = +v * s;
    return `${n1(x + px * c - py * si)} ${n1(y + px * si + py * c)}`;
  });
}
const put = (list, x, y, s = 1, rot = 0, flip = 1) => list.map(([d, f]) => [tf(d, x, y, s, rot, flip), f]);

// An ellipse made of curves, so it can be turned and moved.
function ov(x, y, a, b = a, rot = 0) {
  const k = 0.5523, A = n1(a * k), B = n1(b * k);
  return tf(`M${-a} 0C${-a} ${-B} ${-A} ${-b} 0 ${-b}C${A} ${-b} ${a} ${-B} ${a} 0C${a} ${B} ${A} ${b} 0 ${b}C${-A} ${b} ${-a} ${B} ${-a} 0Z`, x, y, 1, rot);
}

// A puffy outline for crowns, bushes and foam.
function blob(cx, cy, rx, ry, n, b = 0.28, rot = 0) {
  const p = (a, k) => `${n1(cx + Math.cos(a) * rx * k)} ${n1(cy + Math.sin(a) * ry * k)}`;
  const step = 6.28318 / n;
  let d = `M${p(rot, 1)}`;
  for (let i = 0; i < n; i++) d += `Q${p(rot + step * (i + 0.5), 1 + b)} ${p(rot + step * (i + 1), 1)}`;
  return `${d}Z`;
}

// Point outlines, for shapes that are cut into stripes that meet exactly.
function elp(cx, cy, rx, ry, rot = 0, n = 44) {
  const a = rad(rot), c = Math.cos(a), s = Math.sin(a), out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 6.28318, u = Math.cos(t) * rx, v = Math.sin(t) * ry;
    out.push([cx + u * c - v * s, cy + u * s + v * c]);
  }
  return out;
}
function clip(pts, f) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const a = f(p), b = f(q);
    if (a <= 0) out.push(p);
    if ((a <= 0) !== (b <= 0)) { const t = a / (a - b); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
// Cuts an outline into stripes across the direction `deg`, at the given distances from `o`.
function stripes(pts, o, deg, cuts, cols) {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
  const pos = p => (p[0] - o[0]) * c + (p[1] - o[1]) * s;
  const edges = [-1e6, ...cuts, 1e6];
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const part = clip(clip(pts, p => edges[i] - pos(p)), p => pos(p) - edges[i + 1]);
    if (part.length > 2) out.push([poly(part), cols[i % cols.length]]);
  }
  return out;
}

// The part of an outline that lies inside a convex outline, for patches with a curved edge.
function inter(pts, conv) {
  let area = 0;
  for (let i = 0; i < conv.length; i++) { const a = conv[i], b = conv[(i + 1) % conv.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sg = area > 0 ? 1 : -1;
  let out = pts;
  for (let i = 0; i < conv.length; i++) {
    const a = conv[i], b = conv[(i + 1) % conv.length];
    out = clip(out, p => -sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])));
  }
  return out;
}

// ---------- Small things shared by the scenes ----------
function leaf(x, y, len, w, deg, col) {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
  return [[petal(x, y, len, w, a), col], [`M${pt([x + c * len * 0.1, y + s * len * 0.1])}L${pt([x + c * len * 0.72, y + s * len * 0.72])}`, null]];
}

function daisy(x, y, r, n, col, mid, midR = 0.36, w = 0.3, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) out.push([petal(x, y, r, r * w, rot + (i / n) * 6.28318), col]);
  out.push([O(x, y, r * midR), mid]);
  return out;
}

function sun(x, y, r, col, ray, n = 14) {
  return [[starD(x, y, r * 1.58, r * 1.2, n), ray], [O(x, y, r), col]];
}

// ---------- 1. Butterfly garden ----------
const WING_UP = 'M5 -12C22 -78 88 -118 116 -92C136 -70 108 -22 62 -6C38 2 16 2 5 -2Z';
const WING_LO = 'M5 2C40 -2 84 14 88 46C91 76 62 92 40 78C22 66 8 38 5 10Z';

// A butterfly seen from above, head up, about 236 wide at size 1.
function butterfly(c, rich) {
  const out = [];
  for (const f of [1, -1]) {
    const m = d => tf(d, 0, 0, 1, 0, f);
    out.push([m(WING_LO), c.lo], [m(tf(WING_LO, 44 * 0.54, 42 * 0.54, 0.46)), c.inLo]);
    out.push([m(WING_UP), c.up], [m(tf(WING_UP, 40 * 0.44, -36 * 0.44, 0.56)), c.inUp]);
    if (rich) {
      out.push([m(ov(79, -87, 8.5)), c.spot], [m(ov(104, -64, 9.5)), c.spot], [m(ov(97, -42, 8)), c.spot]);
      out.push([m(ov(46, 43, 9)), c.spot], [m(ov(76, 46, 7)), c.spot], [m(ov(68, 67, 7)), c.spot]);
      out.push([m('M30 -30C44 -56 62 -66 76 -64C70 -50 56 -36 30 -30Z'), c.drop]);
    } else {
      out.push([m(ov(103, -70, 9)), c.spot]);
    }
  }
  out.push(['M-4 -45C-6 -62 -12 -76 -22 -84', null], ['M4 -45C6 -62 12 -76 22 -84', null]);
  out.push([ov(-23, -86, rich ? 3 : 4.5), c.body], [ov(23, -86, rich ? 3 : 4.5), c.body]);
  out.push([ov(0, 36, 10, 34), c.body2], [ov(0, -8, 12, 22), c.body], [ov(0, -36, 11.5), c.body2]);
  if (rich) out.push(['M-5 24L5 24', null], ['M-5 38L5 38', null], ['M-4 52L4 52', null]);
  return out;
}

const TULIP_SIDE = 'M-2 46C-34 46 -44 10 -36 -34C-20 -24 -6 -6 -2 10Z';
const TULIP_MID = 'M0 46C-22 30 -22 -14 0 -44C22 -14 22 30 0 46Z';
function tulip(x, y, s, col, col2, rot = 0) {
  return put([[TULIP_SIDE, col], [tf(TULIP_SIDE, 0, 0, 1, 0, -1), col], [TULIP_MID, col2]], x, y, s, rot);
}

const BELL = 'M0 0C-14 0 -18 12 -19 24C-20 32 -24 36 -30 42L-15 36L0 46L15 36L30 42C24 36 20 32 19 24C18 12 14 0 0 0Z';
// A bluebell: a tall stem with arching twigs and a bell hanging from each.
function bluebell(x, y0, col, col2) {
  const top = y0 - 330;
  const out = [[`M${x} ${y0}C${x - 8} ${y0 - 120} ${x + 8} ${y0 - 240} ${x} ${top}`, null]];
  [[-1, 150, 1.25], [1, 210, 1.2], [-1, 262, 1.08], [1, 304, 0.98]].forEach(([side, up, s], i) => {
    const ys = y0 - up, bx = x + side * 56;
    out.push([`M${x} ${ys}C${x + side * 20} ${ys - 34} ${x + side * 50} ${ys - 30} ${bx} ${ys + 6}`, null]);
    out.push([tf(BELL, bx, ys + 6, s), i % 2 ? col2 : col]);
  });
  out.push([ov(x, top - 12, 11, 17), col2]);
  return out;
}

// A small round blossom for bushes.
const bloom = (x, y, r, col, mid) => [[blob(x, y, r * 0.84, r * 0.84, 5, 0.42, x), col], [O(x, y, 6), mid]];

function poppy(x, y, s, col, mid, rot = 0) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    const a = rot + i * 72;
    out.push([ov(x + Math.cos(rad(a)) * 30 * s, y + Math.sin(rad(a)) * 30 * s, 33 * s, 27 * s, a), col]);
  }
  out.push([O(x, y, n1(18 * s)), mid], [O(x, y, n1(5.5 * s)), '#3a2b6b']);
  return out;
}

function snail(x, y, s, flip = 1) {
  return put([
    ['M-64 -30C-66 -44 -72 -52 -78 -56', null], ['M-50 -30C-48 -44 -44 -52 -38 -56', null],
    [ov(-79, -58, 5), '#fff1b8'], [ov(-37, -58, 5), '#fff1b8'],
    ['M86 26C60 30 -20 30 -52 28C-74 26 -80 4 -76 -14C-72 -32 -48 -36 -42 -18C-38 -4 -24 4 0 6C40 8 70 10 86 26Z', '#fff1b8'],
    [ov(22, -22, 44), '#b9794a'], [ov(22, -22, 28), '#ff9a3c'], [ov(22, -22, 12), '#b9794a'],
    ['M-66 -4C-62 2 -56 2 -52 -2', null],
  ], x, y, s, 0, flip);
}

function ladybug(x, y, s, rot = 0) {
  return put([
    [ov(0, -24, 16, 13), '#3a2b6b'],
    ...stripes(elp(0, 0, 30, 27), [0, 0], 0, [0], ['#e8483f', '#e8483f']),
    [ov(-13, -8, 5), '#3a2b6b'], [ov(13, -8, 5), '#3a2b6b'], [ov(-14, 10, 5), '#3a2b6b'], [ov(14, 10, 5), '#3a2b6b'],
  ], x, y, s, rot);
}

function bee(x, y, s, rot = 0, flip = 1) {
  return put([
    [ov(-6, -30, 15, 24, -24), '#ffffff'], [ov(16, -30, 15, 24, 20), '#ffffff'],
    ['M34 0L50 4L34 8Z', '#3a2b6b'],
    ...stripes(elp(0, 0, 38, 25), [0, 0], 0, [-14, 4, 21], ['#ffd447', '#3a2b6b', '#ffd447', '#3a2b6b']),
    [ov(-40, -2, 17), '#ffd447'],
    [ov(-45, -6, 3.5), '#3a2b6b'],
    ['M-46 -18C-50 -30 -58 -34 -64 -32', null], ['M-36 -19C-36 -30 -40 -38 -46 -40', null],
    ['M-50 4C-46 8 -42 8 -38 5', null],
  ], x, y, s, rot, flip);
}

function caterpillar(x, y, s) {
  const out = [];
  const ys = [0, -12, 0, -12, 0];
  for (let i = 4; i >= 0; i--) out.push([ov(40 + i * 34, ys[i], 23), i % 2 ? '#ffd447' : '#3fa860']);
  out.push(['M-8 -22C-12 -36 -18 -42 -26 -44', null], ['M8 -24C10 -38 16 -44 24 -44', null]);
  out.push([ov(0, -4, 27), '#ffd447'], [ov(-9, -8, 4), '#3a2b6b'], [ov(9, -8, 4), '#3a2b6b'], ['M-9 6C-4 12 4 12 9 6', null]);
  return put(out, x, y, s);
}

const garden = () => {
  const SKYC = '#bfe6ff', WHITE = '#ffffff', YEL = '#ffd447', ORA = '#ff9a3c', HILL = '#b5e6a0', LAWN = '#7fd466',
    LEAF = '#3fa860', PINK = '#ff8fc7', RED = '#e8483f', PUR = '#a97bf0', BLUE = '#5aa9f5', INK = '#3a2b6b',
    SAND = '#f3d9a4', CREAM = '#fff1b8', BRN = '#b9794a';
  const s = [bg(SKYC)];
  s.push(...sun(1090, 100, 56, YEL, ORA));
  s.push([cloudD(180, 110, 78), WHITE], [cloudD(836, 66, 46), WHITE]);
  // Far hill with a little garden house.
  s.push(['M-10 440C180 372 400 380 620 430C820 474 1010 404 1210 384L1210 910L-10 910Z', HILL]);
  s.push([R(1012, 330, 30, 50), BRN], [R(1026, 368, 124, 76), CREAM], [poly([[1006, 372], [1088, 300], [1170, 372]]), RED]);
  s.push([R(1046, 392, 34, 52, 15), BRN], [R(1096, 386, 42, 34), SKYC], ['M1117 386L1117 420', null], [O(1088, 347, 11), SKYC]);
  // Lawn and a winding sand path.
  s.push(['M-10 540C260 486 500 548 760 528C950 514 1100 546 1210 528L1210 910L-10 910Z', LAWN]);
  s.push(['M1056 444C960 480 660 530 690 640C716 730 560 800 500 910L800 910C820 800 930 730 880 640C850 570 1010 500 1100 444Z', SAND]);
  // Rose bushes in the middle distance.
  s.push([blob(130, 520, 118, 66, 9, 0.24), LEAF], ...bloom(62, 512, 27, PINK, RED), ...bloom(136, 484, 27, PINK, RED), ...bloom(206, 524, 27, PINK, RED));
  s.push([blob(1130, 570, 96, 58, 8, 0.24, 0.3), LEAF], ...bloom(1068, 566, 24, YEL, ORA), ...bloom(1128, 538, 24, YEL, ORA), ...bloom(1184, 572, 24, YEL, ORA));
  // The big butterfly.
  s.push(...put(butterfly({ up: PUR, inUp: PINK, lo: BLUE, inLo: YEL, spot: WHITE, drop: YEL, body: INK, body2: BRN }, true), 540, 262, 1.84, -10));
  s.push(...put(butterfly({ up: ORA, inUp: YEL, lo: RED, inLo: YEL, spot: WHITE, body: INK, body2: BRN }), 196, 300, 0.98, 24));
  s.push(...put(butterfly({ up: PINK, inUp: WHITE, lo: PUR, inLo: WHITE, spot: YEL, body: INK, body2: BRN }), 884, 250, 1.02, -22));
  // Front row of flowers.
  s.push(['M118 640C100 740 128 820 116 910', null], ...leaf(112, 800, 120, 62, -150, LEAF), ...leaf(116, 830, 118, 62, -24, LEAF));
  s.push(...daisy(118, 640, 96, 12, YEL, BRN, 0.44, 0.28), [O(118, 640, 22), ORA]);
  s.push(['M268 760C262 820 272 870 266 910', null], ['M352 720C358 800 346 860 352 910', null], ['M436 770C442 830 432 870 438 910', null]);
  s.push(...leaf(300, 904, 130, 46, -112, LEAF), ...leaf(394, 904, 128, 46, -70, LEAF));
  s.push(...tulip(268, 716, 1.2, RED, ORA, -6), ...tulip(352, 670, 1.26, YEL, ORA), ...tulip(436, 724, 1.2, PUR, PINK, 6));
  s.push(...bluebell(580, 910, BLUE, PUR), ...leaf(574, 904, 104, 40, -152, LEAF), ...leaf(586, 904, 100, 40, -30, LEAF));
  s.push(...snail(722, 852, 0.92));
  s.push(['M850 724C846 800 858 860 852 910', null]);
  s.push(...leaf(852, 880, 100, 44, -160, LEAF), ...leaf(852, 890, 92, 42, -24, LEAF));
  s.push(...daisy(850, 716, 78, 9, WHITE, YEL, 0.34, 0.32, 0.2));
  s.push(['M1096 710C1100 780 1088 850 1094 910', null], ...leaf(1094, 860, 96, 44, -150, LEAF), ...leaf(1094, 880, 90, 44, -30, LEAF));
  s.push(...poppy(1096, 700, 1.18, RED, YEL, 18));
  s.push(...bee(742, 560, 1.12, -12), ...ladybug(60, 760, 0.9, -30), ...caterpillar(318, 574, 0.8));
  return { id: 'nature2-butterfly-garden', title: 'Сад бабочек и цветов', shapes: s };
};

// ---------- 2. Autumn park ----------
// Dense points along a smooth closed outline, for shapes that are cut into parts.
function sm(pts, k = 8) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let j = 0; j < k; j++) {
      const u = j / k, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * u3)));
    }
  }
  return out;
}

const MAPLE = poly([[0, 22], [-20, 30], [-16, 14], [-40, 8], [-26, -4], [-34, -26], [-14, -18], [0, -42], [14, -18], [34, -26], [26, -4], [40, 8], [16, 14], [20, 30]]);
const maple = (x, y, s, rot, col) => put([[MAPLE, col], ['M0 44L0 -10', null], ['M0 8L-13 -1', null], ['M0 8L13 -1', null]], x, y, s, rot);

// One layer of a fir tree: curved sides and a scalloped hem.
function tier(cx, top, bot, hw, scallops = 4) {
  const w = (hw * 2) / scallops;
  let d = `M${cx} ${top}Q${n1(cx + hw * 0.32)} ${n1(top + (bot - top) * 0.66)} ${cx + hw} ${bot}`;
  for (let i = 0; i < scallops; i++) d += `Q${n1(cx + hw - w * (i + 0.5))} ${n1(bot + w * 0.42)} ${n1(cx + hw - w * (i + 1))} ${bot}`;
  return `${d}Q${n1(cx - hw * 0.32)} ${n1(top + (bot - top) * 0.66)} ${cx} ${top}Z`;
}
function fir(x, base, w, h, col, wood, col2 = col) {
  const trunkH = h * 0.14, b = base - trunkH, H = h - trunkH;
  return [
    [R(x - w * 0.09, b - 4, w * 0.18, trunkH + 4), wood],
    [tier(x, b - H * 0.62, b, w / 2, 4), col],
    [tier(x, b - H * 0.82, b - H * 0.34, w * 0.39, 3), col2],
    [tier(x, b - H, b - H * 0.62, w * 0.27, 2), col],
  ];
}

// A round autumn tree: trunk, crown and a lighter patch of leaves.
function roundTree(x, base, rx, ry, col, col2, wood, side = 1) {
  const cy = base - 46 - ry;
  return [
    [R(x - 13, cy + ry * 0.6, 26, base - cy - ry * 0.6), wood],
    [blob(x, cy, rx, ry, 9, 0.22, 0.3), col],
    [blob(x + side * rx * 0.4, cy + ry * 0.34, rx * 0.62, ry * 0.52, 7, 0.24, 0.2), col2],
  ];
}

// A swimming duck, facing left, about 270 wide at size 1.
function duck(c) {
  const body = sm([[-86, -4], [-92, 20], [-72, 42], [-20, 52], [40, 48], [84, 30], [108, -2], [124, -30], [96, -22], [70, -28], [20, -34], [-40, -30], [-70, -22]]);
  const wing = sm([[-34, -4], [0, -22], [50, -20], [94, -6], [60, 16], [10, 24], [-24, 14]]);
  return [
    ['M112 -24C122 -44 138 -44 136 -30', null],
    [poly(body), c.body],
    ...(c.chest !== c.body ? [[poly(inter(body, elp(-104, 16, 70, 84))), c.chest]] : []),
    [poly(wing), c.wing],
    ...(c.patch !== c.wing ? [[poly(inter(wing, elp(104, 2, 56, 46))), c.patch]] : []),
    ['M-10 4C8 10 22 10 34 6', null],
    ['M-106 -40C-106 -22 -98 -8 -88 2L-46 -16C-54 -26 -58 -38 -58 -48Z', c.neck],
    ['M-104 -76C-128 -78 -150 -70 -154 -60C-144 -52 -124 -50 -102 -54Z', c.beak],
    [ov(-80, -66, 33, 31), c.head],
    [ov(-92, -72, 7), '#ffffff'], [ov(-93, -72, 3), '#3a2b6b'],
    ['M-128 62C-108 72 -88 72 -68 62', null], ['M40 64C60 74 84 74 104 62', null],
  ];
}

function duckling(yel, ora) {
  return [
    [ov(8, 6, 37, 26), yel],
    ['M0 2C14 -9 34 -5 40 6C30 19 8 18 0 2Z', ora],
    ['M-46 -34L-68 -26L-46 -18Z', ora],
    [ov(-30, -26, 22), yel],
    [ov(-38, -31, 3.5), '#3a2b6b'],
    ['M-40 40C-26 48 -8 48 6 40', null],
  ];
}

function lilyPad(x, y, a, b, col) {
  return [[ov(x, y, a, b), col], [`M${x} ${y}L${n1(x + a * 0.8)} ${n1(y - b * 0.55)}`, null]];
}

function mushroom(x, y, s, cap, stem) {
  return put([
    ['M-13 0C-15 -30 -11 -50 -9 -62L9 -62C11 -50 15 -30 13 0Z', stem],
    ['M-50 -56C-48 -104 48 -104 50 -56C22 -46 -22 -46 -50 -56Z', cap],
    [ov(-22, -72, 7), '#ffffff'], [ov(6, -84, 7), '#ffffff'], [ov(26, -66, 6), '#ffffff'],
  ], x, y, s);
}

// An open umbrella lying on its side.
function umbrella(x, y, s, rot, colA, colB) {
  const xs = [-110, -55, 0, 55, 110];
  const out = [['M0 0L0 74C0 92 26 92 26 74', null], ['M0 -90L0 -106', null]];
  for (let i = 0; i < 4; i++) {
    const a = xs[i], b = xs[i + 1];
    out.push([`M0 -90Q${a * 0.96} -88 ${a} 0Q${(a + b) / 2} -22 ${b} 0Q${b * 0.96} -88 0 -90Z`, i % 2 ? colB : colA]);
  }
  return put(out, x, y, s, rot);
}

function squirrel(x, y, s, fur, belly, nut, cap) {
  return put([
    [curve([[18, -8], [62, -4], [98, -40], [104, -92], [90, -134], [106, -164], [78, -180], [46, -158], [38, -108], [46, -64], [30, -34]]), fur],
    ['M88 -164C72 -160 64 -146 68 -128', null], ['M84 -40C90 -60 90 -80 84 -98', null],
    [ov(-18, -6, 24, 9), fur],
    [ov(-2, -44, 30, 42, 8), fur],
    [ov(-13, -40, 14, 26, 6), belly],
    [ov(8, -20, 22, 20), fur],
    ['M-4 -112L4 -146L20 -116Z', fur], ['M-32 -112L-28 -142L-12 -118Z', fur],
    [curve([[-50, -90], [-40, -110], [-16, -122], [8, -114], [16, -92], [4, -74], [-22, -68], [-42, -76]]), fur],
    [ov(-22, -99, 5), '#3a2b6b'], [ov(-50, -90, 4.5), '#3a2b6b'],
    ['M-44 -80C-38 -76 -32 -76 -28 -80', null],
    [ov(-46, -52, 11, 13), nut], ['M-58 -56C-58 -70 -34 -70 -34 -56Z', cap],
    [ov(-28, -54, 15, 8, 25), fur],
  ], x, y, s);
}

const park = () => {
  const SKYC = '#d6eefc', WHITE = '#ffffff', YEL = '#ffd447', ORA = '#ff9a3c', RED = '#e8553f', BANK = '#d3dc7a', NEAR = '#a9cf62',
    GRN = '#3f9e6a', WATER = '#7cc8f0', BRN = '#a9744a', DBRN = '#7a5236', STONE = '#e4ded6', GREY = '#bdb6c4', INK = '#3a2b6b',
    BLUE = '#5aa9f5', TAN = '#e3b888';
  const s = [bg(SKYC)];
  s.push([O(884, 92, 50), YEL], [cloudD(964, 118, 66), WHITE], [cloudD(1130, 70, 40), WHITE]);
  // Birds flying south.
  for (const [x, y] of [[540, 64], [600, 98], [486, 104], [662, 132], [430, 144]]) s.push([`M${x - 20} ${y - 6}Q${x - 10} ${y - 16} ${x} ${y}Q${x + 10} ${y - 16} ${x + 20} ${y - 6}`, null]);
  // Far trees.
  s.push(...roundTree(70, 470, 96, 80, ORA, YEL, DBRN, -1), ...fir(220, 470, 124, 226, GRN, DBRN));
  s.push(...roundTree(350, 466, 84, 78, RED, ORA, DBRN), ...roundTree(500, 462, 92, 90, YEL, ORA, DBRN, -1), ...roundTree(684, 466, 84, 74, ORA, RED, DBRN));
  s.push(...fir(790, 470, 120, 230, GRN, DBRN), ...roundTree(900, 470, 86, 76, RED, YEL, DBRN, -1), ...roundTree(1066, 468, 80, 86, YEL, ORA, DBRN), ...roundTree(1180, 474, 70, 70, ORA, RED, DBRN, -1));
  // Far bank and the pond with an inlet under the bridge.
  s.push(['M-10 452C300 436 800 444 1210 456L1210 910L-10 910Z', BANK]);
  s.push(['M-10 596C90 590 200 580 248 552C262 500 300 474 420 474C540 474 578 500 592 552C650 580 730 566 790 534C880 492 1040 488 1210 512L1210 910L-10 910Z', WATER]);
  s.push(['M330 506C350 500 370 500 390 506', null], ['M440 522C464 516 488 516 512 522', null]);
  // Park lamp.
  s.push([R(1000, 296, 20, 196), GREY], [R(990, 476, 40, 24, 6), INK], [poly([[986, 246], [1034, 246], [1026, 298], [994, 298]]), YEL], [poly([[974, 248], [1010, 216], [1046, 248]]), INK]);
  // Stone bridge.
  const yTop = x => { const u = (x - 120) / 600; return 478 - 416 * u * (1 - u); };
  const top = [], low = [];
  for (let i = 0; i <= 30; i++) { const x = 120 + i * 20; top.push([x, yTop(x)]); low.push([x, yTop(x) + 36]); }
  const arch = [];
  for (let i = 0; i <= 30; i++) { const a = (i / 30) * Math.PI; arch.push([420 + 180 * Math.cos(a), 548 - 100 * Math.sin(a)]); }
  s.push([poly([...low, [720, 548], ...arch, [120, 548]]), STONE]);
  for (let i = 0; i < 9; i++) {
    const inn = [], outr = [];
    for (let j = 0; j <= 6; j++) {
      const a = ((i + j / 6) / 9) * Math.PI;
      inn.push([420 + 180 * Math.cos(a), 548 - 100 * Math.sin(a)]);
      outr.push([420 + 214 * Math.cos(a), 548 - 150 * Math.sin(a)]);
    }
    s.push([poly([...inn, ...outr.reverse()]), i % 2 ? STONE : GREY]);
  }
  s.push(['M136 530L176 530', null], ['M150 508L184 508', null], ['M664 530L704 530', null], ['M656 508L690 508', null]);
  s.push([poly([...top, ...low.slice().reverse()]), GREY]);
  for (const x of [120, 270, 420, 570, 720]) {
    const y = yTop(x);
    s.push([R(x - 13, n1(y - 24), 26, 68), STONE], [O(x, n1(y - 33), 13), GREY]);
  }
  // Life on the pond.
  s.push(...put(duck({ body: WHITE, chest: WHITE, wing: STONE, patch: STONE, neck: WHITE, head: WHITE, beak: ORA }), 1040, 556, 0.5, 0, -1));
  s.push(...lilyPad(664, 746, 58, 21, GRN), ...lilyPad(784, 744, 40, 15, GRN), ...lilyPad(84, 648, 46, 18, GRN));
  s.push([petal(664, 742, 46, 22, rad(-150)), WHITE], [petal(664, 742, 46, 22, rad(-30)), WHITE], [petal(664, 744, 54, 24, rad(-90)), WHITE], [O(664, 740, 10), YEL]);
  s.push(['M276 600L356 600L340 624L292 624Z', WHITE], ['M316 556L340 600L292 600Z', WHITE], ['M316 556L316 600', null], ['M270 640C290 648 340 648 362 640', null]);
  s.push(...put(duck({ body: STONE, chest: BRN, wing: GREY, patch: BLUE, neck: WHITE, head: GRN, beak: YEL }), 850, 628, 1));
  s.push(...put(duck({ body: TAN, chest: TAN, wing: BRN, patch: DBRN, neck: BRN, head: BRN, beak: ORA }), 490, 668, 0.82, 0, -1));
  s.push(...put(duckling(YEL, ORA), 340, 706, 1, 0, -1), ...put(duckling(YEL, ORA), 246, 716, 0.94, 0, -1), ...put(duckling(YEL, ORA), 158, 706, 0.9, 0, -1));
  // Reeds on the right shore.
  s.push(['M1168 720C1166 660 1172 600 1168 560', null], ['M1196 720C1198 670 1192 640 1196 600', null]);
  s.push([R(1158, 520, 22, 62, 11), DBRN], [R(1186, 566, 20, 54, 10), DBRN]);
  // Near bank.
  s.push(['M-10 792C200 764 480 800 700 786C900 774 1080 756 1210 770L1210 910L-10 910Z', NEAR]);
  // Bench with a squirrel.
  s.push([R(866, 836, 22, 50), DBRN], [R(1112, 836, 22, 50), DBRN]);
  s.push([R(840, 730, 320, 30, 6), BRN], [R(840, 760, 320, 30, 6), TAN], [R(840, 790, 320, 30, 6), BRN], [R(826, 818, 348, 26, 8), TAN]);
  s.push(...squirrel(1030, 822, 1.1, ORA, WHITE, BRN, DBRN));
  // Umbrella, mushrooms and fallen leaves.
  s.push(...umbrella(530, 820, 0.92, -28, RED, YEL));
  s.push(...mushroom(120, 880, 1.05, RED, TAN), ...mushroom(204, 890, 0.72, RED, TAN));
  s.push(...maple(300, 850, 0.8, -30, ORA), ...maple(370, 876, 0.7, 40, YEL), ...maple(736, 860, 0.74, 20, ORA));
  // A maple branch with big leaves, and leaves in the wind.
  s.push(['M-10 26C100 34 230 60 340 124L330 142C226 88 100 66 -10 62Z', BRN]);
  s.push(...maple(60, 122, 1.2, 172, RED), ...maple(168, 136, 1.16, 196, ORA), ...maple(276, 166, 1.1, 166, YEL), ...maple(136, 40, 0.9, 20, YEL));
  s.push(...maple(404, 214, 0.8, -40, YEL), ...maple(742, 206, 0.8, 30, RED), ...maple(1140, 196, 0.8, -20, ORA), ...maple(436, 592, 0.66, 80, YEL));
  return { id: 'nature2-autumn-park', title: 'Осенний парк с прудом', shapes: s };
};

// ---------- 3. Camp by a mountain lake ----------
// A fir without a trunk: three scalloped layers.
function pine(x, base, w, h, col) {
  return [
    [tier(x, base - h * 0.62, base, w / 2, 4), col],
    [tier(x, base - h * 0.84, base - h * 0.36, w * 0.39, 3), col],
    [tier(x, base - h, base - h * 0.64, w * 0.27, 2), col],
  ];
}

function owl(x, y, s, c) {
  const both = (d, f) => [[d, f], [tf(d, 0, 0, 1, 0, -1), f]];
  return put([
    [ov(-14, 0, 10, 6), c.beak], [ov(14, 0, 10, 6), c.beak],
    [ov(0, -50, 42, 50), c.body],
    [ov(0, -38, 25, 34), c.belly],
    ['M-8 -46L0 -40L8 -46', null], ['M-8 -30L0 -24L8 -30', null],
    ...both('M-40 -66C-60 -44 -54 -14 -34 -4C-28 -24 -30 -48 -40 -66Z', c.wing),
    ...both('M-42 -104L-38 -140L-12 -122Z', c.body),
    [ov(0, -98, 46, 34), c.body],
    [ov(-19, -98, 18), '#ffffff'], [ov(19, -98, 18), '#ffffff'], [ov(-12, -97, 4), '#3a2b6b'], [ov(12, -97, 4), '#3a2b6b'],
    ['M-7 -90L7 -90L0 -76Z', c.beak],
  ], x, y, s);
}

const FLAME = 'M-48 0C-78 -30 -70 -84 -40 -112C-40 -92 -30 -82 -18 -84C-30 -124 -6 -160 16 -184C14 -150 34 -132 44 -108C50 -96 50 -86 46 -78C58 -84 64 -96 64 -108C86 -70 84 -26 52 0Z';

const camp = () => {
  const SKYC = '#c9c6f7', CREAM = '#fff3c4', YEL = '#ffd447', WHITE = '#ffffff', MT1 = '#a9b4ea', MT2 = '#8792d4', FIR1 = '#2f8f6a',
    FIR2 = '#58b884', LAKE = '#6ec1ee', GRASS = '#8fd28a', ORA = '#ff9a3c', RED = '#e8553f', BRN = '#a9744a', GREY = '#b8bcc8',
    INK = '#3a2b6b', PINK = '#ff8fc7';
  const s = [bg(SKYC)];
  s.push(['M150 58A52 52 0 1 0 150 162A62 62 0 0 1 150 58Z', CREAM]);
  for (const [x, y, r] of [[330, 64, 22], [760, 56, 22], [890, 140, 18], [960, 62, 22], [1140, 250, 18], [60, 250, 18]]) s.push([starD(x, y, r, r * 0.46), YEL]);
  s.push([cloudD(420, 250, 44), WHITE]);
  // An owl on a branch.
  s.push(['M1210 126C1150 130 1090 144 1036 170L1042 188C1094 164 1150 154 1210 152Z', BRN]);
  s.push(...leaf(1068, 160, 52, 26, -128, FIR2));
  s.push(...owl(1128, 146, 0.95, { body: BRN, belly: CREAM, wing: GREY, beak: ORA }));
  // Mountains: a light side, a shaded side and a snow cap each.
  const mountain = (body, shade, snow) => [[poly(body), MT1], [poly(shade), MT2], [poly(snow), WHITE]];
  s.push(...mountain([[-10, 400], [200, 170], [420, 470], [-10, 470]], [[200, 170], [196, 300], [232, 360], [208, 420], [250, 470], [420, 470]],
    [[126, 251], [200, 170], [277, 275], [246, 298], [222, 268], [196, 302], [166, 266], [150, 286]]));
  s.push(...mountain([[760, 470], [1010, 190], [1210, 400], [1210, 470]], [[1010, 190], [1004, 300], [1040, 360], [1016, 420], [1060, 470], [1210, 470], [1210, 400]],
    [[930, 280], [1010, 190], [1080, 264], [1054, 292], [1030, 262], [1004, 302], [976, 270], [956, 298]]));
  s.push(...mountain([[250, 470], [600, 100], [960, 470]], [[600, 100], [606, 252], [652, 330], [622, 400], [680, 470], [960, 470]],
    [[495, 211], [600, 100], [708, 211], [672, 242], [640, 208], [606, 254], [570, 214], [536, 248]]));
  // Far shore with firs.
  s.push(['M-10 474C200 446 400 464 600 456C800 448 1000 466 1210 450L1210 540L-10 540Z', FIR2]);
  s.push(...pine(36, 492, 96, 150, FIR1), ...pine(126, 496, 110, 190, FIR2), ...pine(226, 492, 96, 140, FIR1));
  s.push(...pine(860, 492, 90, 130, FIR1), ...pine(950, 496, 110, 180, FIR2), ...pine(1058, 492, 96, 150, FIR1), ...pine(1150, 496, 110, 200, FIR2));
  // Lake.
  s.push(['M-10 522C300 514 900 514 1210 520L1210 910L-10 910Z', LAKE]);
  s.push(['M560 548C580 542 600 542 620 548', null], ['M640 570C664 564 688 564 712 570', null], ['M770 548C794 542 818 542 842 548', null], ['M60 600C80 594 100 594 120 600', null]);
  s.push(...put([['M-64 0L64 0C54 26 -54 26 -64 0Z', RED], ['M0 0L0 -96', null], ['M6 -92L6 -8L60 -8Z', WHITE], ['M-6 -80L-6 -8L-46 -8Z', CREAM], ['M-84 40C-50 48 50 48 84 40', null]], 1066, 586, 1.05));
  s.push(...put([['M-34 6L-60 -10L-56 22Z', ORA], ['M-38 6C-20 -24 22 -28 42 -6C26 16 -14 24 -38 6Z', ORA], [ov(24, -6, 3.5), INK], ['M6 -16C12 -6 12 4 6 12', null]], 716, 596, 1, -34));
  s.push(['M672 632C690 640 730 640 750 632', null], ['M688 650C702 656 722 656 736 650', null]);
  // Near shore.
  s.push(['M-10 690C200 640 420 650 640 668C860 686 1040 640 1210 652L1210 910L-10 910Z', GRASS]);
  // A little wooden pier.
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  for (let i = 0; i < 5; i++) {
    const L = u => lerp([10, 706], [110, 598], u), Rt = u => lerp([108, 706], [176, 598], u);
    s.push([poly([L(i / 5), Rt(i / 5), Rt((i + 1) / 5), L((i + 1) / 5)]), i % 2 ? GREY : BRN]);
  }
  s.push([R(96, 566, 16, 46, 6), BRN], [R(170, 566, 16, 46, 6), BRN]);
  // Tent.
  s.push([poly([[300, 440], [520, 470], [690, 760], [490, 790]]), RED], [poly([[441, 700], [646, 685.5], [671, 727], [468, 750]]), YEL]);
  s.push([poly([[300, 440], [110, 790], [490, 790]]), ORA], [poly([[159, 700], [441, 700], [468, 750], [132, 750]]), YEL]);
  s.push(['M300 440L300 520', null]);
  s.push([poly([[300, 520], [230, 790], [370, 790]]), INK]);
  s.push([O(272, 700, 13), BRN], [O(328, 700, 13), BRN], [O(300, 726, 31), BRN], [ov(300, 739, 19, 14), CREAM], [O(288, 718, 4), INK], [O(312, 718, 4), INK], [O(300, 733, 3.5), INK]);
  s.push(['M240 790C246 752 354 752 360 790Z', PINK]);
  s.push(['M300 520C276 600 254 700 238 790L198 790C226 720 262 620 300 520Z', CREAM], ['M300 520C324 600 346 700 362 790L402 790C374 720 338 620 300 520Z', CREAM]);
  s.push(['M300 440L300 374', null], [poly([[300, 374], [356, 392], [300, 410]]), PINK]);
  // Backpack and lantern.
  s.push([R(546, 686, 108, 36, 18), PINK], [ov(564, 704, 12, 18), CREAM], ['M564 698C570 700 570 708 564 710', null], ['M616 686L616 722', null]);
  s.push([R(552, 718, 96, 114, 24), LAKE], ['M552 762C580 774 620 774 648 762L648 742C648 729 637 718 624 718L576 718C563 718 552 729 552 742Z', MT2]);
  s.push([R(574, 784, 52, 36, 10), PINK], ['M584 797L616 797', null], [R(591, 756, 18, 22, 4), YEL]);
  s.push([R(690, 812, 44, 22, 6), INK], [R(696, 762, 32, 52, 8), YEL], [R(690, 744, 44, 22, 6), INK], ['M698 744C698 716 726 716 726 744', null]);
  // Campfire.
  for (const a of [205, 250, 290, 335]) s.push([ov(880 + 112 * Math.cos(rad(a)), 806 + 34 * Math.sin(rad(a)), 23, 16), GREY]);
  s.push([tf(FLAME, 880, 800, 0.98), RED], [tf(FLAME, 882, 800, 0.66), ORA], [tf(FLAME, 883, 800, 0.36), YEL]);
  s.push([tf('M-80 -15L80 -15L80 15L-80 15Z', 880, 800, 1, 13), BRN], [tf('M-80 -15L80 -15L80 15L-80 15Z', 880, 800, 1, -13), BRN]);
  for (const a of [20, 65, 115, 160]) s.push([ov(880 + 112 * Math.cos(rad(a)), 806 + 34 * Math.sin(rad(a)), 23, 16), GREY]);
  s.push([O(826, 640, 10), YEL], [O(940, 622, 10), YEL], [O(878, 590, 10), YEL]);
  // A log to sit on, with a mug and a marshmallow on a stick.
  s.push([R(1030, 782, 180, 60, 26), BRN], [ov(1040, 812, 17, 29), CREAM], ['M1040 798C1050 802 1050 822 1040 826', null], ['M1090 800L1150 800', null], ['M1110 824L1190 824', null]);
  s.push(['M1100 784L966 690', null], [ov(960, 688, 16, 13, 25), WHITE]);
  s.push([R(1130, 744, 38, 40, 6), PINK], ['M1168 756C1180 756 1180 772 1168 772', null], ['M1140 734C1134 724 1146 716 1140 706', null], ['M1156 734C1150 724 1162 716 1156 706', null]);
  // Mushrooms and flowers.
  s.push(...mushroom(70, 880, 1, RED, CREAM), ...mushroom(150, 892, 0.7, RED, CREAM));
  // A hedgehog carrying an apple.
  s.push(...put([
    [ov(-10, -66, 15), RED], ['M-10 -80C-9 -85 -6 -88 -2 -89', null],
    ['M-44 0L-54 -14L-42 -18L-50 -34L-34 -34L-36 -50L-20 -44L-14 -60L-2 -48L8 -58L16 -44L28 -48L30 -34L42 -32L38 -20C44 -10 44 -4 40 0Z', BRN],
    ['M22 -32C42 -32 60 -18 72 -6C60 2 42 2 22 0Z', CREAM],
    [ov(72, -7, 5), INK], [ov(46, -17, 3.5), INK], [ov(-22, 2, 10, 5), INK], [ov(20, 2, 10, 5), INK],
  ], 250, 888, 1.12));
  s.push(...daisy(470, 858, 40, 5, WHITE, YEL, 0.34, 0.42, 0.3), ...daisy(398, 870, 34, 5, PINK, YEL, 0.36, 0.42), ...daisy(790, 868, 34, 5, PINK, YEL, 0.36, 0.42, 0.5));
  return { id: 'nature2-mountain-camp', title: 'Палатка у горного озера', shapes: s };
};

// ---------- 4. Tropical island ----------
const bez = (a, b, c, d, u) => {
  const v = 1 - u;
  return [0, 1].map(i => v * v * v * a[i] + 3 * v * v * u * b[i] + 3 * v * u * u * c[i] + u * u * u * d[i]);
};
// A palm leaf 100 long, growing to the right, with a fringed lower edge.
const FROND = (() => {
  const up = u => bez([0, 0], [30, -36], [80, -30], [100, 10], u);
  const lo = u => bez([100, 10], [75, 8], [35, 6], [0, 0], u);
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push(up(i / 12));
  for (let k = 1; k <= 9; k++) {
    const a = lo(k / 10), b = up(1 - k / 10);
    pts.push(k % 2 ? [a[0] + (b[0] - a[0]) * 0.5, a[1] + (b[1] - a[1]) * 0.5] : a);
  }
  return poly(pts);
})();

// A palm: a curved trunk made of rings, a crown of leaves and coconuts.
function palm(P0, P1, P2, w0, w1, n, c) {
  const at = u => { const v = 1 - u; return [v * v * P0[0] + 2 * v * u * P1[0] + u * u * P2[0], v * v * P0[1] + 2 * v * u * P1[1] + u * u * P2[1]]; };
  const edge = (u, side) => {
    const dx = (1 - u) * (P1[0] - P0[0]) + u * (P2[0] - P1[0]), dy = (1 - u) * (P1[1] - P0[1]) + u * (P2[1] - P1[1]);
    const len = Math.hypot(dx, dy), w = (w0 + (w1 - w0) * u) / 2, p = at(u);
    return [p[0] - (dy / len) * w * side, p[1] + (dx / len) * w * side];
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const pts = [];
    for (let j = 0; j <= 4; j++) pts.push(edge((i + j / 4) / n, 1));
    for (let j = 4; j >= 0; j--) pts.push(edge((i + j / 4) / n, -1));
    out.push([poly(pts), i % 2 ? c.wood2 : c.wood]);
  }
  const [x, y] = P2;
  const fr = (len, rot, flip, col) => out.push([tf(FROND, x, y, len / 100, rot, flip), col]);
  fr(176, 26, 1, c.leaf); fr(176, -26, -1, c.leaf);
  fr(200, -10, 1, c.leaf2); fr(200, 10, -1, c.leaf2);
  fr(180, -46, 1, c.leaf); fr(180, 46, -1, c.leaf);
  fr(150, -92, 1, c.leaf2);
  out.push([O(x - 18, y + 16, 19), c.nut], [O(x + 18, y + 18, 19), c.nut], [O(x, y - 2, 19), c.nut]);
  return out;
}

function parrot(c) {
  const wing = sm([[-8, -58], [32, -66], [60, -32], [66, 30], [54, 90], [36, 134], [14, 92], [-8, 32], [-16, -18]]);
  return {
    tail: [[petal(24, 70, 250, 27, rad(80)), c.wing3], [petal(4, 70, 236, 27, rad(98)), c.wing2], [petal(14, 70, 262, 27, rad(89)), c.body]],
    bird: [
      [ov(0, 0, 62, 100, 8), c.body],
      [poly(wing), c.wing3],
      [poly(inter(wing, elp(25, -100, 86, 158))), c.wing2],
      [poly(inter(wing, elp(25, -100, 80, 96))), c.body],
      ['M26 70L30 112', null], ['M42 66L44 100', null],
      [ov(-14, -112, 51, 47), c.body],
      [ov(-34, -114, 25, 27), '#ffffff'],
      ['M-54 -138C-90 -142 -106 -112 -96 -78C-90 -92 -78 -100 -62 -98C-52 -100 -50 -122 -54 -138Z', c.beak],
      ['M-64 -98C-74 -92 -82 -84 -84 -72C-68 -70 -56 -80 -54 -96Z', c.beak2],
      [ov(-32, -118, 8), '#3a2b6b'],
      [ov(-22, 98, 15, 11), c.beak2], [ov(14, 98, 15, 11), c.beak2],
    ],
  };
}

function dolphin(body, belly) {
  return [
    ['M14 -40C6 -64 -10 -76 -32 -78C-22 -62 -22 -48 -24 -34Z', body],
    ['M-82 22C-98 6 -118 0 -136 4C-124 14 -120 24 -122 34C-124 46 -130 54 -138 60C-116 62 -98 52 -82 38Z', body],
    [curve([[126, 6], [104, -4], [92, -20], [60, -38], [10, -44], [-40, -30], [-74, -2], [-94, 26], [-82, 38], [-44, 20], [20, 12], [74, 14], [104, 12]]), body],
    ['M100 10C72 18 20 12 -44 20C0 -6 60 -8 100 10Z', belly],
    ['M34 12C28 30 16 40 2 44C8 30 10 20 12 12Z', body],
    [ov(84, -10, 4), '#3a2b6b'], ['M98 4C106 8 114 8 122 6', null],
  ];
}

function turtle(shell, rim, skin, spot) {
  const dome = sm([[-58, 20], [-56, -12], [-30, -38], [0, -44], [30, -38], [56, -12], [58, 20], [0, 22]], 6);
  return [
    ['M-40 12C-62 22 -78 38 -82 54C-62 52 -44 42 -28 26Z', skin], ['M38 14C54 26 64 40 66 52C50 50 38 42 28 28Z', skin],
    ['M56 8L78 14L58 18Z', skin],
    [ov(-70, -8, 22, 17), skin], [ov(-78, -12, 3.5), '#3a2b6b'], ['M-86 -2C-82 2 -76 2 -72 0', null],
    ...stripes(dome, [0, 0], 90, [0], [shell, rim]),
    [ov(0, -20, 16, 13), spot], [ov(-32, -12, 11, 10), spot], [ov(32, -12, 11, 10), spot],
  ];
}

function crab(body) {
  return [
    ['M-36 10L-62 22', null], ['M-38 0L-66 4', null], ['M36 10L62 22', null], ['M38 0L66 4', null], ['M-28 20L-46 38', null], ['M28 20L46 38', null],
    ['M-34 -14C-46 -22 -54 -30 -58 -40', null], ['M34 -14C46 -22 54 -30 58 -40', null],
    [ov(-62, -50, 19, 16, -20), body], [ov(62, -50, 19, 16, 20), body], ['M-74 -60L-60 -50L-58 -66', null], ['M74 -60L60 -50L58 -66', null],
    ['M-14 -24L-16 -44', null], ['M14 -24L16 -44', null],
    [ov(0, 0, 46, 30), body],
    [ov(-16, -48, 8), '#ffffff'], [ov(16, -48, 8), '#ffffff'], [ov(-16, -48, 3.5), '#3a2b6b'], [ov(16, -48, 3.5), '#3a2b6b'],
    ['M-12 6C-6 14 6 14 12 6', null],
  ];
}

const island = () => {
  const SKYC = '#bdeaff', WHITE = '#ffffff', YEL = '#ffd447', ORA = '#ff9a3c', SEA = '#4db8e8', LAGOON = '#7fe0d6', SAND = '#f6dc9a',
    WOOD = '#b9794a', WOOD2 = '#d9a066', LEAF = '#3fae62', LEAF2 = '#8ed660', RED = '#ee4d40', BLUE = '#3f7fe8', PINK = '#ff8fc7',
    INK = '#3a2b6b', PUR = '#a97bf0';
  const s = [bg(SKYC)];
  s.push(...sun(1064, 112, 60, YEL, ORA));
  s.push([cloudD(120, 96, 62), WHITE], [cloudD(540, 66, 42), WHITE]);
  for (const [x, y] of [[90, 250], [150, 290], [1010, 250]]) s.push([`M${x - 22} ${y - 6}Q${x - 11} ${y - 18} ${x} ${y}Q${x + 11} ${y - 18} ${x + 22} ${y - 6}`, null]);
  // Sea, a far sailing boat, the lagoon and a dolphin.
  s.push(['M-10 400L1210 400L1210 910L-10 910Z', SEA]);
  s.push(...put([['M-64 0L64 0C54 26 -54 26 -64 0Z', RED], ['M0 0L0 -96', null], ['M6 -92L6 -8L60 -8Z', WHITE], ['M-6 -80L-6 -8L-46 -8Z', YEL]], 110, 400, 0.8));
  s.push(['M-10 524Q65 510 140 524Q215 538 290 524Q365 510 440 524Q515 538 590 524Q665 510 740 524Q815 538 890 524Q965 510 1040 524Q1115 538 1210 524L1210 910L-10 910Z', LAGOON]);
  s.push(['M40 452C60 446 80 446 100 452', null], ['M820 440C844 434 868 434 892 440', null], ['M1090 470C1114 464 1138 464 1162 470', null]);
  s.push(...put(dolphin(BLUE, WHITE), 238, 452, 1.05, -26), ['M96 540C116 528 136 528 152 538', null], ['M300 548C320 536 344 538 356 548', null]);
  const smallFish = (x, y, k, col, flip) => put([['M22 0L56 -22L48 0L56 22Z', col], [ov(0, 0, 30, 18), col], [ov(-14, -4, 3.5), INK]], x, y, k, 0, flip);
  s.push(...smallFish(1126, 596, 1, ORA, 1), ...smallFish(1160, 668, 0.9, YEL, -1), ...smallFish(70, 640, 0.95, PINK, -1));
  // The island with a rim of foam.
  const rim = [];
  for (const [a, b, c, d] of [[[26, 910], [72, 742], [250, 612], [470, 582]], [[470, 582], [650, 560], [838, 594], [980, 676]], [[980, 676], [1102, 746], [1178, 846], [1208, 910]]]) {
    for (let i = 0; i < 40; i++) rim.push(bez(a, b, c, d, i / 40));
  }
  rim.push([1208, 910]);
  let len = 0;
  const at = [0];
  for (let i = 1; i < rim.length; i++) at.push(len += Math.hypot(rim[i][0] - rim[i - 1][0], rim[i][1] - rim[i - 1][1]));
  const nb = Math.round(len / 54);
  const onRim = dist => {
    let i = 1;
    while (i < rim.length - 1 && at[i] < dist) i++;
    const u = (dist - at[i - 1]) / (at[i] - at[i - 1] || 1);
    return [rim[i - 1][0] + (rim[i][0] - rim[i - 1][0]) * u, rim[i - 1][1] + (rim[i][1] - rim[i - 1][1]) * u];
  };
  let foam = 'M26 910';
  for (let i = 0; i < nb; i++) {
    const a = onRim((len * i) / nb), b = onRim((len * (i + 1)) / nb), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    foam += `Q${pt([(a[0] + b[0]) / 2 + (dy / l) * 24, (a[1] + b[1]) / 2 - (dx / l) * 24])} ${pt(b)}`;
  }
  s.push([`${foam}Z`, WHITE]);
  s.push(['M60 910C100 760 260 640 470 610C640 590 820 620 960 700C1080 770 1150 850 1180 910Z', SAND]);
  // Palms and a hammock.
  const pc = { wood: WOOD, wood2: WOOD2, leaf: LEAF, leaf2: LEAF2, nut: WOOD };
  s.push(...palm([440, 664], [452, 430], [330, 252], 48, 30, 7, pc), ...palm([640, 644], [618, 380], [742, 184], 50, 30, 8, pc));
  const TUFT = 'M-40 0L-30 -26L-18 -6L-6 -32L6 -6L20 -28L30 -4L40 0Z';
  s.push([tf(TUFT, 440, 672), LEAF2], [tf(TUFT, 640, 652), LEAF2]);
  const ham = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24, v = 1 - u; ham.push([v * v * 423 + 2 * v * u * 535 + u * u * 646, v * v * 463 + 2 * v * u * 520 + u * u * 442]); }
  for (let i = 23; i >= 1; i--) { const u = i / 24, v = 1 - u; ham.push([v * v * 423 + 2 * v * u * 535 + u * u * 646, v * v * 463 + 2 * v * u * 640 + u * u * 442]); }
  s.push(...stripes(ham, [0, 0], 0, [468, 512, 556, 600], [PINK, PUR, PINK, PUR, PINK]));
  // A surfboard standing in the sand.
  s.push(...put(stripes(clip(elp(0, 0, 34, 120), q => q[1] - 92), [0, 0], 90, [-44, 12], [ORA, WHITE, BLUE]), 838, 600, 1, 7), ['M776 700C790 672 874 672 888 700Z', SAND]);
  // The parrot on its perch.
  const pr = parrot({ body: RED, wing2: YEL, wing3: BLUE, beak: YEL, beak2: INK });
  s.push([R(970, 560, 28, 300), WOOD2]);
  s.push(...put(pr.tail, 996, 452));
  s.push([R(876, 548, 216, 28, 14), WOOD]);
  s.push(...put(pr.bird, 996, 452));
  // Treasure chest and coins.
  s.push([R(214, 780, 150, 68, 6), WOOD2], [R(236, 786, 22, 62), WOOD], [R(320, 786, 22, 62), WOOD], ['M214 780C214 720 364 720 364 780Z', WOOD], [R(206, 768, 166, 24, 6), YEL], [O(289, 782, 16), ORA], ['M289 776L289 788', null]);
  s.push([O(396, 836, 14), YEL], [O(330, 874, 14), YEL], [O(432, 862, 14), YEL]);
  // A sandcastle.
  const tower = (x, w, top, base) => {
    const u = w / 5;
    return `M${x} ${base}L${x} ${top - 10}L${x + u} ${top - 10}L${x + u} ${top}L${x + 2 * u} ${top}L${x + 2 * u} ${top - 10}L${x + 3 * u} ${top - 10}L${x + 3 * u} ${top}L${x + 4 * u} ${top}L${x + 4 * u} ${top - 10}L${x + w} ${top - 10}L${x + w} ${base}Z`;
  };
  s.push(['M450 724L450 692', null], ['M450 690L484 701L450 713Z', PINK]);
  s.push([tower(432, 36, 734, 800), WOOD2], [R(408, 764, 84, 36), WOOD2], [tower(388, 34, 752, 800), WOOD2], [tower(478, 34, 752, 800), WOOD2]);
  s.push(['M439 800L439 786C439 772 461 772 461 786L461 800Z', WOOD], [ov(405, 772, 4, 6), INK], [ov(495, 772, 4, 6), INK]);
  // A coconut drink with a little umbrella.
  s.push(...put([['M8 -2L28 -56', null], ['M-36 0C-36 46 36 46 36 0Z', WOOD], [ov(0, 0, 36, 11), WHITE], ['M-12 -2L-18 -40', null],
    ['M-52 -34L-20 -72L-18 -38Z', PINK], ['M-20 -72L16 -50L-18 -38Z', YEL]], 596, 742, 1));
  // Turtle, crab, starfish and a shell.
  s.push(...put(turtle(LEAF, LEAF2, LEAF2, YEL), 800, 770, 1.25));
  s.push(...put(crab(RED), 552, 862, 0.82));
  s.push([starD(672, 846, 42, 19, 5, -1.2), ORA]);
  s.push(...put([['M-10 30L-40 -4C-40 -30 -14 -40 0 -40C14 -40 40 -30 40 -4L10 30Z', PINK], ['M0 22L0 -30', null], ['M-4 22L-22 -22', null], ['M4 22L22 -22', null]], 880, 858, 0.9, 12));
  // Flowers in the corners.
  s.push(...leaf(30, 900, 170, 64, -62, LEAF), ...leaf(40, 900, 150, 60, -18, LEAF2), ...poppy(72, 796, 1.16, PINK, YEL, 10));
  s.push(...leaf(1170, 900, 160, 62, -118, LEAF), ...leaf(1180, 904, 140, 58, -160, LEAF2), ...poppy(1136, 800, 1.12, PUR, YEL, 30));
  return { id: 'nature2-tropical-island', title: 'Тропический остров с попугаем', shapes: s };
};

export default [garden(), park(), camp(), island()];
