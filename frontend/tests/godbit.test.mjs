// Tester för Godbiten (Cut the Rope med Happy). Kör: node frontend/tests/godbit.test.mjs
//
// Banorna ligger förgenererade i godbit/banor.json (se godbit-banor.gen.mjs).
// Testerna kollar att varje bana går att klara med tre stjärnor med den
// sparade lösningen (den som tipset spelar upp), att man inte vinner allt
// genom att göra ingenting, att allt syns på skärmen, och att reglerna i
// motorn stämmer: klipp, pendel, krokar, bubblor, luftkuddar, taggar,
// studsmattor, hattar, ekorrar, tyngdkraftsknappen, tidsstjärnor, rörliga
// hinder och att samma drag alltid ger samma resultat.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { skapaSpel, spelaPlan, STEG, W, H, FYSIK, GODBIT_R, STJARNA_R, MUN_R } from '../src/rotspel/games/godbit/motor.js'
import { los, tillPlan } from '../src/rotspel/games/godbit/losare.js'
import { mulberry32 } from '../src/rotspel/games/delat/rng.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

const BANOR = JSON.parse(readFileSync(new URL('../src/rotspel/games/godbit/banor.json', import.meta.url), 'utf8'))

// banor.js importerar JSON som en modul (Vite); här läser vi logiken direkt.
const PER_VARLD = 10
const LAS_UPP = [0, 14, 34, 58, 86, 116]
const totalStjarnor = (banor) => Object.values(banor || {}).reduce((s, n) => s + (n || 0), 0)
function oppen(nr, banor) {
  if (nr === 1) return true
  if (banor?.[nr - 1] == null) return false
  return totalStjarnor(banor) >= (LAS_UPP[Math.floor((nr - 1) / PER_VARLD)] || 0)
}

// Kör spelet steg för steg och samlar händelser.
function kor(bana, plan = [], tid = 8) {
  const s = skapaSpel(bana, { utseende: false })
  const drag = [...plan].sort((a, b) => a.t - b.t)
  const handelser = []
  const vag = []
  let i = 0
  while (s.t() < tid) {
    while (i < drag.length && drag[i].t <= s.t() + 1e-9) {
      const d = drag[i++]
      if (d.typ === 'klipp') s.klippRep(d.id)
      else if (d.typ === 'pop') s.pop()
      else if (d.typ === 'puff') s.puffa(d.id)
      else if (d.typ === 'knapp') s.knappa()
      handelser.push(...s.tomHandelser())
    }
    handelser.push(...s.steg(STEG))
    vag.push([s.godbit.x, s.godbit.y])
    if (s.status() !== 'spelar') break
  }
  return { s, handelser, vag }
}

// En liten bana att testa regler i: godbiten hänger i ett rep, Happy långt bort.
const grund = (extra = {}) => ({ godbit: { x: 180, y: 200 }, rep: [{ x: 180, y: 100 }], happy: { x: 40, y: 560 }, stjarnor: [], ...extra })

/* ------------------------------------------------------------------ banorna */

test(`banor.json: ${BANOR.length} banor i 6 världar, alla med namn, tre stjärnor, Happy och lösning`, () => {
  assert.equal(BANOR.length, 60)
  for (const [i, b] of BANOR.entries()) {
    const n = i + 1
    assert.ok(b.namn && b.namn.length <= 16, `bana ${n}: namn`)
    assert.equal(b.stjarnor.length, 3, `bana ${n}: tre stjärnor`)
    assert.ok(b.happy && Number.isFinite(b.happy.x) && Number.isFinite(b.happy.y), `bana ${n}: Happy`)
    assert.ok(Array.isArray(b.losning) && b.losning.length > 0, `bana ${n}: lösning`)
    for (let k = 1; k < b.losning.length; k++) assert.ok(b.losning[k].t >= b.losning[k - 1].t, `bana ${n}: lösningen i tidsordning`)
  }
})

