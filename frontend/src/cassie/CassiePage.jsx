import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMapProvider } from './map/GoogleMapProvider.js';
import { useRouteAnimation } from './animation/useRouteAnimation.js';
import ControlPanel from './ui/ControlPanel.jsx';
import FramingFrame from './ui/FramingFrame.jsx';
import Countdown from './ui/Countdown.jsx';
import { parseUrlState, writeUrlState } from './urlState.js';
import { fetchRoute, fetchSavedRoutes, saveRoute } from './api.js';
import { findSimilarHues } from './animation/paletteTexture.js';
import { DEFAULT_CAB_SOURCES, DEFAULT_BOX_SOURCES } from './animation/TruckOverlay.js';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function sanitizeHexList(list) {
  return Array.isArray(list) ? list.filter((h) => HEX_RE.test(h)) : [];
}

// En sparad rutt utan egna cabSources/boxSources (t.ex. sparad innan den
// här funktionen fanns) ska falla tillbaka på standardgrupperna, inte tomt.
function sourcesOrDefault(list, fallback) {
  const clean = sanitizeHexList(list);
  return clean.length ? clean : fallback;
}

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
  const [droneTilt, setDroneTilt] = useState(initial.droneTilt);
  const [droneDistance, setDroneDistance] = useState(initial.droneDistance);
  const [droneSideAngle, setDroneSideAngle] = useState(initial.droneSideAngle);
  const [droneRotationMode, setDroneRotationMode] = useState(initial.droneRotationMode);
  // cabSources/boxSources: vilka UPPTÄCKTA palettfärger som tillhör
  // respektive roll — en roll äger godtyckligt många (grundfärg +
  // skuggnyanser), inte bara en. Faller tillbaka på de hårdkodade
  // standardgrupperna för truck.glb när URL:en/en sparad rutt inte anger
  // något annat (t.ex. ett helt nytt besök).
  const [cabSources, setCabSources] = useState(
    initial.cabSources.length ? initial.cabSources : DEFAULT_CAB_SOURCES
  );
  const [cabColor, setCabColor] = useState(initial.cabColor);
  const [boxSources, setBoxSources] = useState(
    initial.boxSources.length ? initial.boxSources : DEFAULT_BOX_SOURCES
  );
  const [boxColor, setBoxColor] = useState(initial.boxColor);
  // De faktiska färgerna modellens palett-textur använder, upptäckta i
  // TruckOverlay när glTF:en laddat klart — visas som utbytbara rutor i
  // kontrollpanelen så användaren kan peka ut vilken som är hytt/skåp.
  const [paletteColors, setPaletteColors] = useState([]);
  // 'cab' | 'box' | null — medan aktiv lägger klick på en palettruta
  // till/tar bort den ur den rollens grupp. Samma mönster som "Klicka på
  // kartan".
  const [assignMode, setAssignMode] = useState(null);
  // Senast klickade ruta — målet för "Välj liknande".
  const [referenceSwatch, setReferenceSwatch] = useState(null);
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
    setCamMode(['follow', 'fixed', 'overview', 'drone'].includes(match.cam) ? match.cam : initial.cam);
    setDroneTilt(Number.isFinite(match.droneTilt) ? match.droneTilt : initial.droneTilt);
    setDroneDistance(Number.isFinite(match.droneDistance) ? match.droneDistance : initial.droneDistance);
    setDroneSideAngle(Number.isFinite(match.droneSideAngle) ? match.droneSideAngle : initial.droneSideAngle);
    setDroneRotationMode(
      ['track', 'fixed'].includes(match.droneRotationMode) ? match.droneRotationMode : initial.droneRotationMode
    );
    setCabSources(sourcesOrDefault(match.cabSources, DEFAULT_CAB_SOURCES));
    setCabColor(HEX_RE.test(match.cabColor) ? match.cabColor : null);
    setBoxSources(sourcesOrDefault(match.boxSources, DEFAULT_BOX_SOURCES));
    setBoxColor(HEX_RE.test(match.boxColor) ? match.boxColor : null);
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
      droneTilt,
      droneDistance,
      droneSideAngle,
      droneRotationMode,
      cabSources,
      cabColor,
      boxSources,
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
    droneTilt,
    droneDistance,
    droneSideAngle,
    droneRotationMode,
    cabSources,
    cabColor,
    boxSources,
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
    droneTilt,
    droneDistance,
    droneSideAngle,
    droneRotationMode,
    onStartDrag: handleStartDrag,
    onEndDrag: handleEndDrag,
    cabSources,
    cabColor,
    boxSources,
    boxColor,
    onPaletteDiscovered: handlePaletteDiscovered
  });

  // Klick på en palettruta: sätts alltid som referens för "Välj liknande",
  // och om en roll är aktiv läggs den till/tas bort ur den rollens grupp.
  const handleSwatchClick = useCallback(
    (hex) => {
      setReferenceSwatch(hex);
      if (assignMode === 'cab') {
        setCabSources((prev) => (prev.includes(hex) ? prev.filter((h) => h !== hex) : [...prev, hex]));
      } else if (assignMode === 'box') {
        setBoxSources((prev) => (prev.includes(hex) ? prev.filter((h) => h !== hex) : [...prev, hex]));
      }
    },
    [assignMode]
  );

  // "Välj liknande": lägger till alla palettfärger med snarlik nyans som
  // den senast klickade rutan, oavsett ljushet — fångar en hel
  // grundfärg+skuggor-grupp med ett klick.
  const handleSelectSimilarCab = useCallback(() => {
    if (!referenceSwatch) return;
    const matches = findSimilarHues(paletteColors, referenceSwatch);
    setCabSources((prev) => [...new Set([...prev, ...matches])]);
  }, [referenceSwatch, paletteColors]);

  const handleSelectSimilarBox = useCallback(() => {
    if (!referenceSwatch) return;
    const matches = findSimilarHues(paletteColors, referenceSwatch);
    setBoxSources((prev) => [...new Set([...prev, ...matches])]);
  }, [referenceSwatch, paletteColors]);

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
          droneTilt,
          droneDistance,
          droneSideAngle,
          droneRotationMode,
          cabSources,
          cabColor,
          boxSources,
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
      droneTilt,
      droneDistance,
      droneSideAngle,
      droneRotationMode,
      cabSources,
      cabColor,
      boxSources,
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
    setCamMode(['follow', 'fixed', 'overview', 'drone'].includes(record.cam) ? record.cam : 'follow');
    setDroneTilt(Number.isFinite(record.droneTilt) ? record.droneTilt : 55);
    setDroneDistance(Number.isFinite(record.droneDistance) ? record.droneDistance : 50);
    setDroneSideAngle(Number.isFinite(record.droneSideAngle) ? record.droneSideAngle : 0);
    setDroneRotationMode(['track', 'fixed'].includes(record.droneRotationMode) ? record.droneRotationMode : 'track');
    setCabSources(sourcesOrDefault(record.cabSources, DEFAULT_CAB_SOURCES));
    setCabColor(HEX_RE.test(record.cabColor) ? record.cabColor : null);
    setBoxSources(sourcesOrDefault(record.boxSources, DEFAULT_BOX_SOURCES));
    setBoxColor(HEX_RE.test(record.boxColor) ? record.boxColor : null);
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
        droneTilt={droneTilt}
        onDroneTiltChange={setDroneTilt}
        droneDistance={droneDistance}
        onDroneDistanceChange={setDroneDistance}
        droneSideAngle={droneSideAngle}
        onDroneSideAngleChange={setDroneSideAngle}
        droneRotationMode={droneRotationMode}
        onDroneRotationModeChange={setDroneRotationMode}
        paletteColors={paletteColors}
        referenceSwatch={referenceSwatch}
        cabSources={cabSources}
        cabColor={cabColor}
        onCabColorChange={setCabColor}
        onSelectSimilarCab={handleSelectSimilarCab}
        boxSources={boxSources}
        boxColor={boxColor}
        onBoxColorChange={setBoxColor}
        onSelectSimilarBox={handleSelectSimilarBox}
        assignMode={assignMode}
        onAssignModeChange={setAssignMode}
        onSwatchClick={handleSwatchClick}
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
