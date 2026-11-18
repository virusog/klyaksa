// With no internet "My class" says so kindly (rating, drawings, chat), and the rest
// of the app works. Run with --offline, Russian and a class code in the state.
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
await T.go('#/rating', 2500);
const box = T.q('.rating-empty');
check(!!box && !!box.querySelector('.btn.primary') && !T.q('.rating-row'), 'the rating shows the no-internet message with a try-again button');
check(!T.q('.rating-code'), 'it does not ask for a class code');
check(!T.errors.length, `no page errors: ${T.errors.join(' | ')}`);
const text = box?.textContent;
// The drawings and the chat say they need the internet and offer to try again.
await T.go('#/class/art', 1500);
check(/Рисунки не загрузились/.test(T.q('.class-empty')?.textContent || '') && !!T.q('.class-empty .btn.primary'),
  `the drawings say they did not load, with a try-again button (${T.q('.class-empty')?.textContent})`);
await T.go('#/class/chat', 1500);
check(/Чат не загрузился/.test(T.q('.class-empty')?.textContent || '') && !!T.q('.class-empty .btn.primary'),
  `the chat says it did not load, with a try-again button (${T.q('.class-empty')?.textContent})`);
const input = T.q('.chat-input');
input.value = 'Привет';
await T.click(T.q('.chat-send'), 300);
check(/Нет связи. Сообщение не отправлено/.test(T.q('.toast')?.textContent || '') && input.value === 'Привет',
  `a message sent with no internet says so and stays in the field (${T.q('.toast')?.textContent})`);
check(!T.errors.length, `no page errors in the class: ${T.errors.join(' | ')}`);
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
