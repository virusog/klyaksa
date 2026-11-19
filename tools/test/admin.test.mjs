// Tests the parents' admin page (admin/) end to end on the real server.
//   node tools/test/admin.test.mjs        (needs the local server on port 8123)
//   ADMIN_SHOTS=/some/dir node tools/test/admin.test.mjs   also saves screenshots there
// Makes a temporary admin key (note 'test-<tag>-admin', only its sha256 on the
// server) and a throwaway class test-<tag>-adm with three players, messages, two
// drawings and reports. Opens /admin/#key=… in headless Chrome at 1280x800 and
// 390x844 (tools/drive.mjs --net with tools/test/admin-page.js), which looks at
// every section and blocks and unblocks a player, hides and shows a message and
// switches the class chat off and on (and once renames and moves a player and back),
// checking each through the server; and a wrong key in the address. Everything
// is removed in finally: the players and their things, the class settings, the
// log rows of the key and the key itself.
import { RATING_URL, RATING_KEY } from '../../js/net-config.js';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const rpc = async (name, body) => {
  const r = await fetch(`${RATING_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let answer = null;
  try { answer = text ? JSON.parse(text) : null; } catch { answer = { raw: text.slice(0, 200) }; }
  return { status: r.status, body: answer };
};
// Admin SQL through the Management API, with the Supabase login of this machine.
const sql = async query => {
  let token;
  try { token = readFileSync(`${homedir()}/.config/supabase/access-token`, 'utf8').trim(); } catch { return null; }
  const r = await fetch('https://api.supabase.com/v1/projects/qofvpeteuvwhfnwhmdhq/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  });
  return r.ok ? r.json() : null;
};
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); return ok; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const tag = randomBytes(3).toString('hex');
const CLASS = `test-${tag}-adm`;
const KEY = randomBytes(32).toString('hex');
const NOTE = `test-${tag}-admin`;
const adm = (action, args = {}) => rpc('klyaksa_admin', { p_key: KEY, p_action: action, p_args: args });
// Two pictures of the pretend server in tools/drive.mjs (160×120 JPEG).
const DRIVE = readFileSync(join(ROOT, 'tools/drive.mjs'), 'utf8');
const IMG = name => DRIVE.match(new RegExp(`\\b${name}: '([^']+)'`))[1];

const made = [];
const join_ = async (who, name, lang = 'ru') => {
  const p = { p_id: randomUUID(), p_secret: randomBytes(16).toString('hex') };
  made.push(p);
  const r = await rpc('klyaksa_save', { ...p, p_class: CLASS, p_name: name, p_avatar: '🦊', p_lang: lang, p_stars: 7, p_visible: true });
  if (!check(r.status === 200 && r.body?.class === CLASS, `${who} joins the test class (${r.status} ${JSON.stringify(r.body)})`)) throw new Error('setup failed');
  return p;
};
const call = (name, p, body = {}) => rpc(name, { p_id: p.p_id, p_secret: p.p_secret, ...body });
const must = async (what, promise) => {
  const r = await promise;
  if (!check(r.status === 200, `${what} (${r.status} ${JSON.stringify(r.body).slice(0, 200)})`)) throw new Error('setup failed');
  return r.body;
};

