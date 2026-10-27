// Kulkaos — en runda. Ingen DOM.
//
// En runda är tre akter med sex rum var. Det sista rummet i varje akt är en
// boss. Mellan rummen väljer man dörr (som i Hades): vanlig bana, elitbana,
// kulregn, butik, skattkista, händelse eller lägereld. Varje dörr visar vad
// den ger. Efter en bana kommer belöningarna i en kö (rundan.ko): ett
// uppgraderingsval, en relik, en skattkista. När kön är tom väljer man nästa
// dörr. Efter akt 3 har man vunnit, och kan fortsätta i det oändliga med
// starkare bossar.
//
// Kulorna följer med mellan banorna, och rundan är slut när de tar slut med
// orange (eller en boss) kvar. Allt slumpat är seedat på rundans frö och
// rummets nummer, så att samma runda alltid ger samma val.
//
// rundan.steg: spel | belo | dorrar | butik | handelse | vila | seger | slut

import { genereraBana } from '../pinnboll/generator.js'
import { BONUS, hamtaBonus } from '../pinnboll/bonus.js'
import { HINK, KRAFTER } from '../pinnboll/motor.js'
import { mulberry32 } from '../delat/rng.js'
import { hjalte, UPPGRADERINGAR, RELIKER, NYA_KULOR } from './innehall.js'
import { bossBana, BOSSAR } from './bossar.js'
import { HANDELSER } from './handelser.js'

export const AKTER = 3
export const RUM = 6 // rum per akt; det sista är bossen
export const STARTKULOR = 12

export const RUMTYPER = {
  strid: { ikon: '⚔️', namn: 'Bana', belo: 'Välj en uppgradering' },
  elit: { ikon: '💀', namn: 'Elitbana', belo: 'Relik och guld' },
  kulregn: { ikon: '🌧️', namn: 'Kulregn', belo: 'Skattkista och guld' },
  butik: { ikon: '🛒', namn: 'Butik', belo: 'Handla för guld' },
  kista: { ikon: '🎁', namn: 'Skattkista', belo: '1–3 gratis uppgraderingar' },
  handelse: { ikon: '❓', namn: 'Händelse', belo: 'Vem vet?' },
  vila: { ikon: '🔥', namn: 'Lägereld', belo: 'Vila eller träna' },
  boss: { ikon: '👹', namn: 'Boss', belo: 'Stor skattkista och relik' },
}
export const ARBANA = { strid: true, elit: true, kulregn: true, boss: true }

export const ELIT_MOD = {
  fler: { ikon: '🟠', namn: 'Fler orange', text: 'Sex orange pinnar till' },
  tung: { ikon: '🪨', namn: 'Tunga kulor', text: 'Starkare tyngdkraft' },
  ingenHink: { ikon: '🚫', namn: 'Ingen hink', text: 'Hinken är borta' },
}

// Svårigheten (som Ascension i Slay the Spire): Feber n gäller allt till och
// med n. Man låser upp nästa genom att vinna på den förra.
export const FEBER = [
  'Bossarna har 25 % mer liv',
  'En kula mindre efter varje bana',
  'Elitbanor oftare, med två orange till',
  'Butiken är 20 % dyrare',
  'Tre orange till på varje bana',
  'Två kulor mindre från start',
  'Bossarna har ännu 25 % mer liv',
  'Ett val färre på uppgraderingskorten',
  'Svårare banor',
  'Skattkistor ger bara en sak',
]
export const MAX_FEBER = FEBER.length
const har = (r, n) => (r.feber || 0) >= n

/* --------------------------------------------------------------- slumpen */

function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
export function slump(r, salt, extra = 0) {
  return mulberry32((r.fro ^ Math.imul(r.nr + 1, 2654435761) ^ hashStr(salt) ^ Math.imul(extra + 1, 40503)) >>> 0)
}
const valjVikt = (s, lista, vikt) => {
  const v = lista.map(vikt)
  let x = s() * v.reduce((a, b) => a + b, 0)
  let i = 0
  while (i < lista.length - 1 && x >= v[i]) x -= v[i++]
  return i
}

/* --------------------------------------------------------------- början */

