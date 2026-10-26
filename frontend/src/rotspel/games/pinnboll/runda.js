// Pinnbollen — oändligt läge, ett roguelike. Ingen DOM.
//
// En runda börjar med att man väljer en hjälte (världarnas mästare). Hjälten
// bestämmer vad de gröna pinnarna gör hela rundan och ger en första
// uppgradering. Sedan kommer banor som byggs av sig själva och blir svårare
// och svårare. Kulorna man har kvar följer med, och efter varje bana väljer
// man en av tre uppgraderingar (fyra med Tur). De flesta går att ta igen och
// igen — hinken växer, gröna blir fler, kulan blir större — så att man blir
// starkare och starkare, som i Vampire Survivors. Två uppgraderingar på rätt
// nivå låser upp en evolution. Omslag slår om valen. Var femte bana är en
// bonusbana, och efter den öppnas en skattkista med gratis uppgraderingar.
// Rundan är slut när kulorna tar slut med orange kvar.

import { genereraBana } from './generator.js'
import { BONUS, hamtaBonus } from './bonus.js'
import { mulberry32 } from '../delat/rng.js'
import { HINK, STARTKULOR, KRAFTER } from './motor.js'

export const NYA_KULOR = 5
export const BONUS_VAR = 5

// Hjältarna (världarnas mästare): kraft = vad gröna pinnar gör, start =
// uppgraderingar från början, varld = världen hjälten kommer ifrån.
export const HJALTAR = [
  { id: 'happy', varld: 0, namn: 'Happy', ikon: '🐶', kraft: 'spar', start: { sikte: 1, hink: 1 } },
  { id: 'konfekt', varld: 1, namn: 'Kaninen Konfekt', ikon: '🐰', kraft: 'multi', start: { delning: 1 } },
  { id: 'katten', varld: 2, namn: 'Rymdkatten', ikon: '🐱', kraft: 'small', start: { bomber: 1 } },
  { id: 'svea', varld: 3, namn: 'Spöket Svea', ikon: '👻', kraft: 'spok', start: { spoke: 1 } },
  { id: 'glod', varld: 4, namn: 'Draken Glöd', ikon: '🐲', kraft: 'eld', start: { eldkula: 1 } },
  { id: 'blom', varld: 5, namn: 'Biet Blom', ikon: '🐝', kraft: 'blomma', start: { magnet: 1 } },
]
export const hjalte = (id) => HJALTAR.find((h) => h.id === id) || null

// Uppgraderingarna. grad: 1 vanlig, 2 sällsynt, 3 episk, 4 evolution.
// direkt = tas en gång och är sedan borta (inte en nivå). max saknas = inget
// tak, man kan ta den hur många gånger som helst. krav = en evolution som
// blir möjlig när de andra har nått sina nivåer.
export const UPPGRADERINGAR = {
  kulor: { ikon: '➕', namn: '+3 kulor', grad: 1, direkt: true, text: () => 'Tre kulor till, direkt' },
  omslag: { ikon: '🎲', namn: 'Omslag', grad: 1, direkt: true, text: () => 'Två omslag till: slå om valen' },
  trippel: { ikon: '3×', namn: 'Trippelpoäng', grad: 2, direkt: true, text: () => 'Tre gånger poängen i två skott på nästa bana' },

  gron: { ikon: '🟢', namn: 'Grön pinne', grad: 1, text: (n) => (n === 1 ? 'En grön pinne till på varje bana' : `${n} gröna pinnar till på varje bana`) },
  hink: { ikon: '🪣', namn: 'Större hink', grad: 1, text: (n) => `Hinken blir bredare (+${14 * n} px)` },
  bank: { ikon: '💰', namn: 'Kulbanken', grad: 1, text: (n) => `${NYA_KULOR + n} nya kulor efter varje bana` },
  poang: { ikon: '✨', namn: 'Poängregn', grad: 1, text: (n) => `+${25 * n} % poäng på allt` },

  eldkula: { ikon: '🔥', namn: 'Eldkula', grad: 2, max: 5, text: (n) => (n === 1 ? 'Första skottet på varje bana är en stor eldboll' : `De ${n} första skotten på varje bana är eldbollar`) },
  spoke: { ikon: '👻', namn: 'Spökkula', grad: 2, max: 5, text: (n) => (n === 1 ? 'Första skottet på varje bana kommer tillbaka uppifrån' : `De ${n} första skotten på varje bana kommer tillbaka`) },
  jatte: { ikon: '⚪', namn: 'Jättekula', grad: 2, max: 4, text: (n) => `Kulan är ${15 * n} % större och träffar mer` },
  magnet: { ikon: '🧲', namn: 'Magnet', grad: 2, max: 4, text: (n) => (n === 1 ? 'Kulan dras mot orange pinnar' : `Magneten drar starkare (nivå ${n})`) },
  delning: { ikon: '🎱', namn: 'Delning', grad: 2, max: 5, text: (n) => `Första träffen i varje skott delar kulan i ${n + 1}` },
  bomber: { ikon: '💣', namn: 'Bomber', grad: 2, max: 6, text: (n) => `${2 * n} blå pinnar på varje bana är bomber` },
  hinkmagnet: { ikon: '🎯', namn: 'Hinkmagnet', grad: 2, max: 3, text: (n) => (n === 1 ? 'Kulorna dras mot hinken längst ner' : `Hinkmagneten drar starkare (nivå ${n})`) },

  lila: { ikon: '🟣', namn: 'Lila lycka', grad: 3, max: 3, text: (n) => (n === 1 ? 'Lila pinnen ger en extra kula' : `${n} lila pinnar per skott, var och en ger en kula`) },
  smalla: { ikon: '💥', namn: 'Storsmäll', grad: 3, max: 4, text: (n) => (n === 1 ? 'Varje grön pinne smäller och tänder allt runt sig' : `Smällen blir större (nivå ${n})`) },
  sikte: { ikon: '🔮', namn: 'Siktet', grad: 3, max: 1, text: () => 'Långt siktspår hela rundan' },
  tur: { ikon: '🍀', namn: 'Tur', grad: 3, max: 3, text: (n) => (n === 1 ? 'Fyra val i stället för tre, och fler sällsynta' : 'Ännu fler sällsynta val') },

  meteor: { ikon: '☄️', namn: 'Meteorregn', grad: 4, max: 1, krav: { eldkula: 2, jatte: 2 }, text: () => 'Eldbollarna blir enorma, och varje orange de bränner smäller' },
  kulregn: { ikon: '🌧️', namn: 'Kulregn', grad: 4, max: 1, krav: { delning: 2, gron: 2 }, text: () => 'Varje grön pinne skjuter ut två nya kulor' },
  guldhink: { ikon: '🏆', namn: 'Guldhinken', grad: 4, max: 1, krav: { hink: 3, bank: 2 }, text: () => 'Hinken ger två kulor och 25 000 poäng' },
  fyrverkeri: { ikon: '🎆', namn: 'Fyrverkeri', grad: 4, max: 1, krav: { bomber: 2, smalla: 1 }, text: () => 'Bomberna smäller större och skjuter ut en kula var' },
}
export const GRADER = { 1: 'Vanlig', 2: 'Sällsynt', 3: 'Episk', 4: 'Evolution' }

