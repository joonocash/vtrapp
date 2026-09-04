// pieces.js — alla bitformer + färgpalett.
// En bit är { id, cells: [[rad, kol], ...], w, h, weight }
// Ingen rotation i spelet, så varje rotation är en egen bit (precis som originalet).

const def = (id, rows, weight = 1) => {
  const cells = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch !== '.') cells.push([r, c]);
    });
  });
  return {
    id,
    cells,
    w: Math.max(...rows.map((r) => r.length)),
    h: rows.length,
    size: cells.length,
    weight,
  };
};

export const PIECES = [
  // Enstaka och linjer
  def('dot', ['#'], 3),
  def('h2', ['##'], 5),
  def('h3', ['###'], 4),
  def('h4', ['####'], 2.5),
  def('h5', ['#####'], 1.2),
  def('v2', ['#', '#'], 5),
  def('v3', ['#', '#', '#'], 4),
  def('v4', ['#', '#', '#', '#'], 2.5),
  def('v5', ['#', '#', '#', '#', '#'], 1.2),

  // Kvadrater
  def('sq2', ['##', '##'], 4),
  def('sq3', ['###', '###', '###'], 0.9),
  def('rect23', ['###', '###'], 1.6),
  def('rect32', ['##', '##', '##'], 1.6),

  // Hörn (2x2 minus ett)
  def('cornerA', ['##', '#.'], 3),
  def('cornerB', ['##', '.#'], 3),
  def('cornerC', ['#.', '##'], 3),
  def('cornerD', ['.#', '##'], 3),

  // Stora L / J (3x3 minus mitten-armar)
  def('L1', ['#..', '#..', '###'], 1.6),
  def('L2', ['###', '#..', '#..'], 1.6),
  def('L3', ['###', '..#', '..#'], 1.6),
  def('L4', ['..#', '..#', '###'], 1.6),

  // Små L (3 rutor, 2x2-fotavtryck är hörn ovan, dessa är 2x3)
  def('J1', ['#.', '#.', '##'], 2),
  def('J2', ['##', '#.', '#.'], 2),
  def('J3', ['##', '.#', '.#'], 2),
  def('J4', ['.#', '.#', '##'], 2),
  def('J5', ['###', '#..'], 2),
  def('J6', ['###', '..#'], 2),
  def('J7', ['#..', '###'], 2),
  def('J8', ['..#', '###'], 2),

  // T
  def('T1', ['###', '.#.'], 1.5),
  def('T2', ['.#.', '###'], 1.5),
  def('T3', ['#.', '##', '#.'], 1.5),
  def('T4', ['.#', '##', '.#'], 1.5),

  // S / Z
  def('S1', ['.##', '##.'], 1.1),
  def('S2', ['##.', '.##'], 1.1),
  def('S3', ['#.', '##', '.#'], 1.1),
  def('S4', ['.#', '##', '#.'], 1.1),
];

export const PIECE_BY_ID = Object.fromEntries(PIECES.map((p) => [p.id, p]));

// Färger. Index 0-6 används av vanliga block.
export const COLORS = [
  '#ff5d73', // korall
  '#ff9f43', // mandarin
  '#ffd93d', // sol
  '#6ee06a', // lime
  '#34d3e0', // akvamarin
  '#7b6cff', // indigo
  '#ff6bd6', // magenta
];
