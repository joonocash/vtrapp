// Pinnbollen — motorn. Ren fysik och regler som i Peggle, ingen DOM.
//
// En bana är pinnar (cirklar) och tegel (raka eller kurvade, "kapslar"), en
// del av dem i rörelsegrupper som snurrar, pendlar eller glider. 25 av dem
// blir orange (slumpat varje försök bland de som får), två gröna och en lila
// per skott. Man har tio kulor. Träffade pinnar lyser och försvinner när
// skottet är slut. Alla orange borta = Extreme Fever och banan är klar.
//
// Poäng som i Peggle: blå 10, orange 100, lila 500, grön 10, gånger
// multiplikatorn (antal orange träffade på hela banan: 10 → 2x, 15 → 3x,
// 19 → 5x, 22 → 10x). Skottets poäng = summan × antalet träffar i skottet.
// 25 000 / 75 000 / 125 000 i ett skott ger extra kula, liksom hinken.
//
// Anrop:
//   const s = skapaSpel(bana, { fro })
//   s.sikta(vinkel); s.skjut()
//   const handelser = s.steg(dt)    // en gång per bildruta, dt i sekunder
//
// Kurvor (halfpipes, ramper) är äkta cirkelbågar, inte hackiga segment, så
// kulan rullar mjukt längs dem — det är där "Extreme Slide" kommer ifrån.

export const W = 360
export const H = 600
export const KULA_R = 5.5
export const PINNE_R = 7.5
export const TEGEL_TJ = 4.8 // halva tjockleken
export const KANON = { x: W / 2, y: 34 }
export const STARTKULOR = 10
export const ANTAL_ORANGE = 25

// Fysiken. Ett objekt (inte konstanter) så att testerna kan prova varianter.
export const FYSIK = {
  G: 470, // px/s²
  STARTFART: 470,
  STUDS_PINNE: 0.72,
  STUDS_TEGEL: 0.62,
  STUDS_VAGG: 0.86,
  RULL_GRANS: 60, // normalfart under det här = ingen studs, kulan rullar
}
const MAXFART = 1100
const FAST_TID = 1.1
const SKOTT_TAK = 40
const KEDJA_DT = 0.09 // tid mellan smällarna i en kedjereaktion
const LANG_TID = 14 // efter så här länge i ett skott försvinner tända saker som kulan rör

export const HINK = { bredd: 56, hojd: 20, y: H - 22, fart: (2 * Math.PI) / 6.5 }
// Kulkaos: Flipperbenen. Vänster led; den högra är spegelvänd.
export const FLIPPER = { x: 8, y: 534, L: 92, vila: 0.27, lyft: 0.85, fart: 16 }
// Kulkaos: hur långt ett svart hål drar
export const HAL_R = 95
export const FACK_POANG = [10000, 50000, 100000, 50000, 10000]
export const FACK_TOPP = H - 48

export const POANG = { bla: 10, orange: 100, gron: 10, lila: 500 }
export const FEBER_POANG = { bla: 1000, orange: 1000, gron: 1000, lila: 10000 }
export const MULT_GRANSER = [
  [22, 10],
  [19, 5],
  [15, 3],
  [10, 2],
]
export const EXTRA_KULA_VID = [25000, 75000, 125000]

export const STIL = {
  lang: { namn: 'Långskott', poang: 25000 },
  superlang: { namn: 'Superlångskott', poang: 50000 },
  glid: { namn: 'Extreme Slide', poang: 50000 },
  orangeattack: { namn: 'Orangeattack', poang: 50000 },
  vagg: { namn: 'Väggstuds', poang: 5000 },
  hinkskicklig: { namn: 'Hinkskicklig', poang: 5000 },
  dubbelkraft: { namn: 'Dubbelkraft', poang: 25000 },
  rensat: { namn: 'Rent hus', poang: 50000 },
  kedja: { namn: 'Kedjereaktion', poang: 50000 },
  mega: { namn: 'Megasmäll', poang: 100000 },
}

export const KRAFTER = {
  spar: { namn: 'Superspår', text: 'Långt siktspår i tre skott', skott: 3 },
  multi: { namn: 'Dubbelboll', text: 'En kula till, direkt' },
  small: { namn: 'Rymdsmäll', text: 'Allt runt den gröna pinnen tänds' },
  spok: { namn: 'Spöksboll', text: 'Kulan kommer tillbaka uppifrån en gång', skott: 1 },
  eld: { namn: 'Eldboll', text: 'Nästa kula bränner rakt igenom', skott: 1 },
  blomma: { namn: 'Blomkraft', text: 'De närmaste orange pinnarna tänds' },
}

export function multiplikator(orangeTraffade) {
  for (const [n, m] of MULT_GRANSER) if (orangeTraffade >= n) return m
  return 1
}

// Multiplikatorgränserna skalas om en bana har färre än 25 orange.
function multFor(orangeTraffade, antal) {
  const k = ANTAL_ORANGE / antal
  return multiplikator(Math.round(orangeTraffade * k))
}

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ----------------------------------------------------------------- geometri */

const TVAPI = Math.PI * 2
const normVinkel = (v) => ((v % TVAPI) + TVAPI) % TVAPI

// Närmaste punkt på ett objekt (i världskoordinater) till punkten (px, py).
// Returnerar [qx, qy, tjocklek].
export function narmast(o, px, py) {
  if (o.form === 'cirkel') {
    return [o.wx, o.wy, o.r]
  }
  if (o.form === 'segment') {
    const vx = o.wx2 - o.wx1
    const vy = o.wy2 - o.wy1
    const L2 = vx * vx + vy * vy || 1
    let k = ((px - o.wx1) * vx + (py - o.wy1) * vy) / L2
    k = k < 0 ? 0 : k > 1 ? 1 : k
    return [o.wx1 + vx * k, o.wy1 + vy * k, o.tj]
  }
  // båge: centrum (wcx, wcy), radie R, från a0 till a0+span
  const dx = px - o.wcx
  const dy = py - o.wcy
  let v = normVinkel(Math.atan2(dy, dx) - o.wa0)
  if (v > o.span) {
    // utanför bågen: närmaste ändpunkt
    v = v - o.span < TVAPI - v ? o.span : 0
  }
  const a = o.wa0 + v
  return [o.wcx + Math.cos(a) * o.R, o.wcy + Math.sin(a) * o.R, o.tj]
}

// Ungefärlig mittpunkt (för poängtexter och avstånd).
export function mitt(o) {
  if (o.form === 'cirkel') return [o.wx, o.wy]
  if (o.form === 'segment') return [(o.wx1 + o.wx2) / 2, (o.wy1 + o.wy2) / 2]
  const a = o.wa0 + o.span / 2
  return [o.wcx + Math.cos(a) * o.R, o.wcy + Math.sin(a) * o.R]
}

function rotera(x, y, cx, cy, c, s) {
  const dx = x - cx
  const dy = y - cy
  return [cx + dx * c - dy * s, cy + dx * s + dy * c]
}

/* ----------------------------------------------------------------- spelet */

