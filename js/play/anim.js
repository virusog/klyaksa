// «Мультик»: a flip-book studio. She draws frames one by one, sees the previous
// frame faintly underneath, and plays them back as a looping cartoon.
//
// The ladder of the eight lessons (each one is a level):
//   1 мяч        8 frames, one shape and a full guide in every frame: squash and stretch;
//   2 глаз       6 frames, brings in «Копия»: only the eyelid changes;
//   3 цветок     8 frames, every frame adds a detail to a copy of the last one;
//   4 маятник    8 frames, a spacing chart: slow at the ends, fast in the middle;
//                the swing back has no outline, only the dots to place it by;
//   5 шарик      8 frames, the first in-betweens: three frames show only the
//                poses before and after, and she finds the middle herself;
//   6 рука       8 frames, half of them in-betweens, and a shape with five
//                fingers that turns about a fixed elbow;
//   7 рыбка      10 frames, two motions at once (travel and tail), four in-betweens;
//   8 человечек  12 frames, a walk cycle: four limbs out of step, six in-betweens.
// Stars: the frames she drew in are counted. All of them give 3, two thirds
// give 2, anything less 1. A copy she has not touched does not count.
import { h, canvas, svgEl, blobOf, loadImg, clamp } from '../util.js';
import { Painter } from '../painter.js';
import { db, newId, state, award, awardOnce } from '../store.js';
import {
  topbar, btn, iconBtn, icon, speaker, toast, confirmBox, celebrate,
  brushRail, paletteBar, sizeSlider, autosaver, safeSave, COLORS,
} from '../ui.js';
import { sfx } from '../audio.js';
import { levelScreen, finishLevel, isOpen } from './kit.js';
import { t, N, plural } from '../i18n.js';

const MENU = '#/game/anim';
const W = 800;
const H = 600;
const TW = 120;
const TH = 90;
// Sixteen sheets of 800 by 600 are as much as an iPad should be asked to hold.
const MAX = 16;
const SPEEDS = [[N('Медленно'), 4], [N('Нормально'), 8], [N('Быстро'), 12]];
const BRUSHES = ['pen', 'marker', 'pencil', 'crayon', 'eraser'];
// Twenty colours fit in one row, which leaves the sheet more room.
const PALETTE = COLORS.filter(c => !['#8b1e5a', '#fff176', '#ffb340', '#ff8fa3', '#c9a7ff'].includes(c));

const framesOf = n => plural(n, '{n} кадр|{n} кадра|{n} кадров');

