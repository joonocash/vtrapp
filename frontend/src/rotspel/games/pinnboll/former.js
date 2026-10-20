// Pinnbollen — former att bygga banor av, och städningen som gör dem
// spelbara. Används av de handgjorda banorna (banor.js), generatorn till
// oändligt läge (generator.js), bonusbanorna (bonus.js) och baneditorn.
//
// Vinklar anges i grader med y nedåt: 90° är rakt ner, så en halfpipe (ett
// U) är bågen 0°–180°. Pinnar som hamnar för nära något annat tas bort
// automatiskt (se stada), så att kulan aldrig kilas fast mellan två saker.

import { PINNE_R, TEGEL_TJ, KULA_R, W } from './motor.js'

export const rad = (g) => (g * Math.PI) / 180

/* ------------------------------------------------------------- hjälpare */

export const P = (x, y, o = {}) => ({ typ: 'pinne', form: 'cirkel', x, y, r: PINNE_R, ...o })

// n pinnar längs en cirkelbåge (hela varvet om a1 - a0 = 360)
export function ring(cx, cy, R, n, a0 = 0, a1 = 360, o = {}) {
  const hel = Math.abs(a1 - a0) >= 360
  const ut = []
  for (let i = 0; i < n; i++) {
    const k = hel ? i / n : n === 1 ? 0.5 : i / (n - 1)
    const a = rad(a0 + (a1 - a0) * k)
    ut.push(P(cx + Math.cos(a) * R, cy + Math.sin(a) * R, o))
  }
  return ut
}

export function ellips(cx, cy, rx, ry, n, vrid = 0, o = {}) {
  const ut = []
  const c = Math.cos(rad(vrid))
  const s = Math.sin(rad(vrid))
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const x = Math.cos(a) * rx
    const y = Math.sin(a) * ry
    ut.push(P(cx + x * c - y * s, cy + x * s + y * c, o))
  }
  return ut
}

export function linje(x0, y0, x1, y1, n, o = {}) {
  const ut = []
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0.5 : i / (n - 1)
    ut.push(P(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, o))
  }
  return ut
}

export function gitter(x0, y0, kol, rader, dx, dy, sned = true, o = {}) {
  const ut = []
  for (let r = 0; r < rader; r++) {
    const forskj = sned && r % 2 ? dx / 2 : 0
    const k = sned && r % 2 ? kol - 1 : kol
    for (let c = 0; c < k; c++) ut.push(P(x0 + forskj + c * dx, y0 + r * dy, o))
  }
  return ut
}

export function spiral(cx, cy, r0, r1, varv, n, a0 = 0, o = {}) {
  const ut = []
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1)
    const a = rad(a0) + k * varv * Math.PI * 2
    const r = r0 + (r1 - r0) * k
    ut.push(P(cx + Math.cos(a) * r, cy + Math.sin(a) * r, o))
  }
  return ut
}

// Spiral med jämnt avstånd mellan pinnarna längs kurvan (spiral() ovan
// sprider dem jämnt i vinkel, så att de hamnar tätt nära mitten).
export function spiralJamn(cx, cy, r0, r1, varv, avst, a0 = 0, o = {}) {
  const ut = []
  const tot = varv * Math.PI * 2
  let kvar = 0
  let [px, py] = [cx + Math.cos(rad(a0)) * r0, cy + Math.sin(rad(a0)) * r0]
  ut.push(P(px, py, o))
  for (let i = 1; i <= 4000; i++) {
    const k = i / 4000
    const a = rad(a0) + k * tot
    const r = r0 + (r1 - r0) * k
    const [x, y] = [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
    kvar += Math.hypot(x - px, y - py)
    ;[px, py] = [x, y]
    if (kvar >= avst) {
      kvar = 0
      ut.push(P(x, y, o))
    }
  }
  return ut
}

export function sinus(x0, x1, y, amp, perioder, n, fas = 0, o = {}) {
  const ut = []
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1)
    ut.push(P(x0 + (x1 - x0) * k, y + Math.sin(fas + k * perioder * Math.PI * 2) * amp, o))
  }
  return ut
}

// n kurvade tegel längs en båge, med en liten springa mellan dem
export function tegelBage(cx, cy, R, a0, a1, n, o = {}) {
  const ut = []
  const steg = (a1 - a0) / n
  const springa = Math.min(1.6, Math.abs(steg) * 0.12)
  for (let i = 0; i < n; i++) {
    const b0 = a0 + steg * i + springa / 2
    const b1 = a0 + steg * (i + 1) - springa / 2
    ut.push({ typ: 'tegel', form: 'bage', cx, cy, R, a0: rad(Math.min(b0, b1)), a1: rad(Math.max(b0, b1)), tj: TEGEL_TJ, kedja: o.kedja, ...o })
  }
  return ut
}