test('varje bana klaras med tre stjärnor med den sparade lösningen (det tipset spelar upp)', () => {
  for (const [i, b] of BANOR.entries()) {
    const res = spelaPlan(b, b.losning)
    assert.ok(res.vann, `bana ${i + 1} ${b.namn}: lösningen vinner inte (${res.orsak})`)
    assert.equal(res.stjarnor, 3, `bana ${i + 1} ${b.namn}: lösningen tar ${res.stjarnor} stjärnor`)
  }
})

test('ingen bana ger tre stjärnor om man inte gör någonting', () => {
  for (const [i, b] of BANOR.entries()) {
    const res = spelaPlan(b, [])
    assert.ok(!(res.vann && res.stjarnor === 3), `bana ${i + 1} ${b.namn}`)
  }
})

test('allt ligger på skärmen och stjärnorna ligger inte på varandra eller på Happy', () => {
  for (const [i, b] of BANOR.entries()) {
    const n = i + 1
    const inne = (x, y, m = 0) => x >= m && x <= W - m && y >= m && y <= H - m
    assert.ok(inne(b.godbit.x, b.godbit.y, 10), `bana ${n}: godbiten`)
    assert.ok(inne(b.happy.x, b.happy.y, 30), `bana ${n}: Happy`)
    for (const s of b.stjarnor) {
      assert.ok(inne(s.x, s.y, 15), `bana ${n}: stjärna ${JSON.stringify(s)}`)
      assert.ok(Math.hypot(s.x - b.happy.x, s.y - b.happy.y) > MUN_R + STJARNA_R, `bana ${n}: stjärna på Happy`)
    }
    for (let a = 0; a < 3; a++)
      for (let c = a + 1; c < 3; c++) assert.ok(Math.hypot(b.stjarnor[a].x - b.stjarnor[c].x, b.stjarnor[a].y - b.stjarnor[c].y) >= 40, `bana ${n}: stjärnor ovanpå varandra`)
    for (const r of b.rep || []) assert.ok(inne(r.x, r.y, 5), `bana ${n}: spik`)
    if (b.knapp) assert.ok(inne(b.knapp.x, b.knapp.y, 20), `bana ${n}: knappen`)
  }
})

test('lösningen håller godbiten synlig hela vägen och använder varje sak i banan', () => {
  for (const [i, b] of BANOR.entries()) {
    const n = i + 1
    const { s, handelser, vag } = kor(b, b.losning, 14)
    assert.equal(s.status(), 'vunnit', `bana ${n}`)
    for (const [x, y] of vag.slice(0, -1)) assert.ok(x > 0 && x < W && y > 0 && y < H, `bana ${n} ${b.namn}: godbiten utanför (${x.toFixed(0)}, ${y.toFixed(0)})`)
    const typer = (t) => new Set(handelser.filter((e) => e.typ === t).map((e) => e.i))
    assert.equal(typer('krok').size, (b.krokar || []).length, `bana ${n}: alla krokar`)
    assert.equal(typer('bubbla').size, (b.bubblor || []).length, `bana ${n}: alla bubblor`)
    assert.equal(new Set(handelser.filter((e) => e.typ === 'puff' && e.traff).map((e) => e.i)).size, (b.kuddar || []).length, `bana ${n}: alla kuddar`)
    assert.equal(typer('studs').size, (b.studs || []).length, `bana ${n}: alla studsmattor`)
    assert.equal(typer('hatt').size, (b.hattar || []).length, `bana ${n}: alla hattar`)
  }
})

