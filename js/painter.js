// The drawing surface: layers, Apple Pencil input, undo, fill, symmetry and replay.
import { BRUSHES } from './brushes.js';
import { h, canvas, clamp, blobOf, loadImg, hexRgb, mulberry, svgEl } from './util.js';
import { N } from './i18n.js';

export const PAPERS = {
  white: { name: N('Белая'), color: '#ffffff' },
  cream: { name: N('Кремовая'), color: '#fff4dc' },
  sky: { name: N('Голубая'), color: '#d8eeff' },
  pink: { name: N('Розовая'), color: '#ffe3ef' },
  kraft: { name: N('Крафт'), color: '#dcbd90' },
  night: { name: N('Ночная'), color: '#1d1a33' },
  grid: { name: N('Клетка'), color: '#ffffff', grid: 60 },
  dots: { name: N('Точки'), color: '#ffffff', dots: 60 },
  lined: { name: N('Линейка'), color: '#ffffff', lines: 60 },
  mint: { name: N('Мятная'), color: '#dff5e6' },
  lilac: { name: N('Сиреневая'), color: '#ece3ff' },
  peach: { name: N('Персиковая'), color: '#ffe6d1' },
};

export const SYMMETRY = {
  none: { name: N('Обычно'), n: 1 },
  v: { name: N('Зеркало'), n: 2 },
  quad: { name: N('Калейдоскоп 4'), n: 4 },
  r6: { name: N('Снежинка'), n: 6, mirror: true },
  r8: { name: N('Мандала 8'), n: 8, mirror: true },
};

function transforms(sym, w, h2) {
  const cx = w / 2, cy = h2 / 2;
  const id = (x, y) => [x, y];
  if (sym === 'v') return [id, (x, y) => [w - x, y]];
  if (sym === 'quad') return [id, (x, y) => [w - x, y], (x, y) => [x, h2 - y], (x, y) => [w - x, h2 - y]];
  const S = SYMMETRY[sym];
  if (!S || S.n === 1) return [id];
  const out = [];
  for (let i = 0; i < S.n; i++) {
    const a = (i / S.n) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const rot = (x, y) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
    out.push(rot);
    if (S.mirror) out.push((x, y) => rot(2 * cx - x, y));
  }
  return out;
}

const MAX_UNDO_AREA = 26e6;

export class Painter {
  constructor(host, o = {}) {
    this.o = o;
    this.w = o.w || 1600;
    this.h = o.h || 1200;
    this.host = host;
    host.classList.add('stage');
    this.sheet = h('div', { class: 'sheet', style: { width: `${this.w}px`, height: `${this.h}px` } });
    this.paperC = canvas(this.w, this.h);
    this.paperC.className = 'paper';
    this.under = h('div', { class: 'overlay under' });
    this.over = h('div', { class: 'overlay over' });
    this.layers = [];
    for (let i = 0; i < (o.layers || 1); i++) {
      const c = canvas(this.w, this.h);
      c.className = 'layer';
      // Each layer is isolated, so a live "multiply" preview matches the saved result.
      const wrap = h('div', { class: 'layer-wrap', style: { zIndex: 10 + i * 2 } }, c);
      this.layers.push({ c, ctx: c.getContext('2d'), visible: true, wrap });
    }
    this.buf = canvas(this.w, this.h);
    this.buf.className = 'layer';
    this.bctx = this.buf.getContext('2d');
    this.spare = canvas(this.w, this.h);
    this.sctx = this.spare.getContext('2d');
    this.sheet.append(this.paperC, this.under, ...this.layers.map(l => l.wrap), this.over);
    this.layers[0].wrap.append(this.buf);
    host.append(this.sheet);

    this.active = 0;
    this.brushId = o.brush || 'pencil';
    this.color = o.color || '#2a2140';
    this.size = BRUSHES[this.brushId].def;
    this.sym = 'none';
    this.mode = 'draw';
    this.shape = 'line';
    this.enabled = true;
    this.log = [];
    this.undoStack = [];
    this.redoStack = [];
    this.undoArea = 0;
    this.touches = new Map();
    this.view = { s: 1, x: 0, y: 0 };
    this.zoom = 1;
    this.lastPen = -1e9;
    this.lastInk = -1e9;
    this.seed = (Math.random() * 1e9) | 0;
    this.dirty = false;
    this.setPaper(o.paper === null ? 'none' : o.paper || 'white');

    this._ro = new ResizeObserver(() => this.fit());
    this._ro.observe(host);
    this._bind();
    this.fit();
  }

  destroy() {
    this._ro.disconnect();
    this._unbind();
  }

