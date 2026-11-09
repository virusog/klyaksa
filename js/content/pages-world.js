// Coloring pages about things and places.
import { O, E, R, starD, heartD, cloudD, wave, petal, flower, fish, bg, GRASS, DARK } from '../art.js';

const r1 = v => Math.round(v * 10) / 10;
const poly = pts => `M${pts.map(p => `${r1(p[0])} ${r1(p[1])}`).join('L')}Z`;

// A rounded bar from one point to another, half-width w.
const bar = (x1, y1, x2, y2, w) => {
  const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L * w, ny = (x2 - x1) / L * w;
  return `M${r1(x1 + nx)} ${r1(y1 + ny)}L${r1(x2 + nx)} ${r1(y2 + ny)}A${w} ${w} 0 0 0 ${r1(x2 - nx)} ${r1(y2 - ny)}L${r1(x1 - nx)} ${r1(y1 - ny)}A${w} ${w} 0 0 0 ${r1(x1 + nx)} ${r1(y1 + ny)}Z`;
};

// A string of little flags hanging along a curve.
const pennants = (x0, y0, cx, cy, x1, y1, n, h, cols, start = 0) => {
  const Q = t => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1];
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = Q(start + (1 - start) * (i + 0.1) / n), B = Q(start + (1 - start) * (i + 0.9) / n);
    out.push([poly([A, B, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + h]]), cols[i % cols.length]]);
  }
  out.push([`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`, null]);
  return out;
};

const wheel = (x, y, r, rim, disc, hub) => {
  const out = [[O(x, y, r), rim], [O(x, y, r * 0.71), disc], [`M${x} ${y - r * 0.71}V${y + r * 0.71}`, null]];
  if (hub) out.push([O(x, y, r * 0.27), hub]);
  return out;
};

const smallWheel = (x, y, r, rim, hub) => [[O(x, y, r), rim], [O(x, y, r * 0.42), hub]];

const roundTree = (x, y, r, leaf, trunk) => [
  [`M${x - 16} ${y + r * 0.7}L${x - 11} ${y + r * 1.9}H${x + 11}L${x + 16} ${y + r * 0.7}Z`, trunk],
  [`M${x - r} ${y + r * 0.1}C${x - r * 1.2} ${y - r * 0.6} ${x - r * 0.5} ${y - r * 1.2} ${x} ${y - r}C${x + r * 0.5} ${y - r * 1.2} ${x + r * 1.2} ${y - r * 0.6} ${x + r} ${y + r * 0.1}C${x + r * 1.15} ${y + r * 0.8} ${x + r * 0.4} ${y + r * 1.05} ${x} ${y + r * 0.9}C${x - r * 0.4} ${y + r * 1.05} ${x - r * 1.15} ${y + r * 0.8} ${x - r} ${y + r * 0.1}Z`, leaf],
];

const fir = (x, y, s, leaf, trunk) => [
  [R(x - 11 * s, y, 22 * s, 42 * s, 3), trunk],
  [`M${x - 62 * s} ${y + 6 * s}L${x} ${y - 78 * s}L${x + 62 * s} ${y + 6 * s}Q${x} ${y + 26 * s} ${x - 62 * s} ${y + 6 * s}Z`, leaf],
  [`M${x - 48 * s} ${y - 48 * s}L${x} ${y - 124 * s}L${x + 48 * s} ${y - 48 * s}Q${x} ${y - 30 * s} ${x - 48 * s} ${y - 48 * s}Z`, leaf],
];

const tulip = (x, y, s, col) => [
  [`M${x} ${y}V${y - 52 * s}`, null],
  [`M${x - 22 * s} ${y - 92 * s}L${x - 11 * s} ${y - 76 * s}L${x} ${y - 94 * s}L${x + 11 * s} ${y - 76 * s}L${x + 22 * s} ${y - 92 * s}C${x + 28 * s} ${y - 62 * s} ${x + 14 * s} ${y - 48 * s} ${x} ${y - 48 * s}C${x - 14 * s} ${y - 48 * s} ${x - 28 * s} ${y - 62 * s} ${x - 22 * s} ${y - 92 * s}Z`, col],
];

const gull = (x, y, s) => [`M${x - 36 * s} ${y}q${18 * s} ${-24 * s} ${36 * s} 0q${18 * s} ${-24 * s} ${36 * s} 0`, null];

/* ---------- Паровозик ---------- */

