// "My class": the rating, the class drawings and the class chat, played through
// the real screens against the pretend server of tools/drive.mjs (class
// 'test-class' has Маша and Noa, three drawings and four messages). Checks the
// tabs, typed codes and class moves, sharing a drawing and a result, hearts,
// reports and deleting, the chat with its limits and its polling, the chat switch,
// the home badge, the class gate, and drawings from photos staying at home.
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const FAKE = 'klyaksa.fakeServer';
const fake = () => JSON.parse(localStorage.getItem(FAKE) || 'null');
const editFake = fn => { const d = fake(); fn(d); localStorage.setItem(FAKE, JSON.stringify(d)); };
const { state, save } = await import(location.origin + '/js/store.js');
const { syncNow, setClass } = await import(location.origin + '/js/player.js');
const { celebrate } = await import(location.origin + '/js/ui.js');
// Waits until fn() is true (or about ms milliseconds went by); returns the last answer.
const until = async (fn, ms = 3000) => {
  let v;
  for (let i = 0; i < ms / 50 && !(v = fn()); i++) await T.wait(50);
  return v;
};
const toastText = () => T.q('.toast')?.textContent || '';
// Nothing sticks out sideways and no page errors, checked on every screen.
const clean = where => {
  const over = T.overflow();
  check(!over.length, `${where}: sticks out sideways: ${over.join(', ')}`);
  check(!T.errors.length, `${where}: page errors: ${T.errors.join(' | ')}`);
  T.errors.length = 0;
};
const yes = async (ms = 600) => { await T.click(await until(() => T.q('.modal-back:last-child .modal .btn.primary')), ms); };
const rpcs = [];
const realFetch = window.fetch;
// slow: a class call waits this many ms first, as on a slow network.
let slow = 0;
window.fetch = async (url, o) => {
  const m = String(url).match(/rpc\/(klyaksa_\w+)/);
  if (m) { rpcs.push({ name: m[1], body: JSON.parse(o?.body || '{}'), at: Date.now() }); if (slow) await T.wait(slow); }
  return realFetch(url, o);
};
const chatCalls = () => rpcs.filter(r => r.name === 'klyaksa_chat').length;
// The chat polls each time the page comes back into sight: n polls at once.
const pollNow = async n => { for (let i = 0; i < n; i++) { document.dispatchEvent(new Event('visibilitychange')); await T.wait(150); } };

// 1. The hub: three tabs, the rating still works, and the old address opens it.
await T.go('#/class', 300);
check(!!(await until(() => T.qq('.rating-row').length === 3)), `the rating tab shows her and two classmates (${T.qq('.rating-row').length} rows)`);
check(T.qq('.class-tab').length === 3, `three tabs: rating, drawings, chat (${T.qq('.class-tab').length})`);
check(!!T.q('.rating-row.me') && !!T.q('.rating-tabs'), 'her own row is marked and the week / all-time tabs are there');
check(/Мой класс/.test(T.q('.topbar')?.textContent || ''), 'the top bar says "Мой класс"');
clean('#/class');
await T.go('#/rating', 300);
check(!!(await until(() => T.qq('.rating-row').length === 3)) && T.q('.class-tab.on')?.getAttribute('href') === '#/class', 'the old #/rating opens the rating tab');

// 2. A result from the celebration goes to the class chat.
await T.go('#/studio/new', 300);
const stage = await until(() => T.q('.stage'), 5000);
await T.wait(600);
const sr = stage.getBoundingClientRect();
const pts = [];
for (let i = 0; i < 30; i++) pts.push([sr.left + 100 + i * 12, sr.top + 120 + Math.sin(i / 3) * 60]);
await T.stroke(pts, { pause: 5 });
await T.click(T.qq('.topbar .btn.primary').pop(), 300);
const brag = await until(() => T.q('.celebrate .brag'));
check(!!brag, 'the celebration offers to tell the class');
if (brag) {
  await T.click(brag, 100);
  await until(() => brag.disabled, 3000);
  check(brag.disabled && /Класс увидит/.test(toastText()), `the brag is sent once and says so (${toastText()})`);
  const res = fake().messages.filter(m => m.kind === 'result' && m.player === state.player.id);
  check(res.length === 1 && JSON.parse(res[0].body).t === 'draw', `the class chat got her result (${res.map(m => m.body).join()})`);
}
T.q('.celebrate')?.closest('.modal-back')?.remove();
T.q('.celebrate')?.remove();
clean('celebrate');

