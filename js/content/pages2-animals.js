// Detailed coloring pages about animals: whole scenes with many small things to find.
// Shapes are built from dense point outlines, so they can be cut into bands and
// patches that meet exactly and every area stays properly closed.
import { O, R, starD, heartD, cloudD, flower, bg, DARK } from '../art.js';

const f1 = v => +v.toFixed(1);
const rad = a => (a * Math.PI) / 180;

// ---------- Outline kit ----------
// Dense points along a smooth curve through the given points.
function sp(pts, closed = true, k = 8) {
  const n = pts.length, out = [];
  const at = i => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
function elp(cx, cy, rx, ry, rot = 0, n = 36) {
  const a = rad(rot), c = Math.cos(a), s = Math.sin(a), out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 6.2832, u = Math.cos(t) * rx, v = Math.sin(t) * ry;
    out.push([cx + u * c - v * s, cy + u * s + v * c]);
  }
  return out;
}
const D = (pts, closed = true) => `M${pts.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L')}${closed ? 'Z' : ''}`;
const B = pts => D(sp(pts));                       // smooth closed blob
const L = pts => D(sp(pts, false), false);         // smooth open line
const P = pts => D(pts);                           // straight-edged polygon
const el = (cx, cy, rx, ry, rot = 0) => D(elp(cx, cy, rx, ry, rot));
const box = (x, y, w, h) => `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}Z`;

