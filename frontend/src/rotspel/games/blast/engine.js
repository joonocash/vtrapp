// engine.js — all spellogik, helt fri från React och DOM.
// Testbar i node: `node -e "import('./engine.js').then(...)"`

import { PIECES, PIECE_BY_ID, COLORS } from './pieces.js';

export const SIZE = 8;

/* ---------- slump ---------- */

// Deterministisk RNG. Samma seed = samma spel, vilket krävs för banor och highscore.
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/* ---------- bräde ---------- */

// En cell är null eller { c: färgindex, t: typ, hp?: liv }
// t: 'block' | 'ice' | 'stone' | 'gem' | 'bomb'
// stone rensas aldrig men räknas som fylld. ice kräver två rensningar.

export const idx = (r, c) => r * SIZE + c;
export const createBoard = () => new Array(SIZE * SIZE).fill(null);
export const cloneBoard = (b) => b.slice();

export function countFilled(board) {
  let n = 0;
  for (const cell of board) if (cell) n++;
  return n;
}

export function canPlace(board, piece, r0, c0) {
  for (const [dr, dc] of piece.cells) {
    const r = r0 + dr;
    const c = c0 + dc;
    if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return false;
    if (board[idx(r, c)]) return false;
  }
  return true;
}

export function placements(board, piece) {
  const out = [];
  for (let r = 0; r <= SIZE - piece.h; r++) {
    for (let c = 0; c <= SIZE - piece.w; c++) {
      if (canPlace(board, piece, r, c)) out.push([r, c]);
    }
  }
  return out;
}

export function hasPlacement(board, piece) {
  for (let r = 0; r <= SIZE - piece.h; r++) {
    for (let c = 0; c <= SIZE - piece.w; c++) {
      if (canPlace(board, piece, r, c)) return true;
    }
  }
  return false;
}

// Lägger biten och returnerar nytt bräde + vilka celler som fylldes.
export function place(board, piece, r0, c0, color) {
  const next = cloneBoard(board);
  const filled = [];
  for (const [dr, dc] of piece.cells) {
    const r = r0 + dr;
    const c = c0 + dc;
    next[idx(r, c)] = { c: color, t: 'block' };
    filled.push([r, c]);
  }
  return { board: next, filled };
}

/* ---------- rensning ---------- */

