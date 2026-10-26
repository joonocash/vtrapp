// Pinnbollen — banor som byggs av sig själva, till oändligt läge. Ingen DOM.
//
// En bana är två till fyra motiv (spiraler, ringar, galler, vågor, figurer,
// halfpipes, ramper, snurrande hjul …) utplacerade i övre, mellersta och
// nedre delen av planen, oftast speglade så att banan blir symmetrisk som i
// Peggle. Tomma ytor fylls med strödda pinnar. Sedan städas banan som de
// handgjorda (inga krockar, orange bara där kulan når) och kollas: tillräckligt
// många pinnar, inget framför kanonen. Samma frö ger alltid samma bana.
//
// Svårigheten växer med banans nummer i rundan: fler orange, fler rörliga
// delar och mer tegel.

import { P, ring, ellips, linje, gitter, spiralJamn, sinus, tegelBage, tegelLinje, spegla, iGrupp, byggObjekt, ytavstand } from './former.js'
import { VARLDAR } from './banor.js'
import { W } from './motor.js'
import { mulberry32 } from '../delat/rng.js'

const rad = (g) => (g * Math.PI) / 180

// pinnar jämnt längs en sluten eller öppen kurva f(k), k = 0..1
function kurva(fn, avst, slutet = true) {
  const pts = []
  const N = 600
  let [px, py] = fn(0)
  pts.push(P(px, py))
  let kvar = 0
  for (let i = 1; i <= N; i++) {
    const [x, y] = fn(i / N)
    kvar += Math.hypot(x - px, y - py)
    ;[px, py] = [x, y]
    if (kvar >= avst && (!slutet || i < N - 2)) {
      kvar = 0
      pts.push(P(x, y))
    }
  }
  return pts
}

const hjarta = (cx, cy, s) => (k) => {
  const t = k * Math.PI * 2
  return [cx + s * 16 * Math.sin(t) ** 3, cy - s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]
}
const stjarna = (cx, cy, R, r, n = 5) => (k) => {
  // rakt mellan spetsarna
  const seg = n * 2
  const f = k * seg
  const i = Math.min(seg - 1, Math.floor(f))
  const u = f - i
  const p = (j) => {
    const a = -Math.PI / 2 + (j / seg) * Math.PI * 2
    const rr = j % 2 ? r : R
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]
  }
  const [x0, y0] = p(i)
  const [x1, y1] = p(i + 1)
  return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u]
}
const romb = (cx, cy, rx, ry) => (k) => {
  const t = k * 4
  const i = Math.min(3, Math.floor(t))
  const u = t - i
  const pts = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry]]
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]
}

/* ------------------------------------------------------------------ motiv */

