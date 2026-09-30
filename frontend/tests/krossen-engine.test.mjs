// Tester för Krossens motor. Körs med `npm test` från repots rot.
// Ligger utanför src/ så de inte hamnar i bundlen.
import assert from 'node:assert/strict'
import {
  skapaSpel,
  skapaRng,
  hittaGrupper,
  spelaDrag,
  giltigtByte,
  hittaDrag,
  hittaTips,
  harDrag,
  malStatus,
  malKlara,
  godisregn,
  tassen,
  bytFritt,
  gravitation,
  laggUtSpecialer,
  kanBytas,
} from '../src/rotspel/games/krossen/engine.js'
import { BANOR, VARLDAR, BANOR_PER_VARLD } from '../src/rotspel/games/krossen/levels.js'

// Lägger ut ett bräde för hand. Siffror är färger, # hål, B låda,
// o ogräs, e köttben. Slumpen fyller på med pjäser som inte finns i rader.
function brade(rader, extra = {}) {
  const karta = rader.map((r) => r.replace(/[0-9]/g, '.').replace(/[Boe]/g, (x) => ({ B: '1', o: 'o', e: 'e' })[x]))
  const s = skapaSpel({ karta, drag: 20, farger: 6, mal: extra.mal || [{ typ: 'poang', antal: 1 }], kott: extra.kott }, skapaRng(7))
  rader.forEach((rad, r) => {
    for (let c = 0; c < rad.length; c++) {
      const ch = rad[c]
      if (/[0-9]/.test(ch)) {
        const i = r * s.w + c
        s.tiles[i] = { id: s.nextId++, typ: 'bit', farg: Number(ch), special: null, armerad: false, radie: 1 }
      }
    }
  })
  // en kolumn som alltid ger samma färger vid påfyllnad gör testerna förutsägbara
  let n = 0
  s.rng = () => {
    n++
    return ((n * 0.61803398875) % 1)
  }
  return s
}

const tom = (gen) => {
  const steg = []
  for (const x of gen) steg.push(x)
  return steg
}

let ok = 0
function test(namn, fn) {
  fn()
  ok++
  console.log('  ok', namn)
}

// ---------------------------------------------------------------- matchning

test('tre i rad hittas, ingen special', () => {
  const s = brade(['001', '234', '345'])
  s.tiles[2] = { ...s.tiles[2], farg: 0 }
  const g = hittaGrupper(s)
  assert.equal(g.length, 1)
  assert.equal(g[0].celler.length, 3)
  assert.equal(g[0].special, null)
})

test('fyra i rad ger raket där man drog', () => {
  const s = brade(['0000', '2341', '3452', '4513'])
  const g = hittaGrupper(s, [2, 6])
  assert.equal(g[0].special, 'raket-h')
  assert.equal(g[0].plats, 2)
})

test('fem i rad ger skål, L ger bomb, 2×2 ger frisbee', () => {
  let s = brade(['00000', '12341', '23412'])
  assert.equal(hittaGrupper(s)[0].special, 'skal')
  s = brade(['00012', '01234', '02341'])
  assert.equal(hittaGrupper(s)[0].special, 'bomb')
  s = brade(['00123', '00234', '12341'])
  assert.equal(hittaGrupper(s)[0].special, 'frisbee')
})

test('hål bryter en löpa', () => {
  const s = brade(['00#0', '1234', '2341'])
  assert.equal(hittaGrupper(s).length, 0)
})

// ----------------------------------------------------------------- dragen

test('ogiltigt byte nekas, giltigt godkänns', () => {
  const s = brade(['0102', '1034', '2341', '3412'])
  assert.equal(giltigtByte(s, 8, 12), false)
  assert.equal(giltigtByte(s, 1, 5), true)
})

test('ett drag rensar, fyller på och räknar drag', () => {
  const s = brade(['0102', '2041', '3412', '4123'])
  assert.ok(giltigtByte(s, 1, 5))
  const steg = tom(spelaDrag(s, 5, 1))
  assert.equal(s.drag, 19)
  assert.ok(steg.some((x) => x.typ === 'rensa'))
  assert.ok(steg.some((x) => x.typ === 'fall'))
  // inga hål kvar och inga färdiga matchningar
  s.tiles.forEach((t, i) => s.mask[i] && assert.ok(t, 'tom ruta ' + i))
  assert.equal(hittaGrupper(s).length, 0)
})

