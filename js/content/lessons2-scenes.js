// The last chapter: whole pictures with a foreground, a main subject and a background.
// Nothing is filled in, so every line that runs behind something is cut where it hides. Canvas is 1000×750.
import { O, E, R, S, starD } from '../art.js';

const r1 = n => Math.round(n * 10) / 10;
const xy = p => `${r1(p[0])} ${r1(p[1])}`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const line = (...pts) => pts.map((p, i) => (i ? 'L' : 'M') + xy(p)).join('');

// A point on a cubic curve, as [x, y].
const on = (c, t) => [0, 1].map(k => (1 - t) ** 3 * c[0][k] + 3 * (1 - t) ** 2 * t * c[1][k] + 3 * (1 - t) * t * t * c[2][k] + t ** 3 * c[3][k]);
const curve = (...cs) => cs.map((c, i) => `${i ? '' : `M${xy(c[0])}`}C${xy(c[1])} ${xy(c[2])} ${xy(c[3])}`).join('');
// A chain of joined curves: a start point, then three points for every next piece.
const chain = (start, ...rest) => rest.map((c, i) => [i ? rest[i - 1][2] : start, ...c]);
// The same curves seen in a mirror at x = ax.
const flip = (cs, ax) => cs.map(c => c.map(([x, y]) => [2 * ax - x, y]));
// A one-bend curve written as a cubic, so the tools below work on it too.
const quad = (a, q, b) => [a, mix(a, q, 2 / 3), mix(b, q, 2 / 3), b];

// The piece of a curve between two of its points.
function piece(c, t0, t1) {
  const cut = (q, t) => {
    const ab = mix(q[0], q[1], t), bc = mix(q[1], q[2], t), cd = mix(q[2], q[3], t);
    const abc = mix(ab, bc, t), bcd = mix(bc, cd, t), m = mix(abc, bcd, t);
    return [[q[0], ab, abc, m], [m, bcd, cd, q[3]]];
  };
  const rest = t0 > 0 ? cut(c, t0)[1] : c;
  return t1 < 1 ? cut(rest, (t1 - t0) / (1 - t0))[0] : rest;
}

// Where along a curve a test first changes its answer (the test is false at the start).
function first(c, test) {
  for (let i = 1; i <= 200; i++) {
    if (!test(on(c, i / 200))) continue;
    let lo = (i - 1) / 200, hi = i / 200;
    for (let k = 0; k < 20; k++) {
      const m = (lo + hi) / 2;
      if (test(on(c, m))) hi = m; else lo = m;
    }
    return hi;
  }
  return 1;
}
// Where a curve reaches a height y, and the x it has there.
const atY = (c, y) => first(c, p => (p[1] - y) * (on(c, 0)[1] - y) <= 0);
const xAtY = (c, y) => on(c, atY(c, y))[0];

// A closed shape as a ring of points, and a test for a point lying inside it.
const ring = cs => cs.flatMap(c => Array.from({ length: 30 }, (_, i) => on(c, i / 30)));
const inside = (p, poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < a[0] + ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1])) hit = !hit;
  }
  return hit;
};
// The part of a curve that stays in sight until it goes behind a closed shape.
const until = (c, poly) => piece(c, 0, first(c, p => inside(p, poly)));

// A row of soft bumps from one point to another; sag pushes them down the sheet.
function bumps(a, b, n, sag) {
  let d = `M${xy(a)}`;
  for (let i = 0; i < n; i++) {
    const p = mix(a, b, i / n), q = mix(a, b, (i + 1) / n);
    d += `Q${xy([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + sag])} ${xy(q)}`;
  }
  return d;
}
// A short ripple on water: n little waves, each w wide and h high.
const ripple = (x, y, w, n, h) => `M${x} ${y}q${w / 2} ${-h} ${w} 0${`t${w} 0`.repeat(n - 1)}`;
// A tuft of grass: three blades from one spot, the outer two lean away.
const tuft = (x, y, s = 1) => `M${x} ${y}l${r1(-7 * s)} ${r1(-22 * s)}l${r1(17 * s)} ${r1(22 * s)}l${r1(6 * s)} ${r1(-37 * s)}l${r1(6 * s)} ${r1(37 * s)}l${r1(17 * s)} ${r1(-22 * s)}l${r1(-7 * s)} ${r1(22 * s)}`;
// A pointed leaf from its stalk to its tip, w wide on each side.
function leaf(a, b, w) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = ((b[1] - a[1]) / len) * w * 2, ny = (-(b[0] - a[0]) / len) * w * 2, m = mix(a, b, 0.45);
  return `M${xy(a)}Q${xy([m[0] + nx, m[1] + ny])} ${xy(b)}Q${xy([m[0] - nx, m[1] - ny])} ${xy(a)}Z`;
}
// A snowflake: three strokes through one point.
const flake = (x, y, r) => [0, 60, 120].map(a => { const c = Math.cos((a * Math.PI) / 180) * r, q = Math.sin((a * Math.PI) / 180) * r; return `M${r1(x - c)} ${r1(y - q)}L${r1(x + c)} ${r1(y + q)}`; }).join('');

