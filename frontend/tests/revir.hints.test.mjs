// Tester för tipsen i Happys revir. Kör: node frontend/tests/revir.hints.test.mjs
// Löser många bräden med bara tipsen och kontrollerar att inget tips någonsin är fel.
import assert from 'node:assert/strict'
import { generate } from '../src/rotspel/games/revir/engine.js'
import { findHint } from '../src/rotspel/games/revir/hints.js'
import { NAMES } from '../src/rotspel/games/revir/config.js'

let passed = 0
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name) }
const isSol = (st, i) => st.solution[(i / st.n) | 0] === i % st.n

function solveWithHints(n, seed) {
  const P = generate(n, seed)
  const st = { ...P, names: NAMES.slice(0, n), cells: new Array(n * n).fill(0) }
  let steps = 0, fallbacks = 0, dogs = 0
  while (dogs < n) {
    assert.ok(steps++ < 500, 'tipsen fastnade')
    const h = findHint(st, () => 0)
    assert.ok(h, 'inget tips trots olöst bräde')
    assert.ok(h.text && h.text.length > 10)
    if (h.fallback) fallbacks++
    for (const i of h.unmark || []) { assert.equal(st.cells[i], 1); assert.ok(isSol(st, i)); st.cells[i] = 0 }
    for (const i of h.cross || []) { assert.ok(!isSol(st, i), `tipset ville kryssa en lösningsruta: ${h.text}`); st.cells[i] = 1 }
    if (h.place != null) { assert.ok(isSol(st, h.place), `tipset pekade på fel ruta: ${h.text}`); st.cells[h.place] = 3; dogs++ }
  }
  return { steps, fallbacks }
}

for (const n of [6, 8, 10]) {
  test(`${n}×${n}: 25 bräden löses med bara tips, inget tips är fel`, () => {
    let fb = 0, steps = 0
    for (let s = 1; s <= 25; s++) { const r = solveWithHints(n, s * 104729 + n); fb += r.fallbacks; steps += r.steps }
    console.log(`    ${steps} steg, ${fb} reservtips`)
    assert.ok(fb <= 10, 'för många reservtips — logiken hittar för lite')
  })
}

test('ett felaktigt kryss på en lösningsruta upptäcks först', () => {
  const P = generate(8, 7)
  const st = { ...P, names: NAMES.slice(0, 8), cells: new Array(64).fill(0) }
  const i = 3 * 8 + P.solution[3]
  st.cells[i] = 1
  const h = findHint(st)
  assert.deepEqual(h.unmark, [i])
})

test('tipsen använder revirnamnen', () => {
  const P = generate(6, 99)
  const names = ['Soffan', 'Matskålen', 'Hallmattan', 'Parken', 'Sängen', 'Balkongen']
  const st = { ...P, names, cells: new Array(36).fill(0) }
  let found = false
  for (let k = 0; k < 40 && !found; k++) {
    const h = findHint(st, () => 0)
    if (!h) break
    if (h.units.some((u) => u.type === 'region') && names.some((nm) => h.text.includes(nm))) found = true
    for (const i of h.cross || []) st.cells[i] = 1
    if (h.place != null) st.cells[h.place] = 3
  }
  assert.ok(found)
})

console.log(`\n${passed} tester gick igenom`)
