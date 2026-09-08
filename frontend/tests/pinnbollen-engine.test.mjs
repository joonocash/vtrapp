// Testar pinnbollenEngine.js (och pinnbollenKrafter.js) utan att rita
// något. Ren fysik och regler.
//
// Körs med: node tests/pinnbollen-engine.test.mjs
//
// Motorn har flera kulor i luften samtidigt (spel.kulor, en array) i
// stället för en enda spel.kula. Vakthundens tillstånd (lagst,
// utanFramsteg, ankarX, ankarY) ligger på varje kula, inte på spel. Många
// tester bygger egna pinnar/kulor-arrayer i stället för att gå via
// skapaBana()/skjut(), för att få exakt kontroll på geometrin.

import assert from 'node:assert/strict'
import {
  BREDD,
  HOJD,
  PINNE_R,
  KULA_R,
  MIN_AVSTAND,
  RORELSE_TROSKEL,
  resetIds,
  mult,
  skapaBana,
  skapaSpel,
  nastaBana,
  orangeKvar,
  sikta,
  skjut,
  steg,
  KONSTANTER,
} from '../src/rotspel/games/pinnbollenEngine.js'
import { draKraft, chansPerGrad, KRAFTER, TOTALVIKT, GRADER, kraftMedId } from '../src/rotspel/games/pinnbollenKrafter.js'

let failed = 0
let passed = 0

function test(namn, fn) {
  try {
    fn()
    passed++
    console.log('  ok  ' + namn)
  } catch (err) {
    failed++
    console.log('FAIL  ' + namn)
    console.log('      ' + err.message)
  }
}

function section(namn) {
  console.log('\n' + namn)
}

// Enkel seedad slump så ett misslyckat test går att återskapa.
function slumpare(fro) {
  let s = fro >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function slumpvinkel(rnd) {
  const min = Math.PI * 0.08
  const max = Math.PI * 0.92
  return min + rnd() * (max - min)
}

// En kula i det format motorn själv bygger (skapaKula är intern, så vi
// speglar formen här för tester som behöver full kontroll).
function manuellKula(x, y, vx, vy, extra = {}) {
  return {
    id: extra.id ?? -1,
    x,
    y,
    vx,
    vy,
    r: extra.r ?? KULA_R,
    lagst: extra.lagst ?? y,
    utanFramsteg: extra.utanFramsteg ?? 0,
    ankarX: extra.ankarX ?? x,
    ankarY: extra.ankarY ?? y,
  }
}

// Kör ett skott till slut (skottSlut/slut/banaKlar) och samlar alla händelser.
// underVarjeSteg får (spel) efter varje steg().
function korSkott(spel, { maxSteg = 3000, underVarjeSteg = null } = {}) {
  const alla = []
  for (let i = 0; i < maxSteg; i++) {
    const h = steg(spel)
    alla.push(...h)
    if (underVarjeSteg) underVarjeSteg(spel)
    if (h.some((e) => e.typ === 'skottSlut' || e.typ === 'slut')) return alla
  }
  throw new Error('skottet tog aldrig slut inom ' + maxSteg + ' steg')
}

function tatGrupp() {
  // tätt rutnät, alla orange, så ett skott ofta studsar mellan flera innan
  // det når botten
  const pinnar = []
  let id = 1
  const mellanrum = (PINNE_R + KULA_R) * 1.3
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      pinnar.push({
        id: id++,
        x: 60 + c * mellanrum,
        y: 60 + r * mellanrum,
        orange: true,
        gron: false,
        traffad: false,
      })
    }
  }
  return pinnar
}

