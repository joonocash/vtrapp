// Testar pinnbollenEngine.js utan att rita något. Ren fysik och regler.
//
// Körs med: node tests/pinnbollen-engine.test.mjs
//
// Flera tester bygger egna pinnar-arrayer i stället för att gå via
// skapaBana(), för att få exakt kontroll på geometrin (var pinnarna sitter,
// hur nära kulan är). Motorn bryr sig bara om {id,x,y,orange,traffad} på
// varje pinne, så det är säkert.

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
  orangeKvar,
  sikta,
  skjut,
  steg,
  KONSTANTER,
} from '../src/rotspel/games/pinnbollenEngine.js'

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

// Kör ett skott till slut (skottSlut/slut/banaKlar) och samlar alla händelser.
// underVarjeSteg får (spel) före kulan är null, en gång per steg().
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
        traffad: false,
      })
    }
  }
  return pinnar
}

// ------------------------------------------------------------- kollisionen

section('Kollisionen')

test('kulan studsar mot en ensam pinne (vy byter tecken)', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: BREDD / 2, y: 120, orange: false, traffad: false }]
  sikta(spel, Math.PI / 2)
  skjut(spel)

  let vyForeTraff = null
  let vyEfterTraff = null
  for (let i = 0; i < 200 && spel.kula; i++) {
    const vyFore = spel.kula.vy
    const h = steg(spel)
    if (h.some((e) => e.typ === 'traff')) {
      vyForeTraff = vyFore
      vyEfterTraff = spel.kula.vy
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
  // pinne B som redan hunnit kollas i samma delsteg (ordningen i arrayen
  // avgör). Uppmätt värsta avvikelse i den här körningen är ~0.3px, dvs
  // runt 2-3 % av kollisionsradien — osynligt i spelet. Toleransen här är
  // satt för att fånga riktiga genomträngningar (flera pixlar), inte den
  // kända sub-pixel-resten.
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
        if (!s.kula) return
        for (const p of s.pinnar) {
          const dist = Math.hypot(s.kula.x - p.x, s.kula.y - p.y)
          assert.ok(
            dist >= PINNE_R + KULA_R - TOLERANS,
            `tydlig överlappning i skott ${trial} steg ${stegRaknare}: dist=${dist.toFixed(3)}`
          )
        }
      },
    })
  }
})

test('tunnling: hög fart mot en pinne registreras ändå som träff', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: BREDD / 2, y: 52, orange: false, traffad: false }]
  sikta(spel, Math.PI / 2)
  skjut(spel)
  spel.kula.vy = 40 // ska hoppa långt förbi pinnen på ett bildruta utan delsteg

  const h = steg(spel)
  assert.ok(h.some((e) => e.typ === 'traff'), 'snabb kula missade pinnen den skulle träffa')
})

test('tunnling: samma snabba kula missar en pinne som faktiskt inte ligger i vägen', () => {
  const spel = skapaSpel(1)
  spel.pinnar = [{ id: 1, x: BREDD / 2 + 80, y: 52, orange: false, traffad: false }]
  sikta(spel, Math.PI / 2)
  skjut(spel)
  spel.kula.vy = 40

  const h1 = steg(spel)
  const h2 = spel.kula ? steg(spel) : []
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
  spel.pinnar = [{ id: 1, x: BREDD / 2, y: 120, orange: false, traffad: false }]
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
    for (let i = 0; i < 3000 && spel.kula; i++) {
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
    { id: 1, x: x0 - mellanrum, y: y0 + 6, orange: false, traffad: false },
    { id: 2, x: x0 + mellanrum, y: y0 + 6, orange: false, traffad: false },
  ]
  spel.kula = { x: x0, y: y0, vx: 0, vy: 0 }
  spel.lage = 'skjuter'
  spel.lagst = y0
  spel.utanFramsteg = 0
  spel.skottTid = 0

  let raddningsHandelse = null
  let alla = []
  for (let i = 0; i < 400 && !raddningsHandelse; i++) {
    const h = steg(spel, 16.7)
    alla = alla.concat(h)
    raddningsHandelse = h.find((e) => e.typ === 'raddning')
  }
  assert.ok(raddningsHandelse, 'ingen raddning-händelse kom trots att kulan satt fast')

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
    { id: 1, x: x0 - mellanrum, y: y0 + 6, orange: false, traffad: false },
    { id: 2, x: x0 + mellanrum, y: y0 + 6, orange: false, traffad: false },
  ]
  spel.kula = { x: x0, y: y0, vx: 0, vy: 0 }
  spel.lage = 'skjuter'
  spel.lagst = y0
  spel.utanFramsteg = 0
  spel.skottTid = 0

  const antalFore = spel.pinnar.length
  let raddningar = 0
  for (let i = 0; i < 400 && spel.kula; i++) {
    const h = steg(spel, 16.7)
    raddningar += h.filter((e) => e.typ === 'raddning').length
    if (raddningar > 0) break
  }
  assert.strictEqual(raddningar, 1, 'mer än en raddning-händelse kom på en gång')
  assert.strictEqual(spel.pinnar.length, antalFore - 1, 'raddningen tog inte exakt en pinne')
})

