// Detailed fantasy coloring pages: big hand-built scenes, 1200 x 900.
import { O, E, R, starD, heartD, cloudD, petal, flower, fish, bg, DARK } from '../art.js';

const f1 = v => +v.toFixed(1);

// Moves, scales, turns and mirrors a path written only with absolute M L C Q Z.
function tf(d, x = 0, y = 0, s = 1, rot = 0, flip = 1) {
  const c = Math.cos(rot), n = Math.sin(rot);
  return d.replace(/(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g, (m, a, b) => {
    const u = +a * s * flip, v = +b * s;
    return `${f1(x + u * c - v * n)} ${f1(y + u * n + v * c)}`;
  });
}
const place = (list, x, y, s = 1, rot = 0, flip = 1) => list.map(([d, f]) => [tf(d, x, y, s, rot, flip), f]);

// An ellipse made of curves, so that tf can move it.
const el = (x, y, a, b = a) => {
  const k = 0.5523, p = f1(a * k), q = f1(b * k);
  return `M${x - a} ${y}C${x - a} ${y - q} ${x - p} ${y - b} ${x} ${y - b}C${x + p} ${y - b} ${x + a} ${y - q} ${x + a} ${y}C${x + a} ${y + q} ${x + p} ${y + b} ${x} ${y + b}C${x - p} ${y + b} ${x - a} ${y + q} ${x - a} ${y}Z`;
};

// A puffy outline through points given clockwise: every side bulges outward.
function puff(pts, k = 0.56) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const r = f1(Math.hypot(q[0] - p[0], q[1] - p[1]) * k);
    d += `A${r} ${r} 0 0 1 ${q[0]} ${q[1]}`;
  });
  return `${d}Z`;
}

// An arched window or door: top is the top of the arch.
const arch = (cx, top, w, h) =>
  `M${cx - w / 2} ${top + h}V${top + w / 2}A${w / 2} ${w / 2} 0 0 1 ${cx + w / 2} ${top + w / 2}V${top + h}Z`;

// The tooth line of a castle wall, closed at the bottom.
function crenel(x0, x1, top, teeth, depth, bottom) {
  const step = (x1 - x0) / (teeth * 2 - 1);
  let d = `M${x0} ${bottom}V${top}`;
  for (let i = 0; i < teeth * 2 - 1; i++) {
    const x = f1(x0 + (i + 1) * step);
    d += i % 2 ? `H${x}V${top}` : `H${x}V${top + depth}`;
  }
  return `${d}V${bottom}Z`;
}

// The same puffy outline made of curves, so that tf can move it.
function blob(pts, k = 0.3) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    d += `Q${f1((p[0] + q[0]) / 2 + dy * k)} ${f1((p[1] + q[1]) / 2 - dx * k)} ${q[0]} ${q[1]}`;
  });
  return `${d}Z`;
}

const spark = (x, y, r) => starD(x, y, r, r * 0.38, 4);
const bird = (x, y, s) => `M${x - s} ${y}q${s / 2} ${-s * 0.7} ${s} 0q${s / 2} ${-s * 0.7} ${s} 0`;

// A point and its direction on a cubic curve given as four [x, y] pairs.
const cubic = ([a, b, c, d], t) => {
  const u = 1 - t, m = u * u * u, n = 3 * u * u * t, o = 3 * u * t * t, q = t * t * t;
  const dx = 3 * u * u * (b[0] - a[0]) + 6 * u * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]);
  const dy = 3 * u * u * (b[1] - a[1]) + 6 * u * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]);
  const l = Math.hypot(dx, dy) || 1;
  return { x: m * a[0] + n * b[0] + o * c[0] + q * d[0], y: m * a[1] + n * b[1] + o * c[1] + q * d[1], tx: dx / l, ty: dy / l };
};
const seg = c => `C${c[1][0]} ${c[1][1]} ${c[2][0]} ${c[2][1]} ${c[3][0]} ${c[3][1]}`;
const rev = c => [c[3], c[2], c[1], c[0]];
// Short lines joining two curves at the same places: plates of a belly, planks of a bridge.
const rungs = (a, b, ts) => ts.map(t => {
  const p = cubic(a, t), q = cubic(b, t);
  return `M${f1(p.x)} ${f1(p.y)}L${f1(q.x)} ${f1(q.y)}`;
}).join('');
// A row of triangles standing on the upper side of a curve that runs to the right.
function spikes(curve, ts, base, tall, col) {
  return ts.map(t => {
    const p = cubic(curve, t), nx = p.ty, ny = -p.tx;
    const A = `${f1(p.x - p.tx * base - nx * 8)} ${f1(p.y - p.ty * base - ny * 8)}`;
    const B = `${f1(p.x + p.tx * base - nx * 8)} ${f1(p.y + p.ty * base - ny * 8)}`;
    return [`M${A}L${f1(p.x + nx * tall)} ${f1(p.y + ny * tall)}L${B}Z`, col];
  });
}

// A pointed roof with a scalloped band of tiles.
const cone = (cx, y, hw, top, col) => {
  const m = f1(y - (y - top) * 0.42), w = f1(hw * 0.58);
  return [
    [`M${cx - hw} ${y}L${cx} ${top}L${cx + hw} ${y}Q${cx} ${y + 16} ${cx - hw} ${y}Z`, col],
    [`M${cx - w} ${m}Q${cx} ${m + 14} ${cx + w} ${m}`, null],
  ];
};
const pennant = (x, top, len, col, dir = 1) => [
  [`M${x} ${top + 44}V${top}`, null],
  [`M${x} ${top}L${x + len * dir} ${top + 15}L${x} ${top + 30}Z`, col],
];
const fir = (x, y, s, col, trunk = '#c98a55') => place([
  ['M-11 -22L11 -22L11 4L-11 4Z', trunk],
  ['M-54 -16Q0 -2 54 -16L0 -92Z', col],
  ['M-43 -62Q0 -50 43 -62L0 -130Z', col],
  ['M-32 -104Q0 -94 32 -104L0 -166Z', col],
], x, y, s);
const house = (x, y, w, h, wall, roof, door = '#c98a55', win = '#5aa9ff') => [
  [R(x, y, w, h), wall],
  [`M${x - 12} ${y}L${x + w / 2} ${f1(y - h * 0.8)}L${x + w + 12} ${y}Z`, roof],
  [R(f1(x + w * 0.14), f1(y + h * 0.38), f1(w * 0.28), f1(h * 0.62)), door],
  [R(f1(x + w * 0.56), f1(y + h * 0.22), f1(w * 0.3), f1(h * 0.42)), win],
];
const sheep = [
  ['M-20 18L-20 42M-4 24L-4 44M14 24L14 44M28 18L28 42', null],
  [blob([[-36, -4], [-24, -28], [4, -36], [30, -26], [42, -2], [30, 20], [4, 28], [-24, 22]], 0.36), '#ffffff'],
  [el(-46, -12, 16, 19), '#fff0b3'],
  [el(-51, -15, 2.6), DARK], [el(-41, -15, 2.6), DARK],
];

