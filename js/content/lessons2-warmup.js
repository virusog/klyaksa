// Advanced technique exercises for the chapter «Разминка для руки»: pressure strokes,
// hatching that wraps round a form, and a plant ornament. Every curve is computed, so
// that strokes end exactly on outlines and branches leave their stems without a corner.
import { O, E, S } from '../art.js';

const { PI, cos, sin, sqrt, hypot, abs, min, max } = Math;
const rad = d => (d * PI) / 180;
const fx = n => +n.toFixed(1);
const pt = p => `${fx(p[0])} ${fx(p[1])}`;
const repeat = (n, f) => Array.from({ length: n }, (_, i) => f(i));

// Smooth cubic segments through a list of points, continuing from the first one.
function curve(pts) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[max(i - 1, 0)], b = pts[i], c = pts[i + 1], e = pts[min(i + 2, pts.length - 1)];
    d += `C${pt([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${pt([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])} ${pt(c)}`;
  }
  return d;
}
const through = pts => `M${pt(pts[0])}${curve(pts)}`;
const seg = (a, b) => `M${pt(a)}L${pt(b)}`;

const bez = (a, b, c, d) => t => {
  const u = 1 - t;
  return [0, 1].map(k => u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]);
};
// A gently bent line from a to b; bend pushes its middle sideways.
const bow = (a, b, bend) => {
  const n = [-(b[1] - a[1]), b[0] - a[0]], m = hypot(...n) || 1;
  const c = [(a[0] + b[0]) / 2 + (n[0] / m) * bend * 4 / 3, (a[1] + b[1]) / 2 + (n[1] / m) * bend * 4 / 3];
  return bez(a, [a[0] + (c[0] - a[0]) * 0.75, a[1] + (c[1] - a[1]) * 0.75], [b[0] + (c[0] - b[0]) * 0.75, b[1] + (c[1] - b[1]) * 0.75], b);
};
const dirOf = (f, t) => {
  const p = f(max(t - 0.002, 0)), q = f(min(t + 0.002, 1)), m = hypot(q[0] - p[0], q[1] - p[1]) || 1;
  return [(q[0] - p[0]) / m, (q[1] - p[1]) / m];
};

// Width along a stroke: rises like t^a, falls like (1-t)^b, widest value is w.
const prof = (a, b, w) => {
  const tm = a / (a + b), top = tm ** a * (1 - tm) ** b;
  return t => (w * t ** a * (1 - t) ** b) / top;
};

// The outline of a stroke drawn with changing pressure: two edges round a centre line.
function swell(f, width, n = 18) {
  const L = [], Rt = [];
  for (let i = 0; i <= n; i++) {
    const t = 0.5 - 0.5 * cos((PI * i) / n);
    const [x, y] = f(t), [dx, dy] = dirOf(f, t), h = width(t) / 2;
    L.push([x + dy * h, y - dx * h]);
    Rt.push([x - dy * h, y + dx * h]);
  }
  Rt.reverse();
  return `M${pt(L[0])}${curve(L)}L${pt(Rt[0])}${curve(Rt)}Z`;
}

// ---------- 1. Pressure: lines that swell and thin ----------

const BOATS = [[62, 212, 150, 34], [185, 216, 178, 46], [318, 220, 206, 58]].map(([x, y, len, w]) =>
  swell(bow([x, y], [x + len * 0.5, y - len * 0.866], -7), prof(1.2, 1.2, w)));

const DROPS = repeat(4, i => {
  const x = 610 + i * 104;
  return swell(bez([x, 52], [x + 6, 110], [x - 6, 160], [x - 62, 216]), prof(0.5, 1.7, 50), 20);
});

const TWIG = bez([52, 548], [230, 542], [420, 440], [556, 262]);
const TWIG_W = t => 30 * (1 - t) ** 0.85;
// [place on the twig, side, length, width, angle to the twig]
const TWIG_LEAVES = [
  [0.2, -1, 150, 58, 54], [0.46, -1, 132, 52, 54], [0.71, -1, 108, 44, 54],
  [0.33, 1, 146, 56, 40], [0.58, 1, 124, 48, 44], [0.82, 1, 96, 40, 48],
].map(([t, side, len, w, deg]) => {
  const [x, y] = TWIG(t), [dx, dy] = dirOf(TWIG, t);
  const a = Math.atan2(dy, dx) + side * rad(deg), h = TWIG_W(t) / 2 + 3;
  const base = [x - side * dy * h, y + side * dx * h];
  const f = bow(base, [base[0] + cos(a) * len, base[1] + sin(a) * len], side * len * 0.05);
  return { outline: swell(f, prof(0.8, 1.35, w)), rib: through(repeat(6, i => f(0.05 + i * 0.12))) };
});

