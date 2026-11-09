// All sounds are synthesised, so the app needs no audio files and works offline.
import { state } from './store.js';

let ac;
let voiceReady = false;

// iPad only starts sound from a real tap, and can suspend it in the background.
function unlock() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state !== 'running') ac.resume?.().catch(() => {});
  if (state.voice && !voiceReady && window.speechSynthesis) {
    voiceReady = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}
window.addEventListener('click', unlock, true);
window.addEventListener('touchend', unlock, true);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ac && ac.state !== 'running') ac.resume?.().catch(() => {});
});

function tone(f, t = 0, d = 0.14, type = 'sine', vol = 0.16, slide = 0) {
  if (!state.sound || !ac || ac.state !== 'running') return;
  const c = ac;
  const o = c.createOscillator();
  const g = c.createGain();
  const at = c.currentTime + t;
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, at + d);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + d);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + d + 0.02);
}

export const sfx = {
  pop: () => tone(520, 0, 0.09, 'sine', 0.12, 1.7),
  fill: () => { tone(330, 0, 0.16, 'triangle', 0.12, 2.2); },
  soft: () => tone(240, 0, 0.14, 'sine', 0.08, 0.8),
  drop: () => { tone(880, 0, 0.1, 'sine', 0.14, 0.45); },
  ding: () => { tone(880, 0, 0.16); tone(1320, 0.08, 0.22); },
  squeak: () => { tone(700, 0, 0.1, 'triangle', 0.12, 1.6); tone(1000, 0.09, 0.12, 'triangle', 0.12, 1.4); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.26, 'triangle', 0.15)),
};

export function speak(text) {
  if (!state.voice || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  u.rate = 0.98;
  u.pitch = 1.15;
  speechSynthesis.speak(u);
}
