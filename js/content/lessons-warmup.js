// Hand-warming technique exercises. Hatching lines, curls and eights are computed
// from their shapes so that strokes end exactly on the outline and stay smooth.
import { O, S } from '../art.js';

const fx = n => +n.toFixed(1);
const polyline = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fx(x)} ${fx(y)}`).join('');

// A heart with a clean V at the top, as four cubic segments.
function heartCurves(x, y, s) {
  return [
    [[x, y + s], [x - s * 1.5, y + s * 0.05], [x - s * 1.2, y - s], [x - s * 0.55, y - s]],
    [[x - s * 0.55, y - s], [x - s * 0.25, y - s], [x - s * 0.08, y - s * 0.8], [x, y - s * 0.52]],
    [[x, y - s * 0.52], [x + s * 0.08, y - s * 0.8], [x + s * 0.25, y - s], [x + s * 0.55, y - s]],
    [[x + s * 0.55, y - s], [x + s * 1.2, y - s], [x + s * 1.5, y + s * 0.05], [x, y + s]],
  ];
}

const heart = (x, y, s) => {
  const c = heartCurves(x, y, s);
  return `M${c[0][0].map(fx).join(' ')}` + c.map(([, b, d, e]) => `C${[b, d, e].map(p => p.map(fx).join(' ')).join(' ')}`).join('') + 'Z';
};

// The same outline as a list of points to cut hatching against.
function heartPoly(x, y, s) {
  const out = [];
  for (const [a, b, d, e] of heartCurves(x, y, s)) {
    for (let i = 0; i < 40; i++) {
      const t = i / 40, u = 1 - t;
      const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      out.push([0, 1].map(k => w[0] * a[k] + w[1] * b[k] + w[2] * d[k] + w[3] * e[k]));
    }
  }
  return out;
}

function roundedPoly(x, y, w, h, r) {
  const out = [];
  const corners = [[x + w - r, y + r, -90], [x + w - r, y + h - r, 0], [x + r, y + h - r, 90], [x + r, y + r, 180]];
  for (const [cx, cy, from] of corners) {
    for (let i = 0; i <= 12; i++) {
      const a = ((from + (i / 12) * 90) * Math.PI) / 180;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return out;
}

// Parallel straight strokes at an angle, cut exactly by the outline.
function hatch(poly, deg, gap, fixedCount) {
  const a = (deg * Math.PI) / 180;
  const u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]];
  const offs = poly.map(p => p[0] * n[0] + p[1] * n[1]);
  const lo = Math.min(...offs), hi = Math.max(...offs);
  const count = fixedCount || Math.floor((hi - lo) / gap);
  const out = [];
  for (let k = 0; k < count; k++) {
    const c = lo + (hi - lo - (count - 1) * gap) / 2 + k * gap;
    const hits = [];
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length];
      const d1 = offs[i] - c, d2 = offs[(i + 1) % poly.length] - c;
      if (d1 * d2 >= 0) return;
      const t = d1 / (d1 - d2);
      hits.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    });
    hits.sort((p, q) => p[0] * u[0] + p[1] * u[1] - q[0] * u[0] - q[1] * u[1]);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      if (Math.hypot(hits[i][0] - hits[i + 1][0], hits[i][1] - hits[i + 1][1]) > 40) out.push(polyline([hits[i], hits[i + 1]]));
    }
  }
  return out;
}

// Arcs across a ball that bulge towards the viewer.
function ballArcs(cx, cy, r, levels, bow) {
  return levels.map(v => {
    const half = r * Math.sqrt(1 - v * v), y = cy + v * r;
    return `M${fx(cx - half)} ${fx(y)}Q${cx} ${fx(y + bow * half * 2)} ${fx(cx + half)} ${fx(y)}`;
  });
}

// A figure-eight in one stroke, from the top through the middle and back.
function eightPath(cx, cy, a, b, lying) {
  const P = (u, v) => (lying ? `${fx(cx + v)} ${fx(cy + u)}` : `${fx(cx + u)} ${fx(cy + v)}`);
  const lobe = (sx, sy, toCentre) => (toCentre
    ? `C${P(sx * a * 0.66, sy * b)} ${P(sx * a * 1.25, sy * b * 0.42)} ${P(0, 0)}`
    : `C${P(sx * a * 1.25, sy * b * 0.42)} ${P(sx * a * 0.66, sy * b)} ${P(0, sy * b)}`);
  return `M${P(0, -b)}${lobe(-1, -1, true)}${lobe(1, 1, false)}${lobe(-1, 1, true)}${lobe(1, -1, false)}`;
}

// A row of joined handwriting loops.
function loops(x0, y, step, n, b) {
  const c = step / 6.2832, end = n * 6.2832, pts = [];
  for (let t = -3.1416; t <= end - 3.1416 + 0.001; t += 0.1) pts.push([x0 + c * t - b * Math.sin(t), y - b * Math.cos(t)]);
  return polyline(pts);
}

// A wave curl: a tail that leaves the bottom of the previous curl, rises over
// the top of this one and winds in with evenly spaced coils, so it is easy to trace.
function curl(fromX, cx, cy, r0, gap, turns) {
  const top = -Math.PI / 2, span = turns * 6.2832, n = Math.round(turns * 40);
  const R = r0 + gap * turns, base = cy + R - gap / 2;
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const a = top + (span * i) / n;
    const r = R - (gap * span * (i / n)) / 6.2832;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return `M${fromX} ${base}C${fromX + 92} ${base} ${cx - 100} ${cy - R} ${cx} ${cy - R}${pts.map(([x, y]) => `L${fx(x)} ${fx(y)}`).join('')}`;
}

const line = (x1, y1, x2, y2) => `M${x1} ${y1}L${x2} ${y2}`;

const HEART = heartPoly(250, 205, 150);
const WAFFLE = roundedPoly(610, 55, 300, 300, 36);
const BALL = [500, 545, 165];

const grass = (x, y, h) => `M${x} ${y}Q${fx(x - h * 0.02)} ${fx(y - h * 0.55)} ${fx(x + h * 0.16)} ${y - h}`;
const repeat = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const GROW = [[5, 71], [13, 151], [22, 247], [33, 362], [45, 500], [59, 664], [76, 859]];
const BASE = 430;

const ZIG = 'M60 180' + repeat(8, i => `L${115 + i * 110} 70L${170 + i * 110} 180`).join('');
// One arch from the base line. Its feet lean in a little, so neighbours meet in a clean V.
const arch = (x, w, h, y = 460) => `C${fx(x + w * 0.2)} ${fx(y - h * 4 / 3)} ${fx(x + w * 0.8)} ${fx(y - h * 4 / 3)} ${x + w} ${y}`;

// Waffle lines are spaced so that both layers meet exactly on the edge.
const WAFFLE_GAP = 100 / Math.SQRT2;

export default [
  { id: 'warm-hatching', title: 'Штриховка', noCopy: true, guess: false, steps: [
    S('Сначала форма: сердце, вафля и мяч. Штрихи будут жить внутри них.',
      heart(250, 205, 150), `M646 55H874a36 36 0 0 1 36 36V319a36 36 0 0 1 -36 36H646a36 36 0 0 1 -36 -36V91a36 36 0 0 1 36 -36Z`, O(...BALL)),
    S('Параллельные штрихи: все в одну сторону и на равном расстоянии, как косой дождик.',
      ...hatch(HEART, 62, 50)),
    S('Вафля: первый слой косых штрихов. Веди линию до края и сразу останавливайся.',
      ...hatch(WAFFLE, 45, WAFFLE_GAP, 6)),
    S('Второй слой поперёк первого. Такая штриховка перекрёстная, и она темнее.',
      ...hatch(WAFFLE, -45, WAFFLE_GAP, 6)),
    S('Штрихи-дуги повторяют форму. Изгибай их, и мяч сразу станет круглым!',
      ...ballArcs(...BALL, [-0.82, -0.58, -0.34, -0.1, 0.14, 0.38, 0.62], 0.22)),
  ] },
  { id: 'warm-dots', title: 'Точки и чёрточки', noCopy: true, guess: false, steps: [
    S('Точки-бусины в ряд. Ставь их на равном расстоянии, глаз сам подскажет.',
      ...repeat(9, i => O(70 + i * 107.5, 70, 5))),
    S('Чёрточки как дорожная разметка: все одной длины, все на одной линии.',
      ...repeat(7, i => line(70 + i * 130, 155, 150 + i * 130, 155))),
    S('Точка подрастает: от горошинки до мячика. Каждая чуть больше соседки.',
      ...GROW.map(([r, x]) => O(x, BASE - r, r))),
    S('Чёрточки-травинки: каждая выше соседки. Рисуй снизу вверх одним взмахом.',
      ...repeat(8, i => grass(70 + i * 117, 715, 70 + i * 24))),
    S('Две точки чуть выше середины и чёрточка-улыбка. Большой круг ожил!',
      O(832, 335, 5), O(886, 335, 5), 'M824 378Q859 408 894 378'),
  ] },
  { id: 'warm-border', title: 'Узоры-бордюры', noCopy: true, guess: false, steps: [
    S('Шесть ровных линий — это три ленты. Веди от плеча и смотри на конец линии.',
      line(60, 40, 940, 40), line(60, 210, 940, 210), line(60, 290, 940, 290), line(60, 460, 940, 460), line(60, 540, 940, 540), line(60, 710, 940, 710)),
    S('Зигзаг: все зубцы одного роста. Узор — это один кусочек, повторённый много раз.',
      ZIG),
    S('Точка в каждом зубце. Маленькая деталь делает узор нарядным.',
      ...repeat(8, i => O(115 + i * 110, 145, 5))),
    S('Арочки одним движением. Внизу каждой арочки чуть притормози.',
      'M62 460' + repeat(6, i => arch(62 + i * 146, 146, 140)).join('')),
    S('Арочка в арочке. Держи одинаковое расстояние до внешней линии.',
      ...repeat(6, i => `M${92 + i * 146} 460` + arch(92 + i * 146, 86, 108))),
    S('Сердечки по центру ленты. Проверь: они на равных расстояниях?',
      ...repeat(5, i => heart(120 + i * 190, 625, 50))),
    S('Между сердечками ромбики. Чередование — главный секрет бордюра.',
      ...repeat(4, i => { const x = 215 + i * 190; return `M${x} 583L${x + 20} 625L${x} 667L${x - 20} 625Z`; })),
  ] },
  { id: 'warm-curls', title: 'Завитки и восьмёрки', noCopy: true, guess: false, steps: [
    S('Восьмёрка: начни сверху и веди без остановки. Посередине линии встречаются.',
      ...repeat(3, i => eightPath(130 + i * 150, 145, 76, 105))),
    S('Восьмёрка улеглась на бок. Рисуй плавно, рукой от плеча.',
      eightPath(745, 145, 112, 190, true)),
    S('Петельки как в прописях: одна линия, все петли одного роста.',
      loops(134, 385, 122, 7, 64)),
    S('Завитки-волны: каждый растёт из низа соседа и закручивается к центру.',
      ...repeat(4, i => curl(i ? 225 + (i - 1) * 210 : 60, 225 + i * 210, 620, 14, 36, 2))),
  ] },
];
