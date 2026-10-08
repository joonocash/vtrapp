// Skruvat — regler och bangenerator. Ingen DOM.
//
// Som Screw Jam: genomskinliga plattor i flera lager hålls fast av färgade
// skruvar. Bara skruvar som inte har någon platta ovanpå sig går att skruva
// loss. En lossad skruv flyger till en låda med samma färg (tre hål per
// låda, två lådor framme åt gången) — annars till ett av reservhålen. När en
// låda är full åker den och nästa kommer, och reservskruvar i den färgen
// hoppar in direkt. Fulla reservhål = förlust. En platta utan skruvar
// faller bort och visar det som ligger under.
//
// Is (som i Screw Jam): en isad skruv går inte att lossa förrän ett visst
// antal andra skruvar har lossats. Siffran på isen räknar ner.
//
// Att ta bort en skruv blockerar aldrig något, så generatorn väljer först en
// ordning skruvarna kan lossas i och färgar dem sedan så att lådorna går
// ihop med lagom mycket i reservhålen. Varje bana har alltså en lösning.

import { slump, blanda, heltal, klamp, valj } from '../delat/rng.js'
import { svarighet } from '../delat/svarighet.js'

export const HAL_PER_LADA = 3
export const RESERV = 5
export const AKTIVA = 2
export const SKRUV_R = 11

export const FARGER = [
  { namn: 'röd', hex: '#ef4444' },
  { namn: 'blå', hex: '#3b82f6' },
  { namn: 'gul', hex: '#facc15' },
  { namn: 'grön', hex: '#22c55e' },
  { namn: 'lila', hex: '#a855f7' },
  { namn: 'orange', hex: '#fb923c' },
  { namn: 'rosa', hex: '#f472b6' },
  { namn: 'turkos', hex: '#22d3ee' },
  { namn: 'vit', hex: '#f1f5f9' },
]

// Rutnätet skruvarna sitter i (logiska pixlar på spelets canvas).
export const KOL = 8
export const RAD = 11
export const PX = (i) => 38 + i * 40.6
export const PY = (j) => 168 + j * 39.6
const PAD = 15

/* ----------------------------------------------------------------- geometri */

function plattaGeo(p) {
  if (p.typ === 'rund') return { cx: PX(p.i0), cy: PY(p.j0), r: 24 }
  return { x0: PX(p.i0) - PAD, y0: PY(p.j0) - PAD, x1: PX(p.i1) + PAD, y1: PY(p.j1) + PAD }
}

function tackerPunkt(g, x, y, r) {
  if (g.r != null) return Math.hypot(x - g.cx, y - g.cy) < g.r + r - 1
  const nx = Math.max(g.x0, Math.min(x, g.x1))
  const ny = Math.max(g.y0, Math.min(y, g.y1))
  return Math.hypot(x - nx, y - ny) < r - 1
}

function overlappar(a, b, marg = 3) {
  const ra = a.r != null ? { x0: a.cx - a.r, y0: a.cy - a.r, x1: a.cx + a.r, y1: a.cy + a.r } : a
  const rb = b.r != null ? { x0: b.cx - b.r, y0: b.cy - b.r, x1: b.cx + b.r, y1: b.cy + b.r } : b
  return ra.x0 < rb.x1 + marg && rb.x0 < ra.x1 + marg && ra.y0 < rb.y1 + marg && rb.y0 < ra.y1 + marg
}

function skruvPunkter(p) {
  if (p.typ === 'rund') return [[p.i0, p.j0]]
  if (p.typ === 'stav') {
    const ut = [[p.i0, p.j0], [p.i1, p.j1]]
    const len = Math.max(p.i1 - p.i0, p.j1 - p.j0)
    if (len >= 4) ut.splice(1, 0, [(p.i0 + p.i1) / 2, (p.j0 + p.j1) / 2])
    return ut
  }
  return [[p.i0, p.j0], [p.i1, p.j0], [p.i0, p.j1], [p.i1, p.j1]]
}

