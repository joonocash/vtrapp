// Tester för Pinnbollen (Peggle). Kör: node frontend/tests/pinnboll.test.mjs
//
// Kollar banorna (inom planen, inga överlapp, orange bara där kulan når),
// fysiken (skott tar alltid slut, kulan stannar innanför väggarna) och
// reglerna som i Peggle: multiplikatorn, skottpoäng = summa × träffar,
// extra kula vid 25 000, slantsingling, hinken, Extreme Fever och facken.

import assert from 'node:assert/strict'
import { skapaSpel, spelaSkott, botSkott, multiplikator, mitt, W, H, STARTKULOR, EXTRA_KULA_VID, FACK_POANG } from '../src/rotspel/games/pinnboll/motor.js'
import { hamtaBana, ANTAL_BANOR, VARLDAR, STJARNOR, stjarnor, nabara, MIN_SPRINGA } from '../src/rotspel/games/pinnboll/banor.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

const rndFran = (fro) => {
  let x = fro >>> 0 || 1
  return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296)
}

test(`${ANTAL_BANOR} banor i ${VARLDAR.length} världar, alla inom planen`, () => {
  assert.equal(ANTAL_BANOR, VARLDAR.length * 5)
  for (let n = 1; n <= ANTAL_BANOR; n++) {
    const b = hamtaBana(n)
    assert.equal(b.varld, Math.floor((n - 1) / 5), `bana ${n}: värld`)
    assert.ok(b.objekt.length >= 40, `bana ${n}: för få objekt (${b.objekt.length})`)
    for (const o of b.objekt) {
      if (o.form === 'cirkel') {
        assert.ok(o.x >= 14 && o.x <= W - 14 && o.y >= 92 && o.y <= 548, `bana ${n}: pinne utanför (${o.x}, ${o.y})`)
      }
      if (o.grupp != null) assert.ok(b.grupper[o.grupp], `bana ${n}: grupp saknas`)
    }
    assert.ok(STJARNOR[n] && STJARNOR[n][0] < STJARNOR[n][1], `bana ${n}: stjärngränser`)
  }
})

test('orange bara där kulan når, och lagom många', () => {
  for (let n = 1; n <= ANTAL_BANOR; n++) {
    const b = hamtaBana(n)
    const kand = b.objekt.filter((o) => !o.ejOrange).length
    assert.ok(b.orange >= 12 && b.orange <= 25 && b.orange <= kand, `bana ${n}: ${b.orange} orange av ${kand}`)
    for (const fro of [1, 2, 3]) {
      const s = skapaSpel(b, { fro })
      const or = s.objekt.filter((o) => o.farg === 'orange')
      assert.equal(or.length, b.orange)
      assert.ok(or.every((o) => !o.ejOrange), `bana ${n}: orange på onåbar plats`)
      assert.equal(s.objekt.filter((o) => o.farg === 'gron').length, 2, `bana ${n}: två gröna`)
      assert.equal(s.objekt.filter((o) => o.farg === 'lila').length, 1, `bana ${n}: en lila`)
    }
  }
})

test('en pinne inne i en sluten ring räknas som onåbar', () => {
  const ring = []
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    ring.push({ typ: 'pinne', form: 'cirkel', x: 180 + Math.cos(a) * 30, y: 300 + Math.sin(a) * 30, r: 7.5 })
  }
  const inne = { typ: 'pinne', form: 'cirkel', x: 180, y: 300, r: 7.5 }
  const ute = { typ: 'pinne', form: 'cirkel', x: 60, y: 300, r: 7.5 }
  const nas = nabara([...ring, inne, ute])
  assert.ok(!nas.has(12), 'pinnen i mitten')
  assert.ok(nas.has(13), 'pinnen utanför')
  assert.ok(nas.has(0), 'ringen själv')
})

test('inga pinnar omlott (springa minst 3 px)', () => {
  for (let n = 1; n <= ANTAL_BANOR; n++) {
    const b = hamtaBana(n)
    const pinnar = b.objekt.filter((o) => o.form === 'cirkel')
    for (let i = 0; i < pinnar.length; i++)
      for (let j = i + 1; j < pinnar.length; j++) {
        const p = pinnar[i]
        const q = pinnar[j]
        if (p.grupp !== q.grupp) continue
        const d = Math.hypot(p.x - q.x, p.y - q.y) - p.r - q.r
        assert.ok(d >= 2.99, `bana ${n}: pinnar för nära (${d.toFixed(1)} px)`)
      }
  }
  assert.ok(MIN_SPRINGA > 0)
})

