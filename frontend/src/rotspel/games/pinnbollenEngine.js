// Motorn för Pinnbollen. Ren fysik och regler, ingen React, ingen canvas.
//
// Samma uppdelning som Krossen: motorn bestämmer VAD som händer, komponenten
// bestämmer hur det ser ut. Motorn går att köra i Node, vilket är hela
// poängen — kollisionskod är precis den sortens sak där en teckenfelsbugg
// är osynlig tills någon skjuter i en viss vinkel.
//
// Anropsmönster:
//   const spel = skapaSpel(1)
//   sikta(spel, vinkel)
//   skjut(spel)
//   const handelser = steg(spel)   // en gång per bildruta
//
// spel.kulor är en array — ett skott kan ha fler än en kula i luften
// samtidigt (se "trippel" i pinnbollenKrafter.js). Varje kula äger sin egen
// vakthundsdata (lagst/utanFramsteg/ankarX/ankarY) eftersom de kan fastna
// oberoende av varandra. spel.kulorKvar är lagret av kulor kvar att skjuta —
// ett annat fält än spel.kulor, trots det snarlika namnet.
//
// steg() returnerar en lista av händelser som komponenten spelar upp:
//   { typ:'traff', pinne, orange, poang, mult }
//   { typ:'raddning', pinne, kulaId } kulan satt fast, pinnen offrades
//   { typ:'knuff', kulaId }        kulan satt fast utan pinne i närheten
//   { typ:'feberStart', pinne }    sista orange pinnen träffad, feberfinalen börjar
//   { typ:'kraft', kraft }         en grön pinne träffades, kraft dragen
//   { typ:'golv' }                 studsgolvet användes
//   { typ:'hink', kulaId }         en kula landade i hinken
//   { typ:'fackTraff', index, poang } en kula landade i ett bonusfack
//   { typ:'skottSlut', pinnar, extraKulor, poang }
//   { typ:'banaKlar', bonus }
//   { typ:'slut' }
//
// spel.lage: siktar | skjuter | feber | fack | klar. Feberfinalen (se
// FEBERFINALEN nedan) körs som två extra lägen mellan skjuter och klar —
// komponenten styr själv NÄR övergången från feber till fack sker (genom
// att anropa oppnaFack()), motorn bara VAD som gäller i respektive läge.

import { draKraft } from './pinnbollenKrafter.js'

export const BREDD = 300
export const HOJD = 420

export const PINNE_R = 6
export const KULA_R = 5.5

// Minsta tillåtna avstånd mellan två pinnars centrum. En kula som ska kunna
// passera fritt mellan två pinnar behöver minst tre kulradier fri yta i
// springan (annars nyper den fast och vakthunden tvingas rycka in) — därför
// tre gånger kollisionsradien, inte två. Banformerna i skapaBana är byggda
// för att aldrig lägga pinnar närmare varandra än så här.
export const MIN_AVSTAND = (PINNE_R + KULA_R) * 3

const GRAVITATION = 0.17
const STUDS = 0.74
const VAGGSTUDS = 0.9
const DELSTEG = 6
const STARTFART = 3.6
const TIDSSTEG = 1000 / 60

// Vakthunden mot fastnade kulor. Mäter inte hastighet utan framsteg, på två
// oberoende sätt: har kulan inte nått en ny lägstapunkt PÅ så här länge, ELLER
// inte rört sig bort från sin senaste ankarpunkt på så här länge, sitter den
// fast. Bara djupmåttet räcker inte — en kula som studsar högt upp i en båge
// gör inget nytt lägsta på länge (den är ju på väg UPP) trots att den är i
// fritt fall och inte fastnat alls, vilket offrade en pinne helt i onödan
// innan rörelsemåttet fanns. En fastkilad kula rör sig bara någon enstaka
// pixel i taget; en kula i en riktig båge färdas hundratals pixlar.
const FAST_MS = 2500
const DJUP_MARGINAL = 3
const RADDNING_RADIE = 40
const HART_TAK_MS = 30000

// Hur långt kulan måste ha förflyttat sig från sin senaste ankarpunkt för
// att räknas som "i rörelse", oavsett djup. Samma tregångers-logik som
// MIN_AVSTAND: en kilad kula kommer aldrig i närheten av det här avståndet,
// medan en kula i fritt fall passerar det på ett par bildrutor.
export const RORELSE_TROSKEL = (PINNE_R + KULA_R) * 5

