// Tester för Kulkaos: rundan (akter, dörrar, belöningar, butik, händelser),
// metan (Hundkojan, utmaningar, Feber, dagens runda) och det motorn fick för
// spelet (bossar, guld, fler kulor, studsgolv …). Kör: node frontend/tests/kulkaos.test.mjs

import assert from 'node:assert/strict'
import { skapaSpel, spelaSkott, botSkott, H, KULA_R } from '../src/rotspel/games/pinnboll/motor.js'
import { genereraBana } from '../src/rotspel/games/pinnboll/generator.js'
import * as R from '../src/rotspel/games/kulkaos/runda.js'
import { HJALTAR, UPPGRADERINGAR, RELIKER, hjalte } from '../src/rotspel/games/kulkaos/innehall.js'
import { BOSSAR, bossBana } from '../src/rotspel/games/kulkaos/bossar.js'
import { HANDELSER } from '../src/rotspel/games/kulkaos/handelser.js'
import * as M from '../src/rotspel/games/kulkaos/meta.js'
import { mulberry32 } from '../src/rotspel/games/delat/rng.js'

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log('ok  ' + name)
}

// Spelar banan i rundans rum med en bot. Returnerar res för rumKlart och spelet.
function spelaRum(r, vinklar = 6, rnd = mulberry32(r.nr)) {
  const bana = R.rumBana(r)
  const s = skapaSpel(bana, { fro: 300 + r.nr, ...R.spelVal(r, bana) })
  let feber = false
  for (let k = 0; k < 80 && s.lage === 'siktar'; k++) for (const e of spelaSkott(s, botSkott(s, { vinklar, rnd }))) if (e.typ === 'feberStart') feber = true
  return { s, bana, res: { poang: s.poang, kulorKvar: s.kulorKvar, guld: s.guld, feber, rensat: s.rensat, stats: {} } }
}

/* ------------------------------------------------------------- innehållet */

test('innehållet: hjältar, uppgraderingar, evolutioner och reliker hänger ihop', () => {
  assert.ok(HJALTAR.length >= 12)
  assert.equal(HJALTAR.filter((h) => !h.las).length, 3, 'tre hjältar från start')
  for (const h of HJALTAR) {
    for (const id of Object.keys(h.start || {})) assert.ok(UPPGRADERINGAR[id], `${h.id}: ${id}`)
    if (h.las) assert.ok(M.UTMANINGAR.some((u) => u.las?.hjalte === h.id), `${h.id} låses upp av en utmaning`)
  }
  for (const [id, u] of Object.entries(UPPGRADERINGAR)) {
    assert.ok(u.ikon && u.namn && typeof u.text(1) === 'string', id)
    if (u.krav) for (const k of Object.keys(u.krav)) assert.ok(UPPGRADERINGAR[k] && !UPPGRADERINGAR[k].krav, `${id}: ${k}`)
    if (u.las) assert.ok(M.UTMANINGAR.some((x) => x.las?.uppg === id), `${id} låses upp av en utmaning`)
  }
  assert.ok(Object.values(UPPGRADERINGAR).filter((u) => u.grad === 4).length >= 7)
  assert.ok(Object.keys(RELIKER).length >= 15)
})

/* ---------------------------------------------------------------- rundan */

test('rundan börjar: hjältens start, Hundkojan och Feber', () => {
  const r = R.nyRunda({ fro: 1, hjalte: 'happy' })
  assert.equal(r.steg, 'spel')
  assert.equal(r.typ, 'strid')
  assert.equal(r.kulor, R.STARTKULOR)
  assert.deepEqual(r.varig, { sikte: 1, hink: 1 })
  const med = R.nyRunda({ fro: 1, hjalte: 'seg', feber: 6, meta: { kulor: 3, startkassa: 2, omslag: 1, slang: 2, andra: 1, startgava: 2 } })
  assert.equal(med.kulor, 18 + 3 - 2)
  assert.equal(med.guld, 30)
  assert.equal(med.omslag, 2)
  assert.equal(med.slang, 2)
  assert.equal(med.andraChans, 1)
  assert.equal(Object.values(med.varig).reduce((a, b) => a + b, 0), 2 + 2, 'jättekula och två startgåvor')
  assert.deepEqual(R.nyRunda({ fro: 9, hjalte: 'katten' }), R.nyRunda({ fro: 9, hjalte: 'katten' }))
})

