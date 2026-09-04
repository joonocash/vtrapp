// All konfiguration lever i query-parametrar så att en länk går att ladda om
// eller skicka vidare och landa exakt där man var.
//
// ?from=59.334,18.063&fromLabel=Stockholm&to=57.708,11.974&toLabel=G%C3%B6teborg
// &dur=25&pins=proximity&fmt=16x9&style=roadmap&r=stockholm-goteborg

export const DEFAULTS = {
  from: null, // { lat, lng } | null
  to: null,
  fromLabel: '',
  toLabel: '',
  dur: 25,
  pins: 'proximity', // 'always' | 'hidden' | 'proximity'
  fmt: '16x9', // '16x9' | '9x16' | '1x1'
  style: 'roadmap', // 'roadmap' | 'satellite'
  route: '' // slug för sparad rutt
};

function parseLatLng(value) {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return { lat: parts[0], lng: parts[1] };
}

export function parseUrlState(search = window.location.search) {
  const params = new URLSearchParams(search);
  const dur = Number(params.get('dur'));
  const pins = params.get('pins');
  const fmt = params.get('fmt');
  const style = params.get('style');

  return {
    from: parseLatLng(params.get('from')) || DEFAULTS.from,
    to: parseLatLng(params.get('to')) || DEFAULTS.to,
    fromLabel: params.get('fromLabel') || DEFAULTS.fromLabel,
    toLabel: params.get('toLabel') || DEFAULTS.toLabel,
    dur: Number.isFinite(dur) && dur > 0 ? dur : DEFAULTS.dur,
    pins: ['always', 'hidden', 'proximity'].includes(pins) ? pins : DEFAULTS.pins,
    fmt: ['16x9', '9x16', '1x1'].includes(fmt) ? fmt : DEFAULTS.fmt,
    style: ['roadmap', 'satellite'].includes(style) ? style : DEFAULTS.style,
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
  if (state.route) params.set('r', state.route);

  const url = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', url);
}
