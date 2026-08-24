import { useCallback, useEffect, useRef, useState } from 'react';
import { Board, Score, ClueDisplay, ClueInput, History, WinOverlay, TEAM_NAME } from './ui.jsx';
import Lobby from './Lobby.jsx';
import { api, loadSession, saveSession, clearSession, codeFromUrl } from './api.js';

const POLL_MS = 1000;

/**
 * Online-läget. Tillståndet bor på servern; vi hämtar det en gång per sekund.
 * Efter varje eget drag används svaret direkt, så det egna klicket känns snabbt.
 */
export default function OnlineGame({ onExit }) {
  const [session, setSession] = useState(loadSession);
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connLost, setConnLost] = useState(false);
  const [colors, setColors] = useState([]);
  const [lockArmed, setLockArmed] = useState(false);

  // Ref så att pollningen alltid ser aktuell session utan att startas om.
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => { api.getColors().then(setColors).catch(() => {}); }, []);

  // "Lås in" gäller bara ett klick — armas om igen så fort läget ändras.
  useEffect(() => {
    setLockArmed(false);
  }, [state?.clue?.word, state?.clue?.count, state?.turn, state?.phase]);

  /* ── Pollning ────────────────────────────────────────────── */
  useEffect(() => {
    if (!session) { setState(null); return; }
    let alive = true;

    async function tick() {
      const s = sessionRef.current;
      if (!s) return;
      try {
        const next = await api.getState(s.code, s.playerId);
        if (!alive) return;
        setState(next);
        setConnLost(false);
        // Servern kan ha glömt oss (omstart av backend) — då tillbaka till start.
        if (!next.you) {
          clearSession();
          setSession(null);
          setError('Rummet finns inte kvar. Skapa ett nytt eller gå med igen.');
        }
      } catch (err) {
        if (!alive) return;
        if (err.status === 404 || err.status === 403) {
          clearSession();
          setSession(null);
          setError(err.message);
        } else {
          setConnLost(true);
        }
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [session]);

  /* ── Anrop som ändrar något ──────────────────────────────── */
  const act = useCallback(async (fn) => {
    setBusy(true);
    try {
      const data = await fn();
      if (data?.state) setState(data.state);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  function enterRoom(data, name) {
    const next = { code: data.code, playerId: data.playerId, name };
    saveSession(next);
    setSession(next);
    setState(data.state);
    setError('');
  }

  async function leave() {
    const s = sessionRef.current;
    if (s) { try { await api.leave(s.code, s.playerId); } catch { /* strunt samma */ } }
    clearSession();
    setSession(null);
    setState(null);
  }

  if (!session) {
    return <JoinScreen error={error} onEnter={enterRoom} onExit={onExit} />;
  }

  if (!state) {
    return (
      <>
        <div className="ag-wait"><span className="ag-spin" />Ansluter till rum {session.code}…</div>
        {!!error && <div className="ag-err" style={{ marginTop: 10 }}>{error}</div>}
      </>
    );
  }

  const me = state.you;
  const myTurn = me?.team === state.turn && state.phase === 'playing';
  const isSpymaster = me?.role === 'spymaster' && !!me?.team;
  // Kan markera ord och avsluta draget. Att faktiskt gissa kräver att man
  // först "låser in" — se ag-lockbar nedan.
  const canAct = myTurn && !isSpymaster && !!state.clue;
  const turnSpymaster = state.players.find(p => p.team === state.turn && p.role === 'spymaster');

  return (
    <>
      {connLost && <div className="ag-err">Tappade kontakten med servern — försöker igen…</div>}
      {!!error && <div className="ag-err">{error}</div>}

      {state.phase === 'lobby' ? (
        <Lobby
          state={state}
          busy={busy}
          colors={colors}
          onPick={(team, role) => act(() => api.setTeam(session.code, session.playerId, team, role))}
          onColor={color => act(() => api.setColor(session.code, session.playerId, color))}
          onShuffle={() => act(() => api.shuffleTeams(session.code, session.playerId))}
          onStart={() => act(() => api.start(session.code, session.playerId))}
          onLeave={leave}
        />
      ) : (
        <>
          <div className="ag-tools" style={{ marginBottom: 12 }}>
            <span className={'ag-role ' + (me?.team || '')}>
              {me?.team ? TEAM_NAME[me.team] : 'Åskådare'}
              {me?.team && ' · '}
              {me?.team && (isSpymaster ? 'Spelledare' : 'Agent')}
            </span>
            <span className="ag-role">Rum {state.code}</span>
            <span className="ag-role">{state.players.filter(p => p.online).length} online</span>
          </div>

          <Score remaining={state.remaining} turn={state.turn} phase={state.phase} />

          <div className="ag-clue">
            {state.phase === 'over' ? (
              <span className="ag-hint">Spelet är slut.</span>
            ) : state.clue ? (
              <ClueDisplay clue={state.clue} guessesLeft={state.guessesLeft} />
            ) : myTurn && isSpymaster ? (
              <ClueInput
                label="Din ledtråd:"
                busy={busy}
                onSubmit={(word, count) =>
                  act(() => api.clue(session.code, session.playerId, word, count))}
              />
            ) : (
              <div className="ag-wait">
                <span className="ag-spin" />
                Väntar på {turnSpymaster ? `${turnSpymaster.name}s` : `${TEAM_NAME[state.turn]}s`} ledtråd
              </div>
            )}
          </div>

          {canAct && (
            <div className="ag-lockbar">
              {lockArmed ? (
                <>
                  <span className="ag-hint">Klicka på ordet ni är överens om.</span>
                  <button className="ag-btn" disabled={busy} onClick={() => setLockArmed(false)}>Avbryt</button>
                </>
              ) : (
                <>
                  <span className="ag-hint">Klicka ord för att markera dem — alla ser markeringarna.</span>
                  <button className="ag-btn" disabled={busy} onClick={() => setLockArmed(true)}>Lås in ett ord</button>
                </>
              )}
            </div>
          )}

          <div className="ag-main">
            <Board
              words={state.words}
              revealed={state.revealed}
              solution={state.key}
              canPick={canAct}
              markMode={!lockArmed}
              onPick={i => { setLockArmed(false); act(() => api.guess(session.code, session.playerId, i)); }}
              onMark={i => act(() => api.mark(session.code, session.playerId, i))}
              marks={state.marks}
              players={state.players}
            />
            <History history={state.history} />
          </div>

          <div className="ag-foot">
            <div className="ag-log">{state.log}</div>
            {canAct && (
              <button
                className="ag-end"
                disabled={busy}
                onClick={() => act(() => api.endTurn(session.code, session.playerId))}
              >
                Avsluta draget
              </button>
            )}
          </div>

          <div className="ag-tools" style={{ marginTop: 12 }}>
            {me?.isHost && state.phase === 'over' && (
              <button className="ag-btn" disabled={busy}
                onClick={() => act(() => api.newRound(session.code, session.playerId))}>
                Ny runda
              </button>
            )}
            {me?.isHost && (
              <button className="ag-btn" disabled={busy}
                onClick={() => act(() => api.toLobby(session.code, session.playerId))}>
                Till lobbyn
              </button>
            )}
            <button className="ag-btn" disabled={busy} onClick={leave}>Lämna rummet</button>
          </div>

          {state.phase === 'over' && (
            <WinOverlay winner={state.winner} reason={state.winReason}>
              {me?.isHost ? (
                <div className="ag-row">
                  <button className="ag-btn" style={{ flex: 1 }} disabled={busy}
                    onClick={() => act(() => api.newRound(session.code, session.playerId))}>
                    Ny runda
                  </button>
                  <button className="ag-btn" style={{ flex: 1 }} disabled={busy}
                    onClick={() => act(() => api.toLobby(session.code, session.playerId))}>
                    Till lobbyn
                  </button>
                </div>
              ) : (
                <span className="ag-note">Väntar på att värden startar en ny runda.</span>
              )}
            </WinOverlay>
          )}
        </>
      )}
    </>
  );
}

/* ── Startskärmen för online ─────────────────────────────────── */

function JoinScreen({ error, onEnter, onExit }) {
  const [name, setName] = useState(() => loadSession()?.name || '');
  const [code, setCode] = useState(codeFromUrl);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  async function run(fn) {
    const trimmed = name.trim();
    if (!trimmed) { setLocalError('Skriv ditt namn först'); return; }
    setBusy(true);
    setLocalError('');
    try {
      const data = await fn(trimmed);
      onEnter(data, trimmed);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {(localError || error) && <div className="ag-err">{localError || error}</div>}

      <div className="ag-panel">
        <h4>Ditt namn</h4>
        <input
          className="ag-field"
          value={name}
          maxLength={18}
          placeholder="Namn"
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="ag-panel">
        <h4>Starta ett nytt rum</h4>
        <div className="ag-note" style={{ marginBottom: 10 }}>
          Du får en kod som de andra skriver in. Alla behöver vara på samma adress som du.
        </div>
        <button className="ag-btn" disabled={busy} onClick={() => run(n => api.createRoom(n))}>
          Skapa rum
        </button>
      </div>

      <div className="ag-panel">
        <h4>Gå med i ett rum</h4>
        <div className="ag-inline">
          <input
            className="ag-field code"
            value={code}
            maxLength={4}
            placeholder="KOD"
            autoComplete="off"
            spellCheck={false}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => {
              if (e.key === 'Enter' && code.length === 4) run(n => api.joinRoom(code, n));
            }}
          />
          <button
            className="ag-btn"
            disabled={busy || code.length !== 4}
            onClick={() => run(n => api.joinRoom(code, n))}
          >
            Gå med
          </button>
        </div>
      </div>

      <button className="ag-btn" onClick={onExit}>Byt läge</button>
    </>
  );
}
