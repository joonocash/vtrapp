// Pinnbollen — baneditorns logik. Ingen DOM.
//
// En egen bana sparas som det man ritat: drag (prickar, streck, stämplar)
// plus värld och spegling. Motorn gör om det till en riktig bana: streck
// blir jämnt utspridda pinnar eller tegel — raka om strecket är nästan rakt,
// en båge om det liknar en cirkelbåge, annars en mjuk kurva — och sedan
// städas banan som alla andra (inga krockar, orange bara där kulan når).
//
// Datan är liten och går att dela som en länk (koda/avkoda).

import { P, ring, linje, gitter, spiralJamn, tegelBage, tegelLinje, spegla, iGrupp, byggObjekt } from './former.js'
import { VARLDAR } from './banor.js'
import { W, H } from './motor.js'

export const TOM = { v: 1, namn: '', varld: 0, spegel: true, drag: [] }

export const STAMPLAR = {
  ring: { namn: 'Ring', ikon: '⭕' },
  spiral: { namn: 'Spiral', ikon: '🌀' },
  halfpipe: { namn: 'Halfpipe', ikon: '◡' },
  galler: { namn: 'Galler', ikon: '⁘' },
  hjul: { namn: 'Snurrhjul', ikon: '🎡' },
  bana: { namn: 'Glidrad', ikon: '↔' },
}

export const MIN_OBJEKT = 12
const AVST_PINNE = 24
const AVST_TEGEL = 26

/* ------------------------------------------------------------- strecken */

const avstand = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

function langd(pts) {
  let L = 0
  for (let i = 1; i < pts.length; i++) L += avstand(pts[i - 1], pts[i])
  return L
}

// Jämnar ut ett darrigt streck (glidande medelvärde).
function utjamna(pts, f = 2) {
  if (pts.length < 5) return pts
  return pts.map((_, i) => {
    let sx = 0
    let sy = 0
    let n = 0
    for (let j = Math.max(0, i - f); j <= Math.min(pts.length - 1, i + f); j++) {
      sx += pts[j][0]
      sy += pts[j][1]
      n++
    }
    return i === 0 || i === pts.length - 1 ? pts[i] : [sx / n, sy / n]
  })
}

// Punkter med jämnt avstånd längs strecket.
export function jamna(pts, avst) {
  if (pts.length < 2) return pts.slice()
  const ut = [pts[0]]
  let kvar = avst
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1]
    const [bx, by] = pts[i]
    let d = Math.hypot(bx - ax, by - ay)
    while (d >= kvar) {
      const k = kvar / d
      ax += (bx - ax) * k
      ay += (by - ay) * k
      ut.push([ax, ay])
      d = Math.hypot(bx - ax, by - ay)
      kvar = avst
    }
    kvar -= d
  }
  return ut
}

function rakhet(pts) {
  const a = pts[0]
  const b = pts[pts.length - 1]
  const L = avstand(a, b) || 1
  let max = 0
  for (const p of pts) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / L
    max = Math.max(max, d)
  }
  return max / L
}

// Cirkel genom tre punkter.
function cirkel(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
  if (Math.abs(d) < 1e-6) return null
  const a2 = a[0] ** 2 + a[1] ** 2
  const b2 = b[0] ** 2 + b[1] ** 2
  const c2 = c[0] ** 2 + c[1] ** 2
  const cx = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d
  const cy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d
  return { cx, cy, R: Math.hypot(a[0] - cx, a[1] - cy) }
}

// Liknar strecket en cirkelbåge? Returnerar { cx, cy, R, a0, a1 } i grader
// (a0 < a1, medurs på skärmen) eller null.
function bage(pts) {
  const c = cirkel(pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1])
  if (!c || c.R > 420 || c.R < 18) return null
  let max = 0
  for (const p of pts) max = Math.max(max, Math.abs(Math.hypot(p[0] - c.cx, p[1] - c.cy) - c.R))
  if (max > Math.max(5, c.R * 0.09)) return null
  // vinklarna längs strecket, utan hopp
  const v = pts.map((p) => (Math.atan2(p[1] - c.cy, p[0] - c.cx) * 180) / Math.PI)
  for (let i = 1; i < v.length; i++) {
    while (v[i] - v[i - 1] > 180) v[i] -= 360
    while (v[i] - v[i - 1] < -180) v[i] += 360
  }
  const a0 = Math.min(v[0], v[v.length - 1])
  const a1 = Math.max(v[0], v[v.length - 1])
  if (a1 - a0 < 20 || a1 - a0 > 350) return null
  return { ...c, a0, a1 }
}

