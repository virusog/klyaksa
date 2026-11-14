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
import { t, N, plural } from '../i18n.js';
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
// Numbers: type sizes from the first choice down, gaps between a dot and its
// number, how far around a dot to look, and how much room counts as plenty
// (ROOMY) and as enough to keep a type size (CLEAR). All in sheet units.
const SIZES = [26, 22, 19];
const GAPS = [4, 9, 15];
const NEAR = 130;
const ROOMY = 8;
const CLEAR = 4;
const ROUNDS = 3;
const RAYS = Array.from({ length: 24 }, (_, k) => [Math.cos(k * Math.PI / 12), Math.sin(k * Math.PI / 12)]);

const PICS = [...base, ...moreA, ...moreB].sort((a, b) => a.pts.length - b.pts.length);
const LEVELS = PICS.map(p => ({ key: `dots:${p.id}`, href: `${MENU}/${p.id}` }));
const SKIP_WORD = { 2: N('двойками'), 3: N('тройками'), 5: N('пятёрками') };

function rules(index) {
  const n = PICS.length;
  const tier = Math.floor(index * 3 / n);
  if (tier < 2) return { tier, step: 1 };
  const from = Math.ceil(n * 2 / 3);
  return { tier, step: [2, 5, 3][Math.floor((index - from) * 3 / (n - from))] };
}

function introOf(index, tier, step) {
  if (tier === 2) {
    return t('Тут счёт {how}: {a}, {b}, {c}… Каждый раз прибавляй {step}.',
      { how: t(SKIP_WORD[step]), a: step, b: step * 2, c: step * 3, step });
  }
  if (tier === 1) return t('Теперь точки не светятся: ищи следующее число сама.');
  if (index === 0) return t('Нажимай на точки по порядку: 1, 2, 3… Можно вести линию пальцем. Нужная точка светится.');
  if (index === 1) return t('Соединяй точки по порядку. Нужная точка светится.');
  return t('Ищи числа по порядку. Если долго ищешь, нужная точка засветится сама.');
}

const outline = pts => `M${pts.map(p => p.join(' ')).join('L')}Z`;
const far = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

// Sheet distance between two segments.
function segGap(a, b, c, d) {
  const side = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return 0;
  return Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b));
}

// Finds a spot for every number at one type size: beside its own dot, clearly
// farther from every other dot, and clear of the outline and of the other
// numbers. Returns the spots and the room of the tightest one (below zero
// something touches, from ROOMY up nothing is even close).
function layout(P, texts, fs) {
  const n = P.length;
  const hh = fs * 0.4;
  const hws = texts.map(t => t.length * fs * 0.3 + 1);
  const cx = P.reduce((s, p) => s + p[0], 0) / n;
  const cy = P.reduce((s, p) => s + p[1], 0) / n;
  // Only what lies near a dot can get in the way of its number.
  const all = P.map((_, i) => i);
  const dotsBy = P.map((p, i) => all.filter(j => j !== i && far(p, P[j]) < NEAR));
  const linesBy = P.map(p => all.filter(j => segDist(p, P[j], P[(j + 1) % n]) < NEAR));
  const spots = new Array(n).fill(null);

  // A number is measured as a lying capsule: a and b are the ends of its core.
  // Below `floor` the spot has lost already and the exact figure is not needed.
  const roomAt = (i, x, y, own, floor = -Infinity) => {
    const hw = hws[i];
    const a = [x - hw + hh, y];
    const b = [x + hw - hh, y];
    let room = Math.min(x - hw, W - x - hw, y - hh, H - y - hh) - 6;
    for (const j of linesBy[i]) {
      const clear = segGap(a, b, P[j], P[(j + 1) % n]) - hh - 3;
      // A line drawn only after this dot is joined meets a number that has
      // already faded, so lying across one is a fair last resort. The dot's
      // own two lines never count as such.
      const later = j > i && (j + 1) % n !== i;
      room = Math.min(room, later ? Math.max(clear, CLEAR - 2) : clear);
      if (room < floor) return room;
    }
    for (const j of dotsBy[i]) {
      if (room < floor) return room;
      // The gap to another dot against the gap to its own: this is what
      // tells her whose number it is.
      room = Math.min(room, (segDist(P[j], a, b) - hh - own) * 0.7);
      const o = spots[j];
      // Side by side two numbers read as one long number, so that way they
      // keep a wider gap than one above the other.
      if (o) room = Math.min(room, Math.max((Math.abs(o.x - x) - o.hw - hw) * 0.5, Math.abs(o.y - y) - 2 * hh));
    }
    return room;
  };

  const place = i => {
    const [x, y] = P[i];
    const hw = hws[i];
    const reach = hw - hh;
    // Pointing away from both neighbours leaves the most room beside the
    // outline. On a straight run that is no direction at all, so there the
    // number moves away from the middle of the shape.
    const p = P[(i + n - 1) % n];
    const q = P[(i + 1) % n];
    let px = (x - p[0]) / far(P[i], p) + (x - q[0]) / far(P[i], q);
    let py = (y - p[1]) / far(P[i], p) + (y - q[1]) / far(P[i], q);
    if (Math.hypot(px, py) < 0.3) { px = x - cx; py = y - cy; }
    const pl = Math.hypot(px, py) || 1;
    let best = null;
    for (const gap of GAPS) {
      // A number that sits well right beside its dot need not look farther.
      if (best && best.room >= ROOMY) break;
      // The start dot is drawn bigger than the rest.
      const own = DOT_R + (i ? 0 : 6) + gap;
      for (const [dx, dy] of RAYS) {
        // How far along this ray the capsule sits exactly `own` from the dot.
        const d = own + hh;
        const t = d * Math.abs(dx) <= reach * Math.abs(dy) ? d / Math.abs(dy)
          : Math.abs(dx) * reach + Math.sqrt(d * d - reach * reach * dy * dy);
        // Past a comfortable gap more room is worth nothing: then the side
        // decides, and the nearer of two equal spots wins.
        const side = (dx * px + dy * py) / pl - gap * 0.2;
        const room = roomAt(i, x + dx * t, y + dy * t, own, best ? best.score - side : -Infinity);
        const score = Math.min(room, ROOMY) + side;
        if (!best || score > best.score) best = { x: x + dx * t, y: y + dy * t, hw, fs, own, room, score };
      }
    }
    spots[i] = best;
  };

  // The most crowded dots choose first, then everyone looks again, now
  // seeing where the others have settled. The next round starts afresh with
  // the numbers that came out tightest choosing first; the best round wins.
  const crowd = P.map((p, i) => Math.min(...dotsBy[i].map(j => far(p, P[j])), NEAR));
  let order = all.slice().sort((i, j) => crowd[i] - crowd[j]);
  let best = null;
  for (let round = 0; round < ROUNDS; round++) {
    spots.fill(null);
    order.forEach(place);
    order.forEach(place);
    const rooms = spots.map((s, i) => roomAt(i, s.x, s.y, s.own));
    const room = Math.min(...rooms);
    const sum = rooms.reduce((t, r) => t + Math.min(r, ROOMY), 0);
    if (!best || room > best.room || (room === best.room && sum > best.sum)) best = { spots: spots.slice(), room, sum };
    if (room >= ROOMY) break;
    order = all.slice().sort((i, j) => rooms[i] - rooms[j]);
  }
  return best;
}

