import { useEffect, useState } from 'react';
import { DepartureRow } from './DepartureRow';
import { LineFilter } from './LineFilter';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';

// Minuterna räknas om mot klockan var 15:e sekund, så "3 min" inte står
// kvar i 45 sekunder mellan två hämtningar.
function useNu(intervall = 15000) {
  const [nu, setNu] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNu(new Date()), intervall);
    return () => clearInterval(id);
  }, [intervall]);
  return nu;
}

export function DepartureBoard({ departures, loading, error, onRetry }) {
  const [hiddenLines, setHiddenLines] = useState(new Set());
  const nu = useNu();

  const handleToggleLine = (line) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  };

  const filteredDepartures = departures.filter((d) => !hiddenLines.has(d.line));

  let innehall;
  if (loading && departures.length === 0) {
    innehall = <LoadingSpinner />;
  } else if (error) {
    innehall = <ErrorMessage message={error} onRetry={onRetry} />;
  } else if (departures.length === 0) {
    innehall = (
      <div className="px-6 py-16 text-center">
        <p className="font-display text-lg text-gray-200">Inga avgångar just nu</p>
        <p className="mt-1 text-sm text-gray-500">Prova en annan hållplats eller kom tillbaka senare.</p>
      </div>
    );
  } else if (filteredDepartures.length === 0) {
    innehall = (
      <div className="px-6 py-12 text-center text-sm text-gray-400">
        Alla linjer är dolda.{' '}
        <button onClick={() => setHiddenLines(new Set())} className="font-medium text-accent hover:underline">
          Visa alla
        </button>
      </div>
    );
  } else {
    innehall = (
      <ul className="divide-y divide-ink-line">
        {filteredDepartures.map((departure, index) => (
          <DepartureRow key={`${departure.line}-${departure.scheduledTime}-${index}`} departure={departure} nu={nu} />
        ))}
      </ul>
    );
  }

  const antal = filteredDepartures.length;

  return (
    <section className="panel overflow-hidden" aria-label="Avgångar">
      <div className="space-y-3 border-b border-ink-line px-4 pb-3 pt-4 sm:px-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-base font-semibold text-white">Nästa avgångar</h2>
          {!loading && !error && departures.length > 0 && (
            <span className="text-xs text-gray-500 tabular">
              {antal} {antal === 1 ? 'avgång' : 'avgångar'}
            </span>
          )}
        </div>
        <LineFilter
          departures={departures}
          hiddenLines={hiddenLines}
          onToggleLine={handleToggleLine}
          onShowAll={() => setHiddenLines(new Set())}
        />
      </div>
      {innehall}
    </section>
  );
}

export default DepartureBoard;
