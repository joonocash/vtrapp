// Skruvat — regler och bangenerator. Ingen DOM.
//
// Som Screw Jam: plattor i flera lager hålls fast av färgade skruvar. Bara
// skruvar som inte har någon platta ovanpå sig går att skruva loss. En lossad
// skruv flyger till en låda med samma färg (tre hål per låda) — annars till
// ett av reservhålen. När en låda är full åker den och nästa i kön kommer
// fram, och reservskruvar i den färgen hoppar in direkt. Fulla reservhål =
// förlust. En platta utan skruvar faller bort och visar det som ligger under.
//
// Hinder (som i Screw Jam):
//   is      skruven går inte att lossa förrän N andra skruvar lossats
//   rep     två skruvar bundna ihop: lossar man en går båda
//   lås     låsta skruvar går inte att lossa förrän nyckelskruven är lossad
//   bomb    räknar ner för varje lossad skruv — är den kvar vid noll är det slut
//
// Tänkandet: generatorn bygger banan så att lådornas färger ofta ligger
// begravda. Man ser lådkön och måste välja vilken platta man gräver i — de
// skruvar man tar för att komma åt hamnar i reserven, så det gäller att gräva
// där färgerna som kommer snart sitter. Generatorn spelar själv igenom banan
// på ett sätt den vet fungerar (lösningen sparas), och slänger banor som en
// "rytmklickare" (tar alltid en skruv som passar lådan) klarar för ofta.

import { slump, blanda, heltal, klamp, valj } from '../delat/rng.js'
import { svarighet } from '../delat/svarighet.js'

export const HAL_PER_LADA = 3
export const RESERV = 5
export const AKTIVA = 2
export const SKRUV_R = 12

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
export const PY = (j) => 172 + j * 39.4
const PAD = 16

/* ----------------------------------------------------------------- geometri */

export function plattaGeo(p) {
  if (p.typ === 'rund') return { cx: PX(p.i0), cy: PY(p.j0), r: 25 }
  return { x0: PX(p.i0) - PAD, y0: PY(p.j0) - PAD, x1: PX(p.i1) + PAD, y1: PY(p.j1) + PAD }
}