// ---------- 1. Dragon flying over a castle ----------
const D_TOP = [
  [[305, 275], [350, 262], [410, 250], [470, 250]],
  [[470, 250], [540, 226], [640, 236], [700, 270]],
  [[700, 270], [790, 296], [880, 286], [950, 236]],
  [[950, 236], [985, 208], [1012, 186], [1040, 172]],
];
const D_OUT = [
  [[965, 280], [890, 340], [790, 370], [720, 372]],
  [[720, 372], [660, 420], [520, 425], [450, 388]],
  [[450, 388], [410, 370], [370, 340], [300, 335]],
];
const D_IN = [
  [[965, 280], [890, 316], [790, 336], [712, 336]],
  [[712, 336], [655, 378], [530, 383], [468, 350]],
  [[468, 350], [425, 333], [380, 310], [310, 298]],
];
const dragonBody = `M305 275${D_TOP.map(seg).join('')}L1052 190C1030 222 1000 252 965 280${D_OUT.map(seg).join('')}Z`;
const dragonBelly = `M965 280${D_OUT.map(seg).join('')}L310 298${[...D_IN].reverse().map(c => seg(rev(c))).join('')}Z`;
const legFront = 'M445 350C425 385 405 415 385 432C368 446 376 472 400 470C445 464 490 430 505 385C500 360 470 345 445 350Z';
const legHind = 'M640 352C640 322 700 312 730 342C750 367 735 407 705 427C680 447 640 464 612 464C590 464 584 440 602 430C625 420 640 397 640 352Z';

const dragonHead = [
  ['M126 288C104 282 78 268 52 246C62 266 70 280 72 294C62 300 52 308 44 318C54 324 64 332 72 342C70 356 64 372 54 390C82 380 110 364 132 346Z', '#ff9a4d'],
  ['M124 302C110 298 96 292 82 282C88 294 92 302 94 308C86 312 78 316 70 320C78 324 88 328 94 334C92 342 88 350 82 358C98 352 114 346 128 338Z', '#ffe066'],
  ['M318 280C356 258 394 262 410 282C386 292 376 310 382 334C356 334 332 322 320 306Z', '#ff9ec4'],
  ['M282 236C282 196 314 160 372 148C346 172 332 206 326 250Z', '#fff0b3'],
  ['M291 199Q310 196 331 213M312 173Q330 172 346 184', null],
  ['M240 214C242 184 268 160 318 152C296 170 286 194 282 226Z', '#fff0b3'],
  ['M251 184Q268 182 287 196', null],
  ['M318 262C300 205 222 190 185 232C172 250 152 258 134 264C100 272 92 322 120 344C150 366 205 372 250 368C300 364 338 334 334 296C332 282 326 270 318 262Z', '#5fd0a0'],
  [el(238, 270, 26, 30), '#ffffff'],
  [el(231, 275, 13), DARK],
  ['M208 234Q238 218 268 236', null],
  [el(124, 300, 5), DARK],
  ['M124 334Q190 360 258 330Q270 324 270 308', null],
  [el(292, 322, 18, 13), '#ff9ec4'],
];

const dragonFlight = {
  id: 'fantasy2-dragon-flight', title: 'Дракон летит над замком',
  shapes: [
    bg('#cfe6ff'),
    // sun and clouds
    [starD(96, 104, 96, 68, 12), '#ff9a4d'],
    [O(96, 104, 56), '#ffe066'],
    [cloudD(276, 84, 58), '#ffffff'],
    [cloudD(1110, 350, 54), '#ffffff'],
    [cloudD(960, 66, 50), '#ffffff'],
    [cloudD(596, 560, 44), '#ffffff'],
    [bird(250, 470, 18), null],
    [bird(310, 505, 14), null],
    // mountains
    ['M-10 660L130 478L290 660Z', '#b9a8ee'],
    ['M92 528L130 478L172 526L150 548L128 530L108 548Z', '#ffffff'],
    ['M190 670L372 512L560 670Z', '#b9a8ee'],
    ['M328 550L372 512L420 552L396 572L372 554L350 572Z', '#ffffff'],
    ['M1010 680L1140 540L1210 610V680Z', '#b9a8ee'],
    // far meadow
    ['M-10 652C150 610 350 624 520 660C700 632 900 640 1210 662V910H-10Z', '#a5e27a'],
    // river
    ['M284 630C350 690 230 740 290 800C330 850 300 880 250 910H40C110 872 170 842 140 800C100 742 266 700 284 630Z', '#5aa9ff'],
    // village
    ...house(40, 700, 86, 58, '#fff0b3', '#ff6b6b'),
    ...house(380, 716, 92, 62, '#ffffff', '#8f6fd6'),
    ['M150 730L166 622L218 622L234 730Z', '#fff0b3'],
    ['M158 624Q192 570 226 624Z', '#ff6b6b'],
    [arch(192, 684, 30, 46), '#c98a55'],
    ...[0.35, 1.92, 3.49, 5.06].map(a => [petal(192, 612, 86, 17, a), '#ffffff']),
    [O(192, 612, 11), '#ffe066'],
    ...fir(520, 760, 0.8, '#5fd0a0'),
    ...fir(-2, 800, 0.9, '#5fd0a0'),
    // castle hill
    ['M450 910C540 790 720 742 900 742C1040 742 1150 766 1210 790V910Z', '#7fd46a'],
    // castle: back tower
    [R(860, 500, 90, 290), '#d8d3e6'],
    ['M860 610H950', null],
    ...cone(905, 506, 64, 392, '#8f6fd6'),
    ...pennant(905, 348, 54, '#ff6b6b'),
    [arch(905, 538, 34, 54), '#5aa9ff'],
    // side towers
    [R(700, 574, 90, 230), '#fff0b3'],
    ...cone(745, 580, 64, 470, '#ff6b6b'),
    ...pennant(745, 426, 50, '#ffe066'),
    [arch(745, 612, 34, 54), '#5aa9ff'],
    [R(1010, 594, 90, 210), '#fff0b3'],
    ...cone(1055, 600, 64, 494, '#ff9ec4'),
    ...pennant(1055, 450, 50, '#ffe066'),
    [arch(1055, 632, 34, 54), '#5aa9ff'],
    // main wall and gate
    [crenel(775, 1025, 662, 5, 22, 812), '#d8d3e6'],
    [arch(900, 702, 96, 112), '#c98a55'],
    ['M884 703V814M916 703V814', null],
    ['M700 692H775M1025 704H1100', null],
    ['M792 780h22M806 760h22M972 786h22M790 690h14M996 690h14', null],
    [arch(820, 708, 34, 56), '#5aa9ff'],
    [arch(980, 708, 34, 56), '#5aa9ff'],
    // road and bushes
    ['M852 812C850 850 800 876 776 910H910C906 876 940 850 948 812Z', '#fff0b3'],
    [puff([[650, 820], [668, 782], [712, 770], [752, 790], [770, 826], [740, 846], [680, 846]]), '#5fd0a0'],
    [puff([[1030, 824], [1050, 786], [1094, 774], [1136, 792], [1154, 828], [1120, 848], [1060, 848]]), '#5fd0a0'],
    // bridge
    ['M84 822C150 752 310 752 376 822V852C310 800 150 800 84 852Z', '#c98a55'],
    [rungs([[84, 822], [150, 752], [310, 752], [376, 822]], [[84, 852], [150, 800], [310, 800], [376, 852]], [0.2, 0.4, 0.6, 0.8]), null],
    // sheep and flowers
    ...place(sheep, 505, 836, 1),
    ...place(sheep, 592, 866, 0.8, 0, -1),
    ...flower(420, 862, 34, '#ff9ec4', '#ffe066', 5),
    ...flower(1168, 870, 34, '#ffffff', '#ffe066', 5),
    ...flower(980, 872, 30, '#ff6b6b', '#ffe066', 5),
    // dragon: flame, tail, far limbs and wing
    ['M1066 219C1090 190 1094 150 1088 120C1058 124 1020 138 994 158C1012 166 1024 178 1034 190C1046 196 1056 206 1066 219Z', '#ff6b6b'],
    ...spikes(D_TOP[0], [0.3, 0.68], 22, 40, '#ff6b6b'),
    ...spikes(D_TOP[2], [0.42, 0.68, 0.94], 22, 40, '#ff6b6b'),
    ...spikes(D_TOP[3], [0.55], 18, 32, '#ff6b6b'),
    ['M455 258C440 180 470 95 520 40C560 22 610 30 640 60L600 250Z', '#ff9ec4'],
    ['M520 40Q512 150 548 246', null],
    [tf(legFront, 44, -6), '#5fd0a0'],
    [tf(legHind, 46, -8), '#5fd0a0'],
    [dragonBody, '#5fd0a0'],
    [dragonBelly, '#fff0b3'],
    [rungs(D_OUT[0], D_IN[0], [0.3, 0.55, 0.8]) + rungs(D_OUT[1], D_IN[1], [0, 0.2, 0.4, 0.6, 0.8]) + rungs(D_OUT[2], D_IN[2], [0, 0.35, 0.7]), null],
    [el(512, 308, 11), '#ff9ec4'], [el(556, 322, 14), '#ff9ec4'], [el(602, 338, 12), '#ff9ec4'],
    [legFront, '#5fd0a0'],
    ['M384 446q10 8 8 20M400 442q10 10 6 24', null],
    [legHind, '#5fd0a0'],
    ['M604 440q10 8 8 20M620 436q10 10 6 24', null],
    // near wing
    ['M530 262C525 180 565 100 622 52C700 30 800 40 870 78Q815 125 852 196Q785 215 770 305Q715 262 660 290Q590 300 530 262Z', '#ff9a4d'],
    ['M622 52Q760 100 852 196M622 52Q720 150 770 305', null],
    ['M512 268C506 182 550 96 610 44C624 36 640 50 630 64C584 112 552 188 552 270Q532 282 512 268Z', '#5fd0a0'],
    ...place(dragonHead, 330 * -0.12, 300 * -0.12, 1.12),
  ],
};

