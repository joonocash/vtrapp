// Tester för Pinnbollens lägen: bonusbanorna, generatorn till oändligt läge,
// rundans regler och baneditorn. Kör: node frontend/tests/pinnboll-lagen.test.mjs

import assert from 'node:assert/strict'
import { skapaSpel, spelaSkott, botSkott, W, H, STARTKULOR, HINK, KULA_R, KRAFTER } from '../src/rotspel/games/pinnboll/motor.js'
import { BONUS, hamtaBonus } from '../src/rotspel/games/pinnboll/bonus.js'
import { genereraBana } from '../src/rotspel/games/pinnboll/generator.js'
import { nyRunda, rundaBana, spelVal, rundaKlar, bonusVal, valjBonus, slaOm, oppnaKista, mojlig, build, antalVal, HJALTAR, UPPGRADERINGAR, BONUSAR, NYA_KULOR, arBonus } from '../src/rotspel/games/pinnboll/runda.js'
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
  assert.equal(BONUS.length, 16)
  // äventyrets sex först (efter varje värld), sedan tio kulregnsbanor
  assert.deepEqual(BONUS.slice(0, 6).map((d) => d.familj || null), [null, null, null, null, null, null])
  assert.equal(BONUS.filter((d) => d.familj === 'kulregn' && d.kraft === 'multi').length, 10)
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
  const krav = { kulbanan: 0.9, kedjan: 0.85, spiralen: 0.85, kulregnet: 0.2, eldsolen: 0.8, skateparken: 0.8, skyfallet: 0.7, fontanen: 0.45, popcornen: 0.5, flipperspelet: 0.3, kulhjulen: 0.35, plinkot: 0.5, studsmattan: 0.3, kaskaden: 0.45, galaxen: 0.3, kulstormen: 0.4 }
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

test('kulregnsbanorna fyller planen med kulor, men aldrig fler än taket', () => {
  for (const d of BONUS.filter((x) => x.familj === 'kulregn')) {
    const b = hamtaBonus(d.id, 1)
    const tak = d.maxKulor || 40
    const mest = []
    for (const v of [0.5, 0.9, 1.3, 1.57, 1.8, 2.2, 2.6]) {
      const s = skapaSpel(b, { fro: 3 })
      s.sikta(v)
      s.skjut()
      let m = 0
      for (let i = 0; i < 60 * 45 && (s.lage === 'skjuter' || s.lage === 'feber'); i++) {
        s.steg(1 / 60)
        m = Math.max(m, s.kulor.length)
      }
      assert.ok(m <= tak, `${d.id}: ${m} kulor`)
      assert.ok(s.lage !== 'skjuter' && s.lage !== 'feber', `${d.id}: skottet tog slut`)
      mest.push(m)
    }
    mest.sort((a, b) => a - b)
    assert.ok(mest[3] >= 15, `${d.id}: som mest ${mest.join(',')} kulor`)
  }
})

test('kulregnsstilarna: regn från himlen, fontän uppåt, kulan delar sig', () => {
  const forsta = (id) => {
    const s = skapaSpel(hamtaBonus(id, 0), { fro: 1 })
    s.sikta(Math.PI / 2)
    s.skjut()
    for (let i = 0; i < 60 * 20; i++) for (const e of s.steg(1 / 60)) if (e.typ === 'kraft' && e.nya.length) return { e, s }
    return null
  }
  const regn = forsta('skyfallet')
  assert.equal(regn.e.nya.length, 3)
  assert.ok(regn.e.nya.every(([, y]) => y === 70), 'regnet kommer uppifrån')
  const fontan = forsta('fontanen')
  assert.ok(fontan.s.kulor.slice(-2).every((k) => k.vy < -200), 'fontänen sprutar uppåt')
  const dela = forsta('plinkot')
  assert.ok(dela.s.kulor.slice(-3).every((k) => k.vy > 0), 'delade kulor rullar av nedåt')
  assert.equal(hamtaBonus('kulstormen').maxKulor, 60)
})

test('studsare: skjuter iväg kulan och försvinner när de är utslitna', () => {
  // en enda studsare rakt under kanonen: kulan studsar upp tre gånger
  const bana = { namn: 'Prov', fasta: true, grupper: [], objekt: [{ typ: 'pinne', form: 'cirkel', x: 180, y: 300, r: 13, kick: 360, kickAntal: 3, farg0: 'bla' }, { typ: 'pinne', form: 'cirkel', x: 40, y: 500, r: 7.5, farg0: 'orange' }] }
  const s = skapaSpel(bana, { fro: 1 })
  s.sikta(Math.PI / 2)
  s.skjut()
  const studsar = []
  for (let i = 0; i < 60 * 20 && s.lage === 'skjuter'; i++)
    for (const e of s.steg(1 / 60)) if (e.typ === 'studs') studsar.push({ ...e, vy: s.kulor[0]?.vy ?? 0, borta: s.objekt[0].borta })
  assert.equal(studsar.length, 3)
  for (const e of studsar) assert.ok(e.vy <= -360 * 0.9, `studsen ger fart uppåt (${e.vy})`)
  assert.deepEqual(studsar.map((e) => e.kvar), [2, 1, 0])
  assert.ok(studsar[2].borta, 'utsliten studsare försvinner')
  assert.notEqual(s.lage, 'skjuter', 'skottet tar slut')
  // flipperspelet: studsarna studsar många gånger i ett skott
  const f = skapaSpel(hamtaBonus('flipperspelet', 0), { fro: 2 })
  const h = spelaSkott(f, 1.4)
  assert.ok(h.filter((e) => e.typ === 'studs').length >= 10)
})

