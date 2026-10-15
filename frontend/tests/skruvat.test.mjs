// Tester för Skruvat. Kör: node frontend/tests/skruvat.test.mjs
//
// Banorna 1–200 ligger förgenererade i skruv/banor.json (se
// skruvat-banor.gen.mjs). Testerna kollar att varje bana har tre skruvar per
// låda och färg, att plattor i samma lager inte överlappar, att den sparade
// lösningen vinner, att hindren kommer i rätt takt, att det krävs tänkande
// (en "rytmklickare" vinner sällan senare) och att reglerna stämmer:
// plattor ovanpå blockerar, lådor fylls och byts, reservskruvar hoppar in,
// fulla hål = förlust, is, rep, lås och bomber.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { genereraBana, avkoda, koda, skapaSpel, parametrar, smartBot, rytmChans, spelaOrdning, reservBehov, RESERV, HAL_PER_LADA } from '../src/rotspel/games/skruv/engine.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

const RADER = JSON.parse(readFileSync(new URL('../src/rotspel/games/skruv/banor.json', import.meta.url), 'utf8'))
const BANA = (n) => avkoda(n, RADER[n - 1])

const ruta = (g) => (g.r != null ? { x0: g.cx - g.r, x1: g.cx + g.r, y0: g.cy - g.r, y1: g.cy + g.r } : g)

test(`banor.json: ${RADER.length} banor, tre skruvar per låda, inga överlapp, lösningen vinner`, () => {
  assert.equal(RADER.length, 200)
  for (let n = 1; n <= RADER.length; n++) {
    const b = BANA(n)
    const p = parametrar(n)
    assert.equal(b.svar, p.svar, `bana ${n}: svårighet`)
    assert.equal(b.skruvar.length, b.lador.length * HAL_PER_LADA, `bana ${n}`)
    const antal = new Map()
    for (const k of b.skruvar) antal.set(k.f, (antal.get(k.f) || 0) + 1)
    const lador = new Map()
    for (const f of b.lador) lador.set(f, (lador.get(f) || 0) + 1)
    for (const [f, n2] of lador) assert.equal(antal.get(f), n2 * HAL_PER_LADA, `bana ${n}: färg ${f}`)
    const punkter = new Set()
    for (const k of b.skruvar) {
      const pk = `${k.i},${k.j}`
      assert.ok(!punkter.has(pk), `bana ${n}: två skruvar på samma ställe`)
      punkter.add(pk)
    }
    const s = skapaSpel(b)
    for (let i = 0; i < s.plattor.length; i++) {
      for (let j = i + 1; j < s.plattor.length; j++) {
        const a = s.plattor[i]
        const c = s.plattor[j]
        if (a.z !== c.z) continue
        const ra = ruta(a.geo)
        const rc = ruta(c.geo)
        const over = ra.x0 < rc.x1 && rc.x0 < ra.x1 && ra.y0 < rc.y1 && rc.y0 < ra.y1
        assert.ok(!over, `bana ${n}: plattor i samma lager överlappar`)
      }
    }
    const res = spelaOrdning(b, b.losning)
    assert.ok(res.vann, `bana ${n}: lösningen vinner inte`)
    assert.ok(res.maxReserv <= RESERV - 1, `bana ${n}: lösningen fyller reservhålen`)
  }
})

test('kodningen går fram och tillbaka', () => {
  for (const n of [1, 17, 64, 150]) assert.deepEqual(koda(BANA(n)), RADER[n - 1])
})

test('en tänkande spelare (utan facit) klarar banorna', () => {
  for (let n = 1; n <= 200; n += 7) assert.ok(smartBot(BANA(n)), `bana ${n}`)
})

test('det krävs tänkande: en rytmklickare vinner sällan efter de första banorna', () => {
  let tidig = 0
  let sen = 0
  for (let n = 1; n <= 3; n++) tidig += rytmChans(BANA(n), 6, n)
  for (let n = 40; n < 60; n++) sen += rytmChans(BANA(n), 4, n)
  assert.ok(tidig / 3 >= 0.5, `de första banorna ska vara lätta (${tidig / 3})`)
  assert.ok(sen / 20 <= 0.35, `rytmklickaren vinner för ofta på 40–59 (${sen / 20})`)
})