const trainPage = (() => {
  const sky = '#bfe8ff', yellow = '#ffe14d', orange = '#ffb340', white = '#ffffff', hill = '#b9e59a', leaf = '#4fae72',
    brown = '#b57a42', cream = '#fff3c9', grey = '#9aa0bd', pink = '#ff8fb0', mint = '#7fd8c0', blue = '#5a6bd8',
    red = '#e8504a', purple = '#b58cff', azure = '#5aa9ff';
  return {
    id: 'world-train', title: 'Паровозик с вагонами',
    shapes: [
      bg(sky),
      [starD(120, 125, 116, 88, 14), orange],
      [O(120, 125, 76), yellow],
      [cloudD(405, 135, 92), white],
      gull(300, 260, 1),
      gull(650, 262, 0.8),
      gull(610, 165, 0.6),
      [`M-10 500C110 390 300 390 440 470C570 370 800 365 930 460C1020 405 1130 410 1210 450V760H-10Z`, hill],
      ...fir(380, 392, 1, leaf, brown),
      ...roundTree(540, 300, 68, leaf, brown),

      // Track
      [R(-10, 748, 1220, 58), cream],
      ...[90, 280, 470, 660, 850, 1040].map(x => [R(x, 765, 110, 26, 5), brown]),
      [R(-10, 740, 1220, 20, 4), grey],
      [wave(808, 12, 6), GRASS],
      ...flower(100, 852, 34, pink, yellow, 5),
      ...tulip(1105, 888, 0.75, purple),
      [`M340 900q-6 -36 -26 -50M340 900q2 -38 0 -58M340 900q8 -36 26 -48M840 900q-6 -36 -26 -50M840 900q2 -38 0 -58M840 900q8 -36 26 -48M600 895q-5 -28 -20 -40M600 895q2 -30 0 -46M600 895q7 -28 20 -38`, null],

      // Couplings
      [R(330, 622, 66, 18, 6), grey],
      [R(690, 622, 60, 18, 6), grey],

      // Passenger carriage
      [`M26 432Q190 356 354 432Q356 442 346 442H34Q24 442 26 432Z`, pink],
      [R(44, 438, 292, 200, 8), mint],
      [R(66, 462, 100, 88, 12), cream],
      [R(214, 462, 100, 88, 12), cream],
      // bunny in the first window
      [E(102, 490, 11, 26), white],
      [E(130, 490, 11, 26), white],
      [O(116, 534, 30), white],
      [O(105, 530, 4.5), DARK],
      [O(127, 530, 4.5), DARK],
      // kitten in the last window
      [`M236 524L238 482L268 508Z`, orange],
      [`M292 524L290 482L260 508Z`, orange],
      [O(264, 534, 30), orange],
      [O(253, 530, 4.5), DARK],
      [O(275, 530, 4.5), DARK],
      [R(44, 548, 292, 90, 8), mint],
            [R(32, 638, 316, 20, 6), blue],
      ...smallWheel(115, 696, 46, blue, yellow),
      ...smallWheel(265, 696, 46, blue, yellow),

      // Open wagon with toys
      [O(470, 500, 56), red],
      [`M416 490Q470 530 524 490`, null],
      [`M553 442h104v110h-104Z`, purple],
      [`M594 442h22v110h-22Z`, yellow],
      [`M605 442C570 400 545 410 552 428C558 442 590 442 605 442C640 442 652 442 658 428C665 410 640 400 605 442Z`, yellow],
      [R(394, 528, 296, 112, 10), orange],
      [`M470 556V612M542 556V612M614 556V612`, null],
      [R(382, 638, 320, 20, 6), blue],
      ...smallWheel(465, 696, 46, red, yellow),
      ...smallWheel(620, 696, 46, red, yellow),

      // Smoke
      [O(850, 112, 68), white],
      [O(948, 188, 52), white],
      [O(1026, 252, 40), white],

      // Locomotive
      [`M1014 450L1022 348L990 306H1094L1062 348L1070 450Z`, blue],
      [R(978, 288, 128, 26, 11), red],
      [`M926 452C926 386 1000 386 1000 452Z`, yellow],
      [R(1092, 396, 48, 54, 10), yellow],
      [`M1118 450Q1178 532 1118 615Z`, orange],
      [R(900, 448, 225, 170, 12), azure],
      [R(1000, 442, 26, 182, 8), yellow],
      [R(726, 370, 182, 248, 8), red],
      [R(762, 398, 110, 112, 14), sky],
      // the bear driver
      [O(778, 452, 14), brown],
      [O(856, 452, 14), brown],
      [O(817, 474, 42), brown],
      [`M775 450C778 398 856 398 859 450Z`, blue],
      [`M770 450H864`, null],
      [O(802, 477, 5), DARK],
      [O(832, 477, 5), DARK],
      [`M806 494Q817 505 828 494`, null],
      [R(726, 508, 182, 110, 8), red],
      [starD(817, 566, 40), yellow],
      [`M702 352Q816 296 930 352L930 378H702Z`, yellow],
      [R(722, 616, 416, 36, 8), blue],
      [`M1136 652L1188 738H1092Z`, red],
      ...smallWheel(1055, 696, 44, pink, blue),
      ...wheel(800, 676, 66, yellow, pink, null),
      ...wheel(945, 676, 66, yellow, pink, null),
      [bar(800, 676, 945, 676, 12), grey],
      [O(800, 676, 20), blue],
      [O(945, 676, 20), blue],
    ],
  };
})();

/* ---------- Маяк ---------- */

