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
// steg() returnerar en lista av händelser som komponenten spelar upp:
//   { typ:'traff', pinne, orange, poang, mult }
//   { typ:'raddning', pinne }      kulan satt fast, pinnen offrades
//   { typ:'knuff' }                kulan satt fast utan pinne i närheten
//   { typ:'feber' }                sista orange pinnen träffad
//   { typ:'hink' }                 kulan landade i hinken
//   { typ:'skottSlut', pinnar, extraKula, poang }
//   { typ:'banaKlar', bonus }
//   { typ:'slut' }

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

const STARTKULOR = 10
const KULOR_PER_BANA = 2

let nastaId = 1
function pinne(x, y, orange) {
  return { id: nastaId++, x, y, orange: !!orange, traffad: false }
}

export function resetIds() {
  nastaId = 1
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

  // 20 orange, jämnt utspridda men slumpade. Minst 10 även på de glesare
  // banformerna (t.ex. form 2, som bara har ~28 pinnar totalt och annars
  // hade landat på 8).
  const idx = inom.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  const antalOrange = Math.min(inom.length, Math.max(10, Math.min(20, Math.floor(inom.length * 0.3))))
  idx.slice(0, antalOrange).forEach((i) => {
    inom[i].orange = true
  })

  return inom
}

// ------------------------------------------------------------------- spel

export function skapaSpel(niva = 1, kulor = STARTKULOR, poang = 0) {
  return {
    niva,
    pinnar: skapaBana(niva),
    kulor,
    poang,
    kula: null,
    vinkel: Math.PI / 2,
    lage: 'siktar', // siktar | skjuter | klar
    traffadeIdn: [],
    orangeIskottet: 0,
    feber: false,
    hink: { x: BREDD / 2, vx: HINK_FART, bredd: HINK_BREDD },
    // vakthundens tillstånd
    lagst: 0,
    utanFramsteg: 0,
    skottTid: 0,
    raddningar: 0,
    ankarX: 0,
    ankarY: 0,
  }
}

export function orangeKvar(spel) {
  return spel.pinnar.filter((p) => p.orange).length
}

export function sikta(spel, vinkel) {
  const min = Math.PI * 0.08
  const max = Math.PI * 0.92
  spel.vinkel = Math.max(min, Math.min(max, vinkel))
}

export function skjut(spel) {
  if (spel.lage !== 'siktar' || spel.kulor <= 0) return false
  spel.kulor -= 1
  spel.traffadeIdn = []
  spel.orangeIskottet = 0
  spel.feber = false
  spel.raddningar = 0
  spel.skottTid = 0
  spel.kula = {
    x: BREDD / 2,
    y: 32,
    vx: Math.cos(spel.vinkel) * STARTFART,
    vy: Math.sin(spel.vinkel) * STARTFART,
  }
  spel.lagst = spel.kula.y
  spel.utanFramsteg = 0
  spel.ankarX = spel.kula.x
  spel.ankarY = spel.kula.y
  spel.lage = 'skjuter'
  return true
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

  if (p.orange && orangeKvar(spel) === 0 && !spel.feber) {
    spel.feber = true
    handelser.push({ typ: 'feber' })
  }
}

// Räddningen: offra pinnen närmast kulan. Räcker inte den startar mätaren
// om och nästa åker efter ytterligare FAST_MS. En i taget, inte alla —
// att ta bort allt på en gång känns som att spelet gav upp.
function radda(spel, handelser) {
  const k = spel.kula
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
    spel.utanFramsteg = 0
    spel.ankarX = k.x
    spel.ankarY = k.y
    handelser.push({ typ: 'knuff' })
    return
  }

  // pinnen räknas som träffad först — man ska inte förlora poäng på att
  // fysiken krånglade
  markeraTraff(spel, narmast, handelser)
  spel.pinnar = spel.pinnar.filter((p) => p !== narmast)
  spel.raddningar += 1
  spel.utanFramsteg = 0
  spel.lagst = k.y
  spel.ankarX = k.x
  spel.ankarY = k.y
  handelser.push({ typ: 'raddning', pinne: narmast })
}