const HINK_BREDD = 52
const HINK_FART = 1.05

// Krafternas effektstyrka
const STOR_SKALA = 2
const MAGNET_FAKTOR = 0.08 // andel av GRAVITATION
const GOLV_STUDS = 0.8

const STARTKULOR = 10
const KULOR_PER_BANA = 2

// ------------------------------------------------------------ feberfinalen
//
// Facken (vänster till höger). Mittenfacket är både svårast att träffa och
// mest värt — det ligger mitt emellan två väggar i stället för att bara
// gränsa till en, så det kräver en snävare bana.
export const FACK_POANG = [10000, 25000, 100000, 25000, 10000]

// Skiljeväggarnas höjd — hur högt upp i planen "facklådan" börjar. Väggarna
// sträcker sig från den här höjden och nedåt (obegränsat, kulan lämnar
// planen som vanligt vid HOJD+12).
export const FACK_HOJD = 70
const FACK_VAGG_TOPP = HOJD - FACK_HOJD

// Väggarnas kollisionsradie — samma sorts rundade topp som en pinne, fast
// grövre eftersom det är en strukturell vägg, inte en liten pinne. Exporterad
// så komponenten kan rita väggarna med samma mått som fysiken faktiskt använder.
export const VAGG_R = 7

// Två olika studsvärden beroende på VAR man träffar väggen (se kollisionen
// i steg()): en rundad topp man kan komma in över (sidled, förutsägbart) och
// en rundad topp man kan komma in UNDERIFRÅN — nej, ovanifrån, rakt ner i
// den rundade toppen. Den sistnämnda är den viktiga, medvetet oförutsägbara
// studsen som gör att kulan kan hoppa mellan facken i stället för att bara
// falla ner i det första den råkar nudda — det är den spänningen som gör
// finalen till en final och inte bara ett sista skott.
const VAGG_SIDA_STUDS = 0.8
const VAGG_TOPP_STUDS = 0.62

let nastaId = 1
function pinne(x, y, orange) {
  return { id: nastaId++, x, y, orange: !!orange, gron: false, traffad: false }
}

let nastaKulaId = 1
function skapaKula(x, y, vx, vy, r) {
  return {
    id: nastaKulaId++,
    x,
    y,
    vx,
    vy,
    r,
    // vakthundens tillstånd — en egen uppsättning per kula, de kan fastna
    // oberoende av varandra
    lagst: y,
    utanFramsteg: 0,
    ankarX: x,
    ankarY: y,
  }
}

export function resetIds() {
  nastaId = 1
  nastaKulaId = 1
}

// Poängmultiplikatorn räknar orange pinnar i SAMMA skott, inte totalt.
// Det är den regeln som gör spelet till ett vinkelpussel i stället för
// ett träffa-orange-spel.
export function mult(orangeIskottet) {
  if (orangeIskottet >= 8) return 10
  if (orangeIskottet >= 6) return 5
  if (orangeIskottet >= 4) return 3
  if (orangeIskottet >= 2) return 2
  return 1
}

// ------------------------------------------------------------------ banor