const lighthousePage = (() => {
  const night = '#6f6bd1', lilac = '#b79ae8', rose = '#ff9fb2', peach = '#ffc98a', sun = '#ffe14d', white = '#ffffff',
    red = '#e8504a', sea = '#58b7e8', deep = '#2f93d6', rock = '#a7a3c4', grass = '#86d95f', brown = '#b57a42',
    navy = '#3f4fb0', orange = '#ff9440', beam = '#fff3b0';
  const cx = 300, hw = y => 60 + (y - 232) * 0.105;
  const band = (y1, y2, col) => [`M${r1(cx - hw(y1))} ${y1}Q${cx} ${y1 + 16} ${r1(cx + hw(y1))} ${y1}L${r1(cx + hw(y2))} ${y2}Q${cx} ${y2 + 16} ${r1(cx - hw(y2))} ${y2}Z`, col];
  return {
    id: 'world-lighthouse', title: 'Маяк и кораблики',
    shapes: [
      bg(night),
      [O(930, 520, 610), lilac],
      [O(930, 520, 470), rose],
      [O(930, 520, 330), peach],
      [O(930, 520, 120), sun],
      [`M345 150L1210 30V240Z`, beam],
      [`M255 150L-10 70V230Z`, beam],
      [starD(70, 290, 26), sun],
      [starD(170, 400, 20), sun],
      [starD(60, 28, 22), sun],
      [starD(470, 44, 26), sun],
      [starD(620, 24, 18), sun],
      [cloudD(1040, 305, 62), white],
      gull(850, 400, 0.9),
      gull(560, 420, 0.7),

      [wave(524, 10, 16), sea],

      // far boat
      [`M1065 552H1175L1160 584H1082Z`, red],
      [`M1120 552V452`, null],
      [`M1126 460L1172 544H1126Z`, white],
      [`M1114 474L1078 544H1114Z`, peach],

      // sailing boat
      [`M700 626V322`, null],
      [`M708 330C770 410 806 500 812 600H708Z`, white],
      [`M708 470H783M708 540H803`, null],
      [`M692 380C656 450 620 530 604 600H692Z`, sun],
      [`M700 322L654 300L700 278Z`, red],
      [`M580 612H832C824 676 790 706 750 706H660C620 706 590 676 580 612Z`, orange],
      [`M586 640H826`, null],

      [wave(676, 14, 8), deep],

      // island
      [`M20 800C30 700 80 672 150 650C260 624 420 628 520 655C600 680 650 720 670 800Z`, rock],
      [`M75 672C150 628 450 620 545 668C500 694 430 680 370 690C300 702 240 684 180 694C140 700 105 696 75 672Z`, grass],
      [`M212 744C206 716 248 706 286 712C318 716 328 748 304 760C270 772 220 768 212 744Z`, lilac],
      [`M430 742C426 720 460 712 490 716C516 720 520 744 502 754C476 764 436 762 430 742Z`, lilac],
      [starD(125, 742, 34, 16), orange],

      // keeper's house
      [R(420, 560, 128, 92, 6), white],
      [`M404 562L484 494L564 562Z`, red],
      [R(508, 492, 26, 46, 3), brown],
      [`M462 652V604A22 22 0 0 1 506 604V652Z`, brown],
      [O(444, 592, 14), sun],

      // tower
      band(232, 330, red),
      band(330, 430, white),
      band(430, 530, red),
      band(530, 650, white),
      [`M262 652V600A38 38 0 0 1 338 600V652Z`, brown],
      [O(300, 380, 24), sun],
      [O(300, 480, 24), sun],
      // lantern
      [R(250, 104, 100, 90), beam],
      [starD(300, 150, 34), sun],
      [`M240 106Q300 22 360 106Z`, red],
      [O(300, 48, 14), sun],
      [R(218, 158, 164, 46, 6), navy],
      [`M259 158V204M300 158V204M341 158V204`, null],
      [R(204, 204, 192, 28, 8), white],

      // tug boat
      [R(960, 618, 52, 62, 4), red],
      [R(950, 604, 72, 22, 8), white],
      [O(980, 584, 24), white],
      [O(940, 544, 34), white],
      [R(860, 650, 96, 80, 8), white],
      [R(850, 636, 116, 20, 8), orange],
      [O(888, 692, 16), beam],
      [O(930, 692, 16), beam],
      [`M800 720H1118C1112 780 1076 806 1030 806H890C840 806 806 780 800 720Z`, navy],
      [`M806 744H1112`, null],

      // buoy
      [`M679 800L699 730H751L771 800Z`, red],
      [R(687, 766, 76, 18), white],
      [`M725 730V698`, null],
      [O(725, 688, 16), sun],

      [wave(778, 16, 7), sea],
      ...fish(420, 850, 54, orange, sun),
      ...fish(800, 848, 54, rose, lilac, -1),
      ...[[230, 846], [610, 868], [1010, 852]].map(([x, y]) => [`M${x - 56} ${y}q28 -26 56 0q28 -26 56 0`, null]),
    ],
  };
})();

/* ---------- Кондитерская ---------- */

// Icing with a wavy lower edge: straight on top, n scallops below.
const icing = (x, y, w, d, n, col) => {
  const u = w / n;
  let p = `M${x} ${y}H${x + w}V${y + d}`;
  for (let i = 0; i < n; i++) p += `a${r1(u / 2)} ${r1(u / 2)} 0 0 1 ${r1(-u)} 0`;
  return [`${p}Z`, col];
};

