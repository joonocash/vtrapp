import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BearingSmoother,
  ScalarSmoother,
  bankAngleFromTurnRate,
  bearingBetween,
  boundsOf,
  boundsZoom,
  buildRouteTimeline,
  computeZoomForPace,
  droneDistanceZoomOffset,
  groundMetersPerPixel,
  haversineDistance,
  lookAheadDistance,
  sampleRouteAtTime,
  speedAtTime,
  trimTrailingPath
} from './routeMath.js';
import { TruckOverlay } from './TruckOverlay.js';

const OVERVIEW_PADDING = 64;
const OVERVIEW_HOLD_MS = 2000;
const FLY_TO_START_MS = 2000;
const COUNTDOWN_STEPS = [3, 2, 1];
const COUNTDOWN_STEP_MS = 1000;
const HOLD_END_MS = 3000;
const RETURN_TO_OVERVIEW_MS = 2000;
const PLAYING_TILT = 60;
const TAIL_TRIM_METERS = 50000;
const FADE_RADIUS_PX = 220;

function sleep(ms, cancelledRef) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(!cancelledRef.current), ms);
  });
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngleDeg(a, b, t) {
  const diff = (((b - a + 540) % 360) + 360) % 360 - 180;
  return (a + diff * t + 360) % 360;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function normalizeHeadingDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Komponerar en drönarkamera för en given markpunkt. I "track"-rotationsläge
 * följer kompassriktningen lastbilens bäring (som follow, bara med reglerbar
 * tilt/avstånd/sidovinkel ovanpå); i "fixed" hålls kompassriktningen kvar vid
 * fixedHeadingDeg (bäringen vid ruttens start) hela klippet ut, så kartan
 * ligger still och lastbilen svänger på den i stället — det som gör läget
 * skakfritt att spela in.
 *
 * sideAngle roterar kameran ur "rakt bakom"-läget: eftersom Google-kameran
 * alltid sitter mitt emot heading-riktningen relativt center, ger ett
 * heading-offset exakt effekten av att kameran ligger snett bakom i stället
 * för rakt bakom.
 */
function droneCameraFromPoint({
  point,
  travelBearingDeg,
  paceZoom,
  tilt,
  distance,
  sideAngle,
  rotationMode,
  fixedHeadingDeg
}) {
  const baseHeading = rotationMode === 'fixed' ? fixedHeadingDeg : travelBearingDeg;
  return {
    lat: point.lat,
    lng: point.lng,
    zoom: paceZoom + droneDistanceZoomOffset(distance),
    heading: normalizeHeadingDeg(baseHeading + sideAngle),
    tilt
  };
}

function animateCamera(mapProvider, from, to, durationMs, cancelledRef) {
  return new Promise((resolve) => {
    const start = performance.now();

    function frame(now) {
      if (cancelledRef.current) return resolve(false);
      const raw = Math.min(1, (now - start) / durationMs);
      const t = easeInOutCubic(raw);

      mapProvider.moveCamera({
        lat: lerp(from.lat, to.lat, t),
        lng: lerp(from.lng, to.lng, t),
        zoom: lerp(from.zoom, to.zoom, t),
        heading: lerpAngleDeg(from.heading, to.heading, t),
        tilt: lerp(from.tilt, to.tilt, t)
      });

      if (raw < 1) requestAnimationFrame(frame);
      else resolve(true);
    }

    requestAnimationFrame(frame);
  });
}

function applyBookendOpacity(mapProvider, pinsMode, value) {
  if (pinsMode === 'hidden') {
    mapProvider.setMarkerOpacity('start', 0);
    mapProvider.setMarkerOpacity('end', 0);
    return;
  }
  mapProvider.setMarkerOpacity('start', value);
  mapProvider.setMarkerOpacity('end', value);
}

/**
 * Orkestrerar hela Cassie-animationen: bygger tidslinjen från ruttdata, äger
 * rAF-uppspelningsloopen och all uppspelningsstate (fas, nedräkning), och
 * driver kamera/svans/markörer via mapProvider varje bildruta.
 *
 * @param {{
 *   mapProvider: import('../map/MapProvider.js').MapProvider,
 *   ready: boolean,
 *   route: { geometry: {coordinates:[number,number][]}, segments: any[], fromLabel?: string, toLabel?: string } | null,
 *   durationSeconds: number,
 *   pinsMode: 'always' | 'hidden' | 'proximity',
 *   truckSize: number,
 *   trailMode: 'full' | 'fade' | 'none',
 *   camMode: 'follow' | 'fixed' | 'overview' | 'drone',
 *   droneTilt: number,
 *   droneDistance: number,
 *   droneSideAngle: number,
 *   droneRotationMode: 'track' | 'fixed',
 *   onStartDrag: (pos: {lat:number, lng:number}) => void,
 *   onEndDrag: (pos: {lat:number, lng:number}) => void,
 *   cabSources: string[],
 *   cabColor: string | null,
 *   boxSources: string[],
 *   boxColor: string | null,
 *   onPaletteDiscovered: (palette: {hex: string, count: number}[]) => void,
 *   containerRef: { current: HTMLElement | null }
 * }} args
 */
export function useRouteAnimation({
  mapProvider,
  ready,
  route,
  durationSeconds,
  pinsMode,
  truckSize,
  trailMode,
  camMode,
  droneTilt,
  droneDistance,
  droneSideAngle,
  droneRotationMode,
  onStartDrag,
  onEndDrag,
  cabSources,
  cabColor,
  boxSources,
  boxColor,
  onPaletteDiscovered
}) {
  const [phase, setPhase] = useState('idle'); // idle|ready|overview|flyToStart|countdown|playing|holdEnd|returnToOverview|done
  const [countdown, setCountdown] = useState(null);

  const timelineRef = useRef(null);
  const bboxRef = useRef(null);
  const overlayRef = useRef(null);
  const cancelledRef = useRef(false);
  const drivenPathRef = useRef([]);
  const pinsModeRef = useRef(pinsMode);
  const durationRef = useRef(durationSeconds);
  const truckSizeRef = useRef(truckSize);
  const trailModeRef = useRef(trailMode);
  const camModeRef = useRef(camMode);
  const droneTiltRef = useRef(droneTilt);
  const droneDistanceRef = useRef(droneDistance);
  const droneSideAngleRef = useRef(droneSideAngle);
  const droneRotationModeRef = useRef(droneRotationMode);
  const onStartDragRef = useRef(onStartDrag);
  const onEndDragRef = useRef(onEndDrag);
  const cabSourcesRef = useRef(cabSources);
  const cabColorRef = useRef(cabColor);
  const boxSourcesRef = useRef(boxSources);
  const boxColorRef = useRef(boxColor);
  const onPaletteDiscoveredRef = useRef(onPaletteDiscovered);

  pinsModeRef.current = pinsMode;
  durationRef.current = durationSeconds;
  truckSizeRef.current = truckSize;
  trailModeRef.current = trailMode;
  camModeRef.current = camMode;
  droneTiltRef.current = droneTilt;
  droneDistanceRef.current = droneDistance;
  droneSideAngleRef.current = droneSideAngle;
  droneRotationModeRef.current = droneRotationMode;
  onStartDragRef.current = onStartDrag;
  onEndDragRef.current = onEndDrag;
  cabSourcesRef.current = cabSources;
  cabColorRef.current = cabColor;
  boxSourcesRef.current = boxSources;
  boxColorRef.current = boxColor;
  onPaletteDiscoveredRef.current = onPaletteDiscovered;

  // Bygg scenen (tidslinje, overlay, linjer, markörer) när rutten är redo.
  useEffect(() => {
    if (!ready || !mapProvider || !route) return undefined;

    const vertices = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const steps = (route.segments || []).flatMap((s) => s.steps || []);
    const timeline = buildRouteTimeline(vertices, steps);
    const bbox = boundsOf(vertices);

    timelineRef.current = timeline;
    bboxRef.current = bbox;
    drivenPathRef.current = [];

    const overlay = new TruckOverlay();
    mapProvider.attachOverlay(overlay);
    overlayRef.current = overlay;
    overlay._onPaletteDiscovered = (palette) => onPaletteDiscoveredRef.current?.(palette);

    // Placera lastbilen vid startpunkten direkt, innan uppspelning har
    // körts igång — annars finns det inget att visa storleksreglaget mot
    // medan man står still och ställer in det.
    overlay.setPixelSize(truckSizeRef.current);
    overlay.setCabSources(cabSourcesRef.current);
    overlay.setCabColor(cabColorRef.current);
    overlay.setBoxSources(boxSourcesRef.current);
    overlay.setBoxColor(boxColorRef.current);
    overlay.setPose({
      lat: vertices[0].lat,
      lng: vertices[0].lng,
      headingDeg: bearingBetween(vertices[0], vertices[1] || vertices[0]),
      bankDeg: 0
    });
    overlay.requestRedraw();

    mapProvider.addPolyline('driven', {
      path: [],
      strokeColor: '#f97316',
      strokeWeight: 5,
      strokeOpacity: 0.95,
      zIndex: 3
    });
    mapProvider.addPolyline('remaining', {
      path: vertices,
      strokeColor: '#93c5fd',
      strokeWeight: 3,
      strokeOpacity: 0.55,
      dashed: true,
      zIndex: 2
    });

    const startPoint = vertices[0];
    const endPoint = vertices[vertices.length - 1];
    mapProvider.addMarker('start', {
      lat: startPoint.lat,
      lng: startPoint.lng,
      label: route.fromLabel || 'Start',
      draggable: true,
      onDragEnd: (pos) => onStartDragRef.current?.(pos)
    });
    mapProvider.addMarker('end', {
      lat: endPoint.lat,
      lng: endPoint.lng,
      label: route.toLabel || 'Mål',
      draggable: true,
      onDragEnd: (pos) => onEndDragRef.current?.(pos)
    });
    applyBookendOpacity(mapProvider, pinsModeRef.current, 1);

    mapProvider.fitBounds(bbox, OVERVIEW_PADDING);
    setPhase('ready');

    return () => {
      mapProvider.removePolyline('driven');
      mapProvider.removePolyline('remaining');
      mapProvider.removeMarker('start');
      mapProvider.removeMarker('end');
      timelineRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mapProvider, route]);

  // Om pins-läget ändras medan vi inte spelar upp, uppdatera direkt.
  useEffect(() => {
    if (!mapProvider || !timelineRef.current) return;
    if (phase === 'playing') return;
    applyBookendOpacity(mapProvider, pinsMode, 1);
  }, [pinsMode, mapProvider, phase]);

  // Storleksreglaget ska synas direkt, oavsett fas — sliden får inte kräva
  // att man spelar upp för att se resultatet.
  useEffect(() => {
    overlayRef.current?.setPixelSize(truckSize);
  }, [truckSize]);

  // Samma sak för färgerna — synliga direkt, oavsett fas.
  useEffect(() => {
    overlayRef.current?.setCabSources(cabSources);
  }, [cabSources]);

  useEffect(() => {
    overlayRef.current?.setCabColor(cabColor);
  }, [cabColor]);

  useEffect(() => {
    overlayRef.current?.setBoxSources(boxSources);
  }, [boxSources]);

  useEffect(() => {
    overlayRef.current?.setBoxColor(boxColor);
  }, [boxColor]);

  // Drönarreglagen ska synas direkt medan man pausar, precis som
  // storleksreglaget — annars måste man trycka Play för varje liten
  // justering av tilt/avstånd/sidovinkel för att se resultatet.
  useEffect(() => {
    if (!mapProvider || !timelineRef.current || camMode !== 'drone') return;
    // Bara i vilofaserna — under overview/flyToStart/countdown/playing/
    // holdEnd/returnToOverview äger play()-koreografin kameran, och den här
    // effekten ska inte köra över den bara för att fasen ändras.
    if (!['idle', 'ready', 'done'].includes(phase)) return;

    const timeline = timelineRef.current;
    const bbox = bboxRef.current;
    const startVertex = timeline.vertices[0];
    const startBearing = bearingBetween(startVertex, timeline.vertices[1] || startVertex);
    const paceZoom = computeZoomForPace(
      timeline.totalDistance,
      durationSeconds,
      (bbox.north + bbox.south) / 2
    );

    mapProvider.moveCamera(
      droneCameraFromPoint({
        point: startVertex,
        travelBearingDeg: startBearing,
        paceZoom,
        tilt: droneTilt,
        distance: droneDistance,
        sideAngle: droneSideAngle,
        rotationMode: droneRotationMode,
        fixedHeadingDeg: startBearing
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camMode, droneTilt, droneDistance, droneSideAngle, droneRotationMode, durationSeconds, mapProvider, phase]);

  const runPlayback = useCallback(
    (mp, camMode) =>
      new Promise((resolve) => {
        const timeline = timelineRef.current;
        const durationMs = Math.max(1, durationRef.current) * 1000;
        const paceZoom = computeZoomForPace(
          timeline.totalDistance,
          durationRef.current,
          (bboxRef.current.north + bboxRef.current.south) / 2
        );
        const playbackSpeedFactor = timeline.totalTime / Math.max(1, durationRef.current);
        const following = camMode === 'follow';
        const droning = camMode === 'drone';

        const bearingSmoother = new BearingSmoother(0.15);
        const bankSmoother = new ScalarSmoother(0.2);
        const first = sampleRouteAtTime(timeline, 0);
        const droneFixedHeadingDeg = first.bearing;
        bearingSmoother.reset(first.bearing);
        bankSmoother.reset(0);

        drivenPathRef.current = [{ lat: first.lat, lng: first.lng }];
        if (trailModeRef.current === 'none') {
          mp.setPolylinePath('driven', []);
        }
        let prevBearing = first.bearing;
        let lastFrameTime = performance.now();
        const start = performance.now();

        function frame(now) {
          if (cancelledRef.current) return resolve(false);

          const elapsed = now - start;
          const progress = Math.min(1, elapsed / durationMs);
          const t = progress * timeline.totalTime;
          const dt = Math.max(0.001, (now - lastFrameTime) / 1000);
          lastFrameTime = now;

          const sample = sampleRouteAtTime(timeline, t);
          const smoothedBearing = bearingSmoother.next(sample.bearing);
          const rawBank = bankAngleFromTurnRate(prevBearing, smoothedBearing, dt);
          const bank = bankSmoother.next(rawBank);
          prevBearing = smoothedBearing;

          const overlay = overlayRef.current;
          overlay?.setPose({
            lat: sample.lat,
            lng: sample.lng,
            headingDeg: smoothedBearing,
            bankDeg: bank
          });
          overlay?.requestRedraw();

          if (following) {
            const localSpeed = speedAtTime(timeline, t);
            const mapSpeed = localSpeed * playbackSpeedFactor;
            const aheadMeters = lookAheadDistance(mapSpeed);
            const aheadSeconds = aheadMeters / Math.max(0.5, localSpeed);
            const cameraTarget = sampleRouteAtTime(timeline, Math.min(timeline.totalTime, t + aheadSeconds));

            mp.moveCamera({
              lat: cameraTarget.lat,
              lng: cameraTarget.lng,
              zoom: paceZoom,
              heading: smoothedBearing,
              tilt: PLAYING_TILT
            });
          } else if (droning) {
            mp.moveCamera(
              droneCameraFromPoint({
                point: { lat: sample.lat, lng: sample.lng },
                travelBearingDeg: smoothedBearing,
                paceZoom,
                tilt: droneTiltRef.current,
                distance: droneDistanceRef.current,
                sideAngle: droneSideAngleRef.current,
                rotationMode: droneRotationModeRef.current,
                fixedHeadingDeg: droneFixedHeadingDeg
              })
            );
          }

          if (trailModeRef.current !== 'none') {
            drivenPathRef.current.push({ lat: sample.lat, lng: sample.lng });
            if (trailModeRef.current === 'fade') {
              drivenPathRef.current = trimTrailingPath(drivenPathRef.current, TAIL_TRIM_METERS);
            }
            mp.setPolylinePath('driven', drivenPathRef.current);
          }

          const remaining = [
            { lat: sample.lat, lng: sample.lng },
            ...timeline.vertices.slice((sample.segmentIndex ?? 0) + 1)
          ];
          mp.setPolylinePath('remaining', remaining);

          if (pinsModeRef.current === 'proximity') {
            const threshold = groundMetersPerPixel(paceZoom, sample.lat) * FADE_RADIUS_PX;
            const distStart = haversineDistance(sample, timeline.vertices[0]);
            const distEnd = haversineDistance(sample, timeline.vertices[timeline.vertices.length - 1]);
            mp.setMarkerOpacity('start', smoothstep(threshold, threshold * 0.35, distStart));
            mp.setMarkerOpacity('end', smoothstep(threshold, threshold * 0.35, distEnd));
          }

          if (progress < 1) requestAnimationFrame(frame);
          else resolve(true);
        }

        requestAnimationFrame(frame);
      }),
    []
  );

  const play = useCallback(
    async (containerEl) => {
      const mp = mapProvider;
      const timeline = timelineRef.current;
      const bbox = bboxRef.current;
      if (!mp || !timeline || !bbox) return;

      cancelledRef.current = false;
      mp.setGestureHandling('none');

      const camMode = camModeRef.current;

      const width = containerEl?.clientWidth || 1280;
      const height = containerEl?.clientHeight || 720;
      const overviewZoom = boundsZoom(bbox, width, height);
      const overviewCamera = {
        lat: (bbox.north + bbox.south) / 2,
        lng: (bbox.east + bbox.west) / 2,
        zoom: overviewZoom,
        heading: 0,
        tilt: 0
      };

      const startVertex = timeline.vertices[0];
      const startBearing = bearingBetween(startVertex, timeline.vertices[1] || startVertex);
      const paceZoom = computeZoomForPace(
        timeline.totalDistance,
        durationRef.current,
        (bbox.north + bbox.south) / 2
      );
      const startCamera = {
        lat: startVertex.lat,
        lng: startVertex.lng,
        zoom: paceZoom,
        heading: startBearing,
        tilt: PLAYING_TILT
      };

      const endVertex = timeline.vertices[timeline.vertices.length - 1];
      const prevVertex = timeline.vertices[timeline.vertices.length - 2] || endVertex;
      const endBearing = bearingBetween(prevVertex, endVertex);
      const endCamera = {
        lat: endVertex.lat,
        lng: endVertex.lng,
        zoom: paceZoom,
        heading: endBearing,
        tilt: PLAYING_TILT
      };

      // Drönarkamerans egen start/slut-komposition — samma tre punkter
      // (start, slut, fixerad heading vid t=0) som styr valet mellan
      // "kompassen följer bäringen" och "kompassen ligger fast" hela vägen.
      const droneCameraArgs = {
        paceZoom,
        tilt: droneTiltRef.current,
        distance: droneDistanceRef.current,
        sideAngle: droneSideAngleRef.current,
        rotationMode: droneRotationModeRef.current,
        fixedHeadingDeg: startBearing
      };
      const droneStartCamera = droneCameraFromPoint({
        ...droneCameraArgs,
        point: startVertex,
        travelBearingDeg: startBearing
      });
      const droneEndCamera = droneCameraFromPoint({
        ...droneCameraArgs,
        point: endVertex,
        travelBearingDeg: endBearing
      });

      if (camMode === 'follow' || camMode === 'drone') {
        setPhase('overview');
        mp.fitBounds(bbox, OVERVIEW_PADDING);
        if (!(await sleep(OVERVIEW_HOLD_MS, cancelledRef))) return;

        setPhase('flyToStart');
        const introCamera = camMode === 'follow' ? startCamera : droneStartCamera;
        if (!(await animateCamera(mp, overviewCamera, introCamera, FLY_TO_START_MS, cancelledRef))) return;
      } else if (camMode === 'overview') {
        // Ramar in hela rutten en gång och rör sig sedan inte alls.
        mp.fitBounds(bbox, OVERVIEW_PADDING);
      }
      // camMode === 'fixed': rör inte kameran alls — den vy användaren själv
      // panorerat/zoomat till innan Play ligger kvar oförändrad.

      setPhase('countdown');
      for (const step of COUNTDOWN_STEPS) {
        if (cancelledRef.current) return;
        setCountdown(step);
        if (!(await sleep(COUNTDOWN_STEP_MS, cancelledRef))) return;
      }
      setCountdown(null);

      setPhase('playing');
      if (!(await runPlayback(mp, camMode))) return;

      setPhase('holdEnd');
      if (camMode === 'follow') {
        mp.moveCamera(endCamera);
      } else if (camMode === 'drone') {
        mp.moveCamera(droneEndCamera);
      }
      applyBookendOpacity(mp, pinsModeRef.current, 1);
      if (!(await sleep(HOLD_END_MS, cancelledRef))) return;

      if (camMode === 'follow' || camMode === 'drone') {
        setPhase('returnToOverview');
        const outroFrom = camMode === 'follow' ? endCamera : droneEndCamera;
        if (!(await animateCamera(mp, outroFrom, overviewCamera, RETURN_TO_OVERVIEW_MS, cancelledRef))) return;
        mp.fitBounds(bbox, OVERVIEW_PADDING);
      }

      mp.setGestureHandling('greedy');
      setPhase('done');
    },
    [mapProvider, runPlayback]
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setCountdown(null);
    mapProvider?.setGestureHandling('greedy');
    // I fast kameraläge har användaren själv komponerat vyn innan Play —
    // ett avbrott ska inte slänga bort den och hoppa till en översikt.
    if (bboxRef.current && mapProvider && camModeRef.current !== 'fixed') {
      mapProvider.fitBounds(bboxRef.current, OVERVIEW_PADDING);
    }
    setPhase(timelineRef.current ? 'ready' : 'idle');
  }, [mapProvider]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const isPresenting = !['idle', 'ready', 'done'].includes(phase);

  return { phase, countdown, isPresenting, play, reset };
}

export default useRouteAnimation;
