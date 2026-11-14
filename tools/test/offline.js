// With no internet the rating says so kindly, and the rest of the app works.
// Run with --offline and a class code in the state.
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
await T.go('#/rating', 2500);
const box = T.q('.rating-empty');
check(!!box && !!box.querySelector('.btn.primary') && !T.q('.rating-row'), 'the rating shows the no-internet message with a try-again button');
check(!T.q('.rating-code'), 'it does not ask for a class code');
check(!T.errors.length, `no page errors: ${T.errors.join(' | ')}`);
const text = box?.textContent;
await T.go('#/games', 600);
check(T.qq('.game-card').length > 5, 'the games screen still opens');
// A player dropped by joining an archive waits in state.forget until the server answers.
const { state, save } = await import(location.origin + '/js/store.js');
const { forgetDropped } = await import(location.origin + '/js/player.js');
const dropped = { id: '00000000-0000-4000-8000-000000000009', secret: '9'.repeat(32) };
state.forget = [dropped];
save();
await forgetDropped();
check(state.forget.length === 1 && T.state().forget?.[0]?.id === dropped.id, 'with no internet the dropped player is kept to forget later');
return { problems, text };
