// Tester för Pinnbollens lägen: bonusbanorna, generatorn till oändligt läge,
// rundans regler och baneditorn. Kör: node frontend/tests/pinnboll-lagen.test.mjs

import assert from 'node:assert/strict'
import { skapaSpel, spelaSkott, botSkott, W, H, STARTKULOR, HINK } from '../src/rotspel/games/pinnboll/motor.js'
import { BONUS, hamtaBonus } from '../src/rotspel/games/pinnboll/bonus.js'
import { genereraBana } from '../src/rotspel/games/pinnboll/generator.js'
import { nyRunda, rundaBana, spelVal, rundaKlar, bonusVal, valjBonus, BONUSAR, NYA_KULOR, arBonus } from '../src/rotspel/games/pinnboll/runda.js'
import { byggEgen, dragTillObjekt, koda, avkoda, kanSpelas, dragVid, MIN_OBJEKT } from '../src/rotspel/games/pinnboll/editor.js'
import { geomAvst } from '../src/rotspel/games/pinnboll/former.js'
import { mulberry32 } from '../src/rotspel/games/delat/rng.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

// Ett skott i vinkeln v med fast tidssteg; returnerar händelserna och spelet.
function skott(b, v, fro = 1) {
  const s = skapaSpel(b, { fro })
  const h = spelaSkott(s, v, 1 / 60)
  return { s, h }
}

/* ------------------------------------------------------------ bonusbanor */

test(`${BONUS.length} bonusbanor med fasta färger, orange och gröna`, () => {
  assert.equal(BONUS.length, 6)
  for (const d of BONUS)
    for (const variant of [0, 1]) {
      const b = hamtaBonus(d.id, variant)
      assert.ok(b.bonus && b.fasta, d.id)
      assert.equal(b.kulor, 3)
      const s = skapaSpel(b, { fro: 3 })
      const or = s.objekt.filter((o) => o.farg === 'orange').length
      assert.ok(or >= 3 && or === s.antalOrange, `${d.id}: ${or} orange`)
      assert.ok(s.objekt.filter((o) => o.farg === 'gron').length >= 3, `${d.id}: gröna`)
      // färgerna är desamma oavsett slumpfrö
      const s2 = skapaSpel(b, { fro: 99 })
      assert.deepEqual(s2.objekt.filter((o) => o.farg === 'orange').map((o) => o.id), s.objekt.filter((o) => o.farg === 'orange').map((o) => o.id))
    }
})

test('bonusbanorna smäller: de flesta skott ger Extreme Fever och tänder nästan allt', () => {
  const krav = { kulbanan: 0.9, kedjan: 0.85, spiralen: 0.85, kulregnet: 0.2, eldsolen: 0.8, skateparken: 0.8 }
  for (const d of BONUS) {
    const b = hamtaBonus(d.id, 0)
    let feber = 0
    let mycket = 0
    const N = 24
    for (let i = 0; i < N; i++) {
      const v = Math.PI * (0.06 + (0.88 * i) / (N - 1))
      const { s, h } = skott(b, v)
      if (h.some((e) => e.typ === 'feberStart')) feber++
      if (h.filter((e) => e.typ === 'traff').length >= s.objekt.length * 0.6) mycket++
    }
    assert.ok(feber / N >= krav[d.id], `${d.id}: feber i ${feber} av ${N} skott`)
    assert.ok(mycket / N >= Math.min(0.8, krav[d.id]), `${d.id}: stort skott i ${mycket} av ${N}`)
  }
})

test('kedjereaktionen går som en våg: gröna smäller efter varandra, inte samtidigt', () => {
  const b = hamtaBonus('kedjan', 0)
  const s = skapaSpel(b, { fro: 1 })
  s.sikta(Math.PI / 2)
  s.skjut()
  const tider = []
  for (let i = 0; i < 60 * 40 && (s.lage === 'skjuter' || s.lage === 'feber'); i++) for (const e of s.steg(1 / 60)) if (e.typ === 'kraft') tider.push(s.t)
  assert.ok(tider.length >= 20, `${tider.length} smällar`)
  assert.ok(tider[tider.length - 1] - tider[0] > 1, 'vågen tar en stund')
  assert.ok(new Set(tider.map((t) => t.toFixed(3))).size > tider.length / 3, 'inte allt i samma ögonblick')
})

test('Kulregnet: två nya kulor per grön, aldrig fler än 40 samtidigt', () => {
  const b = hamtaBonus('kulregnet', 0)
  let mest = 0
  for (const v of [1.2, 1.57, 1.9]) {
    const s = skapaSpel(b, { fro: 2 })
    s.sikta(v)
    s.skjut()
    for (let i = 0; i < 60 * 45 && (s.lage === 'skjuter' || s.lage === 'feber'); i++) {
      s.steg(1 / 60)
      mest = Math.max(mest, s.kulor.length)
      assert.ok(s.kulor.length <= 40)
    }
  }
  assert.ok(mest >= 9, `som mest ${mest} kulor`)
})

