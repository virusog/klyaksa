// Progress lives in localStorage, pictures live in IndexedDB.
import { N, lang } from './i18n.js';

const KEY = 'klyaksa.v1';
const DEFAULTS = {
  name: '', avatar: '🐱', lang, onboarded: false, rated: true, player: null, classCode: '',
  stars: 0, best: {}, sound: true, voice: false, breakMin: 30, shown: [], unlockAll: false, forget: [],
};

export const state = (() => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* private mode */ }
  // Progress from before profiles existed belongs to Настя, who must not be asked again.
  if (saved && saved.onboarded === undefined) {
    saved = { avatar: '🦄', lang: 'ru', ...saved, name: saved.name || 'Настя', onboarded: true }; // i18n-skip: her own name, kept as typed
  }
  return { ...DEFAULTS, ...(saved || {}) };
})();

// Entries of best that are not stars (the colour lab keeps its next level there).
const NOT_STARS = new Set(['lab:level']);
// Stars that side a holds in best beyond what side b has.
const extra = (a, b) => Object.entries(a.best || {})
  .filter(([k]) => !NOT_STARS.has(k))
  .reduce((sum, [k, v]) => sum + Math.max(0, (+v || 0) - (+(b.best || {})[k] || 0)), 0);
const validPlayer = p => !!(p?.id && p?.secret);

// Joins progress from an archive into this device's. The profile and settings made
// here win; results are joined task by task, so nothing earned on either side is lost
// and restoring the same archive twice changes nothing. Each side's stars may include
// some only the server knew, so the total is each side's own plus what the other adds.
// Of two rating players the one the server already rates higher stays; the other is
// queued in forget. The archive never switches the rating on.
export function mergeState(here, old = {}) {
  const out = { ...DEFAULTS, ...old, ...here };
  const best = { ...(old.best || {}) };
  for (const [k, v] of Object.entries(here.best || {})) best[k] = Math.max(+best[k] || 0, +v || 0);
  out.best = best;
  // The same player on both sides: the server total already covers both, so nothing is added twice.
  const samePlayer = validPlayer(old.player) && old.player.id === here.player?.id;
  const sumBest = Object.entries(best).filter(([k]) => !NOT_STARS.has(k)).reduce((a, [, v]) => a + (+v || 0), 0);
  out.stars = samePlayer
    ? Math.max(+here.stars || 0, +old.stars || 0, sumBest)
    : Math.max((+here.stars || 0) + extra(old, here), (+old.stars || 0) + extra(here, old));
  if (!here.classCode && old.classCode) {
    out.classCode = old.classCode;
    out.rated = here.rated !== false && old.rated !== false;
  }
  const forget = [];
  const queue = p => { if (validPlayer(p) && !forget.some(x => x.id === p.id)) forget.push({ id: p.id, secret: p.secret }); };
  [...(here.forget || []), ...(old.forget || [])].forEach(queue);
  let kept = here;
  if (validPlayer(old.player) && old.player.id !== here.player?.id) {
    const takeOld = old.syncedAt && (!here.syncedAt || (+old.stars || 0) > (+here.stars || 0));
    kept = takeOld ? old : here;
    queue(takeOld ? here.player : old.player);
    out.player = kept.player;
    out.syncedAt = kept.syncedAt;
  }
  // The server lets a known player grow only 400 stars a day and counts it as this
  // week's. When the archive brings old stars to this device's player that the server
  // already knows, she starts as a new player instead (null here, made by the caller):
  // her week starts at 0 and the whole total arrives at once. The player she leaves is
  // forgotten. Stars earned here on top of the archive's player are new, so they just go.
  if (kept === here && here.syncedAt && !samePlayer && out.stars > (+here.stars || 0)) {
    queue(out.player);
    out.player = null;
    out.syncedAt = undefined;
  }
  out.forget = forget.filter(p => p.id !== out.player?.id);
  return out;
}

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