test('kula som fastnar långt från alla pinnar ger en knuff-händelse i stället', () => {
  const spel = skapaSpel(1)
  spel.pinnar = []
  spel.kula = { x: 150, y: 200, vx: 0, vy: 0 }
  spel.lage = 'skjuter'
  spel.lagst = 200
  spel.utanFramsteg = 0
  spel.skottTid = 0

  let knuffHandelse = null
  for (let i = 0; i < 400 && !knuffHandelse; i++) {
    const h = steg(spel, 16.7)
    knuffHandelse = h.find((e) => e.typ === 'knuff')
    // Motorn har ingen "golv" utom pinnar, så en kula i tomma luften faller
    // alltid till slut och vakthunden triggas aldrig av sig själv. Vi
    // simulerar den låsta situationen ("ingen pinne i närheten men ändå
    // fast") genom att hålla kulan still mellan varje steg — precis det
    // scenario som knuff-grenen i motorn är byggd för att hantera.
    if (spel.kula) {
      spel.kula.y = 200
      spel.kula.vy = 0
      spel.kula.vx = 0
    }
  }
  assert.ok(knuffHandelse, 'ingen knuff-händelse kom')
  assert.ok(spel.kula, 'kulan borde fortfarande finnas kvar efter en knuff')
})

test('HART_TAK_MS avslutar skottet oavsett vakthundens progress-mätning', () => {
  const spel = skapaSpel(1)
  spel.pinnar = []
  spel.kula = { x: 150, y: 200, vx: 0, vy: 0 }
  spel.lage = 'skjuter'
  spel.lagst = 200
  spel.utanFramsteg = 0
  spel.skottTid = 0

  let skottSlutHandelse = null
  for (let i = 0; i < 3000 && !skottSlutHandelse; i++) {
    const h = steg(spel, 16.7)
    skottSlutHandelse = h.find((e) => e.typ === 'skottSlut')
    if (spel.kula) {
      // krypande nedåtrörelse så lagst hela tiden hänger med och raddningen
      // aldrig triggas — bara det hårda taket ska kunna avsluta skottet här
      spel.kula.y += 0.01
      spel.kula.vy = 0
      spel.kula.vx = 0
    }
  }
  assert.ok(skottSlutHandelse, 'skottet avslutades aldrig trots hårt tak')
  assert.ok(spel.skottTid > KONSTANTER.HART_TAK_MS, 'skottet avslutades men inte via hårt tak')
})

test('en kula i en brant båge över tomt område, i luften längre än FAST_MS, utlöser varken raddning eller knuff', () => {
  // Renodlar precis det fallet som djupmåttet ensamt missar: kulan stiger
  // (fritt fall uppåt) i en lång, obruten rörelse och gör därför ALDRIG ett
  // nytt lägsta under hela resan — men den förflyttar sig hela tiden
  // hundratals pixlar, långt över RORELSE_TROSKEL. Utan rörelsemåttet skulle
  // vakthunden tro att kulan satt fast och offra en pinne helt i onödan.
  const spel = skapaSpel(1)
  spel.pinnar = []
  spel.kula = { x: 150, y: 400, vx: 0, vy: 0 }
  spel.lage = 'skjuter'
  spel.lagst = 400
  spel.utanFramsteg = 0
  spel.ankarX = spel.kula.x
  spel.ankarY = spel.kula.y
  spel.skottTid = 0

  const dtMs = 16.7
  const antalSteg = Math.ceil((KONSTANTER.FAST_MS * 1.4) / dtMs) // gott och väl över FAST_MS
  assert.ok(antalSteg * dtMs > KONSTANTER.FAST_MS, 'testet mäter inte tillräckligt länge')
  assert.ok(350 > RORELSE_TROSKEL, 'bågens amplitud måste faktiskt räknas som rörelse')

  const alla = []
  for (let i = 0; i < antalSteg; i++) {
    // driv kulan i en jämn, brant båge uppåt (y minskar monotont) — det är
    // just den riktningen där "nytt lägsta" aldrig kan bli sant
    spel.kula.y = 400 - 350 * (i / (antalSteg - 1))
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

// ------------------------------------------------------------------ banorna

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
  // Det här är regeln som håller vakthunden som en sällsynt nödbroms i
  // stället för en del av spelmekaniken: en kula behöver minst tre
  // kulradier fri yta i en springa för att aldrig kunna kilas fast.
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

// ------------------------------------------------------------------ summary

console.log(`\n${passed} godkända, ${failed} misslyckade`)
process.exitCode = failed > 0 ? 1 : 0