// Banorna är deterministiska på nivånumret, så alla spelar samma bana.
function slumpare(fro) {
  let s = fro >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function skapaBana(niva) {
  const rnd = slumpare(niva * 7919 + 13)
  const p = []

  const form = niva % 4

  // Alla fyra banformerna nedan är numeriskt eftersökta (inte handräknade)
  // så att minsta parvisa pinnavstånd i hela banan ligger en bra bit över
  // MIN_AVSTAND, inte bara precis över gränsen — annars kan vakthunden
  // fortfarande kilas fast då och då på de trängsta ställena, bara mer
  // sällan. Marginalen här (~40-44px, mot kravet 34,5px) höll den
  // kilnings-orsakade räddningsfrekvensen vid 0 i alla mätningar.

  if (form === 0) {
    // två bågar och ett rutblock
    const arcRadius = [145, 110]
    const arcCount = [6, 5]
    const arcCy = [130, 200]
    const arcYSkala = [50, 36]
    for (let k = 0; k < 2; k++) {
      const antal = arcCount[k]
      for (let i = 0; i < antal; i++) {
        const a = Math.PI * 0.12 + Math.PI * 0.76 * (i / (antal - 1))
        p.push(
          pinne(
            BREDD / 2 + Math.cos(a) * arcRadius[k],
            arcCy[k] + Math.sin(a) * arcYSkala[k]
          )
        )
      }
    }
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 5; c++) p.push(pinne(54 + c * 50 + (r % 2 ? 25 : 0), 282 + r * 36))
  } else if (form === 1) {
    // pyramid
    for (let r = 0; r < 5; r++) {
      const antal = 3 + r
      for (let c = 0; c < antal; c++) {
        p.push(pinne(BREDD / 2 - (antal - 1) * 22 + c * 44, 128 + r * 44))
      }
    }
  } else if (form === 2) {
    // två torn och tre broar. Tornen sitter nära kanterna (x=40/260) för att
    // ge broarna en säker zon i mitten.
    for (let r = 0; r < 6; r++) {
      p.push(pinne(40, 126 + r * 40))
      p.push(pinne(260, 126 + r * 40))
    }
    const broar = [
      { startX: 80, y: 176 },
      { startX: 100, y: 226 },
      { startX: 80, y: 276 },
    ]
    for (const bro of broar) {
      for (let c = 0; c < 4; c++) p.push(pinne(bro.startX + c * 40, bro.y))
    }
  } else {
    // spiral. Färre varv än tidigare — en tät spiral får bara plats med
    // betydligt färre pinnar än MIN_AVSTAND tillåter innan den måste lämna
    // planen.
    for (let i = 0; i < 32; i++) {
      const a = i * 1.38
      const r = 34 + i * 5.4
      p.push(pinne(BREDD / 2 + Math.cos(a) * r * 1.05, 220 + Math.sin(a) * r * 1.05))
    }
  }

  // Håll pinnarna innanför kanterna. Sidoväggarna studsar kulan (VAGGSTUDS)
  // och behöver samma marginal som två pinnar sinsemellan — annars bildar
  // pinnen och väggen tillsammans en ficka kulan kan nötas ner i precis som
  // mellan två pinnar. Topp/botten har ingen sådan vägg (skottet startar vid
  // toppen och avslutas när kulan lämnar planen nedtill) så de behåller sin
  // gamla, snävare marginal.
  const inom = p.filter(
    (q) => q.x > MIN_AVSTAND && q.x < BREDD - MIN_AVSTAND && q.y > 70 && q.y < HOJD - 60
  )

  // Bygg hellre inte banan än att servera en som gör vakthunden till en del
  // av spelmekaniken. Om två pinnar hamnar för nära har banformens
  // konstanter ändrats utan att avståndet räknats om.
  for (let i = 0; i < inom.length; i++) {
    for (let j = i + 1; j < inom.length; j++) {
      const d = Math.hypot(inom[i].x - inom[j].x, inom[i].y - inom[j].y)
      if (d < MIN_AVSTAND) {
        throw new Error(
          `skapaBana(${niva}): två pinnar för nära varandra (${d.toFixed(1)}px < ${MIN_AVSTAND}px)`
        )
      }
    }
  }

  // Två gröna pinnar, en ur övre och en ur undre halvan (delat på den
  // faktiska höjdspridningen, inte pinnantalet) så de sprids ut i stället
  // för att råka hamna i samma hörn. En pinne är antingen grön eller
  // orange, aldrig båda — grönt väljs innan orange, från hela poolen.
  const yVarden = inom.map((q) => q.y)
  const yMitt = (Math.min(...yVarden) + Math.max(...yVarden)) / 2
  const ovreHalva = inom.filter((q) => q.y < yMitt)
  const undreHalva = inom.filter((q) => q.y >= yMitt)
  const valjGron = (grupp) => {
    if (grupp.length === 0) return
    grupp[Math.floor(rnd() * grupp.length)].gron = true
  }
  valjGron(ovreHalva)
  valjGron(undreHalva)

  const antalGrona = inom.filter((q) => q.gron).length
  if (antalGrona !== 2) {
    throw new Error(`skapaBana(${niva}): fick ${antalGrona} gröna pinnar i stället för 2`)
  }

  // 20 orange, jämnt utspridda men slumpade, valda ur de pinnar som inte
  // redan är gröna. Minst 10 även på de glesare banformerna (t.ex. form 2,
  // som bara har ~28 pinnar totalt och annars hade landat på 8).
  const orangePool = inom.filter((q) => !q.gron)
  const idx = orangePool.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  const antalOrange = Math.min(
    orangePool.length,
    Math.max(10, Math.min(20, Math.floor(inom.length * 0.3)))
  )
  idx.slice(0, antalOrange).forEach((i) => {
    orangePool[i].orange = true
  })

  return inom
}

