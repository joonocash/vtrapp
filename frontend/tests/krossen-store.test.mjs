// Tester för Krossens sparläge: dagliga belöningar, vinstsvit, stjärnkistan
// och sammanslagningen när samma spelare spelar på två enheter.
import assert from 'node:assert/strict'
import {
  komplettera,
  registreraVinst,
  brytSvit,
  svitBoost,
  nyDag,
  dagenFore,
  datum,
  SERIE,
  kanSnurra,
  snurra,
  taHjul,
  HJUL,
  registreraDagens,
  dagensKlar,
  DAGENS_BELONNING,
  kistStatus,
  oppnaKista,
  KISTA_VAR,
  sammanfoga,
  anvandBooster,
} from '../src/rotspel/games/krossen/store.js'
import { dagensBana, BANOR } from '../src/rotspel/games/krossen/levels.js'
import { skapaSpel, skapaRng } from '../src/rotspel/games/krossen/engine.js'

let ok = 0
function test(namn, fn) {
  fn()
  ok++
  console.log('  ok', namn)
}

test('gamla sparlägen från PR 1 får de nya fälten', () => {
  const s = komplettera({ stjarnor: { 1: 3 }, mynt: 42, boosters: { tass: 5 } })
  assert.equal(s.mynt, 42)
  assert.equal(s.boosters.tass, 5)
  assert.equal(s.boosters.byt, 2)
  assert.equal(s.svit, 0)
  assert.equal(s.dagligt.serie, 0)
})

test('datum och dagen före, även över månadsskifte', () => {
  assert.equal(dagenFore('2026-10-01'), '2026-09-30')
  assert.equal(dagenFore('2026-01-01'), '2025-12-31')
  assert.match(datum(), /^\d{4}-\d\d-\d\d$/)
})

test('inloggningsserien räknar upp, börjar om efter en missad dag och varvar efter sju', () => {
  let s = komplettera(null)
  const r1 = nyDag(s, '2026-09-30')
  assert.equal(r1.dag, 1)
  assert.equal(r1.save.mynt, s.mynt + SERIE[0].mynt)
  assert.equal(nyDag(r1.save, '2026-09-30'), null, 'samma dag ger inget')
  const r2 = nyDag(r1.save, '2026-10-01')
  assert.equal(r2.dag, 2)
  const r3 = nyDag(r2.save, '2026-10-03')
  assert.equal(r3.dag, 1, 'missad dag börjar om')
  s = r1.save
  let dag = '2026-09-30'
  for (let k = 2; k <= 8; k++) {
    dag = datum(new Date(2026, 8, 29 + k))
    const r = nyDag(s, dag)
    assert.equal(r.dag, ((k - 1) % 7) + 1)
    s = r.save
  }
  assert.equal(s.boosters.skal, 1, 'dag sju ger en godisskål')
})

test('lyckohjulet: ett snurr per dag, och vikterna följs ungefär', () => {
  let s = komplettera(null)
  assert.ok(kanSnurra(s, '2026-09-30'))
  s = taHjul(s, '2026-09-30', 0)
  assert.ok(!kanSnurra(s, '2026-09-30'))
  assert.ok(kanSnurra(s, '2026-10-01'))
  const rng = skapaRng(1)
  const rakning = new Array(HJUL.length).fill(0)
  for (let k = 0; k < 20000; k++) rakning[snurra(rng)]++
  const summa = HJUL.reduce((a, x) => a + x.vikt, 0)
  HJUL.forEach((x, k) => assert.ok(Math.abs(rakning[k] / 20000 - x.vikt / summa) < 0.02, 'sektor ' + k))
})

test('vinstsviten växer med vinster och nollställs', () => {
  let s = komplettera(null)
  assert.deepEqual(svitBoost(s), [])
  s = registreraVinst(s, 1, 3, 1000)
  assert.deepEqual(svitBoost(s), ['raket'])
  s = registreraVinst(s, 2, 1, 1000)
  s = registreraVinst(s, 3, 1, 1000)
  s = registreraVinst(s, 4, 1, 1000)
  assert.deepEqual(svitBoost(s), ['raket', 'bomb', 'skal'], 'taket är tre')
  s = brytSvit(s)
  assert.equal(s.svit, 0)
})