const BLOOM = [792, 398];
const PETALS = repeat(8, i => {
  const a = rad(i * 45 - 90), at = (r, turn) => [BLOOM[0] + cos(a + turn) * r, BLOOM[1] + sin(a + turn) * r];
  return swell(bez(at(34, 0), at(70, 0.02), at(110, 0.1), at(150, 0.2)), prof(1, 0.5, 60), 20);
});

const RIB_Y = 662, RIB_A = 42;
const ribEdge = s => through(repeat(57, i => {
  const x = 80 + i * 15;
  return [x, RIB_Y + s * RIB_A * cos(((x - 500) / 420) * 2 * PI)];
}));
const ribTail = s => `M${80 * s + (s < 0 ? 1000 : 0)} ${RIB_Y - RIB_A}l${-42 * s} -8l${30 * s} ${RIB_A + 8}l${-30 * s} ${RIB_A + 8}l${42 * s} -8`;
// Shading on the two lobes where the ribbon shows its back.
const ribShade = repeat(8, i => {
  const x = (i < 4 ? 232 : 652) + (i % 4) * 30, h = RIB_A * abs(cos(((x + 14 - 500) / 420) * 2 * PI)) - 11;
  return `M${x} ${fx(RIB_Y + h)}L${x + 28} ${fx(RIB_Y - h)}`;
});

// ---------- 2. Hatching that follows the form ----------

// The three solids are seen a little from above, so every level circle is an oval K times
// as tall as it is wide. A form gives, for u from 0 (top) to 1 (bottom): the radius there,
// the height of that level on the sheet, and how fast the radius grows on the way down.
const K = 0.3, KC = sqrt(1 - K * K), TILT = K / KC;
// The light comes from the upper left. On a level whose radius grows at rate g on the way
// down, the shadow covers the angles between dark(g)[0] and dark(g)[1].
const LIGHT_AZ = rad(165), LIGHT_TAN = Math.tan(rad(24));
// A form may soften the light (soft) and even out its slope over a stretch (blur), so that
// the edge of its shadow stays one calm curve.
const slope = (form, u) => {
  if (!form.blur) return form.at(u)[2] * (form.soft || 1);
  const g = repeat(15, i => max(-3, min(1.2, form.at(max(0.0005, min(0.9995, u + ((i - 7) / 7) * form.blur)))[2])));
  return (g.reduce((a, b) => a + b, 0) / 15) * (form.soft || 1);
};
const dark = (form, u) => { const th = Math.acos(max(-1, min(1, -LIGHT_TAN * slope(form, u)))); return [LIGHT_AZ + th - 2 * PI, LIGHT_AZ - th]; };
const SHADE = LIGHT_AZ - PI / 2; // the edge of the shadow on an upright wall
const FLOOR = 590;

const ball = { x: 190, y: 450, r: 140, at(u) {
  const a = PI * u;
  return [this.r * sin(a), this.y - this.r * KC * cos(a), cos(a) / max(sin(a), 1e-6)];
} };
const can = { x: 500, top: 180, a: 92, at(u) { return [this.a, this.top + (FLOOR - this.top) * u, 0]; } };
const PEAR_SIDE = [
  [[0, 240], [30, 240], [58, 262], [58, 300]],
  [[58, 300], [58, 350], [112, 400], [112, 478]],
  [[112, 478], [112, 545], [65, 590], [0, 590]],
];
const pear = { x: 795, soft: 0.5, blur: 0.07, at(u) {
  const i = min(Math.floor(u * 3), 2), t = u * 3 - i, f = bez(...PEAR_SIDE[i]);
  const [r, y] = f(t), p = f(max(t - 0.001, 0)), q = f(min(t + 0.001, 1));
  return [r, y, (KC * (q[0] - p[0])) / max(q[1] - p[1], 1e-6)];
} };

