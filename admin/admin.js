// The parents' page of Blobika: accounts, statistics and the safety of the class
// features (rating, class drawings, class chat). Russian only: it is for the
// grown-ups, not for the children, and it is not part of the app (not cached by
// sw.js, not translated).
//
// Everything goes through one server function, klyaksa_admin(p_key, p_action,
// p_args) (see server/schema.sql). The key is a long random string that only the
// parent holds; it is pasted into the field (or comes once as /admin/#key=…) and
// is kept for this tab only (sessionStorage), or in this browser's localStorage
// when "remember on this device" is ticked. It never goes into a query string or
// a log.
//
// Text from the server (names, chat messages, titles) is put on the page only as
// text nodes, never as HTML.
import { RATING_URL, RATING_KEY } from '../js/net-config.js';

const KEY_STORE = 'blobika.admin.key';
const SITE = 'https://blobika.com/';
const DB_LIMIT = 500 * 1024 * 1024; // the free Supabase database
const CHAT_PAGE = 150;
const POSTS_PAGE = 100;

// ---------- little helpers ----------

function put(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

// Puts new content into an element (nulls are skipped, strings become text).
const fill = (el, ...kids) => { el.replaceChildren(); return put(el, kids); };

// An element: attributes are set as attributes (never innerHTML), on* are listeners.
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  return put(el, kids);
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, String(v));
  }
  return put(el, kids);
}

// Someone's text (a name, a message, a title): its own direction, so Hebrew reads right.
const user = (text, cls = '') => h('bdi', { dir: 'auto', class: cls }, text ?? '');

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};
const count = (n, one, few, many) => `${n} ${plural(n, one, few, many)}`;
const num = n => Number(n || 0).toLocaleString('ru-RU');

function bytes(n) {
  n = Number(n || 0);
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} МБ`;
}

const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const hhmm = d => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const fullDate = d => d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// "только что", "5 минут назад", "сегодня, 14:05", "вчера", "3 дня назад", "12 окт. 2025".
function ago(iso, withTime = false) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const sec = (Date.now() - d) / 1000;
  if (sec < 60) return 'только что';
  if (sec < 3600) return `${count(Math.floor(sec / 60), 'минуту', 'минуты', 'минут')} назад`;
  const days = Math.round((dayStart(new Date()) - dayStart(d)) / 86400e3);
  if (days <= 0) return withTime ? `сегодня, ${hhmm(d)}` : `${count(Math.floor(sec / 3600), 'час', 'часа', 'часов')} назад`;
  if (days === 1) return withTime ? `вчера, ${hhmm(d)}` : 'вчера';
  if (days < 30) return `${count(days, 'день', 'дня', 'дней')} назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A time with its exact value on hover.
const when = (iso, withTime) => h('time', { datetime: iso || '', title: iso ? fullDate(new Date(iso)) : '' }, ago(iso, withTime));

const isB64 = v => typeof v === 'string' && v.length > 0 && /^[A-Za-z0-9+/=]+$/.test(v);
const jpeg = b64 => (isB64(b64) ? `data:image/jpeg;base64,${b64}` : '');
const cleanCode = v => {
  const c = String(v || '').trim().toLowerCase();
  return /^[a-z0-9-]{4,24}$/.test(c) ? c : '';
};
const parse = v => { try { const j = JSON.parse(v); return j && typeof j === 'object' ? j : null; } catch { return null; } };
const untitled = t => !t || t === 'Мой рисунок';
const LANG = { ru: 'RU', en: 'EN', he: 'HE' };

// ---------- the key ----------

// For this tab only (sessionStorage) unless she ticked "remember" (localStorage): on a
// family iPad the next person who opens /admin/ must not find the key there.
const read = store => { try { return store.getItem(KEY_STORE) || ''; } catch { return ''; } };
const key = {
  get() { return read(sessionStorage) || read(localStorage); },
  remembered() { return !!read(localStorage); },
  set(v, remember = false) {
    key.forget();
    try { (remember ? localStorage : sessionStorage).setItem(KEY_STORE, v); } catch { /* private mode: kept for this page only */ }
    memo = v;
  },
  forget() {
    for (const store of [sessionStorage, localStorage]) { try { store.removeItem(KEY_STORE); } catch { /* nothing stored */ } }
    memo = '';
  },
};
let memo = '';
const currentKey = () => key.get() || memo;