// meta = det Hundkojan och utmaningarna ger: { kulor, hink, tur, girighet,
// omslag, slang, hoppa, andra, startgava, rabatt, startkassa, bosskraft,
// benjakt, upplast: [låsta uppgraderingar som är upplåsta] }
export function nyRunda({ fro = (Date.now() & 0x7fffffff) >>> 0, hjalte: hid = 'happy', feber = 0, dag = null, meta = {} } = {}) {
  const h = hjalte(hid)
  let r = {
    v: 1,
    fro,
    hjalte: h.id,
    feber,
    dag,
    akt: 1,
    rum: 1,
    nr: 1,
    typ: 'strid',
    mod: null,
    steg: 'spel',
    kulor: (h.startKulor ?? STARTKULOR) + (meta.kulor || 0) - (feber >= 6 ? 2 : 0),
    guld: 15 * (meta.startkassa || 0),
    poang: 0,
    klara: 0,
    bossar: 0,
    varig: { ...(h.start || {}) },
    reliker: [],
    nasta: {},
    omslag: 1 + (meta.omslag || 0),
    slang: meta.slang || 0,
    hoppa: meta.hoppa || 0,
    slangda: [],
    andraChans: meta.andra ? 1 : 0,
    slag: 0,
    bonus: { tur: meta.tur || 0, girighet: meta.girighet || 0, rabatt: meta.rabatt || 0, hink: meta.hink || 0, bosskraft: meta.bosskraft || 0, benjakt: meta.benjakt || 0 },
    upplast: meta.upplast || [],
    ko: [],
    dorrar: null,
    butik: null,
    handelse: null,
    aktLog: { butik: 0, kulregn: 0 },
    settHandelser: [],
    stats: { maxKulor: 0, maxTraffar: 0, langsta: 0, eldTand: 0, rensat: 0, maxGuld: 0, kopt: 0, evolutioner: 0 },
    seger: false,
    oandlig: false,
    slut: false,
  }
  // Startgåvan i Hundkojan: slumpade vanliga uppgraderingar från början
  const s = slump(r, 'start')
  for (let i = 0; i < (meta.startgava || 0); i++) {
    const id = slumpUppg(r, s, 1)
    if (id) r = geUppg(r, id)
  }
  return r
}

/* ----------------------------------------------------------- uppgraderingar */

const UPP = UPPGRADERINGAR
export const tak = (r, id) => (UPP[id].max ? UPP[id].max + (r.reliker.includes('trolldryck') && UPP[id].grad < 4 ? 1 : 0) : Infinity)

export function mojlig(r, id) {
  const u = UPP[id]
  if (!u) return false
  if (u.las && !r.upplast.includes(id)) return false
  if (r.slangda.includes(id)) return false
  if ((r.varig[id] || 0) >= tak(r, id)) return false
  if (u.krav) return Object.entries(u.krav).every(([k, v]) => (r.varig[k] || 0) >= v)
  return true
}
export const kanHoja = (r, id) => !UPP[id].direkt && (r.varig[id] || 0) < tak(r, id)

const turNiva = (r) => (r.varig.tur || 0) + (r.bonus?.tur || 0)
function vikt(r, id) {
  const u = UPP[id]
  if (u.grad === 4) return 30
  const tur = turNiva(r)
  const bas = { 1: 10, 2: 6 * (1 + 0.5 * tur), 3: 3 * (1 + 0.7 * tur) }[u.grad]
  return u.direkt ? bas * 0.5 : bas
}

function dra(r, s, antal, { direkt = true, evolution = false, grad = 0, utom = [] } = {}) {
  const pool = Object.keys(UPP).filter((id) => mojlig(r, id) && (direkt || !UPP[id].direkt) && (!grad || UPP[id].grad === grad) && !utom.includes(id))
  const ut = []
  // en evolution som går att få kommer alltid med först
  const evo = evolution ? pool.filter((id) => UPP[id].grad === 4) : []
  if (evo.length) ut.push(pool.splice(pool.indexOf(evo[Math.floor(s() * evo.length)]), 1)[0])
  while (ut.length < antal && pool.length) ut.push(pool.splice(valjVikt(s, pool, (id) => vikt(r, id)), 1)[0])
  return ut
}

// En slumpad uppgradering (för händelser och Startgåvan). grad = bara den graden.
export function slumpUppg(r, s, grad = 0) {
  return dra(r, s, 1, { direkt: false, grad })[0] || (grad ? dra(r, s, 1, { direkt: false })[0] : undefined) || null
}