// Räddningsstatistik: hur många skott av `antal` (per banform) ledde till
// minst en raddning-händelse. Används både för sammanfattningen i
// rapporten och för själva testerna.
function raddningsfrekvens({ antal = 100, seed = 4711, aktivKraft = null } = {}) {
  const rnd = slumpare(seed)
  const perForm = { 0: 0, 1: 0, 2: 0, 3: 0 }
  for (let form = 0; form < 4; form++) {
    const niva = form === 0 ? 4 : form
    for (let trial = 0; trial < antal; trial++) {
      const spel = skapaSpel(niva)
      if (aktivKraft) spel.aktivKraft = kraftMedId(aktivKraft)
      sikta(spel, slumpvinkel(rnd))
      skjut(spel)
      let raddad = false
      for (let i = 0; i < 2500 && spel.kulor.length > 0; i++) {
        const h = steg(spel)
        if (h.some((e) => e.typ === 'raddning')) raddad = true
        if (h.some((e) => e.typ === 'skottSlut' || e.typ === 'slut')) break
      }
      if (raddad) perForm[form]++
    }
  }
  return perForm
}

// ------------------------------------------------------------- kollisionen

section('Kollisionen')

test('kulan studsar mot en ensam pinne (vy byter tecken)', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: BREDD / 2, y: 120, orange: false, gron: false, traffad: false }]
  sikta(spel, Math.PI / 2)
  skjut(spel)

  let vyForeTraff = null
  let vyEfterTraff = null
  for (let i = 0; i < 200 && spel.kulor.length > 0; i++) {
    const vyFore = spel.kulor[0].vy
    const h = steg(spel)
    if (h.some((e) => e.typ === 'traff')) {
      vyForeTraff = vyFore
      vyEfterTraff = spel.kulor[0].vy
      break
    }
  }
  assert.notStrictEqual(vyForeTraff, null, 'kulan träffade aldrig pinnen')
  assert.ok(vyForeTraff > 0, 'kulan borde falla nedåt före träffen')
  assert.ok(vyEfterTraff < 0, 'kulan borde studsa uppåt efter träffen')
})

test('kulan hamnar aldrig märkbart inuti en pinne (500 slumpade skott)', () => {
  // Kollisionsupplösningen kollar en pinne i taget per delsteg: löser den ut
  // träffen mot pinne A kan kulan hamna någon hundradels pixel in i en
  // pinne B som redan hunnit kollas i samma delsteg. Toleransen här är satt
  // för att fånga riktiga genomträngningar (flera pixlar), inte den kända
  // sub-pixel-resten (se tidigare granskning, ~0.3px).
  const TOLERANS = 0.75
  const rnd = slumpare(20260908)
  for (let trial = 0; trial < 500; trial++) {
    const spel = skapaSpel(1 + (trial % 4))
    sikta(spel, slumpvinkel(rnd))
    skjut(spel)

    let stegRaknare = 0
    korSkott(spel, {
      maxSteg: 2500,
      underVarjeSteg: (s) => {
        stegRaknare++
        for (const k of s.kulor) {
          for (const p of s.pinnar) {
            const dist = Math.hypot(k.x - p.x, k.y - p.y)
            assert.ok(
              dist >= PINNE_R + k.r - TOLERANS,
              `tydlig överlappning i skott ${trial} steg ${stegRaknare}: dist=${dist.toFixed(3)}`
            )
          }
        }
      },
    })
  }
})

test('tunnling: hög fart mot en pinne registreras ändå som träff', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: BREDD / 2, y: 52, orange: false, gron: false, traffad: false }]
  sikta(spel, Math.PI / 2)
  skjut(spel)
  spel.kulor[0].vy = 40 // ska hoppa långt förbi pinnen på ett bildruta utan delsteg

  const h = steg(spel)
  assert.ok(h.some((e) => e.typ === 'traff'), 'snabb kula missade pinnen den skulle träffa')
})

test('tunnling: samma snabba kula missar en pinne som faktiskt inte ligger i vägen', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: BREDD / 2 + 80, y: 52, orange: false, gron: false, traffad: false }]
  sikta(spel, Math.PI / 2)
  skjut(spel)
  spel.kulor[0].vy = 40

  const h1 = steg(spel)
  const h2 = spel.kulor.length > 0 ? steg(spel) : []
  assert.ok(
    ![...h1, ...h2].some((e) => e.typ === 'traff'),
    'kulan träffade en pinne som låg för långt bort i sidled'
  )
})

