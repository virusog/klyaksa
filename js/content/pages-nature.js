// Coloring pages about nature and the seasons. All art is original, drawn in code.
import { O, E, R, starD, heartD, cloudD, wave, petal, flower, fish, bg, GRASS, DARK } from '../art.js';

const n1 = v => +v.toFixed(1);

// Moves a path drawn around (0,0). Only for paths made of absolute M, L, C, Q and Z.
const at = (x, y, s = 1, a = 0, f = 1) => d => {
  const c = Math.cos(a), si = Math.sin(a);
  return d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (m, u, v) => {
    const px = +u * s * f, py = +v * s;
    return `${n1(x + px * c - py * si)} ${n1(y + px * si + py * c)}`;
  });
};

// An ellipse made of curves, so that at() can move it.
const oval = (x, y, a, b = a) => {
  const k = 0.5523, A = a * k, B = b * k;
  return `M${n1(x - a)} ${n1(y)}C${n1(x - a)} ${n1(y - B)} ${n1(x - A)} ${n1(y - b)} ${n1(x)} ${n1(y - b)}C${n1(x + A)} ${n1(y - b)} ${n1(x + a)} ${n1(y - B)} ${n1(x + a)} ${n1(y)}C${n1(x + a)} ${n1(y + B)} ${n1(x + A)} ${n1(y + b)} ${n1(x)} ${n1(y + b)}C${n1(x - A)} ${n1(y + b)} ${n1(x - a)} ${n1(y + B)} ${n1(x - a)} ${n1(y)}Z`;
};

// A puffy outline, for tree crowns, bushes and foam.
function blob(cx, cy, rx, ry, n, b = 0.28, rot = 0) {
  const pt = (a, k) => `${n1(cx + Math.cos(a) * rx * k)} ${n1(cy + Math.sin(a) * ry * k)}`;
  const step = 6.28318 / n;
  let d = `M${pt(rot, 1)}`;
  for (let i = 0; i < n; i++) d += `Q${pt(rot + step * (i + 0.5), 1 + b)} ${pt(rot + step * (i + 1), 1)}`;
  return `${d}Z`;
}

const sun = (x, y, r, col, ray, n = 12) => [[starD(x, y, r * 1.55, r * 1.18, n), ray], [O(x, y, r), col]];

// One layer of a fir tree: curved sides and a scalloped hem.
function tier(cx, top, bot, hw, scallops = 4) {
  const w = (hw * 2) / scallops;
  let d = `M${cx} ${top}Q${n1(cx + hw * 0.32)} ${n1(top + (bot - top) * 0.66)} ${cx + hw} ${bot}`;
  for (let i = 0; i < scallops; i++) d += `Q${n1(cx + hw - w * (i + 0.5))} ${n1(bot + w * 0.42)} ${n1(cx + hw - w * (i + 1))} ${bot}`;
  return `${d}Q${n1(cx - hw * 0.32)} ${n1(top + (bot - top) * 0.66)} ${cx} ${top}Z`;
}

function fir(x, base, w, h, col, wood = '#a9744a') {
  const trunkH = h * 0.14;
  const b = base - trunkH;
  const H = h - trunkH;
  return [
    [R(x - w * 0.09, b - 4, w * 0.18, trunkH + 4), wood],
    [tier(x, b - H * 0.62, b, w / 2, 4), col],
    [tier(x, b - H * 0.82, b - H * 0.34, w * 0.39, 3), col],
    [tier(x, b - H, b - H * 0.62, w * 0.27, 2), col],
  ];
}

const flake = (x, y, r) => {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + 0.26;
    const c = Math.cos(a), s = Math.sin(a);
    const P = (u, v) => `${n1(x + u * c - v * s)} ${n1(y + u * s + v * c)}`;
    d += `M${P(0, 0)}L${P(r, 0)}M${P(r * 0.6, 0)}L${P(r * 0.85, r * 0.26)}M${P(r * 0.6, 0)}L${P(r * 0.85, -r * 0.26)}`;
  }
  return [d, null];
};

function gift(x, y, w, h, col, rib) {
  return [
    [petal(x + w / 2, y - h, w * 0.42, w * 0.17, -2.6), rib],
    [petal(x + w / 2, y - h, w * 0.42, w * 0.17, -0.54), rib],
    [R(x, y - h, w, h, 5), col],
    [R(x + w / 2 - 13, y - h, 26, h), rib],
  ];
}

function bird(x, y, s, f, body, belly, wing, beak = '#ffb340') {
  const t = at(x, y, s, 0, f);
  return [
    [t('M-8 -20L-8 0M-20 0L6 0M16 -20L16 0M4 0L30 0'), null],
    [t('M-45 -68L-118 -88L-106 -54L-124 -32L-40 -36Z'), wing],
    [t('M-55 -55C-55 -90 -30 -105 5 -105C5 -135 28 -152 52 -148C78 -144 90 -122 85 -100C82 -60 55 -15 10 -14C-25 -13 -55 -25 -55 -55Z'), body],
    [t('M85 -100C82 -60 55 -15 10 -14C-5 -14 -20 -18 -25 -24C20 -30 50 -65 55 -100C65 -112 78 -112 85 -100Z'), belly],
    [t('M-40 -75C-10 -100 30 -90 38 -68C20 -40 -15 -35 -50 -48C-52 -58 -48 -68 -40 -75Z'), wing],
    [t(oval(54, -126, 11)), DARK],
    [t('M84 -134L122 -120L84 -106Z'), beak],
  ];
}

