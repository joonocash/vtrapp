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

export const HINK = { bredd: 56, hojd: 20, y: H - 22, fart: (2 * Math.PI) / 6.5 }
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

// bana: { namn, objekt: [...], grupper: [...], orange?: antal }
// objekt: { typ: 'pinne'|'tegel', form: 'cirkel'|'segment'|'bage', x, y, r | x1,y1,x2,y2 | cx,cy,R,a0,a1, grupp?, ejOrange? }
// grupp: { typ: 'rotera', cx, cy, w } | { typ: 'pendel', cx, cy, A, T } | { typ: 'glid', ax, ay, T, fas } | { typ: 'bana', R, T, fas }
export function skapaSpel(bana, { fro = 1, kulor = STARTKULOR } = {}) {
  const rnd = mulberry32(fro >>> 0)
  const grupper = (bana.grupper || []).map((g) => ({ ...g, c: 1, s: 0, ox: 0, oy: 0, w: g.w || 0, vx: 0, vy: 0, vinkel: 0 }))
  const objekt = bana.objekt.map((o, id) => {
    const ut = { ...o, id, farg: 'bla', lit: false, borta: false, nr: 0 }
    if (o.form === 'bage') {
      ut.span = normVinkel(o.a1 - o.a0) || TVAPI
      ut.R = o.R
    }
    return ut
  })
  // 25 orange bland de som får vara orange, två gröna bland resten
  const kandidater = objekt.filter((o) => !o.ejOrange)
  const antalOrange = Math.min(bana.orange ?? ANTAL_ORANGE, kandidater.length)
  blanda(kandidater, rnd)
  for (let i = 0; i < antalOrange; i++) kandidater[i].farg = 'orange'
  // gröna bara där kulan når (ejOrange = inbyggd i en sluten ring)
  let ovriga = objekt.filter((o) => o.farg === 'bla' && !o.ejOrange)
  if (ovriga.length < 2) ovriga = objekt.filter((o) => o.farg === 'bla')
  blanda(ovriga, rnd)
  // gröna: helst en i övre och en i undre halvan
  const ovre = ovriga.filter((o) => (o.y ?? o.cy ?? o.y1) < 330)
  const undre = ovriga.filter((o) => (o.y ?? o.cy ?? o.y1) >= 330)
  const g1 = ovre[0] || ovriga[0]
  const g2 = undre.find((o) => o !== g1) || ovriga.find((o) => o !== g1)
  if (g1) g1.farg = 'gron'
  if (g2) g2.farg = 'gron'

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
    skottTraffar: 0,
    skottOrange: 0,
    skottTid: 0,
    extraGivna: 0,
    lista: [], // tända objekt i den ordning de träffades
    stilar: [],
    kraftNamn: bana.kraft || 'spar',
    sparKvar: 0,
    eldKvar: 0,
    spokKvar: 0,
    trippelKvar: 0,
    lila: null,
    feber: false,
    fack: null,
    narSista: null,
    hinkX: W / 2,
    hinkVx: 0,
    rensat: false,
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
      }
      g.c = Math.cos(g.vinkel || 0)
      g.s = Math.sin(g.vinkel || 0)
    }
    for (const o of objekt) placera(o)
  }

  function placera(o) {
    const g = o.grupp != null ? grupper[o.grupp] : null
    const roterar = g && (g.typ === 'rotera' || g.typ === 'pendel')
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
    if (g.typ === 'rotera' || g.typ === 'pendel') return [-g.omega * (qy - g.cy), g.omega * (qx - g.cx)]
    return [g.vx, g.vy]
  }

  uppdateraGrupper(0)

  /* -------------------------------------------------------------- poäng */

  const mult = () => multFor(spel.orangeTraffade, antalOrange)
  const skottPoang = () => spel.skottSumma * spel.skottTraffar

  function valjLila() {
    if (spel.lila && !spel.lila.lit && !spel.lila.borta) spel.lila.farg = 'bla'
    spel.lila = null
    let bla = objekt.filter((o) => !o.borta && !o.lit && o.farg === 'bla' && !o.ejOrange)
    if (!bla.length) bla = objekt.filter((o) => !o.borta && !o.lit && o.farg === 'bla')
    if (!bla.length) return
    spel.lila = bla[Math.floor(rnd() * bla.length)]
    spel.lila.farg = 'lila'
  }
  valjLila()

  const orangeKvar = () => objekt.filter((o) => o.farg === 'orange' && !o.lit && !o.borta).length

  function tand(o, handelser, k) {
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
    const varde = bas * (spel.trippelKvar > 0 ? 3 : 1)
    spel.skottSumma += varde
    spel.skottTraffar++
    const fore = spel.extraGivna
    while (spel.extraGivna < EXTRA_KULA_VID.length && skottPoang() >= EXTRA_KULA_VID[spel.extraGivna]) spel.extraGivna++
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
    if (o.farg === 'gron') kraft(o, handelser, k)
    // sista orange: Extreme Fever
    if (o.farg === 'orange' && orangeKvar() === 0 && !spel.feber) {
      spel.feber = true
      spel.lage = 'feber'
      spel.narSista = null
      spel.fack = FACK_POANG.map((p) => p)
      handelser.push({ typ: 'feberStart', id: o.id, x: mx, y: my })
    }
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
    if (namn === 'spar') spel.sparKvar += KRAFTER.spar.skott
    else if (namn === 'eld') spel.eldKvar += 1
    else if (namn === 'spok') spel.spokKvar = 1
    else if (namn === 'multi') {
      const fran = k || spel.kulor[0]
      if (fran) {
        const ny = nyKula(gx + 3, gy - 10, -fran.vx * 0.9 || 120, -Math.abs(fran.vy) * 0.6 - 80)
        spel.kulor.push(ny)
        ut.nyKula = ny.id
      }
    } else if (namn === 'small') {
      ut.tanda = []
      for (const p of objekt) {
        if (p.lit || p.borta || p === o) continue
        const [qx, qy] = narmast(p, gx, gy)
        if (Math.hypot(qx - gx, qy - gy) < 62) ut.tanda.push(p.id)
      }
      handelser.push(ut)
      for (const id of ut.tanda) tand(objekt[id], handelser, null)
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

  let nastaKula = 1
  function nyKula(x, y, vx, vy) {
    return {
      id: nastaKula++,
      x,
      y,
      vx,
      vy,
      r: spel.eldNu ? KULA_R * 1.35 : KULA_R,
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
  }

  function sikta(v) {
    spel.vinkel = Math.max(Math.PI * 0.035, Math.min(Math.PI * 0.965, v))
  }

  function skjut() {
    if (spel.lage !== 'siktar' || !spel.iKanonen) return false
    spel.iKanonen = false
    spel.skott++
    spel.skottSumma = 0
    spel.skottTraffar = 0
    spel.skottOrange = 0
    spel.skottTid = 0
    spel.extraGivna = 0
    spel.lista = []
    spel.stilar = []
    spel.grontSkott = 0
    spel.hinkSkott = false
    spel.eldNu = spel.eldKvar > 0
    if (spel.eldNu) spel.eldKvar--
    spel.spokNu = spel.spokKvar > 0
    spel.spokKvar = 0
    spel.sparNu = spel.sparKvar > 0
    if (spel.sparNu) spel.sparKvar--
    const vx = Math.cos(spel.vinkel) * FYSIK.STARTFART
    const vy = Math.sin(spel.vinkel) * FYSIK.STARTFART
    spel.kulor = [nyKula(KANON.x + Math.cos(spel.vinkel) * 22, KANON.y + Math.sin(spel.vinkel) * 22, vx, vy)]
    spel.lage = spel.feber ? 'feber' : 'skjuter'
    return true
  }

  // En kula ett delsteg. Returnerar 'ut' om den lämnade planen nedtill.
  function flytta(k, dt, handelser, simulera) {
    k.vy += FYSIK.G * dt
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
      if (d < 1e-6) {
        nx = 0
        ny = -1
      } else {
        nx /= d
        ny /= d
      }
      if (eld) {
        // eldbollen bränner igenom: tänd utan att studsa
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
      tand(o, handelser, k)
    }
    // hinken: kanter studsar, öppningen fångar
    if (!simulera && !spel.feber && !spel.eldNu && !(spel.spokNu && !k.spokad)) {
      const hy = HINK.y
      for (const sida of [-1, 1]) {
        const ex = spel.hinkX + sida * (HINK.bredd / 2)
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
      if (k.y > hy + 4 && Math.abs(k.x - spel.hinkX) < HINK.bredd / 2 - 2) {
        spel.kulorKvar++
        spel.hinkSkott = true
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
    if (k.y > H + k.r + 4) {
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
    const handelser = []
    spel.t += dt
    uppdateraGrupper(spel.t)
    // hinken glider fram och tillbaka
    const hx = W / 2 + (W / 2 - HINK.bredd / 2 - 8) * Math.sin(spel.t * HINK.fart)
    spel.hinkVx = (hx - spel.hinkX) / Math.max(dt, 1e-4)
    spel.hinkX = hx
    if (spel.lage !== 'skjuter' && spel.lage !== 'feber') return handelser
    if (!spel.kulor.length) return handelser
    spel.skottTid += dt
    for (let i = spel.kulor.length - 1; i >= 0; i--) {
      const k = spel.kulor[i]
      const fart = Math.hypot(k.vx, k.vy)
      if (fart > MAXFART) {
        k.vx *= MAXFART / fart
        k.vy *= MAXFART / fart
      }
      const n = Math.max(2, Math.ceil((Math.max(fart, 1) * dt) / (k.r * 0.4)))
      const d = dt / n
      let ut = false
      for (let s = 0; s < n; s++) {
        const r = flytta(k, d, handelser, false)
        if (r === 'ut') {
          ut = true
          break
        }
      }
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
            if (o.borta) continue
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
      // på väg mot sista orange? (för zoomen)
      if (!spel.feber) sistaKoll(k, handelser)
    }
    if (spel.skottTid > SKOTT_TAK) spel.kulor.length = 0
    if (!spel.kulor.length) avsluta(handelser)
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
      slant = rnd() < 0.5
      if (slant) spel.kulorKvar++
    }
    const lista = spel.lista.map((o) => o.id)
    for (const o of spel.lista) o.borta = true
    const kvarAllt = objekt.filter((o) => !o.borta).length
    handelser.push({ typ: 'skottSlut', lista, poang: sp, traffar: spel.skottTraffar, slant })
    spel.narSista = null
    if (spel.feber) {
      if (kvarAllt === 0 && !spel.rensat) {
        spel.rensat = true
        stil('rensat', handelser)
      }
      const bonusKulor = spel.kulorKvar * 10000
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
  const FALT = ['t', 'lage', 'vinkel', 'kulorKvar', 'iKanonen', 'poang', 'orangeTraffade', 'skott', 'skottSumma', 'skottTraffar', 'skottOrange', 'skottTid', 'extraGivna', 'kraftNamn', 'sparKvar', 'eldKvar', 'spokKvar', 'trippelKvar', 'feber', 'hinkX', 'hinkVx', 'rensat', 'eldNu', 'spokNu', 'sparNu', 'grontSkott', 'feberFack', 'hinkSkott']
  function spara() {
    const st = {}
    for (const f of FALT) st[f] = spel[f]
    st.obj = objekt.map((o) => [o.farg, o.lit, o.borta, o.nr])
    st.kulor = spel.kulor.map((k) => ({ ...k }))
    st.lista = spel.lista.map((o) => o.id)
    st.stilar = [...spel.stilar]
    st.lila = spel.lila ? spel.lila.id : -1
    st.fack = spel.fack ? [...spel.fack] : null
    st.narSista = spel.narSista
    return st
  }
  function ladda(st) {
    for (const f of FALT) spel[f] = st[f]
    st.obj.forEach(([farg, lit, borta, nr], i) => Object.assign(objekt[i], { farg, lit, borta, nr }))
    spel.kulor = st.kulor.map((k) => ({ ...k }))
    spel.lista = st.lista.map((id) => objekt[id])
    spel.stilar = [...st.stilar]
    spel.lila = st.lila >= 0 ? objekt[st.lila] : null
    spel.fack = st.fack ? [...st.fack] : null
    spel.narSista = st.narSista
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

  return Object.assign(spel, { sikta, skjut, steg, siktlinje, orangeKvar, mult, skottPoang, spara, ladda, fortsatt })
}

// Spelar ett helt skott med fast tidssteg och returnerar händelserna.
export function spelaSkott(s, vinkel, dt = 1 / 60) {
  s.sikta(vinkel)
  if (!s.skjut()) return []
  const ut = []
  for (let i = 0; i < 60 * 45 && (s.lage === 'skjuter' || s.lage === 'feber'); i++) ut.push(...s.steg(dt))
  return ut
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