test('multiplikatorn som i Peggle: 10 → 2x, 15 → 3x, 19 → 5x, 22 → 10x', () => {
  assert.equal(multiplikator(0), 1)
  assert.equal(multiplikator(9), 1)
  assert.equal(multiplikator(10), 2)
  assert.equal(multiplikator(15), 3)
  assert.equal(multiplikator(19), 5)
  assert.equal(multiplikator(22), 10)
  assert.equal(multiplikator(25), 10)
})

test('varje skott tar slut, kulan stannar innanför väggarna', () => {
  for (let n = 1; n <= ANTAL_BANOR; n += 1) {
    const s = skapaSpel(hamtaBana(n), { fro: n })
    const rnd = rndFran(n * 31)
    for (let k = 0; k < 4 && s.lage === 'siktar'; k++) {
      s.sikta(Math.PI * (0.05 + 0.9 * rnd()))
      assert.ok(s.skjut())
      let steg = 0
      while (s.lage === 'skjuter' || s.lage === 'feber') {
        s.steg(1 / 60)
        for (const kula of s.kulor) assert.ok(kula.x >= 0 && kula.x <= W && kula.y < H + 40, `bana ${n}: kulan rymde (${kula.x}, ${kula.y})`)
        steg++
        assert.ok(steg < 60 * 45, `bana ${n}: skottet tog aldrig slut`)
      }
    }
  }
})

test('skottpoäng = summan × antalet träffar, och poängen läggs till när skottet är slut', () => {
  const s = skapaSpel(hamtaBana(1), { fro: 5 })
  let summa = 0
  let traffar = 0
  let slutPoang = null
  for (const e of spelaSkott(s, Math.PI / 2)) {
    if (e.typ === 'traff') {
      summa += e.poang
      traffar++
    }
    if (e.typ === 'skottSlut') slutPoang = e.poang
  }
  assert.ok(traffar > 0, 'rakt ner ska träffa något')
  assert.equal(slutPoang, summa * traffar)
  assert.ok(s.poang >= slutPoang)
})

test('träffade pinnar lyser under skottet och försvinner efteråt', () => {
  const s = skapaSpel(hamtaBana(3), { fro: 2 })
  s.sikta(Math.PI / 2)
  s.skjut()
  let sett = false
  while (s.lage === 'skjuter') {
    s.steg(1 / 60)
    if (s.objekt.some((o) => o.lit && !o.borta)) sett = true
  }
  assert.ok(sett, 'något ska lysa under skottet')
  assert.ok(s.objekt.filter((o) => o.lit).every((o) => o.borta))
})

test('extra kula vid 25 000 i ett skott', () => {
  const s = skapaSpel(hamtaBana(5), { fro: 1 })
  // låtsas att multiplikatorn är hög: tänd orange tills 10x
  s.orangeTraffade = 22
  const fore = s.kulorKvar
  const h = spelaSkott(s, botSkott(s, { vinklar: 24, rnd: rndFran(9) }))
  const sp = h.find((e) => e.typ === 'skottSlut').poang
  const extra = h.filter((e) => e.typ === 'extraKula' && e.orsak === 'poang').length
  const vantat = EXTRA_KULA_VID.filter((g) => sp >= g).length
  assert.equal(extra, vantat)
  if (sp >= EXTRA_KULA_VID[0]) assert.ok(s.kulorKvar >= fore - 1 + 1)
})

test('skott utan träffar: slantsingling om en kula, ungefär hälften vinner', () => {
  let vann = 0
  let totalt = 0
  for (let fro = 1; fro <= 60; fro++) {
    const s = skapaSpel({ namn: 'tom', objekt: [{ typ: 'pinne', form: 'cirkel', x: 20, y: 300, r: 7.5 }, { typ: 'pinne', form: 'cirkel', x: 340, y: 300, r: 7.5 }, { typ: 'pinne', form: 'cirkel', x: 180, y: 130, r: 7.5, ejOrange: true }], orange: 1 }, { fro })
    // rakt ner förbi allt (pinnen i mitten ligger högt, kulan går bredvid)
    s.sikta(Math.PI / 2 + 0.25)
    const h = spelaSkott(s, Math.PI / 2 + 0.25)
    const slut = h.find((e) => e.typ === 'skottSlut')
    if (slut.traffar > 0) continue
    totalt++
    if (slut.slant) vann++
  }
  assert.ok(totalt > 30, 'för få tomma skott')
  assert.ok(vann > totalt * 0.25 && vann < totalt * 0.75, `slanten: ${vann} av ${totalt}`)
})