function flyBird(x, y, s, f, body, wing, beak = '#ffb340') {
  const t = at(x, y, s, 0, f);
  return [
    [t('M-50 -5L-112 -32L-100 5L-114 32L-48 14Z'), wing],
    [t('M-60 5C-40 -35 30 -35 60 -15C75 -38 112 -32 116 -5C118 14 95 28 72 22C40 42 -30 42 -60 5Z'), body],
    [t('M-24 -16C-44 -80 -20 -130 34 -152C48 -100 44 -50 28 -14Z'), wing],
    [t(oval(92, -10, 8)), DARK],
    [t('M114 -14L146 -2L114 10Z'), beak],
  ];
}

function tulip(x, y, h, col, leaf = '#3fae6b') {
  const t = at(x, y, h / 200);
  return [
    [t('M0 0L0 -105'), null],
    [t('M0 0C-60 -30 -70 -90 -58 -130C-30 -100 -8 -60 0 0Z'), leaf],
    [t('M0 0C60 -30 70 -90 58 -130C30 -100 8 -60 0 0Z'), leaf],
    [t('M-46 -200L-46 -140C-46 -112 -24 -98 0 -98C24 -98 46 -112 46 -140L46 -200L23 -168L0 -206L-23 -168Z'), col],
  ];
}

function mushroom(x, y, s, cap, spots) {
  const t = at(x, y, s);
  const out = [
    [t('M-26 4C-20 -30 -20 -50 -16 -76L16 -76C20 -50 20 -30 26 4Q0 16 -26 4Z'), '#fff1d9'],
    [t('M-84 -66C-84 -160 84 -160 84 -66Q0 -44 -84 -66Z'), cap],
  ];
  if (spots) {
    out.push([t(oval(-36, -96, 15, 13)), spots], [t(oval(12, -116, 15, 12)), spots], [t(oval(46, -84, 13, 11)), spots]);
  }
  return out;
}

const MAPLE = 'M0 -100L13 -68L34 -80L27 -48L56 -56L46 -32L64 -22L26 -6L30 8L5 2L4 24L-4 24L-5 2L-30 8L-26 -6L-64 -22L-46 -32L-56 -56L-27 -48L-34 -80L-13 -68Z';
const OAK = 'M0 -104C14 -104 22 -92 18 -80C34 -86 44 -72 34 -60C48 -60 54 -44 40 -34C50 -30 48 -12 32 -12C28 0 12 2 5 -4L4 24L-4 24L-5 -4C-12 2 -28 0 -32 -12C-48 -12 -50 -30 -40 -34C-54 -44 -48 -60 -34 -60C-44 -72 -34 -86 -18 -80C-22 -92 -14 -104 0 -104Z';
const OVAL_LEAF = 'M0 -104C34 -78 42 -30 0 2C-42 -30 -34 -78 0 -104Z';

function leaf(kind, x, y, s, a, col) {
  const t = at(x, y, s, a);
  if (kind === 'maple') return [[t(MAPLE), col], [t('M0 2L0 -66M0 -32L-22 -46M0 -32L22 -46M0 -14L-40 -24M0 -14L40 -24'), null]];
  if (kind === 'oak') return [[t(OAK), col], [t('M0 0L0 -84M0 -26L-22 -44M0 -26L22 -44M0 -56L-14 -68M0 -56L14 -68'), null]];
  return [[t(OVAL_LEAF), col], [t('M0 26L0 -76M0 -22L-18 -40M0 -22L18 -40'), null]];
}

// A mountain with a snow cap whose sides lie exactly on the slopes.
function mountain(ax, ay, lx, rx, base, col, capT = 0.32, cap = '#ffffff') {
  const L = [ax + (lx - ax) * capT, ay + (base - ay) * capT];
  const Rt = [ax + (rx - ax) * capT, ay + (base - ay) * capT];
  const n = 5;
  let z = `M${ax} ${ay}L${n1(Rt[0])} ${n1(Rt[1])}`;
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1);
    const px = Rt[0] + (L[0] - Rt[0]) * u;
    const py = Rt[1] + (i % 2 ? 44 : -28) * 0.9;
    z += `L${n1(px)} ${n1(py)}`;
  }
  z += `L${n1(L[0])} ${n1(L[1])}Z`;
  return [[`M${ax} ${ay}L${rx} ${base}L${lx} ${base}Z`, col], [z, cap]];
}

function stripe(x1, x2, a, b) {
  const yy = x => b * Math.sqrt(Math.max(0, 1 - (x / a) ** 2));
  const y1 = yy(x1), y2 = yy(x2), mx = (x1 + x2) / 2;
  const cy = 2 * yy(mx) - (y1 + y2) / 2;
  return `M${n1(x1)} ${n1(-y1)}Q${n1(mx)} ${n1(-cy)} ${n1(x2)} ${n1(-y2)}Q${n1(x2 + 12)} 0 ${n1(x2)} ${n1(y2)}Q${n1(mx)} ${n1(cy)} ${n1(x1)} ${n1(y1)}Q${n1(x1 + 12)} 0 ${n1(x1)} ${n1(-y1)}Z`;
}

function bee(x, y, s, a = 0, f = 1) {
  const t = at(x, y, s, a, f);
  const dark = '#6a4524';
  return [
    [t('M-58 -12L-92 0L-58 12Z'), dark],
    [t(petal(-14, -30, 92, 30, -1.98)), '#cdf0ff'],
    [t(petal(10, -32, 92, 30, -1.2)), '#ffffff'],
    [t(oval(0, 0, 64, 44)), '#ffd447'],
    [t(stripe(-44, -22, 64, 44)), dark],
    [t(stripe(-2, 22, 64, 44)), dark],
    [t('M72 -30C76 -56 92 -66 104 -66M84 -28C96 -46 112 -48 124 -44'), null],
    [t(oval(76, -4, 34)), '#ffe08a'],
    [t(oval(86, -12, 9)), DARK],
    [t('M72 12Q88 24 104 10'), null],
  ];
}

