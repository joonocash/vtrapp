import { useCallback, useEffect, useRef, useState } from 'react';
import LocalGame from './LocalGame.jsx';
import OnlineGame from './OnlineGame.jsx';
import { loadSession } from './api.js';
import './agents.css';

/* Kommer ihåg valt läge när man byter flik i appen. */
let lastMode = null;

export default function AgentsGame() {
  // Är man redan med i ett rum sedan tidigare hoppar vi direkt dit.
  const [mode, setMode] = useState(() => lastMode || (loadSession() ? 'online' : null));
  const [fullscreen, setFullscreen] = useState(false);
  const [fakeFullscreen, setFakeFullscreen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => { lastMode = mode; }, [mode]);

  /* ── Fullskärm ───────────────────────────────────────────── */
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // iOS Safari saknar fullskärm för element — då låser vi sidan i stället.
  useEffect(() => {
    if (!fakeFullscreen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape') setFakeFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener('keydown', onKey);
    };
  }, [fakeFullscreen]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    if (fakeFullscreen) {
      setFakeFullscreen(false);
      return;
    }
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setFakeFullscreen(true));
    } else {
      setFakeFullscreen(true);
    }
  }, [fakeFullscreen]);

  const expanded = fullscreen || fakeFullscreen;

  return (
    <section id="agenter" ref={rootRef} className={fakeFullscreen ? 'ag-fs' : ''}>
      <div className="ag-top">
        <div className="ag-brand">
          Agenter
          <small>{mode === 'online' ? 'flera enheter' : mode === 'local' ? 'en skärm' : 'ordspel · 5×5'}</small>
        </div>
        <div className="ag-tools">
          <button className={'ag-btn' + (expanded ? ' is-on' : '')} onClick={toggleFullscreen}>
            {expanded ? 'Lämna fullskärm' : 'Fullskärm'}
          </button>
        </div>
      </div>

      {mode === null && <ModePicker onPick={setMode} />}
      {mode === 'local' && <LocalGame onExit={() => setMode(null)} />}
      {mode === 'online' && <OnlineGame onExit={() => setMode(null)} />}
    </section>
  );
}

function ModePicker({ onPick }) {
  return (
    <>
      <div className="ag-modes">
        <button className="ag-mode" onClick={() => onPick('online')}>
          <b>Flera enheter</b>
          <span>
            Alla surfar in på sidan och går med i samma rum med en kod. Ni delar in er
            i lag, och spelledarna ser färgerna på sin egen skärm.
          </span>
        </button>
        <button className="ag-mode" onClick={() => onPick('local')}>
          <b>En skärm</b>
          <span>
            Klassiskt runt bordet. Skicka runt datorn eller plattan och slå på
            spelledarvyn när det är spelledarens tur.
          </span>
        </button>
      </div>
      <div className="ag-note">
        9 agenter till det lag som börjar, 8 till det andra, 7 civila och 1 mullvad.
        Hittar ni mullvaden förlorar ni direkt.
      </div>
    </>
  );
}