// Varje motiv får en ruta { x0, x1, y0, y1 } och slumpen, och lämnar objekt
// (och ev. en rörelsegrupp). namn används till banans namn.
const MOTIV = {
  spiral: { namn: 'Snäckan', bredd: 'hel', min: 150, f(b, r) {
    const R = Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2 - 6
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    return spiralJamn(cx, cy, R, 14 + r() * 10, 1.3 + r() * 0.9, 21 + r() * 4, r() * 360)
  } },
  ring: { namn: 'Ringen', min: 70, f(b, r) {
    const R = Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2 - 4
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const ut = ring(cx, cy, R, Math.max(6, Math.round((R * Math.PI * 2) / 24)))
    if (R > 44) ut.push(...ring(cx, cy, R * 0.45, Math.max(5, Math.round((R * 0.45 * Math.PI * 2) / 24))))
    else ut.push(P(cx, cy))
    return ut
  } },
  galler: { namn: 'Gallret', f(b, r) {
    const dx = 32 + r() * 8
    const dy = 30 + r() * 6
    const kol = Math.max(2, Math.floor((b.x1 - b.x0) / dx))
    const rader = Math.max(2, Math.floor((b.y1 - b.y0) / dy))
    return gitter(b.x0 + ((b.x1 - b.x0) - (kol - 1) * dx) / 2, b.y0 + 8, kol, rader, dx, dy)
  } },
  vag: { namn: 'Vågen', bredd: 'hel', f(b, r) {
    const ut = []
    const rader = 1 + Math.floor(r() * 2.5)
    const amp = 14 + r() * 16
    for (let i = 0; i < rader; i++) {
      const y = b.y0 + amp + 6 + i * ((b.y1 - b.y0 - 2 * amp) / Math.max(1, rader))
      ut.push(...sinus(b.x0, b.x1, y, amp, 1 + Math.floor(r() * 2) * 0.5, Math.round((b.x1 - b.x0) / 27), i * Math.PI))
    }
    return ut
  } },
  hjarta: { namn: 'Hjärtat', min: 100, f(b) {
    const s = Math.min(b.x1 - b.x0, (b.y1 - b.y0) * 1.1) / 36
    return kurva(hjarta((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2 - s, s), 22)
  } },
  stjarna: { namn: 'Stjärnan', min: 100, f(b, r) {
    const R = Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2 - 2
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    return [...kurva(stjarna(cx, cy, R, R * (0.42 + r() * 0.1)), 22), P(cx, cy)]
  } },
  romb: { namn: 'Diamanten', min: 90, f(b) {
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const rx = (b.x1 - b.x0) / 2 - 4
    const ry = (b.y1 - b.y0) / 2 - 4
    return [...kurva(romb(cx, cy, rx, ry), 23), ...kurva(romb(cx, cy, rx * 0.45, ry * 0.45), 23)]
  } },
  bage: { namn: 'Bågen', f(b, r) {
    // en båge av pinnar, uppåt eller nedåt
    const cx = (b.x0 + b.x1) / 2
    const R = (b.x1 - b.x0) / 2 - 4
    const upp = r() < 0.5
    const cy = upp ? b.y1 : b.y0
    const n = Math.round((R * Math.PI) / 25)
    const ut = upp ? ring(cx, cy, R, n, 195, 345) : ring(cx, cy, Math.min(R, b.y1 - b.y0 - 4), n, 15, 165)
    if (r() < 0.6) ut.push(...(upp ? ring(cx, cy, R * 0.6, Math.max(3, Math.round(n * 0.6)), 200, 340) : ring(cx, cy, Math.min(R, b.y1 - b.y0 - 4) * 0.6, Math.max(3, Math.round(n * 0.6)), 20, 160)))
    return ut
  } },
  halfpipe: { namn: 'Halfpipen', tegel: true, bredd: 'hel', f(b, r) {
    const cx = (b.x0 + b.x1) / 2
    const R = Math.min((b.x1 - b.x0) / 2 - 6, b.y1 - b.y0 - 6)
    const cy = b.y1 - R
    return [...tegelBage(cx, cy, R, 14, 166, Math.round(R / 7)), ...ring(cx, cy, R * 0.68, Math.max(5, Math.round(R / 11)), 25, 155), ...(r() < 0.5 ? [P(cx, cy + R * 0.25)] : [])]
  } },
  ramp: { namn: 'Rampen', tegel: true, f(b, r) {
    // en tegelramp och en rad pinnar ovanför
    const ner = r() < 0.5
    const [y0, y1] = ner ? [b.y0 + 10, b.y1 - 10] : [b.y1 - 10, b.y0 + 10]
    const n = Math.round(Math.hypot(b.x1 - b.x0, y1 - y0) / 24)
    return [...tegelLinje(b.x0 + 4, y0, b.x1 - 4, y1, n), ...linje(b.x0 + 14, y0 - 32, b.x1 - 14, y1 - 32, Math.max(2, n - 2))]
  } },
  pelare: { namn: 'Pelarna', f(b, r) {
    const ut = []
    const n = 2 + Math.floor(r() * 2)
    for (let i = 0; i < n; i++) {
      const x = b.x0 + ((i + 0.5) * (b.x1 - b.x0)) / n
      ut.push(...linje(x, b.y0 + 6, x, b.y1 - 6, Math.max(2, Math.round((b.y1 - b.y0) / 26))))
    }
    return ut
  } },
  blomma: { namn: 'Blomman', min: 120, f(b, r) {
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const R = Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2 - 22
    const n = 5 + Math.floor(r() * 2)
    const ut = [P(cx, cy)]
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      ut.push(...ring(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 18, 5, 0, 360))
    }
    return ut
  } },
  ellips: { namn: 'Ägget', f(b, r) {
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const rx = (b.x1 - b.x0) / 2 - 4
    const ry = (b.y1 - b.y0) / 2 - 4
    return [...ellips(cx, cy, rx, ry, Math.round((Math.PI * (rx + ry)) / 24), r() * 20 - 10), ...ellips(cx, cy, rx * 0.5, ry * 0.5, Math.max(5, Math.round((Math.PI * (rx + ry)) / 48)))]
  } },
}

