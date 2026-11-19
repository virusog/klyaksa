// The class chat: one per class, for the girls of that class only. The server
// cleans every message (links, phone numbers and rude words become ***), keeps
// the pace slow, and hides what two classmates reported. Parents can turn it off.
import { h } from './util.js';
import { state, save } from './store.js';
import { t, N, lang, LANGS } from './i18n.js';
import { syncNow, sendChat, loadChat, deleteChat, report, netError, switches, onSwitches } from './player.js';
import { btn, mascot, toast, confirmBox, popover, closePop } from './ui.js';
import { sfx } from './audio.js';
import { postTitle, untitled } from './classart.js';

const POLL_MS = 4000;
// Every this many polls the whole chat is asked again, so a message its author
// deleted or two classmates reported disappears from screens that are open too.
const RESYNC_EVERY = 8;
// One code point each: the server drops the variation selector U+FE0F, so '❤️' would arrive as a plain '❤'.
const EMOJI = ['😀', '😂', '😍', '🥰', '😎', '🤩', '😮', '😢', '👍', '👏', '🎉', '💖', '⭐', '🌈', '🦄', '🎨'];
// What a shared result says; "what" is the Russian name of a lesson, game or picture.
const RESULTS = {
  lesson: N('{name} прошла урок «{what}»'),
  game: N('{name} сыграла в «{what}»'),
  coloring: N('{name} раскрасила «{what}»'),
  draw: N('{name} нарисовала «{what}»'),
};
const locale = LANGS[lang].speech;

// A translated sentence with real elements in its {holes}, so a name stays a
// separate, isolated piece (her name is hers, not part of the translation).
function fill(text, parts) {
  return text.split(/(\{\w+\})/).filter(Boolean).map(s => {
    const k = s.match(/^\{(\w+)\}$/)?.[1];
    return k && k in parts ? parts[k] : s;
  });
}

