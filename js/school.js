// Drawing school: the same picture three times, with less help every time.
import { h, outlineSvg, svgEl, samplePath, pathLength, matchScore, starsFor, inkPoints, sleep } from './util.js';
import { CHAPTERS, lessonById, allPaths } from './lessons.js';
import { Painter } from './painter.js';
import { state, award, db } from './store.js';
import { topbar, btn, iconBtn, starBadge, celebrate, speaker, brushRail, paletteBar, sizeSlider, autosaver, safeSave, confirmBox } from './ui.js';
import { saveArt } from './studio.js';
import { sfx } from './audio.js';

const MODES = [
  { id: 'trace', name: 'Обведи', hint: 'Рисуй по подсказке' },
  { id: 'copy', name: 'Повтори', hint: 'Смотри и рисуй рядом' },
  { id: 'memory', name: 'Сама', hint: 'Запомни и нарисуй' },
];

const key = (id, m) => `lesson:${id}:${m}`;
const modeStars = (id, m) => state.best[key(id, m)] || 0;

export function school(root) {
  const nextId = CHAPTERS.flatMap(c => c.lessons).find(l => !modeStars(l.id, 'trace'))?.id;
  root.append(h('div', { class: 'screen scroll school' },
    topbar('Школа рисования', { right: [starBadge()] }),
    CHAPTERS.map((ch, n) => h('section', { class: 'chapter', style: { '--ch': ch.color } },
      h('div', { class: 'chapter-head' },
        h('span', { class: 'chapter-n' }, String(n + 1)),
        h('div', {}, h('h2', {}, ch.title), h('p', {}, ch.about)),
      ),
      h('div', { class: 'lesson-grid' }, ch.lessons.map(l => {
        const done = MODES.reduce((s, m) => s + modeStars(l.id, m.id), 0);
        return h('a', { class: `lesson-card ${l.id === nextId ? 'next' : ''}`, href: `#/lesson/${l.id}` },
          outlineSvg(allPaths(l), { sw: 11 }),
          h('b', {}, l.title),
          h('span', { class: 'mini-stars' }, `${done > 0 ? '★'.repeat(Math.min(done, 9)) : 'Начать'}`),
          l.id === nextId && h('em', { class: 'tag' }, 'Сюда!'),
        );
      })),
    )),
  ));
}

export function lessonIntro(root, id) {
  const L = lessonById(id);
  root.append(h('div', { class: 'screen scroll intro' },
    topbar(L.title, { back: '#/school', right: [starBadge()] }),
    h('div', { class: 'intro-body' },
      h('div', { class: 'intro-art' }, outlineSvg(allPaths(L))),
      h('div', { class: 'mode-list' },
        h('p', { class: 'lead' }, 'Один рисунок, три шага. С каждым разом подсказок меньше, а рука умнее.'),
        MODES.filter(m => !(L.noCopy && m.id !== 'trace')).map((m, i) =>
          h('a', { class: `mode-card m${i}`, href: `#/lesson/${id}/${m.id}` },
            h('span', { class: 'mode-n' }, String(i + 1)),
            h('div', {}, h('b', {}, m.name), h('small', {}, m.hint)),
            h('span', { class: 'mode-stars' }, '★'.repeat(modeStars(id, m.id)) + '☆'.repeat(3 - modeStars(id, m.id))),
          )),
      ),
    ),
  ));
}

function animatePaths(svg, indices, { speed = 0.9 } = {}) {
  let cancelled = false;
  (async () => {
    const els = [...svg.querySelectorAll('path')];
    for (const i of indices) els[i].style.visibility = 'hidden';
    for (const i of indices) {
      if (cancelled) return;
      const el = els[i];
      const len = pathLength(el.getAttribute('d'));
      el.style.visibility = 'visible';
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      const ms = Math.min(1500, 220 + len / speed);
      const anim = el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
      await anim.finished.catch(() => {});
      el.style.strokeDasharray = '';
      el.style.strokeDashoffset = '';
      anim.cancel();
      await sleep(60);
    }
  })();
  return () => { cancelled = true; };
}

