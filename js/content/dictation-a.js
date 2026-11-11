// Graphic dictations, harder pack A: ten pictures of 24 to 30 commands on the
// grid of 20 by 14 cells, row 0 at the top. The first five use only straight
// lines, the last five add diagonals. Sorted from fewest commands to most; ids
// are star keys, so they never change.
//
// The cup and the crown let the line pass through a point it has already
// visited (never along the same segment): that closes the hole in the cup's
// handle and stands the gems on the tips of the crown.
export default [
  {
    id: 'ga-cup', name: 'Чашка', color: '#ff8fb1', start: [4, 2],
    moves: '9R 1D 4R 6D 4L 1U 3R 4U 3L 4D 1L 2D 1L 1D 3R 1D 11L 1U 3R 1U 1L 2U 1L 6U',
  },
  {
    id: 'ga-mushroom', name: 'Гриб', color: '#e8543f', start: [7, 2],
    moves: '6R 1D 2R 1D 1R 2D 1R 3D 2L 1U 2L 4D 6L 4U 2L 1D 2L 3U 1R 2U 1R 1U 2R 1U',
  },
  {
    id: 'ga-tower', name: 'Замок с башней', color: '#aab6d3', start: [6, 1],
    moves: '3R 1D 2R 1U 3R 2D 1L 3D 3R 1U 1R 8D 6L 3U 2L 3D 6L 8U 1R 1D 3R 3U 1L 2U',
  },
  {
    id: 'ga-robot', name: 'Робот', color: '#4fc3d9', start: [10, 0],
    moves: '1R 1D 3R 4D 2R 2U 1L 1U 2R 5D 2L 6D 3L 3U 3L 3D 3L 6U 1L 3D 1L 5U 3R 4U 3R 1U',
  },
  {
    id: 'ga-key', name: 'Ключ', color: '#f0a020', start: [2, 4],
    moves: '4R 1D 1R 1D 12R 4D 2L 2U 1L 3D 1L 3U 1L 2D 2L 2U 5L 1D 1L 1D 4L 1U 1L 4U 1R 1U',
  },
  {
    id: 'ga-heart', name: 'Сердце со стрелой', color: '#ff5d7a', start: [10, 14],
    moves: '5LU 1U 2L 1LD 1L 2RU 2LU 1R 1RD 1R 2U 2RU 2R 2RD 2RU 2R 2RD 2D 1R 1U 2RD 2LD 1U 2L 1D 5LD',
  },
  {
    id: 'ga-crown', name: 'Корона', color: '#ffd23f', start: [4, 13],
    moves: '2U 2LU 4U 1LU 1RU 1RD 1LD 2RD 2RU 2RD 2RU 2LU 2RU 2RD 2LD 2RD 2RU 2RD 2RU 1LU 1RU 1RD 1LD 4D 2LD 2D 12L',
  },
  {
    id: 'ga-truck', name: 'Грузовик', color: '#4f9bea', start: [1, 3],
    moves: '10R 5D 1R 3U 3R 2RD 2R 4D 2L 1D 1LD 1L 1LU 1U 4L 1D 1LD 1L 1LU 1U 1L 1D 1LD 1L 1LU 1U 2L 8U',
  },
  {
    id: 'ga-giraffe', name: 'Жираф', color: '#f2a154', start: [9, 7],
    moves: '5RU 1LU 1R 1U 1R 1D 2R 1RD 1D 2L 4LD 7D 1L 3U 1L 3D 1L 4U 2L 4D 1L 3U 1L 3D 1L 6U 2LD 1U 2RU 5R',
  },
  {
    id: 'ga-duck', name: 'Утка', color: '#ffe14d', start: [13, 2],
    moves: '2R 1RD 1D 2R 1LD 1L 1LD 1D 2RD 1D 2LD 2L 1RD 2L 1U 2L 1RD 2L 1U 2L 2LU 1U 2LU 1R 1RD 7R 1RU 1LU 3U 1RU',
  },
];
