// Formatering för WoW-fliken. Rena funktioner, testas i frontend/tests/wow-format.test.mjs.

export const WOWHEAD = 'https://www.wowhead.com/forever/item=';

export const HUS = { alliance: 'Alliance', horde: 'Horde', neutral: 'Blackwater' };

// Kvalitetsfärgerna från spelet, ljusade där originalet blir för mörkt mot bakgrunden.
export const KVALITET = {
  poor: '#9d9d9d',
  common: '#eceff6',
  uncommon: '#1eff00',
  rare: '#4aa3ff',
  epic: '#b96cf5',
  legendary: '#ff9d3a',
  artifact: '#e6cc80',
  heirloom: '#7fd8ff',
};

export const kvalitetsfarg = (q) => KVALITET[q] || KVALITET.common;

// 12345 koppar -> "1g 23s". Koppar visas bara under 1g, som i spelets egna listor.
export function pengar(koppar, { tecken = false } = {}) {
  if (koppar == null || Number.isNaN(Number(koppar))) return '–';
  let c = Math.round(Number(koppar));
  const minus = c < 0;
  c = Math.abs(c);
  const g = Math.floor(c / 10000);
  const s = Math.floor((c % 10000) / 100);
  const k = c % 100;
  const delar = [];
  if (g) delar.push(`${g}g`);
  if (s) delar.push(`${s}s`);
  if (k && !g) delar.push(`${k}c`);
  const text = delar.length ? delar.join(' ') : '0c';
  if (minus) return `−${text}`;
  return tecken && c > 0 ? `+${text}` : text;
}

