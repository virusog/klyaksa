// All pixel pictures of the game, grouped into sets.
import { N } from './i18n.js';
import morePixels from './content/pixels.js';
import pixPets from './content/pixels-pets.js';
import pixWild from './content/pixels-wild.js';
import pixSea from './content/pixels-sea.js';
import pixNature from './content/pixels-nature.js';
import pixFood from './content/pixels-food.js';
import pixFruit from './content/pixels-fruit.js';
import pixMagic from './content/pixels-magic.js';
import pixSpace from './content/pixels-space.js';
import pixThings from './content/pixels-things.js';
import pixHolidays from './content/pixels-holidays.js';
import bigAnimals from './content/pixels16-animals.js';
import bigFantasy from './content/pixels16-fantasy.js';
import bigNature from './content/pixels16-nature.js';
import bigFood from './content/pixels16-food.js';
import bigThings from './content/pixels16-things.js';
import bigHeroes from './content/pixels16-heroes.js';

export const PIX_KEY = { '.': null, r: '#e5252a', p: '#ff85c0', o: '#ff8a1f', y: '#ffd447', g: '#46c257', b: '#2f93d6', v: '#8b5cf6', w: '#ffffff', k: '#2a2140', t: '#d9a273', n: '#8a5a35', a: '#7fd1ff', s: '#9aa3b2', c: '#27c4a8', f: '#f4d9c0', l: '#c9a7ff', m: '#a3e635', d: '#14935a', e: '#1e4fc2', h: '#d6336c', i: '#cfd6e0', z: '#5a3a22' };
const PIX_BASE = [
  { id: 'heart', name: N('Сердце'), a: ['............', '..rr....rr..', '.rrrr..rrrr.', 'rrwrrrrrrrrr', 'rwrrrrrrrrrr', 'rrrrrrrrrrrr', '.rrrrrrrrrr.', '..rrrrrrrr..', '...rrrrrr...', '....rrrr....', '.....rr.....', '............'] },
  { id: 'shroom', name: N('Грибок'), a: ['....rrrr....', '..rrwwrrrr..', '.rrrwwrrwrr.', '.rrrrrrrwrr.', 'rrwwrrrrrrrr', 'rrwwrrrrrwwr', 'rrrrrrrrrwwr', '.kkwwwwwwkk.', '...wkwwkw...', '...wwwwww...', '...wwwwww...', '....wwww....'] },
  { id: 'cat', name: N('Котик'), a: ['.k........k.', '.kk......kk.', '.kokkkkkkok.', '.kooooooook.', 'kooooooooook', 'kokkookkookk', 'kookooookokk', 'kooooppooook', '.koookkookk.', '..kooooook..', '...kkkkkkk..', '............'] },
  { id: 'cream', name: N('Мороженое'), a: ['....pppp....', '...pppppp...', '..ppwppppp..', '..pwpppppp..', '..pppppppp..', '..yyyyyyyy..', '..tntttntt..', '...ttnttn...', '...tntttt...', '....ttnt....', '....tnt.....', '.....t......'] },
  { id: 'flower', name: N('Цветок'), a: ['....vvvv....', '...vvvvvv...', '.vvvvyyvvvv.', 'vvvvyyyyvvvv', 'vvvvyyyyvvvv', '.vvvvyyvvvv.', '...vvvvvv...', '....vvvv....', '.....gg..gg.', '.gg..gg.gg..', '..gggggg....', '.....gg.....'] },
  { id: 'star', name: N('Звезда'), a: ['.....yy.....', '.....yy.....', '....yyyy....', 'yyyyyyyyyyyy', '.yyyyyyyyyy.', '..yykyykyy..', '..yyyyyyyy..', '.yyyyppyyyy.', '.yyyyyyyyyy.', '.yyy....yyy.', 'yyy......yyy', '............'] },
];

export const PIX_PACKS = [
  { id: 'first', name: N('Первые'), list: [...PIX_BASE, ...morePixels] },
  { id: 'pets', name: N('Питомцы'), list: pixPets },
  { id: 'wild', name: N('Дикие звери'), list: pixWild },
  { id: 'sea', name: N('Море'), list: pixSea },
  { id: 'nature', name: N('Природа'), list: pixNature },
  { id: 'food', name: N('Вкусности'), list: pixFood },
  { id: 'fruit', name: N('Фрукты и овощи'), list: pixFruit },
  { id: 'magic', name: N('Сказка'), list: pixMagic },
  { id: 'space', name: N('Космос и машины'), list: pixSpace },
  { id: 'things', name: N('Вещи'), list: pixThings },
  { id: 'holidays', name: N('Праздники и смайлики'), list: pixHolidays },
  { id: 'big-animals', name: N('Звери'), big: true, list: bigAnimals },
  { id: 'big-fantasy', name: N('Сказка'), big: true, list: bigFantasy },
  { id: 'big-nature', name: N('Природа'), big: true, list: bigNature },
  { id: 'big-food', name: N('Еда'), big: true, list: bigFood },
  { id: 'big-things', name: N('Вещи'), big: true, list: bigThings },
  { id: 'big-heroes', name: N('Герои'), big: true, list: bigHeroes },
];
export const PIX = PIX_PACKS.flatMap(p => p.list);
export const packOf = id => PIX_PACKS.find(p => p.list.some(t => t.id === id));
