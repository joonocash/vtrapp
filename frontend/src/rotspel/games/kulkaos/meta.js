// Kulkaos — det som finns kvar mellan rundorna. Ingen DOM.
//
// Ben 🦴 tjänas i varje runda (fler ju längre man kommer) och läggs i
// Hundkojan på permanenta uppgraderingar, som PowerUps i Vampire Survivors:
// priset stiger för varje köp, och allt går att få tillbaka för att prova en
// annan uppsättning. Utmaningarna ger ben och låser upp hjältar och nya
// uppgraderingar (som upplåsningarna i Vampire Survivors och Balatro).
// Samlingen visar allt man har hittat. Feber 1–10 är svårighetsnivåerna,
// och dagens runda är samma för alla en dag, med en egen topplista.

import { HJALTAR, UPPGRADERINGAR, RELIKER, HJALTE_PRIS } from './innehall.js'
import { benFor, MAX_FEBER, build } from './runda.js'

export const ID = 'kulkaos'
export const dagensId = (datum) => `kulkaos-dag-${datum}`

export const START_META = {
  v: 1,
  ben: 0,
  totBen: 0,
  verkstad: {},
  betalt: 0,
  hjaltar: ['happy', 'konfekt', 'katten'],
  uppg: [],
  utmaningar: {},
  stats: { rundor: 0, vinster: 0, bossar: 0, maxRum: 0, maxPoang: 0, kopt: 0 },
  feber: 0, // högsta upplåsta Feber
  vunnaFeber: {}, // hjälte → högsta Feber man vunnit på
  samling: { uppg: {}, reliker: {}, hjaltar: {} },
  runda: null,
  dag: null, // datumet dagens runda senast räknades
  dagPoang: 0,
  bast: 0,
}

/* ---------------------------------------------------------------- Hundkojan */

export const VERKSTAD = [
  { id: 'kulor', ikon: '🎱', namn: 'Fler kulor', max: 5, bas: 40, text: (n) => `+${n} ${n === 1 ? 'kula' : 'kulor'} från start` },
  { id: 'startkassa', ikon: '💰', namn: 'Startkassan', max: 4, bas: 30, text: (n) => `${15 * n} guld från start` },
  { id: 'girighet', ikon: '🪙', namn: 'Girighet', max: 5, bas: 40, text: (n) => `+${10 * n} % guld` },
  { id: 'hink', ikon: '🪣', namn: 'Bred hink', max: 3, bas: 50, text: (n) => `Hinken är ${6 * n} px bredare` },
  { id: 'omslag', ikon: '🎲', namn: 'Omslag', max: 3, bas: 60, text: (n) => `+${n} omslag i varje runda` },
  { id: 'slang', ikon: '🗑️', namn: 'Släng', max: 3, bas: 60, text: (n) => `Släng ${n} ${n === 1 ? 'uppgradering' : 'uppgraderingar'} du inte vill ha, för resten av rundan` },
  { id: 'hoppa', ikon: '⏭️', namn: 'Hoppa över', max: 2, bas: 30, text: (n) => `Hoppa över ${n} ${n === 1 ? 'val' : 'val'} och ta 15 guld i stället` },
  { id: 'tur', ikon: '🍀', namn: 'Tur', max: 3, bas: 80, text: (n) => `Sällsynta uppgraderingar oftare (nivå ${n})` },
  { id: 'rabatt', ikon: '🛒', namn: 'Stamkund', max: 3, bas: 70, text: (n) => `${8 * n} % billigare i butiken` },
  { id: 'bosskraft', ikon: '🗡️', namn: 'Bosskraft', max: 5, bas: 50, text: (n) => `+${10 * n} % skada på bossar` },
  { id: 'startgava', ikon: '🎁', namn: 'Startgåvan', max: 2, bas: 120, text: (n) => `Börja med ${n} slumpad${n === 1 ? '' : 'e'} uppgradering${n === 1 ? '' : 'ar'}` },
  { id: 'benjakt', ikon: '🦴', namn: 'Benjakt', max: 5, bas: 60, text: (n) => `+${10 * n} % ben från varje runda` },
  { id: 'andra', ikon: '❤️', namn: 'Andra chansen', max: 1, bas: 300, text: () => 'En gång per runda: sex nya kulor när de tar slut' },
]
const totalRang = (m) => Object.values(m.verkstad).reduce((a, b) => a + b, 0)

