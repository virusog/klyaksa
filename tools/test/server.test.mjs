// Tests the class functions (rating, drawings, chat) on the real server. Run: node tools/test/server.test.mjs
// Uses classes nobody else has (test-<tag>...), and removes every player, drawing,
// message and class move it creates.
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
  // A passing gateway error ("Internal server error.") is not JSON: it fails that check, not the cleanup.
  let answer = null;
  try { answer = text ? JSON.parse(text) : null; } catch { answer = { raw: text.slice(0, 200) }; }
  return { status: r.status, body: answer };
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
// A real 2x2 JPEG, small enough to send as thumb and image.
const JPEG = '/9j/4AAQSkZJRgABAQAASABIAAD/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwAPDw8PDw8aDw8aJBoaGiQxJCQkJDE+MTExMTE+Sz4+Pj4+PktLS0tLS0tLWlpaWlpaaWlpaWl2dnZ2dnZ2dnZ2/9sAQwESExMeHB40HBw0e1RFVHt7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7e3t7/90ABAAB/9oADAMBAAIRAxEAPwC5RRRXzJ9Cf//Z';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const code = r => r.body && r.body.code;
const errors = {};   // the HTTP status and JSON body PostgREST gives for each error code
const seen = (r, want) => { if (code(r) === want && !errors[want]) errors[want] = `${r.status} ${JSON.stringify(r.body)}`; return code(r) === want; };

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

  // A block by hand (see the header of schema.sql) stays, whatever her app sends.
  r = await save(b, { p_visible: false });
  check((await board(b)).some(x => x.me), 'the app cannot hide a player that already exists');
  const blocked = await admin(`update public.players set visible = false where id = '${b.p_id}' returning id`);
  if (blocked) {
    check(!(await board(b)).some(x => x.me), 'a blocked player is not on the board');
    r = await save(b, { p_visible: true, p_stars: 3001 });
    const v = await admin(`select visible from public.players where id = '${b.p_id}'`);
    check(r.status === 200 && v?.[0]?.visible === false, `her next save does not unblock her (${JSON.stringify(v)})`);
  } else console.log('skip the block checks: no admin token on this machine');

  // Her name is masked like the chat: everyone in the class sees it.
  const n1 = me(); made.push(n1);
  r = await save(n1, { p_name: 'Маша 054-123-4567' });
  check(r.status === 200 && (await board(n1)).find(x => x.me)?.name === 'Маша ***', 'a phone number in a name is masked');
  r = await save(n1, { p_name: 'wa.me/972541234567' });
  check(code(r) === '22023' && (await board(n1)).find(x => x.me)?.name === 'Маша ***', 'a name that is only a link is refused and the old one stays');

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

  // ---------- The class: drawings, hearts, chat, reports ----------
  const CLASS2 = `test-${tag}-c`;
  const join = async (klass, name) => {
    const p = me(); made.push(p);
    const r = await save(p, { p_class: klass, p_name: name });
    check(r.status === 200 && r.body.class === klass, `${name} joins ${klass} and the server says which class she is in`);
    return p;
  };
  const m1 = await join(CLASS2, 'Маша');
  const m2 = await join(CLASS2, 'Noa');
  const m3 = await join(CLASS2, 'Ира');
  const x = await join(OTHER, 'Чужая');
  const call = (name, p, body = {}) => rpc(name, { p_id: p.p_id, p_secret: p.p_secret, ...body });
  const wrong = { p_id: m1.p_id, p_secret: randomBytes(16).toString('hex') };

  // Typed class codes.
  r = await rpc('klyaksa_class_check', { p_class: ` ${CLASS2.toUpperCase()} ` });
  check(r.status === 200 && r.body.class === CLASS2 && r.body.players === 3, `class_check finds the class and counts its players (${JSON.stringify(r.body)})`);
  r = await rpc('klyaksa_class_check', { p_class: 'x!' });
  check(r.status === 200 && r.body.class === '' && r.body.players === 0, 'class_check: a code that is no class code gives ""');
  r = await rpc('klyaksa_class_check', { p_class: `test-${tag}-nobody` });
  check(r.body.class === `test-${tag}-nobody` && r.body.players === 0, 'class_check: a class with nobody says 0');
  const pre = await join(`class-test-${tag}-p`, 'Префикс');
  r = await rpc('klyaksa_class_check', { p_class: `test-${tag}-p` });
  check(r.body.class === `class-test-${tag}-p` && r.body.players === 1, `class_check adds the missing "class-" prefix when only that class has players (${JSON.stringify(r.body)})`);
  r = await rpc('klyaksa_class_check', { p_class: `class-test-${tag}-p` });
  check(r.body.class === `class-test-${tag}-p` && r.body.players === 1, 'class_check keeps a code that already has the prefix');
  const moved = await admin(`insert into public.class_moves values ('test-${tag}-typo', '${CLASS2}') on conflict do nothing returning from_code`);
  if (moved) {
    r = await rpc('klyaksa_class_check', { p_class: `test-${tag}-typo` });
    check(r.body.class === CLASS2 && r.body.players === 3, `class_check follows a class move (${JSON.stringify(r.body)})`);
    const y = me(); made.push(y);
    r = await save(y, { p_class: `test-${tag}-typo`, p_name: 'Опечатка' });
    check(r.status === 200 && r.body.class === CLASS2, `klyaksa_save stores the moved class and says so (${JSON.stringify(r.body)})`);
    check((await board({}, CLASS2)).some(p => p.name === 'Опечатка'), 'the moved player is on the real class board');
    check((await board({}, `test-${tag}-typo`)).some(p => p.name === 'Опечатка'), 'an older app asking for the typo board sees the real class');
    await rpc('klyaksa_forget', y);
    await admin(`delete from public.class_moves where from_code = 'test-${tag}-typo'`);
    r = await rpc('klyaksa_class_check', { p_class: `test-${tag}-typo` });
    check(r.body.class === `test-${tag}-typo` && r.body.players === 0, 'with the move removed the typo is its own empty class again');
  } else console.log('skip the class move checks: no admin token on this machine');
  await rpc('klyaksa_forget', pre);

  // Secrets: a wrong secret, a stranger and a hidden player get 42501.
  r = await call('klyaksa_chat_send', wrong, { p_kind: 'text', p_body: 'Привет' });
  check(r.status >= 400 && seen(r, '42501'), `a wrong secret cannot write to the chat (${r.status} ${code(r)})`);
  for (const [fn, body] of [['klyaksa_posts', {}], ['klyaksa_chat', {}], ['klyaksa_news', {}], ['klyaksa_post_image', { p_post: 1 }],
    ['klyaksa_like', { p_post: 1, p_on: true }], ['klyaksa_post_delete', { p_post: 1 }], ['klyaksa_chat_delete', { p_msg: 1 }],
    ['klyaksa_report', { p_kind: 'msg', p_target: 1 }],
    ['klyaksa_post_add', { p_title: '', p_thumb: JPEG, p_image: JPEG, p_w: 2, p_h: 2 }]]) {
    r = await call(fn, wrong, body);
    check(code(r) === '42501', `${fn} needs her secret (${r.status} ${code(r)})`);
  }
  r = await call('klyaksa_chat', { p_id: randomUUID(), p_secret: randomBytes(16).toString('hex') });
  check(code(r) === '42501', 'an unknown player sees no chat');
  if (blocked) {
    r = await call('klyaksa_chat', b);
    check(code(r) === '42501', 'a blocked player sees no chat');
  }

  // Drawings. A new drawing first throws away what nobody is shown any more.
  const old = await admin(`insert into public.messages (player_id, class_code, kind, body, created_at)
      values ('${x.p_id}', '${OTHER}', 'text', 'old', now() - interval '31 days') returning id;
    insert into public.posts (player_id, class_code, title, thumb, image, created_at)
      values ('${x.p_id}', '${OTHER}', 'old', '\\xffd8ff', '\\xffd8ff', now() - interval '91 days');`);
  r = await call('klyaksa_post_add', m1, { p_title: '  Мой   ​рисунок  ', p_thumb: JPEG, p_image: JPEG, p_w: 2, p_h: 2 });
  check(r.status === 200 && r.body.ok && r.body.id > 0, `she shows a drawing to her class (${JSON.stringify(r.body)})`);
  const P1 = r.body.id;
  if (old) {
    const o = await admin(`select (select count(*) from public.messages where player_id = '${x.p_id}')::int as msgs,
      (select count(*) from public.posts where player_id = '${x.p_id}')::int as posts`);
    check(o?.[0]?.msgs === 0 && o?.[0]?.posts === 0, `messages older than 30 days and drawings older than 90 are deleted (${JSON.stringify(o)})`);
  }
  r = await call('klyaksa_post_add', m1, { p_title: 'Кот сука на site.com', p_thumb: JPEG, p_image: JPEG, p_w: 2, p_h: 2 });
  const P2 = r.body.id;
  r = await call('klyaksa_post_add', m1, { p_title: 'png', p_thumb: 'iVBORw0KGgoAAAANSUhEUg==', p_image: JPEG, p_w: 2, p_h: 2 });
  check(seen(r, '22023'), `a picture that is not a JPEG is refused (${r.status} ${code(r)})`);
  r = await call('klyaksa_post_add', m1, { p_title: 'data', p_thumb: 'data:image/jpeg;base64,' + JPEG, p_image: JPEG, p_w: 2, p_h: 2 });
  check(code(r) === '22023', 'a data: URL instead of base64 is refused');
  r = await call('klyaksa_post_add', m1, { p_title: 'x', p_thumb: '!!!!', p_image: JPEG, p_w: 2, p_h: 2 });
  check(code(r) === '22023', 'broken base64 is refused');
  const big = n => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(n)]).toString('base64');
  r = await call('klyaksa_post_add', m1, { p_title: 'x', p_thumb: big(45100), p_image: JPEG, p_w: 2, p_h: 2 });
  check(seen(r, '54000'), `a thumb over 45 KB is refused (${r.status} ${code(r)})`);
  r = await call('klyaksa_post_add', m1, { p_title: 'x', p_thumb: JPEG, p_image: '#'.repeat(700000), p_w: 2, p_h: 2 });
  check(code(r) === '54000', 'a huge image is refused by its size before it is decoded');

  const keysP = 'at,avatar,h,hearts,id,liked,mine,name,thumb,title,w';
  let posts = (await call('klyaksa_posts', m2)).body;
  let p1 = posts.find(p => p.id === P1), p2 = posts.find(p => p.id === P2);
  check(posts.length === 2 && p1 && p2, `a classmate sees both drawings (${posts.length})`);
  check(Object.keys(p1).sort().join() === keysP, `drawings carry no player ids (${Object.keys(p1).sort().join()})`);
  check(p1.title === 'Мой рисунок' && p1.name === 'Маша' && p1.avatar === '🦊' && p1.w === 2 && !p1.mine && !p1.liked && p1.hearts === 0,
    `the drawing has a tidy title, her name and no hearts yet (${p1.title})`);
  check(p1.thumb === JPEG, 'the thumb comes back as the same base64, without line breaks');
  check(p2.title === 'Кот *** на ***', `bad words and links in a title are masked (${p2.title})`);
  check((await call('klyaksa_posts', m1)).body.every(p => p.mine), 'she sees her drawings as hers');
  r = await call('klyaksa_post_image', m2, { p_post: P1 });
  check(r.status === 200 && r.body.image === JPEG, 'a classmate gets the full picture');

  check((await call('klyaksa_posts', x)).body.length === 0, 'another class sees none of the drawings');
  r = await call('klyaksa_post_image', x, { p_post: P1 });
  check(code(r) === '22023', 'another class cannot fetch the picture');
  r = await call('klyaksa_like', x, { p_post: P1, p_on: true });
  check(code(r) === '22023', 'another class cannot give a heart');
  r = await call('klyaksa_report', x, { p_kind: 'post', p_target: P1 });
  check(code(r) === '22023', 'another class cannot report the drawing');

  r = await call('klyaksa_like', m1, { p_post: P1, p_on: true });
  check(code(r) === '22023', 'she cannot give a heart to her own drawing');
  r = await call('klyaksa_like', m2, { p_post: P1, p_on: true });
  check(r.status === 200 && r.body.hearts === 1 && r.body.liked === true, `a classmate gives a heart (${JSON.stringify(r.body)})`);
  r = await call('klyaksa_like', m2, { p_post: P1, p_on: true });
  check(r.body.hearts === 1 && r.body.liked === true, 'a second heart from her changes nothing');
  r = await call('klyaksa_like', m3, { p_post: P1, p_on: true });
  check(r.body.hearts === 2, 'two classmates, two hearts');
  r = await call('klyaksa_like', m3, { p_post: P1, p_on: false });
  check(r.body.hearts === 1 && r.body.liked === false, 'a heart can be taken back');
  await call('klyaksa_like', m3, { p_post: P1, p_on: true });
  posts = (await call('klyaksa_posts', m2)).body;
  check(posts[0].id === P2 && posts.find(p => p.id === P1).liked && posts.find(p => p.id === P1).hearts === 2, 'newest first, and her heart shows as hers');
  posts = (await call('klyaksa_posts', m2, { p_sort: 'week' })).body;
  check(posts[0].id === P1 && posts[1].id === P2, 'the week sort puts the most hearts first');
  check((await call('klyaksa_posts', m2, { p_limit: 1 })).body.length === 1, 'the drawings limit works');

  // Blocking a player hides her hearts, her drawings and their notices at once, and stays.
  if (await admin(`update public.players set visible = false where id = '${m3.p_id}' returning id`)) {
    check((await call('klyaksa_posts', m2)).body.find(p => p.id === P1)?.hearts === 1, 'a blocked player\'s heart does not count');
    r = await save(m3, { p_class: CLASS2, p_name: 'Ира' });
    check(code(await call('klyaksa_chat', m3)) === '42501', 'after her own save a blocked player still sees no chat');
    await admin(`update public.players set visible = true where id = '${m3.p_id}'`);
    await admin(`update public.players set visible = false where id = '${m1.p_id}'`);
    check(!(await call('klyaksa_posts', m2)).body.length, 'a blocked player\'s drawings are hidden');
    check(!(await call('klyaksa_chat', m2)).body.some(m => m.kind === 'post'), 'and their notices in the chat');
    await admin(`update public.players set visible = true where id = '${m1.p_id}'`);
    check((await call('klyaksa_posts', m2)).body.length === 2, 'unblocked, her drawings are back');
  }

  let chat = (await call('klyaksa_chat', m2)).body;
  let note = chat.find(m => m.kind === 'post' && JSON.parse(m.body).post === P1);
  check(note && JSON.parse(note.body).what === 'Мой рисунок' && note.name === 'Маша', 'a shared drawing leaves a notice in the chat');

  r = await call('klyaksa_post_delete', m2, { p_post: P2 });
  check(r.status === 200 && r.body.ok === false, 'a classmate cannot take her drawing away');
  r = await call('klyaksa_post_delete', m1, { p_post: P2 });
  check(r.body.ok === true, 'she takes her own drawing back');
  check(!(await call('klyaksa_posts', m2)).body.some(p => p.id === P2), 'and it is gone for the class');
  check(!(await call('klyaksa_chat', m2)).body.some(m => m.kind === 'post' && JSON.parse(m.body).post === P2), 'with its notice in the chat');
  const gone = await admin(`select hidden, octet_length(image) as size, bytes from public.posts where id = ${P2}`);
  if (gone) check(gone[0]?.hidden && gone[0].size === 3 && gone[0].bytes > 3, `a deleted drawing is emptied but still counted (${JSON.stringify(gone)})`);

  // At most 10 drawings a day (P1, the deleted P2 and 8 more: deleting does not give a drawing back).
  if (await admin(`insert into public.posts (player_id, class_code, title, thumb, image, hidden)
      select '${m1.p_id}', '${CLASS2}', 'x', '\\xffd8ff', '\\xffd8ff', true from generate_series(1, 8)`)) {
    r = await call('klyaksa_post_add', m1, { p_title: '', p_thumb: JPEG, p_image: JPEG, p_w: 2, p_h: 2 });
    check(code(r) === '54000', `at most 10 drawings a day, deleted ones too (${r.status} ${code(r)})`);
    // At most 60 in a class: 10 of hers and 50 of Noa's.
    await admin(`insert into public.posts (player_id, class_code, title, thumb, image, hidden)
      select '${m2.p_id}', '${CLASS2}', 'x', '\\xffd8ff', '\\xffd8ff', true from generate_series(1, 50)`);
    r = await call('klyaksa_post_add', m3, { p_title: '', p_thumb: JPEG, p_image: JPEG, p_w: 2, p_h: 2 });
    check(code(r) === '54000' && /class/.test(r.body?.message), `at most 60 drawings a day in a class (${r.status} ${JSON.stringify(r.body)})`);
    await admin(`delete from public.posts where player_id = '${m2.p_id}'`);
    // At most 30 MB of drawings a day on the whole server.
    await admin(`insert into public.posts (player_id, class_code, title, thumb, image, hidden, bytes)
      values ('${x.p_id}', '${OTHER}', 'x', '\\xffd8ff', '\\xffd8ff', true, 30000001)`);
    r = await call('klyaksa_post_add', m3, { p_title: '', p_thumb: JPEG, p_image: JPEG, p_w: 2, p_h: 2 });
    await admin(`delete from public.posts where player_id = '${x.p_id}'`);
    check(code(r) === '54000' && /room/.test(r.body?.message), `the server takes at most 30 MB of drawings a day (${r.status} ${JSON.stringify(r.body)})`);
  }

  // Reports on a drawing: gone for the reporter at once, for everyone after two.
  r = await call('klyaksa_report', m1, { p_kind: 'post', p_target: P1 });
  check(code(r) === '22023', 'she cannot report her own drawing');
  r = await call('klyaksa_report', m2, { p_kind: 'post', p_target: P1 });
  check(r.status === 200 && r.body.ok, 'a classmate reports a drawing');
  check(!(await call('klyaksa_posts', m2)).body.some(p => p.id === P1), 'it is gone for her at once');
  check(!(await call('klyaksa_chat', m2)).body.some(m => m.kind === 'post' && JSON.parse(m.body).post === P1), 'its notice too');
  check((await call('klyaksa_posts', m3)).body.some(p => p.id === P1), 'the others still see it');
  r = await call('klyaksa_report', m2, { p_kind: 'post', p_target: P1 });
  check(r.status === 200, 'reporting again is harmless');
  check((await call('klyaksa_posts', m3)).body.some(p => p.id === P1), 'one reporter twice does not hide it');
  await call('klyaksa_report', m3, { p_kind: 'post', p_target: P1 });
  check(!(await call('klyaksa_posts', m1)).body.some(p => p.id === P1), 'after a second reporter it is hidden for everyone');
  check(!(await call('klyaksa_chat', m1)).body.some(m => m.kind === 'post' && JSON.parse(m.body).post === P1), 'its notice is hidden too');
  r = await call('klyaksa_post_image', m1, { p_post: P1 });
  check(code(r) === '22023', 'a hidden drawing cannot be fetched');

  // Chat.
  r = await call('klyaksa_chat_send', m1, { p_kind: 'text', p_body: '  Привет,   класс! ‮ ' });
  check(r.status === 200 && r.body.id > 0 && r.body.body === 'Привет, класс!', `she writes to the class (${JSON.stringify(r.body)})`);
  const M1 = r.body.id;
  r = await call('klyaksa_chat_send', m1, { p_kind: 'text', p_body: 'и ещё' });
  check(seen(r, '54000'), `not two messages within 2 seconds (${r.status} ${code(r)})`);
  r = await call('klyaksa_chat_send', m2, { p_kind: 'text', p_body: 'Пиши 054-123-45-67, mama@mail.ru, https://evil.com/x и www.a.b и roblox.com, ты СУКА, fuck, זונה' });
  check(r.status === 200 && r.body.body === 'Пиши ***, ***, *** и *** и ***, ты ***, ***, ***', `links, phones, e-mails and bad words are masked (${r.body.body})`);
  const M2 = r.body.id;
  r = await call('klyaksa_chat_send', m3, { p_kind: 'text', p_body: ' !!! ... ' });
  check(code(r) === '22023', 'a message of punctuation only is refused');
  r = await call('klyaksa_chat_send', m3, { p_kind: 'text', p_body: '​‮ ' });
  check(code(r) === '22023', 'a message of invisible characters is refused');
  r = await call('klyaksa_chat_send', m3, { p_kind: 'text', p_body: 'а'.repeat(300) });
  check(r.status === 200 && r.body.body.length === 200, 'a long message is cut to 200');
  const M3 = r.body.id;
  r = await call('klyaksa_chat_send', x, { p_kind: 'text', p_body: '😀' });
  check(r.status === 200 && r.body.body === '😀', `an emoji alone is a message (${JSON.stringify(r.body)})`);
  r = await call('klyaksa_chat_delete', x, { p_msg: r.body.id });
  r = await call('klyaksa_chat_send', x, { p_kind: 'text', p_body: 'и снова' });
  check(code(r) === '54000', `a deleted message still counts toward the pace (${r.status} ${code(r)})`);
  r = await call('klyaksa_chat_send', m3, { p_kind: 'post', p_body: JSON.stringify({ post: P1, what: 'x' }) });
  check(code(r) === '22023', 'the app cannot write a drawing notice itself');
  r = await call('klyaksa_chat_send', m3, { p_kind: 'shout', p_body: 'x' });
  check(code(r) === '22023', 'an unknown kind is refused');
  for (const [bad, why] of [['not json', 'not JSON'], ['[1]', 'not an object'], ['{"t":"hack","what":"Круг"}', 'an unknown result type'],
    ['{"t":"lesson","what":5}', 'a "what" that is not text'], ['{"t":"lesson","what":"Круг","stars":5}', 'too many stars'],
    ['{"t":"lesson","what":"Круг","stars":"3"}', 'stars as text'], ['{"t":"lesson","what":"  "}', 'an empty "what"']]) {
    r = await call('klyaksa_chat_send', m3, { p_kind: 'result', p_body: bad });
    check(code(r) === '22023', `a result with ${why} is refused`);
  }
  await sleep(2100);
  r = await call('klyaksa_chat_send', m1, { p_kind: 'result', p_body: JSON.stringify({ t: 'lesson', what: ' Круг  и  квадрат ', stars: 3, extra: 'x' }) });
  check(r.status === 200 && JSON.stringify(JSON.parse(r.body.body)) === JSON.stringify({ t: 'lesson', what: 'Круг и квадрат', stars: 3 }),
    `a result is stored the way the server re-writes it (${r.body.body})`);
  const M4 = r.body.id;
  r = await call('klyaksa_chat_send', m2, { p_kind: 'result', p_body: JSON.stringify({ t: 'coloring', what: 'Кот на cat.com' }) });
  check(r.status === 200 && JSON.parse(r.body.body).what === 'Кот на ***' && !('stars' in JSON.parse(r.body.body)), 'stars are optional and "what" is masked');
  const M5 = r.body.id;

  // What the mask hides, and what it leaves alone.
  const cases = [
    ['054 - 123 - 4567', '***'], ['054_123_4567', '***'], ['054/123/4567', '***'], ['054–123–4567', '***'], ['054 . 123 . 4567', '***'],
    ['0️⃣5️⃣4️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣', '***'], ['my insta @nastya_2015', 'my *** ***'], ['telegram: masha2017', '***: masha2017'],
    ['youtu.be/abc и linktr.ee/x', '*** и ***'], ['ты дура', 'ты ***'], ['ты stupid', 'ты ***'], ['אתה טיפש', 'אתה ***'], ['kill yourself', '***'],
    ['3 + 4 = 7, 12 - 5 = 7', '3 + 4 = 7, 12 - 5 = 7'], ['счёт 10 : 12 : 15', 'счёт 10 : 12 : 15'],
    ['процедура, ослаблять, влюблять, утварь, наступая', 'процедура, ослаблять, влюблять, утварь, наступая'], ['install instant', 'install instant'],
  ];
  const masked = await admin(`select klyaksa_mask(klyaksa_clean(t, 200)) as m from unnest(array[${cases.map(([t]) => `'${t}'`).join(',')}]) with ordinality as u(t, i) order by i`);
  if (masked) cases.forEach(([t, want], i) => check(masked[i]?.m === want, `mask: "${t}" -> "${masked[i]?.m}" (want "${want}")`));

  chat = (await call('klyaksa_chat', m2)).body;
  check(Object.keys(chat[0]).sort().join() === 'at,avatar,body,id,kind,mine,name', `messages carry no player ids (${Object.keys(chat[0]).sort().join()})`);
  check(chat.every((m, i) => i === 0 || m.id > chat[i - 1].id), 'the chat comes oldest first');
  check([M1, M2, M3, M4].every(id => chat.some(m => m.id === id)), 'she sees every message of the class');
  check(chat.find(m => m.id === M2).mine && !chat.find(m => m.id === M1).mine, 'her own messages are marked as hers');
  let after = (await call('klyaksa_chat', m2, { p_after: M3 })).body;
  check(after.length && after.every(m => m.id > M3) && after[0].id === M4, 'p_after gives only newer messages, oldest first');
  after = (await call('klyaksa_chat', m2, { p_limit: 2 })).body;
  check(after.length === 2 && after[1].id === chat[chat.length - 1].id, 'without p_after the limit keeps the newest, still oldest first');
  check((await call('klyaksa_chat', x)).body.every(m => m.mine), 'another class sees none of the messages');
  check((await call('klyaksa_chat', m2, { p_limit: 500 })).body.length <= 120, 'the chat gives at most 120 messages');
  r = await call('klyaksa_news', x);
  check(r.status === 200 && r.body.msg === 0 && r.body.post === 0, `another class has no news (${JSON.stringify(r.body)})`);
  r = await call('klyaksa_news', m1);
  check(r.body.msg === Math.max(...chat.filter(m => m.name !== 'Маша').map(m => m.id)) && r.body.post === 0,
    `news counts only what the others wrote (${JSON.stringify(r.body)})`);
  // A message she reported is not news for her, or the badge would never go away.
  await call('klyaksa_report', m1, { p_kind: 'msg', p_target: M5 });
  r = await call('klyaksa_news', m1);
  const left1 = (await call('klyaksa_chat', m1)).body.filter(m => !m.mine);
  check(r.body.msg !== M5 && r.body.msg === Math.max(0, ...left1.map(m => m.id)), `news leaves out what she reported (${JSON.stringify(r.body)})`);

  // A new name does not change who wrote or drew the old things.
  r = await save(m1, { p_class: CLASS2, p_name: 'Даша', p_avatar: '🐼' });
  chat = (await call('klyaksa_chat', m2)).body;
  check(chat.find(m => m.id === M4)?.name === 'Маша' && chat.find(m => m.id === M4)?.avatar === '🦊', 'a message keeps the name and avatar she had when she wrote it');
  const snap = await admin(`select name from public.posts where id = ${P1}`);
  if (snap) check(snap[0]?.name === 'Маша', 'a drawing keeps the name she had when she showed it');

  r = await call('klyaksa_chat_delete', m2, { p_msg: M1 });
  check(r.status === 200 && r.body.ok === false, 'she cannot delete a classmate\'s message');
  await call('klyaksa_report', m2, { p_kind: 'msg', p_target: M1 });
  r = await call('klyaksa_chat_delete', m1, { p_msg: M1 });
  check(r.body.ok === true && !(await call('klyaksa_chat', m2)).body.some(m => m.id === M1), 'she deletes her own message');
  const del1 = await admin(`select m.hidden, m.body, (select count(*) from public.reports r where r.kind = 'msg' and r.target = m.id)::int as reports
    from public.messages m where m.id = ${M1}`);
  if (del1) check(del1[0]?.hidden && del1[0].body === '' && del1[0].reports === 1, `a deleted message is emptied, and the report on it stays (${JSON.stringify(del1)})`);

  r = await call('klyaksa_report', m3, { p_kind: 'msg', p_target: M3 });
  check(code(r) === '22023', 'she cannot report her own message');
  r = await call('klyaksa_report', x, { p_kind: 'msg', p_target: M3 });
  check(code(r) === '22023', 'another class cannot report a message');
  r = await call('klyaksa_report', m1, { p_kind: 'nope', p_target: M3 });
  check(code(r) === '22023', 'an unknown report kind is refused');
  r = await call('klyaksa_report', m1, { p_kind: 'msg', p_target: M3 });
  check(r.status === 200 && !(await call('klyaksa_chat', m1)).body.some(m => m.id === M3), 'a reported message is gone for the reporter');
  check((await call('klyaksa_chat', m2)).body.some(m => m.id === M3), 'but not yet for the others');
  await call('klyaksa_report', m2, { p_kind: 'msg', p_target: M3 });
  check(!(await call('klyaksa_chat', m3)).body.some(m => m.id === M3), 'after two reporters it is hidden for everyone, even its author');

  // At most 30 messages in 10 minutes and 300 a day.
  if (await admin(`insert into public.messages (player_id, class_code, kind, body, created_at)
      select '${x.p_id}', '${OTHER}', 'text', 'x', now() - interval '1 minute' from generate_series(1, 30)`)) {
    r = await call('klyaksa_chat_send', x, { p_kind: 'text', p_body: 'ещё' });
    check(code(r) === '54000', 'at most 30 messages in 10 minutes');
    await admin(`update public.messages set created_at = now() - interval '1 hour' where player_id = '${x.p_id}';
      insert into public.messages (player_id, class_code, kind, body, created_at)
      select '${x.p_id}', '${OTHER}', 'text', 'x', now() - interval '2 hours' from generate_series(1, 270)`);
    r = await call('klyaksa_chat_send', x, { p_kind: 'text', p_body: 'ещё' });
    check(code(r) === '54000', 'at most 300 messages a day');
    await admin(`update public.messages set created_at = now() - interval '25 hours' where player_id = '${x.p_id}'`);
    r = await call('klyaksa_chat_send', x, { p_kind: 'text', p_body: 'ещё' });
    check(r.status === 200, "yesterday's messages do not count");
  }

  // Moving to another class takes her drawings and messages out of the old one.
  const w = await join(OTHER, 'Соседка');
  r = await call('klyaksa_post_add', x, { p_title: 'Уеду', p_thumb: JPEG, p_image: JPEG, p_w: 2, p_h: 2 });
  check(r.status === 200 && (await call('klyaksa_posts', w)).body.length === 1 && (await call('klyaksa_chat', w)).body.some(m => !m.mine),
    `her old class sees her drawing and messages (${JSON.stringify(r.body)})`);
  const CLASS3 = `test-${tag}-d`;
  r = await save(x, { p_class: CLASS3, p_name: 'Чужая' });
  check(r.status === 200 && r.body.class === CLASS3, 'she moves to another class');
  check((await call('klyaksa_posts', w)).body.length === 0 && !(await call('klyaksa_chat', w)).body.some(m => !m.mine),
    'the old class no longer sees anything of hers');
  // A class takes at most 60 newcomers a day, moving in included.
  const CLASS4 = `test-${tag}-e`;
  if (await admin(`insert into public.players (id, secret_hash, name, class_code, joined_at)
      select gen_random_uuid(), 'x', 'n', '${CLASS4}', now() from generate_series(1, 60)`)) {
    r = await save(x, { p_class: CLASS4, p_name: 'Чужая' });
    check(code(r) === '54000', `moving into a class that took 60 today is refused (${r.status} ${code(r)})`);
    await admin(`delete from public.players where class_code = '${CLASS4}'`);
  }

  // The tables and helpers stay closed to the public key.
  for (const t of ['posts', 'post_likes', 'messages', 'reports', 'class_moves', 'bad_words']) {
    const d = await fetch(`${RATING_URL}/rest/v1/${t}?select=*`, { headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}` } });
    const rows = d.ok ? await d.json() : [];
    check(!d.ok || rows.length === 0, `the table ${t} cannot be read with the public key (${d.status})`);
  }
  const ins = await fetch(`${RATING_URL}/rest/v1/messages`, { method: 'POST', headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: m1.p_id, class_code: CLASS2, kind: 'text', body: 'hack' }) });
  check(!ins.ok, `the chat cannot be written past the functions (${ins.status})`);
  for (const [fn, body] of [['klyaksa_me', { p_id: m1.p_id, p_secret: m1.p_secret }], ['klyaksa_mask', { p: 'x' }], ['klyaksa_mask_words', { p: 'x' }],
    ['klyaksa_clean', { p: 'x', n: 5 }], ['klyaksa_moved', { p: 'x' }]]) {
    check((await rpc(fn, body)).status >= 400, `the helper ${fn} cannot be called from outside`);
  }

  // Leaving takes everything of hers away.
  r = await rpc('klyaksa_forget', m1);
  check(r.body.ok === true, 'Маша leaves the class');
  check(!(await call('klyaksa_chat', m2)).body.some(m => m.name === 'Маша'), 'her messages are gone');
  const rest = await admin(`select (select count(*) from public.posts where player_id = '${m1.p_id}')::int as posts,
    (select count(*) from public.messages where player_id = '${m1.p_id}')::int as msgs,
    (select count(*) from public.post_likes where player_id = '${m1.p_id}')::int as likes,
    (select count(*) from public.reports where reporter = '${m1.p_id}')::int as reports`);
  if (rest) check(rest[0].posts + rest[0].msgs + rest[0].likes + rest[0].reports === 0, `nothing of hers is left (${JSON.stringify(rest[0])})`);
  console.log('\nerror answers of PostgREST:');
  for (const [k, v] of Object.entries(errors)) console.log(`  ${k}: ${v}`);
} finally {
  for (const p of made) {
    const r = await rpc('klyaksa_forget', p);
    check(r.status === 200, `test player removed (${JSON.stringify(r.body)})`);
  }
  await admin(`delete from public.class_moves where from_code like 'test-${tag}%' or to_code like '%test-${tag}%';
    delete from public.players where class_code = 'test-${tag}-e' and secret_hash = 'x'`);
  const left = await admin(`select
    (select count(*) from public.players where class_code like '%test-${tag}%')::int as players,
    (select count(*) from public.posts where class_code like '%test-${tag}%')::int as posts,
    (select count(*) from public.messages where class_code like '%test-${tag}%')::int as messages,
    (select count(*) from public.class_moves where from_code like '%test-${tag}%' or to_code like '%test-${tag}%')::int as moves`);
  if (left) check(Object.values(left[0]).every(n => n === 0), `nothing of the test is left on the server (${JSON.stringify(left[0])})`);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