export function antalVal(r) {
  const h = hjalte(r.hjalte)
  return Math.max(2, 3 + (turNiva(r) >= 1 ? 1 : 0) + (r.reliker.includes('fyrklover') ? 1 : 0) - (h.valFarre || 0) - (har(r, 8) ? 1 : 0))
}
export function uppgVal(r) {
  return dra(r, slump(r, 'val', r.slag || 0), antalVal(r), { evolution: true })
}

export function geUppg(r, id) {
  const u = UPP[id]
  if (!u) return r
  if (id === 'kulor') return { ...r, kulor: r.kulor + 4 }
  if (id === 'guldpase') return { ...r, guld: r.guld + 40 }
  if (id === 'omslag') return { ...r, omslag: r.omslag + 2 }
  if (id === 'trippel') return { ...r, nasta: { ...r.nasta, trippel: (r.nasta.trippel || 0) + 2 } }
  const stats = u.grad === 4 ? { ...r.stats, evolutioner: (r.stats.evolutioner || 0) + 1 } : r.stats
  return { ...r, varig: { ...r.varig, [id]: (r.varig[id] || 0) + 1 }, stats }
}

/* ----------------------------------------------------------------- reliker */

export function relikVal(r, s = slump(r, 'relik'), antal = 3) {
  const pool = Object.keys(RELIKER).filter((id) => !r.reliker.includes(id))
  const ut = []
  while (ut.length < antal && pool.length) ut.push(pool.splice(valjVikt(s, pool, (id) => [0, 6, 4, 2][RELIKER[id].grad]), 1)[0])
  return ut
}
export const slumpRelik = (r, s) => relikVal(r, s, 1)[0] || null
export function geRelik(r, id) {
  if (!RELIKER[id] || r.reliker.includes(id)) return r
  const ny = { ...r, reliker: [...r.reliker, id] }
  if (id === 'tarning') ny.omslag += 3
  return ny
}

/* ----------------------------------------------------------------- banorna */

const svarighet = (r) => (r.akt - 1) * 4 + r.rum + (har(r, 9) ? 2 : 0)
const KRAFTNAMN = Object.keys(KRAFTER)

// Vad gröna pinnar gör: hjältens kraft (Kaos-Kalle: en ny varje bana).
export function kraftFor(r) {
  const k = hjalte(r.hjalte).kraft
  if (k !== 'slump') return k
  const s = slump(r, 'kraft')
  return KRAFTNAMN[Math.floor(s() * KRAFTNAMN.length)]
}

// Banan i rundans nuvarande rum.
export function rumBana(r) {
  if (r.typ === 'boss') {
    const hp = (har(r, 1) ? 1.25 : 1) * (har(r, 7) ? 1.25 : 1)
    return { ...bossBana(r.akt, { hpFaktor: hp, orange: 10 + (har(r, 5) ? 3 : 0) }), kraft: kraftFor(r) }
  }
  if (r.typ === 'kulregn') {
    const s = slump(r, 'kulregn')
    const lista = BONUS.filter((b) => b.familj === 'kulregn' || b.id === 'kulregnet')
    const d = lista[Math.floor(s() * lista.length)]
    return { ...hamtaBonus(d.id, Math.floor(s() * 4)), iRunda: true }
  }
  const elit = r.typ === 'elit'
  const b = genereraBana((r.fro ^ Math.imul(r.nr, 7919)) >>> 0, { niva: svarighet(r) + (elit ? 3 : 0) })
  const kand = b.objekt.filter((o) => !o.ejOrange).length
  const extra = (har(r, 5) ? 3 : 0) + (elit ? 4 + (har(r, 3) ? 2 : 0) + (r.mod === 'fler' ? 6 : 0) : 0)
  // akt 1 börjar snällt: färre orange de första banorna
  const bas = r.akt === 1 ? Math.min(b.orange, 7 + 2 * r.rum) : b.orange
  return { ...b, orange: Math.max(bas, Math.min(bas + extra, kand - 4)), kraft: kraftFor(r), guldpinnar: 2, elit: elit ? r.mod : null }
}

export function guldFaktor(r) {
  const h = hjalte(r.hjalte)
  return (1 + 0.25 * (r.varig.guldnos || 0) + 0.1 * (r.bonus?.girighet || 0)) * (r.reliker.includes('guldtand') ? 1.5 : 1) * (h.guldX || 1)
}

