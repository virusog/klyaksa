// Progress lives in localStorage, pictures live in IndexedDB.
import { N, lang } from './i18n.js';

const KEY = 'klyaksa.v1';
const DEFAULTS = {
  name: '', avatar: '🐱', lang, onboarded: false, rated: true, player: null,
  stars: 0, best: {}, sound: true, voice: false, breakMin: 30, shown: [], unlockAll: false,
};

export const state = (() => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* private mode */ }
  // Progress from before profiles existed belongs to Настя, who must not be asked again.
  if (saved && saved.onboarded === undefined) {
    saved = { avatar: '🦄', lang: 'ru', ...saved, name: saved.name || 'Настя', onboarded: true };
  }
  return { ...DEFAULTS, ...(saved || {}) };
})();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export const REWARDS = [
  { at: 2, kind: 'brush', id: 'glitter', name: N('Кисть «Блёстки»') },
  { at: 5, kind: 'brush', id: 'rainbow', name: N('Кисть «Радуга»') },
  { at: 9, kind: 'stickers', id: 'magic', name: N('Наклейки «Волшебство»') },
  { at: 13, kind: 'brush', id: 'neon', name: N('Кисть «Неон»') },
  { at: 18, kind: 'brush', id: 'hearts', name: N('Кисть «Сердечки»') },
  { at: 24, kind: 'stickers', id: 'space', name: N('Наклейки «Космос»') },
  { at: 30, kind: 'brush', id: 'stars', name: N('Кисть «Звёздочки»') },
  { at: 38, kind: 'brush', id: 'fur', name: N('Кисть «Шёрстка»') },
  { at: 46, kind: 'stickers', id: 'party', name: N('Наклейки «Праздник»') },
  { at: 55, kind: 'brush', id: 'bubbles', name: N('Кисть «Пузыри»') },
  { at: 70, kind: 'brush', id: 'calligraphy', name: N('Кисть «Перо»') },
  { at: 90, kind: 'brush', id: 'leaves', name: N('Кисть «Листики»') },
  { at: 115, kind: 'brush', id: 'confetti', name: N('Кисть «Конфетти»') },
  { at: 140, kind: 'brush', id: 'dashed', name: N('Кисть «Пунктир»') },
  { at: 170, kind: 'brush', id: 'snow', name: N('Кисть «Снежинки»') },
  { at: 200, kind: 'brush', id: 'pixel', name: N('Кисть «Пиксели»') },
];

export const hasReward = id => {
  const r = REWARDS.find(x => x.id === id);
  return !r || state.stars >= r.at;
};
export const nextReward = () => REWARDS.find(r => state.stars < r.at);

const starWatchers = new Set();
// Called whenever her star total grows (the rating listens).
export const onStars = fn => starWatchers.add(fn);

// Stores the best result for a task, and pays only for improvement.
export function award(key, stars) {
  const was = state.best[key] || 0;
  const gain = Math.max(0, stars - was);
  const before = state.stars;
  if (gain) {
    state.best[key] = stars;
    state.stars += gain;
    save();
    starWatchers.forEach(fn => fn(state.stars));
  }
  return { gain, unlocked: REWARDS.filter(r => r.at > before && r.at <= state.stars) };
}

// Small repeat reward for open-ended play, so free drawing also counts.
export function awardOnce(key) {
  return award(`${key}:${new Date().toISOString().slice(0, 10)}`, 1);
}

let dbp;
function open() {
  if (dbp) return dbp;
  const me = dbp = new Promise((res, rej) => {
    const q = indexedDB.open('klyaksa', 1);
    q.onupgradeneeded = () => {
      for (const s of ['art', 'world', 'kv']) q.result.createObjectStore(s, { keyPath: 'id' });
    };
    q.onsuccess = () => {
      // WebKit can drop the connection while the app is in the background.
      q.result.onclose = () => { if (dbp === me) dbp = null; };
      res(q.result);
    };
    q.onerror = () => rej(q.error);
  });
  me.catch(() => { if (dbp === me) dbp = null; });
  return me;
}

function attempt(store, mode, fn) {
  return open().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => res(r.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('aborted'));
  }));
}

function run(store, mode, fn) {
  return attempt(store, mode, fn).catch(() => {
    dbp = null;
    return attempt(store, mode, fn);
  });
}

export const db = {
  put: (s, o) => run(s, 'readwrite', x => x.put(o)),
  get: (s, id) => run(s, 'readonly', x => x.get(id)),
  all: (s) => run(s, 'readonly', x => x.getAll()),
  del: (s, id) => run(s, 'readwrite', x => x.delete(id)),
};

export const newId = p => `${p}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export function askPersist() {
  try { navigator.storage?.persist?.(); } catch { /* unsupported */ }
}
