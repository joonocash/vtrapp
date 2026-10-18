// Bygger Godbitens banor ur ritningarna i godbit/design.js och skriver
// godbit/banor.json.
//
//   node frontend/tests/godbit-banor.gen.mjs          (alla banor)
//   node frontend/tests/godbit-banor.gen.mjs 3 7      (bara 3–7, skriver inte filen)
//
// En ritning är en bana utan stjärnor och Happy plus den tänkta lösningen
// (vilka rep som klipps och när). Generatorn spelar lösningen och lägger
// stjärnorna och Happy längs godbitens väg, där ritningen säger. Då går den
// tänkta lösningen alltid med tre stjärnor. Sedan mäts banan:
//   marginal  hur stor del av lösningarna med lite darr på tiderna (±0,1 s)
//             som fortfarande tar tre stjärnor — hur exakt man måste vara
//   slump     hur stor del av helt slumpade planer som vinner
// och boten (losare.js) letar en egen lösning som extra kontroll. Banor där
// tänkt lösning inte vinner, eller som blir för knivskarpa, stoppas.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { DESIGN } from '../src/rotspel/games/godbit/design.js'
import { skapaSpel, spelaPlan, STEG, W, H } from '../src/rotspel/games/godbit/motor.js'
import { los } from '../src/rotspel/games/godbit/losare.js'
import { mulberry32 } from '../src/rotspel/games/delat/rng.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const UT = path.join(here, '../src/rotspel/games/godbit/banor.json')

const r1 = (v) => Math.round(v)

// Spelar planen och returnerar godbitens väg [{t, x, y, vx, vy}].
export function bana(design, plan) {
  const s = skapaSpel({ ...design, happy: { x: -999, y: -999 }, stjarnor: [] }, { utseende: false })
  const drag = [...plan].sort((a, b) => a.t - b.t)
  const vag = []
  vag.krokar = new Set()
  vag.bubblor = new Set()
  vag.kuddar = new Set()
  vag.studs = new Set()
  vag.hattar = new Set()
  let i = 0
  while (s.status() === 'spelar' && s.t() < 12) {
    while (i < drag.length && drag[i].t <= s.t() + 1e-9) {
      const d = drag[i++]
      if (d.typ === 'klipp') s.klippRep(d.id)
      else if (d.typ === 'pop') s.pop()
      else if (d.typ === 'puff') s.puffa(d.id)
      else if (d.typ === 'knapp') s.knappa()
    }
    for (const e of s.steg(STEG)) {
      if (e.typ === 'krok') vag.krokar.add(e.i)
      if (e.typ === 'bubbla') vag.bubblor.add(e.i)
      if (e.typ === 'puff' && e.traff) vag.kuddar.add(e.i)
      if (e.typ === 'studs') vag.studs.add(e.i)
      if (e.typ === 'hatt') vag.hattar.add(e.i)
    }
    const g = s.godbit
    vag.push({ t: s.t(), x: g.x, y: g.y, vx: g.vx, vy: g.vy })
  }
  return vag
}

function punktVid(vag, t) {
  let bast = vag[0]
  for (const p of vag) if (Math.abs(p.t - t) < Math.abs(bast.t - t)) bast = p
  return bast
}

// Var godbiten kommer ner till Happys höjd (eller null om den inte gör det
// snyggt: åker ut, går sönder eller hamnar utanför planen).
function landning(d, plan) {
  const vag = bana(d, plan)
  const upp = Boolean(d.happy.upp)
  const fran = d.happy.t ?? 0
  const y = d.happy.y
  for (const p of vag) {
    // godbiten ska synas hela vägen
    if (p.x < 10 || p.x > W - 10 || p.y < 10 || p.y > H - 10) return null
    if (p.t < fran) continue
    if (upp ? p.y <= y : p.y >= y) {
      if (p.x < 45 || p.x > W - 45) return null
      // alla krokar ska användas på vägen (om inte ritningen säger annat)
      const behov = d.krokarValfria ? 0 : (d.krokar || []).length
      if (vag.krokar.size < behov) return null
      // och alla bubblor
      if (!d.bubblorValfria && vag.bubblor.size < (d.bubblor || []).length) return null
      // och varje kudde ska träffa minst en gång
      if (vag.kuddar.size < (d.kuddar || []).length) return null
      // studsmattor och hattar likaså
      if (vag.studs.size < (d.studs || []).length) return null
      if (vag.hattar.size < (d.hattar || []).length) return null
      return { x: p.x, t: p.t, vag }
    }
  }
  return null
}