test('nya saker kommer en värld i taget, med en förklaring första gången', () => {
  const forsta = {}
  const sak = (b) => [
    (b.krokar || []).length && 'krok',
    (b.bubblor || []).length + (b.godbit.bubbla ? 1 : 0) && 'bubbla',
    (b.taggar || []).length && 'tagg',
    (b.kuddar || []).length && 'kudde',
    b.stjarnor.some((s) => s.tid) && 'tid',
    (b.ekorrar || []).length && 'ekorre',
    [...(b.rep || []), ...(b.taggar || []), ...(b.studs || [])].some((x) => x.rorelse) && 'rorelse',
    (b.studs || []).length && 'studs',
    (b.hattar || []).length && 'hatt',
    b.knapp && 'knapp',
  ].filter(Boolean)
  BANOR.forEach((b, i) => sak(b).forEach((k) => (forsta[k] ??= i + 1)))
  const varld = (n) => Math.floor((n - 1) / PER_VARLD) + 1
  assert.equal(varld(forsta.krok), 1)
  assert.equal(varld(forsta.bubbla), 2)
  assert.equal(varld(forsta.tagg), 2)
  assert.equal(varld(forsta.kudde), 3)
  assert.equal(varld(forsta.tid), 3)
  assert.equal(varld(forsta.ekorre), 4)
  assert.equal(varld(forsta.rorelse), 4)
  assert.equal(varld(forsta.studs), 5)
  assert.equal(varld(forsta.hatt), 5)
  assert.equal(varld(forsta.knapp), 6)
  for (const [k, n] of Object.entries(forsta)) if (k !== 'tagg' && k !== 'rorelse') assert.ok(BANOR[n - 1].tips, `bana ${n} (${k}) förklarar den nya saken`)
})

test('svårigheten: slumpade drag tar sällan tre stjärnor i världarnas sista banor', () => {
  for (let v = 0; v < 6; v++) {
    const b = BANOR[v * PER_VARLD + 9]
    const { tre } = los(b, { prov: 200, forfina: 0, fro: v + 1 })
    assert.ok(tre < 0.15, `${b.namn}: ${Math.round(tre * 100)} % av slumpade planer tar tre stjärnor`)
  }
})

test('boten hittar själv tre stjärnor i några banor (lösaren fungerar)', () => {
  for (const n of [1, 2, 4, 11, 21]) {
    const b = BANOR[n - 1]
    const r = los(b, { prov: 300, forfina: 1500, fro: n })
    assert.ok(r.res.vann && r.res.stjarnor === 3, `bana ${n}`)
    assert.deepEqual(spelaPlan(b, r.plan), r.res)
  }
})

test('18 gömda foton, på fria platser på skärmen', () => {
  const med = BANOR.filter((b) => b.foto)
  assert.equal(med.length, 18)
  for (const b of med) {
    assert.ok(b.foto.x >= 20 && b.foto.x <= W - 20 && b.foto.y >= 60 && b.foto.y <= H - 40, b.namn)
    for (const s of b.stjarnor) assert.ok(Math.hypot(s.x - b.foto.x, s.y - b.foto.y) > 40, `${b.namn}: fotot på en stjärna`)
    assert.ok(Math.hypot(b.happy.x - b.foto.x, b.happy.y - b.foto.y) > 60, `${b.namn}: fotot på Happy`)
  }
  // tre per värld
  for (let v = 0; v < 6; v++) assert.equal(med.filter((b) => Math.floor(BANOR.indexOf(b) / PER_VARLD) === v).length, 3)
})

test('banorna låses upp i ordning, och varje värld kräver stjärnor', () => {
  assert.ok(oppen(1, {}))
  assert.ok(!oppen(2, {}))
  assert.ok(oppen(2, { 1: 0 }), 'en klarad bana utan stjärnor räcker för nästa')
  const tio = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 1]))
  assert.ok(!oppen(11, tio), 'Parken kräver 14 stjärnor')
  assert.ok(oppen(11, { ...tio, 1: 3, 2: 3, 3: 3 }))
  assert.ok(LAS_UPP.every((g, i) => i === 0 || g <= i * PER_VARLD * 3 * 0.8), 'kraven går att nå utan att vara perfekt')
})

/* ------------------------------------------------------------------ motorn */

test('godbiten hänger stilla i ett rep och faller när man klipper', () => {
  const { s } = kor(grund(), [], 1)
  assert.ok(Math.abs(s.godbit.y - 200) < 3 && Math.abs(s.godbit.x - 180) < 1)
  const { s: s2, handelser } = kor(grund(), [{ t: 0.1, typ: 'klipp', id: 0 }], 0.6)
  assert.ok(handelser.some((e) => e.typ === 'klipp'))
  assert.ok(s2.godbit.y > 300 && s2.godbit.vy > 300, 'faller')
})

