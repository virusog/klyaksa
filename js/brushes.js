// Every brush is a "stamp" function called at even distances along the stroke.
import { canvas, hexRgb, rgbHex, shade, mulberry, clamp } from './util.js';
import { N } from './i18n.js';

const tips = new Map();

function tip(kind, color, variant = 0) {
  const key = `${kind}|${color}|${variant}`;
  let c = tips.get(key);
  if (c) return c;
  if (tips.size > 240) tips.clear();
  const S = 64;
  c = canvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const [r, g, b] = hexRgb(color);
  const rnd = mulberry(variant * 7919 + 13);
  const R = S / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - R, y + 0.5 - R) / R;
      let a = 0;
      if (kind === 'grain') a = d < 1 ? (rnd() < 0.62 ? 1 - d * 0.45 : 0.08) : 0;
      if (kind === 'crayon') a = d < 1 ? (rnd() < 0.55 ? 1 : 0) * (d > 0.8 ? 0.6 : 1) : 0;
      if (kind === 'chalk') a = d < 1 ? (rnd() < 0.34 ? 1 : 0) : 0;
      if (kind === 'soft') a = d < 1 ? Math.pow(1 - d, 0.8) : 0;
      if (kind === 'water') a = d < 1 ? (d > 0.72 ? 0.36 * (1 - d) / 0.28 + 0.1 : 0.22) : 0;
      if (kind === 'glow') a = d < 1 ? Math.pow(1 - d, 2.1) : 0;
      const i = (x + y * S) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  tips.set(key, c);
  return c;
}

function disc(c, x, y, r, color, alpha = 1) {
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, Math.max(0.4, r), 0, 6.2832);
  c.fill();
}

function image(c, t, o, r, alpha) {
  c.globalAlpha = alpha;
  c.drawImage(t, o.x - r, o.y - r, r * 2, r * 2);
}

const STAR = new Path2D();
for (let i = 0; i < 10; i++) {
  const rad = i % 2 ? 0.45 : 1;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  STAR[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad);
}
STAR.closePath();
const LEAF = new Path2D('M-1 0C-.5 -.7 .5 -.7 1 0C.5 .7 -.5 .7 -1 0Z');
const HEART = new Path2D('M0 .9C-1.3 0-1 -.9-.45 -.9-.2 -.9 0 -.7 0 -.45 0 -.7 .2 -.9 .45 -.9 1 -.9 1.3 0 0 .9Z');

function shapeStamp(c, shape, o, r, color) {
  c.save();
  c.translate(o.x, o.y);
  c.rotate((o.rng() - 0.5) * 1.3);
  c.scale(r, r);
  c.fillStyle = color;
  c.globalAlpha = 1;
  c.fill(shape);
  c.restore();
}

function hueJitter(hex, rng, amount = 0.18) {
  const [r, g, b] = hexRgb(hex);
  const d = (rng() - 0.5) * amount * 255;
  return rgbHex(r + d, g + d * 0.6, b - d * 0.5);
}

