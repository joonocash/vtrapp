import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMapProvider } from './map/GoogleMapProvider.js';
import { useRouteAnimation } from './animation/useRouteAnimation.js';
import ControlPanel from './ui/ControlPanel.jsx';
import FramingFrame from './ui/FramingFrame.jsx';
import Countdown from './ui/Countdown.jsx';
import { parseUrlState, writeUrlState } from './urlState.js';
import { fetchRoute, fetchSavedRoutes, saveRoute } from './api.js';

export default function CassiePage() {
  const initial = useMemo(() => parseUrlState(), []);

  const [from, setFromState] = useState(initial.from);
  const [to, setToState] = useState(initial.to);
  const [fromLabel, setFromLabel] = useState(initial.fromLabel);
  const [toLabel, setToLabel] = useState(initial.toLabel);
  const [duration, setDuration] = useState(initial.dur);
  const [pinsMode, setPinsMode] = useState(initial.pins);
  const [format, setFormat] = useState(initial.fmt);
  const [mapStyle, setMapStyle] = useState(initial.style);
  const [routeSlug, setRouteSlug] = useState(initial.route);

  const [route, setRoute] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  const containerRef = useRef(null);
  const frameRef = useRef(null);
  const providerRef = useRef(null);
  const appliedSlugRef = useRef(false);

  if (!providerRef.current) providerRef.current = new GoogleMapProvider();

  // Initiera kartan en gång.
  useEffect(() => {
    let cancelled = false;
    const provider = providerRef.current;

    provider
      .init(containerRef.current, { styleMode: mapStyle })
      .then(() => {
        if (!cancelled) setMapReady(true);
      })
      .catch((err) => {
        console.error('[cassie] kunde inte initiera kartan:', err);
        if (!cancelled) setMapError(err.message || 'Kunde inte ladda kartan');
      });

    return () => {
      cancelled = true;
      provider.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapReady) providerRef.current.setStyle(mapStyle);
  }, [mapStyle, mapReady]);

  // Ladda sparade rutter.
  useEffect(() => {
    fetchSavedRoutes()
      .then(setSavedRoutes)
      .catch(() => setSavedRoutes([]));
  }, []);

  // Applicera en sparad rutt från URL:ens ?r=slug, en gång när listan finns.
  useEffect(() => {
    if (appliedSlugRef.current) return;
    if (!routeSlug || savedRoutes.length === 0) return;
    const match = savedRoutes.find((r) => r.slug === routeSlug);
    if (!match) return;

    appliedSlugRef.current = true;
    setFromState({ lat: match.from[1], lng: match.from[0] });
    setToState({ lat: match.to[1], lng: match.to[0] });
    setFromLabel(match.fromLabel || '');
    setToLabel(match.toLabel || '');
    setDuration(match.dur);
    setPinsMode(match.pins);
    setFormat(match.fmt);
    setMapStyle(match.style);
  }, [routeSlug, savedRoutes]);

  // Hämta rutt från backend (ORS) när start och mål är satta.
  useEffect(() => {
    if (!from || !to) {
      setRoute(null);
      return;
    }

    let cancelled = false;
    setLoadingRoute(true);
    setRouteError('');

    fetchRoute(from, to)
      .then((data) => {
        if (cancelled) return;
        setRoute({ ...data, fromLabel, toLabel });
      })
      .catch((err) => {
        if (cancelled) return;
        setRoute(null);
        setRouteError(err.message || 'Kunde inte hämta rutt');
      })
      .finally(() => {
        if (!cancelled) setLoadingRoute(false);
      });

    return () => {
      cancelled = true;
    };
    // fromLabel/toLabel ska inte trigga ett nytt ORS-anrop, bara from/to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // Skriv tillbaka state till URL:en (replaceState, fyller inte historiken).
  useEffect(() => {
    writeUrlState({ from, to, fromLabel, toLabel, dur: duration, pins: pinsMode, fmt: format, style: mapStyle, route: routeSlug });
  }, [from, to, fromLabel, toLabel, duration, pinsMode, format, mapStyle, routeSlug]);

  const animation = useRouteAnimation({
    mapProvider: providerRef.current,
    ready: mapReady,
    route,
    durationSeconds: duration,
    pinsMode
  });

  const handleSetFrom = useCallback((hit) => {
    setFromState({ lat: hit.lat, lng: hit.lng });
    setFromLabel(hit.label);
    setRouteSlug('');
    appliedSlugRef.current = true;
  }, []);

  const handleSetTo = useCallback((hit) => {
    setToState({ lat: hit.lat, lng: hit.lng });
    setToLabel(hit.label);
    setRouteSlug('');
    appliedSlugRef.current = true;
  }, []);

  const handlePlay = useCallback(() => {
    animation.play(frameRef.current);
  }, [animation]);

  const handleSaveRoute = useCallback(
    async (name) => {
      if (!from || !to) return;
      try {
        const saved = await saveRoute({
          name,
          from: [from.lng, from.lat],
          to: [to.lng, to.lat],
          fromLabel,
          toLabel,
          dur: duration,
          pins: pinsMode,
          fmt: format,
          style: mapStyle
        });
        setSavedRoutes((prev) => [...prev, saved]);
        setRouteSlug(saved.slug);
      } catch (err) {
        console.error('[cassie] kunde inte spara rutten:', err);
      }
    },
    [from, to, fromLabel, toLabel, duration, pinsMode, format, mapStyle]
  );

  const handleLoadRoute = useCallback((record) => {
    appliedSlugRef.current = true;
    setFromState({ lat: record.from[1], lng: record.from[0] });
    setToState({ lat: record.to[1], lng: record.to[0] });
    setFromLabel(record.fromLabel || '');
    setToLabel(record.toLabel || '');
    setDuration(record.dur);
    setPinsMode(record.pins);
    setFormat(record.fmt);
    setMapStyle(record.style);
    setRouteSlug(record.slug);
  }, []);

  const [controlsRevealed, setControlsRevealed] = useState(true);

  useEffect(() => {
    if (animation.isPresenting) setControlsRevealed(false);
  }, [animation.isPresenting]);

  useEffect(() => {
    if (animation.phase !== 'done') return undefined;
    const el = frameRef.current;
    if (!el) return undefined;
    const reveal = () => setControlsRevealed(true);
    el.addEventListener('mousemove', reveal);
    return () => el.removeEventListener('mousemove', reveal);
  }, [animation.phase]);

  const presentationActive = animation.isPresenting || (animation.phase === 'done' && !controlsRevealed);

  const routeInfo = route
    ? {
        distanceKm: Math.round(route.distance / 1000),
        durationMin: Math.round(route.duration / 60)
      }
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <div
        ref={frameRef}
        className="relative h-[60vh] lg:h-[75vh]"
        style={{ cursor: presentationActive ? 'none' : 'default' }}
      >
        <FramingFrame format={format} showGuides={!presentationActive}>
          <div ref={containerRef} className="absolute inset-0" />
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-center p-6">
              <p className="text-sm text-red-300 max-w-sm">{mapError}</p>
            </div>
          )}
          <Countdown value={animation.countdown} />
        </FramingFrame>
      </div>

      <ControlPanel
        hidden={presentationActive}
        fromLabel={fromLabel}
        toLabel={toLabel}
        onSetFrom={handleSetFrom}
        onSetTo={handleSetTo}
        duration={duration}
        onDurationChange={setDuration}
        pinsMode={pinsMode}
        onPinsModeChange={setPinsMode}
        format={format}
        onFormatChange={setFormat}
        mapStyle={mapStyle}
        onMapStyleChange={setMapStyle}
        onPlay={handlePlay}
        onReset={animation.reset}
        phase={animation.phase}
        canPlay={Boolean(route) && !loadingRoute && !routeError}
        routeInfo={routeInfo}
        routeError={routeError}
        loadingRoute={loadingRoute}
        savedRoutes={savedRoutes}
        onSaveRoute={handleSaveRoute}
        onLoadRoute={handleLoadRoute}
      />
    </div>
  );
}
