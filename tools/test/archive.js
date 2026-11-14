// Moving to a new address: a parent saves the archive on the old one and
// restores it on the new one. Draws a picture, saves the archive through the
// real buttons, wipes everything, restores it, and checks the gallery.
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const { db, state, save, mergeState } = await import(location.origin + '/js/store.js');

// A drawing in the studio, saved when she leaves it.
await T.go('#/studio/new', 900);
const cv = T.qq('.screen canvas').sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
const r = cv.getBoundingClientRect();
const pts = [];
for (let i = 0; i <= 30; i++) pts.push([r.left + r.width * (0.2 + i / 50), r.top + r.height * (0.3 + Math.sin(i / 4) / 5)]);
await T.stroke(pts, { el: cv, pause: 8 });
await T.go('#/', 1500);
const before = (await db.all('art')).filter(a => a.thumb);
check(before.length === 1, `the drawing is saved before the archive (${before.length})`);

const openParents = async () => {
  await T.go('#/', 200);
  await T.go('#/parents', 500);
  const g = T.q('.gate h2').textContent.match(/(\d+)\D+(\d+)/);
  T.q('.gate-input').value = String(g[1] * g[2]);
  T.q('.gate .btn').click();
  await T.wait(300);
};

// Saves the archive. Sharing is off, so it goes through a download link.
await openParents();
let archive = null;
Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
const make = URL.createObjectURL;
URL.createObjectURL = b => { if (b.type === 'application/json') archive = b; return make(b); };
T.byText('Скачать архив').click();
for (let i = 0; i < 50 && !T.byText('Сохранить архив'); i++) await T.wait(100);
check(/1 рисунок/.test(T.q('.modal')?.textContent || ''), `the archive window says how many drawings it holds: ${T.q('.modal p')?.textContent}`);
T.byText('Сохранить архив').click();
await T.wait(300);
URL.createObjectURL = make;
check(!!archive, 'the archive is saved');
if (!archive) return { problems };
const dump = JSON.parse(await archive.text());
check(dump.art?.length === 1 && dump.art[0].thumb?.__b?.startsWith('data:image/png'), 'the archive holds the drawing as a picture');

// A new address: nothing stored yet.
for (const s of ['art', 'world', 'kv']) for (const it of await db.all(s)) await db.del(s, it.id);
check((await db.all('art')).length === 0, 'storage is empty before restoring');
// She already made a new profile here, joined another class, switched the rating off,
// and earned stars for a task the archive does not have.
const archived = { ...state.player };
const here = { id: '00000000-0000-4000-8000-000000000001', secret: 'a'.repeat(32) };
Object.assign(state, { name: 'Анастасия', avatar: '🦊', classCode: 'keep-class', rated: false, stars: 7, best: { 'only-here': 7 }, player: here });
save();
const forgotten = [];
const realFetch = window.fetch;
window.fetch = (url, o) => { if (/klyaksa_forget/.test(url)) forgotten.push(JSON.parse(o.body).p_id); return realFetch(url, o); };

// Restores it. The page reload at the end is held back, so the check can go on.
await openParents();
const input = T.q('input[type=file]');
const dt = new DataTransfer();
dt.items.add(new File([await archive.text()], 'blobika-test.json', { type: 'application/json' }));
input.files = dt.files;
const realTimeout = window.setTimeout;
let reloadAsked = false;
window.setTimeout = (fn, ms, ...rest) => ms === 1200 ? (reloadAsked = true, 0) : realTimeout(fn, ms, ...rest);
input.dispatchEvent(new Event('change'));
await T.wait(300);
const asked = T.q('.modal p')?.textContent || '';
check(/1 рисунок/.test(asked) && /добавятся/.test(asked), `before restoring it says what is in the archive and that it is added: ${asked}`);
T.byText('Добавить').click();
for (let i = 0; i < 50 && !reloadAsked; i++) await T.wait(100);
window.setTimeout = realTimeout;
check(reloadAsked, 'the restore finished');
const toastText = T.q('.toast')?.textContent || '';
check(/1 рисунок/.test(toastText), `the restore says how many drawings came back: ${toastText}`);
window.fetch = realFetch;
const archiveStars = dump.state.stars || 0;
check(state.best['only-here'] === 7 && Object.keys(dump.state.best || {}).every(k => k in state.best), 'results from both sides are kept');
check(state.stars >= 7 + archiveStars, `stars from both sides count (${state.stars}, archive ${archiveStars}, here 7)`);
check(state.classCode === 'keep-class' && state.rated === false, `the class and rating choice made here stay (${state.classCode}, ${state.rated})`);
check(state.name === 'Анастасия' && state.avatar === '🦊', `the profile she made here stays (${state.name} ${state.avatar})`);
check(state.player?.id === archived.id, 'the archive\'s player, which the server rates higher, stays');
check(forgotten.includes(here.id) && !state.forget.length, 'the player this device made is taken off the server');
check(document.cookie.includes(state.player.id), 'the cookie holds the kept player');