export const BRUSHES = {
  pencil: {
    name: N('Карандаш'), spacing: 0.16, min: 2, max: 34, def: 8, opacity: 1, blend: 'source-over', scatter: 1.1,
    stamp(c, o) {
      const r = o.r * (0.55 + 0.6 * o.p);
      image(c, tip('grain', o.color, Math.floor(o.rng() * 4)), o, r, 0.28 + 0.65 * o.p);
    },
  },
  pen: {
    name: N('Ручка'), spacing: 0.07, min: 2, max: 30, def: 7, opacity: 1, blend: 'source-over', scatter: 1,
    stamp(c, o) { disc(c, o.x, o.y, o.r * (0.35 + 0.85 * o.p), o.color); },
  },
  marker: {
    name: N('Фломастер'), spacing: 0.08, min: 6, max: 70, def: 18, opacity: 1, blend: 'source-over', scatter: 1,
    stamp(c, o) { disc(c, o.x, o.y, o.r, o.color); },
  },
  highlighter: {
    name: N('Маркер'), spacing: 0.08, min: 12, max: 90, def: 34, opacity: 0.5, blend: 'multiply', scatter: 1,
    stamp(c, o) {
      c.globalAlpha = 1;
      c.fillStyle = o.color;
      c.fillRect(o.x - o.r * 0.38, o.y - o.r, o.r * 0.76, o.r * 2);
    },
  },
  watercolor: {
    name: N('Акварель'), spacing: 0.1, min: 12, max: 140, def: 54, opacity: 0.7, blend: 'multiply', scatter: 1.12,
    stamp(c, o) {
      const r = o.r * (0.78 + 0.4 * o.p + o.rng() * 0.08);
      image(c, tip('water', o.color), { x: o.x + (o.rng() - 0.5) * 3, y: o.y + (o.rng() - 0.5) * 3 }, r, 0.5);
    },
  },
  crayon: {
    name: N('Мелок'), spacing: 0.14, min: 8, max: 80, def: 28, opacity: 1, blend: 'source-over', scatter: 1,
    stamp(c, o) { image(c, tip('crayon', o.color, Math.floor(o.rng() * 6)), o, o.r * (0.7 + 0.4 * o.p), 0.85); },
  },
  chalk: {
    name: N('Пастель'), spacing: 0.18, min: 10, max: 110, def: 42, opacity: 1, blend: 'source-over', scatter: 1,
    stamp(c, o) { image(c, tip('chalk', o.color, Math.floor(o.rng() * 6)), o, o.r, 0.75); },
  },
  spray: {
    name: N('Баллончик'), spacing: 0.22, min: 16, max: 150, def: 60, opacity: 1, blend: 'source-over', scatter: 1.1,
    stamp(c, o) {
      c.fillStyle = o.color;
      c.globalAlpha = 0.75;
      const n = Math.ceil(o.r * 0.9);
      for (let i = 0; i < n; i++) {
        const a = o.rng() * 6.2832;
        const d = o.r * Math.pow(o.rng(), 0.7);
        const z = 0.8 + o.rng() * 1.2;
        c.fillRect(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, z, z);
      }
    },
  },
  fur: {
    name: N('Шёрстка'), spacing: 0.24, min: 12, max: 90, def: 34, opacity: 1, blend: 'source-over', scatter: 2.3, prize: true,
    stamp(c, o) {
      c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = o.angle + Math.PI / 2 * (o.rng() < 0.5 ? 1 : -1) + (o.rng() - 0.5) * 1.1;
        const l = o.r * (0.7 + o.rng() * 1.3);
        const sx = o.x + (o.rng() - 0.5) * o.r * 0.7;
        const sy = o.y + (o.rng() - 0.5) * o.r * 0.7;
        c.strokeStyle = shade(o.color, (o.rng() - 0.5) * 0.5);
        c.lineWidth = 1 + o.rng() * 2;
        c.globalAlpha = 0.85;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l);
        c.stroke();
      }
    },
  },
  neon: {
    name: N('Неон'), spacing: 0.1, min: 8, max: 60, def: 22, opacity: 1, blend: 'source-over', scatter: 2.8, prize: true,
    stamp(c, o) {
      image(c, tip('glow', o.color), o, o.r * 2.7, 0.3);
      disc(c, o.x, o.y, o.r * 0.34, '#ffffff');
    },
  },
  rainbow: {
    name: N('Радуга'), spacing: 0.06, min: 8, max: 80, def: 26, opacity: 1, blend: 'source-over', scatter: 1, prize: true,
    stamp(c, o) {
      c.globalAlpha = 1;
      c.fillStyle = `hsl(${(o.dist * 0.45) % 360} 92% 60%)`;
      c.beginPath();
      c.arc(o.x, o.y, o.r, 0, 6.2832);
      c.fill();
    },
  },
  glitter: {
    name: N('Блёстки'), spacing: 0.34, min: 14, max: 110, def: 40, opacity: 1, blend: 'source-over', scatter: 1.2, prize: true,
    stamp(c, o) {
      for (let i = 0; i < 5; i++) {
        const a = o.rng() * 6.2832;
        const d = o.r * Math.sqrt(o.rng());
        const z = 1.4 + o.rng() * 4.2;
        const white = o.rng() < 0.18;
        const col = white ? '#ffffff' : shade(o.color, (o.rng() - 0.5) * 0.7);
        shapeStamp(c, STAR, { x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d, rng: o.rng }, z, col);
      }
    },
  },
  stars: {
    name: N('Звёздочки'), spacing: 1.5, min: 16, max: 110, def: 42, opacity: 1, blend: 'source-over', scatter: 1.2, prize: true,
    stamp(c, o) { shapeStamp(c, STAR, o, o.r * (0.7 + o.rng() * 0.45), hueJitter(o.color, o.rng)); },
  },
  hearts: {
    name: N('Сердечки'), spacing: 1.5, min: 16, max: 110, def: 42, opacity: 1, blend: 'source-over', scatter: 1.2, prize: true,
    stamp(c, o) { shapeStamp(c, HEART, o, o.r * (0.7 + o.rng() * 0.45), hueJitter(o.color, o.rng)); },
  },
  bubbles: {
    name: N('Пузыри'), spacing: 0.9, min: 16, max: 120, def: 50, opacity: 1, blend: 'source-over', scatter: 1.5, prize: true,
    stamp(c, o) {
      const r = o.r * (0.3 + o.rng() * 0.7);
      const x = o.x + (o.rng() - 0.5) * o.r;
      const y = o.y + (o.rng() - 0.5) * o.r;
      c.globalAlpha = 0.28;
      c.fillStyle = o.color;
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.globalAlpha = 0.95;
      c.strokeStyle = o.color;
      c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.stroke();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, r * 0.17, 0, 6.2832); c.fill();
    },
  },
  calligraphy: {
    name: N('Перо'), spacing: 0.05, min: 6, max: 70, def: 24, opacity: 1, blend: 'source-over', scatter: 1.3, prize: true,
    stamp(c, o) {
      // A flat nib held at an angle: thin one way, wide the other.
      const w = o.r * (0.9 + 0.4 * o.p);
      c.save();
      c.translate(o.x, o.y);
      c.rotate(-0.785);
      c.globalAlpha = 1;
      c.fillStyle = o.color;
      c.fillRect(-w, -w * 0.16, w * 2, w * 0.32);
      c.restore();
    },
  },
  leaves: {
    name: N('Листики'), spacing: 1.1, min: 16, max: 110, def: 44, opacity: 1, blend: 'source-over', scatter: 1.6, prize: true,
    stamp(c, o) {
      const s = o.r * (0.6 + o.rng() * 0.5);
      c.save();
      c.translate(o.x + (o.rng() - 0.5) * o.r * 0.6, o.y + (o.rng() - 0.5) * o.r * 0.6);
      c.rotate(o.angle + (o.rng() - 0.5) * 1.6);
      c.scale(s, s);
      c.globalAlpha = 1;
      c.fillStyle = shade(o.color, (o.rng() - 0.5) * 0.5);
      c.fill(LEAF);
      c.strokeStyle = shade(o.color, -0.35);
      c.lineWidth = 0.08;
      c.beginPath();
      c.moveTo(-1, 0);
      c.lineTo(1, 0);
      c.stroke();
      c.restore();
    },
  },
  confetti: {
    name: N('Конфетти'), spacing: 0.5, min: 14, max: 120, def: 46, opacity: 1, blend: 'source-over', scatter: 1.4, prize: true,
    stamp(c, o) {
      c.globalAlpha = 1;
      for (let i = 0; i < 3; i++) {
        const a = o.rng() * 6.2832, d = o.r * Math.sqrt(o.rng());
        c.save();
        c.translate(o.x + Math.cos(a) * d, o.y + Math.sin(a) * d);
        c.rotate(o.rng() * 3.14);
        c.fillStyle = `hsl(${Math.floor(o.rng() * 360)} 90% 60%)`;
        c.fillRect(-o.r * 0.16, -o.r * 0.08, o.r * 0.32, o.r * 0.16);
        c.restore();
      }
    },
  },
  dashed: {
    name: N('Пунктир'), spacing: 0.08, min: 4, max: 50, def: 12, opacity: 1, blend: 'source-over', scatter: 1, prize: true,
    stamp(c, o) { if (Math.floor(o.dist / (o.r * 5)) % 2 === 0) disc(c, o.x, o.y, o.r, o.color); },
  },
  snow: {
    name: N('Снежинки'), spacing: 1.4, min: 18, max: 120, def: 46, opacity: 1, blend: 'source-over', scatter: 1.5, prize: true,
    stamp(c, o) {
      const s = o.r * (0.55 + o.rng() * 0.45);
      c.save();
      c.translate(o.x + (o.rng() - 0.5) * o.r * 0.5, o.y + (o.rng() - 0.5) * o.r * 0.5);
      c.rotate(o.rng() * 1.05);
      c.globalAlpha = 1;
      c.strokeStyle = o.color;
      c.lineWidth = Math.max(1.5, s * 0.12);
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.2832, cx = Math.cos(a), cy = Math.sin(a);
        c.moveTo(0, 0);
        c.lineTo(cx * s, cy * s);
        for (const t of [-1, 1]) {
          const b = a + t * 0.9;
          c.moveTo(cx * s * 0.6, cy * s * 0.6);
          c.lineTo(cx * s * 0.6 + Math.cos(b) * s * 0.28, cy * s * 0.6 + Math.sin(b) * s * 0.28);
        }
      }
      c.stroke();
      c.restore();
    },
  },
  pixel: {
    name: N('Пиксели'), spacing: 0.3, min: 10, max: 90, def: 30, opacity: 1, blend: 'source-over', scatter: 2, prize: true,
    stamp(c, o) {
      // Snaps to a grid of squares, like pixel art.
      const g = Math.max(4, Math.round(o.r));
      c.globalAlpha = 1;
      c.fillStyle = o.color;
      c.fillRect(Math.floor(o.x / g) * g, Math.floor(o.y / g) * g, g, g);
    },
  },
  eraser: {
    name: N('Ластик'), spacing: 0.08, min: 8, max: 120, def: 36, opacity: 1, blend: 'destination-out', scatter: 1, direct: true,
    stamp(c, o) { disc(c, o.x, o.y, o.r, '#000'); },
  },
};

