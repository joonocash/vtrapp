// Happys revir — effektnivå.
//
// Mobiler orkar inte lika många partiklar och ritoperationer per bildruta som en
// dator. I stället för att dra ner för alla, eller fråga spelaren, körs spelet i
// två nivåer:
//
//   hog nivå  (lag = false)  full mängd partiklar, full upplösning
//   lag nivå  (lag = true)   färre partiklar, lägre canvas-upplösning, 30 fps bakgrund
//
// Nivån sätts på två sätt:
//   1. en gissning direkt vid start, utifrån vad enheten säger om sig själv
//   2. en mätning under körning — om bildrutorna faktiskt blir långa går spelet
//      ner till låg nivå och stannar där resten av sessionen
//
// Ingen väg tillbaka upp med flit: att växla fram och tillbaka mitt i en
// animation ser värre ut än att ligga kvar på den lägre nivån.

// Gissningen. Två svaga kärnor eller lite minne räcker, och en pekskärm med
// smal skärm är nästan alltid en telefon. navigator-fälten saknas i en del
// webbläsare (Safari har varken deviceMemory eller hardwareConcurrency) — då
// faller vi tillbaka på skärmen.
function gissa() {
  try {
    const karnor = navigator.hardwareConcurrency || 0
    const minne = navigator.deviceMemory || 0
    if (karnor && karnor <= 4) return true
    if (minne && minne <= 4) return true
    const grov = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const smal = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 500
    return grov && smal
  } catch {
    return false
  }
}

// Mätningen räknar långa bildrutor i ett glidande fönster. Enstaka hack händer
// på alla enheter (en bild laddas, fliken får fokus), så det krävs att en
// tredjedel av fönstret är långt innan nivån ändras.
const FONSTER = 60
const LANG_MS = 28 // ~36 fps: tydligt under 60, men inte ryckigt i sig
const GRANS = 20

export function skapaEffektniva(startLag) {
  let lag = typeof startLag === 'boolean' ? startLag : gissa()
  let prov = 0
  let langa = 0

  return {
    get lag() {
      return lag
    },
    // Anropas en gång per bildruta från bakgrundsloopen, som alltid är igång.
    // dt är millisekunder sedan förra bildrutan. Returnerar true exakt den gång
    // nivån går ner, så anroparen kan rita om det som behöver ändras.
    mat(dt) {
      if (lag) return false
      if (dt > LANG_MS) langa++
      if (++prov < FONSTER) return false
      const ner = langa >= GRANS
      prov = 0
      langa = 0
      if (ner) lag = true
      return ner
    },
  }
}

export { gissa as gissaLagEffekt }
