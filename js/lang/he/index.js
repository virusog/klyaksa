// All he phrases, merged from one file per part of the app (see tools/i18n.mjs).
import core from './core.js';
import school from './school.js';
import lessonsA from './lessons-a.js';
import lessonsB from './lessons-b.js';
import coloring from './coloring.js';
import games from './games.js';
import pixels from './pixels.js';
import words from './words.js';
import lab from './lab.js';
import playPairs from './play-pairs.js';
import playPuzzle from './play-puzzle.js';
import playDiff from './play-diff.js';
import playDots from './play-dots.js';
import playDictation from './play-dictation.js';
import playOneline from './play-oneline.js';
import playShades from './play-shades.js';
import playPatterns from './play-patterns.js';
import playAnim from './play-anim.js';

export default {
  ...core,
  ...school,
  ...lessonsA,
  ...lessonsB,
  ...coloring,
  ...games,
  ...pixels,
  ...words,
  ...lab,
  ...playPairs,
  ...playPuzzle,
  ...playDiff,
  ...playDots,
  ...playDictation,
  ...playOneline,
  ...playShades,
  ...playPatterns,
  ...playAnim,
};
