// Tester för Happys revir-motorn. Kör: node frontend/tests/revir.engine.test.mjs
import assert from 'node:assert/strict'
import { generate, countSolutions, isValidSolution, placeDogs, mulberry32, hashStr } from '../src/rotspel/games/revir/engine.js'

let passed = 0
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name) }

function connected(n, g, rg) {
  const cells = [...Array(n * n).keys()].filter((i) => g[i] === rg)
  const seen = new Set([cells[0]]), st = [cells[0]]
  while (st.length) {
    const c = st.pop(), y = (c / n) | 0, x = c % n
    for (const d of [y > 0 ? c - n : -1, y < n - 1 ? c + n : -1, x > 0 ? c - 1 : -1, x < n - 1 ? c + 1 : -1])
      if (d >= 0 && g[d] === rg && !seen.has(d)) { seen.add(d); st.push(d) }
  }
  return seen.size === cells.length
}

for (const n of [6, 8, 10]) {
  test(`${n}×${n}: 30 bräden har exakt en lösning, och den är den sparade`, () => {
    for (let s = 1; s <= 30; s++) {
      const P = generate(n, s * 7919 + n)
      assert.equal(P.regions.length, n * n)
      assert.equal(new Set(P.regions).size, n, 'fel antal revir')
      assert.ok(P.regions.every((r) => r >= 0 && r < n), 'ruta utan revir')
      for (let r = 0; r < n; r++) assert.ok(connected(n, P.regions, r), `revir ${r} är inte sammanhängande`)
      assert.ok(isValidSolution(n, P.regions, P.solution), 'sparad lösning bryter mot reglerna')
      const out = []
      assert.equal(countSolutions(n, P.regions, 2, out), 1, 'inte unik')
      assert.deepEqual(out, P.solution)
    }
  })
}

test('samma seed ger samma bräde (Dagens revir)', () => {
  const seed = hashStr('happy-revir-2026-09-22')
  assert.deepEqual(generate(8, seed), generate(8, seed))
  assert.notDeepEqual(generate(8, seed).regions, generate(8, seed + 1).regions)
})

test('placeDogs: en per rad och kolumn, ingen nuddar grannraden', () => {
  for (let s = 0; s < 50; s++) {
    const p = placeDogs(8, mulberry32(s))
    assert.equal(new Set(p).size, 8)
    for (let y = 1; y < 8; y++) assert.ok(Math.abs(p[y] - p[y - 1]) > 1)
  }
})

test('isValidSolution fångar diagonalgrannar, dubbla kolumner och dubbla revir', () => {
  const P = generate(8, 42)
  const bad1 = [...P.solution]; [bad1[0], bad1[1]] = [bad1[1], bad1[0]]
  assert.equal(isValidSolution(8, P.regions, bad1), false)
  const bad2 = [...P.solution]; bad2[1] = bad2[0]
  assert.equal(isValidSolution(8, P.regions, bad2), false)
  const regs = new Array(64).fill(0).map((_, i) => (i < 8 ? 1 : 0))
  assert.equal(isValidSolution(8, regs, P.solution), false)
})

test('generering är snabb nog för att köras i webbläsaren (10×10 under 1 s i snitt)', () => {
  const t = Date.now()
  for (let s = 0; s < 10; s++) generate(10, 1000 + s)
  assert.ok((Date.now() - t) / 10 < 1000)
})

console.log(`\n${passed} tester gick igenom`)
