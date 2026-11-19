#!/usr/bin/env node
// Developer tool: opens the app in headless Chrome, runs a script inside the
// page and saves screenshots. Needs the local server on port 8123.
//
//   node tools/drive.mjs --route '#/game/pairs' --script test.js --shot out.png
//
// Options: --size 1180x820 (default) or 820x1180; --state '{"unlockAll":true}'
// (merged into the saved progress before the app starts); --timeout 90 (seconds).
// The script file is the body of an async function. It can use the helper T
// (see below) and what it returns is printed as JSON, together with any page
// errors. Every run starts with empty storage.
//
// The shared class server (rating, drawings, chat) is replaced by a pretend
// server inside the page (fakeServer below), so test runs never add players to
// the real one. --net uses the real server instead (only tools/test/profile.js
// needs that, and it removes its player again). --offline makes every class
// request fail, as with no internet.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const route = arg('route', '#/');
const [W, H] = arg('size', '1180x820').split('x').map(Number);
const scriptFile = arg('script');
const shotFile = arg('shot');
const preset = arg('state', '');
const timeout = Number(arg('timeout', 90)) * 1000;
const base = arg('base', 'http://localhost:8123/index.html');
const net = process.argv.includes('--net') ? 'real' : process.argv.includes('--offline') ? 'offline' : 'fake';

// Tiny pictures (160×120 JPEG) for the pretend class drawings.
const IMG = {
  house: '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',
  cat: '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',
  flower: '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',
};

// The bad words of server/schema.sql, so the pretend server masks exactly the same.
const SCHEMA = readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8');
const badFrom = SCHEMA.indexOf('insert into public.bad_words');
const BAD_WORDS = [...SCHEMA.slice(badFrom, SCHEMA.indexOf('on conflict do nothing;', badFrom)).matchAll(/\('((?:[^']|'')+)'\)/g)]
  .map(m => m[1].replace(/''/g, "'"));

