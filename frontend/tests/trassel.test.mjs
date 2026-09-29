// Tester för Trassel. Kör: node frontend/tests/trassel.test.mjs
//
// Kollar att varje bana som skeppas har exakt en lösning och att den sparade
// lösningen är den, att generatorn är deterministisk, och att spelmotorn
// beter sig som Flow (klipp, återställ, backa, vinst, perfekt, tips, ångra).

import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { parseLevel, decodeSolution, levelKey } from '../src/rotspel/games/trassel/board.js'
import { solve } from '../src/rotspel/games/trassel/solver.js'
import { generate } from '../src/rotspel/games/trassel/generator.js'
import { mulberry32 } from '../src/rotspel/games/trassel/rng.js'
import { createGame } from '../src/rotspel/games/trassel/game.js'
import { dailyFor, streak, dateStr, unlocked } from '../src/rotspel/games/trassel/store.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const BANOR = path.join(here, '../src/rotspel/games/trassel/banor')

let passed = 0
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name) }

function allLevels() {
  const out = []
  const read = (f) => (existsSync(path.join(BANOR, f)) ? JSON.parse(readFileSync(path.join(BANOR, f), 'utf8')) : null)
  const paket = read('paket.json')
  if (paket) for (const p of paket) p.banor.forEach((lv, i) => out.push([`${p.id} ${i + 1}`, lv]))
  const dagliga = read('dagliga.json')
  if (dagliga) dagliga.forEach((d, di) => d.banor.forEach((lv, i) => out.push([`dag ${di}:${i}`, lv])))
  const tj = read('tidsjakt.json')
  if (tj) for (const [size, list] of Object.entries(tj)) list.forEach((lv, i) => out.push([`tidsjakt ${size}:${i}`, lv]))
  return out
}

// Spelar en färg längs lösningen, nod för nod, som en spelare skulle dra.
function drawPath(game, p) {
  assert.equal(game.begin(p[0]) >= 0, true)
  for (let i = 1; i < p.length; i++) game.stepTo(p[i])
  return game.end()
}

const levels = allLevels()

test(`alla ${levels.length} skeppade banor: lösningen täcker brädet och är den enda`, () => {
  assert.ok(levels.length > 0, 'inga banor hittades — kör trassel-banor.gen.mjs')
  const keys = new Set()
  for (const [name, lv] of levels) {
    const B = parseLevel(lv)
    const paths = decodeSolution(B, lv.s)
    const seen = new Uint8Array(B.N)
    paths.forEach((p, k) => {
      assert.ok(B.ends[k].includes(p[0]) && B.ends[k].includes(p[p.length - 1]) && p[0] !== p[p.length - 1], `${name}: färg ${k} går inte mellan sina prickar`)
      for (const v of p) { assert.equal(seen[v], 0, `${name}: nod ${v} används två gånger`); seen[v] = 1 }
    })
    assert.ok(seen.every((x) => x === 1), `${name}: lösningen lämnar tomma rutor`)
    const res = solve(B, { limit: 2, maxNodes: 200000 })
    assert.ok(!res.aborted, `${name}: lösaren gav upp`)
    assert.equal(res.count, 1, `${name}: ${res.count} lösningar`)
    const k = levelKey(lv)
    assert.ok(!keys.has(k), `${name}: dubblett`)
    keys.add(k)
  }
})

test('generatorn: samma frö ger samma bana, och banan är unik', () => {
  const cfgs = [
    { w: 6, h: 6, colors: [5, 6] },
    { w: 7, h: 7, colors: [5, 7], bridges: [1, 2] },
    { w: 7, h: 7, colors: [5, 7], warpRows: [1, 1], warpCols: [1, 1] },
    { w: 7, h: 7, colors: [5, 7], blocks: [2, 3], walls: [2, 3] },
  ]
  for (const cfg of cfgs) {
    const a = generate(cfg, mulberry32(42))
    const b = generate(cfg, mulberry32(42))
    assert.ok(a, `ingen bana för ${JSON.stringify(cfg)}`)
    assert.deepEqual(a, b)
    const res = solve(parseLevel(a), { limit: 2 })
    assert.equal(res.count, 1)
  }
})

test('lösaren med och utan framåtblick är överens', () => {
  for (const [name, lv] of levels.slice(0, 120)) {
    const B = parseLevel(lv)
    const a = solve(B, { limit: 2, lookahead: false, maxNodes: 200000 })
    const b = solve(B, { limit: 2, lookahead: true })
    assert.equal(a.count, b.count, name)
    assert.deepEqual(a.solution, b.solution, name)
  }
})

test('motorn: lösningen dragen färg för färg vinner, perfekt', () => {
  for (const [name, lv] of levels.filter((_, i) => i % 7 === 0)) {
    const g = createGame(lv)
    for (const p of g.solution()) {
      const r = drawPath(g, p)
      assert.ok(r.changed && r.connected, `${name}: färgen kopplades inte`)
    }
    const s = g.status()
    assert.ok(s.won, `${name}: ingen vinst`)
    assert.ok(s.perfect, `${name}: inte perfekt`)
    assert.equal(s.fillPct, 100)
  }
})

// Litet handgjort bräde för Flow-reglerna:
//   a . b
//   . . .
//   a . b
const tiny = { w: 3, h: 3, g: 'a.b...a.b', s: '000000000' }
const at = (x, y) => y * 3 + x // inga broar, så nod = ruta