// Rörliga motiv: { objekt, grupp }
const RORLIG = {
  hjul: { namn: 'Hjulet', f(b, r) {
    const R = Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2 - 4
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const ut = ring(cx, cy, R, Math.max(8, Math.round((R * Math.PI * 2) / 23)))
    return { objekt: ut, grupp: { typ: 'rotera', cx, cy, w: (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.35) }, mitt: [P(cx, cy)] }
  } },
  ekrar: { namn: 'Eldhjulet', f(b, r) {
    const R = Math.min(b.x1 - b.x0, b.y1 - b.y0) / 2 - 4
    const cx = (b.x0 + b.x1) / 2
    const cy = (b.y0 + b.y1) / 2
    const n = 3 + Math.floor(r() * 2)
    const ut = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      ut.push(...linje(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26, cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.max(2, Math.round((R - 26) / 24) + 1)))
    }
    return { objekt: ut, grupp: { typ: 'rotera', cx, cy, w: (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.4) }, mitt: ring(cx, cy, 11, 3) }
  } },
  band: { namn: 'Bandet', f(b, r) {
    const y = (b.y0 + b.y1) / 2
    const ax = 30 + r() * 25
    const ut = linje(b.x0 + ax, y, b.x1 - ax, y, Math.max(3, Math.round((b.x1 - b.x0 - 2 * ax) / 26)))
    return { objekt: ut, grupp: { typ: 'glid', ax, ay: 0, T: 3.5 + r() * 2, fas: r() * 6 } }
  } },
  pendel: { namn: 'Pendeln', f(b, r) {
    const cx = (b.x0 + b.x1) / 2
    const L = b.y1 - b.y0 - 30
    const ut = [...linje(cx, b.y0 + 20, cx, b.y0 + 20 + L * 0.7, 4), ...ring(cx, b.y0 + 20 + L, Math.min(26, L * 0.3), 7)]
    return { objekt: ut, grupp: { typ: 'pendel', cx, cy: b.y0 - 10, A: 0.4 + r() * 0.25, T: 2.8 + r() * 1.2 } }
  } },
}

const ADJ = ['Snurriga', 'Glada', 'Galna', 'Lyckliga', 'Vilda', 'Gyllene', 'Hemliga', 'Studsiga', 'Lurviga', 'Blanka', 'Sömniga', 'Busiga', 'Modiga', 'Pigga', 'Kluriga', 'Tokiga']

/* ------------------------------------------------------------------ bygget */

const plocka = (r, lista) => lista[Math.floor(r() * lista.length)]
const ZONER = [
  [100, 200],
  [200, 420],
  [420, 545],
]