  setPaper(id) {
    this.paper = id;
    const ctx = this.paperC.getContext('2d');
    ctx.clearRect(0, 0, this.w, this.h);
    const P = PAPERS[id];
    if (!P) return;
    ctx.fillStyle = P.color;
    ctx.fillRect(0, 0, this.w, this.h);
    if (P.grid) {
      ctx.strokeStyle = '#cfe0f2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = P.grid; x < this.w; x += P.grid) { ctx.moveTo(x, 0); ctx.lineTo(x, this.h); }
      for (let y = P.grid; y < this.h; y += P.grid) { ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
      ctx.stroke();
    }
    if (P.lines) {
      ctx.strokeStyle = '#cfe0f2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let y = P.lines; y < this.h; y += P.lines) { ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
      ctx.stroke();
    }
    if (P.dots) {
      ctx.fillStyle = '#b9c9dc';
      for (let x = P.dots; x < this.w; x += P.dots) {
        for (let y = P.dots; y < this.h; y += P.dots) {
          ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 6.3); ctx.fill();
        }
      }
    }
  }

  setBrush(id) {
    this.brushId = id;
    // Even shapes keep working when she switches the brush.
    if (this.mode !== 'shape') this.mode = 'draw';
    this.size = clamp(this.size, BRUSHES[id].min, BRUSHES[id].max);
  }

  // ---- view ----
  fit() {
    const r = this.host.getBoundingClientRect();
    this.rect = r;
    if (!r.width || !r.height) return;
    const pad = this.o.pad ?? 10;
    this.fitS = Math.min((r.width - pad * 2) / this.w, (r.height - pad * 2) / this.h);
    this.zoom = 1;
    this.view.s = this.fitS;
    this.view.x = (r.width - this.w * this.fitS) / 2;
    this.view.y = (r.height - this.h * this.fitS) / 2;
    this._apply();
  }

