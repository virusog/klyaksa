// The class rating: who has the most stars this week and over all time.
import { h } from './util.js';
import { state } from './store.js';
import { t, plural } from './i18n.js';
import { loadBoard, syncNow } from './player.js';
import { topbar, btn, iconBtn, starBadge, mascot, speaker } from './ui.js';
import { sfx } from './audio.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export function rating(root) {
  let tab = sessionStorage.getItem('ratingTab') === 'all' ? 'all' : 'week';
  let rows = null;
  let failed = false;
  let alive = true;
  const body = h('div', { class: 'rating-body' });
  const tabs = h('div', { class: 'tabs rating-tabs' });

  const score = r => (tab === 'week' ? r.week : r.stars);

  function render() {
    tabs.textContent = '';
    for (const [k, label] of [['week', t('За неделю')], ['all', t('За всё время')]]) {
      tabs.append(h('button', {
        class: `tab ${k === tab ? 'on' : ''}`,
        onclick: () => { sfx.pop(); tab = k; sessionStorage.setItem('ratingTab', k); render(); },
      }, label));
    }
    body.textContent = '';
    if (!state.rated) {
      body.append(h('div', { class: 'rating-empty' }, mascot('wow'),
        h('p', {}, t('Ты сейчас не участвуешь в рейтинге.')),
        h('small', {}, t('Включить можно в разделе «Для родителей».'))));
      return;
    }
    if (failed) {
      body.append(h('div', { class: 'rating-empty' }, mascot('wow'),
        h('p', {}, t('Рейтинг не загрузился. Нужен интернет.')),
        btn('primary', t('Попробовать ещё раз'), load)));
      return;
    }
    if (!rows) {
      body.append(h('div', { class: 'rating-empty' }, mascot('happy'), h('p', {}, t('Загружаю рейтинг…'))));
      return;
    }
    const list = [...rows].sort((a, b) => score(b) - score(a) || b.stars - a.stars);
    // Equal scores share a place, so nobody is behind a friend with the same stars.
    let place = 0, prev = null;
    list.forEach((r, i) => {
      if (score(r) !== prev) { place = i + 1; prev = score(r); }
      r.place = place;
    });
    const mine = list.find(r => r.me);
    let headline;
    if (!mine) headline = t('Тебя ещё нет в рейтинге. Получи звезду, и ты появишься!');
    else if (mine.place === 1) headline = t('Ты на первом месте! Так держать!');
    else {
      const ahead = list.filter(r => score(r) > score(mine)).pop();
      headline = t('Ты на {place} месте. Ещё {gap} ★ — и ты догонишь {name}!',
        { place: mine.place, gap: score(ahead) - score(mine), name: `⁨${ahead.name}⁩` });  // isolated, so a Latin name keeps Hebrew punctuation in place
    }
    body.append(
      speaker(headline, mine?.place === 1 ? 'joy' : 'happy'),
      h('p', { class: 'rating-count' }, plural(list.length, '{n} участница|{n} участницы|{n} участниц')),
      h('ol', { class: 'rating-list' }, list.map(r => h('li', { class: `rating-row ${r.me ? 'me' : ''} ${r.place <= 3 ? 'top' : ''}` },
        h('span', { class: 'rating-place' }, r.place <= 3 ? MEDALS[r.place - 1] : String(r.place)),
        h('span', { class: 'rating-avatar' }, r.avatar),
        h('span', { class: 'rating-name' }, h('bdi', {}, r.name), r.me ? h('em', {}, t('это ты')) : null),
        h('span', { class: 'rating-stars' }, h('b', {}, String(score(r))), '★'),
      ))),
      tab === 'week' ? h('p', { class: 'note' }, t('Неделя начинается в воскресенье.')) : null,
    );
  }

  async function load() {
    failed = false;
    rows = null;
    render();
    try {
      await syncNow();
      const got = await loadBoard();
      if (!alive) return;
      rows = got;
    } catch {
      if (!alive) return;
      failed = true;
    }
    render();
  }

  root.append(h('div', { class: 'screen scroll hub rating' },
    topbar(t('Рейтинг'), { right: [iconBtn('undo', t('Обновить'), load), starBadge()] }),
    tabs,
    body,
  ));
  load();
  return () => { alive = false; };
}