export function verkstadPris(m, id) {
  const v = VERKSTAD.find((x) => x.id === id)
  const n = m.verkstad[id] || 0
  return Math.round(v.bas * (1 + n) * (1 + 0.1 * totalRang(m)))
}

export function kopVerkstad(m, id) {
  const v = VERKSTAD.find((x) => x.id === id)
  if (!v || (m.verkstad[id] || 0) >= v.max) return m
  const p = verkstadPris(m, id)
  if (m.ben < p) return m
  return { ...m, ben: m.ben - p, betalt: (m.betalt || 0) + p, verkstad: { ...m.verkstad, [id]: (m.verkstad[id] || 0) + 1 } }
}

// Få tillbaka alla ben och börja om i Hundkojan.
export const aterbetala = (m) => ({ ...m, ben: m.ben + (m.betalt || 0), betalt: 0, verkstad: {} })

// Det rundan får från Hundkojan och upplåsningarna (nyRunda({ meta })).
export function rundMeta(m) {
  const v = m.verkstad
  return { ...Object.fromEntries(VERKSTAD.map((x) => [x.id, v[x.id] || 0])), upplast: [...m.uppg] }
}

/* ------------------------------------------------------------ hjältarna */

export const harHjalte = (m, id) => m.hjaltar.includes(id)
export function kopHjalte(m, id) {
  if (harHjalte(m, id) || m.ben < HJALTE_PRIS) return m
  return { ...m, ben: m.ben - HJALTE_PRIS, hjaltar: [...m.hjaltar, id] }
}

/* ------------------------------------------------------------- utmaningar */

