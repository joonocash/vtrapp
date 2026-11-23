// Tester för WoW-flikens formatering. Kör: node frontend/tests/wow-format.test.mjs
import assert from 'node:assert/strict'
import {
  pengar, tal, timmar, sedan, datumKort, saljtakt, sparkPunkter, grafSkala, heatFarg, flip, kopparFran, kvalitetsfarg,
  parsePris, prisText, pengarAxel,
} from '../src/wow/format.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

test('pengar', () => {
  assert.equal(pengar(12345), '1g 23s')
  assert.equal(pengar(300), '3s')
  assert.equal(pengar(57), '57c')
  assert.equal(pengar(0), '0c')
  assert.equal(pengar(130000, { tecken: true }), '+13g')
  assert.equal(pengar(-5000), '−50s')
  assert.equal(pengar(null), '–')
})

test('tal och timmar', () => {
  assert.equal(tal(17400), '17 400')
  assert.equal(tal(1234567.4), '1 234 567')
  assert.equal(timmar(2.25), '2 h 15 min')
  assert.equal(timmar(0.5), '30 min')
  assert.equal(timmar(3), '3 h')
})

test('tider', () => {
  const nu = Date.parse('2026-11-23T12:00:00Z')
  assert.equal(sedan('2026-11-23T11:59:30Z', nu), 'nyss')
  assert.equal(sedan('2026-11-23T11:48:00Z', nu), '12 min sedan')
  assert.equal(sedan('2026-11-21T12:00:00Z', nu), '2 dagar sedan')
  assert.equal(datumKort('2027-01-14', new Date('2027-01-01T12:00:00Z')), '14 jan')
  assert.equal(datumKort('2027-11-02', new Date('2026-11-23T12:00:00Z')), '2 nov 2027')
})

test('säljtakt', () => {
  assert.equal(saljtakt(140), '~140/dag')
  assert.equal(saljtakt(2.5), '~2,5/dag')
  assert.equal(saljtakt(0.2), 'säljer sällan')
  assert.equal(saljtakt(null), '')
})

test('sparkline hoppar över dagar utan pris', () => {
  const { punkter, sista } = sparkPunkter([10, null, 20, 5], 100, 28)
  assert.equal(punkter.split(' ').length, 3)
  assert.equal(sista.x, 97)
  assert.equal(sista.y, 25) // lägst pris längst ner
  assert.deepEqual(sparkPunkter([null, null], 100, 28), { punkter: '', sista: null })
})

test('grafskala delar skala mellan husen', () => {
  const s = grafSkala({ a: [['2026-11-01T00:00:00Z', 100], ['2026-11-02T00:00:00Z', 200]], b: [['2026-11-01T12:00:00Z', 150]] }, 600, 240)
  assert.ok(s.linjer.a.startsWith('56.0,'))
  assert.equal(s.linjer.b.split(' ').length, 1)
  assert.ok(s.y(200) < s.y(100))
  assert.equal(grafSkala({ a: [] }, 600, 240), null)
})

test('värmekarta, flip och guld', () => {
  assert.equal(heatFarg(0.9, 0.9, 1.1), 'rgba(91,141,255,1.00)')
  assert.equal(heatFarg(1.1, 0.9, 1.1), 'rgba(91,141,255,0.08)')
  assert.equal(flip({ kop: 3800, salj: 6000, antal: 20 }).vinst, 120000 - 6000 - 76000)
  assert.equal(flip({ kop: 100, salj: 100, antal: 1, avgift: 0.15 }).avgift, 15)
  assert.equal(kopparFran(1, 50), 15000)
  assert.equal(kvalitetsfarg('uncommon'), '#1eff00')
  assert.equal(kvalitetsfarg(undefined), '#eceff6')
})

test('prisfält', () => {
  assert.equal(parsePris('1g 20s'), 12000)
  assert.equal(parsePris('38s'), 3800)
  assert.equal(parsePris('38'), 3800)
  assert.equal(parsePris('2,5'), 250)
  assert.equal(parsePris('57c'), 57)
  assert.equal(parsePris('1g20s5c'), 12005)
  assert.equal(parsePris('hej'), null)
  assert.equal(parsePris('1g hej'), null)
  assert.equal(parsePris(''), null)
  assert.equal(prisText(12000), '1g 20s')
  assert.equal(parsePris(prisText(3800)), 3800)
  assert.equal(pengarAxel(6312), '63s')
  assert.equal(pengarAxel(63123), '6g 30s')
})

console.log(`\n${passed} tester ok`)