// A castle tower with teeth on top, a little narrower above than below.
function tower(cx, base, top, bw, tw, n, h) {
  const step = (2 * tw) / (2 * n - 1);
  let d = `M${cx - bw} ${base}L${cx - tw} ${top}`;
  let x = cx - tw;
  for (let i = 0; i < n; i++) {
    d += `L${n1(x)} ${top - h}L${n1(x + step)} ${top - h}L${n1(x + step)} ${top}`;
    x += step;
    if (i < n - 1) { x += step; d += `L${n1(x)} ${top}`; }
  }
  return `${d}L${cx + bw} ${base}Z`;
}

const arch = (x, y, w, h) => `M${x - w} ${y}V${y - h}A${w} ${w} 0 0 1 ${x + w} ${y - h}V${y}Z`;

// How far a tier() reaches left and right at height y, to hang garlands exactly on its edge.
function tierHalf(top, bot, hw, y) {
  const v = (y - top) / (bot - top);
  const t = (1.32 - Math.sqrt(1.7424 - 1.28 * v)) / 0.64;
  return hw * (0.64 * t * (1 - t) + t * t);
}

const swag = (cx, top, bot, hw, y, sag) => {
  const e = n1(tierHalf(top, bot, hw, y));
  return [`M${cx - e} ${y}Q${cx} ${y + sag} ${cx + e} ${y}`, null];
};

// A row of short dashes along a curve: the flight path of a bee.
function trail(x0, y0, x1, y1, x2, y2, x3, y3, n) {
  const B = t => {
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
    return `${n1(a * x0 + b * x1 + c * x2 + e * x3)} ${n1(a * y0 + b * y1 + c * y2 + e * y3)}`;
  };
  let d = '';
  for (let i = 0; i < n; i++) d += `M${B(i / n)}L${B((i + 0.55) / n)}`;
  return [d, null];
}

function winter() {
  const SKYW = '#a4cdf1', W = '#ffffff', SHADE = '#dcebfa', Y = '#ffd447', OR = '#ff9f43', RED = '#ff6b6b';
  const PINK = '#ff8fc7', BLUE = '#5aa9ff', PUR = '#b58cff', G1 = '#2fa36b', G2 = '#5fb59a';
  const WOOD = '#a9744a', LOG = '#d9925a', BARK = '#6f4528', EAR = '#ffc1d9';
  const orn = (x, y, r, c) => [O(x, y, r), c];
  const broom = at(1042, 520, 1, 0.1);
  return {
    id: 'nature-winter', title: 'Снеговик и ёлочка',
    shapes: [
      bg(SKYW),
      ...sun(640, 104, 52, Y, OR, 12),
      [cloudD(470, 130, 64), W],
      [cloudD(96, 118, 62), W],
      [`M-10 530C180 440 380 450 570 520C770 600 980 480 1210 510V910H-10Z`, SHADE],
      ...fir(1140, 545, 100, 180, G2, WOOD),
      ...fir(66, 520, 84, 150, G2, WOOD),

      // the little house
      [R(470, 480, 210, 170), LOG],
      [`M470 530H680M470 585H680`, null],
      [R(506, 372, 42, 80), BARK],
      [`M440 490L575 372L710 490Q715 515 685 510L465 510Q435 515 440 490Z`, W],
      [R(506, 535, 62, 62, 6), Y],
      [`M537 535V597M506 566H568`, null],
      [`M590 650V562A32 32 0 0 1 654 562V650Z`, BARK],
      [O(642, 606, 7), Y],
      [`M527 360c-24 -22 24 -38 0 -62c-20 -22 22 -34 2 -56`, null],
      [`M-10 650C200 600 420 630 600 658C800 690 1000 625 1210 650V910H-10Z`, W],

      // the fir tree
      [R(256, 770, 68, 70, 6), BARK],
      [tier(290, 455, 780, 205, 5), G1],
      swag(290, 455, 780, 205, 690, 66),
      [tier(290, 300, 600, 165, 4), G1],
      swag(290, 300, 600, 165, 512, 56),
      [tier(290, 150, 435, 118, 3), G1],
      swag(290, 150, 435, 118, 345, 44),
      orn(292, 275, 18, BLUE),
      orn(245, 400, 21, RED), orn(338, 396, 20, Y),
      orn(212, 556, 24, Y), orn(292, 546, 26, PINK), orn(372, 556, 23, BLUE),
      orn(250, 716, 26, BLUE), orn(332, 716, 26, RED),
      [starD(290, 138, 62, 28), Y],
      ...gift(392, 852, 110, 86, PINK, Y),
      ...gift(68, 852, 120, 92, PUR, G2),

      // the broom and arms go behind the snowman
      [broom(`M-11 -130L11 -130L11 320L-11 320Z`), WOOD],
      [broom(`M-14 -126C-40 -170 -72 -240 -74 -322L-50 -298L-34 -340L-12 -304L6 -344L26 -304L44 -338L56 -300L76 -320C72 -240 40 -170 14 -126Z`), Y],
      [broom(`M-30 -166L30 -166L22 -130L-22 -130Z`), RED],
      [broom(`M-34 -180L-44 -270M0 -170L0 -276M34 -180L44 -270`), null],
      [`M770 470L668 408L612 410L606 388L648 384L616 346L636 330L684 384L784 440Z`, WOOD],
      [`M930 440L1000 410L1054 420L1056 446L1000 442L942 474Z`, WOOD],

      // the snowman
      [E(850, 700, 170, 150), W],
      [O(850, 480, 112), W],
      [`M892 420L952 424L972 560L908 572Z`, RED],
      [`M898 462L958 464M904 512L965 512`, null],
      [O(850, 298, 88), W],
      [`M768 350C810 398 890 398 932 350C950 366 950 398 932 412C890 450 810 450 768 412C750 398 750 366 768 350Z`, RED],
      [`M812 396L806 438M866 398L872 440`, null],
      [at(850, 236, 1, -0.13)(`M-68 8L-52 -96L52 -96L68 8Z`), BLUE],
      [at(850, 236, 1, -0.13)(`M-84 -4L84 -4Q94 10 84 24L-84 24Q-94 10 -84 -4Z`), Y],
      [O(812, 284, 15), DARK],
      [O(888, 284, 15), DARK],
      [O(818, 278, 5), W],
      [O(894, 278, 5), W],
      [`M852 302C884 288 926 302 968 322C926 330 884 340 852 330C842 322 842 310 852 302Z`, OR],
      [`M892 300l-4 12M920 310l-4 12`, null],
      [`M806 342Q850 372 894 342`, null],
      [O(850, 490, 22), BLUE],
      [O(850, 556, 22), Y],
      [O(850, 640, 24), PINK],
      [O(850, 730, 24), BLUE],

      ...bird(672, 396, 0.62, -1, BLUE, RED, DARK, OR),

      // the sled
      [`M552 824V852M668 824V852`, null],
      [`M528 788H692Q702 788 702 798V814Q702 824 692 824H528Q518 824 518 814V798Q518 788 528 788Z`, OR],
      [`M580 788V824M640 788V824`, null],
      [`M510 852H690C708 852 718 842 722 818L738 820C734 852 716 868 690 868H510Q502 860 510 852Z`, PUR],

      // a bunny in a snowdrift
      [`M1060 770C1040 690 1048 640 1066 636C1088 640 1100 700 1094 770Z`, W],
      [`M1112 770C1120 700 1136 640 1156 646C1172 664 1160 720 1146 776Z`, W],
      [`M1070 750C1060 700 1064 668 1070 660C1082 670 1086 710 1084 750Z`, EAR],
      [`M1124 754C1130 710 1140 680 1150 672C1158 690 1150 730 1138 758Z`, EAR],
      [E(1106, 800, 76, 62), W],
      [O(1078, 790, 11), DARK],
      [O(1134, 790, 11), DARK],
      [`M1098 812h16l-8 10Z`, PINK],
      [`M985 900C1010 836 1070 832 1110 846C1150 832 1200 840 1225 866V920H985Z`, SHADE],

      [O(170, 290, 13), W],
      [O(730, 250, 13), W],
      [O(1185, 330, 13), W],
      [O(1180, 95, 14), W],
      flake(190, 190, 34),
      flake(760, 110, 30),
      flake(1178, 172, 20),
      flake(428, 420, 24),
    ],
  };
}

