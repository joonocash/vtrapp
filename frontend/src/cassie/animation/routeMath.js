// Ruttmatematik: sträcka/tid-tidslinje, sampling, bäring och EMA-glättning.
// Ingen fil här känner till Google eller ORS specifikt — indata är bara
// { lat, lng }-punkter och ORS-liknande steg-durationer.

const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

/** Haversine-avstånd i meter mellan två { lat, lng }-punkter. */
export function haversineDistance(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Bäring i grader (0–360, 0 = norr) från a till b. */
export function bearingBetween(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Bygger tidslinjen för en rutt: kumulativ sträcka och kumulativ tid per
 * vertex. Varje ORS-steg täcker ett intervall way_points: [a, b] med en
 * total duration — den durationen fördelas proportionellt mot avståndet
 * mellan vertexarna i intervallet, så att lastbilen faktiskt saktar ner på
 * småvägar och drar på på motorvägen i stället för att bara röra sig i takt
 * med rå sträcka.
 *
 * @param {{lat:number, lng:number}[]} vertices
 * @param {{duration:number, wayPoints:[number, number]}[]} steps
 */
export function buildRouteTimeline(vertices, steps) {
  const n = vertices.length;
  const cumulativeDistance = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    cumulativeDistance[i] = cumulativeDistance[i - 1] + haversineDistance(vertices[i - 1], vertices[i]);
  }

  const cumulativeTime = new Array(n).fill(0);

  const sortedSteps = [...steps].sort((s1, s2) => s1.wayPoints[0] - s2.wayPoints[0]);

  for (const step of sortedSteps) {
    const [a, b] = step.wayPoints;
    if (b <= a) continue;

    const startTime = cumulativeTime[a];
    const stepDistance = cumulativeDistance[b] - cumulativeDistance[a];

    if (stepDistance <= 0) {
      cumulativeTime[b] = startTime + step.duration;
      continue;
    }

    for (let i = a + 1; i <= b; i++) {
      const fraction = (cumulativeDistance[i] - cumulativeDistance[a]) / stepDistance;
      cumulativeTime[i] = startTime + fraction * step.duration;
    }
  }

  return {
    vertices,
    cumulativeDistance,
    cumulativeTime,
    totalDistance: cumulativeDistance[n - 1] || 0,
    totalTime: cumulativeTime[n - 1] || 0
  };
}

/** Binärsökning: index i så att cumulativeTime[i] <= t < cumulativeTime[i+1]. */
function findLowerIndex(cumulativeTime, t) {
  let lo = 0;
  let hi = cumulativeTime.length - 1;

  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumulativeTime[mid] <= t) lo = mid;
    else hi = mid - 1;
  }

  return lo;
}

/**
 * Interpolerad position och rå (osläta) bäring vid tidpunkt t (sekunder)
 * längs rutten.
 */
export function sampleRouteAtTime(timeline, t) {
  const { vertices, cumulativeTime, totalTime } = timeline;
  const n = vertices.length;

  if (n === 0) return null;
  if (n === 1) return { lat: vertices[0].lat, lng: vertices[0].lng, bearing: 0 };

  const clampedT = Math.max(0, Math.min(totalTime, t));
  const i = findLowerIndex(cumulativeTime, clampedT);
  const j = Math.min(i + 1, n - 1);

  const segmentDuration = cumulativeTime[j] - cumulativeTime[i];
  const frac = segmentDuration > 0 ? (clampedT - cumulativeTime[i]) / segmentDuration : 0;

  const a = vertices[i];
  const b = vertices[j];

  return {
    lat: a.lat + (b.lat - a.lat) * frac,
    lng: a.lng + (b.lng - a.lng) * frac,
    bearing: bearingBetween(a, b),
    segmentIndex: i
  };
}

/**
 * Exponentiellt glidande medelvärde på en cirkulär grad-vinkel (0–360).
 * Interpolerar via sin/cos i stället för graderna direkt, annars ger
 * 360°-wrappen ett hopp (t.ex. 359° -> 1°).
 */