// Ett ritat drag → objekt i banan.
export function dragTillObjekt(d) {
  if (d.t === 'p') return [P(d.x, d.y)]
  if (d.t === 's') return stampel(d)
  if (d.t !== 'l' || d.pts.length < 2) return []
  const pts = utjamna(d.pts)
  const L = langd(pts)
  const tegel = d.k === 'tegel'
  if (L < 10) return tegel ? [] : [P(pts[0][0], pts[0][1])]
  const avst = tegel ? AVST_TEGEL : AVST_PINNE
  const [a, b] = [pts[0], pts[pts.length - 1]]
  if (rakhet(pts) < 0.07) {
    const n = Math.max(1, Math.round(avstand(a, b) / avst))
    return tegel ? tegelLinje(a[0], a[1], b[0], b[1], n) : linje(a[0], a[1], b[0], b[1], n + 1)
  }
  const c = bage(pts)
  if (c) {
    const n = Math.max(1, Math.round((((c.a1 - c.a0) * Math.PI) / 180) * c.R / avst))
    return tegel ? tegelBage(c.cx, c.cy, c.R, c.a0, c.a1, n) : ring(c.cx, c.cy, c.R, n + 1, c.a0, c.a1)
  }
  const j = jamna(pts, tegel ? 30 : avst)
  if (avstand(j[j.length - 1], b) > avst * 0.5) j.push(b)
  if (!tegel) return j.map(([x, y]) => P(x, y))
  const ut = []
  for (let i = 1; i < j.length; i++) ut.push(...tegelLinje(j[i - 1][0], j[i - 1][1], j[i][0], j[i][1], 1))
  return ut
}

function stampel(d) {
  const { x, y } = d
  switch (d.form) {
    case 'ring':
      return [...ring(x, y, 36, 9), P(x, y)]
    case 'spiral':
      return spiralJamn(x, y, 74, 16, 1.6, 23, -90)
    case 'halfpipe':
      return [...tegelBage(x, y - 60, 84, 14, 166, 12), ...ring(x, y - 60, 56, 7, 25, 155)]
    case 'galler':
      return gitter(x - 66, y - 34, 5, 3, 33, 34)
    case 'hjul':
      return { rorlig: { typ: 'rotera', cx: x, cy: y, w: 0.6 }, objekt: ring(x, y, 46, 12), mitt: [P(x, y)] }
    case 'bana':
      return { rorlig: { typ: 'glid', ax: 40, ay: 0, T: 4 }, objekt: linje(x - 70, y, x + 70, y, 6) }
    default:
      return []
  }
}

/* ------------------------------------------------------------- banan */

// Ritningen → en bana som motorn kan spela.
export function byggEgen(data) {
  const objekt = []
  const grupper = []
  const vanlig = (lista) => {
    objekt.push(...lista)
    if (data.spegel) objekt.push(...spegla(lista).filter((o, i) => Math.abs(mittX(lista[i]) - W / 2) > 8))
  }
  for (const d of data.drag || []) {
    const o = dragTillObjekt(d)
    if (Array.isArray(o)) vanlig(o)
    else {
      grupper.push(o.rorlig)
      objekt.push(...iGrupp(grupper.length - 1, o.objekt))
      if (o.mitt) vanlig(o.mitt)
      if (data.spegel && Math.abs(d.x - W / 2) > 30) {
        const g = o.rorlig.typ === 'rotera' ? { ...o.rorlig, cx: W - o.rorlig.cx, w: -o.rorlig.w } : { ...o.rorlig, fas: Math.PI }
        grupper.push(g)
        objekt.push(...iGrupp(grupper.length - 1, spegla(o.objekt)))
      }
    }
  }
  // bara det som ryms på planen (pinnar städas också bort ovanför 92 och under 548)
  const inne = objekt.filter((o) => {
    const [x, y] = [mittX(o), mittY(o)]
    return x > -20 && x < W + 20 && y > 70 && y < H - 30
  })
  const n = inne.length
  const varld = Math.max(0, Math.min(VARLDAR.length - 1, data.varld || 0))
  const { objekt: ut, orange, kandidater } = byggObjekt(inne, { orange: Math.max(3, Math.min(25, Math.round(n * 0.25))), min: 3 })
  return {
    namn: data.namn || 'Min bana',
    varld,
    kraft: VARLDAR[varld].kraft,
    objekt: ut,
    grupper,
    orange: Math.min(orange, kandidater),
    egen: true,
  }
}