function spring() {
  const SKYS = '#c4ecfb', W = '#ffffff', HILL = '#bfe89a', CREAM = '#fff7e8', TAN = '#e8c9a0', CROWN = '#ffc9dc';
  const DEEP = '#ff8fb5', Y = '#ffd447', OR = '#ff9f43', RED = '#ff6b6b', BLUE = '#5aa9ff', PUR = '#b58cff';
  const LEAF = '#3fae6b', WOOD = '#a9744a';
  const pickets = [];
  for (let x = -24; x < 1230; x += 140) pickets.push([`M${x} 650V505L${x + 36} 462L${x + 72} 505V650Z`, CREAM]);
  const blossom = (x, y, r, c, rot = 0) => [[blob(x, y, r * 0.55, r * 0.55, 5, 1.5, rot), c], [O(x, y, r * 0.3), Y]];
  return {
    id: 'nature-spring', title: 'Весенний сад',
    shapes: [
      bg(SKYS),
      ...sun(1102, 104, 56, Y, OR, 12),
      [cloudD(935, 72, 56), W],
      [`M-10 430C200 380 420 420 640 420C860 420 1040 390 1210 430V910H-10Z`, HILL],
      ...pickets,
      [R(-10, 606, 1220, 60), TAN],
      [`M-10 650C200 620 420 640 640 648C860 655 1040 625 1210 650V910H-10Z`, GRASS],

      // the apple tree in bloom
      [`M390 860C425 760 432 680 420 610C380 560 310 530 230 520L236 488C320 490 400 510 440 555C445 500 440 460 430 420L510 420C512 470 512 510 512 555C570 500 650 480 740 478L745 510C660 520 590 550 540 620C532 690 545 770 590 860Z`, WOOD],
      [`M478 700c-20 30 -20 60 0 90M520 640c-14 14 -14 30 -4 44`, null],
      [blob(475, 232, 345, 195, 16, 0.2), CROWN],
      ...blossom(320, 102, 54, W, 0.3),
      ...blossom(482, 88, 54, DEEP, 1),
      ...blossom(640, 112, 54, W, 0.1),
      ...blossom(192, 212, 54, DEEP, 0.7),
      ...blossom(366, 222, 54, W, 1.2),
      ...blossom(548, 218, 54, DEEP, 0.4),
      ...blossom(730, 232, 54, W, 0.9),
      ...blossom(290, 336, 54, W, 0.5),
      ...blossom(462, 342, 54, DEEP, 0.2),

      // nest with three chicks
      [O(205, 450, 28), Y],
      [O(262, 440, 30), Y],
      [O(318, 452, 28), Y],
      [`M192 452L205 474L218 452Z`, OR],
      [`M248 442L262 466L276 442Z`, OR],
      [`M305 454L318 476L331 454Z`, OR],
      [O(193, 438, 6), DARK], [O(217, 438, 6), DARK],
      [O(250, 427, 6), DARK], [O(274, 427, 6), DARK],
      [O(306, 440, 6), DARK], [O(330, 440, 6), DARK],
      [`M150 462C200 480 320 480 372 462C368 520 320 540 262 540C204 540 156 520 150 462Z`, TAN],
      [`M186 490C230 508 300 506 340 488M206 520C240 530 290 528 322 516`, null],

      ...bird(566, 508, 0.7, 1, BLUE, CREAM, PUR, OR),
      ...bird(746, 479, 0.68, -1, OR, CREAM, RED, Y),

      // the bird house
      [R(966, 450, 30, 420), WOOD],
      [R(896, 310, 170, 160, 8), Y],
      [`M868 320L981 212L1094 320Z`, RED],
      [O(981, 385, 44), PUR],
      [O(981, 392, 30), OR],
      [O(971, 383, 7), DARK], [O(993, 383, 7), DARK],
      [`M972 396L981 414L990 396Z`, RED],

      ...flyBird(868, 212, 0.56, 1, BLUE, PUR, OR),

      // flowers in the grass
      ...tulip(70, 830, 180, RED, LEAF),
      ...tulip(180, 870, 200, Y, LEAF),
      ...tulip(295, 850, 150, PUR, LEAF),
      ...tulip(905, 880, 145, DEEP, LEAF),
      ...tulip(1105, 870, 210, OR, LEAF),

      // watering can with drops
      [`M662 745C590 705 598 800 662 795`, null],
      [`M780 788L858 700L876 716L780 834Z`, PUR],
      [`M856 700L857 662Q899 664 913 708L876 716Z`, Y],
      [R(655, 712, 130, 130, 14), BLUE],
      [`M675 714C675 662 765 662 765 714`, null],
      [heartD(720, 780, 28), DEEP],
      [`M934 660c-11 16 -11 26 0 26c11 0 11 -10 0 -26Z`, SKYS],
      [`M944 698c-11 16 -11 26 0 26c11 0 11 -10 0 -26Z`, SKYS],
    ],
  };
}

