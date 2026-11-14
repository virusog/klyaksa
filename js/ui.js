// Shared interface pieces: mascot, toolbars, palette, celebration screen.
import { h, canvas, clamp } from './util.js';
import { BRUSHES, drawSample } from './brushes.js';
import { state, hasReward, REWARDS } from './store.js';
import { sfx, speak } from './audio.js';
import { t } from './i18n.js';

const I = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12h-3" transform="translate(0 -5)"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12h3" transform="translate(0 -5)"/>',
  check: '<path d="M5 13l5 5L20 7"/>',
  layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
  sym: '<path d="M12 3v18"/><path d="M8 7l-5 5 5 5z"/><path d="M16 7l5 5-5 5z"/>',
  paper: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>',
  sticker: '<circle cx="12" cy="12" r="9"/><path d="M8 14q4 4 8 0"/><path d="M9 9v.5M15 9v.5"/>',
  fill: '<path d="M4 12l8-8 8 8-8 8z"/><path d="M4 12h16"/><path d="M21 17q2 3 0 4-2-1 0-4z"/>',
  pick: '<path d="M14 6l4 4M5 19l1-4 9-9 3 3-9 9z"/>',
  trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  share: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v8h14v-8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9v.5M15 15v.5M12 12v.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M4 4l16 16"/><path d="M9.9 5.3A9 9 0 0 1 12 5c6 0 10 7 10 7a15 15 0 0 1-3 3.7M6 7a15 15 0 0 0-4 5s4 7 10 7a9 9 0 0 0 4-1"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
  brush: '<path d="M4 20c0-3 2-4 4-4s3 1 3 2c0 2-3 3-7 2z"/><path d="M10 15L20 4"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
  eraser: '<path d="M8 20l-5-5L14 4l7 7-9 9z"/><path d="M8 9l7 7"/>',
  shape: '<rect x="3" y="11" width="10" height="10" rx="1"/><circle cx="16" cy="8" r="5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  fish: '<path d="M3 12c4-6 12-6 15 0-3 6-11 6-15 0z"/><path d="M18 12l3-3v6z"/>',
};