const mittX = (o) => (o.form === 'cirkel' ? o.x : o.form === 'segment' ? (o.x1 + o.x2) / 2 : o.cx + Math.cos((o.a0 + o.a1) / 2) * o.R)
const mittY = (o) => (o.form === 'cirkel' ? o.y : o.form === 'segment' ? (o.y1 + o.y2) / 2 : o.cy + Math.sin((o.a0 + o.a1) / 2) * o.R)

// Går banan att spela? Returnerar null eller en förklaring.
export function kanSpelas(bana) {
  if (bana.objekt.length < MIN_OBJEKT) return `Rita minst ${MIN_OBJEKT} pinnar eller tegel (nu ${bana.objekt.length})`
  if (bana.orange < 3) return 'Kulan måste kunna nå fler pinnar'
  return null
}

// Vilket drag ligger närmast punkten (för suddet)? Index eller -1.
export function dragVid(data, x, y, max = 22) {
  let bast = -1
  let bd = max
  ;(data.drag || []).forEach((d, i) => {
    const o = dragTillObjekt(d)
    const lista = Array.isArray(o) ? o : [...o.objekt, ...(o.mitt || [])]
    const alla = data.spegel ? [...lista, ...spegla(lista)] : lista
    for (const q of alla) {
      const dd = Math.hypot(mittX(q) - x, mittY(q) - y)
      if (dd < bd) {
        bd = dd
        bast = i
      }
    }
  })
  return bast
}

/* ------------------------------------------------------------- dela */

// Kompakt text med heltal. Editorn sparar redan strecken glesade (var 6:e
// pixel), så koda → avkoda ger exakt samma ritning.
export function koda(data) {
  const drag = (data.drag || []).map((d) => {
    if (d.t === 'p') return ['p', Math.round(d.x), Math.round(d.y)]
    if (d.t === 's') return ['s', d.form, Math.round(d.x), Math.round(d.y)]
    const glesa = d.pts.length > 300 ? jamna(d.pts, 6) : d.pts
    const pts = glesa.flatMap(([x, y]) => [Math.round(x), Math.round(y)])
    return ['l', d.k === 'tegel' ? 1 : 0, ...pts]
  })
  const json = JSON.stringify([1, (data.namn || '').slice(0, 28), data.varld || 0, data.spegel ? 1 : 0, drag])
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function avkoda(txt) {
  try {
    const b64 = String(txt).replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4))))
    const [v, namn, varld, spegel, drag] = JSON.parse(json)
    if (v !== 1 || !Array.isArray(drag)) return null
    const ut = []
    for (const d of drag.slice(0, 400)) {
      if (d[0] === 'p') ut.push({ t: 'p', x: +d[1], y: +d[2] })
      else if (d[0] === 's' && STAMPLAR[d[1]]) ut.push({ t: 's', form: d[1], x: +d[2], y: +d[3] })
      else if (d[0] === 'l') {
        const pts = []
        for (let i = 2; i + 1 < d.length; i += 2) pts.push([+d[i], +d[i + 1]])
        if (pts.length >= 2) ut.push({ t: 'l', k: d[1] ? 'tegel' : 'pinne', pts })
      }
    }
    if (ut.some((d) => [d.x, d.y, ...(d.pts || []).flat()].some((n) => n != null && !Number.isFinite(n)))) return null
    return { v: 1, namn: String(namn || '').slice(0, 28), varld: Math.max(0, Math.min(VARLDAR.length - 1, +varld || 0)), spegel: Boolean(spegel), drag: ut }
  } catch {
    return null
  }
}