export class BearingSmoother {
  constructor(alpha = 0.15) {
    this.alpha = alpha;
    this.sin = null;
    this.cos = null;
  }

  reset(bearingDeg) {
    const rad = toRad(bearingDeg);
    this.sin = Math.sin(rad);
    this.cos = Math.cos(rad);
    return bearingDeg;
  }

  next(bearingDeg) {
    const rad = toRad(bearingDeg);
    const targetSin = Math.sin(rad);
    const targetCos = Math.cos(rad);

    if (this.sin === null) {
      this.sin = targetSin;
      this.cos = targetCos;
    } else {
      this.sin += this.alpha * (targetSin - this.sin);
      this.cos += this.alpha * (targetCos - this.cos);
    }

    return (toDeg(Math.atan2(this.sin, this.cos)) + 360) % 360;
  }

  get current() {
    if (this.sin === null) return 0;
    return (toDeg(Math.atan2(this.sin, this.cos)) + 360) % 360;
  }
}

/** Kortaste vinkelskillnad (grader, -180..180) från a till b. */
function shortestAngleDelta(a, b) {
  let diff = (b - a) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Härleder banklutning (grader) ur bäringens ändringstakt (grader/sekund),
 * clampad till ±maxBankDeg. En egen EMA-glättning (samma alpha-idé som
 * bäringen) tas separat via BankSmoother nedan.
 */
export function bankAngleFromTurnRate(prevBearing, nextBearing, dtSeconds, maxBankDeg = 8, sensitivity = 0.35) {
  if (dtSeconds <= 0) return 0;
  const turnRate = shortestAngleDelta(prevBearing, nextBearing) / dtSeconds; // deg/s
  const raw = turnRate * sensitivity;
  return Math.max(-maxBankDeg, Math.min(maxBankDeg, raw));
}

/** EMA på en skalär (banklutning). Bank wrappar inte runt 360°, så en enkel EMA räcker. */
export class ScalarSmoother {
  constructor(alpha = 0.15) {
    this.alpha = alpha;
    this.value = null;
  }

  reset(value) {
    this.value = value;
    return value;
  }

  next(value) {
    if (this.value === null) this.value = value;
    else this.value += this.alpha * (value - this.value);
    return this.value;
  }
}

/**
 * Marknivå-upplösning (meter per skärmpixel) vid en given zoomnivå och
 * latitud, enligt standardformeln för Web Mercator. Delad mellan
 * useRouteAnimation.js (markörernas fade-tröskel) och TruckOverlay.js
 * (lastbilens skärmstorlek), så de två alltid resonerar i samma enhet.
 */
export function groundMetersPerPixel(zoom, lat) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** Bounding box (BBox) för en lista { lat, lng }-punkter. */
export function boundsOf(points) {
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;

  for (const p of points) {
    if (p.lat > north) north = p.lat;
    if (p.lat < south) south = p.lat;
    if (p.lng > east) east = p.lng;
    if (p.lng < west) west = p.lng;
  }

  return { north, south, east, west };
}

/**
 * Zoomnivå härledd ur tempo: hur många kilometer verklig väg som ska passera
 * på skärmen per sekund klipp. Högre km/s (lång rutt, kort klipp) => mer
 * utzoomat. Baserat på standardformeln för meter/pixel <-> zoom i Web
 * Mercator vid en given latitud.
 *
 * @param {number} totalDistanceMeters
 * @param {number} clipDurationSeconds
 * @param {number} lat
 */
export function computeZoomForPace(totalDistanceMeters, clipDurationSeconds, lat) {
  const kmPerSecond = totalDistanceMeters / 1000 / Math.max(1, clipDurationSeconds);

  // Empiriskt vald skala: hur många meter väg som ska synas per skärmpixel
  // vid ett givet tempo. Justera METERS_PER_PIXEL_PER_KMPS för att göra
  // ramningen tightare/lösare.
  const METERS_PER_PIXEL_PER_KMPS = 6;
  const BASE_METERS_PER_PIXEL = 1.2;
  const metersPerPixel = BASE_METERS_PER_PIXEL + kmPerSecond * METERS_PER_PIXEL_PER_KMPS;

  const zoom =
    Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / metersPerPixel);

  return Math.max(6, Math.min(19, zoom));
}

