// Tester för Skruvat. Kör: node frontend/tests/skruvat.test.mjs
//
// Kollar att varje bana har tre skruvar per låda och färg, att plattor i
// samma lager inte överlappar, att den sparade lösningen vinner utan att
// fylla reservhålen, och att reglerna stämmer: plattor ovanpå blockerar,
// lådor fylls och byts, reservskruvar hoppar in, fulla hål = förlust.

import assert from 'node:assert/strict'
import { genereraBana, skapaSpel, girigBot, reservBehov, RESERV, HAL_PER_LADA } from '../src/rotspel/games/skruv/engine.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

const BANOR = 150

test(`bana 1–${BANOR}: tre skruvar per låda, inga överlapp, lösningen vinner`, () => {
  for (let n = 1; n <= BANOR; n++) {
    const b = genereraBana(n)
    assert.ok(b, `bana ${n} saknas`)
    assert.equal(b.skruvar.length, b.lador.length * HAL_PER_LADA, `bana ${n}`)
    const antal = new Map()
    for (const k of b.skruvar) antal.set(k.f, (antal.get(k.f) || 0) + 1)
    const lador = new Map()
    for (const f of b.lador) lador.set(f, (lador.get(f) || 0) + 1)
    for (const [f, n2] of lador) assert.equal(antal.get(f), n2 * HAL_PER_LADA, `bana ${n}: färg ${f}`)
    const punkter = new Set()
    for (const k of b.skruvar) {
      const p = `${k.i},${k.j}`
      assert.ok(!punkter.has(p), `bana ${n}: två skruvar på samma ställe`)
      punkter.add(p)
    }
    const s = skapaSpel(b)
    for (let i = 0; i < s.plattor.length; i++) {
      for (let j = i + 1; j < s.plattor.length; j++) {
        const a = s.plattor[i]
        const c = s.plattor[j]
        if (a.z !== c.z) continue
        const ra = a.geo.r != null ? { x0: a.geo.cx - a.geo.r, x1: a.geo.cx + a.geo.r, y0: a.geo.cy - a.geo.r, y1: a.geo.cy + a.geo.r } : a.geo
        const rc = c.geo.r != null ? { x0: c.geo.cx - c.geo.r, x1: c.geo.cx + c.geo.r, y0: c.geo.cy - c.geo.r, y1: c.geo.cy + c.geo.r } : c.geo
        const over = ra.x0 < rc.x1 && rc.x0 < ra.x1 && ra.y0 < rc.y1 && rc.y0 < ra.y1
        assert.ok(!over, `bana ${n}: plattor i samma lager överlappar`)
      }
    }
    let max = 0
    for (const id of b.losning) {
      const res = s.tryck(id)
      assert.ok(res && res.typ === 'loss', `bana ${n}: lösningens skruv ${id} går inte att lossa`)
      max = Math.max(max, s.reserv.filter(Boolean).length)
    }
    assert.equal(s.status(), 'vunnit', `bana ${n}: lösningen vinner inte`)
    assert.ok(max <= RESERV - 1, `bana ${n}: lösningen fyller reservhålen`)
  }
})

test('vanliga banor upp till 80 klaras av en girig spelare', () => {
  for (let n = 1; n <= 80; n++) {
    const b = genereraBana(n)
    if (b.svar === 'normal') assert.ok(girigBot(b), `bana ${n}`)
  }
})

test('generatorn är deterministisk', () => {
  for (const n of [1, 8, 30, 77]) assert.deepEqual(genereraBana(n), genereraBana(n))
})

const stav = (i0, j0, i1, j1, z = 0) => ({ typ: 'stav', i0, j0, i1, j1, z })
const skruv = (platta, i, j, f) => ({ platta, i, j, f })

test('en platta ovanpå blockerar, och faller när sista skruven går', () => {
  // Liggande stav i botten med skruvar i (0,0) och (2,0). En stående stav
  // ovanpå täcker (2,0) och har en egen skruv i (2,2).
  const s = skapaSpel({
    plattor: [stav(0, 0, 2, 0, 0), stav(2, 0, 2, 2, 1)],
    skruvar: [skruv(0, 0, 0, 0), skruv(0, 2, 0, 0), skruv(1, 2, 2, 0)],
    lador: [0],
    reserv: RESERV,
  })
  assert.equal(s.blockerad(0), false)
  assert.equal(s.blockerad(1), true)
  assert.equal(s.tryck(1).typ, 'last')
  const res = s.tryck(2)
  assert.equal(res.foll, 1, 'övre staven faller')
  assert.equal(s.blockerad(1), false)
  s.tryck(1)
  assert.equal(s.tryck(0).vunnit, true)
})