// A key that came in the address (#key=…) is kept for this tab (or where a remembered
// key already was) and taken out of the address at once.
function takeKeyFromAddress() {
  const m = location.hash.match(/^#key=([^&]+)/);
  if (!m) return;
  let v = m[1];
  try { v = decodeURIComponent(v); } catch { /* keep as is */ }
  if (v.trim()) key.set(v.trim(), key.remembered());
  history.replaceState(null, '', location.pathname + location.search + '#/overview');
}

// ---------- the server ----------

class AdminError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// What the server's refusals mean, in Russian (klyaksa_admin answers in English).
const REFUSALS = {
  'no such player': 'такого игрока уже нет',
  'no such message': 'такого сообщения уже нет',
  'no such drawing': 'такого рисунка уже нет',
  'empty name': 'в имени нужна хотя бы одна буква',
  'bad name': 'имя не подходит',
  'bad class': 'код класса не подходит',
  'bad from': 'код «откуда» не подходит',
  'bad to': 'код «куда» не подходит',
  'bad move': 'так нельзя: классы совпадают или «куда» само переезжает',
  'bad word': 'слово не подходит: 2–40 знаков, хотя бы одна буква или цифра',
  'bad note': 'заметка не подходит',
  'nothing to change': 'нечего менять',
};

function explain(code, status, message) {
  if (code === '22023') return `Сервер не принял запрос${message ? `: ${REFUSALS[message] || message}` : ''}`;
  if (code === '55000') return message || 'Сейчас это выключено';
  if (code === '54000') return 'Слишком много запросов, подождите минуту';
  if (code === 'PGRST202') return 'На сервере нет функции klyaksa_admin: нужно обновить server/schema.sql';
  return `Ошибка сервера (${code || status})${message ? `: ${message}` : ''}`;
}

async function api(action, args = {}) {
  const k = currentKey();
  if (!k) { showLogin(); throw new AdminError('key', 'Нужен ключ'); }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  let r;
  try {
    r = await fetch(`${RATING_URL}/rest/v1/rpc/klyaksa_admin`, {
      method: 'POST',
      headers: { apikey: RATING_KEY, Authorization: `Bearer ${RATING_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: k, p_action: action, p_args: args }),
      signal: ctl.signal,
      cache: 'no-store',
    });
  } catch {
    throw new AdminError('offline', 'Нет связи с сервером. Проверьте интернет и нажмите «Обновить».');
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    let body = {};
    try { body = await r.json(); } catch { /* not JSON */ }
    const code = String(body?.code || '');
    if (code === '42501') {
      key.forget();
      showLogin('Ключ не подходит');
      throw new AdminError('key', 'Ключ не подходит');
    }
    throw new AdminError(code, explain(code, r.status, body?.message));
  }
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// A changing action: calls the server and says how it went. Gives the server's
// answer (or true when it has none), or null when it did not work.
// done is the toast text, or a function of the answer that makes it.
async function change(action, args, done) {
  try {
    const res = (await api(action, args)) ?? true;
    const text = typeof done === 'function' ? done(res) : done;
    if (text) toast(text);
    return res;
  } catch (e) {
    if (e.code !== 'key') toast(e.message, true);
    return null;
  }
}

// ---------- toasts, buttons, switches, modal ----------

function toast(text, bad = false) {
  const box = document.getElementById('toasts');
  // At most three at a time: the oldest goes first.
  while (box.children.length >= 3) box.firstElementChild.remove();
  const el = h('div', { class: `toast ${bad ? 'bad' : ''}`, role: bad ? 'alert' : 'status' }, text);
  box.append(el);
  setTimeout(() => el.classList.add('out'), bad ? 6000 : 3200);
  setTimeout(() => el.remove(), bad ? 6400 : 3600);
}

// A button whose action may take a while: it stays pressed (disabled) until it ends.
function btn(label, fn, cls = '') {
  const b = h('button', { type: 'button', class: `btn ${cls}` }, label);
  b.addEventListener('click', async e => {
    e.stopPropagation();
    if (b.disabled) return;
    b.disabled = true;
    try { await fn(e); } finally { if (b.isConnected) b.disabled = false; }
  });
  return b;
}

// An on/off switch. onChange(newValue) does the work; the caller redraws afterwards.
function toggle(label, on, onChange, hint) {
  const b = h('button', { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', class: `switch ${on ? 'on' : ''}` },
    h('span', { class: 'knob', 'aria-hidden': 'true' }),
    h('span', { class: 'switch-text' }, h('span', { class: 'switch-label' }, label),
      h('span', { class: 'switch-state' }, on ? 'включено' : 'выключено'),
      hint ? h('span', { class: 'switch-hint' }, hint) : null));
  b.addEventListener('click', async () => {
    if (b.disabled) return;
    b.disabled = true;
    try { await onChange(!on); } finally { if (b.isConnected) b.disabled = false; }
  });
  return b;
}

let modalClose = null;
function modal(...kids) {
  closeModal();
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Закрыть', onclick: () => closeModal() }, '✕'), kids);
  const back = h('div', { class: 'modal-back', onclick: e => { if (e.target === back) closeModal(); } }, box);
  const esc = e => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', esc);
  document.body.append(back);
  document.body.classList.add('locked');
  modalClose = () => { document.removeEventListener('keydown', esc); back.remove(); document.body.classList.remove('locked'); };
  box.querySelector('.modal-x').focus();
  return box;
}
function closeModal() { if (modalClose) { const f = modalClose; modalClose = null; f(); } }

async function showDrawing(id, title, author) {
  const img = h('img', { class: 'big-img', alt: '' });
  const status = h('p', { class: 'muted' }, 'Загрузка…');
  modal(h('div', { class: 'modal-head' }, h('b', {}, untitled(title) ? 'Рисунок без названия' : user(title)),
    author ? h('span', { class: 'muted' }, ' · ', user(author)) : null), status, img);
  try {
    const r = await api('post_image', { id });
    const src = jpeg(r?.image);
    if (!src) { status.textContent = 'Картинки нет: её стёрли.'; return; }
    img.src = src;
    status.remove();
  } catch (e) {
    status.textContent = e.code === 'key' ? '' : e.message;
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Скопировано');
  } catch {
    prompt('Скопируйте ссылку:', text);
  }
}

const empty = text => h('p', { class: 'empty' }, text);
const loading = () => h('p', { class: 'loading' }, 'Загрузка…');
const failed = (e, retry) => h('div', { class: 'failed' }, h('p', {}, e.message), retry ? btn('Повторить', retry) : null);
const badge = (n, cls = '') => (n > 0 ? h('span', { class: `badge ${cls}`, title: count(n, 'жалоба', 'жалобы', 'жалоб') }, `⚑ ${n}`) : null);
const chip = (text, cls = '') => h('span', { class: `chip ${cls}` }, text);

// ---------- the frame: top bar, menu, main ----------

const app = document.getElementById('app');
let main, nav, reportsBadge;
let gen = 0; // each redraw has a number: an answer for an older one is dropped

const SECTIONS = [
  ['overview', 'Обзор'],
  ['classes', 'Классы'],
  ['reports', 'Жалобы'],
  ['protect', 'Защита'],
  ['log', 'Журнал'],
];

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(p => { try { return decodeURIComponent(p); } catch { return p; } });
  const name = SECTIONS.some(([id]) => id === parts[0]) || parts[0] === 'class' ? parts[0] : 'overview';
  return { name, code: parts[1] || '', tab: parts[2] || 'players' };
}
const go = hash => { if (location.hash === hash) render(); else location.hash = hash; };
const classHash = (code, tab = 'players') => `#/class/${encodeURIComponent(code)}/${tab}`;

function frame() {
  reportsBadge = h('span', { class: 'nav-badge', hidden: true });
  nav = h('nav', { class: 'nav', 'aria-label': 'Разделы' },
    SECTIONS.map(([id, label]) => h('a', { href: `#/${id}`, 'data-id': id }, label, id === 'reports' ? reportsBadge : null)));
  main = h('main', { class: 'main', id: 'main' });
  fill(app, 
    h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('span', { class: 'blob', 'aria-hidden': 'true' }), h('span', {}, 'Блобика — для родителей')),
      h('div', { class: 'top-tools' },
        keyState(),
        refreshBtn(),
        btn('Выйти', () => {
          if (!confirm('Забыть ключ на этом устройстве? Чтобы войти снова, понадобится ключ.')) return;
          key.forget();
          showLogin();
        }, 'ghost'))),
    nav, main);
}

// Where the key is kept; a click moves it between "this tab" and "this device".
function keyState() {
  const remembered = key.remembered();
  const b = h('button', { type: 'button', class: 'key-state',
    title: remembered ? 'Ключ запомнен на этом устройстве. Нажмите, чтобы хранить его только до закрытия вкладки.'
      : 'Ключ забудется, когда закроете вкладку. Нажмите, чтобы запомнить его на этом устройстве.' },
  remembered ? '🔑 запомнен на устройстве' : '🔑 до закрытия вкладки');
  b.addEventListener('click', () => {
    const k = currentKey();
    if (!k) return;
    if (!remembered && !confirm('Запомнить ключ на этом устройстве? Любой, кто откроет эту страницу в этом браузере, войдёт без ключа. Только для вашего личного телефона или компьютера.')) return;
    key.set(k, !remembered);
    b.replaceWith(keyState());
    toast(remembered ? 'Ключ забудется при закрытии вкладки' : 'Ключ запомнен на этом устройстве');
  });
  return b;
}

function refreshBtn() {
  const b = btn([h('span', { class: 'refresh-icon', 'aria-hidden': 'true' }, '↻'), h('span', { class: 'refresh-text' }, 'Обновить')], () => render(true), 'ghost');
  b.setAttribute('aria-label', 'Обновить');
  b.title = 'Загрузить заново';
  return b;
}

function setReportsBadge(n) {
  if (!reportsBadge) return;
  reportsBadge.hidden = !(n > 0);
  reportsBadge.textContent = n > 0 ? String(n) : '';
}

async function render(keepScroll = false) {
  if (!currentKey()) { showLogin(); return; }
  if (!main || !main.isConnected) frame();
  const r = route();
  for (const a of nav.querySelectorAll('a')) {
    const on = a.dataset.id === r.name || (r.name === 'class' && a.dataset.id === 'classes');
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  const my = ++gen;
  const y = scrollY;
  const view = { overview, classes: classesView, class: classView, reports: reportsView, protect: protectView, log: logView }[r.name];
  const box = h('div', { class: 'view' });
  // A class view only changes its sub-tab when that is all that changed.
  if (r.name === 'class' && current?.code === r.code && current.box.isConnected && !keepScroll) {
    current.tab(r.tab);
    return;
  }
  current = null;
  if (!keepScroll) fill(main, box, loading());
  try {
    await view(box, r, () => my === gen);
  } catch (e) {
    if (my !== gen) return;
    if (e.code === 'key') return;
    fill(box, failed(e, () => render(true)));
  }
  if (my !== gen) return;
  fill(main, box);
  if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
}
let current = null; // the open class view: { code, box, tab(name) }

// Keeps the menu's report count fresh without stopping anything else.
async function refreshBadge() {
  try { const st = await api('stats'); setReportsBadge(st?.reports_open || 0); } catch { /* shown elsewhere */ }
}

// ---------- the login ----------

function showLogin(error = '') {
  gen++;
  main = null;
  current = null;
  closeModal();
  const input = h('input', { type: 'password', id: 'key', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'Ключ администратора' });
  const remember = h('input', { type: 'checkbox', id: 'remember' });
  const err = h('p', { class: 'login-error', role: 'alert' }, error);
  const submit = e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) { err.textContent = 'Вставьте ключ'; return; }
    key.set(v, remember.checked);
    history.replaceState(null, '', location.pathname + location.search + '#/overview');
    render();
  };
  fill(app, h('div', { class: 'login' },
    h('form', { class: 'card login-card', onsubmit: submit },
      h('div', { class: 'brand big' }, h('span', { class: 'blob', 'aria-hidden': 'true' }), h('span', {}, 'Блобика — для родителей')),
      h('p', {}, 'Здесь взрослые видят классы, игроков, чат и рисунки, и могут всё это защитить.'),
      h('label', { for: 'key' }, 'Ключ'),
      input,
      h('label', { class: 'remember', for: 'remember' }, remember, ' Запомнить на этом устройстве'),
      h('p', { class: 'muted small' }, 'Без галочки ключ забудется, когда закроете вкладку. Ставьте её только на своём личном телефоне или компьютере, не на устройстве, где играют дети.'),
      err,
      h('button', { type: 'submit', class: 'btn primary wide' }, 'Войти'),
      h('p', { class: 'muted small' }, 'Вставляйте ключ сюда. Ссылку вида …/admin/#key=… не пересылайте в чатах: адрес с ключом остаётся в истории браузера, удалите его оттуда.'))));
  input.focus();
}

// ---------- Обзор ----------

async function overview(box, r, alive) {
  const [st, reports] = await Promise.all([api('stats'), api('reports').catch(e => { if (e.code === 'key') throw e; return null; })]);
  if (!alive()) return;
  setReportsBadge(st.reports_open || 0);
  const dbShare = Math.min(1, (st.db_bytes || 0) / DB_LIMIT);
  const postShare = Math.min(dbShare, (st.posts_bytes || 0) / DB_LIMIT);
  const tile = (label, value, sub, cls = '', href) => h(href ? 'a' : 'div', { class: `tile ${cls}`, href },
    h('span', { class: 'tile-label' }, label), h('span', { class: 'tile-value' }, value), sub ? h('span', { class: 'tile-sub' }, sub) : null);
  const blocked = (st.players || 0) - (st.visible || 0);
  box.append(
    h('h1', {}, 'Обзор'),
    h('div', { class: 'tiles' },
      tile('Игроков', num(st.players), blocked > 0 ? `${count(blocked, 'заблокирована', 'заблокированы', 'заблокировано')}` : 'никто не заблокирован'),
      tile('Играли за 7 дней', num(st.active_7d), 'разных игроков'),
      tile('Новых за 7 дней', num(st.new_7d), 'пришли в классы'),
      tile('Классов', num(st.classes), 'открыть список →', '', '#/classes'),
      tile('Сообщений за 7 дней', num(st.messages_7d), 'в чатах классов'),
      tile('Рисунков за 7 дней', num(st.posts_7d), 'показано классам'),
      tile('Открытых жалоб', num(st.reports_open), st.reports_open > 0 ? 'посмотреть →' : 'всё спокойно', st.reports_open > 0 ? 'alert' : 'calm', '#/reports'),
      h('div', { class: 'tile db' },
        h('span', { class: 'tile-label' }, 'База данных'),
        h('span', { class: 'tile-value' }, bytes(st.db_bytes), h('small', {}, ' из 500 МБ')),
        h('div', { class: `bar ${dbShare > 0.8 ? 'warn' : ''}`, role: 'img', 'aria-label': `Занято ${Math.round(dbShare * 100)}%` },
          h('span', { class: 'bar-posts', style: `width:${(postShare * 100).toFixed(1)}%` }),
          h('span', { class: 'bar-rest', style: `width:${((dbShare - postShare) * 100).toFixed(1)}%` })),
        h('span', { class: 'tile-sub' },
          h('span', { class: 'legend-item' }, h('i', { class: 'dot posts' }), `рисунки ${bytes(st.posts_bytes)}`),
          h('span', { class: 'legend-item' }, h('i', { class: 'dot rest' }), `остальное ${bytes(Math.max(0, (st.db_bytes || 0) - (st.posts_bytes || 0)))}`)))),
    activity(st.days || []),
    latestReports(reports));
}

// Three small bar charts with one shared day axis: each measure keeps its own scale.
function activity(days) {
  const series = [
    ['active', 'Играли', 'игроков', '#7c4ddb'],
    ['messages', 'Сообщения', 'сообщений', '#2f86d9'],
    ['posts', 'Рисунки', 'рисунков', '#139c84'],
  ];
  const dates = days.map(d => {
    const [y, m, dd] = String(d.day).split('-').map(Number);
    return new Date(y, (m || 1) - 1, dd || 1);
  });
  const weekday = d => d.toLocaleDateString('ru-RU', { weekday: 'short' });
  const dayName = d => d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const charts = h('div', { class: 'charts' });
  const draw = () => {
    const W = Math.max(260, Math.floor(charts.clientWidth || 600));
    const H = 92, top = 16, bottom = 4, plotH = H - top - bottom;
    const n = days.length || 1;
    const step = W / n;
    const bw = Math.max(4, Math.min(28, step * 0.62));
    fill(charts);
    for (const [field, title, unit, color] of series) {
      const vals = days.map(d => Number(d[field] || 0));
      const max = Math.max(1, ...vals);
      // Players are counted per day (one girl on ten days is 10): for them the busiest day, not a sum.
      const summary = field === 'active' ? `больше всего за день: ${num(Math.max(0, ...vals))}` : `за 14 дней: ${num(vals.reduce((a, b) => a + b, 0))}`;
      const readout = h('span', { class: 'chart-readout' }, summary);
      const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${title} по дням` });
      svg.append(s('line', { x1: 0, x2: W, y1: H - bottom + 0.5, y2: H - bottom + 0.5, class: 'axis' }));
      const peak = vals.indexOf(max);
      vals.forEach((v, i) => {
        const x = i * step + (step - bw) / 2;
        const bh = v > 0 ? Math.max(2, (v / max) * plotH) : 0;
        const y0 = H - bottom;
        const rr = Math.min(4, bw / 2, bh);
        const g = s('g', { class: 'col' });
        g.append(s('title', {}, `${dayName(dates[i])}: ${num(v)}`));
        g.append(s('rect', { x: i * step, y: 0, width: step, height: H, class: 'hit' }));
        if (bh > 0) {
          g.append(s('path', { fill: color, d: `M${x},${y0}V${y0 - bh + rr}Q${x},${y0 - bh} ${x + rr},${y0 - bh}H${x + bw - rr}Q${x + bw},${y0 - bh} ${x + bw},${y0 - bh + rr}V${y0}Z` }));
        }
        // Direct labels only on the highest day and on today.
        if (v > 0 && (i === peak || i === vals.length - 1)) {
          g.append(s('text', { x: x + bw / 2, y: y0 - bh - 4, 'text-anchor': 'middle', class: 'val' }, num(v)));
        }
        const show = () => { readout.textContent = `${dayName(dates[i])}: ${count(v, ...forms[field])}`; svg.classList.add('hovering'); g.classList.add('on'); };
        const hide = () => { readout.textContent = summary; svg.classList.remove('hovering'); g.classList.remove('on'); };
        g.addEventListener('pointerenter', show);
        g.addEventListener('pointerleave', hide);
        g.addEventListener('click', show);
        svg.append(g);
      });
      charts.append(h('figure', { class: 'chart' },
        h('figcaption', {}, h('i', { class: 'swatch', style: `background:${color}` }), h('b', {}, title), readout),
        svg));
    }
    // One row of day labels under the three charts.
    const labels = s('svg', { width: W, height: 30, viewBox: `0 0 ${W} 30`, 'aria-hidden': 'true', class: 'day-axis' });
    const every = step < 22 ? 2 : 1;
    dates.forEach((d, i) => {
      if ((n - 1 - i) % every) return;
      const x = i * step + step / 2;
      const weekend = d.getDay() === 5 || d.getDay() === 6;
      labels.append(s('text', { x, y: 12, 'text-anchor': 'middle', class: weekend ? 'wk' : '' }, String(d.getDate())));
      labels.append(s('text', { x, y: 26, 'text-anchor': 'middle', class: `sub ${weekend ? 'wk' : ''}` }, weekday(d)));
    });
    charts.append(labels);
  };
  const forms = { active: ['игрок', 'игрока', 'игроков'], messages: ['сообщение', 'сообщения', 'сообщений'], posts: ['рисунок', 'рисунка', 'рисунков'] };
  const table = h('table', { class: 'data' },
    h('thead', {}, h('tr', {}, h('th', {}, 'День'), series.map(([, t]) => h('th', {}, t)), h('th', {}, 'Новых'))),
    h('tbody', {}, days.slice().reverse().map((d, i) => h('tr', {},
      h('td', {}, dayName(dates[days.length - 1 - i])), series.map(([f]) => h('td', {}, num(d[f]))), h('td', {}, num(d.new_players))))));
  const card = h('section', { class: 'card' },
    h('h2', {}, 'Последние 14 дней'),
    days.length ? charts : empty('Пока нет данных.'),
    h('details', { class: 'table-view' }, h('summary', {}, 'Таблицей'), h('div', { class: 'scroll-x' }, table)));
  if (days.length) {
    requestAnimationFrame(draw);
    let t;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (charts.isConnected) draw(); else ro.disconnect(); }, 80); });
    ro.observe(charts);
  }
  return card;
}

function latestReports(reports) {
  const card = h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Последние жалобы'), h('a', { href: '#/reports' }, 'Все жалобы →')));
  if (!reports) card.append(empty('Не удалось загрузить жалобы.'));
  else if (!reports.length) card.append(empty('Жалоб нет.'));
  else {
    card.append(h('ul', { class: 'mini-list' }, reports.slice(0, 5).map(rp => h('li', {},
      h('a', { href: '#/reports', class: 'mini-row' },
        rp.kind === 'post' && jpeg(rp.thumb) ? h('img', { class: 'mini-thumb', src: jpeg(rp.thumb), alt: '' }) : h('span', { class: 'mini-icon', 'aria-hidden': 'true' }, rp.kind === 'post' ? '🖼' : '💬'),
        h('span', { class: 'mini-main' },
          h('span', { class: 'mini-title' }, user(rp.author_name, 'name'), ' · ', h('span', { class: 'muted' }, rp.class)),
          h('span', { class: 'mini-text' }, rp.kind === 'post' ? (untitled(rp.preview) ? 'Рисунок без названия' : user(rp.preview)) : previewText(rp.preview))),
        h('span', { class: 'mini-side' }, badge(rp.count, 'red'), h('span', { class: 'muted small' }, ago(rp.last_at))))))));
  }
  return card;
}

// ---------- chat bodies ----------

const VERB = { lesson: 'прошла урок', game: 'сыграла в', coloring: 'раскрасила', draw: 'нарисовала' };

// What a message says, readable: the bodies of 'result' and 'post' are JSON.
function messageBody(m, { openPost = true } = {}) {
  if (m.kind === 'result') {
    const r = parse(m.body);
    if (r) {
      const stars = Math.max(0, Math.min(3, Number(r.stars) || 0));
      const text = r.t === 'draw' && untitled(r.what) ? 'нарисовала новый рисунок' : `${VERB[r.t] || 'сыграла в'} «${r.what || '?'}»`;
      return h('p', { class: 'msg-card' }, '🏅 ', text, stars ? h('span', { class: 'stars' }, ' ', '★'.repeat(stars)) : null);
    }
  }
  if (m.kind === 'post') {
    const r = parse(m.body);
    if (r) {
      const title = untitled(r.what) ? 'показала новый рисунок' : null;
      return h('p', { class: 'msg-card' }, '🖼 ', title || h('span', {}, 'показала рисунок «', user(r.what), '»'),
        openPost && r.post ? h('button', { type: 'button', class: 'link', onclick: () => showDrawing(Number(r.post), r.what, m.name) }, 'открыть') : null);
    }
  }
  if (m.deleted || (!m.body && m.hidden)) return h('p', { class: 'msg-text gone' }, 'текст стёрт');
  return h('p', { class: 'msg-text', dir: 'auto' }, m.body);
}

// A report's preview: a message body (maybe JSON) as one line.
function previewText(body) {
  const j = parse(body);
  if (j && 't' in j) return `🏅 ${VERB[j.t] || 'сыграла в'} «${j.what || ''}»`;
  if (j && 'post' in j) return `🖼 показала рисунок «${j.what || ''}»`;
  return body ? user(body) : h('i', { class: 'muted' }, 'текст стёрт');
}

// ---------- Классы ----------

async function classesView(box, r, alive) {
  const list = await api('classes');
  if (!alive()) return;
  const star = list.find(c => c.code === '*') || { code: '*', chat: true, drawings: true, locked: false };
  const rest = list.filter(c => c.code !== '*');
  box.append(
    h('h1', {}, 'Классы'),
    globalSwitches(star, () => render(true)),
    playerSearch(),
    h('section', { class: 'card' },
      h('h2', {}, `Классы (${rest.length})`),
      rest.length ? h('p', { class: 'muted small legend' }, '👧 игроков · ⚡ играли за неделю · 💬 сообщений за неделю · 🖼 рисунков за неделю') : null,
      rest.length ? h('ul', { class: 'class-list' }, rest.map(c => classRow(c, star))) : empty('Пока ни одного класса.')));
}

function globalSwitches(star, after) {
  const set = (field, label) => async v => {
    if (field === 'locked' && v && !confirm('Закрыть ВСЕ классы для новых участниц? Те, кто уже в классах, продолжат играть.')) return;
    if (field !== 'locked' && !v && !confirm(`Выключить «${label}» во всех классах?`)) return;
    if (await change('class_set', { class: '*', [field]: v }, `${label}: ${field === 'locked' ? (v ? 'закрыто' : 'открыто') : (v ? 'включено' : 'выключено')} для всех классов`)) after();
  };
  return h('section', { class: 'card all-classes' },
    h('h2', {}, 'Все классы'),
    h('p', { class: 'muted' }, 'Эти переключатели действуют на каждый класс сразу. Выключенное здесь выключено везде, что бы ни стояло у класса.'),
    h('div', { class: 'switches' },
      toggle('Чат', star.chat !== false, set('chat', 'Чат')),
      toggle('Рисунки', star.drawings !== false, set('drawings', 'Рисунки')),
      toggle('Закрыть для новых', !!star.locked, set('locked', 'Закрыть для новых'))));
}

function classRow(c, star) {
  const offs = [];
  if (c.chat === false) offs.push(chip('чат выключен', 'off'));
  else if (star.chat === false) offs.push(chip('чат выключен для всех', 'off soft'));
  if (c.drawings === false) offs.push(chip('рисунки выключены', 'off'));
  else if (star.drawings === false) offs.push(chip('рисунки выключены для всех', 'off soft'));
  if (c.locked) offs.push(chip('закрыт для новых', 'lock'));
  else if (star.locked) offs.push(chip('закрыты все', 'lock soft'));
  return h('li', {},
    h('a', { class: 'class-row', href: classHash(c.code) },
      h('span', { class: 'class-main' },
        h('span', { class: 'class-code' }, c.code, badge(c.reports_open, 'red')),
        c.note ? h('span', { class: 'class-note' }, user(c.note)) : null,
        c.moved_from?.length ? h('span', { class: 'muted small' }, `сюда ведут: ${c.moved_from.join(', ')}`) : null),
      h('span', { class: 'class-stats' },
        h('span', { title: 'игроков' }, '👧 ', num(c.players)),
        h('span', { title: 'играли за неделю' }, '⚡ ', num(c.active_7d)),
        h('span', { title: 'сообщений за неделю' }, '💬 ', num(c.messages_7d)),
        h('span', { title: 'рисунков за неделю' }, '🖼 ', num(c.posts_7d))),
      offs.length ? h('span', { class: 'class-chips' }, offs) : null,
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '›')));
}

function playerSearch() {
  const input = h('input', { type: 'search', placeholder: 'Имя игрока', 'aria-label': 'Имя игрока', enterkeyhint: 'search', maxlength: 50 });
  const out = h('div', { class: 'search-out' });
  const find = async () => {
    const q = input.value.trim();
    if (!q) { fill(out); return; }
    fill(out, loading());
    try {
      const list = await api('players', { q });
      if (!out.isConnected) return;
      fill(out, list.length ? playerList(list, { showClass: true, reload: find }) : empty('Никого с таким именем.'));
    } catch (e) { if (e.code !== 'key') fill(out, failed(e, find)); }
  };
  return h('section', { class: 'card' },
    h('h2', {}, 'Найти игрока во всех классах'),
    h('form', { class: 'row-form', onsubmit: e => { e.preventDefault(); find(); } },
      input, h('button', { type: 'submit', class: 'btn' }, 'Найти')),
    out);
}

// ---------- Класс <code> ----------

async function classView(box, r, alive) {
  const code = r.code;
  if (!code) { location.hash = '#/classes'; return; }
  const list = await api('classes');
  if (!alive()) return;
  const star = list.find(c => c.code === '*') || {};
  const c = list.find(x => x.code === code) || { code, players: 0, chat: true, drawings: true, locked: false, note: '' };
  const link = `${SITE}?class=${encodeURIComponent(code)}`;
  const reloadHead = () => render(true);

  const set = (field, label) => async v => {
    if (await change('class_set', { class: code, [field]: v }, `${label}: ${field === 'locked' ? (v ? 'класс закрыт для новых' : 'класс открыт') : (v ? 'включено' : 'выключено')}`)) reloadHead();
  };
  const globalHint = f => (star[f] === (f === 'locked') ? (f === 'locked' ? 'все классы закрыты в «Защите»' : 'выключено для всех классов в «Защите»') : null);

  const note = h('textarea', { rows: 2, maxlength: 200, dir: 'auto', placeholder: 'Например: 2 «Б», учительница Анна', 'aria-label': 'Заметка о классе' });
  note.value = c.note || '';
  const tabsNav = h('div', { class: 'subtabs', role: 'tablist' });
  const body = h('div', { class: 'subtab-body' });

  box.append(
    h('a', { class: 'back', href: '#/classes' }, '← Все классы'),
    h('div', { class: 'class-head' },
      h('h1', {}, 'Класс ', h('span', { class: 'class-code' }, code)),
      c.reports_open > 0 ? h('a', { href: '#/reports', class: 'badge red' }, `⚑ ${count(c.reports_open, 'жалоба', 'жалобы', 'жалоб')}`) : null),
    h('section', { class: 'card' },
      h('div', { class: 'invite' },
        h('span', { class: 'muted' }, 'Приглашение:'),
        h('a', { href: link, target: '_blank', rel: 'noopener', class: 'invite-link' }, link),
        btn('Скопировать', () => copy(link), 'small')),
      h('div', { class: 'switches' },
        toggle('Чат', c.chat !== false, set('chat', 'Чат'), globalHint('chat')),
        toggle('Рисунки', c.drawings !== false, set('drawings', 'Рисунки'), globalHint('drawings')),
        toggle('Закрыть для новых', !!c.locked, set('locked', 'Закрыть для новых'), globalHint('locked'))),
      h('div', { class: 'class-facts muted small' },
        `${count(c.players || 0, 'игрок', 'игрока', 'игроков')} · за неделю: играли ${num(c.active_7d)}, сообщений ${num(c.messages_7d)}, рисунков ${num(c.posts_7d)}`,
        c.moved_from?.length ? ` · сюда ведут коды: ${c.moved_from.join(', ')}` : ''),
      c.note ? h('p', { class: 'class-note-line' }, '📝 ', user(c.note)) : null,
      // The note and the delete button: folded on a phone, so the players and the chat are near the top.
      h('details', { class: 'class-more', open: matchMedia('(min-width: 601px)').matches },
        h('summary', {}, c.note ? 'Изменить заметку, удалить класс' : 'Заметка, удалить класс'),
      h('div', { class: 'note-row' },
        note,
        btn('Сохранить заметку', async () => {
          if (await change('class_set', { class: code, note: note.value.trim() }, 'Заметка сохранена')) reloadHead();
        })),
      h('div', { class: 'danger-zone' },
        btn('Удалить класс', async () => {
          if (!confirm(`Удалить класс ${code}? Игроки, звёзды, рисунки, сообщения и жалобы будут стёрты.\n\n`
            + 'Класс останется в списке закрытым для новых: иначе устройства девочек, где осталась игра, создадут их заново. '
            + 'Открыть его снова можно переключателем «Закрыть для новых».')) return;
          const typed = prompt(`Стёртое нельзя вернуть. Чтобы подтвердить, напишите код класса: ${code}`);
          if (typed == null) return;
          if (typed.trim().toLowerCase() !== code) { toast('Код не совпал, класс не удалён', true); return; }
          if (await change('class_delete', { class: code }, res => `Класс ${code} очищен и закрыт для новых${res?.players != null ? `, удалено игроков: ${res.players}` : ''}`)) location.hash = '#/classes';
        }, 'danger')))),
    tabsNav, body);

  const TABS = [['players', 'Игроки'], ['chat', 'Чат'], ['art', 'Рисунки']];
  const showTab = name => {
    if (!TABS.some(([id]) => id === name)) name = 'players';
    for (const a of tabsNav.children) a.setAttribute('aria-selected', a.dataset.id === name ? 'true' : 'false');
    fill(body, loading());
    ({ players: classPlayers, chat: classChat, art: classArt })[name](body, code);
  };
  tabsNav.append(...TABS.map(([id, label]) => h('a', { href: classHash(code, id), role: 'tab', 'data-id': id }, label)));
  current = { code, box, tab: showTab };
  showTab(r.tab);
}

// The players of one class.
async function classPlayers(body, code) {
  const load = async () => {
    try {
      const list = await api('players', { class: code });
      if (!body.isConnected) return;
      fill(body, list.length ? playerList(list, { reload: load }) : empty('В этом классе никого нет.'));
    } catch (e) { if (e.code !== 'key' && body.isConnected) fill(body, failed(e, load)); }
  };
  await load();
}

function playerList(list, { showClass = false, reload }) {
  return h('ul', { class: 'players' }, list.map(p => playerRow(p, showClass, reload)));
}

function playerRow(p, showClass, reload) {
  const blocked = p.visible === false;
  return h('li', { class: `player ${blocked ? 'blocked' : ''}` },
    h('span', { class: 'avatar', 'aria-hidden': 'true' }, p.avatar || '🙂'),
    h('div', { class: 'player-main' },
      h('div', { class: 'player-name' },
        user(p.name, 'name'),
        p.forced_name ? chip('имя задано взрослым', 'set') : null,
        blocked ? chip('заблокирована', 'off') : null,
        showClass ? h('a', { class: 'chip link-chip', href: classHash(p.class) }, p.class || 'без класса') : null,
        p.forced_class ? chip(`закреплена в ${p.forced_class}`, 'set') : null),
      h('div', { class: 'player-meta' },
        h('span', { title: 'звёзд всего' }, '★ ', num(p.stars)),
        h('span', { title: 'звёзд на этой неделе' }, 'неделя ', num(p.week)),
        h('span', { title: p.updated_at ? fullDate(new Date(p.updated_at)) : '' }, 'была ', ago(p.updated_at)),
        h('span', { title: 'язык' }, LANG[p.lang] || p.lang || '—'),
        h('span', { title: 'сообщений' }, '💬 ', num(p.messages)),
        h('span', { title: 'рисунков' }, '🖼 ', num(p.posts)),
        p.reports_against > 0 ? h('span', { class: 'red-text', title: 'жалоб на неё' }, '⚑ ', num(p.reports_against)) : null,
        h('span', { class: 'muted', title: p.created_at ? fullDate(new Date(p.created_at)) : '' }, 'с ', p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : '—')),
      h('div', { class: 'actions' },
        blocked
          ? btn('Разблокировать', async () => { if (await change('player_set', { id: p.id, visible: true }, `${p.name}: разблокирована`)) reload(); })
          : btn('Заблокировать', async () => {
            if (!confirm(`Заблокировать «${p.name}»? Её строка в рейтинге, рисунки, сообщения и сердечки пропадут у всех. Сама она продолжит играть.`)) return;
            if (await change('player_set', { id: p.id, visible: false }, `${p.name}: заблокирована`)) reload();
          }, 'warn'),
        btn('Переименовать', async () => {
          const v = prompt(`Новое имя для «${p.name}» (до 24 знаков).\nПустое поле — её собственное имя вернётся при следующем входе в игру.`, p.forced_name || p.name);
          if (v == null) return;
          const name = v.trim() ? v.trim().slice(0, 24) : null;
          if (await change('player_set', { id: p.id, name }, name ? 'Имя изменено' : 'Её собственное имя вернётся, когда она в следующий раз откроет игру')) reload();
        }),
        btn('Перевести в класс', async () => {
          const v = prompt(`Код класса, куда перевести «${p.name}».\nПустое поле — снять закрепление (останется в классе, который выберет сама).`, p.forced_class || '');
          if (v == null) return;
          const klass = v.trim() ? cleanCode(v) : null;
          if (v.trim() && !klass) { toast('Код класса — от 4 до 24 латинских букв, цифр и «-»', true); return; }
          if (klass && klass !== p.class) {
            // A typo would put her alone into a new class: say what the code is.
            let known;
            try { known = (await api('classes')).find(c => c.code === klass); } catch (e) { if (e.code !== 'key') toast(e.message, true); return; }
            const ask = known
              ? `Перевести «${p.name}» в ${klass} (${count(known.players || 0, 'игрок', 'игрока', 'игроков')})? Её рисунки и сообщения перейдут с ней.`
              : `Класса ${klass} пока нет. Создать его и перевести туда «${p.name}»? Там она будет одна.`;
            if (!confirm(ask)) return;
          }
          if (await change('player_set', { id: p.id, class: klass }, klass ? `Переведена в ${klass}` : 'Закрепление снято')) reload();
        }),
        btn('Удалить', async () => {
          if (!confirm(`Удалить «${p.name}» и всё её: звёзды, рисунки, сообщения, сердечки и жалобы?\n\n`
            + 'Важно: если на её устройстве игра осталась, при следующем сохранении она появится снова как новый игрок. '
            + 'Надёжнее заблокировать: ни сохранения, ни выход и вход заново из её игры блокировку не снимут. '
            + 'Если же на её устройстве сотрут данные игры, она вернётся новым игроком: тогда помогает «Закрыть для новых».')) return;
          if (await change('player_delete', { id: p.id }, `${p.name}: удалена`)) reload();
        }, 'danger'))));
}

// The whole chat of one class, newest at the bottom.
async function classChat(body, code) {
  let msgs = []; // newest first, as the server sends them
  let more = false;
  let onlyHidden = false, onlyReported = false;
  const list = h('div', { class: 'chat', role: 'log' });
  const older = btn('Ещё раньше', async () => {
    const before = msgs.length ? msgs[msgs.length - 1].id : undefined;
    const keep = list.scrollHeight - list.scrollTop;
    try {
      const page = await api('chat', { class: code, before, limit: CHAT_PAGE });
      msgs = msgs.concat(page);
      more = page.length >= CHAT_PAGE;
      draw();
      list.scrollTop = list.scrollHeight - keep;
    } catch (e) { if (e.code !== 'key') toast(e.message, true); }
  }, 'small');
  const filters = h('div', { class: 'filters' },
    h('label', {}, h('input', { type: 'checkbox', onchange: e => { onlyHidden = e.target.checked; draw(); } }), ' только скрытые'),
    h('label', {}, h('input', { type: 'checkbox', onchange: e => { onlyReported = e.target.checked; draw(); } }), ' с жалобами'),
    h('span', { class: 'chat-count muted small' }));

  // Reloads as many messages as were shown, keeping the place in the list.
  const load = async (first = false) => {
    const want = Math.max(CHAT_PAGE, msgs.length);
    const fromBottom = list.scrollHeight - list.scrollTop;
    try {
      let got = [];
      let page, asked;
      do {
        const before = got.length ? got[got.length - 1].id : undefined;
        asked = Math.min(300, want - got.length);
        page = await api('chat', { class: code, before, limit: asked });
        got = got.concat(page);
      } while (page.length === asked && got.length < want);
      if (!body.isConnected) return;
      msgs = got;
      more = page.length === asked;
      if (first) fill(body, filters, list);
      draw();
      list.scrollTop = first ? list.scrollHeight : list.scrollHeight - fromBottom;
    } catch (e) {
      if (e.code === 'key' || !body.isConnected) return;
      if (first) fill(body, failed(e, () => load(true))); else toast(e.message, true);
    }
  };

  const draw = () => {
    const shown = msgs.filter(m => (!onlyHidden || m.hidden || m.deleted) && (!onlyReported || m.reports > 0)).slice().reverse();
    const hiddenN = msgs.filter(m => m.hidden || m.deleted).length;
    filters.querySelector('.chat-count').textContent = `загружено ${msgs.length}, скрытых ${hiddenN}`;
    const rows = [];
    // The button may have been taken off the page while still pressed: it comes back usable.
    if (more) { older.disabled = false; rows.push(h('div', { class: 'older' }, older)); }
    let lastDay = '';
    for (const m of shown) {
      const d = new Date(m.at);
      const dk = d.toDateString();
      if (dk !== lastDay) {
        lastDay = dk;
        const days = Math.round((dayStart(new Date()) - dayStart(d)) / 86400e3);
        rows.push(h('div', { class: 'day-sep' }, h('span', {}, days === 0 ? 'Сегодня' : days === 1 ? 'Вчера' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }))));
      }
      rows.push(chatMessage(m, () => load()));
    }
    if (!shown.length) rows.push(empty(msgs.length ? 'Среди загруженных таких нет.' : 'В чате пока пусто.'));
    fill(list, ...rows);
  };
  await load(true);
}

// The drawing a notice in the chat ('🖼 показала рисунок') is about, or 0.
const noticePost = m => (m.kind === 'post' ? Number(parse(m.body)?.post) || 0 : 0);

function chatMessage(m, reload) {
  const gone = m.deleted || (m.hidden && m.kind !== 'post' && !m.body);
  const state = gone ? chip('удалено автором', 'gone') : m.hidden ? chip('скрыто', 'off') : null;
  // A notice stands for its drawing: hiding or deleting it acts on the drawing (and the notice goes with it).
  const post = noticePost(m);
  return h('div', { class: `msg ${m.hidden || gone ? 'is-hidden' : ''} ${m.kind !== 'text' ? 'is-card' : ''}`, 'data-id': m.id },
    h('span', { class: 'avatar small', 'aria-hidden': 'true' }, m.avatar || '🙂'),
    h('div', { class: 'msg-bubble' },
      h('div', { class: 'msg-head' }, user(m.name, 'name'), m.author_visible === false ? chip('автор заблокирована', 'off soft') : null, h('span', { class: 'muted small', title: fullDate(new Date(m.at)) }, hhmm(new Date(m.at))), state, badge(m.reports, 'red')),
      messageBody(m),
      h('div', { class: 'actions small' },
        post ? [
          gone ? null : m.hidden
            ? btn('Показать рисунок', async () => { if (await change('post_set', { id: post, hidden: false }, res => (res?.hidden ? 'Рисунок остаётся скрытым: его стёрли' : 'Рисунок снова виден'))) reload(); }, 'small')
            : btn('Скрыть рисунок', async () => { if (await change('post_set', { id: post, hidden: true }, 'Рисунок скрыт, и в чате, и в «Рисунках»')) reload(); }, 'small warn'),
          btn('Удалить рисунок', async () => {
            if (!confirm('Удалить этот рисунок навсегда? Он пропадёт из «Рисунков» класса, и это сообщение о нём тоже.')) return;
            if (await change('post_delete', { id: post }, 'Рисунок удалён')) reload();
          }, 'small danger'),
        ] : [
          gone ? null : m.hidden
            ? btn('Показать', async () => { if (await change('msg_set', { id: m.id, hidden: false }, 'Сообщение снова видно')) reload(); }, 'small')
            : btn('Скрыть', async () => { if (await change('msg_set', { id: m.id, hidden: true }, 'Сообщение скрыто')) reload(); }, 'small warn'),
          btn('Удалить', async () => {
            if (!confirm('Удалить это сообщение навсегда?')) return;
            if (await change('msg_delete', { id: m.id }, 'Сообщение удалено')) reload();
          }, 'small danger'),
        ])));
}

// The drawings of one class.
async function classArt(body, code) {
  let limit = POSTS_PAGE;
  const load = async () => {
    try {
      const list = await api('posts', { class: code, limit });
      if (!body.isConnected) return;
      const grid = h('div', { class: 'art-grid' }, list.map(p => artCard(p, load)));
      fill(body, 
        h('p', { class: 'muted small' }, `${count(list.length, 'рисунок', 'рисунка', 'рисунков')}, скрытых ${list.filter(p => p.hidden || p.deleted).length}, всего ${bytes(list.reduce((a, p) => a + (p.bytes || 0), 0))}`),
        list.length ? grid : empty('Рисунков пока нет.'),
        list.length >= limit && limit < 200 ? h('div', { class: 'older' }, btn('Показать больше (до 200)', async () => { limit = 200; await load(); })) : null);
    } catch (e) { if (e.code !== 'key' && body.isConnected) fill(body, failed(e, load)); }
  };
  await load();
}

function artCard(p, reload) {
  const gone = p.deleted || (p.hidden && !isB64(p.thumb));
  const src = jpeg(p.thumb);
  return h('div', { class: `art ${p.hidden || gone ? 'is-hidden' : ''}` },
    h('button', { type: 'button', class: 'art-img', 'aria-label': 'Открыть рисунок', onclick: () => showDrawing(p.id, p.title, p.name) },
      src ? h('img', { src, alt: '', loading: 'lazy' }) : h('span', { class: 'no-img' }, 'стёрт'),
      p.reports > 0 ? h('span', { class: 'art-badge' }, `⚑ ${p.reports}`) : null),
    h('div', { class: 'art-info' },
      h('div', { class: 'art-title' }, untitled(p.title) ? h('span', { class: 'muted' }, 'Без названия') : user(p.title)),
      h('div', { class: 'art-author' }, h('span', { 'aria-hidden': 'true' }, p.avatar || '🙂'), ' ', user(p.name, 'name'),
        p.author_visible === false ? [' ', chip('заблокирована', 'off soft')] : null),
      h('div', { class: 'art-meta muted small' }, `♥ ${num(p.hearts)} · ${ago(p.at)} · ${bytes(p.bytes)}`),
      gone ? chip('удалён автором', 'gone') : p.hidden ? chip('скрыт', 'off') : null,
      h('div', { class: 'actions small' },
        gone ? null : p.hidden
          ? btn('Показать', async () => { if (await change('post_set', { id: p.id, hidden: false }, 'Рисунок снова виден')) reload(); }, 'small')
          : btn('Скрыть', async () => { if (await change('post_set', { id: p.id, hidden: true }, 'Рисунок скрыт')) reload(); }, 'small warn'),
        btn('Удалить', async () => {
          if (!confirm('Удалить этот рисунок навсегда? Сообщение о нём в чате тоже пропадёт.')) return;
          if (await change('post_delete', { id: p.id }, 'Рисунок удалён')) reload();
        }, 'small danger'))));
}

// ---------- Жалобы ----------

async function reportsView(box, r, alive) {
  const list = await api('reports');
  if (!alive()) return;
  refreshBadge();
  const reload = () => render(true);
  box.append(
    h('h1', {}, 'Жалобы'),
    h('p', { class: 'muted' }, 'Две жалобы от разных девочек сами скрывают сообщение или рисунок у всех. Здесь решаете вы: оставить скрытым, вернуть, удалить или заблокировать автора.'),
    list.length ? h('div', { class: 'reports' }, list.map(rp => reportCard(rp, reload))) : empty('Открытых жалоб нет. Всё спокойно.'));
}

function reportCard(rp, reload) {
  const isPost = rp.kind === 'post';
  // A report from the chat on the notice of a drawing ('🖼 показала рисунок') is about the drawing.
  const notice = !isPost && rp.msg_kind === 'post' ? noticePost({ kind: 'post', body: rp.preview }) : 0;
  const onDrawing = isPost || !!notice;
  const postId = isPost ? rp.target : notice;
  const what = onDrawing ? 'рисунок' : 'сообщение';
  const src = isPost ? jpeg(rp.thumb) : '';
  const back = res => `Жалоба закрыта, ${res?.hidden ? `${onDrawing ? 'он остаётся скрытым' : 'оно остаётся скрытым'}` : (onDrawing ? 'рисунок снова виден' : 'сообщение снова видно')}`;
  return h('article', { class: 'card report' },
    h('div', { class: 'report-head' },
      chip(isPost ? '🖼 Рисунок' : notice ? '🖼 Рисунок в чате' : '💬 Сообщение', 'kind'),
      h('a', { href: classHash(rp.class, isPost ? 'art' : 'chat'), class: 'class-code' }, rp.class),
      badge(rp.count, 'red'),
      rp.deleted ? chip('стёрто автором', 'gone') : rp.hidden ? chip('сейчас скрыто', 'off') : chip('сейчас видно', 'on'),
      h('span', { class: 'muted small' }, ago(rp.last_at, true))),
    h('div', { class: 'report-body' },
      isPost
        ? h('button', { type: 'button', class: 'report-thumb', onclick: () => showDrawing(rp.target, rp.preview, rp.author_name), 'aria-label': 'Открыть рисунок' },
          src ? h('img', { src, alt: '' }) : h('span', { class: 'no-img' }, '🖼'))
        : null,
      h('div', { class: 'report-text' },
        h('div', {}, h('span', { class: 'muted' }, 'Автор: '), user(rp.author_name, 'name'),
          rp.author_visible === false ? [' ', chip('заблокирована', 'off')] : null),
        h('blockquote', { dir: 'auto' }, isPost ? (untitled(rp.preview) ? 'Рисунок без названия' : user(rp.preview)) : previewText(rp.preview),
          notice ? [' ', h('button', { type: 'button', class: 'link', onclick: () => showDrawing(notice, parse(rp.preview)?.what, rp.author_name) }, 'открыть рисунок')] : null),
        h('div', { class: 'small' }, h('span', { class: 'muted' }, 'Пожаловались: '),
          (rp.reporters || []).flatMap((n, i) => (i ? [', ', user(n)] : [user(n)]))))),
    h('div', { class: 'actions' },
      rp.deleted
        // Its author already deleted it: nothing to show or hide, only the report to close.
        ? btn('Закрыть жалобу', async () => {
          if (await change('reports_clear', { kind: rp.kind, target: rp.target }, 'Жалоба закрыта')) reload();
        })
        : [
          // One step on the server: the reports are closed and it stays hidden. A notice hides its drawing first.
          btn(rp.hidden ? 'Оставить скрытым' : 'Скрыть', async () => {
            if (notice && !(await change('post_set', { id: notice, hidden: true }))) return;
            if (await change('reports_clear', { kind: rp.kind, target: rp.target, hidden: true }, `Жалоба закрыта, ${onDrawing ? 'рисунок скрыт' : 'сообщение скрыто'}`)) reload();
          }, 'warn'),
          btn(rp.hidden ? 'Вернуть (жалоба зря)' : 'Жалоба зря', async () => {
            if (!confirm(`Вернуть ${what} всем и закрыть жалобу?`)) return;
            if (await change('reports_clear', { kind: rp.kind, target: rp.target }, back)) reload();
          }),
        ],
      btn('Удалить', async () => {
        if (!confirm(`Удалить ${what} навсегда?${notice ? ' Он пропадёт и из «Рисунков» класса.' : ''}`)) return;
        // The server deletes its reports with it (and the reports of a drawing's notice).
        if (await change(onDrawing ? 'post_delete' : 'msg_delete', { id: onDrawing ? postId : rp.target }, onDrawing ? 'Рисунок удалён' : 'Сообщение удалено')) reload();
      }, 'danger'),
      !rp.author_id ? null : rp.author_visible === false
        ? btn('Разблокировать автора', async () => {
          if (await change('player_set', { id: rp.author_id, visible: true }, `${rp.author_name}: разблокирована`)) reload();
        })
        : btn('Заблокировать автора', async () => {
          if (!confirm(`Заблокировать «${rp.author_name}»? Её рейтинг, рисунки, сообщения и сердечки пропадут у всех.`)) return;
          if (await change('player_set', { id: rp.author_id, visible: false }, `${rp.author_name}: заблокирована`)) reload();
        }, 'warn')));
}

// ---------- Защита ----------

async function protectView(box, r, alive) {
  const [list, words, moves] = await Promise.all([api('classes'), api('words'), api('moves')]);
  if (!alive()) return;
  const star = list.find(c => c.code === '*') || { chat: true, drawings: true, locked: false };
  const reload = () => render(true);
  box.append(
    h('h1', {}, 'Защита'),
    globalSwitches(star, reload),
    wordsCard(words, reload),
    movesCard(moves, list.filter(c => c.code !== '*').map(c => c.code), reload),
    help());
}

function wordsCard(words, reload) {
  const input = h('input', { type: 'text', placeholder: 'слово или =слово', 'aria-label': 'Новое слово', autocapitalize: 'off', spellcheck: 'false', maxlength: 40 });
  const filter = h('input', { type: 'search', placeholder: 'Найти в списке', 'aria-label': 'Найти в списке' });
  const chips = h('div', { class: 'words' });
  const sorted = (words || []).map(w => (typeof w === 'string' ? w : w.word)).filter(Boolean).sort((a, b) => a.replace(/^=/, '').localeCompare(b.replace(/^=/, ''), 'ru'));
  const draw = () => {
    const q = filter.value.trim().toLowerCase();
    const shown = sorted.filter(w => !q || w.includes(q));
    fill(chips, ...shown.map(w => h('span', { class: 'word' }, user(w),
      h('button', { type: 'button', class: 'word-x', 'aria-label': `Убрать ${w}`, title: 'Убрать',
        onclick: async e => {
          e.currentTarget.disabled = true;
          if (!confirm(`Убрать «${w}» из списка?`)) { e.currentTarget.disabled = false; return; }
          if (await change('word_delete', { word: w }, `«${w}» убрано`)) reload();
        } }, '×'))));
    if (!shown.length) chips.append(empty(q ? 'Нет таких.' : 'Список пуст.'));
  };
  filter.addEventListener('input', draw);
  draw();
  const add = async e => {
    e.preventDefault();
    const w = input.value.trim().toLowerCase();
    const core = w.replace(/^=\s*/, '');
    if (core.length < 2 || core.length > 40) { toast('Слово — от 2 до 40 знаков', true); return; }
    if (sorted.includes(w)) { toast('Это слово уже есть'); return; }
    if (await change('word_add', { word: w }, `«${w}» добавлено`)) reload();
  };
  return h('section', { class: 'card' },
    h('h2', {}, `Плохие слова (${sorted.length})`),
    h('p', { class: 'muted' }, 'Сервер заменяет их на *** в именах, сообщениях и названиях рисунков. ',
      'Обычное слово ищется везде, даже внутри других слов, в любом регистре: «дурак» поймает и «дураки». ',
      'Слово со знаком «=» впереди ловится только целиком: «=кот» поймает «кот», но не «котик». ',
      'Пишите строчными буквами. Новое слово действует на новые сообщения, старые не меняются.'),
    h('form', { class: 'row-form', onsubmit: add }, input, h('button', { type: 'submit', class: 'btn primary' }, 'Добавить')),
    sorted.length > 12 ? filter : null,
    chips);
}

function movesCard(moves, codes, reload) {
  const from = h('input', { type: 'text', placeholder: 'откуда (опечатка)', 'aria-label': 'Откуда', autocapitalize: 'off', spellcheck: 'false' });
  const to = h('input', { type: 'text', placeholder: 'куда (настоящий класс)', 'aria-label': 'Куда', autocapitalize: 'off', spellcheck: 'false', list: 'class-codes' });
  const add = async e => {
    e.preventDefault();
    const f = cleanCode(from.value), t = cleanCode(to.value);
    if (!f || !t) { toast('Коды классов — от 4 до 24 латинских букв, цифр и «-»', true); return; }
    if (f === t) { toast('Откуда и куда совпадают', true); return; }
    if (!confirm(`Все, кто в классе ${f} или наберёт этот код, окажутся в ${t}. Продолжить?`)) return;
    if (await change('move_add', { from: f, to: t }, res => `${f} → ${t}: переезд добавлен${res?.moved ? `, переехало ${res.moved}` : ''}`)) reload();
  };
  return h('section', { class: 'card' },
    h('h2', {}, 'Переезды классов'),
    h('p', { class: 'muted' }, 'Если кто-то набрал код с ошибкой, переезд отправит её в правильный класс: и тех, кто уже там, и тех, кто наберёт этот код потом.'),
    moves.length
      ? h('ul', { class: 'moves' }, moves.map(m => h('li', {},
        h('span', { class: 'move' }, h('span', { class: 'class-code' }, m.from), ' → ', h('a', { class: 'class-code', href: classHash(m.to) }, m.to)),
        h('span', { class: 'muted small' },
          `в ${m.to} ${count(m.players_now || 0, 'игрок', 'игрока', 'игроков')}`,
          m.players_from > 0 ? `, в ${m.from} ещё ${m.players_from}` : ''),
        btn('Убрать', async () => {
          if (!confirm(`Убрать переезд ${m.from} → ${m.to}? Те, кто уже переехал, останутся в ${m.to}.`)) return;
          if (await change('move_delete', { from: m.from }, 'Переезд убран')) reload();
        }, 'small'))))
      : empty('Переездов нет.'),
    h('form', { class: 'row-form three', onsubmit: add }, from, to, h('button', { type: 'submit', class: 'btn primary' }, 'Добавить'),
      h('datalist', { id: 'class-codes' }, codes.map(c => h('option', { value: c })))));
}

function help() {
  const item = (title, text) => h('li', {}, h('b', {}, title), ' ', text);
  return h('section', { class: 'card help' },
    h('h2', {}, 'Как устроена защита'),
    h('ul', {},
      item('Только свой класс.', 'Каждый класс видит только себя: свой рейтинг, свой чат и свои рисунки. Попасть в класс можно только по коду из приглашения.'),
      item('Маскировка.', 'Ссылки, телефоны, адреса почты и слова из списка выше сервер заменяет на *** в именах, сообщениях и названиях.'),
      item('Ограничения.', 'Не чаще одного сообщения в 2 секунды, 30 за 10 минут и 300 в день; не больше 10 рисунков в день от игрока и 60 от класса.'),
      item('Две жалобы.', 'Если на сообщение или рисунок пожаловались две разные девочки, оно скрывается у всех и попадает в «Жалобы».'),
      item('Блокировка.', 'Заблокированный игрок продолжает играть, но её рейтинг, рисунки, сообщения и сердечки никто не видит. Ни её сохранения, ни выход и вход заново в настройках её игры блокировку не снимут. Но если на её устройстве стереть данные игры, она вернётся новым игроком: тогда закройте класс для новых. Удаление же не навсегда: игра на её устройстве создаст её заново.'),
      item('Переключатели.', 'Чат и рисунки можно выключить в одном классе или во всех сразу; читать старое при этом можно. «Закрыть для новых» не пускает в класс новых участниц.'),
      item('Сроки.', 'Сообщения хранятся 30 дней, рисунки 90, жалобы 91, журнал 365.')));
}

// ---------- Журнал ----------

const onOff = v => (v ? 'вкл.' : 'выкл.');
function describeLog(row) {
  const a = row.args || {};
  const out = [];
  const used = new Set();
  const take = k => { used.add(k); return a[k]; };
  let what;
  switch (row.action) {
    case 'player_set': {
      what = 'Игрок';
      if ('visible' in a) out.push(take('visible') ? 'разблокирована' : 'заблокирована');
      if ('name' in a) out.push(take('name') == null ? 'имя: своё' : `имя: «${a.name}»`);
      if ('class' in a) out.push(take('class') == null ? 'класс: свой' : `класс: ${a.class}`);
      break;
    }
    case 'player_delete': what = 'Игрок удалён'; break;
    case 'msg_set': what = take('hidden') ? 'Сообщение скрыто' : 'Сообщение показано'; break;
    case 'msg_delete': what = 'Сообщение удалено'; break;
    case 'post_set': what = take('hidden') ? 'Рисунок скрыт' : 'Рисунок показан'; break;
    case 'post_delete': what = 'Рисунок удалён'; break;
    case 'reports_clear': what = take('kind') === 'post' ? 'Жалоба на рисунок закрыта' : 'Жалоба на сообщение закрыта'; break;
    case 'class_set': {
      const c = take('class');
      what = c === '*' ? 'Все классы' : `Класс ${c}`;
      if ('chat' in a) out.push(`чат ${onOff(take('chat'))}`);
      if ('drawings' in a) out.push(`рисунки ${onOff(take('drawings'))}`);
      if ('locked' in a) out.push(`${take('locked') ? 'закрыт' : 'открыт'}${c === '*' ? 'ы' : ''} для новых`);
      if ('note' in a) out.push(`заметка: «${take('note') || ''}»`);
      break;
    }
    case 'class_delete': what = `Класс ${take('class')} удалён`; break;
    case 'word_add': what = `Слово добавлено: «${take('word')}»`; break;
    case 'word_delete': what = `Слово убрано: «${take('word')}»`; break;
    case 'move_add': what = `Переезд ${take('from')} → ${take('to')}`; break;
    case 'move_delete': what = `Переезд из ${take('from')} убран`; break;
    default: what = row.action || '?';
  }
  if (row.action === 'reports_clear' && take('hidden') === true) out.push('оставлено скрытым');
  // Who or what it was about, as it was then (the server keeps a name or a title with the row).
  if (row.about) { used.add('id'); used.add('target'); out.unshift(row.about); }
  for (const [k, v] of Object.entries(a)) {
    if (used.has(k)) continue;
    if (k === 'id' || k === 'target') out.push(`№ ${String(v).length > 12 ? String(v).slice(0, 8) + '…' : v}`);
    else out.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
  return [what, out.join(', ')];
}

async function logView(box, r, alive) {
  const rows = await api('log', { limit: 300 });
  if (!alive()) return;
  // Whose key did it: worth showing only when there is more than one key.
  const keys = new Set(rows.map(x => x.who).filter(Boolean));
  box.append(
    h('h1', {}, 'Журнал'),
    h('p', { class: 'muted' }, 'Всё, что меняли на этой странице, новое сверху. Хранится год.'),
    rows.length
      ? h('section', { class: 'card' }, h('ol', { class: 'log' }, rows.map(row => {
        const [what, details] = describeLog(row);
        return h('li', {},
          h('time', { datetime: row.at, title: fullDate(new Date(row.at)) }, fullDate(new Date(row.at))),
          h('span', { class: 'log-what' }, h('b', {}, what), details ? h('span', { class: 'log-details' }, ': ', user(details)) : null,
            row.who && keys.size > 1 ? h('span', { class: 'muted small' }, ' · ключ «', user(row.who), '»') : null));
      })))
      : empty('Пока ничего не меняли.'));
}

// ---------- start ----------

takeKeyFromAddress();
addEventListener('hashchange', () => {
  if (/^#key=/.test(location.hash)) { takeKeyFromAddress(); render(); return; }
  closeModal();
  render();
});
if (!location.hash || location.hash === '#') history.replaceState(null, '', location.pathname + location.search + '#/overview');
render();
