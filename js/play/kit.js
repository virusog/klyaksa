// Shared pieces for the newer games: the level list, the finish dialog, and
// two small parsers that both a game and the content checker use.
import { h } from '../util.js';
import { state, award } from '../store.js';
import { topbar, starBadge, celebrate, speaker, toast, icon } from '../ui.js';
import { sfx } from '../audio.js';

export const starsOf = key => state.best[key] || 0;

// A level opens once the one before it is done. Parents can open everything.
export const isOpen = (levels, i) =>
  i === 0 || state.unlockAll || starsOf(levels[i].key) > 0 || starsOf(levels[i - 1].key) > 0;

// levels: [{ key, name, sub?, href, thumb? }]. thumb is a ready DOM node.
export function levelScreen(root, { title, back = '#/games', hint, levels, extra }) {
  const grid = h('div', { class: 'level-grid' }, levels.map((L, i) => {
    const open = isOpen(levels, i);
    const stars = starsOf(L.key);
    const body = [
      h('span', { class: 'level-n' }, String(i + 1)),
      L.thumb ? h('span', { class: 'level-thumb' }, L.thumb) : null,
      h('b', {}, L.name),
      L.sub ? h('small', {}, L.sub) : null,
      open
        ? h('span', { class: 'level-stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars))
        : h('span', { class: 'level-lock' }, icon('lock', 22)),
    ];
    if (open) return h('a', { class: `level-card ${stars ? 'done' : ''}`, href: L.href }, body);
    return h('button', {
      class: 'level-card locked',
      onclick: () => { sfx.soft(); toast(`Сначала пройди уровень ${i}`); },
    }, body);
  }));
  root.append(h('div', { class: 'screen scroll hub levels' },
    topbar(title, { back, right: [starBadge()] }),
    hint ? speaker(hint) : null,
    extra || null,
    grid,
  ));
  // Brings the first unfinished level into view.
  grid.querySelector('.level-card:not(.done)')?.scrollIntoView({ block: 'center' });
}

// Pays the stars and shows the finish dialog with the usual three buttons.
export function finishLevel({ levels, index, stars, title, text, menu, again }) {
  const res = award(levels[index].key, stars);
  const next = levels[index + 1];
  return celebrate({
    title: title || (stars === 3 ? 'Блестяще!' : stars === 2 ? 'Хорошо!' : 'Получилось!'),
    text,
    stars,
    unlocked: res.unlocked,
    actions: [
      again && { label: 'Ещё раз', fn: again },
      { label: 'К уровням', primary: !next, fn: () => { location.hash = menu; } },
      next && { label: 'Дальше', primary: true, fn: () => { location.hash = next.href; } },
    ].filter(Boolean),
  });
}

// "3R 2U 1RD" → [[dx, dy, count], ...]. Throws on a bad token.
const DIRS = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1], RU: [1, -1], RD: [1, 1], LU: [-1, -1], LD: [-1, 1] };
export function parseMoves(text) {
  return text.trim().split(/\s+/).map(tok => {
    const m = /^(\d+)(RU|RD|LU|LD|R|L|U|D)$/.exec(tok);
    if (!m) throw new Error(`bad move "${tok}"`);
    return [...DIRS[m[2]], +m[1], m[2]];
  });
}

// For a one-line puzzle: is it drawable in one stroke, and from which nodes.
export function eulerInfo({ nodes, edges }) {
  const deg = nodes.map(() => 0);
  const adj = nodes.map(() => []);
  for (const [a, b] of edges) { deg[a]++; deg[b]++; adj[a].push(b); adj[b].push(a); }
  const seen = new Set([edges[0]?.[0] ?? 0]);
  const stack = [...seen];
  while (stack.length) for (const n of adj[stack.pop()]) if (!seen.has(n)) { seen.add(n); stack.push(n); }
  const connected = deg.every((d, i) => d === 0 || seen.has(i)) && deg.every(d => d > 0);
  const odd = deg.map((d, i) => (d % 2 ? i : -1)).filter(i => i >= 0);
  return { connected, odd, ok: connected && (odd.length === 0 || odd.length === 2), starts: odd.length ? odd : nodes.map((_, i) => i) };
}