const PERKAR = ['jatte', 'magnet', 'bomber', 'lila', 'smalla', 'poang', 'hinkmagnet', 'meteor', 'kulregn', 'guldhink', 'fyrverkeri', 'golv', 'lyckoslant', 'blixt', 'blixtstorm', 'kulfabrik', 'genom', 'guldpinnar', 'midas']
const RELIKPERKAR = ['spelautomat', 'karamell', 'spegel', 'diamant', 'stjarnfall', 'kronan', 'snigel', 'glodkol']

// Hur motorn ska startas för rummets bana (skapaSpel(bana, { fro, ...spelVal })).
export function spelVal(r, bana) {
  const h = hjalte(r.hjalte)
  const p = r.varig
  const hp = h.perk || {}
  const perk = {}
  for (const id of PERKAR) if (p[id]) perk[id] = p[id]
  if (hp.golv) perk.golv = (perk.golv || 0) + hp.golv
  if (hp.genom) perk.genom = 1
  const fler = (p.flerskott || 0) + (hp.flerskott || 0) + (p.kulkanon ? 2 : 0)
  if (fler) perk.flerskott = fler
  if (p.delning) perk.delning = p.delning * (p.kulkanon ? 2 : 1)
  for (const id of ['tvilling', 'eldstor', 'honung']) if (hp[id]) perk[id] = 1
  let grav = (hp.grav || 1) * (1 - 0.12 * (p.fjader || 0))
  if (bana.elit === 'tung') grav *= 1.25
  if (grav !== 1) perk.grav = grav
  perk.guldFaktor = guldFaktor(r)
  const jagare = (p.jagare || 0) + 0.5 * (r.bonus?.bosskraft || 0)
  if (jagare) perk.jagare = jagare
  for (const id of RELIKPERKAR) if (r.reliker.includes(id)) perk[id] = 1
  const start = {
    spar: p.sikte ? 999 : r.nasta.spar || 0,
    eld: (p.eldkula || 0) + (bana.start?.eld || 0),
    spok: h.spokAlltid ? 999 : p.spoke || 0,
    trippel: r.nasta.trippel || 0,
  }
  let hinkBredd = Math.round((HINK.bredd + 14 * (p.hink || 0) + 6 * (r.bonus?.hink || 0)) * (r.reliker.includes('hinkskydd') ? 1.4 : 1))
  if (h.ingenHink || bana.elit === 'ingenHink') hinkBredd = 0
  if (bana.bonus) return { kulor: bana.kulor || 3, kulBonus: false, hinkBredd, start, perk }
  return { kulor: r.kulor, kulBonus: false, hinkBredd, extraGrona: p.gron || 0, start, perk }
}

// Nya kulor efter en vanlig bana.
export function nyaKulor(r) {
  const h = hjalte(r.hjalte)
  return Math.max(0, (h.nya ?? NYA_KULOR) + (r.varig.bank || 0) + (r.reliker.includes('kottben') ? 2 : 0) - (har(r, 2) ? 1 : 0))
}

/* ----------------------------------------------------------- efter en bana */