function summer() {
  const W = '#ffffff', SEA1 = '#6fcdef', SEA2 = '#3fa9de', SAND = '#f8e2ab', C1 = '#f3c978', C2 = '#ecb863';
  const WOOD = '#b57a42', Y = '#ffd447', AM = '#ffb340', RED = '#ff6b6b', COR = '#ff7f50', PINK = '#ff8fc7', BLUE = '#5aa9ff';
  const stripes = [RED, W, Y, W, RED];
  const xs = [-200, -120, -40, 40, 120, 200];
  const um = at(214, 340, 1, 0.16);
  const canopy = stripes.map((c, i) => {
    const a = xs[i], b = xs[i + 1];
    const ctrl = v => `${n1(v * 0.92)} ${n1(-20 - 135 * (1 - (Math.abs(v) / 200) ** 2) - (Math.abs(v) / 200) * 90)}`;
    return [um(`M0 -160Q${ctrl(a)} ${a} 0Q${(a + b) / 2} -36 ${b} 0Q${ctrl(b)} 0 -160Z`), c];
  });
  const spade = at(1118, 640, 1, 0.06);
  const cr = at(141, 812, 0.85);
  return {
    id: 'nature-summer', title: 'Лето на пляже',
    shapes: [
      bg('#aee3fb'),
      ...sun(1085, 118, 66, Y, AM, 14),
      [cloudD(640, 120, 86), W],
      [cloudD(860, 80, 50), W],
      [`M470 200q24 -28 48 0q24 -28 48 0`, null],
      [`M760 215q18 -22 36 0q18 -22 36 0`, null],
      [wave(320, 12, 10), SEA1],

      // sailboat
      [`M905 350V190`, null],
      [`M915 200L1023 336L915 336Z`, PINK],
      [`M895 215L803 336L895 336Z`, W],
      [`M800 332L1030 332L985 392L845 392Z`, COR],

      [wave(380, 14, 8), SEA2],
      [`M-10 482C100 500 200 460 330 482C470 505 560 462 700 484C840 506 960 462 1210 488V910H-10Z`, W],
      [`M-10 510C200 480 500 540 700 510C900 480 1100 520 1210 500V910H-10Z`, SAND],

      // beach umbrella
      [`M196 340L212 342L178 642L162 640Z`, WOOD],
      ...canopy,
      [um(oval(0, -164, 14)), Y],
      [`M105 650C130 612 215 612 240 650Q172 668 105 650Z`, C1],

      // sand castle
      [`M290 800L910 800C925 860 880 885 600 888C320 885 275 860 290 800Z`, C2],
      [tower(600, 700, 380, 100, 86, 3, 30), C2],
      [`M600 350V240`, null],
      [`M606 244L700 274L606 306Z`, RED],
      [tower(600, 800, 520, 215, 215, 6, 36), C1],
      [tower(355, 810, 430, 95, 76, 3, 30), C2],
      [tower(845, 810, 430, 95, 76, 3, 30), C2],
      [arch(600, 800, 62, 110), WOOD],
      [`M600 628V800M538 700H662`, null],
      [arch(600, 470, 28, 40), SEA1],
      [arch(355, 590, 28, 40), SEA1],
      [arch(845, 590, 28, 40), SEA1],
      [arch(355, 720, 28, 40), SEA1],
      [arch(845, 720, 28, 40), SEA1],
      [starD(486, 620, 32, 15), PINK],
      [starD(714, 620, 32, 15), PINK],
      [O(486, 724, 22), W],
      [O(714, 724, 22), W],

      // bucket and spade
      [spade(`M-11 -130L11 -130L11 200L-11 200Z`), WOOD],
      [spade(`M-50 -150C-58 -200 -56 -245 -48 -272Q0 -298 48 -272C56 -245 58 -200 50 -150Q0 -132 -50 -150Z`), Y],
      [spade(`M-22 -144L22 -144L11 -106L-11 -106Z`), AM],
      [`M945 660C960 540 1140 540 1155 660`, null],
      [`M960 660L1140 660L1115 850Q1050 870 985 850Z`, BLUE],
      [`M950 650H1150Q1160 665 1150 682H950Q940 665 950 650Z`, PINK],
      [starD(1050, 770, 52, 24), Y],

      // the crab
      [cr(`M-75 0L-115 20M-75 15L-109 46M-69 30L-97 68M75 0L115 20M75 15L109 46M69 30L97 68`), null],
      [cr(`M-55 -40C-85 -60 -95 -80 -105 -100M55 -40C85 -60 95 -80 105 -100`), null],
      [cr(`M-105 -100C-145 -110 -145 -160 -117 -172L-103 -140L-87 -174C-65 -160 -67 -110 -105 -100Z`), COR],
      [cr(`M105 -100C145 -110 145 -160 117 -172L103 -140L87 -174C65 -160 67 -110 105 -100Z`), COR],
      [cr(`M-25 -50L-25 -95M25 -50L25 -95`), null],
      [cr(oval(-25, -100, 20)), W],
      [cr(oval(25, -100, 20)), W],
      [cr(oval(-20, -97, 9)), DARK],
      [cr(oval(20, -97, 9)), DARK],
      [cr(oval(0, 0, 98, 66)), COR],
      [cr(`M-30 15Q0 45 30 15`), null],

      // shells and stars on the sand
      [starD(500, 846, 42, 21, 5, -1.2), AM],
      [`M805 886C760 874 722 840 730 808C735 786 755 782 765 792C775 768 800 765 812 780C825 765 850 770 858 792C870 782 890 790 890 812C895 844 850 878 805 886Z`, PINK],
      [`M805 886L765 792M805 886L812 780M805 886L858 792`, null],
      [`M56 600Q70 583 56 560A40 40 0 0 1 90.6 620Q63.5 620.7 56 600Z`, RED],
      [`M56 600Q63.5 620.7 90.6 620A40 40 0 0 1 21.4 620Q34.3 596.2 56 600Z`, W],
      [`M56 600Q34.3 596.2 21.4 620A40 40 0 0 1 56 560Q70 583 56 600Z`, Y],
      [starD(940, 864, 30, 15, 5, -1.9), RED],
    ],
  };
}

