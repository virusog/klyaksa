// The living world: what she draws starts to swim, fly and hop.
import { h, canvas, blobOf, loadImg, clamp, pick } from './util.js';
import { Painter } from './painter.js';
import { db, newId, awardOnce } from './store.js';
import { topbar, btn, iconBtn, brushRail, paletteBar, sizeSlider, celebrate, confirmBox, toast, speaker, autosaver, safeSave } from './ui.js';
import { sfx } from './audio.js';
import moreGuides from './content/world-guides.js';

export const HABITATS = {
  sea: { name: 'Море', who: 'рыбку', hint: 'Нарисуй морского жителя. Пусть смотрит направо!',
    guide: 'M180 300C300 110 560 130 640 300C560 470 300 490 180 300ZM180 300L60 190L95 300L60 410Z' },
  sky: { name: 'Небо', who: 'птичку', hint: 'Нарисуй того, кто летает. Крылья пошире, голова справа!',
    guide: 'M400 310C330 180 200 150 90 190C160 260 250 330 340 360C400 390 500 380 560 320C600 300 650 290 690 300C650 250 590 240 540 260C500 200 460 230 400 310Z' },
  land: { name: 'Луг', who: 'зверька', hint: 'Нарисуй зверя, который живёт на лугу. Лапы внизу, голова справа!',
    guide: 'M180 330C180 230 300 200 420 220C450 140 590 130 620 220C650 300 590 350 530 360V500H470V380H290V500H230V370C200 370 180 350 180 330Z' },
};

for (const [k, list] of Object.entries(moreGuides)) HABITATS[k].guides = [{ name: HABITATS[k].who, d: HABITATS[k].guide }, ...list];