// A fir tree: the top, then [bottom y, half width] for every tier. Boughs sag, the last tier ends in a fringe.
// Gives the outline and a way to find a point on the edge of a tier (for snow and for lines that hide behind).
function fir(cx, top, tiers, tuck = 0.42) {
  const segs = [];
  const sides = [];
  let a = [cx, top];
  tiers.forEach(([y, w], i) => {
    const tip = [cx - w, y];
    const c = [a[0] + (tip[0] - a[0]) * 0.3, a[1] + (tip[1] - a[1]) * 0.72];
    segs.push([a, c, tip]);
    sides.push(quad(a, c, tip));
    if (i < tiers.length - 1) {
      const inn = [cx - w * tuck, y - 5];
      segs.push([tip, [(tip[0] + inn[0]) / 2, y + 7], inn]);
      a = inn;
    }
  });
  const m = ([x, y]) => [2 * cx - x, y];
  const [yb, wb] = tiers[tiers.length - 1];
  const left = segs.map(s => `Q${xy(s[1])} ${xy(s[2])}`).join('');
  const right = [...segs].reverse().map(s => `Q${xy(m(s[1]))} ${xy(m(s[0]))}`).join('');
  const d = `M${xy([cx, top])}${left}${bumps([cx - wb, yb], [cx + wb, yb], Math.max(3, Math.round(wb / 28)), 11).replace(/^M[^Q]+/, '')}${right}Z`;
  const edge = (i, t, rightSide) => (rightSide ? m(on(sides[i], t)) : on(sides[i], t));
  // A wavy cap of snow lying across a tier.
  const snow = (i, t, n, sag = 9) => bumps(edge(i, t), edge(i, t, true), n, sag);
  return { d, edge, snow, sides };
}

// A soft tube around a chain of curves, open at the start and round at the tip: a tail.
function tube(cs, w, n = 8) {
  const pts = [];
  cs.forEach((c, k) => { for (let i = k ? 1 : 0; i <= n; i++) pts.push(on(c, i / n)); });
  const L = [], Rt = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (b[1] - a[1]) / len, ny = -(b[0] - a[0]) / len;
    L.push([p[0] + nx * w, p[1] + ny * w]);
    Rt.push([p[0] - nx * w, p[1] - ny * w]);
  });
  const smooth = q => q.slice(1, -1).map((p, i) => `Q${xy(p)} ${xy(mix(p, q[i + 2], 0.5))}`).join('') + `L${xy(q[q.length - 1])}`;
  const back = [...Rt].reverse();
  const d = `M${xy(L[0])}L${xy(mix(L[0], L[1], 0.5))}${smooth(L)}A${w} ${w} 0 0 1 ${xy(back[0])}L${xy(mix(back[0], back[1], 0.5))}${smooth(back)}`;
  // Where a side of the tube crosses a height y.
  const cross = (side, y) => {
    for (let i = 1; i < side.length; i++) {
      const p = side[i - 1], q = side[i];
      if ((p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1]) return p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]);
    }
    return side[0][0];
  };
  return { d, L, Rt, cross };
}