/* ------------------------------------------------------------------- spelet */

// Bana: { plattor: [{ typ, i0, j0, i1, j1, z, ton }], skruvar: [{ platta, i, j, f }], lador: [f...], reserv }
export function skapaSpel(bana) {
  const plattor = bana.plattor.map((p, id) => ({ ...p, id, geo: plattaGeo(p), skruvar: [], kvar: true }))
  const skruvar = bana.skruvar.map((s, id) => ({ ...s, id, x: PX(s.i), y: PY(s.j), kvar: true }))
  for (const s of skruvar) plattor[s.platta].skruvar.push(s.id)
  const lador = bana.lador.map((f, serie) => ({ f, serie, fyllda: 0 }))
  const aktiva = lador.slice(0, AKTIVA)
  while (aktiva.length < AKTIVA) aktiva.push(null)
  let nasta = AKTIVA
  const reserv = new Array(bana.reserv ?? RESERV).fill(null)
  let drag = 0

  function blockerad(id) {
    const s = skruvar[id]
    const z = plattor[s.platta].z
    for (const p of plattor) {
      if (!p.kvar || p.z <= z) continue
      if (tackerPunkt(p.geo, s.x, s.y, SKRUV_R)) return true
    }
    return false
  }
  const isad = (id) => skruvar[id].is > 0
  const kanLossa = (id) => skruvar[id] && skruvar[id].kvar && !blockerad(id) && !isad(id)

  function ladorna(handelser) {
    let andrat = true
    while (andrat) {
      andrat = false
      for (let slot = 0; slot < AKTIVA; slot++) {
        const l = aktiva[slot]
        if (!l || l.fyllda < HAL_PER_LADA) continue
        handelser.push({ typ: 'ladaKlar', slot, serie: l.serie, f: l.f })
        const ny = nasta < lador.length ? lador[nasta++] : null
        aktiva[slot] = ny
        if (ny) {
          handelser.push({ typ: 'nyLada', slot, serie: ny.serie, f: ny.f })
          for (let p = 0; p < reserv.length && ny.fyllda < HAL_PER_LADA; p++) {
            if (reserv[p] && reserv[p].f === ny.f) {
              handelser.push({ typ: 'flytt', plats: p, skruv: reserv[p].id, slot, serie: ny.serie, hal: ny.fyllda })
              reserv[p] = null
              ny.fyllda++
            }
          }
        }
        andrat = true
      }
    }
  }

  function tryck(id) {
    if (status() !== 'spelar') return null
    const s = skruvar[id]
    if (!s || !s.kvar) return null
    if (blockerad(id)) return { typ: 'last', id }
    if (isad(id)) return { typ: 'is', id, kvar: s.is }
    s.kvar = false
    drag++
    const handelser = []
    for (const k of skruvar) {
      if (!k.kvar || !(k.is > 0)) continue
      k.is--
      handelser.push({ typ: k.is === 0 ? 'tinat' : 'spricka', id: k.id, kvar: k.is })
    }
    let mal = null
    // helst den låda som har flest i sig redan, så den blir klar först
    let bastSlot = -1
    for (let slot = 0; slot < AKTIVA; slot++) {
      const l = aktiva[slot]
      if (l && l.f === s.f && l.fyllda < HAL_PER_LADA && (bastSlot < 0 || l.fyllda > aktiva[bastSlot].fyllda)) bastSlot = slot
    }
    if (bastSlot >= 0) {
      const l = aktiva[bastSlot]
      mal = { typ: 'lada', slot: bastSlot, serie: l.serie, hal: l.fyllda }
      l.fyllda++
    } else {
      const p = reserv.indexOf(null)
      mal = { typ: 'reserv', plats: p }
      reserv[p] = { id, f: s.f }
    }
    const platta = plattor[s.platta]
    let foll = null
    if (platta.skruvar.every((k) => !skruvar[k].kvar)) {
      platta.kvar = false
      foll = platta.id
    }
    ladorna(handelser)
    const st = status()
    return { typ: 'loss', id, f: s.f, mal, foll, handelser, vunnit: st === 'vunnit', forlorat: st === 'forlorat' }
  }

  function status() {
    if (aktiva.every((l) => l === null) && nasta >= lador.length) return 'vunnit'
    if (reserv.indexOf(null) === -1) return 'forlorat'
    return 'spelar'
  }

  // Booster: alla lossbara skruvar som passar en låda som står framme.
  function magnet(max = 9) {
    const ut = []
    for (let k = 0; k < max && status() === 'spelar'; k++) {
      let val = -1
      for (const s of skruvar) {
        if (!kanLossa(s.id)) continue
        if (aktiva.some((l) => l && l.f === s.f && l.fyllda < HAL_PER_LADA)) {
          val = s.id
          break
        }
      }
      if (val < 0) break
      ut.push(tryck(val))
    }
    return ut
  }

  return {
    plattor,
    skruvar,
    aktiva,
    reserv,
    lador,
    tryck,
    magnet,
    blockerad,
    isad,
    kanLossa,
    status,
    kvarSkruvar: () => skruvar.filter((s) => s.kvar).length,
    kvarLador: () => lador.length - nasta + aktiva.filter(Boolean).length,
    kommandeLador: () => lador.slice(nasta).map((l) => l.f),
    drag: () => drag,
    extraHal() {
      reserv.push(null)
    },
  }
}