function avslutaSkott(spel, handelser) {
  const iHinken =
    spel.kula && Math.abs(spel.kula.x - spel.hink.x) < spel.hink.bredd / 2

  const borttagna = spel.pinnar.filter((p) => p.traffad)
  spel.pinnar = spel.pinnar.filter((p) => !p.traffad)
  spel.pinnar.forEach((p) => {
    p.traffad = false
  })
  spel.kula = null

  let bonus = 0
  if (iHinken) {
    spel.kulor += 1
    bonus = 500
    spel.poang += bonus
    handelser.push({ typ: 'hink' })
  }

  handelser.push({
    typ: 'skottSlut',
    pinnar: borttagna,
    extraKula: !!iHinken,
    poang: bonus,
  })

  if (orangeKvar(spel) === 0) {
    const kvarBonus = spel.kulor * 1000
    spel.poang += kvarBonus
    spel.lage = 'klar'
    handelser.push({ typ: 'banaKlar', bonus: kvarBonus })
  } else if (spel.kulor <= 0) {
    spel.lage = 'klar'
    handelser.push({ typ: 'slut' })
  } else {
    spel.lage = 'siktar'
  }
}

// Nästa bana: kulorna följer med och man får några till.
export function nastaBana(spel) {
  return skapaSpel(spel.niva + 1, spel.kulor + KULOR_PER_BANA, spel.poang)
}

// Ett steg framåt. dtMs bara för vakthundens tidtagning — fysiken kör med
// fast tidssteg så den blir identisk i Node och i webbläsaren.
export function steg(spel, dtMs = TIDSSTEG) {
  const handelser = []

  spel.hink.x += spel.hink.vx
  if (spel.hink.x < spel.hink.bredd / 2 + 4 || spel.hink.x > BREDD - spel.hink.bredd / 2 - 4) {
    spel.hink.vx *= -1
  }

  if (spel.lage !== 'skjuter' || !spel.kula) return handelser

  spel.skottTid += dtMs
  const k = spel.kula

  for (let s = 0; s < DELSTEG; s++) {
    const d = 1 / DELSTEG
    k.vy += GRAVITATION * d
    k.x += k.vx * d
    k.y += k.vy * d

    if (k.x < KULA_R) {
      k.x = KULA_R
      k.vx = Math.abs(k.vx) * VAGGSTUDS
    }
    if (k.x > BREDD - KULA_R) {
      k.x = BREDD - KULA_R
      k.vx = -Math.abs(k.vx) * VAGGSTUDS
    }
    if (k.y < KULA_R) {
      k.y = KULA_R
      k.vy = Math.abs(k.vy) * VAGGSTUDS
    }

    // Kollision mot varje pinne. Delstegen är hela knepet: utan dem flyger
    // kulan rakt igenom pinnar när den går fort, eftersom den hinner passera
    // hela pinnen mellan två bildrutor.
    for (const p of spel.pinnar) {
      const dx = k.x - p.x
      const dy = k.y - p.y
      const dist = Math.hypot(dx, dy)
      if (dist >= PINNE_R + KULA_R || dist === 0) continue

      const nx = dx / dist
      const ny = dy / dist
      // skjut ut kulan ur pinnen, annars upptäcks kollisionen igen nästa
      // delsteg och kulan vibrerar fast
      k.x = p.x + nx * (PINNE_R + KULA_R + 0.1)
      k.y = p.y + ny * (PINNE_R + KULA_R + 0.1)

      const dot = k.vx * nx + k.vy * ny
      k.vx = (k.vx - 2 * dot * nx) * STUDS
      k.vy = (k.vy - 2 * dot * ny) * STUDS

      markeraTraff(spel, p, handelser)
    }

    if (k.y > HOJD + 12) {
      avslutaSkott(spel, handelser)
      return handelser
    }
  }

  // vakthunden: framsteg räknas som ANTINGEN ett nytt lägsta djup ELLER
  // tillräcklig förflyttning från senaste ankarpunkten. Djupet ensamt räcker
  // inte — en kula på väg uppåt i en hög båge gör inget nytt lägsta på
  // länge, men den är uppenbarligen inte fastkilad om den samtidigt färdas
  // hundratals pixlar.
  const nyttDjup = k.y > spel.lagst + DJUP_MARGINAL
  const harRortSig = Math.hypot(k.x - spel.ankarX, k.y - spel.ankarY) > RORELSE_TROSKEL
  if (nyttDjup || harRortSig) {
    if (nyttDjup) spel.lagst = k.y
    spel.utanFramsteg = 0
    spel.ankarX = k.x
    spel.ankarY = k.y
  } else {
    spel.utanFramsteg += dtMs
  }
  if (spel.utanFramsteg >= FAST_MS) radda(spel, handelser)

  // hårt tak: vakthunden täcker det vi tänkt på, taket täcker resten
  if (spel.skottTid > HART_TAK_MS) {
    avslutaSkott(spel, handelser)
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
}