// 3. Showing her drawing from the art view in the gallery.
await T.go('#/gallery', 900);
const frame = await until(() => T.q('.gallery .frame'));
check(!!frame, 'the drawing is in her gallery');
if (frame) await T.go(frame.getAttribute('href'), 900);
const show = await until(() => T.q('.class-show'));
check(!!show, 'the art view has "Показать классу"');
if (show) {
  await T.click(show, 300);
  check(/Показать этот рисунок всему классу/.test(T.q('.modal p')?.textContent || ''), 'it asks before showing');
  await yes(300);
  await until(() => location.hash === '#/class/art' && T.q('.post-card.mine'), 6000);
  check(location.hash === '#/class/art', `after sharing she is on the class drawings (${location.hash})`);
  check(/в классе/.test(toastText()), `a toast says the drawing is in the class (${toastText()})`);
}
const art = (await (await import(location.origin + '/js/store.js')).db.all('art')).find(a => a.thumb);
check(state.shared.includes(art?.id), 'the shared drawing is remembered');
const sentPost = rpcs.find(r => r.name === 'klyaksa_post_add')?.body;
check(sentPost && ['p_title', 'p_thumb', 'p_image', 'p_w', 'p_h'].every(k => k in sentPost), 'every parameter of klyaksa_post_add is sent');
check(sentPost && atob(sentPost.p_thumb.slice(0, 8)).charCodeAt(0) === 0xff && sentPost.p_thumb.length * 0.75 <= 45000 && sentPost.p_image.length * 0.75 <= 450000,
  'the drawing goes as a JPEG small enough for the server');
let cards = await until(() => T.qq('.post-card').length === 4 && T.qq('.post-card'));
check(cards && cards.length === 4, `the drawings tab shows 3 classmates' drawings and hers (${T.qq('.post-card').length})`);
const mine = T.q('.post-card.mine');
check(!!mine && !mine.querySelector('.heart') && !!mine.querySelector('.hearts-count'), 'her own drawing shows its hearts without a heart button');
check(mine?.querySelector('.hearts-count')?.textContent.trim() === '🤍 0', `with no hearts yet her own count is an empty heart (${mine?.querySelector('.hearts-count')?.textContent})`);
// A free drawing is "Мой рисунок" only for its author; classmates see "Рисунок".
check(mine?.querySelector('.post-title')?.textContent === 'Мой рисунок' && T.q('.post-card[data-post="2"] .post-title')?.textContent === 'Рисунок',
  `an untitled drawing reads as hers only to her (${mine?.querySelector('.post-title')?.textContent} / ${T.q('.post-card[data-post="2"] .post-title')?.textContent})`);
check(T.qq('.post-card .post-name').every(n => n.tagName === 'BDI'), 'names are isolated in <bdi>');
check(T.qq('.post-card img').every(i => i.complete && i.naturalWidth > 0) || (await until(() => T.qq('.post-card img').every(i => i.naturalWidth > 0))), 'every thumbnail shows');
clean('#/class/art');

