// Free drawing: the full set of brushes, layers, symmetry, stickers.
import { h, blobOf, svgEl } from './util.js';
import { Painter, PAPERS, SYMMETRY } from './painter.js';
import { db, newId, state, awardOnce, hasReward } from './store.js';
import { STICKERS } from './art.js';
import { t, N } from './i18n.js';
import {
  brushRail, paletteBar, sizeSlider, iconBtn, btn, topbar, popover, closePop, toast, confirmBox, celebrate, autosaver, safeSave,
} from './ui.js';

const ALL = ['pencil', 'pen', 'marker', 'highlighter', 'watercolor', 'crayon', 'chalk', 'spray',
  'glitter', 'rainbow', 'neon', 'hearts', 'stars', 'fur', 'bubbles',
  'calligraphy', 'leaves', 'confetti', 'dashed', 'snow', 'pixel', 'eraser'];

export async function saveArt(p, meta) {
  const id = meta.id || newId('art');
  // Cleared first, so a stroke finished during the save still counts as unsaved.
  p.dirty = false;
  try {
    const data = await p.serialize();
    const [thumb, full] = await Promise.all([blobOf(p.thumb()), blobOf(p.flatten())]);
    const old = meta.id ? await db.get('art', id) : null;
    await db.put('art', {
      created: old?.created || Date.now(),
      ...meta,
      title: meta.title || old?.title || N('Мой рисунок'),
      id, updated: Date.now(), thumb, full, data, w: p.w, h: p.h,
    });
  } catch (e) {
    p.dirty = true;
    throw e;
  }
  return id;
}

