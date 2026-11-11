import { h } from '../util.js';
import { topbar } from '../ui.js';

export default function run(root) {
  root.append(h('div', { class: 'screen' }, topbar('Скоро', { back: '#/games' })));
}