// The pretend class server: the same calls as server/schema.sql, with the same
// parameters, answers and error codes, kept in this page's localStorage. Class
// 'test-class' already has Маша and Noa, three drawings (Noa gave Маша's flower a
// heart) and four chat messages; 'tset-class' is a known typo moved to 'test-class'.
// What the parents' admin page switches (server table class_settings) lives in
// db.settings: { 'test-class': { chat: false, drawings: false, locked: true }, '*': {...} };
// a test sets it through the same localStorage entry. A player may carry forcedName
// and forcedClass (an admin rename or move), which klyaksa_save keeps.
// Errors come back as the real PostgREST sends them to the public key:
// {"code":"42501"} with 401, {"code":"22023"} with 400, {"code":"54000"} with
// 500 and {"code":"55000"} with 500, so the app must look at the code, not the status. This function is never
// run in Node: its source text is put into the page.
function fakeServer(mode, IMG, BAD) {
  if (mode === 'real') return;
  const real = window.fetch.bind(window);
  const KEY = 'klyaksa.fakeServer';
  const HOUR = 3600e3;
  const ago = ms => new Date(Date.now() - ms).toISOString();
  // Hours ago, but never before this week began, so "best of the week" always has them.
  const inWeek = hours => ago(Math.min(hours * HOUR, (Date.now() - weekStart()) / 2));
  const seed = () => ({
    players: [
      { id: 'fake-1', secret: 'x', klass: 'test-class', name: 'Маша', avatar: '🦄', stars: 40, week: 9, visible: true },
      { id: 'fake-2', secret: 'x', klass: 'test-class', name: 'Noa', avatar: '🐼', stars: 25, week: 14, visible: true },
    ],
    moves: { 'tset-class': 'test-class' },
    posts: [
      { id: 1, player: 'fake-1', klass: 'test-class', title: 'Котик', thumb: IMG.cat, image: IMG.cat, w: 160, h: 120, hidden: false, at: ago(50 * HOUR) },
      { id: 2, player: 'fake-2', klass: 'test-class', title: 'Мой рисунок', thumb: IMG.house, image: IMG.house, w: 160, h: 120, hidden: false, at: inWeek(5) },
      { id: 3, player: 'fake-1', klass: 'test-class', title: 'Кит и кораблик', thumb: IMG.flower, image: IMG.flower, w: 160, h: 120, hidden: false, at: inWeek(1) },
    ],
    likes: [{ post: 3, player: 'fake-2', at: inWeek(0.5) }],
    messages: [
      { id: 1, player: 'fake-1', klass: 'test-class', kind: 'text', body: 'Привет! Кто сегодня рисовал?', hidden: false, at: ago(26 * HOUR) },
      { id: 2, player: 'fake-2', klass: 'test-class', kind: 'text', body: 'שלום! ציירתי חתול 🐱', hidden: false, at: ago(25 * HOUR) },
      { id: 3, player: 'fake-2', klass: 'test-class', kind: 'post', body: JSON.stringify({ post: 2, what: 'Мой рисунок' }), hidden: false, at: inWeek(5) },
      { id: 4, player: 'fake-1', klass: 'test-class', kind: 'result', body: JSON.stringify({ t: 'lesson', what: 'Котик', stars: 3 }), hidden: false, at: ago(2 * HOUR) },
    ],
    reports: [],
    settings: {},
  });
  const load = () => ({ ...seed(), ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) });
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const oops = (status, code) => { throw { status, code }; };
  const deny = () => oops(401, '42501');
  const bad = () => oops(400, '22023');
  const limit = () => oops(500, '54000');
  // Switched off by the grown-ups, or a class closed to newcomers.
  const off = () => oops(500, '55000');

  const cleanClass = s => { const c = String(s || '').trim().toLowerCase(); return /^[a-z0-9-]{4,24}$/.test(c) ? c : ''; };
  const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u20e3\u00ad\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0]/g;
  const tidy = (s, n) => String(s || '').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim().slice(0, n);
  // A word is matched anywhere, or as a whole word when stored as '=word' (as klyaksa_mask_words).
  const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const RUDE = new RegExp([...BAD].sort((a, b) => b.length - a.length)
    .map(w => (w.startsWith('=') ? `(?<![\\p{L}\\p{N}_])${esc(w.slice(1))}(?![\\p{L}\\p{N}_])` : esc(w))).join('|'), 'giu');
  const TLD = 'com|ru|net|org|il|io|app|me|ly|gg|co|info|xyz|рф|be|ee|tv|site|ua|uk|us|link|online|top|live|ws';
  const mask = s => String(s)
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, '***')
    .replace(/@[\p{L}\p{N}_.]{3,}/gu, '***')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '***')
    .replace(new RegExp('(?:[\\p{L}\\p{N}_-]+\\.)+(?:' + TLD + ')(?![\\p{L}\\p{N}_])(?:[/?#]\\S*)?', 'giu'), '***')
    .replace(/\+?\(?\d(?:[ ._/,()–—-]{0,3}\d){6,}/g, '***')
    .replace(RUDE, '***');
  const isJpeg = b64 => { try { const s = atob(String(b64).slice(0, 8)); return s.charCodeAt(0) === 0xff && s.charCodeAt(1) === 0xd8 && s.charCodeAt(2) === 0xff; } catch { return false; } };
  const bytes = b64 => Math.floor(String(b64).length * 3 / 4);
  // Sunday, the start of the school week.
  const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); };

  window.fetch = async (url, opts) => {
    const m = String(url).match(/\/rest\/v1\/rpc\/(klyaksa_\w+)$/);
    if (!m) return real(url, opts);
    if (mode === 'offline') throw new TypeError('Failed to fetch');
    await new Promise(r => setTimeout(r, 30));
    const b = JSON.parse(opts.body || '{}');
    const db = load();
    const saveDb = () => localStorage.setItem(KEY, JSON.stringify(db));
    const byId = id => db.players.find(p => p.id === id);
    const shown = row => byId(row.player)?.visible && !row.hidden;
    // Her own row, proven by the secret, visible and in a class; the class always comes from here.
    const me = () => {
      const p = byId(b.p_id);
      if (!p || p.secret !== b.p_secret || !p.visible || !p.klass) deny();
      return p;
    };
    // A switch is on unless the class row or the '*' row turns it off; locked if either says so.
    const sw = klass => {
      const a = (db.settings || {})[klass] || {};
      const g = (db.settings || {})['*'] || {};
      return { chat: a.chat !== false && g.chat !== false, drawings: a.drawings !== false && g.drawings !== false, locked: !!(a.locked || g.locked) };
    };
    const reportedBy = (who, kind, id) => db.reports.some(r => r.reporter === who && r.kind === kind && r.target === id);
    const count = klass => db.players.filter(p => p.visible && p.klass === klass).length;
    // Hearts of blocked players do not count.
    const hearts = id => db.likes.filter(l => l.post === id && byId(l.player)?.visible).length;
    const postOf = (p, id) => {
      const post = db.posts.find(x => x.id === +id);
      if (!post || post.klass !== p.klass || !shown(post)) bad();
      return post;
    };
    const noticeOf = id => x => x.kind === 'post' && JSON.parse(x.body).post === id;
    // A notice of a drawing that is gone, hidden or reported by her is left out for her.
    const noticeShown = (p, x) => {
      if (x.kind !== 'post') return true;
      const d = db.posts.find(y => y.id === JSON.parse(x.body).post);
      return !!d && !d.hidden && !reportedBy(p.id, 'post', d.id);
    };
    // Messages and drawings keep the name and avatar she had when she wrote or showed them.
    const author = x => ({ name: x.name || byId(x.player).name, avatar: x.avatar || byId(x.player).avatar });
    const say = (p, kind, body) => {
      const id = Math.max(0, ...db.messages.map(x => x.id)) + 1;
      db.messages.push({ id, player: p.id, klass: p.klass, kind, body, name: p.name, avatar: p.avatar, hidden: false, at: new Date().toISOString() });
      return id;
    };
    // Deleting only empties and hides: it still counts toward her limits, and reports stay.
    const unsay = x => { x.hidden = true; if (x.kind !== 'post') x.body = ''; };
    try {
      switch (m[1]) {
        case 'klyaksa_save': {
          let p = byId(b.p_id);
          if (p && p.secret !== b.p_secret) deny();
          const c = cleanClass(b.p_class);
          if (!c) bad();
          // An admin move or rename wins over what the device sends.
          const klass = p?.forcedClass || db.moves[c] || c;
          // The name is masked like the chat and must keep a letter.
          const name = p?.forcedName || mask(tidy(b.p_name, 24));
          if (!p?.forcedName && !/\p{L}/u.test(name)) bad();
          // At most 60 newcomers a day in a class, moving in included.
          const moved = !p || p.klass !== klass;
          // A class closed to newcomers takes nobody new and nobody moving in (an admin move excepted).
          if (moved && !p?.forcedClass && sw(klass).locked) off();
          if (moved && db.players.filter(x => x.klass === klass && Date.parse(x.joinedAt || 0) > Date.now() - 24 * HOUR).length >= 60) limit();
          // "visible" is set only for a new player: a block by hand stays.
          if (!p) db.players.push(p = { id: b.p_id, secret: b.p_secret, stars: b.p_stars, week: 0, visible: b.p_visible !== false });
          // She left while blocked, renamed or moved (klyaksa_forget kept her row): back like a newcomer, with that.
          else if (!p.klass) Object.assign(p, { stars: b.p_stars, week: 0 });
          else if (moved) {
            // Her drawings and messages leave the old class.
            db.posts.filter(x => x.player === p.id && x.klass !== klass).forEach(x => { x.hidden = true; });
            db.messages.filter(x => x.player === p.id && x.klass !== klass).forEach(unsay);
          }
          const gain = Math.max(0, b.p_stars - p.stars);
          Object.assign(p, { klass, name, avatar: b.p_avatar, stars: p.stars + gain, week: p.week + gain, joinedAt: moved ? new Date().toISOString() : p.joinedAt });
          saveDb();
          return reply({ ok: true, stars: p.stars, class: klass });
        }
        case 'klyaksa_board': {
          const c = cleanClass(b.p_class);
          return reply(db.players.filter(p => p.visible && c && p.klass === (db.moves[c] || c)).sort((a, c) => c.stars - a.stars).slice(0, b.p_limit)
            .map(({ id, secret, name, avatar, stars, week }) => ({ name, avatar, stars, week, me: id === b.p_id && secret === b.p_secret })));
        }
        case 'klyaksa_forget': {
          const gone = db.players.filter(p => p.id === b.p_id && p.secret === b.p_secret).map(p => p.id);
          // What the admin page set (a block, a name, a class) stays: her row is kept in no class.
          const keep = db.players.filter(p => gone.includes(p.id) && (!p.visible || p.forcedName || p.forcedClass));
          keep.forEach(p => Object.assign(p, { klass: '', stars: 0, week: 0, name: p.forcedName || '—', avatar: '🐱' }));
          db.players = db.players.filter(p => !gone.includes(p.id) || keep.includes(p));
          // Everything of hers goes with her, as the cascades do on the server.
          const posts = db.posts.filter(x => gone.includes(x.player)).map(x => x.id);
          db.posts = db.posts.filter(x => !gone.includes(x.player));
          db.likes = db.likes.filter(l => !gone.includes(l.player) && !posts.includes(l.post));
          db.messages = db.messages.filter(x => !gone.includes(x.player));
          db.reports = db.reports.filter(r => !gone.includes(r.reporter));
          saveDb();
          return reply({ ok: gone.length > 0 });
        }
        case 'klyaksa_class_check': {
          let c = cleanClass(b.p_class);
          c = db.moves[c] || c;
          if (c && !count(c) && !c.startsWith('class-') && count(`class-${c}`)) c = `class-${c}`;
          return reply({ class: c, players: c ? count(c) : 0, locked: c ? sw(c).locked : false });
        }
        case 'klyaksa_post_add': {
          const p = me();
          // Every parameter is required, as on the server (PostgREST answers 404 PGRST202 otherwise).
          if (!['p_title', 'p_thumb', 'p_image', 'p_w', 'p_h'].every(k => k in b)) return reply({ code: 'PGRST202' }, 404);
          if (!sw(p.klass).drawings) off();
          if (b.p_thumb == null || b.p_image == null || String(b.p_title || '').length > 1000) bad();
          if (bytes(b.p_thumb) > 45000 || bytes(b.p_image) > 450000) limit();
          if (!isJpeg(b.p_thumb) || !isJpeg(b.p_image)) bad();
          const day = Date.now() - 24 * HOUR;
          // Deleted ones count too.
          if (db.posts.filter(x => x.player === p.id && Date.parse(x.at) > day).length >= 10) limit();
          if (db.posts.filter(x => x.klass === p.klass && Date.parse(x.at) > day).length >= 60) limit();
          const title = mask(tidy(b.p_title, 60));
          const id = Math.max(0, ...db.posts.map(x => x.id)) + 1;
          const size = v => (Number.isInteger(v) && v >= 1 && v <= 10000 ? v : null);
          db.posts.push({ id, player: p.id, klass: p.klass, title, thumb: b.p_thumb, image: b.p_image, w: size(b.p_w), h: size(b.p_h),
            name: p.name, avatar: p.avatar, hidden: false, at: new Date().toISOString() });
          // With the chat switched off its title does not go there.
          if (sw(p.klass).chat) say(p, 'post', JSON.stringify({ post: id, what: title }));
          saveDb();
          return reply({ ok: true, id });
        }
        case 'klyaksa_posts': {
          const p = me();
          const from = b.p_sort === 'week' ? weekStart() : Date.now() - 90 * 24 * HOUR;
          const rows = db.posts.filter(x => x.klass === p.klass && shown(x) && Date.parse(x.at) >= from && !reportedBy(p.id, 'post', x.id))
            .map(x => ({
              id: x.id, ...author(x), title: x.title, thumb: x.thumb, w: x.w, h: x.h,
              hearts: hearts(x.id), liked: db.likes.some(l => l.post === x.id && l.player === p.id), mine: x.player === p.id, at: x.at,
            }))
            .sort((x, y) => (b.p_sort === 'week' ? y.hearts - x.hearts : 0) || Date.parse(y.at) - Date.parse(x.at));
          return reply(rows.slice(0, Math.min(60, Math.max(1, b.p_limit || 60))));
        }
        case 'klyaksa_post_image':
          return reply({ image: postOf(me(), b.p_post).image });
        case 'klyaksa_like': {
          const p = me();
          const post = postOf(p, b.p_post);
          if (post.player === p.id) bad();
          db.likes = db.likes.filter(l => !(l.post === post.id && l.player === p.id));
          if (b.p_on) db.likes.push({ post: post.id, player: p.id, at: new Date().toISOString() });
          saveDb();
          return reply({ hearts: hearts(post.id), liked: !!b.p_on });
        }
        case 'klyaksa_post_delete': {
          const p = me();
          const post = db.posts.find(x => x.id === +b.p_post);
          if (!post || post.player !== p.id) return reply({ ok: false });
          // Emptied and hidden, with its notice: it still counts toward the limits, and reports stay.
          Object.assign(post, { hidden: true, thumb: '/9j/', image: '/9j/' });
          db.messages.filter(x => x.player === p.id && noticeOf(post.id)(x)).forEach(unsay);
          saveDb();
          return reply({ ok: true });
        }
        case 'klyaksa_chat_send': {
          const p = me();
          if (!sw(p.klass).chat) off();
          let body;
          if (b.p_body == null || String(b.p_body).length > 2000) bad();
          if (b.p_kind === 'text') {
            body = tidy(b.p_body, 200);
            if (!/[\p{L}\p{N}\p{S}]/u.test(body)) bad();
            body = mask(body);
          } else if (b.p_kind === 'result') {
            let r;
            try { r = JSON.parse(b.p_body); } catch { bad(); }
            if (!r || typeof r !== 'object' || !['lesson', 'game', 'coloring', 'draw'].includes(r.t) || typeof r.what !== 'string') bad();
            if (r.stars != null && !(Number.isInteger(r.stars) && r.stars >= 0 && r.stars <= 3)) bad();
            const what = mask(tidy(r.what, 80));
            if (!what) bad();
            body = JSON.stringify({ t: r.t, what, ...(r.stars != null ? { stars: r.stars } : {}) });
          } else bad();
          // Notices of shared drawings do not count toward the pace.
          const mine = db.messages.filter(x => x.player === p.id && x.kind !== 'post').map(x => Date.parse(x.at));
          const now = Date.now();
          if (mine.some(at => now - at < 2000) || mine.filter(at => now - at < 600e3).length >= 30 || mine.filter(at => now - at < 24 * HOUR).length >= 300) limit();
          const id = say(p, b.p_kind, body);
          saveDb();
          return reply({ id, body });
        }
        case 'klyaksa_chat': {
          const p = me();
          const n = Math.min(120, Math.max(1, b.p_limit || 80));
          const rows = db.messages.filter(x => x.klass === p.klass && shown(x) && Date.parse(x.at) > Date.now() - 30 * 24 * HOUR && !reportedBy(p.id, 'msg', x.id) && noticeShown(p, x))
            .sort((x, y) => x.id - y.id);
          const pick = b.p_after > 0 ? rows.filter(x => x.id > b.p_after).slice(0, n) : rows.slice(-n);
          return reply(pick.map(x => ({ id: x.id, ...author(x), kind: x.kind, body: x.body, at: x.at, mine: x.player === p.id })));
        }
        case 'klyaksa_chat_delete': {
          const p = me();
          const msg = db.messages.find(x => x.id === +b.p_msg);
          if (!msg || msg.player !== p.id) return reply({ ok: false });
          unsay(msg);
          saveDb();
          return reply({ ok: true });
        }
        case 'klyaksa_report': {
          const p = me();
          if (!['msg', 'post'].includes(b.p_kind)) bad();
          const row = (b.p_kind === 'msg' ? db.messages : db.posts).find(x => x.id === +b.p_target);
          if (!row || row.klass !== p.klass || row.player === p.id) bad();
          if (db.reports.filter(r => r.reporter === p.id && Date.parse(r.at) > Date.now() - 24 * HOUR).length >= 50) limit();
          if (!reportedBy(p.id, b.p_kind, row.id)) db.reports.push({ reporter: p.id, kind: b.p_kind, target: row.id, at: new Date().toISOString() });
          if (new Set(db.reports.filter(r => r.kind === b.p_kind && r.target === row.id).map(r => r.reporter)).size >= 2) {
            row.hidden = true;
            // A hidden drawing takes its notice in the chat with it.
            if (b.p_kind === 'post') db.messages.filter(noticeOf(row.id)).forEach(x => { x.hidden = true; });
          }
          saveDb();
          return reply({ ok: true });
        }
        case 'klyaksa_news': {
          const p = me();
          // What the chat and the drawings show her, or the badge would never go away.
          const top = (list, days, kind, more = () => true) => Math.max(0, ...list.filter(x => x.klass === p.klass && x.player !== p.id && shown(x)
            && Date.parse(x.at) > Date.now() - days * 24 * HOUR && !reportedBy(p.id, kind, x.id) && more(x)).map(x => x.id));
          return reply({ msg: top(db.messages, 30, 'msg', x => noticeShown(p, x)), post: top(db.posts, 90, 'post'), ...(({ chat, drawings }) => ({ chat, drawings }))(sw(p.klass)) });
        }
        default:
          return new Response('{}', { status: 404 });
      }
    } catch (e) {
      if (e && e.code) return reply({ code: e.code, message: `fake server: ${e.code}` }, e.status);
      throw e;
    }
  };
}
const FAKE_SERVER = `(${fakeServer})(${JSON.stringify(net)}, ${JSON.stringify(IMG)}, ${JSON.stringify(BAD_WORDS)});\n`;

