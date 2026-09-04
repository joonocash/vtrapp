// Ligger utanfor src/ sa den inte hamnar i bundlen. Enda andringen mot
// originalet ar de tva sokvagarna nedan.
import { makeRng, createBoard, generateTray, place, findFullLines, resolveClears, hasAnyMove, scoreClear, SIZE, traySolvable, tickBombs } from '../src/rotspel/games/blast/engine.js';
import { buildLevel, boardFromLevel, TOTAL_LEVELS } from '../src/rotspel/games/blast/levels.js';

// 1. Spela 300 slumpade partier med greedy-AI och se att inget kraschar
let worstFill = 0, totalMoves = 0, games = 0;
for (let g = 0; g < 60; g++) {
  const rng = makeRng(g + 1);
  let board = createBoard();
  let tray = generateTray(board, rng);
  let streak = 0, score = 0, moves = 0;
  while (true) {
    let played = false;
    for (let i = 0; i < tray.length; i++) {
      const p = tray[i]; if (!p) continue;
      let done = false;
      for (let r = 0; r <= SIZE - p.h && !done; r++) for (let c = 0; c <= SIZE - p.w && !done; c++) {
        const ok = p.cells.every(([dr,dc]) => !board[(r+dr)*SIZE + (c+dc)]);
        if (!ok) continue;
        const res = place(board, p, r, c, p.color);
        const lines = findFullLines(res.board);
        const n = lines.rows.length + lines.cols.length;
        if (n) { streak++; score += scoreClear({lines:n, streak}); board = resolveClears(res.board, lines).board; }
        else { streak = 0; board = res.board; }
        tray[i] = null; done = true; played = true; moves++;
      }
    }
    if (!played) break;
    if (tray.every(t => !t)) tray = generateTray(board, rng);
    if (moves > 4000) break;
  }
  totalMoves += moves; games++;
  worstFill = Math.max(worstFill, board.filter(Boolean).length);
}
console.log('partier:', games, 'snitt drag innan game over:', (totalMoves/games).toFixed(1));

// 2. Alla banor byggs och är rimliga
let bad = [];
for (let i = 1; i <= TOTAL_LEVELS; i++) {
  const lv = buildLevel(i);
  const b = boardFromLevel(lv);
  const filled = b.filter(Boolean).length;
  const lines = findFullLines(b);
  if (lines.rows.length || lines.cols.length) bad.push([i, 'full linje från start']);
  if (filled > 34) bad.push([i, 'för fullt: ' + filled]);
  if (!lv.goals.length) bad.push([i, 'inga mål']);
  // går det att lägga en bricka på startbrädet?
  const tray = generateTray(b, makeRng(lv.seed), { tokens: lv.tokens });
  if (!hasAnyMove(b, tray)) bad.push([i, 'ingen möjlig start']);
  if (!lv.par || lv.par[1] >= lv.par[0]) bad.push([i, 'par baklänges']);
  const need = lv.goals.find(g => g.type === 'collect')?.count ?? 0;
  if (need && lv.par[1] < need / lv.tokens.chance) bad.push([i, 'tre stjärnor omöjligt']);
}
console.log('banor:', TOTAL_LEVELS, 'problem:', bad.length, bad.slice(0,5));

// 3. determinism
console.log('deterministisk:', JSON.stringify(buildLevel(77)) === JSON.stringify(buildLevel(77)));
console.log('poäng 4 linjer streak 5:', scoreClear({lines:4, streak:5}));
const ex = buildLevel(130);
console.log('exempelbana 130:', JSON.stringify(ex.goals), '| figurchans', ex.tokens.chance.toFixed(2), '| hinder', ex.preset.length, '| par', ex.par.join('/'));