// ------------------------------------------------------------------- spel

export function skapaSpel(niva = 1, kulorKvar = STARTKULOR, poang = 0) {
  return {
    niva,
    pinnar: skapaBana(niva),
    kulorKvar, // lager av kulor kvar att skjuta — inte samma sak som kulor (nedan)
    poang,
    kulor: [], // kulorna i luften just nu, under det pågående skottet
    vinkel: Math.PI / 2,
    lage: 'siktar', // siktar | skjuter | klar
    traffadeIdn: [],
    orangeIskottet: 0,
    hink: { x: BREDD / 2, vx: HINK_FART, bredd: HINK_BREDD },
    fack: null, // sätts av oppnaFack() när feberfinalen når fack-läget
    fackVaggar: null,
    skottTid: 0,
    raddningar: 0,
    golvKvar: false,
    vantandeKraft: null, // dragen under pågående skott, väntar på skottSlut
    aktivKraft: null, // gäller det pågående/kommande skottet
    // ackumuleras under skottet, rapporteras i skottSlut-händelsen
    hinkFangade: 0,
    hinkBonus: 0,
  }
}

// OBS: filtrerar bort redan träffade pinnar (!traffad). En träffad pinne
// ligger kvar i spel.pinnar ända till avslutaSkott (se kommentaren där) —
// utan det filtret skulle den pinnen man precis träffade räkna sig själv och
// orangeKvar() aldrig kunna bli 0 mitt i ett skott, vilket i sin tur gjorde
// att feberfinalen (se markeraTraff) aldrig gick att lösa ut.
export function orangeKvar(spel) {
  return spel.pinnar.filter((p) => p.orange && !p.traffad).length
}

export function sikta(spel, vinkel) {
  const min = Math.PI * 0.08
  const max = Math.PI * 0.92
  spel.vinkel = Math.max(min, Math.min(max, vinkel))
}

export function skjut(spel) {
  if (spel.lage !== 'siktar' || spel.kulorKvar <= 0) return false
  spel.kulorKvar -= 1
  spel.traffadeIdn = []
  spel.orangeIskottet = 0
  spel.raddningar = 0
  spel.skottTid = 0
  spel.hinkFangade = 0
  spel.hinkBonus = 0

  const kraftId = spel.aktivKraft?.id
  spel.golvKvar = kraftId === 'golv'
  spel.hink.bredd = kraftId === 'hink' ? HINK_BREDD * 2 : HINK_BREDD
  const r = kraftId === 'stor' ? KULA_R * STOR_SKALA : KULA_R

  const vinklar = kraftId === 'trippel' ? [spel.vinkel - 0.12, spel.vinkel, spel.vinkel + 0.12] : [spel.vinkel]
  spel.kulor = vinklar.map((v) =>
    skapaKula(BREDD / 2, 32, Math.cos(v) * STARTFART, Math.sin(v) * STARTFART, r)
  )

  spel.lage = 'skjuter'
  return true
}

// Närmaste otraffade orange pinne, för magneten. null om ingen finns kvar.
function narmasteOrangePinne(spel, k) {
  let bast = null
  let bastD = Infinity
  for (const p of spel.pinnar) {
    if (!p.orange || p.traffad) continue
    const d = Math.hypot(p.x - k.x, p.y - k.y)
    if (d < bastD) {
      bastD = d
      bast = p
    }
  }
  return bast
}