test('ett svep klipper de rep det korsar, och bara dem', () => {
  const s = skapaSpel(grund({ rep: [{ x: 100, y: 100 }, { x: 260, y: 100 }] }), { utseende: true })
  for (let i = 0; i < 30; i++) s.steg()
  assert.equal(s.klipp(90, 150, 130, 140), 1, 'vänstra repet')
  assert.equal(s.aktivaRep().length, 1)
  assert.equal(s.klipp(0, 20, 30, 20), 0, 'svep i luften')
  assert.equal(s.klipp(200, 150, 250, 140), 1, 'högra repet')
  assert.equal(s.aktivaRep().length, 0)
})

test('pendeln: godbiten svänger men repet blir aldrig mycket längre', () => {
  const b = grund({ godbit: { x: 290, y: 100 }, rep: [{ x: 180, y: 100 }] })
  const { vag } = kor(b, [], 4)
  const max = Math.max(...vag.map(([x, y]) => Math.hypot(x - 180, y - 100)))
  assert.ok(max < 110 * 1.08, `längsta ${max.toFixed(1)}`)
  assert.ok(Math.min(...vag.map(([x]) => x)) < 90, 'svänger över till andra sidan')
})

test('ett sträckt rep fungerar som en slangbella', () => {
  const b = grund({ godbit: { x: 180, y: 300 }, rep: [{ x: 180, y: 440, langd: 100 }, { x: 180, y: 160 }] })
  const { s } = kor(b, [{ t: 0.3, typ: 'klipp', id: 1 }], 0.5)
  assert.ok(s.godbit.vy > 500, 'skjuts nedåt mot det sträckta repets spik')
})

test('kroken: in i ringen så fäster ett nytt rep', () => {
  const b = grund({ krokar: [{ x: 180, y: 330, r: 60 }] })
  const { s, handelser } = kor(b, [{ t: 0.1, typ: 'klipp', id: 0 }], 3)
  const e = handelser.find((h) => h.typ === 'krok')
  assert.ok(e && e.rep === 1, 'nytt rep med id rep.length + krokens nummer')
  assert.equal(s.aktivaRep().length, 1)
  assert.ok(Math.hypot(s.godbit.x - 180, s.godbit.y - 330) < 60 * 1.1, 'hänger i kroken')
})

test('bubblan lyfter godbiten, och när man spräcker den faller den', () => {
  const b = grund({ godbit: { x: 180, y: 450, bubbla: true }, rep: [] })
  const s = skapaSpel(b, { utseende: false })
  for (let i = 0; i < 120; i++) s.steg()
  assert.ok(s.godbit.y < 400 && s.godbit.vy < -80, 'stiger')
  assert.ok(s.godbit.vy > -FYSIK.BUBBLA_LYFT / FYSIK.BUBBLA_DRAG - 1, 'lugnt')
  assert.equal(s.tryck(s.godbit.x + 10, s.godbit.y), 'pop', 'tryck på bubblan')
  for (let i = 0; i < 60; i++) s.steg()
  assert.ok(s.godbit.vy > 200, 'faller')
  // en godbit som faller in i en bubbla fångas
  const { handelser } = kor(grund({ bubblor: [{ x: 180, y: 330 }] }), [{ t: 0.1, typ: 'klipp', id: 0 }], 1)
  assert.ok(handelser.some((e) => e.typ === 'bubbla'))
})

test('luftkudden knuffar godbiten åt sitt håll, men bara inom räckhåll', () => {
  const b = grund({ godbit: { x: 180, y: 450, bubbla: true }, rep: [], kuddar: [{ x: 100, y: 450, vinkel: 0 }, { x: 100, y: 100, vinkel: Math.PI }] })
  const s = skapaSpel(b, { utseende: false })
  s.steg()
  assert.equal(s.tryck(100, 452), 'kudde')
  assert.ok(s.godbit.vx > 300, 'knuffad åt höger')
  const vx = s.godbit.vx
  s.puffa(1) // pekar bort från godbiten
  assert.equal(s.godbit.vx, vx)
  assert.ok(s.tomHandelser().some((e) => e.typ === 'puff' && e.i === 1 && !e.traff))
})