// Fria tider i planen (drag med ett fönster [lo, hi]) väljs så att godbiten
// landar inom planen — mitt i det längsta intervallet som fungerar, så att
// man har så stor marginal som möjligt, eller så nära happy.mal som går.
function optimera(d) {
  const plan = d.plan.map((x) => ({ ...x }))
  const fria = plan.map((x, i) => (x.fonster ? i : -1)).filter((i) => i >= 0)
  for (let varv = 0; varv < 2; varv++) {
    for (const i of fria) {
      const [lo, hi] = plan[i].fonster
      const ok = []
      for (let t = lo; t <= hi + 1e-9; t += 0.02) {
        plan[i].t = t
        ok.push(landning(d, plan))
      }
      let bastI = -1
      if (d.happy.mal != null) {
        let bv = Infinity
        ok.forEach((l, k) => {
          if (l && Math.abs(l.x - d.happy.mal) < bv) {
            bv = Math.abs(l.x - d.happy.mal)
            bastI = k
          }
        })
      } else {
        let langst = 0
        let start = -1
        for (let k = 0; k <= ok.length; k++) {
          if (k < ok.length && ok[k]) {
            if (start < 0) start = k
          } else if (start >= 0) {
            if (k - start > langst) {
              langst = k - start
              bastI = Math.floor((start + k - 1) / 2)
            }
            start = -1
          }
        }
      }
      plan[i].t = bastI >= 0 ? lo + bastI * 0.02 : (lo + hi) / 2
    }
  }
  return plan.map(({ fonster, ...x }) => ({ ...x, t: Math.round(x.t / STEG) * STEG })).sort((a, b) => a.t - b.t)
}

export function bygg(d) {
  const plan = optimera(d)
  const l = landning(d, plan)
  const vag = l ? l.vag : bana(d, plan)
  const slut = l ? l.t : vag[vag.length - 1].t
  let happy
  if (d.happy.x != null) happy = { x: d.happy.x, y: d.happy.y, ...(d.happy.upp ? { upp: true } : {}) }
  else happy = { x: r1(l ? l.x : W / 2), y: r1(d.happy.y), ...(d.happy.upp ? { upp: true } : {}) }
  // Stjärnorna läggs längs vägen, men aldrig ovanpå varandra, starten eller
  // Happy, och aldrig där godbiten kommer av sig själv om man inte gör
  // någonting (då tar man dem gratis): är platsen dålig flyttas stjärnan
  // framåt längs vägen.
  const lagda = []
  const avSigSjalv = bana(d, []).filter((p) => p.t < 8)
  const fritt = (p) =>
    avSigSjalv.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 34) &&
    Math.hypot(p.x - d.godbit.x, p.y - d.godbit.y) >= 45 &&
    Math.hypot(p.x - happy.x, p.y - happy.y) >= 55 &&
    p.x >= 22 && p.x <= W - 22 && p.y >= 40 &&
    lagda.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 48)
  const stjarnor = d.stjarnor.map((s) => {
    if (s.x != null) {
      lagda.push(s)
      return { x: s.x, y: s.y, ...(s.tid ? { tid: s.tid } : {}) }
    }
    let t = s.f != null ? slut * s.f : s.efter != null ? plan[s.efter].t + s.dt : s.t
    let p = punktVid(vag, t)
    while (!fritt(p) && t < slut) {
      t += STEG * 2
      p = punktVid(vag, t)
    }
    // marg: stjärnan försvinner så här många sekunder efter att godbiten
    // passerar den i den tänkta lösningen
    const tid = s.marg != null ? Math.ceil((p.t + s.marg) * 2) / 2 : s.tid
    const st = { x: r1(p.x + (s.dx || 0)), y: r1(p.y + (s.dy || 0)), ...(tid ? { tid } : {}) }
    lagda.push(st)
    return st
  })
  const ut = { ...d, stjarnor, happy }
  delete ut.plan
  return { bana: ut, plan }
}

// Hur exakt måste man vara? Darr på alla tider samtidigt.
export function marginal(b, plan, { forsok = 40, darr = 0.1, fro = 1 } = {}) {
  const r = mulberry32(fro)
  let ok = 0
  for (let i = 0; i < forsok; i++) {
    const p = plan.map((x) => ({ ...x, t: Math.max(0, x.t + (r() * 2 - 1) * darr) }))
    const res = spelaPlan(b, p)
    if (res.vann && res.stjarnor === b.stjarnor.length) ok++
  }
  return ok / forsok
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fran = Number(process.argv[2] || 1)
  const till = Number(process.argv[3] || DESIGN.length)
  const ut = []
  let fel = 0
  for (let n = fran; n <= till; n++) {
    const d = DESIGN[n - 1]
    const { bana: b, plan } = bygg(d)
    const res = spelaPlan(b, plan)
    const m = marginal(b, plan, { fro: n })
    const bot = los(b, { prov: 300, forfina: 1200, fro: n })
    const ok = res.vann && res.stjarnor === b.stjarnor.length
    if (!ok) fel++
    console.log(
      String(n).padStart(2),
      d.namn.padEnd(16),
      ok ? 'ok  ' : 'FEL ',
      `tänkt ${res.vann ? 'vinst' : res.orsak} ${res.stjarnor}★`,
      `marginal ${Math.round(m * 100)}%`,
      `slump ${Math.round(bot.vinst * 100)}%/${Math.round(bot.tre * 100)}%`,
      `bot ${bot.res.vann ? bot.res.stjarnor + '★' : '–'}`
    )
    ut.push({ ...b, losning: plan.map((x) => ({ ...x, t: +x.t.toFixed(4) })) })
  }
  if (fran === 1 && till === DESIGN.length) {
    if (fel) console.log(`\n${fel} banor går inte — skriver inte filen`)
    else {
      writeFileSync(UT, '[\n' + ut.map((b) => JSON.stringify(b)).join(',\n') + '\n]\n')
      console.log('skrev', UT)
    }
  }
}
