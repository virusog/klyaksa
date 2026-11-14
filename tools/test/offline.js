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
return { problems, text };