// ---------- 1. The house by the lake ----------
const lake = (() => {
  // The side wall runs away to a far point on the horizon.
  const VP = [2400, 350];
  const far = (p, x) => [x, p[1] + ((VP[1] - p[1]) * (x - p[0])) / (VP[0] - p[0])];
  const apex = [295, 300], eaveR = [390, 410], corner = [375, 560];
  const ridgeEnd = far(apex, 485), eaveEnd = far(eaveR, 575);
  const wallTop = far(eaveR, 555), wallFoot = far(corner, 555);
  const top = x => far([375, 448], x), bot = x => far([375, 506], x);
  const win = (x0, x1) => [
    `${line(top(x0), top(x1), bot(x1), bot(x0))}Z`,
    line(mix(top(x0), top(x1), 0.5), mix(bot(x0), bot(x1), 0.5)),
    line(mix(top(x0), bot(x0), 0.5), mix(top(x1), bot(x1), 0.5)),
  ];
  // Mountains: the big one in front, two more peeping out from behind it.
  const bigL = quad([625, 350], [705, 238], [800, 95]), bigR = quad([800, 95], [882, 200], [970, 322]);
  const join = on(bigL, 0.42), peep = on(bigR, 0.5);
  const leftUp = quad(far(apex, 455), [527, 232], [605, 140]), leftDown = quad([605, 140], [649, 197], join);
  const tree = fir(102, 262, [[345, 44], [437, 62], [532, 76]]);
  // The pier starts on the bank and runs out over the water, so the bank line breaks under its boards.
  const nearL = [610, 514], nearR = [676, 552], farL = [770, 430], farR = [822, 452], thick = 22;
  const shoreA = [[555, 500], [575, 500], [594, 506], nearL];
  const shoreB = chain([nearR[0], nearR[1] + thick], [[716, 592], [760, 600], [800, 604]], [[870, 612], [930, 622], [970, 624]]);
  const plank = t => line(mix(nearL, farL, t), mix(nearR, farR, t));
  // A post stands in the water in front of the boards and sticks up a little above them.
  const pile = (t, len) => { const p = mix(nearR, farR, t); return `M${xy([p[0], p[1] - 14])}V${r1(p[1] + thick + len)}`; };
  return {
    horizon: ['M526 350H970', curve(shoreA), curve(...shoreB)],
    front: ['M215 392.6V560H375V392.6', 'M200 410L295 300L390 410'],
    side: [line(apex, ridgeEnd, eaveEnd), line(eaveR, eaveEnd), line(wallTop, wallFoot, corner)],
    door: ['M264 560V480C264 440 326 440 326 480V560', O(313, 522, 6), O(295, 372, 19),
      'M385 342V266H421V342Z', R(378, 252, 50, 14, 4), 'M403 238C378 216 428 198 402 170C384 150 414 134 400 110'],
    windows: [...win(400, 455), ...win(480, 532)],
    mountains: [
      `${curve(leftUp)}${curve(leftDown).replace(/^M[^C]+/, '')}`,
      `${curve(bigL)}${curve(bigR).replace(/^M[^C]+/, '')}`,
      `M${xy(peep)}L924 176Q952 212 970 250`,
      line(on(leftUp, 0.68), [577, 182], [598, 206], [621, 180], on(leftDown, 0.5)),
      line(on(bigL, 0.72), [770, 152], [790, 181], [812, 152], [830, 179], on(bigR, 0.3)),
      O(150, 115, 46), 'M238 96Q256 78 272 96Q288 78 306 96', 'M300 158Q313 145 324 158Q335 145 348 158',
    ],
    firs: [tree.d, 'M90 532V590H114V532', 'M546 350L563 312L580 350L598 320L616 350', 'M842 350L857 320L872 350L889 306L906 350L921 324L936 350'],
    path: ['M264 560C246 612 322 650 284 722', 'M326 560C338 602 478 640 446 722', tuft(140, 668, 1.2), tuft(512, 640, 1.1), tuft(590, 712, 1.3)],
    pier: [`${line(nearL, farL, farR, nearR)}Z`, `M${xy(nearR)}v${thick}L${xy([farR[0], farR[1] + thick])}`,
      plank(0.2), plank(0.5), plank(0.78), pile(0.34, 30), pile(0.67, 26), pile(1, 22),
      ripple(585, 392, 22, 2, 8), ripple(866, 408, 26, 2, 9)],
    reeds: ['M872 722C870 664 866 620 864 586', E(863, 558, 10, 27), 'M908 722C908 650 912 596 914 556', E(915, 528, 10, 27),
      'M944 722C944 680 946 640 948 612', E(949, 584, 10, 27), 'M888 722C884 684 868 664 846 656', 'M926 722C930 694 944 676 964 672', ripple(858, 476, 30, 3, 11)],
  };
})();

