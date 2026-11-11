// «Диктант по клеточкам»: squared paper, a start point and a list of commands
// such as "3 →". Following them cell by cell draws a closed picture.
//
// The ladder. Pictures are sorted by number of commands (11 at the start, 46 at
// the end), and the help shrinks by position in that list:
//   first third   the current command is large and highlighted, with the cells
//                 left in it counted down;
//   middle third  the whole list is visible but nothing is ticked off: she
//                 keeps her own place and counts cells herself;
//   last third    four commands at a time: read, hide, draw from memory.
//                 Peeking is allowed but caps the level at two stars.
import { h, svgEl } from '../util.js';
import { topbar, btn, speaker, confirmBox } from '../ui.js';
import { db } from '../store.js';
import { sfx } from '../audio.js';
import { levelScreen, finishLevel, starsOf, isOpen, parseMoves } from './kit.js';
import BASE from '../content/dictation.js';
import MORE_A from '../content/dictation-a.js';
import MORE_B from '../content/dictation-b.js';

const COLS = 20;
const ROWS = 14;
const Z = 40;       // one cell in drawing units
const EDGE = 20;    // paper around the grid, so the outer points can be reached
const MENU = '#/game/dictation';
const GROUP = 4;    // commands shown at once in the memory levels

// In cells. The pencil can be picked up from a little beside its point, and
// follows the finger from there (SLIP caps how far beside, so the edge of the
// sheet stays within reach). A right step counts generously; a wrong one has
// to be deliberate, so a finger that slides a little too far is not punished.
const GRAB = 1;
const SLIP = 0.75;
const NEAR = 0.45;
const SURE = 0.25;

// One broken picture must not take the whole game down, so it is left out.
const PICS = [...BASE, ...MORE_A, ...MORE_B].flatMap(p => {
  try { return [{ ...p, cmds: parseMoves(p.moves) }]; } catch { return []; }
});
// Diagonal steps are harder to follow than straight ones, so they weigh half a command more.
const weight = p => p.cmds.length + p.cmds.filter(c => c[0] && c[1]).length / 2;
PICS.sort((a, b) => weight(a) - weight(b));

const tierOf = i => Math.min(2, Math.floor(i * 3 / PICS.length));
const TIER_NAME = ['с подсказкой', 'следи сама', 'по памяти'];
const INTRO = [
  'Веди линию от красной точки. Число — сколько клеточек, стрелка — куда.',
  'Теперь я не подсвечиваю. Следи сама, какая команда на очереди!',
  'Запомни четыре команды, нажми «Запомнила» и рисуй по памяти.',
];
const OOPS = [
  ['Не туда. Посмотри на жёлтую команду.', 'Не спеши, посчитай клеточки.'],
  ['Не туда. Найди в списке свою команду.', 'Не спеши, посчитай клеточки.'],
  ['Не туда. Вспомни, что было дальше.', 'Не спеши, посчитай клеточки.'],
];
// Said after three wrong tries in a row, so she is never stuck.
const HELP = [
  'Смотри на жёлтую карточку: там число и стрелка.',
  'Смотри, я подсветила, где ты сейчас.',
  'Забыла? Можно подсмотреть, это не страшно.',
];

// Said when a half-drawn sheet is opened again.
const RESUME = [
  'Продолжаем с того места, где ты остановилась.',
  'Продолжаем! Я подсветила, где ты остановилась.',
  'Продолжаем! Вот команды ещё раз.',
];

const KEYS = [
  [-1, -1, 'Влево вверх'], [0, -1, 'Вверх'], [1, -1, 'Вправо вверх'],
  [-1, 0, 'Влево'], null, [1, 0, 'Вправо'],
  [-1, 1, 'Влево вниз'], [0, 1, 'Вниз'], [1, 1, 'Вправо вниз'],
];

const plural = (n, one, few, many) => {
  const d = n % 10;
  const t = n % 100;
  return d === 1 && t !== 11 ? one : d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
};

// Drawn, not typed: iPad shows some arrow characters as emoji.
const arrow = (dx, dy) => h('span', {
  class: 'dictation-arrow',
  html: `<svg viewBox="0 0 24 24"><path transform="rotate(${Math.atan2(dy, dx) * 180 / Math.PI} 12 12)" d="M3 12h17M13 5l7 7-7 7"/></svg>`,
});

