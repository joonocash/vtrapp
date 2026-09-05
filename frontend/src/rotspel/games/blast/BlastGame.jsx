import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './blast.css';
import {
  SIZE, idx, makeRng, createBoard, canPlace, place, findFullLines, resolveClears,
  hasAnyMove, scoreClear, comboMult, tickBombs, countType, COLORS,
  generateTray,
} from './engine.js';
import {
  PACKS, LEVELS_PER_PACK, TOTAL_LEVELS, goalLabel, starsFor, buildLevel, boardFromLevel,
} from './levels.js';
import { ParticleField } from './particles.js';
import { sfx, buzz, unlockAudio, setSoundEnabled } from './audio.js';

const STORAGE_KEY = 'rotspel-blast-v1';
const CLEAR_STEP = 28;   // ms mellan varje ruta i en rensning
const CLEAR_DUR = 300;   // ms för själva försvinnandet
// Pointer gain: på touch glider biten något snabbare än tummen, så man slipper
// dra hela vägen upp till brädet. Faktorn växer med avståndet från greppunkten
// och planar ut mot 1 + GAIN_MAX — små justeringar blir alltså nästan 1:1.
const GAIN_MAX = 0.35;      // högsta extra andel utöver 1:1
const GAIN_FALLOFF = 220;   // px innan gain nått ~63 % av taket

/* ---------- sparad progress ---------- */

const loadSave = () => {
  try {
    return { best: 0, stars: {}, sound: true, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { best: 0, stars: {}, sound: true };
  }
};
const persist = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* privat läge */ }
};

/* ---------- små byggstenar ---------- */

function PieceMini({ piece, cell = 14, dim }) {
  if (!piece) return <div className="bb-mini bb-mini-empty" />;
  return (
    <div
      className={`bb-mini${dim ? ' bb-mini-dim' : ''}`}
      style={{ width: piece.w * cell, height: piece.h * cell }}
    >
      {piece.cells.map(([r, c], i) => (
        <span
          key={i}
          className="bb-block"
          style={{
            left: c * cell, top: r * cell, width: cell - 2, height: cell - 2,
            '--bc': COLORS[piece.color ?? 0],
          }}
        >
          {piece.tokens?.[i] && <span className="bb-token">{piece.tokens[i]}</span>}
        </span>
      ))}
    </div>
  );
}

function Stars({ n, size = 14 }) {
  return (
    <span className="bb-stars" style={{ '--s': `${size}px` }}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < n ? 'bb-star bb-star-on' : 'bb-star'} />
      ))}
    </span>
  );
}

/* ---------- huvudkomponent ---------- */