const onForm = (form, u, a) => { const [r, y] = form.at(u); return [form.x + r * cos(a), y + K * r * sin(a)]; };
// The place on a belt where it slips behind the form and meets the outline.
const rim = (form, u) => Math.asin(max(-1, min(1, -form.at(u)[2] * TILT)));
const cut = (from, to, test) => { let a = from, b = to; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (test(m)) a = m; else b = m; } return a; };
const levelOf = (form, y) => cut(0, 1, u => form.at(u)[1] < y);
// A hatching stroke: a piece of the level oval from the shadow edge to the outline.
const belt = (form, y) => {
  const u = levelOf(form, y), r = form.at(u)[0], back = rim(form, u), [d0, d1] = dark(form, u);
  // Low belts run along the outline for a while, so they stop a little early and stay readable.
  const from = min(d1, PI - back - max(back, 0) * 0.6), to = max(d0, back + max(back, 0) * 0.6);
  return `M${pt(onForm(form, u, from))}A${fx(r)} ${fx(r * K)} 0 0 0 ${pt(onForm(form, u, to))}`;
};
// Evenly spaced points along a dense list of points.
function resample(pts, n) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  let k = 0;
  return repeat(n + 1, i => {
    const want = (len[len.length - 1] * i) / n;
    while (k < pts.length - 2 && len[k + 1] < want) k++;
    const t = (want - len[k]) / (len[k + 1] - len[k] || 1);
    return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t];
  });
}
// A line that runs down the form inside its shadow and crosses every belt at the same place.
const meridian = (form, a, y0, y1) => {
  const u0 = levelOf(form, y0), u1 = levelOf(form, y1);
  const us = repeat(401, i => u0 + ((u1 - u0) * i) / 400).filter(u => {
    const [d0, d1] = dark(form, u);
    return a <= d1 && a >= max(d0, rim(form, u));
  });
  return through(resample(us.map(u => onForm(form, u, a)), 14));
};
// The edge of the shadow where we can see it: from its highest place, right by the outline,
// down the front of the form to the outline again.
const shadeEdge = form => {
  const pts = [];
  for (let i = 1; i < 3000; i++) {
    const u = i / 3000, back = rim(form, u), d1 = dark(form, u)[1];
    if (abs(LIGHT_TAN * slope(form, u)) < 1 && d1 > back && d1 < PI - back) pts.push(onForm(form, u, d1));
  }
  return through(resample(pts, 30));
};

// The outline of the pear is where its belts turn away from us.
const pearRight = (() => {
  const u0 = cut(0, 0.3, u => pear.at(u)[2] * TILT > 1), u1 = cut(0.7, 1, u => pear.at(u)[2] * TILT > -1);
  return repeat(41, i => { const u = u0 + (u1 - u0) * (0.5 - 0.5 * cos((PI * i) / 40)); return onForm(pear, u, rim(pear, u)); });
})();
const pearD = (() => {
  const pts = [...pearRight, ...pearRight.slice(1, -1).reverse().map(([x, y]) => [2 * pear.x - x, y])], n = pts.length;
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n], e = pts[(i + 2) % n];
    d += `C${pt([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${pt([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])} ${pt(c)}`;
  }
  return `${d}Z`;
})();
const pearHalf = y => {
  for (let i = 0; i < pearRight.length - 1; i++) {
    const [a, b] = [pearRight[i], pearRight[i + 1]];
    if (y >= a[1] && y <= b[1]) return a[0] - pear.x + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1] || 1);
  }
  return 0;
};
const ballHalf = y => sqrt(max(ball.r ** 2 - (y - ball.y) ** 2, 0));

const inBall = ([x, y], grow = 0) => hypot(x - ball.x, y - ball.y) < ball.r + grow;
const inPear = ([x, y], grow = 0) => abs(x - pear.x) < pearHalf(y - grow) + grow || (abs(x - pear.x) < 40 && y < FLOOR + grow && y > 400);
const inCan = ([x, y], grow = 0) => abs(x - can.x) < can.a + grow
  && y < FLOOR + grow + can.a * K * sqrt(max(1 - ((x - can.x) / (can.a + grow)) ** 2, 0));