// ----------------------------------------------------------------- reglerna

section('Reglerna')

test('en pinne träffas bara en gång per skott (inga dubbletter i traffadeIdn)', () => {
  const spel = skapaSpel(1)
  spel.pinnar = tatGrupp()
  sikta(spel, Math.PI * 0.5)
  skjut(spel)
  korSkott(spel)

  const unika = new Set(spel.traffadeIdn)
  assert.strictEqual(unika.size, spel.traffadeIdn.length, 'traffadeIdn innehöll dubbletter')
})

test('mult() ger 1, 2, 3, 5, 10 vid rätt trösklar', () => {
  assert.strictEqual(mult(0), 1)
  assert.strictEqual(mult(1), 1)
  assert.strictEqual(mult(2), 2)
  assert.strictEqual(mult(3), 2)
  assert.strictEqual(mult(4), 3)
  assert.strictEqual(mult(5), 3)
  assert.strictEqual(mult(6), 5)
  assert.strictEqual(mult(7), 5)
  assert.strictEqual(mult(8), 10)
  assert.strictEqual(mult(20), 10)
})

test('träffade pinnar försvinner först vid skottSlut, inte vid traff', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: BREDD / 2, y: 120, orange: false, gron: false, traffad: false }]
  sikta(spel, Math.PI / 2)
  skjut(spel)

  let sagFortfarandeMedISpelPinnar = false
  let skottSlutHandelse = null
  for (let i = 0; i < 500 && !skottSlutHandelse; i++) {
    const h = steg(spel)
    const traff = h.find((e) => e.typ === 'traff')
    if (traff && !sagFortfarandeMedISpelPinnar) {
      const p = spel.pinnar.find((q) => q.id === traff.pinne.id)
      assert.ok(p, 'pinnen togs bort direkt vid traff, inte vid skottSlut')
      assert.strictEqual(p.traffad, true)
      sagFortfarandeMedISpelPinnar = true
    }
    const slutH = h.find((e) => e.typ === 'skottSlut')
    if (slutH) skottSlutHandelse = slutH
  }
  assert.ok(sagFortfarandeMedISpelPinnar, 'testet såg aldrig träffen')
  assert.ok(
    !spel.pinnar.some((p) => p.id === 1),
    'pinnen fanns kvar även efter skottSlut'
  )
})

test('poängen för en pinne använder multiplikatorn som gällde när den träffades', () => {
  let sagMultOver1 = false
  for (let trial = 0; trial < 40; trial++) {
    const spel = skapaSpel(1)
    spel.pinnar = tatGrupp()
    sikta(spel, Math.PI * (0.15 + (0.7 * trial) / 40))
    skjut(spel)

    let lopandeOrange = 0
    for (let i = 0; i < 3000 && spel.kulor.length > 0; i++) {
      const h = steg(spel)
      for (const e of h) {
        if (e.typ !== 'traff') continue
        if (e.orange) lopandeOrange++
        const vantadMult = mult(lopandeOrange)
        const vantadPoang = (e.orange ? 100 : 10) * vantadMult
        assert.strictEqual(e.mult, vantadMult, 'fel multiplikator på traff-händelsen')
        assert.strictEqual(e.poang, vantadPoang, 'fel poäng på traff-händelsen')
        if (vantadMult > 1) sagMultOver1 = true
      }
    }
  }
  assert.ok(sagMultOver1, 'testet fick aldrig ett skott med flera orange, så det testade inte mycket')
})

// --------------------------------------------------------------- vakthunden

section('Vakthunden')