test('banorna: vanlig, elit, kulregn och boss', () => {
  const r = R.nyRunda({ fro: 3, hjalte: 'katten' })
  const vanlig = R.rumBana(r)
  assert.equal(vanlig.kraft, 'small', 'hjältens kraft')
  assert.ok(vanlig.objekt.length > 40 && vanlig.orange >= 8)
  const elit = R.rumBana({ ...r, typ: 'elit', mod: 'fler', rum: 3, nr: 3 })
  const strid = R.rumBana({ ...r, typ: 'strid', rum: 3, nr: 3 })
  assert.ok(elit.orange > strid.orange, `elit ${elit.orange} mot ${strid.orange}`)
  assert.equal(elit.elit, 'fler')
  const regn = R.rumBana({ ...r, typ: 'kulregn' })
  assert.ok(regn.bonus && regn.kraft === 'multi')
  assert.equal(R.spelVal(r, regn).kulor, 3)
  for (const akt of [1, 2, 3, 4]) {
    const b = R.rumBana({ ...r, typ: 'boss', akt })
    assert.ok(b.boss && b.boss.hp > 0)
    assert.equal(b.objekt.filter((o) => o.boss).length, 1)
  }
  assert.ok(R.rumBana({ ...r, typ: 'boss', akt: 4 }).boss.hp > R.rumBana({ ...r, typ: 'boss', akt: 1 }).boss.hp, 'bossarna blir starkare efter seger')
  assert.equal(R.rumBana({ ...r, typ: 'boss', akt: 1, feber: 1 }).boss.hp, Math.round(R.rumBana({ ...r, typ: 'boss', akt: 1 }).boss.hp * 1.25))
  // Kaos-Kalle får en ny kraft varje bana
  const kalle = R.nyRunda({ fro: 3, hjalte: 'kalle' })
  const krafter = new Set()
  for (let nr = 1; nr < 30; nr++) krafter.add(R.kraftFor({ ...kalle, nr }))
  assert.ok(krafter.size >= 4)
})

test('dörrarna: boss sist i varje akt, alltid en bana att välja, nästa akt efter bossen', () => {
  const r = R.nyRunda({ fro: 11, hjalte: 'happy' })
  for (let rum = 2; rum <= 5; rum++)
    for (let nr = 1; nr < 12; nr++) {
      const d = R.dorrVal({ ...r, nr, rum: rum - 1 }, rum)
      assert.ok(d.length >= 2 && d.length <= 3)
      assert.ok(d.some((x) => R.ARBANA[x.typ]), 'minst en bana')
      assert.equal(new Set(d.map((x) => x.typ)).size, d.length, 'olika dörrar')
      for (const x of d) if (x.typ === 'elit') assert.ok(R.ELIT_MOD[x.mod])
    }
  assert.deepEqual(R.dorrVal(r, 6).map((d) => d.typ), ['boss'])
  // efter bossen i akt 1: akt 2, och efter akt 3: seger
  let efter = R.valjBelo(R.rumKlart({ ...r, typ: 'boss', rum: 6 }, { poang: 1, kulorKvar: 3 }))
  assert.equal(efter.ko[0].typ, 'relik')
  efter = R.valjBelo(efter, efter.ko[0].val[0])
  assert.equal(efter.steg, 'dorrar')
  assert.equal(efter.akt, 2)
  let seger = R.rumKlart({ ...r, typ: 'boss', rum: 6, akt: 3 }, { poang: 1, kulorKvar: 3 })
  seger = R.valjBelo(seger)
  seger = R.valjBelo(seger, seger.ko[0].val[0])
  assert.equal(seger.steg, 'seger')
  assert.ok(seger.seger)
  const vidare = R.fortsattOandligt(seger)
  assert.equal(vidare.akt, 4)
  assert.ok(vidare.oandlig && vidare.steg === 'dorrar')
})

