// Graphic dictations, harder set B: long outlines with diagonals on 20x14 squared paper.
// Each picture is one closed line; commands are a count and a direction
// (R, L, U, D and the diagonals RU, RD, LU, LD). Sorted from fewest commands to most.
export default [
  {
    id: 'gb-cat',
    name: 'Кошка',
    color: '#f2a03d',
    start: [3, 0],
    moves: '2RD 3R 2RU 2D 1RD 2D 1LD 2RD 1D 1RD 1D 1R 2RU 3U 1RU 1R 1RD 1D 1LU 1L 4D 3LD 5L 1LU 1LD 3L 1U 1R 6U 2L 1LU 2U 1RU 2U',
  },
  {
    id: 'gb-rocket',
    name: 'Ракета',
    color: '#e2524a',
    start: [10, 0],
    moves: '1RD 1D 1RD 1D 1RD 1L 2D 2RD 1D 1RD 2D 2LU 1L 2D 1LU 1D 1LD 1LU 1U 1LD 2U 1L 2LD 2U 1RU 1U 2RU 2U 1L 1RU 1U 1RU 1U 1RU',
  },
  {
    id: 'gb-elephant',
    name: 'Слон',
    color: '#8fa3b8',
    start: [5, 1],
    moves: '2R 2RD 1RU 5R 1RD 1D 1R 1RD 3D 1RD 1LD 1L 5U 1L 8D 3L 2U 1LU 1L 1LD 2D 3L 5U 2LD 2U 1L 3D 1LD 2L 1LU 1U 1R 1RD 7U 3RU',
  },
  {
    id: 'gb-camel',
    name: 'Верблюд',
    color: '#d6a45a',
    start: [4, 5],
    moves: '2RU 1R 2RD 2RU 1R 2RD 1R 4U 1RD 1RU 1R 1RD 1D 2L 4D 1LD 5D 1L 3U 1L 3D 1L 4U 6L 4D 1L 3U 1L 3D 1L 5U 1LD 2U 1RU 1U',
  },
  {
    id: 'gb-deer',
    name: 'Олень',
    color: '#b07a45',
    start: [4, 7],
    moves: '7R 2RU 2U 2LU 1U 2RD 2U 1R 2D 2RU 1D 2LD 1D 2R 1RD 1D 2L 1LD 2D 1LD 4D 1L 3U 1L 3D 1L 4U 3L 4D 1L 3U 1L 3D 1L 5U 1LU 2U 1RD',
  },
  {
    id: 'gb-plane',
    name: 'Самолёт',
    color: '#4a90d9',
    start: [19, 7],
    moves: '1LD 1L 1LD 3L 2LD 1R 1D 2L 2LD 2L 3RU 2U 3L 1LU 1L 2LD 1L 2U 1L 2U 1R 2U 1R 2RD 1R 1RU 3R 2U 3LU 2R 2RD 2R 1D 1L 2RD 3R 1RD 1R 1RD',
  },
  {
    id: 'gb-squirrel',
    name: 'Белка',
    color: '#d9742b',
    start: [2, 5],
    moves: '3RU 2U 1RD 1D 1R 1RD 3D 1RD 3D 1RD 1RU 6U 2RU 3R 2RD 3D 1LD 1LU 3D 1LD 1D 1LD 9L 1U 1R 2U 2L 1LD 1L 1LU 1U 1RU 1R 1RD 1R 2U 2L 1LU 1U',
  },
  {
    id: 'gb-rooster',
    name: 'Петух',
    color: '#e0463c',
    start: [2, 4],
    moves: '1RU 1R 2U 1RU 1D 1RU 1D 1RU 3D 2RD 2R 1RU 2U 2RU 2R 2RD 4D 1LU 3D 1LU 2D 1LU 2LD 1L 3D 2L 1RU 2U 2L 3D 2L 1RU 2U 1L 2LU 3U 1LD 1LU 1U 1L',
  },
  {
    id: 'gb-dino',
    name: 'Динозавр',
    color: '#58a84f',
    start: [1, 9],
    moves: '1U 1RU 1R 1RU 2U 1RD 2U 1RD 2U 1RD 2RU 2RD 1RU 2D 1RU 2D 1RU 2D 1RU 2D 2R 1U 1RD 1U 1RD 1D 4L 2LD 3D 3L 1U 1R 2U 4L 3D 3L 1U 1R 2U 3L 1LU',
  },
  {
    id: 'gb-train',
    name: 'Паровоз',
    color: '#3f8f6a',
    start: [1, 3],
    moves: '7R 1D 1L 3D 2R 1RU 1R 1RD 1R 3U 1LU 1U 4R 1D 1LD 3D 1R 1RD 2D 2RD 3L 1D 1LD 1L 1LU 1U 1L 1D 1LD 1L 1LU 1U 1L 1D 1LD 3L 1LU 1U 1L 1U 1L 1U 1R 6U 1L 1U',
  },
];