// kolla({ r, m }) — r är rundan (kan saknas), m metan. las: vad som låses upp.
export const UTMANINGAR = [
  { id: 'forsta', ikon: '🎱', namn: 'Första kaoset', text: 'Spela klart en runda', ben: 20, kolla: ({ m }) => m.stats.rundor >= 1 },
  { id: 'akt1', ikon: '🐀', namn: 'Råttfångare', text: 'Besegra Råttkungen (klara akt 1)', ben: 50, las: { hjalte: 'svea', uppg: 'blixt' }, kolla: ({ r }) => r?.bossar >= 1 },
  { id: 'akt2', ikon: '🦀', namn: 'Krabbkokare', text: 'Besegra Krabban Klo (klara akt 2)', ben: 80, las: { hjalte: 'hopp' }, kolla: ({ r }) => r?.bossar >= 2 },
  { id: 'seger', ikon: '🏆', namn: 'Kulkungen', text: 'Vinn en runda (klara akt 3)', ben: 150, las: { hjalte: 'kalle', feber: 1 }, kolla: ({ r }) => Boolean(r?.seger) },
  { id: 'kulor30', ikon: '🐙', namn: 'Kulhav', text: 'Ha 30 kulor ute samtidigt', ben: 40, las: { hjalte: 'atta' }, kolla: ({ r }) => r?.stats.maxKulor >= 30 },
  { id: 'kulor40', ikon: '🌪️', namn: 'Kulstorm', text: 'Ha 40 kulor ute samtidigt', ben: 60, kolla: ({ r }) => r?.stats.maxKulor >= 40 },
  { id: 'traffar60', ikon: '🦔', namn: 'Pinnslukaren', text: 'Tänd 60 pinnar i ett enda skott', ben: 40, las: { hjalte: 'taggis' }, kolla: ({ r }) => r?.stats.maxTraffar >= 60 },
  { id: 'langskott', ikon: '🦉', namn: 'Långflygaren', text: 'Ett skott som varar i 20 sekunder', ben: 30, las: { hjalte: 'klok' }, kolla: ({ r }) => r?.stats.langsta >= 20 },
  { id: 'guld200', ikon: '🐝', namn: 'Guldgruvan', text: 'Ha 200 guld samtidigt', ben: 40, las: { hjalte: 'blom' }, kolla: ({ r }) => r?.stats.maxGuld >= 200 },
  { id: 'eld40', ikon: '🐲', namn: 'Pyroman', text: 'Bränn 40 pinnar med eldbollar i en runda', ben: 40, las: { hjalte: 'glod' }, kolla: ({ r }) => r?.stats.eldTand >= 40 },
  { id: 'kop8', ikon: '🦊', namn: 'Storhandlaren', text: 'Köp 8 saker i butiker (totalt)', ben: 40, las: { hjalte: 'raven' }, kolla: ({ r, m }) => m.stats.kopt + (r?.stats.kopt || 0) >= 8 },
  { id: 'rundor10', ikon: '🐢', namn: 'Envis', text: 'Spela klart 10 rundor', ben: 60, las: { hjalte: 'seg' }, kolla: ({ m }) => m.stats.rundor >= 10 },
  { id: 'evolution', ikon: '🌟', namn: 'Evolution!', text: 'Ta din första evolution', ben: 50, las: { uppg: 'kulfabrik' }, kolla: ({ r }) => r?.stats.evolutioner >= 1 },
  { id: 'evolution3', ikon: '💫', namn: 'Utvecklingsläran', text: 'Ta tre evolutioner i samma runda', ben: 120, kolla: ({ r }) => r?.stats.evolutioner >= 3 },
  { id: 'rensat5', ikon: '🧹', namn: 'Rent hus ×5', text: 'Rent hus på fem banor i samma runda', ben: 60, las: { uppg: 'genom' }, kolla: ({ r }) => r?.stats.rensat >= 5 },
  { id: 'miljon', ikon: '💯', namn: 'Tiomiljonersklubben', text: '10 miljoner poäng i en runda', ben: 80, las: { uppg: 'flerskott' }, kolla: ({ r }) => r?.poang >= 10_000_000 },
  { id: 'reliker5', ikon: '🏺', namn: 'Samlaren', text: 'Ha fem reliker i samma runda', ben: 50, kolla: ({ r }) => r?.reliker.length >= 5 },
  { id: 'hink10', ikon: '🪣', namn: 'Jättehinken', text: 'Större hink på nivå 10', ben: 40, kolla: ({ r }) => (r?.varig.hink || 0) >= 10 },
  { id: 'gron10', ikon: '🟢', namn: 'Grönsaksland', text: 'Grön pinne på nivå 10', ben: 40, kolla: ({ r }) => (r?.varig.gron || 0) >= 10 },
  { id: 'oandlig', ikon: '♾️', namn: 'Bortom slutet', text: 'Nå akt 5 efter en seger', ben: 120, kolla: ({ r }) => r?.akt >= 5 },
  { id: 'feber3', ikon: '🌡️', namn: 'Feberfri', text: 'Vinn på Feber 3', ben: 200, kolla: ({ r }) => r?.seger && r.feber >= 3 },
  { id: 'feber10', ikon: '🔥', namn: 'Kokhet', text: 'Vinn på Feber 10', ben: 1000, kolla: ({ r }) => r?.seger && r.feber >= 10 },
  { id: 'dagens', ikon: '📅', namn: 'Dagens hjälte', text: 'Spela klart en dagens runda', ben: 20, kolla: ({ r }) => Boolean(r?.dag && r.slut) },
  { id: 'allahjaltar', ikon: '🎪', namn: 'Hela gänget', text: 'Lås upp alla hjältar', ben: 300, kolla: ({ m }) => HJALTAR.every((h) => m.hjaltar.includes(h.id)) },
]

