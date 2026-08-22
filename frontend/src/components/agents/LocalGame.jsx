import { useEffect, useState } from 'react';
import { Board, Score, ClueDisplay, ClueInput, History, WinOverlay, TEAM_NAME } from './ui.jsx';
import * as G from './localGame.js';

/**
 * Lokalt läge: alla sitter runt samma skärm och skickar den mellan sig.
 * Spelledarvyn tänds och släcks manuellt.
 */
export default function LocalGame({ onExit }) {
  const [state, setState] = useState(() => G.readCache());
  const [error, setError] = useState('');
  const [askSpy, setAskSpy] = useState(false);

  // Starta ett spel om det inte redan finns ett sparat sedan förra flikbytet.
  useEffect(() => {
    if (state) return;
    let alive = true;
    G.loadWords()
      .then(words => { if (alive) setState(G.newGame(words)); })
      .catch(err => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [state]);

  // Spara undan tillståndet så det överlever att man byter flik i appen.
  useEffect(() => { G.writeCache(state); }, [state]);

  function restart() {
    G.loadWords()
      .then(words => setState(G.newGame(words)))
      .catch(err => setError(err.message));
  }

  if (error) {
    return (
      <>
        <div className="ag-err">{error}</div>
        <button className="ag-btn" onClick={onExit}>Tillbaka</button>
      </>
    );
  }

  if (!state) {
    return <div className="ag-wait"><span className="ag-spin" />Delar ut brädet…</div>;
  }

  const over = state.phase === 'over';
  const showKey = state.showKey || over;

  return (
    <>
      <Score remaining={state.remaining} turn={state.turn} phase={state.phase} />

      <div className="ag-clue">
        {over ? (
          <span className="ag-hint">Spelet är slut.</span>
        ) : state.clue ? (
          <ClueDisplay clue={state.clue} guessesLeft={state.guessesLeft} />
        ) : (
          <ClueInput
            label={`${TEAM_NAME[state.turn]}s ledtråd:`}
            onSubmit={(word, count) => setState(s => G.giveClue(s, word, count))}
          />
        )}
      </div>

      <div className="ag-main">
        <Board
          words={state.words}
          revealed={state.revealed}
          solution={showKey ? state.key : null}
          canPick={!over && !!state.clue && !state.showKey}
          onPick={i => setState(s => G.pick(s, i))}
        />
        <History history={state.history} />
      </div>

      <div className="ag-foot">
        <div className="ag-log">{state.log}</div>
        <button
          className="ag-end"
          disabled={over || !state.clue || state.showKey}
          onClick={() => setState(s => G.endTurn(s))}
        >
          Avsluta draget
        </button>
      </div>

      <div className="ag-tools" style={{ marginTop: 12 }}>
        <button className="ag-btn" onClick={restart}>Nytt spel</button>
        <button
          className={'ag-btn' + (state.showKey ? ' is-on' : '')}
          onClick={() => {
            if (state.showKey) setState(s => ({ ...s, showKey: false }));
            else setAskSpy(true);
          }}
        >
          {state.showKey ? 'Dölj nyckeln' : 'Spelledarvy'}
        </button>
        <button className="ag-btn" onClick={onExit}>Byt läge</button>
      </div>

      {askSpy && (
        <div className="ag-modal open">
          <div className="ag-box">
            <h3>Visa nyckeln?</h3>
            <p>Nyckeln avslöjar vilka ord som tillhör vilket lag. Se till att bara spelledaren ser skärmen.</p>
            <div className="ag-row">
              <button
                className="ag-btn"
                style={{ flex: 1 }}
                onClick={() => { setState(s => ({ ...s, showKey: true })); setAskSpy(false); }}
              >
                Visa nyckeln
              </button>
              <button className="ag-btn" style={{ flex: 1 }} onClick={() => setAskSpy(false)}>
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {over && (
        <WinOverlay winner={state.winner} reason={state.winReason}>
          <div className="ag-row">
            <button className="ag-btn" style={{ flex: 1 }} onClick={restart}>Nytt spel</button>
            <button className="ag-btn" style={{ flex: 1 }} onClick={onExit}>Byt läge</button>
          </div>
        </WinOverlay>
      )}
    </>
  );
}