test('Eldsolen börjar med en eldboll, och långa skott tar slut', () => {
  const s = skapaSpel(hamtaBonus('eldsolen', 0), { fro: 1 })
  assert.equal(s.eldKvar, 1)
  // skateparken: kulan gungar i halfpipen men skottet tar slut ändå
  for (const v of [0.9, 1.3, 1.57]) {
    const { s: s2 } = skott(hamtaBonus('skateparken', 1), v)
    assert.ok(s2.lage !== 'skjuter' && s2.lage !== 'feber', 'skottet tog slut')
  }
})

/* ------------------------------------------------------------ generatorn */

test('generatorn: giltiga banor, samma frö ger samma bana', () => {
  for (let i = 1; i <= 40; i++) {
    const niva = 1 + (i % 15)
    const b = genereraBana(i * 7777, { niva })
    assert.ok(b.namn && b.namn.length > 3, `namn ${b.namn}`)
    assert.ok(b.objekt.length >= 55 && b.objekt.length <= 150, `${b.namn}: ${b.objekt.length} objekt`)
    const kand = b.objekt.filter((o) => !o.ejOrange).length
    assert.ok(b.orange >= 12 && b.orange <= Math.min(25, kand), `${b.namn}: ${b.orange} orange av ${kand}`)
    for (const o of b.objekt) if (o.form === 'cirkel') assert.ok(o.x >= 14 && o.x <= W - 14 && o.y >= 92 && o.y <= 548, `${b.namn}: pinne utanför`)
    for (const g of b.grupper) assert.ok(['rotera', 'pendel', 'glid', 'bana'].includes(g.typ))
    const pinnar = b.objekt.filter((o) => o.form === 'cirkel' && o.grupp == null)
    for (let x = 0; x < pinnar.length; x++)
      for (let y = x + 1; y < pinnar.length; y++) assert.ok(geomAvst(pinnar[x], pinnar[y]) >= 2.99, `${b.namn}: pinnar omlott`)
    assert.deepEqual(genereraBana(i * 7777, { niva }), b)
  }
})

test('generatorn: svårare för varje bana, och boten klarar de första', () => {
  assert.ok(genereraBana(5, { niva: 1 }).orange < genereraBana(5, { niva: 12 }).orange)
  let rorliga = 0
  for (let i = 0; i < 20; i++) rorliga += genereraBana(i * 31, { niva: 8 }).grupper.length > 0 ? 1 : 0
  assert.ok(rorliga >= 6, `rörliga delar i ${rorliga} av 20 svåra banor`)
  assert.equal(genereraBana(9, { niva: 1 }).grupper.length, 0, 'första banan står still')
  for (const fro of [11, 22, 33]) {
    const b = genereraBana(fro, { niva: 1 + (fro % 3) })
    const s = skapaSpel(b, { fro, kulor: STARTKULOR })
    const r = mulberry32(fro)
    let k = 0
    while (s.lage === 'siktar' && k < 30) {
      spelaSkott(s, botSkott(s, { vinklar: 20, rnd: r }))
      k++
    }
    assert.equal(s.lage, 'klar', `${b.namn} (frö ${fro})`)
  }
})

/* ------------------------------------------------------------ rundan */

test('rundan: kulorna följer med, fem nya per bana, bonusbana var femte', () => {
  let r = nyRunda(42)
  assert.equal(r.kulor, STARTKULOR)
  assert.equal(rundaBana(r).bonus, undefined)
  r = rundaKlar(r, { poang: 1000, kulorKvar: 3, bonus: false })
  assert.equal(r.niva, 2)
  assert.equal(r.kulor, 3 + NYA_KULOR)
  assert.equal(r.poang, 1000)
  for (const n of [5, 10, 15]) assert.ok(arBonus(n) && rundaBana({ ...r, niva: n }).bonus, `bana ${n} är en bonusbana`)
  assert.ok(!rundaBana({ ...r, niva: 6 }).bonus)
  // bonusbanan har egna kulor och ger tre till
  const efter = rundaKlar({ ...r, niva: 5 }, { poang: 5000, kulorKvar: 0, bonus: true })
  assert.equal(efter.kulor, r.kulor + 3)
  assert.equal(spelVal(r, rundaBana({ ...r, niva: 5 })).kulor, 3)
  // samma runda ger samma banor
  assert.deepEqual(rundaBana({ ...r, niva: 7 }), rundaBana({ ...r, niva: 7 }))
  assert.notDeepEqual(rundaBana({ ...r, niva: 7 }).objekt, rundaBana({ ...r, niva: 8 }).objekt)
})