// Two icons the shared set does not have, drawn the same way.
const glyph = d => h('span', {
  class: 'ico',
  html: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`,
});
const STOP = '<rect x="6" y="6" width="12" height="12" rx="2"/>';
const COPY = '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/>';

// ---- lesson guides: every pose is computed, on a sheet of 800 by 600 ----
const TAU = Math.PI * 2;
const rad = d => (d * Math.PI) / 180;
const r1 = v => Math.round(v * 10) / 10;
const pt = (x, y) => `${r1(x)} ${r1(y)}`;
const oval = (cx, cy, rx, ry = rx) => `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}"/>`;
const line = (...pts) => `<path d="M${pts.map(q => pt(q[0], q[1])).join('L')}"/>`;
// A step of the given length from a point; the angle is measured from straight down.
const reach = (o, a, len) => [o[0] + len * Math.sin(a), o[1] + len * Math.cos(a)];

const BALL_Y = [140, 172, 268, 404, 482, 404, 268, 172];
const BALL_SHAPE = { 3: [50, 72], 4: [86, 38], 5: [50, 72] };

const LID = [0, 0.4, 0.8, 1, 0.6, 0.25];

const STEM = [26, 80, 150, 220, 280, 320, 340, 350];
const leaf = (y, dir, s) => `<path d="M400 ${y}q${r1(-60 * dir * s)} ${r1(-46 * s)} ${r1(-112 * dir * s)} ${r1(-14 * s)}q${r1(52 * dir * s)} ${r1(46 * s)} ${r1(112 * dir * s)} ${r1(14 * s)}z"/>`;
function flower(i) {
  const top = 520 - STEM[i];
  let s = `<path d="M400 520V${top}"/>`;
  if (i === 0) s += `<path d="M400 ${top}q-26 -22 -40 0M400 ${top}q26 -22 40 0"/>`;
  if (i >= 2) s += leaf(430, 1, [0.5, 0.8][i - 2] || 1);
  if (i >= 3) s += leaf(370, -1, [0.5, 0.8][i - 3] || 1);
  if (i === 4) s += oval(400, top - 16, 13, 18);
  if (i === 5) s += oval(400, top - 26, 22, 30);
  if (i >= 6) {
    const [core, petal, far] = i === 6 ? [13, 14, 28] : [26, 27, 54];
    s += oval(400, top, core);
    for (let k = 0; k < 6; k++) s += oval(400 + far * Math.cos(k * TAU / 6), top + far * Math.sin(k * TAU / 6), petal);
  }
  return s;
}

const PIVOT = [400, 70];
const swing = i => rad(38 * Math.cos(TAU * i / 8));
const bob = i => reach(PIVOT, swing(i), 360);

const fly = i => {
  const k = i / 7;
  return [230 + 370 * k + 26 * Math.sin(k * TAU), 345 - 285 * k, 105 * 0.74 ** i];
};
function balloon(i) {
  const [x, y, r] = fly(i);
  const b = y + r * 1.15;
  return `${oval(x, y, r, r * 1.15)}<path d="M${pt(x, b)}l${r1(-r * 0.12)} ${r1(r * 0.16)}h${r1(r * 0.24)}z"/>`
    + `<path d="M${pt(x, b + r * 0.16)}q${r1(r * 0.25)} ${r1(r * 0.24)} 0 ${r1(r * 0.47)}t0 ${r1(r * 0.47)}"/>`;
}

const ELBOW = [400, 560];
const WAVE = [-28, -20, 0, 20, 28, 20, 0, -20];
const finger = (x, tip) => `<path d="M${x - 13} 214V${tip + 13}a13 13 0 0 1 26 0V214"/>`;
const HAND = '<path d="M372 600L376 324M428 600L424 324"/><rect x="340" y="200" width="120" height="124" rx="34"/>'
  + finger(356, 130) + finger(386, 104) + finger(414, 108) + finger(444, 138)
  + '<ellipse cx="322" cy="262" rx="15" ry="42" transform="rotate(-32 322 262)"/>';
const waveSpot = i => [ELBOW[0] + 480 * Math.sin(rad(WAVE[i])), ELBOW[1] - 480 * Math.cos(rad(WAVE[i]))];

const swim = i => [150 + 58 * i, 300 + 28 * Math.sin(TAU * i / 10), rad(30 * Math.sin(TAU * i / 5))];
function fish(i) {
  const [x, y, wag] = swim(i);
  const tip = k => [x - 72 - 74 * Math.cos(wag + k), y + 74 * Math.sin(wag + k)];
  return `${oval(x, y, 78, 44)}<path d="M${pt(x - 72, y)}L${pt(...tip(0.55))}L${pt(...tip(-0.55))}Z"/>`
    + `${oval(x + 44, y - 10, 6)}<path d="M${pt(x - 22, y - 42)}q24 -30 52 -4"/>`;
}

// A walk in place. The body rises over the straight leg and sinks at the widest step.
function walker(i) {
  const ph = TAU * i / 12;
  const hip = [400, 330 - 8 * Math.cos(2 * ph)];
  const neck = [406, hip[1] - 128];
  const leg = p => {
    const a = rad(28) * Math.sin(p);
    const knee = reach(hip, a, 90);
    // The knee bends only while the leg swings forward.
    const s = a - rad(50) * Math.max(0, Math.cos(p));
    const ankle = reach(knee, s, 90);
    return line(hip, knee, ankle, [ankle[0] + 30 * Math.cos(s), ankle[1] - 30 * Math.sin(s)]);
  };
  const arm = p => {
    const a = -rad(26) * Math.sin(p);
    const elbow = reach(neck, a, 68);
    return line(neck, elbow, reach(elbow, a + rad(24), 62));
  };
  return `<g class="anim-g-far">${leg(ph + Math.PI)}${arm(ph + Math.PI)}</g>`
    + oval(408, neck[1] - 40, 34) + line(hip, neck) + leg(ph) + arm(ph);
}

// n: frames; mid: in-between frames, which show the pose before (orange) and
// the pose after (blue) instead of their own; bare: frames with no pose at
// all, only the dots; spot: where the thing is in each frame (the dots).
const LESSONS = [
  {
    name: N('Прыгающий мяч'), n: 8, fps: 8, thumb: [4, 0],
    tip: N('Сверху мяч летит медленно, а у земли быстро. Точки справа показывают его путь.'),
    tips: {
      0: N('Мяч на самом верху. Нарисуй его по подсказке и нажми на кадр 2.'),
      1: N('Мяч чуть ниже. Бледный рисунок под ним — твой прошлый кадр.'),
      3: N('Мяч разогнался и вытянулся, как капля.'),
      4: N('Шлёп! У земли мяч сплющивается в лепёшку.'),
      5: N('Отскочил! Снова вытянулся и летит вверх.'),
      7: N('Последний кадр. Дорисуй и нажми «Смотреть»!'),
    },
    scene: '<path d="M80 522H720"/>',
    spot: i => [620, BALL_Y[i]],
    pose: i => oval(400, BALL_Y[i], ...(BALL_SHAPE[i] || [60, 60])),
  },
  {
    name: N('Моргающий глаз'), n: 6, fps: 8, thumb: [1],
    tip: N('Меняется только веко. «Копия» переносит рисунок в следующий кадр.'),
    tips: {
      0: N('Нарисуй открытый глаз. Потом нажми «Копия» — рисунок перейдёт в кадр 2.'),
      1: N('Веко пошло вниз. Закрась им верх глаза: фломастер перекроет рисунок.'),
      2: N('Глаз почти закрыт: из-под века выглядывает только краешек.'),
      3: N('Закрыт совсем: одна дуга и реснички.'),
      4: N('Глаз открывается. Открывается он медленнее, чем закрывается!'),
      5: N('Почти открыт. Дорисуй и нажми «Смотреть»!'),
    },
    pose: i => `${oval(400, 295, 80)}${oval(400, 295, 34)}`
      + `<path class="anim-g-lid" d="M200 300Q400 110 600 300Q400 ${110 + 360 * LID[i]} 200 300Z"/>`
      + `<path d="M200 300Q400 470 600 300"/>${LID[i] === 1 ? '<path d="M300 362l-14 34M400 386v38M500 362l14 34"/>' : ''}`,
  },
  {
    name: N('Растущий цветок'), n: 8, fps: 4, thumb: [7],
    tip: N('Цветок растёт понемногу. Жми «Копия» и дорисовывай новое.'),
    tips: {
      0: N('Из земли показался маленький росток.'),
      2: N('Стебель выше, и появился первый листик.'),
      4: N('Наверху завязался бутон.'),
      6: N('Бутон раскрывается!'),
      7: N('Цветок расцвёл. Раскрась его как захочешь!'),
    },
    scene: '<path d="M80 520H720"/>',
    pose: flower,
  },
  {
    name: N('Качающийся маятник'), n: 8, fps: 8, thumb: [0, 4], bare: [5, 6, 7],
    tip: N('Смотри на точки: у краёв они стоят тесно — там маятник замирает.'),
    bareTip: N('Обратно — без подсказки! Нарисуй маятник сама: нить от гвоздика до яркой точки.'),
    tips: {
      0: N('Маятник отвели в сторону. Здесь он на миг замирает.'),
      2: N('Середина пути: тут маятник летит быстрее всего.'),
      4: N('Другой край. Точки снова стоят тесно — маятник тормозит.'),
    },
    scene: `<path d="M300 70H500"/>${oval(400, 70, 9)}<path d="M${pt(...bob(4))}A360 360 0 0 0 ${pt(...bob(0))}"/>`,
    spot: bob,
    pose: i => line(PIVOT, reach(PIVOT, swing(i), 316)) + oval(...bob(i), 44),
  },
  {
    name: N('Улетающий шарик'), n: 8, fps: 8, thumb: [0, 4], mid: [1, 3, 5],
    tip: N('Шарик улетает вдаль: с каждым кадром он выше и меньше.'),
    midTip: N('Рыжий шарик — кадр до, голубой — кадр после. Нарисуй свой между ними, у яркой точки.'),
    tips: {
      0: N('Шарик совсем близко — он большой.'),
      7: N('Шарик уже далеко: маленький, как горошина.'),
    },
    spot: fly,
    pose: balloon,
  },
  {
    name: N('Машущая рука'), n: 8, fps: 8, thumb: [0, 4], mid: [1, 3, 5, 7],
    tip: N('Локоть стоит на месте, а ладонь качается по дуге.'),
    midTip: N('Рыжая рука — кадр до, голубая — кадр после. Нарисуй свою посередине между ними.'),
    tips: {
      0: N('Рука наклонилась влево. Локоть внизу — он не двигается.'),
      4: N('Рука дошла до правого края и сейчас пойдёт обратно.'),
    },
    scene: `<path d="M${pt(...waveSpot(0))}A480 480 0 0 1 ${pt(...waveSpot(4))}"/>`,
    spot: waveSpot,
    pose: i => `<g transform="rotate(${WAVE[i]} ${ELBOW[0]} ${ELBOW[1]})">${HAND}</g>`,
  },
  {
    name: N('Рыбка плывёт'), n: 10, fps: 8, thumb: [2, 8], mid: [1, 3, 5, 7],
    tip: N('Два движения сразу: рыбка плывёт вперёд, а хвост виляет.'),
    midTip: N('Рыбка — у яркой точки. А хвост? Посередине между рыжим и голубым.'),
    tips: {
      0: N('Рыбка только выплыла. Хвост пока смотрит прямо.'),
      9: N('Рыбка доплыла до края. В мультике она появится слева снова.'),
    },
    scene: '<path d="M40 548q90 -20 180 0t180 0t180 0t180 0"/>',
    spot: swim,
    pose: fish,
  },
  {
    name: N('Шагающий человечек'), n: 12, fps: 12, thumb: [2], mid: [1, 3, 5, 7, 9, 11],
    tip: N('Рука идёт вперёд вместе с другой ногой. Бледные линии — дальние рука и нога.'),
    midTip: N('Рыжий человечек — кадр до, голубой — после. Каждая рука и нога — посередине между ними.'),
    tips: {
      0: N('Одна нога прямая, другая согнута и шагает вперёд. Бледные линии — дальние рука и нога.'),
      6: N('Та же поза, но ноги поменялись: теперь вперёд идёт другая.'),
    },
    scene: '<path d="M120 506H680"/>',
    pose: walker,
  },
];

const LEVELS = LESSONS.map((L, i) => ({
  key: `anim:lesson-${i + 1}`,
  name: t(L.name),
  sub: framesOf(L.n),
  href: `${MENU}/lesson-${i + 1}`,
}));

// Playback asks for the exact pose of every frame, so that the motion of the
// lesson can be watched whole before she draws it.
function guide(L, i, exact) {
  const spots = L.spot ? Array.from({ length: L.n }, (_, k) => L.spot(k)) : [];
  let pose = `<g class="anim-g">${L.pose(i)}</g>`;
  if (!exact && L.mid?.includes(i)) {
    pose = `<g class="anim-g-ghost before">${L.pose(i - 1)}</g><g class="anim-g-ghost">${L.pose((i + 1) % L.n)}</g>`;
  } else if (!exact && L.bare?.includes(i)) {
    pose = '';
  }
  return `<g class="anim-g-fix">${L.scene || ''}</g>`
    + `<g class="anim-g-dots">${spots.map(s => oval(s[0], s[1], 6)).join('')}</g>${pose}`
    + (spots.length ? `<g class="anim-g-now">${oval(spots[i][0], spots[i][1], 10)}</g>` : '');
}

function lessonThumb(L) {
  const [a, b] = L.thumb;
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'anim-thumb' });
  s.innerHTML = `<g class="anim-g-fix">${L.scene || ''}</g>`
    + (b == null ? '' : `<g class="anim-g-ghost">${L.pose(b)}</g>`)
    + `<g class="anim-g">${L.pose(a)}</g>`;
  return s;
}