function autumn() {
  const SKYA = '#ffe6bb', HILL = '#e9c07f', GROUND = '#d8a35c', Y = '#ffd447', AM = '#ffa940', REDO = '#ec6a48', BRICK = '#d9513a';
  const FIR = '#2f8064', BARK = '#8a5a35', DEEP = '#5b3a1e', SPINE = '#9b6a43', CREAM = '#ffdfb3', W = '#ffffff', PINK = '#ffb4b4';
  const spikes = (cx, cy, rx, ry, n, len) => {
    let d = `M${cx - rx} ${cy + 46}`;
    for (let i = 0; i <= n * 2; i++) {
      const a = Math.PI + (i / (n * 2)) * Math.PI * 1.02;
      const k = i % 2 ? 1 + len : 1;
      d += `L${n1(cx + Math.cos(a) * rx * k)} ${n1(cy + Math.sin(a) * ry * k)}`;
    }
    return `${d}L${cx + rx} ${cy + 46}Q${cx} ${cy + 92} ${cx - rx} ${cy + 46}Z`;
  };
  return {
    id: 'nature-autumn', title: 'Осенний лес',
    shapes: [
      bg(SKYA),
      ...sun(575, 112, 58, Y, AM, 12),
      [cloudD(725, 110, 50), W],
      [`M-10 520C180 470 420 500 600 490C820 480 1020 460 1210 510V910H-10Z`, HILL],

      ...fir(462, 620, 130, 270, FIR, BARK),
      ...fir(800, 620, 150, 300, FIR, BARK),

      // left oak with a hollow
      [`M140 720C190 640 200 500 180 400L330 400C310 500 320 640 380 720Z`, BARK],
      [E(258, 520, 34, 50), DEEP],
      [O(246, 512, 8), Y], [O(272, 512, 8), Y],
      [blob(250, 245, 235, 195, 13, 0.24), AM],
      ...leaf('maple', 150, 235, 1.05, -0.4, Y),
      ...leaf('oak', 300, 165, 1, 0.5, REDO),
      ...leaf('oval', 340, 320, 1, 1.05, Y),
      ...leaf('maple', 215, 375, 0.85, 0.3, BRICK),

      // right maple
      [`M900 720C950 640 960 500 945 420L1075 420C1060 500 1070 640 1120 720Z`, BARK],
      [`M985 480c-14 20 -14 40 0 60M1040 560c14 20 14 40 0 60`, null],
      [blob(1010, 240, 205, 195, 13, 0.24), REDO],
      ...leaf('maple', 945, 215, 1.05, 0.3, Y),
      ...leaf('oak', 1090, 175, 0.95, -0.5, AM),
      ...leaf('oval', 1095, 335, 0.95, -0.9, Y),
      ...leaf('maple', 960, 375, 0.85, -0.3, AM),

      [`M-10 680C200 640 400 700 620 672C840 646 1030 690 1210 660V910H-10Z`, GROUND],

      // big falling leaves
      ...leaf('maple', 640, 350, 1.05, 0.5, AM),
      ...leaf('oval', 548, 300, 0.75, -1.2, REDO),
      ...leaf('oak', 730, 300, 0.75, 0.5, BRICK),
      ...leaf('oval', 690, 500, 0.9, 1.1, Y),
      ...leaf('maple', 880, 610, 0.8, -0.4, REDO),
      ...leaf('oak', 388, 628, 0.8, -0.8, REDO),
      ...leaf('oval', 90, 625, 0.8, 0.6, Y),
      ...leaf('maple', 1145, 610, 0.72, 0.8, AM),

      // the hedgehog
      [spikes(555, 770, 195, 138, 14, 0.16), SPINE],
      [`M450 720l26 -8l-10 24M620 700l26 -8l-10 24M480 790l26 -8l-10 24M580 780l26 -8l-10 24M410 770l26 -8l-10 24`, null],
      [`M522 594c4 -20 12 -30 22 -36`, null],
      [petal(530, 578, 56, 16, -0.3), FIR],
      [O(522, 648, 56), BRICK],
      [`M490 626q10 -16 24 -18`, null],
      [E(690, 852, 46, 26), SPINE],
      [E(470, 850, 46, 26), SPINE],
      [`M668 668C740 650 800 720 880 785C868 835 770 860 700 840C640 815 625 715 668 668Z`, CREAM],
      [E(688, 672, 28, 32), PINK],
      [O(884, 786, 22), DARK],
      [O(878, 778, 6), W],
      [O(775, 735, 15), DARK],
      [O(780, 729, 5), W],
      [`M806 816Q838 836 866 816`, null],
      [E(750, 790, 24, 16), PINK],

      // mushrooms
      ...mushroom(135, 850, 1.05, BRICK, W),
      ...mushroom(270, 870, 0.72, REDO, W),
      ...mushroom(1040, 840, 1, SPINE, null),
      ...mushroom(1140, 870, 0.7, AM, null),
      ...leaf('oak', 960, 866, 0.75, 1.3, AM),
      ...leaf('oval', 370, 866, 0.7, -1.3, REDO),
    ],
  };
}

