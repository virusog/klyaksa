// With no internet the rating says so kindly, and the rest of the app works.
// Run with --offline.
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
await T.go('#/rating', 2500);
check(!!T.q('.rating-empty') && !T.q('.rating-row'), 'the rating shows the no-internet message');
check(!T.errors.length, `no page errors: ${T.errors.join(' | ')}`);
await T.go('#/games', 600);
check(T.qq('.game-card, .tile, a').length > 5, 'the games screen still opens');
return { problems, text: T.q('.rating-empty')?.textContent };
