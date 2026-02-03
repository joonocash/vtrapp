import React, { useState } from 'react';
import { DepartureBoard } from './components/DepartureBoard';
import { StopSelector } from './components/StopSelector';
import { useDepartures } from './hooks/useDepartures';

function App() {
  const [selectedStop, setSelectedStop] = useState({
    areaId: '740025695',
    name: 'Göteborg Ullevi Norra'
  });

  const { departures, loading, error, lastUpdated, refresh } = useDepartures(selectedStop.areaId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-2xl">
        <div className="container mx-auto px-6 py-8 max-w-5xl">
          <h1 className="text-5xl font-bold text-white tracking-tight">Västtrafik</h1>
          <p className="text-blue-100 mt-2 text-lg">Realtidsavgångar • Göteborg</p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-5xl">
        {/* Stop Selector */}
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 mb-8 border border-gray-700">
          <StopSelector
            currentStop={selectedStop}
            onStopChange={setSelectedStop}
          />
        </div>

        {/* Departure Board */}
        <div className="bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
          <DepartureBoard
            departures={departures}
            loading={loading}
            error={error}
            lastUpdated={lastUpdated}
            onRetry={refresh}
            stopName={selectedStop.name}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
