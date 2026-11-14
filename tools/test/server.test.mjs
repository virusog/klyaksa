// Tests the rating functions on the real server. Run: node tools/test/server.test.mjs
// Every player it creates is removed again at the end.
import { RATING_URL, RATING_KEY } from '../../js/net-config.js';
import { randomUUID, randomBytes } from 'node:crypto';

const rpc = async (name, body) => {
  const r = await fetch(`${RATING_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
};
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
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
const me = () => ({ p_id: randomUUID(), p_secret: randomBytes(16).toString('hex') });
const save = (p, extra = {}) => rpc('klyaksa_save', { ...p, p_name: 'Тест', p_avatar: '🦊', p_lang: 'ru', p_stars: 5, p_visible: true, ...extra });
const made = [];

try {
  const a = me(); made.push(a);
  let r = await save(a, { p_name: '  Тест   Тестовна  ', p_stars: 7 });
  check(r.status === 200 && r.body.ok && r.body.stars === 7, 'a new player is created');
  let board = (await rpc('klyaksa_board', { p_limit: 300 })).body;
  let row = board.find(x => x.id === a.p_id);
  check(row && row.name === 'Тест Тестовна' && row.stars === 7, 'the name is tidied and the player is on the board');
  check(row && row.week === 7, 'stars of a player who joined this week all count for the week');
  check(!('secret_hash' in (row || {})) && Object.keys(row || {}).sort().join() === 'avatar,id,name,stars,week', 'the board shows nothing secret');

  r = await save(a, { p_stars: 3 });
  check(r.status === 200 && r.body.stars === 7, 'stars never go down');
  r = await save(a, { p_stars: 12, p_name: 'Маша', p_avatar: '🐼', p_lang: 'he' });
  check(r.body.stars === 12, 'stars go up');
  row = (await rpc('klyaksa_board', { p_limit: 300 })).body.find(x => x.id === a.p_id);
  check(row.name === 'Маша' && row.avatar === '🐼', 'name and avatar can change');

  r = await save({ p_id: a.p_id, p_secret: randomBytes(16).toString('hex') }, { p_stars: 999 });
  check(r.status >= 400, 'someone without the secret cannot change her');
  row = (await rpc('klyaksa_board', { p_limit: 300 })).body.find(x => x.id === a.p_id);
  check(row.stars === 12, 'and her stars stay as they were');

  const b = me(); made.push(b);
  r = await save(b, { p_name: '   ' });
  check(r.status >= 400, 'an empty name is refused');
  r = await save({ ...b, p_secret: 'short' });
  check(r.status >= 400, 'a short secret is refused');
  r = await save(b, { p_name: 'Очень-очень-длинное-имя-которое-не-влезет', p_lang: 'xx', p_stars: 10 ** 9, p_avatar: '' });
  check(r.status === 200 && r.body.stars === 100000, 'silly values are cut to size');
  row = (await rpc('klyaksa_board', { p_limit: 300 })).body.find(x => x.id === b.p_id);
  check(row && row.name.length === 24 && row.avatar === '🐱', 'long names are cut and an empty avatar gets the default');

  r = await save(b, { p_visible: false });
  board = (await rpc('klyaksa_board', { p_limit: 300 })).body;
  check(!board.some(x => x.id === b.p_id), 'a hidden player is not on the board');

  board = (await rpc('klyaksa_board', { p_limit: 1 })).body;
  check(board.length === 1, 'the limit works');
  check((await rpc('klyaksa_board', {})).status === 200, 'the board works without arguments');

  const direct = await fetch(`${RATING_URL}/rest/v1/players?select=*`, { headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}` } });
  const rows = direct.ok ? await direct.json() : [];
  check(!direct.ok || rows.length === 0, 'the table itself cannot be read with the public key');
  const del = await fetch(`${RATING_URL}/rest/v1/players?id=eq.${a.p_id}`, { method: 'DELETE', headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}` } });
  row = (await rpc('klyaksa_board', { p_limit: 300 })).body.find(x => x.id === a.p_id);
  check(row, `the table cannot be changed with the public key (status ${del.status})`);

  // The week counts from the last total before Sunday. Needs the admin token of this machine.
  const sql = await admin(`insert into public.player_days (player_id, day, stars) values ('${a.p_id}', ((date_trunc('week', (now() at time zone 'Asia/Jerusalem')::date + 1) - interval '1 day')::date - 3), 4), ('${a.p_id}', ((date_trunc('week', (now() at time zone 'Asia/Jerusalem')::date + 1) - interval '1 day')::date - 9), 1) returning day`);
  if (sql) {
    row = (await rpc('klyaksa_board', { p_limit: 300 })).body.find(x => x.id === a.p_id);
    check(row.week === 12 - 4, `this week counts from the last total before Sunday (week ${row.week}, want 8)`);
  } else console.log('skip the week check: no admin token on this machine');

  r = await rpc('klyaksa_forget', { p_id: a.p_id, p_secret: 'wrong-secret-wrong' });
  check(r.body.ok === false, 'forgetting needs the secret');
} finally {
  for (const p of made) await rpc('klyaksa_forget', p);
  const left = (await rpc('klyaksa_board', { p_limit: 300 })).body.filter(x => made.some(m => m.p_id === x.id));
  check(left.length === 0, 'test players are removed again');
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
