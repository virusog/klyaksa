// "My class": the class rating, the class drawings and the class chat, in three tabs.
// One gate stands in front of all three: without a class code she is asked for it,
// and with the rating switched off by her parents nothing of the class is shown.
import { h } from './util.js';
import { state, save } from './store.js';
import { t } from './i18n.js';
import { checkClass, cleanClass, setClass } from './player.js';
import { topbar, btn, iconBtn, starBadge, mascot, toast, confirmBox } from './ui.js';
import { ratingTab } from './rating.js';
import { artTab } from './classart.js';
import { chatTab } from './chat.js';

const TABS = [
  { id: '', icon: '🏆', label: () => t('Рейтинг'), make: ratingTab },
  { id: 'art', icon: '🖼', label: () => t('Рисунки'), make: artTab },
  { id: 'chat', icon: '💬', label: () => t('Чат'), make: chatTab },
];

// A typed code is checked with the server first: a girl once typed "clrss-4" for
// "class-4ezgt7" and sat alone in a class of her own. Returns the code to use, or
// null when she would rather fix it. With no internet the code is taken as typed.
export async function resolveClass(code) {
  let info;
  try { info = await checkClass(code); } catch { return code; }
  const real = cleanClass(info?.class) || code;
  if (+info?.players === 0) {
    // The code is isolated left to right, so its dashes stay in place in Hebrew.
    // Nearly always a typo, so fixing it is the big button.
    const fix = await confirmBox(t('В классе «{code}» пока никого нет. Проверь код в приглашении.', { code: `⁦${real}⁩` }),
      t('Исправить'), t('Всё равно войти'));
    if (fix) return null;
  }
  return real;
}

function codeEntry(onJoined) {
  const field = h('input', { class: 'field rating-code', dir: 'ltr', autocapitalize: 'off', spellcheck: 'false', placeholder: 'class-…', 'aria-label': t('Код класса') });
  return h('div', { class: 'rating-empty' }, mascot('wow'),
    h('p', {}, t('В «Моём классе» — рейтинг, рисунки и чат твоего класса. Открой ссылку-приглашение от учительницы или родителей.')),
    h('small', {}, t('Или введи код класса:')),
    h('div', { class: 'row' }, field, btn('primary', t('Войти в класс'), async () => {
      const c = cleanClass(field.value);
      if (!c) { toast(t('Код — это от 4 до 24 латинских букв, цифр или чёрточек.')); return; }
      const real = await resolveClass(c);
      if (!real) { field.focus(); return; }
      if (!state.rated) { state.rated = true; save(); }
      await setClass(real);
      onJoined();
    })));
}

// Route #/class (rating), #/class/art, #/class/art/<post id>, #/class/chat; #/rating too.
export function classHub(root, tabId = '', arg) {
  if (tabId === 'chat' && state.chat === false) tabId = '';
  const tab = TABS.find(x => x.id === tabId) || TABS[0];
  const shown = TABS.filter(x => x.id !== 'chat' || state.chat !== false);
  const main = h('div', { class: 'class-main' });
  const nav = h('nav', { class: 'tabs class-tabs' }, shown.map(x => h('a', {
    class: `tab class-tab ${x === tab ? 'on' : ''}`, href: x.id ? `#/class/${x.id}` : '#/class',
  }, h('span', { class: 'class-tab-ico', 'aria-hidden': 'true' }, x.icon), h('span', {}, x.label()))));
  let current = null;
  // Joining from the code entry can end after she has left this screen: nothing starts then.
  let alive = true;

  function open() {
    if (!alive) return;
    current?.stop?.();
    current = null;
    main.textContent = '';
    const gated = !state.classCode || !state.rated;
    nav.classList.toggle('hidden', gated);
    if (!state.classCode) {
      main.append(h('div', { class: 'class-scroll' }, codeEntry(open)));
      return;
    }
    if (!state.rated) {
      main.append(h('div', { class: 'class-scroll' }, h('div', { class: 'rating-empty' }, mascot('wow'),
        h('p', {}, t('Сейчас «Мой класс» выключен.')),
        h('small', {}, t('Включить можно в разделе «Для родителей».')))));
      return;
    }
    current = tab.make(main, arg);
  }

  root.append(h('div', { class: `screen hub class class-${tab.id || 'rating'}` },
    topbar(t('Мой класс'), { right: [iconBtn('refresh', t('Обновить'), () => (current ? current.reload() : open())), starBadge()] }),
    nav,
    main,
  ));
  open();
  return () => { alive = false; current?.stop?.(); };
}
