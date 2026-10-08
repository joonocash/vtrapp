// Tester för Pixelkanon. Kör: node frontend/tests/pixelkanon.test.mjs
//
// Kollar bilderna (raka rader, bara palettens tecken), att varje banas ammo
// är exakt lika med antalet kuber per färg, att boten vinner varje bana,
// och att reglerna stämmer: grisen skjuter bara på första kuben i linjen och
// bara i sin färg, ammo kvar = väntplats, fulla platser = förlust.

import assert from 'node:assert/strict'
import { BILDER, HAPPY, PALETT } from '../src/rotspel/games/pixel/bilder.js'
import { byggBana, skala } from '../src/rotspel/games/pixel/banor.js'
import { skapaSpel, spelaBot, byggVag, VARVTID } from '../src/rotspel/games/pixel/engine.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

const TECKEN = '0123456789abcdefghijkl'.slice(0, PALETT.length)

test('bilderna: raka rader och bara palettens färger', () => {
  const kolla = (rader, namn) => {
    assert.ok(rader.length >= 8, namn)
    const w = rader[0].length
    for (const r of rader) {
      assert.equal(r.length, w, `${namn}: ojämna rader`)
      for (const ch of r) assert.ok(ch === '.' || TECKEN.includes(ch), `${namn}: okänt tecken ${ch}`)
    }
  }
  for (const b of BILDER) for (const [n, rader] of Object.entries(b.storlekar)) kolla(rader, `${b.id} ${n}`)
  for (const h of HAPPY) kolla(h.rader, h.id)
  assert.ok(BILDER.length >= 80)
  assert.ok(HAPPY.length >= 3)
})

const BANOR = 110

test(`bana 1–${BANOR}: ammo = kuber per färg, och boten vinner`, () => {
  for (let n = 1; n <= BANOR; n++) {
    const b = byggBana(n)
    const kuber = new Map()
    for (const f of b.kuber) if (f >= 0) kuber.set(f, (kuber.get(f) || 0) + 1)
    const ammo = new Map()
    for (const k of b.kolumner) for (const g of k) {
      assert.ok(g.ammo > 0, `bana ${n}: gris utan ammo`)
      ammo.set(g.f, (ammo.get(g.f) || 0) + g.ammo)
    }
    assert.deepEqual([...ammo.entries()].sort(), [...kuber.entries()].sort(), `bana ${n}: ammo stämmer inte`)
    const res = spelaBot(b)
    assert.ok(res.vann, `bana ${n} (${b.bild.namn}) vinns inte av boten`)
  }
})

test('var sjunde bana är en Happy-bild', () => {
  for (const n of [7, 14, 21, 28]) assert.equal(byggBana(n).bild.typ, 'happy')
  assert.equal(byggBana(8).bild.typ, 'emoji')
})

test('skalningen tar yttersta kuberna först', () => {
  // 3×3 fylld: kanten är lager 0, mitten lager 1
  const l = skala(new Array(9).fill(0), 3, 3)
  assert.equal(l[4], 1)
  assert.equal(l[0], 0)
})

test('vägen runt bilden: en ruta per rad och kolumn på varje sida plus fyra hörn', () => {
  const v = byggVag(5, 3)
  assert.equal(v.length, 2 * 5 + 2 * 3 + 4)
  assert.equal(v.filter((r) => r.sida === 'v').length, 3)
  assert.equal(v.filter((r) => r.sida === 'o').length, 5)
})

// Kör spelet tills något händer eller tiden tar slut.
function kor(s, sek) {
  const ut = []
  for (let t = 0; t < sek; t += 1 / 60) {
    s.steg(1 / 60)
    ut.push(...s.tomHandelser())
    if (s.status() !== 'spelar') break
  }
  return ut
}