export const icon = (n, size = 26) =>
  h('span', {
    class: 'ico',
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${I[n] || ''}</svg>`,
  });

export function btn(cls, content, onClick, attrs = {}) {
  let busy = false;
  return h('button', {
    class: `btn ${cls}`,
    onclick: async e => {
      // A second tap during a slow save must not save the picture twice.
      if (busy) return;
      busy = true;
      sfx.pop();
      try { await onClick?.(e); } finally { busy = false; }
    },
    ...attrs,
  }, content);
}

export const iconBtn = (name, label, fn, cls = '') =>
  btn(`icon ${cls}`, icon(name), fn, { 'aria-label': label, title: label });

const BLOB = 'M60 9C82 6 96 17 100 33c6 8 16 13 12 26-3 9-11 9-12 15-2 10 5 19-5 28-10 8-20 1-30 7-11 6-21 8-31 0-8-8-1-16-11-22C14 87 6 78 8 62c2-12 14-12 16-24C28 18 40 11 60 9Z';

export function mascot(mood = 'happy', color) {
  const mouths = {
    happy: '<path d="M46 74q14 14 28 0" fill="none" stroke="#2a2140" stroke-width="5" stroke-linecap="round"/>',
    wow: '<ellipse cx="60" cy="78" rx="8" ry="11" fill="#2a2140"/>',
    joy: '<path d="M42 70q18 28 36 0z" fill="#2a2140"/><path d="M50 80q10 8 20 0" fill="#ff8fa3"/>',
  };
  const el = h('div', {
    class: 'mascot',
    style: color ? { '--blob': color } : undefined,
    html: `<svg viewBox="0 0 120 120">
      <path d="${BLOB}" class="blob" stroke="#2a2140" stroke-width="5"/>
      <ellipse cx="42" cy="26" rx="10" ry="6" fill="#fff" opacity=".5" transform="rotate(-24 42 26)"/>
      <g class="eyes">
        <ellipse cx="44" cy="52" rx="11" ry="14" fill="#fff" stroke="#2a2140" stroke-width="3"/>
        <ellipse cx="76" cy="52" rx="11" ry="14" fill="#fff" stroke="#2a2140" stroke-width="3"/>
        <circle cx="47" cy="55" r="6" fill="#2a2140"/><circle cx="73" cy="55" r="6" fill="#2a2140"/>
        <circle cx="49" cy="52" r="2.2" fill="#fff"/><circle cx="75" cy="52" r="2.2" fill="#fff"/>
      </g>
      ${mouths[mood] || mouths.happy}
      <circle cx="30" cy="70" r="5.5" fill="#ff8fa3" opacity=".7"/><circle cx="90" cy="70" r="5.5" fill="#ff8fa3" opacity=".7"/>
    </svg>`,
  });
  return el;
}

export function topbar(title, { back = '#/', right = [], onBack } = {}) {
  return h('header', { class: 'topbar' },
    iconBtn('back', t('Назад'), () => { if (onBack) onBack(); else location.hash = back; }),
    h('h1', {}, title),
    h('div', { class: 'spacer' }),
    right,
  );
}

export function starBadge() {
  return h('a', { class: 'star-badge', href: '#/prizes' }, h('span', { class: 'star' }, '★'), String(state.stars));
}

let toastT;
export function toast(text) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast' }, text);
  document.body.append(el);
  clearTimeout(toastT);
  toastT = setTimeout(() => el.remove(), 2400);
}

export function popover(anchor, content) {
  document.querySelector('.pop')?.remove();
  const pop = h('div', { class: 'pop' }, content);
  document.body.append(pop);
  const a = anchor.getBoundingClientRect();
  const w = pop.offsetWidth;
  pop.style.left = `${clamp(a.left + a.width / 2 - w / 2, 10, innerWidth - w - 10)}px`;
  pop.style.top = `${a.bottom + 12}px`;
  const close = e => {
    if (pop.contains(e.target)) return;
    pop.remove();
    document.removeEventListener('pointerdown', close, true);
  };
  setTimeout(() => document.addEventListener('pointerdown', close, true));
  return pop;
}

export function closePop() { document.querySelector('.pop')?.remove(); }

export function confirmBox(text, yes = t('Да'), no = t('Нет')) {
  return new Promise(res => {
    const end = v => { o.remove(); res(v); };
    const o = h('div', { class: 'modal-back' },
      h('div', { class: 'modal' },
        mascot('wow'),
        h('p', {}, text),
        h('div', { class: 'row' },
          btn('ghost', no, () => end(false)),
          btn('primary', yes, () => end(true)),
        ),
      ),
    );
    document.body.append(o);
  });
}

export function confetti(ms = 2600) {
  const c = canvas(innerWidth, innerHeight);
  c.className = 'confetti';
  document.body.append(c);
  const x = c.getContext('2d');
  const cols = ['#ffc83d', '#ff6b5e', '#27c4a8', '#4aa8ff', '#8b5cf6', '#ff85c0'];
  const bits = Array.from({ length: 130 }, () => ({
    x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.8,
    v: 3 + Math.random() * 5, s: 7 + Math.random() * 9, r: Math.random() * 6, w: Math.random() * 0.2 - 0.1,
    c: cols[Math.floor(Math.random() * 6)],
  }));
  const t0 = performance.now();
  const f = now => {
    x.clearRect(0, 0, c.width, c.height);
    for (const b of bits) {
      b.y += b.v; b.r += b.w; b.x += Math.sin(b.r * 3) * 1.4;
      x.save();
      x.translate(b.x, b.y);
      x.rotate(b.r);
      x.fillStyle = b.c;
      x.fillRect(-b.s / 2, -b.s / 3, b.s, b.s * 0.66);
      x.restore();
    }
    if (now - t0 < ms) requestAnimationFrame(f); else c.remove();
  };
  requestAnimationFrame(f);
}

export function celebrate({ title, text, stars, unlocked = [], actions = [] }) {
  sfx.win();
  confetti();
  // Confetti must not keep falling over whatever she opens next.
  const close = () => { o.remove(); document.querySelectorAll('.confetti').forEach(c => c.remove()); };
  const o = h('div', { class: 'modal-back celebrate' },
    h('div', { class: 'modal big' },
      mascot('joy'),
      h('h2', {}, title),
      text && h('p', {}, text),
      stars != null && h('div', { class: 'stars-row' },
        [1, 2, 3].map(i => h('span', { class: `big-star ${i <= stars ? 'on' : ''}`, style: { animationDelay: `${i * 0.18}s` } }, '★')),
      ),
      unlocked.map(r => h('div', { class: 'unlock' }, h('b', {}, t('Подарок!')), ' ', t(r.name))),
      h('div', { class: 'row wrap' }, actions.map(a => btn(a.primary ? 'primary' : 'ghost', a.label, () => { close(); a.fn?.(); }))),
    ),
  );
  document.body.append(o);
  return o;
}

export const COLORS = [
  '#2a2140', '#6b7280', '#ffffff', '#f4d9c0', '#d9a273', '#8a5a35',
  '#e5252a', '#ff6b5e', '#ff8fa3', '#ff85c0', '#d6336c', '#8b1e5a',
  '#ff8a1f', '#ffb340', '#ffd447', '#fff176', '#a3e635', '#46c257',
  '#14935a', '#27c4a8', '#7fd1ff', '#2f93d6', '#1e4fc2', '#8b5cf6', '#c9a7ff',
];

export function brushRail(p, ids, { onPick } = {}) {
  const items = new Map();
  const rail = h('div', { class: 'rail' });
  const redraw = () => {
    for (const [id, el] of items) drawSample(el.querySelector('canvas'), id, p.color === '#ffffff' ? '#c9c4e8' : p.color);
  };
  const mark = () => {
    for (const [id, el] of items) el.classList.toggle('on', (p.mode === 'draw' || p.mode === 'shape') && p.brushId === id);
  };
  for (const id of ids) {
    const b = BRUSHES[id];
    const locked = b.prize && !hasReward(id);
    const cv = canvas(132, 72);
    const el = h('button', {
      class: `brush ${locked ? 'locked' : ''}`,
      onclick: () => {
        if (locked) {
          const r = REWARDS.find(x => x.id === id);
          sfx.soft();
          toast(t('«{name}» — подарок за {at} ★. У тебя пока {stars} ★', { name: t(b.name), at: r.at, stars: state.stars }));
          return;
        }
        sfx.pop();
        p.setBrush(id);
        mark();
        onPick?.(id);
      },
    }, cv, h('span', {}, t(b.name)), locked && h('i', { class: 'lock' }, '★'));
    items.set(id, el);
    rail.append(el);
  }
  rail.redraw = redraw;
  rail.mark = mark;
  redraw();
  mark();
  return rail;
}

export function paletteBar(p, { onPick, colors = COLORS } = {}) {
  const row = h('div', { class: 'palette' });
  const pickInput = h('input', { type: 'color', value: p.color, 'aria-label': t('Любой цвет') });
  const swatches = [];
  const mark = () => {
    for (const s of swatches) s.classList.toggle('on', s.dataset.c === p.color);
  };
  const choose = c => {
    p.color = c;
    if (p.mode === 'pick') p.mode = 'draw';
    mark();
    onPick?.(c);
  };
  for (const c of colors) {
    const s = h('button', {
      class: 'swatch', 'data-c': c, style: { background: c },
      'aria-label': t('Цвет'), onclick: () => { sfx.drop(); choose(c); },
    });
    swatches.push(s);
    row.append(s);
  }
  pickInput.addEventListener('input', () => choose(pickInput.value));
  row.append(h('label', { class: 'swatch any' }, pickInput));
  row.mark = mark;
  row.set = choose;
  mark();
  return row;
}

export function sizeSlider(p) {
  const dot = h('i', { class: 'dot' });
  const input = h('input', { type: 'range', 'aria-label': t('Толщина') });
  const sync = () => {
    const b = BRUSHES[p.brushId];
    input.min = b.min;
    input.max = b.max;
    input.value = p.size;
    const d = clamp(p.size * (p.fitS || 0.6), 4, 36);
    dot.style.width = dot.style.height = `${d}px`;
    dot.style.background = p.color === '#ffffff' ? '#c9c4e8' : p.color;
  };
  input.addEventListener('input', () => { p.size = +input.value; sync(); });
  const el = h('div', { class: 'size' }, h('span', { class: 'dotbox' }, dot), input);
  el.sync = sync;
  sync();
  return el;
}

// Mascot with a speech bubble. Returns an element with a .say(text) method.
export function speaker(text, mood = 'happy') {
  const bubble = h('div', { class: 'bubble' }, text);
  const el = h('div', { class: 'speaker' }, mascot(mood), bubble);
  el.say = text => {
    bubble.textContent = text;
    bubble.classList.remove('pop-in');
    void bubble.offsetWidth;
    bubble.classList.add('pop-in');
    speak(text);
  };
  return el;
}

// Must be called directly from a tap: iPad refuses to share after a long wait.
export async function shareBlob(blob, fileName) {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  h('a', { href: URL.createObjectURL(blob), download: file.name }).click();
}

// Runs a save and, if it fails, offers to try again instead of losing the work.
export async function safeSave(fn) {
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      console.error(e);
      const again = await confirmBox(t('Не получилось сохранить рисунок. Попробуем ещё раз?'), t('Повторить'), t('Не сейчас'));
      if (!again) throw e;
    }
  }
}

// Background saving: on a timer while she pauses, and whenever the app is hidden.
export function autosaver(isDirty, save, isBusy) {
  let running = null;
  let last = performance.now();
  const pass = () => {
    last = performance.now();
    running = save().finally(() => { running = null; });
    return running;
  };
  // Waits for everything to be stored: used by Done and when leaving a screen.
  const flush = async () => {
    while (running || isDirty()) await (running || pass());
  };
  // One pass only, so saving never runs back to back while she keeps drawing.
  const quiet = () => {
    if (running || !isDirty()) return;
    pass().catch(e => {
      console.error(e);
      toast(t('Не получилось сохранить. Закрой приложение и открой снова.'));
    });
  };
  const timer = setInterval(() => {
    if (!isDirty()) return;
    const since = performance.now() - last;
    // PNG encoding can stutter, so it waits for a pause in the drawing.
    if (since > 45000 || (since > 10000 && !isBusy?.())) quiet();
  }, 2500);
  const onHide = () => { if (document.hidden) quiet(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', quiet);
  return {
    flush,
    stop() {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', quiet);
    },
  };
}
