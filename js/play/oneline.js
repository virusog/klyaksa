// «Одним росчерком»: draw the whole figure without lifting the pencil and
// without going along any line twice.
//
// The ladder. Figures are sorted by the number of lines, fewest first, so
// every next one has more places to close a loop too early.
// - First third of the list: the free lines from the current point glow, and
//   a dead end caused by a bad start says so.
// - After that nothing glows: the route has to be planned in the head.
// - Figures with exactly two "odd" points only work from those two points.
//   Nothing marks them; only the hint does, and it caps the level at 2 stars.
//   The first figure gives them away with a loose end; later ones hide them
//   among ordinary corners.
import { h, svgEl, lerp, clamp } from '../util.js';
import { topbar, btn, icon, speaker } from '../ui.js';
import { sfx } from '../audio.js';
import { award, db } from '../store.js';
import { levelScreen, finishLevel, isOpen, eulerInfo } from './kit.js';
import base from '../content/oneline.js';
import partA from '../content/oneline-a.js';
import partB from '../content/oneline-b.js';

const MENU = '#/game/oneline';
// In sheet units (the sheet is 1000 by 750). Points are at least 110 apart, so
// a tap may be generous; a drag is stricter because a finger sliding along a
// line may pass 48 units from a point that is not on it.
const TAP_R = 55;
const DRAG_R = 38;
// No yellow or orange here: yellow is kept for "you are here" and "you can go this way".
const INK = ['#ff6b5e', '#4aa8ff', '#27c4a8', '#8b5cf6', '#ff85c0'];

// A repeated or unsolvable figure is dropped, so one bad entry cannot block the levels after it.
const PUZZLES = (() => {
  const seen = new Set();
  return [...base, ...partA, ...partB]
    .filter(p => !seen.has(p.id) && seen.add(p.id) && eulerInfo(p).ok)
    .sort((a, b) => a.edges.length - b.edges.length);
})();

const lineWord = n => {
  const d = n % 10;
  const teen = n % 100 > 10 && n % 100 < 15;
  return `${n} ${d === 1 && !teen ? 'линия' : d > 1 && d < 5 && !teen ? 'линии' : 'линий'}`;
};

function thumb({ nodes, edges }) {
  const s = svgEl('svg', { viewBox: '0 0 1000 750', width: 92, height: 69, class: 'oneline-thumb' });
  for (const [a, b] of edges) s.append(svgEl('line', { x1: nodes[a][0], y1: nodes[a][1], x2: nodes[b][0], y2: nodes[b][1] }));
  for (const [x, y] of nodes) s.append(svgEl('circle', { cx: x, cy: y, r: 30 }));
  return s;
}