// Keeps the part of an outline where f(point) <= 0.
function clip(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const a = f(p), b = f(q);
    if (a <= 0) out.push(p);
    if ((a <= 0) !== (b <= 0)) { const t = a / (a - b); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
// Cuts an outline into bands across the direction `deg`, at the given distances from `o`.
function bands(poly, o, deg, cuts) {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
  const pos = p => (p[0] - o[0]) * c + (p[1] - o[1]) * s;
  const edges = [-1e6, ...cuts, 1e6];
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const part = clip(clip(poly, p => edges[i] - pos(p)), p => pos(p) - edges[i + 1]);
    if (part.length > 2) out.push(part);
  }
  return out;
}
const striped = (poly, o, deg, cuts, cols) => bands(poly, o, deg, cuts).map((b, i) => [D(b), cols[i % cols.length]]);

// Moves a path made only of absolute M, L, C, Q and Z commands.
function move(d, x, y, s = 1, flip = 1, rot = 0) {
  const a = rad(rot), c = Math.cos(a), n = Math.sin(a);
  return d.replace(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g, (_, u, v) => {
    const px = +u * s * flip, py = +v * s;
    return `${f1(x + px * c - py * n)} ${f1(y + px * n + py * c)}`;
  });
}
const place = (shapes, x, y, s = 1, flip = 1, rot = 0) => shapes.filter(Boolean).map(([d, c]) => [move(d, x, y, s, flip, rot), c]);
const mir = d => move(d, 0, 0, 1, -1);
const both = (d, c) => [[d, c], [mir(d), c]];

// A pointed leaf lying along +x from 0,0.
const leafPts = (len, w) => sp([[0, 0], [len * 0.22, -w * 0.78], [len * 0.55, -w], [len * 0.85, -w * 0.5], [len, 0], [len * 0.85, w * 0.5], [len * 0.55, w], [len * 0.22, w * 0.78]], true, 6);
// A leaf with a midrib: two halves that can take two greens.
function leaf2(x, y, len, w, deg, c1, c2 = c1) {
  const pts = leafPts(len, w);
  const up = clip(pts, p => p[1]), down = clip(pts, p => -p[1]);
  return place([[D(up), c1], [D(down), c2]], x, y, 1, 1, deg);
}
const leaf1 = (x, y, len, w, deg, c) => place([[D(leafPts(len, w)), c]], x, y, 1, 1, deg);
const dot = (x, y, r = 6.5) => [el(x, y, r, r), DARK];

// ================= 1. Jungle =================
const J = { sky: '#c9f0e4', far: '#9bdcb0', mid: '#5fbf6a', deep: '#2f9a5a', lime: '#b8e068', water: '#6fc1ee', rock: '#c9a27a', wood: '#9a6238',
  red: '#f0483e', orange: '#ff9a3d', yellow: '#ffd447', blue: '#3f7fe0', pink: '#ff8fc7', white: '#ffffff' };

// A big parrot sitting on a branch, feet at 0,0, looking right.
function macaw({ body, head = body, wing, tail, beak }) {
  const feather = (x, deg, len, c) => place([[D(leafPts(len, 27)), c]], x, -50, 1, 1, deg);
  return [
    ...feather(-46, 114, 250, tail[0]),
    ...feather(-30, 101, 266, tail[1]),
    ...feather(-14, 88, 250, tail[2]),
    [B([[-8, -204], [48, -172], [64, -100], [44, -30], [0, -8], [-44, -30], [-66, -100], [-50, -172]]), body],
    [B([[-56, -178], [-10, -172], [8, -110], [-6, -38], [-52, 20], [-76, -50], [-80, -120]]), wing[2]],
    [B([[-56, -180], [-10, -174], [6, -124], [-10, -80], [-46, -52], [-74, -88], [-78, -140]]), wing[1]],
    [B([[-56, -182], [-12, -176], [2, -146], [-14, -122], [-46, -108], [-70, -126], [-74, -160]]), wing[0]],
    [el(-20, -3, 16, 11), DARK],
    [el(18, -3, 16, 11), DARK],
    [el(8, -238, 62, 58), head],
    [B([[20, -270], [58, -262], [70, -232], [58, -206], [28, -204], [8, -232]]), '#ffffff'],
    [B([[58, -224], [84, -214], [100, -198], [84, -184], [62, -190], [52, -206]]), DARK],
    [B([[52, -276], [92, -280], [122, -252], [122, -214], [108, -190], [100, -212], [80, -222], [56, -228], [48, -252]]), beak],
    dot(36, -244, 7),
  ];
}

// A toucan with a huge striped beak, feet at 0,0, looking right.
function toucan() {
  const beak = sp([[50, -252], [110, -272], [176, -262], [220, -226], [232, -186], [214, -178], [160, -186], [100, -190], [52, -200]], true, 8);
  return [
    ...place([[D(leafPts(200, 30)), DARK]], -30, -50, 1, 1, 112),
    [B([[-6, -196], [50, -164], [64, -92], [46, -26], [4, -6], [-40, -28], [-64, -100], [-50, -166]]), DARK],
    [B([[-52, -160], [-10, -152], [6, -98], [-10, -40], [-54, -6], [-72, -66], [-74, -116]]), J.blue],
    [el(-20, -3, 16, 11), J.blue],
    [el(18, -3, 16, 11), J.blue],
    [el(8, -224, 58, 54), DARK],
    [B([[14, -252], [50, -246], [66, -196], [66, -128], [40, -92], [10, -112], [-4, -170], [-2, -224]]), '#ffffff'],
    ...striped(beak, [50, -220], 0, [70, 126], [J.orange, J.yellow, J.red]),
    [el(22, -232, 19, 19), J.orange],
    dot(22, -232, 6.5),
  ];
}

const frog = [
  [el(-52, -6, 26, 12), J.mid],
  [el(52, -6, 26, 12), J.mid],
  [el(0, -40, 66, 44), J.mid],
  [el(0, -26, 40, 26), J.lime],
  ...both(el(-34, -86, 25, 25), J.mid),
  ...both(el(-34, -88, 13, 14), DARK),
  [el(-39, -93, 4.5, 4.5), '#ffffff'], [el(29, -93, 4.5, 4.5), '#ffffff'],
  ['M-26 -56Q0 -40 26 -56', null],
  ...both(el(-52, -50, 13, 9.5), J.pink),
];

function butterfly(w1, w2, spot) {
  const up = B([[6, -12], [48, -84], [116, -100], [140, -48], [98, 2], [8, 8]]);
  const low = B([[8, 8], [78, 12], [104, 56], [70, 96], [28, 80], [8, 36]]);
  return [
    ['M-3 -56Q-20 -96 -46 -106M3 -56Q20 -96 46 -106', null],
    ...both(up, w1), ...both(low, w2),
    ...both(el(88, -52, 24, 24), spot),
    ...both(el(62, 52, 18, 18), spot),
    [el(0, 0, 13, 46), DARK],
    [el(0, -54, 15, 15), DARK],
  ];
}

// A big holey leaf growing from 0,0 along +x.
function monstera(x, y, len, deg, c1, c2, hole) {
  const pts = sp([[0, 0], [len * 0.04, -len * 0.3], [len * 0.36, -len * 0.45], [len * 0.76, -len * 0.3], [len, 0], [len * 0.76, len * 0.3], [len * 0.36, len * 0.45], [len * 0.04, len * 0.3]], true, 8);
  const v = f => `M${len * f} 0L${len * (f + 0.1)} ${-len * 0.13}M${len * f} 0L${len * (f + 0.1)} ${len * 0.13}`;
  return place([
    [D(clip(pts, p => p[1])), c1],
    [D(clip(pts, p => -p[1])), c2],
    [v(0.14) + v(0.76), null],
    [el(len * 0.4, -len * 0.21, len * 0.09, len * 0.07, -20), hole],
    [el(len * 0.64, -len * 0.14, len * 0.07, len * 0.055, -30), hole],
    [el(len * 0.4, len * 0.21, len * 0.09, len * 0.07, 20), hole],
    [el(len * 0.64, len * 0.14, len * 0.07, len * 0.055, 30), hole],
  ], x, y, 1, 1, deg);
}
// Little tufts of grass: lines only.
const tufts = list => [list.map(([x, y, k = 1]) => `M${x - 12 * k} ${y}q${2 * k} ${-16 * k} ${-6 * k} ${-26 * k}M${x} ${y}q0 ${-20 * k} ${2 * k} ${-34 * k}M${x + 12 * k} ${y}q${-2 * k} ${-16 * k} ${6 * k} ${-26 * k}`).join(''), null];

// A little monkey's face, centre at 0,0; the bush in front hides the rest of it.
const monkey = [
  ...both(el(-49, -10, 19, 21), J.rock),
  [el(0, 0, 46, 43), J.wood],
  [B([[0, -17], [15, -27], [31, -17], [32, 4], [20, 25], [0, 31], [-20, 25], [-32, 4], [-31, -17], [-15, -27]]), J.rock],
  dot(-14, -5, 5.5), dot(14, -5, 5.5),
  ['M-4 9L-2 11M4 9L2 11M-13 15Q0 26 13 15', null],
];
const canopy = `M-10 -10H1210V26${'q-55.5 38 -111 0'.repeat(11)}Z`;

const fall = sp([[584, 234], [612, 224], [640, 221], [668, 224], [696, 234], [704, 320], [714, 460], [730, 644], [550, 644], [566, 460], [576, 320]], true, 8);

const jungle = {
  id: 'jungle-parrots', title: 'Джунгли: попугаи и тукан',
  shapes: [
    bg(J.sky),
    [O(640, 124, 58), J.yellow],
    [`M-10 330C120 250 260 240 380 300C470 230 560 220 640 250C740 210 880 220 960 290C1040 240 1140 250 1210 300V910H-10Z`, J.far],
    // waterfall
    [B([[480, 258], [552, 226], [640, 232], [740, 224], [832, 258], [846, 420], [862, 640], [640, 664], [418, 640], [450, 430]]), J.rock],
    [`M800 340q-26 40 -8 90M770 520q20 30 10 70`, null],
    ...striped(fall, [0, 0], 0, [616, 664], [J.water, J.white, J.water]),
    [el(640, 694, 270, 66), J.water],
    [cloudD(640, 656, 84), J.white],
    [el(478, 704, 46, 17), J.lime],
    [el(806, 708, 46, 17), J.lime],
    [`M478 704L512 694M806 708L840 698`, null],
    // bushes
    ...place(monkey, 334, 546, 1.14),
    [`M-10 580C80 520 200 530 270 600C340 570 410 610 430 690C380 740 200 760 -10 750Z`, J.mid],
    [`M1210 600C1130 540 1010 540 940 610C880 590 850 640 846 700C900 750 1080 770 1210 750Z`, J.mid],
    [el(296, 596, 15, 11, -20), J.wood],
    [el(374, 607, 15, 11, 28), J.wood],
    ['M1014 640Q1008 606 1030 588', null],
    ...[[996, 634], [1033, 628], [1017, 664]].map(([x, y]) => [O(x, y, 17), J.red]),
    [`M-10 770C200 730 420 750 600 780C800 750 1000 730 1210 770V910H-10Z`, J.deep],
    // branches
    [B([[60, 432], [240, 436], [420, 428], [596, 434], [640, 450], [596, 468], [420, 466], [240, 474], [60, 478]]), J.wood],
    [B([[1230, 380], [1050, 394], [900, 388], [806, 398], [770, 414], [806, 430], [900, 426], [1050, 432], [1230, 428]]), J.wood],
    ...leaf2(634, 446, 100, 27, -38, J.mid, J.lime),
    ...leaf2(638, 458, 92, 25, 44, J.lime, J.mid),
    ...leaf2(778, 412, 92, 25, 150, J.mid, J.lime),
    ...leaf2(40, -24, 210, 42, 50, J.deep, J.mid),
    // tree trunk
    [`M-10 -10L92 -10C80 200 90 380 108 520C120 700 96 820 124 910L-10 910Z`, J.wood],
    [`M30 96q16 50 4 110M62 396q12 40 4 90M34 560q18 70 8 150`, null],
    [el(46, 296, 27, 37), DARK],
    [el(36, 290, 5, 5), J.white], [el(57, 290, 5, 5), J.white],
    // birds
    ...place(macaw({ body: J.red, wing: [J.red, J.yellow, J.blue], tail: [J.blue, J.red, J.yellow], beak: J.yellow }), 204, 438, 1),
    ...place(macaw({ body: J.yellow, head: J.blue, wing: [J.blue, J.water, J.mid], tail: [J.yellow, J.blue, J.water], beak: DARK }), 478, 434, 0.96, -1),
    [heartD(342, 150, 26), J.pink],
    ...place(toucan(), 1004, 394, 1.12, -1),
    // canopy
    ...leaf2(150, -14, 140, 36, 98, J.mid, J.deep),
    ...leaf2(262, -14, 116, 33, 78, J.deep, J.mid),
    ...leaf2(430, -14, 120, 33, 100, J.mid, J.deep),
    ...leaf2(520, -14, 150, 36, 76, J.deep, J.mid),
    ...leaf2(770, -14, 140, 36, 104, J.mid, J.deep),
    ...leaf2(880, -14, 104, 32, 82, J.deep, J.mid),
    ...leaf2(1090, -14, 110, 32, 96, J.mid, J.deep),
    ...leaf2(1194, -14, 180, 40, 114, J.deep, J.mid),
    [canopy, J.deep],
    // foreground
    tufts([[200, 690], [330, 700, 0.9], [944, 704, 0.9], [1090, 700, 0.9], [520, 840, 0.9], [790, 850], [860, 800, 0.8]]),
    ...monstera(24, 916, 250, -72, J.mid, J.lime, J.deep),
    ...monstera(110, 930, 230, -24, J.lime, J.mid, J.deep),
    ...leaf2(1190, 910, 280, 46, 212, J.lime, J.mid),
    ...leaf2(1200, 910, 290, 46, 244, J.mid, J.lime),
    ...leaf2(1210, 900, 230, 42, 272, J.lime, J.mid),
    ...flower(330, 800, 54, J.red, J.yellow, 5),
    ...flower(960, 836, 48, J.pink, J.yellow, 5),
    [el(640, 850, 130, 40), J.rock],
    ...place(frog, 640, 836, 1.05),
    ...place(butterfly(J.orange, J.yellow, J.white), 872, 588, 0.72, 1, 16),
  ],
};

// ================= 2. Coral reef =================
const S = { water: '#9ad9f5', light: '#c9eefc', far: '#6fbfee', sand: '#f6dfa4', skin: '#7fd07a', weed: '#3fae6a', brown: '#c97b3a', amber: '#f2b24a',
  yellow: '#ffd447', orange: '#ff8a3d', red: '#f0564a', pink: '#ff9ec2', purple: '#a58cf0', rock: '#8f96c4', white: '#ffffff' };

// A band that follows a curve; `w` gives half-widths along it. The far end is rounded.
function ribbon(pts, w, k = 8) {
  const c = sp(pts, false, k), n = c.length, a = [], b = [];
  let h = 0, ux = 0, uy = 0;
  for (let i = 0; i < n; i++) {
    const p = c[Math.max(0, i - 1)], q = c[Math.min(n - 1, i + 1)];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    const t = (i / (n - 1)) * (w.length - 1), j = Math.min(w.length - 2, Math.floor(t));
    h = w[j] + (w[j + 1] - w[j]) * (t - j);
    ux = dx / len; uy = dy / len;
    a.push([c[i][0] - uy * h, c[i][1] + ux * h]);
    b.push([c[i][0] + uy * h, c[i][1] - ux * h]);
  }
  const cap = [];
  for (let i = 1; i < 6; i++) {
    const t = (i / 6) * Math.PI, e = c[n - 1];
    cap.push([e[0] + h * (Math.cos(t) * -uy + Math.sin(t) * ux), e[1] + h * (Math.cos(t) * ux + Math.sin(t) * uy)]);
  }
  return [...a, ...cap, ...b.reverse()];
}
const arc = (rx, ry, a0, a1, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
  const t = rad(a0 + ((a1 - a0) * i) / n);
  return [Math.cos(t) * rx, Math.sin(t) * ry];
});
const vflip = d => move(d, 0, 0, 1, -1, 180);
const both2 = (d, c) => [[d, c], [vflip(d), c]];
const eye = (x, y, rx, ry) => [[el(x, y, rx, ry), DARK], [el(x + rx * 0.3, y - ry * 0.36, rx * 0.4, ry * 0.36), '#ffffff']];