// ---------- 2. The still life ----------
// A tulip bud standing on the end of its stem and leaning by some degrees.
function tulip(x, y, s, deg) {
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const P = (u, v) => xy([x + (u * ca + v * sa) * s, y + (u * sa - v * ca) * s]);
  return [
    `M${P(-0.42, 1)}C${P(-0.68, 0.64)} ${P(-0.56, 0)} ${P(0, 0)}C${P(0.56, 0)} ${P(0.68, 0.64)} ${P(0.42, 1)}L${P(0.21, 0.78)}L${P(0, 1.08)}L${P(-0.21, 0.78)}Z`,
    `M${P(-0.21, 0.78)}C${P(-0.27, 0.5)} ${P(-0.15, 0.24)} ${P(0, 0.1)}`,
    `M${P(0.21, 0.78)}C${P(0.27, 0.5)} ${P(0.15, 0.24)} ${P(0, 0.1)}`,
  ];
}
const still = (() => {
  const apple = chain([470, 526], [[500, 498], [558, 512], [556, 572]], [[554, 625], [510, 652], [470, 640]],
    [[430, 652], [386, 625], [384, 572]], [[382, 512], [440, 498], [470, 526]]);
  const pear = chain([684, 398], [[706, 398], [716, 420], [718, 450]], [[722, 500], [768, 520], [764, 570]], [[762, 612], [722, 622], [690, 620]],
    [[655, 622], [615, 612], [614, 568]], [[612, 520], [652, 500], [656, 450]], [[658, 420], [664, 398], [684, 398]]);
  const appleRing = ring(apple);
  const vaseR = chain([408, 252], [[400, 285], [380, 297], [380, 325]], [[380, 365], [462, 385], [462, 455]], [[462, 515], [420, 545], [408, 564]]);
  const vaseL = flip(vaseR, 350);
  const foot = quad([292, 564], [350, 600], [408, 564]);
  // A band that runs round the belly of the vase at a height y.
  const band = (y, sag) => { const x = xAtY(vaseR[1], y); return `M${xy([700 - x, y])}Q350 ${y + sag} ${xy([x, y])}`; };
  const edgeY = 440;
  const stemC = [[350, 254], [348, 215], [354, 180], [352, 136]];
  const stemL = [[338, 254], [332, 225], [251, 226], [232, 185]], stemR = [[362, 254], [370, 225], [450, 220], [470, 180]];
  return {
    apple: [`${curve(...apple)}Z`, 'M470 530C468 510 476 492 490 480', 'M477 506C492 478 528 470 548 480C540 506 506 518 477 506Z',
      'M534 570C532 548 522 532 506 524'],
    pear: [`${curve(...pear)}Z`, 'M686 398C684 380 690 366 702 356', 'M690 382C668 360 636 364 620 380C640 400 672 400 690 382Z',
      'M738 568C740 546 732 524 722 510'],
    vase: [curve(...vaseL), curve(vaseR[0], vaseR[1], until(vaseR[2], appleRing)), curve(until(foot, appleRing))],
    pattern: [E(350, 252, 58, 15), band(400, 30), band(468, 34),
      'M266 440L287 420L308 449L329 426L350 453L371 426L392 449L413 420L434 440'],
    stems: [curve(stemC), curve(stemL), curve(stemR), leaf(on(stemL, 0.5), [204, 268], 13), leaf(on(stemR, 0.5), [506, 258], 13)],
    tulips: [...tulip(352, 136, 96, 0), ...tulip(232, 185, 92, -25), ...tulip(470, 180, 92, 27)],
    table: [`M30 ${edgeY}H${r1(700 - xAtY(vaseR[1], edgeY))}`, `M${r1(xAtY(vaseR[1], edgeY))} ${edgeY}H${r1(xAtY(pear[5], edgeY))}`,
      `M${r1(xAtY(pear[0], edgeY))} ${edgeY}H970`, 'M30 695H970'],
    shadows: ['M236 570H288', 'M196 583H306', 'M226 596H318', 'M340 622H396', 'M306 635H412', 'M334 649H422',
      'M588 600H618', 'M572 611H630', 'M590 623H640'],
    curtain: ['M730 30C744 150 818 250 898 294', 'M822 30C836 140 874 236 912 290', 'M905 30C912 130 924 226 930 288',
      'M968 30C970 120 964 220 952 292', E(926, 305, 32, 13), 'M900 318C890 360 896 400 890 440', 'M928 320C924 360 930 400 926 440'],
  };
})();

