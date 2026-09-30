import { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin } from 'lucide-react';
import { useStopSearch } from '../hooks/useStopSearch';

export function StopSelector({ onStopChange }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { results, searching, search } = useStopSearch();
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Stäng listan vid klick utanför
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFocus = () => {
    if (query.trim().length >= 2) setIsOpen(true);
    // På mobil: scrolla upp fältet så träffarna inte hamnar bakom tangentbordet.
    // Inte på dator — där ligger panelen fast och toppbaren skulle täcka fältet.
    if (window.matchMedia('(max-width: 767px)').matches) {
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  };

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
    onStopChange({ areaId: stop.areaId, name: stop.name });
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur(); // stänger mobiltangentbordet
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && results.length > 0) handleSelectStop(results[0]);
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label htmlFor="hallplats-sok" className="sr-only">
        Sök hållplats
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" aria-hidden="true" />
        <input
          id="hallplats-sok"
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={handleSearch}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Byt hållplats…"
          className="w-full rounded-xl border border-ink-line bg-black/20 py-3 pl-11 pr-11 text-base text-white placeholder-gray-500 outline-none transition-colors focus:border-accent/60 focus:bg-black/30 [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {searching ? (
            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-accent/70 border-t-transparent" />
          ) : (
            query && (
              <button
                onClick={() => {
                  setQuery('');
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="grid h-7 w-7 place-items-center rounded-full text-gray-500 hover:bg-white/10 hover:text-gray-200"
                aria-label="Rensa sökningen"
              >
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-ink-line-strong bg-gray-850/95 p-1 shadow-2xl backdrop-blur-xl sm:max-h-96">
          {results.map((stop) => (
            <li key={stop.areaId}>
              <button
                onClick={() => handleSelectStop(stop)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] active:bg-white/10"
              >
                <MapPin className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-white">{stop.name}</span>
                  {Number.isFinite(stop.averageDailyStopTimes) && (
                    <span className="block text-xs text-gray-500">
                      {Math.round(stop.averageDailyStopTimes)} avgångar/dag
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !searching && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-ink-line-strong bg-gray-850/95 p-5 text-center text-sm text-gray-400 shadow-2xl backdrop-blur-xl">
          Inga hållplatser hittades
        </div>
      )}
    </div>
  );
}

export default StopSelector;
