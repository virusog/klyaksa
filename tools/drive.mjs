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
// The shared rating is replaced by a pretend server inside the page, so test
// runs never add players to the real one. --net uses the real server instead
// (only tools/test/profile.js needs that, and it removes its player again).
// --offline makes every rating request fail, as with no internet.
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

// The pretend rating server: the same three calls as server/schema.sql, kept
// in this page's localStorage, with two classmates already on it.
const FAKE_SERVER = `
(() => {
  const mode = ${JSON.stringify(net)};
  if (mode === 'real') return;
  const real = window.fetch.bind(window);
  const KEY = 'klyaksa.fakeServer';
  const load = () => JSON.parse(localStorage.getItem(KEY) || 'null') || { players: [
    { id: 'fake-1', secret: 'x', name: 'Маша', avatar: '🦄', stars: 40, week: 9, visible: true },
    { id: 'fake-2', secret: 'x', name: 'Noa', avatar: '🐼', stars: 25, week: 14, visible: true },
  ] };
  const reply = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  window.fetch = async (url, opts) => {
    const m = String(url).match(/\\/rest\\/v1\\/rpc\\/(klyaksa_\\w+)$/);
    if (!m) return real(url, opts);
    if (mode === 'offline') throw new TypeError('Failed to fetch');
    await new Promise(r => setTimeout(r, 30));
    const b = JSON.parse(opts.body || '{}');
    const db = load();
    const saveDb = () => localStorage.setItem(KEY, JSON.stringify(db));
    if (m[1] === 'klyaksa_save') {
      let p = db.players.find(x => x.id === b.p_id);
      if (p && p.secret !== b.p_secret) return new Response('{"message":"wrong secret"}', { status: 400 });
      if (!p) db.players.push(p = { id: b.p_id, secret: b.p_secret, stars: 0, week: 0 });
      const gain = Math.max(0, b.p_stars - p.stars);
      Object.assign(p, { name: String(b.p_name).trim().replace(/\\s+/g, ' ').slice(0, 24), avatar: b.p_avatar, stars: p.stars + gain, week: p.week + gain, visible: b.p_visible });
      saveDb();
      return reply(null);
    }
    if (m[1] === 'klyaksa_board') {
      return reply(db.players.filter(p => p.visible).sort((a, c) => c.stars - a.stars).slice(0, b.p_limit)
        .map(({ id, name, avatar, stars, week }) => ({ id, name, avatar, stars, week })));
    }
    if (m[1] === 'klyaksa_forget') {
      db.players = db.players.filter(p => !(p.id === b.p_id && p.secret === b.p_secret));
      saveDb();
      return reply(null);
    }
    return new Response('{}', { status: 404 });
  };
})();
`;

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
    return T.qq('.screen *').filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); })
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