// ---------- 3. The lighthouse ----------
const light = (() => {
  const left = y => 626 + (32 * (570 - y)) / 370, right = y => 1400 - left(y);
  const stripe = (y, rise) => `M${r1(left(y))} ${y}Q700 ${y - rise * 2} ${r1(right(y))} ${y}`;
  const H = 400;
  return {
    horizon: [`M30 ${H}H${r1(left(H))}`, `M${r1(right(H))} ${H}H970`],
    tower: ['M626 570L658 200', 'M774 570L742 200', 'M626 570Q700 594 774 570'],
    lamp: ['M636 200V182Q700 170 764 182V200Q700 188 636 200Z', 'M640 180V156H668', 'M732 156H760V180',
      'M668 176V118H732V176', 'M690 118V175', 'M710 118V175', 'M658 118C664 78 736 78 742 118Z', 'M700 88V70', O(700, 60, 9)],
    stripes: [stripe(285, 7), stripe(372, 3), stripe(468, -6), 'M687 345V318a13 13 0 0 1 26 0V345Z', 'M678 580V530a22 22 0 0 1 44 0V580'],
    cliff: ['M626 570L592 580L574 612L548 622L540 668L514 682L504 722', 'M774 570L820 566L862 548H970',
      'M574 612L608 648L596 716', 'M540 668L566 694', 'M660 579L682 648L664 716', 'M774 570L760 640L782 716', 'M862 548L882 622L864 704',
      tuft(906, 548, 1.1)],
    boat: ['M188 560C208 600 240 612 290 612H360C400 612 420 592 432 560Z', 'M201 580C260 588 370 588 423 580', 'M300 560V420',
      'M310 440C352 470 388 510 406 546H310Z', 'M290 452C264 490 234 522 210 546H290Z', 'M300 420L332 430L300 442'],
    waves: [ripple(40, 692, 70, 4, 30), ripple(300, 655, 58, 3, 24), ripple(52, 520, 40, 2, 15), ripple(455, 505, 40, 2, 15),
      ripple(430, 430, 24, 2, 8), ripple(520, 468, 30, 2, 10), 'M120 606C142 592 166 594 186 606', 'M434 606C454 594 478 592 500 606'],
    sky: ['M70 400A60 60 0 0 1 190 400', 'M96 420H164', 'M112 438H148',
      'M246 196C222 196 218 164 244 158C248 124 298 118 314 146C336 120 388 130 386 162C412 162 414 196 390 196Z',
      'M440 262Q458 244 474 262Q490 244 508 262', 'M520 318Q534 304 546 318Q558 304 572 318', 'M150 250Q164 236 176 250Q188 236 202 250'],
    rays: ['M618 125L470 86', 'M618 169L470 208', 'M782 125L930 86', 'M782 169L930 208'],
  };
})();