const cupcake = (x, y, s, cup, cream, top) => [
  [`M${x - 34 * s} ${y - 52 * s}L${x - 24 * s} ${y}H${x + 24 * s}L${x + 34 * s} ${y - 52 * s}Z`, cup],
  [`M${x - 11 * s} ${y - 44 * s}L${x - 8 * s} ${y - 6 * s}M${x + 11 * s} ${y - 44 * s}L${x + 8 * s} ${y - 6 * s}`, null],
  [`M${x - 42 * s} ${y - 50 * s}C${x - 54 * s} ${y - 74 * s} ${x - 34 * s} ${y - 88 * s} ${x - 26 * s} ${y - 86 * s}C${x - 30 * s} ${y - 108 * s} ${x - 12 * s} ${y - 112 * s} ${x} ${y - 124 * s}C${x + 12 * s} ${y - 112 * s} ${x + 30 * s} ${y - 108 * s} ${x + 26 * s} ${y - 86 * s}C${x + 34 * s} ${y - 88 * s} ${x + 54 * s} ${y - 74 * s} ${x + 42 * s} ${y - 50 * s}Q${x} ${y - 38 * s} ${x - 42 * s} ${y - 50 * s}Z`, cream],
  [`M${x - 24 * s} ${y - 78 * s}Q${x} ${y - 66 * s} ${x + 26 * s} ${y - 84 * s}`, null],
  [O(x, y - 128 * s, 12 * s), top],
];

const donut = (x, y, r, dough, glaze, hole) => [
  [O(x, y, r), dough],
  [`M${x - r * 0.9} ${y}C${x - r * 0.9} ${y - r * 1.2} ${x + r * 0.9} ${y - r * 1.2} ${x + r * 0.9} ${y}C${x + r * 0.9} ${y + r * 0.4} ${x + r * 0.55} ${y + r * 0.2} ${x + r * 0.4} ${y + r * 0.55}C${x + r * 0.15} ${y + r * 0.9} ${x - r * 0.2} ${y + r * 0.35} ${x - r * 0.45} ${y + r * 0.62}C${x - r * 0.75} ${y + r * 0.8} ${x - r * 0.9} ${y + r * 0.35} ${x - r * 0.9} ${y}Z`, glaze],
  [O(x, y, r * 0.3), hole],
  [`M${x - r * 0.6} ${y - r * 0.3}l${r * 0.14} ${-r * 0.14}M${x + r * 0.45} ${y - r * 0.45}l${r * 0.16} ${r * 0.06}M${x - r * 0.05} ${y - r * 0.68}l${r * 0.1} ${r * 0.12}M${x + r * 0.55} ${y + r * 0.02}l${r * 0.06} ${r * 0.16}`, null],
];