// Cast shadows lie on the table, stretched away from the sun.
const SUN_DEG = 12, LIGHT = [cos(rad(SUN_DEG)), sin(rad(SUN_DEG))];
const shadow = (x, y, len, wide, off) => ({ c: [x + LIGHT[0] * off, y + LIGHT[1] * off], len, wide });
const shadowAt = (e, a) => [e.c[0] + e.len * cos(a) * LIGHT[0] - e.wide * sin(a) * LIGHT[1], e.c[1] + e.len * cos(a) * LIGHT[1] + e.wide * sin(a) * LIGHT[0]];
const inShadow = ([x, y], e, shrink = 0) => {
  const dx = x - e.c[0], dy = y - e.c[1];
  return ((dx * LIGHT[0] + dy * LIGHT[1]) / (e.len - shrink)) ** 2 + ((dy * LIGHT[0] - dx * LIGHT[1]) / (e.wide - shrink)) ** 2 < 1;
};
// The part of a shadow's edge that is not hidden behind its object, as one arc.
function shadowEdge(e, hidden) {
  const h = a => hidden(shadowAt(e, a));
  let start = 0;
  while (!h(rad(start)) || h(rad(start + 1))) start++;
  let end = start + 1;
  while (!h(rad(end + 1))) end++;
  const a0 = cut(rad(start), rad(start + 1), h), a1 = cut(rad(end), rad(end + 1), a => !h(a));
  return `M${pt(shadowAt(e, a0))}A${e.len} ${e.wide} ${SUN_DEG} ${a1 - a0 > PI ? 1 : 0} 1 ${pt(shadowAt(e, a1))}`;
}
// One unbroken zigzag that fills a flat shadow.
function zigzag(inside, x0, x1, stepX) {
  const pts = [];
  for (let x = x0, k = 0; x <= x1; x += stepX) {
    const ys = [];
    for (let y = 540; y <= 725; y++) if (inside([x, y])) ys.push(y);
    if (ys.length < 15) continue;
    pts.push([x, k++ % 2 ? ys[0] : ys[ys.length - 1]]);
  }
  return pts.map((p, i) => `${i ? 'L' : 'M'}${pt(p)}`).join('');
}

const BALL_SH = shadow(ball.x, ball.y + ball.r * KC + 8, 116, 41, 97), PEAR_SH = shadow(pear.x, FLOOR + 8, 94, 35, 77);
const CAN_SH = [LIGHT[0] * 108, LIGHT[1] * 108];
const canBase = a => [can.x + can.a * cos(a), FLOOR + can.a * K * sin(a)];
const canShadowD = (() => {
  const a = Math.atan2(-K * CAN_SH[0], CAN_SH[1]), far = canBase(a);
  const near = [canBase(a + PI)[0] + CAN_SH[0] * 0.5, canBase(a + PI)[1] + CAN_SH[1] * 0.5];
  const s = (can.x + can.a - far[0]) / CAN_SH[0];
  return `M${pt(near)}L${pt([near[0] + CAN_SH[0] * 0.5, near[1] + CAN_SH[1] * 0.5])}A${can.a} ${fx(can.a * K)} 0 0 0 ${pt([far[0] + CAN_SH[0], far[1] + CAN_SH[1]])}L${pt([far[0] + CAN_SH[0] * s, far[1] + CAN_SH[1] * s])}`;
})();
const inCanShadow = ([x, y]) => repeat(21, i => i / 20).some(s =>
  ((x - CAN_SH[0] * s - can.x) / (can.a - 11)) ** 2 + ((y - CAN_SH[1] * s - FLOOR) / (can.a * K - 9)) ** 2 < 1);

const tilted = (cx, cy, rx, ry, deg) => {
  const dx = rx * cos(rad(deg)), dy = rx * sin(rad(deg));
  return `M${fx(cx - dx)} ${fx(cy - dy)}A${rx} ${ry} ${deg} 1 0 ${fx(cx + dx)} ${fx(cy + dy)}A${rx} ${ry} ${deg} 1 0 ${fx(cx - dx)} ${fx(cy - dy)}Z`;
};
const SUN = [128, 132];
const sunRays = repeat(8, i => seg([SUN[0] + 66 * cos(rad(i * 45)), SUN[1] + 66 * sin(rad(i * 45))], [SUN[0] + 94 * cos(rad(i * 45)), SUN[1] + 94 * sin(rad(i * 45))])).join('');
const TABLE_Y = 535;
const table = [[25, ball.x - ballHalf(TABLE_Y) - 14], [ball.x + ballHalf(TABLE_Y) + 14, can.x - can.a - 14],
  [can.x + can.a + 14, pear.x - pearHalf(TABLE_Y) - 14], [pear.x + pearHalf(TABLE_Y) + 14, 975]]
  .map(([a, b]) => `M${fx(a)} ${TABLE_Y}H${fx(b)}`).join('');