// res = { poang, kulorKvar, guld, feber, rensat, stats: { maxKulor, maxTraffar, langsta, eldTand } }
export function rumKlart(r, res) {
  const h = hjalte(r.hjalte)
  const st = res.stats || {}
  const stats = {
    ...r.stats,
    maxKulor: Math.max(r.stats.maxKulor, st.maxKulor || 0),
    maxTraffar: Math.max(r.stats.maxTraffar, st.maxTraffar || 0),
    langsta: Math.max(r.stats.langsta, st.langsta || 0),
    eldTand: r.stats.eldTand + (st.eldTand || 0),
    rensat: r.stats.rensat + (res.rensat ? 1 : 0),
  }
  let ny = { ...r, poang: r.poang + (res.poang || 0), klara: r.klara + 1, guld: r.guld + (res.guld || 0), stats, nasta: {}, slag: 0 }
  // guld för banan, och Spargrisens ränta
  const bas = { strid: 12, elit: 30, boss: 60, kulregn: 25 }[r.typ] + 3 * (r.akt - 1)
  ny.guld += Math.round(bas * guldFaktor(r))
  if (r.reliker.includes('spargris')) ny.guld += Math.min(15, Math.floor(ny.guld * 0.1))
  ny.stats.maxGuld = Math.max(ny.stats.maxGuld, ny.guld)
  // kulorna: kulregnsbanorna har egna kulor, bossen ger fem extra
  if (r.typ === 'kulregn') ny.kulor = r.kulor + 3
  else ny.kulor = Math.max(0, res.kulorKvar || 0) + nyaKulor(r) + (r.typ === 'boss' ? 5 : 0)
  if (res.feber && r.reliker.includes('klockan')) ny.kulor += 4
  if (r.typ === 'boss') ny.bossar = r.bossar + 1
  // belöningarna
  const ko = []
  if (r.typ === 'strid') ko.push(h.auto ? { typ: 'kista', antal: 2, auto: true } : { typ: 'uppg' })
  if (r.typ === 'elit') ko.push({ typ: 'relik' }, ...(h.auto ? [{ typ: 'kista', antal: 2, auto: true }] : []))
  if (r.typ === 'kulregn') ko.push({ typ: 'kista', antal: kistaAntal(ny) })
  if (r.typ === 'boss') ko.push({ typ: 'kista', antal: har(r, 10) ? 1 : 3 }, { typ: 'relik' })
  return forberedKo({ ...ny, ko, steg: 'belo' })
}

export function kistaAntal(r) {
  if (har(r, 10)) return 1
  const s = slump(r, 'kistantal')
  const tur = turNiva(r)
  let n = 1 + (s() < 0.35 + 0.08 * tur ? 1 : 0) + (s() < 0.1 + 0.04 * tur ? 1 : 0)
  if (r.reliker.includes('present')) n = Math.max(2, n)
  return n
}

// Öppnar en skattkista: antal olika uppgraderingar, direkt.
export function oppnaKista(r, antal) {
  const s = slump(r, 'kista', r.ko.length)
  let ny = r
  const fick = []
  for (let i = 0; i < antal; i++) {
    const [id] = dra(ny, s, 1, { direkt: false, utom: fick, evolution: i === 0 })
    if (!id) break
    fick.push(id)
    ny = geUppg(ny, id)
  }
  return { runda: ny, fick }
}

// Gör i ordning första belöningen i kön (eller går vidare om den är tom).
function forberedKo(r) {
  if (!r.ko.length) return efterRum(r)
  const [f, ...rest] = r.ko
  if (f.klar) return { ...r, steg: 'belo' }
  if (f.typ === 'kista') {
    const { runda, fick } = oppnaKista(r, f.antal)
    return { ...runda, ko: [{ ...f, fick, klar: true }, ...rest], steg: 'belo' }
  }
  if (f.typ === 'uppg') {
    const val = uppgVal(r)
    if (!val.length) return forberedKo({ ...r, guld: r.guld + 30, ko: rest })
    return { ...r, ko: [{ ...f, val, klar: true }, ...rest], steg: 'belo' }
  }
  const val = relikVal(r)
  if (!val.length) return forberedKo({ ...r, guld: r.guld + 50, ko: rest })
  return { ...r, ko: [{ ...f, val, klar: true }, ...rest], steg: 'belo' }
}

const nastaIKo = (r) => forberedKo({ ...r, ko: r.ko.slice(1), slag: 0 })

// Val i första belöningen. Skattkistan kvitteras bara.
export function valjBelo(r, id) {
  const f = r.ko[0]
  if (!f) return r
  if (f.typ === 'kista') return nastaIKo(r)
  if (f.typ === 'relik') return f.val.includes(id) ? nastaIKo(geRelik(r, id)) : r
  if (!f.val.includes(id) || !mojlig(r, id)) return r
  return nastaIKo(geUppg(r, id))
}

// Slå om valen (ett omslag), släng ett av dem för resten av rundan (en
// släng), eller hoppa över och ta 15 guld (en hoppa).
export function slaOm(r) {
  const f = r.ko[0]
  if (!f || f.typ !== 'uppg' || !(r.omslag > 0)) return r
  const ny = { ...r, omslag: r.omslag - 1, slag: (r.slag || 0) + 1 }
  return { ...ny, ko: [{ ...f, val: uppgVal(ny) }, ...r.ko.slice(1)] }
}
export function sling(r, id) {
  const f = r.ko[0]
  if (!f || f.typ !== 'uppg' || !(r.slang > 0) || !f.val.includes(id)) return r
  const ny = { ...r, slang: r.slang - 1, slangda: [...r.slangda, id], slag: (r.slag || 0) + 1 }
  return { ...ny, ko: [{ ...f, val: uppgVal(ny) }, ...r.ko.slice(1)] }
}
export function hoppa(r) {
  const f = r.ko[0]
  if (!f || f.typ !== 'uppg' || !(r.hoppa > 0)) return r
  return nastaIKo({ ...r, hoppa: r.hoppa - 1, guld: r.guld + 15 })
}