const bakeryPage = (() => {
  const sky = '#cfeeff', wall = '#ffe2c9', pink = '#ff9ec4', white = '#ffffff', yellow = '#ffe14d', brown = '#a86b3c',
    cream = '#fff3c9', mint = '#8fe0c8', purple = '#b58cff', red = '#e8504a', walk = '#d9d6ea', road = '#9c9abb',
    green = '#7ed36a', orange = '#ffb340';

  // Block letters for the shop sign, each drawn as one thick closed shape.
  const t = 18, y = 110, h = 68;
  const letterT = (x, col) => [poly([[x, y], [x + 60, y], [x + 60, y + t], [x + 39, y + t], [x + 39, y + h], [x + 21, y + h], [x + 21, y + t], [x, y + t]]), col];
  const letterP = (x, col) => [`M${x} ${y}H${x + 44}Q${x + 60} ${y} ${x + 60} ${y + 16}V${y + 28}Q${x + 60} ${y + 44} ${x + 44} ${y + 44}H${x + t}V${y + h}H${x}Z`, col];
  const stripes = [];
  for (let i = 0; i < 12; i++) {
    const a = 150 + 75 * i, b = 150 + 75 * (i + 1), c = 120 + 80 * i, d = 120 + 80 * (i + 1);
    stripes.push([`M${a} 204H${b}L${d} 272A40 26 0 0 1 ${c} 272Z`, i % 2 ? white : pink]);
  }
  const topiary = x => [
    [R(x - 8, 610, 16, 80), brown],
    [O(x, 580, 62), green],
    [`M${x - 42} 680H${x + 42}L${x + 32} 770H${x - 32}Z`, orange],
  ];
  return {
    id: 'world-bakery', title: 'Кондитерская',
    shapes: [
      bg(sky),
      gull(50, 150, 0.6),
      gull(1150, 170, 0.6),
      [`M50 345Q28 430 50 525M1150 345Q1172 430 1150 525`, null],
      [E(50, 300, 36, 46), purple],
      [E(1150, 300, 36, 46), yellow],
      [`M70 88L130 22H1070L1130 88Z`, red],
      [R(100, 86, 1000, 640), wall],

      // Sign
      [R(300, 98, 600, 92, 28), white],
      letterT(418, pink),
      [R(490, y, 60, h, 24), orange],
      [R(508, y + t, 24, h - 2 * t, 8), white],
      letterP(562, mint),
      [R(562 + t, y + t, 24, 8, 3), white],
      letterT(634, purple),
      [`M706 ${y}H${706 + t}V${y + 24}H${706 + 36}Q${706 + 54} ${y + 24} ${706 + 54} ${y + 42}V${y + 50}Q${706 + 54} ${y + h} ${706 + 36} ${y + h}H706Z`, red],
      [R(706 + 60, y, t, h), red],
      [heartD(358, 146, 26), pink],
      [heartD(842, 146, 26), pink],

      ...stripes,

      // Shop window
      [R(130, 318, 620, 340, 14), brown],
      [R(148, 336, 584, 304, 8), cream],

      // Shelves
      [R(150, 470, 170, 20, 4), brown],
      [R(560, 470, 170, 20, 4), brown],

      // Roll on the top left shelf
      [R(180, 396, 130, 74, 30), orange],
      [E(192, 433, 26, 37), cream],
      [`M192 433c10 -8 14 8 2 12c-14 4 -20 -18 -2 -26`, null],

      // Donuts on the top right shelf
      ...donut(600, 426, 42, orange, pink, cream),
      ...donut(686, 426, 42, orange, mint, cream),

      // Cakes and cupcakes below
      [R(170, 562, 136, 78, 12), purple],
      icing(170, 554, 136, 22, 5, white),
      [O(208, 544, 15), red],
      [O(268, 544, 15), red],
      ...cupcake(602, 640, 1, pink, white, red),
      ...cupcake(680, 640, 1, mint, pink, yellow),

      // Three-tier cake
      [`M320 618H560L544 640H336Z`, white],
      [R(336, 534, 208, 84, 10), pink],
      icing(336, 526, 208, 24, 7, white),
      [R(368, 456, 144, 78, 10), mint],
      icing(368, 448, 144, 22, 5, yellow),
      [R(398, 392, 84, 64, 10), yellow],
      icing(398, 384, 84, 18, 3, pink),
      [heartD(440, 366, 19), red],
      ...[376, 440, 504].map(x => [starD(x, 588, 15), yellow]),

      // Flower box
      [`M140 678${'a37.5 28 0 0 1 75 0'.repeat(8)}V704H140Z`, green],
      ...[178, 252, 328, 402, 478, 552, 628, 696].map((x, i) => [O(x, 670, 10), [pink, yellow, purple, red, orange, pink, yellow, purple][i]]),
      [R(136, 692, 608, 28, 8), orange],

      // Door
      [R(812, 310, 240, 416, 10), brown],
      [R(828, 326, 208, 400, 8), mint],
      [`M860 490V404A72 72 0 0 1 1004 404V490Z`, sky],
      [`M932 332V490M860 420H1004`, null],
      [R(860, 520, 144, 170, 12), yellow],
      [heartD(932, 606, 36), pink],
      [O(846, 540, 13), yellow],

      // Street
      [R(-10, 726, 1220, 72), walk],
      [`M270 726V798M1000 726V798`, null],
      [R(-10, 798, 1220, 112), road],
      ...[110, 480, 850].map(x => [R(x, 842, 220, 22, 8), white]),
      ...topiary(50),
      ...topiary(1150),

      // Cat waiting for a treat
      ...(() => {
        const X = v => v + 34, Y = v => v + 6;
        return [
          [`M${X(806)} ${Y(778)}C${X(868)} ${Y(784)} ${X(880)} ${Y(722)} ${X(842)} ${Y(702)}C${X(860)} ${Y(740)} ${X(840)} ${Y(762)} ${X(808)} ${Y(760)}Z`, orange],
          [`M${X(700)} ${Y(790)}C${X(690)} ${Y(730)} ${X(712)} ${Y(690)} ${X(756)} ${Y(690)}C${X(800)} ${Y(690)} ${X(822)} ${Y(730)} ${X(812)} ${Y(790)}Z`, orange],
          [`M${X(712)} ${Y(660)}L${X(708)} ${Y(610)}L${X(746)} ${Y(636)}Z`, orange],
          [`M${X(800)} ${Y(660)}L${X(804)} ${Y(610)}L${X(766)} ${Y(636)}Z`, orange],
          [O(X(756), Y(664), 50), orange],
          [O(X(738), Y(656), 7), DARK],
          [O(X(774), Y(656), 7), DARK],
          [`M${X(748)} ${Y(674)}h16l-8 9ZM${X(756)} ${Y(683)}q0 12 -14 10M${X(756)} ${Y(683)}q0 12 14 10M${X(696)} ${Y(660)}l-18 -4M${X(696)} ${Y(672)}l-18 4M${X(816)} ${Y(660)}l18 -4M${X(816)} ${Y(672)}l18 4`, null],
        ];
      })(),
    ],
  };
})();

/* ---------- Комната мечты ---------- */

const cube = (x, y, s, front, top, side, star) => [
  [`M${x} ${y}L${x + 22} ${y - 22}H${x + s + 22}L${x + s} ${y}Z`, top],
  [`M${x + s} ${y}L${x + s + 22} ${y - 22}V${y + s - 22}L${x + s} ${y + s}Z`, side],
  [R(x, y, s, s, 6), front],
  ...(star ? [[starD(x + s / 2, y + s / 2 + 2, s * 0.3), star]] : []),
];