test('rundan: tre olika bonusar att välja mellan, och de gör vad de säger', () => {
  const r = nyRunda(7)
  for (let n = 1; n < 30; n++) {
    const val = bonusVal({ ...r, niva: n })
    assert.equal(val.length, 3)
    assert.equal(new Set(val).size, 3)
    for (const id of val) assert.ok(BONUSAR[id])
  }
  assert.equal(valjBonus(r, 'kulor').kulor, r.kulor + 3)
  const eld = valjBonus(r, 'eld')
  const bana = rundaBana(eld)
  const s = skapaSpel(bana, { fro: 1, ...spelVal(eld, bana) })
  assert.equal(s.eldKvar, 1)
  let hink = r
  for (let i = 0; i < 5; i++) hink = valjBonus(hink, 'hink')
  assert.equal(hink.varig.hink, 5)
  assert.ok(!bonusVal({ ...hink, varig: { hink: 3, gron: 3 } }).some((id) => id === 'hink' || id === 'gron'), 'fulla bonusar erbjuds inte')
  const s2 = skapaSpel(bana, { fro: 1, ...spelVal({ ...r, varig: { hink: 2, gron: 2 } }, bana) })
  assert.equal(s2.hinkBredd, HINK.bredd + 28)
  assert.equal(s2.objekt.filter((o) => o.farg === 'gron').length, 4)
  // ingen kulbonus i rundan (kulorna följer ju med i stället)
  assert.equal(spelVal(r, bana).kulBonus, false)
})

/* ------------------------------------------------------------ editorn */

test('editorn: raka streck blir raka rader, bågar blir bågar, kurvor följs', () => {
  const rak = dragTillObjekt({ t: 'l', k: 'pinne', pts: Array.from({ length: 30 }, (_, i) => [40 + i * 8, 200 + i * 2 + (i % 2) * 2]) })
  assert.ok(rak.length >= 9 && rak.every((o) => o.form === 'cirkel'))
  // jämnt avstånd
  const d = rak.slice(1).map((o, i) => Math.hypot(o.x - rak[i].x, o.y - rak[i].y))
  assert.ok(Math.max(...d) - Math.min(...d) < 1, 'jämnt utspridda')
  const bage = dragTillObjekt({ t: 'l', k: 'tegel', pts: Array.from({ length: 40 }, (_, i) => [180 + Math.cos(0.3 + i * 0.06) * 100, 300 + Math.sin(0.3 + i * 0.06) * 100]) })
  assert.ok(bage.length >= 5 && bage.every((o) => o.form === 'bage' && Math.abs(o.R - 100) < 3), 'tegelbåge')
  const kurva = dragTillObjekt({ t: 'l', k: 'pinne', pts: Array.from({ length: 60 }, (_, i) => [30 + i * 5, 400 + Math.sin(i / 5) * 30]) })
  assert.ok(kurva.length >= 10)
  assert.equal(dragTillObjekt({ t: 'p', x: 50, y: 300 }).length, 1)
  assert.ok(dragTillObjekt({ t: 's', form: 'hjul', x: 180, y: 300 }).rorlig, 'snurrhjulet rör sig')
})

test('editorn: spegling, städning och för små banor', () => {
  const data = { v: 1, namn: 'x', varld: 1, spegel: true, drag: [{ t: 'l', k: 'pinne', pts: [[30, 200], [150, 260]] }] }
  const b = byggEgen(data)
  const utan = byggEgen({ ...data, spegel: false })
  assert.equal(b.objekt.length, utan.objekt.length * 2)
  assert.ok(kanSpelas(utan), 'för få för att spela')
  // dubbelritat tas bort
  const dubbel = byggEgen({ ...data, spegel: false, drag: [data.drag[0], data.drag[0]] })
  assert.equal(dubbel.objekt.length, utan.objekt.length)
  const stor = byggEgen({ ...data, drag: [{ t: 's', form: 'galler', x: 100, y: 200 }, { t: 's', form: 'ring', x: 100, y: 400 }] })
  assert.ok(stor.objekt.length >= MIN_OBJEKT && kanSpelas(stor) === null)
  assert.equal(stor.kraft, 'multi', 'världen ger kraften')
  assert.equal(dragVid(data, 30, 200), 0)
  assert.equal(dragVid(data, W - 30, 200), 0, 'spegelbilden hittar samma drag')
  assert.equal(dragVid(data, 180, 500), -1)
})

test('editorn: en delad länk blir exakt samma bana', () => {
  const r = mulberry32(5)
  const drag = []
  for (let i = 0; i < 12; i++) {
    const pts = []
    let [x, y] = [30 + r() * 300, 110 + r() * 400]
    for (let k = 0; k < 20; k++) pts.push([Math.round((x += (r() - 0.5) * 30)), Math.round((y += (r() - 0.3) * 12))])
    drag.push({ t: 'l', k: r() < 0.3 ? 'tegel' : 'pinne', pts })
  }
  drag.push({ t: 'p', x: 90, y: 300 }, { t: 's', form: 'spiral', x: 180, y: 330 })
  const data = { v: 1, namn: 'Åäö-banan', varld: 4, spegel: false, drag }
  // så som editorn sparar strecken: glesade och avrundade
  const sparad = avkoda(koda(data))
  const igen = avkoda(koda(sparad))
  assert.deepEqual(igen, sparad)
  assert.deepEqual(byggEgen(igen), byggEgen(sparad))
  assert.equal(sparad.namn, 'Åäö-banan')
  assert.equal(sparad.varld, 4)
  for (const fel of ['', 'hej', 'eyJ4Ijox', koda(data).slice(0, 20)]) assert.equal(avkoda(fel), null, `trasig kod: ${fel}`)
  assert.ok(koda(data).length < 4000, 'länken blir inte för lång')
})

console.log(`\n${passed} tester ok`)
