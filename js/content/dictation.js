// Graphic dictations, the four starter pictures. Grid of 20 by 14 cells, row 0
// at the top. Sorted from fewest commands to most; ids are star keys, so they
// never change.
export default [
  {
    id: 'house', name: 'Домик', color: '#ffb340', start: [6, 13],
    moves: '6U 1L 5RU 2RD 2U 1R 3D 2RD 1L 6D 8L',
  },
  {
    id: 'fir', name: 'Ёлочка', color: '#46c257', start: [9, 13],
    moves: '2U 4L 3RU 2L 3RU 2L 3RU 3RD 2L 3RD 2L 3RD 4L 2D 2L',
  },
  {
    id: 'sailboat', name: 'Кораблик', color: '#7fd1ff', start: [2, 10],
    moves: '2RD 5R 1D 2R 1U 5R 2RU 7L 1U 5R 5LU 1U 3R 1LU 1RU 4L 2D 5LD 5R 2D 8L',
  },
  {
    id: 'dog', name: 'Собачка', color: '#d9a273', start: [4, 6],
    moves: '7R 5U 1R 2RD 1R 1RD 2R 1D 1L 1D 3L 1LD 5D 1R 1D 3L 3U 1LU 3L 1LD 2D 1R 1D 3L 5U 2LU 1U 2RD 1U',
  },
];