test('kula som fastnar mellan två pinnar löser ut en raddning-händelse', () => {
  const spel = skapaSpel(1)
  const x0 = 150
  const y0 = 100
  const mellanrum = PINNE_R + KULA_R - 1 // kilad, precis trång nog
  spel.pinnar = [
    { id: 1, x: x0 - mellanrum, y: y0 + 6, orange: false, gron: false, traffad: false },
    { id: 2, x: x0 + mellanrum, y: y0 + 6, orange: false, gron: false, traffad: false },
  ]
  spel.kulor = [manuellKula(x0, y0, 0, 0, { id: 1 })]
  spel.lage = 'skjuter'

  let raddningsHandelse = null
  let alla = []
  for (let i = 0; i < 400 && !raddningsHandelse; i++) {
    const h = steg(spel, 16.7)
    alla = alla.concat(h)
    raddningsHandelse = h.find((e) => e.typ === 'raddning')
  }
  assert.ok(raddningsHandelse, 'ingen raddning-händelse kom trots att kulan satt fast')
  assert.strictEqual(raddningsHandelse.kulaId, 1, 'raddning-händelsen hade fel kulaId')

  // räddningen räknas som träff och ger poäng
  const traffHandelse = alla.find((e) => e.typ === 'traff' && e.pinne.id === raddningsHandelse.pinne.id)
  assert.ok(traffHandelse, 'den räddade pinnen gav ingen traff-händelse')
  assert.ok(traffHandelse.poang > 0, 'den räddade pinnen gav ingen poäng')
  assert.ok(spel.traffadeIdn.includes(raddningsHandelse.pinne.id), 'pinnen räknas inte som träffad')
})

test('raddningen tar en pinne, inte alla', () => {
  const spel = skapaSpel(1)
  const x0 = 150
  const y0 = 100
  const mellanrum = PINNE_R + KULA_R - 1
  spel.pinnar = [
    { id: 1, x: x0 - mellanrum, y: y0 + 6, orange: false, gron: false, traffad: false },
    { id: 2, x: x0 + mellanrum, y: y0 + 6, orange: false, gron: false, traffad: false },
  ]
  spel.kulor = [manuellKula(x0, y0, 0, 0, { id: 1 })]
  spel.lage = 'skjuter'

  const antalFore = spel.pinnar.length
  let raddningar = 0
  for (let i = 0; i < 400 && spel.kulor.length > 0; i++) {
    const h = steg(spel, 16.7)
    raddningar += h.filter((e) => e.typ === 'raddning').length
    if (raddningar > 0) break
  }
  assert.strictEqual(raddningar, 1, 'mer än en raddning-händelse kom på en gång')
  assert.strictEqual(spel.pinnar.length, antalFore - 1, 'raddningen tog inte exakt en pinne')
})

test('två kulor kan fastna samtidigt och räddas oberoende', () => {
  // Två separata "V-fållor" långt ifrån varandra, en kula i var och en.
  // Båda fastnar i samma takt (identisk uppställning) och ska räddas var
  // för sig, med rätt pinne kopplad till rätt kulaId — inte bara att båda
  // kulaId dyker upp NÅGON gång (en kula som repeatedvis knuffas fel kan
  // råka ramla ut och skifta indexen rätt av misstag), utan att den räddade
  // pinnen faktiskt hörde till just den kulans egen fålla.
  const mellanrum = PINNE_R + KULA_R - 1
  const falla = (cx, cy) => [
    { x: cx - mellanrum, y: cy + 6 },
    { x: cx + mellanrum, y: cy + 6 },
  ]
  const [p1, p2] = falla(80, 100)
  const [p3, p4] = falla(220, 100)
  const spel = skapaSpel(1)
  spel.pinnar = [
    { id: 1, ...p1, orange: false, gron: false, traffad: false },
    { id: 2, ...p2, orange: false, gron: false, traffad: false },
    { id: 3, ...p3, orange: false, gron: false, traffad: false },
    { id: 4, ...p4, orange: false, gron: false, traffad: false },
  ]
  spel.kulor = [manuellKula(80, 100, 0, 0, { id: 101 }), manuellKula(220, 100, 0, 0, { id: 102 })]
  spel.lage = 'skjuter'

  const raddningar = []
  for (let i = 0; i < 160 && raddningar.length < 2; i++) {
    const h = steg(spel, 16.7)
    for (const e of h) {
      if (e.typ === 'raddning') raddningar.push({ kulaId: e.kulaId, pinneId: e.pinne.id })
    }
  }
  assert.strictEqual(raddningar.length, 2, `väntade 2 räddningar inom 160 steg, fick ${raddningar.length}`)
  const kulaIdn = raddningar.map((r) => r.kulaId).sort()
  assert.deepStrictEqual(kulaIdn, [101, 102], 'räddningarna hade inte en av varje kulaId')
  for (const r of raddningar) {
    const vantade = r.kulaId === 101 ? [1, 2] : [3, 4]
    assert.ok(
      vantade.includes(r.pinneId),
      `kula ${r.kulaId} räddades med pinne ${r.pinneId}, hörde till fel fålla (väntade en av ${vantade})`
    )
  }
})