function mountains() {
  const SKYM = '#bfe7ff', RED = '#ff6b6b', OR = '#ffb340', Y = '#ffd447', RB_G = '#6fd66f', BLUE = '#58b0f0', PUR = '#b58cff';
  const W = '#ffffff', M1 = '#9db4e0', M2 = '#c3d0ee', ROCK = '#b39a84', WATER = '#7fd1ff', FIR = '#2f8f65', FIR2 = '#58b98a', WOOD = '#a9744a';
  const r = (R1, c) => [`M${610 - R1} 640A${R1} ${R1} 0 0 1 ${610 + R1} 640H${610 + R1 - 36}A${R1 - 36} ${R1 - 36} 0 0 0 ${610 - R1 + 36} 640Z`, c];
  const duck = (x, y, s, f) => {
    const t = at(x, y, s, 0, f);
    return [
      [t(oval(55, -72, 36)), Y],
      [t('M-92 -48C-72 -36 -60 -40 -45 -46C-20 -56 18 -56 40 -42C70 -42 88 -22 78 0C62 26 -52 28 -72 0C-82 -15 -88 -30 -92 -48Z'), Y],
      [t('M-44 -22C-22 -44 18 -40 30 -18C10 2 -26 8 -44 -22Z'), W],
      [t('M88 -82L128 -68L88 -56Z'), OR],
      [t(oval(66, -82, 9)), DARK],
    ];
  };
  return {
    id: 'nature-mountains', title: 'Водопад и радуга',
    shapes: [
      bg(SKYM),
      r(560, RED), r(524, OR), r(488, Y), r(452, RB_G), r(416, BLUE), r(380, PUR),
      [cloudD(120, 130, 76), W],
      ...sun(1104, 102, 52, Y, OR, 12),
      ...flyBird(606, 374, 0.48, 1, W, M1, OR),

      ...mountain(190, 290, -300, 640, 780, M1),
      ...mountain(1030, 260, 590, 1500, 780, M1),
      ...mountain(420, 430, 150, 680, 780, M2, 0.26),

      // the cliff and the river behind the edge
      [`M350 800L385 690L372 640L415 560L470 500L540 458L620 446L700 462L770 490L835 560L850 640L880 700L905 800Z`, ROCK],
      [`M545 458C565 438 600 418 636 404L664 408C680 426 690 446 695 464C650 452 590 452 545 458Z`, WATER],
      [`M430 610L482 650L462 720M800 590L760 660L790 730M450 530L510 548`, null],

      // the waterfall in three streams
      [`M545 458C560 455 580 454 595 455C600 560 582 660 584 770H520C534 660 552 560 545 458Z`, WATER],
      [`M595 455C620 454 640 455 655 458C652 560 670 660 668 770H584C582 660 600 560 595 455Z`, SKYM],
      [`M655 458C670 460 685 462 695 464C690 560 716 660 736 770H668C670 660 652 560 655 458Z`, WATER],
      [`M568 510c6 20 -6 40 0 60M625 490c6 24 -6 50 0 74M676 520c-6 20 6 40 0 60M558 630c6 24 -6 50 0 70M626 620c6 26 -6 54 0 84M694 640c-6 24 6 50 0 70`, null],

      // lake and foam
      [`M-10 730C200 700 420 760 620 740C840 720 1020 760 1210 725V910H-10Z`, BLUE],
      [`M470 790C440 750 490 720 520 735C530 695 600 690 625 720C650 690 720 695 735 735C770 720 815 750 785 790C760 806 700 798 680 802C640 816 590 812 560 802C530 797 490 806 470 790Z`, W],
      [`M60 806q30 -14 60 0q30 14 60 0M955 800q24 -12 48 0q24 12 48 0`, null],
      [`M318 760C330 728 388 728 402 760C388 776 332 776 318 760Z`, ROCK],
      [`M842 748C856 722 904 722 916 748C904 762 854 762 842 748Z`, ROCK],

      ...fish(366, 816, 52, OR, RED, -1),
      [`M290 858q-22 -18 -14 -40M442 858q22 -18 14 -40`, null],

      ...duck(686, 872, 0.8, -1),
      ...duck(822, 858, 0.42, -1),
      ...duck(905, 838, 0.42, -1),

      ...fir(90, 760, 210, 400, FIR, WOOD),
      ...fir(1110, 760, 210, 420, FIR, WOOD),
      ...fir(240, 790, 130, 230, FIR2, WOOD),
      ...fir(980, 770, 130, 240, FIR2, WOOD),

      [`M-10 846C120 806 240 840 300 880C330 900 400 915 470 915H-10Z`, GRASS],
      [`M1215 840C1080 812 960 850 900 915H1215Z`, GRASS],
      ...flower(100, 866, 30, RED),
      ...flower(205, 860, 26, PUR),
      ...flower(1090, 862, 32, PUR),
      ...flower(990, 878, 24, RED),
    ],
  };
}