test('taggar: godbiten går sönder', () => {
  const b = grund({ taggar: [{ x1: 120, y1: 330, x2: 240, y2: 330 }] })
  const { s, handelser } = kor(b, [{ t: 0.1, typ: 'klipp', id: 0 }], 2)
  assert.equal(s.status(), 'forlorat')
  assert.equal(s.orsak(), 'tagg')
  assert.ok(handelser.some((e) => e.typ === 'forlust' && e.orsak === 'tagg'))
})

test('studsmattan skickar iväg godbiten med minst sin studsfart', () => {
  const b = grund({ studs: [{ x1: 120, y1: 330, x2: 240, y2: 330 }] })
  const { s, handelser } = kor(b, [{ t: 0.1, typ: 'klipp', id: 0 }], 0.8)
  assert.ok(handelser.some((e) => e.typ === 'studs'))
  const s2 = skapaSpel(b, { utseende: false })
  s2.klippRep(0)
  let fart = 0
  for (let i = 0; i < 120; i++) {
    const ev = s2.steg()
    if (ev.some((e) => e.typ === 'studs')) fart = -s2.godbit.vy
  }
  assert.ok(fart >= FYSIK.STUDS_MIN * 0.95, `studsfart ${fart.toFixed(0)}`)
  assert.ok(s.status() === 'spelar')
})

test('hattarna: in i den ena, ut ur den andra åt dess håll', () => {
  const b = grund({ hattar: [[{ x: 180, y: 360, vinkel: -Math.PI / 2 }, { x: 300, y: 120, vinkel: Math.PI / 2 }]] })
  const { s, handelser } = kor(b, [{ t: 0.1, typ: 'klipp', id: 0 }], 0.9)
  const e = handelser.find((h) => h.typ === 'hatt')
  assert.ok(e, 'teleporterad')
  assert.deepEqual(e.till, [300, 120])
  assert.ok(Math.abs(s.godbit.x - 300) < 25 && s.godbit.y > 120, 'kom ut under hatt B')
  // inte medan godbiten sitter i ett rep
  const fast = grund({ godbit: { x: 180, y: 200 }, rep: [{ x: 180, y: 140 }], hattar: [[{ x: 180, y: 205, vinkel: -Math.PI / 2 }, { x: 300, y: 120, vinkel: Math.PI / 2 }]] })
  assert.ok(!kor(fast, [], 1).handelser.some((h) => h.typ === 'hatt'))
})

test('ekorren: hinner den fram tar den godbiten, klipper man repet faller den', () => {
  const b = grund({ ekorrar: [{ rep: 0, fart: 60, vanta: 0.2 }] })
  const { s } = kor(b, [], 4)
  assert.equal(s.orsak(), 'ekorre')
  const r = kor(b, [{ t: 0.5, typ: 'klipp', id: 0 }], 1)
  assert.ok(r.handelser.some((e) => e.typ === 'ekorreFaller'))
  assert.ok(r.s.orsak() !== 'ekorre')
})

test('tyngdkraftsknappen vänder tyngdkraften (och bubblor sjunker)', () => {
  const b = grund({ rep: [], knapp: { x: 300, y: 550 } })
  const s = skapaSpel(b, { utseende: false })
  assert.equal(s.tryck(300, 552), 'knapp')
  assert.equal(s.grav(), -1)
  for (let i = 0; i < 30; i++) s.steg()
  assert.ok(s.godbit.vy < -150, 'faller uppåt')
  const bub = skapaSpel(grund({ godbit: { x: 180, y: 300, bubbla: true }, rep: [], knapp: { x: 300, y: 550 } }), { utseende: false })
  bub.knappa()
  for (let i = 0; i < 60; i++) bub.steg()
  assert.ok(bub.godbit.vy > 50, 'bubblan sjunker')
  // en bana kan börja uppochner
  const upp = skapaSpel({ ...grund({ rep: [] }), grav: -1 }, { utseende: false })
  for (let i = 0; i < 30; i++) upp.steg()
  assert.ok(upp.godbit.vy < -150)
})