export function tackerPunkt(g, x, y, r) {
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

// Bana: { plattor: [{ typ, i0, j0, i1, j1, z, ton }], skruvar: [{ platta, i, j, f, is?, rep?, nyckel?, last?, bomb? }],
//         lador: [f...], reserv, aktiva }
export function skapaSpel(bana) {
  const plattor = bana.plattor.map((p, id) => ({ ...p, id, geo: plattaGeo(p), skruvar: [], kvar: true }))
  const skruvar = bana.skruvar.map((s, id) => ({ ...s, id, x: PX(s.i), y: PY(s.j), kvar: true }))
  for (const s of skruvar) plattor[s.platta].skruvar.push(s.id)
  // lador kan växa under genereringen (generatorn färgar banan medan den spelar)
  const lador = Array.isArray(bana.lador) ? bana.lador.map((f, serie) => ({ f, serie, fyllda: 0 })) : []
  const antalAktiva = bana.aktiva ?? AKTIVA
  const aktiva = lador.slice(0, antalAktiva)
  while (aktiva.length < antalAktiva) aktiva.push(null)
  let nasta = antalAktiva
  const reserv = new Array(bana.reserv ?? RESERV).fill(null)
  let drag = 0
  let orsak = null // 'reserv' | 'bomb'
  let overfull = false

  function blockerad(id) {
    const s = skruvar[id]
    const z = plattor[s.platta].z
    for (const p of plattor) {
      if (!p.kvar || p.z <= z) continue
      if (tackerPunkt(p.geo, s.x, s.y, SKRUV_R)) return true
    }
    return false
  }
  const nyckelKvar = () => skruvar.some((k) => k.kvar && k.nyckel)
  const isad = (id) => skruvar[id].is > 0
  const lasad = (id) => skruvar[id].last && nyckelKvar()
  function kanLossaEn(id) {
    const s = skruvar[id]
    return s && s.kvar && !blockerad(id) && !isad(id) && !lasad(id)
  }
  // En bunden skruv går bara om partnern också går.
  function kanLossa(id) {
    if (!kanLossaEn(id)) return false
    const s = skruvar[id]
    if (s.rep != null && skruvar[s.rep].kvar && !kanLossaEn(s.rep)) return false
    return true
  }

  function ladorna(handelser) {
    let andrat = true
    while (andrat) {
      andrat = false
      for (let slot = 0; slot < aktiva.length; slot++) {
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

  // Lossar en skruv (utan kontroller) och returnerar vart den tog vägen.
  function lossa(id, handelser) {
    const s = skruvar[id]
    s.kvar = false
    let mal
    let bastSlot = -1
    for (let slot = 0; slot < aktiva.length; slot++) {
      const l = aktiva[slot]
      if (l && l.f === s.f && l.fyllda < HAL_PER_LADA && (bastSlot < 0 || l.fyllda > aktiva[bastSlot].fyllda)) bastSlot = slot
    }
    if (bastSlot >= 0) {
      const l = aktiva[bastSlot]
      mal = { typ: 'lada', slot: bastSlot, serie: l.serie, hal: l.fyllda }
      l.fyllda++
    } else {
      let p = reserv.indexOf(null)
      // Bara en bunden skruv kan komma hit med full reserv: den får ett
      // tillfälligt extrahål (och spelet är förlorat tills man köper ett hål).
      if (p < 0) {
        reserv.push(null)
        p = reserv.length - 1
        overfull = true
      }
      mal = { typ: 'reserv', plats: p }
      reserv[p] = { id, f: s.f }
    }
    const platta = plattor[s.platta]
    let foll = null
    if (platta.skruvar.every((k) => !skruvar[k].kvar)) {
      platta.kvar = false
      foll = platta.id
    }
    // is smälter och bomber räknar ner för varje lossad skruv
    for (const k of skruvar) {
      if (!k.kvar) continue
      if (k.is > 0) {
        k.is--
        handelser.push({ typ: k.is === 0 ? 'tinat' : 'spricka', id: k.id, kvar: k.is })
      }
      if (k.bomb > 0) {
        k.bomb--
        handelser.push({ typ: 'bomb', id: k.id, kvar: k.bomb })
        if (k.bomb === 0 && !orsak) orsak = 'bomb'
      }
    }
    if (s.nyckel) {
      const upp = skruvar.filter((k) => k.kvar && k.last).map((k) => k.id)
      if (upp.length) handelser.push({ typ: 'upplast', ids: upp })
    }
    return { id, f: s.f, mal, foll }
  }

  function tryck(id) {
    if (status() !== 'spelar') return null
    const s = skruvar[id]
    if (!s || !s.kvar) return null
    if (blockerad(id)) return { typ: 'last', id }
    if (isad(id)) return { typ: 'is', id, kvar: s.is }
    if (lasad(id)) return { typ: 'lasad', id }
    if (s.rep != null && skruvar[s.rep].kvar && !kanLossaEn(s.rep)) return { typ: 'rep', id, partner: s.rep }
    drag++
    const handelser = []
    const fore = new Set(skruvar.filter((k) => k.kvar && kanLossa(k.id)).map((k) => k.id))
    const losta = [lossa(id, handelser)]
    if (s.rep != null && skruvar[s.rep].kvar) losta.push(lossa(s.rep, handelser))
    // reserven kan ha blivit överfull av en bunden skruv — se status()
    ladorna(handelser)
    // skruvar som just blev fria (för "pop"-effekten)
    const nyaFria = skruvar.filter((k) => k.kvar && !fore.has(k.id) && kanLossa(k.id)).map((k) => k.id)
    const st = status()
    const forsta = losta[0]
    return { typ: 'loss', ...forsta, losta, nyaFria, handelser, vunnit: st === 'vunnit', forlorat: st === 'forlorat', orsak }
  }

  function status() {
    if (orsak === 'bomb') return 'forlorat'
    if (aktiva.every((l) => l === null) && nasta >= lador.length && skruvar.every((k) => !k.kvar)) return 'vunnit'
    if (reserv.indexOf(null) === -1 || overfull) {
      orsak = orsak || 'reserv'
      return 'forlorat'
    }
    return 'spelar'
  }

  // Booster: lossbara skruvar som passar en låda som står framme.
  function magnet(max = 9) {
    const ut = []
    for (let k = 0; k < max && status() === 'spelar'; k++) {
      let val = -1
      for (const s of skruvar) {
        if (!kanLossa(s.id) || s.rep != null || s.bomb > 0) continue
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
    lasad,
    kanLossa,
    status,
    orsak: () => orsak,
    kvarSkruvar: () => skruvar.filter((s) => s.kvar).length,
    kvarLador: () => lador.length - nasta + aktiva.filter(Boolean).length,
    kommandeLador: () => lador.slice(nasta).map((l) => l.f),
    drag: () => drag,
    extraHal() {
      if (overfull) overfull = false
      else reserv.push(null)
      if (orsak === 'reserv') orsak = null
    },
    // för generatorn: lägg till en låda sist i kön
    laggTillLada(f) {
      lador.push({ f, serie: lador.length, fyllda: 0 })
    },
    // Ögonblicksbild av allt som ändras, för "Ångra" och för botarna.
    spara() {
      return {
        sk: skruvar.map((k) => [k.kvar, k.is || 0, k.bomb || 0]),
        pl: plattor.map((p) => p.kvar),
        lad: lador.map((l) => l.fyllda),
        akt: aktiva.map((l) => (l ? l.serie : -1)),
        nasta,
        res: reserv.map((x) => (x ? [x.id, x.f] : null)),
        drag,
        orsak,
        overfull,
      }
    },
    ladda(st) {
      st.sk.forEach(([kv, is, bomb], i) => {
        const k = skruvar[i]
        k.kvar = kv
        if (k.is != null || is) k.is = is
        if (k.bomb != null || bomb) k.bomb = bomb
      })
      st.pl.forEach((kv, i) => (plattor[i].kvar = kv))
      st.lad.forEach((n, i) => (lador[i].fyllda = n))
      st.akt.forEach((serie, i) => (aktiva[i] = serie >= 0 ? lador[serie] : null))
      nasta = st.nasta
      reserv.length = 0
      for (const x of st.res) reserv.push(x ? { id: x[0], f: x[1] } : null)
      drag = st.drag
      orsak = st.orsak
      overfull = st.overfull
    },
  }
}

/* --------------------------------------------------------------- generator */

export function parametrar(niva) {
  const svar = svarighet(niva)
  const lager = klamp(3 + Math.floor(niva / 6), 3, 8) + (svar === 'normal' ? 0 : 1)
  const mal = klamp(12 + niva * 2, 12, 63) + (svar === 'svår' ? 9 : svar === 'supersvår' ? 15 : 0)
  // Hur ofta generatorns egen spelare gräver efter en begravd färg, och hur
  // ofta en fri skruv den tar ska passa lådan. Mer grävning = mer tänkande.
  const grav = niva <= 2 ? 0.1 : klamp(0.22 + niva * 0.008, 0.22, 0.6) + (svar === 'normal' ? 0 : 0.15)
  // Rytmklickarens tillåtna vinstchans: tak så att tänkande behövs, golv så
  // att vanliga banor inte blir knivseggar (sågtand: lätt, lätt, svår).
  const rytmTak = niva <= 3 ? 1 : niva <= 6 ? 0.75 : niva <= 12 ? 0.55 : niva <= 30 ? 0.4 : 0.3
  const rytmGolv = svar !== 'normal' ? 0 : niva <= 3 ? 0.5 : niva <= 12 ? 0.25 : niva <= 40 ? 0.1 : 0.05
  return {
    svar,
    lager: Math.min(9, lager),
    malSkruvar: Math.min(81, mal),
    farger: klamp(3 + Math.floor(niva / 5), 3, 9),
    aktiva: niva <= 2 ? 2 : 1 + (svar === 'normal' && niva % 3 === 0 ? 1 : 0),
    grav,
    // reservhål som generatorns lösning får använda (av fem)
    reservMax: svar === 'supersvår' ? 4 : svar === 'svår' ? 3 : niva < 25 ? 2 : 3,
    rytmTak: svar === 'normal' ? rytmTak : svar === 'svår' ? Math.min(rytmTak, 0.25) : Math.min(rytmTak, 0.15),
    rytmGolv,
    runda: niva >= 6,
    is: niva < 12 ? 0 : klamp(Math.floor((niva - 4) / 8), 1, 4),
    rep: niva < 8 ? 0 : klamp(1 + Math.floor((niva - 8) / 14), 1, 3),
    las: niva >= 16 && niva % 2 === 0,
    bomb: niva >= 22 && (niva % 3 === 1 || svar !== 'normal'),
  }
}

const cache = new Map()

// Banorna 1–200 genereras i förväg med smart: true (frontend/tests/
// skruvat-banor.gen.mjs) och ligger i banor.json. Högre banor görs i
// webbläsaren med den snabba kontrollen (bara rytmklickaren).
export function genereraBana(niva, { smart = false, forsok = smart ? 80 : 24 } = {}) {
  const nyckel = `${niva}:${smart}`
  if (cache.has(nyckel)) return cache.get(nyckel)
  const p = parametrar(niva)
  let bast = null
  let bastAvst = Infinity
  for (let f = 0; f < forsok; f++) {
    const r = slump('skruvat2', niva, f)
    const bana = forsokBygga(niva, p, r)
    if (!bana) continue
    const rytm = rytmChans(bana, smart ? 10 : 6, niva)
    // hur långt från [golv, tak] rytmchansen ligger
    const avst = rytm > p.rytmTak ? rytm - p.rytmTak : rytm < p.rytmGolv ? p.rytmGolv - rytm : 0
    if (avst > bastAvst) continue
    if (smart && !smartBot(bana)) continue
    bast = bana
    bastAvst = avst
    if (avst === 0) break
  }
  if (!bast) bast = forsokBygga(niva, { ...p, malSkruvar: 12, lager: 2, grav: 0, is: 0, rep: 0, las: false, bomb: false, reservMax: 4 }, slump('skruvat-nod', niva))
  cache.set(nyckel, bast)
  return bast
}

/* --------------------------------------------- kompakt form för banor.json */

const TYPER = ['platta', 'stav', 'rund']
const SVAR = ['normal', 'svår', 'supersvår']

export function koda(b) {
  return [
    SVAR.indexOf(b.svar),
    b.aktiva,
    b.plattor.map((q) => [TYPER.indexOf(q.typ), q.i0, q.j0, q.i1, q.j1, q.z, TONER.indexOf(q.ton)]),
    b.skruvar.map((k) => {
      const flaggor = (k.nyckel ? 1 : 0) | (k.last ? 2 : 0)
      const rad = [k.platta, k.i, k.j, k.f]
      if (k.is || k.rep != null || flaggor || k.bomb) rad.push(k.is || 0, k.rep ?? -1, flaggor, k.bomb || 0)
      return rad
    }),
    b.lador,
    b.losning,
  ]
}

export function avkoda(niva, d) {
  const [svar, aktiva, plattor, skruvar, lador, losning] = d
  return {
    niva,
    svar: SVAR[svar],
    aktiva,
    reserv: RESERV,
    plattor: plattor.map(([t, i0, j0, i1, j1, z, ton]) => ({ typ: TYPER[t], i0, j0, i1, j1, z, ton: TONER[ton] })),
    skruvar: skruvar.map(([platta, i, j, f, is = 0, rep = -1, flaggor = 0, bomb = 0]) => {
      const k = { platta, i, j, f }
      if (is) k.is = is
      if (rep >= 0) k.rep = rep
      if (flaggor & 1) k.nyckel = true
      if (flaggor & 2) k.last = true
      if (bomb) k.bomb = bomb
      return k
    }),
    lador,
    losning,
  }
}

const TONER = ['#8ec9ff', '#c4b2ff', '#ffd08a', '#a6f0c6', '#ffb3cc', '#d8dfec', '#ffe58a', '#9fe7e2']

function byggPlattor(p, r) {
  const plattor = []
  const upptagna = new Set()
  let antal = 0
  const lagerMal = Math.ceil(p.malSkruvar / p.lager)
  for (let z = 0; z < p.lager && antal < p.malSkruvar; z++) {
    const iLager = []
    let lagt = 0
    for (let f = 0; f < 200 && lagt < lagerMal && antal < p.malSkruvar; f++) {
      const typ = p.runda && r() < 0.1 ? 'rund' : r() < (z > 0 ? 0.55 : 0.6) ? 'stav' : 'platta'
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
      // Övre lager ska täcka minst två skruvar under sig — det är där grävandet kommer ifrån.
      if (z > 0) {
        let tacker = 0
        for (const q of plattor) if (q.z < z) for (const [i, j] of q.punkter) if (tackerPunkt(geo, PX(i), PY(j), SKRUV_R)) tacker++
        if (tacker < 2 && !(tacker === 1 && r() < 0.25)) continue
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
  for (let f = 0; antal % 3 !== 0 && f < 20; f++) {
    const kand = plattor.filter((q) => q.punkter.length === antal % 3 || q.punkter.length === (antal % 3) + 3)
    if (!kand.length) break
    const q = kand.reduce((a, b) => (b.z > a.z ? b : a))
    plattor.splice(plattor.indexOf(q), 1)
    antal -= q.punkter.length
  }
  if (antal % 3 !== 0 || antal < 6) return null
  return plattor
}

function forsokBygga(niva, p, r) {
  const plattor = byggPlattor(p, r)
  if (!plattor) return null
  const skruvar = []
  plattor.forEach((q, pid) => {
    for (const [i, j] of q.punkter) skruvar.push({ platta: pid, i, j, f: -1 })
  })
  // Is på några skruvar, gärna i de övre lagren så att man ser dem direkt.
  const maxZ = Math.max(...plattor.map((q) => q.z))
  for (let k = 0; k < (p.is || 0); k++) {
    const kand = skruvar.filter((x) => !x.is && plattor[x.platta].z >= maxZ / 2)
    if (!kand.length) break
    valj(r, kand).is = heltal(r, 2, 4)
  }
  const bas = plattor.map(({ typ, i0, j0, i1, j1, z, ton }) => ({ typ, i0, j0, i1, j1, z, ton }))

  // 1. En ordning skruvarna kan lossas i, som ofta gräver efter begravda skruvar.
  const plan = planera(bas, skruvar, r, p.grav)
  if (!plan) return null

  // 2. Färga skruvarna medan banan spelas i den ordningen, så att målen
  //    passar lådan som står framme och grävandet hamnar i reserven.
  const farg = fargaLangs(bas, skruvar, plan, p, r)
  if (!farg) return null
  for (let k = 0; k < skruvar.length; k++) skruvar[k].f = farg.f[k]

  const bana = { niva, svar: p.svar, plattor: bas, skruvar, lador: farg.lador, reserv: RESERV, aktiva: p.aktiva, losning: plan.ordning }

  // 3. Hinder som följer lösningen: rep, lås och nyckel, bomb.
  hinder(bana, p, r)

  // 4. Lösningen måste vinna med marginal på reserven.
  const kontroll = spelaOrdning(bana, bana.losning)
  if (!kontroll.vann || kontroll.maxReserv > p.reservMax) return null
  return bana
}

// Spelar en färdig bana i en given ordning (en skruv per steg; bundna skruvar
// tas i samma tryck, så partnern hoppas över). { vann, maxReserv }
export function spelaOrdning(bana, ordning) {
  const s = skapaSpel(bana)
  let max = 0
  for (const id of ordning) {
    if (!s.skruvar[id].kvar) continue
    const res = s.tryck(id)
    if (!res || res.typ !== 'loss') return { vann: false, maxReserv: max, fel: id, res }
    max = Math.max(max, s.reserv.filter(Boolean).length)
  }
  return { vann: s.status() === 'vunnit', maxReserv: max }
}

// Skruvar som måste bort innan id går att lossa, i en ordning som fungerar.
// null om det kräver något som inte går just nu (is, lås) eller är för dyrt.
function gravvag(s, id, max) {
  const ut = []
  const planerad = new Set()
  const fallna = new Set()
  function bort(x, djup) {
    if (planerad.has(x)) return true
    if (djup > 4 || ut.length > max) return false
    const k = s.skruvar[x]
    // plattor ovanför x som täcker den och inte redan faller
    for (const pl of s.plattor) {
      if (!pl.kvar || fallna.has(pl.id) || pl.z <= s.plattor[k.platta].z) continue
      if (!tackerPunkt(pl.geo, k.x, k.y, SKRUV_R)) continue
      for (const y of pl.skruvar) {
        if (!s.skruvar[y].kvar || planerad.has(y)) continue
        if (!bort(y, djup + 1)) return false
      }
      fallna.add(pl.id)
    }
    if (s.isad(x) && s.skruvar[x].is > ut.length) return false
    if (s.lasad(x) || s.skruvar[x].rep != null) return false
    planerad.add(x)
    ut.push(x)
    // plattan x sitter i faller om alla dess skruvar är planerade
    const egen = s.plattor[k.platta]
    if (egen.skruvar.every((y) => !s.skruvar[y].kvar || planerad.has(y))) fallna.add(egen.id)
    return true
  }
  return bort(id, 0) ? ut : null
}

// Ordningen: ibland en slumpad fri skruv, ibland en grävning efter en
// begravd skruv. Varje steg märks med vad det var (för färgningen).
function planera(plattor, skruvar, r, pGrav) {
  const s = skapaSpel({ plattor, skruvar: skruvar.map((k) => ({ ...k, f: 0 })), lador: new Array(skruvar.length / 3).fill(0), reserv: 999, aktiva: 1 })
  const ordning = []
  const typ = []
  let varv = 0
  while (ordning.length < skruvar.length && varv++ < 400) {
    const fria = s.skruvar.filter((k) => s.kanLossa(k.id))
    if (r() < pGrav) {
      const begravda = s.skruvar.filter((k) => k.kvar && s.blockerad(k.id))
      let bast = null
      for (const b of blanda([...begravda], r).slice(0, 12)) {
        const v = gravvag(s, b.id, 5)
        if (v && v.length >= 2 && (!bast || v.length < bast.length)) bast = v
      }
      if (bast) {
        for (let k = 0; k < bast.length; k++) {
          const id = bast[k]
          if (!s.kanLossa(id)) return null
          s.tryck(id)
          ordning.push(id)
          typ.push(k === bast.length - 1 ? 'mal' : 'grav')
        }
        continue
      }
    }
    if (!fria.length) return null
    const val = valj(r, fria)
    s.tryck(val.id)
    ordning.push(val.id)
    typ.push('fri')
  }
  return ordning.length === skruvar.length ? { ordning, typ } : null
}

// Färgar längs ordningen med en riktig spelmotor: målen och de flesta fria
// skruvarna får färgen på lådan som står framme, grävskruvarna får färgen på
// en låda som kommer snart (de väntar i reserven).
function fargaLangs(plattor, skruvar, plan, p, r) {
  const N = skruvar.length
  const antalLador = N / 3
  const fargval = blanda(Array.from({ length: FARGER.length }, (_, i) => i), r).slice(0, Math.min(p.farger, FARGER.length))
  let skapade = 0
  const nyFarg = (inte) => {
    const ok = fargval.filter((f) => !inte.includes(f))
    return ok.length ? valj(r, ok) : valj(r, fargval)
  }
  const forsta = []
  for (let k = 0; k < p.aktiva && skapade < antalLador; k++) {
    forsta.push(nyFarg(forsta))
    skapade++
  }
  const kopia = skruvar.map((k) => ({ ...k, f: -1 }))
  const s = skapaSpel({ plattor, skruvar: kopia, lador: forsta, reserv: RESERV, aktiva: p.aktiva })
  const f = new Array(N).fill(-1)
  // reserverat[serie] = hur många skruvar som redan väntar i reserven på den lådan
  const reserverat = new Map()
  const kofyll = () => {
    // håll kön minst två lådor före, så motorn alltid har något att dra fram
    while (skapade < antalLador && s.kommandeLador().length < 2) {
      const aktivaF = s.aktiva.filter(Boolean).map((l) => l.f)
      const sista = s.lador.length ? s.lador[s.lador.length - 1].f : -1
      s.laggTillLada(nyFarg([...aktivaF, sista]))
      skapade++
    }
  }
  kofyll()
  for (let k = 0; k < N; k++) {
    const id = plan.ordning[k]
    const avsikt = plan.typ[k]
    const aktivaMedPlats = s.aktiva.filter((l) => l && l.fyllda < HAL_PER_LADA)
    const iReserv = s.reserv.filter(Boolean).length
    let farg = -1
    const vilReserv = avsikt === 'grav' || (avsikt === 'fri' && r() < 0.25)
    if (vilReserv && iReserv < p.reservMax) {
      // en låda längre bak i kön som har plats och inte har samma färg som en aktiv
      const kommande = s.lador.slice(s.lador.length - s.kommandeLador().length)
      const aktivaF = aktivaMedPlats.map((l) => l.f)
      const kand = kommande.slice(0, 3).filter((l) => !aktivaF.includes(l.f) && (reserverat.get(l.serie) || 0) < HAL_PER_LADA)
      if (kand.length) {
        const l = kand[0]
        farg = l.f
        reserverat.set(l.serie, (reserverat.get(l.serie) || 0) + 1)
      }
    }
    if (farg < 0) {
      if (!aktivaMedPlats.length) return null
      // som spelet: lådan med flest i sig först
      const l = aktivaMedPlats.reduce((a, b) => (b.fyllda > a.fyllda ? b : a))
      // Har lådan redan sina tre (några väntar i reserven)? Då passar den inte.
      farg = l.f
    }
    s.skruvar[id].f = farg
    f[id] = farg
    const res = s.tryck(id)
    if (!res || res.typ !== 'loss') return null
    if (res.forlorat) return null
    kofyll()
  }
  if (s.status() !== 'vunnit') return null
  return { f, lador: s.lador.map((l) => l.f) }
}

function hinder(bana, p, r) {
  const ordning = bana.losning
  const sk = bana.skruvar
  const pos = new Map(ordning.map((id, k) => [id, k]))
  // Läget före steg k i lösningen, för att se vilka som är fria då.
  const lageFore = (k) => {
    const s = skapaSpel(bana)
    for (let i = 0; i < k; i++) if (s.skruvar[ordning[i]].kvar) s.tryck(ordning[i])
    return s
  }
  const upptagen = (id) => sk[id].rep != null || sk[id].nyckel || sk[id].last || sk[id].bomb || sk[id].is

  // Rep: två skruvar i rad i lösningen som båda är fria före den första.
  for (let n = 0, f = 0; n < p.rep && f < 60; f++) {
    const k = heltal(r, 2, ordning.length - 3)
    const a = ordning[k]
    const b = ordning[k + 1]
    if (upptagen(a) || upptagen(b)) continue
    // repet ska vara kort, annars ser det ut som en lina över hela brädet
    if (Math.hypot(PX(sk[a].i) - PX(sk[b].i), PY(sk[a].j) - PY(sk[b].j)) > 125) continue
    const s = lageFore(k)
    if (!s.kanLossa(a) || !s.kanLossa(b)) continue
    sk[a].rep = b
    sk[b].rep = a
    // kontrollera att lösningen fortfarande går (reserven får ta båda samtidigt)
    const kontroll = spelaOrdning(bana, ordning)
    if (!kontroll.vann || kontroll.maxReserv > p.reservMax) {
      delete sk[a].rep
      delete sk[b].rep
      continue
    }
    n++
  }

  // Lås: nyckeln ungefär en tredjedel in, två eller tre låsta efter den —
  // gärna sådana som är fria från start, så att man ser dem och får leta.
  if (p.las) {
    const s0 = skapaSpel(bana)
    for (let f = 0; f < 20; f++) {
      const k = heltal(r, Math.floor(ordning.length * 0.2), Math.floor(ordning.length * 0.45))
      const nyckel = ordning[k]
      if (upptagen(nyckel)) continue
      const efter = ordning.slice(k + 1).filter((id) => !upptagen(id))
      const fria = efter.filter((id) => s0.kanLossa(id))
      const valda = blanda([...(fria.length >= 2 ? fria : efter)], r).slice(0, heltal(r, 2, 3))
      if (valda.length < 2) continue
      sk[nyckel].nyckel = true
      for (const id of valda) sk[id].last = true
      break
    }
  }

  // Bomb: på en skruv som är begravd från start, med lite marginal.
  if (p.bomb) {
    const s0 = skapaSpel(bana)
    const kand = ordning.filter((id, k) => k >= 6 && k < ordning.length * 0.6 && !upptagen(id) && s0.skruvar[id] && s0.blockerad(id))
    if (kand.length) {
      const id = valj(r, kand)
      const slack = p.svar === 'normal' ? heltal(r, 4, 6) : heltal(r, 2, 4)
      sk[id].bomb = pos.get(id) + slack
    }
  }
}

/* ------------------------------------------------------------ spelarbotar */

// Rytmklickaren: tar en fri skruv som passar en låda om det finns, annars en
// slumpad fri skruv. Andelen vinster mäter hur lite banan kräver av tänkande.
export function rytmChans(bana, forsok = 6, fro = 1) {
  let vinster = 0
  for (let f = 0; f < forsok; f++) {
    let x = (fro * 7919 + f * 104729) >>> 0
    const rnd = () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296)
    const s = skapaSpel(bana)
    for (let drag = 0; drag < 400 && s.status() === 'spelar'; drag++) {
      const fria = s.skruvar.filter((k) => s.kanLossa(k.id))
      if (!fria.length) break
      const passar = fria.filter((k) => s.aktiva.some((l) => l && l.f === k.f && l.fyllda < HAL_PER_LADA))
      const lista = passar.length ? passar : fria
      s.tryck(lista[Math.floor(rnd() * lista.length)].id)
    }
    if (s.status() === 'vunnit') vinster++
  }
  return vinster / forsok
}

// En tänkande spelare: tittar på lådkön och ett drag framåt. Passar en
// skruv lådan tar den den (helst en som också släpper loss något). Annars
// gräver den där färgerna i kön sitter och tar helst skruvar vars färg
// kommer snart. Används av generatorn för att kolla att banorna går att
// klara utan facit — ungefär som en människa som tänker efter lite.
export function smartBot(bana, { bredd = 5 } = {}) {
  const s = skapaSpel(bana)
  for (let steg = 0; steg < 400 && s.status() === 'spelar'; steg++) {
    const id = valjSmart(s, bredd)
    if (id < 0) return false
    s.tryck(id)
  }
  return s.status() === 'vunnit'
}

function fria(s) {
  const ut = []
  for (const k of s.skruvar) if (s.kanLossa(k.id)) ut.push(k.id)
  return ut
}

function poangLage(s) {
  const st = s.status()
  if (st === 'vunnit') return 1e6
  if (st === 'forlorat') return -1e6
  const iReserv = s.reserv.filter(Boolean).length
  const fritt = s.reserv.length - iReserv
  const aktiva = s.aktiva.filter((l) => l && l.fyllda < HAL_PER_LADA)
  const ko = s.kommandeLador()
  let p = -s.kvarSkruvar() * 6 - iReserv * 14 - (fritt <= 1 ? 160 : 0)
  // reservskruvar vars låda ligger långt bort i kön är dyra
  for (const x of s.reserv) {
    if (!x) continue
    const i = ko.indexOf(x.f)
    if (!aktiva.some((l) => l.f === x.f)) p -= i < 0 ? 30 : i * 6
  }
  const behov = new Set(aktiva.map((l) => l.f))
  for (const id of fria(s)) {
    const f = s.skruvar[id].f
    if (behov.has(f)) p += 9
    else {
      const i = ko.indexOf(f)
      if (i >= 0 && i < 3) p += 4 / (1 + i)
    }
  }
  // Hur mycket måste bort för att nå en begravd skruv som lådan behöver?
  for (const f of behov) {
    let bast = 99
    for (const k of s.skruvar) {
      if (!k.kvar || k.f !== f || !s.blockerad(k.id)) continue
      let kostnad = 0
      for (const pl of s.plattor) {
        if (!pl.kvar || pl.z <= s.plattor[k.platta].z || !tackerPunkt(pl.geo, k.x, k.y, SKRUV_R)) continue
        kostnad += pl.skruvar.filter((y) => s.skruvar[y].kvar).length
      }
      bast = Math.min(bast, kostnad)
    }
    if (bast < 99) p -= bast * 3
  }
  // bomber nära noll är farliga
  for (const k of s.skruvar) if (k.kvar && k.bomb > 0 && k.bomb <= 3) p -= 40 / k.bomb
  return p
}

function valjSmart(s, bredd) {
  const kand = fria(s)
  if (!kand.length) return -1
  const st = s.spara()
  const forsta = []
  for (const id of kand) {
    s.tryck(id)
    forsta.push([id, poangLage(s)])
    s.ladda(st)
  }
  forsta.sort((a, b) => b[1] - a[1])
  let bast = forsta[0][0]
  let bastP = -Infinity
  for (const [id, p1] of forsta.slice(0, bredd)) {
    s.tryck(id)
    let p = p1
    if (s.status() === 'spelar') {
      const st2 = s.spara()
      let b2 = -Infinity
      for (const id2 of fria(s)) {
        s.tryck(id2)
        b2 = Math.max(b2, poangLage(s))
        s.ladda(st2)
      }
      if (b2 > -Infinity) p = Math.max(p1 - 1, b2)
    }
    s.ladda(st)
    if (p > bastP) {
      bastP = p
      bast = id
    }
  }
  return bast
}

// Kvar för bakåtkompatibilitet med äldre tester: reservens största fyllnad om
// skruvarna lossas i färgordningen seq.
export function reservBehov(seq, lador, antalAktiva = AKTIVA) {
  const aktiva = lador.slice(0, antalAktiva).map((f) => ({ f, n: 0 }))
  let nasta = antalAktiva
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

// Girig spelare (gammal): kvar för testerna.
export function girigBot(bana) {
  return smartBot(bana, { bredd: 1 })
}