// Two digits get the class 'wide' and smaller type, so one digit can be large.
const chip = ([dx, dy, n], cls = '') => h('span', { class: `dictation-chip ${n > 9 ? 'wide' : ''} ${cls}` }, String(n), arrow(dx, dy));

// Every command at once. More commands get more columns, so that the list
// never has to scroll: she could not keep her place in a list that moves.
function chipList(chips) {
  const n = chips.length;
  const across = n <= 24 ? 4 : n <= 40 ? 5 : 6;
  const upright = n <= 24 ? 6 : n <= 40 ? 8 : 10;
  return h('div', {
    class: 'dictation-list',
    style: `--cl:${across};--rl:${Math.ceil(n / across)};--cp:${upright};--rp:${Math.ceil(n / upright)}`,
  }, chips);
}

// Every grid point the line visits, and for each cell the command it belongs to.
function trace(pic) {
  const pts = [pic.start];
  const steps = [];
  pic.cmds.forEach(([dx, dy, n], ci) => {
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[pts.length - 1];
      pts.push([x + dx, y + dy]);
      steps.push(ci);
    }
  });
  return { pts, steps };
}

const at = ([x, y]) => `${x * Z},${y * Z}`;

function gridPath() {
  let d = '';
  for (let i = 0; i <= COLS; i++) d += `M${i * Z} 0V${ROWS * Z}`;
  for (let i = 0; i <= ROWS; i++) d += `M0 ${i * Z}H${COLS * Z}`;
  return d;
}

// The card shows the picture only once she has drawn it.
function thumb(pic, solved) {
  const s = svgEl('svg', { viewBox: `${-EDGE} ${-EDGE} ${COLS * Z + 2 * EDGE} ${ROWS * Z + 2 * EDGE}`, width: 110, height: 79, class: 'dictation-thumb' });
  s.append(svgEl('path', { d: gridPath(), class: 'dictation-grid' }));
  if (solved) {
    s.append(svgEl('polygon', { points: trace(pic).pts.map(at).join(' '), fill: pic.color, class: 'dictation-thumb-pic' }));
  } else {
    const q = svgEl('text', { x: COLS * Z / 2, y: ROWS * Z / 2, class: 'dictation-thumb-q' });
    q.textContent = '?';
    s.append(q);
  }
  return s;
}

const levels = () => PICS.map((p, i) => {
  const key = `dictation:${p.id}`;
  const solved = starsOf(key) > 0;
  const n = p.cmds.length;
  return {
    key,
    name: solved ? p.name : 'Загадка',
    sub: `${n} ${plural(n, 'команда', 'команды', 'команд')}\n${TIER_NAME[tierOf(i)]}`,
    href: `${MENU}/${p.id}`,
    thumb: thumb(p, solved),
  };
});