export function findFullLines(board) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < SIZE; r++) {
    let full = true;
    for (let c = 0; c < SIZE; c++) if (!board[idx(r, c)]) { full = false; break; }
    if (full) rows.push(r);
  }
  for (let c = 0; c < SIZE; c++) {
    let full = true;
    for (let r = 0; r < SIZE; r++) if (!board[idx(r, c)]) { full = false; break; }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

// Rensar raderna/kolumnerna och rapporterar vad som faktiskt försvann.
// Sten blir kvar. Is tappar ett liv först och försvinner andra gången.
export function resolveClears(board, lines) {
  const next = cloneBoard(board);
  const marked = new Set();
  for (const r of lines.rows) for (let c = 0; c < SIZE; c++) marked.add(idx(r, c));
  for (const c of lines.cols) for (let r = 0; r < SIZE; r++) marked.add(idx(r, c));

  const removed = [];
  const cracked = [];
  let gems = 0;

  for (const i of marked) {
    const cell = next[i];
    if (!cell) continue;
    if (cell.t === 'stone') continue;
    if (cell.t === 'ice' && (cell.hp ?? 2) > 1) {
      next[i] = { ...cell, hp: (cell.hp ?? 2) - 1 };
      cracked.push([Math.floor(i / SIZE), i % SIZE]);
      continue;
    }
    if (cell.t === 'gem') gems++;
    removed.push([Math.floor(i / SIZE), i % SIZE, cell]);
    next[i] = null;
  }

  return { board: next, removed, cracked, gems };
}

/* ---------- poäng ---------- */

// Flera linjer i samma drag ger en kraftig multiplikator.
const COMBO_MULT = [0, 1, 2.2, 4, 6.5, 9, 12, 15, 18];
export const comboMult = (lines) => COMBO_MULT[Math.min(lines, COMBO_MULT.length - 1)];
// Streak = antal placeringar i rad som rensat minst en linje.
export const streakMult = (streak) => 1 + 0.25 * Math.min(Math.max(streak - 1, 0), 12);

export function scorePlacement({ cells }) {
  return cells;
}

export function scoreClear({ lines, streak }) {
  if (lines <= 0) return 0;
  const raw = 80 * lines;
  return Math.round(raw * comboMult(lines) * streakMult(streak));
}

/* ---------- game over ---------- */

export function hasAnyMove(board, pieces) {
  return pieces.some((p) => p && hasPlacement(board, p));
}

/* ---------- bricka med tre bitar ---------- */

// Kan alla tre bitarna placeras i någon ordning? Djupsökning med budget
// så att en omöjlig bricka inte fryser tråden.
export function traySolvable(board, pieces, budget = 20000) {
  const list = pieces.filter(Boolean);
  if (!list.length) return true;
  let nodes = 0;

  const dfs = (b, remaining) => {
    if (!remaining.length) return true;
    if (nodes++ > budget) return false;
    for (let i = 0; i < remaining.length; i++) {
      const piece = remaining[i];
      const rest = remaining.filter((_, j) => j !== i);
      for (const [r, c] of placements(b, piece)) {
        if (nodes++ > budget) return false;
        const { board: b2 } = place(b, piece, r, c, 0);
        const lines = findFullLines(b2);
        const b3 = lines.rows.length || lines.cols.length
          ? resolveClears(b2, lines).board
          : b2;
        if (dfs(b3, rest)) return true;
      }
    }
    return false;
  };

  return dfs(board, list);
}

function weightedPiece(rng, fullness, allowed) {
  // Ju fullare bräde, desto mindre bitar. Utan det här känns spelet orättvist.
  const bias = 1 - fullness * 0.14;
  const pool = allowed ? PIECES.filter((p) => allowed.includes(p.id)) : PIECES;
  let total = 0;
  const weights = pool.map((p) => {
    const w = p.weight * Math.pow(bias, p.size);
    total += w;
    return w;
  });
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// Genererar tre bitar som går att spela ut. Faller tillbaka stegvis
// istället för att ge upp: hellre en svår bricka än en död.
export function generateTray(board, rng, { allowed = null, tries = 60 } = {}) {
  const fullness = countFilled(board) / (SIZE * SIZE);
  let fallback = null;

  for (let t = 0; t < tries; t++) {
    const pieces = [0, 1, 2].map(() => weightedPiece(rng, fullness, allowed));
    const eachFits = pieces.every((p) => hasPlacement(board, p));
    if (!eachFits) continue;
    if (!fallback) fallback = pieces;
    if (traySolvable(board, pieces)) return pieces.map(withColor(rng));
  }

  if (fallback) return fallback.map(withColor(rng));

  // Sista utvägen: minsta möjliga bitar.
  const tiny = [PIECE_BY_ID.dot, PIECE_BY_ID.h2, PIECE_BY_ID.v2].filter((p) =>
    hasPlacement(board, p)
  );
  const pieces = [0, 1, 2].map((i) => tiny[i % Math.max(tiny.length, 1)] || PIECE_BY_ID.dot);
  return pieces.map(withColor(rng));
}

const withColor = (rng) => (piece) => ({
  ...piece,
  key: `${piece.id}-${Math.floor(rng() * 1e9)}`,
  color: Math.floor(rng() * COLORS.length),
});

/* ---------- bomber ---------- */

// Räknar ner alla bomber ett steg. Returnerar nytt bräde och om någon small.
export function tickBombs(board) {
  let exploded = false;
  const next = board.map((cell) => {
    if (!cell || cell.t !== 'bomb') return cell;
    const n = (cell.n ?? 5) - 1;
    if (n <= 0) exploded = true;
    return { ...cell, n };
  });
  return { board: next, exploded };
}

export function countType(board, type) {
  let n = 0;
  for (const cell of board) if (cell && cell.t === type) n++;
  return n;
}

export { PIECES, PIECE_BY_ID, COLORS };
