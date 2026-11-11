// «По точкам»: connect numbered dots in order to reveal a hidden picture.
//
// The ladder follows the position in the list, which is sorted by dot count:
//   first third  - few dots, and the next dot glows softly: at once in the
//                  two teaching pictures, after a pause of a few seconds in
//                  the others, so that she reads the numbers herself;
//   middle third - more dots, nothing glows, she finds each number herself;
//   last third   - the most dots, numbered by skip-counting: by 2s first,
//                  then by 5s, and by 3s for the very last pictures.
// A wrong dot is one she taps, or one she drags the line onto.
// Stars depend only on mistakes: 0-1 gives 3, up to 4 gives 2, otherwise 1.
import { h, svgEl, clamp } from '../util.js';
import { topbar, iconBtn, speaker, confirmBox } from '../ui.js';
import { db } from '../store.js';
import { sfx } from '../audio.js';
import { levelScreen, finishLevel, starsOf, isOpen } from './kit.js';
import base from '../content/dots.js';
import moreA from '../content/dots-a.js';
import moreB from '../content/dots-b.js';

const MENU = '#/game/dots';
const W = 1000;
const H = 750;
const DOT_R = 9;
// Reach in screen pixels. The expected dot gets the widest one, so that a
// finger between two close dots always means the right one.
const TAP = 34;
const DRAG = 24;
const WRONG = 22;
// A dragged line has to run right over a wrong dot to count, and dots this
// close to the straight way to the right one are forgiven: fingers wobble.
const CORE = 14;
const PASS = 50;

const PICS = [...base, ...moreA, ...moreB].sort((a, b) => a.pts.length - b.pts.length);
const LEVELS = PICS.map(p => ({ key: `dots:${p.id}`, href: `${MENU}/${p.id}` }));
const SKIP_WORD = { 2: 'двойками', 3: 'тройками', 5: 'пятёрками' };

function rules(index) {
  const n = PICS.length;
  const tier = Math.floor(index * 3 / n);
  if (tier < 2) return { tier, step: 1 };
  const from = Math.ceil(n * 2 / 3);
  return { tier, step: [2, 5, 3][Math.floor((index - from) * 3 / (n - from))] };
}

function introOf(index, tier, step) {
  if (tier === 2) return `Тут счёт ${SKIP_WORD[step]}: ${step}, ${step * 2}, ${step * 3}… Каждый раз прибавляй ${step}.`;
  if (tier === 1) return 'Теперь точки не светятся: ищи следующее число сама.';
  if (index === 0) return 'Нажимай на точки по порядку: 1, 2, 3… Можно вести линию пальцем. Нужная точка светится.';
  if (index === 1) return 'Соединяй точки по порядку. Нужная точка светится.';
  return 'Ищи числа по порядку. Если долго ищешь, нужная точка засветится сама.';
}

const dotsWord = n => {
  const d = n % 10;
  const t = n % 100;
  if (d === 1 && t !== 11) return 'точка';
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? 'точки' : 'точек';
};

const outline = pts => `M${pts.map(p => p.join(' ')).join('L')}Z`;
const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

