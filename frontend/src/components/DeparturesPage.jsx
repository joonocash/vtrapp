import { useCallback, useState } from 'react';
import { RefreshCw, MapPin, History } from 'lucide-react';
import { DepartureBoard } from './DepartureBoard';
import { StopSelector } from './StopSelector';
import { useDepartures } from '../hooks/useDepartures';
import { formatLastUpdated } from '../utils/dateFormatter';

const STANDARD = { areaId: '740025695', name: 'Göteborg Ullevi Norra' };
const VALD_KEY = 'vtr_hallplats';
const SENASTE_KEY = 'vtr_senaste';
const MAX_SENASTE = 4;

function las(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function spara(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // privat läge — sidan fungerar ändå, den kommer bara inte ihåg
  }
}

// "Göteborg Ullevi Norra" → { ort: 'Göteborg', namn: 'Ullevi Norra' }.
// Trafiklab sätter kommunen först i många namn; den blir en liten rad ovanför.
function delaNamn(namn = '') {
  const m = namn.match(/^(Göteborg|Mölndal|Partille|Kungälv|Lerum|Härryda|Kungsbacka|Ale|Öckerö|Stenungsund)\s+(.+)$/);
  return m ? { ort: m[1], namn: m[2] } : { ort: '', namn };
}

function LiveStatus({ lastUpdated, error, onRefresh }) {
  const [uppdaterar, setUppdaterar] = useState(false);

  async function klick() {
    if (uppdaterar) return;
    setUppdaterar(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setUppdaterar(false), 400);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 text-xs text-gray-400">
        {error ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
        ) : (
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-live-ping rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        )}
        <span className="truncate">
          {error ? 'Ingen kontakt' : 'Live'}
          {lastUpdated && <span className="text-gray-500"> · uppdaterad {formatLastUpdated(lastUpdated)}</span>}
        </span>
      </div>
      <button
        onClick={klick}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
        aria-label="Uppdatera nu"
        title="Uppdatera nu (sker annars automatiskt var 45:e sekund)"
      >
        <RefreshCw className={`h-4 w-4 ${uppdaterar ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

export default function DeparturesPage() {
  const [selectedStop, setSelectedStop] = useState(() => {
    const v = las(VALD_KEY, null);
    return v && v.areaId && v.name ? v : STANDARD;
  });
  const [senaste, setSenaste] = useState(() => {
    const v = las(SENASTE_KEY, []);
    return Array.isArray(v) ? v.filter((s) => s && s.areaId && s.name) : [];
  });

  const { departures, loading, error, lastUpdated, refresh } = useDepartures(selectedStop.areaId);

  const byt = useCallback((stop) => {
    setSelectedStop(stop);
    spara(VALD_KEY, stop);
    setSenaste((forra) => {
      const nya = [stop, ...forra.filter((s) => s.areaId !== stop.areaId)].slice(0, MAX_SENASTE + 1);
      spara(SENASTE_KEY, nya);
      return nya;
    });
  }, []);

  const { ort, namn } = delaNamn(selectedStop.name);
  const andraSenaste = senaste.filter((s) => s.areaId !== selectedStop.areaId).slice(0, MAX_SENASTE);

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <aside className="panel relative z-10 space-y-4 p-4 sm:p-5 lg:sticky lg:top-[calc(var(--topbar-h)+2rem)]">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            {ort || 'Hållplats'}
          </p>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[32px]">
            {namn}
          </h1>
        </div>

        <LiveStatus lastUpdated={lastUpdated} error={error} onRefresh={refresh} />

        <StopSelector onStopChange={byt} />

        {andraSenaste.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-500">
              <History className="h-3.5 w-3.5" aria-hidden="true" /> Senaste
            </p>
            <div className="flex flex-wrap gap-1.5">
              {andraSenaste.map((s) => (
                <button
                  key={s.areaId}
                  onClick={() => byt(s)}
                  className="max-w-full truncate rounded-full border border-ink-line bg-white/[0.03] px-3 py-1.5 text-[13px] text-gray-300 transition-colors hover:border-ink-line-strong hover:bg-white/[0.06] hover:text-white"
                >
                  {delaNamn(s.name).namn}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <DepartureBoard
        key={selectedStop.areaId}
        departures={departures}
        loading={loading}
        error={error}
        onRetry={refresh}
      />
    </div>
  );
}
