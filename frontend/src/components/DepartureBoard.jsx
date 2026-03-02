import { useState } from 'react';
import { DepartureRow } from './DepartureRow';
import { LineFilter } from './LineFilter';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { formatLastUpdated } from '../utils/dateFormatter';

export function DepartureBoard({ departures, loading, error, lastUpdated, onRetry, stopName }) {
  const [hiddenLines, setHiddenLines] = useState(new Set());

  const handleToggleLine = (line) => {
    setHiddenLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) {
        next.delete(line);
      } else {
        next.add(line);
      }
      return next;
    });
  };

  const filteredDepartures = departures.filter((d) => !hiddenLines.has(d.line));

  if (loading && departures.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={onRetry} />;
  }

  if (departures.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg">Inga avgångar just nu</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pb-3 sm:mb-6 sm:pb-4 border-b border-gray-700">
        <h2 className="text-lg sm:text-2xl font-bold text-white">{stopName}</h2>
        {lastUpdated && (
          <div className="text-xs sm:text-sm text-gray-400">
            Uppdaterad: {formatLastUpdated(lastUpdated)}
          </div>
        )}
      </div>

      {/* Line Filter */}
      <LineFilter
        departures={departures}
        hiddenLines={hiddenLines}
        onToggleLine={handleToggleLine}
      />

      {/* Departures List */}
      <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
        {filteredDepartures.length > 0 ? (
          filteredDepartures.map((departure, index) => (
            <DepartureRow
              key={`${departure.line}-${departure.scheduledTime}-${index}`}
              departure={departure}
            />
          ))
        ) : (
          <div className="py-8 text-center text-gray-400">
            Alla linjer är dolda - tryck på en linje ovan för att visa
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-gray-500">
        Uppdateras automatiskt var 45:e sekund
      </div>
    </div>
  );
}

export default DepartureBoard;
