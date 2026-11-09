// Progress lives in localStorage, pictures live in IndexedDB.
const KEY = 'klyaksa.v1';
const DEFAULTS = {
  name: '', nameAsked: false, stars: 0, best: {}, sound: true, voice: false, breakMin: 30, shown: [],
};

export const state = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
})();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export const REWARDS = [
  { at: 2, kind: 'brush', id: 'glitter', name: 'Кисть «Блёстки»' },
  { at: 5, kind: 'brush', id: 'rainbow', name: 'Кисть «Радуга»' },
  { at: 9, kind: 'stickers', id: 'magic', name: 'Наклейки «Волшебство»' },
  { at: 13, kind: 'brush', id: 'neon', name: 'Кисть «Неон»' },
  { at: 18, kind: 'brush', id: 'hearts', name: 'Кисть «Сердечки»' },
  { at: 24, kind: 'stickers', id: 'space', name: 'Наклейки «Космос»' },
  { at: 30, kind: 'brush', id: 'stars', name: 'Кисть «Звёздочки»' },
  { at: 38, kind: 'brush', id: 'fur', name: 'Кисть «Шёрстка»' },
  { at: 46, kind: 'stickers', id: 'party', name: 'Наклейки «Праздник»' },
  { at: 55, kind: 'brush', id: 'bubbles', name: 'Кисть «Пузыри»' },
];

export const hasReward = id => {
  const r = REWARDS.find(x => x.id === id);
  return !r || state.stars >= r.at;
};
export const nextReward = () => REWARDS.find(r => state.stars < r.at);

// Stores the best result for a task, and pays only for improvement.
export function award(key, stars) {
  const was = state.best[key] || 0;
  const gain = Math.max(0, stars - was);
  const before = state.stars;
  if (gain) {
    state.best[key] = stars;
    state.stars += gain;
    save();
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