// Finds a spot for every number: beside its dot, and clear of the outline,
// of the other dots and of the numbers placed before it.
function placeLabels(P, texts) {
  const n = P.length;
  const cx = P.reduce((s, p) => s + p[0], 0) / n;
  const cy = P.reduce((s, p) => s + p[1], 0) / n;
  const placed = [];
  // One size for the whole picture; three-digit numbers need a smaller one.
  const fs = texts.some(t => t.length > 2) ? 22 : 26;
  return P.map(([x, y], i) => {
    const hw = texts[i].length * fs * 0.3 + 2;
    const hh = fs * 0.42;
    // Pointing away from both neighbours leaves the most room beside the
    // outline. On a straight run that is no direction at all, so there the
    // number moves away from the middle of the shape.
    const a = P[(i + n - 1) % n];
    const b = P[(i + 1) % n];
    let px = (x - a[0]) / far(P[i], a) + (x - b[0]) / far(P[i], b);
    let py = (y - a[1]) / far(P[i], a) + (y - b[1]) / far(P[i], b);
    if (Math.hypot(px, py) < 0.3) { px = x - cx; py = y - cy; }
    const pl = Math.hypot(px, py) || 1;
    // The number is wider than tall, so it is measured at three points.
    const reach = Math.max(0, hw - hh);
    let best = null;
    for (let k = 0; k < 16; k++) {
      const dx = Math.cos(k * Math.PI / 8);
      const dy = Math.sin(k * Math.PI / 8);
      const r = DOT_R + 5 + Math.abs(dx) * hw + Math.abs(dy) * hh;
      const qx = x + dx * r;
      const qy = y + dy * r;
      let room = Math.min(qx - hw, W - qx - hw, qy - hh, H - qy - hh);
      for (const sx of [qx - reach, qx, qx + reach]) {
        for (let j = 0; j < n; j++) {
          room = Math.min(room, segDist([sx, qy], P[j], P[(j + 1) % n]) - hh);
          if (j !== i) room = Math.min(room, far([sx, qy], P[j]) - hh - DOT_R);
        }
      }
      // A number must sit clearly nearer to its own dot than to any other.
      for (let j = 0; j < n; j++) if (j !== i) room = Math.min(room, (far([qx, qy], P[j]) - r) / 2);
      for (const o of placed) {
        room = Math.min(room, Math.max(Math.abs(o.x - qx) - o.hw - hw, Math.abs(o.y - qy) - o.hh - hh));
      }
      // Past a comfortable gap more room is worth nothing, and the side decides.
      const score = Math.min(room, 12) + 4 * (dx * px + dy * py) / pl;
      if (!best || score > best.score) best = { x: qx, y: qy, hw, hh, fs, score };
    }
    placed.push(best);
    return best;
  });
}

function thumb(pic) {
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dots-thumb' });
  s.append(svgEl('path', { d: outline(pic.pts), fill: pic.color }));
  for (const d of pic.extra || []) s.append(svgEl('path', { d, fill: 'none' }));
  return s;
}

function list(root) {
  levelScreen(root, {
    title: 'По точкам',
    hint: 'Соединяй точки по порядку и узнай, что спряталось. Чем дальше, тем точек больше!',
    levels: PICS.map((pic, i) => {
      const solved = starsOf(LEVELS[i].key) > 0;
      const { step } = rules(i);
      const n = pic.pts.length;
      return {
        ...LEVELS[i],
        // The name would give the secret away, so it waits for the first win.
        name: solved ? pic.name : 'Секрет',
        // Kept to one line: a taller card would push the picture into the badge.
        sub: `${n} ${dotsWord(n)}${step > 1 ? ` · счёт по ${step}` : ''}`,
        thumb: solved ? thumb(pic) : h('span', { class: 'dots-secret' }, '?'),
      };
    }),
  });
  return () => {};
}