/* --------------------------------------------------------------- generator */

export function parametrar(niva) {
  const svar = svarighet(niva)
  const lager = klamp(2 + Math.floor(niva / 7), 2, 7) + (svar === 'normal' ? 0 : 1)
  const mal = klamp(9 + niva * 2, 9, 66) + (svar === 'svår' ? 9 : svar === 'supersvår' ? 15 : 0)
  return {
    svar,
    lager: Math.min(8, lager),
    malSkruvar: Math.min(81, mal),
    farger: klamp(3 + Math.floor(niva / 6), 3, 9),
    fonster: niva <= 3 ? 1 : klamp(2 + Math.floor(niva / 6), 2, 10) + (svar === 'normal' ? 0 : 2),
    marginal: svar === 'normal' ? (niva < 30 ? 2 : 1) : svar === 'svår' ? 1 : 0,
    runda: niva >= 6,
    is: niva < 12 ? 0 : klamp(Math.floor((niva - 4) / 8), 1, 5),
  }
}

export function genereraBana(niva) {
  const p = parametrar(niva)
  for (let forsok = 0; forsok < 80; forsok++) {
    const r = slump('skruvat', niva, forsok)
    const bana = forsokBygga(niva, p, r, Math.max(1, p.fonster - Math.floor(forsok / 10)))
    if (bana) return bana
  }
  return forsokBygga(niva, { ...p, malSkruvar: 12, lager: 2 }, slump('skruvat-nod', niva), 1)
}

const TONER = ['#9ad8ff', '#c7b8ff', '#ffd9a0', '#b8f5d0', '#ffc2d6', '#e2e8f0']