test('motorn: klipp en annan färg och backa ut igen, den kommer tillbaka', () => {
  const g = createGame(tiny)
  drawPath(g, [at(0, 0), at(1, 0), at(1, 1), at(1, 2), at(0, 2)])
  assert.ok(g.complete(0))
  g.begin(at(2, 0))
  assert.equal(g.stepTo(at(1, 0)), 'cut')
  assert.deepEqual(g.paths[0], [at(0, 0)])
  assert.equal(g.stepTo(at(2, 0)), 'shrink')
  assert.deepEqual(g.paths[0], [at(0, 0), at(1, 0), at(1, 1), at(1, 2), at(0, 2)], 'klippet ska återställas')
  const r = g.end()
  assert.equal(r.changed, false)
  // Nu klipper vi på riktigt och släpper.
  g.begin(at(2, 0))
  g.stepTo(at(1, 0))
  g.end()
  assert.deepEqual(g.committed[0], [], 'en ensam prick räknas som ingen linje')
  assert.ok(g.undo())
  assert.ok(g.complete(0))
})

test('motorn: kan inte gå in i en annan färgs prick, klar linje kan bara backas', () => {
  const g = createGame(tiny)
  g.begin(at(0, 0))
  g.stepTo(at(1, 0))
  assert.equal(g.stepTo(at(2, 0)), 'blocked')
  g.stepTo(at(1, 1)); g.stepTo(at(1, 2))
  assert.equal(g.stepTo(at(0, 2)), 'connect')
  assert.equal(g.stepTo(at(0, 1)), 'blocked', 'klar linje kan inte fortsätta')
  assert.equal(g.stepTo(at(2, 2)), null, 'inte granne till huvudet')
  assert.equal(g.stepTo(at(1, 2)), 'shrink')
  g.end()
  assert.equal(g.complete(0), false)
})

test('motorn: drag räknas per färgbyte, tips ger aldrig perfekt', () => {
  const lv = levels.find(([, l]) => l.w === 5)[1]
  const g = createGame(lv)
  const S = g.solution()
  // Rita färg 0 i två omgångar: räknas som ett drag.
  g.begin(S[0][0]); g.stepTo(S[0][1]); g.end()
  g.begin(S[0][1]); for (let i = 2; i < S[0].length; i++) g.stepTo(S[0][i]); g.end()
  assert.equal(g.status().moves, 1)
  const k = g.hint()
  assert.ok(k > 0)
  for (let j = 1; j < S.length; j++) if (j !== k) drawPath(g, S[j])
  const s = g.status()
  assert.ok(s.won)
  assert.equal(s.perfect, false)
  assert.equal(s.hints, 1)
})

test('broar: två färger korsar varandra i samma ruta', () => {
  const lv = levels.find(([, l]) => l.g.includes('+'))
  if (!lv) return
  const g = createGame(lv[1])
  for (const p of g.solution()) drawPath(g, p)
  assert.ok(g.status().won)
  const B = g.B
  const c = lv[1].g.indexOf('+')
  const own = g.owner()
  assert.ok(own[B.nodeH[c]] >= 0 && own[B.nodeV[c]] >= 0, 'båda filerna på bron ska vara fyllda')
})

test('portaler: en linje går ut på ena sidan och in på den andra', () => {
  const lv = levels.find(([, l]) => l.wr && l.wr.length)
  if (!lv) return
  const g = createGame(lv[1])
  const B = g.B
  const row = lv[1].wr[0]
  const right = B.nodeH[row * B.w + B.w - 1]
  // Kanten österut från högerkanten ska leda till vänsterkanten på samma rad.
  const dest = g.neighborInDir(right, 0)
  if (B.kind[row * B.w] !== 1) assert.equal(B.nodeCell[dest], row * B.w)
})

test('Dagens: samma bana hela dagen, veckodagen väljer tema, dagar i rad räknas', () => {
  const pools = Array.from({ length: 7 }, (_, i) => ({ tema: `t${i}`, banor: ['a', 'b', 'c'].map((x) => `${i}${x}`) }))
  const mon = new Date(2026, 8, 28, 8, 0) // måndag
  const monLate = new Date(2026, 8, 28, 23, 59)
  assert.equal(dailyFor(pools, mon).level, dailyFor(pools, monLate).level)
  assert.equal(dailyFor(pools, mon).tema, 't0')
  assert.equal(dailyFor(pools, new Date(2026, 8, 29)).tema, 't1')
  assert.equal(dailyFor(pools, new Date(2026, 9, 4)).tema, 't6') // söndag
  // Nästa måndag: ny bana ur samma hög
  assert.notEqual(dailyFor(pools, new Date(2026, 9, 5)).level, dailyFor(pools, mon).level)
  const s = { dagar: { [dateStr(new Date(2026, 8, 27))]: 1, [dateStr(new Date(2026, 8, 28))]: 1 } }
  assert.equal(streak(s, new Date(2026, 8, 28)), 2)
  assert.equal(streak(s, new Date(2026, 8, 29)), 2, 'i går räknas fortfarande')
  assert.equal(streak(s, new Date(2026, 8, 30)), 0)
})

test('banor låses upp: högst två olösta före', () => {
  const pack = { id: 'p', banor: new Array(10).fill(0) }
  const s = { stars: {} }
  assert.deepEqual([0, 1, 2, 3].map((i) => unlocked(s, pack, i)), [true, true, true, false])
  s.stars['p:0'] = 1
  assert.equal(unlocked(s, pack, 3), true)
  assert.equal(unlocked(s, pack, 4), false)
})

console.log(`\n${passed} test ok`)
