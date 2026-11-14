// First launch on a new device (language, name, avatar) and the profile screen.
import { h } from './util.js';
import { state, save } from './store.js';
import { t, lang, LANGS } from './i18n.js';
import { AVATARS, ensurePlayer, syncNow } from './player.js';
import { mascot, btn, topbar, toast, speaker } from './ui.js';
import { sfx } from './audio.js';

// A new language needs its dictionary and page direction, so the app starts again.
export function setLang(code, hash = location.hash) {
  if (!LANGS[code]) return;
  state.lang = code;
  save();
  if (code === lang) return;
  history.replaceState(null, '', hash || '#/');
  location.reload();
}

function langPicker(onPick) {
  return h('div', { class: 'hello-langs' }, Object.entries(LANGS).map(([code, L]) =>
    h('button', {
      class: `hello-lang ${code === lang ? 'on' : ''}`,
      lang: code,
      dir: L.dir,
      onclick: () => { sfx.pop(); onPick(code); },
    }, h('b', {}, L.name), h('small', {}, L.app))));
}

function profileForm({ submit, onDone }) {
  let avatar = state.avatar || AVATARS[0];
  const name = h('input', {
    class: 'field hello-name', value: state.name || '', maxlength: 24, autocomplete: 'off',
    'aria-label': t('Имя'), placeholder: t('Твоё имя'),
  });
  const faces = h('div', { class: 'hello-avatars' }, AVATARS.map(a => h('button', {
    class: `hello-avatar ${a === avatar ? 'on' : ''}`,
    'aria-label': a,
    onclick: e => {
      sfx.pop();
      avatar = a;
      faces.querySelectorAll('.hello-avatar').forEach(x => x.classList.toggle('on', x === e.currentTarget));
    },
  }, a)));
  const go = btn('primary hello-go', submit, () => {
    const clean = name.value.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!clean) {
      sfx.soft();
      toast(t('Напиши, как тебя зовут'));
      name.focus();
      return;
    }
    state.name = clean;
    state.avatar = avatar;
    state.onboarded = true;
    save();
    ensurePlayer();
    syncNow();
    onDone();
  });
  return h('div', { class: 'hello-form' },
    h('label', { class: 'hello-label' }, t('Как тебя зовут?')), name,
    h('label', { class: 'hello-label' }, t('Выбери свой значок')), faces,
    go,
  );
}

export function hello(root, step) {
  if (step !== '2') {
    root.append(h('div', { class: 'screen scroll hello' },
      h('div', { class: 'hello-card' },
        mascot('joy'),
        h('h1', {}, t('Привет! Я Блобика.')),
        h('p', {}, t('На каком языке будем играть?')),
        langPicker(code => {
          if (code === lang) { location.hash = '#/hello/2'; return; }
          setLang(code, '#/hello/2');
        }),
      ),
    ));
    return;
  }
  root.append(h('div', { class: 'screen scroll hello' },
    h('div', { class: 'hello-card' },
      mascot('happy'),
      h('h1', {}, t('Давай знакомиться!')),
      profileForm({ submit: t('Поехали!'), onDone: () => { location.hash = '#/'; } }),
      h('p', { class: 'hello-note' }, t('Твоё имя, значок и звёзды увидят одноклассницы в рейтинге.')),
      h('button', { class: 'hello-back', onclick: () => { location.hash = '#/hello'; } }, t('Сменить язык')),
    ),
  ));
}

// Her own page: name, avatar and language.
export function me(root) {
  root.append(h('div', { class: 'screen scroll hello' },
    topbar(t('Мой профиль')),
    h('div', { class: 'hello-card' },
      speaker(t('Здесь можно поменять имя, значок и язык.')),
      // The router clears toasts when the screen changes, so the toast waits for the new screen.
      profileForm({ submit: t('Сохранить'), onDone: () => {
        addEventListener('hashchange', () => toast(t('Готово!')), { once: true });
        location.hash = '#/';
      } }),
      h('h2', { class: 'hello-sub' }, t('Язык')),
      langPicker(code => setLang(code, '#/me')),
    ),
  ));
}