test('hindren kommer i rätt takt', () => {
  const har = (n, f) => BANA(n).skruvar.some(f)
  for (let n = 1; n < 8; n++) assert.ok(!har(n, (k) => k.rep != null), `bana ${n} har rep för tidigt`)
  for (let n = 1; n < 12; n++) assert.ok(!har(n, (k) => k.is > 0), `bana ${n} har is för tidigt`)
  for (let n = 1; n < 16; n++) assert.ok(!har(n, (k) => k.last), `bana ${n} har lås för tidigt`)
  for (let n = 1; n < 22; n++) assert.ok(!har(n, (k) => k.bomb > 0), `bana ${n} har bomb för tidigt`)
  let is = 0
  let rep = 0
  for (let n = 12; n <= 60; n++) is += har(n, (k) => k.is > 0) ? 1 : 0
  for (let n = 8; n <= 60; n++) rep += har(n, (k) => k.rep != null) ? 1 : 0
  assert.ok(is >= 35, `bara ${is} av 49 banor har is`)
  assert.ok(rep >= 35, `bara ${rep} av 53 banor har rep`)
  // rep sitter ihop parvis
  for (let n = 8; n <= 200; n += 5) {
    const b = BANA(n)
    for (const [id, k] of b.skruvar.entries()) if (k.rep != null) assert.equal(b.skruvar[k.rep].rep, id, `bana ${n}: repet är inte parvis`)
  }
})

test('banor över 200 görs i webbläsaren, deterministiskt', () => {
  const a = genereraBana(230)
  const b = genereraBana(230)
  assert.deepEqual(a, b)
  assert.ok(spelaOrdning(a, a.losning).vann)
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

test('rep: lossar man en skruv följer den andra med', () => {
  const s = skapaSpel({
    plattor: [stav(0, 0, 4, 0), stav(0, 2, 4, 2)],
    skruvar: [{ ...skruv(0, 0, 0, 0), rep: 1 }, { ...skruv(1, 0, 2, 0), rep: 0 }, skruv(0, 4, 0, 0), skruv(1, 4, 2, 1), skruv(0, 2, 0, 1), skruv(1, 2, 2, 1)],
    lador: [0, 1],
    reserv: RESERV,
  })
  const res = s.tryck(0)
  assert.equal(res.losta.length, 2)
  assert.equal(s.skruvar[1].kvar, false)
})

test('lås och nyckel: låsta skruvar går först när nyckelskruven är borta', () => {
  const s = skapaSpel({
    plattor: [stav(0, 0, 4, 0), stav(0, 2, 4, 2)],
    skruvar: [{ ...skruv(0, 0, 0, 0), last: true }, skruv(0, 4, 0, 0), { ...skruv(1, 0, 2, 0), nyckel: true }, skruv(1, 4, 2, 1), skruv(0, 2, 0, 1), skruv(1, 2, 2, 1)],
    lador: [0, 1],
    reserv: RESERV,
  })
  assert.equal(s.tryck(0).typ, 'lasad')
  const r = s.tryck(2)
  assert.ok(r.handelser.some((e) => e.typ === 'upplast' && e.ids.includes(0)))
  assert.equal(s.tryck(0).typ, 'loss')
})

test('bomb: räknar ner för varje lossad skruv, kvar vid noll = förlust', () => {
  const s = skapaSpel({
    plattor: [stav(0, 0, 4, 0), stav(0, 2, 4, 2)],
    skruvar: [{ ...skruv(0, 0, 0, 1), bomb: 2 }, skruv(0, 4, 0, 0), skruv(1, 0, 2, 0), skruv(1, 4, 2, 0), skruv(0, 2, 0, 1), skruv(1, 2, 2, 1)],
    lador: [0, 1],
    reserv: RESERV,
  })
  const r1 = s.tryck(1)
  assert.ok(r1.handelser.some((e) => e.typ === 'bomb' && e.id === 0 && e.kvar === 1))
  const r2 = s.tryck(2)
  assert.equal(r2.forlorat, true)
  assert.equal(s.orsak(), 'bomb')
})

test('spara/ladda återställer allt (ångra)', () => {
  const b = BANA(30)
  const s = skapaSpel(b)
  for (const id of b.losning.slice(0, 6)) s.tryck(id)
  const st = s.spara()
  const fore = JSON.stringify([s.skruvar.map((k) => k.kvar), s.reserv, s.aktiva.map((l) => l && [l.f, l.fyllda]), s.drag()])
  for (const id of b.losning.slice(6, 12)) if (s.skruvar[id].kvar) s.tryck(id)
  s.ladda(st)
  const efter = JSON.stringify([s.skruvar.map((k) => k.kvar), s.reserv, s.aktiva.map((l) => l && [l.f, l.fyllda]), s.drag()])
  assert.equal(efter, fore)
  // och lösningen vinner fortfarande därifrån
  for (const id of b.losning.slice(6)) if (s.skruvar[id].kvar) s.tryck(id)
  assert.equal(s.status(), 'vunnit')
})

test('en låda framme från bana 3 (oftast), två på de allra första', () => {
  assert.equal(BANA(1).aktiva, 2)
  assert.equal(BANA(2).aktiva, 2)
  let en = 0
  for (let n = 3; n <= 40; n++) en += BANA(n).aktiva === 1 ? 1 : 0
  assert.ok(en >= 20, `bara ${en} banor med en låda`)
})

console.log(`\n${passed} test ok`)
