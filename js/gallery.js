// Everything she has made, plus time-lapse playback.
import { h, canvas, loadImg } from './util.js';
import { Painter, replay } from './painter.js';
import { db } from './store.js';
import { topbar, btn, icon, iconBtn, confirmBox, shareBlob, mascot, toast } from './ui.js';
import { HABITATS, makeCreature } from './world.js';

export async function gallery(root) {
  const items = (await db.all('art')).filter(it => it.thumb).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const grid = h('div', { class: 'wall' });
  items.forEach((it, i) => {
    grid.append(h('a', { class: 'frame', href: it.kind === 'anim' ? `#/game/anim/${it.id}` : `#/art/${it.id}`, style: { '--r': `${((i * 37) % 7) - 3}deg` } },
      h('img', { src: URL.createObjectURL(it.thumb), alt: it.title }),
      h('span', {}, it.title),
    ));
  });
  root.append(h('div', { class: 'screen scroll gallery' },
    topbar('Моя галерея'),
    items.length ? grid : h('div', { class: 'empty' }, mascot('wow'), h('p', {}, 'Тут будут висеть твои картины. Начнём с первой?'),
      h('a', { class: 'btn primary', href: '#/studio/new' }, 'Рисовать')),
  ));
}

async function flatLayers(rec) {
  const c = canvas(rec.w, rec.h);
  const x = c.getContext('2d', { willReadFrequently: true });
  for (const b of rec.data.layers) {
    if (b) x.drawImage(await loadImg(b), 0, 0);
  }
  return c;
}

function worldChooser(rec) {
  const o = h('div', { class: 'modal-back' },
    h('div', { class: 'modal' },
      mascot('joy'),
      h('p', {}, 'Куда выпустить?'),
      h('div', { class: 'row wrap' },
        Object.entries(HABITATS).map(([k, v]) => btn('primary', v.name, async () => {
          o.remove();
          const c = await flatLayers(rec);
          const made = await makeCreature(c, k);
          if (made) location.hash = `#/world/${k}`;
          else toast('Тут пока нечего оживлять');
        })),
        btn('ghost', 'Отмена', () => o.remove()),
      ),
    ),
  );
  document.body.append(o);
}

export async function artView(root, id, action) {
  const rec = await db.get('art', id);
  if (!rec) { location.hash = '#/gallery'; return undefined; }
  if (rec.kind === 'anim') { location.hash = `#/game/anim/${id}`; return undefined; }
  const hasLog = rec.data?.log?.length > 0;
  let stop = () => {};
  let painter = null;

  const stageEl = h('div', { class: 'art-stage' });
  const showStill = () => {
    stageEl.textContent = '';
    stageEl.classList.remove('stage');
    stageEl.append(h('img', { src: URL.createObjectURL(rec.full), class: 'art-full', alt: rec.title }));
  };

  function play() {
    stop();
    painter?.destroy();
    stageEl.textContent = '';
    painter = new Painter(stageEl, { w: rec.w, h: rec.h, layers: rec.layersN || 3, paper: rec.data.paper || 'white' });
    painter.enabled = false;
    stop = replay(painter, rec.data.log, { seconds: Math.min(16, 6 + rec.data.log.length * 0.08) });
  }

  const actions = [
    hasLog && btn('accent', [icon('film', 22), ' Как я рисовала'], play),
    rec.data && rec.kind === 'studio' && h('a', { class: 'btn ghost', href: `#/studio/${rec.id}` }, icon('brush', 22), ' Дорисовать'),
    rec.data && h('button', { class: 'btn ghost', onclick: () => worldChooser(rec) }, icon('fish', 22), ' Оживить'),
    btn('ghost', [icon('share', 22), ' В Фото'], () => shareBlob(rec.full, `${rec.title}.png`)),
    iconBtn('trash', 'Удалить', async () => {
      if (await confirmBox('Удалить эту картину навсегда?', 'Удалить', 'Оставить')) {
        await db.del('art', id);
        location.hash = '#/gallery';
      }
    }),
  ];

  root.append(h('div', { class: 'screen art-view' },
    topbar(rec.title, { back: '#/gallery' }),
    stageEl,
    h('footer', { class: 'art-actions' }, actions),
  ));
  showStill();
  if (action === 'replay' && hasLog) play();

  return () => { stop(); painter?.destroy(); };
}
