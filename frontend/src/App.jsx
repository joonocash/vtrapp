import { Component, Suspense, useEffect } from 'react';
import Skal from './shell/Skal.jsx';
import { useHashRutt } from './shell/useHashRutt.js';
import { hittaApp, gissaAppUtanHash, STARTAPP, SAJTNAMN } from './shell/appar.js';

function Laddar() {
  return (
    <div className="grid h-64 place-items-center" role="status" aria-label="Laddar">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
    </div>
  );
}

// Om en app kastar under rendering ska bara den gå ner, inte menyn — annars
// går det inte ens att byta flik. (Rötspel har en egen, finare gräns per spel.)
class AppFelgrans extends Component {
  state = { fel: null };

  static getDerivedStateFromError(fel) {
    return { fel };
  }

  componentDidCatch(fel, info) {
    console.error('[skal] appen kraschade:', fel, info);
  }

  componentDidUpdate(forra) {
    if (this.state.fel && forra.appId !== this.props.appId) this.setState({ fel: null });
  }

  render() {
    if (this.state.fel) {
      return (
        <div className="panel mx-auto max-w-md p-6 text-center">
          <p className="font-display text-lg text-white">Något gick fel</p>
          <p className="mt-1 break-words text-sm text-gray-400">{String(this.state.fel?.message || this.state.fel)}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            Ladda om
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [rutt, ga] = useHashRutt();
  // Ingen hash alls = gammal länk eller första besöket: gissa (Cassie-länkar
  // med ?r=… ska till Cassie). Finns en hash men den är tom/okänd: startsidan.
  const aktiv =
    (rutt.app && hittaApp(rutt.app)) || (window.location.hash ? STARTAPP : gissaAppUtanHash());
  const { Komponent } = aktiv;

  useEffect(() => {
    document.title = `${aktiv.namn} · ${SAJTNAMN}`;
  }, [aktiv.namn]);

  // Ny app = börja överst, som en ny sida.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [aktiv.id]);

  return (
    <Skal aktiv={aktiv}>
      <AppFelgrans appId={aktiv.id}>
        <Suspense fallback={<Laddar />}>
          <Komponent sub={rutt.sub} ga={(sokvag, opt) => ga(`${aktiv.id}${sokvag ? `/${sokvag}` : ''}`, opt)} />
        </Suspense>
      </AppFelgrans>
    </Skal>
  );
}