test('belöningar: uppgradering efter bana, relik efter elit, kista och relik efter boss', () => {
  const r = R.nyRunda({ fro: 21, hjalte: 'happy' })
  const a = R.rumKlart(r, { poang: 5000, kulorKvar: 4, guld: 7 })
  assert.equal(a.steg, 'belo')
  assert.equal(a.ko[0].typ, 'uppg')
  assert.equal(a.ko[0].val.length, 3)
  assert.equal(a.kulor, 4 + R.nyaKulor(r))
  assert.ok(a.guld >= 7 + 12)
  assert.equal(a.poang, 5000)
  const id = a.ko[0].val[0]
  const b = R.valjBelo(a, id)
  assert.equal(b.steg, 'dorrar')
  assert.ok(b.varig[id] > 0 || UPPGRADERINGAR[id].direkt)
  const e = R.rumKlart({ ...r, typ: 'elit' }, { poang: 1, kulorKvar: 1 })
  assert.equal(e.ko[0].typ, 'relik')
  assert.ok(e.ko[0].val.every((x) => RELIKER[x]))
  assert.deepEqual(R.valjBelo(e, e.ko[0].val[0]).reliker, [e.ko[0].val[0]])
  const boss = R.rumKlart({ ...r, typ: 'boss', rum: 6 }, { poang: 1, kulorKvar: 1 })
  assert.equal(boss.ko[0].typ, 'kista')
  assert.equal(boss.ko[0].fick.length, 3)
  assert.equal(boss.ko[1].typ, 'relik')
  assert.equal(boss.bossar, 1)
  // kulregn: egna kulor, banken rörs inte
  const regn = R.rumKlart({ ...r, typ: 'kulregn', kulor: 9 }, { poang: 1, kulorKvar: 0 })
  assert.equal(regn.kulor, 12)
  assert.equal(regn.ko[0].typ, 'kista')
  // Kaos-Kalle väljer aldrig själv
  const kalle = R.rumKlart(R.nyRunda({ fro: 21, hjalte: 'kalle' }), { poang: 1, kulorKvar: 1 })
  assert.equal(kalle.ko[0].typ, 'kista')
  assert.equal(kalle.ko[0].fick.length, 2)
})

test('omslag, släng och hoppa över', () => {
  const r = R.nyRunda({ fro: 31, hjalte: 'happy', meta: { slang: 1, hoppa: 1 } })
  const a = R.rumKlart(r, { poang: 1, kulorKvar: 5 })
  const om = R.slaOm(a)
  assert.equal(om.omslag, a.omslag - 1)
  assert.notDeepEqual(om.ko[0].val, a.ko[0].val)
  assert.equal(R.slaOm({ ...om, omslag: 0 }).omslag, 0)
  const bort = a.ko[0].val[1]
  const sl = R.sling(a, bort)
  assert.equal(sl.slang, 0)
  assert.ok(sl.slangda.includes(bort))
  assert.ok(!sl.ko[0].val.includes(bort))
  for (let nr = 1; nr < 20; nr++) assert.ok(!R.uppgVal({ ...sl, nr }).includes(bort), 'slängd kommer aldrig tillbaka')
  const hp = R.hoppa(a)
  assert.equal(hp.guld, a.guld + 15)
  assert.equal(hp.steg, 'dorrar')
  // Tur och Fyrklövern ger fler val, Räven och Feber 8 färre
  assert.equal(R.antalVal({ ...r, varig: { tur: 1 }, reliker: ['fyrklover'] }), 5)
  assert.equal(R.antalVal({ ...r, hjalte: 'raven' }), 2)
  assert.equal(R.antalVal({ ...r, hjalte: 'raven', feber: 8 }), 2, 'aldrig färre än två')
})

