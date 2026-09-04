import { useEffect, useRef, useState } from 'react';
import { geocode } from '../api.js';

const PINS_OPTIONS = [
  { id: 'always', label: 'Alltid' },
  { id: 'hidden', label: 'Aldrig' },
  { id: 'proximity', label: 'Nära lastbilen' }
];

const FORMAT_OPTIONS = [
  { id: '16x9', label: '16:9' },
  { id: '9x16', label: '9:16' },
  { id: '1x1', label: '1:1' }
];

function GeocodeInput({ label, placeholder, value, onSelect }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const hits = await geocode(q);
        setResults(hits);
      } catch {
        setResults([]);
      }
    }, 300);
  }

  function pick(hit) {
    setQuery(hit.label);
    setOpen(false);
    setResults([]);
    onSelect(hit);
  }

  return (
    <div className="relative">
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-56 overflow-auto">
          {results.map((hit, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(hit)}
                className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ControlPanel({
  fromLabel,
  toLabel,
  onSetFrom,
  onSetTo,
  duration,
  onDurationChange,
  pinsMode,
  onPinsModeChange,
  format,
  onFormatChange,
  mapStyle,
  onMapStyleChange,
  truckSize,
  onTruckSizeChange,
  onPlay,
  onReset,
  phase,
  canPlay,
  routeInfo,
  routeError,
  loadingRoute,
  savedRoutes,
  onSaveRoute,
  onLoadRoute,
  hidden
}) {
  const [saveName, setSaveName] = useState('');
  const canControl = phase === 'idle' || phase === 'ready' || phase === 'done';

  if (hidden) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-5 space-y-4 transition-opacity duration-300">
      <div>
        <h2 className="text-gray-100 font-semibold">Cassie</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Animera en 3D-lastbil längs en riktig rutt — b-roll för skärminspelning.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <GeocodeInput label="Från" placeholder="t.ex. Göteborg" value={fromLabel} onSelect={onSetFrom} />
        <GeocodeInput label="Till" placeholder="t.ex. Kiruna" value={toLabel} onSelect={onSetTo} />
      </div>

      {loadingRoute && <p className="text-xs text-blue-400">Hämtar rutt…</p>}
      {routeError && <p className="text-xs text-red-400">{routeError}</p>}
      {routeInfo && !loadingRoute && (
        <p className="text-xs text-gray-500">
          {routeInfo.distanceKm} km · {routeInfo.durationMin} min körtid enligt ORS
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Klipplängd (sekunder)</label>
          <input
            type="number"
            min={3}
            max={300}
            value={duration}
            onChange={(e) => onDurationChange(Number(e.target.value) || 1)}
            disabled={!canControl}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Kartstil</label>
          <select
            value={mapStyle}
            onChange={(e) => onMapStyleChange(e.target.value)}
            disabled={!canControl}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          >
            <option value="roadmap">Karta</option>
            <option value="satellite">Satellit</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Lastbilsstorlek <span className="text-gray-600">({Math.round(truckSize)} px)</span>
        </label>
        <input
          type="range"
          min={20}
          max={250}
          step={1}
          value={truckSize}
          onChange={(e) => onTruckSizeChange(Number(e.target.value))}
          disabled={!canControl}
          className="w-full accent-blue-500 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Markörer</label>
        <div className="flex flex-wrap gap-2">
          {PINS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={!canControl}
              onClick={() => onPinsModeChange(opt.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                pinsMode === opt.id
                  ? 'bg-blue-600 text-blue-50'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Format</label>
        <div className="flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={!canControl}
              onClick={() => onFormatChange(opt.id)}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                format === opt.id
                  ? 'bg-blue-600 text-blue-50'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onPlay}
          disabled={!canControl || !canPlay}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-blue-50 text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {phase === 'done' ? 'Spela igen' : 'Spela upp'}
        </button>
        {!canControl && (
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2.5 rounded-lg text-sm bg-gray-900 text-gray-300 hover:bg-gray-700"
          >
            Avbryt
          </button>
        )}
      </div>

      <div className="pt-3 border-t border-gray-700 space-y-2">
        <div className="flex gap-2">
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Namn på rutten"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => {
              if (!saveName.trim()) return;
              onSaveRoute(saveName.trim());
              setSaveName('');
            }}
            disabled={!canPlay}
            className="px-4 py-2 rounded-lg text-sm bg-gray-900 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            Spara
          </button>
        </div>

        {savedRoutes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {savedRoutes.map((r) => (
              <button
                key={r.slug}
                type="button"
                onClick={() => onLoadRoute(r)}
                className="text-xs px-3 py-1.5 rounded-full bg-gray-900 text-gray-400 hover:bg-gray-700"
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