// The biggest type that leaves every number easy to tell from its neighbours.
function placeLabels(P, texts) {
  let best = null;
  for (const fs of SIZES) {
    const got = layout(P, texts, fs);
    if (!best || got.room > best.room) best = got;
    if (got.room >= CLEAR) break;
  }
  return best.spots;
}

function thumb(pic) {
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'dots-thumb' });
  s.append(svgEl('path', { d: outline(pic.pts), fill: pic.color }));
  for (const d of pic.extra || []) s.append(svgEl('path', { d, fill: 'none' }));
  return s;
}

function list(root) {
  levelScreen(root, {
    title: t('По точкам'),
    hint: t('Соединяй точки по порядку и узнай, что спряталось. Чем дальше, тем точек больше!'),
    levels: PICS.map((pic, i) => {
      const solved = starsOf(LEVELS[i].key) > 0;
      const { step } = rules(i);
      const n = pic.pts.length;
      return {
        ...LEVELS[i],
        // The name would give the secret away, so it waits for the first win.
        name: solved ? t(pic.name) : t('Секрет'),
        // Kept to one line: a taller card would push the picture into the badge.
        sub: plural(n, '{n} точка|{n} точки|{n} точек') + (step > 1 ? ' · ' + t('счёт по {step}', { step }) : ''),
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
  const heading = t('По точкам · {n}', { n: index + 1 });
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

  // "3 / 14": a count, read left to right in Hebrew too.
  const count = h('span', { class: 'dots-count', dir: 'ltr' });
  const again = iconBtn('undo', t('Начать заново'), async () => {
    if (await confirmBox(t('Начать эту картинку заново?'), t('Заново'), t('Нет')) && phase === 'play') restart();
  });
  const bar = topbar(heading, { back: MENU, right: [count, again] });
  const title = bar.querySelector('h1');
  const bubble = speaker(intro);
  // A play surface: the picture and its numbers keep their left-to-right geometry.
  const sheet = h('div', { class: 'dots-sheet', dir: 'ltr' }, svg);
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
      tell(done === N ? t('Осталась одна линия: вернись к самой первой точке!')
        : misses >= 3 && tier > 0 ? t('Подсказка: нужная точка светится.') : intro);
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
    title.textContent = t(pic.name);
    sfx.ding();
    refresh();
    tell(t('Вот что спряталось: «{name}»!', { name: t(pic.name) }));
    const stars = mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1;
    const verdict = mistakes === 0 ? t('Ни одной ошибки!')
      : mistakes === 1 ? t('Всего одна ошибка!') : t('Ошибок: {n}. Без спешки выйдет ещё лучше.', { n: mistakes });
    const text = t('Это «{name}».', { name: t(pic.name) }) + ' ' + verdict;
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