export function studio(root, editId) {
  let artId = editId && editId !== 'new' ? editId : null;
  const prompt = sessionStorage.getItem('prompt');
  sessionStorage.removeItem('prompt');

  const stageEl = h('div', { class: 'stage-host' });
  const undoBtn = iconBtn('undo', t('Отменить'), () => { p.undo(); sync(); });
  const redoBtn = iconBtn('redo', t('Вернуть'), () => { p.redo(); sync(); });

  const symGuide = svgEl('svg', { class: 'sym-guide', viewBox: '0 0 1600 1200' });

  const sync = () => {
    undoBtn.disabled = !p.undoStack.length;
    redoBtn.disabled = !p.redoStack.length;
    rail.mark();
    size.sync();
    fillBtn.classList.toggle('on', p.mode === 'fill');
    pickBtn.classList.toggle('on', p.mode === 'pick');
    stickerBtn.classList.toggle('on', p.mode === 'sticker');
    shapeBtn.classList.toggle('on', p.mode === 'shape');
  };

  const p = new Painter(stageEl, {
    w: 1600, h: 1200, layers: 3, onChange: () => sync(),
    onPick: c => { pal.set(c); sync(); toast(t('Цвет взят!')); },
  });
  p.active = 1;
  p.over.append(symGuide);

  const rail = brushRail(p, ALL, { onPick: () => sync() });
  const pal = paletteBar(p, { onPick: () => { rail.redraw(); sync(); } });
  const size = sizeSlider(p);

  const drawSym = () => {
    symGuide.textContent = '';
    const S = SYMMETRY[p.sym];
    if (S.n === 1) return;
    const add = (x1, y1, x2, y2) => symGuide.append(svgEl('line', { x1, y1, x2, y2 }));
    if (p.sym === 'v') add(800, 0, 800, 1200);
    else if (p.sym === 'quad') { add(800, 0, 800, 1200); add(0, 600, 1600, 600); }
    else {
      for (let i = 0; i < S.n; i++) {
        const a = (i / S.n) * Math.PI * 2;
        add(800, 600, 800 + Math.cos(a) * 1100, 600 + Math.sin(a) * 1100);
      }
    }
  };

  const fillBtn = iconBtn('fill', t('Заливка'), () => { p.mode = p.mode === 'fill' ? 'draw' : 'fill'; sync(); });
  const pickBtn = iconBtn('pick', t('Пипетка'), () => { p.mode = p.mode === 'pick' ? 'draw' : 'pick'; sync(); });
  const stickerBtn = iconBtn('sticker', t('Наклейки'), e => stickerPop(e.currentTarget));

  function stickerPop(a) {
    const grid = h('div', { class: 'sticker-grid' });
    const tabs = h('div', { class: 'tabs small' });
    const show = key => {
      grid.textContent = '';
      for (const s of STICKERS[key].list) {
        grid.append(h('button', {
          class: 'sticker',
          onclick: () => {
            p.mode = 'sticker';
            p.sticker = s;
            p.stickerSize = Math.max(90, p.size * 3);
            closePop();
            sync();
            toast(t('Коснись холста, потащи и отпусти'));
          },
        }, s));
      }
      [...tabs.children].forEach(c => c.classList.toggle('on', c.dataset.k === key));
    };
    for (const [k, v] of Object.entries(STICKERS)) {
      const open = !v.prize || hasReward(k);
      tabs.append(h('button', {
        class: `tab ${open ? '' : 'dim'}`, 'data-k': k,
        onclick: () => (open ? show(k) : toast(t('Эти наклейки — подарок за звёзды ★'))),
      }, t(v.name)));
    }
    popover(a, h('div', { class: 'pop-stickers' }, tabs, grid));
    show('animals');
  }

  function symPop(a) {
    popover(a, h('div', { class: 'pop-list' }, Object.entries(SYMMETRY).map(([k, v]) =>
      h('button', {
        class: `pick ${p.sym === k ? 'on' : ''}`,
        onclick: () => { p.sym = k; drawSym(); closePop(); symBtn.classList.toggle('on', k !== 'none'); },
      }, t(v.name)))));
  }

  function paperPop(a) {
    popover(a, h('div', { class: 'paper-grid' }, Object.entries(PAPERS).map(([k, v]) =>
      h('button', {
        class: `paper-chip ${p.paper === k ? 'on' : ''}`,
        style: { background: v.color },
        onclick: () => {
          p.setPaper(k);
          p.dirty = true;
          closePop();
          if (k === 'night' && p.color === '#2a2140') { pal.set('#ffffff'); rail.redraw(); }
        },
      }, h('span', { style: { color: k === 'night' ? '#fff' : '#2a2140' } }, t(v.name))))));
  }

  function layersPop(a) {
    const names = [N('Фон'), N('Рисунок'), N('Верх')];
    const box = h('div', { class: 'pop-list wide' });
    const build = () => {
      box.textContent = '';
      for (let i = 2; i >= 0; i--) {
        const L = p.layers[i];
        const th = document.createElement('canvas');
        th.width = 96; th.height = 72;
        th.getContext('2d').drawImage(L.c, 0, 0, 96, 72);
        box.append(h('div', { class: `layer-row ${p.active === i ? 'on' : ''}` },
          h('button', { class: 'layer-pick', onclick: () => { p.active = i; build(); } }, th, h('b', {}, t(names[i]))),
          iconBtn(L.visible ? 'eye' : 'eyeoff', t('Показать'), () => {
            L.visible = !L.visible;
            L.c.style.visibility = L.visible ? 'visible' : 'hidden';
            build();
          }),
          iconBtn('trash', t('Очистить слой'), async () => {
            if (await confirmBox(t('Очистить слой «{name}»?', { name: t(names[i]) }))) { p.clearLayer(i); build(); }
          }),
        ));
      }
    };
    build();
    popover(a, box);
  }

  const symBtn = iconBtn('sym', t('Симметрия'), e => symPop(e.currentTarget));

  // Even shapes drawn with the current brush: drag from corner to corner.
  const SHAPES = [['', N('Рисую рукой')], ['line', N('Ровная линия')], ['rect', N('Прямоугольник')], ['oval', N('Овал и круг')], ['tri', N('Треугольник')]];
  function shapePop(a) {
    popover(a, h('div', { class: 'pop-list' }, SHAPES.map(([k, name]) =>
      h('button', {
        class: `pick ${(p.mode === 'shape' ? p.shape : '') === k ? 'on' : ''}`,
        onclick: () => {
          if (k) { p.shape = k; p.mode = 'shape'; toast(t('Проведи по холсту от угла до угла')); } else p.mode = 'draw';
          closePop();
          sync();
        },
      }, t(name)))));
  }
  const shapeBtn = iconBtn('shape', t('Фигуры'), e => shapePop(e.currentTarget));

  let closed = false;
  async function persist() {
    artId = await saveArt(p, { id: artId, kind: 'studio', title: prompt || undefined, layersN: 3 });
    if (!closed && location.hash === '#/studio/new') history.replaceState(null, '', `#/studio/${artId}`);
  }
  const saver = autosaver(() => p.dirty && p.log.length > 0, persist, () => p.isBusy());

  const done = btn('primary', t('Готово'), async () => {
    if (!p.log.length) { toast(t('Сначала что-нибудь нарисуй!')); return; }
    await safeSave(saver.flush);
    const r = awardOnce('studio');
    celebrate({
      title: t('Красота, {name}!', { name: state.name }),
      text: r.gain ? t('Рисунок в галерее. Держи звезду за сегодняшнее творчество.') : t('Рисунок в галерее.'),
      unlocked: r.unlocked,
      actions: [
        { label: t('Рисовать дальше') },
        { label: t('В галерею'), primary: true, fn: () => { location.hash = `#/art/${artId}`; } },
      ],
    });
  });

  root.append(h('div', { class: 'screen studio' },
    topbar(prompt ? t('Тема: {theme}', { theme: t(prompt) }) : t('Мастерская'), {
      right: [undoBtn, redoBtn, fillBtn, pickBtn, shapeBtn, stickerBtn, symBtn,
        iconBtn('layers', t('Слои'), e => layersPop(e.currentTarget)),
        iconBtn('paper', t('Бумага'), e => paperPop(e.currentTarget)),
        done],
    }),
    h('div', { class: 'studio-main' }, rail, stageEl),
    h('footer', { class: 'tools-foot' }, size, pal),
  ));
  p.fit();
  sync();

  if (artId) {
    db.get('art', artId).then(rec => {
      if (rec?.data) return p.restore(rec.data).then(sync);
      return null;
    });
  }

  return () => {
    closed = true;
    closePop();
    saver.stop();
    safeSave(saver.flush).catch(() => {}).finally(() => p.destroy());
  };
}