const roomPage = (() => {
  const wall = '#e7dbff', floor = '#eebd84', white = '#ffffff', pink = '#ff9ec4', red = '#ef6a6a', yellow = '#ffe14d',
    orange = '#ffb340', mint = '#8fe0c8', blue = '#6fb6ff', navy = '#3f4fb0', purple = '#b58cff', brown = '#b57a42',
    green = '#7ed36a', cream = '#fff3c9', bear = '#d9a066';
  return {
    id: 'world-room', title: 'Комната мечты',
    shapes: [
      bg(wall),
      ...pennants(430, -8, 820, 140, 1210, -8, 10, 58, [pink, yellow, mint, orange, blue]),
      [starD(530, 160, 26), yellow],

      // Floor
      [R(-10, 640, 1220, 270), floor],
      [`M40 700H240M300 740H410M880 790H1100M120 860H300M640 720H760M760 860H920M1000 720H1150`, null],
      [R(-10, 620, 1220, 22), white],

      // Window with the night outside
      [R(72, 112, 316, 312, 14), white],
      [R(92, 132, 276, 272, 6), navy],
      [`M230 132V404M92 268H368`, null],
      [`M318 170A42 42 0 1 0 318 244A52 52 0 1 1 318 170Z`, yellow],
      [starD(180, 200, 24), yellow],
      [starD(175, 335, 22), yellow],
      [starD(290, 335, 26), yellow],
            [R(54, 420, 352, 24, 10), white],
      [`M60 96H134C134 200 118 300 76 372L60 420Z`, pink],
      [`M400 96H326C326 200 342 300 384 372L400 420Z`, pink],
      [R(38, 84, 384, 20, 10), brown],

      // Doll's house
      [R(62, 556, 184, 150, 6), yellow],
      [`M36 560L154 462L272 560Z`, red],
      [`M132 706V640A22 22 0 0 1 176 640V706Z`, mint],
      [R(82, 586, 46, 46, 6), blue],
      [R(180, 586, 46, 46, 6), blue],

      // Easel
      [bar(520, 300, 520, 700, 9), brown],
      [bar(470, 400, 428, 712, 10), brown],
      [bar(570, 400, 612, 712, 10), brown],
      [R(420, 240, 200, 172, 6), white],
      [`M450 372A70 70 0 0 1 590 372H560A40 40 0 0 0 480 372Z`, red],
      [starD(520, 300, 26), yellow],
      [R(408, 410, 224, 22, 6), brown],

      // Bed
      [R(668, 690, 34, 62, 6), brown],
      [R(1100, 690, 34, 62, 6), brown],
      [`M1072 730V328C1072 262 1180 262 1180 328V730Z`, pink],
      [heartD(1126, 366, 34), white],
      [`M636 730V506C636 456 708 456 708 506V730Z`, pink],
      [R(700, 628, 376, 90, 8), brown],
            [O(760, 672, 7), yellow],
      [O(1020, 672, 7), yellow],
      [R(704, 532, 366, 100, 20), white],
      [E(1002, 494, 68, 44), mint],
      ...[0, 1, 2].flatMap(i => [
        [R(708 + 96 * i, 510, 96, 72), [blue, yellow, purple][i]],
        [R(708 + 96 * i, 582, 96, 72), [orange, red, blue][i]],
      ]),

      // Teddy on the bed
      [O(780, 366, 24), bear],
      [O(892, 366, 24), bear],
      [bar(782, 448, 748, 490, 19), bear],
      [bar(890, 448, 924, 490, 19), bear],
      [E(836, 448, 70, 62), bear],
      [E(836, 464, 42, 44), cream],
      [E(776, 508, 40, 24), bear],
      [E(896, 508, 40, 24), bear],
      [O(836, 362, 62), bear],
      [E(836, 386, 28, 22), cream],
      [E(836, 374, 9, 7), DARK],
      [O(812, 348, 7), DARK],
      [O(860, 348, 7), DARK],
      [`M836 380V392M822 394Q836 406 850 394`, null],
      [`M836 428L800 410V446ZM836 428L872 410V446Z`, red],
      [O(836, 428, 11), yellow],

      // Shelf with books
      [R(672, 248, 340, 20, 6), brown],
      [R(700, 150, 38, 98, 4), red],
      [R(738, 134, 38, 114, 4), yellow],
      [R(776, 160, 38, 88, 4), blue],
      [`M820 246L846 144L880 152L854 248Z`, mint],
      [O(945, 212, 34), orange],

      // Rug and toys
      [E(430, 815, 300, 80), purple],
      [E(430, 815, 226, 58), yellow],
      [E(430, 815, 150, 35), pink],

      ...cube(232, 700, 74, red, cream, blue),
      ...cube(316, 700, 74, blue, cream, mint),
      ...cube(272, 614, 74, mint, cream, red, pink),

      [O(596, 806, 62), white],
      [`M596 744C562 774 562 838 596 868M596 744C630 774 630 838 596 868`, null],
    ],
  };
})();

/* ---------- Весёлый робот ---------- */

const gear = (x, y, R1, R2, n) => {
  const pts = [], s = Math.PI / n;
  for (let i = 0; i < n; i++) {
    const a = i * 2 * s;
    [[-0.62, R2], [-0.42, R1], [0.42, R1], [0.62, R2]].forEach(([k, r]) => pts.push([x + Math.cos(a + k * s) * r, y + Math.sin(a + k * s) * r]));
  }
  return poly(pts);
};