// Draws a small live sample of a brush: the toolbar icons are the real brush.
export function drawSample(cv, id, color) {
  const b = BRUSHES[id];
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const rng = mulberry(42);
  const W = cv.width;
  const Hh = cv.height;
  const size = clamp(Hh * 0.3, b.min * 0.6, b.def * 1.1);
  if (id === 'eraser') {
    ctx.save();
    ctx.fillStyle = '#ffb6c9';
    ctx.strokeStyle = '#2a2140';
    ctx.lineWidth = 3;
    ctx.translate(W / 2, Hh / 2);
    ctx.rotate(-0.4);
    ctx.beginPath();
    ctx.roundRect(-W * 0.26, -Hh * 0.24, W * 0.52, Hh * 0.48, 8);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    return;
  }
  const buf = canvas(W, Hh);
  const bctx = buf.getContext('2d');
  let dist = 0;
  let left = 0;
  let prev = null;
  const pad = Math.max(size * 0.6, 8);
  for (let t = 0; t <= 1; t += 0.008) {
    const x = pad + (W - pad * 2) * t;
    const y = Hh / 2 + Math.sin(t * 6.2) * Hh * 0.17;
    if (prev) {
      const d = Math.hypot(x - prev[0], y - prev[1]);
      dist += d;
      left -= d;
    }
    if (left <= 0) {
      left = Math.max(0.6, b.spacing * size);
      b.stamp(bctx, {
        x, y, p: 0.35 + 0.55 * Math.sin(t * 3.14), r: size / 2, color, rng,
        angle: prev ? Math.atan2(y - prev[1], x - prev[0]) : 0, dist: dist * 3,
      });
    }
    prev = [x, y];
  }
  ctx.globalAlpha = b.opacity;
  ctx.drawImage(buf, 0, 0);
  ctx.globalAlpha = 1;
}