// Showing the same drawing again asks about it; a colouring from a photo is never offered.
const { db } = await import(location.origin + '/js/store.js');
await db.put('art', { id: 'photo-test', kind: 'coloring', title: 'Моё фото', photo: true, created: Date.now(), updated: Date.now(), thumb: art.thumb, full: art.full });
await T.click(T.q('.class-share'), 300);
await until(() => T.q('.share-pick .pick-art'));
check(T.qq('.share-pick .pick-art').length === 1 && T.q('.share-pick .pick-art.shared'), `the picker shows her drawing, marked as shared, and no photo (${T.qq('.share-pick .pick-art').length})`);
await T.click(T.q('.share-pick .pick-art'), 300);
check(/Этот рисунок уже в классе. Показать ещё раз\?/.test(T.q('.modal-back:last-child .modal p')?.textContent || ''), 'sharing it again asks first');
await T.click(T.q('.modal-back:last-child .modal .btn.ghost'), 300);
check(!!T.q('.share-pick') && !T.q('.share-pick').closest('.hidden'), 'cancelling goes back to the picker');
clean('#/class/art picker');
await T.click(T.q('.share-pick .btn.ghost'), 300);
check(!T.q('.share-pick'), 'the picker closes');
await T.go('#/art/photo-test', 900);
check(!!T.q('.art-view, .screen') && !T.q('.class-show'), 'a colouring from a photo has no "Показать классу"');
const { shareArt } = await import(location.origin + '/js/classart.js');
check(!(await shareArt({ id: 'photo-test', title: 'Моё фото', full: art.full })) && /из фото/.test(toastText()), `and cannot be shared at all (${toastText()})`);
await db.del('art', 'photo-test');
await T.go('#/class/art', 300);
await until(() => T.qq('.post-card').length === 4);

// 4. A heart for a classmate's drawing, and taking it back.
const house = T.q('.post-card[data-post="2"] .heart');
check(!!house && house.textContent.trim() === '🤍 0', `Noa's drawing has an empty heart (${house?.textContent})`);
if (house) {
  await T.click(house, 50);
  check(house.textContent.trim() === '❤️ 1', `the heart fills at once (${house.textContent})`);
  await until(() => fake().likes.some(l => l.post === 2 && l.player === state.player.id), 2000);
  check(fake().likes.some(l => l.post === 2 && l.player === state.player.id), 'the server got her heart');
  await T.wait(200);
  await T.click(house, 400);
  check(house.textContent.trim() === '🤍 0' && !fake().likes.some(l => l.post === 2 && l.player === state.player.id), `the heart is taken back (${house.textContent})`);
}

// 5. Best of the week: the drawing with a heart wears the crown.
await T.click(T.byText('Лучшие за неделю'), 100);
await until(() => T.qq('.post-card').length >= 1);
const first = T.q('.post-card');
check(first?.dataset.post === '3' && !!first.querySelector('.post-crown') && T.qq('.post-crown').length === 1,
  `the week tab starts with the drawing with a heart, crowned (${first?.dataset.post}, ${T.qq('.post-crown').length} crowns)`);
clean('#/class/art week');
await T.click(T.byText('Новые'), 100);
await until(() => T.qq('.post-card').length === 4);

// 6. A classmate's drawing opens big, with its title in her language.
await T.click(T.q('.post-card[data-post="3"] .post-pic'), 100);
const modal = await until(() => T.q('.post-modal'));
check(!!modal && T.q('.post-modal .post-title')?.textContent === 'Кит и кораблик', `the drawing opens with its title (${T.q('.post-modal .post-title')?.textContent})`);
check(!!(await until(() => T.q('.post-full')?.naturalWidth > 0)), 'the big picture loads');
check(!!T.q('.post-modal .heart') && !!T.byText('Пожаловаться'), 'a classmate\'s drawing has a heart and "Пожаловаться"');
clean('post modal');
await T.click(T.byText('Закрыть'), 200);
check(!T.q('.post-modal'), 'the dialog closes');

// 7. Taking her own drawing back from the class.
await T.click(T.q('.post-card.mine .post-pic'), 300);
check(!!T.byText('Убрать из класса') && !T.q('.post-modal .heart'), 'her own drawing offers "Убрать из класса" and no heart');
await T.click(T.byText('Убрать из класса'), 200);
await yes(600);
check(T.qq('.post-card').length === 3 && !T.q('.post-card.mine'), `her drawing is gone (${T.qq('.post-card').length} left)`);
check(!fake().posts.some(p => p.player === state.player.id && !p.hidden) && !fake().messages.some(m => m.kind === 'post' && m.player === state.player.id && !m.hidden),
  'the server removed the drawing and its notice in the chat');