const drop = (x, y, s) => `M${x} ${y - 18 * s}C${x + 16 * s} ${y + 2 * s} ${x + 12 * s} ${y + 14 * s} ${x} ${y + 14 * s}C${x - 12 * s} ${y + 14 * s} ${x - 16 * s} ${y + 2 * s} ${x} ${y - 18 * s}Z`;

const robotPage = (() => {
  const sky = '#c9f2e3', sun = '#ffe14d', orange = '#ffb340', white = '#ffffff', hill = '#b6e590', grass = '#86d95f',
    azure = '#7fd1e8', blue = '#4a78d8', red = '#ef5f5f', pink = '#ff9ec4', purple = '#b58cff', grey = '#b9bdd6',
    cream = '#fff3c9', water = '#5aa9ff';
  return {
    id: 'world-robot', title: 'Весёлый робот',
    shapes: [
      bg(sky),
      [gear(1060, 130, 96, 72, 12), orange],
      [O(1060, 130, 54), sun],
      [cloudD(215, 130, 90), white],
      [cloudD(800, 100, 64), white],
      [`M-10 640C160 520 340 560 520 620C700 560 900 520 1210 620V900H-10Z`, hill],
      [wave(735, 14, 5), grass],

      // Robot pup
      [bar(84, 668, 58, 618, 7), grey],
      [O(54, 606, 15), red],
      [R(80, 668, 170, 84, 30), azure],
      [R(120, 684, 70, 48, 16), sun],
      [O(116, 766, 26), blue],
      [O(214, 766, 26), blue],
      [O(116, 766, 10), sun],
      [O(214, 766, 10), sun],
      [R(206, 596, 116, 90, 28), azure],
      [bar(214, 610, 200, 664, 14), red],
      [bar(314, 610, 328, 664, 14), red],
      [O(244, 634, 9), DARK],
      [O(284, 634, 9), DARK],
      [E(264, 654, 10, 7), DARK],
      [`M250 666Q264 678 278 666`, null],

      // Legs
      [R(388, 612, 76, 142, 14), grey],
      [R(536, 612, 76, 142, 14), grey],
      [`M388 650H464M388 690H464M536 650H612M536 690H612`, null],
      [`M356 806C356 736 482 736 490 806Z`, red],
      [`M510 806C518 736 644 736 644 806Z`, red],

      // Arms behind the body
      [bar(362, 424, 250, 476, 26), azure],
      [bar(250, 476, 186, 330, 26), azure],
      [bar(638, 424, 760, 480, 26), azure],
      [bar(760, 480, 918, 332, 26), azure],

      // Body
      [R(520 - 20 - 90, 336, 180, 40, 8), grey],
      [R(340, 352, 320, 272, 46), blue],
      [R(392, 400, 216, 176, 26), cream],
      [heartD(462, 482, 48), red],
      [O(562, 438, 26), sun],
      [O(562, 520, 26), pink],

      // Elbows, shoulders, waving hand
      [O(350, 424, 36), red],
      [O(650, 424, 36), red],
      [O(250, 476, 32), sun],
      [O(760, 480, 32), sun],
      [`M144 284C132 252 150 224 172 228C176 212 204 212 210 228C232 222 248 252 234 284C240 320 210 348 186 348C164 348 136 322 144 284Z`, red],
      [`M172 228V274M210 228V276`, null],
      [`M112 258q-16 24 -6 56M86 240q-24 36 -8 84M264 256q18 26 8 58M290 240q22 36 8 84`, null],

      // Antenna and head
      [`M500 138V78`, null],
      [O(500, 60, 24), red],
      [R(330, 196, 46, 74, 14), orange],
      [R(624, 196, 46, 74, 14), orange],
      [R(358, 130, 284, 214, 50), azure],
      [O(432, 220, 54), white],
      [O(568, 220, 54), white],
      [O(432, 228, 30), blue],
      [O(568, 228, 30), blue],
      [O(444, 214, 10), white],
      [O(580, 214, 10), white],
      [E(386, 290, 22, 14), pink],
      [E(614, 290, 22, 14), pink],
      [`M430 286H570C566 332 530 340 500 340C470 340 434 332 430 286Z`, white],
      [`M476 286V336M524 286V336`, null],

      // Watering can
      [`M1020 438L1108 360L1126 380L1036 480Z`, sun],
      [`M1094 340L1148 396L1156 384L1106 332Z`, orange],
      [`M882 392C872 330 1014 330 1006 392`, null],
      [`M876 390H1036L1050 520H862Z`, purple],
      [`M866 470H1046`, null],
      [O(924, 330, 36), red],
            [drop(1160, 440, 1), water],
      [drop(1180, 500, 1), water],
      [drop(1130, 490, 1), water],
      [drop(1160, 560, 1), water],

      // Flowers
      [`M1130 880V750M960 880V790`, null],
      [petal(1130, 830, 56, 16, -2.5), grass],
      [petal(960, 840, 56, 16, -2.6), grass],
      ...flower(1130, 700, 58, pink),
      ...flower(960, 760, 42, purple, sun, 5),
      ...flower(780, 836, 34, orange, sun, 5),
      [gear(560, 850, 40, 30, 9), grey],
      [O(560, 850, 14), sun],
      [gear(370, 862, 28, 21, 8), orange],
    ],
  };
})();

