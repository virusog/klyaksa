// First launch from a class invitation, the profile screen, the cookie, and the
// class rating on the real server, end to end. Starts from empty storage at
// http://localhost:8123/index.html?class=__CLASS__ (run.mjs fills in a class used
// only by this test). The test player is always removed again, even on failure.
const CLASS = '__CLASS__';
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const out = {};
// Opening the screen we are already on does not redraw it, so step away first.
const fresh = async (hash, ms) => { await T.go('#/prizes', 300); await T.go(hash, ms); };
const { RATING_URL, RATING_KEY } = await import(location.origin + '/js/net-config.js');
const rpc = (name, body) => fetch(`${RATING_URL}/rest/v1/rpc/${name}`, {
  method: 'POST', headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then(r => r.json());
let player = null;

try {
  check(!location.search.includes('class='), 'the class code is taken out of the address');
  check(T.state().classCode === CLASS, `the invitation link sets the class (${T.state().classCode})`);
  check(location.hash === '#/hello', `a new device starts at #/hello, not ${location.hash}`);
  check(T.qq('.hello-lang').length === 3, 'three languages are offered');
  const current = T.q('.hello-lang.on');
  check(!!current, 'the current language is marked');
  await T.click(current, 500);
  check(location.hash === '#/hello/2', 'choosing the current language goes on to the name');
  await T.click(T.q('.hello-go'), 300);
  check(location.hash === '#/hello/2' && !!T.q('.toast'), 'an empty name is refused with a hint');
  T.q('.hello-name').value = '   Test   Girl   ';
  const face = T.qq('.hello-avatar')[7];
  const chosen = face.textContent;
  await T.click(face, 100);
  await T.click(T.q('.hello-go'), 900);
  const st = T.state();
  player = st.player;
  check(location.hash === '#/', 'after the name she lands at home');
  check(st.name === 'Test Girl', `the name is tidied (${st.name})`);
  check(st.avatar === chosen && chosen !== '🐱', `the chosen avatar ${chosen} is kept (${st.avatar})`);
  check(/^[0-9a-f-]{36}$/.test(st.player?.id || '') && /^[0-9a-f]{32}$/.test(st.player?.secret || ''), 'a player id and secret are made');
  check(document.cookie.includes(`klyaksa_player=${st.player?.id}.${st.player?.secret}`), 'the id is mirrored in a cookie');
  check(T.q('.hello h1')?.textContent.includes('Test Girl'), 'home greets her by name');

  // Reaching the rating sends her stars and shows her.
  await T.wait(2500);
  await fresh('#/rating', 3500);
  const mine = T.q('.rating-row.me');
  check(!!mine, 'she is on her class rating');
  check(mine?.querySelector('.rating-name bdi')?.textContent === 'Test Girl', 'with her name');
  out.rows = T.qq('.rating-row').length;
  check(out.rows === 1, `only her own class is shown (${out.rows} rows)`);

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

  // Another class does not see her.
  const other = await rpc('klyaksa_board', { p_class: 'class-nobody-here', p_limit: 300 });
  check(Array.isArray(other) && !other.some(r => r.name === 'Test Girl'), 'another class does not see her');

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
  const { ensurePlayer, leaveRating } = await import(location.origin + '/js/player.js');
  const { state } = await import(location.origin + '/js/store.js');
  state.player = null;
  const back = ensurePlayer();
  check(back.id === player.id && back.secret === player.secret, 'the cookie brings the same player back');

  // Leaving the rating removes her from the server: asked of the server itself.
  await leaveRating();
  const after = await rpc('klyaksa_board', { p_class: CLASS, p_id: player.id, p_secret: player.secret, p_limit: 300 });
  check(Array.isArray(after) && after.length === 0, `after leaving the server has nobody in the test class (${JSON.stringify(after).slice(0, 120)})`);
  await fresh('#/rating', 1500);
  check(!!T.q('.rating-empty') && !T.q('.rating-row'), 'after leaving the screen says she is not on the rating');
} finally {
  // Whatever happened above, the test player does not stay on the server.
  if (player) out.forget = await rpc('klyaksa_forget', { p_id: player.id, p_secret: player.secret }).catch(e => String(e));
}
out.problems = problems;
return out;
