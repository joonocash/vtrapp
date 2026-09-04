// Ligger utanfor src/ sa den inte hamnar i bundlen. Enda andringen mot
// originalet ar de tva sokvagarna nedan.
// Spelar igenom banor med en halvbra bot för att kalibrera par-värdena.
import { makeRng, SIZE, canPlace, place, findFullLines, resolveClears, hasAnyMove,
         scoreClear, generateTray, tickBombs, countType } from '../src/rotspel/games/blast/engine.js';
import { buildLevel, boardFromLevel, starsFor, TOTAL_LEVELS, PACKS, LEVELS_PER_PACK } from '../src/rotspel/games/blast/levels.js';

function playLevel(level, seedOffset = 0) {
  const rng = makeRng(level.seed + seedOffset);
  let board = boardFromLevel(level);
  let tray = generateTray(board, rng, { tokens: level.tokens });
  let score = 0, streak = 0, lines = 0, tokens = 0, moves = 0, bestCombo = 0;

  const goalsDone = () => level.goals.every((g) => {
    if (g.type === 'collect') return tokens >= g.count;
    if (g.type === 'score') return score >= g.count;
    if (g.type === 'lines') return lines >= g.count;
    if (g.type === 'combo') return bestCombo >= g.count;
    if (g.type === 'ice') return countType(board, 'ice') === 0;
    if (g.type === 'clean') return !board.some((c) => c && c.preset && c.t === 'block');
    return true;
  });

  while (moves < 400) {
    if (goalsDone()) return { won: true, moves, score, tokens };
    const live = tray.map((p, i) => [p, i]).filter(([p]) => p);
    if (!hasAnyMove(board, live.map(([p]) => p))) return { won: false, moves, score, tokens };

    let best = null;
    for (const [piece, slot] of live) {
      for (let r = 0; r <= SIZE - piece.h; r++) for (let c = 0; c <= SIZE - piece.w; c++) {
        if (!canPlace(board, piece, r, c)) continue;
        const { board: b2 } = place(board, piece, r, c, piece.color);
        const ln = findFullLines(b2);
        const n = ln.rows.length + ln.cols.length;
        let after = b2, got = 0;
        if (n) { const res = resolveClears(b2, ln); after = res.board; got = Object.values(res.tokens).reduce((a,b)=>a+b,0); }
        const filled = after.filter(Boolean).length;
        // vill rensa linjer, plocka figurer, och hålla brädet tomt
        const val = n * 900 + got * 700 - filled * 6;
        if (!best || val > best.val) best = { val, piece, slot, r, c, n, after, got };
      }
    }
    if (!best) return { won: false, moves, score, tokens };

    if (best.n) { streak++; score += scoreClear({ lines: best.n, streak }); }
    else streak = 0;
    score += best.piece.cells.length;
    lines += best.n; tokens += best.got; bestCombo = Math.max(bestCombo, best.n);
    board = best.after;
    const t = tickBombs(board); board = t.board;
    if (t.exploded) return { won: false, moves, score, tokens, bomb: true };
    moves++;
    tray[best.slot] = null;
    if (tray.every((p) => !p)) tray = generateTray(board, rng, { tokens: level.tokens });
  }
  return { won: false, moves, score, tokens };
}

const rows = [];
for (let id = 1; id <= TOTAL_LEVELS; id++) {
  const lv = buildLevel(id);
  const runs = [0, 1, 2].map((o) => playLevel(lv, o * 999));
  const wins = runs.filter((r) => r.won);
  rows.push({ id, pack: lv.packName, won: wins.length, avgMoves: wins.length ? Math.round(wins.reduce((a,r)=>a+r.moves,0)/wins.length) : null,
              par: lv.par, stars: wins.length ? Math.round(wins.reduce((a,r)=>a+starsFor(lv,r.moves),0)/wins.length*10)/10 : 0 });
}
for (let p = 0; p < PACKS.length; p++) {
  const slice = rows.slice(p*LEVELS_PER_PACK, (p+1)*LEVELS_PER_PACK);
  const winRate = slice.reduce((a,r)=>a+r.won,0) / (slice.length*3);
  const moved = slice.filter(r=>r.avgMoves);
  const avg = moved.length ? Math.round(moved.reduce((a,r)=>a+r.avgMoves,0)/moved.length) : 0;
  const par0 = Math.round(slice.reduce((a,r)=>a+r.par[0],0)/slice.length);
  const stars = Math.round(slice.reduce((a,r)=>a+r.stars,0)/slice.length*10)/10;
  console.log(`${PACKS[p].name.padEnd(14)} klarade ${(winRate*100).toFixed(0).padStart(3)}%  bitar ${String(avg).padStart(3)}  par ${String(par0).padStart(3)}  stjärnor ${stars}`);
}
const failures = rows.filter(r => r.won === 0);
console.log('\nbanor boten aldrig klarade:', failures.length, failures.slice(0,10).map(f=>f.id));