// ---------- 4. The winter forest ----------
const winter = (() => {
  // The hare sits in profile and looks to the left.
  const back = chain([642, 458], [[704, 468], [768, 535], [768, 612]], [[768, 652], [748, 682], [716, 692]]);
  const chest = [[590, 498], [562, 526], [554, 590], [558, 640]];
  const earEdge = [[644, 310], [664, 340], [656, 388], [626, 418]];
  const tailA = on(back[0], 0.82), tailB = on(back[1], 0.32);
  const big = fir(200, 60, [[185, 66], [305, 100], [435, 134], [578, 166]]);
  const small = fir(868, 150, [[238, 46], [328, 68], [428, 90]]);
  // The far edge of the snow: it dives behind both firs.
  const farA = big.edge(2, 0.3), farB = big.edge(2, 0.3, true), farC = small.edge(1, 0.72), farD = small.edge(1, 0.72, true);
  const farMid = chain(farB, [[330, 288], [410, 322], [500, 298]], [[580, 276], [660, 252], [740, 270]], [[772, 277], [795, 290], farC]);
  const baby = (c, t0, t1, h) => { const a = on(c, t0), b = on(c, t1); return line(a, [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - h], b); };
  const drift = on(chest, 0.42), driftR = on(back[1], 0.45);
  const prints = [[446, 350, 7], [418, 400, 8], [432, 452, 10], [392, 506, 12], [426, 550, 13], [440, 640, 15], [502, 676, 16]];
  return {
    hare: ['M590 410C558 404 526 430 518 460C514 480 526 496 546 500C562 503 578 503 590 498', curve(...back),
      `${curve(chest)}C559 654 558 668 554 680`, 'M626 418C636 430 642 444 642 458'],
    ears: [`M590 410C584 366 606 326 644 310${curve(earEdge).replace(/^M[^C]+/, '')}`, `M${xy(on(earEdge, 0.36))}C672 336 690 330 706 330C712 362 694 404 646 438`,
      'M608 400C604 372 616 344 634 332',
      `M${xy(tailA)}C792 572 808 596 804 622C800 646 780 658 ${xy(tailB)}`,
      'M554 680C550 696 568 697 586 697C604 697 610 687 606 673C602 648 608 626 618 606',
      'M650 570C704 554 748 600 738 652C734 672 716 686 690 681', 'M716 692H646C622 692 622 666 646 664C664 662 676 672 690 681'],
    face: [O(568, 450, 10), 'M521 470C530 482 544 484 553 475', 'M516 463L466 450', 'M515 472L462 476', 'M519 482L470 500',
      'M590 536L580 554', 'M602 562L594 580', 'M580 572L572 590'],
    bigFir: [big.d, 'M186 588V634H214V588'],
    bigSnow: [big.snow(0, 0.62, 3), big.snow(1, 0.6, 4), big.snow(2, 0.6, 5), big.snow(3, 0.6, 6)],
    smallFir: [small.d, 'M857 438V474', 'M879 438V474', small.snow(0, 0.62, 2, 7), small.snow(1, 0.55, 3, 7), small.snow(2, 0.58, 4, 7),
      'M772 492Q868 456 968 490'],
    drifts: [`M30 352C60 338 100 340 ${xy(farA)}`, curve(...farMid), `M${xy(farD)}C935 296 955 304 970 312`,
      baby(farMid[0], 0.42, 0.58, 46), baby(farMid[0], 0.62, 0.75, 36), baby(farMid[1], 0.08, 0.22, 42),
      'M30 612C80 598 140 626 186 634', `M214 634C320 596 450 610 ${xy(drift)}`, `M${xy(driftR)}C810 660 900 610 970 596`],
    prints: [...prints.map(([x, y, r]) => E(x, y, r, r * 0.62)), 'M520 708C600 722 720 722 796 704', 'M30 700C130 672 270 708 400 712'],
    flakes: [flake(90, 96, 17), O(340, 84, 7), flake(430, 176, 15), O(520, 96, 7), flake(610, 190, 17), O(700, 112, 7), flake(772, 200, 14), O(940, 96, 7), O(60, 240, 7)],
  };
})();

