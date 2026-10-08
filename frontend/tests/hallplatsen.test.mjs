// Tester för Hållplatsen. Kör: node frontend/tests/hallplatsen.test.mjs
//
// Kollar att varje bana har rätt antal resenärer per färg (tre per vagn),
// att den sparade lösningen faktiskt vinner, att vanliga banor klaras av en
// girig spelare, och att reglerna stämmer: väg upp, bänken, vagnbyten,
// hemliga resenärer, is och rulltrappor.

import assert from 'node:assert/strict'
import { genereraBana, skapaSpel, girigBot, bankBehov, KAPACITET, BANK } from '../src/rotspel/games/hallplats/engine.js'
import { mulberry32 } from '../src/rotspel/games/delat/rng.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

const BANOR = 150

test(`bana 1–${BANOR}: tre resenärer per vagn och färg, lösningen vinner`, () => {
  for (let n = 1; n <= BANOR; n++) {
    const b = genereraBana(n)
    assert.ok(b, `bana ${n} saknas`)
    const antal = new Map()
    for (const c of b.celler) {
      if (!c) continue
      if (c.t === 'r') antal.set(c.f, (antal.get(c.f) || 0) + 1)
      if (c.t === 't') for (const f of c.ko) antal.set(f, (antal.get(f) || 0) + 1)
    }
    const vagnar = new Map()
    for (const f of b.vagnar) vagnar.set(f, (vagnar.get(f) || 0) + 1)
    for (const [f, n2] of vagnar) assert.equal(antal.get(f), n2 * KAPACITET, `bana ${n}: färg ${f} går inte jämnt ut`)
    assert.equal([...antal.values()].reduce((a, x) => a + x, 0), b.vagnar.length * KAPACITET)

    const s = skapaSpel(b)
    let maxBank = 0
    for (const i of b.losning) {
      const res = s.tryck(i)
      assert.ok(res && res.typ === 'gar', `bana ${n}: lösningens drag går inte`)
      maxBank = Math.max(maxBank, s.bank.filter((x) => x !== null).length)
    }
    assert.equal(s.status(), 'vunnit', `bana ${n}: lösningen vinner inte`)
    assert.ok(maxBank <= BANK - 1, `bana ${n}: lösningen fyller bänken`)
  }
})

test('vanliga banor upp till 80 klaras av en girig spelare', () => {
  for (let n = 1; n <= 80; n++) {
    const b = genereraBana(n)
    if (b.svar === 'normal') assert.ok(girigBot(b), `bana ${n}`)
  }
})

test('generatorn är deterministisk', () => {
  for (const n of [1, 9, 27, 61]) assert.deepEqual(genereraBana(n), genereraBana(n))
})

const R = (f, extra = {}) => ({ t: 'r', f, ...extra })

test('bara resenärer med fri väg upp kan gå', () => {
  //  A B
  //  C .     C når den tomma rutan men inte toppen förrän B gått
  const s = skapaSpel({ w: 2, h: 2, celler: [R(0), R(0), R(1), null], vagnar: [0, 1], bank: 5 })
  assert.ok(s.kanGa(0))
  assert.equal(s.kanGa(2), false)
  s.tryck(1)
  assert.deepEqual(s.vag(2), [2, 3, 1])
})

test('väg: instängd resenär kan inte gå förrän grannen gått', () => {
  //  A B C
  //  D E F
  const s = skapaSpel({ w: 3, h: 2, celler: [R(0), R(0), R(0), R(1), R(1), R(1)], vagnar: [0, 1], bank: 5 })
  assert.equal(s.kanGa(4), false)
  assert.equal(s.tryck(4).typ, 'blockerad')
  s.tryck(1)
  assert.ok(s.kanGa(4))
  assert.deepEqual(s.vag(4), [4, 1])
})

test('rätt färg kliver på, fel färg till bänken, bänken kliver på när vagnen kommer', () => {
  const s = skapaSpel({ w: 4, h: 2, celler: [R(1), R(0), R(0), R(0), R(1), R(1), null, null], vagnar: [0, 1], bank: 5 })
  const a = s.tryck(0)
  assert.equal(a.mal.typ, 'bank')
  s.tryck(1)
  s.tryck(2)
  const sista = s.tryck(3)
  assert.equal(sista.mal.typ, 'vagn')
  assert.ok(sista.handelser.some((e) => e.typ === 'avgang' && e.vagn === 0))
  assert.ok(sista.handelser.some((e) => e.typ === 'byte' && e.plats === 0 && e.vagn === 1))
  assert.equal(s.ombord(), 1)
  assert.equal(s.bank[0], null)
})

