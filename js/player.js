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
    if (!r.ok) {
      // PostgREST answers {"code":"54000","message":…}: the code tells a limit from a refusal.
      let code = '';
      try { code = String((await r.json())?.code || ''); } catch { /* not JSON */ }
      throw Object.assign(new Error(`rating ${r.status} ${code}`), { status: r.status, code });
    }
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

// A class the grown-ups closed to newcomers: the server refused her save into it
// ('55000'). Automatic saves leave it alone for a while instead of asking again on
// every star and every return to the app; the class screen can ask again (retryLocked).
const LOCK_PAUSE = 10 * 60e3;
let locked = { code: '', at: 0 };
const lockListeners = new Set();

// True when this device's class refused her as a newcomer and she is not in it on the server.
export const classLocked = () => !!state.classCode && locked.code === state.classCode;
export function onLocked(fn) { lockListeners.add(fn); return () => lockListeners.delete(fn); }
// Forgets the refusal and saves again now, e.g. when she opens her class once more.
export function retryLocked() {
  if (locked.code) locked = { code: '', at: 0 };
  return syncNow();
}

// Sends her name, avatar and stars. Silent when offline: the next change or launch tries again.
export function syncNow() {
  if (running) return running;
  const canSave = state.onboarded && state.rated && state.name && state.classCode;
  if (!canSave && !state.forget?.length) return Promise.resolve(false);
  // Refused a moment ago: no new try until the pause is over or she asks.
  if (canSave && classLocked() && Date.now() - locked.at < LOCK_PAUSE && !state.forget?.length) return Promise.resolve(false);
  running = (async () => {
    // Her old player goes first, so she is never on the board twice.
    if (!(await flushForget()) || !canSave) return false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const p = ensurePlayer();
      // The code this save sends: she may change it while the save is on its way.
      const sent = state.classCode;
      try {
        const res = await rpc('klyaksa_save', {
          p_id: p.id, p_secret: p.secret, p_class: sent, p_name: state.name, p_avatar: state.avatar,
          p_lang: state.lang, p_stars: state.stars, p_visible: true,
        });
        // The server may know more stars than this device (storage was cleared, an old archive restored).
        if (res?.stars > state.stars) state.stars = res.stars;
        // A mistyped code the server knows a fix for: she moves to the real class.
        if (res?.class && state.classCode === sent && res.class !== sent && cleanClass(res.class)) state.classCode = res.class;
        state.syncedAt = Date.now();
        // The class the server has her in now (the home badge asks about that class).
        state.syncedClass = cleanClass(res?.class) || sent;
        if (locked.code) locked = { code: '', at: 0 };
        save();
        return true;
      } catch (e) {
        // The class is closed to newcomers: once, quietly, and the class screen explains it.
        if (e.code === '55000') {
          const was = locked.code;
          locked = { code: sent, at: Date.now() };
          if (was !== sent) lockListeners.forEach(fn => { try { fn(); } catch { /* a closed screen */ } });
          return false;
        }
        // Her id is taken by someone else's secret: start afresh with a new one.
        // (PostgREST answers this 42501 with 401 to the public key, so the code is what counts.)
        if ((e.code === '42501' || e.status === 403) && attempt === 0) { state.player = null; continue; }
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

// Class features (drawings, chat) only for a girl who is in the rating of a class.
export const inClass = () => !!(state.onboarded && state.rated && state.name && state.classCode);

// What the server knows of a typed code: the class it really means (a known typo
// is moved to the right class) and how many girls are in it.
export const checkClass = code => rpc('klyaksa_class_check', { p_class: code }, 6000);

// A call made as her: the server takes the class from her own row, never from here.
function asMe(name, params = {}, ms) {
  const p = ensurePlayer();
  return rpc(name, { p_id: p.id, p_secret: p.secret, ...params }, ms);
}

// What the grown-ups switched on or off for her class on the server: the chat and
// showing drawings. Reading always works. Known from klyaksa_news and from a refusal
// ('55000'); until then both count as on. Screens follow it with onSwitches.
export const switches = { chat: true, drawings: true };
const switchListeners = new Set();
export function onSwitches(fn) { switchListeners.add(fn); return () => switchListeners.delete(fn); }
function setSwitches(next) {
  let changed = false;
  for (const k of ['chat', 'drawings']) {
    if (typeof next[k] === 'boolean' && next[k] !== switches[k]) { switches[k] = next[k]; changed = true; }
  }
  if (changed) switchListeners.forEach(fn => { try { fn(); } catch { /* a closed screen */ } });
}
// A refusal with '55000' means that switch is off now.
const orOff = (key, call) => call.catch(e => { if (e?.code === '55000') setSwitches({ [key]: false }); throw e; });

export const addPost = ({ title, thumb, image, w, h }) =>
  orOff('drawings', asMe('klyaksa_post_add', { p_title: title, p_thumb: thumb, p_image: image, p_w: w, p_h: h }, 30000));
export const loadPosts = (sort = 'new') => asMe('klyaksa_posts', { p_sort: sort, p_limit: 60 }, 15000);
export const postImage = id => asMe('klyaksa_post_image', { p_post: id }, 20000);
export const likePost = (id, on) => asMe('klyaksa_like', { p_post: id, p_on: on });
export const deletePost = id => asMe('klyaksa_post_delete', { p_post: id });
export const sendChat = (kind, body) => orOff('chat', asMe('klyaksa_chat_send', { p_kind: kind, p_body: body }));
export const loadChat = (after = 0) => asMe('klyaksa_chat', { p_after: after, p_limit: 80 });
export const deleteChat = id => asMe('klyaksa_chat_delete', { p_msg: id });
export const report = (kind, target) => asMe('klyaksa_report', { p_kind: kind, p_target: target });
export const loadNews = () => asMe('klyaksa_news', {}, 6000).then(n => {
  // An older server sends no switches: then nothing is off.
  setSwitches({ chat: n?.chat !== false, drawings: n?.drawings !== false });
  return n;
});
// Asks the server what is switched on; quiet when she is offline or not on the server yet.
export const refreshSwitches = () => (inClass() && !classLocked() ? loadNews().catch(() => null) : Promise.resolve(null));

// Why a class call failed, in words she understands. No status means no internet.
export function netError(e) {
  if (!e?.status) return 'offline';
  if (e.code === '54000') return 'limit';
  if (e.code === '42501') return 'denied';
  if (e.code === '22023') return 'bad';
  // Switched off by the grown-ups (the chat, the drawings) or a class closed to newcomers.
  if (e.code === '55000') return 'off';
  return 'other';
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

// Players dropped when an archive was joined in (see mergeState) are taken off the
// server, so she is not in the class twice. Kept in state.forget and tried again before
// every save until the server answers. Returns true when nothing is left to forget.
async function flushForget() {
  for (const p of [...(state.forget || [])]) {
    if (p.id !== state.player?.id) {
      try { await rpc('klyaksa_forget', { p_id: p.id, p_secret: p.secret }); } catch { continue; }
    }
    state.forget = state.forget.filter(x => x.id !== p.id);
    save();
  }
  return !state.forget?.length;
}

// A new player for this device, never taken from the cookie (see mergeState).
export function freshPlayer() {
  state.player = { id: newId(), secret: randomHex(16) };
  writeCookie(state.player);
  save();
}

export async function forgetDropped() {
  clearTimeout(timer);
  await running;
  writeCookie(ensurePlayer());
  return flushForget();
}

export async function joinRating() {
  state.rated = true;
  save();
  await running;
  return syncNow();
}

// Moves her into another class (the server takes her drawings and messages out of
// the old one), or out of any class with '': then the server forgets her, as when
// her parents switch participation off, but she stays ready to join another class.
export async function setClass(code) {
  const was = state.classCode;
  state.classCode = cleanClass(code);
  save();
  await running;
  if (was && !state.classCode) {
    const p = ensurePlayer();
    try { await rpc('klyaksa_forget', { p_id: p.id, p_secret: p.secret }); } catch { return false; }
    return true;
  }
  return syncNow();
}

// Keeps the rating up to date: on launch, after every new star, when she comes back online.
export function startSync() {
  ensurePlayer();
  if (state.forget?.length) syncSoon(500);
  onStars(() => syncSoon());
  window.addEventListener('online', () => syncSoon(500));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSoon(1500); });
  syncSoon(1500);
}