// raka tegel längs en linje
export function tegelLinje(x0, y0, x1, y1, n, o = {}) {
  const ut = []
  const L = Math.hypot(x1 - x0, y1 - y0)
  const springa = Math.min(2.5, (L / n) * 0.12)
  for (let i = 0; i < n; i++) {
    const k0 = i / n + springa / L / 2
    const k1 = (i + 1) / n - springa / L / 2
    ut.push({ typ: 'tegel', form: 'segment', x1: x0 + (x1 - x0) * k0, y1: y0 + (y1 - y0) * k0, x2: x0 + (x1 - x0) * k1, y2: y0 + (y1 - y0) * k1, tj: TEGEL_TJ, ...o })
  }
  return ut
}

// spegla runt mittlinjen
export function spegla(lista) {
  return lista.map((o) => {
    if (o.form === 'cirkel') return { ...o, x: W - o.x }
    if (o.form === 'segment') return { ...o, x1: W - o.x1, x2: W - o.x2 }
    // båge: vinkeln a speglas till 180° - a
    return { ...o, cx: W - o.cx, a0: Math.PI - o.a1, a1: Math.PI - o.a0 }
  })
}
export const medSpegel = (lista) => [...lista, ...spegla(lista)]

// lägg objekten i en rörelsegrupp
export const iGrupp = (g, lista) => lista.map((o) => ({ ...o, grupp: g }))

/* ----------------------------------------------------- städning och mått */

export function geomAvst(a, b) {
  // ungefärligt avstånd mellan ytorna (räcker för att hitta krockar)
  const pa = provpunkter(a)
  const pb = provpunkter(b)
  let d = Infinity
  for (const [x1, y1, t1] of pa) for (const [x2, y2, t2] of pb) d = Math.min(d, Math.hypot(x1 - x2, y1 - y2) - t1 - t2)
  return d
}

export function provpunkter(o) {
  if (o.form === 'cirkel') return [[o.x, o.y, o.r]]
  if (o.form === 'segment') {
    const ut = []
    for (let k = 0; k <= 4; k++) ut.push([o.x1 + ((o.x2 - o.x1) * k) / 4, o.y1 + ((o.y2 - o.y1) * k) / 4, o.tj])
    return ut
  }
  const ut = []
  for (let k = 0; k <= 4; k++) {
    const a = o.a0 + ((o.a1 - o.a0) * k) / 4
    ut.push([o.cx + Math.cos(a) * o.R, o.cy + Math.sin(a) * o.R, o.tj])
  }
  return ut
}

// Tar bort pinnar som ligger för nära något (en springa smalare än kulan men
// större än noll kilar fast kulan). Tegel får ligga kant i kant med tegel.
export const MIN_SPRINGA = 2 * KULA_R + 2
export function stada(objekt) {
  const ut = []
  for (const o of objekt) {
    if (o.form === 'cirkel' && (o.x < 14 || o.x > W - 14 || o.y < 92 || o.y > 548)) continue
    let ok = true
    for (const p of ut) {
      if (p.grupp !== o.grupp && (p.grupp != null || o.grupp != null)) continue
      if (o.typ === 'tegel' && p.typ === 'tegel') continue
      const d = geomAvst(o, p)
      // Tätt är okej (kulan rullar över eller lägger sig i en svacka, och
      // då tar motorn bort pinnen den fastnat på) — men inte omlott.
      if (d < 3) {
        ok = false
        break
      }
    }
    if (ok) ut.push(o)
  }
  return ut
}

/* ------------------------------------------------------------- nåbarhet */

const TVAPI = Math.PI * 2
const normV = (v) => ((v % TVAPI) + TVAPI) % TVAPI

// Avstånd från en punkt till objektets yta (negativt inuti).
export function ytavstand(o, px, py) {
  if (o.form === 'cirkel') return Math.hypot(px - o.x, py - o.y) - o.r
  if (o.form === 'segment') {
    const vx = o.x2 - o.x1
    const vy = o.y2 - o.y1
    const L2 = vx * vx + vy * vy || 1
    let k = ((px - o.x1) * vx + (py - o.y1) * vy) / L2
    k = k < 0 ? 0 : k > 1 ? 1 : k
    return Math.hypot(px - o.x1 - vx * k, py - o.y1 - vy * k) - o.tj
  }
  const span = normV(o.a1 - o.a0) || TVAPI
  let v = normV(Math.atan2(py - o.cy, px - o.cx) - o.a0)
  if (v > span) v = v - span < TVAPI - v ? span : 0
  const a = o.a0 + v
  return Math.hypot(px - o.cx - Math.cos(a) * o.R, py - o.cy - Math.sin(a) * o.R) - o.tj
}