test('Happy i taket äter godbiten som kommer underifrån', () => {
  const b = grund({ rep: [], happy: { x: 180, y: 90, upp: true }, knapp: { x: 300, y: 550 } })
  const { s } = kor(b, [{ t: 0.05, typ: 'knapp' }], 2)
  assert.equal(s.status(), 'vunnit')
})

test('tidsstjärnor försvinner efter sin tid', () => {
  const b = grund({ stjarnor: [{ x: 300, y: 300, tid: 1.5 }] })
  const { s, handelser } = kor(b, [], 2)
  assert.ok(handelser.some((e) => e.typ === 'stjarnaBorta'))
  assert.ok(s.stjarnor[0].borta)
  // men tar man den i tid räknas den
  const { s: s2 } = kor(grund({ stjarnor: [{ x: 180, y: 300, tid: 1.5 }] }), [{ t: 0.1, typ: 'klipp', id: 0 }], 1)
  assert.equal(s2.tagna(), 1)
})

test('rörliga spikar, taggar och krokar flyttar sig fram och tillbaka eller snurrar', () => {
  const b = grund({
    rep: [{ x: 100, y: 100, rorelse: { typ: 'glid', dx: 160, dy: 0, T: 2 } }],
    taggar: [{ x1: 20, y1: 500, x2: 120, y2: 500, rorelse: { typ: 'snurr', cx: 70, cy: 500, w: Math.PI } }],
    krokar: [{ x: 60, y: 400, r: 30, rorelse: { typ: 'glid', dx: 0, dy: -40, T: 2 } }],
  })
  const s = skapaSpel(b, { utseende: false })
  for (let i = 0; i < 120; i++) s.steg() // en halv period: spiken längst bort, taggarna har snurrat ett halvt varv
  assert.ok(Math.abs(s.rep[0].ax - 260) < 2, `spiken ${s.rep[0].ax}`)
  assert.ok(Math.abs(s.taggar[0].w[0] - 120) < 2 && Math.abs(s.taggar[0].w[2] - 20) < 2, 'snurrat')
  assert.ok(Math.abs(s.krokar[0].wy - 360) < 2, 'kroken')
  for (let i = 0; i < 120; i++) s.steg()
  assert.ok(Math.abs(s.rep[0].ax - 100) < 2, 'tillbaka')
})

test('samma drag vid samma tid ger alltid exakt samma resultat', () => {
  const r = mulberry32(7)
  for (const n of [5, 24, 38, 47, 55]) {
    const b = BANOR[n - 1]
    const plan = b.losning.map((d) => ({ ...d, t: d.t + (r() - 0.5) * 0.3 })).map((d) => ({ ...d, t: Math.max(0, Math.round(d.t / STEG) * STEG) }))
    const a = kor(b, plan, 10)
    const c = kor(b, plan, 10)
    assert.deepEqual(a.vag, c.vag, `bana ${n}`)
    assert.deepEqual(spelaPlan(b, plan), spelaPlan(b, plan))
  }
  assert.deepEqual(tillPlan({ rep: [1, null], pop: [0.5], puff: [[2]], knapp: [] }).map((d) => d.typ), ['pop', 'klipp', 'puff'])
})

test('Happy äter bara det som når munnen', () => {
  const b = grund({ happy: { x: 180, y: 420 } })
  const { s, handelser } = kor(b, [{ t: 0.1, typ: 'klipp', id: 0 }], 2)
  assert.equal(s.status(), 'vunnit')
  assert.ok(handelser.some((e) => e.typ === 'mums'))
  const mis = grund({ happy: { x: 180 + MUN_R + GODBIT_R + 4, y: 420 } })
  assert.notEqual(kor(mis, [{ t: 0.1, typ: 'klipp', id: 0 }], 2).s.status(), 'vunnit')
})

console.log(`\n${passed} tester ok`)