// Sea turtle seen from above, shell centred on 0,0, swimming left.
function turtle() {
  const inner = elp(0, 0, 148, 104, 0, 72);
  const hex = Array.from({ length: 6 }, (_, i) => [Math.cos(rad(i * 60)) * 80, Math.sin(rad(i * 60)) * 56]);
  const cross = (v, q) => v[0] * q[1] - v[1] * q[0];
  const scutes = hex.map((v, i) => {
    const w = hex[(i + 1) % 6], e = [w[0] - v[0], w[1] - v[1]];
    let p = clip(inner, q => -cross(v, q));
    p = clip(p, q => cross(w, q));
    p = clip(p, q => cross(e, [q[0] - v[0], q[1] - v[1]]));
    return [D(p), i % 2 ? S.amber : S.brown];
  });
  const rim = Array.from({ length: 12 }, (_, i) => [D([...arc(194, 146, i * 30 - 15, i * 30 + 15), ...arc(148, 104, i * 30 + 15, i * 30 - 15)]), i % 2 ? S.yellow : S.amber]);
  const front = B([[-158, -60], [-176, -130], [-146, -214], [-84, -270], [-40, -262], [-52, -206], [-70, -140], [-64, -66]]);
  const back = B([[104, -70], [150, -128], [214, -172], [248, -150], [224, -96], [170, -52]]);
  return [
    ...both2(back, S.skin),
    ...both2(front, S.skin),
    ...both2(el(-122, -150, 15, 20, 20), S.weed),
    ...both2(el(-84, -220, 14, 18, 40), S.weed),
    ...both2(el(196, -124, 15, 13), S.weed),
    [B([[168, -24], [212, -14], [246, 0], [212, 14], [168, 24]]), S.skin],
    [B([[-150, -46], [-222, -58], [-292, -54], [-336, -8], [-312, 40], [-240, 50], [-150, 46]]), S.skin],
    ...eye(-276, -16, 18, 21),
    [el(-246, 22, 17, 11), S.pink],
    ['M-330 10Q-308 34 -280 28', null],
    ...scutes,
    [P(hex), S.yellow],
    ...rim,
  ];
}