// Gamla namn från innan rundan blev ett roguelike.
export const BONUSAR = UPPGRADERINGAR

// Vilka evolutioner en uppgradering ingår i (för tipset på kortet).
export function ingarI(id) {
  return Object.entries(UPPGRADERINGAR)
    .filter(([, u]) => u.krav && u.krav[id] != null)
    .map(([eid, u]) => ({ id: eid, ...u }))
}

export function nyRunda(fro = (Date.now() & 0x7fffffff) >>> 0, hjalteId = null) {
  const h = hjalte(hjalteId)
  return { fro, niva: 1, kulor: STARTKULOR, poang: 0, klara: 0, nasta: {}, varig: { ...(h?.start || {}) }, hjalte: h?.id || null, omslag: 1, slag: 0 }
}

export const arBonus = (niva) => niva % BONUS_VAR === 0

// Banan med nummer niva i rundan. Gröna pinnar gör det hjälten gör.
export function rundaBana(runda) {
  const { fro, niva } = runda
  if (arBonus(niva)) {
    const k = niva / BONUS_VAR - 1
    const d = BONUS[k % BONUS.length]
    return { ...hamtaBonus(d.id, Math.floor(k / BONUS.length) + (fro % 4)), iRunda: true }
  }
  // svårigheten räknar bara de vanliga banorna
  const vanlig = niva - Math.floor(niva / BONUS_VAR)
  const b = genereraBana((Math.imul(fro, 1009) + niva * 7919) >>> 0, { niva: vanlig })
  const h = hjalte(runda.hjalte)
  return h ? { ...b, kraft: h.kraft } : b
}

// Krafterna i motorn som uppgraderingarna styr.
const PERKAR = ['jatte', 'magnet', 'delning', 'bomber', 'lila', 'smalla', 'poang', 'hinkmagnet', 'meteor', 'kulregn', 'guldhink', 'fyrverkeri']

// Hur spelet ska startas för rundans nuvarande bana.
export function spelVal(runda, bana) {
  const p = runda.varig || {}
  const nasta = runda.nasta || {}
  const perk = {}
  for (const id of PERKAR) if (p[id]) perk[id] = p[id]
  const start = {
    spar: p.sikte ? 999 : nasta.spar || 0,
    eld: (p.eldkula || 0) + (nasta.eld || 0) + (bana.start?.eld || 0),
    spok: p.spoke || 0,
    trippel: nasta.trippel || 0,
  }
  const hinkBredd = HINK.bredd + 14 * (p.hink || 0)
  if (bana.bonus) return { kulor: bana.kulor || 3, hinkBredd, start, perk }
  return { kulor: runda.kulor, kulBonus: false, hinkBredd, extraGrona: p.gron || 0, start, perk }
}