function alphaBox(ctx, w, ht) {
  const d = ctx.getImageData(0, 0, w, ht).data;
  let x0 = w, y0 = ht, x1 = -1, y1 = -1;
  for (let y = 0; y < ht; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(x + y * w) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

// An outline with an empty middle would be see-through, so closed shapes get a white body.
function solidify(c) {
  const x = c.getContext('2d', { willReadFrequently: true });
  const W = c.width, H = c.height;
  const img = x.getImageData(0, 0, W, H);
  const d = img.data;
  const seen = new Uint8Array(W * H);
  const stack = [];
  const open = i => d[i * 4 + 3] < 60;
  const add = i => { if (!seen[i] && open(i)) { seen[i] = 1; stack.push(i); } };
  for (let i = 0; i < W; i++) { add(i); add(W * (H - 1) + i); }
  for (let i = 0; i < H; i++) { add(i * W); add(i * W + W - 1); }
  while (stack.length) {
    const q = stack.pop();
    const xx = q % W;
    if (xx > 0) add(q - 1);
    if (xx < W - 1) add(q + 1);
    if (q >= W) add(q - W);
    if (q < W * (H - 1)) add(q + W);
  }
  for (let i = 0; i < W * H; i++) {
    if (seen[i]) continue;
    const a = d[i * 4 + 3] / 255;
    d[i * 4] = d[i * 4] * a + 255 * (1 - a);
    d[i * 4 + 1] = d[i * 4 + 1] * a + 255 * (1 - a);
    d[i * 4 + 2] = d[i * 4 + 2] * a + 255 * (1 - a);
    d[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
}

export async function makeCreature(source, habitat) {
  const x = source.getContext('2d', { willReadFrequently: true });
  const box = alphaBox(x, source.width, source.height);
  if (!box) return null;
  const pad = 6;
  const raw = canvas(box[2] + pad * 2, box[3] + pad * 2);
  raw.getContext('2d').drawImage(source, box[0], box[1], box[2], box[3], pad, pad, box[2], box[3]);
  solidify(raw);
  const s = Math.min(1, 340 / Math.max(raw.width, raw.height));
  const out = canvas(raw.width * s, raw.height * s);
  const ox = out.getContext('2d');
  ox.imageSmoothingQuality = 'high';
  ox.drawImage(raw, 0, 0, out.width, out.height);
  const rec = { id: newId('w'), habitat, img: await blobOf(out), w: out.width, h: out.height, created: Date.now() };
  await db.put('world', rec);
  return rec;
}

function drawSea(c, W, H, t, deco) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7fd9f5'); g.addColorStop(0.55, '#2f9ddb'); g.addColorStop(1, '#1b6bb0');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.globalAlpha = 0.14;
  c.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) {
    const x = ((i + 0.5) / 5) * W + Math.sin(t * 0.3 + i) * 40;
    c.beginPath();
    c.moveTo(x - 30, 0); c.lineTo(x + 40, 0); c.lineTo(x + 210, H); c.lineTo(x - 170, H);
    c.fill();
  }
  c.globalAlpha = 1;
  c.fillStyle = '#f0d596';
  c.beginPath();
  c.moveTo(0, H);
  c.lineTo(0, H * 0.88);
  for (let x = 0; x <= W + 40; x += 40) c.lineTo(x, H * 0.88 + Math.sin(x * 0.012) * 14);
  c.lineTo(W + 40, H);
  c.fill();
  c.lineCap = 'round';
  for (const s of deco.weeds) {
    c.strokeStyle = s.c;
    c.lineWidth = s.w;
    c.beginPath();
    c.moveTo(s.x, H * 0.92);
    for (let i = 1; i <= 6; i++) {
      const y = H * 0.92 - (i / 6) * s.h;
      c.lineTo(s.x + Math.sin(t * 1.3 + i * 0.8 + s.x) * i * 5, y);
    }
    c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,.75)';
  c.fillStyle = 'rgba(255,255,255,.2)';
  c.lineWidth = 2;
  for (const b of deco.bubbles) {
    const y = ((b.y - t * b.v * 40) % (H + 40) + H + 40) % (H + 40) - 20;
    c.beginPath();
    c.arc(b.x * W + Math.sin(t * 2 + b.y) * 8, y, b.r, 0, 6.3);
    c.fill(); c.stroke();
  }
}

function drawCloud(c, x, y, s) {
  c.beginPath();
  c.arc(x, y, 34 * s, 0, 6.3);
  c.arc(x + 42 * s, y - 16 * s, 42 * s, 0, 6.3);
  c.arc(x + 90 * s, y, 32 * s, 0, 6.3);
  c.rect(x, y - 4 * s, 90 * s, 36 * s);
  c.fill();
}

function drawSky(c, W, H, t, deco) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6ec2f7'); g.addColorStop(1, '#fde7c4');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffd447';
  c.beginPath();
  c.arc(W * 0.85, H * 0.18, 62, 0, 6.3);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.92)';
  for (const k of deco.clouds) drawCloud(c, ((k.x * W + t * k.v * 18) % (W + 300)) - 200, k.y * H, k.s);
}

function drawLand(c, W, H, t, deco) {
  const g = c.createLinearGradient(0, 0, 0, H * 0.6);
  g.addColorStop(0, '#90d6fa'); g.addColorStop(1, '#e0f5ff');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffd447';
  c.beginPath();
  c.arc(W * 0.14, H * 0.16, 56, 0, 6.3);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.92)';
  for (const k of deco.clouds) drawCloud(c, ((k.x * W + t * k.v * 8) % (W + 300)) - 200, k.y * H * 0.5, k.s * 0.8);
  c.fillStyle = '#a4e27f';
  c.beginPath();
  c.moveTo(0, H);
  c.lineTo(0, H * 0.55);
  c.quadraticCurveTo(W * 0.3, H * 0.34, W * 0.6, H * 0.52);
  c.quadraticCurveTo(W * 0.85, H * 0.42, W, H * 0.5);
  c.lineTo(W, H);
  c.fill();
  c.fillStyle = '#78cf55';
  c.fillRect(0, H * 0.6, W, H * 0.4);
  c.strokeStyle = '#5eb843';
  c.lineWidth = 3;
  c.lineCap = 'round';
  for (const s of deco.grass) {
    const y = H * (0.62 + s.y * 0.36);
    c.beginPath();
    c.moveTo(s.x * W, y);
    c.lineTo(s.x * W + Math.sin(t * 1.8 + s.x * 30) * 5, y - 16);
    c.stroke();
  }
  for (const f of deco.flowers) {
    const x = f.x * W, y = H * (0.64 + f.y * 0.32);
    c.fillStyle = f.c;
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.arc(x + Math.cos(i * 1.257 + t * 0.2) * 9, y + Math.sin(i * 1.257 + t * 0.2) * 9, 6.5, 0, 6.3);
      c.fill();
    }
    c.fillStyle = '#ffd447';
    c.beginPath(); c.arc(x, y, 6, 0, 6.3); c.fill();
  }
}

