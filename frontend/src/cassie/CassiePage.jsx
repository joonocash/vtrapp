import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMapProvider } from './map/GoogleMapProvider.js';
import { useRouteAnimation } from './animation/useRouteAnimation.js';
import ControlPanel from './ui/ControlPanel.jsx';
import FramingFrame from './ui/FramingFrame.jsx';
import Countdown from './ui/Countdown.jsx';
import { parseUrlState, writeUrlState } from './urlState.js';
import { fetchRoute, fetchSavedRoutes, saveRoute } from './api.js';

function formatCoord(lat, lng) {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

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
  const [truckSize, setTruckSize] = useState(initial.scale);
  const [trailMode, setTrailMode] = useState(initial.trail);
  const [camMode, setCamMode] = useState(initial.cam);
  const [cabSource, setCabSource] = useState(initial.cabSource);
  const [cabColor, setCabColor] = useState(initial.cabColor);
  const [boxSource, setBoxSource] = useState(initial.boxSource);
  const [boxColor, setBoxColor] = useState(initial.boxColor);
  // De faktiska färgerna modellens palett-textur använder, upptäckta i
  // TruckOverlay när glTF:en laddat klart — visas som utbytbara rutor i
  // kontrollpanelen så användaren kan peka ut vilken som är hytt/skåp.
  const [paletteColors, setPaletteColors] = useState([]);
  // 'cab' | 'box' | null — nästa klick på en palettruta tilldelar den till
  // denna roll. Samma mönster som "Klicka på kartan".
  const [assignMode, setAssignMode] = useState(null);
  const [placementMode, setPlacementMode] = useState(false);
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
  const fromRef = useRef(from);
  const toRef = useRef(to);
  const placementModeRef = useRef(placementMode);

  fromRef.current = from;
  toRef.current = to;
  placementModeRef.current = placementMode;

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

  // Klick-för-att-placera: klick ett sätter start, klick två sätter mål,
  // klick tre börjar om (och blir själv den nya starten). Sökfälten
  // fungerar parallellt eftersom båda vägarna bara skriver till samma
  // from/to-state.
  useEffect(() => {
    if (!mapReady) return undefined;

    return providerRef.current.onMapClick((point) => {
      if (!placementModeRef.current) return;

      const label = formatCoord(point.lat, point.lng);
      appliedSlugRef.current = true;
      setRouteSlug('');

      if (!fromRef.current) {
        setFromState(point);
        setFromLabel(label);
      } else if (!toRef.current) {
        setToState(point);
        setToLabel(label);
      } else {
        setToState(null);
        setToLabel('');
        setFromState(point);
        setFromLabel(label);
      }
    });
  }, [mapReady]);

  const handleStartDrag = useCallback((pos) => {
    setFromState(pos);
    setFromLabel(formatCoord(pos.lat, pos.lng));
    setRouteSlug('');
    appliedSlugRef.current = true;
  }, []);

  const handleEndDrag = useCallback((pos) => {
    setToState(pos);
    setToLabel(formatCoord(pos.lat, pos.lng));
    setRouteSlug('');
    appliedSlugRef.current = true;
  }, []);

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
    setTruckSize(Number.isFinite(match.scale) && match.scale > 0 ? match.scale : initial.scale);
    setTrailMode(['full', 'fade', 'none'].includes(match.trail) ? match.trail : initial.trail);
    setCamMode(['follow', 'fixed', 'overview'].includes(match.cam) ? match.cam : initial.cam);
    setCabSource(/^#[0-9a-fA-F]{6}$/.test(match.cabSource) ? match.cabSource : null);
    setCabColor(/^#[0-9a-fA-F]{6}$/.test(match.cabColor) ? match.cabColor : null);
    setBoxSource(/^#[0-9a-fA-F]{6}$/.test(match.boxSource) ? match.boxSource : null);
    setBoxColor(/^#[0-9a-fA-F]{6}$/.test(match.boxColor) ? match.boxColor : null);
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
    writeUrlState({
      from,
      to,
      fromLabel,
      toLabel,
      dur: duration,
      pins: pinsMode,
      fmt: format,
      style: mapStyle,
      scale: truckSize,
      trail: trailMode,
      cam: camMode,
      cabSource,
      cabColor,
      boxSource,
      boxColor,
      route: routeSlug
    });
  }, [
    from,
    to,
    fromLabel,
    toLabel,
    duration,
    pinsMode,
    format,
    mapStyle,
    truckSize,
    trailMode,
    camMode,
    cabSource,
    cabColor,
    boxSource,
    boxColor,
    routeSlug
  ]);

  const handlePaletteDiscovered = useCallback((palette) => {
    setPaletteColors(palette);
  }, []);

  const animation = useRouteAnimation({
    mapProvider: providerRef.current,
    ready: mapReady,
    route,
    durationSeconds: duration,
    pinsMode,
    truckSize,
    trailMode,
    camMode,
    onStartDrag: handleStartDrag,
    onEndDrag: handleEndDrag,
    cabSource,
    cabColor,
    boxSource,
    boxColor,
    onPaletteDiscovered: handlePaletteDiscovered
  });

  // Klick på en palettruta i "peka ut hytt/skåp"-läge tilldelar den rutan
  // som källfärg för den aktiva rollen.
  const handleAssignSwatch = useCallback(
    (hex) => {
      if (assignMode === 'cab') setCabSource((prev) => (prev === hex ? null : hex));
      else if (assignMode === 'box') setBoxSource((prev) => (prev === hex ? null : hex));
      setAssignMode(null);
    },
    [assignMode]
  );

  // Escape avbryter uppspelningen och återställer panelen/muspekaren. Bara
  // Escape — inga musklick, så en pågående tagning inte avbryts av misstag.
  useEffect(() => {
    if (!animation.isPresenting) return undefined;

    function onKeyDown(e) {
      if (e.key === 'Escape') animation.reset();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [animation.isPresenting, animation.reset]);

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
          style: mapStyle,
          scale: truckSize,
          trail: trailMode,
          cam: camMode,
          cabSource,
          cabColor,
          boxSource,
          boxColor
        });
        setSavedRoutes((prev) => [...prev, saved]);
        setRouteSlug(saved.slug);
      } catch (err) {
        console.error('[cassie] kunde inte spara rutten:', err);
      }
    },
    [
      from,
      to,
      fromLabel,
      toLabel,
      duration,
      pinsMode,
      format,
      mapStyle,
      truckSize,
      trailMode,
      camMode,
      cabSource,
      cabColor,
      boxSource,
      boxColor
    ]
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
    setTruckSize(Number.isFinite(record.scale) && record.scale > 0 ? record.scale : 90);
    setTrailMode(['full', 'fade', 'none'].includes(record.trail) ? record.trail : 'full');
    setCamMode(['follow', 'fixed', 'overview'].includes(record.cam) ? record.cam : 'follow');
    setCabSource(/^#[0-9a-fA-F]{6}$/.test(record.cabSource) ? record.cabSource : null);
    setCabColor(/^#[0-9a-fA-F]{6}$/.test(record.cabColor) ? record.cabColor : null);
    setBoxSource(/^#[0-9a-fA-F]{6}$/.test(record.boxSource) ? record.boxSource : null);
    setBoxColor(/^#[0-9a-fA-F]{6}$/.test(record.boxColor) ? record.boxColor : null);
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
        style={{ cursor: presentationActive ? 'none' : placementMode ? 'crosshair' : 'default' }}
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
        truckSize={truckSize}
        onTruckSizeChange={setTruckSize}
        trailMode={trailMode}
        onTrailModeChange={setTrailMode}
        camMode={camMode}
        onCamModeChange={setCamMode}
        paletteColors={paletteColors}
        cabSource={cabSource}
        cabColor={cabColor}
        onCabColorChange={setCabColor}
        boxSource={boxSource}
        boxColor={boxColor}
        onBoxColorChange={setBoxColor}
        assignMode={assignMode}
        onAssignModeChange={setAssignMode}
        onAssignSwatch={handleAssignSwatch}
        placementMode={placementMode}
        onPlacementModeChange={setPlacementMode}
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