/**
 * Look-ahead-avstånd (meter) som skalar med aktuell hastighet — mer
 * framförhållning på motorväg, mindre i stadstrafik.
 */
export function lookAheadDistance(speedMetersPerSecond) {
  const MIN_LOOKAHEAD = 25;
  const MAX_LOOKAHEAD = 350;
  const SPEED_FACTOR = 6; // sekunder framåt att sikta mot
  return Math.max(MIN_LOOKAHEAD, Math.min(MAX_LOOKAHEAD, speedMetersPerSecond * SPEED_FACTOR));
}

/** Ungefärlig momentanhastighet (m/s) vid tid t, via liten central differens. */
export function speedAtTime(timeline, t, deltaSeconds = 1) {
  const t0 = Math.max(0, t - deltaSeconds);
  const t1 = Math.min(timeline.totalTime, t + deltaSeconds);
  if (t1 <= t0) return 0;

  const p0 = sampleRouteAtTime(timeline, t0);
  const p1 = sampleRouteAtTime(timeline, t1);
  if (!p0 || !p1) return 0;

  const dist = haversineDistance(p0, p1);
  return dist / (t1 - t0);
}

/**
 * Ungefärlig zoomnivå för att en bbox ska rymmas i en yta av given
 * pixelstorlek (klassisk Web Mercator "fit bounds"-formel). Används bara som
 * startpunkt för en mjuk kameraflygning — den exakta inramningen sätts sedan
 * med ett riktigt fitBounds-anrop.
 */
export function boundsZoom(bbox, mapWidthPx, mapHeightPx) {
  const WORLD_DIM = 256;
  const ZOOM_MAX = 21;

  const latRad = (lat) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
  };

  const zoomFor = (mapPx, fraction) => Math.log2(mapPx / WORLD_DIM / Math.max(fraction, 1e-9));

  const latFraction = (latRad(bbox.north) - latRad(bbox.south)) / Math.PI;
  const lngDiff = bbox.east - bbox.west;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const latZoom = zoomFor(mapHeightPx, latFraction);
  const lngZoom = zoomFor(mapWidthPx, lngFraction);

  return Math.max(2, Math.min(latZoom, lngZoom, ZOOM_MAX));
}

/**
 * Zoomjustering (zoom-nivåer, kan vara negativ) för drönarlägets
 * avståndsreglage — 0 = nära (något mer inzoomat än pace-zoomen), 100 = långt
 * bort (betydligt mer utzoomat). Lastbilens skärmstorlek påverkas inte av
 * detta, eftersom TruckOverlay räknar om sin skala varje bildruta från den
 * faktiska kamerazoomen — effekten blir precis "kameran drar sig längre bort
 * och lastbilen krymper inte" som en riktig drönare.
 */
export function droneDistanceZoomOffset(distance0to100) {
  const t = Math.max(0, Math.min(100, distance0to100)) / 100;
  const CLOSE_OFFSET = 1.4;
  const FAR_OFFSET = -3;
  return CLOSE_OFFSET + (FAR_OFFSET - CLOSE_OFFSET) * t;
}

/**
 * Trimmar en körd-sträcka-path till de senaste maxDistanceMeters (från
 * slutet), så att långa rutter inte blir ett spagettinät på kartan. Ger
 * tillbaka hela pathen om den redan är kortare.
 */
export function trimTrailingPath(path, maxDistanceMeters) {
  if (path.length < 2) return path;

  let acc = 0;
  let cutIndex = 0;

  for (let i = path.length - 1; i > 0; i--) {
    acc += haversineDistance(path[i - 1], path[i]);
    if (acc >= maxDistanceMeters) {
      cutIndex = i - 1;
      break;
    }
  }

  return cutIndex === 0 ? path : path.slice(cutIndex);
}