test('kula som fastnar långt från alla pinnar ger en knuff-händelse i stället', () => {
  const spel = skapaSpel(1)
  spel.pinnar = []
  spel.kulor = [manuellKula(150, 200, 0, 0, { id: 1 })]
  spel.lage = 'skjuter'

  let knuffHandelse = null
  for (let i = 0; i < 400 && !knuffHandelse; i++) {
    const h = steg(spel, 16.7)
    knuffHandelse = h.find((e) => e.typ === 'knuff')
    // Motorn har ingen "golv" utom pinnar (om inte studsgolvet är aktivt),
    // så en kula i tomma luften faller alltid till slut och vakthunden
    // triggas aldrig av sig själv. Vi simulerar den låsta situationen
    // genom att hålla kulan still mellan varje steg.
    if (spel.kulor[0]) {
      spel.kulor[0].y = 200
      spel.kulor[0].vy = 0
      spel.kulor[0].vx = 0
    }
  }
  assert.ok(knuffHandelse, 'ingen knuff-händelse kom')
  assert.strictEqual(knuffHandelse.kulaId, 1, 'knuff-händelsen hade fel kulaId')
  assert.strictEqual(spel.kulor.length, 1, 'kulan borde fortfarande finnas kvar efter en knuff')
})

test('HART_TAK_MS avslutar skottet oavsett vakthundens progress-mätning', () => {
  const spel = skapaSpel(1)
  spel.pinnar = []
  spel.kulor = [manuellKula(150, 200, 0, 0, { id: 1 })]
  spel.lage = 'skjuter'

  let skottSlutHandelse = null
  for (let i = 0; i < 3000 && !skottSlutHandelse; i++) {
    const h = steg(spel, 16.7)
    skottSlutHandelse = h.find((e) => e.typ === 'skottSlut')
    if (spel.kulor[0]) {
      // krypande nedåtrörelse så lagst hela tiden hänger med och raddningen
      // aldrig triggas — bara det hårda taket ska kunna avsluta skottet här
      spel.kulor[0].y += 0.01
      spel.kulor[0].vy = 0
      spel.kulor[0].vx = 0
    }
  }
  assert.ok(skottSlutHandelse, 'skottet avslutades aldrig trots hårt tak')
  assert.ok(spel.skottTid > KONSTANTER.HART_TAK_MS, 'skottet avslutades men inte via hårt tak')
})

test('en kula i en brant båge över tomt område, i luften längre än FAST_MS, utlöser varken raddning eller knuff', () => {
  // Renodlar precis det fallet som djupmåttet ensamt missar: kulan stiger
  // (fritt fall uppåt) i en lång, obruten rörelse och gör därför ALDRIG ett
  // nytt lägsta under hela resan — men den förflyttar sig hela tiden
  // hundratals pixlar, långt över RORELSE_TROSKEL.
  const spel = skapaSpel(1)
  spel.pinnar = []
  spel.kulor = [manuellKula(150, 400, 0, 0, { id: 1, lagst: 400 })]
  spel.lage = 'skjuter'

  const dtMs = 16.7
  const antalSteg = Math.ceil((KONSTANTER.FAST_MS * 1.4) / dtMs) // gott och väl över FAST_MS
  assert.ok(antalSteg * dtMs > KONSTANTER.FAST_MS, 'testet mäter inte tillräckligt länge')
  assert.ok(350 > RORELSE_TROSKEL, 'bågens amplitud måste faktiskt räknas som rörelse')

  const alla = []
  for (let i = 0; i < antalSteg; i++) {
    // driv kulan i en jämn, brant båge uppåt (y minskar monotont)
    spel.kulor[0].y = 400 - 350 * (i / (antalSteg - 1))
    const h = steg(spel, dtMs)
    alla.push(...h)
  }

  assert.ok(
    !alla.some((e) => e.typ === 'raddning' || e.typ === 'knuff'),
    'en kula i en lång, obruten båge löste ut vakthunden trots att den aldrig var fastkilad'
  )
})