// 8. Reporting a drawing: it disappears for her at once.
await T.click(T.q('.post-card[data-post="1"] .post-pic'), 300);
await T.click(T.byText('Пожаловаться'), 200);
check(/Пожаловаться на этот рисунок/.test(T.q('.modal-back:last-child .modal p')?.textContent || ''), 'reporting asks first');
await yes(600);
check(T.qq('.post-card').length === 2 && !T.q('.post-card[data-post="1"]'), `the reported drawing is gone for her (${T.qq('.post-card').length} left)`);
check(fake().reports.some(r => r.kind === 'post' && r.target === 1 && r.reporter === state.player.id), 'the server got the report');
check(/скажи маме или учительнице/.test(toastText()), `after a report she is told to tell a grown-up (${toastText()})`);
check(state.seenPost >= 3, `the newest drawing counts as seen (${state.seenPost})`);

// 9. The chat: the messages, a result card in words, a notice of a drawing.
await T.go('#/class/chat', 300);
await until(() => T.qq('.msg-row').length >= 4);
const rows = T.qq('.msg-row');
check(rows.length === 5, `the chat shows 4 messages and her result (${rows.length})`);
check(T.qq('.msg-text').some(p => p.textContent.includes('Привет! Кто сегодня рисовал?') && p.dir === 'auto'), 'a Russian message, with dir="auto"');
check(T.qq('.msg-text').some(p => p.textContent.includes('שלום')), 'a Hebrew message');
const cardText = T.qq('.msg-result').map(p => p.textContent);
check(cardText.some(s => s.includes('Маша прошла урок «Котик»') && s.includes('★★★')), `the lesson result reads as a sentence with stars (${cardText.join(' | ')})`);
check(cardText.some(s => s.includes(`${state.name} нарисовала новый рисунок`)), `her own result is there, for a drawing without a name (${cardText.join(' | ')})`);
check(!!T.q('.msg-post') && /Noa показала новый рисунок/.test(T.q('.msg-post').textContent), `the notice of Noa's untitled drawing (${T.q('.msg-post')?.textContent})`);
check(T.qq('.chat-day').length >= 1 && T.qq('.chat-day').some(d => /Сегодня/.test(d.textContent)), 'days are separated');
check(T.qq('.msg-row .chat-name').every(n => n.tagName === 'BDI'), 'names in the chat are isolated in <bdi>');
check(/Пиши по-доброму/.test(T.q('.chat-note')?.textContent || ''), 'the kindness note is shown');
const input = T.q('.chat-input');
check(input?.maxLength === 200 && input.getAttribute('enterkeyhint') === 'send' && input.dir === 'auto', 'the field takes 200 letters, sends on Enter and follows the writing direction');
check(T.visible(input) && T.visible(T.q('.chat-send')), 'the field and the send button are on screen');
clean('#/class/chat');

// 10. Sending: the server's cleaned text is what she sees; Enter sends; too fast is refused.
input.value = 'Привет всем! мой номер 054-123-4567 и сайт www.example.com';
await T.click(T.q('.chat-send'), 100);
await until(() => T.qq('.msg-row.mine .msg-text').length === 1);
const shown = T.qq('.msg-row.mine .msg-text').pop()?.textContent || '';
check(shown.startsWith('Привет всем!') && !/054|example/.test(shown) && shown.includes('***'), `the phone number and link are hidden (${shown})`);
check(input.value === '', 'the field is emptied');
input.value = 'Ещё раз';
input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await until(() => /Не так быстро/.test(toastText()), 1500);
check(/Не так быстро/.test(toastText()), `a second message at once is refused kindly (${toastText()})`);
check(input.value === 'Ещё раз', 'the refused text stays in the field');
await T.wait(2100);
input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
await until(() => T.qq('.msg-row.mine .msg-text').length === 2);
check(T.qq('.msg-row.mine .msg-text').pop()?.textContent === 'Ещё раз', 'Enter sends');
const sentKinds = fake().messages.filter(m => m.player === state.player.id).map(m => m.kind);
check(sentKinds.filter(k => k === 'text').length === 2, `the server has her two messages (${sentKinds})`);

// Emoji go into the field.
await T.click(T.q('.chat-emoji'), 200);
check(T.qq('.pop .emoji').length >= 12, 'the emoji open');
const pop = T.q('.pop');
check(!!pop && T.visible(pop), 'the emoji fit on the screen');
await T.click(T.q('.pop .emoji'), 100);
check(input.value === '😀', `an emoji goes into the field (${input.value})`);
document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
T.q('.pop')?.remove();
input.value = '';

