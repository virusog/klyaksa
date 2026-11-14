#!/usr/bin/env node
// Runs every automatic test of Klyaksa and prints one summary.
//   node tools/test/run.mjs          the full set (needs the local server on port 8123)
//   node tools/test/run.mjs quick    skips the deep visit of every level in every language
// Exit code 0 only when everything passed.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const quick = process.argv[2] === 'quick';
const tmp = mkdtempSync(join(tmpdir(), 'klyaksa-test-'));
const results = [];
// A class nobody else uses, so the real-server test never shows up on a real class board.
const TEST_CLASS = `test-${process.pid}`;

function run(name, cmd, args, { parse } = {}) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 30 * 60 * 1000 });
  const text = `${r.stdout || ''}${r.stderr || ''}`;
  let ok = r.status === 0;
  let detail = '';
  if (parse) {
    try { [ok, detail] = parse(text, r.status); } catch (e) { ok = false; detail = `could not read the result: ${String(e).slice(0, 200)}\n${text.slice(-1500)}`; }
  } else if (!ok) detail = text.slice(-3000);
  results.push({ name, ok, detail, sec: Math.round((Date.now() - started) / 1000) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${Math.round((Date.now() - started) / 1000)} s)`);
  if (!ok) console.log(detail.split('\n').map(l => `      ${l}`).join('\n'));
}

// Runs a page script through the driver; the script returns { problems: [...] }.
function page(name, script, { route = '#/', size = '1180x820', state, vars = {}, timeout = 600, flags = [] } = {}) {
  let code = readFileSync(join(ROOT, 'tools/test', script), 'utf8');
  for (const [k, v] of Object.entries(vars)) code = code.replaceAll(k, v);
  const file = join(tmp, `${name.replace(/\W+/g, '-')}.js`);
  writeFileSync(file, code);
  const args = ['tools/drive.mjs', '--route', route, '--size', size, '--script', file, '--timeout', String(timeout)];
  if (state) args.push('--state', JSON.stringify(state));
  args.push(...flags);
  run(name, 'node', args, {
    parse: text => {
      const j = JSON.parse(text.slice(text.indexOf('{')));
      const probs = [...(j.result?.problems || []), ...(j.result?.error ? [j.result.error] : []), ...(j.error ? [j.error] : []), ...(j.errors || []).map(e => `page error: ${e}`)];
      const extra = j.result?.seen ? ` (${j.result.seen.routes} screens, ${j.result.seen.levels} levels)` : '';
      return [probs.length === 0, probs.length ? `${probs.length} problems${extra}:\n${probs.slice(0, 40).join('\n')}` : extra];
    },
  });
}

const ready = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:8123/index.html'], { encoding: 'utf8' });
if (ready.stdout !== '200') {
  console.log('The local server is not running on port 8123 (start it: python3 -m http.server 8123).');
  process.exit(2);
}

run('syntax of every module', 'bash', ['-c', 'for f in js/*.js js/*/*.js js/lang/*/*.js sw.js; do node --check --input-type=module < "$f" || echo "BAD $f"; done | grep BAD; test $? -eq 1']);
run('every file is cached for offline use', 'python3', ['-c', `
import re,os,sys
s=open('sw.js',encoding='utf8').read()
listed=set(re.findall(r"'((?:js|css)/[^']+)'",s)); real=set()
for d in ('js','css'):
  for r,_,f in os.walk(d):
    for x in f: real.add(os.path.join(r,x))
bad=(real-listed)|(listed-real)
print('missing or stale:', bad) if bad else None
sys.exit(1 if bad else 0)`]);
run('all shown Russian text is marked for translation', 'node', ['tools/i18n.mjs', 'raw'], {
  parse: text => { const n = Number(text.match(/(\d+) unmarked/)?.[1]); return [n === 0, n ? text.slice(0, 3000) : '']; },
});
run('English and Hebrew are complete and well-formed', 'node', ['tools/i18n.mjs', 'check']);
run('rating server', 'node', ['tools/test/server.test.mjs']);

page('first launch from a class invitation, profile, cookie and the real rating server', 'profile.js', { route: '#/', flags: ['--net', '--base', `http://localhost:8123/index.html?class=${TEST_CLASS}`], vars: { __CLASS__: TEST_CLASS } });
page('the rating with no internet', 'offline.js', { route: '#/', state: { onboarded: true, name: 'Test', classCode: 'test-class' }, flags: ['--offline'] });
page('the rating without a class code', 'noclass.js', { route: '#/', state: { onboarded: true, name: 'Test' } });
page('Настя keeps her old progress', 'migrate.js', { route: '#/', state: { stars: 12, best: { x: 3 }, sound: false } });
for (const lang of ['ru', 'en', 'he']) {
  for (const size of ['1180x820', '820x1180']) {
    page(`every screen, ${lang}, ${size}`, 'sweep.js', {
      route: '#/', size, state: { lang, onboarded: true, name: 'Test', avatar: '🦊', unlockAll: true, rated: true, classCode: 'test-class', stars: 300 },
      vars: { __LANG__: lang, __DEEP__: String(!quick && size === '1180x820') }, timeout: 1500,
    });
  }
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed${failed.length ? `; failed: ${failed.map(r => r.name).join('; ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
