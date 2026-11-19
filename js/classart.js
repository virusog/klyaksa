// The class drawings: what classmates showed, with hearts, and the "best of the week".
// Also the way a drawing gets there (from this tab or from the art view in the gallery).
import { h, canvas, blobOf, loadImg } from './util.js';
import { state, save, db } from './store.js';
import { t } from './i18n.js';
import { inClass, syncNow, addPost, loadPosts, postImage, likePost, deletePost, report, netError, switches, onSwitches, classLocked } from './player.js';
import { btn, mascot, toast, confirmBox, icon } from './ui.js';
import { sfx } from './audio.js';

const jpegUrl = b64 => `data:image/jpeg;base64,${b64}`;
// Post titles are the Russian names the app gives pictures, so each reader sees her own language.
// A free drawing is saved as "Мой рисунок": a classmate sees it as just "Рисунок", not as hers.
export const untitled = s => !s || s === 'Мой рисунок'; // i18n-skip: the saved name, compared
export const postTitle = (title, mine) => (untitled(title) ? (mine ? t('Мой рисунок') : t('Рисунок')) : t(title));
// A colouring made from a photo keeps the photo's outlines (her face, her house): it stays at home.
export const fromPhoto = rec => !!rec?.photo || rec?.title === 'Моё фото'; // i18n-skip: the saved name, compared

// One JPEG no bigger than max bytes: the quality goes down first, then the size.
// The sheet is white first, because a transparent PNG would turn black in a JPEG.
async function jpeg(img, side, quality, max) {
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  for (let i = 0; i < 14; i++) {
    const k = Math.min(1, side / Math.max(w0, h0));
    const c = canvas(Math.max(1, Math.round(w0 * k)), Math.max(1, Math.round(h0 * k)));
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    const blob = await blobOf(c, 'image/jpeg', quality);
    if (blob && blob.size <= max) return { blob, w: c.width, h: c.height };
    if (quality > 0.55) quality -= 0.1; else side = Math.round(side * 0.85);
  }
  throw new Error('the picture does not get small enough');
}

const base64 = blob => new Promise((res, rej) => {
  const f = new FileReader();
  f.onload = () => res(String(f.result).split(',')[1] || '');
  f.onerror = () => rej(f.error);
  f.readAsDataURL(blob);
});

// The server takes a picture up to 450 000 bytes and a thumbnail up to 45 000; a margin stays.
export async function prepareImage(full) {
  const img = await loadImg(full);
  const big = await jpeg(img, 1024, 0.8, 430000);
  const small = await jpeg(img, 360, 0.7, 42000);
  return { image: await base64(big.blob), thumb: await base64(small.blob), w: big.w, h: big.h };
}

// Showing drawings to the class is switched off by the grown-ups on the server.
export const drawingsOff = () => t('Показывать рисунки сейчас нельзя: взрослые выключили.');

// posting: the limit she can reach by posting is the day's number of drawings.
function failText(e, posting) {
  const why = netError(e);
  if (why === 'offline') return t('Нет связи. Попробуй позже.');
  if (why === 'off' && posting) return drawingsOff();
  if (why === 'limit') return posting ? t('На сегодня хватит рисунков. Завтра можно ещё!') : t('Не так быстро! Подожди немного.');
  return t('Не получилось. Попробуй ещё раз.');
}

// Shows one of her gallery pictures to the class. Asks first; true when it went.
export async function shareArt(rec) {
  if (!inClass() || !rec?.full) return false;
  if (fromPhoto(rec)) { toast(t('Рисунки из фото остаются только у тебя')); return false; }
  if (switches.drawings === false) { toast(drawingsOff(), 5000); return false; }
  if (classLocked()) { toast(t('Этот класс закрыт для новых участниц. Спроси учительницу или родителей.'), 6000); return false; }
  const again = (state.shared || []).includes(rec.id);
  const ask = again ? t('Этот рисунок уже в классе. Показать ещё раз?') : t('Показать этот рисунок всему классу?');
  if (!(await confirmBox(ask, t('Показать'), t('Отмена')))) return false;
  toast(t('Отправляю рисунок…'));
  try {
    const img = await prepareImage(rec.full);
    // A new player must exist on the server before she can post.
    await syncNow();
    await addPost({ title: rec.title || '', ...img });
  } catch (e) {
    console.warn(e);
    toast(failText(e, true), 5000);
    return false;
  }
  state.shared = [...(state.shared || []).filter(id => id !== rec.id), rec.id].slice(-200);
  save();
  sfx.win();
  toast(t('Рисунок теперь в классе!'));
  return true;
}