test('evolutioner: kommer alltid med när de går att få, låsta uppgraderingar kommer inte', () => {
  const r = { ...R.nyRunda({ fro: 41, hjalte: 'happy' }), varig: { eldkula: 2, jatte: 2 } }
  for (let nr = 1; nr < 15; nr++) assert.equal(R.uppgVal({ ...r, nr })[0], 'meteor')
  const utan = R.nyRunda({ fro: 41, hjalte: 'happy' })
  for (let nr = 1; nr < 40; nr++) for (const id of R.uppgVal({ ...utan, nr })) assert.ok(!UPPGRADERINGAR[id].las, `${id} är låst`)
  const med = { ...utan, upplast: ['blixt', 'flerskott'] }
  let sett = false
  for (let nr = 1; nr < 80; nr++) if (R.uppgVal({ ...med, nr }).some((id) => id === 'blixt' || id === 'flerskott')) sett = true
  assert.ok(sett, 'upplåsta finns i potten')
  // Trolldrycken ger ett steg till
  assert.equal(R.tak({ ...utan, reliker: ['trolldryck'] }, 'jatte'), 5)
  assert.ok(!R.mojlig({ ...utan, varig: { jatte: 4 } }, 'jatte'))
  assert.ok(R.mojlig({ ...utan, varig: { jatte: 4 }, reliker: ['trolldryck'] }, 'jatte'))
})

test('butiken: köp för guld, en gång per vara, omslag kostar mer varje gång', () => {
  let r = R.valjDorr({ ...R.nyRunda({ fro: 51, hjalte: 'happy' }), steg: 'dorrar', rum: 2, dorrar: [{ typ: 'butik' }] }, 0)
  assert.equal(r.steg, 'butik')
  assert.ok(r.butik.varor.length >= 4)
  const i = r.butik.varor.findIndex((v) => v.typ === 'kulor')
  assert.equal(R.kop(r, i), r, 'för lite guld')
  r = { ...r, guld: 500 }
  const k = R.kop(r, i)
  assert.equal(k.guld, 500 - r.butik.varor[i].pris)
  assert.equal(k.kulor, r.kulor + 5)
  assert.equal(R.kop(k, i), k, 'såld')
  const om = R.slaOmButik(k)
  assert.equal(om.guld, k.guld - 10)
  assert.equal(om.butik.omslagPris, 20)
  assert.ok(R.pris({ ...r, hjalte: 'raven' }, 100) < R.pris(r, 100))
  assert.ok(R.pris({ ...r, feber: 4 }, 100) > R.pris(r, 100))
  assert.equal(R.lamna(om).steg, 'dorrar')
})

test('händelser och lägereld: alla val går att göra och leder vidare', () => {
  const bas = { ...R.nyRunda({ fro: 61, hjalte: 'happy' }), guld: 200, kulor: 20, varig: { gron: 2, jatte: 1 }, rum: 3, nr: 4 }
  for (const h of HANDELSER)
    h.val.forEach((v, i) => {
      const r = { ...bas, steg: 'handelse', handelse: { id: h.id, svar: null } }
      const ny = R.svaraHandelse(r, i)
      assert.ok(ny.handelse.svar, `${h.id} val ${i}`)
      assert.equal(R.svaraHandelse(ny, i), ny, 'bara ett svar')
      assert.equal(R.lamna(ny).steg, 'dorrar')
      assert.ok(ny.kulor >= 1 && ny.guld >= 0)
    })
  const v = { ...bas, steg: 'vila' }
  assert.equal(R.vila(v, 'vila').kulor, bas.kulor + 6)
  const t = R.vila(v, 'trana')
  assert.equal(Object.values(t.varig).reduce((a, b) => a + b, 0), 4)
})

test('en hel runda med en bot: från första banan till seger eller slut, utan fel', () => {
  for (const hj of ['happy', 'atta', 'svea']) {
    let r = R.nyRunda({ fro: 777, hjalte: hj })
    const rnd = mulberry32(5)
    let banor = 0
    for (let steg = 0; steg < 300 && !r.slut; steg++) {
      if (r.steg === 'spel') {
        const { s, res } = spelaRum(r, 4, rnd)
        banor++
        if (s.lage !== 'klar' && !s.bana.bonus) r = R.avsluta(r)
        else r = R.rumKlart(r, res)
      } else if (r.steg === 'belo') r = R.valjBelo(r, r.ko[0].val?.[0])
      else if (r.steg === 'dorrar') r = R.valjDorr(r, 0)
      else if (r.steg === 'butik') r = R.lamna(R.kop(r, 0))
      else if (r.steg === 'handelse') r = R.lamna(R.svaraHandelse(r, 0))
      else if (r.steg === 'vila') r = R.vila(r, 'trana')
      else if (r.steg === 'seger') r = R.avsluta(r)
      assert.ok(r.kulor >= 0 && Number.isFinite(r.guld))
    }
    assert.ok(r.slut, `${hj}: rundan tog slut`)
    assert.ok(banor >= 1)
    assert.ok(R.benFor(r) >= 0)
  }
})