const tmp = mkdtempSync(join(tmpdir(), 'klyaksa-admin-'));
let keyMade = false;
try {
  const ready = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:8123/admin/index.html'], { encoding: 'utf8' });
  if (ready.stdout !== '200') throw new Error('the local server is not running on port 8123 (python3 -m http.server 8123)');
  const keyRow = await sql(`insert into public.admin_keys (hash, note) values ('${createHash('sha256').update(KEY).digest('hex')}', '${NOTE}') returning note`);
  if (!keyRow) {
    console.log('skip the admin page test: no admin token on this machine');
  } else {
    keyMade = true;
    // The class: three girls, a little chat, two drawings and reports.
    const p = { ann: await join_('Аня', 'Аня'), bella: await join_('Бэлла', 'Бэлла'), noa: await join_('Noa', 'נועה', 'he') };
    const msgA = (await must('Аня writes', call('klyaksa_chat_send', p.ann, { p_kind: 'text', p_body: 'Привет всем' }))).id;
    const msgB = (await must('Бэлла writes', call('klyaksa_chat_send', p.bella, { p_kind: 'text', p_body: 'Как дела? 🙂' }))).id;
    const msgR = (await must('Noa posts a result', call('klyaksa_chat_send', p.noa, { p_kind: 'result', p_body: JSON.stringify({ t: 'lesson', what: 'Кот', stars: 3 }) }))).id;
    const postA = (await must('Аня shows a drawing', call('klyaksa_post_add', p.ann, { p_title: 'Кошка', p_thumb: IMG('cat'), p_image: IMG('cat'), p_w: 160, p_h: 120 }))).id;
    await must('Noa shows a drawing', call('klyaksa_post_add', p.noa, { p_title: 'בית', p_thumb: IMG('house'), p_image: IMG('house'), p_w: 160, p_h: 120 }));
    await must('Бэлла gives a heart', call('klyaksa_like', p.bella, { p_post: postA, p_on: true }));
    await must('Бэлла reports Аня', call('klyaksa_report', p.bella, { p_kind: 'msg', p_target: msgA }));
    await must('Noa reports Аня', call('klyaksa_report', p.noa, { p_kind: 'msg', p_target: msgA }));
    await must('Бэлла reports the drawing', call('klyaksa_report', p.bella, { p_kind: 'post', p_target: postA }));
    // A report on a message its author then deleted, and one from the chat on the notice of Аня's drawing.
    await sleep(2100); // one message in 2 seconds
    const msgD = (await must('Noa writes', call('klyaksa_chat_send', p.noa, { p_kind: 'text', p_body: 'Это я сотру' }))).id;
    await must('Аня reports it', call('klyaksa_report', p.ann, { p_kind: 'msg', p_target: msgD }));
    await must('Noa deletes it', call('klyaksa_chat_delete', p.noa, { p_msg: msgD }));
    const noticeA = (await adm('chat', { class: CLASS })).body?.find?.(m => m.kind === 'post' && JSON.parse(m.body).post === postA)?.id;
    await must('Noa reports the notice of the drawing', call('klyaksa_report', p.noa, { p_kind: 'msg', p_target: noticeA }));

    // The page, at both sizes; the second one also clears a report.
    const sizes = ['1280x800', '390x844'];
    for (const [i, size] of sizes.entries()) {
      const vars = { cls: CLASS, cls2: `${CLASS}2`, p, msgA, msgB, msgR, msgD, postA, noticeA, last: i === sizes.length - 1, shots: process.env.ADMIN_SHOTS || '' };
      const file = join(tmp, `admin-page-${size}.js`);
      writeFileSync(file, readFileSync(join(ROOT, 'tools/test/admin-page.js'), 'utf8').replace('const V = __VARS__;', `const V = ${JSON.stringify(vars)};`));
      const started = Date.now();
      const run = spawnSync('node', ['tools/drive.mjs', '--net', '--base', 'http://localhost:8123/admin/', '--route', `#key=${KEY}`,
        '--size', size, '--script', file, '--timeout', '240'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      let j = {};
      try { j = JSON.parse(run.stdout.slice(run.stdout.indexOf('{'))); } catch { j = { error: `no answer from the driver: ${(run.stdout + run.stderr).slice(-800)}` }; }
      const probs = [...(j.result?.problems || []), ...(j.result?.error ? [j.result.error] : []), ...(j.error ? [j.error] : []), ...(j.errors || []).map(e => `page error: ${e}`)];
      if (Object.keys(j.result?.out?.sections || {}).length < 7) probs.push(`only some sections were seen: ${run.stdout.slice(-1500)}`);
      check(probs.length === 0, `the admin page at ${size}: ${Object.keys(j.result?.out?.sections || {}).length} sections, ${Math.round((Date.now() - started) / 1000)} s${probs.length ? `\n      ${probs.join('\n      ')}` : ''}`);
      await sleep(300);
    }

    // A wrong key: refused, not kept anywhere, not left in the address.
    const wrong = join(tmp, 'admin-wrong-key.js');
    writeFileSync(wrong, `const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await T.wait(100); } return null; };
check(!!(await until(() => /Ключ не подходит/.test(T.q('.login-error')?.textContent || ''))), 'the login says the key does not fit (' + T.q('.login-error')?.textContent + ')');
check(!localStorage.getItem('blobika.admin.key') && !sessionStorage.getItem('blobika.admin.key'), 'the wrong key is not kept');
check(!/key=/.test(location.href), 'nor left in the address (' + location.hash + ')');
check(!!T.q('#key') && !!T.q('#remember') && !T.q('#remember').checked, 'the login offers "remember on this device", unticked');
return { problems };`);
    const wr = spawnSync('node', ['tools/drive.mjs', '--net', '--base', 'http://localhost:8123/admin/', '--route', `#key=${randomBytes(16).toString('hex')}`,
      '--size', '390x844', '--script', wrong, '--timeout', '60'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    let wj = {};
    try { wj = JSON.parse(wr.stdout.slice(wr.stdout.indexOf('{'))); } catch { wj = { error: `no answer from the driver: ${(wr.stdout + wr.stderr).slice(-800)}` }; }
    const wp = [...(wj.result?.problems || []), ...(wj.result?.error ? [wj.result.error] : []), ...(wj.error ? [wj.error] : []), ...(wj.errors || []).map(e => `page error: ${e}`)];
    check(wp.length === 0, `a wrong key in the address${wp.length ? `\n      ${wp.join('\n      ')}` : ''}`);

    // Everything the page changed was put back, and its log has each change.
    let r = await adm('players', { class: CLASS });
    check(r.body?.length === 3 && r.body.every(x => x.visible), 'every player is visible again');
    r = await adm('chat', { class: CLASS });
    const byId = Object.fromEntries((r.body || []).map(m => [m.id, m]));
    check(byId[msgB]?.hidden === false, 'the hidden message is shown again');
    check(byId[msgA]?.hidden === true && byId[msgA]?.reports === 0, `the reported message was kept hidden and its reports closed (${JSON.stringify(byId[msgA])})`);
    r = await adm('classes');
    const c = r.body?.find?.(x => x.code === CLASS);
    check(c?.chat === true && c?.drawings === true && c?.locked === false, `the class chat is on again (${JSON.stringify(c)})`);
    r = await adm('log', { limit: 100 });
    const mine = (r.body || []).filter(l => l.who === NOTE);
    const n = act => mine.filter(l => l.action === act).length;
    r = await adm('posts', { class: CLASS });
    check(r.body?.find?.(d => d.id === postA)?.hidden === false, 'the drawing hidden from its notice is shown again');
    check(n('player_set') === 9 && n('msg_set') === 4 && n('class_set') === 4 && n('reports_clear') === 3 && n('post_set') === 2,
      `the log has each change (${JSON.stringify(Object.fromEntries(['player_set', 'msg_set', 'class_set', 'reports_clear', 'post_set'].map(a => [a, n(a)])))})`);
  }
} catch (e) {
  check(false, String(e && e.stack || e));
} finally {
  for (const p of made) await rpc('klyaksa_forget', p);
  if (keyMade) {
    // A player the page blocked, renamed or moved keeps her row when she leaves (in no class): removed by id.
    const ids = made.map(p => `'${p.p_id}'`).join(',') || 'null';
    await sql(`delete from public.players where class_code like 'test-${tag}%' or id in (${ids});
      delete from public.class_settings where class_code like 'test-${tag}%';
      delete from public.admin_log where who = '${NOTE}' or args::text like '%test-${tag}%';
      delete from public.admin_keys where note = '${NOTE}'`);
    const left = await sql(`select
      (select count(*) from public.players where class_code like 'test-${tag}%' or id in (${ids}))::int as players,
      (select count(*) from public.posts where class_code like 'test-${tag}%')::int as posts,
      (select count(*) from public.messages where class_code like 'test-${tag}%')::int as messages,
      (select count(*) from public.class_settings where class_code like 'test-${tag}%')::int as settings,
      (select count(*) from public.admin_log where who = '${NOTE}' or args::text like '%test-${tag}%')::int as log,
      (select count(*) from public.admin_keys where note = '${NOTE}')::int as keys`);
    check(left && Object.values(left[0]).every(x => x === 0), `nothing of the test is left on the server (${JSON.stringify(left?.[0])})`);
  }
  try { rmSync(tmp, { recursive: true, force: true }); } catch { /* busy */ }
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