// The joining rules on their own.
const m1 = mergeState({ ...state, best: { a: 2, b: 5 }, stars: 7 }, { best: { a: 3, c: 1 }, stars: 4 });
check(m1.best.a === 3 && m1.best.b === 5 && m1.best.c === 1 && m1.stars === 9, `results join task by task (${JSON.stringify(m1.best)} ${m1.stars})`);
const m2 = mergeState(m1, { best: { a: 3, c: 1 }, stars: 4 });
check(m2.stars === m1.stars, 'restoring the same archive twice adds nothing');
const m3 = mergeState({ ...state, classCode: '', rated: true }, { classCode: 'old', rated: false });
check(m3.classCode === 'old' && m3.rated === false, 'an archive never switches the rating on');
const m4 = mergeState({ ...state }, { stars: 3, best: { x: 3 }, sound: false });
check(m4.player?.id === state.player.id && m4.stars === state.stars && m4.sound === state.sound, 'an archive from before profiles keeps this player and settings');
const m5 = mergeState({ best: { 'lab:0': 3, 'lab:level': 20 }, stars: 3 }, { best: { 'lab:0': 3, 'lab:level': 12 }, stars: 3 });
check(m5.stars === 3 && m5.best['lab:level'] === 20, `the lab level is not counted as stars (${m5.stars})`);
const m6 = mergeState({ best: { a: 30 }, stars: 30 }, { best: { b: 10 }, stars: 160 });
check(m6.stars === 190, `stars only the server knew are kept, and new ones from here are added (${m6.stars})`);
const P = n => ({ id: `00000000-0000-4000-8000-00000000000${n}`, secret: String(n).repeat(32) });
const ids = m => m.forget.map(p => p.id).sort().join();
const m7 = mergeState({ player: P(1), syncedAt: 5, stars: 50, best: { a: 50 } }, { player: P(2), stars: 50, best: { a: 50 } });
check(m7.player.id === P(1).id && ids(m7) === P(2).id, 'a player that never reached the server is not taken over, and is queued to forget');
const m8 = mergeState({ player: P(1), syncedAt: 5, stars: 50, best: { a: 50 } }, { player: P(2), syncedAt: 4, stars: 900, best: { a: 50 } });
check(m8.player.id === P(2).id && ids(m8) === P(1).id, 'the player the server rates higher stays');
const m9 = mergeState({ player: P(1), stars: 50 }, { player: P(2), syncedAt: 4, stars: 10 });
check(m9.player.id === P(2).id && ids(m9) === P(1).id, 'a device player that never synced gives way to one the server knows');
const m10 = mergeState({ player: P(1), syncedAt: 5, stars: 40, best: { a: 40 } }, { stars: 1500, best: { b: 1500 } });
check(m10.player === null && m10.stars === 1540 && ids(m10) === P(1).id, 'old stars never land on a known player as this week\'s');
const m12 = mergeState({ player: P(1), syncedAt: 5, stars: 150, best: {} }, { player: P(1), syncedAt: 4, stars: 150, best: { a: 150 } });
check(m12.stars === 150 && m12.player.id === P(1).id && !m12.forget.length, `the same player on both sides: nothing counted twice (${m12.stars})`);
const m13 = mergeState({ player: P(1), stars: 1, best: { d: 1 } }, { player: P(2), syncedAt: 4, stars: 800, best: { a: 800 } });
check(m13.stars === 801 && m13.player.id === P(2).id, 'a star earned here before restoring does not start a new player');
const m11 = mergeState({ player: P(1), stars: 40 }, { stars: 1500, forget: [P(3)] });
check(m11.player.id === P(1).id && ids(m11) === P(3).id, 'a player that never synced keeps going, and the archive\'s own forget list is kept');
check(mergeState(m8, { player: P(2), syncedAt: 4, stars: 900, best: { a: 50 } }).player.id === P(2).id, 'restoring the same archive twice keeps the player');

const after = (await db.all('art')).filter(a => a.thumb);
check(after.length === 1 && after[0].thumb instanceof Blob && after[0].full instanceof Blob, 'the drawing is back, with its pictures');
check(after[0]?.data?.layers?.every(b => b instanceof Blob), 'its layers are pictures again, so it can be drawn on');

await T.go('#/gallery', 900);
const imgs = T.qq('.gallery .frame img');
await Promise.all(imgs.map(i => i.decode().catch(() => {})));
check(imgs.length === 1, `the gallery shows it (${imgs.length})`);
check(imgs.every(i => i.naturalWidth > 0), 'its picture opens');
await T.go(T.q('.gallery .frame').getAttribute('href'), 900);
check(!!T.q('.screen img, .screen canvas'), 'the drawing opens from the gallery');
return { problems, toast: toastText, size: archive.size };