/* ------------------------------------------------------------------ dörrar */

function efterRum(r) {
  if (r.typ === 'boss') {
    if (r.akt >= AKTER && !r.oandlig) return { ...r, steg: 'seger', seger: true, ko: [] }
    return nyAkt(r)
  }
  return { ...r, ko: [], steg: 'dorrar', dorrar: dorrVal(r, r.rum + 1) }
}

function nyAkt(r) {
  const ny = { ...r, akt: r.akt + 1, rum: 0, aktLog: { butik: 0, kulregn: 0 }, ko: [] }
  if (r.reliker.includes('tarning')) ny.omslag += 1
  return { ...ny, steg: 'dorrar', dorrar: dorrVal(ny, 1) }
}

export function dorrVal(r, rumNy) {
  if (rumNy >= RUM) {
    const b = BOSSAR[(r.akt - 1) % BOSSAR.length]
    return [{ typ: 'boss', boss: { namn: b.namn, ikon: b.ikon, text: b.text } }]
  }
  const s = slump(r, 'dorr', rumNy)
  const vikter = {
    strid: 6,
    elit: rumNy >= 2 ? 2.2 + (har(r, 3) ? 1.2 : 0) : 0,
    butik: rumNy >= 2 && r.typ !== 'butik' && r.aktLog.butik < 2 ? 1.6 : 0,
    kista: 1,
    handelse: 1.6,
    kulregn: r.aktLog.kulregn < 1 ? 1.2 : 0,
    vila: rumNy >= 3 && !r.aktLog.vila ? 1 : 0,
  }
  const pool = Object.keys(vikter).filter((t) => vikter[t] > 0)
  const valda = []
  while (valda.length < 3 && pool.length) valda.push(pool.splice(valjVikt(s, pool, (t) => vikter[t]), 1)[0])
  // minst en bana att spela
  if (!valda.some((t) => ARBANA[t])) valda[valda.length - 1] = 'strid'
  return valda.map((typ) => {
    if (typ !== 'elit') return { typ }
    const mods = Object.keys(ELIT_MOD)
    return { typ, mod: mods[Math.floor(s() * mods.length)] }
  })
}

export function valjDorr(r, i) {
  const d = r.dorrar?.[i]
  if (!d || r.steg !== 'dorrar') return r
  const aktLog = { ...r.aktLog }
  if (d.typ === 'butik') aktLog.butik++
  if (d.typ === 'kulregn') aktLog.kulregn++
  if (d.typ === 'vila') aktLog.vila = 1
  const ny = { ...r, rum: r.rum + 1, nr: r.nr + 1, typ: d.typ, mod: d.mod || null, dorrar: null, aktLog, slag: 0 }
  if (ARBANA[d.typ]) return { ...ny, steg: 'spel' }
  if (d.typ === 'butik') return { ...ny, steg: 'butik', butik: nyButik(ny) }
  if (d.typ === 'kista') return forberedKo({ ...ny, ko: [{ typ: 'kista', antal: kistaAntal(ny) }], steg: 'belo' })
  if (d.typ === 'handelse') {
    const s = slump(ny, 'handelse')
    let pool = HANDELSER.filter((h) => !r.settHandelser.includes(h.id))
    if (!pool.length) pool = HANDELSER
    const h = pool[Math.floor(s() * pool.length)]
    return { ...ny, steg: 'handelse', handelse: { id: h.id, svar: null }, settHandelser: [...r.settHandelser, h.id] }
  }
  return { ...ny, steg: 'vila' }
}

/* ------------------------------------------------------------------ butiken */

export function pris(r, bas) {
  const h = hjalte(r.hjalte)
  return Math.max(5, Math.round(bas * (1 + 0.15 * (r.akt - 1)) * (1 - 0.08 * (r.bonus?.rabatt || 0)) * (1 - (h.rabatt || 0)) * (har(r, 4) ? 1.2 : 1)))
}