// En bana är klar. kulorKvar = kulorna i banken när banan tog slut.
export function rundaKlar(runda, { poang, kulorKvar, bonus }) {
  return {
    ...runda,
    niva: runda.niva + 1,
    poang: runda.poang + poang,
    klara: runda.klara + 1,
    // bonusbanorna har egna kulor: banken rörs inte, men man får tre till
    kulor: bonus ? runda.kulor + 3 : kulorKvar + NYA_KULOR + (runda.varig?.bank || 0),
    nasta: bonus ? runda.nasta : {},
    slag: 0,
  }
}

// Kan uppgraderingen väljas nu?
export function mojlig(runda, id) {
  const u = UPPGRADERINGAR[id]
  if (!u) return false
  const n = runda.varig?.[id] || 0
  if (u.max && n >= u.max) return false
  if (u.krav) return Object.entries(u.krav).every(([k, v]) => (runda.varig?.[k] || 0) >= v)
  return true
}

function vikt(runda, id) {
  const u = UPPGRADERINGAR[id]
  const tur = runda.varig?.tur || 0
  if (u.grad === 4) return 30 // en evolution som går att få är nästan säker
  const bas = { 1: 10, 2: 6 * (1 + 0.5 * tur), 3: 3 * (1 + 0.7 * tur) }[u.grad]
  return id === 'omslag' || id === 'trippel' ? bas * 0.5 : bas
}

function dra(runda, r, antal, { direkt = true, evolution = false, utom = [] } = {}) {
  const pool = Object.keys(UPPGRADERINGAR).filter((id) => mojlig(runda, id) && (direkt || !UPPGRADERINGAR[id].direkt) && !utom.includes(id))
  const ut = []
  // en evolution som går att få kommer alltid med först
  const evo = evolution ? pool.filter((id) => UPPGRADERINGAR[id].grad === 4) : []
  if (evo.length) ut.push(pool.splice(pool.indexOf(evo[Math.floor(r() * evo.length)]), 1)[0])
  while (ut.length < antal && pool.length) {
    const vikter = pool.map((id) => vikt(runda, id))
    let x = r() * vikter.reduce((a, b) => a + b, 0)
    let i = 0
    while (i < pool.length - 1 && x >= vikter[i]) x -= vikter[i++]
    ut.push(pool.splice(i, 1)[0])
  }
  return ut
}

export const antalVal = (runda) => 3 + ((runda.varig?.tur || 0) >= 1 ? 1 : 0)

// Valen efter en bana (samma runda, bana och omslag ger samma val).
export function bonusVal(runda) {
  const r = mulberry32((runda.fro ^ Math.imul(runda.niva, 2654435761) ^ Math.imul(runda.slag || 0, 40503)) >>> 0)
  return dra(runda, r, antalVal(runda), { evolution: true })
}

// Slå om valen (kostar ett omslag).
export function slaOm(runda) {
  if (!(runda.omslag > 0)) return runda
  return { ...runda, omslag: runda.omslag - 1, slag: (runda.slag || 0) + 1 }
}

export function valjBonus(runda, id) {
  const u = UPPGRADERINGAR[id]
  if (!u || !mojlig(runda, id)) return runda
  if (id === 'kulor') return { ...runda, kulor: runda.kulor + 3 }
  if (id === 'omslag') return { ...runda, omslag: (runda.omslag || 0) + 2 }
  if (id === 'trippel') return { ...runda, nasta: { ...runda.nasta, trippel: (runda.nasta?.trippel || 0) + 2 } }
  return { ...runda, varig: { ...runda.varig, [id]: (runda.varig?.[id] || 0) + 1 } }
}

// Skattkistan efter en bonusbana: en till tre gratis uppgraderingar.
export function oppnaKista(runda) {
  const r = mulberry32((runda.fro ^ Math.imul(runda.niva + 77, 2246822519)) >>> 0)
  const tur = runda.varig?.tur || 0
  const antal = 1 + (r() < 0.35 + 0.1 * tur ? 1 : 0) + (r() < 0.1 + 0.05 * tur ? 1 : 0)
  let ny = runda
  const fick = []
  for (let i = 0; i < antal; i++) {
    const [id] = dra(ny, r, 1, { direkt: false, utom: fick })
    if (!id) break
    fick.push(id)
    ny = valjBonus(ny, id)
  }
  return { runda: ny, fick }
}

// Rundans build: uppgraderingarna man har, i ordning efter grad.
export function build(runda) {
  return Object.entries(runda.varig || {})
    .filter(([id, n]) => n > 0 && UPPGRADERINGAR[id])
    .map(([id, n]) => ({ id, n, ...UPPGRADERINGAR[id] }))
    .sort((a, b) => b.grad - a.grad)
}

export const kraftNamn = (runda) => KRAFTER[hjalte(runda.hjalte)?.kraft]?.namn || null