test('lådor fylls och byts, skruven går till lådan som har flest', () => {
  const s = skapaSpel({
    plattor: [{ typ: 'platta', i0: 0, j0: 0, i1: 1, j1: 1, z: 0 }, stav(3, 0, 4, 0)],
    skruvar: [skruv(0, 0, 0, 1), skruv(0, 1, 0, 0), skruv(0, 0, 1, 0), skruv(0, 1, 1, 0), skruv(1, 3, 0, 1), skruv(1, 4, 0, 1)],
    lador: [0, 1],
    reserv: RESERV,
  })
  const a = s.tryck(4)
  assert.equal(a.mal.typ, 'lada')
  assert.equal(a.mal.slot, 1)
  s.tryck(1)
  s.tryck(2)
  const full = s.tryck(3)
  assert.ok(full.handelser.some((e) => e.typ === 'ladaKlar' && e.slot === 0))
  assert.equal(s.aktiva[0], null, 'inga fler lådor i kön')
  s.tryck(0)
  assert.equal(s.tryck(5).vunnit, true)
})

test('reservskruvar flyttar in när en låda i deras färg kommer fram', () => {
  const s = skapaSpel({
    plattor: [stav(0, 0, 4, 0), stav(0, 2, 4, 2), stav(0, 4, 4, 4)],
    skruvar: [
      skruv(0, 0, 0, 2), skruv(0, 2, 0, 0), skruv(0, 4, 0, 0),
      skruv(1, 0, 2, 0), skruv(1, 2, 2, 2), skruv(1, 4, 2, 2),
      skruv(2, 0, 4, 1), skruv(2, 2, 4, 1), skruv(2, 4, 4, 1),
    ],
    lador: [0, 1, 2],
    reserv: RESERV,
  })
  assert.equal(s.tryck(0).mal.typ, 'reserv')
  s.tryck(1)
  s.tryck(2)
  const res = s.tryck(3)
  assert.ok(res.handelser.some((e) => e.typ === 'nyLada' && e.slot === 0 && e.f === 2))
  assert.ok(res.handelser.some((e) => e.typ === 'flytt' && e.plats === 0 && e.slot === 0 && e.hal === 0))
  assert.equal(s.reserv[0], null)
  for (const id of [4, 5, 6, 7]) s.tryck(id)
  assert.equal(s.tryck(8).vunnit, true)
})

test('fulla reservhål = förlust, ett hål till = fortsätt', () => {
  // Två reservhål och två skruvar i en färg som ingen låda vill ha.
  const s = skapaSpel({
    plattor: [stav(0, 0, 4, 0), stav(0, 2, 4, 2)],
    skruvar: [skruv(0, 0, 0, 2), skruv(0, 4, 0, 2), skruv(1, 0, 2, 0), skruv(1, 4, 2, 0)],
    lador: [0, 1],
    reserv: 2,
  })
  s.tryck(0)
  const res = s.tryck(1)
  assert.equal(res.forlorat, true)
  assert.equal(s.status(), 'forlorat')
  assert.equal(s.tryck(2), null)
  s.extraHal()
  assert.equal(s.status(), 'spelar')
  assert.equal(s.tryck(2).mal.typ, 'lada')
})

test('reservbehovet räknas som i spelet (två lådor framme)', () => {
  assert.equal(reservBehov([0, 0, 0, 1, 1, 1], [0, 1]), 0)
  assert.equal(reservBehov([2, 0, 0, 0, 1, 1, 1, 2, 2], [0, 1, 2]), 1)
  assert.equal(reservBehov([0, 0, 1], [0]), null)
})

test('isad skruv går först att lossa när tillräckligt många andra lossats', () => {
  // Tre liggande stavar bredvid varandra, inget överlapp. Skruven i (0,0) har is 2.
  const s = skapaSpel({
    plattor: [stav(0, 0, 2, 0, 0), stav(0, 2, 2, 2, 0), stav(0, 4, 2, 4, 0)],
    skruvar: [{ ...skruv(0, 0, 0, 0), is: 2 }, skruv(0, 2, 0, 0), skruv(1, 0, 2, 0), skruv(1, 2, 2, 1), skruv(2, 0, 4, 1), skruv(2, 2, 4, 1)],
    lador: [0, 1],
    reserv: RESERV,
  })
  assert.equal(s.tryck(0).typ, 'is')
  assert.equal(s.kanLossa(0), false)
  const r1 = s.tryck(1)
  assert.ok(r1.handelser.some((e) => e.typ === 'spricka' && e.id === 0 && e.kvar === 1))
  const r2 = s.tryck(2)
  assert.ok(r2.handelser.some((e) => e.typ === 'tinat' && e.id === 0))
  assert.equal(s.tryck(0).typ, 'loss')
})

test('banor från 12 har is, och den sparade lösningen tar hänsyn till den', () => {
  let medIs = 0
  for (let n = 12; n <= 60; n++) if (genereraBana(n).skruvar.some((k) => k.is > 0)) medIs++
  assert.ok(medIs >= 40, `bara ${medIs} av 49 banor har is`)
  for (let n = 1; n < 12; n++) assert.ok(!genereraBana(n).skruvar.some((k) => k.is > 0), `bana ${n} har is för tidigt`)
})

console.log(`\n${passed} test ok`)
