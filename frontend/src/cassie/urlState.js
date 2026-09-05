// All konfiguration lever i query-parametrar så att en länk går att ladda om
// eller skicka vidare och landa exakt där man var.
//
// ?from=59.334,18.063&fromLabel=Stockholm&to=57.708,11.974&toLabel=G%C3%B6teborg
// &dur=25&pins=proximity&fmt=16x9&style=roadmap&scale=90&trail=full&cam=follow
// &cabSources=%23c9a0dc,%232e7d32&cabColor=%23ff0000&r=stockholm-goteborg

export const DEFAULTS = {
  from: null, // { lat, lng } | null
  to: null,
  fromLabel: '',
  toLabel: '',
  dur: 25,
  pins: 'proximity', // 'always' | 'hidden' | 'proximity'
  fmt: '16x9', // '16x9' | '9x16' | '1x1'
  style: 'roadmap', // 'roadmap' | 'satellite'
  // Lastbilens ungefärliga skärmstorlek i pixlar — måste matcha
  // DEFAULT_PIXEL_SIZE i animation/TruckOverlay.js.
  scale: 90,
  trail: 'full', // 'full' | 'fade' | 'none'
  cam: 'follow', // 'follow' | 'fixed' | 'overview' | 'drone'
  // Drönarläget: samma "följ lastbilen"-princip som follow, men med
  // reglerbar tilt/avstånd/sidovinkel, plus valet mellan att kompassen
  // följer lastbilens riktning eller ligger fast (skakfritt i sväng).
  droneTilt: 55, // 0 (rakt ovanifrån) .. 67.5 (Googles max)
  droneDistance: 50, // 0 (nära) .. 100 (långt bort) — se droneDistanceZoomOffset
  droneSideAngle: 0, // -90 .. 90, offset från "rakt bakom"
  droneRotationMode: 'track', // 'track' | 'fixed'
  // cabSources/boxSources: vilka UPPTÄCKTA originalfärger i modellens
  // palett användaren pekat ut som hytt/skåp — en roll kan äga flera
  // (grundfärg + skuggnyanser). cabColor/boxColor: vilken ERSÄTTNINGSfärg
  // gruppen ska bytas mot. Tomma listor/null = rör inget, modellens egna
  // färger visas tills användaren aktivt valt något.
  cabSources: [],
  cabColor: null,
  boxSources: [],
  boxColor: null,
  route: '' // slug för sparad rutt
};

function parseLatLng(value) {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return { lat: parts[0], lng: parts[1] };
}

function parseHexColor(value) {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

function parseHexList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^#[0-9a-fA-F]{6}$/.test(h));
}

function serializeHexList(list) {
  return (list || []).filter((h) => /^#[0-9a-fA-F]{6}$/.test(h)).join(',');
}

export function parseUrlState(search = window.location.search) {
  const params = new URLSearchParams(search);
  const dur = Number(params.get('dur'));
  const pins = params.get('pins');
  const fmt = params.get('fmt');
  const style = params.get('style');
  const scale = Number(params.get('scale'));
  const trail = params.get('trail');
  const cam = params.get('cam');
  const droneTilt = Number(params.get('drTilt'));
  const droneDistance = Number(params.get('drDist'));
  const droneSideAngle = Number(params.get('drSide'));
  const droneRotationMode = params.get('drRot');

  return {
    from: parseLatLng(params.get('from')) || DEFAULTS.from,
    to: parseLatLng(params.get('to')) || DEFAULTS.to,
    fromLabel: params.get('fromLabel') || DEFAULTS.fromLabel,
    toLabel: params.get('toLabel') || DEFAULTS.toLabel,
    dur: Number.isFinite(dur) && dur > 0 ? dur : DEFAULTS.dur,
    pins: ['always', 'hidden', 'proximity'].includes(pins) ? pins : DEFAULTS.pins,
    fmt: ['16x9', '9x16', '1x1'].includes(fmt) ? fmt : DEFAULTS.fmt,
    style: ['roadmap', 'satellite'].includes(style) ? style : DEFAULTS.style,
    scale: Number.isFinite(scale) && scale > 0 ? scale : DEFAULTS.scale,
    trail: ['full', 'fade', 'none'].includes(trail) ? trail : DEFAULTS.trail,
    cam: ['follow', 'fixed', 'overview', 'drone'].includes(cam) ? cam : DEFAULTS.cam,
    droneTilt: Number.isFinite(droneTilt) ? Math.max(0, Math.min(67.5, droneTilt)) : DEFAULTS.droneTilt,
    droneDistance: Number.isFinite(droneDistance)
      ? Math.max(0, Math.min(100, droneDistance))
      : DEFAULTS.droneDistance,
    droneSideAngle: Number.isFinite(droneSideAngle)
      ? Math.max(-90, Math.min(90, droneSideAngle))
      : DEFAULTS.droneSideAngle,
    droneRotationMode: ['track', 'fixed'].includes(droneRotationMode)
      ? droneRotationMode
      : DEFAULTS.droneRotationMode,
    cabSources: parseHexList(params.get('cabSources')),
    cabColor: parseHexColor(params.get('cabColor')) || DEFAULTS.cabColor,
    boxSources: parseHexList(params.get('boxSources')),
    boxColor: parseHexColor(params.get('boxColor')) || DEFAULTS.boxColor,
    route: params.get('r') || DEFAULTS.route
  };
}

/** Skriver state till URL:en med replaceState — fyller inte historiken. */
export function writeUrlState(state) {
  const params = new URLSearchParams();

  if (state.from) params.set('from', `${state.from.lat},${state.from.lng}`);
  if (state.to) params.set('to', `${state.to.lat},${state.to.lng}`);
  if (state.fromLabel) params.set('fromLabel', state.fromLabel);
  if (state.toLabel) params.set('toLabel', state.toLabel);
  params.set('dur', String(state.dur ?? DEFAULTS.dur));
  params.set('pins', state.pins || DEFAULTS.pins);
  params.set('fmt', state.fmt || DEFAULTS.fmt);
  params.set('style', state.style || DEFAULTS.style);
  params.set('scale', String(state.scale ?? DEFAULTS.scale));
  params.set('trail', state.trail || DEFAULTS.trail);
  params.set('cam', state.cam || DEFAULTS.cam);
  params.set('drTilt', String(state.droneTilt ?? DEFAULTS.droneTilt));
  params.set('drDist', String(state.droneDistance ?? DEFAULTS.droneDistance));
  params.set('drSide', String(state.droneSideAngle ?? DEFAULTS.droneSideAngle));
  params.set('drRot', state.droneRotationMode || DEFAULTS.droneRotationMode);
  const cabSourcesStr = serializeHexList(state.cabSources);
  if (cabSourcesStr) params.set('cabSources', cabSourcesStr);
  if (state.cabColor) params.set('cabColor', state.cabColor);
  const boxSourcesStr = serializeHexList(state.boxSources);
  if (boxSourcesStr) params.set('boxSources', boxSourcesStr);
  if (state.boxColor) params.set('boxColor', state.boxColor);
  if (state.route) params.set('r', state.route);

  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', url);
}