export default function BlastGame({ onScore }) {
  const [save, setSave] = useState(loadSave);
  const [view, setView] = useState('menu'); // menu | map | game
  const [level, setLevel] = useState(null); // null = klassiskt läge
  const [pack, setPack] = useState(0);
  const [run, setRun] = useState(0); // ökas för att starta om en omgång

  const updateSave = useCallback((patch) => {
    setSave((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  useEffect(() => { setSoundEnabled(save.sound); }, [save.sound]);

  const startClassic = () => { unlockAudio(); setLevel(null); setRun((r) => r + 1); setView('game'); };
  const startLevel = (id) => { unlockAudio(); setLevel(buildLevel(id)); setRun((r) => r + 1); setView('game'); };

  if (view === 'game') {
    return (
      <Board
        key={`${level ? `lvl-${level.id}` : 'classic'}-${run}`}
        level={level}
        save={save}
        updateSave={updateSave}
        onScore={onScore}
        onExit={() => setView(level ? 'map' : 'menu')}
        onNext={() => {
          const next = buildLevel((level?.id ?? 0) + 1);
          if (next) { setLevel(next); setRun((r) => r + 1); } else setView('map');
        }}
        onRetry={() => setRun((r) => r + 1)}
      />
    );
  }

  if (view === 'map') {
    return (
      <LevelMap
        pack={pack}
        setPack={setPack}
        stars={save.stars}
        onPick={startLevel}
        onExit={() => setView('menu')}
      />
    );
  }

  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const cleared = Object.keys(save.stars).length;

  return (
    <div className="bb-root bb-menu">
      <div className="bb-logo">
        <span className="bb-logo-word">RÖT</span>
        <span className="bb-logo-word bb-logo-alt">BLAST</span>
      </div>
      <p className="bb-tagline">Åtta gånger åtta. Inga rotationer. Ingen nåd.</p>

      <button className="bb-big bb-big-classic" onClick={startClassic}>
        <span className="bb-big-title">Klassiskt</span>
        <span className="bb-big-sub">Spela tills brädet tar slut</span>
        <span className="bb-big-stat">{save.best ? `Rekord ${save.best.toLocaleString('sv-SE')}` : 'Inget rekord än'}</span>
      </button>

      <button className="bb-big bb-big-adv" onClick={() => setView('map')}>
        <span className="bb-big-title">Äventyr</span>
        <span className="bb-big-sub">{TOTAL_LEVELS} banor i {PACKS.length} paket</span>
        <span className="bb-big-stat">{cleared} klarade · {totalStars} stjärnor</span>
      </button>

      <button
        className="bb-link"
        onClick={() => updateSave((s) => ({ ...s, sound: !s.sound }))}
      >
        Ljud {save.sound ? 'på' : 'av'}
      </button>
    </div>
  );
}

/* ---------- bankarta ---------- */

function LevelMap({ pack, setPack, stars, onPick, onExit }) {
  const info = PACKS[pack];
  const first = pack * LEVELS_PER_PACK + 1;
  const ids = Array.from({ length: LEVELS_PER_PACK }, (_, i) => first + i);
  const unlocked = (id) => id === 1 || (stars[id - 1] ?? 0) > 0;
  const packUnlocked = (p) => p === 0 || (stars[p * LEVELS_PER_PACK] ?? 0) > 0;

  return (
    <div className="bb-root bb-map">
      <div className="bb-topbar">
        <button className="bb-icon" onClick={onExit} aria-label="Tillbaka">←</button>
        <h2 className="bb-map-title">{info.name}</h2>
        <span className="bb-map-count">
          {ids.filter((id) => stars[id]).length}/{LEVELS_PER_PACK}
        </span>
      </div>

      <div className="bb-packs" role="tablist">
        {PACKS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === pack}
            disabled={!packUnlocked(p.id)}
            className={`bb-pack${p.id === pack ? ' bb-pack-on' : ''}`}
            style={{ '--tint': p.tint }}
            onClick={() => setPack(p.id)}
          >
            {packUnlocked(p.id) ? p.name : 'Låst'}
          </button>
        ))}
      </div>

      <p className="bb-pack-hint">{info.hint}</p>

      <div className="bb-nodes">
        {ids.map((id) => {
          const s = stars[id] ?? 0;
          const open = unlocked(id);
          return (
            <button
              key={id}
              className={`bb-node${s ? ' bb-node-done' : ''}${open ? '' : ' bb-node-locked'}`}
              style={{ '--tint': info.tint }}
              disabled={!open}
              onClick={() => onPick(id)}
            >
              <span className="bb-node-num">{id}</span>
              {open && <Stars n={s} size={9} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- själva spelplanen ---------- */

function Board({ level, save, updateSave, onScore, onExit, onNext, onRetry }) {
  const rngRef = useRef(makeRng(level ? level.seed : (Date.now() & 0x7fffffff)));

  const [board, setBoard] = useState(() => (level ? boardFromLevel(level) : createBoard()));
  const trayOpts = useMemo(() => (level ? { tokens: level.tokens } : undefined), [level]);
  const [tray, setTray] = useState(() =>
    generateTray(level ? boardFromLevel(level) : createBoard(), rngRef.current, trayOpts)
  );
  const [score, setScore] = useState(0);
  const [shown, setShown] = useState(0);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState({ lines: 0, gems: 0, moves: 0, bestCombo: 0, tokens: 0 });
  const [status, setStatus] = useState('playing'); // playing | won | lost
  const [clearing, setClearing] = useState(null);  // { delays: Map, cracked: Set }
  const [pops, setPops] = useState([]);
  const [banner, setBanner] = useState(null);
  const [shake, setShake] = useState(0);
  const [drag, setDrag] = useState(null);
  const [flights, setFlights] = useState([]);
  const [chipHit, setChipHit] = useState(0);
  const chipRef = useRef(null);

  const [cs, setCs] = useState(40);
  const boardRef = useRef(null);
  const canvasRef = useRef(null);
  const fieldRef = useRef(null);
  const busy = useRef(false);
  const wrapRef = useRef(null);
  const movesRef = useRef(0); // antal utlagda bitar, används för stjärnorna

  /* mät rutstorleken så att bitar och partiklar hamnar rätt */
  useLayoutEffect(() => {
    if (!boardRef.current) return;
    const measure = () => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect?.width) setCs(rect.width / SIZE);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(boardRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  /* partiklar */
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    fieldRef.current = new ParticleField(canvasRef.current);
    const ro = new ResizeObserver(() => fieldRef.current?.resize());
    ro.observe(canvasRef.current);
    return () => { ro.disconnect(); fieldRef.current?.destroy(); };
  }, []);

  /* poängen räknas upp istället för att hoppa */
  useEffect(() => {
    if (shown === score) return;
    let raf;
    const from = shown;
    const t0 = performance.now();
    const dur = 340;
    const tick = (now) => {
      const t = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (score - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- mål ---------- */

  const goalState = useMemo(() => {
    if (!level) return null;
    return level.goals.map((g) => {
      let have = 0;
      let need = g.count ?? 1;
      if (g.type === 'collect') have = stats.tokens;
      else if (g.type === 'score') have = score;
      else if (g.type === 'lines') have = stats.lines;
      else if (g.type === 'combo') have = stats.bestCombo;
      else if (g.type === 'ice') { need = 1; have = countType(board, 'ice') === 0 ? 1 : 0; }
      else if (g.type === 'clean') {
        need = 1;
        have = board.some((c) => c && c.preset && c.t === 'block') ? 0 : 1;
      }
      return { ...g, have, need, done: have >= need };
    });
  }, [level, board, score, stats]);

  /* ---------- placering ---------- */

  const cellSize = () => {
    const rect = boardRef.current?.getBoundingClientRect();
    return rect ? rect.width / SIZE : cs;
  };

  // Enda stället där rå pekarposition blir bitens faktiska position. Både
  // renderingen och målruteberäkningen läser härifrån, så spökbilden och rutan
  // biten landar i kan inte glida isär.
  //
  // Returnerar bitens MITTPUNKT i viewport-koordinater: .bb-drag har
  // transform: translate(-50%, -50%), så left/top är mitten och inte hörnet.
  const dragPos = (d) => {
    const dx = d.x - d.gx;
    const dy = d.y - d.gy;
    let ex = d.x;
    let ey = d.y;

    if (d.touch) {
      const dist = Math.hypot(dx, dy);
      const gain = 1 + GAIN_MAX * (1 - Math.exp(-dist / GAIN_FALLOFF));
      // hela förskjutningsvektorn skalas med samma faktor, annars drar
      // diagonala rörelser snett
      ex = d.gx + dx * gain;
      ey = d.gy + dy * gain;
    }
    ey -= d.lift;

    // klamra så biten aldrig kan hamna utanför skärmen nära kanterna
    const size = cellSize();
    const halvW = (d.piece.w * size) / 2;
    const halvH = (d.piece.h * size) / 2;
    return {
      x: Math.min(Math.max(ex, halvW), window.innerWidth - halvW),
      y: Math.min(Math.max(ey, halvH), window.innerHeight - halvH),
    };
  };

  const preview = useMemo(() => {
    if (!drag || !drag.target) return null;
    const { piece } = drag;
    const { r, c } = drag.target;
    if (!canPlace(board, piece, r, c)) return { valid: false, cells: [], rows: [], cols: [] };
    const { board: hypo } = place(board, piece, r, c, piece.color);
    const lines = findFullLines(hypo);
    return {
      valid: true,
      cells: piece.cells.map(([dr, dc]) => idx(r + dr, c + dc)),
      rows: lines.rows,
      cols: lines.cols,
    };
  }, [drag, board]);

  const addPop = (x, y, text, kind = '') => {
    const id = Math.random().toString(36).slice(2);
    setPops((p) => [...p, { id, x, y, text, kind }]);
    setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 900);
  };

  const finish = useCallback((won, finalScore) => {
    setStatus(won ? 'won' : 'lost');
    if (won) {
      sfx.levelWin();
      buzz([12, 40, 12, 40, 30]);
      if (level) {
        const earned = starsFor(level, movesRef.current);
        updateSave((s) => ({
          ...s,
          stars: { ...s.stars, [level.id]: Math.max(s.stars[level.id] ?? 0, earned) },
        }));
      }
    } else {
      sfx.levelFail();
      buzz([40, 60, 90]);
    }
    if (!level) {
      onScore?.(finalScore);
      if (finalScore > (save.best ?? 0)) {
        sfx.newBest();
        updateSave((s) => ({ ...s, best: finalScore }));
      }
    }
  }, [level, onScore, save.best, updateSave]);

  const commit = useCallback((slot, piece, r, c) => {
    if (busy.current || status !== 'playing') return false;
    if (!canPlace(board, piece, r, c)) return false;

    busy.current = true;
    const rect = boardRef.current.getBoundingClientRect();
    const cs = rect.width / SIZE;

    const { board: placed, filled } = place(board, piece, r, c, piece.color);
    const lines = findFullLines(placed);
    const lineCount = lines.rows.length + lines.cols.length;

    const nextTrayRaw = tray.map((p, i) => (i === slot ? null : p));
    let gained = filled.length;
    let nextStreak = streak;

    sfx.drop();
    buzz(8);

    if (lineCount > 0) {
      nextStreak = streak + 1;
      const bonus = scoreClear({ lines: lineCount, streak: nextStreak });
      gained += bonus;

      const { board: resolved, removed, cracked, gems, tokens } = resolveClears(placed, lines);
      const tokenCount = Object.values(tokens).reduce((a, b) => a + b, 0);

      // Ordna rensningen så att den sprider sig utåt från där biten släpptes.
      const origin = { r: r + piece.h / 2 - 0.5, c: c + piece.w / 2 - 0.5 };
      const delays = new Map();
      removed.forEach(([rr, cc]) => {
        const d = Math.round(Math.hypot(rr - origin.r, cc - origin.c) * CLEAR_STEP);
        delays.set(idx(rr, cc), d);
      });
      const crackSet = new Set(cracked.map(([rr, cc]) => idx(rr, cc)));

      setBoard(placed);
      setClearing({ delays, cracked: crackSet });

      // partiklar och ljud i takt med animationen
      const field = fieldRef.current;
      removed.forEach(([rr, cc, cell]) => {
        const d = delays.get(idx(rr, cc)) ?? 0;
        const x = (cc + 0.5) * cs;
        const y = (rr + 0.5) * cs;
        const color = cell.t === 'gem' ? '#ffd93d' : COLORS[cell.c ?? 0];
        setTimeout(() => field?.burst(x, y, color, {
          count: 6 + lineCount * 2,
          power: 130 + lineCount * 40,
          size: cs * 0.16,
        }), d);
      });
      if (lineCount >= 2) {
        fieldRef.current?.shockwave((c + piece.w / 2) * cs, (r + piece.h / 2) * cs, '#ffc94d');
      }
      if (cracked.length) setTimeout(() => sfx.crack(), 60);

      // figurerna flyger upp till målrutan
      if (tokenCount) {
        const gridRect = boardRef.current.getBoundingClientRect();
        const chip = chipRef.current?.getBoundingClientRect();
        let n = 0;
        removed.forEach(([rr, cc, cell]) => {
          if (!cell.token) return;
          const d = delays.get(idx(rr, cc)) ?? 0;
          const x0 = gridRect.left + (cc + 0.5) * cs;
          const y0 = gridRect.top + (rr + 0.5) * cs;
          const x1 = chip ? chip.left + chip.width / 2 : gridRect.left + gridRect.width / 2;
          const y1 = chip ? chip.top + chip.height / 2 : gridRect.top - 30;
          const id = `${rr}-${cc}-${Math.random()}`;
          const i = n++;
          setTimeout(() => {
            sfx.gem(Math.min(i, 4));
            setFlights((f) => [...f, { id, token: cell.token, x0, y0, x1, y1 }]);
            setTimeout(() => {
              setFlights((f) => f.filter((q) => q.id !== id));
              setChipHit((v) => v + 1);
            }, 620);
          }, d + 90);
        });
      }
      sfx.clear({ lines: lineCount, streak: nextStreak });

      setShake(Math.min(lineCount, 4));
      buzz(lineCount >= 3 ? [20, 30, 40] : [16]);
      setTimeout(() => setShake(0), 320);

      const label = lineCount >= 4 ? 'OTROLIGT!'
        : lineCount === 3 ? 'TRIPPEL!'
        : lineCount === 2 ? 'DUBBEL!'
        : nextStreak >= 3 ? `${nextStreak} I RAD` : null;
      if (label) {
        setBanner({ text: label, sub: nextStreak >= 2 ? `×${(comboMult(lineCount) * (1 + 0.25 * Math.min(nextStreak - 1, 12))).toFixed(1)}` : null });
        setTimeout(() => setBanner(null), 900);
      }

      addPop(
        (c + piece.w / 2) * cs,
        (r + piece.h / 2) * cs,
        `+${bonus.toLocaleString('sv-SE')}`,
        lineCount >= 2 ? 'bb-pop-big' : ''
      );

      const maxDelay = Math.max(0, ...delays.values());
      setTimeout(() => {
        let after = resolved;
        let exploded = false;
        if (level) {
          const ticked = tickBombs(after);
          after = ticked.board;
          exploded = ticked.exploded;
        }
        setBoard(after);
        setClearing(null);
        afterMove({ after, gained, nextStreak, lineCount, gems, tokens: tokenCount, nextTrayRaw, exploded });
        busy.current = false;
      }, maxDelay + CLEAR_DUR);
      setScore((s) => s + gained);
      return true;
    }

    // inget rensades
    nextStreak = 0;
    let after = placed;
    let exploded = false;
    if (level) {
      const ticked = tickBombs(after);
      after = ticked.board;
      exploded = ticked.exploded;
      const low = after.find((cell) => cell && cell.t === 'bomb' && cell.n <= 3);
      if (low) sfx.bombTick(low.n);
    }
    setBoard(after);
    setScore((s) => s + gained);
    afterMove({ after, gained, nextStreak, lineCount: 0, gems: 0, tokens: 0, nextTrayRaw, exploded });
    busy.current = false;
    return true;
  }, [board, tray, streak, status, level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Allt som ska hända efter att brädet lagt sig: ny bricka, mål, förlust.
  const afterMove = useCallback(({ after, gained, nextStreak, lineCount, gems, tokens, nextTrayRaw, exploded }) => {
    setStreak(nextStreak);

    const nextStats = {
      lines: stats.lines + lineCount,
      gems: stats.gems + gems,
      tokens: stats.tokens + (tokens || 0),
      moves: stats.moves + 1,
      bestCombo: Math.max(stats.bestCombo, lineCount),
    };
    setStats(nextStats);
    movesRef.current = nextStats.moves;

    const empty = nextTrayRaw.every((p) => !p);
    const nextTray = empty ? generateTray(after, rngRef.current, trayOpts) : nextTrayRaw;
    setTray(nextTray);

    const total = score + gained;

    if (level) {
      const done = level.goals.every((g) => {
        if (g.type === 'collect') return nextStats.tokens >= g.count;
        if (g.type === 'score') return total >= g.count;
        if (g.type === 'lines') return nextStats.lines >= g.count;
        if (g.type === 'combo') return nextStats.bestCombo >= g.count;
        if (g.type === 'ice') return countType(after, 'ice') === 0;
        if (g.type === 'clean') return !after.some((c) => c && c.preset && c.t === 'block');
        return true;
      });
      if (done) { finish(true, total); return; }
      if (exploded) { finish(false, total); return; }
    }

    // Enda sättet en bana tar slut i förtid: brädet är fullt. Precis som klassiskt.
    if (!hasAnyMove(after, nextTray.filter(Boolean))) finish(false, total);
  }, [stats, score, level, finish, trayOpts]);

  /* ---------- pekhantering ---------- */

  const onPointerDown = (e, slot) => {
    if (status !== 'playing' || busy.current) return;
    const piece = tray[slot];
    if (!piece) return;
    unlockAudio();
    sfx.pickup();
    const touch = e.pointerType !== 'mouse';
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({
      slot, piece, pointerId: e.pointerId, touch,
      lift: touch ? cellSize() * 2.2 : 0,
      // greppunkten: gain räknas som förskjutning härifrån
      gx: e.clientX, gy: e.clientY,
      x: e.clientX, y: e.clientY, target: null,
    });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      if (e.pointerId !== drag.pointerId) return;
      const pointer = dragPos({ ...drag, x: e.clientX, y: e.clientY });
      const rect = boardRef.current?.getBoundingClientRect();
      let target = null;
      if (rect) {
        const cs = rect.width / SIZE;
        const c = Math.round((pointer.x - (drag.piece.w * cs) / 2 - rect.left) / cs);
        const r = Math.round((pointer.y - (drag.piece.h * cs) / 2 - rect.top) / cs);
        if (r > -2 && c > -2 && r < SIZE + 1 && c < SIZE + 1) target = { r, c };
      }
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, target } : d));
    };
    const up = (e) => {
      if (e.pointerId !== drag.pointerId) return;
      const t = drag.target;
      if (t && canPlace(board, drag.piece, t.r, t.c)) {
        commit(drag.slot, drag.piece, t.r, t.c);
      } else if (t) {
        sfx.invalid();
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag, board, commit]);

  /* ---------- rendering ---------- */

  const previewSet = useMemo(() => new Set(preview?.cells ?? []), [preview]);
  const lineSet = useMemo(() => {
    const s = new Set();
    if (!preview?.valid) return s;
    for (const r of preview.rows) for (let c = 0; c < SIZE; c++) s.add(idx(r, c));
    for (const c of preview.cols) for (let r = 0; r < SIZE; r++) s.add(idx(r, c));
    return s;
  }, [preview]);

  const dragPoint = drag ? dragPos(drag) : null;

  return (
    <div className={`bb-root bb-play${shake ? ` bb-shake-${shake}` : ''}`} ref={wrapRef}>
      <div className="bb-topbar">
        <button className="bb-icon" onClick={onExit} aria-label="Tillbaka">←</button>
        <div className="bb-score">
          <span className="bb-score-num">{shown.toLocaleString('sv-SE')}</span>
          {level
            ? <span className="bb-score-sub">Bana {level.id} · {level.packName}</span>
            : <span className="bb-score-sub">Rekord {(save.best ?? 0).toLocaleString('sv-SE')}</span>}
        </div>
        {level
          ? <div className="bb-moves" title={`Två stjärnor på ${level.par[0]} bitar, tre på ${level.par[1]}`}>
              <b>{stats.moves}</b><span>bitar</span>
            </div>
          : <div className={`bb-streak${streak >= 2 ? ' bb-streak-on' : ''}`}>
              <b>{streak}</b><span>i rad</span>
            </div>}
      </div>

      {goalState && (
        <div className="bb-goals">
          {goalState.map((g, i) => (
            <div
              key={i}
              ref={g.type === 'collect' ? chipRef : undefined}
              className={`bb-goal${g.done ? ' bb-goal-done' : ''}${g.type === 'collect' ? ' bb-goal-collect' : ''}`}
            >
              {g.type === 'collect' && (
                <span key={chipHit} className="bb-goal-token">{level.tokens.types.join('')}</span>
              )}
              <span>{goalLabel(g)}</span>
              {g.need > 1 && <b>{Math.min(g.have, g.need)}/{g.need}</b>}
            </div>
          ))}
        </div>
      )}

      <div className="bb-well">
        <div className="bb-grid" ref={boardRef}>
          {board.map((cell, i) => {
            const delay = clearing?.delays.get(i);
            const cracking = clearing?.cracked.has(i);
            const cls = [
              'bb-cell',
              cell ? 'bb-filled' : '',
              cell ? `bb-t-${cell.t}` : '',
              cell?.t === 'ice' ? `bb-ice-${cell.hp ?? 2}` : '',
              previewSet.has(i) ? 'bb-ghost' : '',
              lineSet.has(i) && !previewSet.has(i) ? 'bb-willclear' : '',
              delay != null ? 'bb-clearing' : '',
              cracking ? 'bb-cracking' : '',
            ].filter(Boolean).join(' ');
            return (
              <div
                key={i}
                className={cls}
                style={{
                  '--bc': cell ? COLORS[cell.c ?? 0] : undefined,
                  animationDelay: delay != null ? `${delay}ms` : undefined,
                }}
              >
                {cell?.token && <span className="bb-token">{cell.token}</span>}
                {cell?.t === 'gem' && <span className="bb-gem" />}
                {cell?.t === 'bomb' && <span className="bb-bomb">{cell.n}</span>}
                {cell?.t === 'stone' && <span className="bb-stone" />}
                {previewSet.has(i) && preview?.valid && (
                  <span className="bb-ghost-fill" style={{ '--bc': COLORS[drag.piece.color] }} />
                )}
              </div>
            );
          })}
        </div>
        <canvas className="bb-fx" ref={canvasRef} />
        {pops.map((p) => (
          <span key={p.id} className={`bb-pop ${p.kind}`} style={{ left: p.x, top: p.y }}>{p.text}</span>
        ))}
        {banner && (
          <div className="bb-banner">
            <span>{banner.text}</span>
            {banner.sub && <b>{banner.sub}</b>}
          </div>
        )}
      </div>

      <div className="bb-tray">
        {tray.map((piece, i) => (
          <div
            key={piece?.key ?? `slot-${i}`}
            className={`bb-slot${drag?.slot === i ? ' bb-slot-held' : ''}`}
            onPointerDown={(e) => onPointerDown(e, i)}
          >
            <PieceMini piece={piece} cell={Math.max(12, cs * 0.42)} />
          </div>
        ))}
      </div>

      {drag && (
        <div
          className={`bb-drag${preview?.valid ? ' bb-drag-ok' : ''}`}
          style={{
            left: dragPoint.x,
            top: dragPoint.y,
            width: drag.piece.w * cs,
            height: drag.piece.h * cs,
          }}
        >
          {drag.piece.cells.map(([r, c], i) => (
            <span
              key={i}
              className="bb-block"
              style={{
                left: c * cs, top: r * cs, width: cs - 3, height: cs - 3,
                '--bc': COLORS[drag.piece.color],
              }}
            >
              {drag.piece.tokens?.[i] && <span className="bb-token">{drag.piece.tokens[i]}</span>}
            </span>
          ))}
        </div>
      )}

      {flights.map((f) => (
        <span
          key={f.id}
          className="bb-flight"
          style={{ left: f.x0, top: f.y0, '--dx': `${f.x1 - f.x0}px`, '--dy': `${f.y1 - f.y0}px` }}
        >
          {f.token}
        </span>
      ))}

      {status !== 'playing' && (
        <div className="bb-overlay">
          <div className="bb-card">
            {status === 'won' ? (
              <>
                <h3>Klart!</h3>
                {level && <Stars n={starsFor(level, stats.moves)} size={30} />}
                <p className="bb-card-score">{score.toLocaleString('sv-SE')}</p>
                {level && (
                  <p className="bb-card-note">
                    {stats.moves} bitar utlagda
                    {starsFor(level, stats.moves) < 3 && ` · klara den på ${level.par[starsFor(level, stats.moves) === 2 ? 1 : 0]} för en stjärna till`}
                  </p>
                )}
                <div className="bb-card-actions">
                  <button className="bb-btn" onClick={onExit}>Kartan</button>
                  <button className="bb-btn bb-btn-primary" onClick={onNext}>Nästa bana</button>
                </div>
              </>
            ) : (
              <>
                <h3>Slut på plats</h3>
                {level && goalState && (
                  <p className="bb-card-note">
                    {goalState.filter((g) => !g.done).map((g) => `${goalLabel(g)} — ${Math.min(g.have, g.need)}/${g.need}`).join(' · ')}
                  </p>
                )}
                <p className="bb-card-score">{score.toLocaleString('sv-SE')}</p>
                {!level && score >= (save.best ?? 0) && score > 0 && <p className="bb-card-best">Nytt rekord</p>}
                <div className="bb-card-actions">
                  <button className="bb-btn" onClick={onExit}>{level ? 'Kartan' : 'Meny'}</button>
                  <button className="bb-btn bb-btn-primary" onClick={onRetry}>Igen</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