function forsok(fro, niva) {
  const r = mulberry32(fro >>> 0)
  const varld = (niva - 1) % VARLDAR.length
  const spegel = r() < 0.85
  const rorligChans = niva < 3 ? 0 : niva < 6 ? 0.35 : 0.55
  const tegelChans = niva < 2 ? 0.15 : 0.35
  const objekt = []
  const grupper = []
  const namn = []

  // varje zon: ett motiv över hela bredden, eller ett i varje halva (speglat)
  const delar = []
  for (const [zi, [y0, y1]] of ZONER.entries()) {
    const hog = y1 - y0
    if (zi === 1 && r() < rorligChans) {
      const m = plocka(r, Object.values(RORLIG))
      const rr = Math.min(130, hog / 2)
      const b = { x0: 180 - rr, x1: 180 + rr, y0: (y0 + y1) / 2 - rr, y1: (y0 + y1) / 2 + rr }
      const { objekt: o, grupp, mitt } = m.f(b, r)
      grupper.push(grupp)
      objekt.push(...iGrupp(grupper.length - 1, o), ...(mitt || []))
      namn.push([m.namn, o.length])
      continue
    }
    const halv = spegel && r() < 0.6
    const b = halv ? { x0: 20, x1: 178, y0, y1 } : { x0: 22, x1: W - 22, y0, y1 }
    const storlek = Math.min(b.x1 - b.x0, b.y1 - b.y0)
    const val = Object.values(MOTIV).filter((m) => (!halv || m.bredd !== 'hel') && (m.min || 0) <= storlek && (m.tegel ? r() < tegelChans * 2 : true))
    const m = plocka(r, val)
    delar.push({ m, b, spegla: halv })
  }
  for (const d of delar) {
    const o = d.m.f(d.b, r)
    objekt.push(...o, ...(d.spegla ? spegla(o) : []))
    namn.push([d.m.namn, o.length * (d.spegla ? 2 : 1)])
  }
  // ibland en rörlig rad eller pendel högst upp eller längst ner
  if (r() < rorligChans * 0.6) {
    const m = r() < 0.5 ? RORLIG.band : RORLIG.pendel
    const [y0, y1] = r() < 0.5 ? [104, 170] : [470, 540]
    const { objekt: o, grupp } = m.f({ x0: 30, x1: W - 30, y0, y1 }, r)
    grupper.push(grupp)
    objekt.push(...iGrupp(grupper.length - 1, o))
  }
  // fyll tomma ytor med strödda pinnar (speglade om banan är det)
  const fyll = []
  const fritt = (x, y) => [...objekt, ...fyll].every((o) => ytavstand(o, x, y) > (o.grupp != null ? 40 : 26))
  for (let i = 0; i < 400 && objekt.length + fyll.length * (spegel ? 2 : 1) < 88; i++) {
    const x = 24 + r() * (spegel ? 150 : W - 48)
    const y = 104 + r() * 436
    if (fritt(x, y) && (!spegel || fritt(W - x, y))) fyll.push(P(x, y))
  }
  objekt.push(...fyll, ...(spegel ? spegla(fyll) : []))

  // fler orange för varje bana upp till 25 (som i Peggle), och i oändligt
  // läge sedan en till varannan bana (högst 40), eftersom man blir starkare
  const orange = Math.min(40, 12 + Math.floor(niva * 1.3), 25 + Math.max(0, Math.floor((niva - 10) / 2)))
  const { objekt: ut, orange: antal, kandidater } = byggObjekt(objekt, { orange })
  // banan heter efter sitt största motiv
  const huvud = namn.reduce((a, c) => (c[1] > a[1] ? c : a), ['Banan', 0])[0]
  const titel = `${plocka(r, ADJ)} ${huvud.toLowerCase()}`
  return { bana: { namn: titel[0].toUpperCase() + titel.slice(1), varld, kraft: VARLDAR[varld].kraft, objekt: ut, grupper, orange: Math.min(antal, kandidater), gen: { fro, niva } }, kandidater }
}

// Är banan bra nog? Lagom många saker, tillräckligt många som kan bli
// orange, inget mitt framför kanonen.
function godkand({ bana, kandidater }) {
  const n = bana.objekt.length
  if (n < 55 || n > 150) return false
  if (kandidater < Math.max(18, bana.orange + 6)) return false
  for (const o of bana.objekt) {
    const y = o.form === 'cirkel' ? o.y : o.form === 'segment' ? Math.min(o.y1, o.y2) : o.cy - o.R
    if (y < 92 && Math.abs((o.x ?? o.cx ?? o.x1) - 180) < 70) return false
  }
  return true
}

export function genereraBana(fro, { niva = 1 } = {}) {
  for (let i = 0; i < 30; i++) {
    const f = forsok((fro + i * 7919) >>> 0, niva)
    if (godkand(f)) return f.bana
  }
  // nödutgång: ett enkelt galler
  const { objekt, orange } = byggObjekt(gitter(40, 140, 8, 11, 40, 36), { orange: 15 })
  const varld = (niva - 1) % VARLDAR.length
  return { namn: 'Reservbanan', varld, kraft: VARLDAR[varld].kraft, objekt, grupper: [], orange, gen: { fro, niva } }
}
