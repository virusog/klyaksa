// Detailed coloring pages about the world around us: big busy scenes, 1200 x 900.
// Every filled shape is a closed path, and neighbours share their edges exactly.
import { O, E, R, starD, heartD, cloudD, flower, bg } from '../art.js';

const f1 = v => +v.toFixed(1);
const TAU = Math.PI * 2;
const P = pts => `M${pts.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L')}Z`;

// A fluffy round outline: tree crowns, bushes, smoke, cotton candy.
function fluff(cx, cy, rx, ry, n, rot = 0, k = 0.62) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    pts.push([f1(cx + Math.cos(a) * rx), f1(cy + Math.sin(a) * ry)]);
  }
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % n];
    const r = f1(Math.hypot(q[0] - p[0], q[1] - p[1]) * k);
    d += `A${r} ${r} 0 0 1 ${q[0]} ${q[1]}`;
  });
  return `${d}Z`;
}

// A window or door with a round top: `top` is the top of the arch.
const arch = (cx, top, w, h) =>
  `M${cx - w / 2} ${top + h}V${top + w / 2}A${w / 2} ${w / 2} 0 0 1 ${cx + w / 2} ${top + w / 2}V${top + h}Z`;

// A striped shop awning with a scalloped lower edge; stripes share their sides.
function awning(x, y, w, h, n, a, b, inset = 12) {
  const out = [];
  const tw = (w - inset * 2) / n, bw = w / n;
  for (let i = 0; i < n; i++) {
    const t0 = f1(x + inset + tw * i), t1 = f1(x + inset + tw * (i + 1));
    const b0 = f1(x + bw * i), b1 = f1(x + bw * (i + 1));
    out.push([`M${t0} ${y}L${t1} ${y}L${b1} ${y + h}Q${f1((b0 + b1) / 2)} ${y + h + 16} ${b0} ${y + h}Z`, i % 2 ? b : a]);
  }
  return out;
}

// A wavy line that looks like writing on a sign.
const scribble = (x, y, w) => `M${x} ${y}q${f1(w / 8)} -9 ${f1(w / 4)} 0t${f1(w / 4)} 0t${f1(w / 4)} 0t${f1(w / 4)} 0`;