function forsokBygga(niva, p, r, fonster) {
  const plattor = []
  const upptagna = new Set()
  let antal = 0
  const lagerMal = Math.ceil(p.malSkruvar / p.lager)

  for (let z = 0; z < p.lager && antal < p.malSkruvar; z++) {
    const iLager = []
    let lagt = 0
    for (let f = 0; f < 160 && lagt < lagerMal && antal < p.malSkruvar; f++) {
      const typ = p.runda && r() < 0.12 ? 'rund' : r() < (z > 0 ? 0.5 : 0.65) ? 'stav' : 'platta'
      let i0, j0, i1, j1
      if (typ === 'rund') {
        i0 = i1 = heltal(r, 0, KOL - 1)
        j0 = j1 = heltal(r, 0, RAD - 1)
      } else if (typ === 'stav') {
        const len = heltal(r, 1, 4)
        if (r() < 0.5) {
          i0 = heltal(r, 0, KOL - 1 - len)
          j0 = heltal(r, 0, RAD - 1)
          i1 = i0 + len
          j1 = j0
        } else {
          i0 = heltal(r, 0, KOL - 1)
          j0 = heltal(r, 0, RAD - 1 - len)
          i1 = i0
          j1 = j0 + len
        }
      } else {
        const a = heltal(r, 1, 2)
        const b = heltal(r, 1, 2)
        i0 = heltal(r, 0, KOL - 1 - a)
        j0 = heltal(r, 0, RAD - 1 - b)
        i1 = i0 + a
        j1 = j0 + b
      }
      const pl = { typ, i0, j0, i1, j1, z }
      const geo = plattaGeo(pl)
      if (iLager.some((q) => overlappar(q.geo, geo))) continue
      const punkter = skruvPunkter(pl)
      if (punkter.some(([i, j]) => upptagna.has(`${i},${j}`))) continue
      // Övre lager ska täcka skruvar under sig, annars blir lagren meningslösa.
      if (z > 0) {
        let tacker = 0
        for (const q of plattor) if (q.z < z) for (const [i, j] of q.punkter) if (tackerPunkt(geo, PX(i), PY(j), SKRUV_R)) tacker++
        if (tacker === 0 || (tacker === 1 && r() < 0.6)) continue
      }
      pl.geo = geo
      pl.punkter = punkter
      pl.ton = valj(r, TONER)
      for (const [i, j] of punkter) upptagna.add(`${i},${j}`)
      plattor.push(pl)
      iLager.push(pl)
      antal += punkter.length
      lagt += punkter.length
    }
  }
  // Delbart med tre: ta bort små plattor från översta lagret tills det går.
  for (let f = 0; antal % 3 !== 0 && f < 20; f++) {
    const kand = plattor.filter((q) => q.punkter.length === antal % 3 || q.punkter.length === (antal % 3) + 3)
    if (!kand.length) break
    const q = kand.reduce((a, b) => (b.z > a.z ? b : a))
    plattor.splice(plattor.indexOf(q), 1)
    antal -= q.punkter.length
  }
  if (antal % 3 !== 0 || antal < 6) return null

  const skruvar = []
  plattor.forEach((q, pid) => {
    for (const [i, j] of q.punkter) skruvar.push({ platta: pid, i, j, f: -1 })
  })
  // Is på några skruvar, gärna i de övre lagren så att man ser dem direkt.
  for (let k = 0; k < (p.is || 0); k++) {
    const kand = skruvar.filter((x) => !x.is && plattor[x.platta].z >= p.lager / 2 - 1)
    if (!kand.length) break
    valj(r, kand).is = heltal(r, 2, 4)
  }

  // En ordning skruvarna kan lossas i, färgfritt.
  const ordning = tankbarOrdning(plattor, skruvar, r)
  if (!ordning) return null

  const antalLador = antal / 3
  const farger = Math.min(p.farger, antalLador)
  const fargval = blanda(Array.from({ length: FARGER.length }, (_, i) => i), r).slice(0, farger)
  const lador = []
  while (lador.length < antalLador) lador.push(...blanda([...fargval], r))
  lador.length = antalLador
  const seq = lador
    .flatMap((f) => [f, f, f])
    .map((f, i) => [f, i + r() * fonster])
    .sort((a, b) => a[1] - b[1])
    .map(([f]) => f)
  ordning.forEach((sid, k) => {
    skruvar[sid].f = seq[k]
  })

  const bana = {
    niva,
    svar: p.svar,
    plattor: plattor.map(({ typ, i0, j0, i1, j1, z, ton }) => ({ typ, i0, j0, i1, j1, z, ton })),
    skruvar,
    lador,
    reserv: RESERV,
    // En lösning (skruvar att lossa i tur och ordning). Används av testerna.
    losning: ordning,
  }
  const max = reservBehov(seq, lador)
  if (max === null || max > RESERV - 1 - p.marginal) return null
  if (botKrav(niva, p.svar) && !girigBot(bana)) return null
  return bana
}