  _apply() {
    const v = this.view;
    this.sheet.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.s})`;
  }

  _toDoc(cx, cy) {
    return [(cx - this.rect.left - this.view.x) / this.view.s, (cy - this.rect.top - this.view.y) / this.view.s];
  }

  // ---- input ----
  _bind() {
    const hst = this.host;
    this._h = {
      pointerdown: e => this._down(e),
      pointermove: e => this._move(e),
      pointerup: e => this._up(e),
      pointercancel: e => this._up(e, true),
      // Stops the iPad loupe and page gestures from stealing a Pencil stroke.
      touchstart: e => e.preventDefault(),
      touchmove: e => e.preventDefault(),
      contextmenu: e => e.preventDefault(),
    };
    for (const [k, fn] of Object.entries(this._h)) hst.addEventListener(k, fn, { passive: false });
  }

  _unbind() {
    for (const [k, fn] of Object.entries(this._h)) this.host.removeEventListener(k, fn);
  }

  _pressure(e, x, y) {
    if (e.pointerType === 'pen') return clamp(Math.pow(e.pressure || 0.02, 0.72), 0.05, 1);
    const now = e.timeStamp;
    const v = this._lp ? Math.hypot(x - this._lp[0], y - this._lp[1]) / Math.max(1, now - this._lp[2]) : 0;
    this._lp = [x, y, now];
    const target = clamp(0.8 - v * 0.14, 0.32, 0.8);
    this._simP = this._simP == null ? 0.6 : this._simP + (target - this._simP) * 0.25;
    return this._simP;
  }

  _penRecent() {
    return performance.now() - this.lastPen < 15000;
  }

  isBusy() {
    return !!this.stroke || performance.now() - this.lastInk < 1500;
  }

  _reveal() {
    const L = this.layers[this.active];
    if (L.visible) return;
    L.visible = true;
    L.c.style.visibility = 'visible';
  }

  _clearSticker() {
    this.drag = null;
    this._stickerEl?.remove();
    this._stickerEl = null;
  }

  _down(e) {
    if (!this.enabled) return;
    this.rect = this.host.getBoundingClientRect();
    if (e.pointerType === 'pen') {
      this.lastPen = performance.now();
      // A palm that landed just before the Pencil must not leave a mark.
      if (this.stroke?.touch) this._cancelStroke();
      if (this.drag && this.touches.has(this.pid)) this._clearSticker();
      this.touches.clear();
      // A hand that shifted the sheet just before the Pencil landed is put back.
      const g = this.gesture;
      if (g && performance.now() - g.t0 < 500) {
        this.view.s = g.s;
        this.view.x = g.x;
        this.view.y = g.y;
        this._apply();
      }
      this.gesture = null;
      this.pan = null;
      this.pendingTap = null;
    }
    if (e.pointerType === 'touch') {
      if (e.width > 70 || e.height > 70) return;
      const now = performance.now();
      this.touches.set(e.pointerId, [e.clientX, e.clientY, now]);
      if (this.touches.size >= 2) {
        this.pendingTap = null;
        if (this.drag && this.touches.has(this.pid)) this._clearSticker();
        const s = this.stroke;
        if (s && s.touch && now - s.t0 < 320) this._cancelStroke();
        if (!this.stroke && !this.drag) this._gestureStart();
        // A thumb resting while she holds the iPad must not swallow her taps.
        const resting = Math.min(...[...this.touches.values()].map(v => v[2])) < now - 200;
        if (resting && (this.mode === 'tap' || this.mode === 'fill' || this.mode === 'pick')) {
          const [x, y] = this._toDoc(e.clientX, e.clientY);
          this.pendingTap = { id: e.pointerId, x, y, cx: e.clientX, cy: e.clientY, t: now };
        }
        return;
      }
      if (this.mode === 'sticker' && now - this.lastPen < 1500) return;
      // While she works with the Pencil a finger only moves the sheet, in shape mode too.
      if (this._penRecent() && (this.mode === 'draw' || this.mode === 'shape')) {
        if (!this.stroke && !this.drag) this._panStart();
        return;
      }
    }
    if (e.button > 0 || this.stroke || this.drag) return;
    try { this.host.setPointerCapture(e.pointerId); } catch { /* finger already gone */ }
    const [x, y] = this._toDoc(e.clientX, e.clientY);
    this.pid = e.pointerId;
    this._simP = null;
    this._lp = null;
    if (this.mode === 'draw') {
      this._reveal();
      this.o.beforeStroke?.(x, y);
      this._strokeBegin({
        b: this.brushId, c: this.color, z: this.size, l: this.active, y: this.sym, seed: this.seed++,
      }, x, y, this._pressure(e, x, y));
      this.stroke.touch = e.pointerType === 'touch';
    } else if (this.mode === 'sticker' || this.mode === 'shape') {
      this._reveal();
      this.drag = { x, y, x0: x, y0: y };
      this._dragPreview();
    } else if (e.pointerType === 'touch') {
      // A finger may turn out to be the start of a pinch, so taps wait for the lift.
      this.pendingTap = { id: e.pointerId, x, y, cx: e.clientX, cy: e.clientY, t: performance.now() };
    } else {
      this._runTap(x, y, e);
    }
  }

  _runTap(x, y, e) {
    if (this.mode === 'tap') this.o.onTap?.(x, y, e);
    else if (this.mode === 'fill') { this._reveal(); this.floodFill(x, y, this.color, this.active); }
    else if (this.mode === 'pick') this.pickColor(x, y);
  }

  _move(e) {
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      this.touches.set(e.pointerId, [e.clientX, e.clientY, this.touches.get(e.pointerId)[2]]);
      if (this.gesture) { this._gestureMove(); return; }
      if (this.pan) { this._panMove(e); return; }
    }
    if (this.drag && e.pointerId === this.pid) {
      const [x, y] = this._toDoc(e.clientX, e.clientY);
      this.drag = { ...this.drag, x, y };
      this._dragPreview();
      return;
    }
    if (!this.stroke || e.pointerId !== this.pid) return;
    if (e.pointerType === 'pen') this.lastPen = performance.now();
    const coal = e.getCoalescedEvents?.();
    for (const ev of coal && coal.length ? coal : [e]) {
      const [x, y] = this._toDoc(ev.clientX, ev.clientY);
      this._strokePoint(x, y, this._pressure(ev, x, y));
    }
    this._flushClip();
  }

  _up(e, cancelled) {
    const now = performance.now();
    if (e.pointerType === 'pen') this.lastPen = now;
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId);
      if (cancelled && this.gesture) this.gesture.cancelled = true;
      if (this.gesture) {
        if (this.touches.size < 2) this._gestureEnd();
        else this._gestureRebase();
      }
      if (!this.touches.size) this.pan = null;
    }
    const t = this.pendingTap;
    if (t && t.id === e.pointerId) {
      this.pendingTap = null;
      const small = Math.hypot(e.clientX - t.cx, e.clientY - t.cy) < 24;
      if (!cancelled && small && now - t.t < 1800 && now - this.lastPen > 500 && !this.stroke) {
        this._runTap(t.x, t.y, e);
      }
      return;
    }
    if (this.drag && e.pointerId === this.pid) {
      const d = this.drag;
      const shape = this.mode === 'shape';
      this._clearSticker();
      if (!cancelled) {
        if (shape) this._placeShape(d); else this.placeSticker(d.x, d.y);
      }
      return;
    }
    if (this.stroke && e.pointerId === this.pid) {
      if (cancelled && this.stroke.touch) this._cancelStroke();
      else this._strokeEnd();
    }
  }

  _gestureStart() {
    const [a, b] = [...this.touches.values()];
    if (!b) return;
    this.pan = null;
    const downs = [...this.touches.values()].map(v => v[2]);
    this.gesture = {
      together: Math.max(...downs) - Math.min(...downs) < 200,
      d: Math.hypot(a[0] - b[0], a[1] - b[1]),
      mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2,
      s: this.view.s, x: this.view.x, y: this.view.y,
      t0: performance.now(), moved: 0, n: this.touches.size,
    };
  }

  _gestureMove() {
    const g = this.gesture;
    const [a, b] = [...this.touches.values()];
    if (!b) return;
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    g.n = Math.max(g.n, this.touches.size);
    g.moved = Math.max(g.moved, Math.abs(d - g.d), Math.hypot(mx - g.mx, my - g.my));
    if (g.moved >= 14) this.pendingTap = null;
    const s = clamp(g.s * (d / g.d), this.fitS * 0.7, this.fitS * 8);
    const rx = g.mx - this.rect.left, ry = g.my - this.rect.top;
    this.view.s = s;
    this.view.x = mx - this.rect.left - ((rx - g.x) / g.s) * s;
    this.view.y = my - this.rect.top - ((ry - g.y) / g.s) * s;
    this._clampView();
    this._apply();
  }

  // When one of three fingers lifts, carry on from the two that remain.
  _gestureRebase() {
    const g = this.gesture;
    const [a, b] = [...this.touches.values()];
    if (!b) return;
    g.d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    g.mx = (a[0] + b[0]) / 2;
    g.my = (a[1] + b[1]) / 2;
    g.s = this.view.s;
    g.x = this.view.x;
    g.y = this.view.y;
  }

  // At least a quarter of the stage always keeps showing the sheet.
  _clampView() {
    const v = this.view, r = this.rect;
    const mx = r.width * 0.25, my = r.height * 0.25;
    v.x = clamp(v.x, mx - this.w * v.s, r.width - mx);
    v.y = clamp(v.y, my - this.h * v.s, r.height - my);
  }

  _gestureEnd() {
    const g = this.gesture;
    this.gesture = null;
    const now = performance.now();
    // A hand settling near a recent Pencil stroke is not an undo.
    const quick = g.together && !g.cancelled && now - this.lastPen > 1500 && now - g.t0 < 260 && g.moved < 14;
    if (quick) {
      // Quick two-finger tap undoes, three-finger tap redoes.
      if (g.n >= 3) this.redo(); else this.undo();
    } else if (this.view.s < this.fitS * 1.03) {
      this.fit();
    }
    if (this.touches.size === 1 && this._penRecent() && (this.mode === 'draw' || this.mode === 'shape')) this._panStart();
  }

  _panStart() {
    const [a] = [...this.touches.values()];
    this.pan = { sx: a[0], sy: a[1], x: this.view.x, y: this.view.y };
  }

  _panMove(e) {
    if (this.view.s <= this.fitS * 1.03) return;
    this.view.x = this.pan.x + e.clientX - this.pan.sx;
    this.view.y = this.pan.y + e.clientY - this.pan.sy;
    this._clampView();
    this._apply();
  }

  // ---- strokes ----
  _strokeBegin(meta, x, y, p) {
    const b = BRUSHES[meta.b];
    const L = this.layers[meta.l];
    const s = this.stroke = {
      ...meta, br: b, pts: [], left: 0, dist: 0,
      rng: mulberry(meta.seed), tf: transforms(meta.y, this.w, this.h),
      bbox: [1e9, 1e9, -1e9, -1e9], flush: [1e9, 1e9, -1e9, -1e9],
      mx: x, my: y, lx: x, ly: y, lp: p, angle: 0, t0: performance.now(),
    };
    if (b.direct) {
      this.sctx.clearRect(0, 0, this.w, this.h);
      this.sctx.drawImage(L.c, 0, 0);
      s.ctx = L.ctx;
      L.ctx.globalCompositeOperation = b.blend;
    } else {
      s.ctx = this.bctx;
      if (this.buf.parentNode !== L.wrap) L.wrap.append(this.buf);
      this.buf.style.opacity = b.opacity;
      this.buf.style.mixBlendMode = b.blend === 'multiply' ? 'multiply' : 'normal';
    }
    s.pts.push(Math.round(x), Math.round(y), Math.round(p * 99));
    this._emit(x, y, p);
    this._flushClip();
  }

  _strokePoint(x, y, p) {
    const s = this.stroke;
    s.pts.push(Math.round(x), Math.round(y), Math.round(p * 99));
    const dx = x - s.lx, dy = y - s.ly;
    if (dx * dx + dy * dy < 0.8) { s.lp = p; return; }
    const mx = (s.lx + x) / 2, my = (s.ly + y) / 2;
    this._curve(s.mx, s.my, s.lx, s.ly, mx, my, s.lp, p);
    s.mx = mx; s.my = my; s.lx = x; s.ly = y; s.lp = p;
  }

  _curve(ax, ay, cx, cy, bx, by, p0, p1) {
    const s = this.stroke;
    const len = Math.hypot(cx - ax, cy - ay) + Math.hypot(bx - cx, by - cy);
    const n = Math.max(1, Math.ceil(len / 1.2));
    const spacing = Math.max(0.7, s.br.spacing * s.z);
    let px = ax, py = ay;
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const x = u * u * ax + 2 * u * t * cx + t * t * bx;
      const y = u * u * ay + 2 * u * t * cy + t * t * by;
      const d = Math.hypot(x - px, y - py);
      s.dist += d;
      s.left -= d;
      if (d > 0.001) s.angle = Math.atan2(y - py, x - px);
      if (s.left <= 0) {
        this._emit(x, y, p0 + (p1 - p0) * t);
        s.left += spacing;
      }
      px = x; py = y;
    }
  }

  _emit(x, y, p) {
    const s = this.stroke;
    const r = s.z / 2;
    const reach = r * s.br.scatter * 1.6 + 3;
    for (const t of s.tf) {
      const [tx, ty] = t(x, y);
      s.br.stamp(s.ctx, { x: tx, y: ty, p, r, color: s.c, rng: s.rng, angle: s.angle, dist: s.dist });
      const b = s.bbox, f = s.flush;
      b[0] = Math.min(b[0], tx - reach); b[1] = Math.min(b[1], ty - reach);
      b[2] = Math.max(b[2], tx + reach); b[3] = Math.max(b[3], ty + reach);
      f[0] = Math.min(f[0], tx - reach); f[1] = Math.min(f[1], ty - reach);
      f[2] = Math.max(f[2], tx + reach); f[3] = Math.max(f[3], ty + reach);
    }
    s.ctx.globalAlpha = 1;
  }

  // Keeps a "magic" stroke inside one region while it is being drawn.
  _flushClip() {
    const s = this.stroke;
    if (!s) return;
    const f = s.flush;
    if (this.clip && !s.br.direct && f[2] > f[0]) {
      const c = s.ctx;
      c.save();
      c.beginPath();
      c.rect(f[0], f[1], f[2] - f[0], f[3] - f[1]);
      c.clip();
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'destination-in';
      c.drawImage(this.clip, 0, 0);
      c.restore();
    }
    s.flush = [1e9, 1e9, -1e9, -1e9];
  }

  _strokeEnd() {
    const s = this.stroke;
    this._curve(s.mx, s.my, s.lx, s.ly, s.lx, s.ly, s.lp, s.lp);
    this._flushClip();
    const L = this.layers[s.l];
    const box = this._box(s.bbox);
    if (box) {
      const [x, y, w, h2] = box;
      if (!this.noHistory) {
        const src = s.br.direct ? this.spare : L.c;
        this._pushUndo(s.l, x, y, w, h2, src);
      }
      if (!s.br.direct) {
        L.ctx.save();
        L.ctx.globalAlpha = s.br.opacity;
        L.ctx.globalCompositeOperation = s.br.blend;
        L.ctx.drawImage(this.buf, x, y, w, h2, x, y, w, h2);
        L.ctx.restore();
        this.bctx.clearRect(x, y, w, h2);
      }
      if (!this.noHistory) this.log.push({ t: 's', b: s.b, c: s.c, z: s.z, l: s.l, y: s.y, seed: s.seed, pts: s.pts });
    }
    if (s.br.direct) L.ctx.globalCompositeOperation = 'source-over';
    this.stroke = null;
    this.buf.style.opacity = 1;
    this.dirty = true;
    this.lastInk = performance.now();
    this.o.onChange?.();
  }

  _cancelStroke() {
    const s = this.stroke;
    if (!s) return;
    if (s.br.direct) {
      const L = this.layers[s.l];
      L.ctx.globalCompositeOperation = 'copy';
      L.ctx.drawImage(this.spare, 0, 0);
      L.ctx.globalCompositeOperation = 'source-over';
    } else {
      this.bctx.clearRect(0, 0, this.w, this.h);
    }
    this.stroke = null;
    this.buf.style.opacity = 1;
  }

  _box(b) {
    const x = Math.max(0, Math.floor(b[0]));
    const y = Math.max(0, Math.floor(b[1]));
    const w = Math.min(this.w, Math.ceil(b[2])) - x;
    const h2 = Math.min(this.h, Math.ceil(b[3])) - y;
    return w > 0 && h2 > 0 ? [x, y, w, h2] : null;
  }

  // ---- history ----
  _snap(src, x, y, w, h2) {
    const c = canvas(w, h2);
    c.getContext('2d').drawImage(src, x, y, w, h2, 0, 0, w, h2);
    return c;
  }

  _pushUndo(l, x, y, w, h2, src) {
    this.pendingFill?.();
    this.undoStack.push({ l, x, y, w, h: h2, snap: this._snap(src, x, y, w, h2), logLen: this.log.length });
    this.undoArea += w * h2;
    while ((this.undoArea > MAX_UNDO_AREA || this.undoStack.length > 40) && this.undoStack.length > 1) {
      const old = this.undoStack.shift();
      this.undoArea -= old.w * old.h;
    }
    this.redoStack.length = 0;
  }

  _swap(e) {
    const L = this.layers[e.l];
    const after = this._snap(L.c, e.x, e.y, e.w, e.h);
    L.ctx.clearRect(e.x, e.y, e.w, e.h);
    L.ctx.drawImage(e.snap, e.x, e.y);
    e.snap = after;
  }

  undo() {
    this.pendingFill?.();
    const e = this.undoStack.pop();
    if (!e) return false;
    this._swap(e);
    e.tail = this.log.splice(e.logLen);
    this.undoArea -= e.w * e.h;
    this.redoStack.push(e);
    this.dirty = true;
    this.o.onChange?.();
    return true;
  }

  redo() {
    this.pendingFill?.();
    const e = this.redoStack.pop();
    if (!e) return false;
    this._swap(e);
    this.log.push(...e.tail);
    this.undoArea += e.w * e.h;
    this.undoStack.push(e);
    this.dirty = true;
    this.o.onChange?.();
    return true;
  }

  // A programmatic change with undo support.
  edit(l, x, y, w, h2, fn, entry) {
    if (!this.noHistory) this._pushUndo(l, x, y, w, h2, this.layers[l].c);
    fn(this.layers[l].ctx);
    if (entry && !this.noHistory) this.log.push(entry);
    this.dirty = true;
    this.lastInk = performance.now();
    this.o.onChange?.();
  }

  clearLayer(l = this.active) {
    this.edit(l, 0, 0, this.w, this.h, c => c.clearRect(0, 0, this.w, this.h), { t: 'c', l });
  }

  // ---- fill, picking, stickers ----
  _merged() {
    const c = canvas(this.w, this.h);
    const x = c.getContext('2d', { willReadFrequently: true });
    for (const L of this.layers) if (L.visible) x.drawImage(L.c, 0, 0);
    return x;
  }

  floodFill(sx, sy, color, l, entry = true, gapOverride) {
    sx = Math.floor(sx); sy = Math.floor(sy);
    const W = this.w, H = this.h;
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
    const data = this._merged().getImageData(0, 0, W, H).data;
    const at = (sx + sy * W) * 4;
    const tr = data[at], tg = data[at + 1], tb = data[at + 2], ta = data[at + 3];
    const same = i => {
      const a = data[i + 3];
      if (ta < 30 && a < 110) return true;
      return Math.abs(data[i] - tr) + Math.abs(data[i + 1] - tg) + Math.abs(data[i + 2] - tb) + Math.abs(a - ta) * 1.4 < 96;
    };
    // Children leave small gaps between lines. Walls are thickened while the
    // colour spreads, then the colour grows back up to the real line.
    const gap = gapOverride ?? this.o.fillGap ?? 7;
    const N = W * H;
    const wall = new Uint8Array(N);
    for (let i = 0; i < N; i++) wall[i] = same(i * 4) ? 0 : 1;
    const dist = new Uint16Array(N);
    for (let i = 0; i < N; i++) dist[i] = wall[i] ? 0 : 60000;
    for (let i = 0; i < N; i++) {
      if (i % W > 0 && dist[i - 1] + 1 < dist[i]) dist[i] = dist[i - 1] + 1;
      if (i >= W && dist[i - W] + 1 < dist[i]) dist[i] = dist[i - W] + 1;
    }
    for (let i = N - 1; i >= 0; i--) {
      if (i % W < W - 1 && dist[i + 1] + 1 < dist[i]) dist[i] = dist[i + 1] + 1;
      if (i < N - W && dist[i + W] + 1 < dist[i]) dist[i] = dist[i + W] + 1;
    }
    // A tap right beside a line still counts: step to the nearest open spot.
    let seed = sx + sy * W;
    if (dist[seed] <= gap && !wall[seed]) {
      let bestD = dist[seed];
      for (let dy = -gap * 2; dy <= gap * 2; dy++) {
        for (let dx = -gap * 2; dx <= gap * 2; dx++) {
          const qx = sx + dx, qy = sy + dy;
          if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
          if (dist[qx + qy * W] > bestD) { bestD = dist[qx + qy * W]; seed = qx + qy * W; }
        }
      }
    }
    const limit = dist[seed] > gap ? gap : 0;
    const open = i => !wall[i] && dist[i] > limit;
    const mask = new Uint8Array(N);
    const stack = [seed];
    mask[seed] = 1;
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    let frontier = [];
    while (stack.length) {
      const q = stack.pop();
      const x = q % W, y = (q - x) / W;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      frontier.push(q);
      if (x > 0 && !mask[q - 1] && open(q - 1)) { mask[q - 1] = 1; stack.push(q - 1); }
      if (x < W - 1 && !mask[q + 1] && open(q + 1)) { mask[q + 1] = 1; stack.push(q + 1); }
      if (y > 0 && !mask[q - W] && open(q - W)) { mask[q - W] = 1; stack.push(q - W); }
      if (y < H - 1 && !mask[q + W] && open(q + W)) { mask[q + W] = 1; stack.push(q + W); }
    }
    for (let round = 0; round < limit + 1; round++) {
      const next = [];
      for (const q of frontier) {
        const x = q % W;
        for (const n of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, q >= W ? q - W : -1, q < N - W ? q + W : -1]) {
          if (n < 0 || mask[n] || wall[n]) continue;
          mask[n] = 1;
          next.push(n);
          const nx = n % W, ny = (n - nx) / W;
          if (nx < x0) x0 = nx;
          if (nx > x1) x1 = nx;
          if (ny < y0) y0 = ny;
          if (ny > y1) y1 = ny;
        }
      }
      frontier = next;
    }
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2);
    x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const tmp = canvas(bw, bh);
    const tctx = tmp.getContext('2d');
    const img = tctx.createImageData(bw, bh);
    const [r, g, b] = hexRgb(color);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const m = mask[x + y * W]
          || (x > 0 && mask[x - 1 + y * W]) || (x < W - 1 && mask[x + 1 + y * W])
          || (y > 0 && mask[x + (y - 1) * W]) || (y < H - 1 && mask[x + (y + 1) * W]);
        if (!m) continue;
        const i = (x - x0 + (y - y0) * bw) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    tctx.putImageData(img, 0, 0);
    this.edit(l, x0, y0, bw, bh, c => c.drawImage(tmp, x0, y0), entry ? { t: 'f', x: sx, y: sy, c: color, l, g: gap } : null);
  }

  pickColor(x, y) {
    const c = canvas(1, 1);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(this.paperC, -Math.floor(x), -Math.floor(y));
    for (const L of this.layers) if (L.visible) ctx.drawImage(L.c, -Math.floor(x), -Math.floor(y));
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const hex = '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    this.mode = 'draw';
    this.o.onPick?.(hex);
  }

  _dragPreview() {
    const d = this.drag;
    if (this.mode !== 'shape') { this._stickerPreview(d.x, d.y); return; }
    if (!this._stickerEl) {
      this._stickerEl = svgEl('svg', { viewBox: `0 0 ${this.w} ${this.h}`, class: 'shape-ghost' });
      this._stickerEl.append(svgEl('path', {
        fill: 'none', stroke: this.color, 'stroke-width': Math.max(3, this.size * 0.6),
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0.55,
      }));
      this.over.append(this._stickerEl);
    }
    this._stickerEl.firstChild.setAttribute('d', `M${this._shapePts(d, 14).map(q => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join('L')}`);
  }

  // Points along an even line, box, oval or triangle stretched between two corners.
  _shapePts({ x0, y0, x, y }, step = 6) {
    const out = [];
    const line = (ax, ay, bx, by) => {
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
      for (let i = out.length ? 1 : 0; i <= n; i++) out.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
    };
    if (this.shape === 'rect') {
      line(x0, y0, x, y0); line(x, y0, x, y); line(x, y, x0, y); line(x0, y, x0, y0);
    } else if (this.shape === 'tri') {
      line(x0, y, (x0 + x) / 2, y0); line((x0 + x) / 2, y0, x, y); line(x, y, x0, y);
    } else if (this.shape === 'oval') {
      const cx = (x0 + x) / 2, cy = (y0 + y) / 2, rx = Math.abs(x - x0) / 2, ry = Math.abs(y - y0) / 2;
      const n = Math.max(24, Math.ceil((Math.PI * (rx + ry)) / step));
      for (let i = 0; i <= n; i++) out.push([cx + Math.cos((i / n) * 6.28319) * rx, cy + Math.sin((i / n) * 6.28319) * ry]);
    } else {
      line(x0, y0, x, y);
    }
    return out;
  }

  // A shape is stored as an ordinary stroke, so undo and time-lapse just work.
  _placeShape(d) {
    if (Math.hypot(d.x - d.x0, d.y - d.y0) < 8) return;
    const pts = this._shapePts(d);
    this._strokeBegin({
      b: this.brushId, c: this.color, z: this.size, l: this.active, y: this.sym, seed: this.seed++,
    }, pts[0][0], pts[0][1], 0.7);
    for (let i = 1; i < pts.length; i++) this._strokePoint(pts[i][0], pts[i][1], 0.7);
    this._strokeEnd();
  }

  _stickerPreview(x, y) {
    if (!this._stickerEl) {
      this._stickerEl = h('div', {
        class: 'sticker-ghost',
        style: { fontSize: `${this.stickerSize}px`, lineHeight: 1 },
      }, this.sticker);
      this.over.append(this._stickerEl);
    }
    this._stickerEl.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
  }

  placeSticker(x, y) {
    this._paintSticker({
      t: 'k', x: Math.round(x), y: Math.round(y), z: this.stickerSize, e: this.sticker, l: this.active,
    });
  }

  _paintSticker(e) {
    const box = this._box([e.x - e.z * 0.8, e.y - e.z * 0.8, e.x + e.z * 0.8, e.y + e.z * 0.8]);
    if (!box) return;
    this.edit(e.l, box[0], box[1], box[2], box[3], c => {
      c.font = `${e.z}px "Apple Color Emoji","Segoe UI Emoji",serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#000';
      c.fillText(e.e, e.x, e.y + e.z * 0.06);
    }, e);
  }

  // ---- files ----
  flatten({ paper = true } = {}) {
    this.pendingFill?.();
    const c = canvas(this.w, this.h);
    const x = c.getContext('2d');
    if (paper) x.drawImage(this.paperC, 0, 0);
    for (const L of this.layers) if (L.visible) x.drawImage(L.c, 0, 0);
    if (this.o.overlayCanvas) x.drawImage(this.o.overlayCanvas, 0, 0);
    return c;
  }

  thumb(maxW = 480) {
    const f = this.flatten();
    const s = maxW / this.w;
    const c = canvas(maxW, this.h * s);
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(f, 0, 0, c.width, c.height);
    return c;
  }

  async serialize() {
    this.pendingFill?.();
    const log = this.log.slice();
    const layers = await Promise.all(this.layers.map(L => blobOf(L.c)));
    return { layers, log, paper: this.paper };
  }

  async restore(data) {
    if (data.paper) this.setPaper(data.paper);
    this.log = data.log || [];
    await Promise.all((data.layers || []).map(async (b, i) => {
      if (!this.layers[i] || !b) return;
      const img = await loadImg(b);
      this.layers[i].ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);
    }));
    this.dirty = false;
  }
}