// Klarar av utmaningar som är uppfyllda. Returnerar { m, nya: [id] }.
export function kollaUtmaningar(m, r = null) {
  let ny = m
  const nya = []
  for (let varv = 0; varv < 3; varv++) {
    let fler = false
    for (const u of UTMANINGAR) {
      if (ny.utmaningar[u.id] || !u.kolla({ r, m: ny })) continue
      ny = { ...ny, utmaningar: { ...ny.utmaningar, [u.id]: Date.now() }, ben: ny.ben + u.ben, totBen: (ny.totBen || 0) + u.ben }
      if (u.las?.hjalte && !ny.hjaltar.includes(u.las.hjalte)) ny = { ...ny, hjaltar: [...ny.hjaltar, u.las.hjalte] }
      if (u.las?.uppg && !ny.uppg.includes(u.las.uppg)) ny = { ...ny, uppg: [...ny.uppg, u.las.uppg] }
      if (u.las?.feber) ny = { ...ny, feber: Math.max(ny.feber, u.las.feber) }
      nya.push(u.id)
      fler = true
    }
    if (!fler) break // en upplåsning kan klara en annan (Hela gänget)
  }
  return { m: ny, nya }
}

// Vad som låser upp en hjälte eller uppgradering (för samlingen).
export function lasText(typ, id) {
  const u = UTMANINGAR.find((x) => x.las?.[typ] === id)
  return u ? `${u.ikon} ${u.text}` : ''
}

/* ----------------------------------------------------------- en runda slut */

// Rundan är slut (förlust eller seger). Ger ben, statistik, samling och
// nästa Feber. Returnerar { m, ben, nya }.
export function avslutaRunda(m, r) {
  const ben = benFor(r)
  const samling = {
    uppg: { ...m.samling.uppg },
    reliker: { ...m.samling.reliker },
    hjaltar: { ...m.samling.hjaltar, [r.hjalte]: (m.samling.hjaltar[r.hjalte] || 0) + 1 },
  }
  for (const u of build(r)) samling.uppg[u.id] = Math.max(samling.uppg[u.id] || 0, u.n)
  for (const id of r.reliker) samling.reliker[id] = (samling.reliker[id] || 0) + 1
  const stats = {
    rundor: m.stats.rundor + 1,
    vinster: m.stats.vinster + (r.seger ? 1 : 0),
    bossar: m.stats.bossar + r.bossar,
    maxRum: Math.max(m.stats.maxRum, (r.akt - 1) * 6 + r.rum),
    maxPoang: Math.max(m.stats.maxPoang, r.poang),
    kopt: m.stats.kopt + (r.stats.kopt || 0),
  }
  let ny = { ...m, ben: m.ben + ben, totBen: (m.totBen || 0) + ben, samling, stats, runda: null, bast: Math.max(m.bast || 0, r.poang) }
  // vinner man på den högsta Febern öppnas nästa
  if (r.seger && !r.dag) {
    ny.vunnaFeber = { ...m.vunnaFeber, [r.hjalte]: Math.max(m.vunnaFeber[r.hjalte] ?? -1, r.feber) }
    if (r.feber >= ny.feber) ny.feber = Math.min(MAX_FEBER, r.feber + 1)
  }
  if (r.dag) ny = { ...ny, dag: r.dag, dagPoang: Math.max(m.dag === r.dag ? m.dagPoang : 0, r.poang) }
  const k = kollaUtmaningar(ny, { ...r, slut: true })
  return { m: k.m, ben, nya: k.nya }
}

/* ---------------------------------------------------------- dagens runda */

export function idag(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Samma för alla en dag: frö, hjälte (vilken som helst, även låsta) och
// Feber 2. Hundkojan räknas inte, men alla uppgraderingar finns med.
export function dagensRunda(datum) {
  let h = 2166136261
  for (let i = 0; i < datum.length; i++) h = Math.imul(h ^ datum.charCodeAt(i), 16777619)
  const fro = h >>> 0
  return { fro, hjalte: HJALTAR[fro % HJALTAR.length].id, feber: 2, dag: datum, meta: { upplast: Object.keys(UPPGRADERINGAR).filter((id) => UPPGRADERINGAR[id].las) } }
}

export const antalReliker = Object.keys(RELIKER).length
export const antalUppg = Object.keys(UPPGRADERINGAR).length