// ---------- 5. The cat on the windowsill ----------
const cat = (() => {
  const bodyL = [[642, 460], [600, 490], [578, 560], [584, 610]], bodyR = flip([bodyL], 676)[0];
  const tail = tube(chain([742, 610], [[742, 648], [744, 672], [760, 686]], [[774, 698], [796, 698], [806, 680]]), 13);
  const top = 610, low = 646, glass = 595;
  const curtain = [
    'M38 46V590', 'M118 46C122 180 112 330 82 424', 'M82 446C102 480 112 540 116 590',
    'M38 422C52 431 68 431 82 422V446C68 455 52 455 38 446', bumps([38, 590], [116, 590], 3, 13),
    'M76 48C78 180 72 320 60 426', 'M60 452C64 500 72 550 77 590',
  ];
  const twin = d => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (m, x, y) => `${1000 - x} ${y}`);
  return {
    body: ['M642 460C612 448 604 410 624 386L628 324L658 366C670 362 682 362 694 366L724 324L728 386C748 410 740 448 710 460',
      curve(bodyL), curve(bodyR)],
    fur: ['M612 426L560 416', 'M612 438L558 442', 'M740 426L792 416', 'M740 438L794 442',
      'M666 374L668 394', 'M686 374L684 394', 'M648 500Q676 516 704 500', 'M638 536Q676 554 714 536', 'M634 572Q676 592 718 572'],
    sill: [`M${r1(tail.cross(tail.L, top))} ${top}H60V${low}H${r1(tail.cross(tail.L, low))}`,
      `M${r1(tail.cross(tail.Rt, top))} ${top}H940V${low}H${r1(tail.cross(tail.Rt, low))}`,
      tail.d, line(tail.L[5], tail.Rt[5]), line(tail.L[10], tail.Rt[10])],
    pot: [R(182, 536, 96, 18, 4), 'M192 554L203 610', 'M268 554L257 610', 'M212 536V478C212 452 248 452 248 478V536',
      'M248 518C276 520 284 502 282 480C280 466 264 466 264 480C264 492 258 498 248 498', 'M230 468V534', O(230, 444, 9)],
    frame: ['M140 610V58H860V610', R(162, 80, 324, 205), R(514, 80, 324, 205),
      'M200 595H162V315H486V595H260', `M${r1(xAtY(bodyL, glass))} ${glass}H514V315H838V${glass}H${r1(xAtY(bodyR, glass))}`],
    night: ['M313.6 125.7A56 56 0 1 0 346.5 211.2A46 46 0 1 1 313.6 125.7Z', starD(432, 140, 30), starD(216, 126, 24),
      starD(604, 160, 32), starD(770, 140, 24), starD(700, 232, 22), starD(262, 384, 26), starD(404, 386, 30), starD(796, 366, 24)],
    town: ['M267 560H292V532L316 510L340 532V548H356V496H400V548H416V522L434 494L452 522V560H486',
      `M514 560H532V532L553 512L574 532V560H${r1(xAtY(bodyL, 560))}`, `M${r1(xAtY(bodyR, 560))} 560H794V522H838`,
      R(367, 510, 22, 24), R(806, 536, 20, 22)],
    left: ['M46 34H954', O(36, 34, 9), O(964, 34, 9), ...curtain],
    right: curtain.map(twin),
  };
})();