// Her gallery, to choose what to show. Resolves when she has shared one (true) or closed it.
async function pickArt() {
  const items = (await db.all('art')).filter(it => it.thumb && it.full && it.kind !== 'anim' && !fromPhoto(it))
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return new Promise(done => {
    const urls = [];
    const close = v => { o.remove(); urls.forEach(u => URL.revokeObjectURL(u)); done(v); };
    const grid = h('div', { class: 'pick-art-grid' }, items.map(it => {
      const url = URL.createObjectURL(it.thumb);
      urls.push(url);
      return h('button', {
        class: `pick-art ${(state.shared || []).includes(it.id) ? 'shared' : ''}`,
        'aria-label': t(it.title),
        onclick: async () => {
          sfx.pop();
          o.classList.add('hidden');
          const ok = await shareArt(it);
          if (ok) close(true); else if (switches.drawings === false) close(false); else o.classList.remove('hidden');
        },
      }, h('img', { src: url, alt: '' }), h('span', {}, t(it.title)));
    }));
    const o = h('div', { class: 'modal-back' }, h('div', { class: 'modal share-pick' },
      h('h2', {}, t('Какой рисунок показать классу?')),
      items.length ? grid : h('div', { class: 'class-empty' }, mascot('wow'), h('p', {}, t('В твоей галерее пока нет рисунков.')),
        h('a', { class: 'btn primary', href: '#/studio/new' }, t('Рисовать'))),
      btn('ghost', t('Отмена'), () => close(false)),
    ));
    document.body.append(o);
  });
}

