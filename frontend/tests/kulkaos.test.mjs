// Tester för Kulkaos: rundan (akter, dörrar, belöningar, butik, händelser),
// metan (Hundkojan, utmaningar, Feber, dagens runda) och det motorn fick för
// spelet (bossar, guld, fler kulor, studsgolv …). Kör: node frontend/tests/kulkaos.test.mjs

import assert from 'node:assert/strict'
import { skapaSpel, spelaSkott, botSkott, zenVinkel, H, KULA_R } from '../src/rotspel/games/pinnboll/motor.js'
import { genereraBana } from '../src/rotspel/games/pinnboll/generator.js'
import * as R from '../src/rotspel/games/kulkaos/runda.js'
import { HJALTAR, UPPGRADERINGAR, RELIKER, BOSSRELIKER, KULTYPER, BASKULOR, FUSIONER, ARKANOR, VASKA_MAX, hjalte } from '../src/rotspel/games/kulkaos/innehall.js'
import { BOSSAR, bossBana, bossarIAkt } from '../src/rotspel/games/kulkaos/bossar.js'
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
  const r0 = R.nyRunda({ fro: 1, hjalte: 'happy' })
  assert.equal(r0.steg, 'arkana', 'först en arkana')
  assert.equal(r0.arkanaVal.length, 3)
  const r = R.valjArkana(r0, r0.arkanaVal[0])
  assert.equal(r.steg, 'spel')
  assert.deepEqual(r.arkanor, [r0.arkanaVal[0]])
  assert.equal(R.valjArkana(r, 'tvilling'), r, 'bara när man väljer')
  assert.equal(r.typ, 'strid')
  assert.deepEqual(r.vaska.map((k) => k.typ), ['cell', 'vanlig', 'vanlig', 'vanlig'], 'hjältens kula i väskan')
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
  assert.equal(efter.ko[0].typ, 'bossrelik')
  assert.equal(efter.ko[0].id, R.bossFor(r).relik)
  efter = R.valjBelo(efter)
  assert.ok(efter.reliker.includes(R.bossFor(r).relik))
  assert.equal(efter.ko[0].typ, 'kula')
  efter = R.valjBelo(efter, efter.ko[0].val[0])
  assert.equal(efter.steg, 'arkana', 'ny arkana i varje akt')
  assert.equal(efter.akt, 2)
  efter = R.valjArkana(efter, efter.arkanaVal[0])
  assert.equal(efter.steg, 'dorrar')
  let seger = R.rumKlart({ ...r, typ: 'boss', rum: 6, akt: 3 }, { poang: 1, kulorKvar: 3 })
  for (let i = 0; i < 4 && seger.steg === 'belo'; i++) seger = R.valjBelo(seger, seger.ko[0].val?.[0])
  assert.equal(seger.steg, 'seger')
  assert.ok(seger.seger)
  const vidare = R.fortsattOandligt(seger)
  assert.equal(vidare.akt, 4)
  assert.ok(vidare.oandlig && vidare.steg === 'arkana')
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
  assert.equal(a.ko[1].typ, 'kula', 'första banan i akten ger en kula')
  const id = a.ko[0].val[0]
  const b = R.valjBelo(a, id)
  assert.equal(b.steg, 'belo')
  assert.ok(b.varig[id] > 0 || UPPGRADERINGAR[id].direkt)
  const c = R.valjBelo(b, b.ko[0].val[0])
  assert.equal(c.steg, 'dorrar')
  assert.equal(R.rumKlart({ ...c, steg: 'spel', typ: 'strid' }, { poang: 1, kulorKvar: 1 }).ko.length, 1, 'bara en gång per akt')
  const e = R.rumKlart({ ...r, typ: 'elit' }, { poang: 1, kulorKvar: 1 })
  assert.equal(e.ko[0].typ, 'relik')
  assert.ok(e.ko[0].val.every((x) => RELIKER[x] && !BOSSRELIKER[x]), 'inga bossreliker bland de vanliga')
  assert.deepEqual(R.valjBelo(e, e.ko[0].val[0]).reliker, [e.ko[0].val[0]])
  assert.equal(e.ko[1].typ, 'kula')
  assert.equal(e.elitKlara, 1)
  const boss = R.rumKlart({ ...r, typ: 'boss', rum: 6 }, { poang: 1, kulorKvar: 1 })
  assert.equal(boss.ko[0].typ, 'kista')
  assert.equal(boss.ko[0].fick.length, 3)
  assert.deepEqual(boss.ko.slice(1).map((x) => x.typ), ['bossrelik', 'kula'])
  assert.equal(boss.bossar, 1)
  assert.deepEqual(boss.besegrade, [R.bossFor(r).id])
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
  assert.equal(hp.ko[0].typ, 'kula', 'nästa belöning')
  const kom = R.slaOm({ ...hp, omslag: 1 })
  assert.equal(kom.omslag, 0, 'omslag på kulor också')
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
  for (const hj of ['happy', 'atta', 'svea', 'slosa']) {
    let r = R.nyRunda({ fro: 777, hjalte: hj })
    const rnd = mulberry32(5)
    let banor = 0
    for (let steg = 0; steg < 300 && !r.slut; steg++) {
      if (r.steg === 'arkana') r = R.valjArkana(r, r.arkanaVal[0])
      else if (r.steg === 'spel') {
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

test('Orangestormen: sista orange på en bossbana skickar allt in i bossen, utan feber och slow motion', () => {
  const s = skapaSpel(bossBana(1), { fro: 4, kulor: 40 })
  const orange = s.objekt.filter((o) => o.farg === 'orange')
  for (const o of orange.slice(1)) o.lit = true // bara en orange kvar
  let storm = null
  let ater = false
  const fel = []
  for (let k = 0; k < 40 && s.lage === 'siktar' && !storm; k++)
    for (const e of spelaSkott(s, botSkott(s, { vinklar: 12, rnd: mulberry32(k + 1) }))) {
      if (e.typ === 'bossStorm') storm = e
      if (e.typ === 'aterstall') ater = true
      if (e.typ === 'narSista' || e.typ === 'feberStart') fel.push(e.typ)
    }
  assert.ok(storm, 'stormen kom')
  assert.equal(storm.fran.length, orange.length, 'alla orange blir raketer')
  assert.ok(storm.skada >= 3 * orange.length)
  assert.ok(ater, 'planen fylls på direkt efter skottet')
  assert.ok(s.orangeKvar() > 0, 'en ny våg med orange')
  assert.equal(s.kulor.length, 0, 'inga kulor att vänta på')
  assert.deepEqual(fel, [], 'ingen feber och ingen zoom')
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

/* --------------------------------------------- kulväskan, arkanor, reliker */

test('kulväskan: nivåer, plats för nya, byte när den är full, och fusioner', () => {
  let r = R.valjArkana(R.nyRunda({ fro: 81, hjalte: 'happy' }), R.nyRunda({ fro: 81, hjalte: 'happy' }).arkanaVal[0])
  const typer = (x) => x.vaska.map((k) => `${k.typ}${k.niva}`)
  assert.deepEqual(typer(R.geKula(r, 'cell')), ['cell2', 'vanlig1', 'vanlig1', 'vanlig1'], 'samma kula igen: en nivå till')
  r = R.geKula(R.geKula(R.geKula(r, 'laser'), 'jord'), 'agg')
  assert.deepEqual(typer(r), ['cell1', 'laser1', 'jord1', 'agg1'], 'nya kulor tar de vanligas plats')
  r = R.geKula(r, 'spoke')
  assert.equal(r.vaska.length, VASKA_MAX)
  assert.ok(!R.kulaRyms(r, 'jarn') && R.kulaRyms(r, 'cell'))
  // full väska: man väljer vilken som byts ut (eller behåller väskan)
  const val = { ...r, steg: 'belo', ko: [{ typ: 'kula', val: ['jarn', 'cell', 'laser'], klar: true }] }
  const byt = R.valjBelo(val, 'jarn')
  assert.equal(byt.ko[0].typ, 'byt')
  assert.equal(R.valjBelo(byt, 2).vaska[2].typ, 'jarn')
  assert.deepEqual(typer(R.valjBelo(byt, -1)), typer(r), 'behåll väskan')
  // fusion: järn + jord blir en bomb, och kommer alltid först bland valen
  const f = { ...r, vaska: [{ typ: 'jarn', niva: 2 }, { typ: 'jord', niva: 1 }, { typ: 'vanlig', niva: 1 }] }
  assert.deepEqual(R.fusionerMojliga(f), ['bomb'])
  for (let slag = 0; slag < 6; slag++) assert.equal(R.kulVal({ ...f, slag })[0], 'f:bomb')
  const bomb = R.geKula(f, 'f:bomb')
  assert.deepEqual(typer(bomb), ['vanlig1', 'bomb3'])
  assert.equal(bomb.stats.fusioner, 1)
  for (const id of FUSIONER) assert.ok(KULTYPER[id].fusion.every((t) => BASKULOR.includes(t)), id)
  // Trollkulan och Kulväskans hjärta höjer nivåerna (högst 4), vanliga förblir vanliga
  const tk = R.vaskaFor({ ...r, reliker: ['trollkula'], arkanor: ['hjarta'] })
  assert.ok(tk.every((k) => k.niva === 3), JSON.stringify(tk))
  const bana = R.rumBana(r)
  assert.equal(R.spelVal(r, bana).vaska.length, r.vaska.length)
  // butiken säljer en kula som ryms
  const b = R.valjDorr({ ...R.nyRunda({ fro: 81, hjalte: 'happy' }), steg: 'dorrar', rum: 2, dorrar: [{ typ: 'butik' }] }, 0)
  const i = b.butik.varor.findIndex((v) => v.typ === 'kula')
  assert.ok(i >= 0, 'en kula i butiken')
  const kopt = R.kop({ ...b, guld: 999 }, i)
  assert.ok(kopt.vaska.some((k) => k.typ === b.butik.varor[i].id))
})

test('arkanor: tre att välja på i varje akt, och de ändrar spelet', () => {
  const r = R.nyRunda({ fro: 91, hjalte: 'katten' })
  assert.equal(new Set(r.arkanaVal).size, 3)
  assert.ok(r.arkanaVal.every((id) => ARKANOR[id]))
  assert.ok(!R.arkanaDrag({ ...r, arkanor: ['moln', 'eld'] }, 12).some((id) => id === 'moln' || id === 'eld'), 'aldrig samma två gånger')
  const kalle = R.nyRunda({ fro: 91, hjalte: 'kalle' })
  assert.equal(kalle.arkanaVal.length, 1, 'Kaos-Kalle väljer inte själv')
  assert.equal(R.kulVal(kalle).length, 1)
  const med = (id) => ({ ...r, steg: 'spel', arkanor: [id] })
  const boss = { typ: 'boss', rum: 6 }
  assert.equal(R.rumBana({ ...med('drapare'), ...boss }).boss.hp, Math.round(R.rumBana({ ...r, ...boss }).boss.hp * 0.7))
  assert.equal(R.rumBana(med('kristall')).kritpinnar, 5)
  assert.equal(R.rumBana(med('hal')).svartaHal.length, 1)
  assert.equal(R.guldFaktor(med('midas')), R.guldFaktor(r) * 2)
  const bana = R.rumBana(r)
  assert.equal(R.spelVal(med('eld'), bana).start.eld, R.spelVal(r, bana).start.eld + 3)
  assert.equal(R.spelVal(med('grona'), bana).extraGrona, 3)
  assert.equal(R.spelVal(med('moln'), bana).perk.moln, 1)
  assert.ok(R.nyaKulor({ ...med('kalla'), guld: 200 }) > R.nyaKulor({ ...r, guld: 200 }))
})

test('reliker: växande reliker, Kopiaturen och en egen relik för varje boss', () => {
  const r = { ...R.nyRunda({ fro: 95, hjalte: 'happy' }), steg: 'spel' }
  assert.equal(R.relikN({ ...r, reliker: ['kronan', 'kopia'] }, 'kronan'), 2, 'Kopiaturen kopierar den senaste')
  assert.equal(R.relikN({ ...r, reliker: ['kopia', 'kronan', 'spegel'] }, 'kronan'), 1)
  assert.equal(R.spelVal({ ...r, reliker: ['kronan', 'kopia'] }, R.rumBana(r)).perk.kronan, 2)
  assert.ok(Math.abs(R.bossFaktor({ ...r, reliker: ['pokal'], elitKlara: 2, bossar: 1 }) - 1.45) < 1e-9)
  assert.equal(R.nyaKulor({ ...r, reliker: ['palt'], bossar: 2 }), R.nyaKulor(r) + 2)
  assert.equal(R.nyaKulor({ ...r, reliker: ['ost'] }), R.nyaKulor(r) + 3)
  const sk = R.spelVal({ ...r, reliker: ['skal'] }, R.rumBana(r))
  assert.equal(sk.perk.hinkGuld, 10)
  assert.ok(sk.hinkBredd > R.spelVal(r, R.rumBana(r)).hinkBredd * 1.4)
  // sex bossar, två per akt, alla med attacker och en egen relik
  assert.equal(BOSSAR.length, 6)
  for (const akt of [1, 2, 3]) assert.equal(bossarIAkt(akt).length, 2)
  for (const b of BOSSAR) {
    assert.ok(b.attacker.length >= 1, b.id)
    assert.ok(BOSSRELIKER[b.relik], b.id)
  }
  const sett = new Set()
  for (let fro = 1; fro < 30; fro++) {
    const x = { ...r, fro }
    assert.equal(R.bossFor(x).id, R.bossFor(x).id)
    assert.ok(bossarIAkt(1).includes(R.bossFor(x)))
    sett.add(R.bossFor(x).id)
    assert.equal(R.dorrVal(x, 6)[0].boss.id, R.bossFor(x).id, 'dörren visar rätt boss')
  }
  assert.equal(sett.size, 2, 'båda bossarna i akten förekommer')
  for (const id of ['spindeln', 'stormfageln', 'draken']) {
    const b = bossBana(1, { id })
    assert.ok(b.boss.hp > 0 && b.boss.attacker.length)
  }
})

test('motorn: kultyperna i väskan gör det de ska', () => {
  const bana = genereraBana(77, { niva: 6 })
  const skott = (opt, v = 1.35) => {
    const s = skapaSpel(bana, { fro: 4, kulor: 20, ...opt })
    s.sikta(v)
    s.skjut()
    const h = []
    let mest = 0
    let maxR = 0
    for (let i = 0; i < 60 * 45 && (s.lage === 'skjuter' || s.lage === 'feber'); i++) {
      h.push(...s.steg(1 / 60))
      mest = Math.max(mest, s.kulor.length)
      for (const k of s.kulor) maxR = Math.max(maxR, k.r)
    }
    const n = (typ) => h.filter((e) => e.typ === typ).length
    return { s, h, n, mest, maxR }
  }
  const vanlig = skott({ vaska: [{ typ: 'vanlig', niva: 1 }] })
  assert.equal(vanlig.mest, 1)
  assert.ok(skott({ vaska: [{ typ: 'cell', niva: 2 }] }).n('cell') >= 2, 'cellkulan delar sig')
  const agg = skott({ vaska: [{ typ: 'agg', niva: 2 }] })
  assert.equal(agg.n('agg'), 1)
  assert.ok(agg.mest >= 3, 'äggsäcken spricker i småkulor')
  assert.ok(skott({ vaska: [{ typ: 'laser', niva: 2 }] }).n('laser') >= 2)
  assert.ok(skott({ vaska: [{ typ: 'jord', niva: 1 }] }).h.some((e) => e.typ === 'small' && e.orsak === 'jord'))
  assert.ok(skott({ vaska: [{ typ: 'spoke', niva: 1 }] }).n('spok') >= 1, 'spökkulan kommer tillbaka uppifrån')
  assert.ok(skott({ vaska: [{ typ: 'hagel', niva: 3 }] }).n('hagel') === 1)
  assert.ok(skott({ vaska: [{ typ: 'bomb', niva: 3 }] }).h.some((e) => e.typ === 'small' && e.orsak === 'bomb'))
  // järnkulan gör mer bosskada
  const b = bossBana(1)
  const d = (typ) => spelaSkott(skapaSpel(b, { fro: 2, vaska: [{ typ, niva: 1 }] }), 1.3).find((e) => e.typ === 'bossSkada')?.skada || 0
  assert.ok(d('jarn') > d('vanlig'), `${d('jarn')} mot ${d('vanlig')}`)
  // Slösaren skjuter allt och får tillbaka hälften
  const sl = skott({ perk: { slosa: 1 } })
  assert.ok(sl.mest >= 8)
  assert.equal(sl.n('slosa'), 1)
  // snöbollen växer för varje träff
  assert.ok(skott({ perk: { sno: 3 } }).maxR > vanlig.maxR * 1.3)
})

test('motorn: specialpinnar, svarta hål, flipprar, pyramiden, zenskottet och bossattacker', () => {
  const bana = { ...genereraBana(77, { niva: 6 }), kritpinnar: 3, fornyare: 1, slempinnar: 5, svartaHal: [{ x: 180, y: 330 }] }
  const s = skapaSpel(bana, { fro: 4, kulor: 20 })
  assert.equal(s.objekt.filter((o) => o.krit).length, 3)
  assert.equal(s.objekt.filter((o) => o.forny).length, 1)
  assert.equal(s.objekt.filter((o) => o.slem).length, 5)
  const typer = new Set()
  for (const v of [0.9, 1.35, 1.8, 1.1, 1.6]) if (s.lage === 'siktar') for (const e of spelaSkott(s, v)) typer.add(e.typ)
  assert.ok(typer.has('svartHal') || typer.has('krit') || typer.has('slem'), [...typer].join(' '))
  // svarta hålet håller aldrig kvar kulorna: skottet tar slut, och efter
  // tre smällar stängs hålet
  const ring = Array.from({ length: 10 }, (_, i) => ({ typ: 'pinne', form: 'cirkel', x: 180 + Math.cos(i * 0.628) * 44, y: 260 + Math.sin(i * 0.628) * 44, r: 7.5, farg0: 'bla' }))
  const halBana = { namn: 'Hål', fasta: true, grupper: [], svartaHal: [{ x: 180, y: 260 }], objekt: [{ typ: 'pinne', form: 'cirkel', x: 30, y: 420, r: 7.5, farg0: 'orange' }, { typ: 'pinne', form: 'cirkel', x: 330, y: 420, r: 7.5, farg0: 'orange' }, ...ring] }
  const hs = skapaSpel(halBana, { fro: 1, kulor: 10, hinkBredd: 0, perk: { flerskott: 2 } })
  let stangt = false
  for (let k = 0; k < 4; k++) {
    hs.sikta(Math.PI / 2 + (k - 1.5) * 0.04)
    hs.skjut()
    let t = 0
    while ((hs.lage === 'skjuter' || hs.lage === 'feber') && t < 20) {
      for (const e of hs.steg(1 / 60)) if (e.typ === 'halBorta') stangt = true
      t += 1 / 60
    }
    assert.ok(t < 12, `skott ${k + 1} tog ${t.toFixed(1)} s`)
  }
  assert.ok(stangt && hs.hal[0].borta, 'hålet stängs efter tre smällar')
  // flipprar: två hårda flipprar som går upp när man håller in
  const f = skapaSpel(genereraBana(77, { niva: 6 }), { fro: 4, perk: { flipper: 1 } })
  assert.ok(f.objekt.filter((o) => o.flipper).length >= 2)
  f.sikta(1.3)
  f.skjut()
  f.flippa(true)
  for (let i = 0; i < 20; i++) f.steg(1 / 60)
  assert.ok(f.flipperUppe)
  f.flippa(false)
  assert.ok(!f.flipperUppe)
  // pyramiden följer med hinken
  const p = skapaSpel(genereraBana(77, { niva: 6 }), { fro: 4, perk: { pyramid: 1 }, hinkBredd: 112 })
  assert.equal(p.objekt.filter((o) => o.pyramid).length, 2)
  // zenskottet: en vinkel nära den man siktade på, och spelet står kvar och siktar
  const z = skapaSpel(genereraBana(77, { niva: 6 }), { fro: 4 })
  const v = zenVinkel(z, 1.3, { bredd: 0.06 })
  assert.ok(Math.abs(v - 1.3) <= 0.06 + 1e-9)
  assert.equal(z.lage, 'siktar')
  // bossattacker: var annat skott gör bossen något
  for (const att of ['stenar', 'skold', 'flytta', 'slem', 'hela']) {
    const b = bossBana(1)
    b.boss = { ...b.boss, attacker: [att] }
    const x = skapaSpel(b, { fro: 3, kulor: 30 })
    const h = []
    for (let k = 0; k < 4 && x.lage === 'siktar'; k++) h.push(...spelaSkott(x, 1.1 + k * 0.2))
    assert.ok(h.some((e) => e.typ === 'bossAttack' && e.attack === att), att)
  }
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
  // nya utmaningar: fusion, full väska, Kaosdraken och Slösaren
  const r2 = { ...r, stats: { ...r.stats, fusioner: 1 }, vaska: ['cell', 'agg', 'laser', 'jord', 'jarn'].map((typ) => ({ typ, niva: 1 })), besegrade: ['draken'] }
  const k2 = M.kollaUtmaningar({ ...m, stats: { ...m.stats, kopt: 20 } }, r2)
  for (const id of ['fusion', 'vaska5', 'kaosdraken', 'kop20']) assert.ok(k2.nya.includes(id), id)
  assert.ok(k2.m.hjaltar.includes('slosa'))
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
  assert.equal(m.samling.kulor.agg, 1, 'kulorna i väskan hamnar i samlingen')
  assert.ok(nya.includes('seger') && nya.includes('forsta'))
  assert.ok(m.hjaltar.includes('kalle'))
  assert.ok(R.benFor({ ...r, feber: 5 }) > R.benFor(r), 'mer ben på högre Feber')
  assert.ok(R.benFor({ ...r, reliker: ['benbit'] }) > R.benFor(r))
  // en sparad runda från förra versionen går att spela vidare
  const gammal = { ...r, v: 1, steg: 'spel', slut: false }
  for (const f of ['arkanor', 'arkanaVal', 'vaska', 'elitKlara', 'besegrade']) delete gammal[f]
  const lagad = R.laga(gammal)
  assert.equal(lagad.v, 2)
  assert.ok(lagad.vaska.length >= 2 && Array.isArray(lagad.arkanor))
  assert.ok(R.spelVal(lagad, R.rumBana(lagad)).perk)
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