test('en normal fallande kula utlöser aldrig vakthunden (200 vanliga skott)', () => {
  const rnd = slumpare(4711)
  let raddningar = 0
  for (let trial = 0; trial < 200; trial++) {
    const spel = skapaSpel(1 + (trial % 4))
    sikta(spel, slumpvinkel(rnd))
    skjut(spel)
    const h = korSkott(spel, { maxSteg: 2500 })
    raddningar += h.filter((e) => e.typ === 'raddning').length
  }
  assert.strictEqual(raddningar, 0, 'en vanlig kula utlöste vakthunden')
})

// -------------------------------------------------------------- banorna

section('Banorna')

test('skapaBana(n) är deterministisk för samma n', () => {
  resetIds()
  const a = skapaBana(7)
  resetIds()
  const b = skapaBana(7)
  assert.deepStrictEqual(a, b)
})

test('alla pinnar i alla banformer ligger innanför kanterna', () => {
  for (let niva = 1; niva <= 12; niva++) {
    const bana = skapaBana(niva)
    for (const p of bana) {
      assert.ok(p.x > 0 && p.x < BREDD, `pinne utanför bredden i bana ${niva}: x=${p.x}`)
      assert.ok(p.y > 0 && p.y < HOJD, `pinne utanför höjden i bana ${niva}: y=${p.y}`)
    }
  }
})

test('varje bana har minst 10 orange pinnar', () => {
  for (let niva = 1; niva <= 12; niva++) {
    const bana = skapaBana(niva)
    const antalOrange = bana.filter((p) => p.orange).length
    assert.ok(antalOrange >= 10, `bana ${niva} hade bara ${antalOrange} orange pinnar`)
  }
})

test('inga två pinnar i någon bana ligger närmare varandra än MIN_AVSTAND', () => {
  for (let niva = 1; niva <= 20; niva++) {
    const bana = skapaBana(niva)
    let minsta = Infinity
    let sammaPar = null
    for (let i = 0; i < bana.length; i++) {
      for (let j = i + 1; j < bana.length; j++) {
        const d = Math.hypot(bana[i].x - bana[j].x, bana[i].y - bana[j].y)
        if (d < minsta) {
          minsta = d
          sammaPar = [bana[i], bana[j]]
        }
      }
    }
    assert.ok(
      minsta >= MIN_AVSTAND,
      `bana ${niva} (form ${niva % 4}) har två pinnar bara ${minsta.toFixed(1)}px isär: ${JSON.stringify(sammaPar)}`
    )
  }
})

test('varje bana har exakt två gröna pinnar, och ingen pinne är både grön och orange', () => {
  for (let niva = 1; niva <= 20; niva++) {
    const bana = skapaBana(niva)
    const grona = bana.filter((p) => p.gron)
    assert.strictEqual(grona.length, 2, `bana ${niva} hade ${grona.length} gröna pinnar, väntade 2`)
    assert.ok(
      !bana.some((p) => p.gron && p.orange),
      `bana ${niva} hade en pinne som var både grön och orange`
    )
  }
})

// ------------------------------------------------------------- krafterna

section('Krafterna (pinnbollenKrafter.js)')