/* ----------------------------------------------------------------- motorn */

test('bossen: tar skada efter varje skott, fylls på, och dör', () => {
  const b = bossBana(1)
  const s = skapaSpel(b, { fro: 2, kulor: 60 })
  assert.equal(s.bossHp, b.boss.hp)
  const boss = s.objekt.find((o) => o.boss)
  assert.notEqual(boss.farg, 'orange')
  let skador = 0
  let aterstall = 0
  for (let k = 0; k < 60 && s.lage === 'siktar'; k++)
    for (const e of spelaSkott(s, 1.0 + (k % 7) * 0.18)) {
      if (e.typ === 'bossSkada') skador++
      if (e.typ === 'aterstall') aterstall++
      assert.notEqual(e.typ, 'feberStart', 'ingen feber på bossbanor')
    }
  assert.equal(s.lage, 'klar', `bossen lever: ${s.bossHp} kvar`)
  assert.ok(skador >= 3)
  assert.ok(!boss.lit && !boss.borta, 'bossen tänds aldrig')
  assert.ok(aterstall >= 1, 'planen fylldes på')
  // krabbans klor är hårda: de tänds aldrig
  const k = skapaSpel(bossBana(2), { fro: 1, kulor: 30 })
  for (let i = 0; i < 6 && k.lage === 'siktar'; i++) spelaSkott(k, 1.2 + i * 0.12)
  assert.ok(k.objekt.filter((o) => o.hard).every((o) => !o.lit && !o.borta))
  // Kronan och Bossjägaren: mer skada
  const s1 = skapaSpel(b, { fro: 2 })
  const s2 = skapaSpel(b, { fro: 2, perk: { kronan: 1 } })
  const d1 = spelaSkott(s1, 1.3).find((e) => e.typ === 'bossSkada').skada
  const d2 = spelaSkott(s2, 1.3).find((e) => e.typ === 'bossSkada').skada
  assert.equal(d2, d1 * 2)
})

test('guld, fler kulor per skott, spegelkula, genomborr, studsgolv och lägre tyngdkraft', () => {
  const bana = { ...genereraBana(31, { niva: 4 }), guldpinnar: 4 }
  const s = skapaSpel(bana, { fro: 1, perk: { guldFaktor: 2 } })
  assert.equal(s.objekt.filter((o) => o.guld).length, 4)
  let guld = 0
  for (let k = 0; k < 10 && s.lage === 'siktar'; k++) for (const e of spelaSkott(s, botSkott(s, { vinklar: 8 }))) if (e.typ === 'guld') guld += e.n
  assert.equal(s.guld, guld)
  if (guld) assert.equal(guld % 10, 0, 'fem guld per guldpinne, gånger två')
  const tre = skapaSpel(bana, { fro: 1, perk: { flerskott: 2 } })
  tre.sikta(1.2)
  tre.skjut()
  assert.equal(tre.kulor.length, 3)
  const tv = skapaSpel(bana, { fro: 1, perk: { tvilling: 1 } })
  tv.sikta(1.2)
  tv.skjut()
  assert.equal(tv.kulor.length, 2)
  assert.ok(Math.abs(tv.kulor[0].vx + tv.kulor[1].vx) < 1e-9, 'spegelkulan far åt andra hållet')
  // genomborr: kulan studsar inte på blå pinnar
  const g = skapaSpel(bana, { fro: 1, perk: { genom: 1 } })
  const h = spelaSkott(g, 1.4)
  assert.ok(h.filter((e) => e.typ === 'traff' && e.farg === 'bla').length >= 1)
  // studsgolv: kulan kommer upp igen, högst två gånger
  const tom = { namn: 'Tom', fasta: true, grupper: [], objekt: [{ typ: 'pinne', form: 'cirkel', x: 30, y: 120, r: 7.5, farg0: 'orange' }, { typ: 'pinne', form: 'cirkel', x: 330, y: 120, r: 7.5, farg0: 'bla' }] }
  const gs = skapaSpel(tom, { fro: 1, hinkBredd: 0, perk: { golv: 2 } })
  const gh = spelaSkott(gs, 1.5)
  assert.equal(gh.filter((e) => e.typ === 'golv').length, 2)
  // lägre tyngdkraft: kulan är längre i luften
  const tid = (perk) => {
    const x = skapaSpel(tom, { fro: 1, hinkBredd: 0, perk })
    x.sikta(Math.PI / 2 - 0.05)
    x.skjut()
    let t = 0
    while (x.lage === 'skjuter' && t < 30) {
      x.steg(1 / 60)
      t += 1 / 60
    }
    return t
  }
  assert.ok(tid({ grav: 0.5 }) > tid({}) * 1.12, `${tid({ grav: 0.5 })} mot ${tid({})}`)
  // ingen hink: kulan åker rakt igenom där hinken skulle ha varit
  const ih = skapaSpel(tom, { fro: 1, hinkBredd: 0 })
  assert.ok(!spelaSkott(ih, Math.PI / 2).some((e) => e.typ === 'hink'))
  assert.ok(H > 0 && KULA_R > 0)
})