const parse = s => { try { return JSON.parse(s) || {}; } catch { return {}; } };
const dayOf = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function dayLabel(d) {
  const now = new Date();
  if (dayOf(d) === dayOf(now)) return t('Сегодня');
  if (dayOf(d) === dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return t('Вчера');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
}

export function sendError(e) {
  const why = netError(e);
  if (why === 'offline') return t('Нет связи. Сообщение не отправлено.');
  if (why === 'limit') return t('Не так быстро! Подожди немного.');
  if (why === 'bad') return t('Так написать нельзя. Попробуй по-другому.');
  if (why === 'off') return t('Чат сейчас выключен взрослыми.');
  return t('Не получилось. Попробуй ещё раз.');
}

export function chatTab(host) {
  let msgs = [];
  let after = 0;
  let loaded = false;
  let failed = false;
  let alive = true;
  let polling = false;
  let sending = false;
  let gen = 0;
  const list = h('div', { class: 'chat-list', role: 'log' });
  const input = h('input', {
    class: 'field chat-input', maxlength: 200, enterkeyhint: 'send', dir: 'auto', autocomplete: 'off', autocapitalize: 'sentences',
    placeholder: t('Напиши сообщение…'), 'aria-label': t('Сообщение'),
  });
  const send = btn('primary chat-send', t('Отправить'), () => doSend());
  const smile = h('button', { class: 'btn icon chat-emoji', 'aria-label': t('Смайлики'), onclick: e => emojiPop(e.currentTarget) }, '😊');
  const kind = h('p', { class: 'chat-note' }, t('Пиши по-доброму. Ссылки и номера телефонов чат скрывает.'));
  const bar = h('div', { class: 'chat-bar' }, smile, input, send);
  // Switched off by the grown-ups on the server: she can still read, but not write.
  const off = h('p', { class: 'chat-off', role: 'status' }, t('Чат сейчас выключен взрослыми.'));
  const wrap = h('div', { class: 'chat' }, list, kind, bar, off);
  const applySwitch = () => {
    const on = switches.chat !== false;
    kind.classList.toggle('hidden', !on);
    bar.classList.toggle('hidden', !on);
    off.classList.toggle('hidden', on);
    if (!on) { closePop(); input.blur(); }
  };
  applySwitch();
  const offSwitch = onSwitches(applySwitch);

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); doSend(); }
  });
  // On iPad the keyboard comes up: the newest messages stay in sight above it.
  input.addEventListener('focus', () => setTimeout(() => { list.scrollTop = list.scrollHeight; }, 350));

  const nearEnd = () => list.scrollHeight - list.scrollTop - list.clientHeight < 90;

  function emojiPop(anchor) {
    const pop = popover(anchor, h('div', { class: 'emoji-grid' }, EMOJI.map(e => h('button', {
      class: 'emoji', 'aria-label': e,
      onclick: () => {
        sfx.pop();
        const v = input.value;
        if (v.length + e.length > 200) return;
        const a = input.selectionStart ?? v.length;
        const b = input.selectionEnd ?? v.length;
        input.value = v.slice(0, a) + e + v.slice(b);
        input.setSelectionRange?.(a + e.length, a + e.length);
      },
    }, e))));
    // The button sits at the bottom of the screen, so the emoji open above it.
    const r = anchor.getBoundingClientRect();
    pop.style.top = `${Math.max(10, r.top - pop.offsetHeight - 12)}px`;
  }

  function menu(anchor, m) {
    sfx.pop();
    const item = m.mine
      ? h('button', { class: 'pick', onclick: () => { closePop(); remove(m); } }, t('Удалить'))
      : h('button', { class: 'pick', onclick: () => { closePop(); complain(m); } }, t('Пожаловаться'));
    popover(anchor, h('div', { class: 'pop-list' }, item));
  }

  async function remove(m) {
    if (!(await confirmBox(t('Удалить это сообщение?'), t('Удалить'), t('Оставить')))) return;
    try { await deleteChat(m.id); } catch (e) { toast(sendError(e)); return; }
    msgs = msgs.filter(x => x.id !== m.id);
    render(false);
  }

  async function complain(m) {
    if (!(await confirmBox(t('Пожаловаться на это сообщение? Ты его больше не увидишь.'), t('Пожаловаться'), t('Отмена')))) return;
    try { await report('msg', m.id); } catch (e) { toast(sendError(e)); return; }
    msgs = msgs.filter(x => x.id !== m.id);
    render(false);
    toast(t('Ты это больше не увидишь. Если обижают, скажи маме или учительнице.'), 5000);
  }

  function content(m) {
    const name = h('bdi', { class: 'chat-name' }, m.name);
    if (m.kind === 'result') {
      const r = parse(m.body);
      // A free drawing has no name of its own: "Маша нарисовала «Мой рисунок»" would read as if it were yours.
      const text = r.t === 'draw' && untitled(r.what) ? t('{name} нарисовала новый рисунок') : t(RESULTS[r.t] || RESULTS.game);
      return h('p', { class: 'msg-result' }, '🏅 ', fill(text, { name, what: t(r.what) }),
        r.stars > 0 ? h('span', { class: 'msg-stars' }, ' ', '★'.repeat(Math.min(3, r.stars))) : null);
    }
    if (m.kind === 'post') {
      const r = parse(m.body);
      return h('button', { class: 'msg-post', onclick: () => { sfx.pop(); location.hash = `#/class/art/${r.post}`; } },
        h('span', {}, '🖼 ', untitled(r.what) ? fill(t('{name} показала новый рисунок'), { name })
          : fill(t('{name} показала рисунок «{what}»'), { name, what: postTitle(r.what) })),
        h('span', { class: 'msg-open' }, t('Посмотреть')));
    }
    return h('p', { class: 'msg-text', dir: 'auto' }, m.body);
  }

  function bubble(m) {
    const d = new Date(m.at);
    const card = m.kind !== 'text';
    return h('div', { class: `msg-row ${m.mine ? 'mine' : ''}`, 'data-id': m.id },
      h('span', { class: 'msg-avatar', 'aria-hidden': 'true' }, m.avatar),
      h('div', { class: `msg ${card ? 'card' : ''}` },
        !m.mine && !card ? h('div', { class: 'msg-head' }, h('bdi', { class: 'chat-name' }, m.name)) : null,
        content(m),
        h('time', { class: 'msg-time', datetime: m.at, dir: 'ltr' }, d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }))),
      h('button', { class: 'msg-more', 'aria-label': m.mine ? t('Удалить') : t('Пожаловаться'), onclick: e => menu(e.currentTarget, m) }, '⋯'));
  }

  // Draws the whole list again: messages are few, and order by id is then always right.
  function render(toEnd) {
    const stay = toEnd || nearEnd();
    const top = list.scrollTop;
    list.textContent = '';
    if (failed && !msgs.length) {
      list.append(h('div', { class: 'class-empty' }, mascot('wow'), h('p', {}, t('Чат не загрузился. Нужен интернет.')),
        btn('primary', t('Попробовать ещё раз'), load)));
      return;
    }
    if (!loaded) {
      list.append(h('div', { class: 'class-empty' }, mascot('happy'), h('p', {}, t('Загружаю чат…'))));
      return;
    }
    if (!msgs.length) {
      list.append(h('div', { class: 'class-empty' }, mascot('wow'), h('p', {}, t('Здесь пока тихо. Напиши первой!'))));
      return;
    }
    let day = '';
    for (const m of msgs) {
      const d = new Date(m.at);
      if (dayOf(d) !== day) {
        day = dayOf(d);
        list.append(h('div', { class: 'chat-day' }, h('span', {}, dayLabel(d))));
      }
      list.append(bubble(m));
    }
    list.scrollTop = stay ? list.scrollHeight : top;
    // Seen up to the newest message: the home tile stops saying "new".
    const last = msgs[msgs.length - 1].id;
    if (last > (state.seenMsg || 0)) { state.seenMsg = last; save(); }
  }

  // track: rows that came from the server's list move the polling mark on. Her own
  // sent message does not, or messages written just before it would be skipped.
  function merge(rows, toEnd, track = true) {
    const known = new Set(msgs.map(m => m.id));
    const fresh = (rows || []).filter(m => !known.has(+m.id)).map(m => ({ ...m, id: +m.id }));
    if (track) for (const m of rows || []) after = Math.max(after, +m.id);
    if (!fresh.length) return false;
    msgs = [...msgs, ...fresh].sort((a, b) => a.id - b.id).slice(-200);
    render(toEnd);
    return true;
  }

  async function load() {
    const my = ++gen;
    failed = false;
    loaded = false;
    msgs = [];
    after = 0;
    render(true);
    try {
      await syncNow();
      const rows = await loadChat(0);
      if (!alive || my !== gen) return;
      loaded = true;
      merge(rows, true) || render(true);
    } catch {
      if (!alive || my !== gen) return;
      failed = true;
      render(true);
    }
  }

  // The whole chat again: what the server no longer gives (deleted or hidden) goes away.
  // Older messages she scrolled through stay; the sound is only for something new.
  function resync(rows) {
    rows = (rows || []).map(m => ({ ...m, id: +m.id }));
    const top = Math.max(0, ...msgs.map(m => m.id));
    // Nothing at all means the chat is empty now; otherwise only the newest page came back.
    // What she sent while this was on its way stays too.
    const first = rows.length ? rows[0].id : 0;
    const last = rows.length ? rows[rows.length - 1].id : 0;
    const next = [...msgs.filter(m => m.id < first), ...rows, ...msgs.filter(m => m.id > last && m.mine)];
    const fresh = rows.some(m => m.id > top);
    for (const m of rows) after = Math.max(after, m.id);
    const same = next.length === msgs.length && next.every((m, i) => m.id === msgs[i].id);
    if (same) return false;
    msgs = next.slice(-200);
    render(false);
    return fresh;
  }

  // New messages every few seconds, only while the chat is open and in sight.
  let polls = 0;
  async function poll() {
    if (!alive || !loaded || polling || document.hidden) return;
    polling = true;
    try {
      const whole = ++polls % RESYNC_EVERY === 0;
      const rows = await loadChat(whole ? 0 : after);
      if (alive && (whole ? resync(rows) : merge(rows, false)) && !nearEnd()) sfx.soft();
    } catch { /* the next poll tries again */ }
    polling = false;
  }

  async function doSend() {
    const text = input.value.replace(/\s+/g, ' ').trim();
    if (!text) { input.focus(); return; }
    if (sending) return;
    sending = true;
    send.disabled = true;
    try {
      const r = await sendChat('text', text);
      input.value = '';
      sfx.drop();
      // What the server stored, so she sees exactly what her classmates see.
      merge([{ id: r.id, name: state.name, avatar: state.avatar, kind: 'text', body: r.body, at: new Date().toISOString(), mine: true }], true, false);
    } catch (e) {
      toast(sendError(e));
    }
    sending = false;
    send.disabled = false;
  }

  // On iPad the keyboard covers the bottom of the page: the chat shrinks to what is left.
  const screen = host.closest('.screen');
  const vv = window.visualViewport;
  const fit = () => {
    if (!screen || !vv) return;
    const covered = innerHeight - vv.height > 80;
    screen.style.height = covered ? `${vv.height}px` : '';
    screen.style.transform = covered ? `translateY(${vv.offsetTop}px)` : '';
    if (covered) list.scrollTop = list.scrollHeight;
  };
  vv?.addEventListener('resize', fit);
  vv?.addEventListener('scroll', fit);
  const onShow = () => { if (!document.hidden) poll(); };
  document.addEventListener('visibilitychange', onShow);
  const timer = setInterval(poll, POLL_MS);

  host.append(wrap);
  load();
  return {
    reload: load,
    stop() {
      alive = false;
      offSwitch();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
      vv?.removeEventListener('resize', fit);
      vv?.removeEventListener('scroll', fit);
      closePop();
    },
  };
}