// A message from a classmate arrives by itself.
editFake(d => d.messages.push({ id: 900, player: 'fake-2', klass: 'test-class', kind: 'text', body: 'Новенькое от Noa', hidden: false, at: new Date().toISOString() }));
check(!!(await until(() => T.q('.msg-row[data-id="900"]'), 6000)), 'a new message from a classmate shows up without reloading');
// Hidden for everyone (two reports, or its author deleted it): it goes from open screens too.
editFake(d => { d.messages.find(m => m.id === 2).hidden = true; });
await pollNow(8);
check(!!(await until(() => !T.q('.msg-row[data-id="2"]'), 3000)) && !!T.q('.msg-row[data-id="900"]'), 'a message hidden on the server disappears from the open chat');

// Deleting her own message, reporting someone else's.
const before = T.qq('.msg-row.mine').length;
await T.click(T.qq('.msg-row.mine .msg-more').pop(), 200);
check(T.q('.pop .pick')?.textContent === 'Удалить', 'her message offers "Удалить"');
await T.click(T.q('.pop .pick'), 200);
await yes(600);
check(T.qq('.msg-row.mine').length === before - 1, `her message is deleted (${T.qq('.msg-row.mine').length})`);
check(fake().messages.filter(m => m.player === state.player.id && m.kind === 'text' && !m.hidden).length === 1, 'and gone from the server');
await T.click(T.q('.msg-row[data-id="1"] .msg-more'), 200);
check(T.q('.pop .pick')?.textContent === 'Пожаловаться', 'a classmate\'s message offers "Пожаловаться"');
await T.click(T.q('.pop .pick'), 200);
await yes(600);
check(!T.q('.msg-row[data-id="1"]') && fake().reports.some(r => r.kind === 'msg' && r.target === 1), 'the reported message is gone for her and reported');
check(/скажи маме или учительнице/.test(toastText()), `after reporting a message she is told to tell a grown-up (${toastText()})`);
check(state.seenMsg >= 900, `the newest message counts as seen (${state.seenMsg})`);
clean('#/class/chat after');

// 11. The notice of a drawing opens that drawing.
await T.click(T.q('.msg-post'), 300);
check(!!(await until(() => T.q('.post-modal'), 4000)) && location.hash === '#/class/art', `the notice opens the drawing (${location.hash})`);
check(T.q('.post-modal .post-name')?.textContent === 'Noa', 'it is Noa\'s drawing');
T.q('.post-modal')?.closest('.modal-back')?.remove();
// The chat stopped asking the server once she left it.
const calls = chatCalls();
await T.wait(9000);
check(chatCalls() === calls, `the chat stops polling when she leaves it (${chatCalls() - calls} calls after)`);
// A drawing that is gone: the link says so.
await T.go('#/class/art/999', 300);
check(!!(await until(() => /Этого рисунка уже нет/.test(toastText()))), `a link to a drawing that is gone says so (${toastText()})`);