// bana: { namn, objekt: [...], grupper: [...], orange?: antal, fasta?: true }
// objekt: { typ: 'pinne'|'tegel', form: 'cirkel'|'segment'|'bage', x, y, r | x1,y1,x2,y2 | cx,cy,R,a0,a1, grupp?, ejOrange?, farg0? }
// grupp: { typ: 'rotera', cx, cy, w } | { typ: 'pendel', cx, cy, A, T } | { typ: 'glid', ax, ay, T, fas } | { typ: 'bana', R, T, fas }
//
// fasta: färgerna är bestämda i banan (farg0 på objekten) i stället för
// slumpade — bonusbanorna vill ha de orange längs den väg kulan tar.
//
// val: kulor (antal från start), kulBonus (10 000 per kula kvar när banan
// är klar), hinkBredd, extraGrona (fler gröna pinnar), start ({ spar, eld,
// spok, trippel } — krafter som är igång från början).
export function skapaSpel(bana, { fro = 1, kulor = STARTKULOR, kulBonus = true, hinkBredd = HINK.bredd, extraGrona = 0, start = {}, perk = {}, vaska = null } = {}) {
  // hinken får inte bli bredare än att den hinner glida lite
  hinkBredd = Math.min(hinkBredd, W - 40)
  const rnd = mulberry32(fro >>> 0)
  start = { ...(bana.start || {}), ...start }
  // Kulkaos: Flipperbenen och Pyramiden är egna objekt i egna grupper
  const egnaGrupper = [...(bana.grupper || [])]
  let basObjekt = bana.objekt
  if (perk.flipper) {
    const g = egnaGrupper.length
    const iZon = (o) => {
      const [x, y] = o.form === 'cirkel' ? [o.x, o.y] : o.form === 'segment' ? [(o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2] : [o.cx, o.cy + o.R]
      // bara det som ligger i vägen när flipprarna slår upp
      const iVag = (px) => {
        const dx = Math.abs(x - px)
        const d = Math.hypot(dx, y - FLIPPER.y)
        return d < FLIPPER.L + 14 && y > FLIPPER.y - Math.sin(FLIPPER.lyft - FLIPPER.vila) * dx - 20
      }
      return !o.boss && (iVag(FLIPPER.x) || iVag(W - FLIPPER.x))
    }
    basObjekt = [
      ...basObjekt.filter((o) => !iZon(o)),
      { typ: 'tegel', form: 'segment', x1: FLIPPER.x, y1: FLIPPER.y, x2: FLIPPER.x + FLIPPER.L * Math.cos(FLIPPER.vila), y2: FLIPPER.y + FLIPPER.L * Math.sin(FLIPPER.vila), tj: 6.5, hard: true, flipper: true, grupp: g },
      { typ: 'tegel', form: 'segment', x1: W - FLIPPER.x, y1: FLIPPER.y, x2: W - FLIPPER.x - FLIPPER.L * Math.cos(FLIPPER.vila), y2: FLIPPER.y + FLIPPER.L * Math.sin(FLIPPER.vila), tj: 6.5, hard: true, flipper: true, grupp: g + 1 },
    ]
    egnaGrupper.push({ typ: 'flipper', cx: FLIPPER.x, cy: FLIPPER.y, upp: -FLIPPER.lyft }, { typ: 'flipper', cx: W - FLIPPER.x, cy: FLIPPER.y, upp: FLIPPER.lyft })
  }
  if (perk.pyramid && hinkBredd > 0) {
    // två sluttande studsväggar på hinkens kanter, som glider med hinken
    const g = egnaGrupper.length
    const b = hinkBredd / 2
    basObjekt = [
      ...basObjekt,
      { typ: 'tegel', form: 'segment', x1: W / 2 - b - 3, y1: HINK.y - 6, x2: W / 2 - b - 46, y2: HINK.y + 20, tj: 5, hard: true, kick: 380, pyramid: true, grupp: g },
      { typ: 'tegel', form: 'segment', x1: W / 2 + b + 3, y1: HINK.y - 6, x2: W / 2 + b + 46, y2: HINK.y + 20, tj: 5, hard: true, kick: 380, pyramid: true, grupp: g },
    ]
    egnaGrupper.push({ typ: 'glid', ax: W / 2 - b - 8, T: (2 * Math.PI) / HINK.fart, fas: 0 })
  }
  // Kulkaos: Snigelslem gör att allt som rör sig går hälften så fort
  const lugn = perk.snigel ? 0.5 : 1
  const grupper = egnaGrupper.map((g) => (g.typ === 'flipper' ? { ...g, c: 1, s: 0, ox: 0, oy: 0, vinkel: 0, omega: 0 } : { ...g, c: 1, s: 0, ox: 0, oy: 0, w: (g.w || 0) * lugn, T: g.T ? g.T / lugn : g.T, vx: 0, vy: 0, vinkel: 0 }))
  const objekt = basObjekt.map((o, id) => {
    const ut = { ...o, id, farg: 'bla', lit: false, borta: false, nr: 0 }
    if (o.kick) {
      ut.kickKvar = o.kickAntal || 10
      ut.kickT = -1
    }
    if (o.form === 'bage') {
      ut.span = normVinkel(o.a1 - o.a0) || TVAPI
      ut.R = o.R
    }
    return ut
  })
  let antalOrange = 0
  // Färgerna: fasta (bestämda i banan) eller slumpade. Bossen färgas aldrig.
  // Körs igen när en bossbana fylls på (aterstall).
  function farga() {
    const med = objekt.filter((o) => !o.boss && !o.hard && !o.borta)
    if (bana.fasta) {
      for (const o of med) o.farg = o.farg0 || 'bla'
      antalOrange = med.filter((o) => o.farg === 'orange').length
    } else {
      for (const o of med) o.farg = 'bla'
      // 25 orange bland de som får vara orange, två gröna bland resten
      const kandidater = med.filter((o) => !o.ejOrange)
      antalOrange = Math.min(bana.orange ?? ANTAL_ORANGE, kandidater.length)
      blanda(kandidater, rnd)
      for (let i = 0; i < antalOrange; i++) kandidater[i].farg = 'orange'
      // gröna bara där kulan når (ejOrange = inbyggd i en sluten ring)
      let ovriga = med.filter((o) => o.farg === 'bla' && !o.ejOrange)
      if (ovriga.length < 2) ovriga = med.filter((o) => o.farg === 'bla')
      blanda(ovriga, rnd)
      // gröna: helst en i övre och en i undre halvan
      const ovre = ovriga.filter((o) => (o.y ?? o.cy ?? o.y1) < 330)
      const undre = ovriga.filter((o) => (o.y ?? o.cy ?? o.y1) >= 330)
      const g1 = ovre[0] || ovriga[0]
      const g2 = undre.find((o) => o !== g1) || ovriga.find((o) => o !== g1)
      if (g1) g1.farg = 'gron'
      if (g2) g2.farg = 'gron'
      // fler gröna (en bonus i oändligt läge)
      for (const o of ovriga.filter((q) => q.farg === 'bla').slice(0, extraGrona)) o.farg = 'gron'
    }
    // roguelike: Bomber — blå pinnar som smäller när de träffas
    if (perk.bomber) {
      for (const o of med) o.bomb = false
      const bla = med.filter((o) => o.farg === 'bla' && o.form === 'cirkel' && !o.kick)
      blanda(bla, rnd)
      for (const o of bla.slice(0, 2 * perk.bomber)) o.bomb = true
    }
    // Kulkaos: guldpinnar ger guld när de träffas
    const guldpinnar = (bana.guldpinnar || 0) + 2 * (perk.guldpinnar || 0)
    if (guldpinnar) {
      for (const o of med) o.guld = false
      const bla = med.filter((o) => o.farg === 'bla' && o.form === 'cirkel' && !o.kick && !o.bomb)
      blanda(bla, rnd)
      for (const o of bla.slice(0, guldpinnar)) o.guld = true
    }
    // Kulkaos: kritpinnar (dubbla poäng och skada resten av skottet),
    // förnyare (allt borttaget kommer tillbaka) och slempinnar (tål två träffar)
    const sarskilda = [
      ['krit', (bana.kritpinnar || 0) + (perk.krit || 0)],
      ['forny', bana.fornyare || 0],
      ['slem', bana.slempinnar || 0],
    ]
    if (sarskilda.some(([, n]) => n > 0)) {
      for (const o of med) {
        o.krit = false
        o.forny = false
        o.slem = 0
      }
      const bla = med.filter((o) => o.farg === 'bla' && o.form === 'cirkel' && !o.kick && !o.bomb && !o.guld)
      blanda(bla, rnd)
      let i = 0
      for (const [namn, n] of sarskilda)
        for (let j = 0; j < n && i < bla.length; j++, i++) {
          if (namn === 'slem') bla[i].slem = 1
          else bla[i][namn] = true
        }
    }
  }
  farga()

  const spel = {
    bana,
    objekt,
    grupper,
    antalOrange,
    t: 0,
    lage: 'siktar', // siktar | skjuter | feber | klar | slut
    vinkel: Math.PI / 2,
    kulorKvar: kulor - 1, // en ligger redan i kanonen
    iKanonen: true,
    kulor: [],
    poang: 0,
    orangeTraffade: 0,
    skott: 0,
    // skottets räknare
    skottSumma: 0,
    skottBas: 0, // poängen utan Kulkaos poängfaktorer: det extrakulorna räknas på
    skottTraffar: 0,
    skottOrange: 0,
    skottTid: 0,
    extraGivna: 0,
    lista: [], // tända objekt i den ordning de träffades
    kedjeKo: [], // gröna som ska smälla strax (kedjereaktion)
    stilar: [],
    kraftNamn: bana.kraft || 'spar',
    sparKvar: start.spar || 0,
    eldKvar: start.eld || 0,
    spokKvar: start.spok || 0,
    trippelKvar: start.trippel || 0,
    hinkBredd,
    lila: null,
    feber: false,
    fack: null,
    narSista: null,
    hinkX: W / 2,
    hinkVx: 0,
    rensat: false,
    perk,
    lilor: [], // fler lila pinnar (roguelike: Lila lycka)
    guld: 0, // Kulkaos: guld som samlats på banan
    // Kulkaos: bossen (bana.boss = { hp }) tar skada efter varje skott
    bossHp: bana.boss ? bana.boss.hp : 0,
    bossMax: bana.boss ? bana.boss.hp : 0,
    bossTraffar: 0,
    bossSkold: 0, // bossattacken Skölden tar upp skada
    bossXNu: 1, // skottets bosskada (järnkulan)
    krit: false, // en kritpinne är träffad i skottet
    fornyNu: false, // en förnyare är träffad i skottet
    slosaN: 0, // Slösaren: kulor i skottet
    flipperUppe: false,
    vaska, // kulväskan: kultypen i varje skott, i tur och ordning
    kulTyp: null, // skottets kultyp
    hal: (bana.svartaHal || []).map((h) => ({ ...h, redo: true })),
  }

  function blanda(a, r) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
  }

  /* -------------------------------------------------- rörelse och världskoordinater */

  function uppdateraGrupper(t) {
    for (const g of grupper) {
      if (g.typ === 'rotera') {
        g.vinkel = (g.v0 || 0) + g.w * t
        g.omega = g.w
      } else if (g.typ === 'pendel') {
        const k = (TVAPI / g.T) * t
        g.vinkel = g.A * Math.sin(k)
        g.omega = g.A * Math.cos(k) * (TVAPI / g.T)
      } else if (g.typ === 'glid') {
        const k = (TVAPI / g.T) * t + (g.fas || 0)
        g.ox = g.ax * Math.sin(k)
        g.oy = (g.ay || 0) * Math.sin(k)
        g.vx = g.ax * Math.cos(k) * (TVAPI / g.T)
        g.vy = (g.ay || 0) * Math.cos(k) * (TVAPI / g.T)
      } else if (g.typ === 'bana') {
        const k = (TVAPI / g.T) * t + (g.fas || 0)
        g.ox = Math.cos(k) * g.R - Math.cos(g.fas || 0) * g.R
        g.oy = Math.sin(k) * g.R - Math.sin(g.fas || 0) * g.R
        g.vx = -Math.sin(k) * g.R * (TVAPI / g.T)
        g.vy = Math.cos(k) * g.R * (TVAPI / g.T)
      } else if (g.typ === 'flipper') {
        // Kulkaos: flipprarna slår upp när spelaren håller in
        const dt = Math.max(0, t - (g.tf ?? t))
        g.tf = t
        const mal = spel?.flipperUppe ? g.upp : 0
        const fore = g.vinkel || 0
        const steg = FLIPPER.fart * dt
        g.vinkel = fore + Math.max(-steg, Math.min(steg, mal - fore))
        g.omega = dt > 0 ? (g.vinkel - fore) / dt : 0
      }
      g.c = Math.cos(g.vinkel || 0)
      g.s = Math.sin(g.vinkel || 0)
    }
    for (const o of objekt) placera(o)
  }

  function placera(o) {
    const g = o.grupp != null ? grupper[o.grupp] : null
    const roterar = g && (g.typ === 'rotera' || g.typ === 'pendel' || g.typ === 'flipper')
    const ox = g && !roterar ? g.ox : 0
    const oy = g && !roterar ? g.oy : 0
    if (o.form === 'cirkel') {
      if (roterar) [o.wx, o.wy] = rotera(o.x, o.y, g.cx, g.cy, g.c, g.s)
      else {
        o.wx = o.x + ox
        o.wy = o.y + oy
      }
    } else if (o.form === 'segment') {
      if (roterar) {
        ;[o.wx1, o.wy1] = rotera(o.x1, o.y1, g.cx, g.cy, g.c, g.s)
        ;[o.wx2, o.wy2] = rotera(o.x2, o.y2, g.cx, g.cy, g.c, g.s)
      } else {
        o.wx1 = o.x1 + ox
        o.wy1 = o.y1 + oy
        o.wx2 = o.x2 + ox
        o.wy2 = o.y2 + oy
      }
    } else {
      if (roterar) {
        ;[o.wcx, o.wcy] = rotera(o.cx, o.cy, g.cx, g.cy, g.c, g.s)
        o.wa0 = o.a0 + g.vinkel
      } else {
        o.wcx = o.cx + ox
        o.wcy = o.cy + oy
        o.wa0 = o.a0
      }
    }
  }

  // Ytans hastighet i punkten (qx, qy) — rörliga pinnar knuffar kulan.
  function ytfart(o, qx, qy) {
    const g = o.grupp != null ? grupper[o.grupp] : null
    if (!g) return [0, 0]
    if (g.typ === 'rotera' || g.typ === 'pendel' || g.typ === 'flipper') return [-g.omega * (qy - g.cy), g.omega * (qx - g.cx)]
    return [g.vx, g.vy]
  }

  uppdateraGrupper(0)

  /* -------------------------------------------------------------- poäng */

  const mult = () => multFor(spel.orangeTraffade, antalOrange)
  const skottPoang = () => spel.skottSumma * spel.skottTraffar

  function valjLila() {
    for (const l of [spel.lila, ...(spel.lilor || [])]) if (l && !l.lit && !l.borta) l.farg = 'bla'
    spel.lila = null
    spel.lilor = []
    let bla = objekt.filter((o) => !o.borta && !o.lit && o.farg === 'bla' && !o.ejOrange && !o.boss && !o.hard)
    if (!bla.length) bla = objekt.filter((o) => !o.borta && !o.lit && o.farg === 'bla' && !o.boss && !o.hard)
    if (!bla.length) return
    spel.lila = bla[Math.floor(rnd() * bla.length)]
    spel.lila.farg = 'lila'
    // Lila lycka nivå 2 och uppåt: fler lila per skott
    for (let i = 1; i < (perk.lila || 0); i++) {
      const fria = bla.filter((o) => o.farg === 'bla')
      if (!fria.length) break
      const l = fria[Math.floor(rnd() * fria.length)]
      l.farg = 'lila'
      spel.lilor.push(l)
    }
  }
  valjLila()

  const orangeKvar = () => objekt.filter((o) => o.farg === 'orange' && !o.lit && !o.borta).length

  function tand(o, handelser, k, kedja = false) {
    if (o.lit || o.borta) return
    o.lit = true
    spel.lista.push(o)
    o.nr = spel.lista.length
    if (o.farg === 'orange') {
      spel.orangeTraffade++
      spel.skottOrange++
    }
    const m = mult()
    const bas = spel.feber ? FEBER_POANG[o.farg] : POANG[o.farg] * m
    // Kulkaos: kritpinnen ger dubbla poäng resten av skottet
    if (o.krit && !spel.krit) {
      spel.krit = true
      const [kx, ky] = mitt(o)
      handelser.push({ typ: 'krit', id: o.id, x: kx, y: ky })
    }
    if (o.forny && !spel.fornyNu) {
      spel.fornyNu = true
      const [fx, fy] = mitt(o)
      handelser.push({ typ: 'fornyTraff', id: o.id, x: fx, y: fy })
    }
    const sno = perk.sno ? 1 + Math.min(1, 0.012 * perk.sno * spel.skottTraffar) : 1
    const grund = bas * (spel.trippelKvar > 0 ? 3 : 1) * (1 + 0.25 * (perk.poang || 0)) * (o.farg === 'orange' ? Math.pow(2, perk.diamant || 0) : 1)
    const varde = Math.round(grund * (spel.krit ? 2 : 1) * sno * (perk.poangX || 1))
    spel.skottSumma += varde
    // kritpinnar, snöbollen och poängfaktorerna ger poäng, inte extrakulor
    spel.skottBas += Math.round(grund)
    spel.skottTraffar++
    if (spel.skottTraffar === 50 && !spel.stilar.includes('mega')) stil('mega', handelser)
    const fore = spel.extraGivna
    while (spel.extraGivna < EXTRA_KULA_VID.length && spel.skottBas * spel.skottTraffar >= EXTRA_KULA_VID[spel.extraGivna]) spel.extraGivna++
    const [mx, my] = mitt(o)
    handelser.push({ typ: 'traff', id: o.id, farg: o.farg, poang: varde, mult: m, nr: spel.skottTraffar, x: mx, y: my, skott: skottPoang(), tegel: o.typ === 'tegel' })
    for (let i = fore; i < spel.extraGivna; i++) {
      spel.kulorKvar++
      handelser.push({ typ: 'extraKula', orsak: 'poang', grans: EXTRA_KULA_VID[i] })
    }
    // stilskott: långskott (mellan två icke-blå träffar), väggstuds
    if (k) {
      if (o.farg !== 'bla' && k.senastIckeBla) {
        const d = Math.hypot(mx - k.senastIckeBla[0], my - k.senastIckeBla[1])
        if (d >= 240 && !spel.stilar.includes('superlang')) stil('superlang', handelser)
        else if (d >= 150 && !spel.stilar.includes('lang') && !spel.stilar.includes('superlang')) stil('lang', handelser)
      }
      if (o.farg !== 'bla') k.senastIckeBla = [mx, my]
      if (o.farg !== 'bla' && k.vaggFran && Math.hypot(mx - k.vaggFran[0], my - k.vaggFran[1]) > 72 && !spel.stilar.includes('vagg')) stil('vagg', handelser)
      k.vaggFran = null
      // Extreme Slide: många träffar tätt efter varandra i mjuk kontakt
      if (spel.skottTid - k.senastTraff < 0.3 && (k.mjuk || o.typ === 'tegel')) k.glid++
      else k.glid = 1
      k.senastTraff = spel.skottTid
      if (k.glid >= 12 && !spel.stilar.includes('glid')) stil('glid', handelser)
    }
    if (spel.skottOrange >= 10 && !spel.stilar.includes('orangeattack')) stil('orangeattack', handelser)
    // roguelike: Delning — första träffen i skottet delar kulan
    if (k && perk.delning && spel.skottTraffar === 1) handelser.push({ typ: 'delning', x: mx, y: my, nya: nyaKulor(o, k, perk.delning, 'dela') })
    // Lila lycka: lila pinnar ger en kula
    if (o.farg === 'lila' && perk.lila) {
      spel.kulorKvar++
      handelser.push({ typ: 'extraKula', orsak: 'lila' })
    }
    if (o.bomb) {
      small(o, perk.fyrverkeri ? 85 : 58, handelser, 'bomb')
      if (perk.fyrverkeri) nyaKulor(o, k, 1, 'stjarna')
    }
    if (perk.meteor && spel.eldNu && k && o.farg === 'orange') small(o, 42, handelser, 'meteor')
    // Kulkaos: guld, blixtar, stjärnfall och kulfabriken
    if (o.guld) {
      guld(perk.midas ? 10 : 5, mx, my, handelser)
      if (perk.midas) small(o, 48, handelser, 'guld')
    }
    if (o.farg === 'orange' && (perk.honung || perk.midas)) guld((perk.honung ? 1 : 0) + (perk.midas ? 2 : 0), mx, my, handelser)
    if (k && o.farg === 'orange' && perk.blixt) blixt(o, perk.blixt + (perk.blixtstorm ? 3 : 0), perk.blixtstorm ? 170 : 110, handelser)
    if (o.farg === 'gron' && perk.stjarnfall) {
      const or = objekt.filter((p) => p.farg === 'orange' && !p.lit && !p.borta)
      for (let i = 0; i < perk.stjarnfall && or.length; i++) blixt(o, 1, 9999, handelser, or.splice(Math.floor(rnd() * or.length), 1))
    }
    // Kulkaos: Snöbollen växer för varje träff
    if (k && perk.sno && !k.typ?.endsWith('baby') && k.r < k.r0 * (1.3 + 0.3 * perk.sno)) k.r = Math.min(k.r0 * (1.3 + 0.3 * perk.sno), k.r + KULA_R * 0.035 * perk.sno)
    if (k && perk.kulfabrik && spel.skottTraffar % Math.max(6, 14 - 2 * perk.kulfabrik) === 0) handelser.push({ typ: 'delning', x: mx, y: my, nya: nyaKulor(o, k, 1, 'stjarna') })
    // en grön som tänds av en annan grön smäll smäller lite senare, så att
    // kedjereaktionen syns som en våg
    if (o.farg === 'gron') {
      if (kedja) spel.kedjeKo.push({ t: spel.skottTid + KEDJA_DT, id: o.id })
      else kraft(o, handelser, k)
    }
    // Kulkaos: sista orange på en bossbana — Orangestormen
    if (o.farg === 'orange' && bana.boss && !spel.storm && orangeKvar() === 0) storm(handelser)
    // sista orange: Extreme Fever
    if (o.farg === 'orange' && orangeKvar() === 0 && !spel.feber && !bana.boss) {
      spel.feber = true
      spel.lage = 'feber'
      spel.narSista = null
      spel.fack = FACK_POANG.map((p) => p)
      handelser.push({ typ: 'feberStart', id: o.id, x: mx, y: my })
    }
  }

  // Kulkaos: Orangestormen. Alla orange på en bossbana är tända: varje
  // orange pinne och varje kula ute flyger som en raket rakt in i bossen.
  // Kulorna är förbrukade (inget att vänta på), och planen fylls på efter
  // skottet. Ingen Extreme Fever och ingen slow motion på bossbanor.
  function storm(handelser) {
    spel.storm = true
    const boss = objekt.find((p) => p.boss)
    const fran = objekt.filter((p) => p.farg === 'orange' && p.lit).map(mitt)
    const kulor = spel.kulor.map((k) => [k.x, k.y])
    const skada = bossSkada(3 * fran.length + 4 * kulor.length)
    spel.bossHp = Math.max(0, spel.bossHp - skada)
    spel.kulor.length = 0
    spel.narSista = null
    handelser.push({ typ: 'bossStorm', skada, hp: spel.bossHp, max: spel.bossMax, fran, kulor, till: boss ? [boss.wx, boss.wy] : [W / 2, 200] })
  }

  // Skada på bossen: Bossjägaren, Kronan, kritpinnen, järnkulan, reliker
  // och Drakhjärtat. Skölden (en bossattack) tar upp det den kan.
  function bossSkada(bas) {
    let skada = Math.round(bas * (1 + 0.2 * (perk.jagare || 0)) * Math.pow(2, perk.kronan || 0) * (spel.krit ? 2 : 1) * spel.bossXNu * (perk.bossX || 1) * (perk.drakhjarta && spel.eldNu ? 2 : 1))
    if (spel.bossSkold > 0) {
      const tar = Math.min(spel.bossSkold, skada)
      spel.bossSkold -= tar
      skada -= tar
    }
    return skada
  }

  function stil(id, handelser) {
    spel.stilar.push(id)
    spel.poang += STIL[id].poang
    handelser.push({ typ: 'stil', id, namn: STIL[id].namn, poang: STIL[id].poang })
  }

  function kraft(o, handelser, k) {
    const namn = spel.kraftNamn
    const [gx, gy] = mitt(o)
    const ut = { typ: 'kraft', kraft: namn, x: gx, y: gy }
    spel.grontSkott = (spel.grontSkott || 0) + 1
    if (spel.grontSkott === 2) stil('dubbelkraft', handelser)
    if (spel.grontSkott === 5) stil('kedja', handelser)
    // roguelike: Kulregn ger kulor ur varje grön, Storsmäll tänder runt den
    if (perk.kulregn) ut.regn = nyaKulor(o, k, 2, 'stjarna')
    if (perk.smalla && namn !== 'small') small(o, 40 + 15 * perk.smalla, handelser, 'smalla')
    if (perk.karamell && spel.grontSkott === 1) small(o, 60 + 12 * perk.karamell, handelser, 'smalla')
    if (namn === 'spar') spel.sparKvar += KRAFTER.spar.skott
    else if (namn === 'eld') spel.eldKvar += 1
    else if (namn === 'spok') spel.spokKvar = Math.max(spel.spokKvar, 1)
    else if (namn === 'multi') ut.nya = nyaKulor(o, k, bana.multi || 1, bana.multiStil)
    else if (namn === 'small') {
      ut.tanda = []
      for (const p of objekt) {
        if (p.lit || p.borta || p === o) continue
        const [qx, qy] = narmast(p, gx, gy)
        if (Math.hypot(qx - gx, qy - gy) < 62) ut.tanda.push(p.id)
      }
      handelser.push(ut)
      for (const id of ut.tanda) tand(objekt[id], handelser, null, true)
      return
    } else if (namn === 'blomma') {
      const or = objekt.filter((p) => p.farg === 'orange' && !p.lit && !p.borta)
      const n = Math.ceil(or.length / 5)
      or.sort((a, b) => Math.hypot(mitt(a)[0] - gx, mitt(a)[1] - gy) - Math.hypot(mitt(b)[0] - gx, mitt(b)[1] - gy))
      ut.tanda = or.slice(0, n).map((p) => p.id)
      handelser.push(ut)
      for (const id of ut.tanda) tand(objekt[id], handelser, null)
      return
    }
    handelser.push(ut)
  }

  /* -------------------------------------------------------------- kulor */

  // Nya kulor ur objektet o (en grön, eller en träff som delar kulan).
  // Högst bana.maxKulor (40) åt gången. stil säger var de kommer ifrån:
  //   (inget)  sprutar ut från den gröna, åt sidorna
  //   regn     faller från himlen, på slumpade ställen
  //   fontan   skjuts rakt upp ur den gröna, som en fontän
  //   stjarna  far ut åt alla håll, som popcorn
  //   dela     kulan delar sig: nya kulor rullar av åt båda sidor
  function nyaKulor(o, k, n, stil) {
    const fran = k || spel.kulor[0]
    const [gx, gy] = mitt(o)
    const tak = Math.min(bana.maxKulor || 40, 60)
    const antal = Math.min(n, tak - spel.kulor.length)
    const avst = (o.form === 'cirkel' ? o.r : o.tj) + (fran ? fran.r : KULA_R) + 2
    const a0 = stil === 'stjarna' ? rnd() * TVAPI : 0
    const nya = []
    for (let i = 0; i < antal; i++) {
      let ny = null
      if (stil === 'regn') {
        ny = nyKula(24 + rnd() * (W - 48), 70, (rnd() - 0.5) * 90, 30 + rnd() * 90)
      } else if (stil === 'fontan') {
        const v = -Math.PI / 2 + (i - (antal - 1) / 2) * 0.5 + (rnd() - 0.5) * 0.25
        const fart = 390 + rnd() * 90
        ny = nyKula(gx + Math.cos(v) * avst, gy + Math.sin(v) * avst, Math.cos(v) * fart, Math.sin(v) * fart)
      } else if (stil === 'stjarna') {
        const v = a0 + (i * TVAPI) / antal
        const fart = 280 + rnd() * 80
        ny = nyKula(gx + Math.cos(v) * avst, gy + Math.sin(v) * avst, Math.cos(v) * fart, Math.sin(v) * fart - 90)
      } else if (stil === 'dela') {
        const sida = i % 2 ? -1 : 1
        const ut = 1 + Math.floor(i / 2) * 0.5
        ny = nyKula(gx + sida * avst * 0.8, gy + 3, sida * (55 + rnd() * 30) * ut, 20 + rnd() * 30)
      } else if (fran) {
        const sida = i % 2 ? -1 : 1
        ny = nyKula(gx + 3 * sida, gy - 10, (-fran.vx * 0.9 || 120) * (i ? -0.7 : 1) + sida * i * 40, -Math.abs(fran.vy) * 0.6 - 80 - i * 30)
      }
      if (!ny) break
      spel.kulor.push(ny)
      nya.push([ny.x, ny.y])
    }
    return nya
  }

  // En smäll runt objektet o: allt inom radien tänds (gröna i kedja).
  // typ: 'bomb' (en bombpinne), 'smalla' (Storsmäll) eller 'meteor'.
  function small(o, radie, handelser, typ) {
    const [gx, gy] = mitt(o)
    const tanda = []
    for (const p of objekt) {
      if (p.lit || p.borta || p === o) continue
      const [qx, qy] = narmast(p, gx, gy)
      if (Math.hypot(qx - gx, qy - gy) < radie) tanda.push(p.id)
    }
    handelser.push({ typ: 'small', orsak: typ, x: gx, y: gy, radie, tanda })
    for (const id of tanda) tand(objekt[id], handelser, null, true)
  }

  // Kulkaos: guld (gånger guldfaktorn från uppgraderingar och reliker).
  function guld(n, x, y, handelser) {
    const g = Math.max(1, Math.round(n * (perk.guldFaktor || 1)))
    spel.guld += g
    handelser.push({ typ: 'guld', n: g, x, y })
  }

  // Kulkaos: Kedjeblixten — från o till de n närmaste otända inom radien
  // (eller till mal om de är givna).
  function blixt(o, n, radie, handelser, mal = null) {
    const [x, y] = mitt(o)
    let lista = mal
    if (!lista) {
      lista = []
      for (const p of objekt) {
        if (p.lit || p.borta || p.boss || p.hard || p === o) continue
        const [px, py] = mitt(p)
        const d = Math.hypot(px - x, py - y)
        if (d < radie) lista.push([d, p])
      }
      lista = lista.sort((a, b) => a[0] - b[0]).slice(0, n).map((q) => q[1])
    }
    if (!lista.length) return
    handelser.push({ typ: 'blixt', x, y, till: lista.map((p) => mitt(p)) })
    for (const p of lista) tand(p, handelser, null, true)
  }

  // Studsare (o.kick, som i ett flipperspel): kulan skjuts iväg med minst
  // o.kick px/s, hur långsamt den än kom. Efter o.kickAntal studsar är
  // studsaren slut och försvinner, så att skottet till slut tar slut.
  function studsare(o, k, nx, ny, qx, qy, handelser) {
    const ut = k.vx * nx + k.vy * ny
    if (ut < o.kick) {
      k.vx += (o.kick - ut) * nx
      k.vy += (o.kick - ut) * ny
    }
    k.mjuk = false
    // en studs räknas en gång även om kulan nuddar flera delsteg i rad
    if (spel.skottTid - o.kickT < 0.05) return
    o.kickT = spel.skottTid
    o.kickKvar--
    handelser.push({ typ: 'studs', id: o.id, x: qx, y: qy, kvar: o.kickKvar })
    if (o.kickKvar <= 0) {
      o.borta = true
      handelser.push({ typ: 'fast', id: o.id })
    }
  }

  let nastaKula = 1
  function nyKula(x, y, vx, vy) {
    const k = {
      id: nastaKula++,
      x,
      y,
      vx,
      vy,
      // eldbollen är stor (Meteorregn ännu större), Jättekula gör alla större
      r: KULA_R * (spel.eldNu ? (perk.meteor ? 2.6 : perk.eldstor ? 2.2 : 1.8) : 1 + 0.15 * (perk.jatte || 0)),
      senastTraff: -10,
      glid: 0,
      mjuk: false,
      senastIckeBla: null,
      vaggFran: null,
      stilla: 0,
      ankX: x,
      ankY: y,
      spokad: false,
      hinkStuds: false,
    }
    k.r0 = k.r
    return k
  }

  // Kulkaos: kultyperna i kulväskan. kt = { typ, niva }.
  //   cell        delar sig vid träff (niva + 1 generationer)
  //   agg         spricker i småkulor vid första träffen
  //   laser       träffen tänder hela raden, sedan kolumnen …
  //   jord        jordbävning: tänder allt runt träffen
  //   jarn        tung och stor, dubbel skada på bossar (mer med nivån)
  //   spoke       flyger rakt igenom allt och kommer tillbaka uppifrån
  //   fusioner: bomb, bikupa, korslaser, fantom, lonnmordare, hagel, spokagg
  function geTyp(k, kt) {
    if (!kt || !kt.typ || kt.typ === 'vanlig') return k
    const n = kt.niva || 1
    k.typ = kt.typ
    if (kt.typ === 'cell') k.dela = n
    else if (kt.typ === 'agg') k.agg = n
    else if (kt.typ === 'laser') k.laser = n
    else if (kt.typ === 'jord') {
      k.jord = n
      k.jordR = 34 + 8 * n
    } else if (kt.typ === 'jarn') {
      k.r *= 1.3
      k.tung = 1.2
      k.bossX = 1.5 + 0.5 * n
    } else if (kt.typ === 'spoke') {
      k.genom = true
      k.ater = n
    } else if (kt.typ === 'bomb') {
      k.jord = 5
      k.jordR = 62
      k.bomb = true
    } else if (kt.typ === 'bikupa') k.bikupa = 12
    else if (kt.typ === 'korslaser') {
      k.laser = 5
      k.kors = true
    } else if (kt.typ === 'fantom') {
      k.genom = true
      k.ater = 2
      k.r *= 2.2
    } else if (kt.typ === 'lonnmordare') {
      k.genom = true
      k.genomBoss = true
      k.ater = 1
      k.bossX = 2
    } else if (kt.typ === 'hagel') k.hagel = true
    else if (kt.typ === 'spokagg') {
      k.agg = 3
      k.aggSpoke = true
    }
    k.r0 = k.r
    return k
  }

  const kulTak = () => Math.min(bana.maxKulor || 40, 60)

  // En småkula (från äggsäckar, bikupor och hagel).
  function baby(x, y, vx, vy, spoke = false) {
    const b = nyKula(x, y, vx, vy)
    b.r = b.r0 = KULA_R * 0.72
    b.typ = spoke ? 'spokbaby' : 'baby'
    if (spoke) b.genom = true
    spel.kulor.push(b)
    return b
  }

  // Laserstrålen: tänder allt i raden (eller kolumnen), och träffar bossen.
  function laser(x, y, horisontell, handelser) {
    const tanda = []
    let boss = false
    for (const p of objekt) {
      if (p.lit || p.borta || p.hard) continue
      const [px, py] = mitt(p)
      const d = horisontell ? Math.abs(py - y) : Math.abs(px - x)
      if (p.boss) {
        if (d < p.r) boss = true
        continue
      }
      if (d < 12) tanda.push(p.id)
    }
    if (boss) spel.bossTraffar += 2
    handelser.push({ typ: 'laser', x, y, horisontell, boss })
    for (const id of tanda) tand(objekt[id], handelser, null, true)
  }

  // Det kultypen gör när den träffar något (o).
  function kulEffekt(k, o, handelser) {
    const t = spel.skottTid
    if (k.agg) {
      // äggsäcken spricker i småkulor
      const n = Math.max(0, Math.min(k.agg + 1 + Math.floor(rnd() * 3), kulTak() - spel.kulor.length + 1))
      const a0 = rnd() * TVAPI
      for (let i = 0; i < n; i++) {
        const v = a0 + (i * TVAPI) / n
        const f = 260 + rnd() * 80
        baby(k.x + Math.cos(v) * 4, k.y + Math.sin(v) * 4, Math.cos(v) * f, Math.sin(v) * f - 90, k.aggSpoke)
      }
      handelser.push({ typ: 'agg', x: k.x, y: k.y, n, spoke: Boolean(k.aggSpoke) })
      k.agg = 0
      k.borta = true
      return
    }
    if (t - (k.effT ?? -1) < 0.08) return
    let gjort = false
    if (k.dela > 0 && spel.kulor.length < kulTak()) {
      const c = nyKula(k.x, k.y, -k.vx * 0.9 + (rnd() - 0.5) * 80, k.vy - 40 - rnd() * 60)
      c.typ = 'cell'
      c.r = c.r0 = k.r
      c.dela = --k.dela
      c.effT = t
      spel.kulor.push(c)
      handelser.push({ typ: 'cell', x: k.x, y: k.y })
      gjort = true
    }
    if (k.laser > 0) {
      const [mx, my] = mitt(o)
      if (k.kors) {
        laser(mx, my, true, handelser)
        laser(mx, my, false, handelser)
      } else {
        laser(mx, my, !k.laserV, handelser)
        k.laserV = !k.laserV
      }
      k.laser--
      gjort = true
    }
    if (k.jord > 0) {
      small(o, k.jordR, handelser, k.bomb ? 'bomb' : 'jord')
      k.jord--
      gjort = true
    }
    if (k.bikupa > 0) {
      k.bikupaN = (k.bikupaN || 0) + 1
      if (k.bikupaN % 3 === 0 && spel.kulor.length < kulTak()) {
        const v = rnd() * TVAPI
        baby(k.x, k.y, Math.cos(v) * 240, Math.sin(v) * 240 - 100)
        k.bikupa--
        handelser.push({ typ: 'cell', x: k.x, y: k.y })
        gjort = true
      }
    }
    if (k.hagel) {
      // hagelgeväret: fem snabba järnkulor framåt
      k.hagel = false
      const v0 = Math.atan2(k.vy, k.vx)
      for (let i = 0; i < 5 && spel.kulor.length < kulTak(); i++) {
        const v = v0 + (i - 2) * 0.22
        const b = baby(k.x, k.y, Math.cos(v) * 620, Math.sin(v) * 620)
        b.r = b.r0 = KULA_R * 0.85
        b.typ = 'jarnbaby'
      }
      handelser.push({ typ: 'hagel', x: k.x, y: k.y })
      gjort = true
    }
    if (gjort) k.effT = t
  }

  function sikta(v) {
    spel.vinkel = Math.max(Math.PI * 0.035, Math.min(Math.PI * 0.965, v))
  }

  // händelser från skjut() kommer med i nästa steg()
  const handelser0 = []
  function skjut() {
    if (spel.lage !== 'siktar' || !spel.iKanonen) return false
    spel.iKanonen = false
    spel.skott++
    spel.skottSumma = 0
    spel.skottBas = 0
    spel.skottTraffar = 0
    spel.skottOrange = 0
    spel.skottTid = 0
    spel.extraGivna = 0
    spel.lista = []
    spel.kedjeKo = []
    spel.stilar = []
    spel.grontSkott = 0
    spel.hinkSkott = false
    spel.krit = false
    spel.fornyNu = false
    spel.bossXNu = 1
    for (const h of spel.hal) h.redo = true
    // Kulkaos: Glödkolet gör var femte skott till en eldboll (två Glödkol:
    // var fjärde), Drakhjärtat var tredje
    const period = perk.drakhjarta ? 3 : perk.glodkol ? Math.max(3, 6 - perk.glodkol) : 0
    const glod = period > 0 && spel.skott % period === 0
    spel.eldNu = spel.eldKvar > 0 || glod
    if (spel.eldKvar > 0 && !glod) spel.eldKvar--
    spel.spokNu = spel.spokKvar > 0
    if (spel.spokNu) spel.spokKvar--
    spel.sparNu = spel.sparKvar > 0
    if (spel.sparNu) spel.sparKvar--
    const vx = Math.cos(spel.vinkel) * FYSIK.STARTFART
    const vy = Math.sin(spel.vinkel) * FYSIK.STARTFART
    // Kulkaos: skottets kultyp ur kulväskan, i tur och ordning
    spel.kulTyp = spel.vaska?.length ? spel.vaska[(spel.skott - 1) % spel.vaska.length] : null
    const kanonKula = (v, typ = true) => {
      const k = nyKula(KANON.x + Math.cos(v) * 22, KANON.y + Math.sin(v) * 22, Math.cos(v) * FYSIK.STARTFART, Math.sin(v) * FYSIK.STARTFART)
      return typ && !spel.eldNu ? geTyp(k, spel.kulTyp) : k
    }
    spel.kulor = [kanonKula(spel.vinkel)]
    if (spel.kulor[0].bossX) spel.bossXNu = spel.kulor[0].bossX
    // Kulkaos: spegelkula (Tvilling, Spegeln) och fler kulor per skott
    const fler = []
    if (perk.tvilling || (perk.spegel && spel.skott === 1)) fler.push(Math.PI - spel.vinkel + (Math.abs(spel.vinkel - Math.PI / 2) < 0.05 ? 0.1 : 0))
    for (let i = 1; i <= (perk.flerskott || 0); i++) fler.push(spel.vinkel + (i % 2 ? 1 : -1) * 0.13 * Math.ceil(i / 2))
    for (const v of fler) spel.kulor.push(kanonKula(v))
    // Kulkaos: Slösaren skjuter alla kulor på en gång (högst 10) i en solfjäder
    spel.slosaN = 0
    if (perk.slosa && !spel.feber) {
      const n = Math.min(10, spel.kulorKvar + 1)
      for (let i = 1; i < n; i++) spel.kulor.push(kanonKula(spel.vinkel + (i % 2 ? 1 : -1) * 0.09 * Math.ceil(i / 2), false))
      spel.kulorKvar -= n - 1
      spel.slosaN = n
    }
    // Kulkaos: arkanan Molnet — var tredje skott regnar fyra kulor från himlen
    if (perk.moln && spel.skott % 3 === 0) handelser0.push({ typ: 'moln', nya: nyaKulor({ form: 'cirkel', wx: W / 2, wy: 70, r: 1 }, spel.kulor[0], 4, 'regn') })
    spel.bossTraffar = 0
    spel.lage = spel.feber ? 'feber' : 'skjuter'
    return true
  }

  // roguelike: Magneten drar kulan mot närmaste otända orange, Hinkmagneten
  // drar den mot hinken längst ner.
  let magnetMal = []
  function dras(k, dt) {
    if (perk.magnet) {
      const R = 60 + 15 * perk.magnet
      let bast = null
      let bd = R
      for (const o of magnetMal) {
        if (o.lit || o.borta) continue
        const [qx, qy] = narmast(o, k.x, k.y)
        const d = Math.hypot(qx - k.x, qy - k.y)
        if (d < bd) {
          bd = d
          bast = [qx, qy]
        }
      }
      if (bast && bd > 1) {
        const a = (300 + 150 * perk.magnet) * dt
        k.vx += ((bast[0] - k.x) / bd) * a
        k.vy += ((bast[1] - k.y) / bd) * a
      }
    }
    if (perk.hinkmagnet && k.y > 400 && !spel.feber && !spel.eldNu) {
      const dx = spel.hinkX - k.x
      k.vx += Math.sign(dx) * Math.min(Math.abs(dx) * 6, 200 * perk.hinkmagnet) * dt
    }
  }

  // En kula ett delsteg. Returnerar 'ut' om den lämnade planen nedtill.
  function flytta(k, dt, handelser, simulera) {
    if (!simulera && (perk.magnet || perk.hinkmagnet)) dras(k, dt)
    // Kulkaos: Fjäderlätt och Ugglan Klok ger lägre gravitation, järnkulan högre
    k.vy += FYSIK.G * (perk.grav || 1) * (k.tung || 1) * dt
    // Kulkaos: svarta hål drar kulorna till sig, tänder allt runt sig och
    // spottar ut kulan igen (en gång per skott och hål)
    for (const h of spel.hal) {
      const dx = h.x - k.x
      const dy = h.y - k.y
      const d = Math.hypot(dx, dy)
      if (d > HAL_R || d < 1e-6) continue
      const a = 1300 * (1 - d / HAL_R) * dt
      k.vx += (dx / d) * a
      k.vy += (dy / d) * a
      if (!simulera && d < 12 && h.redo) {
        h.redo = false
        small({ form: 'cirkel', wx: h.x, wy: h.y, r: 1 }, 66, handelser, 'hal')
        const v = -Math.PI / 2 + (rnd() - 0.5) * 1.6
        k.x = h.x + Math.cos(v) * 16
        k.y = h.y + Math.sin(v) * 16
        k.vx = Math.cos(v) * 430
        k.vy = Math.sin(v) * 430
        handelser.push({ typ: 'svartHal', x: h.x, y: h.y })
      }
    }
    k.x += k.vx * dt
    k.y += k.vy * dt
    if (k.x < k.r) {
      k.x = k.r
      k.vx = Math.abs(k.vx) * FYSIK.STUDS_VAGG
      k.vaggFran = [k.x, k.y]
    } else if (k.x > W - k.r) {
      k.x = W - k.r
      k.vx = -Math.abs(k.vx) * FYSIK.STUDS_VAGG
      k.vaggFran = [k.x, k.y]
    }
    if (k.y < k.r && k.spokad !== true) {
      k.y = k.r
      k.vy = Math.abs(k.vy) * FYSIK.STUDS_VAGG
    }
    const eld = !simulera && spel.eldNu
    let kontakt = null
    for (const o of objekt) {
      if (o.borta) continue
      // snabb grovkoll
      if (o.form === 'cirkel') {
        const dx = k.x - o.wx
        const dy = k.y - o.wy
        const rr = o.r + k.r
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue
      }
      const [qx, qy, tj] = narmast(o, k.x, k.y)
      let nx = k.x - qx
      let ny = k.y - qy
      const d = Math.hypot(nx, ny)
      const grans = tj + k.r
      if (d >= grans) continue
      if (simulera) return { traff: o, x: k.x, y: k.y }
      // ett skott som aldrig tar slut (kulan gungar i en halfpipe): det tända
      // den rör försvinner, så att den till slut ramlar ner
      if (o.lit && spel.skottTid > LANG_TID) {
        o.borta = true
        handelser.push({ typ: 'fast', id: o.id })
        continue
      }
      if (d < 1e-6) {
        nx = 0
        ny = -1
      } else {
        nx /= d
        ny /= d
      }
      if ((eld || k.genom) && !o.boss && !o.hard) {
        // eldbollen bränner igenom (och spökkulan flyger igenom): tänd utan att studsa
        tand(o, handelser, k)
        if (k.typ) kulEffekt(k, o, handelser)
        if (k.borta) return 'borta'
        continue
      }
      // Kulkaos: Lönnmördaren flyger rakt igenom bossen, och varje passage räknas tre gånger
      if (k.genomBoss && o.boss) {
        if (spel.skottTid - (k.bossT ?? -1) > 0.25) {
          k.bossT = spel.skottTid
          spel.bossTraffar += 3
          handelser.push({ typ: 'bossTraff', id: o.id, x: qx, y: qy })
        }
        continue
      }
      // Kulkaos: Genomborr — kulan går rakt igenom blå pinnar
      if (perk.genom && o.farg === 'bla' && o.form === 'cirkel' && !o.kick && !o.boss) {
        tand(o, handelser, k)
        continue
      }
      // ut ur objektet
      k.x = qx + nx * (grans + 0.02)
      k.y = qy + ny * (grans + 0.02)
      const [sx, sy] = ytfart(o, qx, qy)
      const rvx = k.vx - sx
      const rvy = k.vy - sy
      const vn = rvx * nx + rvy * ny
      if (vn < 0) {
        const studs = -vn < FYSIK.RULL_GRANS ? 0 : o.typ === 'tegel' ? FYSIK.STUDS_TEGEL : FYSIK.STUDS_PINNE
        const tx = rvx - vn * nx
        const ty = rvy - vn * ny
        const friktion = 0.997
        k.vx = tx * friktion - studs * vn * nx + sx
        k.vy = ty * friktion - studs * vn * ny + sy
        k.mjuk = -vn < 150
      }
      kontakt = o
      // Kulkaos: en slempinne tål en träff till: kulan studsar högt i stället
      if (o.slem > 0 && !o.lit) {
        const ut = k.vx * nx + k.vy * ny
        if (ut < 300) {
          k.vx += (300 - ut) * nx
          k.vy += (300 - ut) * ny
        }
        k.mjuk = false
        if (spel.skottTid - (o.slemT ?? -1) > 0.15) {
          o.slemT = spel.skottTid
          o.slem--
          spel.skottSumma += POANG.bla
          spel.skottBas += POANG.bla
          handelser.push({ typ: 'slem', id: o.id, x: qx, y: qy })
        }
        continue
      }
      if (o.boss || o.hard) {
        // Kulkaos: bossen och hårda saker (krabbans klor) tänds aldrig. Kulan
        // studsar alltid iväg ordentligt från bossen, och varje träff räknas.
        const min = o.boss ? 260 : o.kick || 0
        const ut = k.vx * nx + k.vy * ny
        if (ut < min) {
          k.vx += (min - ut) * nx
          k.vy += (min - ut) * ny
          k.mjuk = false
        }
        if (o.boss && spel.skottTid - (k.bossT ?? -1) > 0.12) {
          k.bossT = spel.skottTid
          spel.bossTraffar++
          handelser.push({ typ: 'bossTraff', id: o.id, x: qx, y: qy })
        }
        continue
      }
      tand(o, handelser, k)
      if (o.kick) studsare(o, k, nx, ny, qx, qy, handelser)
      if (k.typ) kulEffekt(k, o, handelser)
      if (k.borta) return 'borta'
    }
    // hinken: kanter studsar, öppningen fångar
    if (!simulera && spel.hinkBredd > 0 && !spel.feber && !spel.eldNu && !(spel.spokNu && !k.spokad) && !(k.ater > 0)) {
      const hy = HINK.y
      for (const sida of [-1, 1]) {
        const ex = spel.hinkX + sida * (spel.hinkBredd / 2)
        const qy = Math.max(hy, Math.min(H + 10, k.y))
        const dx = k.x - ex
        const dy = k.y - qy
        const d = Math.hypot(dx, dy)
        if (d < k.r + 4 && d > 1e-6) {
          k.x = ex + (dx / d) * (k.r + 4.02)
          k.y = qy + (dy / d) * (k.r + 4.02)
          const vn = (k.vx - spel.hinkVx) * (dx / d) + k.vy * (dy / d)
          if (vn < 0) {
            k.vx -= 1.7 * vn * (dx / d)
            k.vy -= 1.7 * vn * (dy / d)
          }
          k.hinkStuds = true
        }
      }
      if (k.y > hy + 4 && Math.abs(k.x - spel.hinkX) < spel.hinkBredd / 2 - 2) {
        spel.kulorKvar++
        // roguelike: Guldhinken ger två kulor och poäng
        if (perk.guldhink) {
          spel.kulorKvar++
          spel.poang += 25000
          handelser.push({ typ: 'guldhink', x: k.x, poang: 25000 })
        }
        spel.hinkSkott = true
        if (perk.hinkGuld) guld(perk.hinkGuld, k.x, HINK.y - 10, handelser)
        handelser.push({ typ: 'hink', kula: k.id, x: k.x })
        handelser.push({ typ: 'extraKula', orsak: 'hink' })
        if (k.hinkStuds) stil('hinkskicklig', handelser)
        return 'ut'
      }
    }
    // feberfacken
    if (!simulera && spel.feber && spel.fack) {
      const n = spel.fack.length
      for (let i = 1; i < n; i++) {
        const ex = (W / n) * i
        const qy = Math.max(FACK_TOPP, k.y)
        const dx = k.x - ex
        const dy = k.y - qy
        const d = Math.hypot(dx, dy)
        if (d < k.r + 5 && d > 1e-6) {
          k.x = ex + (dx / d) * (k.r + 5.02)
          k.y = qy + (dy / d) * (k.r + 5.02)
          const vn = k.vx * (dx / d) + k.vy * (dy / d)
          if (vn < 0) {
            k.vx -= 1.6 * vn * (dx / d)
            k.vy -= 1.6 * vn * (dy / d)
          }
        }
      }
    }
    // Kulkaos: Studsgolvet — kulan studsar upp från golvet några gånger
    if (!simulera && perk.golv && (k.golv || 0) < perk.golv && k.y > H - k.r - 2 && k.vy > 0 && !spel.feber) {
      k.y = H - k.r - 2
      k.vy = -Math.max(Math.abs(k.vy) * 0.8, 380)
      k.golv = (k.golv || 0) + 1
      handelser.push({ typ: 'golv', x: k.x })
    }
    if (k.y > H + k.r + 4) {
      // Kulkaos: spökkulan kommer tillbaka uppifrån (en gång per nivå)
      if (!simulera && k.ater > 0) {
        k.ater--
        k.spokad = true
        k.y = -k.r
        k.vy = Math.min(k.vy, 260)
        handelser.push({ typ: 'spok', kula: k.id, x: k.x })
        return null
      }
      if (!simulera && spel.spokNu && !k.spokad) {
        // spöksbollen: tillbaka uppifrån en gång
        k.spokad = true
        k.y = -k.r
        k.vy = Math.min(k.vy, 260)
        handelser.push({ typ: 'spok', kula: k.id, x: k.x })
        return null
      }
      return 'ut'
    }
    if (k.spokad && k.y > k.r) k.spokad = 'klar'
    return kontakt
  }

  function steg(dt) {
    const handelser = handelser0.splice(0)
    spel.t += dt
    uppdateraGrupper(spel.t)
    // hinken glider fram och tillbaka
    const hx = W / 2 + (W / 2 - spel.hinkBredd / 2 - 8) * Math.sin(spel.t * HINK.fart)
    spel.hinkVx = (hx - spel.hinkX) / Math.max(dt, 1e-4)
    spel.hinkX = hx
    if (spel.lage !== 'skjuter' && spel.lage !== 'feber') return handelser
    if (!spel.kulor.length && !spel.kedjeKo.length) return handelser
    spel.skottTid += dt
    if (perk.magnet) magnetMal = objekt.filter((o) => o.farg === 'orange' && !o.lit && !o.borta)
    for (let i = spel.kulor.length - 1; i >= 0; i--) {
      const k = spel.kulor[i]
      if (!k) continue // Orangestormen tog alla kulor mitt i steget
      const fart = Math.hypot(k.vx, k.vy)
      if (fart > MAXFART) {
        k.vx *= MAXFART / fart
        k.vy *= MAXFART / fart
      }
      const n = Math.max(2, Math.ceil((Math.max(fart, 1) * dt) / (k.r * 0.4)))
      const d = dt / n
      let ut = false
      let tagen = false
      for (let s = 0; s < n; s++) {
        const r = flytta(k, d, handelser, false)
        if (spel.kulor[i] !== k) {
          tagen = true
          break
        }
        if (r === 'borta') {
          // äggsäcken sprack: kulan finns inte längre
          spel.kulor.splice(i, 1)
          tagen = true
          break
        }
        if (r === 'ut') {
          ut = true
          break
        }
      }
      if (tagen) continue
      if (ut) {
        if (spel.feber && spel.fack) {
          const idx = Math.max(0, Math.min(spel.fack.length - 1, Math.floor(k.x / (W / spel.fack.length))))
          const p = spel.rensat ? 100000 : spel.fack[idx]
          spel.feberFack = (spel.feberFack || 0) + p
          handelser.push({ typ: 'fack', index: idx, poang: p, x: k.x })
        }
        spel.kulor.splice(i, 1)
        continue
      }
      // fastnad kula: ta bort det den ligger på
      if (Math.hypot(k.x - k.ankX, k.y - k.ankY) > 6) {
        k.ankX = k.x
        k.ankY = k.y
        k.stilla = 0
      } else {
        k.stilla += dt
        if (k.stilla > FAST_TID) {
          k.stilla = 0
          let bast = null
          let bd = Infinity
          for (const o of objekt) {
            if (o.borta || o.boss || o.hard) continue
            const [qx, qy, tj] = narmast(o, k.x, k.y)
            const dd = Math.hypot(qx - k.x, qy - k.y) - tj
            if (dd < bd) {
              bd = dd
              bast = o
            }
          }
          if (bast && bd < k.r + 6) {
            tand(bast, handelser, null)
            bast.borta = true
            handelser.push({ typ: 'fast', id: bast.id })
          } else {
            k.vx += (rnd() - 0.5) * 80
            k.vy -= 60
          }
        }
      }
      // på väg mot sista orange? (för zoomen; inte på bossbanor)
      if (!spel.feber && !bana.boss) sistaKoll(k, handelser)
    }
    // kedjereaktionen: smällar som väntar på sin tur
    while (spel.kedjeKo.length && spel.kedjeKo[0].t <= spel.skottTid) kraft(objekt[spel.kedjeKo.shift().id], handelser, null)
    if (spel.skottTid > SKOTT_TAK) {
      spel.kulor.length = 0
      spel.kedjeKo.length = 0
    }
    if (!spel.kulor.length && !spel.kedjeKo.length) avsluta(handelser)
    return handelser
  }

  // Zoomen: en enda orange kvar och kulan är på väg rakt mot den.
  function sistaKoll(k, handelser) {
    const kvar = objekt.filter((o) => o.farg === 'orange' && !o.lit && !o.borta)
    if (kvar.length !== 1) return
    const o = kvar[0]
    const [qx, qy, tj] = narmast(o, k.x, k.y)
    const dx = qx - k.x
    const dy = qy - k.y
    const d = Math.hypot(dx, dy)
    const narmar = k.vx * dx + k.vy * dy > 0
    if (!spel.narSista) {
      if (d > 95 || !narmar) return
      // ballistisk förutsägelse 0,4 s framåt
      let x = k.x
      let y = k.y
      let vx = k.vx
      let vy = k.vy
      for (let i = 0; i < 24; i++) {
        vy += FYSIK.G / 60
        x += vx / 60
        y += vy / 60
        const [px, py] = narmast(o, x, y)
        if (Math.hypot(px - x, py - y) < tj + k.r + 3) {
          spel.narSista = { kula: k.id, id: o.id }
          handelser.push({ typ: 'narSista', id: o.id, x: qx, y: qy, kula: k.id })
          return
        }
      }
    } else if (spel.narSista.kula === k.id && (!narmar || d > 110)) {
      spel.narSista = null
      handelser.push({ typ: 'missadeSista', id: o.id })
    }
  }

  function avsluta(handelser) {
    const sp = skottPoang()
    spel.poang += sp
    if (spel.trippelKvar > 0) spel.trippelKvar--
    // ett skott utan träffar: slant om en extra kula
    let slant = null
    if (spel.skottTraffar === 0 && !spel.feber && !spel.hinkSkott) {
      slant = Boolean(perk.lyckoslant) || rnd() < 0.5
      if (slant) spel.kulorKvar++
    }
    const lista = spel.lista.map((o) => o.id)
    for (const o of spel.lista) o.borta = true
    // Kulkaos: förnyaren — allt som är borta kommer tillbaka, som blå pinnar
    let fornyade = 0
    if (spel.fornyNu && !spel.feber) {
      for (const o of objekt) {
        if (!o.borta || o.boss || o.hard) continue
        Object.assign(o, { borta: false, lit: false, farg: 'bla', krit: false, forny: false, guld: false, bomb: false, slem: 0 })
        fornyade++
      }
    }
    // Kulkaos: stenarna (en bossattack) smulas sönder efter några skott
    for (const o of objekt)
      if (o.sten && !o.borta && --o.stenKvar <= 0) {
        o.borta = true
        handelser.push({ typ: 'fast', id: o.id })
      }
    const kvarAllt = objekt.filter((o) => !o.borta).length
    handelser.push({ typ: 'skottSlut', lista, poang: sp, traffar: spel.skottTraffar, slant })
    if (fornyade) handelser.push({ typ: 'forny', antal: fornyade })
    spel.narSista = null
    // Kulkaos: Slösaren får tillbaka hälften av kulorna efter skottet
    if (spel.slosaN > 0) {
      const tillbaka = Math.floor(spel.slosaN / 2)
      spel.kulorKvar += tillbaka
      handelser.push({ typ: 'slosa', n: tillbaka })
      spel.slosaN = 0
    }
    // Kulkaos: bossen tar skada av allt skottet tände och av varje träff
    if (bana.boss && !spel.feber) {
      const vikt = { bla: 1, orange: 2, gron: 3, lila: 5 }
      let bas = spel.bossTraffar * 4
      for (const o of spel.lista) bas += vikt[o.farg] || 1
      const skold = spel.bossSkold
      const skada = bossSkada(bas)
      spel.bossHp = Math.max(0, spel.bossHp - skada)
      handelser.push({ typ: 'bossSkada', skada, hp: spel.bossHp, max: spel.bossMax, skold: skold - spel.bossSkold })
      if (spel.bossHp <= 0) {
        spel.lage = 'klar'
        handelser.push({ typ: 'bossDod' })
        handelser.push({ typ: 'banaKlar', fack: 0, kulor: spel.kulorKvar, kulBonus: 0, poang: spel.poang })
        return
      }
      // efter Orangestormen, eller när det mesta är borta, fylls planen på
      const alla = objekt.filter((o) => !o.boss && !o.hard)
      if (spel.storm || orangeKvar() === 0 || alla.filter((o) => !o.borta).length < alla.length * 0.4) {
        spel.storm = false
        for (const o of alla) {
          o.borta = false
          o.lit = false
        }
        farga()
        spel.antalOrange = antalOrange
        handelser.push({ typ: 'aterstall' })
      }
      // bossen slår tillbaka varannat skott
      const attacker = bana.boss.attacker || []
      if (attacker.length && spel.skott % 2 === 0) bossAttack(attacker[(spel.skott / 2 - 1) % attacker.length], handelser)
    }
    // Kulkaos: Spelautomaten — ibland kostar skottet ingen kula
    if (perk.spelautomat && !spel.feber && rnd() < 0.12 * perk.spelautomat) {
      spel.kulorKvar++
      handelser.push({ typ: 'gratisKula' })
    }
    if (spel.feber) {
      if (kvarAllt === 0 && !spel.rensat) {
        spel.rensat = true
        stil('rensat', handelser)
      }
      const bonusKulor = kulBonus ? spel.kulorKvar * 10000 : 0
      spel.poang += (spel.feberFack || 0) + bonusKulor
      spel.lage = 'klar'
      handelser.push({ typ: 'banaKlar', fack: spel.feberFack || 0, kulor: spel.kulorKvar, kulBonus: bonusKulor, poang: spel.poang })
      return
    }
    if (spel.kulorKvar <= 0) {
      spel.lage = 'slut'
      handelser.push({ typ: 'slut', orangeKvar: orangeKvar() })
      return
    }
    spel.kulorKvar--
    spel.iKanonen = true
    spel.lage = 'siktar'
    valjLila()
    handelser.push({ typ: 'redo' })
  }

  // Kulkaos: bossattackerna mellan skotten.
  //   stenar  tre stenar som inte går att tända dyker upp (de smulas efter fyra skott)
  //   skold   bossen får en sköld som tar upp skada i nästa skott
  //   flytta  tre orange byter plats med tre blå
  //   slem    fem pinnar blir slempinnar
  //   hela    bossen får tillbaka lite liv
  function bossAttack(typ, handelser) {
    const boss = objekt.find((o) => o.boss)
    const fria = () => objekt.filter((o) => !o.borta && !o.lit && !o.boss && !o.hard && o.form === 'cirkel')
    const ut = { typ: 'bossAttack', attack: typ, pos: [] }
    if (typ === 'stenar') {
      for (let forsok = 0; forsok < 200 && ut.pos.length < 3; forsok++) {
        const x = 30 + rnd() * (W - 60)
        const y = 140 + rnd() * 360
        if (boss && Math.hypot(x - boss.wx, y - boss.wy) < boss.r + 40) continue
        if (objekt.some((o) => !o.borta && Math.hypot(...((q) => [q[0] - x, q[1] - y])(narmast(o, x, y))) < 22)) continue
        const sten = { typ: 'pinne', form: 'cirkel', x, y, r: 8.5, hard: true, sten: true, stenKvar: 4, id: objekt.length, farg: 'bla', lit: false, borta: false, nr: 0 }
        objekt.push(sten)
        placera(sten)
        ut.pos.push([x, y])
      }
    } else if (typ === 'skold') {
      spel.bossSkold = Math.round(spel.bossMax * 0.06)
      ut.skold = spel.bossSkold
    } else if (typ === 'flytta') {
      const or = fria().filter((o) => o.farg === 'orange')
      const bla = fria().filter((o) => o.farg === 'bla' && !o.guld && !o.krit && !o.forny && !o.bomb)
      blanda(or, rnd)
      blanda(bla, rnd)
      for (let i = 0; i < 3 && i < or.length && i < bla.length; i++) {
        or[i].farg = 'bla'
        bla[i].farg = 'orange'
        ut.pos.push([or[i].wx, or[i].wy, bla[i].wx, bla[i].wy])
      }
    } else if (typ === 'slem') {
      const lista = fria().filter((o) => !o.slem)
      blanda(lista, rnd)
      for (const o of lista.slice(0, 5)) {
        o.slem = 1
        ut.pos.push([o.wx, o.wy])
      }
    } else if (typ === 'hela') {
      const fore = spel.bossHp
      spel.bossHp = Math.min(spel.bossMax, spel.bossHp + Math.round(spel.bossMax * 0.06))
      ut.hela = spel.bossHp - fore
    }
    ut.x = boss?.wx ?? W / 2
    ut.y = boss?.wy ?? 200
    handelser.push(ut)
  }

  // Siktspåret: kulans väg från kanonen till första träffen. Superspåret
  // följer med genom två studsar.
  function siktlinje(studsar = 0, maxTid = 1.1) {
    const pts = []
    const k = nyKula(KANON.x + Math.cos(spel.vinkel) * 22, KANON.y + Math.sin(spel.vinkel) * 22, Math.cos(spel.vinkel) * FYSIK.STARTFART, Math.sin(spel.vinkel) * FYSIK.STARTFART)
    const dt = 1 / 120
    let kvar = studsar
    const tak = studsar > 0 ? maxTid * 2.4 : maxTid
    for (let t = 0; t < tak; t += dt) {
      const r = flytta(k, dt, null, true)
      if (r && r.traff) {
        pts.push([k.x, k.y, true])
        if (kvar <= 0) break
        kvar--
        // studsa på riktigt (utan att tända) och fortsätt
        const o = r.traff
        const [qx, qy, tj] = narmast(o, k.x, k.y)
        let nx = k.x - qx
        let ny = k.y - qy
        const d = Math.hypot(nx, ny) || 1
        nx /= d
        ny /= d
        k.x = qx + nx * (tj + k.r + 0.05)
        k.y = qy + ny * (tj + k.r + 0.05)
        const vn = k.vx * nx + k.vy * ny
        const e = o.typ === 'tegel' ? FYSIK.STUDS_TEGEL : FYSIK.STUDS_PINNE
        k.vx -= (1 + e) * vn * nx
        k.vy -= (1 + e) * vn * ny
        continue
      }
      if (r === 'ut' || k.y > H) break
      if (pts.length === 0 || Math.hypot(pts[pts.length - 1][0] - k.x, pts[pts.length - 1][1] - k.y) > 7) pts.push([k.x, k.y, false])
    }
    return pts
  }

  // Ögonblicksbild (för botarna som provar vinklar). Slumpen sparas inte.
  const FALT = ['t', 'lage', 'vinkel', 'kulorKvar', 'iKanonen', 'poang', 'orangeTraffade', 'skott', 'skottSumma', 'skottBas', 'skottTraffar', 'skottOrange', 'skottTid', 'extraGivna', 'kraftNamn', 'sparKvar', 'eldKvar', 'spokKvar', 'trippelKvar', 'feber', 'hinkX', 'hinkVx', 'rensat', 'eldNu', 'spokNu', 'sparNu', 'grontSkott', 'feberFack', 'hinkSkott', 'guld', 'bossHp', 'bossTraffar', 'antalOrange', 'storm', 'bossSkold', 'bossXNu', 'krit', 'fornyNu', 'slosaN', 'kulTyp']
  function spara() {
    const st = {}
    for (const f of FALT) st[f] = spel[f]
    st.n = objekt.length
    st.obj = objekt.map((o) => [o.farg, o.lit, o.borta, o.nr, o.kickKvar, o.bomb, o.guld, o.slem, o.krit, o.forny, o.stenKvar])
    st.hal = spel.hal.map((h) => h.redo)
    st.kulor = spel.kulor.map((k) => ({ ...k }))
    st.lista = spel.lista.map((o) => o.id)
    st.stilar = [...spel.stilar]
    st.lila = spel.lila ? spel.lila.id : -1
    st.lilor = spel.lilor.map((o) => o.id)
    st.fack = spel.fack ? [...spel.fack] : null
    st.narSista = spel.narSista
    st.kedjeKo = spel.kedjeKo.map((x) => ({ ...x }))
    return st
  }
  function ladda(st) {
    for (const f of FALT) spel[f] = st[f]
    objekt.length = st.n // stenar som kom till under provskottet
    st.obj.forEach(([farg, lit, borta, nr, kickKvar, bomb, guld, slem, krit, forny, stenKvar], i) => Object.assign(objekt[i], { farg, lit, borta, nr, kickKvar, bomb, guld, slem, krit, forny, stenKvar }))
    spel.hal.forEach((h, i) => (h.redo = st.hal[i]))
    antalOrange = spel.antalOrange
    spel.kulor = st.kulor.map((k) => ({ ...k }))
    spel.lista = st.lista.map((id) => objekt[id])
    spel.stilar = [...st.stilar]
    spel.lila = st.lila >= 0 ? objekt[st.lila] : null
    spel.lilor = (st.lilor || []).map((id) => objekt[id])
    spel.fack = st.fack ? [...st.fack] : null
    spel.narSista = st.narSista
    spel.kedjeKo = (st.kedjeKo || []).map((x) => ({ ...x }))
    uppdateraGrupper(spel.t)
  }

  // Fortsätt efter slut på kulor (köpt med mynt): n nya kulor, en i kanonen.
  function fortsatt(n = 3) {
    if (spel.lage !== 'slut') return false
    spel.kulorKvar = n - 1
    spel.iKanonen = true
    spel.lage = 'siktar'
    valjLila()
    return true
  }

  // Kulkaos: håll in för att slå upp flipprarna
  const flippa = (pa) => {
    spel.flipperUppe = Boolean(pa)
  }

  return Object.assign(spel, { sikta, skjut, steg, siktlinje, orangeKvar, mult, skottPoang, spara, ladda, fortsatt, flippa })
}