// Striped little fish, nose at the left.
function clownfish(c1, c2, fin) {
  const body = sp([[-100, 0], [-72, -42], [-12, -60], [50, -44], [86, -12], [86, 12], [50, 44], [-12, 60], [-72, 42]]);
  return [
    [B([[70, 0], [118, -50], [150, -30], [138, 0], [150, 30], [118, 50]]), fin],
    [B([[-40, -46], [-8, -96], [48, -86], [56, -34]]), fin],
    [B([[-20, 50], [0, 92], [40, 82], [44, 36]]), fin],
    ...striped(body, [0, 0], 0, [-52, -20, 16, 48], [c1, c2, c1, c2, c1]),
    [el(-2, 18, 20, 12, 30), fin],
    dot(-74, -12, 7),
    ['M-98 10Q-86 20 -74 14', null],
  ];
}

function angelfish(c1, c2, fin) {
  const body = sp([[-84, 0], [-40, -62], [20, -82], [70, -36], [74, 36], [20, 82], [-40, 62]]);
  return [
    [B([[60, 0], [112, -52], [138, -34], [126, 0], [138, 34], [112, 52]]), fin],
    [B([[-14, -62], [26, -128], [84, -150], [80, -96], [64, -36]]), fin],
    [B([[-14, 62], [26, 128], [84, 150], [80, 96], [64, 36]]), fin],
    ...striped(body, [0, 0], 0, [-44, -14, 20, 48], [c1, c2, c1, c2, c1]),
    dot(-60, -8, 7),
    ['M-82 12Q-72 20 -62 16', null],
  ];
}

// A plain small fish, nose at the left.
const minnow = (c, fin) => [
  [P([[24, 0], [76, -32], [66, 0], [76, 32]]), fin],
  [B([[-50, 0], [-22, -27], [20, -24], [40, 0], [20, 24], [-22, 27]]), c],
  [el(4, 2, 12, 8, 20), fin],
  dot(-28, -6, 5),
];

function jelly(c, c2) {
  const tent = (x, flip) => [D(ribbon([[x, -4], [x + 12 * flip, 40], [x - 12 * flip, 84], [x + 12 * flip, 128], [x - 4 * flip, 166]], [9.5, 9.5, 9, 8.5, 8])), c2];
  return [
    tent(-57, 1), tent(-19, 1), tent(19, 1), tent(57, 1),
    [B([[-86, 0], [-78, -56], [-40, -98], [0, -106], [40, -98], [78, -56], [86, 0], [57, 18], [38, 2], [19, 18], [0, 2], [-19, 18], [-38, 2], [-57, 18]]), c],
    [el(-34, -62, 13, 11), '#ffffff'],
    [el(10, -74, 11, 9), '#ffffff'],
    [el(40, -44, 10, 9), '#ffffff'],
    dot(-22, -26, 6), dot(22, -26, 6),
    ['M-12 -16Q0 -6 12 -16', null],
  ];
}

// Seahorse looking left, the curl of the tail near 0,0.
function seahorse(c, c2, fin) {
  const body = ribbon([[-4, -168], [14, -130], [26, -84], [12, -36], [-8, 6], [0, 44], [26, 60], [48, 44], [42, 22]], [26, 30, 36, 30, 20, 13, 10, 8.5, 7.5], 10);
  return [
    [B([[30, -128], [72, -122], [84, -90], [70, -58], [34, -60]]), fin],
    ['M44 -114L72 -108M46 -92L78 -90M44 -72L68 -66', null],
    ...striped(body, [0, 0], 90, [-126, -96, -66, -36, -6], [c, c2, c, c2, c, c]),
    [P([[-18, -214], [-14, -254], [0, -236], [12, -262], [22, -236], [38, -250], [34, -208]]), fin],
    [D(ribbon([[-14, -190], [-48, -172], [-82, -152]], [14, 9, 8.5], 6)), c],
    [B([[-32, -206], [-4, -230], [30, -220], [44, -192], [34, -166], [4, -154], [-24, -166], [-36, -184]]), c],
    ...eye(0, -196, 9, 10),
    [el(20, -174, 10, 7), S.pink],
  ];
}

const crab = [
  ['M-50 -22L-84 -6L-92 14M-52 -12L-78 6L-80 24M50 -22L84 -6L92 14M52 -12L78 6L80 24', null],
  ['M-44 -48L-74 -70M44 -48L74 -70', null],
  ...both(B([[-74, -66], [-104, -70], [-116, -98], [-96, -120], [-84, -98], [-70, -112], [-62, -86]]), S.red),
  ['M-20 -62L-22 -86M20 -62L22 -86', null],
  [el(0, -34, 58, 36), S.red],
  ...both(el(-22, -92, 12, 12), '#ffffff'),
  ...both(el(-22, -92, 4.5, 4.5), DARK),
  ['M-18 -24Q0 -10 18 -24', null],
];

// A ribbed shell, hinge at 0,0.
function shell(c1, c2) {
  const fan = [[0, 0], ...arc(64, 64, 205, 335, 20)];
  const ray = a => [Math.cos(rad(a)), Math.sin(rad(a))];
  const out = [[P([[-18, -4], [-22, 12], [22, 12], [18, -4]]), c1]];
  for (let i = 0; i < 5; i++) {
    const u = ray(205 + i * 26), v = ray(205 + (i + 1) * 26);
    out.push([D(clip(clip(fan, q => -(u[0] * q[1] - u[1] * q[0])), q => v[0] * q[1] - v[1] * q[0])), i % 2 ? c2 : c1]);
  }
  return out;
}

const tubes = (c, hole) => [[-52, 96, 22], [0, 150, 26], [50, 112, 23], [96, 70, 20]].flatMap(([x, h, w]) => [
  [P([[x - w, 6], [x - w, -h], [x + w, -h], [x + w, 6]]), c],
  [el(x, -h, w, w * 0.42), hole],
]);

const branchCoral = B([[-24, 4], [-24, -60], [-66, -112], [-92, -170], [-82, -196], [-60, -188], [-46, -140], [-16, -104], [-18, -180], [-30, -232], [-14, -254], [8, -240], [14, -180], [18, -100], [50, -140], [70, -196], [92, -204], [102, -182], [78, -116], [26, -58], [24, 4]]);

function anemone(c, base) {
  const arms = [-66, -44, -22, 0, 22, 44, 66].map((a, i) => {
    const s = Math.sin(rad(a)), k = Math.cos(rad(a)), len = i % 2 ? 128 : 112;
    return [D(ribbon([[s * 26, -k * 26], [s * len * 0.55 + k * 10, -k * len * 0.55 + s * 10], [s * len, -k * len]], [12, 12, 11], 6)), c];
  });
  return [...arms, [B([[-78, 8], [-66, -30], [-30, -52], [30, -52], [66, -30], [78, 8]]), base]];
}