test('Kulhjulen och Galaxen snurrar, och speglade snurrar åt andra hållet', () => {
  for (const id of ['kulhjulen', 'galaxen']) {
    const a = hamtaBonus(id, 0)
    const b = hamtaBonus(id, 1)
    assert.ok(a.grupper.length >= 1 && a.grupper.every((g) => g.typ === 'rotera'))
    assert.deepEqual(b.grupper.map((g) => Math.sign(g.w)), a.grupper.map((g) => -Math.sign(g.w)))
    assert.ok(a.objekt.some((o) => o.grupp != null))
  }
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
    assert.ok(b.orange >= 12 && b.orange <= Math.min(niva <= 10 ? 25 : 40, kand), `${b.namn}: ${b.orange} orange av ${kand}`)
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
  // i oändligt läge fortsätter det efter 25 orange, eftersom man blir starkare
  assert.ok(genereraBana(5, { niva: 30 }).orange > 25)
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

test('rundan: hjälten bestämmer vad gröna gör och ger en första uppgradering', () => {
  assert.equal(HJALTAR.length, 6)
  for (const h of HJALTAR) {
    assert.ok(KRAFTER[h.kraft], h.id)
    const r = nyRunda(5, h.id)
    assert.equal(r.hjalte, h.id)
    assert.deepEqual(r.varig, h.start)
    for (const n of [1, 2, 7]) assert.equal(rundaBana({ ...r, niva: n }).kraft, h.kraft)
    // bonusbanorna behåller sin egen kraft
    assert.equal(rundaBana({ ...r, niva: 20 }).kraft, 'multi')
    for (const id of Object.keys(h.start)) assert.ok(UPPGRADERINGAR[id], id)
  }
  // en gammal runda utan hjälte fungerar som förut
  const gammal = { ...nyRunda(5), hjalte: undefined }
  assert.ok(rundaBana(gammal).kraft)
})

test('rundan: olika uppgraderingar att välja mellan, och de gör vad de säger', () => {
  const r = nyRunda(7, 'glod')
  for (let n = 1; n < 30; n++) {
    const val = bonusVal({ ...r, niva: n })
    assert.equal(val.length, 3)
    assert.equal(new Set(val).size, 3)
    for (const id of val) assert.ok(UPPGRADERINGAR[id] && mojlig(r, id))
  }
  assert.equal(BONUSAR, UPPGRADERINGAR)
  assert.equal(valjBonus(r, 'kulor').kulor, r.kulor + 3)
  assert.equal(valjBonus(r, 'omslag').omslag, r.omslag + 2)
  // Eldkula: de första skotten på varje bana är eldbollar, och eldbollen är stor
  const eld = valjBonus(r, 'eldkula')
  const bana = rundaBana(eld)
  const s = skapaSpel(bana, { fro: 1, ...spelVal(eld, bana) })
  assert.equal(s.eldKvar, 2)
  s.sikta(1.2)
  s.skjut()
  assert.ok(s.kulor[0].r >= KULA_R * 1.7, 'stor eldboll')
  // inget tak för hinken och de gröna
  let hink = r
  for (let i = 0; i < 12; i++) hink = valjBonus(valjBonus(hink, 'hink'), 'gron')
  assert.equal(hink.varig.hink, 12)
  assert.equal(hink.varig.gron, 12)
  assert.ok(mojlig(hink, 'hink') && mojlig(hink, 'gron'))
  const s2 = skapaSpel(bana, { fro: 1, ...spelVal(hink, bana) })
  assert.equal(s2.hinkBredd, HINK.bredd + 14 * 12)
  assert.equal(s2.objekt.filter((o) => o.farg === 'gron').length, 14)
  // hinken växer inte ut ur planen
  const jatte = skapaSpel(bana, { fro: 1, ...spelVal({ ...r, varig: { hink: 60 } }, bana) })
  assert.ok(jatte.hinkBredd <= W - 40)
  // det som har ett tak erbjuds inte när det är fullt
  const fullt = { ...r, varig: { sikte: 1, jatte: 4, tur: 3 } }
  for (let n = 1; n < 40; n++) assert.ok(!bonusVal({ ...fullt, niva: n }).some((id) => ['sikte', 'jatte', 'tur'].includes(id)))
  // Tur ger fyra val
  assert.equal(antalVal({ ...r, varig: { tur: 1 } }), 4)
  assert.equal(bonusVal({ ...r, varig: { tur: 1 } }).length, 4)
  // Kulbanken ger fler kulor efter varje bana
  assert.equal(rundaKlar({ ...r, varig: { bank: 3 } }, { poang: 0, kulorKvar: 2, bonus: false }).kulor, 2 + NYA_KULOR + 3)
  assert.equal(spelVal(r, bana).kulBonus, false)
})

test('rundan: evolutioner, omslag och skattkistan', () => {
  const r = nyRunda(9, 'konfekt')
  assert.ok(!mojlig(r, 'kulregn'), 'evolutionen kräver sina delar')
  const nara = { ...r, varig: { delning: 2, gron: 2 } }
  assert.ok(mojlig(nara, 'kulregn'))
  // en möjlig evolution erbjuds alltid
  let sett = 0
  for (let n = 1; n <= 20; n++) if (bonusVal({ ...nara, niva: n }).includes('kulregn')) sett++
  assert.equal(sett, 20, `evolutionen visades ${sett} av 20 gånger`)
  assert.ok(!mojlig(valjBonus(nara, 'kulregn'), 'kulregn'), 'en evolution tas bara en gång')
  for (const [id, u] of Object.entries(UPPGRADERINGAR)) if (u.krav) for (const k of Object.keys(u.krav)) assert.ok(UPPGRADERINGAR[k] && !UPPGRADERINGAR[k].krav, `${id}: ${k}`)
  // omslag: nya val, samma varje gång, och kostar ett omslag
  const val = bonusVal({ ...r, niva: 3 })
  const om = slaOm({ ...r, niva: 3 })
  assert.equal(om.omslag, r.omslag - 1)
  assert.deepEqual(bonusVal(om), bonusVal(slaOm({ ...r, niva: 3 })))
  let olika = 0
  for (let n = 1; n <= 10; n++) if (bonusVal({ ...r, niva: n }).join() !== bonusVal(slaOm({ ...r, niva: n })).join()) olika++
  assert.ok(olika >= 8, 'omslaget ger andra val')
  assert.equal(slaOm({ ...r, omslag: 0 }).omslag, 0)
  assert.deepEqual(val, bonusVal({ ...r, niva: 3 }))
  // skattkistan: 1–3 uppgraderingar, inga direkta
  for (let n = 5; n <= 50; n += 5) {
    const k = oppnaKista({ ...r, niva: n })
    assert.ok(k.fick.length >= 1 && k.fick.length <= 3)
    assert.ok(k.fick.every((id) => !UPPGRADERINGAR[id].direkt))
    assert.equal(new Set(k.fick).size, k.fick.length, "olika saker i kistan")
    assert.ok(build(k.runda).length >= build(r).length)
  }
})

test('uppgraderingarna i motorn: jättekula, delning, bomber, magnet, lila och Kulregn', () => {
  const bana = genereraBana(77, { niva: 6 })
  const spela = (perk, start = {}) => {
    const s = skapaSpel(bana, { fro: 4, perk, start })
    s.sikta(1.35)
    s.skjut()
    const h = []
    let mest = 0
    for (let i = 0; i < 60 * 45 && (s.lage === 'skjuter' || s.lage === 'feber'); i++) {
      h.push(...s.steg(1 / 60))
      mest = Math.max(mest, s.kulor.length)
    }
    return { s, h, mest }
  }
  const vanlig = spela({})
  assert.equal(vanlig.mest, 1)
  const jatte = skapaSpel(bana, { fro: 4, perk: { jatte: 4 } })
  jatte.skjut()
  assert.ok(Math.abs(jatte.kulor[0].r - KULA_R * 1.6) < 1e-9)
  const del = spela({ delning: 3 })
  assert.ok(del.h.some((e) => e.typ === 'delning' && e.nya.length === 3))
  assert.ok(del.mest >= 4)
  const bomb = spela({ bomber: 3 })
  assert.equal(bomb.s.objekt.filter((o) => o.bomb).length, 6)
  const lila = skapaSpel(bana, { fro: 4, perk: { lila: 3 } })
  assert.equal(lila.objekt.filter((o) => o.farg === 'lila').length, 3)
  // Kulregn: varje grön skjuter ut två kulor, även med en annan kraft
  const regn = spela({ kulregn: 1 })
  const krafter = regn.h.filter((e) => e.typ === 'kraft')
  if (krafter.length) assert.ok(krafter.every((e) => e.regn.length === 2))
  // Poängregn: mer poäng för samma träff
  const pa = spela({ poang: 4 })
  const forsta = (x) => x.h.find((e) => e.typ === 'traff').poang
  assert.equal(forsta(pa), forsta(vanlig) * 2)
  // magneten drar kulan till sig: fler orange tänds i snitt
  let utan = 0
  let med = 0
  for (let i = 0; i < 16; i++) {
    const v = 0.35 + i * 0.16
    for (const [perk, add] of [[{}, (n) => (utan += n)], [{ magnet: 4 }, (n) => (med += n)]]) {
      const s = skapaSpel(bana, { fro: 4, perk })
      spelaSkott(s, v)
      add(s.orangeTraffade)
    }
  }
  assert.ok(med > utan, `magnet ${med} orange mot ${utan} utan`)
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