function botKrav(niva, svar) {
  if (svar === 'normal') return niva <= 80
  if (svar === 'svår') return niva <= 35
  return niva <= 20
}

function tankbarOrdning(plattor, skruvar, r) {
  const s = skapaSpel({ plattor, skruvar, lador: new Array(skruvar.length / 3).fill(0), reserv: 999 })
  // Alla skruvar har färg 0 och lådorna också, så allt går direkt i lådor.
  for (const k of s.skruvar) k.f = 0
  const ordning = []
  for (;;) {
    const kand = s.skruvar.filter((k) => s.kanLossa(k.id))
    if (!kand.length) break
    const val = kand[Math.floor(r() * kand.length)]
    s.tryck(val.id)
    ordning.push(val.id)
  }
  return ordning.length === skruvar.length ? ordning : null
}

// Största antalet i reservhålen om skruvarna lossas i färgordningen seq.
export function reservBehov(seq, lador) {
  const aktiva = lador.slice(0, AKTIVA).map((f) => ({ f, n: 0 }))
  let nasta = AKTIVA
  const reserv = []
  let max = 0
  for (const f of seq) {
    let slot = -1
    for (let k = 0; k < aktiva.length; k++) {
      const l = aktiva[k]
      if (l && l.f === f && l.n < 3 && (slot < 0 || l.n > aktiva[slot].n)) slot = k
    }
    if (slot >= 0) aktiva[slot].n++
    else reserv.push(f)
    max = Math.max(max, reserv.length)
    let andrat = true
    while (andrat) {
      andrat = false
      for (let k = 0; k < aktiva.length; k++) {
        if (!aktiva[k] || aktiva[k].n < 3) continue
        aktiva[k] = nasta < lador.length ? { f: lador[nasta++], n: 0 } : null
        if (aktiva[k]) {
          for (let i = 0; i < reserv.length && aktiva[k].n < 3; ) {
            if (reserv[i] === aktiva[k].f) {
              reserv.splice(i, 1)
              aktiva[k].n++
            } else i++
          }
        }
        andrat = true
      }
    }
  }
  return aktiva.every((l) => l === null) ? max : null
}

// Girig spelare: en skruv som passar en låda om det går (helst en som
// frigör många andra), annars den färg som behövs snarast — och aldrig så
// att reservhålen blir fulla.
export function girigBot(bana) {
  const s = skapaSpel(bana)
  for (let steg = 0; steg < 500; steg++) {
    const st = s.status()
    if (st !== 'spelar') return st === 'vunnit'
    const fria = s.reserv.filter((x) => x === null).length
    const kommande = [...s.aktiva.filter(Boolean).map((l) => l.f), ...s.kommandeLador()]
    let val = -1
    let bast = -Infinity
    for (const k of s.skruvar) {
      if (!s.kanLossa(k.id)) continue
      const passar = s.aktiva.some((l) => l && l.f === k.f && l.fyllda < 3)
      if (!passar && fria <= 1) continue
      // hur många blockerade skruvar på samma platta / under den här plattan?
      const p = s.plattor[k.platta]
      const sista = p.skruvar.filter((x) => s.skruvar[x].kvar).length === 1
      let frigor = 0
      if (sista) for (const o of s.skruvar) if (o.kvar && o.id !== k.id && s.blockerad(o.id) && tackerPunkt(p.geo, o.x, o.y, SKRUV_R)) frigor++
      const iRes = s.reserv.filter((x) => x && x.f === k.f).length
      const avst = kommande.indexOf(k.f)
      const poang = (passar ? 1000 : -50) + frigor * 15 + iRes * 20 - (avst < 0 ? 300 : avst * 4)
      if (poang > bast) {
        bast = poang
        val = k.id
      }
    }
    if (val < 0) return false
    s.tryck(val)
  }
  return false
}