// Spelar ett helt skott med fast tidssteg och returnerar händelserna.
export function spelaSkott(s, vinkel, dt = 1 / 60) {
  s.sikta(vinkel)
  if (!s.skjut()) return []
  const ut = []
  for (let i = 0; i < 60 * 45 && (s.lage === 'skjuter' || s.lage === 'feber'); i++) ut.push(...s.steg(dt))
  return ut
}

// Kulkaos: Zenskottet. Provar n vinklar runt spelarens (±bredd) och väljer
// den som tänder mest, men byter bara om det är tydligt bättre. Provskotten
// är högst maxTid sekunder, så att det går fort.
export function zenVinkel(s, vinkel, { bredd = 0.04, n = 7, maxTid = 7 } = {}) {
  const st = s.spara()
  const varde = (v) => {
    s.sikta(v)
    if (!s.skjut()) return -Infinity
    let p = 0
    for (let i = 0; i < 60 * maxTid && (s.lage === 'skjuter' || s.lage === 'feber'); i++)
      for (const e of s.steg(1 / 60)) {
        if (e.typ === 'traff') p += e.farg === 'orange' ? 12 : e.farg === 'gron' ? 6 : e.farg === 'lila' ? 4 : 1
        if (e.typ === 'feberStart' || e.typ === 'bossStorm') p += 200
      }
    s.ladda(st)
    return p
  }
  const egen = varde(vinkel)
  let bast = vinkel
  let bastV = egen
  for (let i = 0; i < n; i++) {
    const v = vinkel - bredd + (2 * bredd * i) / (n - 1)
    const p = varde(v)
    if (p > bastV) {
      bastV = p
      bast = v
    }
  }
  s.sikta(vinkel)
  return bastV > egen * 1.15 + 2 ? bast : vinkel
}

// En bot som provar många vinklar (med ögonblicksbilder) och väljer den
// som tänder flest orange — ungefär som en duktig spelare som siktar.
// Används för att kolla att banorna går och för stjärngränserna.
export function botSkott(s, { vinklar = 36, rnd = Math.random } = {}) {
  const st = s.spara()
  let bast = Math.PI / 2
  let bastV = -Infinity
  for (let i = 0; i < vinklar; i++) {
    const v = Math.PI * 0.05 + (Math.PI * 0.9 * (i + rnd() * 0.8)) / vinklar
    const h = spelaSkott(s, v)
    let varde = 0
    for (const e of h) {
      if (e.typ === 'traff') varde += e.farg === 'orange' ? 12 : e.farg === 'gron' ? 6 : e.farg === 'lila' ? 4 : 1
      if (e.typ === 'extraKula') varde += 10
      if (e.typ === 'banaKlar') varde += 1000
    }
    varde += s.poang / 20000
    if (varde > bastV) {
      bastV = varde
      bast = v
    }
    s.ladda(st)
  }
  return bast
}