// Vilka objekt kulan kan nå direkt från början: en flodfyllning uppifrån
// genom alla punkter där kulan får plats. En pinne inne i en sluten ring
// (springorna smalare än kulan) går inte att träffa förrän ringen är borta —
// sådana får aldrig bli orange, så sista orange alltid går att sikta på.
// Rörliga objekt räknas som nåbara.
const RUTA = 2.5
export function ram(o) {
  if (o.form === 'cirkel') return [o.x - o.r, o.x + o.r, o.y - o.r, o.y + o.r]
  if (o.form === 'segment') return [Math.min(o.x1, o.x2) - o.tj, Math.max(o.x1, o.x2) + o.tj, Math.min(o.y1, o.y2) - o.tj, Math.max(o.y1, o.y2) + o.tj]
  const span = normV(o.a1 - o.a0) || TVAPI
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (let k = 0; k <= 12; k++) {
    const a = o.a0 + (span * k) / 12
    const x = o.cx + Math.cos(a) * o.R
    const y = o.cy + Math.sin(a) * o.R
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  const m = o.tj + o.R * (1 - Math.cos(span / 24))
  return [x0 - m, x1 + m, y0 - m, y1 + m]
}

export function nabara(objekt) {
  const kol = Math.floor(W / RUTA) + 1
  const rader = Math.floor(600 / RUTA) + 1
  const fri = new Uint8Array(kol * rader).fill(1)
  for (let i = 0; i < kol; i++) {
    const x = i * RUTA
    if (x < KULA_R || x > W - KULA_R) for (let j = 0; j < rader; j++) fri[j * kol + i] = 0
  }
  const ramar = objekt.map(ram)
  const omrade = (r, m) => [
    Math.max(0, Math.floor((r[0] - m) / RUTA)),
    Math.min(kol - 1, Math.ceil((r[1] + m) / RUTA)),
    Math.max(0, Math.floor((r[2] - m) / RUTA)),
    Math.min(rader - 1, Math.ceil((r[3] + m) / RUTA)),
  ]
  objekt.forEach((o, id) => {
    if (o.grupp != null) return
    const [i0, i1, j0, j1] = omrade(ramar[id], KULA_R + 1)
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * kol + i
        if (fri[k] && ytavstand(o, i * RUTA, j * RUTA) <= KULA_R) fri[k] = 0
      }
  })
  const nadd = new Uint8Array(kol * rader)
  const ko = []
  for (let j = 0; j * RUTA < 70; j++)
    for (let i = 0; i < kol; i++) {
      const k = j * kol + i
      if (fri[k]) {
        nadd[k] = 1
        ko.push(k)
      }
    }
  while (ko.length) {
    const k = ko.pop()
    const i = k % kol
    const j = (k - i) / kol
    if (i > 0 && fri[k - 1] && !nadd[k - 1]) (nadd[k - 1] = 1), ko.push(k - 1)
    if (i < kol - 1 && fri[k + 1] && !nadd[k + 1]) (nadd[k + 1] = 1), ko.push(k + 1)
    if (j > 0 && fri[k - kol] && !nadd[k - kol]) (nadd[k - kol] = 1), ko.push(k - kol)
    if (j < rader - 1 && fri[k + kol] && !nadd[k + kol]) (nadd[k + kol] = 1), ko.push(k + kol)
  }
  const ut = new Set()
  const grans = KULA_R + RUTA * 1.2
  objekt.forEach((o, id) => {
    if (o.grupp != null) {
      ut.add(id)
      return
    }
    const [i0, i1, j0, j1] = omrade(ramar[id], grans + 1)
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (nadd[j * kol + i] && ytavstand(o, i * RUTA, j * RUTA) <= grans) {
          ut.add(id)
          return
        }
      }
  })
  return ut
}


// pinnar utanför en cirkel (för att hålla en figur fri)
export const utanfor = (lista, cx, cy, r) => lista.filter((o) => Math.hypot(o.x - cx, o.y - cy) > r)

// Gör en bana av en lista objekt: städa bort krockar, markera det kulan inte
// når (får aldrig bli orange) och välj hur många som blir orange.
export function byggObjekt(objekt, { andel = 0.25, orange, min = 12 } = {}) {
  const st = stada(objekt)
  const nas = nabara(st)
  const ut = st.map((o, i) => (nas.has(i) ? o : { ...o, ejOrange: true }))
  const kand = ut.filter((o) => !o.ejOrange).length
  const antal = orange ?? Math.max(Math.min(min, kand), Math.min(25, Math.round(st.length * andel), kand))
  return { objekt: ut, orange: antal, kandidater: kand }
}
