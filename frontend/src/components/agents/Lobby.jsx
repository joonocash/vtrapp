/**
 * Lobbyn. Alla i rummet ser samma lista och väljer lag själva.
 * Bara en spelledare per lag — servern flyttar automatiskt undan den
 * förra om någon annan tar rollen.
 */
export default function Lobby({ state, busy, colors, onPick, onColor, onShuffle, onStart, onLeave }) {
  const me = state.you;
  const bench = state.players.filter(p => !p.team);

  function column(team) {
    const label = team === 'red' ? 'Rött lag' : 'Blått lag';
    const spymasters = state.players.filter(p => p.team === team && p.role === 'spymaster');
    const operatives = state.players.filter(p => p.team === team && p.role === 'operative');
    const mine = me?.team === team;

    return (
      <div className={'ag-lobby-col ' + team}>
        <h5>{label}</h5>

        <div className="ag-slot">Spelledare</div>
        <PlayerList players={spymasters} me={me} empty="Ingen vald" />

        <div className="ag-slot">Agenter</div>
        <PlayerList players={operatives} me={me} empty="Inga än" />

        <div className="ag-pick">
          <button
            className={'ag-btn' + (mine && me?.role === 'operative' ? ` ${team}-on` : '')}
            disabled={busy}
            onClick={() => onPick(team, 'operative')}
          >
            Gå med
          </button>
          <button
            className={'ag-btn' + (mine && me?.role === 'spymaster' ? ` ${team}-on` : '')}
            disabled={busy}
            onClick={() => onPick(team, 'spymaster')}
          >
            Bli spelledare
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="ag-panel">
        <h4>Rumskod {state.code}</h4>
        <div className="ag-note">
          Alla surfar in på samma adress, väljer Agenter och skriver in koden. Spelledarna
          ser färgerna på brädet, resten ser bara orden.
        </div>
      </div>

      {!!colors?.length && (
        <div className="ag-panel">
          <h4>Din färg</h4>
          <div className="ag-note" style={{ marginBottom: 8 }}>
            Syns som en prick på orden ni markerar tillsammans under diskussionen.
          </div>
          <div className="ag-colors">
            {colors.map(c => {
              const owner = state.players.find(p => p.color === c && p.id !== me?.id);
              const mine = me?.color === c;
              return (
                <button
                  key={c}
                  className={'ag-swatch' + (mine ? ' is-on' : '')}
                  style={{ '--sw': c }}
                  disabled={!!owner || busy}
                  title={owner ? `${owner.name} har den här färgen` : 'Välj den här färgen'}
                  onClick={() => onColor(c)}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="ag-lobby">
        {column('red')}
        {column('blue')}
      </div>

      {!!bench.length && (
        <div className="ag-panel ag-bench">
          <h4>Utan lag</h4>
          <PlayerList players={bench} me={me} empty="—" />
        </div>
      )}

      {!!state.problems.length && (
        <div className="ag-err">{state.problems.join(' · ')}</div>
      )}

      <div className="ag-tools">
        {me?.isHost && (
          <>
            <button className="ag-btn" disabled={busy} onClick={onShuffle}>Lotta lagen</button>
            <button
              className="ag-btn"
              disabled={busy || !!state.problems.length}
              onClick={onStart}
            >
              Starta spelet
            </button>
          </>
        )}
        {!me?.isHost && (
          <span className="ag-note">Väntar på att {hostName(state)} startar spelet.</span>
        )}
        <button className="ag-btn" disabled={busy} onClick={onLeave}>Lämna rummet</button>
      </div>
    </>
  );
}

function hostName(state) {
  const host = state.players.find(p => p.isHost);
  return host ? host.name : 'värden';
}

function PlayerList({ players, me, empty }) {
  if (!players.length) return <div className="ag-empty">{empty}</div>;
  return (
    <ul className="ag-plist">
      {players.map(p => (
        <li key={p.id} className={p.online ? '' : 'off'}>
          <span className="ag-color-dot" style={{ background: p.color }} />
          <span className="ag-dot-on" />
          {p.name}
          {p.id === me?.id && <span className="me">du</span>}
          {p.isHost && <span className="me">värd</span>}
        </li>
      ))}
    </ul>
  );
}
