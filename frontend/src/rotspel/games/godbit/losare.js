// Godbiten — en bot som letar lösningar. Ingen DOM.
//
// En lösning är en plan: när varje rep klipps (eller aldrig), när bubblor
// spräcks, när kuddarna puffar och när knappen trycks. Boten provar
// slumpade planer och förfinar den bästa tills den tar alla tre stjärnor.
// Testerna använder den för att visa att varje bana går med tre stjärnor,
// och spelets tips visar dess lösning.
//
// Andelen slumpade planer som vinner säger något om hur svår banan är:
// en bana där nästan allt vinner är lätt, en där bara en noggrann plan tar
// tre stjärnor är svår.

import { spelaPlan, STEG } from './motor.js'
import { mulberry32 } from '../delat/rng.js'

const avrunda = (t) => Math.max(0, Math.round(t / STEG) * STEG)

export function dragFor(bana) {
  return {
    rep: (bana.rep || []).length + (bana.krokar || []).length,
    bubblor: (bana.bubblor || []).length + (bana.godbit.bubbla ? 1 : 0),
    kuddar: (bana.kuddar || []).length,
    knapp: Boolean(bana.knapp),
  }
}

// Arvsmassan: rep[i] = tid eller null, pop = [tider], puff[k] = [tider], knapp = [tider]
function slumpGen(d, r) {
  return {
    rep: Array.from({ length: d.rep }, () => (r() < 0.85 ? avrunda(r() * 5) : null)),
    pop: Array.from({ length: d.bubblor }, () => avrunda(0.4 + r() * 6)).filter(() => r() < 0.8),
    puff: Array.from({ length: d.kuddar }, () => Array.from({ length: Math.floor(r() * 4) }, () => avrunda(r() * 6))),
    knapp: d.knapp ? Array.from({ length: Math.floor(r() * 3) }, () => avrunda(r() * 6)) : [],
  }
}

export function tillPlan(gen) {
  const plan = []
  gen.rep.forEach((t, id) => t != null && plan.push({ t, typ: 'klipp', id }))
  for (const t of gen.pop) plan.push({ t, typ: 'pop' })
  gen.puff.forEach((lista, id) => lista.forEach((t) => plan.push({ t, typ: 'puff', id })))
  for (const t of gen.knapp) plan.push({ t, typ: 'knapp' })
  return plan.sort((a, b) => a.t - b.t)
}

const kopia = (g) => ({ rep: [...g.rep], pop: [...g.pop], puff: g.puff.map((l) => [...l]), knapp: [...g.knapp] })

function mutera(gen, d, r) {
  const g = kopia(gen)
  const skjut = (t) => avrunda(t + (r() - 0.5) * (r() < 0.6 ? 0.12 : 0.9))
  const val = Math.floor(r() * 4)
  if (val === 0 && g.rep.length) {
    const i = Math.floor(r() * g.rep.length)
    if (g.rep[i] == null || r() < 0.1) g.rep[i] = g.rep[i] == null ? avrunda(r() * 5) : null
    else g.rep[i] = skjut(g.rep[i])
  } else if (val === 1 && d.bubblor) {
    if (!g.pop.length || r() < 0.2) g.pop.push(avrunda(r() * 6))
    else if (r() < 0.15) g.pop.splice(Math.floor(r() * g.pop.length), 1)
    else {
      const i = Math.floor(r() * g.pop.length)
      g.pop[i] = skjut(g.pop[i])
    }
  } else if (val === 2 && d.kuddar) {
    const k = g.puff[Math.floor(r() * g.puff.length)]
    if (!k.length || r() < 0.25) k.push(avrunda(r() * 6))
    else if (r() < 0.2) k.splice(Math.floor(r() * k.length), 1)
    else {
      const i = Math.floor(r() * k.length)
      k[i] = skjut(k[i])
    }
  } else if (val === 3 && d.knapp) {
    if (!g.knapp.length || r() < 0.25) g.knapp.push(avrunda(r() * 6))
    else if (r() < 0.25) g.knapp.splice(Math.floor(r() * g.knapp.length), 1)
    else {
      const i = Math.floor(r() * g.knapp.length)
      g.knapp[i] = skjut(g.knapp[i])
    }
  } else if (g.rep.length) {
    const i = Math.floor(r() * g.rep.length)
    if (g.rep[i] != null) g.rep[i] = skjut(g.rep[i])
  }
  return g
}

const antalDrag = (g) => g.rep.filter((t) => t != null).length + g.pop.length + g.puff.reduce((s, l) => s + l.length, 0) + g.knapp.length
const varde = (res) => (res.vann ? 100 : 0) + res.stjarnor * 10 - (res.vann ? res.tid * 0.1 : 0)

// Söker en plan. Returnerar { plan, res, vinst, tre } där vinst och tre är
// andelen slumpade planer som vann respektive tog tre stjärnor.
export function los(bana, { prov = 600, forfina = 2500, fro = 1 } = {}) {
  const r = mulberry32(fro >>> 0)
  const d = dragFor(bana)
  const maxStj = (bana.stjarnor || []).length
  let bast = null
  let bastRes = null
  let vinster = 0
  let tre = 0
  const klar = () => bastRes.vann && bastRes.stjarnor === maxStj
  for (let i = 0; i < prov; i++) {
    const gen = slumpGen(d, r)
    const res = spelaPlan(bana, tillPlan(gen))
    if (res.vann) vinster++
    if (res.vann && res.stjarnor === maxStj) tre++
    if (!bast || varde(res) > varde(bastRes)) {
      bast = gen
      bastRes = res
    }
  }
  for (let i = 0; i < forfina && !klar(); i++) {
    const gen = mutera(bast, d, r)
    const res = spelaPlan(bana, tillPlan(gen))
    const v = varde(res)
    const bv = varde(bastRes)
    if (v > bv || (v === bv && antalDrag(gen) <= antalDrag(bast))) {
      bast = gen
      bastRes = res
    }
  }
  // städa: ta bort drag som inte behövs
  if (klar()) {
    let andrat = true
    while (andrat) {
      andrat = false
      const kandidater = []
      bast.rep.forEach((t, i) => t != null && kandidater.push((g) => (g.rep[i] = null)))
      bast.pop.forEach((_, i) => kandidater.push((g) => g.pop.splice(i, 1)))
      bast.puff.forEach((l, k) => l.forEach((_, i) => kandidater.push((g) => g.puff[k].splice(i, 1))))
      bast.knapp.forEach((_, i) => kandidater.push((g) => g.knapp.splice(i, 1)))
      for (const ta of kandidater) {
        const g = kopia(bast)
        ta(g)
        const res = spelaPlan(bana, tillPlan(g))
        if (res.vann && res.stjarnor === maxStj) {
          bast = g
          bastRes = res
          andrat = true
          break
        }
      }
    }
  }
  return { plan: tillPlan(bast), res: bastRes, vinst: vinster / prov, tre: tre / prov }
}