export function artTab(host, openId) {
  let sort = openId ? 'new' : sessionStorage.getItem('classArtSort') === 'week' ? 'week' : 'new';
  let posts = null;
  let failed = false;
  let alive = true;
  let gen = 0;
  let wanted = openId ? +openId : 0;
  const tabs = h('div', { class: 'tabs art-sort' });
  const body = h('div', { class: 'art-body' });
  const share = btn('primary class-share', [icon('plus', 22), t('Показать свой рисунок')], async () => {
    if (await pickArt()) { sort = 'new'; sessionStorage.setItem('classArtSort', sort); load(); }
  });
  // Switched off by the grown-ups: the drawings stay to look at, the button gives way to a note.
  const off = h('p', { class: 'class-off-note', role: 'status' }, drawingsOff());
  const applySwitch = () => {
    const on = switches.drawings !== false;
    share.classList.toggle('hidden', !on);
    off.classList.toggle('hidden', on);
  };
  applySwitch();
  const offSwitch = onSwitches(applySwitch);

  // Every place that shows one post's hearts (its card, the open dialog) redraws together.
  const views = new Map();
  const redrawHearts = p => views.get(p.id)?.forEach(fn => fn());
  const watch = (p, fn) => {
    if (!views.has(p.id)) views.set(p.id, new Set());
    views.get(p.id).add(fn);
    fn();
  };

  function hearts(p) {
    let el;
    if (p.mine) {
      // Her own drawing: she sees the hearts but cannot give herself one.
      el = h('span', { class: 'hearts-count', 'aria-label': t('Сердечки') });
      el.draw = () => { el.textContent = `${p.hearts ? '❤️' : '🤍'} ${p.hearts}`; };
    } else {
      el = h('button', { class: 'heart', 'aria-label': t('Сердечко'), onclick: () => toggle(p) });
      el.draw = () => {
        el.classList.toggle('on', !!p.liked);
        el.setAttribute('aria-pressed', p.liked ? 'true' : 'false');
        el.textContent = `${p.liked ? '❤️' : '🤍'} ${p.hearts}`;
      };
    }
    watch(p, el.draw);
    return el;
  }

  async function toggle(p) {
    if (p.busy) return;
    p.busy = true;
    const was = { liked: p.liked, hearts: p.hearts };
    p.liked = !p.liked;
    p.hearts = Math.max(0, p.hearts + (p.liked ? 1 : -1));
    if (p.liked) sfx.ding(); else sfx.pop();
    redrawHearts(p);
    try {
      const r = await likePost(p.id, p.liked);
      p.hearts = +r?.hearts || 0;
      p.liked = !!r?.liked;
    } catch (e) {
      Object.assign(p, was);
      toast(failText(e));
    }
    p.busy = false;
    redrawHearts(p);
  }

  function drop(p) {
    posts = posts.filter(x => x.id !== p.id);
    render();
  }

  function openPost(p) {
    sfx.pop();
    const title = postTitle(p.title, p.mine);
    const img = h('img', { class: 'post-full', src: jpegUrl(p.thumb), alt: title });
    const heart = hearts(p);
    const close = () => { o.remove(); views.get(p.id)?.delete(heart.draw); };
    const o = h('div', { class: 'modal-back post-back', onclick: e => { if (e.target === o) close(); } },
      h('div', { class: 'modal post-modal' },
        h('div', { class: 'post-frame', dir: 'ltr' }, img),
        h('h2', { class: 'post-title' }, title),
        h('p', { class: 'post-by' }, h('span', { class: 'post-avatar' }, p.avatar), h('bdi', { class: 'post-name' }, p.name)),
        h('div', { class: 'row wrap' },
          heart,
          p.mine
            ? btn('ghost', t('Убрать из класса'), async () => {
              if (!(await confirmBox(t('Убрать рисунок из класса? В твоей галерее он останется.'), t('Убрать'), t('Оставить')))) return;
              try { await deletePost(p.id); } catch (e) { toast(failText(e)); return; }
              close();
              drop(p);
              toast(t('Рисунок убран из класса'));
            })
            : btn('ghost', t('Пожаловаться'), async () => {
              if (!(await confirmBox(t('Пожаловаться на этот рисунок? Ты его больше не увидишь.'), t('Пожаловаться'), t('Отмена')))) return;
              try { await report('post', p.id); } catch (e) { toast(failText(e)); return; }
              close();
              drop(p);
              toast(t('Ты это больше не увидишь. Если обижают, скажи маме или учительнице.'), 5000);
            }),
          btn('primary', t('Закрыть'), close),
        ),
      ));
    document.body.append(o);
    // The big picture comes only when someone opens it: the list carries thumbnails.
    postImage(p.id).then(r => { if (r?.image && o.isConnected) img.src = jpegUrl(r.image); }).catch(() => {});
  }

  function card(p, i) {
    const title = postTitle(p.title, p.mine);
    const crown = sort === 'week' && i < 3 && p.hearts > 0;
    return h('article', { class: `post-card ${p.mine ? 'mine' : ''}`, 'data-post': p.id },
      h('button', { class: 'post-pic', 'aria-label': title, onclick: () => openPost(p) },
        h('img', { src: jpegUrl(p.thumb), alt: '', loading: 'lazy' }),
        crown ? h('span', { class: 'post-crown', 'aria-hidden': 'true' }, '👑') : null),
      h('div', { class: 'post-info' },
        h('b', { class: 'post-title' }, title),
        h('div', { class: 'post-foot' },
          h('span', { class: 'post-by' }, h('span', { class: 'post-avatar' }, p.avatar), h('bdi', { class: 'post-name' }, p.name)),
          hearts(p))));
  }

  function render() {
    tabs.textContent = '';
    for (const [k, label] of [['new', t('Новые')], ['week', t('Лучшие за неделю')]]) {
      tabs.append(h('button', {
        class: `tab ${k === sort ? 'on' : ''}`,
        onclick: () => { if (k === sort) return; sfx.pop(); sort = k; sessionStorage.setItem('classArtSort', k); load(); },
      }, label));
    }
    body.textContent = '';
    views.clear();
    if (failed) {
      body.append(h('div', { class: 'class-empty' }, mascot('wow'), h('p', {}, t('Рисунки не загрузились. Нужен интернет.')),
        btn('primary', t('Попробовать ещё раз'), load)));
      return;
    }
    if (!posts) {
      body.append(h('div', { class: 'class-empty' }, mascot('happy'), h('p', {}, t('Загружаю рисунки…'))));
      return;
    }
    if (!posts.length) {
      body.append(h('div', { class: 'class-empty' }, mascot('wow'),
        h('p', {}, sort === 'week' ? t('На этой неделе рисунков пока нет. Покажи свой первой!') : t('Здесь пока нет рисунков. Покажи свой первой!'))));
      return;
    }
    body.append(h('div', { class: 'post-grid' }, posts.map(card)));
    if (sort === 'week') body.append(h('p', { class: 'note' }, t('Неделя начинается в воскресенье.')));
  }

  async function load() {
    const my = ++gen;
    failed = false;
    posts = null;
    render();
    try {
      await syncNow();
      const got = await loadPosts(sort);
      if (!alive || my !== gen) return;
      posts = Array.isArray(got) ? got : [];
    } catch {
      if (!alive || my !== gen) return;
      failed = true;
    }
    render();
    if (!posts) return;
    // Seen up to the newest drawing: the home tile stops saying "new".
    const top = Math.max(0, ...posts.map(p => +p.id || 0));
    if (top > (state.seenPost || 0)) { state.seenPost = top; save(); }
    // Came from a notice in the chat: that drawing opens at once.
    if (wanted) {
      const p = posts.find(x => +x.id === wanted);
      wanted = 0;
      history.replaceState(null, '', '#/class/art');
      if (p) openPost(p); else toast(t('Этого рисунка уже нет в классе.'));
    }
  }

  host.append(h('div', { class: 'class-scroll' },
    h('div', { class: 'art-head' }, tabs, share, off),
    body));
  load();
  return { reload: load, stop: () => { alive = false; offSwitch(); } };
}