const weed = (x, y, h, lean, c, w = 17) => [D(ribbon([[x, y], [x + lean, y - h * 0.25], [x - lean, y - h * 0.5], [x + lean, y - h * 0.75], [x, y - h]], [w, w, w * 0.9, w * 0.7, w * 0.35])), c];

const reef = {
  id: 'reef-turtle', title: 'Коралловый риф и черепаха',
  shapes: [
    bg(S.water),
    [`M-10 -10H1210V64q-152 44 -305 0t-305 0t-305 0t-305 0Z`, S.light],
    [`M-10 450C70 450 170 520 230 620C270 600 310 650 330 780H-10Z`, S.far],
    [`M1210 520C1130 470 1040 520 1000 600C950 590 900 660 880 780H1210Z`, S.far],
    // weeds behind
    weed(40, 790, 330, 22, S.weed),
    weed(1160, 800, 400, -24, S.weed),
    weed(1110, 800, 280, 20, S.skin),
    weed(960, 800, 200, 18, S.weed, 15),
    [`M-10 770C150 740 330 780 520 760C700 740 900 780 1210 750V910H-10Z`, S.sand],
    [`M330 800q30 -10 60 0M560 790q30 -10 60 0M920 850q30 -10 60 0M180 870q30 -10 60 0`, null],
    // corals
    [B([[-30, 800], [20, 730], [100, 760], [130, 830], [60, 870], [-20, 860]]), S.rock],
    ...place(anemone(S.pink, S.purple), 170, 800, 1),
    [move(branchCoral, 294, 814, 0.62), S.red],
    [B([[364, 812], [374, 752], [432, 722], [490, 752], [500, 812]]), S.pink],
    [`M392 790q10 -30 30 -20t20 -20M422 800q20 -10 30 -30t20 0M404 760q14 -16 30 -8`, null],
    ...place(tubes(S.purple, DARK), 1010, 800, 1),
    [move(branchCoral, 880, 806, 0.82), S.orange],
    [B([[1120, 830], [1150, 770], [1210, 760], [1220, 880], [1130, 880]]), S.rock],
    // on the sand
    [starD(560, 836, 46, 23), S.orange],
    dot(551, 832, 3.6), dot(569, 832, 3.6),
    ['M553 842Q560 849 567 842', null],
    ...place(shell(S.pink, S.white), 654, 856, 0.9),
    ...place(crab, 790, 868, 0.8),
    // swimmers
    ...place(turtle(), 640, 400, 1, 1, -14),
    ...place(jelly(S.pink, S.purple), 150, 250, 1),
    ...place(clownfish(S.orange, S.white, S.orange), 160, 560, 0.72, -1),
    ...place(clownfish(S.orange, S.white, S.orange), 404, 636, 0.64),
    ...place(angelfish(S.yellow, S.purple, S.orange), 1000, 214, 0.82),
    ...place(seahorse(S.yellow, S.orange, S.orange), 1084, 640, 0.95),
    ...place(minnow(S.red, S.yellow), 392, 108, 1.1),
    ...place(minnow(S.yellow, S.red), 292, 186, 1.1),
    ...place(minnow(S.red, S.yellow), 770, 112, 1.1, -1),
    // bubbles
    ...[[276, 400, 15], [252, 352, 11], [282, 310, 17], [900, 440, 13], [930, 392, 17], [60, 430, 13], [86, 384, 10], [1150, 150, 16], [1120, 100, 11], [590, 120, 12]].map(([x, y, r]) => [O(x, y, r), S.white]),
  ],
};

// ================= 3. Farm =================
const F = { sky: '#bfe6ff', white: '#ffffff', yellow: '#ffd447', far: '#b8e68c', grass: '#86d95f', green: '#4fae5a', red: '#e0524a', roof: '#8a5a3a',
  wood: '#d9a066', pink: '#ffb0c4', orange: '#ff9a3d', grey: '#aab4c8', blue: '#5aa9ff' };

// The barn, front bottom left corner at 0,0.
const barn = [
  [P([[140, -350], [336, -350], [452, -272], [256, -272]]), F.roof],
  [P([[256, -272], [452, -272], [494, -186], [296, -186]]), F.roof],
  ['M200 -330L290 -330M222 -306L334 -306M306 -250L446 -250M318 -220L460 -220', null],
  [P([[270, -186], [470, -186], [470, 0], [270, 0]]), F.red],
  [box(400, -156, 60, 74), F.white],
  [box(418, -138, 24, 38), F.sky],
  [P([[-16, -186], [24, -274], [140, -350], [256, -274], [296, -186], [270, -186], [236, -256], [140, -318], [44, -256], [10, -186]]), F.white],
  [P([[10, 0], [10, -186], [44, -256], [140, -318], [236, -256], [270, -186], [270, 0]]), F.red],
  [box(104, -280, 72, 66), F.white],
  [box(122, -262, 36, 34), F.yellow],
  [box(66, -166, 148, 166), F.white],
  [box(84, -148, 50, 148), F.red],
  [box(146, -148, 50, 148), F.red],
  ['M84 -148L134 -46L84 -46L134 -148M146 -148L196 -46L146 -46L196 -148', null],
];

const silo = [
  ...striped([[-42, 0], [-42, -240], [42, -240], [42, 0]], [0, 0], 90, [-180, -120, -60], [F.grey, F.white, F.grey, F.white]),
  [D([...arc(42, 46, 180, 360, 14).map(q => [q[0], q[1] - 240])]), F.red],
];

