// Visits every screen and every level in one language and screen size, and checks:
// no page errors, nothing sticking out sideways, and in English and Hebrew no
// Russian left on screen. Run through tools/test/run.mjs, which fills in __LANG__.
// The result lists every problem with the address where it was seen.
const LANG = '__LANG__';
const DEEP = __DEEP__;
const problems = [];
const seen = { routes: 0, levels: 0 };
const CYR = /[А-Яа-яЁё]+/g;
// Names of languages are written in their own language on purpose.
const ALLOWED = new Set(['Русский', 'Клякса']);

function visibleText() {
  const skip = new Set(T.qq('.rating-name, .me-name'));
  const parts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || [...skip].some(s => s.contains(el))) continue;
    if (el.closest('script, style, svg text')) continue;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || el.closest('.hidden')) continue;
    if (!el.getClientRects().length) continue;
    parts.push(n.nodeValue);
  }
  for (const el of T.qq('[aria-label], [title], [placeholder]')) {
    if (!el.getClientRects().length) continue;
    for (const a of ['aria-label', 'title', 'placeholder']) if (el.getAttribute(a)) parts.push(el.getAttribute(a));
  }
  return parts.join(' ');
}

function inspect(where) {
  seen.routes++;
  const over = T.overflow();
  if (over.length) problems.push(`${where}: sticks out sideways: ${over.slice(0, 3).join(', ')}`);
  if (LANG !== 'ru') {
    const words = [...visibleText().matchAll(CYR)].map(m => m[0]).filter(w => !ALLOWED.has(w));
    if (words.length) problems.push(`${where}: Russian on screen: ${[...new Set(words)].slice(0, 8).join(' ')}`);
  }
  if (LANG === 'he' && document.documentElement.dir !== 'rtl') problems.push(`${where}: the page is not right-to-left`);
  if (T.errors.length) {
    problems.push(`${where}: page errors: ${T.errors.slice(0, 3).join(' | ')}`);
    T.errors.length = 0;
  }
}

async function visit(hash, ms = 700) {
  await T.go(hash, ms);
  // Some screens draw after a short delay.
  await T.wait(150);
  inspect(hash);
}

const ROUTES = ['#/', '#/studio/new', '#/school', '#/coloring/pages', '#/coloring/num', '#/coloring/math', '#/coloring/mandala',
  '#/coloring/photo', '#/world/sea', '#/world/sky', '#/world/land', '#/creature/sea', '#/creature/sky', '#/creature/land',
  '#/games', '#/gallery', '#/prizes', '#/me', '#/rating', '#/hello', '#/hello/2', '#/parents',
  '#/game/squiggle', '#/game/dice', '#/game/half', '#/game/lab', '#/game/pixels', '#/game/pixels/free', '#/game/guess',
  '#/color/whale/free', '#/color/whale/num', '#/color/whale/math', '#/color/mandala3/free',
  '#/lesson/cat', '#/lesson/cat/trace', '#/lesson/cat/copy', '#/lesson/fox/memory'];
for (const r of ROUTES) await visit(r, r.startsWith('#/color/') ? 1500 : r === '#/rating' ? 2500 : 700);

// Popovers and dialogs of the studio and the parents screen.
await T.go('#/studio/new', 700);
for (const btn of T.qq('.topbar .btn.icon').slice(2)) {
  btn.click();
  await T.wait(200);
  if (T.q('.pop')) inspect(`#/studio/new popover ${btn.getAttribute('aria-label')}`);
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  T.q('.pop')?.remove();
}
await T.go('#/parents', 500);
const gate = T.q('.gate h2')?.textContent.match(/(\d+)\D+(\d+)/);
if (gate) {
  T.q('.gate-input').value = String(gate[1] * gate[2]);
  T.q('.gate .btn').click();
  await T.wait(300);
  inspect('#/parents (open)');
} else problems.push('#/parents: the times-table question was not found');

// Every newer game: the level list and every level's first screen.
for (const game of ['pairs', 'puzzle', 'diff', 'dots', 'dictation', 'oneline', 'shades', 'patterns', 'anim']) {
  await visit(`#/game/${game}`, 1200);
  const hrefs = T.qq('.level-card').map(c => c.getAttribute('href')).filter(Boolean);
  if (!hrefs.length) problems.push(`#/game/${game}: no levels listed`);
  const pick = DEEP ? hrefs : [hrefs[0], hrefs[Math.floor(hrefs.length / 2)], hrefs[hrefs.length - 1]].filter(Boolean);
  for (const h of pick) { await visit(h, game === 'diff' ? 2500 : game === 'puzzle' ? 1500 : 900); seen.levels++; }
}

// Every lesson and every coloring page, in the deep run.
const { ALL_LESSONS } = await import(location.origin + '/js/lessons.js');
const { PAGES } = await import(location.origin + '/js/pages.js');
const { PIX } = await import(location.origin + '/js/pix.js');
const lessons = DEEP ? ALL_LESSONS : ALL_LESSONS.filter((_, i) => i % 15 === 0);
for (const L of lessons) {
  await visit(`#/lesson/${L.id}`, 300);
  await T.go(`#/lesson/${L.id}/trace`, 400);
  // Walks through the steps, so every step text is seen.
  for (let i = 0; i < L.steps.length; i++) {
    inspect(`#/lesson/${L.id}/trace step ${i + 1}`);
    const next = T.q('.lesson-foot .btn.primary');
    if (!next) break;
    next.click();
    await T.wait(120);
    next.click();
    await T.wait(160);
  }
  seen.levels++;
}
if (DEEP) {
  for (const p of PAGES) { await visit(`#/color/${p.id}/num`, 1300); seen.levels++; }
  for (const p of PIX) { await visit(`#/game/pixels/${p.id}`, 200); seen.levels++; }
}
return { lang: LANG, size: `${innerWidth}x${innerHeight}`, seen, problems: problems.slice(0, 200), problemCount: problems.length };