// Runs in the page before the app. Everything a test script needs.
const HELPERS = `
window.T = {
  errors: [],
  wait: ms => new Promise(r => setTimeout(r, ms)),
  q: (s, root = document) => root.querySelector(s),
  qq: (s, root = document) => [...root.querySelectorAll(s)],
  // Finds a button or link by its text: exact match first, then partial.
  byText(text, sel = 'button, a') {
    const all = T.qq(sel).filter(e => e.offsetParent !== null);
    return all.find(e => e.textContent.trim() === text) || all.find(e => e.textContent.includes(text)) || null;
  },
  async go(hash, ms = 600) { location.hash = hash; await T.wait(ms); },
  // click() for things with onclick; accepts an element, a selector or a button text.
  async click(target, ms = 150) {
    const el = typeof target === 'string' ? (T.q(target) || T.byText(target)) : target;
    if (!el) throw new Error('click: not found: ' + target);
    el.click();
    await T.wait(ms);
    return el;
  },
  center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  // A pointer gesture through client points [[x, y], ...]: down, moves, up.
  // type is 'pen' (default), 'touch' or 'mouse'. pause is the delay between moves in ms.
  async stroke(pts, { el, type = 'pen', id = 7, pause = 0 } = {}) {
    const target = el || document.elementFromPoint(pts[0][0], pts[0][1]);
    if (!target) throw new Error('stroke: nothing at ' + pts[0]);
    const ev = (name, [x, y], buttons) => target.dispatchEvent(new PointerEvent(name, {
      bubbles: true, cancelable: true, composed: true, pointerId: id, pointerType: type, isPrimary: true,
      clientX: x, clientY: y, pressure: buttons ? 0.5 : 0, width: 20, height: 20, button: 0, buttons,
    }));
    ev('pointerdown', pts[0], 1);
    for (const p of pts.slice(1)) { if (pause) await T.wait(pause); ev('pointermove', p, 1); }
    ev('pointerup', pts[pts.length - 1], 0);
    await T.wait(30);
  },
  // A pointer tap on an element (for things that listen to pointer events, not click).
  async tap(target, opts) {
    const el = typeof target === 'string' ? T.q(target) : target;
    if (!el) throw new Error('tap: not found: ' + target);
    await T.stroke([T.center(el)], { el, ...opts });
  },
  // Elements that stick out of the screen sideways: should be an empty list.
  overflow() {
    // Dialogs and popovers live outside .screen; a popover must also fit top to bottom.
    return T.qq('.screen *, .modal-back *, .pop, .pop *').filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1 || (e.matches('.pop') && (r.bottom > innerHeight + 1 || r.top < -1)));
    })
      .slice(0, 8).map(e => e.className || e.tagName);
  },
  // True when the element is fully inside the visible screen.
  visible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; },
  state: () => JSON.parse(localStorage.getItem('klyaksa.v1') || '{}'),
  // Saves a screenshot right now, e.g. await T.shot('/path/step1.png').
  shot: path => new Promise(res => { window.__shotDone = res; window.__shot(path); }),
};
addEventListener('error', e => T.errors.push(String(e.message)));
addEventListener('unhandledrejection', e => T.errors.push('unhandled: ' + String(e.reason && e.reason.stack || e.reason)));
`;