// 12. The home badge: there for something new, gone after looking.
await T.go('#/', 300);
await T.wait(800);
check(!T.q('.t-rating .tile-new'), 'no badge when she has seen everything');
editFake(d => d.messages.push({ id: 901, player: 'fake-1', klass: 'test-class', kind: 'text', body: 'Кто пойдёт гулять?', hidden: false, at: new Date().toISOString() }));
await T.go('#/games', 200);
await T.go('#/', 300);
check(!!(await until(() => T.q('.t-rating .tile-new'))), 'a new message puts "Новое" on the class tile');
check(T.q('.t-rating')?.getAttribute('href') === '#/class' && /Мой класс/.test(T.q('.t-rating').textContent), 'the tile is "Мой класс" and opens #/class');
clean('#/ with the badge');
await T.go('#/class/chat', 300);
await until(() => T.q('.msg-row[data-id="901"]'));
await T.go('#/', 300);
await T.wait(800);
check(!T.q('.t-rating .tile-new'), 'after visiting the chat the badge is gone');
const callsHome = chatCalls();
// A new drawing puts the badge there too.
editFake(d => d.posts.push({ id: 50, player: 'fake-2', klass: 'test-class', title: 'Котик', thumb: d.posts[0].thumb, image: d.posts[0].image, w: 160, h: 120, hidden: false, at: new Date().toISOString() }));
await T.go('#/games', 200);
await T.go('#/', 300);
check(!!(await until(() => T.q('.t-rating .tile-new'))), 'a new drawing puts "Новое" on the class tile');
// She reports that drawing before opening the chat, where its notice never shows: no badge stays.
editFake(d => d.messages.push({ id: 902, player: 'fake-2', klass: 'test-class', kind: 'post', body: JSON.stringify({ post: 50, what: 'Котик' }), hidden: false, at: new Date().toISOString() }));
await T.go('#/class/art', 300);
await T.click(await until(() => T.q('.post-card[data-post="50"] .post-pic')), 300);
await T.click(T.byText('Пожаловаться'), 200);
await yes(600);
await T.go('#/class/chat', 300);
await until(() => T.q('.msg-row[data-id="901"]'));
check(!T.q('.msg-row[data-id="902"]'), 'the notice of a drawing she reported is not in her chat');
await T.go('#/', 300);
await T.wait(800);
check(!T.q('.t-rating .tile-new'), 'and it leaves no badge on the class tile');
check(chatCalls() - callsHome <= 2, `away from the chat nothing polls it (${chatCalls() - callsHome} calls)`);

// 13. The chat switched off by her parents: no tab, no brag.
state.chat = false;
save();
await T.go('#/class/chat', 300);
await until(() => T.qq('.rating-row').length === 3);
check(T.qq('.class-tab').length === 2 && !T.q('.chat') && !!T.q('.rating-row'), `with the chat off there is no chat tab (${T.qq('.class-tab').length} tabs)`);
celebrate({ title: 'Ура', stars: 3, brag: { t: 'game', what: 'Пазл', stars: 3 } });
check(!T.q('.celebrate .brag'), 'and no brag button');
T.q('.celebrate')?.closest('.modal-back')?.remove();
T.q('.celebrate')?.remove();
await T.go('#/parents', 500);
const g = T.q('.gate h2')?.textContent.match(/(\d+)\D+(\d+)/);
T.q('.gate-input').value = String(g[1] * g[2]);
T.q('.gate .btn').click();
await T.wait(300);
const chatBox = T.qq('.set').find(l => l.textContent.includes('Чат класса'))?.querySelector('input');
check(!!chatBox && !chatBox.checked, 'the parents see the chat switched off');
chatBox?.click();
await T.wait(100);
check(state.chat === true, 'and can switch it on again');
check(T.qq('.set').some(l => l.textContent.includes('Участвовать: рейтинг, рисунки и чат')), 'the participation switch names everything it covers');
clean('#/parents');

