// Tester för Pilflykt. Kör: node frontend/tests/pilflykt.test.mjs
//
// Kollar att varje bana går att lösa (girigt, vilket räcker eftersom en
// borttagen pil aldrig gör en annan pil sämre), att pilarna är hela och
// ligger i brädets form, att generatorn är deterministisk och att spelets
// regler stämmer: fri pil flyger ut, blockerad pil kostar ett hjärta.

import assert from 'node:assert/strict'
import { genereraBana, skapaSpel, losGirigt, DX, DY, HJARTAN } from '../src/rotspel/games/pilar/engine.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

const BANOR = 300

test(`bana 1–${BANOR}: hela pilar inne i formen, inga överlapp, lösbara, täta`, () => {
  let samstTathet = 1
  for (let n = 1; n <= BANOR; n++) {
    const b = genereraBana(n)
    const upptagen = new Set()
    let fyllt = 0
    for (const p of b.pilar) {
      assert.ok(p.celler.length >= 1, `bana ${n}: tom pil`)
      for (let i = 0; i < p.celler.length; i++) {
        const [x, y] = p.celler[i]
        assert.ok(x >= 0 && y >= 0 && x < b.w && y < b.h, `bana ${n}: pil utanför brädet`)
        assert.equal(b.mask[y * b.w + x], 1, `bana ${n}: pil utanför formen`)
        const k = `${x},${y}`
        assert.ok(!upptagen.has(k), `bana ${n}: två pilar i samma ruta`)
        upptagen.add(k)
        if (i > 0) {
          const [px, py] = p.celler[i - 1]
          assert.equal(Math.abs(px - x) + Math.abs(py - y), 1, `bana ${n}: pilen hänger inte ihop`)
        }
      }
      if (p.celler.length >= 2) {
        const [hx, hy] = p.celler[p.celler.length - 1]
        const [fx, fy] = p.celler[p.celler.length - 2]
        assert.equal(hx - fx, DX[p.dir], `bana ${n}: huvudet pekar fel`)
        assert.equal(hy - fy, DY[p.dir], `bana ${n}: huvudet pekar fel`)
      }
      fyllt += p.celler.length
    }
    const yta = b.mask.reduce((s, v) => s + v, 0)
    samstTathet = Math.min(samstTathet, fyllt / yta)
    assert.ok(losGirigt(b), `bana ${n} går inte att lösa`)
  }
  assert.ok(samstTathet >= 0.9, `för gles bana (${samstTathet.toFixed(2)})`)
})

test('generatorn är deterministisk', () => {
  for (const n of [1, 7, 33, 120]) assert.deepEqual(genereraBana(n).pilar, genereraBana(n).pilar)
})

test('fri pil flyger ut, blockerad pil kostar ett hjärta och ligger kvar', () => {
  // Två pilar på en rad: den vänstra pekar höger in i den högra.
  const bana = {
    w: 4,
    h: 1,
    mask: new Uint8Array(4).fill(1),
    pilar: [
      { celler: [[0, 0], [1, 0]], dir: 1 },
      { celler: [[2, 0], [3, 0]], dir: 1 },
    ],
  }
  const s = skapaSpel(bana)
  assert.equal(s.fri(0), false)
  assert.equal(s.fri(1), true)
  const krock = s.tryck(0)
  assert.equal(krock.typ, 'krock')
  assert.equal(krock.mot, 1)
  assert.equal(krock.steg, 0)
  assert.equal(s.hjartan(), HJARTAN - 1)
  assert.equal(s.kvar(), 2)
  const ut = s.tryck(1)
  assert.equal(ut.typ, 'ut')
  assert.equal(s.fri(0), true)
  const sista = s.tryck(0)
  assert.equal(sista.vunnit, true)
  assert.equal(s.kvar(), 0)
})

test('tre krockar = slut, extra hjärta fortsätter', () => {
  const bana = {
    w: 3,
    h: 1,
    mask: new Uint8Array(3).fill(1),
    pilar: [
      { celler: [[0, 0]], dir: 1 },
      { celler: [[1, 0], [2, 0]], dir: 1 },
    ],
  }
  const s = skapaSpel(bana)
  for (let i = 0; i < HJARTAN; i++) assert.equal(s.tryck(0).typ, 'krock')
  assert.equal(s.hjartan(), 0)
  assert.equal(s.tryck(1), null, 'inga drag efter förlust')
  s.extraHjarta()
  assert.equal(s.tryck(1).typ, 'ut')
})

test('tips pekar alltid på en fri pil', () => {
  const s = skapaSpel(genereraBana(40))
  while (s.kvar() > 0) {
    const id = s.tips()
    assert.ok(id >= 0 && s.fri(id))
    s.tryck(id)
  }
})

test('tryck nära en pil träffar den', () => {
  const b = genereraBana(15)
  const s = skapaSpel(b)
  for (const p of s.pilar) {
    const [x, y] = p.celler[0]
    assert.equal(s.pilVid(x + 0.5, y + 0.5), p.id)
  }
})

console.log(`\n${passed} test ok`)