function markeraTraff(spel, p, handelser) {
  if (p.traffad) return
  p.traffad = true
  spel.traffadeIdn.push(p.id)
  if (p.orange) spel.orangeIskottet += 1

  const m = mult(spel.orangeIskottet)
  const poang = (p.orange ? 100 : 10) * m
  spel.poang += poang
  handelser.push({ typ: 'traff', pinne: p, orange: p.orange, poang, mult: m })

  // Feberfinalen: sätts EXAKT när den sista orange pinnen faller, oavsett
  // hur många kulor som råkar vara i luften samtidigt (trippel). Kulan som
  // träffade fortsätter flyga precis som vanligt — det är komponenten som
  // bestämmer när facken faktiskt öppnas (oppnaFack), motorn markerar bara
  // att finalen har börjat. Lage-kollen (i stället för en enkel flagga)
  // hindrar också att en andra/tredje kula (samma trippel) triggar om
  // finalen om den råkar träffa en pinne som redan räknats.
  if (p.orange && orangeKvar(spel) === 0 && spel.lage !== 'feber' && spel.lage !== 'fack') {
    spel.lage = 'feber'
    handelser.push({ typ: 'feberStart', pinne: p })
  }

  // Grön pinne: dra en kraft direkt, men den gäller inte förrän nästa skott
  // (utom "extra", som är omedelbar och aldrig blir aktivKraft) — se
  // avslutaSkott. Lådan i komponenten visar bara upp ett resultat som redan
  // är avgjort här.
  if (p.gron) {
    const kraft = draKraft()
    handelser.push({ typ: 'kraft', kraft })
    if (kraft.direkt) {
      spel.kulorKvar += 1
    } else {
      spel.vantandeKraft = kraft
    }
  }
}

// Räddningen: offra pinnen närmast kulan. Räcker inte den startar mätaren
// om och nästa åker efter ytterligare FAST_MS. En i taget, inte alla —
// att ta bort allt på en gång känns som att spelet gav upp.
function radda(spel, k, handelser) {
  let narmast = null
  let bast = Infinity

  for (const p of spel.pinnar) {
    const d = Math.hypot(p.x - k.x, p.y - k.y)
    if (d < bast) {
      bast = d
      narmast = p
    }
  }

  if (!narmast || bast > RADDNING_RADIE) {
    // ingen pinne i närheten: knuffa kulan i stället, annars kan den låsa
    // spelet mellan väggarna
    k.vx += (Math.random() - 0.5) * 2
    k.vy += 1.2
    k.utanFramsteg = 0
    k.ankarX = k.x
    k.ankarY = k.y
    handelser.push({ typ: 'knuff', kulaId: k.id })
    return
  }

  // pinnen räknas som träffad först — man ska inte förlora poäng på att
  // fysiken krånglade
  markeraTraff(spel, narmast, handelser)
  spel.pinnar = spel.pinnar.filter((p) => p !== narmast)
  spel.raddningar += 1
  k.lagst = k.y
  k.utanFramsteg = 0
  k.ankarX = k.x
  k.ankarY = k.y
  handelser.push({ typ: 'raddning', pinne: narmast, kulaId: k.id })
}

// Kontrollerar om en kula som lämnat planen landade i hinken. Måste göras i
// samma ögonblick som kulan passerar underkanten — i efterhand vet man inte
// längre var den var. Flera kulor i samma skott kan fångas var för sig.
function provaHinkFangst(spel, k, handelser) {
  if (Math.abs(k.x - spel.hink.x) < spel.hink.bredd / 2) {
    spel.kulorKvar += 1
    spel.poang += 500
    spel.hinkFangade += 1
    spel.hinkBonus += 500
    handelser.push({ typ: 'hink', kulaId: k.id })
  }
}

// Motsvarigheten till provaHinkFangst under feberfinalens fack-läge. Facken
// täcker HELA bredden (se oppnaFack) så kulan kan aldrig missa alla fem —
// clamp:en är bara ett skydd mot flyttal som landar en hårsmån utanför 0
// eller BREDD, inte en riktig missad-fallback.
function provaFackTraff(spel, k, handelser) {
  const bredd = BREDD / spel.fack.length
  const index = Math.max(0, Math.min(spel.fack.length - 1, Math.floor(k.x / bredd)))
  const poang = spel.fack[index].poang
  spel.poang += poang
  handelser.push({ typ: 'fackTraff', index, poang })
}

function avslutaSkott(spel, handelser) {
  const borttagna = spel.pinnar.filter((p) => p.traffad)
  spel.pinnar = spel.pinnar.filter((p) => !p.traffad)
  spel.pinnar.forEach((p) => {
    p.traffad = false
  })

  spel.hink.bredd = HINK_BREDD
  spel.golvKvar = false

  handelser.push({
    typ: 'skottSlut',
    pinnar: borttagna,
    extraKulor: spel.hinkFangade,
    poang: spel.hinkBonus,
  })

  // Kraften som gällde skottet som just tog slut är förbrukad. En ny som
  // vanns under samma skott (grön pinne) blir aktiv för nästa i stället —
  // den hinner aldrig påverka flykten som redan är i gång.
  spel.aktivKraft = spel.vantandeKraft
  spel.vantandeKraft = null

  if (orangeKvar(spel) === 0) {
    const kvarBonus = spel.kulorKvar * 1000
    spel.poang += kvarBonus
    spel.lage = 'klar'
    handelser.push({ typ: 'banaKlar', bonus: kvarBonus })
  } else if (spel.kulorKvar <= 0) {
    spel.lage = 'klar'
    handelser.push({ typ: 'slut' })
  } else {
    spel.lage = 'siktar'
  }
}

