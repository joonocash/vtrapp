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
const TAIL_TRIM_THRESHOLD_METERS = 200000;
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
 *   containerRef: { current: HTMLElement | null }
 * }} args
 */
export function useRouteAnimation({ mapProvider, ready, route, durationSeconds, pinsMode, truckSize }) {
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

  pinsModeRef.current = pinsMode;
  durationRef.current = durationSeconds;
  truckSizeRef.current = truckSize;

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

    // Placera lastbilen vid startpunkten direkt, innan uppspelning har
    // körts igång — annars finns det inget att visa storleksreglaget mot
    // medan man står still och ställer in det.
    overlay.setPixelSize(truckSizeRef.current);
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
      label: route.fromLabel || 'Start'
    });
    mapProvider.addMarker('end', {
      lat: endPoint.lat,
      lng: endPoint.lng,
      label: route.toLabel || 'Mål'
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

  const runPlayback = useCallback(
    (mp) =>
      new Promise((resolve) => {
        const timeline = timelineRef.current;
        const durationMs = Math.max(1, durationRef.current) * 1000;
        const paceZoom = computeZoomForPace(
          timeline.totalDistance,
          durationRef.current,
          (bboxRef.current.north + bboxRef.current.south) / 2
        );
        const playbackSpeedFactor = timeline.totalTime / Math.max(1, durationRef.current);

        const bearingSmoother = new BearingSmoother(0.15);
        const bankSmoother = new ScalarSmoother(0.2);
        const first = sampleRouteAtTime(timeline, 0);
        bearingSmoother.reset(first.bearing);
        bankSmoother.reset(0);

        drivenPathRef.current = [{ lat: first.lat, lng: first.lng }];
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

          drivenPathRef.current.push({ lat: sample.lat, lng: sample.lng });
          if (timeline.totalDistance > TAIL_TRIM_THRESHOLD_METERS) {
            drivenPathRef.current = trimTrailingPath(drivenPathRef.current, TAIL_TRIM_METERS);
          }
          mp.setPolylinePath('driven', drivenPathRef.current);

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

      setPhase('overview');
      mp.fitBounds(bbox, OVERVIEW_PADDING);
      if (!(await sleep(OVERVIEW_HOLD_MS, cancelledRef))) return;

      setPhase('flyToStart');
      if (!(await animateCamera(mp, overviewCamera, startCamera, FLY_TO_START_MS, cancelledRef))) return;

      setPhase('countdown');
      for (const step of COUNTDOWN_STEPS) {
        if (cancelledRef.current) return;
        setCountdown(step);
        if (!(await sleep(COUNTDOWN_STEP_MS, cancelledRef))) return;
      }
      setCountdown(null);

      setPhase('playing');
      if (!(await runPlayback(mp))) return;

      setPhase('holdEnd');
      mp.moveCamera(endCamera);
      applyBookendOpacity(mp, pinsModeRef.current, 1);
      if (!(await sleep(HOLD_END_MS, cancelledRef))) return;

      setPhase('returnToOverview');
      if (!(await animateCamera(mp, endCamera, overviewCamera, RETURN_TO_OVERVIEW_MS, cancelledRef))) return;
      mp.fitBounds(bbox, OVERVIEW_PADDING);

      mp.setGestureHandling('greedy');
      setPhase('done');
    },
    [mapProvider, runPlayback]
  );

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setCountdown(null);
    mapProvider?.setGestureHandling('greedy');
    if (bboxRef.current && mapProvider) {
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