test('draKraft med fast pseudoslump ger förväntad fördelning över 10 000 dragningar', () => {
  const rnd = slumpare(1337)
  const antal = 10000
  const raknare = Object.fromEntries(KRAFTER.map((k) => [k.id, 0]))
  for (let i = 0; i < antal; i++) {
    raknare[draKraft(rnd).id]++
  }
  for (const k of KRAFTER) {
    const vantad = (k.vikt / TOTALVIKT) * antal
    const faktisk = raknare[k.id]
    // 10 000 dragningar ger gott om marginal — tillåt 25 % relativ
    // avvikelse (eller minst 40 dragningar för de allra sällsyntaste) utan
    // att det ska räknas som en skev fördelning.
    const marginal = Math.max(40, vantad * 0.25)
    assert.ok(
      Math.abs(faktisk - vantad) <= marginal,
      `kraft ${k.id}: fick ${faktisk}, väntade ~${vantad.toFixed(0)} (±${marginal.toFixed(0)})`
    )
  }
})

test('chansPerGrad() summerar till 100', () => {
  const chans = chansPerGrad()
  const summa = Object.values(chans).reduce((a, b) => a + b, 0)
  assert.strictEqual(summa, 100)
  for (const g of Object.keys(GRADER)) {
    assert.ok(g in chans, `graden ${g} saknades i chansPerGrad()`)
  }
})

// --------------------------------------------------------------- krafteffekter

section('Krafteffekter i motorn')

test('trippel ger exakt tre kulor, och skottet avslutas först när alla tre är borta', () => {
  const spel = skapaSpel(1)
  spel.aktivKraft = kraftMedId('trippel')
  sikta(spel, Math.PI / 2)
  skjut(spel)
  assert.strictEqual(spel.kulor.length, 3, 'trippel gav inte tre kulor')

  let sagSkottSlutMedKulorKvar = false
  let skottSlutHandelse = null
  for (let i = 0; i < 3000 && !skottSlutHandelse; i++) {
    const h = steg(spel)
    skottSlutHandelse = h.find((e) => e.typ === 'skottSlut')
    if (skottSlutHandelse && spel.kulor.length > 0) sagSkottSlutMedKulorKvar = true
  }
  assert.ok(skottSlutHandelse, 'skottet tog aldrig slut')
  assert.ok(!sagSkottSlutMedKulorKvar, 'skottSlut kom medan kulor fortfarande fanns kvar')
  assert.strictEqual(spel.kulor.length, 0, 'kulor fanns kvar efter skottSlut')
})

test('storkula fördubblar kulans radie', () => {
  const spel = skapaSpel(1)
  spel.aktivKraft = kraftMedId('stor')
  sikta(spel, Math.PI / 2)
  skjut(spel)
  assert.strictEqual(spel.kulor[0].r, KULA_R * KONSTANTER.STOR_SKALA)
})

test('studsgolvet studsar exakt en gång även med tre kulor', () => {
  const spel = skapaSpel(1)
  spel.pinnar = []
  spel.golvKvar = true
  spel.kulor = [
    manuellKula(100, HOJD, 0, 5, { id: 1 }),
    manuellKula(150, HOJD, 0, 5, { id: 2 }),
    manuellKula(200, HOJD, 0, 5, { id: 3 }),
  ]
  spel.lage = 'skjuter'

  const alla = []
  for (let i = 0; i < 500 && spel.kulor.length > 0; i++) {
    alla.push(...steg(spel, 16.7))
  }
  const golvHandelser = alla.filter((e) => e.typ === 'golv')
  assert.strictEqual(golvHandelser.length, 1, 'studsgolvet studsade inte exakt en gång')
})

test('genomborraren registrerar träff utan att ändra hastighetsriktning', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: BREDD / 2, y: 120, orange: false, gron: false, traffad: false }]
  spel.aktivKraft = kraftMedId('genom')
  sikta(spel, Math.PI / 2)
  skjut(spel)
  const vxFore = spel.kulor[0].vx // exakt 0 (rakt ner) — gravitationen rör aldrig vx

  let traffHandelse = null
  for (let i = 0; i < 300 && spel.kulor.length > 0 && !traffHandelse; i++) {
    const h = steg(spel)
    traffHandelse = h.find((e) => e.typ === 'traff')
  }
  assert.ok(traffHandelse, 'genomborraren registrerade aldrig träffen')
  assert.strictEqual(spel.kulor[0].vx, vxFore, 'genomborraren ändrade vx trots att den bara ska passera rakt igenom')
})

