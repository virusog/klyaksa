// Who is playing on this device, and her place in the shared rating.
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
    if (!r.ok) throw new Error(`rating ${r.status}`);
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

let timer = 0;
let running = null;

// Sends her name, avatar and stars. Silent when offline: the next change or launch tries again.
export function syncNow() {
  if (running) return running;
  if (!state.onboarded || !state.rated || !state.name) return Promise.resolve(false);
  const p = ensurePlayer();
  running = rpc('klyaksa_save', {
    p_id: p.id, p_secret: p.secret, p_name: state.name, p_avatar: state.avatar,
    p_lang: state.lang, p_stars: state.stars, p_visible: true,
  })
    .then(() => { state.syncedAt = Date.now(); save(); return true; })
    .catch(() => false)
    .finally(() => { running = null; });
  return running;
}

export function syncSoon(delay = 2500) {
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function loadBoard() {
  const rows = await rpc('klyaksa_board', { p_limit: 300 });
  return rows.map(r => ({ ...r, me: r.id === state.player?.id }));
}

// Takes her out of the rating entirely; the server keeps nothing of her.
export async function leaveRating() {
  const p = ensurePlayer();
  state.rated = false;
  save();
  await rpc('klyaksa_forget', { p_id: p.id, p_secret: p.secret });
}

export function joinRating() {
  state.rated = true;
  save();
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