export function nyButik(r, omslag = 0) {
  const s = slump(r, 'butik', omslag)
  const varor = dra(r, s, 2, { direkt: false }).map((id) => ({ typ: 'uppg', id, pris: pris(r, [0, 30, 50, 80, 120][UPP[id].grad]) }))
  const rel = relikVal(r, s, 1)[0]
  if (rel) varor.push({ typ: 'relik', id: rel, pris: pris(r, 90 + 30 * RELIKER[rel].grad) })
  varor.push({ typ: 'kulor', n: 5, pris: pris(r, 25) }, { typ: 'omslag', n: 2, pris: pris(r, 20) })
  return { varor, omslag, omslagPris: 10 + 10 * omslag }
}

export function kop(r, i) {
  const v = r.butik?.varor[i]
  if (!v || v.sald || r.guld < v.pris) return r
  if (v.typ === 'uppg' && !mojlig(r, v.id)) return r
  let ny = { ...r, guld: r.guld - v.pris, stats: { ...r.stats, kopt: (r.stats.kopt || 0) + 1 } }
  if (v.typ === 'uppg') ny = geUppg(ny, v.id)
  else if (v.typ === 'relik') ny = geRelik(ny, v.id)
  else if (v.typ === 'kulor') ny = { ...ny, kulor: ny.kulor + v.n }
  else if (v.typ === 'omslag') ny = { ...ny, omslag: ny.omslag + v.n }
  return { ...ny, butik: { ...r.butik, varor: r.butik.varor.map((x, j) => (j === i ? { ...x, sald: true } : x)) } }
}

export function slaOmButik(r) {
  const b = r.butik
  if (!b || r.guld < b.omslagPris) return r
  return { ...r, guld: r.guld - b.omslagPris, butik: nyButik(r, b.omslag + 1) }
}

export const lamna = (r) => efterRum({ ...r, butik: null, handelse: null })

/* ------------------------------------------------------- händelser och vila */

export const VERKTYG = {
  slumpUppg,
  slumpRelik,
  geUppg,
  geRelik,
  kanHoja,
  namn: (id) => UPP[id]?.namn || id,
  relikNamn: (id) => RELIKER[id]?.namn || id,
  grad: (id) => UPP[id]?.grad || 1,
}

export function svaraHandelse(r, i) {
  const h = HANDELSER.find((x) => x.id === r.handelse?.id)
  if (!h || r.handelse.svar) return r
  const val = h.val[i]
  if (!val || (val.kan && !val.kan(r))) return r
  const { runda, text } = val.gor(r, slump(r, 'svar', i), VERKTYG)
  return { ...runda, handelse: { ...r.handelse, svar: text } }
}

export function vila(r, val) {
  if (r.steg !== 'vila') return r
  if (val === 'trana') {
    const mina = Object.keys(r.varig).filter((id) => r.varig[id] > 0 && kanHoja(r, id))
    if (mina.length) {
      const s = slump(r, 'trana')
      return lamna(geUppg(r, mina[Math.floor(s() * mina.length)]))
    }
  }
  return lamna({ ...r, kulor: r.kulor + 6 })
}

/* ---------------------------------------------------------- slut och seger */

export const fortsattOandligt = (r) => (r.steg === 'seger' ? nyAkt({ ...r, oandlig: true }) : r)
export const avsluta = (r) => ({ ...r, steg: 'slut', slut: true, ko: [] })

// Ben (metavalutan) för en runda.
export function benFor(r) {
  const bas = 3 * r.klara + 30 * r.bossar + Math.floor(r.poang / 250000) + (r.seger ? 100 : 0)
  const f = (1 + 0.2 * (r.feber || 0)) * (1 + 0.1 * (r.bonus?.benjakt || 0)) * (r.reliker.includes('benbit') ? 1.5 : 1)
  return Math.round(bas * f)
}

// Rundans build: uppgraderingarna med nivåer, evolutioner först.
export function build(r) {
  return Object.entries(r.varig)
    .filter(([id, n]) => n > 0 && UPP[id])
    .map(([id, n]) => ({ id, n, ...UPP[id] }))
    .sort((a, b) => b.grad - a.grad)
}