test('magneten drar kulan mot närmaste orange pinne', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: 250, y: 200, orange: true, gron: false, traffad: false }]
  spel.aktivKraft = kraftMedId('magnet')
  sikta(spel, Math.PI / 2) // rakt ner — utan magneten skulle x aldrig ändras
  skjut(spel)
  const x0 = spel.kulor[0].x
  for (let i = 0; i < 20 && spel.kulor.length > 0; i++) steg(spel)
  assert.ok(spel.kulor.length === 0 || spel.kulor[0].x > x0, 'magneten drog inte kulan mot pinnen')
})

test('grön pinne drar en kraft direkt och sparar den till nästa skott (utom extra)', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: BREDD / 2, y: 120, orange: false, gron: true, traffad: false }]
  sikta(spel, Math.PI / 2)
  skjut(spel)

  let kraftHandelse = null
  const alla = korSkott(spel, {
    underVarjeSteg: () => {},
  })
  kraftHandelse = alla.find((e) => e.typ === 'kraft')
  assert.ok(kraftHandelse, 'ingen kraft-händelse kom för den gröna pinnen')

  if (kraftHandelse.kraft.direkt) {
    assert.strictEqual(spel.aktivKraft, null, 'en direkt kraft (extra) blev aktivKraft')
  } else {
    assert.strictEqual(spel.aktivKraft, kraftHandelse.kraft, 'kraften blev inte aktivKraft efter skottSlut')
  }
})

test('en aktiv kraft överlever ett banbyte (nastaBana tappar den inte)', () => {
  // nastaBana() bygger ett helt nytt spelobjekt via skapaSpel(), som annars
  // nollställer aktivKraft till null. En kraft som vanns i sista skottet på
  // en bana ska gälla på nästa banas första skott, inte försvinna i bytet.
  const spel = skapaSpel(1)
  spel.aktivKraft = kraftMedId('trippel')
  const nasta = nastaBana(spel)
  assert.strictEqual(nasta.aktivKraft, spel.aktivKraft, 'aktivKraft följde inte med i banbytet')

  // och den fungerar faktiskt på banans första skott
  sikta(nasta, Math.PI / 2)
  skjut(nasta)
  assert.strictEqual(nasta.kulor.length, 3, 'den medhavda kraften gav inte tre kulor på nästa bana')
})

// -------------------------------------------------------- räddningsfrekvens

section('Räddningsfrekvens (5 %-gränsen)')

test('räddningsfrekvensen är under 5 % per banform utan krafter', () => {
  const perForm = raddningsfrekvens({ antal: 100, seed: 4711 })
  for (const form of [0, 1, 2, 3]) {
    assert.ok(perForm[form] < 5, `form ${form}: ${perForm[form]}/100 räddningar (>=5%)`)
  }
})

test('räddningsfrekvensen är under 5 % per banform med storkula aktiv', () => {
  // En dubbelt så stor kula behöver egentligen dubbelt så mycket fri yta
  // (se MIN_AVSTAND-kommentaren), men den marginalen är bara inbyggd i
  // banorna för normalstora kulor. Det här testet mäter hur illa det
  // faktiskt blir i praktiken, inte om den teoretiska marginalen håller.
  const perForm = raddningsfrekvens({ antal: 100, seed: 4711, aktivKraft: 'stor' })
  for (const form of [0, 1, 2, 3]) {
    assert.ok(perForm[form] < 5, `form ${form} med storkula: ${perForm[form]}/100 räddningar (>=5%)`)
  }
})

// ------------------------------------------------------------------ summary

console.log(`\n${passed} godkända, ${failed} misslyckade`)
process.exitCode = failed > 0 ? 1 : 0