function play(root, index) {
  const pic = PICS[index];
  const P = pic.pts;
  const N = P.length;
  const { tier, step } = rules(index);
  const saveId = `dots_${pic.id}`;
  const heading = `По точкам · ${index + 1}`;
  const intro = introOf(index, tier, step);

  let done = 0;       // dots joined so far; at N only the closing line is left
  let mistakes = 0;
  let misses = 0;     // wrong dots since the last right one
  let phase = 'load'; // load, play, solved, closed
  let drag = null;
  let timer = 0;
  let glowFor = '';
  let said = intro;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dots-svg' });
  const fill = svgEl('path', { d: outline(P), class: 'dots-fill', fill: pic.color });
  const lines = svgEl('g', { class: 'dots-lines' });
  const extra = svgEl('g', { class: 'dots-extra' });
  for (const d of pic.extra || []) extra.append(svgEl('path', { d }));
  const band = svgEl('line', { class: 'dots-band' });
  const glow = svgEl('circle', { class: 'dots-glow', r: 27 });
  const texts = P.map((_, i) => String((i + 1) * step));
  const spots = placeLabels(P, texts);
  const dots = P.map(([x, y], i) => {
    const g = svgEl('g', { class: i ? 'dots-dot' : 'dots-dot first' });
    const t = svgEl('text', { x: spots[i].x, y: spots[i].y, dy: '.35em', 'font-size': spots[i].fs });
    t.textContent = texts[i];
    g.append(svgEl('circle', { cx: x, cy: y, r: i ? DOT_R : DOT_R + 4 }), t);
    g.addEventListener('animationend', () => g.classList.remove('no'));
    return g;
  });
  svg.append(fill, lines, extra, band, glow, ...dots);

  const count = h('span', { class: 'dots-count' });
  const again = iconBtn('undo', 'Начать заново', async () => {
    if (await confirmBox('Начать эту картинку заново?', 'Заново', 'Нет') && phase === 'play') restart();
  });
  const bar = topbar(heading, { back: MENU, right: [count, again] });
  const title = bar.querySelector('h1');
  const bubble = speaker(intro);
  const sheet = h('div', { class: 'dots-sheet' }, svg);
  root.append(h('div', { class: 'screen dots-play' }, bar, bubble, h('div', { class: 'dots-host' }, sheet)));

  const tell = text => {
    if (text === said) return;
    said = text;
    bubble.say(text);
  };

  function addLine(a, b, fresh) {
    const p = svgEl('path', { d: `M${a.join(' ')}L${b.join(' ')}` });
    if (fresh) {
      p.style.setProperty('--len', Math.ceil(far(a, b)) + 1);
      p.classList.add('new');
    }
    lines.append(p);
  }

  function refresh() {
    dots.forEach((g, i) => {
      g.classList.toggle('done', i < done);
      g.classList.toggle('here', done > 0 && i === done - 1);
    });
    count.textContent = `${done} / ${N}`;
    again.disabled = phase !== 'play' || !done;
    const next = P[done % N];
    glow.setAttribute('cx', next[0]);
    glow.setAttribute('cy', next[1]);
    // Past the two teaching pictures the glow waits a few seconds (in CSS):
    // it is for a girl who is stuck, not a way around reading the numbers.
    const late = tier === 0 && index > 1 && misses === 0;
    if (glowFor !== `${done} ${late}`) {
      // A new dot or a new reason: the pulse and its wait start over.
      glowFor = `${done} ${late}`;
      glow.classList.remove('on');
      glow.getBoundingClientRect();
    }
    glow.classList.toggle('late', late);
    // Three misses in a row mean she is stuck, so the dot shows itself.
    glow.classList.toggle('on', phase === 'play' && (tier === 0 || misses >= 3));
    if (phase === 'play') {
      tell(done === N ? 'Осталась одна линия: вернись к самой первой точке!'
        : misses >= 3 && tier > 0 ? 'Подсказка: нужная точка светится.' : intro);
    }
  }

  function redraw() {
    lines.textContent = '';
    for (let i = 1; i < done; i++) addLine(P[i - 1], P[i], false);
    refresh();
  }

  const store = () => {
    db.put('kv', { id: saveId, done, mistakes }).catch(() => {});
  };

  function restart() {
    clearTimeout(timer);
    done = 0;
    mistakes = 0;
    misses = 0;
    phase = 'play';
    sheet.classList.remove('solved');
    title.textContent = heading;
    db.del('kv', saveId).catch(() => {});
    redraw();
  }

  function solve() {
    addLine(P[N - 1], P[0], true);
    phase = 'solved';
    drag = null;
    band.classList.remove('on');
    sheet.classList.add('solved');
    title.textContent = pic.name;
    sfx.ding();
    refresh();
    tell(`Вот что спряталось: «${pic.name}»!`);
    const stars = mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1;
    const text = `Это «${pic.name}». ${mistakes === 0 ? 'Ни одной ошибки!'
      : mistakes === 1 ? 'Всего одна ошибка!' : `Ошибок: ${mistakes}. Без спешки выйдет ещё лучше.`}`;
    // A moment to look at the picture before the dialog covers it. The saved
    // progress stays until then, so leaving right now does not lose the level.
    timer = setTimeout(() => {
      db.del('kv', saveId).catch(() => {});
      finishLevel({ levels: LEVELS, index, stars, text, menu: MENU, again: restart });
    }, 1700);
  }

  function connect() {
    if (done === N) { solve(); return; }
    if (done > 0) addLine(P[done - 1], P[done], true);
    done++;
    misses = 0;
    if (drag) drag.missed = false;
    sfx.pop();
    store();
    refresh();
  }

  // Sheet units per screen pixel, so a reach stays finger-sized on any screen.
  const unit = () => 1 / svg.getScreenCTM().a;
  const toSheet = e => {
    const m = svg.getScreenCTM().inverse();
    return [m.a * e.clientX + m.c * e.clientY + m.e, m.b * e.clientX + m.d * e.clientY + m.f];
  };

  // The finger can jump a long way between two events, so its whole step
  // from the last place counts, not only where it is now.
  function reachNext(p, px, from = p) {
    if (segDist(P[done % N], from, p) > px * unit()) return false;
    connect();
    return true;
  }

  function wrongAt(p, px, from = p) {
    let near = -1;
    let d = px * unit();
    P.forEach((q, i) => {
      const dq = segDist(q, from, p);
      if (dq <= d) { d = dq; near = i; }
    });
    // Joined dots are never wrong: her finger rests on them all the time.
    return near < done ? -1 : near;
  }

  function miss(i) {
    // One wrong guess per line: a finger that wanders on over more dots, or
    // lifts where it went wrong, is still making the same mistake.
    if (drag.missed) return;
    drag.missed = true;
    mistakes++;
    misses++;
    sfx.soft();
    // Restarts the shake when she hits the same dot again straight away.
    dots[i].classList.remove('no');
    dots[i].getBoundingClientRect();
    dots[i].classList.add('no');
    store();
    refresh();
  }

  function stretch(p) {
    const on = phase === 'play' && drag?.moved && done > 0;
    band.classList.toggle('on', !!on);
    if (!on) return;
    const [x, y] = P[done - 1];
    band.setAttribute('x1', x);
    band.setAttribute('y1', y);
    band.setAttribute('x2', p[0]);
    band.setAttribute('y2', p[1]);
  }

  svg.addEventListener('pointerdown', e => {
    if (phase !== 'play') return;
    // One finger draws and a second one is ignored. But the pencil wins over
    // a resting palm, and a finger whose lift got lost must not block her.
    if (drag && e.pointerType !== 'pen' && !(e.isPrimary && e.pointerType === drag.type)) return;
    e.preventDefault();
    const p = toSheet(e);
    drag = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, p, moved: false, missed: false };
    try { svg.setPointerCapture(e.pointerId); } catch { /* finger already gone */ }
    if (reachNext(p, TAP)) return;
    const i = wrongAt(p, WRONG);
    if (i >= 0) miss(i);
  });
  svg.addEventListener('pointermove', e => {
    if (phase !== 'play' || e.pointerId !== drag?.id) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12) drag.moved = true;
    const p = toSheet(e);
    const from = drag.p;
    drag.p = p;
    let joined = false;
    while (phase === 'play' && reachNext(p, DRAG, from)) joined = true;
    // A line stretched over a wrong dot is a wrong answer, just like a tap.
    if (!joined && drag.moved && done > 0) {
      const i = wrongAt(p, CORE, from);
      if (i >= 0 && segDist(P[i], P[done - 1], P[done]) > PASS * unit()) miss(i);
    }
    stretch(p);
  });
  const lift = e => {
    if (e.pointerId !== drag?.id) return;
    if (e.type === 'pointerup' && drag.moved && phase === 'play') {
      const p = toSheet(e);
      const i = wrongAt(p, WRONG);
      // A line dropped on a wrong dot is wrong too, but lifting the finger
      // beside the dot she has just reached is not a guess.
      if (i >= 0 && !(done > 0 && far(p, P[done - 1]) <= TAP * unit())) miss(i);
    }
    drag = null;
    band.classList.remove('on');
  };
  svg.addEventListener('pointerup', lift);
  svg.addEventListener('pointercancel', lift);
  svg.addEventListener('lostpointercapture', lift);

  refresh();
  db.get('kv', saveId).catch(() => null).then(saved => {
    if (phase === 'closed') return;
    if (saved && Number.isInteger(saved.done) && saved.done > 0 && saved.done <= N) {
      done = saved.done;
      mistakes = saved.mistakes | 0;
    }
    phase = 'play';
    redraw();
  });

  return () => {
    // Every handler checks the phase, so nothing can score on a dead screen.
    phase = 'closed';
    clearTimeout(timer);
  };
}

export default function run(root, arg) {
  if (!arg) return list(root);
  const index = PICS.findIndex(p => p.id === arg);
  if (index < 0 || !isOpen(LEVELS, index)) {
    location.hash = MENU;
    return () => {};
  }
  return play(root, index);
}