// Plays a recorded drawing back on an empty painter.
export function replay(p, log, { seconds = 10, onDone } = {}) {
  p.noHistory = true;
  p.enabled = false;
  const total = log.reduce((s, e) => s + (e.t === 's' ? e.pts.length / 3 : 40), 0) || 1;
  const perFrame = Math.max(1, total / (seconds * 60));
  let i = 0, j = 0, stop = false;
  const P = e => e.pts[j + 2] / 99;
  const frame = () => {
    if (stop) return;
    let q = perFrame;
    while (q > 0 && i < log.length) {
      const e = log[i];
      if (e.t === 's') {
        if (j === 0) {
          p._strokeBegin(e, e.pts[0], e.pts[1], P(e));
          j = 3;
        }
        while (q > 0 && j < e.pts.length) {
          p._strokePoint(e.pts[j], e.pts[j + 1], P(e));
          j += 3;
          q--;
        }
        if (j >= e.pts.length) { p._strokeEnd(); i++; j = 0; }
      } else {
        if (e.t === 'f') p.floodFill(e.x, e.y, e.c, e.l, true, e.g);
        if (e.t === 'c') p.layers[e.l].ctx.clearRect(0, 0, p.w, p.h);
        if (e.t === 'k') p._paintSticker(e);
        i++;
        q -= 40;
      }
    }
    if (i < log.length) requestAnimationFrame(frame);
    else onDone?.();
  };
  requestAnimationFrame(frame);
  return () => { stop = true; };
}