const PAINT = { sea: drawSea, sky: drawSky, land: drawLand };

function makeDeco() {
  const R = Math.random;
  return {
    weeds: Array.from({ length: 12 }, (_, i) => ({ x: 40 + (i * 1300) / 12 + R() * 40, h: 90 + R() * 150, w: 8 + R() * 8, c: pick(['#2fae6a', '#1c8f5a', '#58c07f']) })),
    bubbles: Array.from({ length: 24 }, () => ({ x: R(), y: R() * 1000, r: 3 + R() * 10, v: 0.5 + R() })),
    clouds: Array.from({ length: 6 }, () => ({ x: R(), y: 0.08 + R() * 0.7, s: 0.7 + R() * 1.1, v: 0.5 + R() })),
    grass: Array.from({ length: 90 }, () => ({ x: R(), y: R() })),
    flowers: Array.from({ length: 16 }, () => ({ x: R(), y: R(), c: pick(['#ff8fc7', '#ffffff', '#ff6b5e', '#c9a7ff']) })),
  };
}

export function worldView(root, tab = 'sea') {
  const cv = canvas(10, 10);
  cv.className = 'world-canvas';
  const box = h('div', { class: 'world-box' }, cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, live = true, removing = false;
  const deco = makeDeco();
  let all = [];
  const food = [];
  const hearts = [];

  const resize = () => {
    const r = box.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    for (const c of all) place(c);
  };
  const ro = new ResizeObserver(resize);

  function place(c) {
    c.x ??= Math.random() * W;
    c.x = clamp(c.x, 60, W - 60);
    if (tab === 'land') c.y = H * (0.68 + Math.random() * 0.22);
    else c.y = H * (0.14 + Math.random() * 0.62);
  }

  function spawn(rec, img) {
    const base = rec.habitat === 'sea' ? 0.62 : rec.habitat === 'sky' ? 0.5 : 0.56;
    const c = {
      rec, img, x: undefined, y: 0, phase: Math.random() * 10, jump: 0,
      vx: (Math.random() < 0.5 ? -1 : 1) * (rec.habitat === 'land' ? 28 : 40 + Math.random() * 44),
      scale: base + Math.random() * 0.14, dy: 0,
    };
    place(c);
    all.push(c);
    return c;
  }

  async function load() {
    all = [];
    const list = (await db.all('world')).filter(r => r.habitat === tab);
    for (const r of list) spawn(r, await loadImg(r.img));
    hint.classList.toggle('hidden', list.length > 0);
  }

  function drawStrips(c, cr, dw, dh, offset) {
    const sw = 5;
    const scale = dw / cr.rec.w;
    for (let sx = 0; sx < cr.rec.w; sx += sw) {
      const u = sx / cr.rec.w;
      c.drawImage(cr.img, sx, 0, sw + 1, cr.rec.h, -dw / 2 + sx * scale, -dh / 2 + offset(u), (sw + 1) * scale, dh);
    }
  }

  let last = performance.now();
  function tick(now) {
    if (!live) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    PAINT[tab](ctx, W, H, t, deco);

    if (tab === 'sea') {
      ctx.fillStyle = '#ffcf6b';
      for (let i = food.length - 1; i >= 0; i--) {
        const f = food[i];
        f.y += 34 * dt;
        ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, 6.3); ctx.fill();
        if (f.y > H * 0.9) food.splice(i, 1);
      }
    }

    all.sort((a, b) => a.y - b.y);
    for (const c of all) {
      c.phase += dt;
      c.jump = Math.max(0, c.jump - dt * 2.4);
      const dw0 = c.rec.w * c.scale;

      if (tab === 'sea' && food.length) {
        const f = food.reduce((b, q) => (Math.hypot(q.x - c.x, q.y - c.y) < Math.hypot(b.x - c.x, b.y - c.y) ? q : b));
        const dx = f.x - c.x, dy = f.y - c.y, d = Math.hypot(dx, dy);
        if (d < 300) {
          c.vx = Math.sign(dx || 1) * 130;
          c.y += clamp(dy, -1, 1) * 90 * dt;
          if (d < dw0 * 0.45) { food.splice(food.indexOf(f), 1); sfx.pop(); c.jump = 0.6; }
        }
      }
      const speedBack = tab === 'land' ? 28 : 62;
      if (Math.abs(c.vx) > speedBack) c.vx *= 0.995;

      const hopping = tab === 'land' ? Math.abs(Math.sin(c.phase * 3)) : 0;
      if (tab !== 'land' || hopping > 0.08) c.x += c.vx * dt;
      if (c.x < dw0 / 2 && c.vx < 0) c.vx = -c.vx;
      if (c.x > W - dw0 / 2 && c.vx > 0) c.vx = -c.vx;

      ctx.save();
      const lift = (tab === 'land' ? hopping * 24 : Math.sin(c.phase * 1.3) * 10) + Math.sin(c.jump * 3.14) * 46;
      const depth = tab === 'land' ? 0.75 + ((c.y / H) - 0.68) * 1.6 : 1;
      ctx.translate(c.x, c.y - lift);
      if (c.vx < 0) ctx.scale(-1, 1);
      const dw = dw0 * depth;
      const dh = c.rec.h * c.scale * depth;
      if (tab === 'sea') {
        drawStrips(ctx, c, dw, dh, u => Math.sin(c.phase * 7 + u * 5) * Math.pow(1 - u, 2) * dh * 0.16);
      } else if (tab === 'sky') {
        drawStrips(ctx, c, dw, dh, u => Math.sin(c.phase * 9) * Math.abs(u - 0.45) * 2 * dh * 0.3);
      } else {
        const sq = 1 + (hopping - 0.5) * 0.09;
        ctx.scale(1 / sq, sq);
        ctx.fillStyle = 'rgba(30,70,20,.16)';
        ctx.beginPath(); ctx.ellipse(0, dh / 2 + lift / sq, dw * 0.38, 8, 0, 0, 6.3); ctx.fill();
        ctx.drawImage(c.img, -dw / 2, -dh / 2, dw, dh);
      }
      ctx.restore();
    }

    ctx.font = '30px "Apple Color Emoji",serif';
    ctx.textAlign = 'center';
    for (let i = hearts.length - 1; i >= 0; i--) {
      const q = hearts[i];
      q.t += dt;
      ctx.globalAlpha = clamp(1 - q.t, 0, 1);
      ctx.fillText('💖', q.x + Math.sin(q.t * 7) * 12, q.y - q.t * 110);
      if (q.t > 1) hearts.splice(i, 1);
    }
    ctx.globalAlpha = 1;
  }

  box.addEventListener('pointerdown', async e => {
    const r = box.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = [...all].reverse().find(c => {
      const dw = c.rec.w * c.scale, dh = c.rec.h * c.scale;
      return Math.abs(x - c.x) < dw / 2 && Math.abs(y - c.y) < dh / 2;
    });
    if (removing && hit) {
      if (await confirmBox('Отпустить на волю?', 'Отпустить', 'Оставить')) {
        await db.del('world', hit.rec.id);
        all = all.filter(c => c !== hit);
      }
      return;
    }
    if (hit) {
      sfx.squeak();
      hit.jump = 1;
      hit.vx = -hit.vx;
      hearts.push({ x: hit.x, y: hit.y - 40, t: 0 });
      return;
    }
    if (tab === 'sea') { sfx.drop(); for (let i = 0; i < 4; i++) food.push({ x: x + (Math.random() - 0.5) * 36, y: y + Math.random() * 20 }); }
  });

  const hint = speaker(`Здесь пока пусто. Нарисуй ${HABITATS[tab].who}, и она оживёт!`);
  hint.classList.add('world-hint');
  const removeBtn = iconBtn('trash', 'Отпустить', () => {
    removing = !removing;
    removeBtn.classList.toggle('on', removing);
    toast(removing ? 'Коснись того, кого хочешь отпустить' : 'Всё как было');
  });

  root.append(h('div', { class: 'screen world' },
    topbar('Живой мир', {
      right: [
        h('div', { class: 'tabs small' }, Object.entries(HABITATS).map(([k, v]) => h('a', { class: `tab ${k === tab ? 'on' : ''}`, href: `#/world/${k}` }, v.name))),
        removeBtn,
        btn('primary', `Нарисовать ${HABITATS[tab].who}`, () => { location.hash = `#/creature/${tab}`; }),
      ],
    }),
    h('div', { class: 'world-wrap' }, box, hint),
  ));
  ro.observe(box);
  resize();
  load().then(resize);
  raf = requestAnimationFrame(tick);

  return () => { live = false; cancelAnimationFrame(raf); ro.disconnect(); };
}