// Nästa bana: kulorna följer med och man får några till. skapaSpel() ger ett
// helt nytt spelobjekt, så en kraft som precis vanns (aktivKraft, satt av
// avslutaSkott när den sista orange pinnen föll) måste flyttas över för
// hand — annars vinner spelaren en trippel som försvinner i banbytet innan
// den ens gick att använda.
export function nastaBana(spel) {
  const nytt = skapaSpel(spel.niva + 1, spel.kulorKvar + KULOR_PER_BANA, spel.poang)
  nytt.aktivKraft = spel.aktivKraft
  return nytt
}

// Tar bort alla kvarvarande pinnar (blå/gröna — orange finns per definition
// inga kvar, det är precis det som utlöste feberläget) och returnerar dem,
// så komponenten kan spela upp sin egen våganimation utan att motorn behöver
// veta något om ritning eller timing. Kulorna i luften påverkas inte.
export function rensaPinnar(spel) {
  const borttagna = spel.pinnar
  spel.pinnar = []
  return borttagna
}

// Komponenten avgör NÄR facken ska öppnas (se den exakta tidslinjen i
// Pinnbollen.jsx) — motorn bara utför bytet: den rörliga hinken försvinner
// och ersätts av fem fasta fack över hela bredden plus fyra skiljeväggar.
// Ett no-op om spelet redan lämnat feber-läget (t.ex. en fördröjd timer som
// hinner köra efter att finalen redan löstes ut på annat sätt).
export function oppnaFack(spel) {
  if (spel.lage !== 'feber') return
  const n = FACK_POANG.length
  const bredd = BREDD / n
  spel.hink = null
  spel.fack = FACK_POANG.map((poang, i) => ({
    index: i,
    poang,
    xMin: bredd * i,
    xMax: bredd * (i + 1),
  }))
  spel.fackVaggar = Array.from({ length: n - 1 }, (_, i) => bredd * (i + 1))
  spel.lage = 'fack'
}