// 14. Typed codes: a class with nobody asks first; a known typo moves on its own.
state.classCode = '';
save();
await T.go('#/class', 500);
const field = T.q('.rating-code');
check(!!field && T.q('.class-tabs')?.classList.contains('hidden'), 'without a class the hub asks for the code and hides the tabs');
check(/рейтинг, рисунки и чат/.test(T.q('.rating-empty p')?.textContent || ''), `the gate names everything "Мой класс" has (${T.q('.rating-empty p')?.textContent})`);
field.value = 'nobody-here';
await T.click(T.q('.rating-empty .btn.primary'), 100);
const ask = await until(() => T.q('.modal-back .modal p')?.textContent);
check(/пока никого нет/.test(ask || '') && ask.includes('nobody-here'), `a class with nobody asks to check the code (${ask})`);
check(T.q('.modal-back .modal .btn.primary')?.textContent === 'Исправить', `"Исправить" is the big button (${T.q('.modal-back .modal .btn.primary')?.textContent})`);
await T.click(T.byText('Исправить'), 300);
check(!state.classCode && !!T.q('.rating-code'), 'fixing the code keeps her out of that class');
field.value = 'nobody-here';
await T.click(T.q('.rating-empty .btn.primary'), 100);
await until(() => T.byText('Всё равно войти'));
await T.click(T.byText('Всё равно войти'), 1200);
check(state.classCode === 'nobody-here', `"Всё равно войти" joins the empty class (${state.classCode})`);
state.classCode = '';
save();
await T.go('#/games', 100);
await T.go('#/class', 500);
T.q('.rating-code').value = 'tset-class';
await T.click(T.q('.rating-empty .btn.primary'), 100);
await until(() => state.classCode === 'test-class' && T.qq('.rating-row').length === 3, 3000);
check(state.classCode === 'test-class' && !T.q('.modal-back .modal p'), `a known typo moves to the real class without asking (${state.classCode})`);
check(T.qq('.rating-row').length === 3, `and shows its rating (${T.qq('.rating-row').length} rows)`);
// A code typed without 'class-' finds the class that has it.
editFake(d => d.players.push({ id: 'fake-3', secret: 'x', klass: 'class-ab12cd', name: 'Lia', avatar: '🐸', stars: 3, week: 3, visible: true }));
state.classCode = '';
save();
await T.go('#/games', 100);
await T.go('#/class', 500);
T.q('.rating-code').value = 'ab12cd';
await T.click(T.q('.rating-empty .btn.primary'), 100);
await until(() => state.classCode, 3000);
check(state.classCode === 'class-ab12cd' && !T.q('.modal-back .modal p'), `"ab12cd" becomes "class-ab12cd" (${state.classCode})`);
// A saved code that the server moved: the device takes the real class.
state.classCode = 'tset-class';
save();
await syncNow();
check(state.classCode === 'test-class', `a save moves a known typo to the real class (${state.classCode})`);
await T.go('#/games', 100);
await T.go('#/class', 500);
check(!!(await until(() => T.qq('.rating-row').length === 3)), 'back in the class, the rating shows');
clean('#/class at the end');

// A code changed while an older save is on its way: the older answer does not bring the old class back.
slow = 1000;
const before2 = syncNow();
await T.wait(100);
await setClass('other-class');
await before2;
slow = 0;
check(state.classCode === 'other-class', `a new code is kept when an older save answers late (${state.classCode})`);
await setClass('test-class');

// Joining from the gate and leaving before the server answered: no chat starts in the background.
state.classCode = '';
save();
await T.go('#/games', 100);
await T.go('#/class/chat', 500);
T.q('.rating-code').value = 'test-class';
slow = 1500;
T.q('.rating-empty .btn.primary').click();
await T.wait(300);
await T.go('#/', 100);
const callsGate = chatCalls();
await T.wait(6000);
slow = 0;
check(state.classCode === 'test-class' && chatCalls() === callsGate, `after leaving, the joined class does not poll its chat (${chatCalls() - callsGate} calls)`);

// Switched off by her parents: the gate says "Мой класс" is off, whichever tab.
state.rated = false;
save();
await T.go('#/class/chat', 500);
check(/«Мой класс» выключен/.test(T.q('.rating-empty')?.textContent || ''), `with participation off the gate says so (${T.q('.rating-empty')?.textContent})`);
state.rated = true;
save();

// A name with no letter in it is refused: the class server would not take it.
await T.go('#/me', 500);
const nameField = T.q('.hello-name');
nameField.value = '🌸🌸';
await T.click(T.q('.hello-go'), 200);
check(/хотя бы одна буква/.test(toastText()) && state.name === 'Test', `an emoji-only name is refused (${toastText()}, ${state.name})`);

// 15. Every class call signs with her player and never names a class.
const signed = ['klyaksa_post_add', 'klyaksa_posts', 'klyaksa_post_image', 'klyaksa_like', 'klyaksa_post_delete', 'klyaksa_chat_send', 'klyaksa_chat', 'klyaksa_chat_delete', 'klyaksa_report', 'klyaksa_news'];
const called = new Set(rpcs.map(r => r.name));
check(signed.every(n => called.has(n)) && called.has('klyaksa_class_check'), `every class call was used (missing: ${signed.filter(n => !called.has(n)).join(' ')})`);
check(rpcs.filter(r => signed.includes(r.name)).every(r => r.body.p_id && r.body.p_secret && !('p_class' in r.body)), 'class calls carry her id and secret and no class');
window.fetch = realFetch;
return { problems };