// ---- frames ----
function newFrame() {
  const th = canvas(TW, TH);
  const tx = th.getContext('2d', { willReadFrequently: true });
  tx.imageSmoothingQuality = 'high';
  return { c: canvas(W, H), th, tx, el: null, ink: 0, drawn: false, stale: false, blob: null, ver: 0 };
}

// Redraws the small picture and, on the way, measures how much ink it holds.
function paintThumb(f, src) {
  f.tx.clearRect(0, 0, TW, TH);
  f.tx.drawImage(src, 0, 0, TW, TH);
  const d = f.tx.getImageData(0, 0, TW, TH).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++;
  // A stray speck is not a drawing.
  f.ink = n >= 4 ? n : 0;
}

async function loadFrame(blob, drawn) {
  const f = newFrame();
  if (!blob) return f;
  try {
    const img = await loadImg(blob);
    f.c.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
    paintThumb(f, f.c);
    f.drawn = !!drawn;
    // Safari deletes a stored blob's file when its record is rewritten, so keep the bytes.
    f.blob = new Blob([await blob.arrayBuffer()], { type: 'image/png' });
  } catch { /* a damaged frame opens empty */ }
  return f;
}

// Safari hands back nothing when memory is short. Failing the save then keeps
// the last good copy instead of storing an empty frame over it.
async function png(c) {
  const b = await blobOf(c);
  if (!b) throw new Error('no PNG');
  return b;
}

