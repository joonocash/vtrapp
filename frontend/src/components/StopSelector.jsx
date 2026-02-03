import { useState, useRef, useEffect } from 'react';
import { useStopSearch } from '../hooks/useStopSearch';

export function StopSelector({ currentStop, onStopChange }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { results, searching, search } = useStopSearch();
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim().length >= 2) {
      search(value);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelectStop = (stop) => {
    onStopChange({
      areaId: stop.areaId,
      name: stop.name
    });
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-lg font-semibold text-white mb-3">
        Sök hållplats
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder="Skriv namn på hållplats..."
          className="w-full px-5 py-4 pr-12 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-lg"
        />
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          {searching ? (
            <div className="animate-spin h-6 w-6 border-2 border-blue-400 border-t-transparent rounded-full"></div>
          ) : (
            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-10 w-full mt-3 bg-gray-700 border border-gray-600 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
          {results.map((stop) => (
            <button
              key={stop.areaId}
              onClick={() => handleSelectStop(stop)}
              className="w-full text-left px-5 py-4 hover:bg-gray-600 transition-colors border-b border-gray-600 last:border-b-0 first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="font-semibold text-white text-lg">{stop.name}</div>
              <div className="text-sm text-gray-300 mt-1">
                {Math.round(stop.averageDailyStopTimes)} avgångar/dag
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !searching && (
        <div className="absolute z-10 w-full mt-3 bg-gray-700 border border-gray-600 rounded-xl shadow-2xl p-6 text-center text-gray-300">
          Inga hållplatser hittades
        </div>
      )}
    </div>
  );
}

export default StopSelector;
