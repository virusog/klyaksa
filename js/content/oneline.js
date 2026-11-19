// Starter figures for «Одним росчерком», on a 1000 by 750 sheet.
// nodes are points, edges join two points by their index in nodes.
export default [
  {
    // The loose tail shows where to start or finish: its end, or the corner it hangs from.
    id: 'kite', name: 'Воздушный змей',
    nodes: [[500, 90], [700, 290], [500, 520], [300, 290], [640, 655]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4]],
  },
  {
    // Any start works, but closing the body before the tail is a dead end.
    id: 'fish', name: 'Рыбка',
    nodes: [[850, 375], [610, 200], [610, 550], [370, 375], [160, 235], [160, 515]],
    edges: [[0, 1], [1, 3], [3, 2], [2, 0], [3, 4], [4, 5], [5, 3]],
  },
  {
    // No loose end gives the start away: only the bow and the mast top have three lines.
    id: 'boat', name: 'Кораблик',
    nodes: [[200, 470], [500, 470], [800, 470], [680, 640], [320, 640], [500, 110], [720, 340]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 5], [5, 6], [6, 1], [5, 0]],
  },
  {
    // A five-point star inside a pentagon, on a handle: every star point has four lines.
    id: 'wand', name: 'Волшебная палочка',
    nodes: [[570, 95], [774, 244], [696, 484], [444, 484], [366, 244], [340, 580], [240, 665]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [2, 4], [4, 1], [1, 3], [3, 0], [3, 5], [5, 6]],
  },
];