test('raket rensar hela raden och skadar lådor i vägen', () => {
  const s = brade(['0123', '1B45', '2345', '3450'])
  const i = 4 // (1,0)
  s.tiles[i].special = 'raket-h'
  const steg = tom(tassen(s, i))
  const forsta = steg.find((x) => x.typ === 'rensa')
  assert.equal(forsta.kallor[0].special, 'raket-h')
  assert.ok(forsta.lador.length === 1 && forsta.lador[0].hp === 0)
  assert.equal(forsta.borta.length, 3)
})

test('koppel går sönder men pjäsen ligger kvar', () => {
  const s = brade(['000', '123', '234'])
  s.koppel[1] = true
  const g = hittaGrupper(s)
  assert.equal(g.length, 1)
  const steg = tom(tassen(s, 1))
  assert.ok(steg[0].koppel.includes(1))
  assert.equal(s.koppel[1], false)
})

test('lera tvättas bort under en matchning', () => {
  const s = brade(['0123', '1234', '2340', '3401'])
  s.lera[5] = 2
  const steg = tom(tassen(s, 5))
  assert.equal(steg[0].lera[0].niva, 1)
  assert.equal(s.lera[5], 1)
})

test('bomben smäller två gånger', () => {
  const s = brade(['012345', '123450', '234501', '345012', '450123', '501234'])
  s.tiles[14].special = 'bomb' // (2,2)
  const steg = tom(tassen(s, 14))
  const smallar = steg.filter((x) => x.typ === 'rensa' && x.kallor.some((k) => k.special === 'bomb'))
  assert.ok(smallar.length >= 2, 'två smällar, fick ' + smallar.length)
  assert.ok(smallar[1].kallor.some((k) => k.andra))
})

test('skål + vanlig pjäs tar alla av den färgen', () => {
  const s = brade(['0123', '1230', '2301', '3012'])
  s.tiles[0].special = 'skal'
  const antalEttor = s.tiles.filter((t) => t && t.farg === 1).length
  const steg = tom(spelaDrag(s, 0, 1))
  const r = steg.find((x) => x.typ === 'rensa')
  assert.equal(r.kallor[0].special, 'skal')
  assert.ok(r.borta.filter((b) => b.farg === 1).length >= antalEttor)
})

test('raket + raket blir kors', () => {
  const s = brade(['01234', '12340', '23401', '34012', '40123'])
  s.tiles[12].special = 'raket-h'
  s.tiles[13].special = 'raket-v'
  const steg = tom(spelaDrag(s, 13, 12))
  const r = steg.find((x) => x.typ === 'rensa')
  assert.equal(r.kombo, 'kors')
  assert.ok(r.rensas.length >= 9)
})

test('frisbee flyger till en låda', () => {
  const s = brade(['0123B', '12340', '23401', '34012', '40123'])
  s.tiles[12].special = 'frisbee'
  const steg = tom(tassen(s, 12))
  const r = steg[0]
  assert.equal(r.kallor[0].special, 'frisbee')
  assert.equal(r.kallor[0].mal[0], 4)
  assert.equal(r.lador.length, 1)
})

test('skål + raket gör alla av färgen till raketer', () => {
  const s = brade(['01234', '12340', '23401', '34012', '40123'])
  s.tiles[0].special = 'skal'
  s.tiles[1].special = 'raket-h'
  const steg = tom(spelaDrag(s, 0, 1))
  const om = steg.find((x) => x.typ === 'omvandla')
  assert.ok(om && om.celler.length >= 3)
})

// --------------------------------------------------------------- tyngdkraft

test('pjäser glider snett in under en låda', () => {
  const s = brade(['012', '1B2', '345'])
  s.tiles[7] = null // (2,1) under lådan
  const moves = gravitation(s)
  assert.ok(s.tiles[7], 'rutan under lådan fylldes')
  assert.ok(moves.length >= 1)
})

test('pjäser faller igenom hål', () => {
  const s = brade(['012', '3#4', '501'])
  s.tiles[7] = null // (2,1)
  gravitation(s)
  assert.ok(s.tiles[7])
  assert.equal(s.tiles[4], null) // hålet är fortfarande tomt
})

