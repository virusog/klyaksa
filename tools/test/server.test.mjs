// Tests the rating functions on the real server. Run: node tools/test/server.test.mjs
// Uses classes nobody else has, and removes every player it creates.
import { RATING_URL, RATING_KEY } from '../../js/net-config.js';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const rpc = async (name, body) => {
  const r = await fetch(`${RATING_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};
// Admin SQL through the Management API, with the Supabase login of this machine.
const admin = async query => {
  let token;
  try { token = readFileSync(`${homedir()}/.config/supabase/access-token`, 'utf8').trim(); } catch { return null; }
  const r = await fetch('https://api.supabase.com/v1/projects/qofvpeteuvwhfnwhmdhq/database/query', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  });
  return r.ok ? r.json() : null;
};
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const tag = randomBytes(3).toString('hex');
const CLASS = `test-${tag}`;
const OTHER = `test-${tag}-b`;
const me = () => ({ p_id: randomUUID(), p_secret: randomBytes(16).toString('hex') });
const save = (p, extra = {}) => rpc('klyaksa_save', { ...p, p_class: CLASS, p_name: 'Тест', p_avatar: '🦊', p_lang: 'ru', p_stars: 5, p_visible: true, ...extra });
const board = async (p = {}, klass = CLASS) => (await rpc('klyaksa_board', { p_class: klass, p_id: p.p_id, p_secret: p.p_secret, p_limit: 300 })).body;
const made = [];

try {
  const a = me(); made.push(a);
  let r = await save(a, { p_name: '  Тест   Тестовна  ', p_stars: 7 });
  check(r.status === 200 && r.body.ok && r.body.stars === 7, 'a new player is created');
  let rows = await board(a);
  let row = rows.find(x => x.me);
  check(row && row.name === 'Тест Тестовна' && row.stars === 7, 'the name is tidied and she sees herself, marked as "me"');
  check(row && row.week === 0, `stars she brought with her do not count as this week (week ${row?.week})`);
  check(Object.keys(row || {}).sort().join() === 'avatar,me,name,stars,week', 'the board shows no ids and nothing secret');
  check((await board()).every(x => !x.me), 'without her secret nobody is marked as "me"');

  r = await save(a, { p_stars: 3 });
  check(r.status === 200 && r.body.stars === 7, 'stars never go down');
  r = await save(a, { p_stars: 12, p_name: 'Маша', p_avatar: '🐼', p_lang: 'he' });
  check(r.body.stars === 12, 'stars go up');
  row = (await board(a)).find(x => x.me);
  check(row.name === 'Маша' && row.avatar === '🐼' && row.week === 5, `name and avatar change, and new stars count for the week (week ${row.week})`);
  r = await save(a, { p_stars: 5000 });
  check(r.body.stars === 7 + 400, `at most 400 new stars a day (${r.body.stars})`);

  check((await board({}, OTHER)).length === 0, 'another class does not see her');
  check((await rpc('klyaksa_board', { p_class: '' })).body.length === 0, 'an empty class code shows nobody');
  r = await save(me(), { p_class: 'x' });
  check(r.status >= 400, 'a player without a proper class is refused');

  r = await save({ p_id: a.p_id, p_secret: randomBytes(16).toString('hex') }, { p_stars: 999 });
  check(r.status >= 400, 'someone without the secret cannot change her');
  row = (await board(a)).find(x => x.me);
  check(row.stars === 407, 'and her stars stay as they were');

  const b = me(); made.push(b);
  r = await save(b, { p_name: '   ' });
  check(r.status >= 400, 'an empty name is refused');
  r = await save(b, { p_name: '​​‮' });
  check(r.status >= 400, 'a name of invisible characters is refused');
  r = await save({ ...b, p_secret: 'short' });
  check(r.status >= 400, 'a short secret is refused');
  r = await save(b, { p_name: 'Оче​нь-очень-длинное-имя-которое-не-влезет', p_lang: 'xx', p_stars: 10 ** 9, p_avatar: 'ВЗЛОМ' });
  check(r.status === 200 && r.body.stars === 3000, `a new player starts with at most 3000 stars (${r.body?.stars})`);
  row = (await board(b)).find(x => x.me);
  check(row && row.name.length === 24 && !row.name.includes('​') && row.avatar === '🐱', 'long names are cut, hidden characters dropped, unknown avatars replaced');

  r = await save(b, { p_visible: false });
  check(!(await board()).some(x => x.name === row.name), 'a hidden player is not on the board');

  check((await rpc('klyaksa_board', { p_class: CLASS, p_limit: 1 })).body.length === 1, 'the limit works');
  check((await rpc('klyaksa_board', { p_class: CLASS })).status === 200, 'the board works with only the class');

  const direct = await fetch(`${RATING_URL}/rest/v1/players?select=*`, { headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}` } });
  const all = direct.ok ? await direct.json() : [];
  check(!direct.ok || all.length === 0, 'the table itself cannot be read with the public key');
  const del = await fetch(`${RATING_URL}/rest/v1/players?id=eq.${a.p_id}`, { method: 'DELETE', headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}` } });
  check((await board(a)).some(x => x.me), `the table cannot be changed with the public key (status ${del.status})`);
  check((await rpc('klyaksa_week_start', {})).status >= 400, 'the helper functions cannot be called from outside');

  // The week counts from the last total before Sunday. Needs the admin token of this machine.
  const sql = await admin(`update public.player_days set stars = 4 where player_id = '${a.p_id}' and day < public.klyaksa_week_start() returning day`);
  if (sql) {
    row = (await board(a)).find(x => x.me);
    check(row.week === 407 - 4, `this week counts from the last total before Sunday (week ${row.week}, want 403)`);
  } else console.log('skip the week check: no admin token on this machine');

  r = await rpc('klyaksa_forget', { p_id: a.p_id, p_secret: 'wrong-secret-wrong' });
  check(r.body.ok === false, 'forgetting needs the secret');

  // Leaving and joining again does not turn all her stars into "this week".
  r = await rpc('klyaksa_forget', a);
  check(r.body.ok === true, 'she can leave');
  r = await save(a, { p_stars: 407 });
  row = (await board(a)).find(x => x.me);
  check(row && row.week === 0, `after joining again her week starts at 0 (week ${row?.week})`);
} finally {
  for (const p of made) {
    const r = await rpc('klyaksa_forget', p);
    check(r.status === 200, `test player removed (${JSON.stringify(r.body)})`);
  }
  const left = await admin(`select count(*)::int as n from public.players where class_code like 'test-${tag}%'`);
  if (left) check(left[0].n === 0, `no test players left on the server (${left[0].n})`);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