test('reliker i motorn: Spelautomaten, Glödkolet, Spegeln och Diamanten', () => {
  const bana = genereraBana(41, { niva: 3 })
  let gratis = 0
  const s = skapaSpel(bana, { fro: 3, kulor: 40, perk: { spelautomat: 1 } })
  for (let k = 0; k < 30 && s.lage === 'siktar'; k++) for (const e of spelaSkott(s, 0.4 + (k % 9) * 0.28)) if (e.typ === 'gratisKula') gratis++
  assert.ok(gratis >= 1, 'ibland gratis')
  const gl = skapaSpel(bana, { fro: 3, kulor: 20, perk: { glodkol: 1 } })
  const eld = []
  for (let k = 0; k < 10 && gl.lage === 'siktar'; k++) {
    gl.sikta(1.2)
    gl.skjut()
    eld.push(gl.eldNu)
    while (gl.lage === 'skjuter' || gl.lage === 'feber') gl.steg(1 / 60)
  }
  assert.deepEqual(eld.slice(0, 10).map((x, i) => x === ((i + 1) % 5 === 0)), new Array(Math.min(10, eld.length)).fill(true))
  const sp = skapaSpel(bana, { fro: 3, perk: { spegel: 1 } })
  sp.sikta(1.2)
  sp.skjut()
  assert.equal(sp.kulor.length, 2, 'spegelkula i första skottet')
  const forsta = (perk) => {
    const x = skapaSpel(bana, { fro: 3, perk })
    return spelaSkott(x, 1.35).find((e) => e.typ === 'traff' && e.farg === 'orange')?.poang
  }
  const p = forsta({})
  if (p) assert.equal(forsta({ diamant: 1 }), p * 2)
})

/* ------------------------------------------------------------------- metan */

test('Hundkojan: priset stiger, taket gäller, och allt går att få tillbaka', () => {
  let m = { ...M.START_META, ben: 2000 }
  const p1 = M.verkstadPris(m, 'kulor')
  m = M.kopVerkstad(m, 'kulor')
  assert.equal(m.ben, 2000 - p1)
  assert.equal(m.verkstad.kulor, 1)
  assert.ok(M.verkstadPris(m, 'kulor') > p1)
  assert.ok(M.verkstadPris(m, 'tur') > M.VERKSTAD.find((v) => v.id === 'tur').bas, 'allt blir dyrare för varje köp')
  for (let i = 0; i < 10; i++) m = M.kopVerkstad(m, 'andra')
  assert.equal(m.verkstad.andra, 1)
  const fore = m.ben
  m = M.aterbetala(m)
  assert.deepEqual(m.verkstad, {})
  assert.equal(m.ben, 2000)
  assert.ok(fore < 2000)
  assert.equal(M.kopVerkstad({ ...m, ben: 0 }, 'kulor').verkstad.kulor, undefined, 'inte utan ben')
  const rm = M.rundMeta({ ...m, verkstad: { kulor: 2, omslag: 1 }, uppg: ['blixt'] })
  assert.equal(rm.kulor, 2)
  assert.equal(rm.omslag, 1)
  assert.deepEqual(rm.upplast, ['blixt'])
  assert.equal(R.nyRunda({ fro: 1, meta: rm }).kulor, R.STARTKULOR + 2)
})

