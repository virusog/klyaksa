// Every coloring page in the app.
import { PAGES as base } from './art.js';
import animals from './content/pages-animals.js';
import fantasy from './content/pages-fantasy.js';
import nature from './content/pages-nature.js';
import world from './content/pages-world.js';

export const PAGES = [...base, ...animals, ...fantasy, ...nature, ...world];