// ---------- 3. A plant ornament ----------

const WAVE = 400, MID = 375, AMP = 128;
const stemY = x => {
  const a = ((x - 100) / WAVE) * 2 * PI;
  return MID + (AMP * (cos(a) - 0.06 * cos(3 * a))) / 0.94;
};
const stemDir = x => { const m = hypot(1, stemY(x + 0.5) - stemY(x - 0.5)); return [1 / m, (stemY(x + 0.5) - stemY(x - 0.5)) / m]; };
const STEM = through(repeat(81, i => [100 + i * 10, stemY(100 + i * 10)]));

// Points of a spiral that winds in from radius r0 to r1. turn is +1 clockwise, flip mirrors it top to bottom.
function coil([cx, cy], r0, r1, fromDeg, turns, turn = 1, flip = 1) {
  const n = Math.round(turns * 28);
  return repeat(n + 1, i => {
    const a = rad(fromDeg) + turn * (i / n) * turns * 2 * PI, r = r0 + ((r1 - r0) * i) / n;
    return [cx + r * cos(a), cy + flip * r * sin(a)];
  });
}
// A branch that leaves point p in direction d and flows into a list of points.
function branch(p, d, pts) {
  const s = pts[0], m = hypot(pts[1][0] - s[0], pts[1][1] - s[1]);
  const e = [(pts[1][0] - s[0]) / m, (pts[1][1] - s[1]) / m], len = hypot(s[0] - p[0], s[1] - p[1]) / 3;
  return `M${pt(p)}C${pt([p[0] + d[0] * len, p[1] + d[1] * len])} ${pt([s[0] - e[0] * len, s[1] - e[1] * len])} ${pt(s)}${curve(pts)}`;
}

const END_R = 62, SCROLL_R = 95, SCROLL_TURNS = 1.9;
const endCurl = side => through(coil([500 - side * 400, MID + AMP - END_R], END_R, 12, 90, 1.3, side));
// A big scroll in each pocket of the wave: under the two crests and over the middle dip.
const SCROLLS = [[300, 1], [500, -1], [700, 1]].map(([x, flip]) => {
  const from = x - 112, d = stemDir(from);
  return branch([from, stemY(from)], d, coil([x, MID + flip * 20], SCROLL_R, 12, 215, SCROLL_TURNS, 1, flip));
});

function leaf(node, base, tip, w, bend, veinAt = [0.2, 0.42]) {
  const f = bow(base, tip, bend), width = prof(0.75, 1.3, w);
  const vein = t => {
    const m = f(t), c = f(t + 0.17), [dx, dy] = dirOf(f, t + 0.17), h = width(t + 0.17) * 0.3;
    return `M${pt([c[0] + dy * h, c[1] - dx * h])}L${pt(m)}L${pt([c[0] - dy * h, c[1] + dx * h])}`;
  };
  return { outline: swell(f, width), rib: through([node, ...repeat(7, i => f(i * 0.145))]), veins: veinAt.map(vein) };
}
const LEAVES = [
  leaf([306, 247], [314, 230], [428, 84], 80, 14),
  leaf([706, 247], [714, 230], [828, 84], 80, 14),
  leaf([506, 503], [514, 520], [634, 660], 80, -14),
  leaf([106, 503], [114, 520], [226, 664], 80, -14),
  leaf([70, 403], [73, 386], [112, 222], 66, 10, [0.3]),
  leaf([930, 403], [927, 386], [888, 222], 66, -10, [0.3]),
];