test('sista orange ger Extreme Fever, kulan landar i ett fack, banan klar', () => {
  // en bana med en enda orange rakt under kanonen
  const bana = {
    namn: 'test',
    objekt: [
      { typ: 'pinne', form: 'cirkel', x: 180, y: 200, r: 7.5 },
      { typ: 'pinne', form: 'cirkel', x: 60, y: 300, r: 7.5, ejOrange: true },
      { typ: 'pinne', form: 'cirkel', x: 300, y: 300, r: 7.5, ejOrange: true },
      { typ: 'pinne', form: 'cirkel', x: 120, y: 420, r: 7.5, ejOrange: true },
      { typ: 'pinne', form: 'cirkel', x: 240, y: 420, r: 7.5, ejOrange: true },
    ],
    orange: 1,
  }
  const s = skapaSpel(bana, { fro: 3 })
  assert.equal(s.objekt[0].farg, 'orange')
  const h = spelaSkott(s, Math.PI / 2)
  const typer = h.map((e) => e.typ)
  assert.ok(typer.includes('feberStart'))
  const fack = h.find((e) => e.typ === 'fack')
  assert.ok(fack, 'kulan ska landa i ett fack')
  assert.equal(fack.poang, FACK_POANG[fack.index])
  const klar = h.find((e) => e.typ === 'banaKlar')
  assert.ok(klar)
  assert.equal(klar.kulBonus, klar.kulor * 10000)
  assert.equal(s.lage, 'klar')
})

test('hinken fångar kulan och ger en kula tillbaka', () => {
  const bana = { namn: 'hink', objekt: [{ typ: 'pinne', form: 'cirkel', x: 30, y: 120, r: 7.5 }], orange: 1 }
  const s = skapaSpel(bana, { fro: 1 })
  let fangad = false
  // vänta olika länge innan skottet tills kulan rakt ner hamnar i hinken
  for (let i = 0; i < 400 && !fangad; i++) {
    s.steg(1 / 60)
    const st = s.spara()
    const fore = s.kulorKvar
    const h = spelaSkott(s, Math.PI / 2)
    if (h.some((e) => e.typ === 'hink')) {
      fangad = true
      assert.ok(h.some((e) => e.typ === 'extraKula' && e.orsak === 'hink'))
      assert.equal(s.kulorKvar, fore, 'kulan kommer tillbaka')
    }
    s.ladda(st)
  }
  assert.ok(fangad, 'hinken fångade aldrig kulan')
})

test('spara/ladda: samma skott ger samma resultat', () => {
  const s = skapaSpel(hamtaBana(9), { fro: 11 })
  spelaSkott(s, 1.3)
  const st = s.spara()
  const v = 1.9
  const h1 = spelaSkott(s, v).filter((e) => e.typ === 'traff').map((e) => e.id)
  const p1 = s.poang
  s.ladda(st)
  const h2 = spelaSkott(s, v).filter((e) => e.typ === 'traff').map((e) => e.id)
  assert.deepEqual(h2, h1)
  assert.equal(s.poang, p1)
})

test('slut på kulor → fortsätt med tre till', () => {
  const s = skapaSpel(hamtaBana(14), { fro: 4, kulor: 1 })
  spelaSkott(s, 0.12)
  if (s.lage === 'siktar') spelaSkott(s, 0.12) // slanten kan ge en till
  while (s.lage === 'siktar') spelaSkott(s, 0.12)
  assert.equal(s.lage, 'slut')
  assert.ok(s.fortsatt(3))
  assert.equal(s.lage, 'siktar')
  assert.equal(s.kulorKvar, 2)
  assert.ok(s.iKanonen)
})

test('en bot som siktar klarar de första banorna med tio kulor', () => {
  for (const n of [1, 3, 5]) {
    let klar = 0
    for (const fro of [1, 2, 3]) {
      const s = skapaSpel(hamtaBana(n), { fro, kulor: STARTKULOR })
      const rnd = rndFran(n * 100 + fro)
      let k = 0
      while (s.lage === 'siktar' && k < 30) {
        spelaSkott(s, botSkott(s, { vinklar: 24, rnd }))
        k++
      }
      if (s.lage === 'klar') klar++
    }
    assert.ok(klar >= 2, `bana ${n}: boten klarade ${klar} av 3`)
  }
})

test('stjärnor: 0 om inte klar, sedan 1–3 efter poäng', () => {
  const [g2, g3] = STJARNOR[1]
  assert.equal(stjarnor(1, 10 ** 7, false), 0)
  assert.equal(stjarnor(1, g2 - 1, true), 1)
  assert.equal(stjarnor(1, g2, true), 2)
  assert.equal(stjarnor(1, g3, true), 3)
})

test('alla objekt har en mittpunkt (för poängtexter)', () => {
  const s = skapaSpel(hamtaBana(15), { fro: 1 })
  for (const o of s.objekt) {
    const [x, y] = mitt(o)
    assert.ok(Number.isFinite(x) && Number.isFinite(y))
  }
})

console.log(`\n${passed} tester ok`)
