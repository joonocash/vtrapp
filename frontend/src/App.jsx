import React, { useState } from 'react';
import { DepartureBoard } from './components/DepartureBoard';
import { StopSelector } from './components/StopSelector';
import AgentsGame from './components/agents/AgentsGame.jsx';
import ImpostorGame from './components/ImpostorGame';
import RotspelPage from './rotspel/RotspelPage.jsx';
import { useDepartures } from './hooks/useDepartures';

function App() {
  const [activeTab, setActiveTab] = useState('departures'); // 'departures', 'agents', 'imposter', or 'rotspel'
  const [selectedStop, setSelectedStop] = useState({
    areaId: '740025695',
    name: 'Göteborg Ullevi Norra'
  });

  const { departures, loading, error, lastUpdated, refresh } = useDepartures(selectedStop.areaId);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header with Tabs */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-2xl">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl">
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">Västtrafik</h1>
          <p className="text-blue-100 mt-1 sm:mt-2 text-sm sm:text-lg">Realtidsavgångar • Göteborg</p>

          {/* Tab Navigation */}
          <div className="flikrad flex flex-nowrap gap-3 sm:gap-4 mt-6 overflow-x-auto -mx-4 px-4 py-1 -my-1 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveTab('departures')}
              className={`shrink-0 whitespace-nowrap px-5 sm:px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'departures'
                  ? 'bg-white text-blue-700 shadow-lg'
                  : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
            >
              Avgångar
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`shrink-0 whitespace-nowrap px-5 sm:px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'agents'
                  ? 'bg-white text-blue-700 shadow-lg'
                  : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
            >
              Agenter
            </button>
            <button
              onClick={() => setActiveTab('imposter')}
              className={`shrink-0 whitespace-nowrap px-5 sm:px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'imposter'
                  ? 'bg-white text-blue-700 shadow-lg'
                  : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
            >
              Imposter
            </button>
            <button
              onClick={() => setActiveTab('rotspel')}
              className={`shrink-0 whitespace-nowrap px-5 sm:px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'rotspel'
                  ? 'bg-white text-blue-700 shadow-lg'
                  : 'bg-blue-500 text-white hover:bg-blue-400'
              }`}
            >
              Rötspel
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-6 sm:py-10 max-w-5xl">
        {activeTab === 'departures' ? (
          <>
            {/* Stop Selector */}
            <div className="bg-gray-800 rounded-xl shadow-2xl p-4 sm:p-8 mb-6 sm:mb-8 border border-gray-700">
              <StopSelector
                currentStop={selectedStop}
                onStopChange={setSelectedStop}
              />
            </div>

            {/* Departure Board */}
            <div className="bg-gray-800 rounded-xl shadow-2xl p-3 sm:p-8 border border-gray-700">
              <DepartureBoard
                departures={departures}
                loading={loading}
                error={error}
                lastUpdated={lastUpdated}
                onRetry={refresh}
                stopName={selectedStop.name}
              />
            </div>
          </>
        ) : activeTab === 'agents' ? (
          /* Agents Game */
          <AgentsGame />
        ) : activeTab === 'imposter' ? (
          /* Imposter Game */
          <ImpostorGame />
        ) : (
          /* Rötspel */
          <RotspelPage />
        )}
      </main>
    </div>
  );
}

export default App;
