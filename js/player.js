// Who is playing on this device, and her place in her class's rating.
// She is known by a random id plus a secret that only this browser holds
// (in localStorage, copied into a cookie as a second home). The server keeps
// only the secret's hash, so nobody else can change her name or stars.
import { state, save, onStars } from './store.js';
import { RATING_URL, RATING_KEY } from './net-config.js';

const COOKIE = 'klyaksa_player';

export const AVATARS = ['🐱', '🐶', '🦊', '🐰', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🦄', '🐧',
  '🦉', '🐙', '🐬', '🦋', '🐞', '🐢', '🦖', '🐲', '🌸', '🌈', '⭐', '🍓'];

function readCookie() {
  const m = document.cookie.match(/(?:^|;\s*)klyaksa_player=([0-9a-f-]{36})\.([0-9a-f]{32})/);
  return m ? { id: m[1], secret: m[2] } : null;
}

function writeCookie(p) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${p.id}.${p.secret}; Max-Age=${60 * 60 * 24 * 730}; Path=/; SameSite=Lax${secure}`;
}

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const h = randomHex(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20)}`;
}

// Makes sure this device has a player id, restoring it from the cookie if storage lost it.
export function ensurePlayer() {
  if (!state.player?.id || !state.player?.secret) {
    state.player = readCookie() || { id: newId(), secret: randomHex(16) };
    save();
  }
  writeCookie(state.player);
  return state.player;
}

async function rpc(name, body, ms = 9000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`${RATING_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    if (!r.ok) throw Object.assign(new Error(`rating ${r.status}`), { status: r.status });
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

// A class code is 4 to 24 of a-z, 0-9 and '-', the same rule as on the server.
export const cleanClass = s => {
  const c = String(s || '').trim().toLowerCase();
  return /^[a-z0-9-]{4,24}$/.test(c) ? c : '';
};

// A new class gets a code nobody can guess, e.g. 'class-k3x9pq'.
export function newClassCode() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return `class-${[...a].map(b => abc[b % abc.length]).join('')}`;
}

export const inviteLink = code => `https://blobika.com/?class=${code}`;

// The invitation link (https://blobika.com/?class=CODE) puts this device into that class.
export function classFromLink() {
  const params = new URLSearchParams(location.search);
  const code = cleanClass(params.get('class'));
  if (!params.has('class')) return;
  if (code) { state.classCode = code; save(); }
  params.delete('class');
  const rest = params.toString();
  history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
}

let timer = 0;
let running = null;

// Sends her name, avatar and stars. Silent when offline: the next change or launch tries again.
export function syncNow() {
  if (running) return running;
  if (!state.onboarded || !state.rated || !state.name || !state.classCode) return Promise.resolve(false);
  running = (async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const p = ensurePlayer();
      try {
        const res = await rpc('klyaksa_save', {
          p_id: p.id, p_secret: p.secret, p_class: state.classCode, p_name: state.name, p_avatar: state.avatar,
          p_lang: state.lang, p_stars: state.stars, p_visible: true,
        });
        // The server may know more stars than this device (storage was cleared, an old archive restored).
        if (res?.stars > state.stars) state.stars = res.stars;
        state.syncedAt = Date.now();
        save();
        return true;
      } catch (e) {
        // Her id is taken by someone else's secret: start afresh with a new one.
        if (e.status === 403 && attempt === 0) { state.player = null; continue; }
        return false;
      }
    }
    return false;
  })().finally(() => { running = null; });
  return running;
}

export function syncSoon(delay = 2500) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function loadBoard() {
  const p = ensurePlayer();
  return rpc('klyaksa_board', { p_class: state.classCode, p_id: p.id, p_secret: p.secret, p_limit: 300 });
}

// Takes her out of the rating entirely; the server keeps nothing of her.
// A save already on its way is waited for first, so it cannot bring her back.
export async function leaveRating() {
  const p = ensurePlayer();
  state.rated = false;
  save();
  clearTimeout(timer);
  await running;
  await rpc('klyaksa_forget', { p_id: p.id, p_secret: p.secret });
}

export async function joinRating() {
  state.rated = true;
  save();
  await running;
  return syncNow();
}

// Moves her into another class (or out of any class with '').
export async function setClass(code) {
  state.classCode = cleanClass(code);
  save();
  await running;
  return syncNow();
}

// Keeps the rating up to date: on launch, after every new star, when she comes back online.
export function startSync() {
  ensurePlayer();
  onStars(() => syncSoon());
  window.addEventListener('online', () => syncSoon(500));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSoon(1500); });
  syncSoon(1500);
}