// A thin spring: leaves the stem and winds into a small curl.
// It bends more and more sharply all the way, so there is no corner anywhere along it.
function tendril(p, deg, turn, len = 275) {
  const pts = [p], n = 80;
  let [x, y] = p, a = rad(deg);
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) / n;
    a += turn * (len / n) * (0.085 * s ** 2.4 - 0.007 * (1 - s) ** 2);
    x += (cos(a) * len) / n; y += (sin(a) * len) / n;
    if (i % 2) pts.push([x, y]);
  }
  return through(pts);
}
const TENDRILS = [tendril([292, 248], -112, -1), tendril([692, 248], -112, -1), tendril([494, 502], 112, 1), tendril([894, 502], 112, 1)];

// Three berries on a little fan of stalks. dir is +1 for hanging down, -1 for standing up.
function bunch(x, from, dir, r = 25) {
  const fork = from + dir * 34;
  const spots = [[-49, 72], [0, 88], [49, 72]].map(([dx, dy]) => [x + dx, fork + dir * dy]);
  const stalk = `M${x} ${from}V${fork}` + spots.map(([bx, by]) => {
    const m = hypot(bx - x, by - fork), end = [bx - ((bx - x) / m) * r, by - ((by - fork) / m) * r];
    return `M${x} ${fork}Q${fx((x + end[0]) / 2 + (bx - x) * 0.12)} ${fx((fork + end[1]) / 2 - dir * 6)} ${pt(end)}`;
  }).join('');
  return {
    stalk,
    berries: spots.map(([bx, by]) => O(bx, by, r)),
    shine: spots.map(([bx, by]) => `M${fx(bx - r * 0.52)} ${fx(by - r * 0.1)}A${fx(r * 0.55)} ${fx(r * 0.55)} 0 0 1 ${fx(bx - r * 0.1)} ${fx(by - r * 0.52)}`),
  };
}
const scrollEdge = SCROLL_R - ((SCROLL_R - 12) * (450 - 215)) / (SCROLL_TURNS * 360); // radius of a scroll where its outer turn passes the pocket mouth
const BUNCHES = [bunch(300, MID + 20 + scrollEdge, 1), bunch(500, MID - 20 - scrollEdge, -1), bunch(700, MID + 20 + scrollEdge, 1)];

// Small leaves on the outer side of every slope of the wave, half way between the big ones.
const BUDS = [240, 440, 640, 840].map((x, i) => {
  const [dx, dy] = stemDir(x), side = i % 2 ? -1 : 1, a = Math.atan2(dy, dx) - side * rad(50);
  const base = [x + side * dy * 5, stemY(x) - side * dx * 5];
  return swell(bow(base, [base[0] + cos(a) * 60, base[1] + sin(a) * 60], -side * 5), prof(0.8, 1.2, 30), 12);
});