const up = (shapes, dy) => shapes.map(([d, c]) => [move(d, 0, dy), c]);
const cow = [
  // far legs
  [P([[-96, -130], [-58, -130], [-62, -18], [-94, -18]]), F.white],
  [P([[-96, -20], [-60, -20], [-58, 0], [-98, 0]]), DARK],
  [P([[46, -130], [84, -130], [82, -18], [50, -18]]), F.white],
  [P([[48, -20], [84, -20], [86, 0], [46, 0]]), DARK],
  // near legs
  [P([[-158, -140], [-116, -140], [-120, -18], [-154, -18]]), F.white],
  [P([[-156, -20], [-118, -20], [-116, 0], [-158, 0]]), DARK],
  [P([[104, -140], [146, -140], [142, -18], [108, -18]]), F.white],
  [P([[106, -20], [144, -20], [146, 0], [104, 0]]), DARK],
  ...up([
    [L([[-166, -160], [-190, -140], [-198, -100], [-194, -70]]), null],
    [B([[-194, -76], [-178, -44], [-194, -14], [-212, -44]]), DARK],
    [B([[-74, -72], [-14, -72], [-14, -36], [-44, -16], [-76, -36]]), F.pink],
    ['M-58 -22L-58 -8M-32 -22L-32 -8', null],
    [B([[-166, -160], [-136, -194], [-70, -202], [0, -194], [70, -200], [128, -188], [160, -146], [158, -96], [120, -64], [30, -56], [-70, -54], [-142, -68], [-176, -112]]), F.white],
    [B([[-128, -170], [-72, -182], [-44, -144], [-84, -106], [-142, -126]]), DARK],
    [B([[-6, -146], [44, -162], [78, -126], [48, -84], [-6, -100]]), DARK],
    // head
    ...both(B([[-46, -262], [-84, -285], [-103, -264], [-82, -242], [-48, -244]]), F.white).map(([d, c]) => [move(d, 164, 0), c]),
    ...both(B([[-38, -288], [-52, -322], [-36, -338], [-16, -296]]), F.wood).map(([d, c]) => [move(d, 164, 0), c]),
    [B([[112, -262], [136, -298], [192, -298], [216, -262], [210, -204], [190, -166], [138, -166], [118, -204]]), F.white],
    [B([[124, -266], [140, -294], [172, -296], [170, -264], [146, -250]]), DARK],
    [el(164, -182, 50, 33), F.pink],
    [el(148, -186, 5, 7), DARK], [el(180, -186, 5, 7), DARK],
    ['M148 -166Q164 -156 180 -166', null],
    dot(140, -230, 6.8), dot(190, -230, 6.8),
    [el(164, -134, 17, 18), F.yellow],
    ['M164 -126L164 -118', null],
  ], -40),
];

const tractor = [
  [P([[86, -196], [86, -262], [108, -262], [108, -196]]), F.grey],
  [P([[76, -262], [76, -286], [118, -286], [118, -262]]), F.grey],
  [P([[-208, -364], [-8, -364], [-18, -336], [-198, -336]]), F.red],
  [P([[-190, -336], [-26, -336], [-26, -200], [-200, -200]]), F.blue],
  [P([[-168, -314], [-48, -314], [-48, -218], [-176, -218]]), F.sky],
  ['M-76 -218L-90 -262M-108 -270L-74 -256', null],
  [P([[-200, -204], [-26, -204], [-26, -196], [182, -196], [200, -176], [200, -98], [-200, -98]]), F.blue],
  [P([[0, -172], [130, -172], [130, -146], [0, -146]]), F.yellow],
  [P([[150, -184], [186, -184], [186, -122], [150, -122]]), F.grey],
  ['M168 -172L168 -134', null],
  [D([...arc(114, 114, 180, 360, 18), ...arc(90, 90, 360, 180, 18)].map(q => [q[0] - 90, q[1] - 90])), F.red],
  [el(-90, -90, 90, 90), DARK],
  [el(-90, -90, 54, 54), F.yellow],
  [el(-90, -90, 20, 20), F.grey],
  [el(134, -54, 54, 54), DARK],
  [el(134, -54, 30, 30), F.yellow],
  [el(134, -54, 11, 11), F.grey],
];

// A wind pump on its tower, foot of the tower at 0,0.
const windmill = [
  [P([[-24, 0], [-9, -176], [9, -176], [24, 0]]), F.grey],
  ['M-12 -60L12 -60M-10 -116L10 -116', null],
  ...[20, 110, 200, 290].flatMap((a, i) => leaf1(0, -180, 70, 17, a, i % 2 ? F.red : F.white)),
  [el(0, -180, 14, 14), F.yellow],
];

// A hen looking right, feet at 0,0.
const hen = (body, wing) => [
  ['M-14 -22L-14 0M-28 4L-14 0L-2 6M14 -22L16 0M2 4L16 0L28 6', null],
  [B([[-40, -50], [-92, -62], [-112, -100], [-84, -104], [-50, -78]]), wing],
  [B([[-36, -64], [-70, -100], [-76, -140], [-50, -128], [-28, -92]]), body],
  [B([[28, -140], [32, -174], [48, -162], [58, -186], [70, -164], [88, -166], [84, -134]]), F.red],
  [P([[74, -138], [102, -126], [74, -116]]), F.orange],
  [el(70, -98, 12, 17), F.red],
  [B([[-60, -60], [-36, -92], [6, -88], [30, -112], [34, -140], [56, -154], [78, -138], [74, -104], [66, -64], [40, -30], [0, -18], [-40, -26]]), body],
  [B([[-36, -70], [-6, -80], [24, -62], [10, -40], [-22, -36]]), wing],
  dot(56, -134, 5),
];

const chick = [
  ['M-6 -4L-6 6M8 -4L8 6', null],
  [el(0, -24, 26, 22), F.yellow],
  [P([[30, -58], [48, -52], [30, -46]]), F.orange],
  [el(16, -54, 18, 17), F.yellow],
  ['M-14 -26Q-2 -12 8 -28', null],
  dot(22, -58, 3.5),
];

// A piece of fence: rails first, then posts over them.
const fence = (x0, x1, y, posts) => [
  [box(x0, y - 76, x1 - x0, 21), F.wood],
  [box(x0, y - 33, x1 - x0, 21), F.wood],
  ...posts.map(x => [P([[x - 14, y], [x - 14, y - 84], [x, y - 100], [x + 14, y - 84], [x + 14, y]]), F.wood]),
];

const sunflower = (x, y, top) => [
  [`M${x} ${y}L${x} ${top}`, null],
  ...leaf1(x, y - 50, 54, 18, -150, F.green),
  ...leaf1(x, y - 80, 54, 18, -30, F.green),
  ...flower(x, top, 48, F.yellow, F.roof, 8),
];

const pumpkin = (x, y, r) => striped(elp(x, y, r * 1.2, r), [x, y], 0, [-r * 0.42, r * 0.42], [F.orange, F.orange, F.orange]).concat([[`M${x} ${y - r}q4 -16 16 -20`, null]]);

const field = [[800, 432], [1210, 404], [1210, 600], [800, 600]];