// Ett steg framåt. dtMs bara för vakthundens tidtagning — fysiken kör med
// fast tidssteg så den blir identisk i Node och i webbläsaren.
//
// Loopar över spel.kulor: varje kula kör hela sekvensen (delsteg, väggar,
// kollisioner, vakthund) för sig. En kula som passerar underkanten tas ur
// arrayen direkt — skottet avslutas först när arrayen är tom.
export function steg(spel, dtMs = TIDSSTEG) {
  const handelser = []

  // Hinken finns bara innan facken öppnats (oppnaFack sätter den till null).
  if (spel.hink) {
    spel.hink.x += spel.hink.vx
    if (spel.hink.x < spel.hink.bredd / 2 + 4 || spel.hink.x > BREDD - spel.hink.bredd / 2 - 4) {
      spel.hink.vx *= -1
    }
  }

  // Feber och fack är förlängningar av skjuter — kulan/kulorna som redan är
  // i luften när den sista orange pinnen faller ska fortsätta flyga med
  // exakt samma fysik, bara reglerna för vad som händer vid underkanten
  // ändras (se fack-grenen nedan).
  const flyger = spel.lage === 'skjuter' || spel.lage === 'feber' || spel.lage === 'fack'
  if (!flyger || spel.kulor.length === 0) return handelser

  spel.skottTid += dtMs
  const genom = spel.aktivKraft?.id === 'genom'
  const magnet = spel.aktivKraft?.id === 'magnet'

  for (let ki = spel.kulor.length - 1; ki >= 0; ki--) {
    const k = spel.kulor[ki]
    let borttagen = false

    for (let s = 0; s < DELSTEG && !borttagen; s++) {
      const d = 1 / DELSTEG
      k.vy += GRAVITATION * d

      if (magnet) {
        const mal = narmasteOrangePinne(spel, k)
        if (mal) {
          const dx = mal.x - k.x
          const dy = mal.y - k.y
          const dist = Math.hypot(dx, dy) || 1
          const accel = GRAVITATION * MAGNET_FAKTOR
          k.vx += (dx / dist) * accel * d
          k.vy += (dy / dist) * accel * d
        }
      }

      k.x += k.vx * d
      k.y += k.vy * d

      if (k.x < k.r) {
        k.x = k.r
        k.vx = Math.abs(k.vx) * VAGGSTUDS
      }
      if (k.x > BREDD - k.r) {
        k.x = BREDD - k.r
        k.vx = -Math.abs(k.vx) * VAGGSTUDS
      }
      if (k.y < k.r) {
        k.y = k.r
        k.vy = Math.abs(k.vy) * VAGGSTUDS
      }

      // Kollision mot varje pinne. Delstegen är hela knepet: utan dem flyger
      // kulan rakt igenom pinnar när den går fort, eftersom den hinner passera
      // hela pinnen mellan två bildrutor.
      for (const p of spel.pinnar) {
        const dx = k.x - p.x
        const dy = k.y - p.y
        const dist = Math.hypot(dx, dy)
        if (dist >= PINNE_R + k.r || dist === 0) continue

        const nx = dx / dist
        const ny = dy / dist

        if (genom) {
          // Ingen reflektion — kulan ska fortsätta rakt igenom. Men den
          // måste ändå flyttas ur pinnen, annars upptäcks samma kollision
          // igen nästa delsteg (farten är ju oförändrad, så den skulle
          // aldrig ta sig ur på egen hand). Flytta till andra sidan i
          // färdriktningen i stället för tillbaka mot ingångssidan, annars
          // fastnar den precis där den gick in.
          k.x = p.x - nx * (PINNE_R + k.r + 0.1)
          k.y = p.y - ny * (PINNE_R + k.r + 0.1)
        } else {
          // skjut ut kulan ur pinnen, annars upptäcks kollisionen igen nästa
          // delsteg och kulan vibrerar fast
          k.x = p.x + nx * (PINNE_R + k.r + 0.1)
          k.y = p.y + ny * (PINNE_R + k.r + 0.1)

          const dot = k.vx * nx + k.vy * ny
          k.vx = (k.vx - 2 * dot * nx) * STUDS
          k.vy = (k.vy - 2 * dot * ny) * STUDS
        }

        markeraTraff(spel, p, handelser)
      }

      // Skiljeväggarna i fack-läget. Varje vägg är en "kapsel": en rundad
      // topp vid FACK_VAGG_TOPP och därunder en rak stolpe. Träffpunkten
      // beräknas som avståndet till närmaste punkt på den (nedåt oändliga)
      // linjen — kommer kulan uppifrån klipper den in mot den rundade toppen
      // (ny pekar uppåt, oförutsägbar studs uppåt), kommer den från sidan
      // klipper den in mot stolpen (ny blir 0, ren sidledsstuds). Samma
      // knep som pinnkollisionen: flytta ut kulan innan studsen, annars
      // upptäcks samma kollision igen nästa delsteg.
      if (spel.lage === 'fack') {
        for (const vx of spel.fackVaggar) {
          const cy = Math.max(FACK_VAGG_TOPP, k.y)
          const dx = k.x - vx
          const dy = k.y - cy
          const dist = Math.hypot(dx, dy)
          if (dist >= VAGG_R + k.r || dist === 0) continue

          const nx = dx / dist
          const ny = dy / dist
          k.x = vx + nx * (VAGG_R + k.r + 0.1)
          k.y = cy + ny * (VAGG_R + k.r + 0.1)

          const uppifran = cy === FACK_VAGG_TOPP && ny < -0.3
          const studs = uppifran ? VAGG_TOPP_STUDS : VAGG_SIDA_STUDS
          const dot = k.vx * nx + k.vy * ny
          k.vx = (k.vx - 2 * dot * nx) * studs
          k.vy = (k.vy - 2 * dot * ny) * studs
        }
      }

      if (k.y > HOJD + 12) {
        if (spel.golvKvar) {
          // studsgolvet: en gratis studs uppåt, en gång per skott oavsett
          // hur många kulor som är i luften
          spel.golvKvar = false
          k.y = HOJD + 11
          k.vy = -Math.abs(k.vy) * GOLV_STUDS
          handelser.push({ typ: 'golv', kulaId: k.id })
        } else if (spel.lage === 'fack') {
          provaFackTraff(spel, k, handelser)
          spel.kulor.splice(ki, 1)
          borttagen = true
        } else {
          provaHinkFangst(spel, k, handelser)
          spel.kulor.splice(ki, 1)
          borttagen = true
        }
      }
    }

    if (borttagen) continue

    // vakthunden: framsteg räknas som ANTINGEN ett nytt lägsta djup ELLER
    // tillräcklig förflyttning från senaste ankarpunkten. Djupet ensamt
    // räcker inte — en kula på väg uppåt i en hög båge gör inget nytt
    // lägsta på länge, men den är uppenbarligen inte fastkilad om den
    // samtidigt färdas hundratals pixlar.
    const nyttDjup = k.y > k.lagst + DJUP_MARGINAL
    const harRortSig = Math.hypot(k.x - k.ankarX, k.y - k.ankarY) > RORELSE_TROSKEL
    if (nyttDjup || harRortSig) {
      if (nyttDjup) k.lagst = k.y
      k.utanFramsteg = 0
      k.ankarX = k.x
      k.ankarY = k.y
    } else {
      k.utanFramsteg += dtMs
    }
    if (k.utanFramsteg >= FAST_MS) radda(spel, k, handelser)
  }

  if (spel.kulor.length === 0 && spel.lage === 'skjuter') {
    avslutaSkott(spel, handelser)
  }

  // hårt tak: vakthunden täcker det vi tänkt på, taket täcker resten. Alla
  // kvarvarande kulor avslutas som om de just passerat underkanten. Gäller
  // även feber/fack — annars kan en enda pinsamt fastkilad kula i facket
  // frysa finalen för alltid om vakthundens knuff mot förmodan aldrig lyckas
  // få loss den.
  if (spel.skottTid > HART_TAK_MS && spel.lage === 'skjuter') {
    for (const k of spel.kulor) provaHinkFangst(spel, k, handelser)
    spel.kulor = []
    avslutaSkott(spel, handelser)
  } else if (spel.skottTid > HART_TAK_MS && (spel.lage === 'feber' || spel.lage === 'fack')) {
    for (const k of spel.kulor) {
      if (spel.lage === 'fack') provaFackTraff(spel, k, handelser)
      else if (spel.hink) provaHinkFangst(spel, k, handelser)
    }
    spel.kulor = []
  }

  // Fack-läget har ingen avslutaSkott (se kommentaren där uppe) — banan är
  // redan definitivt klar (orangeKvar var 0 när feberläget startade), så när
  // sista kulan lämnat facken avslutas nivån direkt, på samma sätt som
  // avslutaSkotts orangeKvar===0-gren men utan pinnstädning (det är redan
  // gjort av rensaPinnar). Kollas sist i funktionen så den även fångar
  // hårda-tak-grenen ovan, som kan tömma spel.kulor i samma anrop.
  if (spel.kulor.length === 0 && spel.lage === 'fack') {
    spel.lage = 'klar'
    const kvarBonus = spel.kulorKvar * 1000
    spel.poang += kvarBonus
    handelser.push({ typ: 'banaKlar', bonus: kvarBonus })
  }

  return handelser
}

// Siktlinjen simulerar skottet i förväg. Utan den går spelet inte att
// spela på en liten skärm.
export function siktlinje(spel, maxSteg = 46) {
  const pts = []
  let x = BREDD / 2
  let y = 32
  let vx = Math.cos(spel.vinkel) * STARTFART
  let vy = Math.sin(spel.vinkel) * STARTFART

  for (let i = 0; i < maxSteg; i++) {
    vy += GRAVITATION
    x += vx
    y += vy
    if (x < KULA_R || x > BREDD - KULA_R) break
    pts.push([x, y])
    if (spel.pinnar.some((p) => Math.hypot(p.x - x, p.y - y) < PINNE_R + KULA_R)) break
    if (y > HOJD) break
  }
  return pts
}

export const KONSTANTER = {
  GRAVITATION,
  STUDS,
  DELSTEG,
  STARTFART,
  FAST_MS,
  HART_TAK_MS,
  STARTKULOR,
  KULOR_PER_BANA,
  STOR_SKALA,
  MAGNET_FAKTOR,
  GOLV_STUDS,
  VAGG_SIDA_STUDS,
  VAGG_TOPP_STUDS,
}