function bees() {
  const SKYB = '#cdf0ff', W = '#ffffff', HILL = '#b9e58e', Y = '#ffd447', AM = '#ffb340', POT = '#ffe08a', BROWN = '#6a4524';
  const WOOD = '#c98a55', BLUE = '#7fd1ff', PINK = '#ff8fb5', PUR = '#b58cff', COR = '#ff8f5c', RED = '#ff6b6b';
  const skep = (cx, base, s) => {
    const t = at(cx, base, s);
    const rows = [[-212, 66], [-200, 66], [-178, 66], [-140, 66], [-92, 62]];
    const out = [];
    rows.forEach(([w, h], i) => {
      const y = -66 * i - h;
      const rr = h / 2;
      out.push([t(`M${w + rr} ${y}L${-w - rr} ${y}C${-w + 4} ${y} ${-w + 4} ${y + h} ${-w - rr} ${y + h}L${w + rr} ${y + h}C${w - 4} ${y + h} ${w - 4} ${y} ${w + rr} ${y}Z`), i % 2 ? POT : AM]);
    });
    out.push([t(`M-50 -2C-50 -96 50 -96 50 -2Z`), BROWN]);
    return out;
  };
  return {
    id: 'nature-bees', title: 'Пчёлки и ульи',
    shapes: [
      bg(SKYB),
      ...sun(1075, 125, 66, Y, AM, 14),
      [cloudD(210, 120, 90), W],
      [cloudD(760, 100, 56), W],
      [`M-10 460C200 400 430 430 640 480C840 520 1020 410 1210 450V910H-10Z`, HILL],
      [`M-10 590C220 550 430 590 640 584C860 578 1040 540 1210 580V910H-10Z`, GRASS],

      // small hive far away
      ...skep(600, 560, 0.5),

      // big straw hive on a stand
      [R(90, 660, 34, 130), WOOD],
      [R(430, 660, 34, 130), WOOD],
      [R(60, 640, 440, 36, 8), WOOD],
      ...skep(278, 640, 1),

      // wooden hive
      [R(760, 680, 34, 130), WOOD],
      [R(1020, 680, 34, 130), WOOD],
      [R(740, 640, 340, 50, 8), WOOD],
      [R(770, 540, 280, 106), BLUE],
      [R(770, 440, 280, 106), PINK],
      [R(770, 340, 280, 106), PUR],
      [`M730 346L910 240L1090 346Z`, COR],
      [R(860, 610, 100, 26, 10), BROWN],
      [heartD(910, 392, 30), Y],
      [O(910, 495, 30), Y],

      // honey pot
      [`M520 790C470 800 460 880 520 890H700C760 880 750 800 700 790Z`, POT],
      [`M540 790C545 830 570 830 575 800C585 850 610 850 618 800C626 824 650 824 660 790Z`, AM],
      [R(500, 760, 220, 40, 14), COR],

      ...flower(170, 838, 52, PINK),
      ...flower(370, 848, 44, W),
      ...flower(860, 842, 48, PUR),
      ...flower(1096, 836, 52, RED),
      [`M428 872l-8 -34M440 872l4 -38M452 872l14 -30M762 880l-8 -34M774 880l4 -38M786 880l14 -30M960 880l-8 -34M972 880l4 -38M984 880l14 -30`, null],

      ...bee(560, 296, 1.4, -0.06),
      ...bee(100, 326, 0.74, 0.08, -1),
      ...bee(1128, 300, 0.58, 0.1, -1),
      ...bee(622, 690, 0.66, 0.05),
      trail(440, 340, 428, 384, 445, 430, 500, 440, 7),
      trail(170, 318, 206, 290, 214, 250, 188, 218, 5),
      trail(554, 702, 535, 732, 505, 728, 514, 690, 4),
    ],
  };
}

export default [winter(), spring(), summer(), autumn(), mountains(), bees()];
