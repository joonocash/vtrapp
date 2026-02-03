import { DepartureRow } from './DepartureRow';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { formatLastUpdated } from '../utils/dateFormatter';

export function DepartureBoard({ departures, loading, error, lastUpdated, onRetry, stopName }) {
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
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
        <h2 className="text-2xl font-bold text-white">{stopName}</h2>
        {lastUpdated && (
          <div className="text-sm text-gray-400">
            Uppdaterad: {formatLastUpdated(lastUpdated)}
          </div>
        )}
      </div>

      {/* Departures List */}
      <div className="bg-gray-800 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
        {departures.map((departure, index) => (
          <DepartureRow
            key={`${departure.line}-${departure.scheduledTime}-${index}`}
            departure={departure}
          />
        ))}
      </div>

      {/* Auto-refresh indicator */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Uppdateras automatiskt var 45:e sekund
      </div>
    </div>
  );
}

export default DepartureBoard;