// 12345 -> "12 345"
export function tal(n) {
  if (n == null || Number.isNaN(Number(n))) return '–';
  return String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// 1.75 -> "1 h 45 min"
export function timmar(h) {
  if (h == null || Number.isNaN(Number(h))) return '–';
  const min = Math.max(0, Math.round(Number(h) * 60));
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  if (hh && mm) return `${hh} h ${mm} min`;
  return hh ? `${hh} h` : `${mm} min`;
}

export function sedan(iso, nu = Date.now()) {
  if (!iso) return 'aldrig';
  const s = Math.round((nu - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'nyss';
  const m = Math.floor(s / 60);
  if (m < 90) return `${m} min sedan`;
  const h = Math.floor(m / 60);
  if (h < 36) return `${h} h sedan`;
  return `${Math.floor(h / 24)} dagar sedan`;
}

export function timmarSedan(iso, nu = Date.now()) {
  return iso ? Math.max(0, (nu - new Date(iso).getTime()) / 3600000) : null;
}

const MANADER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DAGAR = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];

// "2027-01-14" -> "14 jan"
export function datumKort(iso) {
  if (!iso) return '–';
  const [, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} ${MANADER[m - 1]}`;
}

// ISO-tid -> "sön 22 nov 19:02" i webbläsarens tidszon
export function lokalTid(iso) {
  if (!iso) return '–';
  const t = new Date(iso);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  return `${DAGAR[t.getDay()]} ${t.getDate()} ${MANADER[t.getMonth()]} ${hh}:${mm}`;
}

export function saljtakt(perDag) {
  if (perDag == null) return '';
  if (perDag < 1) return 'säljer sällan';
  return perDag >= 10 ? `~${Math.round(perDag)}/dag` : `~${perDag.toFixed(1).replace('.', ',')}/dag`;
}

// Värden -> SVG-punkter. Saknade värden (null) hoppas över. Lägre pris = längre ner.
export function sparkPunkter(varden, bredd, hojd, kant = 3) {
  const finns = (varden || []).map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (!finns.length) return { punkter: '', sista: null };
  const tal_ = finns.map(([, v]) => v);
  const min = Math.min(...tal_);
  const max = Math.max(...tal_);
  const steg = (varden.length - 1) || 1;
  const pkt = finns.map(([i, v]) => {
    const x = (i / steg) * (bredd - 2 * kant) + kant;
    const y = max === min ? hojd / 2 : kant + (1 - (v - min) / (max - min)) * (hojd - 2 * kant);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
  const [sx, sy] = pkt[pkt.length - 1];
  return { punkter: pkt.map((p) => p.join(',')).join(' '), sista: { x: sx, y: sy } };
}

// Flera serier [[tid, värde]] i samma graf med gemensam skala.
export function grafSkala(serier, bredd, hojd, kant = { v: 56, h: 12, o: 10, n: 24 }) {
  const alla = Object.values(serier).flat();
  if (!alla.length) return null;
  const tider = alla.map(([t]) => new Date(t).getTime());
  const varden = alla.map(([, v]) => v);
  const t0 = Math.min(...tider);
  const t1 = Math.max(...tider);
  let v0 = Math.min(...varden);
  let v1 = Math.max(...varden);
  if (v0 === v1) {
    v0 *= 0.9;
    v1 = v1 * 1.1 || 1;
  }
  const pad = (v1 - v0) * 0.08;
  v0 = Math.max(0, v0 - pad);
  v1 += pad;
  const x = (t) => kant.v + ((new Date(t).getTime() - t0) / ((t1 - t0) || 1)) * (bredd - kant.v - kant.h);
  const y = (v) => kant.o + (1 - (v - v0) / (v1 - v0)) * (hojd - kant.o - kant.n);
  const linjer = {};
  for (const [namn, pkt] of Object.entries(serier)) {
    linjer[namn] = pkt.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  }
  const rutnat = [0, 1, 2, 3].map((i) => {
    const v = v0 + ((v1 - v0) * i) / 3;
    return { y: y(v), v };
  });
  return { linjer, rutnat, x, y, t0, t1, vanster: kant.v, hoger: bredd - kant.h };
}

// Värmekartans färg: billigast = starkast blå. Skalan räknas på itemets egna rutor.
export function heatFarg(ratio, min, max) {
  if (ratio == null) return 'rgba(148,163,196,0.06)';
  const t = max === min ? 0.5 : (max - ratio) / (max - min);
  return `rgba(91,141,255,${(0.08 + t * 0.92).toFixed(2)})`;
}

// Flip: köp `antal` för `kop`/st, sälj för `salj`/st. AH tar `avgift` av försäljningen.
export function flip({ kop, salj, antal, avgift = 0.05 }) {
  const n = Math.max(1, Math.round(Number(antal) || 1));
  const intakt = (Number(salj) || 0) * n;
  const avg = Math.round(intakt * avgift);
  return { avgift: avg, vinst: intakt - avg - (Number(kop) || 0) * n, antal: n };
}

// Guld och silver från två fält -> koppar
export const kopparFran = (guld, silver) =>
  Math.round((Number(guld) || 0) * 10000 + (Number(silver) || 0) * 100);

// "1g 20s", "38s", "57c" eller bara ett tal (silver) -> koppar. null om det inte går att läsa.
export function parsePris(text) {
  const t = String(text ?? '').trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 100);
  const delar = [...t.matchAll(/(\d+(?:\.\d+)?)\s*([gsc])/g)];
  if (!delar.length || delar.map((d) => d[0]).join('').replace(/\s/g, '') !== t.replace(/\s/g, '')) return null;
  const varde = { g: 10000, s: 100, c: 1 };
  return Math.round(delar.reduce((sum, [, n, enhet]) => sum + Number(n) * varde[enhet], 0));
}

// Koppar -> text som går att skriva in igen i ett prisfält
export const prisText = (koppar) => (koppar == null ? '' : pengar(koppar).replace(/[−–]/g, ''));

// Kort pris för axlar: hela silver, eller hela tiotal silver över 1g. 63123 -> "6g 30s"
export function pengarAxel(koppar) {
  if (koppar == null) return '';
  const steg = koppar >= 10000 ? 1000 : koppar >= 100 ? 100 : 1;
  return pengar(Math.round(koppar / steg) * steg);
}