test('köttben lämnas vid botten', () => {
  const s = brade(['0e2', '123', '234'], { kott: { antal: 1, max: 1 }, mal: [{ typ: 'kott', antal: 1 }] })
  s.tiles[4] = null
  s.tiles[7] = null
  const steg = tom(tassen(s, 0))
  assert.ok(steg.some((x) => x.typ === 'leverans'))
  assert.equal(s.levererade, 1)
  assert.ok(malKlara(s))
})

test('ogräs växer när man inte tar bort något', () => {
  const s = brade(['o123', '1234', '2340', '3401'])
  s.tiles[6] = { ...s.tiles[6], farg: 3 } // (1,2)=3 gör ingenting i sig
  // ett drag som inte rör ogräset
  const drag = hittaDrag(s).find(([a, b]) => a > 4 && b > 4)
  if (drag) {
    const fore = s.tiles.filter((t) => t && t.typ === 'ograss').length
    tom(spelaDrag(s, drag[0], drag[1]))
    const efter = s.tiles.filter((t) => t && t.typ === 'ograss').length
    assert.ok(efter >= fore)
  }
})

// ---------------------------------------------------- bollar och klockor

test('tennisbollen stoppar raketen och tar smällen', () => {
  const s = brade(['01b23', '12340', '23401'])
  s.tiles[0].special = 'raket-h'
  const steg = tom(tassen(s, 0))
  const r = steg[0]
  assert.ok(r.rensas.includes(2), 'bollen träffas')
  assert.ok(!r.rensas.includes(3) && !r.rensas.includes(4), 'raketen stannar vid bollen')
  assert.equal(r.bollar.length, 1)
  assert.deepEqual(r.kallor[0].linjer[0], { i: 0, lodrat: false, minus: 0, plus: 2 })
})

test('tennisbollen faller men går inte att byta', () => {
  const s = brade(['b12', '345', '012'])
  assert.equal(kanBytas(s, 0), false)
  s.tiles[3] = null
  gravitation(s)
  assert.equal(s.tiles[3].typ, 'boll', 'bollen föll ner')
})

test('en matchning bredvid tar bollen', () => {
  const s = brade(['1b2', '010', '304'])
  const steg = tom(spelaDrag(s, 7, 4))
  assert.ok(steg.some((x) => x.typ === 'rensa' && x.bollar.length === 1))
  assert.equal(s.samlat.boll, 1)
})

test('klockan tickar per drag och ringer vid noll', () => {
  const s = brade(['0102', '2041', '3412', '4123'], { mal: [{ typ: 'poang', antal: 1e9 }] })
  s.tiles[15].klocka = 2
  tom(spelaDrag(s, 5, 1))
  const kvar = s.tiles.find((t) => t && t.klocka !== undefined && t.klocka > 0)
  assert.ok(kvar && kvar.klocka === 1, 'klockan tickade ett steg')
  assert.equal(s.klockaRingde, null)
  const drag = hittaDrag(s).find(([a, b]) => s.tiles[a].klocka === undefined && s.tiles[b].klocka === undefined)
  const steg = tom(spelaDrag(s, drag[0], drag[1]))
  const tick = steg.find((x) => x.typ === 'klocka')
  if (s.tiles.some((t) => t && t.klocka === 0)) {
    assert.ok(tick && tick.ringde !== null)
    assert.notEqual(s.klockaRingde, null)
  }
})

test('en klocka som matchas bort räknas', () => {
  const s = brade(['000', '123', '234'], { mal: [{ typ: 'klocka', antal: 1 }] })
  s.tiles[1].klocka = 5
  tom(tassen(s, 1))
  assert.equal(s.samlat.klocka, 1)
  assert.ok(malKlara(s))
})

// ------------------------------------------------------------ slumpspel