export function lessonPlay(root, id, mode) {
  const L = lessonById(id);
  const steps = mode === 'memory'
    ? [{ t: 'Рисуй по памяти! Если совсем забыла, нажми «Подсмотреть».', p: allPaths(L) }]
    : L.steps;
  const SCALE = 1.2;
  let i = 0;
  let phase = 'draw';
  let warned = false;
  let scores = [];
  let stepLog = 0;
  let stopAnim = () => {};
  let closed = false;
  let finished = false;
  const draftId = `draft_lesson_${id}_${mode}`;

  const stageEl = h('div', { class: 'stage-host' });
  const p = new Painter(stageEl, { w: 1200, h: 900, layers: 2, brush: 'pencil', color: '#2a2140', pad: 6, fillGap: 11,
    onChange: () => { if (p.log.length < stepLog) stepLog = p.log.length; },
  });
  p.active = 1;
  p.size = 9;

  const guide = svgEl('svg', { viewBox: '0 0 1000 750', class: 'guide' });
  p.under.append(guide);

  const refCard = h('div', { class: 'ref-card' });
  const voice = speaker('');
  const dots = h('div', { class: 'step-dots' }, steps.map(() => h('i')));
  const undoBtn = iconBtn('undo', 'Отменить', () => p.undo());
  const eraserBtn = iconBtn('eraser', 'Ластик', () => {
    const on = p.brushId !== 'eraser';
    p.setBrush(on ? 'eraser' : 'pencil');
    p.size = on ? 40 : 9;
    eraserBtn.classList.toggle('on', on);
  });
  const showBtn = iconBtn('play', 'Показать ещё раз', () => showStep(true));
  const peekBtn = btn('ghost', 'Подсмотреть', peek);
  const nextBtn = btn('primary', 'Дальше', next);
  const restartBtn = iconBtn('trash', 'Начать заново', async () => {
    if (!(await confirmBox('Начать этот рисунок заново?', 'Заново', 'Нет'))) return;
    saver.stop();
    await saver.flush().catch(() => {});
    finished = true;
    await db.del('kv', draftId).catch(() => {});
    location.reload();
  }, 'hidden');
  const colorTools = h('div', { class: 'lesson-colors hidden' });
  const foot = h('footer', { class: 'lesson-foot' }, voice,
    h('div', { class: 'spacer' }), mode === 'memory' ? peekBtn : showBtn, eraserBtn, undoBtn, nextBtn);

  const bodyEl = h('div', { class: 'lesson-body' }, mode !== 'trace' && refCard, stageEl);
  root.append(h('div', { class: `screen lesson mode-${mode}` },
    topbar(L.title, { back: `#/lesson/${id}`, right: [restartBtn, dots] }),
    bodyEl,
    colorTools,
    foot,
  ));
  p.fit();

  function showStep(replayAnim) {
    stopAnim();
    const s = steps[i];
    [...dots.children].forEach((d, n) => {
      d.classList.toggle('on', n === i);
      d.classList.toggle('done', n < i);
    });
    if (!replayAnim) { voice.say(s.t); stepLog = p.log.length; }

    if (mode === 'trace') {
      guide.textContent = '';
      const prev = steps.slice(0, i).flatMap(x => x.p);
      prev.forEach(d => guide.append(svgEl('path', { d, class: 'g-old' })));
      s.p.forEach(d => guide.append(svgEl('path', { d, class: 'g-cur' })));
      stopAnim = animatePaths(guide, s.p.map((_, n) => prev.length + n));
    } else if (mode === 'copy') {
      refCard.textContent = '';
      const prev = steps.slice(0, i).flatMap(x => x.p);
      const art = outlineSvg([...prev, ...s.p], { cls: 'ref-art' });
      [...art.children].forEach((e, n) => e.classList.add(n < prev.length ? 'g-old' : 'g-cur'));
      refCard.append(art);
      stopAnim = animatePaths(art, s.p.map((_, n) => prev.length + n));
    } else {
      startMemory();
    }
  }

  async function startMemory() {
    refCard.textContent = '';
    const art = outlineSvg(allPaths(L), { cls: 'ref-art' });
    const ring = h('div', { class: 'count' }, '8');
    refCard.append(art, ring);
    p.enabled = false;
    nextBtn.disabled = true;
    peekBtn.disabled = true;
    voice.say('Смотри внимательно! Запоминай формы, потом картинка спрячется.');
    for (let n = 8; n > 0; n--) {
      if (closed) return;
      ring.textContent = String(n);
      await sleep(1000);
    }
    if (closed) return;
    refCard.textContent = '';
    refCard.append(h('div', { class: 'ref-hidden' }, 'Спряталось!'));
    p.enabled = true;
    nextBtn.disabled = false;
    peekBtn.disabled = false;
    voice.say(steps[0].t);
    stepLog = p.log.length;
  }

  async function peek() {
    refCard.textContent = '';
    refCard.append(outlineSvg(allPaths(L), { cls: 'ref-art' }));
    await sleep(2000);
    if (closed) return;
    refCard.textContent = '';
    refCard.append(h('div', { class: 'ref-hidden' }, 'Спряталось!'));
  }

  function next() {
    if (phase === 'color') return finish();
    const ink = inkPoints(p.log, stepLog, SCALE);
    if (!ink.length && !warned) {
      warned = true;
      voice.say('Попробуй хотя бы линию! Ошибиться тут нельзя.');
      sfx.soft();
      return;
    }
    warned = false;
    if (ink.length && mode === 'trace') {
      const g = steps[i].p.flatMap(d => samplePath(d, 10));
      scores.push(matchScore(g, ink, { tol: 34 }));
      sfx.ding();
    } else if (mode === 'trace') {
      scores.push(0);
    }
    i++;
    p.dirty = true;
    if (i < steps.length) { showStep(false); return; }
    if (mode !== 'trace') {
      const g = allPaths(L).flatMap(d => samplePath(d, 10));
      scores = [matchScore(g, inkPoints(p.log, 0, SCALE), { tol: 56, normalize: true })];
    }
    startColor();
  }

  function startColor() {
    stopAnim();
    phase = 'color';
    p.dirty = true;
    guide.style.display = 'none';
    refCard.remove();
    [...dots.children].forEach(d => d.classList.add('done'));
    voice.say('Рисунок готов! Теперь раскрась. Цвет ложится под линии.');
    p.active = 0;
    p.setBrush('marker');
    p.size = 30;
    p.color = '#ffb340';
    eraserBtn.style.display = 'none';
    showBtn.style.display = 'none';
    peekBtn.style.display = 'none';
    nextBtn.textContent = 'Готово';
    const rail = brushRail(p, ['marker', 'crayon', 'watercolor', 'chalk', 'glitter', 'rainbow'], { onPick: () => { sz.sync(); fillBtn.classList.remove('on'); } });
    const sz = sizeSlider(p);
    const pal = paletteBar(p, { onPick: () => { rail.redraw(); sz.sync(); } });
    const fillBtn = iconBtn('fill', 'Заливка', () => {
      p.mode = p.mode === 'fill' ? 'draw' : 'fill';
      fillBtn.classList.toggle('on', p.mode === 'fill');
      rail.mark();
    });
    colorTools.classList.remove('hidden');
    bodyEl.prepend(rail);
    colorTools.append(h('div', { class: 'tools-foot' }, fillBtn, sz, pal));
    p.fit();
  }

  async function finish() {
    if (!p.log.length) {
      voice.say('Тут пока пусто. Нарисуй хоть что-нибудь!');
      sfx.soft();
      return;
    }
    const avg = scores.length ? scores.reduce((a, b) => a + b) / scores.length : 0.3;
    const stars = starsFor(avg);
    let artId;
    try {
      artId = await safeSave(() => saveArt(p, { kind: 'lesson', title: L.title, layersN: 2, habitat: L.habitat }));
    } catch { return; }
    const res = award(key(id, mode), stars);
    finished = true;
    saver.stop();
    db.del('kv', draftId).catch(() => {});
    if (closed) return;
    const nextMode = MODES[MODES.findIndex(m => m.id === mode) + 1];
    const praise = stars === 3 ? 'Точная рука!' : stars === 2 ? 'Очень похоже!' : 'Хорошее начало, с каждым разом будет легче.';
    celebrate({
      title: praise,
      text: res.gain ? `+${res.gain} ★` : 'Рисунок сохранён в галерее.',
      stars,
      unlocked: res.unlocked,
      actions: [
        { label: 'Как я рисовала', fn: () => { location.hash = `#/art/${artId}/replay`; } },
        !L.noCopy && nextMode
          ? { label: `Дальше: ${nextMode.name}`, primary: true, fn: () => { location.hash = `#/lesson/${id}/${nextMode.id}`; } }
          : { label: 'К урокам', primary: true, fn: () => { location.hash = '#/school'; } },
      ],
    });
  }

  // Unfinished lessons are kept as a draft and resume where she stopped.
  const saver = autosaver(() => p.dirty && p.log.length > 0, async () => {
    p.dirty = false;
    try {
      await db.put('kv', { id: draftId, ...(await p.serialize()), i, phase, scores, stepLog });
    } catch (e) {
      p.dirty = true;
      throw e;
    }
  }, () => p.isBusy());

  db.get('kv', draftId).catch(() => null).then(async d => {
    if (closed) return;
    if (!d) { showStep(false); return; }
    await p.restore(d);
    if (closed) return;
    i = d.i;
    scores = d.scores || [];
    restartBtn.classList.remove('hidden');
    if (d.phase === 'color') { startColor(); p.dirty = false; return; }
    if (mode === 'memory') {
      // She has already seen the picture, so there is no second countdown.
      dots.children[0].classList.add('on');
      refCard.append(h('div', { class: 'ref-hidden' }, 'Спряталось!'));
      voice.say(steps[0].t);
    } else {
      showStep(false);
    }
    stepLog = d.stepLog;
  });

  return () => {
    closed = true;
    stopAnim();
    saver.stop();
    if (finished) p.destroy();
    else safeSave(saver.flush).catch(() => {}).finally(() => p.destroy());
  };
}