const profile = mkdtempSync(join(tmpdir(), 'klyaksa-drive-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' });

const finish = code => {
  try { chrome.kill('SIGKILL'); } catch { /* already gone */ }
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* busy */ } process.exit(code); }, 150);
};
const hard = setTimeout(() => { console.log(JSON.stringify({ error: `timed out after ${timeout / 1000}s` })); finish(1); }, timeout + 15000);

const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150 && !existsSync(portFile); i++) await sleep(100);
  const port = readFileSync(portFile, 'utf8').split('\n')[0].trim();
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = list.find(t => t.type === 'page');
    if (!page) await sleep(100);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const waiting = new Map();
  const pageErrors = [];
  let loaded = () => {};
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    waiting.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const snap = async path => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(dirname(resolve(path)), { recursive: true });
    writeFileSync(path, Buffer.from(data, 'base64'));
  };
  ws.onmessage = async m => {
    const msg = JSON.parse(m.data);
    if (msg.id) {
      const w = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) w.rej(new Error(msg.error.message)); else w.res(msg.result);
      return;
    }
    if (msg.method === 'Page.loadEventFired') loaded();
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      pageErrors.push(`${d.exception?.description || d.text} @ ${d.url || ''}:${d.lineNumber}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + msg.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
    if (msg.method === 'Runtime.bindingCalled' && msg.params.name === '__shot') {
      await snap(msg.params.payload);
      await send('Runtime.evaluate', { expression: 'window.__shotDone && window.__shotDone()' });
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Runtime.addBinding', { name: '__shot' });
  const seed = preset
    ? `try { if (!sessionStorage.__seeded) { sessionStorage.__seeded = 1; localStorage.setItem('klyaksa.v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('klyaksa.v1') || '{}'), ${preset}))); } } catch (e) {}`
    : '';
  await send('Page.addScriptToEvaluateOnNewDocument', { source: seed + FAKE_SERVER + HELPERS });
  const onLoad = new Promise(res => { loaded = res; });
  await send('Page.navigate', { url: base + route });
  await Promise.race([onLoad, sleep(15000)]);
  await sleep(900);

  let result = null;
  if (scriptFile) {
    const code = readFileSync(scriptFile, 'utf8');
    const r = await Promise.race([
      send('Runtime.evaluate', { expression: `(async () => {\n${code}\n})()`, awaitPromise: true, returnByValue: true }),
      sleep(timeout).then(() => ({ timedOut: true })),
    ]);
    if (r.timedOut) result = { error: `script did not finish in ${timeout / 1000}s` };
    else if (r.exceptionDetails) result = { error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
    else result = r.result.value ?? null;
  }
  const inPage = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.T ? T.errors : ["helpers missing: the page did not load"])', returnByValue: true });
  if (shotFile) await snap(shotFile);
  console.log(JSON.stringify({ result, errors: [...new Set([...pageErrors, ...JSON.parse(inPage.result.value)])] }, null, 1));
  clearTimeout(hard);
  finish(0);
} catch (e) {
  console.log(JSON.stringify({ error: String(e && e.stack || e) }));
  clearTimeout(hard);
  finish(1);
}
