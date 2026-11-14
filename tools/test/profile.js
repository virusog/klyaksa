// First launch, the profile screen, the cookie, and the shared rating, end to end.
// Starts from empty storage. Creates one test player on the real server and
// removes it again at the end.
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const out = {};
// Opening the screen we are already on does not redraw it, so step away first.
const fresh = async (hash, ms) => { await T.go('#/prizes', 300); await T.go(hash, ms); };

check(location.hash === '#/hello', `a new device starts at #/hello, not ${location.hash}`);
check(T.qq('.hello-lang').length === 3, 'three languages are offered');
const current = T.q('.hello-lang.on');
check(!!current, 'the current language is marked');
await T.click(current, 500);
check(location.hash === '#/hello/2', 'choosing the current language goes on to the name');
await T.click(T.q('.hello-go'), 300);
check(location.hash === '#/hello/2' && !!T.q('.toast'), 'an empty name is refused with a hint');
T.q('.hello-name').value = '   Test   Girl   ';
await T.click(T.qq('.hello-avatar')[7], 100);
await T.click(T.q('.hello-go'), 900);
const st = T.state();
check(location.hash === '#/', 'after the name she lands at home');
check(st.name === 'Test Girl' && st.avatar === T.qq('.me-avatar')[0]?.textContent, 'name tidied and avatar kept');
check(/^[0-9a-f-]{36}$/.test(st.player?.id || '') && /^[0-9a-f]{32}$/.test(st.player?.secret || ''), 'a player id and secret are made');
check(document.cookie.includes(`klyaksa_player=${st.player?.id}.${st.player?.secret}`), 'the id is mirrored in a cookie');
check(T.q('.hello h1')?.textContent.includes('Test Girl'), 'home greets her by name');

// Reaching the rating sends her stars and shows her.
await T.wait(3000);
await fresh('#/rating', 3500);
const mine = T.q('.rating-row.me');
check(!!mine, 'she is on the rating');
check(mine?.querySelector('.rating-name bdi')?.textContent === 'Test Girl', 'with her name');
out.rows = T.qq('.rating-row').length;

// Stars won in a game reach the server soon after.
const { award } = await import(location.origin + '/js/store.js');
award('test:one', 3);
await T.wait(4500);
await fresh('#/rating', 3500);
// Both tabs show 3: all of her stars were won this week.
for (const tab of T.qq('.rating-tabs .tab')) {
  await T.click(tab, 300);
  check(T.q('.rating-row.me .rating-stars b')?.textContent === '3', `new stars reach the rating, tab «${tab.textContent}» shows ${T.q('.rating-row.me .rating-stars b')?.textContent}`);
}

// Changing the name on the profile screen.
await T.go('#/me', 500);
check(T.q('.hello-name')?.value === 'Test Girl', 'the profile screen shows her name');
T.q('.hello-name').value = 'Test Two';
await T.click(T.q('.hello-go'), 800);
check(T.state().name === 'Test Two', 'the new name is saved');
await T.wait(500);
await fresh('#/rating', 3500);
check(T.q('.rating-row.me .rating-name bdi')?.textContent === 'Test Two', 'and reaches the rating');

// A cleared storage gets the same player back from the cookie.
const keep = T.state().player;
const { ensurePlayer, leaveRating } = await import(location.origin + '/js/player.js');
const { state } = await import(location.origin + '/js/store.js');
state.player = null;
const back = ensurePlayer();
check(back.id === keep.id && back.secret === keep.secret, 'the cookie brings the same player back');

// Leaving the rating removes her from the server.
await leaveRating();
await fresh('#/rating', 2500);
check(!!T.q('.rating-empty') && !T.q('.rating-row.me'), 'after leaving she is not on the rating');
out.problems = problems;
return out;
