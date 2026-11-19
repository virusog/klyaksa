// The parents' admin page (admin/) on the real server, run inside the page by
// tools/test/admin.test.mjs through tools/drive.mjs --net. The page was opened
// as /admin/#key=<a temporary key>; __VARS__ is filled in with the throwaway class,
// its players (id and secret, to see what the children see) and their things.
// Every change made here is checked through the server and put back.
const V = __VARS__;
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(`${innerWidth}px: ${msg}`); return ok; };
const out = { sections: {} };
window.confirm = () => true;
window.prompt = () => null;

const { RATING_URL, RATING_KEY } = await import(location.origin + '/js/net-config.js');
const rpc = async (name, body) => {
  const r = await fetch(`${RATING_URL}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  let body2 = null;
  try { body2 = await r.json(); } catch { /* empty */ }
  return { status: r.status, body: body2 };
};
// The key from the address is kept for this tab only, not on the device.
const KEY = sessionStorage.getItem('blobika.admin.key');
const KEPT_ON_DEVICE = localStorage.getItem('blobika.admin.key');
const adm = (action, args = {}) => rpc('klyaksa_admin', { p_key: KEY, p_action: action, p_args: args });
const as = (who, name, body = {}) => rpc(name, { p_id: V.p[who].p_id, p_secret: V.p[who].p_secret, ...body });
const until = async (fn, ms = 10000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await T.wait(100); }
  return null;
};
// The section is drawn: no "Загрузка…" left and the view is in place.
const ready = () => until(() => T.q('main .view') && !T.q('main .loading') && T.q('main h1'));
// A screenshot for a person to look at (only with ADMIN_SHOTS): no toasts, scrolled to what matters.
const shot = async (name, sel) => {
  if (!V.shots) return;
  T.qq('.toast').forEach(t => t.remove());
  if (sel && T.q(sel)) T.q(sel).scrollIntoView({ block: 'start' }); else scrollTo(0, 0);
  await T.wait(150);
  await T.shot(`${V.shots}/${innerWidth}-${name}.png`);
};
// Anything wider than the screen, or sticking out of it sideways.
const overflow = () => {
  const W = document.documentElement.clientWidth;
  const bad = T.qq('body *').filter(e => {
    if (e.closest('.scroll-x') && e.closest('details:not([open])')) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.right > W + 1 || r.left < -1);
  }).slice(0, 6).map(e => `${e.tagName.toLowerCase()}.${String(e.className?.baseVal ?? e.className).trim().replace(/\s+/g, '.')}`);
  if (document.documentElement.scrollWidth > W + 1) bad.unshift(`page ${document.documentElement.scrollWidth} > ${W}`);
  return bad;
};
const look = async (hash, name, wait = 0) => {
  if (location.hash !== hash) location.hash = hash;
  await T.wait(50);
  check(!!(await ready()), `${name}: drawn`);
  if (wait) await T.wait(wait);
  const bad = overflow();
  check(bad.length === 0, `${name}: nothing sticks out sideways (${bad.join(', ')})`);
  check(!T.q('main .failed'), `${name}: no error card (${T.q('main .failed')?.textContent})`);
  out.sections[name] = true;
};
const toastsBad = () => T.qq('.toast.bad').map(t => t.textContent);
const btnIn = (root, text) => root && [...root.querySelectorAll('button')].find(b => b.textContent.trim() === text);
const rowOf = name => T.qq('.player').find(p => p.querySelector('.player-name bdi')?.textContent === name);
const msgEl = id => T.q(`.msg[data-id="${id}"]`);

try {
  // The key came in the address and left it at once.
  check(location.hash === '#/overview' && !location.href.includes(KEY || '-') && KEY?.length > 20, `the key is stored and taken out of the address (${location.hash})`);
  check(!KEPT_ON_DEVICE, 'the key from the address is kept for this tab only, not in localStorage');
  check(/до закрытия вкладки/.test(T.q('.key-state')?.textContent || ''), `the top bar says the key lasts until the tab closes (${T.q('.key-state')?.textContent})`);
  // "Remember on this device" moves it to localStorage, and back.
  T.q('.key-state').click();
  check(localStorage.getItem('blobika.admin.key') === KEY && !sessionStorage.getItem('blobika.admin.key')
    && /запомнен/.test(T.q('.key-state')?.textContent || ''), 'the key can be remembered on this device');
  T.q('.key-state').click();
  check(sessionStorage.getItem('blobika.admin.key') === KEY && !localStorage.getItem('blobika.admin.key'), 'and kept for the tab only again');

  // ---------- Обзор ----------
  await look('#/overview', 'overview', 400);
  check(T.qq('.tiles .tile').length === 8, `overview: 8 numbers (${T.qq('.tiles .tile').length})`);
  check(T.qq('.charts svg').length === 4, `overview: three charts and the day axis (${T.qq('.charts svg').length})`);
  check(/больше всего за день/.test(T.q('.chart-readout')?.textContent || '') && /за 14 дней/.test(T.qq('.chart-readout')[1]?.textContent || ''),
    `overview: players by their busiest day, messages as a sum (${T.qq('.chart-readout').map(x => x.textContent).join(' | ')})`);
  check(T.qq('.tile-label').some(x => x.textContent === 'Играли за 7 дней') && !T.qq('.tile-label').some(x => /недел/.test(x.textContent)),
    `overview: the numbers say "за 7 дней" (${T.qq('.tile-label').map(x => x.textContent).join(' | ')})`);
  const players = Number(T.q('.tile .tile-value')?.textContent.replace(/\D/g, ''));
  check(players >= 3, `overview: the players are counted (${players})`);
  check(T.qq('.mini-list li').length >= 1, 'overview: the latest reports are listed');
  check(T.qq('.nav-badge').some(b => !b.hidden && Number(b.textContent) >= 2), 'the menu shows the open reports');
  await shot('overview');

  // ---------- Классы ----------
  await look('#/classes', 'classes');
  const classLink = T.qq('a.class-row').find(a => a.getAttribute('href') === `#/class/${V.cls}/players`);
  check(!!classLink, 'classes: the test class is listed');
  check(classLink?.textContent.includes('👧 3'), `classes: with its 3 players (${classLink?.textContent})`);
  check(T.qq('.all-classes .switch').length === 3, 'classes: the three switches for all classes');

  // ---------- Класс: игроки ----------
  await look(`#/class/${V.cls}/players`, 'class players');
  await until(() => T.qq('.player').length);
  check(T.qq('.player').length === 3, `class: 3 players (${T.qq('.player').length})`);
  check(T.q('.invite-link')?.textContent === `https://blobika.com/?class=${V.cls}`, 'class: the invitation link');
  const he = rowOf('נועה');
  check(he?.querySelector('.player-name bdi')?.getAttribute('dir') === 'auto', 'a Hebrew name keeps its own direction');
  check(overflow().length === 0, `class players: nothing sticks out (${overflow().join(', ')})`);
  // Deleting a class says it stays closed to newcomers (answered "no" here).
  let said = '';
  window.confirm = t => { said = String(t); return false; };
  T.q('.class-more')?.setAttribute('open', '');
  await T.click(btnIn(T.q('.danger-zone'), 'Удалить класс'));
  check(/закрытым для новых/.test(said) && !/навсегда/.test(said), `delete class: the warning says it stays closed to newcomers (${said})`);
  window.confirm = () => true;
  await shot('class-head');
  await shot('class-players', '.subtabs');

  // Block Бэлла: the children no longer see her, and she cannot use the chat.
  await T.click(btnIn(rowOf('Бэлла'), 'Заблокировать'));
  check(!!(await until(() => rowOf('Бэлла')?.classList.contains('blocked'))), 'block: the row shows her blocked');
  let r = await adm('players', { class: V.cls });
  check(r.body?.find?.(p => p.id === V.p.bella.p_id)?.visible === false, 'block: the server has her blocked');
  r = await as('bella', 'klyaksa_chat');
  check(r.body?.code === '42501', `block: she cannot open the chat (${r.status} ${r.body?.code})`);
  r = await rpc('klyaksa_board', { p_class: V.cls, p_limit: 50 });
  check(Array.isArray(r.body) && !r.body.some(x => x.name === 'Бэлла'), 'block: she is off the class rating');
  await T.click(btnIn(rowOf('Бэлла'), 'Разблокировать'));
  check(!!(await until(() => rowOf('Бэлла') && !rowOf('Бэлла').classList.contains('blocked'))), 'unblock: the row shows her back');
  r = await as('bella', 'klyaksa_chat');
  check(r.status === 200, `unblock: she can open the chat again (${r.status})`);

  if (V.last) {
    const bella = async () => (await adm('players', { q: '' })).body?.find?.(x => x.id === V.p.bella.p_id);
    const lastToast = () => T.qq('.toast').pop()?.textContent || '';
    // Rename Бэлла, then let her own name come back (only when her game saves next).
    window.prompt = () => 'Тест Имя';
    await T.click(btnIn(rowOf('Бэлла'), 'Переименовать'));
    check(!!(await until(() => rowOf('Тест Имя')?.querySelector('.chip.set'))), 'rename: the row shows the new name, marked as given by a grown-up');
    check((await bella())?.forced_name === 'Тест Имя', 'rename: the server has it');
    window.prompt = () => '';
    await T.click(btnIn(rowOf('Тест Имя'), 'Переименовать'));
    check(!!(await until(() => rowOf('Тест Имя') && !rowOf('Тест Имя').querySelector('.chip.set'))), 'rename back: the mark is gone');
    check(/вернётся, когда она в следующий раз откроет игру/.test(lastToast()), `rename back: says her name comes back when she next opens the game (${lastToast()})`);
    check((await bella())?.forced_name === null, 'rename back: the server let it go');
    await as('bella', 'klyaksa_save', { p_class: V.cls, p_name: 'Бэлла', p_avatar: '🦊', p_lang: 'ru', p_stars: 7, p_visible: true });
    await T.click(T.q('.top-tools button[aria-label="Обновить"]'));
    check(!!(await until(() => rowOf('Бэлла'))), 'her next save brings her own name back');
    // Move her to a class that does not exist yet: the page asks first. Then back, then unpin.
    let asked = '';
    window.confirm = t => { asked = String(t); return true; };
    window.prompt = () => V.cls2;
    await T.click(btnIn(rowOf('Бэлла'), 'Перевести в класс'));
    check(!!(await until(() => !rowOf('Бэлла'))), 'move: she leaves the list of this class');
    check(/Класса .* пока нет/.test(asked), `move: a class nobody is in is named as new before moving (${asked})`);
    let b = await bella();
    check(b?.class === V.cls2 && b?.forced_class === V.cls2, `move: the server has her in the other class (${JSON.stringify(b && [b.class, b.forced_class])})`);
    await look(`#/class/${V.cls2}/players`, 'class she was moved to');
    await until(() => rowOf('Бэлла'));
    window.prompt = () => V.cls;
    await T.click(btnIn(rowOf('Бэлла'), 'Перевести в класс'));
    check(!!(await until(() => !rowOf('Бэлла'))), 'move back: she leaves that class');
    check(/\(2 игрока\)/.test(asked), `move back: a known class is named with its players (${asked})`);
    await look(`#/class/${V.cls}/players`, 'class players again');
    await until(() => rowOf('Бэлла'));
    window.prompt = () => '';
    await T.click(btnIn(rowOf('Бэлла'), 'Перевести в класс'));
    check(!!(await until(() => rowOf('Бэлла') && !rowOf('Бэлла').querySelector('.chip.set'))), 'unpin: the mark is gone');
    b = await bella();
    check(b?.class === V.cls && b?.forced_class === null, `unpin: she is back in her class, not pinned (${JSON.stringify(b && [b.class, b.forced_class])})`);
    window.confirm = () => true;
    window.prompt = () => null;
  }

  // ---------- Класс: чат ----------
  await look(`#/class/${V.cls}/chat`, 'class chat');
  await until(() => msgEl(V.msgB));
  check(T.qq('.msg').length >= 4, `chat: every message, hidden ones too (${T.qq('.msg').length})`);
  check(msgEl(V.msgA)?.classList.contains('is-hidden') && msgEl(V.msgA)?.querySelector('.badge'), 'chat: the reported message is greyed with its report count');
  check(/прошла урок «Кот»/.test(msgEl(V.msgR)?.textContent || ''), `chat: a result is readable (${msgEl(V.msgR)?.textContent})`);
  const noticeEl = T.qq('.msg').find(m => /показала рисунок/.test(m.textContent) && m.dataset.id === String(V.noticeA));
  check(!!noticeEl, 'chat: a drawing notice is readable');
  check(btnIn(noticeEl, 'Скрыть рисунок') && btnIn(noticeEl, 'Удалить рисунок') && !btnIn(noticeEl, 'Скрыть'), 'chat: a notice acts on its drawing');
  check(overflow().length === 0, `class chat: nothing sticks out (${overflow().join(', ')})`);
  await shot('class-chat', '.subtabs');
  await T.click(btnIn(msgEl(V.msgB), 'Скрыть'));
  check(!!(await until(() => msgEl(V.msgB)?.classList.contains('is-hidden'))), 'hide: the message is greyed');
  r = await as('ann', 'klyaksa_chat');
  check(Array.isArray(r.body) && !r.body.some(m => m.id === V.msgB), 'hide: the class does not see it');
  await T.click(btnIn(msgEl(V.msgB), 'Показать'));
  check(!!(await until(() => msgEl(V.msgB) && !msgEl(V.msgB).classList.contains('is-hidden'))), 'show: the message is back');
  r = await as('ann', 'klyaksa_chat');
  check(Array.isArray(r.body) && r.body.some(m => m.id === V.msgB), 'show: the class sees it again');

  // A switch: the chat of this class off, then on again.
  const chatSwitch = () => T.qq('.class-head ~ .card .switch').find(s => s.querySelector('.switch-label')?.textContent === 'Чат');
  await T.click(chatSwitch());
  check(!!(await until(() => chatSwitch()?.getAttribute('aria-checked') === 'false')), 'switch: the chat shows off');
  r = await as('ann', 'klyaksa_chat_send', { p_kind: 'text', p_body: 'А можно?' });
  check(r.body?.code === '55000', `switch: with the chat off she cannot write (${r.status} ${r.body?.code})`);
  r = await as('ann', 'klyaksa_news');
  check(r.body?.chat === false, `switch: her app is told the chat is off (${JSON.stringify(r.body)})`);
  await T.click(chatSwitch());
  check(!!(await until(() => chatSwitch()?.getAttribute('aria-checked') === 'true')), 'switch: the chat shows on again');
  r = await as('ann', 'klyaksa_news');
  check(r.body?.chat === true, 'switch: her app is told the chat is on');
  check(location.hash === `#/class/${V.cls}/chat`, `the class view stays on its tab after a switch (${location.hash})`);

  // ---------- Класс: рисунки ----------
  await look(`#/class/${V.cls}/art`, 'class drawings');
  await until(() => T.qq('.art img').length);
  check(T.qq('.art').length === 2 && T.qq('.art img').length === 2, `drawings: both with pictures (${T.qq('.art').length})`);
  await T.click(T.q('.art .art-img'));
  check(!!(await until(() => T.q('.modal .big-img')?.src?.startsWith('data:image/jpeg'))), 'drawings: the full picture opens');
  check(overflow().length === 0, `drawing modal: nothing sticks out (${overflow().join(', ')})`);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await T.wait(100);
  check(!T.q('.modal'), 'drawings: Escape closes the picture');
  await shot('class-drawings', '.subtabs');

  // ---------- Жалобы ----------
  await look('#/reports', 'reports');
  const card = () => T.qq('.report').find(c => c.querySelector('a.class-code')?.textContent === V.cls && /Привет всем/.test(c.textContent));
  check(!!card(), 'reports: the reported message is in the queue');
  check(T.qq('.report').some(c => c.querySelector('a.class-code')?.textContent === V.cls && c.querySelector('.report-thumb img')), 'reports: the reported drawing has its picture');
  await shot('reports');
  if (V.last) {
    // Keep it hidden and close the reports: one step on the server.
    await T.click(btnIn(card(), 'Оставить скрытым'));
    check(!!(await until(() => !card(), 8000)), 'reports: "keep hidden" takes it off the queue');
    r = await adm('reports');
    check(Array.isArray(r.body) && !r.body.some(x => x.kind === 'msg' && x.target === V.msgA), 'reports: the server has no reports on it any more');
    r = await adm('chat', { class: V.cls });
    check(r.body?.find?.(m => m.id === V.msgA)?.hidden === true, 'reports: and it stays hidden');
    // A report from the chat on a drawing's notice: hiding it hides the drawing itself.
    const noticeCard = () => T.qq('.report').find(c => c.querySelector('a.class-code')?.textContent === V.cls && /Рисунок в чате/.test(c.textContent));
    check(!!noticeCard() && !!noticeCard().querySelector('button.link'), 'reports: a notice of a drawing is shown as the drawing, with a way to open it');
    await T.click(btnIn(noticeCard(), 'Скрыть'));
    check(!!(await until(() => !noticeCard(), 8000)), 'reports: hiding it takes it off the queue');
    r = await adm('posts', { class: V.cls });
    check(r.body?.find?.(d => d.id === V.postA)?.hidden === true, 'reports: and the drawing itself is hidden, not only its notice');
    await adm('post_set', { id: V.postA, hidden: false });
    // A message its author deleted: nothing to show again, only the report to close.
    const goneCard = () => T.qq('.report').find(c => c.querySelector('a.class-code')?.textContent === V.cls && /стёрто автором/.test(c.textContent));
    check(!!goneCard() && !btnIn(goneCard(), 'Скрыть') && !btnIn(goneCard(), 'Оставить скрытым') && !btnIn(goneCard(), 'Вернуть (жалоба зря)')
      && !!btnIn(goneCard(), 'Закрыть жалобу'), `reports: a deleted message offers only to close the report (${goneCard()?.textContent})`);
    await T.click(btnIn(goneCard(), 'Закрыть жалобу'));
    check(!!(await until(() => !goneCard(), 8000)), 'reports: closing it takes it off the queue');
    r = await adm('reports');
    check(Array.isArray(r.body) && !r.body.some(x => x.kind === 'msg' && x.target === V.msgD), 'reports: the server closed it');
  }

  // ---------- Защита ----------
  await look('#/protect', 'protection');
  check(T.qq('.word').length > 50, `protection: the bad words (${T.qq('.word').length})`);
  check(T.qq('.switch').length === 3, 'protection: the switches for all classes');
  await shot('protection');

  // ---------- Журнал ----------
  await look('#/log', 'log');
  const lines = T.qq('.log li').map(li => li.textContent);
  check(lines.some(l => l.includes('Бэлла') && l.includes('заблокирована')), `log: the block, with her name (${lines.slice(0, 3).join(' | ')})`);
  check(lines.some(l => l.includes(`Класс ${V.cls}`) && l.includes('чат выкл.')), 'log: the switch');
  await shot('log');

  check(toastsBad().length === 0, `no error toasts (${toastsBad().join(' | ')})`);
} catch (e) {
  problems.push(`${innerWidth}px: ${e && e.stack || e}`);
}
return { problems, out };