test('grisen skjuter bara på första kuben i linjen, och bara i sin färg', () => {
  // En rad: [1, 0, 0]. Den röda (0) grisen kan inte nå förbi den blå (1)
  // från vänster, men från höger och uppifrån/nedifrån når den.
  const s = skapaSpel({ w: 3, h: 1, kuber: [1, 0, 0], kolumner: [[{ f: 0, ammo: 2 }], [{ f: 1, ammo: 1 }]], slots: 5, kap: 5 })
  assert.equal(s.skickaKolumn(0).ok, true)
  const h = kor(s, VARVTID + 0.5)
  const skott = h.filter((e) => e.typ === 'skott')
  assert.equal(skott.length, 2)
  assert.ok(skott.every((e) => e.f === 0))
  assert.equal(s.kuber[0], 1, 'den blå kuben står kvar')
  assert.ok(h.some((e) => e.typ === 'tom'), 'grisen är tom och hoppar av')
})

test('ammo kvar efter varvet = väntplats; fulla platser = förlust; en plats till = fortsätt', () => {
  // Fem kuber i färg 1 längst in, men grisarna är färg 0 och kuberna i färg 0
  // sitter bakom. Varje gris kommer tillbaka med ammo.
  const kuber = [1, 1, 1, 0, 1, 1, 1]
  const s = skapaSpel({ w: 7, h: 1, kuber, kolumner: [[{ f: 0, ammo: 1 }, { f: 0, ammo: 1 }]], slots: 1, kap: 5 })
  // Kub 3 (färg 0) syns uppifrån och nedifrån, så första grisen tömmer sig.
  s.skickaKolumn(0)
  kor(s, VARVTID + 0.5)
  assert.equal(s.kuber[3], -1)
  // Andra grisen hittar inget och sätter sig i den enda platsen.
  s.skickaKolumn(0)
  const h = kor(s, VARVTID + 0.5)
  assert.ok(h.some((e) => e.typ === 'slot' && e.slot === 0))
  // Utan väntplatser: grisen kommer runt med ammo kvar → förlust.
  const s2 = skapaSpel({ w: 3, h: 1, kuber: [1, 1, 1], kolumner: [[{ f: 0, ammo: 1 }]], slots: 0, kap: 5 })
  s2.skickaKolumn(0)
  const h2 = kor(s2, VARVTID + 0.5)
  assert.ok(h2.some((e) => e.typ === 'forlust'))
  assert.equal(s2.status(), 'forlorat')
  s2.extraSlot()
  assert.equal(s2.status(), 'spelar')
  assert.ok(s2.slots[0] && s2.slots[0].ammo === 1)
})

test('bandets kapacitet och länkade grisar', () => {
  const s = skapaSpel({
    w: 2,
    h: 2,
    kuber: [0, 0, 1, 1],
    kolumner: [[{ f: 0, ammo: 2, lank: 1 }], [{ f: 1, ammo: 2, lank: 1 }]],
    slots: 5,
    kap: 1,
  })
  assert.equal(s.skickaKolumn(0).varfor, 'fullt', 'två länkade får inte plats när kapaciteten är 1')
  const s2 = skapaSpel({
    w: 2,
    h: 2,
    kuber: [0, 0, 1, 1],
    kolumner: [[{ f: 0, ammo: 2, lank: 1 }], [{ f: 1, ammo: 2, lank: 1 }]],
    slots: 5,
    kap: 5,
  })
  const res = s2.skickaKolumn(1)
  assert.equal(res.ok, true)
  assert.equal(res.grisar.length, 2, 'båda åker')
  kor(s2, VARVTID * 2)
  assert.equal(s2.status(), 'vunnit')
})

test('dold gris syns när den kommer längst fram', () => {
  const s = skapaSpel({ w: 1, h: 1, kuber: [0], kolumner: [[{ f: 0, ammo: 1 }, { f: 0, ammo: 1, dold: true }]], slots: 5, kap: 5 })
  assert.equal(s.kolumner[0][1].dold, true)
  s.skickaKolumn(0)
  assert.equal(s.kolumner[0][0].dold, false)
  assert.ok(s.tomHandelser().some((e) => e.typ === 'avslojd'))
})

const lika = (s, msg) => {
  const a = [...s.ammoPerFarg().entries()].sort()
  const k = [...s.perFarg().entries()].sort()
  assert.deepEqual(a, k, msg)
}