test('dagens bana: mynt bara första vinsten, bästa poängen sparas', () => {
  let s = komplettera(null)
  const m0 = s.mynt
  s = registreraDagens(s, '2026-09-30', 5000)
  assert.equal(s.mynt, m0 + DAGENS_BELONNING)
  assert.ok(dagensKlar(s, '2026-09-30'))
  s = registreraDagens(s, '2026-09-30', 9000)
  assert.equal(s.mynt, m0 + DAGENS_BELONNING)
  assert.equal(s.dagligt.dagensPoang, 9000)
  s = registreraDagens(s, '2026-09-30', 3000)
  assert.equal(s.dagligt.dagensPoang, 9000)
})

test('dagens bana är samma för alla och ger samma startbräde', () => {
  const a = dagensBana('2026-09-30')
  const b = dagensBana('2026-09-30')
  assert.equal(a.bas, b.bas)
  const s1 = skapaSpel(a, skapaRng(a.fro))
  const s2 = skapaSpel(b, skapaRng(b.fro))
  assert.deepEqual(
    s1.tiles.map((t) => t && t.farg),
    s2.tiles.map((t) => t && t.farg)
  )
  const olika = new Set()
  for (let d = 1; d <= 20; d++) olika.add(dagensBana(`2026-10-${String(d).padStart(2, '0')}`).bas)
  assert.ok(olika.size > 8, 'olika dagar ger olika banor')
  assert.ok(a.bas > 20 && BANOR[a.bas - 1])
})

test('stjärnkistan: en per tjugo stjärnor, går inte att öppna två gånger', () => {
  let s = komplettera(null)
  for (let k = 1; k <= 7; k++) s = registreraVinst(s, k, 3, 1000)
  assert.equal(kistStatus(s).redo, 1)
  assert.equal(kistStatus(s).mot, 21 - KISTA_VAR)
  const r = oppnaKista(s, skapaRng(3))
  assert.equal(r.innehall.length, 3)
  assert.ok(r.save.mynt >= s.mynt + 60)
  assert.equal(oppnaKista(r.save), null)
  assert.equal(kistStatus(r.save).redo, 0)
})

test('synken tar de bästa stjärnorna från båda och låter inte datum gå bakåt', () => {
  const telefon = komplettera({
    stjarnor: { 1: 3, 2: 1 },
    poang: { 1: 9000 },
    mynt: 100,
    kistor: 1,
    dagligt: { inloggad: '2026-09-30', hjul: '2026-09-30', serie: 3 },
    uppdaterad: 1000,
  })
  const dator = komplettera({
    stjarnor: { 1: 2, 2: 3, 3: 1 },
    poang: { 1: 5000, 3: 2000 },
    mynt: 250,
    kistor: 0,
    dagligt: { inloggad: '2026-09-29', hjul: null, serie: 2 },
    uppdaterad: 2000,
  })
  const ihop = sammanfoga(telefon, dator)
  assert.deepEqual(ihop.stjarnor, { 1: 3, 2: 3, 3: 1 })
  assert.deepEqual(ihop.poang, { 1: 9000, 3: 2000 })
  assert.equal(ihop.mynt, 250, 'mynten från den senaste')
  assert.equal(ihop.kistor, 1, 'öppnade kistor går aldrig bakåt')
  assert.equal(ihop.dagligt.inloggad, '2026-09-30', 'dagen går inte bakåt')
  assert.equal(ihop.dagligt.hjul, '2026-09-30', 'hjulet kan inte snurras två gånger')
  assert.equal(nyDag(ihop, '2026-09-30'), null)
  assert.deepEqual(sammanfoga(dator, telefon).stjarnor, ihop.stjarnor, 'ordningen spelar ingen roll')
})

test('boosters: först förrådet, sedan mynt, annars nej', () => {
  let s = komplettera({ mynt: 70, boosters: { tass: 1 } })
  s = anvandBooster(s, 'tass')
  assert.equal(s.boosters.tass, 0)
  assert.equal(s.mynt, 70)
  s = anvandBooster(s, 'tass')
  assert.equal(s.mynt, 10)
  assert.equal(anvandBooster(s, 'tass'), null)
})

console.log(`krossen-store: ${ok} tester gick igenom`)