export default [
  { id: 'warm2-pressure', title: 'Линия с нажимом', noCopy: true, guess: false, steps: [
    S('Мазок-лодочка: начни легко, в середине нажми сильнее, а к концу снова отпусти.', ...BOATS),
    S('Капля: нажим сразу в начале, потом плавно отпускай. Хвостик станет тонким сам.', ...DROPS),
    S('Ветка у основания толстая, а к кончику тает. Веди снизу вверх и ослабляй нажим.', swell(TWIG, TWIG_W, 24)),
    S('Лист — тот же мазок-лодочка. Самое широкое место у него ближе к ветке.', ...TWIG_LEAVES.slice(0, 3).map(l => l.outline)),
    S('Листья с другой стороны. К вершине ветки они мельче: сравни первый и последний.', ...TWIG_LEAVES.slice(3).map(l => l.outline)),
    S('Жилка — самая лёгкая линия, почти без нажима. До кончика листа её не доводи.', ...TWIG_LEAVES.map(l => l.rib)),
    S('Лепестки-капли растут из серединки по кругу. Сначала верхний, потом напротив.', O(...BLOOM, 24), ...PETALS),
    S('Лента: две волны то сходятся, то расходятся. Где они встретились, лента перевернулась.', ribEdge(1), ribEdge(-1)),
    S('Хвостики ленты — галочкой. Изнанка ленты в тени: заштрихуй её лёгкими штрихами.', ribTail(1), ribTail(-1), ...ribShade),
  ] },
  { id: 'warm2-form-hatch', title: 'Штрих по форме', noCopy: true, guess: false, steps: [
    S('Шар — круг, у цилиндра верх — овал. Низ цилиндра круглится так же, как верх.',
      O(ball.x, ball.y, ball.r), E(can.x, can.top, can.a, can.a * K), `M${can.x - can.a} ${can.top}V${FLOOR}A${can.a} ${fx(can.a * K)} 0 0 0 ${can.x + can.a} ${FLOOR}V${can.top}`),
    S('Груша — два шара: маленький над большим. Соедини их плавной талией, без углов.',
      pearD, 'M795 241C792 212 800 188 818 166', 'M803 203C826 165 868 151 900 159C890 195 848 215 803 203Z'),
    S('Солнышко слева, значит, тени будут справа. Линия стола прячется за предметами.',
      O(...SUN, 46), sunRays, table),
    S('Граница тени повторяет форму: на шаре и груше она дуга, на цилиндре — прямая.',
      shadeEdge(ball), seg(onForm(can, 0, SHADE), onForm(can, 1, SHADE)), shadeEdge(pear)),
    S('Штрих на шаре — кусочек овала. Веди от границы тени к краю, будто обнимаешь шар.',
      ...repeat(7, i => belt(ball, ball.y + (i * 0.215 - 0.72) * ball.r * KC))),
    S('На цилиндре все дуги одинаковые, как его дно. Следи, чтобы промежутки были равные.',
      ...repeat(9, i => belt(can, can.top + ((i + 1) * (FLOOR - can.top)) / 10))),
    S('У груши дуги растут вместе с формой: на шейке короткие, на животике длинные.',
      ...repeat(8, i => belt(pear, 285 + i * 36))),
    S('Второй слой идёт вдоль формы: на шаре и груше это дуги, а на цилиндре — прямая.',
      meridian(ball, rad(45), ball.y - 0.95 * ball.r * KC, ball.y + 0.57 * ball.r * KC),
      seg(onForm(can, 0, rad(45)), onForm(can, 1, rad(45))),
      meridian(pear, rad(45), 321, 537)),
    S('Падающая тень лежит на столе плоско, как лужица. Штрихуй её ровным зигзагом.',
      shadowEdge(BALL_SH, p => inBall(p)), canShadowD, shadowEdge(PEAR_SH, p => inPear(p)),
      zigzag(p => inShadow(p, BALL_SH, 11) && !inBall(p, 11), 184, 420, 21),
      zigzag(p => inCanShadow(p) && !inCan(p, 11), 444, 690, 21),
      zigzag(p => inShadow(p, PEAR_SH, 11) && !inPear(p, 11), 786, 970, 21)),
    S('Блик — самое светлое место, он со стороны солнца. Обведи его и оставь белым.',
      tilted(ball.x - 58, ball.y - 62, 32, 19, -50), `M${can.x - 72} 262a11 11 0 0 1 22 0v150a11 11 0 0 1 -22 0Z`, tilted(pear.x - 54, 452, 27, 14, -62)),
  ] },
  { id: 'warm2-vine', title: 'Растительный орнамент', noCopy: true, guess: false, steps: [
    S('Орнамент живёт в ленте. Две ровные линии — её края: веди рукой от плеча.', 'M40 45H960', 'M40 705H960'),
    S('Стебель — волна от края до края. Все гребни одной высоты: сначала проведи в воздухе.', STEM),
    S('Завитки: ветка отходит от стебля плавно, без угла, и закручивается всё туже.', endCurl(1), endCurl(-1), ...SCROLLS),
    S('Лист — две дуги с острым кончиком. Самое широкое место у него ближе к стеблю.', ...LEAVES.map(l => l.outline)),
    S('Средняя жилка выходит из стебля, делит лист пополам и гнётся вместе с ним.', ...LEAVES.map(l => l.rib)),
    S('Боковые жилки — галочки. Остриём они смотрят к стеблю, как ёлочка.', ...LEAVES.flatMap(l => l.veins)),
    S('Усик сначала почти прямой, а к концу закручен туго. Черешки ягод расходятся веером.', ...TENDRILS, ...BUNCHES.map(b => b.stalk)),
    S('Ягоды сидят тройками и касаются боками. Каждую рисуй одним быстрым кругом.', ...BUNCHES.flatMap(b => b.berries)),
    S('Блик-дужка на каждой ягоде с одной и той же стороны: свет ведь один.', ...BUNCHES.flatMap(b => b.shine)),
    S('Почки — маленькие листики на внешней стороне волны. Они заполняют пустые места.', ...BUDS),
  ] },
];