function play(root, list, index) {
  const pic = PICS[index];
  const tier = tierOf(index);
  const saveId = `dictation_${pic.id}`;
  const { pts, steps } = trace(pic);
  const first = pic.cmds.map((_, ci) => steps.indexOf(ci));
  const total = steps.length;

  let done = 0;             // cells drawn so far
  let mistakes = 0;
  let missRun = 0;          // wrong tries in a row
  let back = false;         // just returned to a half-drawn sheet
  let peeked = false;
  let shown = tier === 2;   // memory levels: the commands are on screen, the pencil waits
  let ready = false;        // until the saved progress has been read
  let over = false;
  let alive = true;
  let drag = null;
  let endTimer = 0;

  const cmdAt = () => steps[done];
  const isNext = (dx, dy) => pic.cmds[cmdAt()][0] === dx && pic.cmds[cmdAt()][1] === dy;

  const voice = speaker(INTRO[tier]);
  // The same remark is not repeated: with the voice on, it would nag.
  let said = INTRO[tier];
  const say = text => { if (text !== said) voice.say(said = text); };
  // A failed save only costs her the resume, so it must not interrupt the game.
  const save = () => db.put('kv', { id: saveId, done, mistakes, peeked }).catch(() => {});
  const forget = () => db.del('kv', saveId).catch(() => {});

  // ---- the sheet -----------------------------------------------------------
  const line = svgEl('polyline', { class: 'dictation-line' });
  const band = svgEl('line', { class: 'dictation-band' });
  const cursor = svgEl('g', { class: 'dictation-cursor' });
  cursor.append(svgEl('circle', { r: 19, class: 'dictation-halo' }), svgEl('circle', { r: 11 }));
  const svg = svgEl('svg', { viewBox: `${-EDGE} ${-EDGE} ${COLS * Z + 2 * EDGE} ${ROWS * Z + 2 * EDGE}`, class: 'dictation-svg' });
  svg.append(
    svgEl('path', { d: gridPath(), class: 'dictation-grid' }),
    svgEl('polygon', { points: pts.map(at).join(' '), fill: pic.color, class: 'dictation-fill' }),
    line,
    band,
    cursor,
    // On top of the pencil point, so the start stays red while she stands on it.
    svgEl('circle', { cx: pic.start[0] * Z, cy: pic.start[1] * Z, r: 7, class: 'dictation-start' }),
  );
  const board = h('div', { class: 'dictation-board' }, svg);

  // ---- the commands, one view per kind of level ------------------------------
  function guidedView() {
    const now = h('div', { class: 'dictation-now' });
    const chips = pic.cmds.map(c => chip(c));
    const all = chipList(chips);
    return {
      el: h('div', { class: 'dictation-guided' }, now, all),
      update() {
        const ci = cmdAt();
        const [dx, dy, n] = pic.cmds[ci];
        const left = n - (done - first[ci]);
        chips.forEach((c, i) => { c.classList.toggle('done', i < ci); c.classList.toggle('cur', i === ci); });
        now.replaceChildren(
          h('b', {}, String(n), arrow(dx, dy)),
          h('span', { class: 'dictation-dots' }, Array.from({ length: n }, (_, i) => h('i', { class: i < n - left ? 'on' : '' }))),
          h('small', {}, `ещё ${left} ${plural(left, 'клеточка', 'клеточки', 'клеточек')}`),
        );
        all.scrollTop = chips[ci].offsetTop - all.clientHeight / 2;
      },
    };
  }

  function listView() {
    const chips = pic.cmds.map(c => chip(c));
    const el = chipList(chips);
    return {
      el,
      // Her place is shown only as a rescue, and only until the next right step.
      // After a break it is one too: nobody finds their place in thirty commands.
      update() {
        const lost = missRun >= 3 || back;
        chips.forEach((c, i) => c.classList.toggle('cur', lost && i === cmdAt()));
        if (lost) el.scrollTop = chips[cmdAt()].offsetTop - el.clientHeight / 2;
      },
    };
  }

  function memoryView() {
    const el = h('div', { class: 'dictation-mem' });
    const hide = () => { shown = false; say('Теперь рисуй по памяти.'); paint(); };
    const peek = () => { shown = true; peeked = true; save(); paint(); };
    return {
      el,
      update() {
        const ci = cmdAt();
        const from = ci - ci % GROUP;
        const part = pic.cmds.slice(from, from + GROUP);
        const to = from + part.length;
        el.replaceChildren(
          h('small', {}, to - from > 1 ? `Команды ${from + 1}–${to} из ${pic.cmds.length}` : `Команда ${to} из ${pic.cmds.length}`),
          h('div', { class: 'dictation-cards' }, part.map((c, i) => {
            const passed = from + i < ci ? 'done' : '';
            return shown ? chip(c, `big ${passed}`) : h('span', { class: `dictation-chip big hid ${passed}` }, passed ? '✓' : '?');
          })),
          shown ? btn('primary', 'Запомнила', hide) : btn('ghost', 'Подсмотреть', peek),
          h('small', {}, shown ? 'Читай слева направо.'
            : peeked ? 'В этот раз будет не больше двух звёзд.' : 'Подсмотришь — будет не больше двух звёзд.'),
        );
      },
    };
  }

  const view = [guidedView, listView, memoryView][tier]();
  const cmdsBox = h('div', { class: 'dictation-cmds' }, view.el);
  const missChip = h('span', { class: 'dictation-count' });

  function paint() {
    line.setAttribute('points', pts.slice(0, done + 1).map(at).join(' '));
    cursor.setAttribute('transform', `translate(${at(pts[done])})`);
    board.classList.toggle('wait', shown);
    missChip.textContent = `Ошибок: ${mistakes}`;
    if (!over) view.update();
  }

  // ---- the rules -----------------------------------------------------------
  function endDrag() {
    drag = null;
    band.classList.remove('on', 'bad');
  }

  function finish() {
    over = true;
    endDrag();
    board.classList.add('done');
    bar.querySelector('h1').textContent = pic.name;
    cmdsBox.replaceChildren(h('div', { class: 'dictation-reveal' }, h('small', {}, 'Получилось:'), h('b', {}, pic.name)));
    sfx.fill();
    say('Линия замкнулась!');
    paint();
    const stars = Math.min(peeked ? 2 : 3, mistakes <= 1 ? 3 : mistakes <= 4 ? 2 : 1);
    const text = (mistakes === 0 ? 'Ни одной ошибки!'
      : mistakes === 1 ? 'Всего одна ошибка!'
      : `${mistakes} ${plural(mistakes, 'ошибка', 'ошибки', 'ошибок')}. Чем их меньше, тем больше звёзд.`)
      + (peeked && mistakes <= 1 ? ' Без подсмотра будет три звезды.' : '');
    // A pause, so she sees the picture fill before the dialog covers it. The
    // saved progress goes only with the stars: if she leaves during the pause,
    // one last cell is left to draw, not the whole picture.
    endTimer = setTimeout(() => {
      forget();
      finishLevel({ levels: list, index, stars, title: `${pic.name}!`, text, menu: MENU, again: restart });
    }, 1400);
  }

  function advance() {
    const was = cmdAt();
    done++;
    missRun = 0;
    back = false;
    if (drag) { drag.missed = false; drag.used = true; }
    if (done === total) { finish(); return; }
    const ci = cmdAt();
    const nextGroup = tier === 2 && ci !== was && ci % GROUP === 0;
    if (nextGroup) {
      shown = true;
      endDrag();
      say('Есть! Вот следующие команды.');
    }
    // Only the guided levels may tell her that a command has ended.
    if (nextGroup || (tier === 0 && ci !== was)) sfx.ding(); else sfx.pop();
    save();
    paint();
  }

  function miss(dx, dy) {
    mistakes++;
    missRun++;
    sfx.soft();
    const [x, y] = pts[done];
    const ghost = svgEl('line', { x1: x * Z, y1: y * Z, x2: (x + dx) * Z, y2: (y + dy) * Z, class: 'dictation-miss' });
    ghost.addEventListener('animationend', () => ghost.remove());
    svg.insertBefore(ghost, band);
    say(missRun >= 3 ? HELP[tier] : OOPS[tier][mistakes % 2]);
    save();
    paint();
  }

  // False while the pencil must not move; says why when it is her turn to read.
  function canDraw() {
    if (!ready || over) return false;
    if (shown) say('Сначала запомни команды и нажми «Запомнила».');
    return !shown;
  }

  function restart() {
    endDrag();
    forget();
    done = 0; mistakes = 0; missRun = 0; back = false; peeked = false; over = false;
    shown = tier === 2;
    board.classList.remove('done');
    cmdsBox.replaceChildren(view.el);
    say(INTRO[tier]);
    paint();
  }

  // ---- finger or pencil on the sheet ---------------------------------------
  const cellAt = e => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [p.x / Z, p.y / Z];
  };

  function follow(e) {
    const p = cellAt(e).map((v, i) => v - drag.slip[i]);
    const [x, y] = pts[done];
    const gx = Math.round(p[0]);
    const gy = Math.round(p[1]);
    const dx = gx - x;
    const dy = gy - y;
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    if (!n) drag.missed = false;   // back at the pencil point: a new attempt
    else if (!dx || !dy || Math.abs(dx) === Math.abs(dy)) {
      const off = Math.hypot(p[0] - gx, p[1] - gy);
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      let k = 0;
      // Points the finger has already passed count; the last one must be close.
      while (drag && k < n && isNext(sx, sy) && (k < n - 1 || off < NEAR)) { advance(); k++; }
      // One mistake per wrong attempt, however many move events it takes.
      if (drag && k < n && !drag.missed && !isNext(sx, sy) && (n - k > 1 || off < SURE)) {
        drag.missed = true;
        drag.used = true;
        miss(sx, sy);
      }
    }
    if (!drag) return;
    const [cx, cy] = pts[done];
    for (const [name, v] of [['x1', cx * Z], ['y1', cy * Z], ['x2', p[0] * Z], ['y2', p[1] * Z]]) band.setAttribute(name, v);
    band.classList.add('on');
    band.classList.toggle('bad', drag.missed);
  }

  board.addEventListener('pointerdown', e => {
    // A second finger never takes over. A new first touch does, in case the
    // end of the last stroke was lost.
    if ((drag && !e.isPrimary) || !canDraw()) return;
    const p = cellAt(e);
    const slip = [p[0] - pts[done][0], p[1] - pts[done][1]];
    const far = Math.hypot(...slip);
    if (far > GRAB) {
      if (!drag) say('Карандаш ждёт на большой точке. Веди линию от неё.');
      return;
    }
    // A finger rarely lands exactly on the point. Where it lands must neither
    // draw nor cost a mistake: only the movement that follows counts.
    const k = Math.min(1, SLIP / far);
    drag = { id: e.pointerId, missed: false, used: false, slip: slip.map(v => v * k) };
    try { board.setPointerCapture(e.pointerId); } catch { /* finger already gone */ }
    follow(e);
  });
  board.addEventListener('pointermove', e => {
    // The in-between points keep a fast stroke from jumping over a corner.
    const fine = e.getCoalescedEvents?.() || [];
    for (const one of fine.length ? fine : [e]) if (drag?.id === e.pointerId) follow(one);
  });
  board.addEventListener('pointerup', e => {
    if (drag?.id !== e.pointerId) return;
    // A tap draws nothing, so she is told what to do instead.
    if (!drag.used) say('Нажми на большую точку и веди, не отрывая.');
    endDrag();
  });
  board.addEventListener('pointercancel', e => { if (drag?.id === e.pointerId) endDrag(); });

  // ---- arrows, for small fingers -------------------------------------------
  const pad = h('div', { class: 'dictation-pad' }, KEYS.map(k => (k
    ? h('button', {
      class: 'dictation-key', 'aria-label': k[2],
      onclick: () => {
        if (!canDraw()) return;
        // A finger still resting on the sheet lets go, or it would seem to pull back.
        endDrag();
        if (isNext(k[0], k[1])) advance(); else miss(k[0], k[1]);
      },
    }, arrow(k[0], k[1]))
    : h('span', { class: 'dictation-key-mid' }))));

  const bar = topbar(starsOf(list[index].key) ? pic.name : `Диктант ${index + 1}`, {
    back: MENU,
    right: [missChip, btn('ghost', 'Заново', async () => {
      // Not in the pause after the last cell: it would throw the stars away.
      if (over) return;
      if (!done || (await confirmBox('Стереть линию и начать заново?', 'Заново', 'Нет') && alive)) restart();
    })],
  });
  root.append(h('div', { class: 'screen dictation' },
    bar,
    h('div', { class: 'dictation-main' },
      h('div', { class: 'dictation-stage' }, board),
      h('div', { class: 'dictation-panel' }, voice, cmdsBox, pad),
    ),
  ));
  paint();

  db.get('kv', saveId).catch(() => null).then(rec => {
    if (!alive) return;
    if (rec && Number.isInteger(rec.done) && rec.done >= 0 && rec.done < total) {
      done = rec.done;
      mistakes = rec.mistakes || 0;
      peeked = !!rec.peeked;
      // She cannot remember hidden commands across a break, so a memory level
      // goes back to the start of its four and shows them again.
      if (tier === 2) {
        done = first[cmdAt() - cmdAt() % GROUP];
        shown = true;
      }
      back = done > 0;
      if (back) say(RESUME[tier]);
    }
    ready = true;
    paint();
  });

  return () => {
    alive = false;
    clearTimeout(endTimer);
  };
}

export default function run(root, arg) {
  const list = levels();
  if (!arg) {
    levelScreen(root, {
      title: 'Диктант по клеточкам',
      hint: 'Читай команды и веди линию по клеточкам. Что получится — секрет!',
      levels: list,
    });
    return undefined;
  }
  const index = PICS.findIndex(p => p.id === arg);
  if (index < 0 || !isOpen(list, index)) {
    location.hash = MENU;
    return undefined;
  }
  return play(root, list, index);
}