const farm = {
  id: 'farm-barn', title: 'Ферма: корова и трактор',
  shapes: [
    bg(F.sky),
    [O(120, 110, 66), F.yellow],
    [cloudD(470, 150, 84), F.white],
    [cloudD(1010, 130, 66), F.white],
    [`M250 70q14 -16 28 0q14 -16 28 0M330 130q12 -14 24 0q12 -14 24 0`, null],
    [`M-10 480C150 400 380 400 560 460C700 410 900 390 1210 440V620H-10Z`, F.far],
    ...striped(field, [0, 0], 8, [900, 990, 1080, 1172], [F.yellow, F.green, F.yellow, F.green, F.yellow]),
    [`M-10 572C200 540 400 560 600 572C800 552 1000 552 1210 572V910H-10Z`, F.grass],
    // tree
    [P([[1088, 560], [1096, 440], [1132, 440], [1140, 560]]), F.roof],
    [B([[1030, 400], [1010, 330], [1060, 280], [1114, 262], [1170, 282], [1214, 330], [1200, 400], [1150, 438], [1080, 438]]), F.green],
    [el(1070, 340, 15, 15), F.red], [el(1140, 310, 15, 15), F.red], [el(1120, 390, 15, 15), F.red],
    // buildings
    ...place(windmill, 70, 462, 0.9),
    ...place(silo, 700, 612),
    ...fence(-10, 206, 626, [10, 106]),
    ...place(barn, 190, 612),
    [`M584 540L638 540Q664 578 638 616L584 616Z`, F.yellow],
    ['M620 550Q632 578 620 606M638 556Q646 578 638 600', null],
    [el(584, 578, 28, 38), F.wood],
    ['M578 569q12 -8 15 5t-11 13', null],
    ...sunflower(58, 704, 562),
    ...fence(940, 1210, 632, [1004, 1128]),
    // animals and tractor
    ...place(cow, 312, 812, 1.02),
    ...place(tractor, 962, 838, 1),
    ...place(hen(F.white, F.grey), 664, 800, 0.78),
    ...place(hen(F.wood, F.roof), 566, 880, 0.9, -1),
    ...place(hen(F.orange, F.wood), 84, 890, 0.78, -1),
    ...place(chick, 216, 892, 1),
    ...place(chick, 282, 876, 1),
    ...place(chick, 668, 884, 1.1, -1),
    ...pumpkin(1150, 860, 40),
    ...pumpkin(1076, 876, 28),
    tufts([[420, 860], [760, 870, 0.9], [22, 728, 0.8], [540, 690, 0.8], [1180, 700, 0.9]]),
  ],
};

// ================= 4. Cat cafe =================
const C = { wall: '#e9defc', plank: '#e8b98a', cream: '#fff1d8', wood: '#b9743c', white: '#ffffff', pink: '#ff9eb8', red: '#f0564a',
  yellow: '#ffd447', teal: '#5fc7b8', sky: '#bfe6ff', orange: '#f4a64e', grey: '#a9b4d0', green: '#6fbf6a', purple: '#b58cff', choc: '#7a4a2e' };

// A cat's head seen from the front, centre at x,y.
function catHead(x, y, s, fur, { ear = fur, mask = null, sleep = false, tabby = false, blush = true, muzzle = '#ffffff' } = {}) {
  return place([
    ...both(P([[-70, -16], [-62, -88], [-12, -54]]), ear),
    [el(0, 0, 74, 62), fur],
    mask && [B([[0, -34], [40, -22], [50, 14], [28, 42], [0, 48], [-28, 42], [-50, 14], [-40, -22]]), mask],
    tabby && ['M0 -61L0 -40M-19 -57L-15 -38M19 -57L15 -38', null],
    [el(0, 22, 27, 18), muzzle],
    ['M-7 11L7 11L0 19Z', C.pink],
    ['M0 19L0 26Q-9 36 -18 28M0 26Q9 36 18 28', null],
    ...(sleep ? [['M-44 -8Q-30 6 -16 -8M16 -8Q30 6 44 -8', null]] : both(el(-30, -8, 12, 15), DARK)),
    ...(blush ? both(el(-54, 18, 15, 11), C.pink) : []),
    ...both('M-70 4L-104 -4M-70 16L-104 20', null),
  ], x, y, s);
}

function catSit(fur, { belly = '#ffffff', tailSide = 1, ...face } = {}) {
  const t = D(ribbon([[40, -16], [94, -14], [118, -52], [102, -96]], [13, 13, 12.5, 12]));
  return [
    [tailSide > 0 ? t : mir(t), fur],
    [B([[-58, 0], [-66, -60], [-46, -112], [0, -128], [46, -112], [66, -60], [58, 0], [0, 6]]), fur],
    [B([[0, -118], [27, -98], [33, -52], [19, -14], [0, -10], [-19, -14], [-33, -52], [-27, -98]]), belly],
    ...both(el(-25, -7, 22, 13), fur),
    ...catHead(0, -168, 1, fur, face),
  ];
}

function catLoaf(fur, face = {}) {
  return [
    [B([[-118, 0], [-126, -48], [-86, -94], [0, -104], [78, -94], [120, -52], [116, 0]]), fur],
    ['M36 -100Q44 -84 36 -68M64 -96Q72 -80 64 -64M92 -84Q100 -70 92 -56', null],
    [D(ribbon([[121, -20], [108, -4], [76, 2], [30, -8]], [3, 11, 12.5, 12])), fur],
    ...catHead(-60, -78, 0.9, fur, { sleep: true, ...face }),
  ];
}

function catLie(fur, pt) {
  return [
    [D(ribbon([[-108, -24], [-144, 8], [-134, 60], [-152, 106]], [13, 13, 12.5, 12])), pt],
    [B([[-122, 0], [-128, -40], [-86, -74], [36, -76], [112, -58], [128, -12], [112, 0]]), fur],
    ...[22, 76].flatMap(x => striped(ribbon([[x, -10], [x, 34]], [15, 15]), [0, 0], 90, [24], [fur, pt])),
    ...catHead(104, -84, 0.86, fur, { ear: pt }),
  ];
}

function catBed(fur, patch, rim, cushion) {
  return [
    [el(0, -6, 158, 60), rim],
    [el(0, -16, 124, 40), cushion],
    [B([[-98, -10], [-104, -50], [-66, -84], [16, -106], [86, -80], [106, -34], [86, 4], [0, 12], [-70, 8]]), fur],
    [B([[14, -98], [60, -90], [74, -58], [42, -42], [8, -62]]), patch],
    [D(ribbon([[94, -34], [84, 0], [24, 12], [-36, 4]], [13, 13, 12.5, 12])), patch],
    ...catHead(-58, -44, 0.82, fur, { sleep: true, ear: patch }),
    [D([...arc(158, 60, 8, 172, 24), ...arc(142, 36, 172, 8, 24)].map(q => [q[0], q[1] - 6])), rim],
  ];
}