test('supergrisen spränger synliga kuber i en färg och tar ammo från väntplatsen först', () => {
  // Rad: [0, 1, 0]. Färg 0 syns från vänster och höger, uppifrån och nedifrån.
  const s = skapaSpel({ w: 3, h: 1, kuber: [0, 1, 0], kolumner: [[{ f: 0, ammo: 1 }, { f: 1, ammo: 1 }], [{ f: 0, ammo: 1 }]], slots: 5, kap: 5 })
  // Lägg en färg 0-gris i väntplatsen för hand (som om den kommit tillbaka).
  s.slots[0] = s.kolumner[1].shift()
  lika(s, 'före')
  const mal = s.supergris(0)
  assert.deepEqual(mal.sort(), [0, 2])
  assert.equal(s.slots[0], null, 'grisen i väntplatsen tog slut och försvann')
  assert.equal(s.kolumner[0][0].f, 1, 'grisen i kön försvann också')
  lika(s, 'efter')
  const h = s.tomHandelser()
  assert.equal(h.filter((e) => e.typ === 'super').length, 2)
  assert.ok(h.some((e) => e.typ === 'gratis' && e.var === 'slot'))
})

test('enhörningen skjuter på allt, håller ammo = kuber och tar ingen väntplats', () => {
  const kuber = [0, 1, 2, 1, 0, 2, 2, 0, 1]
  const s = skapaSpel({
    w: 3,
    h: 3,
    kuber,
    kolumner: [[{ f: 0, ammo: 3 }], [{ f: 1, ammo: 3 }], [{ f: 2, ammo: 3 }]],
    slots: 1,
    kap: 5,
  })
  assert.equal(s.regnbage(4).ok, true)
  const h = kor(s, VARVTID * 1.3)
  const skott = h.filter((e) => e.typ === 'skott')
  assert.equal(skott.length, 4)
  lika(s, 'efter enhörningen')
  assert.equal(s.slots[0], null, 'enhörningen satte sig inte i väntplatsen')
  assert.equal(s.status(), 'spelar')
})

test('handen tar valfri gris, löser upp länken och respekterar bandets kapacitet', () => {
  const s = skapaSpel({
    w: 2,
    h: 1,
    kuber: [0, 1],
    kolumner: [[{ f: 0, ammo: 1 }, { f: 1, ammo: 1, lank: 1 }], [{ f: 0, ammo: 0 }, { f: 1, ammo: 0, lank: 1 }]],
    slots: 5,
    kap: 1,
  })
  const res = s.hand(0, 1)
  assert.equal(res.ok, true)
  assert.equal(s.kolumner[1][1].lank, undefined, 'partnern är inte länkad längre')
  assert.equal(s.hand(0, 0).varfor, 'fullt')
  assert.equal(s.extraBricka(), true)
  assert.equal(s.kap, 2)
  assert.equal(s.hand(0, 0).ok, true)
})

test('slumpad spelare med boosters: ammo = kuber hela tiden, inga krascher', () => {
  let r = 12345
  const slumpa = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296)
  for (const n of [5, 12, 23, 31, 44, 57]) {
    const s = skapaSpel(byggBana(n))
    for (let t = 0; t < 400 && s.status() === 'spelar'; t += 1 / 30) {
      const x = slumpa()
      if (x < 0.02) s.skickaKolumn(Math.floor(slumpa() * s.kolumner.length))
      else if (x < 0.025) s.skickaSlot(Math.floor(slumpa() * s.slots.length))
      else if (x < 0.027) s.supergris([...s.perFarg().keys()][0])
      else if (x < 0.028) s.regnbage(20)
      else if (x < 0.029) s.hand(Math.floor(slumpa() * s.kolumner.length), 1)
      s.steg(1 / 30)
      s.tomHandelser()
      if (s.status() === 'spelar') lika(s, `bana ${n} t=${t.toFixed(2)}`)
    }
  }
})

console.log(`\n${passed} test ok`)
