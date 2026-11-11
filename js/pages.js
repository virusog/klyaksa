// Every coloring page in the app.
import { PAGES as base } from './art.js';
import animals from './content/pages-animals.js';
import fantasy from './content/pages-fantasy.js';
import nature from './content/pages-nature.js';
import world from './content/pages-world.js';
import moreAnimals from './content/pages2-animals.js';
import moreFantasy from './content/pages2-fantasy.js';
import moreNature from './content/pages2-nature.js';
import moreWorld from './content/pages2-world.js';
import morePatterns from './content/pages2-patterns.js';

export const PAGES = [...base, ...animals, ...fantasy, ...nature, ...world,
  ...moreAnimals, ...moreFantasy, ...moreNature, ...moreWorld, ...morePatterns];