/* ---------- Цирк ---------- */

const circusPage = (() => {
  const night = '#4d57b8', sun = '#ffe14d', cream = '#fff3c9', red = '#e8504a', blue = '#6fb6ff', white = '#ffffff',
    pink = '#ff9ec4', purple = '#b58cff', mint = '#8fe0c8', dark = '#7a3ea8', grass = '#86d95f', grey = '#b9bdd6',
    orange = '#ffb340', brown = '#b57a42', path = '#f3dcae';
  const canopy = [];
  for (let i = 0; i < 8; i++) {
    const x0 = 140 + 115 * i, x1 = x0 + 115;
    const c0 = 600 + (x0 - 600) * 0.28, c1 = 600 + (x1 - 600) * 0.28;
    canopy.push([`M600 130Q${r1(c1)} 300 ${x1} 400A57.5 34 0 0 1 ${x0} 400Q${r1(c0)} 300 600 130Z`, i % 2 ? cream : red]);
  }
  const walls = [];
  for (let i = 0; i < 8; i++) walls.push([R(200 + 100 * i, 396, 100, 352), i % 2 ? red : cream]);
  return {
    id: 'world-circus', title: 'Цирковой шатёр',
    shapes: [
      bg(night),
      [`M1062 44A60 60 0 1 0 1062 150A74 74 0 1 1 1062 44Z`, sun],
      ...[[90, 76, 28], [250, 42, 22], [420, 90, 26], [780, 74, 28], [860, 164, 22], [1170, 90, 24], [100, 340, 22], [1105, 330, 24]].map(([x, y, r]) => [starD(x, y, r), sun]),

      [wave(735, 14, 5), grass],
      ...pennants(600, 150, 310, 280, 36, 214, 6, 54, [pink, sun, mint, orange], 0.34),
      ...pennants(600, 150, 890, 280, 1164, 214, 6, 54, [mint, orange, pink, sun], 0.34),
      [`M36 214V720M1164 214V720`, null],
      [`M36 214L100 176L36 146Z`, red],
      [`M1164 214L1100 176L1164 146Z`, red],

      ...walls,
      [R(470, 396, 260, 352), dark],
      ...canopy,
      [`M600 132V60`, null],
      [`M600 26L690 52L600 78Z`, sun],
      [O(600, 142, 16), sun],

      // Seal on a stand, balancing a ball
      [`M526 690H674L682 748H518Z`, blue],
      [starD(600, 722, 22), sun],
      [`M530 690C530 626 556 596 600 596C644 596 670 626 670 690Z`, grey],
      [E(600, 656, 36, 30), white],
      [petal(556, 622, 62, 20, 2.2), grey],
      [petal(644, 622, 62, 20, 0.94), grey],
      [O(600, 572, 48), grey],
      [E(600, 596, 30, 19), white],
      [E(600, 585, 11, 8), DARK],
      [O(580, 562, 7), DARK],
      [O(620, 562, 7), DARK],
      [`M600 593V613M569 592l-20 -6M569 602l-20 6M631 592l20 -6M631 602l20 6`, null],
      [O(600, 482, 44), pink],
      [`M600 438Q566 482 600 526M600 438Q634 482 600 526`, null],

      // Curtains
      [`M466 416H546C542 470 520 512 500 534C510 630 512 700 510 748H466Z`, purple],
      [`M734 416H654C658 470 680 512 700 534C690 630 688 700 690 748H734Z`, purple],
      [R(462, 526, 54, 22, 8), sun],
      [R(684, 526, 54, 22, 8), sun],

      // Ticket booth
      [R(46, 576, 130, 174, 6), blue],
      [`M28 584L60 520H162L194 584Z`, red],
      [R(68, 612, 86, 62, 8), cream],
      [R(40, 672, 142, 16, 4), brown],
      [starD(112, 716, 24), sun],

      // Popcorn cart with balloons
      [`M1090 590V472M1090 590L1038 490M1090 590L1148 500`, null],
      [E(1090, 430, 40, 48), red],
      [E(1036, 448, 36, 44), mint],
      [E(1150, 456, 36, 44), sun],
      [R(1026, 606, 140, 110, 8), red],
      [R(1056, 606, 28, 110), cream],
      [R(1112, 606, 28, 110), cream],
      [`M1012 612L1040 566H1152L1180 612Z`, orange],
      ...smallWheel(1058, 750, 30, brown, sun),
      ...smallWheel(1136, 750, 30, brown, sun),

      // Path and balls on the grass
      [`M520 748H680L820 910H380Z`, path],
      ...flower(250, 838, 32, pink, sun, 5),
      ...flower(960, 846, 32, orange, sun, 5),
      [`M140 870q-6 -32 -24 -44M140 870q2 -34 0 -52M140 870q8 -32 24 -42M1100 880q-6 -32 -24 -44M1100 880q2 -34 0 -52M1100 880q8 -32 24 -42`, null],
    ],
  };
})();

export default [trainPage, lighthousePage, bakeryPage, roomPage, robotPage, circusPage];