// A sector of a ring between two radii, angles in radians, clockwise.
function ringPart(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => `${f1(cx + Math.cos(a) * r)} ${f1(cy + Math.sin(a) * r)}`;
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)}A${r1} ${r1} 0 ${big} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 ${big} 0 ${p(r0, a0)}Z`;
}

// A string of little flags hanging on a sagging line from (x0, y0) to (x1, y1).
function bunting(x0, y0, cx, cy, x1, y1, n, len, cols) {
  const pt = t => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  const out = [[`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`, null]];
  for (let i = 0; i < n; i++) {
    const a = pt(i / n), b = pt((i + 1) / n);
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    out.push([P([a, b, [(a[0] + b[0]) / 2 - (dy / l) * len, (a[1] + b[1]) / 2 + (dx / l) * len]]), cols[i % cols.length]]);
  }
  return out;
}

// Moves, scales and mirrors a path written only with absolute M L C Q Z.
const tf = (d, x = 0, y = 0, s = 1, flip = 1) =>
  d.replace(/(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/g, (m, a, b) => `${f1(x + +a * s * flip)} ${f1(y + +b * s)}`);
const place = (list, x, y, s = 1, flip = 1) => list.map(([d, f]) => [tf(d, x, y, s, flip), f]);

// Cuts a cubic curve (four points) at t into two cubic curves that meet exactly.
const cut = (p, t) => {
  const mix = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const a = mix(p[0], p[1]), b = mix(p[1], p[2]), c = mix(p[2], p[3]);
  const d = mix(a, b), e = mix(b, c), m = mix(d, e);
  return [[p[0], a, d, m], [m, e, c, p[3]]];
};

// ---------- shared colours ----------
const WHITE = '#ffffff', SUN = '#ffd447', RED = '#ff6b6b', PINK = '#ffb4d0', ORANGE = '#ffa64d';
const BROWN = '#c98a55', GREEN = '#5fc46a', BLUE = '#5aa9ff', LILAC = '#d3c2ff', MINT = '#b5ecc4';
const PEACH = '#ffcf9e', GLASS = '#a9defc', STEEL = '#6f7791', INK = '#3a2b6b';

// ---------- 1. A street with shops and a tram ----------
const ROAD = '#b8bfd2', PAVE = '#efe6cf';

const flowerBox = (cx, y, col) => [
  [R(cx - 36, y, 72, 22, 6), BROWN],
  [O(cx - 20, y - 5, 7), col], [O(cx, y - 8, 7), col], [O(cx + 20, y - 5, 7), col],
];
const door = (x, y, w, h, col) => [
  [R(x, y, w, h), col],
  [R(x + 10, y + 9, w - 20, 34, 4), GLASS],
  [O(x + w - 11, y + h * 0.62, 3), INK],
];
const dove = (x, y, s = 1) => [
  [`M${x - 2} ${y + 14}V${y + 28}M${x + 8} ${y + 14}V${y + 28}`, null],
  [`M${x + 26 * s} ${y}C${x + 26 * s} ${y - 22} ${x - 10 * s} ${y - 20} ${x - 46 * s} ${y - 12}L${x - 38 * s} ${y + 3}C${x - 20 * s} ${y + 20} ${x + 26 * s} ${y + 20} ${x + 26 * s} ${y}Z`, WHITE],
  [P([[x + 30 * s, y - 24], [x + 44 * s, y - 20], [x + 30 * s, y - 15]]), ORANGE],
  [O(x + 22 * s, y - 18, 13), WHITE],
  [O(x + 27 * s, y - 21, 2.2), INK],
  [`M${x - 14 * s} ${y - 6}Q${x} ${y + 10} ${x + 12 * s} ${y - 2}`, null],
];
// A little animal looking out of a tram window whose lower edge is y.
const catHead = (x, y, col) => [
  [`M${x - 22} ${y}Q${x - 27} ${y - 16} ${x - 22} ${y - 28}L${x - 20} ${y - 48}L${x - 7} ${y - 37}Q${x} ${y - 39} ${x + 7} ${y - 37}L${x + 20} ${y - 48}L${x + 22} ${y - 28}Q${x + 27} ${y - 16} ${x + 22} ${y}Z`, col],
  [O(x - 8, y - 20, 2.6), INK], [O(x + 8, y - 20, 2.6), INK],
  [`M${x - 5} ${y - 10}Q${x} ${y - 5} ${x + 5} ${y - 10}`, null],
];
const bunnyHead = (x, y, col) => [
  [`M${x - 20} ${y}Q${x - 25} ${y - 14} ${x - 18} ${y - 27}L${x - 19} ${y - 48}Q${x - 12} ${y - 62} ${x - 5} ${y - 48}L${x - 4} ${y - 31}L${x + 4} ${y - 31}L${x + 5} ${y - 48}Q${x + 12} ${y - 62} ${x + 19} ${y - 48}L${x + 18} ${y - 27}Q${x + 25} ${y - 14} ${x + 20} ${y}Z`, col],
  [O(x - 8, y - 17, 2.6), INK], [O(x + 8, y - 17, 2.6), INK],
  [`M${x - 4} ${y - 8}Q${x} ${y - 4} ${x + 4} ${y - 8}`, null],
];

const street = [
  bg(GLASS),
  [O(80, 82, 46), SUN],
  ['M80 16V2M28 30L16 18M132 30L144 18M14 82H2M146 82H160M32 132L20 144M128 132L140 144M80 148V162', null],
  [cloudD(250, 62, 44), WHITE],
  [cloudD(580, 84, 46), WHITE],
  [cloudD(1010, 62, 44), WHITE],

  // House 1: the flower shop.
  [R(120, 215, 195, 330), PEACH],
  [P([[106, 215], [217.5, 104], [329, 215]]), RED],
  [O(217, 170, 20), GLASS],
  [arch(172, 245, 52, 78), GLASS],
  [arch(263, 245, 52, 78), GLASS],
  ...flowerBox(172, 323, PINK),
  ...flowerBox(263, 323, SUN),
  [R(160, 360, 115, 30, 8), WHITE],
  [scribble(176, 377, 84), null],
  ...awning(134, 400, 167, 40, 5, PINK, WHITE),
  [R(138, 464, 96, 68), GLASS],
  [O(168, 496, 13), SUN], [O(204, 496, 13), PINK], [O(186, 484, 13), RED],
  [P([[166, 532], [160, 504], [212, 504], [206, 532]]), ORANGE],
  ...door(250, 462, 52, 83, BROWN),

  // House 2: the ice-cream cafe.
  [R(315, 150, 205, 395), PINK],
  [`M370 138A47 47 0 0 1 464 138Z`, RED],
  [R(305, 138, 225, 24), WHITE],
  [R(344, 182, 60, 66), GLASS], [R(431, 182, 60, 66), GLASS],
  [R(344, 272, 60, 66), GLASS], [R(431, 272, 60, 66), GLASS],
  ...catHead(461, 338, ORANGE),
  [R(360, 356, 115, 30, 8), WHITE],
  [scribble(376, 373, 84), null],
  ...awning(329, 400, 177, 40, 5, BLUE, WHITE),
  ...door(333, 462, 52, 83, BLUE),
  [R(400, 464, 104, 68), GLASS],
  [P([[418, 492], [448, 492], [433, 528]]), ORANGE], [O(433, 482, 15), PINK],
  [P([[460, 496], [490, 496], [475, 528]]), ORANGE], [O(475, 486, 15), MINT],

  // House 3: the bakery.
  [R(645, 128, 30, 60), RED],
  [O(662, 104, 13), WHITE], [O(676, 76, 17), WHITE],
  [R(520, 250, 180, 295), MINT],
  [P([[508, 250], [540, 170], [680, 170], [712, 250]]), ORANGE],
  [arch(600, 186, 46, 52), GLASS],
  [R(554, 278, 26, 78), GREEN], [R(640, 278, 26, 78), GREEN],
  [R(580, 278, 60, 78), GLASS],
  ['M610 278V356', null],
  ...flowerBox(610, 356, RED),
  ...awning(532, 400, 156, 40, 4, ORANGE, WHITE),
  [R(536, 464, 86, 68), GLASS],
  ['M548 532A31 26 0 0 1 610 532Z', BROWN],
  ['M566 516l6 -8M579 512v-9M592 516l-6 -8', null],
  ...door(634, 462, 52, 83, RED),

  // House 4: the toy shop with a clock.
  [R(700, 120, 215, 425), LILAC],
  [P([[688, 120], [807.5, 34], [927, 120]]), BLUE],
  [O(807, 168, 31), WHITE],
  ['M807 168V148M807 168L821 176', null],
  [arch(745, 214, 46, 70), GLASS], [arch(807, 214, 46, 70), GLASS], [arch(870, 214, 46, 70), GLASS],
  [R(728, 306, 64, 60), GLASS], [R(823, 306, 64, 60), GLASS],
  ...awning(714, 400, 187, 40, 5, RED, SUN),
  [R(718, 464, 112, 68), GLASS],
  [O(748, 508, 21), RED],
  ['M729 500Q748 512 767 500', null],
  [R(776, 490, 40, 40), SUN],
  ['M796 500V520M786 510H806', null],
  ...door(846, 462, 52, 83, GREEN),

  // House 5: the bookshop.
  [R(1100, 72, 34, 60), RED],
  [R(915, 205, 300, 340), PEACH],
  [P([[901, 205], [945, 112], [1215, 112], [1215, 205]]), BROWN],
  ['M960 150q16 14 32 0q16 14 32 0q16 14 32 0q16 14 32 0q16 14 32 0q16 14 32 0M944 180q16 14 32 0q16 14 32 0q16 14 32 0q16 14 32 0q16 14 32 0q16 14 32 0q16 14 32 0', null],
  [R(941, 240, 22, 80), BLUE], [R(1023, 240, 22, 80), BLUE], [R(963, 240, 60, 80), GLASS],
  [R(1071, 240, 22, 80), BLUE], [R(1153, 240, 22, 80), BLUE], [R(1093, 240, 60, 80), GLASS],
  [R(998, 350, 120, 30, 8), WHITE],
  [scribble(1014, 367, 88), null],
  ...awning(929, 400, 257, 40, 6, GREEN, WHITE),
  [R(962, 464, 112, 68), GLASS],
  [R(976, 482, 24, 50), RED], [R(1000, 474, 24, 58), BLUE], [R(1024, 486, 24, 46), SUN],
  ...door(1090, 462, 56, 83, BROWN),

  // The pavement, the tree and the small things on it.
  [R(-10, 545, 1220, 75), PAVE],
  [R(-10, 620, 1220, 290), ROAD],
  [P([[30, 548], [36, 410], [62, 410], [68, 548]]), BROWN],
  [fluff(50, 345, 72, 76, 9, 0.3), GREEN],
  [R(116, 548, 86, 26, 6), BROWN],
  [R(108, 577, 102, 22, 6), BROWN],
  ['M124 599V610M194 599V610', null],
  [R(898, 540, 44, 56, 8), BLUE],
  ['M908 558H932M920 596V616', null],
  [P([[1130, 606], [1123, 572], [1177, 572], [1170, 606]]), ORANGE],
  [fluff(1150, 548, 30, 26, 7, 0.2), GREEN],
  [O(1138, 544, 7), PINK], [O(1156, 534, 7), PINK], [O(1164, 554, 7), PINK],

  // The road: a rail, a puddle with a paper boat, two doves.
  ['M0 826H1200M0 854H1200', null],
  ['M40 879H130M250 879H340M700 879H790M910 879H1000M1120 879H1200', null],
  [E(520, 878, 46, 14), STEEL],
  ['M498 874H542M498 882H542', null],
  [E(104, 726, 86, 24), GLASS],
  [P([[68, 702], [140, 702], [122, 726], [86, 726]]), WHITE],
  [P([[104, 702], [104, 660], [132, 702]]), WHITE],
  ...dove(985, 700, 1),
  ...dove(1105, 762, -1),

  // The tram.
  [R(296, 780, 80, 46), ROAD], [R(716, 780, 80, 46), ROAD],
  [O(296, 798, 28), STEEL], [O(376, 798, 28), STEEL], [O(716, 798, 28), STEEL], [O(796, 798, 28), STEEL],
  [O(296, 798, 8), WHITE], [O(376, 798, 8), WHITE], [O(716, 798, 8), WHITE], [O(796, 798, 8), WHITE],
  ['M540 600L506 579L540 558L574 579ZM514 558H566', null],
  ['M231 628Q231 600 262 600H828Q862 600 868 628Z', ROAD],
  ['M215 720V654Q215 628 241 628H835Q875 628 875 668V720Z', WHITE],
  [R(215, 720, 660, 22), SUN],
  ['M215 742H875V766Q875 786 855 786H235Q215 786 215 766Z', RED],
  [R(240, 644, 86, 62, 6), GLASS],
  [R(414, 644, 80, 62, 6), GLASS], [R(508, 644, 80, 62, 6), GLASS],
  [R(602, 644, 80, 62, 6), GLASS], [R(696, 644, 80, 62, 6), GLASS],
  ['M790 644H838Q858 644 858 664V706H790Z', GLASS],
  ...catHead(454, 706, ORANGE),
  ...bunnyHead(642, 706, PINK),
  [O(810, 672, 7), BROWN], [O(838, 672, 7), BROWN], [O(824, 688, 18), BROWN],
  [O(818, 686, 2.4), INK], [O(830, 686, 2.4), INK],
  [R(340, 644, 60, 138, 6), BLUE],
  [R(352, 654, 36, 48, 4), GLASS],
  ['M390 720V738', null],
  [O(850, 762, 12), SUN],
  [heartD(600, 763, 15), WHITE],
];

// ---------- 2. The funfair with a big wheel ----------
const GRASS2 = '#86d95f';
const WX = 430, WY = 340, R_IN = 236, R_OUT = 262, R_MID = 249, R_HUB = 86;
const CABIN_COLS = [RED, BLUE, ORANGE, GREEN, LILAC, RED, BLUE, GREEN];

// A gondola of the wheel, hung so that its middle sits on the rim.
const gondola = (x, y, col) => [
  [`M${x - 32} ${y - 12}V${y - 18}A16 16 0 0 1 ${x - 16} ${y - 34}H${x + 16}A16 16 0 0 1 ${x + 32} ${y - 18}V${y - 12}Z`, WHITE],
  [`M${x - 32} ${y - 12}H${x + 32}V${y + 18}A16 16 0 0 1 ${x + 16} ${y + 34}H${x - 16}A16 16 0 0 1 ${x - 32} ${y + 18}Z`, col],
  [R(x - 21, y - 5, 42, 21, 5), GLASS],
];
const wheel = () => {
  const out = [];
  out.push([P([[416, 340], [444, 340], [324, 724], [290, 724]]), STEEL]);
  out.push([P([[416, 340], [444, 340], [570, 724], [536, 724]]), STEEL]);
  let spokes = '';
  for (let k = 0; k < 8; k++) {
    const a = (k * TAU) / 8, b = ((k + 1) * TAU) / 8;
    out.push([ringPart(WX, WY, R_IN, R_OUT, a, b), k % 2 ? SUN : PINK]);
    out.push([ringPart(WX, WY, 30, R_HUB, a, b), k % 2 ? WHITE : BLUE]);
    spokes += `M${f1(WX + Math.cos(a) * R_HUB)} ${f1(WY + Math.sin(a) * R_HUB)}L${f1(WX + Math.cos(a) * R_IN)} ${f1(WY + Math.sin(a) * R_IN)}`;
  }
  out.push([spokes, null]);
  out.push([O(WX, WY, 30), SUN], [O(WX, WY, 8), STEEL]);
  for (let k = 0; k < 8; k++) {
    const a = (k * TAU) / 8;
    out.push(...gondola(f1(WX + Math.cos(a) * R_MID), f1(WY + Math.sin(a) * R_MID), CABIN_COLS[k]));
  }
  return out;
};

// A merry-go-round horse prancing to the right, drawn around the middle of its body.
const horse = (x, y, s, body, mane, saddle) => [
  ...place([
    ['M-42 -14C-66 -28 -82 -4 -76 22C-74 34 -72 42 -66 50C-66 34 -62 18 -46 6Z', mane],
    ['M-44 -4C-44 -24 -20 -30 4 -26C12 -36 16 -50 20 -62C22 -70 26 -76 32 -78L35 -95L47 -78C60 -76 72 -64 80 -50C84 -42 80 -32 70 -32C62 -32 56 -36 50 -40C48 -28 50 -14 44 -2C54 -4 66 0 74 8L66 36L51 34L56 18C48 14 42 15 34 18C14 26 -8 26 -20 20C-22 30 -24 40 -26 50L-44 50C-44 38 -46 26 -50 14C-46 8 -44 2 -44 -4Z', body],
    ['M-34 -22C-24 -31 -12 -32 -3 -28L-1 -6Q-16 5 -32 -5Z', saddle],
    ['M30 -68C18 -82 2 -72 8 -60C-4 -58 -8 -44 0 -38C-7 -33 -3 -25 7 -26C13 -27 16 -31 18 -36Z', mane],
  ], x, y, s),
  [O(f1(x + 54 * s), f1(y - 58 * s), 3), INK],
];

const kiteBow = (x, y) => [
  [P([[x, y], [x - 13, y - 8], [x - 13, y + 8]]), PINK],
  [P([[x, y], [x + 13, y - 8], [x + 13, y + 8]]), PINK],
];
const balloon = (x, y, col) => [
  [E(x, y, 30, 36), col],
  [P([[x, y + 36], [x - 7, y + 46], [x + 7, y + 46]]), col],
];

const funfair = [
  bg(GLASS),
  [O(1105, 92, 50), SUN],
  ['M1105 26V8M1105 158V176M1039 92H1021M1171 92H1189M1058 45L1046 33M1152 45L1164 33M1058 139L1046 151M1152 139L1164 151', null],
  [cloudD(90, 110, 56), WHITE],
  [cloudD(690, 74, 44), WHITE],
  ['M210 60q14 -16 28 0q14 -16 28 0M300 118q12 -14 24 0q12 -14 24 0M1010 250q12 -14 24 0q12 -14 24 0', null],

  // The kite.
  ['M880 236q22 26 2 50t-2 50', null],
  [P([[880, 96], [835, 152], [880, 152]]), RED],
  [P([[880, 96], [925, 152], [880, 152]]), SUN],
  [P([[835, 152], [880, 236], [880, 152]]), SUN],
  [P([[925, 152], [880, 236], [880, 152]]), RED],
  ...kiteBow(890, 262), ...kiteBow(880, 312),

  // The grass and the path.
  ['M-10 742Q300 722 600 738T1210 736V910H-10Z', GRASS2],
  ['M470 910C480 830 440 786 372 744H500C560 786 640 840 660 910Z', PAVE],

  // The big wheel.
  ...wheel(),
  [R(270, 716, 320, 30, 8), ORANGE],

  // The merry-go-round.
  [R(972, 500, 36, 224), LILAC],
  ['M855 506V722M1085 506V722', null],
  ...[0, 1, 2, 3, 4, 5].map(i => [P([[990, 380], [794 + (392 / 6) * i, 480], [794 + (392 / 6) * (i + 1), 480]]), i % 2 ? WHITE : RED]),
  ...awning(794, 480, 392, 26, 6, SUN, BLUE, 0),
  ['M990 362V322', null],
  [P([[990, 318], [1036, 332], [990, 346]]), PINK],
  [O(990, 374, 13), SUN],
  ...horse(872, 655, 0.96, WHITE, ORANGE, RED),
  ...horse(1102, 628, 0.96, PEACH, BROWN, BLUE),
  [R(800, 720, 380, 30, 10), PINK],
  [R(822, 750, 336, 24, 8), BLUE],

  // The sweets stall with balloons.
  ['M98 570L38 536M98 570V470M98 570L156 534', null],
  ...balloon(38, 490, RED), ...balloon(156, 488, GREEN), ...balloon(98, 424, BLUE),
  [R(50, 604, 190, 84), LILAC],
  ['M96 666V688M150 666V688M204 666V688', null],
  [fluff(96, 648, 21, 19, 7, 0.2), PINK], [fluff(150, 648, 21, 19, 7, 0.5), MINT], [fluff(204, 648, 21, 19, 7, 0.1), SUN],
  ...awning(28, 566, 234, 44, 6, RED, WHITE),
  [R(40, 686, 210, 100, 8), ORANGE],
  [heartD(145, 736, 24), WHITE],

  // The ticket booth with a cat inside.
  [R(664, 630, 116, 114), MINT],
  [P([[648, 630], [722, 564], [796, 630]]), RED],
  [O(722, 556, 11), SUN],
  [arch(722, 650, 64, 66), GLASS],
  ...catHead(722, 716, ORANGE),
  [R(680, 716, 84, 20, 6), BROWN],

  // A teddy bear prize and a tub of popcorn.
  [O(288, 776, 13), BROWN], [O(336, 776, 13), BROWN],
  [E(268, 842, 17, 21), BROWN], [E(356, 842, 17, 21), BROWN],
  [E(312, 848, 36, 32), BROWN],
  [E(312, 846, 19, 16), PEACH],
  [O(282, 878, 15), BROWN], [O(342, 878, 15), BROWN],
  [O(312, 800, 31), BROWN],
  [E(312, 811, 15, 12), PEACH],
  [O(312, 804, 3.5), INK], [O(300, 794, 3), INK], [O(324, 794, 3), INK],
  [fluff(920, 800, 44, 20, 8, 0.2), WHITE],
  [P([[872, 806], [904, 806], [908.7, 884], [886, 884]]), RED],
  [P([[904, 806], [936, 806], [931.3, 884], [908.7, 884]]), SUN],
  [P([[936, 806], [968, 806], [954, 884], [931.3, 884]]), RED],

  // Flowers and bushes in front.
  [fluff(1085, 852, 78, 40, 9, 0.2), GREEN],
  [O(1040, 842, 8), RED], [O(1085, 826, 8), RED], [O(1130, 846, 8), RED], [O(1090, 868, 8), RED],
  ...flower(760, 842, 34, PINK),
  ...flower(120, 846, 34, SUN, ORANGE),
];

// ---------- 3. The kitchen where pies are baked ----------
const WALL = '#ffe9c2', GREY = '#b8bfd2';
const jar = (x, fill, lid) => [
  [R(x - 32, 130, 64, 76, 12), fill],
  [R(x - 27, 110, 54, 22, 6), lid],
  [R(x - 21, 152, 42, 32, 5), WHITE],
];
const kitchen = [
  bg(WALL),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [R(i * 150, 770, 150, 66), i % 2 ? GLASS : PEACH]),
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [R(i * 150, 836, 150, 74), i % 2 ? PEACH : GLASS]),

  // The window with a view, a short curtain and a plant.
  [R(60, 96, 280, 270, 8), BROWN],
  [R(78, 114, 113, 234), GLASS], [R(209, 114, 113, 234), GLASS],
  ['M78 348V300Q134 268 191 296V348Z', GREEN],
  ['M209 348V292Q266 302 322 274V348Z', GREEN],
  [O(276, 196, 26), SUN],
  [cloudD(132, 222, 30), WHITE],
  ...awning(48, 84, 304, 44, 6, PINK, WHITE, 0),
  ['M34 84H366', null],
  [O(34, 84, 7), BROWN], [O(366, 84, 7), BROWN],
  [R(44, 366, 312, 22, 8), BROWN],
  [fluff(200, 302, 42, 32, 8, 0.2), GREEN],
  [O(180, 296, 7), PINK], [O(206, 284, 7), PINK], [O(222, 308, 7), PINK],
  [P([[172, 366], [165, 330], [235, 330], [228, 366]]), ORANGE],

  // The clock and the things that hang on the wall.
  [O(440, 170, 56), RED], [O(440, 170, 36), WHITE],
  ['M440 170V147M440 170L458 181', null],
  ['M716 106H842M744 106V176M808 106V150', null],
  ['M722 176A22 22 0 0 0 766 176Z', STEEL],
  [R(790, 150, 36, 52, 6), STEEL],

  ...bunting(374, 30, 620, 84, 866, 30, 8, 46, [BLUE, SUN, GREEN, PINK]),

  // The shelf with jars.
  [R(866, 206, 312, 20, 6), BROWN],
  ...jar(920, RED, BLUE), ...jar(1010, SUN, PINK), ...jar(1100, LILAC, GREEN),

  // The oven and the kettle.
  [R(860, 386, 300, 384), MINT],
  [R(848, 364, 324, 24, 8), STEEL],
  [O(920, 411, 13), RED], [O(1010, 411, 13), RED], [O(1100, 411, 13), RED],
  [R(884, 434, 252, 132, 12), LILAC],
  ['M930 446H1090', null],
  [R(908, 458, 204, 86, 10), SUN],
  ['M940 544C946 494 1034 494 1040 544Z', BROWN],
  [R(1052, 438, 54, 38), WHITE], [R(1052, 476, 54, 36), PINK],
  ['M1066 512v10M1079 512v10M1092 512v10', null],
  ['M910 334C900 250 996 250 986 334', null],
  [P([[990, 340], [1028, 304], [1046, 318], [1002, 364]]), RED],
  ['M896 364C896 296 1000 296 1000 364Z', RED],
  [O(948, 306, 9), SUN],
  [fluff(1056, 284, 15, 13, 6, 0.3), WHITE], [fluff(1076, 256, 18, 15, 6, 0.1), WHITE],

  // The cat cook.
  [P([[530.9, 481.2], [450.9, 429.2], [429.1, 462.8], [509.1, 514.8]]), GREY],
  [P([[669.1, 481.2], [749.1, 429.2], [770.9, 462.8], [690.9, 514.8]]), GREY],
  ['M512 640C504 520 540 424 600 424C660 424 696 520 688 640Z', GREY],
  ['M546 640V470Q600 454 654 470V640Z', WHITE],
  ['M546 470L566 428M654 470L634 428', null],
  [P([[502, 312], [504, 208], [582, 262]]), GREY], [P([[698, 312], [696, 208], [618, 262]]), GREY],
  [P([[517, 290], [518, 236], [560, 265]]), PINK], [P([[683, 290], [682, 236], [640, 265]]), PINK],
  [E(600, 338, 96, 82), GREY],
  [fluff(600, 168, 82, 52, 8, 0.39), WHITE],
  [R(536, 216, 128, 42, 8), WHITE],
  ['M548 332q14 -18 28 0M624 332q14 -18 28 0', null],
  [O(538, 366, 14), PINK], [O(662, 366, 14), PINK],
  [E(600, 374, 36, 26), WHITE],
  [P([[591, 357], [609, 357], [600, 368]]), PINK],
  ['M600 368v8M600 376q-9 10 -18 2M600 376q9 10 18 2', null],
  ['M514 350L474 342M514 366L476 374M686 350L726 342M686 366L724 374', null],
  [P([[600, 430], [560, 410], [560, 450]]), RED], [P([[600, 430], [640, 410], [640, 450]]), RED],
  [O(600, 430, 9), RED],
  [R(751, 300, 18, 150), BROWN], [E(760, 280, 24, 32), BROWN],
  [O(440, 446, 26), GREY], [O(760, 446, 26), GREY],
  [E(440, 452, 12, 10), PINK],
  ['M429 424v9M440 421v9M451 424v9', null],

  // The table with a striped cloth.
  [R(150, 728, 30, 122), BROWN], [R(1020, 728, 30, 122), BROWN],
  [R(70, 610, 1060, 34, 10), BROWN],
  ...awning(110, 644, 980, 76, 10, RED, WHITE, 0),

  ...[257, 453, 649, 845, 1041].map(x => [heartD(x, 682, 14), RED]),

  // The pie.
  ['M446 600C452 470 748 470 754 600Z', PEACH],
  [heartD(600, 536, 14), RED],
  ['M540 550l-8 -14M660 550l8 -14', null],
  ...[0, 1, 2, 3, 4, 5, 6].map(i => [O(468 + i * 44, 584, 22), ORANGE]),
  [R(420, 596, 360, 22, 11), WHITE],

  // Flour, a bowl of dough, a rolling pin and eggs.
  ['M106 622C92 560 98 500 114 470L198 470C214 500 220 560 206 622Z', WHITE],
  ['M114 470C104 448 126 436 138 450C146 434 166 434 174 450C186 436 208 448 198 470Z', WHITE],
  [E(156, 548, 30, 36), SUN],
  ['M156 574V524M156 560l-12 -10M156 560l12 -10M156 546l-12 -10M156 546l12 -10M156 532l-9 -8M156 532l9 -8', null],
  [P([[292, 512], [309, 505], [276, 418], [259, 425]]), BROWN],
  ['M262 528C268 484 392 484 398 528Z', PEACH],
  ['M246 546H414C414 596 384 622 330 622C276 622 246 596 246 546Z', BLUE],
  [R(238, 528, 184, 22, 11), WHITE],
  [O(290, 580, 7), WHITE], [O(330, 592, 7), WHITE], [O(370, 580, 7), WHITE],
  [R(800, 593, 40, 20, 10), BROWN], [R(972, 593, 40, 20, 10), BROWN],
  [R(836, 586, 140, 34, 17), PEACH],
  [E(1058, 598, 18, 24), WHITE], [E(1098, 600, 18, 24), WHITE],

  // A basket of apples and a mouse with cheese under the table.
  ['M290 748q4 -12 14 -14M360 748q4 -12 14 -14M325 732q4 -12 14 -14', null],
  [O(290, 772, 24), RED], [O(360, 772, 24), RED], [O(325, 758, 24), RED],
  [P([[262, 852], [248, 790], [402, 790], [388, 852]]), BROWN],
  ['M290 802V840M325 802V840M360 802V840', null],
  ['M634 846C600 848 594 822 612 812', null],
  ['M632 850A44 34 0 0 1 720 850Z', GREY],
  [O(714, 808, 13), PINK],
  [O(726, 832, 20), GREY],
  [O(734, 828, 2.5), INK], [O(746, 836, 3.5), PINK],
  [P([[752, 850], [796, 850], [796, 820]]), SUN],
];

// ---------- 4. The spaceport: a rocket ready to fly ----------
const NIGHT = '#4f5bb5';
const spark = (x, y, r = 12) => [starD(x, y, r, r * 0.4, 4), WHITE];
// One side rocket; side is -1 for the left one and 1 for the right one.
const booster = side => {
  const X = v => 600 + side * v;
  return [
    [P([[X(130), 548], [X(174), 652], [X(130), 640]]), RED],
    [P([[X(80), 640], [X(120), 640], [X(128), 676], [X(72), 676]]), STEEL],
    [`M${X(70)} 430C${X(70)} 385 ${X(90)} 355 ${X(100)} 342C${X(110)} 355 ${X(130)} 385 ${X(130)} 430Z`, ORANGE],
    [P([[X(70), 430], [X(130), 430], [X(130), 500], [X(70), 500]]), WHITE],
    [P([[X(70), 500], [X(130), 500], [X(130), 524], [X(70), 524]]), ORANGE],
    [P([[X(70), 524], [X(130), 524], [X(130), 640], [X(70), 640]]), WHITE],
  ];
};
// The rocket's nose: one smooth curve cut into a red base, a yellow ring and a red tip.
const nose = () => {
  const [low, rest] = cut([[530, 250], [530, 190], [572, 110], [600, 62]], 0.38);
  const [mid, top] = cut(rest, 0.2);
  const l = p => `${f1(p[0])} ${f1(p[1])}`, r = p => `${f1(1200 - p[0])} ${f1(p[1])}`;
  const part = ([a, b, c, d]) => `M${l(a)}C${l(b)} ${l(c)} ${l(d)}L${r(d)}C${r(c)} ${r(b)} ${r(a)}Z`;
  return [[part(low), RED], [part(mid), SUN], [part(top), RED]];
};
const tower = () => {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const y = 130 + i * 78, z = y + 78;
    if (i % 2) out.push([P([[340, y], [410, y], [340, z]]), WHITE], [P([[410, y], [410, z], [340, z]]), RED]);
    else out.push([P([[340, y], [410, y], [410, z]]), RED], [P([[340, y], [410, z], [340, z]]), WHITE]);
  }
  return out;
};
// A planet cut into three bands.
const bandPlanet = (x, y, r, h, a, b) => {
  const dx = f1(Math.sqrt(r * r - h * h));
  return [
    [`M${x - dx} ${y - h}A${r} ${r} 0 0 1 ${x + dx} ${y - h}Z`, a],
    [`M${x - dx} ${y - h}A${r} ${r} 0 0 0 ${x - dx} ${y + h}L${x + dx} ${y + h}A${r} ${r} 0 0 0 ${x + dx} ${y - h}Z`, b],
    [`M${x - dx} ${y + h}A${r} ${r} 0 0 0 ${x + dx} ${y + h}Z`, a],
  ];
};

const spaceport = [
  bg(NIGHT),

  // Planets, the moon, a satellite and stars.
  [O(170, 150, 78), PINK],
  ['M120 112q24 -20 54 -14M196 104q20 4 30 20', null],
  ['M48 138C60 205 280 205 292 138C270 176 70 176 48 138Z', SUN],
  ['M1078 55A80 80 0 1 0 1125 158A70 70 0 0 1 1078 55Z', WHITE],
  [O(1004, 112, 14), GREY], [O(1022, 162, 10), GREY],
  [starD(1108, 100, 19), SUN],
  ...bandPlanet(1010, 322, 46, 15, GREEN, MINT),
  ['M734 112H740M784 112H790M762 96V78', null],
  [R(690, 99, 44, 26), BLUE], [R(790, 99, 44, 26), BLUE],
  ['M712 99V125M812 99V125', null],
  [R(740, 96, 44, 32, 6), GREY],
  [O(762, 72, 7), RED],
  ...[[60, 300], [270, 480], [58, 500], [318, 44], [740, 250], [880, 250], [1150, 330], [800, 470], [886, 44], [1160, 500]].map(([x, y]) => [starD(x, y, 24), SUN]),
  ['M288 322L232 290M282 336L224 318M296 312L250 276', null],
  [starD(306, 340, 24), SUN],
  [O(474, 192, 37), BLUE],
  ['M450 178C456 162 478 162 482 177C486 190 471 201 460 198C452 196 446 188 450 178Z', GREEN],
  ['M476 205C485 198 498 203 496 214C494 224 481 226 475 218C472 213 472 209 476 205Z', GREEN],
  ['M790 350A48 48 0 0 1 886 350Z', GLASS],
  [O(838, 328, 17), GREEN],
  [O(831, 322, 2.6), INK], [O(845, 322, 2.6), INK],
  [E(838, 362, 74, 21), LILAC],
  [O(798, 363, 6), SUN], [O(838, 368, 6), SUN], [O(878, 363, 6), SUN],
  spark(470, 60), spark(186, 392), spark(880, 150), spark(1160, 230), spark(60, 400), spark(690, 380), spark(1100, 440), spark(800, 180),

  // Far hills and the ground.
  ['M-10 650C80 590 180 600 250 660C280 640 310 650 340 700V760H-10Z', LILAC],
  ['M800 760V700C840 640 900 620 960 660C1020 610 1120 600 1210 640V760Z', LILAC],
  ['M-10 728C300 716 900 716 1210 728V910H-10Z', PEACH],

  // The control house with a big dish.
  ['M1028 504L1008 536M1005 470L972 424', null],
  ['M957.5 503.3L1052.5 436.7C1086.1 484.6 991.1 551.2 957.5 503.3Z', GREY],
  [O(970, 420, 9), RED],
  [R(880, 640, 250, 100), WHITE],
  ['M896 640A109 109 0 0 1 1005 531C968 560 958 600 958 640Z', MINT],
  ['M958 640C958 600 968 560 1005 531C1042 560 1052 600 1052 640Z', WHITE],
  ['M1052 640C1052 600 1042 560 1005 531A109 109 0 0 1 1114 640Z', MINT],
  [arch(1005, 672, 52, 68), BLUE],
  [R(902, 664, 56, 40, 6), SUN], [R(1052, 664, 56, 40, 6), SUN],

  // The launch tower.
  ['M375 96V70', null],
  [P([[340, 130], [375, 92], [410, 130]]), STEEL],
  [O(375, 64, 10), SUN],
  ...tower(),
  [R(410, 290, 120, 22), GREY], [R(410, 452, 60, 22), GREY],

  // The rocket.
  ...booster(-1), ...booster(1),
  [P([[572, 640], [628, 640], [640, 676], [560, 676]]), STEEL],
  ...nose(),
  [R(530, 250, 140, 130), WHITE],
  [O(600, 315, 40), GLASS],
  ['M580 321L582 299L594 307Q600 305 606 307L618 299L620 321C620 343 580 343 580 321Z', ORANGE],
  [O(592, 320, 2.4), INK], [O(608, 320, 2.4), INK],
  [R(530, 380, 140, 24), BLUE],
  [R(530, 404, 140, 156), WHITE],
  [starD(600, 458, 32), RED],
  [O(600, 524, 20), GLASS],
  [R(530, 560, 140, 24), BLUE],
  [R(530, 584, 140, 56), GREY],
  ['M565 594V630M600 594V630M635 594V630', null],

  // The launch pad in clouds of steam.
  [P([[330, 716], [430, 716], [430, 790], [290, 790]]), ORANGE],
  [P([[710, 716], [810, 716], [850, 790], [710, 790]]), ORANGE],
  [R(430, 716, 280, 74), GREY],
  [arch(570, 738, 60, 52), BLUE],
  [R(310, 676, 520, 40, 6), STEEL],
  [fluff(376, 706, 34, 22, 7, 0.4), WHITE], [fluff(824, 706, 34, 22, 7, 0.4), WHITE],
  [fluff(446, 694, 50, 30, 8, 0.2), WHITE], [fluff(754, 694, 50, 30, 8, 0.2), WHITE],
  [fluff(522, 702, 44, 28, 7, 0.1), WHITE], [fluff(678, 702, 44, 28, 7, 0.1), WHITE],
  [fluff(600, 706, 52, 30, 8, 0.3), WHITE],

  // Stones, hollows and a little flag.
  [E(470, 846, 62, 17), BROWN], [E(742, 838, 46, 15), BROWN],
  ['M30 884C38 838 102 838 110 884Z', GREY],
  ['M1090 886C1099 834 1171 834 1180 886Z', GREY],
  ['M640 880C646 846 694 846 700 880Z', GREY],
  ['M590 880V800', null],
  [P([[590, 800], [644, 817], [590, 834]]), GREEN],

  // The moon car.
  [O(884, 858, 26), STEEL], [O(936, 858, 26), STEEL], [O(988, 858, 26), STEEL],
  ['M996 788V760', null],
  [O(996, 752, 8), RED],
  ['M880 788A44 44 0 0 1 968 788Z', GLASS],
  [R(858, 788, 160, 56, 16), ORANGE],
  [O(1000, 814, 9), SUN],
  [O(884, 858, 9), WHITE], [O(936, 858, 9), WHITE], [O(988, 858, 9), WHITE],

  // The girl astronaut waves hello.
  [R(98, 668, 36, 84, 18), WHITE],
  [P([[214, 666.7], [272, 594.7], [300, 617.3], [242, 689.3]]), WHITE],
  [R(136, 756, 44, 84, 12), WHITE], [R(180, 756, 44, 84, 12), WHITE],
  [R(136, 796, 44, 26), BLUE], [R(180, 796, 44, 26), BLUE],
  [R(124, 822, 56, 34, 14), RED], [R(180, 822, 56, 34, 14), RED],
  [R(124, 652, 112, 116, 34), WHITE],
  [R(154, 694, 52, 38, 8), BLUE],
  [O(168, 713, 5), SUN], [O(182, 713, 5), RED], [O(196, 713, 5), WHITE],
  ['M180 534V510', null],
  [O(180, 502, 8), RED],
  [O(180, 596, 64), WHITE],
  [E(184, 600, 42, 38), PEACH],
  ['M142 600A42 38 0 0 1 226 600A42 38 0 0 1 220.5 619Q213 604 204 594Q184 580 164 594Q155 604 147.5 619A42 38 0 0 1 142 600Z', BROWN],
  [O(170, 608, 3.5), INK], [O(198, 608, 3.5), INK],
  ['M174 621q10 9 20 0M165 603l-5 -3M203 603l5 -3', null],
  [O(116, 752, 20), RED], [O(288, 600, 21), RED],
];

export default [
  { id: 'world2-street', title: 'Улица с трамваем', shapes: street },
  { id: 'world2-funfair', title: 'Парк аттракционов', shapes: funfair },
  { id: 'world2-kitchen', title: 'Печём пироги', shapes: kitchen },
  { id: 'world2-spaceport', title: 'Космодром', shapes: spaceport },
];