test('utmaningar: ger ben och låser upp hjältar och uppgraderingar', () => {
  const m = M.START_META
  const r = { ...R.nyRunda({ fro: 1 }), bossar: 1, stats: { ...R.nyRunda({ fro: 1 }).stats, maxKulor: 31, evolutioner: 1 } }
  const k = M.kollaUtmaningar(m, r)
  assert.ok(k.nya.includes('akt1') && k.nya.includes('kulor30') && k.nya.includes('evolution'))
  assert.ok(k.m.hjaltar.includes('svea') && k.m.hjaltar.includes('atta'))
  assert.ok(k.m.uppg.includes('blixt') && k.m.uppg.includes('kulfabrik'))
  assert.ok(k.m.ben > 0)
  assert.deepEqual(M.kollaUtmaningar(k.m, r).nya, [], 'bara en gång')
  assert.equal(M.kopHjalte({ ...m, ben: 1000 }, 'taggis').hjaltar.includes('taggis'), true)
  assert.equal(M.kopHjalte({ ...m, ben: 10 }, 'taggis').hjaltar.includes('taggis'), false)
  for (const h of HJALTAR) if (h.las) assert.ok(M.lasText('hjalte', h.id))
})

test('en runda slut: ben, statistik, samling och nästa Feber', () => {
  const r = { ...R.nyRunda({ fro: 1, hjalte: 'konfekt', feber: 0 }), klara: 10, bossar: 3, seger: true, poang: 3_000_000, varig: { delning: 2 }, reliker: ['kronan'], slut: true }
  const { m, ben, nya } = M.avslutaRunda(M.START_META, r)
  assert.equal(ben, R.benFor(r))
  assert.ok(ben >= 3 * 10 + 30 * 3 + 100)
  assert.ok(m.ben >= ben)
  assert.equal(m.stats.rundor, 1)
  assert.equal(m.stats.vinster, 1)
  assert.equal(m.feber, 1, 'Feber 1 öppnas')
  assert.equal(m.samling.uppg.delning, 2)
  assert.equal(m.samling.reliker.kronan, 1)
  assert.ok(nya.includes('seger') && nya.includes('forsta'))
  assert.ok(m.hjaltar.includes('kalle'))
  assert.ok(R.benFor({ ...r, feber: 5 }) > R.benFor(r), 'mer ben på högre Feber')
  assert.ok(R.benFor({ ...r, reliker: ['benbit'] }) > R.benFor(r))
})

test('dagens runda: samma för alla samma dag, egen topplista', () => {
  const a = M.dagensRunda('2026-10-27')
  assert.deepEqual(a, M.dagensRunda('2026-10-27'))
  assert.notEqual(a.fro, M.dagensRunda('2026-10-28').fro)
  assert.ok(hjalte(a.hjalte))
  assert.equal(a.feber, 2)
  assert.equal(M.dagensId('2026-10-27'), 'kulkaos-dag-2026-10-27')
  assert.equal(M.idag(new Date(2026, 9, 7)), '2026-10-07')
  const r = R.nyRunda(a)
  assert.equal(r.dag, '2026-10-27')
  const { m } = M.avslutaRunda(M.START_META, { ...r, poang: 500, slut: true })
  assert.equal(m.dag, '2026-10-27')
  assert.equal(m.dagPoang, 500)
  assert.equal(m.feber, 0, 'dagens runda öppnar ingen Feber')
})

console.log(`\n${passed} tester ok`)