test('full bänk = förlust, en plats till = fortsätt', () => {
  const celler = [R(1), R(2), R(3), R(4), R(5), R(0), R(0), R(0)]
  const s = skapaSpel({ w: 8, h: 1, celler, vagnar: [0], bank: 5 })
  for (let i = 0; i < 4; i++) s.tryck(i)
  const res = s.tryck(4)
  assert.equal(res.forlorat, true)
  assert.equal(s.status(), 'forlorat')
  assert.equal(s.tryck(5), null)
  s.extraPlats()
  assert.equal(s.status(), 'spelar')
  assert.equal(s.tryck(5).mal.typ, 'vagn')
})

test('hemlig resenär syns när en granne går', () => {
  const s = skapaSpel({ w: 1, h: 2, celler: [R(0), R(1, { dold: true })], vagnar: [0, 1], bank: 5 })
  assert.equal(s.tryck(1).typ, 'last')
  const res = s.tryck(0)
  assert.ok(res.handelser.some((e) => e.typ === 'avslojd' && e.i === 1))
  assert.equal(s.celler[1].dold, false)
})

test('is smälter bara med en öppen sida, ett drag i taget', () => {
  //  A B C
  //  . I F     I är fryst (2) och har en tom granne till vänster
  const s = skapaSpel({ w: 3, h: 2, celler: [R(0), R(0), R(0), null, R(1, { is: 2 }), R(1)], vagnar: [0, 1], bank: 5 })
  assert.equal(s.kanGa(4), false)
  s.tryck(0)
  assert.equal(s.celler[4].is, 1)
  const res = s.tryck(1)
  assert.ok(res.handelser.some((e) => e.typ === 'tinat' && e.i === 4))
  assert.ok(s.kanGa(4))
})

test('rulltrappan släpper ut en resenär när rutan framför är tom', () => {
  const s = skapaSpel({ w: 2, h: 1, celler: [R(0), { t: 't', dir: 3, ko: [0, 0] }], vagnar: [0], bank: 5 })
  const res = s.tryck(0)
  assert.ok(res.handelser.some((e) => e.typ === 'rulltrappa' && e.till === 0))
  assert.equal(s.celler[0].f, 0)
  s.tryck(0)
  s.tryck(0)
  assert.equal(s.status(), 'vunnit')
})

test('lyft tar en instängd resenär rakt upp', () => {
  const s = skapaSpel({ w: 1, h: 2, celler: [R(1), R(0)], vagnar: [0, 1], bank: 5 })
  assert.equal(s.kanGa(1), false)
  const res = s.lyft(1)
  assert.equal(res.mal.typ, 'vagn')
})

test('vinka tar alla i vagnens färg var de än står, så många som får plats', () => {
  // Kolumn: röd, blå, blå (hemlig), blå, blå. Vagnar: blå, röd.
  const s = skapaSpel({ w: 1, h: 5, celler: [R(1), R(0), { t: 'r', f: 0, dold: true }, R(0), R(0)], vagnar: [0, 0, 1], bank: 5 })
  s.tryck(0) // röd till bänken
  const ut = s.vinka()
  assert.equal(ut.length, 3, 'tre platser i vagnen')
  assert.ok(ut.every((r) => r.mal.typ === 'vagn'))
  assert.deepEqual([1, 3, 4].map((i) => s.celler[i]), [null, null, null], 'de synliga togs först')
  assert.ok(s.celler[2] && s.celler[2].f === 0, 'den hemliga står kvar (och syns nu när grannen gått)')
  assert.equal(s.aktiv(), 1, 'vagnen blev full och gick')
})

test('slumpade spelare fastnar aldrig: finns resenärer kvar kan alltid någon gå', () => {
  // Spelaren tar oftast vagnens färg, annars vem som helst som kan gå. Bana
  // 113 låste sig förr när bara en isad resenär var kvar (isen smälte aldrig).
  for (let n = 100; n <= 120; n++) {
    const bana = genereraBana(n)
    for (const bank of [5, 6]) {
      for (let fro = 0; fro < 20; fro++) {
        const r = mulberry32(fro * 7919 + n)
        const s = skapaSpel({ ...bana, bank })
        for (let steg = 0; steg < 500 && s.status() === 'spelar'; steg++) {
          const kan = []
          for (let i = 0; i < s.celler.length; i++) if (s.kanGa(i)) kan.push(i)
          assert.ok(kan.length > 0, `bana ${n} (bänk ${bank}, frö ${fro}) låste sig efter ${steg} drag`)
          const aktivF = s.vagnar[s.aktiv()]
          const direkt = kan.filter((i) => s.celler[i].f === aktivF)
          const lista = direkt.length && r() < 0.85 ? direkt : kan
          s.tryck(lista[Math.floor(r() * lista.length)])
        }
      }
    }
  }
})

test('bänkbehovet räknas som i spelet', () => {
  assert.equal(bankBehov([0, 0, 0, 1, 1, 1], [0, 1]), 0)
  assert.equal(bankBehov([1, 0, 0, 0, 1, 1], [0, 1]), 1)
  assert.equal(bankBehov([0, 0, 1], [0]), null)
})

console.log(`\n${passed} test ok`)