function play(root, levels, index) {
  const puzzle = PUZZLES[index];
  const { nodes, edges } = puzzle;
  const info = eulerInfo(puzzle);
  const glow = index < Math.ceil(PUZZLES.length / 3);
  const around = nodes.map(() => []);
  edges.forEach(([a, b], e) => { around[a].push({ e, to: b }); around[b].push({ e, to: a }); });

  let cur = -1;        // the point the pencil stands on; -1 until she picks one
  let steps = [];      // { e, from } for every drawn line, in order
  const used = edges.map(() => false);
  let undos = 0;
  let restarts = 0;
  let hinted = false;
  let hintAt = -1;     // the point the hint ring marks; always a good one to start from
  let lost = '';       // the hint's verdict that this route cannot be finished; it stands until it can
  let done = false;
  let drag = null;     // { id, p, over, pen } while a finger or the pencil is down
  let finishTimer = 0;
  let unpaid = 0;      // stars earned but not yet handed over by the finish dialog

  const freeFrom = n => around[n].filter(x => !used[x.e]);
  const isStuck = () => cur >= 0 && steps.length < edges.length && !freeFrom(cur).length;

  // A big figure can take a long think, so the route drawn so far outlives the
  // screen. Writes run in turn: a late save must not undo a delete.
  const saveId = `oneline_${puzzle.id}`;
  let saving = Promise.resolve();
  function keep() {
    const rec = steps.length && !done
      ? { id: saveId, path: [...steps.map(s => s.from), cur], undos, restarts, hinted }
      : null;
    saving = saving.then(() => (rec ? db.put('kv', rec) : db.del('kv', saveId))).catch(() => {});
  }

  const intro = index === 0
    ? 'Нажми на точку и веди по линиям. По каждой можно пройти только раз!'
    : glow
      ? 'Обведи фигуру одним росчерком. Жёлтые линии — куда можно пойти.'
      : 'Подсветки нет. Подумай, с какой точки начать и где закончить.';

  const lineEls = edges.map(([a, b]) => svgEl('line', { class: 'oneline-edge', x1: nodes[a][0], y1: nodes[a][1], x2: nodes[b][0], y2: nodes[b][1] }));
  const nodeEls = nodes.map(([x, y]) => svgEl('circle', { class: 'oneline-node', cx: x, cy: y, r: 24 }));
  const ink = svgEl('g');
  const band = svgEl('line', { class: 'oneline-band' });
  const ring = svgEl('circle', { class: 'oneline-ring', r: 52 });
  const svg = svgEl('svg', { viewBox: '0 0 1000 750', class: 'oneline-sheet' });
  svg.append(...lineEls, ink, band, ring, ...nodeEls);

  const count = h('div', { class: 'oneline-count' });
  const talk = speaker(intro);
  // The same words are not said twice in a row, so a slip does not make the mascot nag.
  let said = intro;
  const tell = text => {
    if (text === said) return;
    said = text;
    talk.say(text);
  };
  const undoBtn = btn('ghost', [icon('undo', 22), 'Шаг назад'], undo);
  const againBtn = btn('ghost', 'Сначала', restart);
  const hintBtn = btn('accent', 'Подсказка', showHint);
  const tools = h('div', { class: 'oneline-tools' }, undoBtn, againBtn, hintBtn);

  function update() {
    const open = cur < 0 || done ? [] : freeFrom(cur).map(x => x.e);
    lineEls.forEach((el, e) => el.classList.toggle('glow', glow && open.includes(e)));
    nodeEls.forEach((el, n) => {
      el.classList.toggle('cur', n === cur);
      el.classList.toggle('full', !freeFrom(n).length);
      el.setAttribute('r', n === cur ? 34 : 24);
    });
    ring.classList.toggle('on', hintAt >= 0);
    if (hintAt >= 0) {
      ring.setAttribute('cx', nodes[hintAt][0]);
      ring.setAttribute('cy', nodes[hintAt][1]);
    }
    count.textContent = `${steps.length} из ${edges.length}`;
    undoBtn.disabled = cur < 0 || done;
    againBtn.disabled = cur < 0 || done;
    hintBtn.disabled = done;
    tools.classList.toggle('nudge', isStuck());
  }

  function hideBand() {
    band.classList.remove('on');
  }

  function clear() {
    steps = [];
    used.fill(false);
    cur = -1;
    lost = '';
    ink.textContent = '';
    hideBand();
  }

  function start(n) {
    cur = n;
    hintAt = -1;
    lost = '';
    sfx.drop();
    tell('Отсюда и начнём. Веди к соседней точке!');
    update();
  }

  // Adds one line to the route. Sounds and words are up to the caller.
  function mark(e, to) {
    const [x1, y1] = nodes[cur];
    const [x2, y2] = nodes[to];
    used[e] = true;
    steps.push({ e, from: cur });
    // pathLength lets the stylesheet draw the line from her point to the next one.
    ink.append(svgEl('path', {
      class: 'oneline-ink', d: `M${x1} ${y1}L${x2} ${y2}`, pathLength: 1, stroke: INK[(steps.length - 1) % INK.length],
    }));
    cur = to;
  }

  function draw(e, to) {
    mark(e, to);
    // A ring that shows where to start again stays while the route is lost.
    if (!lost) hintAt = -1;
    if (steps.length === edges.length) return win();
    sfx.pop();
    update();
    keep();
    if (isStuck()) sayStuck();
    else tell(lost || 'Хорошо! Веди дальше, пока не обведёшь всю фигуру.');
  }

  function sayStuck() {
    sfx.soft();
    tell(glow && !info.starts.includes(steps[0].from)
      ? 'Тупик! Идти некуда. Начни сначала — может, с другой точки?'
      : 'Тупик! Отсюда идти некуда. Шагни назад или начни сначала.');
  }

  function refuse(e) {
    const el = ink.children[steps.findIndex(s => s.e === e)];
    el.classList.remove('no');
    // Reading the size restarts the wobble when she tries the same line again.
    el.getBoundingClientRect();
    el.classList.add('no');
    sfx.soft();
    tell('По этой линии ты уже прошла. Выбери другую.');
  }

  // The pencil reached point n: by a tap (tapped) or by sliding over it.
  function arrive(n, tapped) {
    if (done || n === cur) return;
    // In a dead end "pick another line" would be bad advice: only the buttons help.
    if (isStuck()) {
      if (tapped) sayStuck();
      return;
    }
    // A tap on the hinted point moves the start there even from the point next to it.
    if (tapped && !steps.length && n === hintAt) return start(n);
    const link = cur < 0 ? null : around[cur].find(x => x.to === n);
    if (link && !used[link.e]) return draw(link.e, n);
    // Until the first line is drawn she may still change her mind about the start.
    if (!steps.length) {
      if (tapped || cur < 0) start(n);
      return;
    }
    if (link) return refuse(link.e);
    if (tapped) {
      sfx.soft();
      tell('Отсюда туда нет линии. Иди к соседней точке.');
    }
  }

  function undo() {
    if (done) return;
    const wasStuck = isStuck();
    const last = steps.pop();
    if (last) {
      used[last.e] = false;
      cur = last.from;
      undos++;
      ink.lastChild.remove();
      // The hint promised to say when the way opens again, so every step back is checked.
      if (lost) {
        if (canFinish()) lost = '';
        tell(lost || 'Путь снова открыт! Попробуй пойти по-другому.');
      } else if (wasStuck) {
        tell('Шаг назад. Попробуй другой путь.');
      }
    } else {
      cur = -1;
    }
    update();
    keep();
  }

  function restart() {
    if (done) return;
    if (steps.length) restarts++;
    clear();
    tell('Начинаем сначала. Выбери точку.');
    update();
    keep();
  }

  // Can the lines that are left still be drawn in one go from where she stands?
  function canFinish() {
    const left = edges.filter((_, e) => !used[e]);
    const ids = [...new Set(left.flat())];
    const rest = eulerInfo({ nodes: ids, edges: left.map(([a, b]) => [ids.indexOf(a), ids.indexOf(b)]) });
    return rest.ok && rest.starts.includes(ids.indexOf(cur));
  }

  // Shows where to start. Once lines are drawn it only says whether the way
  // is still good, so the route itself stays hers to find.
  function showHint() {
    if (done) return;
    hinted = true;
    hintAt = -1;
    if (!steps.length) {
      if (info.starts.includes(cur)) {
        hintAt = cur;
        tell('Эта точка подходит. Смело начинай отсюда!');
      } else {
        // The point she picked is let go, so the ring is the only thing calling her.
        cur = -1;
        hintAt = info.starts[0];
        tell(info.odd.length
          ? 'Начни вот с этой точки: отсюда фигура получится.'
          : 'Здесь подойдёт любая точка. Например, вот эта.');
      }
    } else if (canFinish()) {
      tell('Пока всё верно: отсюда фигуру ещё можно дорисовать.');
    } else if (!info.starts.includes(steps[0].from)) {
      hintAt = info.starts[0];
      lost = 'С той точки фигура не получится. Начни сначала вот отсюда.';
      tell(lost);
    } else {
      lost = 'Так уже не дорисовать. Шагай назад, пока путь снова не откроется.';
      tell(lost);
    }
    update();
    keep();
  }

  function win() {
    done = true;
    update();
    keep();
    sfx.ding();
    tell('Готово! Вся фигура обведена.');
    // Three stars for a planned route: no hint, no restart, one slip at most.
    const clean = restarts === 0 && undos <= 1;
    const stars = clean && !hinted ? 3 : restarts <= 1 && undos <= 4 ? 2 : 1;
    unpaid = stars;
    // A short pause so she sees the last line land before the dialog covers it.
    finishTimer = setTimeout(() => {
      unpaid = 0;
      finishLevel({
        levels, index, stars, menu: MENU,
        text: stars === 3
          ? `${lineWord(edges.length)} одним росчерком!`
          : stars === 2
            ? 'Фигура готова! Получится без подсказки и с первого раза?'
            : 'Фигура готова! Теперь ты знаешь путь — попробуй пройти его чисто.',
        again() {
          undos = 0;
          restarts = 0;
          hinted = false;
          hintAt = -1;
          done = false;
          clear();
          tell(intro);
          update();
        },
      });
    }, 650);
  }

  // The sheet is fitted into its box and centred, like the SVG does it itself.
  const toSheet = e => {
    const r = svg.getBoundingClientRect();
    const k = Math.min(r.width / 1000, r.height / 750);
    return [(e.clientX - r.left - (r.width - 1000 * k) / 2) / k, (e.clientY - r.top - (r.height - 750 * k) / 2) / k];
  };
  const dist = ([x, y], n) => Math.hypot(nodes[n][0] - x, nodes[n][1] - y);
  const nodeNear = (p, r) => {
    let best = -1;
    let bestD = r;
    nodes.forEach((_, n) => {
      const d = dist(p, n);
      if (d <= bestD) { bestD = d; best = n; }
    });
    return best;
  };
  const offLine = ([x, y], e) => {
    const [[x1, y1], [x2, y2]] = edges[e].map(n => nodes[n]);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
  };
  // A finger sliding along one line may brush a point beside it. That is not a
  // turn: the point counts once the finger is nearer to it than to that line.
  const brushed = (p, n) => cur >= 0 && freeFrom(cur).some(x => x.to !== n && offLine(p, x.e) < dist(p, n));

  function showBand([x, y]) {
    band.classList.toggle('on', cur >= 0 && !done);
    if (cur < 0) return;
    band.setAttribute('x1', nodes[cur][0]);
    band.setAttribute('y1', nodes[cur][1]);
    band.setAttribute('x2', x);
    band.setAttribute('y2', y);
  }

  svg.addEventListener('pointerdown', e => {
    if (done) return;
    const p = toSheet(e);
    const over = nodeNear(p, TAP_R);
    const pen = e.pointerType === 'pen';
    // A thumb holding the iPad must not block her, so a new touch on a point
    // takes over. A palm landing beside the pencil never does.
    if (drag && (over < 0 || (drag.pen && !pen))) return;
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch { /* finger already gone */ }
    drag = { id: e.pointerId, p, over, pen };
    if (over >= 0) arrive(over, true);
    showBand(p);
  });
  svg.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = toSheet(e);
    // A fast finger skips pixels, so the way between two events is walked in small steps.
    const n = Math.ceil(Math.hypot(p[0] - drag.p[0], p[1] - drag.p[1]) / 20) || 1;
    for (let i = 1; i <= n; i++) {
      const q = [lerp(drag.p[0], p[0], i / n), lerp(drag.p[1], p[1], i / n)];
      // She stays "on" a point until she clearly leaves it, so a wobble does not count as coming back.
      const over = drag.over >= 0 && dist(q, drag.over) <= TAP_R ? drag.over : nodeNear(q, DRAG_R);
      if (over === drag.over || (over >= 0 && brushed(q, over))) continue;
      drag.over = over;
      if (over >= 0) arrive(over, false);
    }
    drag.p = p;
    showBand(p);
  });
  const lift = e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    hideBand();
  };
  svg.addEventListener('pointerup', lift);
  svg.addEventListener('pointercancel', lift);
  // The system can take a touch away (a swipe from the edge) without a pointerup.
  svg.addEventListener('lostpointercapture', lift);

  root.append(h('div', { class: 'screen oneline' },
    topbar(`${index + 1}. ${puzzle.name}`, { back: MENU, right: [count] }),
    talk,
    tools,
    h('div', { class: 'oneline-board' }, svg),
  ));
  update();

  // Puts a saved route back, unless she has already begun or it no longer fits the figure.
  db.get('kv', saveId).catch(() => null).then(saved => {
    if (done || cur >= 0 || !Array.isArray(saved?.path)) return;
    const [first, ...rest] = saved.path;
    cur = first;
    const fits = rest.length > 0 && rest.length < edges.length && rest.every(to => {
      const link = around[cur]?.find(x => x.to === to && !used[x.e]);
      if (link) mark(link.e, to);
      return link;
    });
    if (fits) {
      undos = saved.undos | 0;
      restarts = saved.restarts | 0;
      hinted = !!saved.hinted;
      if (isStuck()) sayStuck();
      else tell('С возвращением! Продолжай с жёлтой точки.');
    } else {
      clear();
    }
    update();
  });

  return () => {
    clearTimeout(finishTimer);
    // A finger may still be down on the sheet that is gone: its moves must do nothing.
    drag = null;
    done = true;
    // She left during that short pause: the stars are hers all the same.
    if (unpaid) award(levels[index].key, unpaid);
  };
}

export default function run(root, arg) {
  const levels = PUZZLES.map(p => ({
    key: `oneline:${p.id}`, name: p.name, sub: lineWord(p.edges.length), href: `${MENU}/${p.id}`, thumb: thumb(p),
  }));
  if (arg) {
    const index = PUZZLES.findIndex(p => p.id === arg);
    if (index >= 0 && isOpen(levels, index)) return play(root, levels, index);
    // An old or locked address leads back to the list.
    location.hash = MENU;
    return undefined;
  }
  levelScreen(root, {
    title: 'Одним росчерком',
    hint: 'Обведи всю фигуру, не отрывая карандаша. По каждой линии можно пройти только один раз!',
    levels,
  });
  return undefined;
}