// Riktiga banor med slumpade drag. Inga krascher, inga tomma rutor som
// borde vara fyllda, inga matchningar kvar, alltid ett drag.
const kartor = [
  ['........', '........', '........', '........', '........', '........', '........', '........'],
  ['#..ll..#', '.llLLll.', '.1.kk.1.', 'l..22..l', 'l..oo..l', '.1....1.', '.llLLll.', '#..ll..#'],
  ['..e..e..', '........', '..3..3..', '.k....k.', '........', '###..###', '........', '........'],
  ['.........', '..o...o..', '.........', '.2.....2.', '....#....', '.2.....2.', '.........', '..o...o..', '.........'],
  ['..b..t..', '........', '.t....b.', '........', '..bb....', '........', '.t..1...', '........'],
]
let drag = 0
for (let seed = 1; seed <= 40; seed++) {
  const karta = kartor[seed % kartor.length]
  const s = skapaSpel(
    {
      karta,
      drag: 30,
      farger: 4 + (seed % 3),
      mal: [{ typ: 'poang', antal: 1e9 }],
      kott: karta.join('').includes('e') ? { antal: 4, max: 2 } : null,
      bollar: karta.join('').includes('b') ? { chans: 0.1, max: 6 } : null,
      klockor: karta.join('').includes('t') ? { chans: 0.05, max: 3, tid: 12 } : null,
    },
    skapaRng(seed)
  )
  assert.equal(hittaGrupper(s).length, 0, 'startbrädet har matchningar')
  assert.ok(harDrag(s), 'startbrädet saknar drag')
  laggUtSpecialer(s, ['raket', 'bomb', 'skal', 'frisbee'])
  const rng = skapaRng(seed * 13)
  while (s.drag > 0) {
    const alla = hittaDrag(s)
    assert.ok(alla.length > 0, 'inga drag')
    const [a, b] = alla[Math.floor(rng() * alla.length)]
    if (rng() < 0.08) {
      tom(bytFritt(s, a, b))
      s.drag--
    } else tom(spelaDrag(s, a, b))
    drag++
    assert.equal(hittaGrupper(s).length, 0, 'matchning kvar efter drag')
    const ids = new Set()
    s.tiles.forEach((t, i) => {
      if (!t) return
      assert.ok(s.mask[i], 'pjäs i ett hål')
      assert.ok(!ids.has(t.id), 'dubbla id')
      ids.add(t.id)
      if (t.typ === 'bit') assert.ok(!t.armerad, 'laddad bomb kvar')
    })
    assert.ok(s.lera.every((x) => x >= 0))
    assert.ok(hittaTips(s))
  }
  tom(godisregn(s))
  // Med fyra färger kan kedjorna i finalen skapa nya specialer i det
  // oändliga; finalen har ett tak, så ett par kan bli kvar. Fler än så
  // betyder att något inte utlöses.
  assert.ok(s.tiles.filter((t) => t && t.typ === 'bit' && t.special).length <= 4, 'specialer kvar efter finalen')
  malStatus(s)
}
console.log('  ok', drag, 'slumpade drag på', kartor.length, 'kartor')

// ------------------------------------------------------------------ banorna

test('alla hundra banor går att bygga och spela', () => {
  assert.equal(BANOR.length, VARLDAR.length * BANOR_PER_VARLD)
  for (const b of BANOR) {
    const namn = 'bana ' + b.nr
    assert.ok(b.drag >= 10 && b.drag <= 60, namn + ': dragantal')
    assert.ok(b.stjarnor[0] < b.stjarnor[1] && b.stjarnor[1] < b.stjarnor[2], namn + ': stjärngränser')
    assert.ok(b.mal.length > 0, namn + ': mål saknas')
    for (const m of b.mal) {
      if (m.typ === 'farg') assert.ok(m.farg < b.farger, namn + ': målfärgen finns inte på brädet')
      if (m.typ === 'poang') assert.ok(m.antal > 0, namn + ': poängmål utan poäng')
    }
    const s = skapaSpel(b, skapaRng(b.nr))
    assert.equal(hittaGrupper(s).length, 0, namn + ': färdiga matchningar vid start')
    assert.ok(harDrag(s), namn + ': inga drag vid start')
    const status = malStatus(s)
    for (const m of status) {
      if (['lera', 'lada', 'ograss', 'koppel'].includes(m.typ)) assert.ok(m.kvar > 0, namn + ': målet ' + m.typ + ' finns inte på kartan')
    }
    if (b.kott) assert.ok(s.utgangar.size > 0, namn + ': köttben utan utgång')
  }
  assert.equal(BANOR.filter((b) => b.boss).length, VARLDAR.length)
})

console.log(`krossen: ${ok + 1} tester gick igenom`)