// ---------- 2. Mushroom houses and fireflies ----------
// A row of round tree tops from left to right, closed along the bottom.
function ridge(pts, bottom) {
  let d = `M${pts[0][0]} ${bottom}V${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const r = f1(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * 0.56);
    d += `A${r} ${r} 0 0 1 ${pts[i][0]} ${pts[i][1]}`;
  }
  return `${d}V${bottom}Z`;
}
const mirror = d => tf(d, 0, 0, 1, 0, -1);
const firefly = (x, y, s = 1, rot = 0) => {
  const w = 'M0 -6C-10 -30 -36 -36 -40 -20C-38 -6 -16 -2 0 -6Z';
  return place([[w, '#ffffff'], [mirror(w), '#ffffff'], [el(0, 8, 17), '#ffe45c'], [el(0, -11, 6), DARK]], x, y, s, rot);
};
const toadstool = (x, y, s, cap) => place([
  ['M-15 0C-11 -20 -11 -36 -10 -44L10 -44C11 -36 11 -20 15 0Z', '#fff0d0'],
  ['M-46 -42C-44 -82 -18 -98 0 -98C18 -98 44 -82 46 -42Q0 -26 -46 -42Z', cap],
  ['M-24 -62Q-20 -78 -6 -82M14 -80Q26 -74 30 -60', null],
], x, y, s);
const fern = (x, y, len, col, n = 3, spread = 0.5) =>
  Array.from({ length: n }, (_, i) => [petal(x, y, len, len * 0.2, -1.5708 + (i - (n - 1) / 2) * spread), col]);
const owl = [
  ['M-42 -34L-38 -74L-10 -50Z', '#a98bff'], ['M42 -34L38 -74L10 -50Z', '#a98bff'],
  [el(0, 0, 48, 58), '#a98bff'],
  [el(0, 18, 28, 32), '#fff0d0'],
  ['M-10 10Q-5 18 0 10Q5 18 10 10M-10 28Q-5 36 0 28Q5 36 10 28', null],
  ['M-48 -4C-64 12 -62 40 -44 50C-36 32 -38 12 -48 -4Z', '#a98bff'],
  ['M48 -4C64 12 62 40 44 50C36 32 38 12 48 -4Z', '#a98bff'],
  [el(-20, -22, 20), '#ffffff'], [el(20, -22, 20), '#ffffff'],
  [el(-17, -20, 10), DARK], [el(17, -20, 10), DARK],
  ['M-8 -6L8 -6L0 9Z', '#ff9a4d'],
  ['M-16 56L-16 66M-8 57L-8 67M8 57L8 67M16 56L16 66', null],
];
const lantern = (x, y) => [
  [`M${x} ${y + 4}V${y + 34}`, null],
  [`M${x - 30} ${y + 58}L${x} ${y + 30}L${x + 30} ${y + 58}Z`, '#a9744a'],
  [`M${x - 24} ${y + 58}H${x + 24}V${y + 104}Q${x} ${y + 132} ${x - 24} ${y + 104}Z`, '#ffe45c'],
];
const picket = (x, y, h) => `M${x} ${y}V${y - h + 14}L${x + 13} ${y - h}L${x + 26} ${y - h + 14}V${y}Z`;
const snail = [
  ['M-62 -22L-72 -48M-52 -24L-50 -50', null],
  ['M-80 14C-86 -8 -72 -30 -58 -22C-48 -16 -50 -2 -42 4C-20 10 30 8 62 12Q74 24 58 28L-64 28Q-80 26 -80 14Z', '#ff9ec4'],
  [el(10, -14, 36), '#a98bff'],
  ['M10 -14C22 -22 28 -6 16 2C0 12 -18 -2 -12 -24C-6 -42 24 -44 36 -24', null],
  [el(-66, -8, 2.6), DARK],
];
const roundWindow = (x, y, r, col = '#ffe45c') => [[O(x, y, r), col], [`M${x} ${y - r}V${y + r}M${x - r} ${y}H${x + r}`, null]];

const fireflyForest = {
  id: 'fantasy2-firefly-forest', title: 'Грибные домики и светлячки',
  shapes: [
    bg('#4a55a8'),
    [O(872, 106, 68), '#fff0d0'],
    ['M842 86a16 16 0 0 1 22 -10M884 132a14 14 0 0 0 20 -8', null],
    [spark(130, 300, 24), '#ffe45c'],
    [spark(420, 80, 24), '#ffe45c'],
    [spark(610, 170, 22), '#ffe45c'],
    [spark(1082, 58, 24), '#ffe45c'],
    [spark(960, 440, 20), '#ffe45c'],
    // far trees
    [ridge([[-20, 430], [70, 350], [190, 380], [310, 320], [440, 366], [560, 356], [700, 366], [830, 316], [950, 366], [1080, 320], [1180, 372], [1220, 430]], 660), '#2f8f8a'],
    // moss and path
    ['M-10 640C200 604 420 612 600 622C800 632 1000 604 1210 632V910H-10Z', '#7ed67a'],
    ['M552 770C548 812 492 836 470 910H712C700 852 656 812 648 770Z', '#f0d49a'],
    [E(590, 812, 34, 13), '#ffffff'], [E(560, 858, 38, 14), '#ffffff'], [E(640, 884, 36, 13), '#ffffff'],
    // big trees on both sides
    ['M-10 -10H74C62 200 84 420 72 560C68 700 92 820 134 910H-10Z', '#a9744a'],
    ['M60 56C120 50 190 76 262 52C274 48 278 64 268 70C200 112 130 100 62 120Z', '#a9744a'],
    ['M20 300q16 30 4 70M40 520q14 40 2 90M24 150q10 24 0 50', null],
    ['M1210 -10H1128C1140 200 1118 420 1130 560C1134 700 1110 820 1068 910H1210Z', '#a9744a'],
    ['M1140 286C1060 276 980 306 906 280C894 276 890 292 900 298C970 340 1050 328 1138 348Z', '#a9744a'],
    ['M1180 200q-16 30 -4 70M1164 480q-14 40 -2 90M1178 660q-10 30 0 60', null],
    ...lantern(206, 94),
    ...place(owl, 1012, 214, 1.2),
    ...lantern(1070, 330),
    // tall house on the left
    ['M150 792C158 660 170 550 185 470H265C280 550 292 660 300 792Z', '#fff0d0'],
    ['M100 480C125 380 185 290 225 262C265 290 325 380 350 480Q225 522 100 480Z', '#a98bff'],
    [el(225, 346, 24, 19), '#ff9ec4'], [el(168, 430, 26, 21), '#ff9ec4'], [el(284, 432, 26, 21), '#ff9ec4'],
    ...roundWindow(225, 568, 28),
    [arch(225, 672, 66, 120), '#ff9ec4'],
    [O(244, 736, 8), '#ffe45c'],
    // the big house
    ['M686 356V258H736V356Z', '#a9744a'],
    [R(676, 240, 70, 24, 8), '#ff9a4d'],
    [el(724, 200, 22), '#ffffff'], [el(694, 148, 28), '#ffffff'], [el(640, 88, 34), '#ffffff'],
    ['M430 772C445 650 470 570 495 522H705C730 570 755 650 770 772Z', '#fff0d0'],
    ['M370 530C370 380 490 290 600 290C710 290 830 380 830 530Q600 582 370 530Z', '#ff6b6b'],
    [el(470, 420, 36, 29), '#ffffff'], [el(596, 352, 32, 25), '#ffffff'], [el(716, 414, 38, 31), '#ffffff'],
    [el(548, 494, 24, 19), '#ffffff'], [el(776, 500, 22, 18), '#ffffff'], [el(418, 496, 22, 18), '#ffffff'],
    [el(672, 494, 22, 18), '#ffffff'],
    ...roundWindow(600, 438, 36),
    [arch(600, 618, 144, 154), '#ff9a4d'],
    [arch(600, 640, 100, 132), '#a9744a'],
    [heartD(600, 692, 20), '#ff9ec4'],
    [O(630, 734, 9), '#ffe45c'],
    ...roundWindow(482, 676, 28),
    ...roundWindow(718, 676, 28),
    // small house on the right
    ['M890 802C896 730 906 690 920 660H1020C1034 690 1044 730 1050 802Z', '#fff0d0'],
    ['M845 668C852 580 915 530 970 530C1025 530 1088 580 1095 668Q970 706 845 668Z', '#ff9a4d'],
    [el(912, 604, 26, 21), '#fff0d0'], [el(1024, 612, 27, 22), '#fff0d0'], [el(972, 566, 23, 17), '#fff0d0'],
    [arch(970, 708, 62, 94), '#6fb8ff'],
    [O(986, 762, 8), '#ffe45c'],
    // fences
    ['M318 742H424M786 760H884', null],
    ...[322, 356, 390].map(x => [picket(x, 778, 74), '#f0d49a']),
    ...[790, 824, 858].map(x => [picket(x, 796, 74), '#f0d49a']),
    // fireflies
    ...firefly(396, 226, 1.2, -0.3),
    ...firefly(540, 120, 1.1, 0.3),
    ...firefly(960, 446, 1.15, 0.2),
    ...firefly(366, 600, 1.15, 0.25),
    ...firefly(386, 404, 1.1, -0.25),
    ...firefly(112, 590, 1.1, 0.1),
    ...firefly(806, 300, 1.1, -0.2),
    // meadow things
    ...fern(60, 900, 110, '#3fae6a'),
    ...fern(1150, 905, 110, '#3fae6a'),
    ...place(snail, 846, 868, 1),
    ...toadstool(350, 846, 0.9, '#ff6b6b'),
    ...toadstool(1040, 886, 0.8, '#a98bff'),
    ...toadstool(742, 846, 0.7, '#ff9a4d'),
    ...toadstool(150, 880, 0.75, '#6fb8ff'),
    ...flower(430, 868, 30, '#ff9ec4', '#ffe45c', 5),
    ...flower(250, 870, 30, '#6fb8ff', '#ffe45c', 5),
    ...flower(952, 866, 30, '#ffffff', '#ffe45c', 5),
  ],
};

// ---------- 3. Mermaid lagoon ----------
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function split(c, t) {
  const a = lerp(c[0], c[1], t), b = lerp(c[1], c[2], t), d = lerp(c[2], c[3], t);
  const e = lerp(a, b, t), f = lerp(b, d, t), g = lerp(e, f, t);
  return [[c[0], a, e, g], [g, f, d, c[3]]];
}
const sub = (c, t0, t1) => { const r = split(c, t1)[0]; return t0 <= 0 ? r : split(r, t0 / t1)[1]; };
// A piece of a chain of curves, from u0 to u1, where whole numbers are the joints.
function chainSub(chain, u0, u1) {
  const out = [];
  for (let i = Math.floor(u0); i < chain.length && i < u1; i++) {
    const a = Math.max(u0 - i, 0), b = Math.min(u1 - i, 1);
    if (b - a > 1e-6) out.push(sub(chain[i], a, b));
  }
  return out;
}
const pt = p => `${f1(p[0])} ${f1(p[1])}`;
const segP = c => `C${pt(c[1])} ${pt(c[2])} ${pt(c[3])}`;
// One band of a tube whose two sides are chains of curves; its ends bow by `bow`.
function band(top, bot, [t0, t1], [b0, b1], bow = 12) {
  const a = chainSub(top, t0, t1), b = chainSub(bot, b0, b1).reverse().map(rev);
  const ctl = (p, q, k) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
    return [(p[0] + q[0]) / 2 - (dy / l) * k, (p[1] + q[1]) / 2 + (dx / l) * k];
  };
  const p1 = a[a.length - 1][3], q1 = b[0][0], q0 = b[b.length - 1][3], p0 = a[0][0];
  return `M${pt(p0)}${a.map(segP).join('')}Q${pt(ctl(q1, p1, bow))} ${pt(q1)}${b.map(segP).join('')}Q${pt(ctl(q0, p0, t0 > 0 ? bow : 0))} ${pt(p0)}Z`;
}
// A fan shell made of wedges in two colours; the hinge is at x, y.
function shellFan(x, y, r, spread, mid, n, colA, colB) {
  const a0 = mid - spread / 2, step = spread / n;
  const P = (rr, a) => `${f1(x + Math.cos(a) * rr)} ${f1(y + Math.sin(a) * rr)}`;
  return Array.from({ length: n }, (_, i) =>
    [`M${x} ${y}L${P(r, a0 + i * step)}Q${P(r * 1.2, a0 + (i + 0.5) * step)} ${P(r, a0 + (i + 1) * step)}Z`, i % 2 ? colB : colA]);
}
const TAIL_T = [
  [[522, 492], [540, 540], [600, 548], [670, 560]],
  [[670, 560], [740, 572], [790, 610], [830, 600]],
  [[830, 600], [850, 594], [862, 574], [870, 556]],
];
const TAIL_B = [
  [[430, 492], [424, 520], [416, 550], [430, 580]],
  [[430, 580], [470, 640], [580, 612], [660, 622]],
  [[660, 622], [720, 630], [760, 654], [820, 646]],
  [[820, 646], [860, 640], [888, 600], [896, 566]],
];
const TAIL_CUTS = [[0, 0], [0.3, 1.15], [0.65, 1.5], [1, 1.85], [1.4, 2.4], [1.8, 2.85], [2.3, 3.35], [3, 4]];
const TAIL_COLS = ['#ff8fc7', '#8f6fd6', '#7aa7e8', '#5fcf8f', '#ffe066', '#ffb04d', '#ff8fc7'];
const crab = [
  ['M-34 14L-60 32M-40 4L-66 12M34 14L60 32M40 4L66 12M-30 -14L-50 -30M30 -14L50 -30', null],
  [el(-56, -40, 18), '#ff6b6b'], [el(56, -40, 18), '#ff6b6b'],
  ['M-56 -40L-66 -58M56 -40L66 -58', null],
  [el(0, 0, 46, 31), '#ff6b6b'],
  ['M-12 -28L-14 -44M12 -28L14 -44M-12 6Q0 16 12 6', null],
  [el(-14, -49, 7), '#ffffff'], [el(14, -49, 7), '#ffffff'],
];
const turtle = [
  ['M-34 -22C-38 -52 -60 -68 -86 -62C-80 -46 -68 -32 -48 -14Z', '#5fcf8f'],
  ['M-34 22C-38 52 -60 68 -86 62C-80 46 -68 32 -48 14Z', '#5fcf8f'],
  ['M28 -18C44 -40 64 -44 80 -36C70 -22 56 -12 40 -4Z', '#5fcf8f'],
  ['M28 18C44 40 64 44 80 36C70 22 56 12 40 4Z', '#5fcf8f'],
  [el(-64, -6, 21, 17), '#5fcf8f'],
  [el(-72, -10, 3), DARK],
  [el(0, 0, 52, 38), '#ffb04d'],
  ['M-22 0L-11 -18L11 -18L22 0L11 18L-11 18Z', '#ffe066'],
  ['M-22 0L-52 0M22 0L52 0M-11 -18L-25 -33.3M11 -18L25 -33.3M-11 18L-25 33.3M11 18L25 33.3', null],
];

const jelly = [
  ['M-22 4C-30 20 -14 30 -22 48M0 6C-8 22 8 34 0 54M22 4C14 20 30 30 22 48', null],
  ['M-38 2C-38 -50 38 -50 38 2Q28 14 19 2Q9 14 0 2Q-9 14 -19 2Q-28 14 -38 2Z', '#ff8fc7'],
  ['M-16 -14Q-14 -28 0 -32', null],
];
const coral = [
  ['M-10 0C-12 -24 -30 -30 -34 -52C-36 -68 -20 -72 -17 -58C-15 -46 -8 -44 -7 -54C-5 -70 -9 -84 -5 -98C-1 -112 15 -110 15 -96C15 -84 8 -70 10 -54C15 -48 22 -56 24 -66C28 -80 43 -76 41 -62C37 -40 14 -28 12 0Z', '#ff6b6b'],
];
const dolphin = [
  [el(912, 572, 56, 15), '#ffffff'],
  ['M980 440C984 412 1000 396 1024 392C1018 410 1022 426 1032 434Z', '#7aa7e8'],
  ['M902 550C882 568 858 572 838 562C854 552 864 542 868 526C882 530 894 536 902 550Z', '#7aa7e8'],
  ['M888 540C900 470 960 420 1030 424C1066 426 1092 444 1110 470L1138 478C1130 492 1112 498 1098 496C1070 512 1030 502 990 508C950 514 920 532 906 558Z', '#7aa7e8'],
  ['M1098 496C1070 512 1030 502 990 508C958 513 934 526 916 544C946 504 1008 482 1060 486C1076 488 1090 492 1098 496Z', '#ffffff'],
  ['M1016 500C1012 522 996 538 980 542C982 524 988 510 996 502Z', '#7aa7e8'],
  [el(1080, 462, 4), DARK],
];
const clam = [
  ['M-100 0C-110 -70 -40 -120 30 -100C70 -88 100 -50 100 0C60 -16 -60 -16 -100 0Z', '#8f6fd6'],
  ['M-58 -10Q-56 -60 -30 -98M0 -12Q6 -60 28 -100M56 -10Q66 -44 84 -60', null],
  ['M-100 0C-60 -16 60 -16 100 0C60 22 -60 22 -100 0Z', '#ff8fc7'],
  [el(0, -8, 25), '#ffffff'],
  ['M-100 0C-90 62 90 62 100 0C60 22 -60 22 -100 0Z', '#8f6fd6'],
];
const conch = [
  ['M-92 10L34 -42C64 -40 80 -14 72 12C64 34 40 44 20 38Z', '#ffb04d'],
  ['M-46 -9Q-34 8 -40 22M-6 -25Q10 2 0 31', null],
  [el(46, 2, 19, 27), '#ff8fc7'],
];
const ROCK_L = [[286, 840], [262, 700], [296, 562], [370, 522]];
const ROCK_R = [[700, 600], [752, 630], [782, 720], [772, 840]];
const rl = cubic(ROCK_L, 0.42), rr = cubic(ROCK_R, 0.45);

const mermaidLagoon = {
  id: 'fantasy2-mermaid-lagoon', title: 'Лагуна русалки',
  shapes: [
    bg('#ffdcc8'),
    [starD(778, 330, 104, 82, 14), '#ffb04d'],
    [O(778, 330, 68), '#ffe066'],
    [cloudD(370, 92, 64), '#ffffff'],
    [cloudD(700, 110, 56), '#ffffff'],
    [cloudD(1080, 96, 48), '#ffffff'],
    [bird(330, 236, 18), null], [bird(820, 170, 15), null], [bird(1120, 190, 14), null],
    // far island with palms
    ['M150 304C140 254 150 204 170 174L186 180C168 210 160 256 172 304Z', '#c98a55'],
    ['M236 310C232 276 240 244 256 222L270 228C256 250 250 280 258 310Z', '#c98a55'],
    ...[3.5, 4.2, 5.0, 5.9, 0.4].map(a => [petal(178, 176, 84, 17, a), '#5fcf8f']),
    ...[3.4, 4.2, 5.1, 6.0, 0.6].map(a => [petal(263, 224, 62, 14, a), '#5fcf8f']),
    ['M30 340C80 286 220 278 300 340Z', '#f7e0a3'],
    // lighthouse on a far cliff
    ['M1150 300L1157 204L1187 204L1194 300Z', '#ffffff'],
    ['M1154 258L1156 230L1188 230L1190 258Z', '#ff6b6b'],
    [R(1159, 178, 26, 26), '#ffe066'],
    ['M1152 180L1172 152L1192 180Z', '#ff6b6b'],
    ['M1084 340C1104 300 1150 284 1210 282V340Z', '#b0a8d9'],
    // sea
    ['M-10 330H1210V910H-10Z', '#8fdcf2'],
    // ship far away
    ['M970 300V192M1036 300V158', null],
    ['M888 298L930 214L930 298Z', '#ffffff'],
    ['M944 212Q970 204 996 212Q988 256 996 304H944Q952 256 944 212Z', '#ffffff'],
    ['M1008 238H1064Q1056 272 1064 304H1008Q1016 272 1008 238Z', '#ffffff'],
    ['M1012 186Q1036 178 1060 186Q1053 214 1060 242Q1036 250 1012 242Q1019 214 1012 186Z', '#ffffff'],
    ['M1036 158L1074 146L1036 134Z', '#ff6b6b'],
    ['M878 300H1082L1064 338Q982 352 906 338Z', '#c98a55'],
    ['M-10 404q50 -18 100 0q50 18 100 0q50 -18 100 0q50 18 100 0q50 -18 100 0q50 18 100 0q50 -18 100 0q50 18 100 0q50 -18 100 0q50 18 100 0q50 -18 100 0q50 18 100 0q50 -18 110 0V910H-10Z', '#55bfe8'],
    ['M-10 520q75 -22 150 0q75 22 150 0q75 -22 150 0q75 22 150 0q75 -22 150 0q75 22 150 0q75 -22 150 0q75 22 150 0q10 -4 20 -6V910H-10Z', '#6fe0d0'],
    ['M716 372h60M800 386h50M726 440h56', null],
    ...fish(1090, 470, 36, '#ffb04d', '#ff6b6b', -1),
    ...place(dolphin, -630, 130, 0.8),
    ...fish(700, 474, 34, '#ff8fc7', '#8f6fd6', 1),
    ...fish(204, 672, 38, '#ffe066', '#ff6b6b', -1),
    ...place(jelly, 66, 652, 1.05),
    ...place(coral, 1146, 752, 1.3),
    ...place(turtle, 996, 668, 1.1),
    ...[[860, 700, 15], [868, 752, 11], [1082, 566, 14], [1108, 534, 10], [272, 610, 13], [250, 574, 10], [1040, 770, 11]].map(([x, y, r]) => [O(x, y, r), '#ffffff']),
    // rock
    [`M286 840${seg(ROCK_L)}C402 506 432 512 452 532L700 600${seg(ROCK_R)}Z`, '#b0a8d9'],
    [`M${f1(rl.x)} ${f1(rl.y)}C360 660 420 720 470 840M${f1(rr.x)} ${f1(rr.y)}C700 690 640 740 620 840`, null],
    [starD(352, 610, 34, 16), '#ffb04d'],
    [starD(716, 752, 30, 14, 5, -1.1), '#ff8fc7'],
    // mermaid: long hair behind
    ['M470 226C436 224 386 236 384 300C384 344 362 366 352 410C342 452 344 504 364 538C374 554 394 564 414 556L436 540L440 470L500 420L522 420C528 442 542 462 566 470C574 448 568 420 562 392C556 352 560 322 556 296C552 240 506 224 470 226Z', '#8f6fd6'],
    ['M396 318C396 384 368 426 368 506M546 306C550 326 552 344 550 360', null],
    // body and both arms in one piece
    ['M459 330V352C444 355 428 360 420 374C412 400 398 440 384 478C378 492 372 508 380 518C388 527 402 524 407 512C409 502 410 492 411 484C418 456 426 430 435 402C438 424 444 444 442 462C440 476 434 484 430 494H522C518 484 512 476 510 462C508 444 514 420 517 396C534 402 558 406 576 398C590 390 598 368 604 346C612 338 628 324 632 304C636 282 622 266 606 272C596 276 594 290 594 300C587 295 577 299 576 308C576 318 584 322 591 320C589 328 586 336 583 342C580 356 574 368 564 378C550 378 536 372 520 364C506 357 494 353 481 352V330Z', '#ffd9b8'],
    ['M433 404C456 417 498 417 519 402C520 424 516 440 511 452C492 462 460 462 441 452C437 440 433 424 433 404Z', '#ffe066'],
    ['M476 414L476 459', null],
    // tail
    ['M866 560C844 500 868 444 914 422C920 466 928 504 902 554Z', '#8f6fd6'],
    ['M898 552C940 518 990 516 1018 544C980 562 942 584 892 570Z', '#8f6fd6'],
    ['M880 536Q882 488 904 454M912 554Q954 536 992 543', null],
    ...TAIL_COLS.map((c, i) => [band(TAIL_T, TAIL_B, [TAIL_CUTS[i][0], TAIL_CUTS[i + 1][0]], [TAIL_CUTS[i][1], TAIL_CUTS[i + 1][1]]), c]),
    ['M424 486Q476 474 528 486L526 506Q514 520 502 506Q490 520 478 506Q466 520 454 506Q442 520 430 506Z', '#ffe066'],
    // head
    [el(470, 284, 58, 60), '#ffd9b8'],
    ['M410 290C404 232 436 198 470 198C516 198 540 236 532 292C514 284 494 264 484 240C470 266 444 286 410 290Z', '#8f6fd6'],
    [el(449, 300, 7, 9), DARK], [el(493, 300, 7, 9), DARK],
    ['M439 290L432 285M503 290L510 285M458 322Q471 334 484 322', null],
    [starD(522, 232, 25, 11), '#ffe066'],
    // beach
    ['M-10 706C120 706 220 764 330 804C480 840 700 840 840 804C960 790 1080 744 1210 734V910H-10Z', '#f7e0a3'],
    ...fern(292, 800, 70, '#5fcf8f', 3, 0.45),
    ...fern(790, 812, 64, '#5fcf8f', 3, 0.45),
    ...shellFan(128, 882, 112, 2.3, -1.5708, 5, '#ff8fc7', '#ffffff'),
    [el(128, 880, 20, 14), '#ff8fc7'],
    ...place(conch, 330, 864, 0.95, -0.15),
    [starD(480, 866, 40, 19), '#ff6b6b'],
    ...place(crab, 640, 854, 0.85),
    ...shellFan(800, 896, 58, 2.2, -1.5708, 4, '#ffe066', '#ffb04d'),
    ...place(clam, 1040, 838, 1),
    [starD(900, 868, 34, 16, 5, -1.2), '#ff8fc7'],
  ],
};

// ---------- 4. City on the clouds ----------
// A curve moved sideways by d, as many short steps: the stripes of a rainbow bridge stay parallel.
const offs = (c, d, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
  const p = cubic(c, i / n);
  return [p.x + p.ty * d, p.y - p.tx * d];
});
const stripe = (c, d0, d1) => `M${[...offs(c, d0), ...offs(c, d1).reverse()].map(pt).join('L')}Z`;
// The curve is the inner edge of the bridge; the stripes stack outward from it.
const rainbowBridge = (c, cols, w = 20) => cols.map((col, i) => {
  const d = (cols.length - i) * w;
  return [stripe(c, d, d - w), col];
});
const ENV_L = [[[0, -100], [-62, -100], [-100, -56], [-100, -6]], [[-100, -6], [-100, 44], [-52, 84], [-30, 112]]];
const moved = (chain, x, y, s, flip = 1) => chain.map(c => c.map(p => [x + p[0] * s * flip, y + p[1] * s]));
const basket = (x, y, s, col = '#c98a55') => {
  const P = (u, v) => `${f1(x + u * s)} ${f1(y + v * s)}`;
  // A small balloon carries its basket right under the envelope.
  if (s < 0.8) return [[`M${P(-30, 110)}L${P(30, 110)}L${P(24, 168)}L${P(-24, 168)}Z`, col]];
  return [
    [`M${P(-26, 128)}L${P(-20, 164)}M${P(26, 128)}L${P(20, 164)}`, null],
    [`M${P(-30, 110)}L${P(30, 110)}L${P(26, 130)}L${P(-26, 130)}Z`, col],
    [`M${P(-24, 162)}L${P(24, 162)}L${P(19, 200)}L${P(-19, 200)}Z`, col],
  ];
};
const kite = (x, y, s, rot, a, b) => place([
  ['M0 56C-14 78 10 96 -6 118C-16 132 -6 146 -12 160', null],
  ['M0 -40L28 0L0 0Z', a], ['M0 -40L-28 0L0 0Z', b], ['M0 56L28 0L0 0Z', b], ['M0 56L-28 0L0 0Z', a],
], x, y, s, rot);
// The soft shadow under a cloud island: the same puff, narrower and lower.
const under = (pts, cx, dy) => puff(pts.map(([x, y]) => [f1(cx + (x - cx) * 0.9), y + dy]));
// A balloon with bands across it.
const balloonBands = (x, y, s, cols, cuts) => [
  ...cols.map((col, i) => [band(moved(ENV_L, x, y, s), moved(ENV_L, x, y, s, -1), [cuts[i], cuts[i + 1]], [cuts[i], cuts[i + 1]], -14 * s), col]),
  ...basket(x, y, s),
];
// A balloon with gores from top to bottom.
function balloonGores(x, y, s, colA, colB) {
  const P = (u, v) => `${f1(x + u * s)} ${f1(y + v * s)}`;
  const side = (e, b) => `C${P(e * 1.05, -72)} ${P(e, 50)} ${P(b, 112)}`;
  const back = (e, b) => `C${P(e, 50)} ${P(e * 1.05, -72)} ${P(0, -100)}`;
  const gore = (e0, b0, e1, b1) => `M${P(0, -100)}${side(e0, b0)}L${P(b1, 112)}${back(e1, b1)}Z`;
  return [
    [`M${P(0, -100)}C${P(62, -100)} ${P(100, -56)} ${P(100, -6)}C${P(100, 44)} ${P(52, 84)} ${P(30, 112)}L${P(-30, 112)}C${P(-52, 84)} ${P(-100, 44)} ${P(-100, -6)}C${P(-100, -56)} ${P(-62, -100)} ${P(0, -100)}Z`, colA],
    [gore(-66, -18, -23, -6), colB],
    [gore(23, 6, 66, 18), colB],
    ...basket(x, y, s),
  ];
}
const airship = [
  ['M56 -16L98 -46L92 -4Z', '#ff6b7f'], ['M56 16L98 46L92 4Z', '#ff6b7f'],
  ['M-26 30L26 30L18 58L-18 58Z', '#c98a55'],
  [el(0, 0, 88, 36), '#4fc9c4'],
  ['M-30 -33.8Q0 -38.2 30 -33.8Q44 0 30 33.8Q0 38.2 -30 33.8Q-44 0 -30 -33.8Z', '#ffe066'],
];
const sq = (x, y, w, h, col = '#ffe066') => [R(x, y, w, h, 4), col];
const dome = (cx, y, r, col) => [`M${cx - r} ${y}A${r} ${r} 0 0 1 ${cx + r} ${y}Z`, col];

const ISLE_A = [[20, 650], [38, 600], [90, 575], [160, 588], [230, 570], [300, 588], [345, 628], [335, 672], [270, 702], [190, 708], [110, 702], [50, 692]];
const ISLE_C = [[858, 618], [870, 566], [925, 542], [1000, 554], [1070, 536], [1140, 550], [1186, 590], [1176, 636], [1110, 666], [1030, 672], [950, 666], [890, 656]];
const ISLE_B = [[408, 800], [424, 742], [480, 716], [550, 730], [605, 712], [665, 730], [730, 716], [786, 742], [802, 800], [764, 826], [684, 838], [605, 842], [526, 838], [446, 826]];
const BRIDGE_COLS = ['#ff6b7f', '#ffe066', '#7fd67a', '#5aa9ff'];
const BRIDGE_L = [[352, 668], [360, 584], [412, 592], [418, 776]];
const BRIDGE_R = [[784, 776], [788, 596], [850, 548], [858, 628]];

const cloudCity = {
  id: 'fantasy2-cloud-city', title: 'Город на облаках',
  shapes: [
    bg('#d8d2ff'),
    [starD(600, 112, 88, 62, 12), '#ffb04d'],
    [O(600, 112, 50), '#ffe066'],
    [cloudD(1060, 110, 62), '#ffffff'],
    [cloudD(112, 812, 50), '#ffffff'],
    [bird(292, 100, 16), null], [bird(336, 74, 13), null], [bird(1124, 236, 14), null],
    [spark(38, 226, 24), '#ffe066'], [spark(1150, 320, 24), '#ffe066'], [spark(604, 300, 24), '#ffe066'],
    [spark(448, 70, 22), '#ffe066'], [spark(200, 872, 22), '#ffe066'], [spark(770, 60, 22), '#ffe066'],
    [heartD(560, 380, 17), '#ff9ec4'], [heartD(676, 350, 14), '#ff9ec4'],
    ...kite(250, 300, 1.15, 0.35, '#ff6b7f', '#ffe066'),
    ...kite(934, 258, 1, -0.3, '#4fc9c4', '#ff9ec4'),
    // a tiny island of its own
    [R(98, 72, 72, 66), '#ffc9dd'],
    ['M86 78L134 30L182 78Z', '#9b7fe8'],
    [arch(134, 92, 28, 46), '#c98a55'],
    ['M174 136L202 82L230 136Z', '#7fd67a'],
    ['M183 102L202 60L221 102Z', '#7fd67a'],
    [puff([[66, 172], [82, 140], [126, 128], [172, 138], [212, 130], [238, 160], [222, 190], [170, 200], [110, 198]]), '#ffffff'],
    ['M120 172q22 -20 46 -5', null],
    // airship
    ...place(airship, 912, 802, 0.92),
    // balloons
    ...balloonBands(400, 250, 1, ['#ff6b7f', '#ffe066', '#4fc9c4', '#ffe066', '#ff6b7f'], [0, 0.55, 0.95, 1.35, 1.72, 2]),
    ...balloonGores(800, 216, 0.95, '#5aa9ff', '#ff9ec4'),
    ...balloonGores(1082, 792, 0.58, '#7fd67a', '#ffe066'),
    ...balloonBands(292, 802, 0.55, ['#9b7fe8', '#ffb04d', '#9b7fe8'], [0, 0.7, 1.4, 2]),
    // left island
    [R(52, 380, 70, 250), '#ffc9dd'],
    ['M52 472H122', null],
    ...cone(87, 386, 50, 290, '#9b7fe8'),
    ...pennant(87, 246, 46, '#ff6b7f'),
    [arch(87, 408, 30, 50), '#ffe066'], [arch(87, 494, 30, 50), '#ffe066'],
    [R(122, 450, 110, 180), '#fff0c9'],
    [R(200, 390, 24, 46), '#c98a55'],
    ['M114 456L180 384L246 456Z', '#ff6b7f'],
    [O(180, 428, 14), '#ffe066'],
    sq(140, 482, 32, 42, '#5aa9ff'), sq(184, 482, 32, 42, '#5aa9ff'),
    [R(232, 470, 90, 160), '#a8ecd0'],
    dome(280, 476, 52, '#4fc9c4'),
    ['M280 424C266 440 262 460 262 476M280 424C294 440 298 460 298 476', null],
    ['M280 424V398', null], [O(280, 388, 11), '#ffe066'],
    [arch(280, 506, 36, 62), '#ffe066'],
    [under(ISLE_A, 182, 34), '#a9d8ff'],
    [puff(ISLE_A), '#ffffff'],
    ['M80 640q26 -24 54 -6M200 650q26 -24 54 -6', null],
    // right island
    [R(888, 400, 96, 200), '#a9d8ff'],
    [R(950, 334, 22, 60), '#c98a55'],
    ['M874 406L932 338L990 406Z', '#ffb04d'],
    sq(902, 430, 26, 38), sq(938, 430, 26, 38), sq(902, 492, 26, 38), sq(938, 492, 26, 38),
    [R(984, 300, 76, 300), '#fff0c9'],
    ['M984 482H1060', null],
    ...cone(1022, 306, 54, 212, '#ff6b7f'),
    ...pennant(1022, 168, 46, '#4fc9c4'),
    [O(1022, 352, 27), '#ffffff'], ['M1022 352V334M1022 352L1036 358', null],
    [arch(1022, 412, 30, 52), '#5aa9ff'],
    [R(1060, 424, 98, 176), '#ffc9dd'],
    ['M1066 428C1046 386 1092 368 1110 326C1128 368 1174 386 1154 428Z', '#9b7fe8'],
    ['M1110 326C1094 370 1092 400 1094 428M1110 326C1126 370 1128 400 1126 428', null],
    [arch(1110, 462, 36, 62), '#ffe066'],
    [under(ISLE_C, 1022, 34), '#a9d8ff'],
    [puff(ISLE_C), '#ffffff'],
    ['M920 610q26 -24 54 -6M1050 616q26 -24 54 -6', null],
    // middle island
    [R(478, 590, 62, 180), '#a9d8ff'],
    ['M478 678H540M670 678H732', null],
    ...cone(509, 596, 45, 508, '#ff9ec4'),
    ...pennant(509, 466, 40, '#ffe066', -1),
    [arch(509, 628, 26, 46), '#ffe066'],
    [R(670, 590, 62, 180), '#a9d8ff'],
    ...cone(701, 596, 45, 508, '#ff9ec4'),
    ...pennant(701, 466, 40, '#ffe066'),
    [arch(701, 628, 26, 46), '#ffe066'],
    [R(540, 540, 130, 230), '#fff0c9'],
    dome(605, 546, 76, '#9b7fe8'),
    [arch(605, 650, 58, 120), '#c98a55'],
    ['M605 470C586 492 580 524 580 546M605 470C624 492 630 524 630 546M540 578H670M605 650V770', null],
    ['M605 470V444', null], [starD(605, 424, 22), '#ffe066'],
    [arch(566, 592, 28, 46), '#5aa9ff'], [arch(644, 592, 28, 46), '#5aa9ff'],
    [under(ISLE_B, 605, 30), '#a9d8ff'],
    [puff(ISLE_B), '#ffffff'],
    ['M470 790q26 -24 54 -6M640 800q26 -24 54 -6', null],
    // rainbow bridges
    ...rainbowBridge(BRIDGE_L, BRIDGE_COLS, 18),
    ...rainbowBridge(BRIDGE_R, BRIDGE_COLS, 18),
    [puff([[282, 672], [296, 640], [334, 634], [358, 660], [346, 694], [304, 700]]), '#ffffff'],
    [puff([[420, 790], [432, 754], [470, 746], [496, 772], [486, 806], [440, 812]]), '#ffffff'],
    [puff([[716, 772], [742, 746], [780, 754], [792, 790], [772, 812], [726, 806]]), '#ffffff'],
    [puff([[856, 636], [870, 604], [908, 598], [932, 624], [920, 658], [876, 664]]), '#ffffff'],
  ],
};

export default [dragonFlight, fireflyForest, mermaidLagoon, cloudCity];