export default [
  { id: 'scene-lake-house', title: 'Домик у озера', steps: [
    S('Горизонт — чуть выше середины листа. Берег ближе, он ниже. В нём оставь разрыв для причала.', ...lake.horizon),
    S('Дом — главный, но стоит левее центра. Начни с передней стены и двух скатов крыши.', ...lake.front),
    S('Боковая стена уходит вдаль: её низ чуть поднимается к горизонту, а конёк опускается.', ...lake.side),
    S('Дверь — посередине стены, круглое окошко — под коньком. Труба стоит ровно, дым вьётся.', ...lake.door),
    S('Окна на боковой стене — на одной высоте. Дальнее чуть уже и меньше ближнего.', ...lake.windows),
    S('Горы далеко: они прячутся за крышей и друг за другом. Солнце и птицы — в свободном небе.', ...lake.mountains),
    S('Ёлка у дома высокая, а ёлочки на том берегу крошечные: чем дальше, тем меньше.', ...lake.firs),
    S('Тропинка от двери бежит к нам и расширяется. Вблизи видны даже травинки.', ...lake.path),
    S('Причал уходит от берега в озеро и сужается. Ближний столбик выше дальнего, рябь вдали мельче.', ...lake.pier),
    S('Камыши — передний план: они ниже всех на листе и самые крупные. Картина готова!', ...lake.reeds),
  ] },

  { id: 'scene-still-life', title: 'Натюрморт: ваза и фрукты', steps: [
    S('Начни с ближнего: яблоко ниже всех на листе. Сверху ямка, от неё — хвостик и листок.', ...still.apple),
    S('Груша чуть дальше: её низ выше, чем у яблока. Внизу она широкая, к хвостику сужается.', ...still.pear),
    S('Ваза — главная и самая высокая. Она левее центра, а её бок прячется за яблоком.', ...still.vase),
    S('Горлышко — узкий овал. Узор огибает вазу дугой, как улыбка: так видно, что она круглая.', ...still.pattern),
    S('Стебли расходятся из вазы веером: средний прямой, боковые клонятся. Листья длинные.', ...still.stems),
    S('Тюльпаны на разной высоте, самый высокий — посередине. Бутон — чашечка с тремя зубцами.', ...still.tulips),
    S('Дальний край стола — как горизонт: он прячется за вазой и грушей. Ближний край — внизу.', ...still.table),
    S('Свет справа, значит тени лежат слева. Штрихуй их лежачими линиями: средняя длиннее.', ...still.shadows),
    S('Фон — штора справа: она уравновешивает вазу слева. Складки сходятся к завязке.', ...still.curtain),
  ] },

  { id: 'scene-lighthouse-sea', title: 'Маяк, море и лодка', steps: [
    S('Горизонт моря — ровная линия чуть ниже середины. Справа оставь разрыв для маяка.', ...light.horizon),
    S('Маяк — главный, но стоит справа, а не в центре. Башня кверху плавно сужается.', ...light.tower),
    S('Наверху балкон шире башни, на нём фонарь с окнами и круглая крыша с шариком.', ...light.lamp),
    S('Полоски огибают башню: выше горизонта — горкой, ниже — улыбкой. Дверь внизу, окно выше.', ...light.stripes),
    S('Скала под маяком — передний план. Её край неровный, трещины идут сверху вниз.', ...light.cliff),
    S('Лодка слева уравновешивает маяк. Она ближе горизонта, поэтому вся ниже его линии.', ...light.boat),
    S('Ближние волны крупные и редкие, а к горизонту — мелкие и короткие.', ...light.waves),
    S('Солнце садится прямо на горизонт. Облако и чайки заполняют небо слева.', ...light.sky),
    S('Лучи расходятся от фонаря веером в обе стороны: чем дальше, тем шире. Готово!', ...light.rays),
  ] },

  { id: 'scene-winter-forest', title: 'Зимний лес и заяц', steps: [
    S('Заяц — главный. Посади его правее центра и пониже: он близко. Голова, спина дугой, грудка.', ...winter.hare),
    S('Уши длиннее головы и чуть откинуты назад. Задняя лапа длинная, хвост — пушистый комок.', ...winter.ears),
    S('Глаз ближе к уху, чем к носу. Усы — лёгкие быстрые линии, на грудке короткий мех.', ...winter.face),
    S('Большая ёлка слева чуть дальше зайца: её низ выше. Ярусы книзу всё шире.', ...winter.bigFir),
    S('Снег лежит на каждом ярусе волнистой шапкой. Веди волну от края до края ветки.', ...winter.bigSnow),
    S('Вторая ёлка дальше — она меньше и стоит выше на листе. На ней тоже снег.', ...winter.smallFir),
    S('Дальний край снега выше середины листа. Сугробы прячутся за ёлками и за зайцем.', ...winter.drifts),
    S('Следы вдали мелкие, а к нам — всё крупнее. Под зайцем — ямка в снегу.', ...winter.prints),
    S('Снежинки разбросай неровно: где-то гуще, где-то реже. Зимний лес готов!', ...winter.flakes),
  ] },

  { id: 'scene-cat-window', title: 'Кот на подоконнике', steps: [
    S('Кот — главный. Посади его правее середины: слева останется место для месяца.', ...cat.body),
    S('Кот сидит спиной, поэтому мордочки нет: только усы по бокам и полоски на спине.', ...cat.fur),
    S('Подоконник — длинная полка. Хвост свисает перед ней, поэтому её линия прерывается.', ...cat.sill),
    S('Слева — кактус в горшке, для равновесия. Он меньше кота и не спорит с ним.', ...cat.pot),
    S('Окно — большая рама за котом. Низ стекла прячется за спиной кота и за горшком.', ...cat.frame),
    S('Месяц — в левом верхнем стекле, наискосок от кота. Звёзды разного размера.', ...cat.night),
    S('Город за окном очень далеко: крыши меньше кактуса. Линия прячется за котом и горшком.', ...cat.town),
    S('Штора обрамляет картину: сверху широкая, у завязки собрана. Складки тянутся к ней.', ...cat.left),
    S('Вторая штора — как отражение первой. Края листа закрыты, и взгляд идёт к коту.', ...cat.right),
  ] },
];
