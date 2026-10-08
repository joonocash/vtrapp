// Pixelkanon — gör banor av bilderna. Ingen DOM.
//
// En bana = en bild + grisar i köer. Varje färg delas upp på grisar så att
// ammo totalt är exakt lika med antalet kuber i den färgen. Grisarna ställs
// i ungefär den ordning de behövs: bilden "skalas" från utsidan och in, och
// en gris som behövs tidigt hamnar långt fram. Lite slump gör det klurigt.
//
// Varje bana spelas av boten (engine.js) innan den används. Klarar boten
// den inte med marginal byggs den om med mindre slump.

import { BILDER, HAPPY } from './bilder.js'
import { spelaBot, SLOTS, KAPACITET } from './engine.js'
import { slump, blanda, klamp } from '../delat/rng.js'
import { svarighet } from '../delat/svarighet.js'

const TECKEN = '0123456789abcdefghijkl'
export const HAPPY_VAR = 7 // var sjunde bana är en Happy-bild

export function bildFor(niva) {
  const svar = svarighet(niva)
  if (niva % HAPPY_VAR === 0) {
    const i = (niva / HAPPY_VAR - 1) % HAPPY.length
    return { typ: 'happy', index: i, id: HAPPY[i].id, rader: HAPPY[i].rader, namn: 'Happy', fil: HAPPY[i].fil }
  }
  const i = (niva - 1 - Math.floor(niva / HAPPY_VAR)) % BILDER.length
  let steg = niva <= 6 ? 0 : niva <= 24 ? 1 : 2
  if (svar === 'svår') steg = Math.min(2, steg + 1)
  if (svar === 'supersvår') steg = 2
  const storlek = [16, 20, 24][steg]
  const b = BILDER[i]
  return { typ: 'emoji', index: i, id: b.id, rader: b.storlekar[storlek], namn: b.namn }
}

export function parametrar(niva) {
  const svar = svarighet(niva)
  return {
    svar,
    kolumner: niva <= 3 ? 2 : niva <= 14 ? 3 : 4,
    ammo: klamp(Math.round(9 + niva * 0.3), 9, 22) * (svar === 'normal' ? 1 : 1.3) * (niva % HAPPY_VAR === 0 ? 1.4 : 1),
    brus: niva <= 3 ? 0.4 : klamp(0.8 + niva * 0.05, 0.8, 4) + (svar === 'normal' ? 0 : 1.5),
    dolda: niva < 12 ? 0 : klamp(0.12 + niva * 0.002, 0.12, 0.3),
    lankar: niva < 20 ? 0 : klamp(Math.floor((niva - 10) / 12), 1, 3),
    marginal: svar === 'supersvår' ? 0 : 1,
    kap: KAPACITET,
    slots: SLOTS,
  }
}

const cache = new Map()

export function byggBana(niva) {
  if (cache.has(niva)) return cache.get(niva)
  const bild = bildFor(niva)
  const p = parametrar(niva)
  const h = bild.rader.length
  const w = bild.rader[0].length
  const kuber = []
  for (const rad of bild.rader) for (const ch of rad) kuber.push(ch === '.' ? -1 : TECKEN.indexOf(ch))

  const lager = skala(kuber, w, h)
  let bana = null
  for (let forsok = 0; forsok < 12 && !bana; forsok++) {
    const r = slump('pixelkanon', niva, forsok)
    const brus = Math.max(0, p.brus * (1 - forsok / 8))
    const kolumner = gorGrisar(kuber, lager, w, h, p, r, brus, forsok < 8)
    const kandidat = { niva, svar: p.svar, w, h, kuber, kolumner, kap: p.kap, slots: p.slots, bild }
    const res = spelaBot(kandidat)
    if (res.vann && res.maxSlots <= p.slots - p.marginal) bana = kandidat
  }
  if (!bana) {
    // Nödutgång: helt sorterat, inga dolda eller länkade.
    const r = slump('pixelkanon-nod', niva)
    bana = { niva, svar: p.svar, w, h, kuber, kolumner: gorGrisar(kuber, lager, w, h, { ...p, dolda: 0, lankar: 0 }, r, 0, false), kap: p.kap, slots: p.slots, bild }
  }
  cache.set(niva, bana)
  return bana
}

// Skalar bilden utifrån: varje varv tas alla kuber som går att träffa bort.
// Ger varje kubs "lager" (0 = ytterst).
export function skala(kuber0, w, h) {
  const kuber = Int16Array.from(kuber0)
  const lager = new Int16Array(w * h).fill(-1)
  let kvar = kuber.reduce((s, v) => s + (v >= 0 ? 1 : 0), 0)
  for (let varv = 0; kvar > 0 && varv < 999; varv++) {
    const ta = new Set()
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) if (kuber[y * w + x] >= 0) { ta.add(y * w + x); break }
      for (let x = w - 1; x >= 0; x--) if (kuber[y * w + x] >= 0) { ta.add(y * w + x); break }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) if (kuber[y * w + x] >= 0) { ta.add(y * w + x); break }
      for (let y = h - 1; y >= 0; y--) if (kuber[y * w + x] >= 0) { ta.add(y * w + x); break }
    }
    for (const i of ta) {
      lager[i] = varv
      kuber[i] = -1
      kvar--
    }
  }
  return lager
}

function gorGrisar(kuber, lager, w, h, p, r, brus, medKrangel) {
  const perFarg = new Map()
  for (let i = 0; i < kuber.length; i++) {
    if (kuber[i] < 0) continue
    if (!perFarg.has(kuber[i])) perFarg.set(kuber[i], [])
    perFarg.get(kuber[i]).push(lager[i])
  }
  const grisar = []
  for (const [f, lagren] of perFarg) {
    lagren.sort((a, b) => a - b)
    const n = lagren.length
    const m = Math.max(1, Math.round(n / p.ammo))
    let pos = 0
    for (let j = 0; j < m; j++) {
      const ammo = Math.floor(n / m) + (j < n % m ? 1 : 0)
      const forst = lagren[pos]
      const sist = lagren[pos + ammo - 1]
      grisar.push({ f, ammo, behov: forst + 0.35 * (sist - forst) + r() * brus })
      pos += ammo
    }
  }
  grisar.sort((a, b) => a.behov - b.behov)
  const kolumner = Array.from({ length: p.kolumner }, () => [])
  for (const g of grisar) {
    const minst = Math.min(...kolumner.map((k) => k.length))
    const kand = kolumner.map((k, i) => [k, i]).filter(([k]) => k.length === minst)
    const [k] = kand[Math.floor(r() * kand.length)]
    k.push({ f: g.f, ammo: g.ammo, behov: g.behov })
  }
  if (medKrangel) {
    // Dolda grisar (syns först när de kommer längst fram).
    for (const k of kolumner) for (let d = 1; d < k.length; d++) if (r() < p.dolda) k[d].dold = true
    // Länkade par på samma djup i kolumner bredvid varandra.
    const par = []
    for (let c = 0; c + 1 < kolumner.length; c++) {
      const djup = Math.min(kolumner[c].length, kolumner[c + 1].length)
      for (let d = 1; d < djup; d++) {
        const a = kolumner[c][d]
        const b = kolumner[c + 1][d]
        if (a.lank == null && b.lank == null && Math.abs(a.behov - b.behov) < 2.5) par.push([a, b])
      }
    }
    blanda(par, r)
    let lank = 1
    for (const [a, b] of par.slice(0, p.lankar)) {
      if (a.lank != null || b.lank != null) continue
      a.lank = b.lank = lank++
    }
  }
  for (const k of kolumner) for (const g of k) delete g.behov
  return kolumner
}