async function encode(f) {
  if (f.blob) return f.blob;
  const v = f.ver;
  const b = await png(f.c);
  // A stroke made while the PNG was being written leaves the frame unsaved.
  if (f.ver === v) f.blob = b;
  return b;
}

// The frame with the most ink, on white, stands for the cartoon on the gallery wall.
async function cover(list) {
  const best = list.reduce((a, f) => (f.ink > a.ink ? f : a));
  const full = canvas(W, H);
  const x = full.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, W, H);
  x.drawImage(best.c, 0, 0);
  const small = canvas(480, 360);
  const sx = small.getContext('2d');
  sx.imageSmoothingQuality = 'high';
  sx.drawImage(full, 0, 0, 480, 360);
  try {
    return await Promise.all([png(small), png(full)]);
  } finally {
    // Safari gives canvas memory back late; an emptied canvas frees it at once.
    full.width = 0;
    small.width = 0;
  }
}

// The save that a screen starts when she leaves it. The next screen waits for
// it, so coming straight back never opens a cartoon older than the one she left.
let pending = Promise.resolve();
// Counts the openings of the studio: one that is still loading when she has
// already left and come back must not draw a second screen.
let visit = 0;

// ---- the list: a new cartoon, the lessons, her own cartoons ----
function menu(root) {
  const urls = [];
  let closed = false;
  const head = h('h2', { class: 'anim-head hidden' }, t('Мои мультики'));
  const mine = h('div', { class: 'anim-mine' });
  levelScreen(root, {
    title: t('Мультик'),
    hint: t('Мультик — это много рисунков подряд. Каждый урок открывает новый секрет аниматоров!'),
    levels: LEVELS.map((lv, i) => ({ ...lv, thumb: lessonThumb(LESSONS[i]) })),
    extra: h('div', { class: 'anim-top' },
      h('a', { class: 'anim-new', href: `${MENU}/new` },
        icon('plus', 36),
        h('span', {}, h('b', {}, t('Новый мультик')), h('small', {}, t('Чистые кадры и твоя история')))),
      h('h2', { class: 'anim-head' }, t('Уроки анимации')),
    ),
  });
  root.querySelector('.screen').append(head, mine);

  const card = it => {
    const url = URL.createObjectURL(it.thumb);
    urls.push(url);
    const href = `${MENU}/${it.id}`;
    const n = it.frames?.length || 0;
    // The saved title is the Russian key, so the gallery shows it in any language.
    const title = t(it.title);
    const el = h('div', { class: 'anim-card' },
      h('a', { href }, h('img', { src: url, alt: title })),
      h('div', { class: 'anim-card-foot' },
        h('a', { href, class: 'anim-card-text' }, h('b', {}, title), h('small', {}, framesOf(n))),
        iconBtn('trash', t('Удалить мультик'), async () => {
          if (!(await confirmBox(t('Удалить мультик «{title}» навсегда?', { title }), t('Удалить'), t('Оставить')))) return;
          try {
            await db.del('art', it.id);
            el.remove();
            head.classList.toggle('hidden', !mine.children.length);
          } catch {
            toast(t('Не получилось удалить. Попробуй ещё раз.'));
          }
        }),
      ),
    );
    return el;
  };
  pending.then(() => db.all('art')).then(items => {
    if (closed) return;
    const list = items.filter(it => it.kind === 'anim' && it.thumb).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    mine.append(...list.map(card));
    head.classList.toggle('hidden', !list.length);
  }).catch(() => {});

  return () => {
    closed = true;
    urls.forEach(u => URL.revokeObjectURL(u));
  };
}

