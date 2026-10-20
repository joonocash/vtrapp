// Pinnbollen — oändligt läge. Ingen DOM.
//
// En runda är banor som byggs av sig själva, en efter en, med kulor som
// följer med: man börjar med tio, kulorna man har kvar när en bana är klar
// följer med till nästa och man får fem nya. Var femte bana är en bonusbana
// (bonus.js) — där smäller det, och man får tre egna kulor att skjuta med.
// Efter varje vanlig bana väljer man en av tre bonusar. Rundan är slut när
// kulorna tar slut med orange kvar.

import { genereraBana } from './generator.js'
import { BONUS, hamtaBonus } from './bonus.js'
import { mulberry32 } from '../delat/rng.js'
import { HINK, STARTKULOR } from './motor.js'

export const NYA_KULOR = 5
export const BONUS_VAR = 5

// Bonusarna man väljer mellan. varig = gäller resten av rundan.
export const BONUSAR = {
  kulor: { ikon: '➕', namn: '+3 kulor', text: 'Tre kulor till, direkt' },
  spar: { ikon: '🔮', namn: 'Superspår', text: 'Långt siktspår i fem skott på nästa bana' },
  eld: { ikon: '🔥', namn: 'Eldboll', text: 'Första kulan på nästa bana bränner rakt igenom' },
  trippel: { ikon: '3×', namn: 'Trippelpoäng', text: 'Tre gånger poängen i två skott' },
  gron: { ikon: '🟢', namn: 'Grön pinne', text: 'En grön pinne till på varje bana', varig: true, max: 3 },
  hink: { ikon: '🪣', namn: 'Större hink', text: 'Hinken blir bredare resten av rundan', varig: true, max: 3 },
}

export function nyRunda(fro = (Date.now() & 0x7fffffff) >>> 0) {
  return { fro, niva: 1, kulor: STARTKULOR, poang: 0, klara: 0, nasta: {}, varig: {} }
}

export const arBonus = (niva) => niva % BONUS_VAR === 0

// Banan med nummer niva i rundan.
export function rundaBana(runda) {
  const { fro, niva } = runda
  if (arBonus(niva)) {
    const k = niva / BONUS_VAR - 1
    const d = BONUS[k % BONUS.length]
    return { ...hamtaBonus(d.id, Math.floor(k / BONUS.length) + (fro % 4)), iRunda: true }
  }
  // svårigheten räknar bara de vanliga banorna
  const vanlig = niva - Math.floor(niva / BONUS_VAR)
  return genereraBana((Math.imul(fro, 1009) + niva * 7919) >>> 0, { niva: vanlig })
}

// Hur spelet ska startas för rundans nuvarande bana.
export function spelVal(runda, bana) {
  if (bana.bonus) return { kulor: bana.kulor || 3 }
  return {
    kulor: runda.kulor,
    kulBonus: false,
    hinkBredd: HINK.bredd + 14 * (runda.varig.hink || 0),
    extraGrona: runda.varig.gron || 0,
    start: { spar: runda.nasta.spar || 0, eld: runda.nasta.eld || 0, trippel: runda.nasta.trippel || 0 },
  }
}

// En bana är klar. kulorKvar = kulorna i banken när banan tog slut.
export function rundaKlar(runda, { poang, kulorKvar, bonus }) {
  return {
    ...runda,
    niva: runda.niva + 1,
    poang: runda.poang + poang,
    klara: runda.klara + 1,
    // bonusbanorna har egna kulor: banken rörs inte, men man får tre till
    kulor: bonus ? runda.kulor + 3 : kulorKvar + NYA_KULOR,
    nasta: bonus ? runda.nasta : {},
  }
}

// Tre bonusar att välja mellan efter en bana (samma runda och bana ger samma val).
export function bonusVal(runda) {
  const r = mulberry32((runda.fro ^ (runda.niva * 2654435761)) >>> 0)
  const mojliga = Object.keys(BONUSAR).filter((id) => !BONUSAR[id].max || (runda.varig[id] || 0) < BONUSAR[id].max)
  const ut = []
  while (ut.length < 3 && mojliga.length) ut.push(mojliga.splice(Math.floor(r() * mojliga.length), 1)[0])
  return ut
}

export function valjBonus(runda, id) {
  const b = BONUSAR[id]
  if (!b) return runda
  if (id === 'kulor') return { ...runda, kulor: runda.kulor + 3 }
  if (b.varig) return { ...runda, varig: { ...runda.varig, [id]: (runda.varig[id] || 0) + 1 } }
  const mangd = id === 'spar' ? 5 : id === 'trippel' ? 2 : 1
  return { ...runda, nasta: { ...runda.nasta, [id]: (runda.nasta[id] || 0) + mangd } }
}
