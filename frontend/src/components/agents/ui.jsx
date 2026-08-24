import { useEffect, useRef, useState } from 'react';

export const TEAM_NAME = { red: 'Rött lag', blue: 'Blått lag' };
export const ROLE_NAME = { red: 'röd agent', blue: 'blå agent', civil: 'civil', mole: 'mullvaden' };

/**
 * Håller reda på vilka kort som just vändes, så de kan få flip-animationen.
 * Jämför nuvarande revealed-array med förra renderingen.
 */
export function useFlips(revealed) {
  const prev = useRef(revealed);
  const [flips, setFlips] = useState(() => new Set());

  useEffect(() => {
    const before = prev.current || [];
    const fresh = [];
    (revealed || []).forEach((r, i) => {
      if (r && !before[i]) fresh.push(i);
    });
    prev.current = revealed;
    if (!fresh.length) return;

    setFlips(new Set(fresh));
    const t = setTimeout(() => setFlips(new Set()), 450);
    return () => clearTimeout(t);
  }, [revealed]);

  return flips;
}

/**
 * 5×5-brädet. `solution` är nyckeln — skickas bara in när den får visas.
 *
 * `marks` (index → lista av playerId) visas alltid, för alla — det är bara
 * diskussion, ingen hemlighet. Vem som får klicka avgörs av `canPick`, och
 * `markMode` styr om ett klick markerar ordet (true) eller gissar direkt
 * genom `onPick` (false) — se "Lås in" i OnlineGame.
 */
export function Board({ words, revealed, solution, canPick, onPick, marks = {}, players = [], markMode = false, onMark }) {
  const flips = useFlips(revealed);

  return (
    <div className="ag-board">
      {words.map((word, i) => {
        const done = revealed[i];
        const role = solution ? solution[i] : null;
        const marked = !done ? marks[i] : null;
        const classes = ['ag-card'];
        if (done) classes.push('done', 'r-' + role);
        else if (role) classes.push('key', 'key-' + role);
        if (!done && !canPick) classes.push('blocked');
        if (flips.has(i)) classes.push('flip');

        function click() {
          if (done || !canPick) return;
          if (markMode) onMark(i);
          else onPick(i);
        }

        return (
          <button
            key={i}
            className={classes.join(' ')}
            onClick={click}
            disabled={done || !canPick}
          >
            {!done && <span className="idx">{String(i + 1).padStart(2, '0')}</span>}
            {word}
            {!!marked?.length && (
              <span className="ag-marks">
                {marked.map(pid => {
                  const p = players.find(pp => pp.id === pid);
                  return <span key={pid} className="ag-mark-dot" style={{ background: p?.color || '#7d8ba6' }} title={p?.name || ''} />;
                })}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Ställningen: kvarvarande agenter per lag och vems tur det är. */
export function Score({ remaining, turn, phase }) {
  const over = phase === 'over';
  return (
    <div className="ag-score">
      <div className={'ag-team red' + (turn === 'red' && !over ? ' active' : '')}>
        <div className="lbl">Rött lag</div>
        <div className="num">{remaining.red}</div>
      </div>
      <div className="ag-turn">
        Tur<b>{over ? 'Slut' : TEAM_NAME[turn]}</b>
      </div>
      <div className={'ag-team blue' + (turn === 'blue' && !over ? ' active' : '')}>
        <div className="lbl">Blått lag</div>
        <div className="num">{remaining.blue}</div>
      </div>
    </div>
  );
}

/** Den aktiva ledtråden med antal gissningar kvar. */
export function ClueDisplay({ clue, guessesLeft }) {
  const left = guessesLeft >= 99
    ? 'obegränsat'
    : `${guessesLeft} ${guessesLeft === 1 ? 'gissning kvar' : 'gissningar kvar'}`;

  return (
    <div className="ag-clue-live">
      <span className="ag-clue-word">{clue.word}</span>
      <span className="ag-clue-num">{clue.count === 0 ? '∞' : clue.count}</span>
      <span className="ag-left">{left}</span>
    </div>
  );
}

/** Inmatning av ledtråd. Används av spelledaren i båda lägena. */
export function ClueInput({ label, onSubmit, busy }) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState(1);
  const ref = useRef(null);

  function send() {
    const w = word.trim();
    if (!w) { ref.current?.focus(); return; }
    onSubmit(w, Number(count));
    setWord('');
    setCount(1);
  }

  return (
    <>
      <span className="ag-hint">{label}</span>
      <input
        ref={ref}
        type="text"
        value={word}
        placeholder="ord"
        autoComplete="off"
        spellCheck={false}
        onChange={e => setWord(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && send()}
      />
      <input
        type="number"
        min={0}
        max={9}
        value={count}
        onChange={e => setCount(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && send()}
      />
      <button className="ag-btn" onClick={send} disabled={busy}>Ge ledtråd</button>
    </>
  );
}

/** Historiken över alla ledtrådar och vad lagen valde på dem. */
export function History({ history }) {
  return (
    <div className="ag-side">
      <h4>Ledtrådar</h4>
      {!history.length && <div className="ag-empty">Inga ledtrådar än.</div>}
      <ul className="ag-hist">
        {history.slice().reverse().map((h, i) => (
          <li key={history.length - i} className={h.team}>
            <span className="cw">{h.word}</span>
            <span className="cn">{h.count === 0 ? '∞' : h.count}</span>
            {h.by && <span className="by">{h.by}</span>}
            {!!h.picks.length && (
              <div className="ag-picks">
                {h.picks.map((p, j) => (
                  <span key={j} className={'ag-pill ' + p.role}>{p.word}</span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Slutrutan. */
export function WinOverlay({ winner, reason, children }) {
  return (
    <div className="ag-modal open">
      <div className={'ag-box ag-win ' + winner}>
        <div className="who">{TEAM_NAME[winner]} vinner</div>
        <p>{reason}</p>
        {children}
      </div>
    </div>
  );
}