// ---- the studio: a free cartoon, a lesson, or a saved cartoon ----
async function studio(root, arg) {
  const here = location.hash;
  const my = ++visit;
  const m = /^lesson-(\d+)$/.exec(arg);
  const index = m ? m[1] - 1 : -1;
  const L = LESSONS[index] || null;
  if (m && (!L || !isOpen(LEVELS, index))) { location.hash = MENU; return undefined; }
  // An unfinished lesson waits here; a finished one moves to the gallery.
  const draftId = `anim_lesson-${index + 1}`;

  await pending;
  let rec = null;
  try {
    if (L) rec = await db.get('kv', draftId);
    else if (arg !== 'new') rec = await db.get('art', arg);
  } catch { /* opens empty */ }
  if (!L && arg !== 'new' && rec?.kind !== 'anim') { location.hash = MENU; return undefined; }

  const frames = [];
  const blobs = rec?.frames || [];
  const count = L ? L.n : clamp(blobs.length, 1, MAX);
  // One at a time, so decoding never holds more than one extra sheet.
  for (let i = 0; i < count; i++) frames.push(await loadFrame(blobs[i], rec?.drawn?.[i]));
  // She may have left while the frames were loading.
  if (my !== visit || location.hash !== here) {
    for (const f of frames) f.c.width = 0;
    return undefined;
  }

  let cur = L ? clamp(rec?.cur | 0, 0, count - 1) : 0;
  let fps = SPEEDS.some(s => s[1] === rec?.fps) ? rec.fps : L?.fps || 8;
  let artId = !L && rec ? rec.id : null;
  const created = (!L && rec?.created) || Date.now();
  let saved = !!rec;
  let changed = false;
  let closed = false;
  let playing = false;
  let timer = 0;
  let at = 0;
  let onion = true;
  let hints = true;
  // Whether she had drawn in the current frame before she opened it this time.
  let before = false;
  // The stars of a lesson whose «Готово» is still saving. If she leaves before
  // the dialog, they are paid on the way out, so the list opens the next lesson.
  let owed = 0;

  const counts = f => f.ink > 0 && (!L || f.drawn);
  const tipFor = i => (L.mid?.includes(i) ? L.midTip : L.bare?.includes(i) ? L.bareTip : L.tips?.[i]) || L.tip;
  let said = L ? tipFor(cur) : '';

  // A play surface: the sheet, the guide, the onion skin and the player keep
  // their left-to-right geometry in Hebrew too.
  const stageEl = h('div', { class: 'stage-host', dir: 'ltr' });
  const p = new Painter(stageEl, { w: W, h: H, layers: 1, brush: 'pen', onChange: inked });
  const layer = p.layers[0];
  // A finger still on the sheet would finish its stroke in the wrong frame.
  const idle = () => !p.stroke;

  const guideSvg = L && svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'anim-guide' });
  const onionBox = h('div', { class: 'anim-onion' });
  p.under.append(...[guideSvg, onionBox].filter(Boolean));
  // Playback covers the sheet and shows the frame canvases themselves: no copies.
  const playGuide = L && svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'anim-guide' });
  const player = h('div', { class: 'anim-player hidden' }, playGuide);
  p.over.append(player);

  const tipEl = L && speaker(t(said));
  tipEl?.classList.add('anim-tip');
  const undoBtn = iconBtn('undo', t('Отменить'), () => { p.undo(); });
  const redoBtn = iconBtn('redo', t('Вернуть'), () => { p.redo(); });
  const onionBtn = iconBtn('layers', t('Калька: бледный прошлый кадр'), () => { onion = !onion; syncFrame(); });
  const hintBtn = L && iconBtn('eye', t('Подсказка'), () => { hints = !hints; syncFrame(); });
  const doneBtn = btn('primary', t('Готово'), L ? finishLesson : finishFree);

  const size = sizeSlider(p);
  const rail = brushRail(p, BRUSHES, { onPick: () => size.sync() });
  const pal = paletteBar(p, { colors: PALETTE, onPick: () => { rail.redraw(); size.sync(); } });

  const playBtn = btn('primary anim-play', '', () => (playing ? stopPlay() : play()));
  const speedBtns = SPEEDS.map(([name, v]) => h('button', {
    class: 'anim-speed',
    onclick: () => { sfx.pop(); setFps(v); },
  }, t(name)));
  // The film runs left to right in every language, like the lessons' motion.
  const strip = h('div', { class: 'anim-strip', dir: 'ltr' });
  const act = (ico, label, fn) => btn('ghost anim-act', [ico, h('span', {}, label)], fn);
  // A lesson keeps its number of frames, so there «Копия» fills the next one.
  const acts = L
    ? [act(glyph(COPY), t('Копия'), copyNext), act(icon('trash', 24), t('Стереть'), wipe)]
    : [act(icon('plus', 24), t('Кадр'), () => addFrame(false)), act(glyph(COPY), t('Копия'), () => addFrame(true)),
      act(icon('trash', 24), t('Убрать'), removeFrame)];

  const screen = h('div', { class: `screen anim-screen${L ? ' lesson' : ''}` },
    topbar(L ? t('Урок {n}', { n: index + 1 }) : t('Мультик'), { back: MENU, right: [tipEl, undoBtn, redoBtn, onionBtn, hintBtn, doneBtn] }),
    h('div', { class: 'anim-main' }, rail, stageEl,
      h('div', { class: 'anim-panel' }, playBtn, h('div', { class: 'anim-speeds' }, speedBtns), strip, h('div', { class: 'anim-acts' }, acts))),
    h('footer', { class: 'tools-foot' }, size, pal),
  );
  root.append(screen);
  stageEl.addEventListener('pointerdown', () => {
    if (playing) toast(t('Нажми «Стоп», чтобы рисовать дальше'));
  });

  // Runs after every stroke, undo and redo: all of them change the current frame.
  function inked() {
    const f = frames[cur];
    f.stale = true;
    // A stroke that was undone again leaves a copy just a copy.
    f.drawn = before || p.undoStack.length > 0;
    f.blob = null;
    f.ver++;
    changed = true;
    paintThumb(f, layer.c);
    syncTools();
    markFrames();
  }

  // The Painter's layer is the current frame; its own canvas catches up here.
  function commit() {
    const f = frames[cur];
    if (!f.stale) return;
    const x = f.c.getContext('2d');
    x.clearRect(0, 0, W, H);
    x.drawImage(layer.c, 0, 0);
    f.stale = false;
    // A PNG made while the frame was stale shows the old picture.
    f.blob = null;
    f.ver++;
  }

  function show(i) {
    cur = i;
    before = frames[i].drawn;
    layer.ctx.clearRect(0, 0, W, H);
    layer.ctx.drawImage(frames[i].c, 0, 0);
    // Undo belongs to one frame: it must never reach back into another.
    // Emptying the snapshots frees their memory at once on an iPad.
    for (const e of [...p.undoStack, ...p.redoStack]) e.snap.width = 0;
    p.undoStack.length = 0;
    p.redoStack.length = 0;
    p.undoArea = 0;
    p.log.length = 0;
    syncTools();
    syncFrame();
  }

  function select(i) {
    if (!idle()) return;
    stopPlay();
    if (i === cur) return;
    commit();
    show(i);
  }

  function markFrames(now = cur) {
    frames.forEach((f, i) => {
      f.el.classList.toggle('on', i === now);
      f.el.classList.toggle('ok', counts(f));
    });
  }

  function buildStrip() {
    frames.forEach((f, i) => {
      f.el ||= h('button', {
        class: 'anim-frame',
        onclick: () => { sfx.pop(); select(frames.indexOf(f)); },
      }, f.th, h('i'));
      f.el.lastChild.textContent = i + 1;
      f.el.setAttribute('aria-label', t('Кадр {n}', { n: i + 1 }));
    });
    strip.replaceChildren(...frames.map(f => f.el));
    strip.classList.toggle('dense', frames.length > 10);
  }

  function syncTools() {
    undoBtn.disabled = playing || !p.undoStack.length;
    redoBtn.disabled = playing || !p.redoStack.length;
    for (const b of acts) b.disabled = playing;
  }

  function syncFrame() {
    onionBtn.classList.toggle('on', onion);
    hintBtn?.classList.toggle('on', hints);
    // While it plays the frame canvases are with the player; «Стоп» comes back here.
    if (playing) return;
    const prev = onion && cur > 0 ? frames[cur - 1].c : null;
    if (prev) onionBox.replaceChildren(prev); else onionBox.textContent = '';
    if (L) {
      guideSvg.innerHTML = hints ? guide(L, cur) : '';
      // The tip is compared by its Russian key and translated only to be shown.
      const tip = tipFor(cur);
      if (tip !== said) {
        said = tip;
        tipEl.say(t(tip));
      }
    }
    markFrames();
    frames[cur].el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function step() {
    const f = frames[at];
    if (L) playGuide.innerHTML = hints ? guide(L, at, true) : '';
    if (f.c.parentNode !== player) {
      player.querySelector('canvas')?.remove();
      player.append(f.c);
    }
    markFrames(at);
    at = (at + 1) % frames.length;
  }

  function setPlaying(on) {
    playing = on;
    p.enabled = !on;
    player.classList.toggle('hidden', !on);
    screen.classList.toggle('playing', on);
    playBtn.classList.toggle('going', on);
    playBtn.replaceChildren(on ? glyph(STOP) : icon('play', 24), on ? t('Стоп') : t('Смотреть'));
    syncTools();
  }

  function play() {
    if (playing || !idle()) return;
    if (frames.length < 2) { toast(t('Мультику нужно хотя бы два кадра. Нажми «Кадр» или «Копия»!')); return; }
    commit();
    at = 0;
    setPlaying(true);
    step();
    timer = setInterval(step, 1000 / fps);
  }

  function stopPlay() {
    if (!playing) return;
    clearInterval(timer);
    setPlaying(false);
    player.querySelector('canvas')?.remove();
    syncFrame();
  }

  function setFps(v) {
    if (v !== fps) {
      fps = v;
      changed = true;
    }
    speedBtns.forEach((b, i) => b.classList.toggle('on', SPEEDS[i][1] === fps));
    if (playing) {
      clearInterval(timer);
      timer = setInterval(step, 1000 / fps);
    }
  }

  function fill(to, from) {
    const x = to.c.getContext('2d');
    x.clearRect(0, 0, W, H);
    x.drawImage(from.c, 0, 0);
    paintThumb(to, to.c);
    // The same picture is the same PNG, so the copy costs no encoding.
    to.blob = from.blob;
    to.ver++;
    to.drawn = false;
  }

  function addFrame(copy) {
    if (!idle()) return;
    if (frames.length >= MAX) { toast(t('В мультике помещается {n} кадров. Больше некуда!', { n: MAX })); return; }
    commit();
    const f = newFrame();
    if (copy) fill(f, frames[cur]);
    frames.splice(cur + 1, 0, f);
    changed = true;
    buildStrip();
    show(cur + 1);
  }

  async function copyNext() {
    if (!idle()) return;
    const to = frames[cur + 1];
    if (!to) { toast(t('Это последний кадр — дальше копировать некуда')); return; }
    if (!frames[cur].ink) { toast(t('Сначала нарисуй что-нибудь в этом кадре')); return; }
    if (to.ink && !(await confirmBox(t('В кадре {n} уже есть рисунок. Заменить его копией?', { n: cur + 2 }), t('Заменить'), t('Оставить')))) return;
    // A second finger may have picked another frame while the question was up.
    if (frames[cur + 1] !== to) return;
    commit();
    fill(to, frames[cur]);
    changed = true;
    show(cur + 1);
    toast(t('Это копия. Теперь измени её по подсказке!'));
  }

  // Undo is forgotten as soon as she changes frame, so she is asked first.
  async function wipe() {
    if (!idle()) return;
    const f = frames[cur];
    if (!f.ink) { toast(t('В этом кадре и так пусто')); return; }
    if (!(await confirmBox(t('Стереть весь рисунок в этом кадре?'), t('Стереть'), t('Оставить')))) return;
    if (frames[cur] === f && idle()) p.clearLayer();
  }

  async function removeFrame() {
    if (!idle()) return;
    if (frames.length === 1) { await wipe(); return; }
    const f = frames[cur];
    if (f.ink && !(await confirmBox(t('Убрать этот кадр из мультика?'), t('Убрать'), t('Оставить')))) return;
    if (frames[cur] !== f) return;
    frames.splice(cur, 1);
    changed = true;
    buildStrip();
    show(Math.min(cur, frames.length - 1));
  }

  async function persist() {
    commit();
    changed = false;
    // She may add or remove frames while the PNGs are being written.
    const list = frames.slice();
    try {
      const pngs = [];
      for (const f of list) pngs.push(await encode(f));
      if (L && !artId) {
        await db.put('kv', { id: draftId, frames: pngs, drawn: list.map(f => f.drawn), fps, cur });
      } else {
        const id = artId || newId('art');
        const [thumb, full] = await cover(list);
        await db.put('art', {
          id, kind: 'anim', title: L ? L.name : N('Мой мультик'), created, updated: Date.now(),
          w: W, h: H, fps, frames: pngs, thumb, full,
        });
        artId = id;
        // Opening the app again must return to this cartoon, not to a new one.
        if (!closed && location.hash === `${MENU}/new`) history.replaceState(null, '', `${MENU}/${id}`);
      }
      saved = true;
    } catch (e) {
      changed = true;
      throw e;
    }
  }
  // An untouched blank cartoon is not worth a place in the gallery.
  const saver = autosaver(() => changed && (saved || frames.some(f => f.ink)), persist, () => p.isBusy());

  async function finishLesson() {
    if (!idle()) return;
    stopPlay();
    const done = frames.filter(counts).length;
    if (!done) { toast(t('Сначала нарисуй хотя бы один кадр!')); return; }
    const n = frames.length;
    const stars = done === n ? 3 : done * 3 >= n * 2 ? 2 : 1;
    const copies = frames.some(f => f.ink && !f.drawn);
    const missing = frames.findIndex(f => !counts(f));
    // Only a complete lesson moves to the gallery; an unfinished one stays a draft she can go on with.
    const full = missing < 0;
    const fresh = full && !artId;
    if (fresh) artId = newId('art');
    changed = true;
    owed = stars;
    try {
      await safeSave(saver.flush);
    } catch {
      owed = 0;
      if (fresh) artId = null;
      return;
    }
    if (full) db.del('kv', draftId).catch(() => {});
    if (closed) return;
    owed = 0;
    finishLevel({
      levels: LEVELS, index, stars, menu: MENU,
      // With all frames drawn she watches it again; otherwise she goes on drawing.
      again: missing < 0 ? play : () => select(missing),
      text: stars === 3
        ? plural(n, 'Все {n} кадр нарисованы. Мультик уже в галерее!|Все {n} кадра нарисованы. Мультик уже в галерее!|Все {n} кадров нарисованы. Мультик уже в галерее!')
        : copies
          ? t('Готово {done} из {n}. Копия считается, когда ты в ней что-то изменишь. Нажми «Ещё раз» и дорисуй остальные кадры!', { done, n })
          : t('Готово {done} из {n}. Нажми «Ещё раз» и дорисуй остальные кадры!', { done, n }),
    });
  }

  async function finishFree() {
    if (!idle()) return;
    stopPlay();
    const done = frames.filter(counts).length;
    if (done < 2) {
      toast(done ? t('Мультику нужно хотя бы два кадра с рисунком. Нажми «Копия» и измени её!') : t('Сначала нарисуй первый кадр!'));
      return;
    }
    try {
      await safeSave(saver.flush);
    } catch {
      return;
    }
    const r = awardOnce('anim');
    if (closed) return;
    celebrate({
      title: t('Мультик готов, {name}!', { name: state.name }),
      text: r.gain ? t('Он уже в галерее. Держи звезду за сегодняшний мультик!') : t('Он уже в галерее.'),
      unlocked: r.unlocked,
      actions: [
        { label: t('Рисовать дальше') },
        { label: t('К мультикам'), primary: true, fn: () => { location.hash = MENU; } },
      ],
    });
  }

  buildStrip();
  setFps(fps);
  setPlaying(false);
  p.fit();
  show(cur);
  // A saved cartoon opens moving: first she watches, then she may go on drawing.
  if (!L && rec) play();

  return () => {
    closed = true;
    clearInterval(timer);
    if (owed) award(LEVELS[index].key, owed);
    saver.stop();
    const first = saver.flush();
    // The next screen waits for this try only, never for an answer to the error dialog.
    pending = first.catch(() => {});
    first.catch(() => safeSave(saver.flush)).catch(() => {}).finally(() => {
      p.destroy();
      for (const f of frames) f.c.width = 0;
    });
  };
}

export default function run(root, arg) {
  return arg ? studio(root, arg) : menu(root);
}