const potPlant = (pot, leaf) => [
  ...leaf1(-4, -40, 78, 22, -116, leaf), ...leaf1(4, -40, 78, 22, -62, leaf),
  [P([[-30, -48], [30, -48], [22, 0], [-22, 0]]), pot],
];
const lamp = (x, y, shade) => [
  [`M${x} -10L${x} ${y - 46}`, null],
  [el(x, y + 4, 19, 17), C.yellow],
  [D(arc(54, 48, 180, 360, 14).map(q => [q[0] + x, q[1] + y])), shade],
];
const bracket = (x, y, dir) => [P([[x, y], [x, y + 40], [x + 40 * dir, y]]), C.wood];
const shelf = (x, y, w, legs = true) => [[box(x, y, w, 24), C.wood], ...(legs ? [bracket(x + 22, y + 24, 1), bracket(x + w - 22, y + 24, -1)] : [])];
const paw = (x, y, s, c) => place([
  ...[[-26, -9], [-9, -22], [9, -22], [26, -9]].map(([u, v]) => [el(u, v, 10, 11), c]),
  [el(0, 12, 25, 19), c],
], x, y, s);

const cake = [
  [el(0, -14, 72, 13), C.white],
  ...striped([[-54, -20], [-54, -100], [54, -100], [54, -20]], [0, 0], 90, [-60], [C.pink, C.cream]),
  [B([[-58, -94], [-60, -112], [0, -122], [60, -112], [58, -94], [40, -80], [20, -94], [0, -80], [-20, -94], [-40, -80]]), C.white],
  [el(0, -132, 14, 14), C.red],
];
const shake = [
  [P([[-28, -92], [28, -92], [20, 0], [-20, 0]]), C.pink],
  ['M10 -120L28 -166', null],
  [B([[-34, -92], [-28, -118], [0, -130], [28, -118], [34, -92]]), C.white],
];
const cupcake = (wrap, top) => [
  [P([[-24, -32], [24, -32], [17, 0], [-17, 0]]), wrap],
  ['M-8 -24L-6 -9M8 -24L6 -9', null],
  [B([[-30, -30], [-24, -54], [0, -68], [24, -54], [30, -30]]), top],
  [el(0, -74, 11, 11), C.red],
];
const teapot = [
  ['M-40 -58Q-96 -64 -92 -32Q-88 -4 -40 -12', null],
  [B([[38, -40], [66, -66], [80, -60], [58, -20]]), C.teal],
  [el(0, -34, 48, 35), C.teal],
  [B([[-26, -62], [0, -80], [26, -62]]), C.yellow],
];
const cup = [
  ['M20 -34Q56 -38 54 -20Q52 -2 18 -8', null],
  [el(0, 0, 38, 10), C.white],
  [P([[-22, -38], [22, -38], [16, -2], [-16, -2]]), C.yellow],
  ['M-7 -46Q-15 -56 -7 -66M8 -46Q0 -56 8 -66', null],
];

const cloth = [
  ...arc(172, 38, 0, 180, 18).map(q => [q[0] + 250, q[1] + 690]),
  [86, 812],
  ...Array.from({ length: 36 }, (_, i) => [86 + ((i + 1) / 36) * 328, 812 + 16 * Math.abs(Math.sin(((i + 1) / 36) * 6 * Math.PI))]),
];

const cafe = {
  id: 'cat-cafe', title: 'Кошачье кафе',
  shapes: [
    bg(C.wall),
    [box(-10, 716, 1220, 200), C.plank],
    [`M150 716V760M460 716V790M760 716V800M34 716V790M330 846V900M720 860V900`, null],
    // window
    [R(50, 110, 350, 330, 10), C.white],
    [box(72, 132, 142, 286), C.sky],
    [box(236, 132, 142, 286), C.sky],
    [O(112, 176, 26), C.yellow],
    [cloudD(150, 250, 44), C.white],
    ...[0, 1, 2, 3, 4, 5].map(i => [`M${38 + i * 62} 92L${100 + i * 62} 92L${100 + i * 62} 128Q${69 + i * 62} 166 ${38 + i * 62} 128Z`, i % 2 ? C.white : C.red]),
    [R(30, 440, 390, 26, 8), C.wood],
    ...place(potPlant(C.orange, C.green), 112, 440, 0.9),
    ...place(catSit(C.grey, { tailSide: -1 }), 310, 442, 0.86),
    // mugs on hooks
    [R(64, 494, 252, 20, 8), C.wood],
    ...[[112, C.pink], [190, C.teal], [268, C.yellow]].flatMap(([x, c]) => [
      [`M${x} 514V530M${x + 19} 541q14 0 12 11q-2 8 -13 6`, null],
      [P([[x - 21, 530], [x + 21, 530], [x + 16, 576], [x - 16, 576]]), c],
    ]),
    // picture
    [R(424, 366, 100, 116, 8), C.wood],
    [box(442, 384, 64, 80), C.cream],
    [heartD(474, 422, 20), C.pink],
    // lamps
    ...lamp(470, 110, C.teal),
    ...lamp(790, 130, C.pink),
    // menu board
    [R(860, 64, 290, 200, 10), C.wood],
    [box(880, 84, 250, 160), DARK],
    ...paw(940, 170, 1.1, C.yellow),
    [heartD(1020, 130, 20), C.pink],
    [P([[1050, 170], [1104, 170], [1096, 222], [1058, 222]]), C.white],
    ['M1104 180q24 2 20 18', null],
    // shelves and their cats
    ...shelf(520, 300, 270, false),
    ...place(catSit(C.orange, { tabby: true, tailSide: -1, belly: C.cream, muzzle: C.cream }), 620, 300, 0.84),
    ...place(potPlant(C.teal, C.green), 742, 300, 0.8),
    ...shelf(830, 440, 330, false),
    [B([[858, 442], [864, 418], [1136, 418], [1142, 442]]), C.purple],
    ...place(catLoaf(C.white), 1004, 424, 0.96),
    ...shelf(480, 540, 270, false),
    ...place(catLie(C.cream, C.choc), 616, 540, 1),
    // counter
    ...catHead(1096, 606, 0.86, C.grey, { blush: false }),
    [box(790, 640, 430, 28), C.wood],
    [box(810, 668, 410, 250), C.teal],
    [heartD(920, 786, 34), C.pink],
    [heartD(1110, 786, 34), C.pink],
    [`M1015 690V900`, null],
    [el(1068, 642, 19, 13), C.grey],
    [el(1124, 642, 19, 13), C.grey],
    ...place(cake, 864, 640, 1),
    ...place(shake, 972, 640, 1),
    [el(972, 508, 12, 12), C.red],
    // table
    [box(236, 800, 28, 90), C.wood],
    [el(250, 890, 62, 13), C.wood],
    [el(250, 690, 172, 38), C.cream],
    [D(cloth), C.pink],
    ...place(teapot, 176, 694, 1),
    ...place(cup, 318, 700, 1.2),
    // floor
    ...place(catBed(C.white, C.orange, C.purple, C.yellow), 596, 836, 1),
    [el(48, 850, 36, 36), C.red],
    ['M24 836Q52 850 30 874M44 818Q76 846 50 884', null],
  ],
};

export default [jungle, reef, farm, cafe];