export function creatureDraw(root, habitat) {
  const H = HABITATS[habitat];
  const stageEl = h('div', { class: 'stage-host' });
  const p = new Painter(stageEl, { w: 800, h: 600, layers: 1, brush: 'marker', color: '#ff6b5e' });
  p.size = 16;
  let guideN = Math.floor(Math.random() * H.guides.length);
  const shape = h('div', { class: 'silhouette' });
  const showShape = () => { shape.innerHTML = `<svg viewBox="0 0 800 600"><path d="${H.guides[guideN].d}"/></svg>`; };
  showShape();
  p.under.append(shape);
  const rail = brushRail(p, ['marker', 'pen', 'crayon', 'watercolor', 'glitter', 'rainbow', 'fur', 'eraser'], { onPick: () => size.sync() });
  const size = sizeSlider(p);
  const pal = paletteBar(p, { onPick: () => { rail.redraw(); size.sync(); } });

  let showGuide = true;
  const draftId = `draft_creature_${habitat}`;
  let finished = false;
  const saver = autosaver(() => p.dirty, async () => {
    p.dirty = false;
    try {
      await db.put('kv', { id: draftId, ...(await p.serialize()) });
    } catch (e) {
      p.dirty = true;
      throw e;
    }
  }, () => p.isBusy());
  const restartBtn = iconBtn('trash', 'Начать заново', async () => {
    if (!(await confirmBox('Стереть и начать заново?', 'Заново', 'Нет'))) return;
    saver.stop();
    await saver.flush().catch(() => {});
    finished = true;
    await db.del('kv', draftId).catch(() => {});
    location.reload();
  }, 'hidden');
  db.get('kv', draftId).catch(() => null).then(async d => {
    if (!d || finished) return;
    await p.restore(d);
    restartBtn.classList.remove('hidden');
  });

  const go = btn('primary', 'Оживить!', async () => {
    if (!p.log.length) { toast('Сначала нарисуй!'); return; }
    let rec;
    try {
      rec = await safeSave(() => makeCreature(p.layers[0].c, habitat));
    } catch { return; }
    if (!rec) { toast('Сначала нарисуй!'); return; }
    finished = true;
    saver.stop();
    db.del('kv', draftId).catch(() => {});
    const r = awardOnce(`world-${habitat}`);
    sfx.win();
    location.hash = `#/world/${habitat}`;
    if (r.unlocked.length) setTimeout(() => celebrate({ title: 'Подарок!', unlocked: r.unlocked, actions: [{ label: 'Ура', primary: true }] }), 500);
  });

  root.append(h('div', { class: 'screen studio' },
    topbar(H.hint, {
      back: `#/world/${habitat}`,
      right: [
        restartBtn,
        iconBtn('undo', 'Отменить', () => p.undo()),
        H.guides.length > 1 && iconBtn('dice', 'Другая подсказка', () => {
          guideN = (guideN + 1) % H.guides.length;
          showShape();
        }),
        iconBtn('eye', 'Подсказка', () => {
          showGuide = !showGuide;
          p.under.style.opacity = showGuide ? 1 : 0;
        }),
        go,
      ],
    }),
    h('div', { class: 'studio-main' }, rail, stageEl),
    h('footer', { class: 'tools-foot' }, size, pal),
  ));
  p.fit();
  return () => {
    saver.stop();
    if (finished) p.destroy();
    else safeSave(saver.flush).catch(() => {}).finally(() => p.destroy());
  };
}
