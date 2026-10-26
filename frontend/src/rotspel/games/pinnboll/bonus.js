// Pinnbollen — bonusbanorna. Ingen DOM.
//
// Banor gjorda för att smälla: sikta i tratten så tar kulbanan, spiralen
// eller kedjereaktionen hand om resten, och nästan allt tänds i ett enda
// skott. Färgerna är bestämda (fasta), så de orange ligger längs vägen.
// Varje bonusbana finns i varianter (speglad, andra pinnar), så att oändligt
// läge kan bjuda på en ny var femte bana.

import { P, ring, linje, gitter, sinus, spiralJamn, tegelLinje, tegelBage, spegla, stada, nabara, iGrupp } from './former.js'
import { W } from './motor.js'
import { mulberry32 } from '../delat/rng.js'

const f = (farg, lista) => lista.map((o) => ({ ...o, farg0: farg }))

// Mittpunkten på en pinne, ett tegel eller en båge.
const mid = (o) => (o.form === 'cirkel' ? [o.x, o.y] : o.form === 'segment' ? [(o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2] : [o.cx + Math.cos((o.a0 + o.a1) / 2) * o.R, o.cy + Math.sin((o.a0 + o.a1) / 2) * o.R])

// Färgar en kulregnsbana: gron gröna utspridda över banan (helst aldrig två
// närmare än minAvst), sedan var orange:te av resten orange. Det som redan
// har en färg (farg0) behåller den. far(o) säger var gröna får sitta och
// orangeFar(o) var orange får sitta.
function farga(lista, r, { gron, orange = 4, minAvst = 36, far = () => true, orangeFar = () => true }) {
  const pts = lista.map(mid)
  const d = (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
  const fria = lista.map((_, i) => i).filter((i) => lista[i].farg0 == null && far(lista[i], pts[i]))
  for (let i = fria.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[fria[i], fria[j]] = [fria[j], fria[i]]
  }
  const valda = lista.map((o, i) => i).filter((i) => lista[i].farg0 === 'gron')
  const borjan = valda.length
  for (const avst of [minAvst, minAvst * 0.7, 0])
    for (const i of fria) {
      if (valda.length - borjan >= gron) break
      if (!valda.includes(i) && valda.every((j) => d(i, j) >= avst)) valda.push(i)
    }
  const g = new Set(valda)
  let k = 0
  return lista.map((o, i) => {
    if (o.farg0) return o
    if (g.has(i)) return { ...o, farg0: 'gron' }
    if (!orangeFar(o, pts[i])) return { ...o, farg0: 'bla' }
    k++
    return { ...o, farg0: k % orange === 0 ? 'orange' : 'bla' }
  })
}

// Avstånd från en punkt till en sträcka.
function tillStracka(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1
  const vy = y2 - y1
  const k = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy || 1)))
  return Math.hypot(px - x1 - vx * k, py - y1 - vy * k)
}

// Pinnar längs en kurva med jämnt avstånd (kurva(t) för t i 0..1).
function langs(kurva, avst, o = {}) {
  const ut = []
  let [px, py] = kurva(0)
  ut.push(P(px, py, o))
  let kvar = 0
  for (let i = 1; i <= 2000; i++) {
    const [x, y] = kurva(i / 2000)
    kvar += Math.hypot(x - px, y - py)
    ;[px, py] = [x, y]
    if (kvar >= avst) {
      kvar = 0
      ut.push(P(x, y, o))
    }
  }
  return ut
}

// Var n:te i listan får färgen (de andra behålls).
const varannan = (lista, n, farg, start = 0) => lista.map((o, i) => (i % n === start ? { ...o, farg0: farg } : o))

// Stubin: väljer gröna rymdsmällar i en mängd pinnar så att varje pinne
// ligger inom smällens räckvidd från en grön och de gröna når varandra —
// en enda grön smäll tänder då allt, som en våg som börjar där kulan slår i.
function stubin(lista, { start = [180, 300], rackvidd = 56, lank = 58, orange = 0.22 } = {}) {
  const pts = lista.map(mid)
  const n = lista.length
  const d = (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
  const fran = (i) => Math.hypot(pts[i][0] - start[0], pts[i][1] - start[1])
  // börja närmast startpunkten, lägg sedan till den gröna (inom länkavstånd
  // från en grön) som täcker flest otända — tills allt är täckt
  const gron = [lista.map((_, i) => i).reduce((a, b) => (fran(b) < fran(a) ? b : a))]
  const tackt = new Set()
  const tack = (g) => {
    for (let j = 0; j < n; j++) if (d(g, j) <= rackvidd) tackt.add(j)
  }
  tack(gron[0])
  while (tackt.size < n) {
    let bast = -1
    let bastV = 0
    for (let i = 0; i < n; i++) {
      if (gron.includes(i) || !gron.some((g) => d(g, i) <= lank)) continue
      let v = 0
      for (let j = 0; j < n; j++) if (!tackt.has(j) && d(i, j) <= rackvidd) v++
      if (v > bastV || (v === bastV && v > 0 && fran(i) < fran(bast))) {
        bastV = v
        bast = i
      }
    }
    // en ö som stubinen inte når: närmaste otända blir en egen grön
    if (bast < 0) bast = lista.map((_, i) => i).filter((i) => !tackt.has(i)).reduce((a, b) => (fran(b) < fran(a) ? b : a))
    gron.push(bast)
    tack(bast)
  }
  // binder ihop öar: en pinne som når båda blir grön
  for (let varv = 0; varv < 20; varv++) {
    const komp = new Map()
    let nr = 0
    for (const g of gron) {
      if (komp.has(g)) continue
      const ko = [g]
      komp.set(g, nr)
      while (ko.length) {
        const x = ko.pop()
        for (const y of gron) if (!komp.has(y) && d(x, y) <= lank) komp.set(y, nr), ko.push(y)
      }
      nr++
    }
    if (nr <= 1) break
    let bast = -1
    let bastD = Infinity
    for (let i = 0; i < n; i++) {
      if (gron.includes(i)) continue
      const nar = new Set(gron.filter((g) => d(g, i) <= lank).map((g) => komp.get(g)))
      if (nar.size < 2) continue
      if (fran(i) < bastD) {
        bastD = fran(i)
        bast = i
      }
    }
    if (bast < 0) break
    gron.push(bast)
  }
  const arGron = new Set(gron)
  const steg = Math.round(1 / orange)
  let k = 0
  return lista.map((o, i) => {
    if (arGron.has(i)) return { ...o, farg0: 'gron' }
    k++
    return { ...o, farg0: k % steg === 0 ? 'orange' : 'bla' }
  })
}

function bonus(id, namn, text, kraft, objekt, extra = {}) {
  const st = stada(objekt)
  const nas = nabara(st)
  return { id, namn, text, kraft, bonus: true, fasta: true, objekt: st.map((o, i) => (nas.has(i) ? o : { ...o, ejOrange: true })), grupper: [], ...extra }
}

// Tratten högst upp: två tegellinjer som leder kulan till mitten.
// Den går ända ut till väggarna så att ingen kula smiter förbi.
const tratt = (y = 100, oppning = 22, djup = 52) => [...tegelLinje(2, y, 180 - oppning / 2 - 5, y + djup, 7), ...tegelLinje(W - 2, y, 180 + oppning / 2 + 5, y + djup, 7)]

/* ---------------------------------------------------------------- banorna */

const MALLAR = {
  // Kulbanan: fyra ramper i sicksack. Kulan rullar längs teglet (allt tänds)
  // och gröna rymdsmällar tänder pinnarna ovanför varje ramp.
  kulbanan() {
    // ramperna: [x0, y0, x1, y1]; kulan faller av i änden och landar på nästa
    const ramper = [
      [190, 200, 28, 240],
      [6, 292, 330, 336],
      [354, 386, 30, 430],
      [6, 482, 300, 528],
    ]
    const obj = tratt(100, 24).map((o, i) => ({ ...o, farg0: (i % 7) % 2 === 0 ? 'gron' : 'bla' }))
    ramper.forEach(([x0, y0, x1, y1], i) => {
      const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 18)
      // var tredje tegel är en grön smäll: när kulan rör en brinner banan av
      // som en stubintråd, ramp för ramp
      const t = tegelLinje(x0, y0, x1, y1, n).map((o, k) => ({ ...o, farg0: k % 3 === 1 ? 'gron' : (k + i) % 3 === 0 ? 'orange' : 'bla' }))
      obj.push(...t)
    })
    // gröna pinnar där kulan faller mellan ramperna, så att stubinen hoppar vidare
    obj.push(...f('gron', [P(16, 266), P(344, 361), P(16, 457)]))
    return obj
  },

  // Kedjereaktionen: en måltavla av ringar. En grön smäll var som helst och
  // vågen sprider sig ring för ring över hela tavlan.
  kedjan(r) {
    const obj = [P(180, 330)]
    for (const [R, n] of [[34, 7], [70, 13], [106, 19], [142, 26]]) {
      const a0 = r() * 360
      obj.push(...ring(180, 330, R, n, a0, a0 + 360))
    }
    obj.push(...linje(40, 140, 320, 140, 9), ...linje(40, 520, 320, 520, 9))
    return stubin(obj, { start: [180, 330], rackvidd: 54 })
  },

  // Spiralen: tratten skickar kulan in i en snäcka av pinnar, och stubinen
  // brinner längs spiralen in mot mitten.
  spiralen() {
    const spir = [...spiralJamn(180, 338, 150, 24, 1.75, 23, -90), P(180, 338)]
    return stubin([...tratt(96, 30), ...spir], { start: [180, 150], rackvidd: 52 })
  },

  // Kulregnet: varje grön pinne ger en kula till, och de nya kulorna
  // träffar fler gröna — till slut regnar det kulor över hela planen.
  kulregnet(r) {
    const obj = gitter(30, 196, 10, 9, 33.3, 33)
    const gron = new Set()
    while (gron.size < 14) gron.add(Math.floor(r() * 47)) // de gröna sitter högt upp
    return [
      ...obj.map((o, i) => ({ ...o, farg0: gron.has(i) ? 'gron' : i % 5 === 2 && i > 18 ? 'orange' : 'bla' })),
      ...f('bla', [...tegelLinje(4, 478, 120, 506, 4), ...tegelLinje(356, 478, 240, 506, 4)]),
    ]
  },

  // Eldsolen: första kulan är en eldboll som bränner rakt igenom solen, och
  // varje grön den bränner smäller och tänder grannarna.
  eldsolen(r) {
    const obj = [...ring(180, 330, 22, 6)]
    const vrid = r() * 30
    for (let a = 0; a < 360; a += 30) for (const R of [52, 78, 104, 130, 156]) {
      const v = ((a + vrid + (R > 100 ? 6 : 0)) * Math.PI) / 180
      obj.push(P(180 + Math.cos(v) * R, 330 + Math.sin(v) * R * 0.92))
    }
    return stubin(obj, { start: [180, 330], rackvidd: 46 })
  },

  // Skateparken: kulan glider fram och tillbaka i två stora halfpipes och
  // stubinen brinner längs kanterna.
  skateparken() {
    const obj = [...tegelBage(180, 250, 150, 15, 165, 18), ...tegelBage(180, 420, 120, 20, 160, 16), ...ring(180, 250, 104, 13, 25, 155), ...ring(180, 420, 76, 9, 30, 150), P(80, 408), P(280, 408), P(180, 438)]
    return stubin(obj, { start: [180, 400], rackvidd: 38 })
  },

  /* ---------------------------------------- kulregn: massor av kulor */

  // Skyfallet: moln högst upp och paraplyer under. Varje grön får det att
  // regna nya kulor från himlen, som träffar fler gröna i molnen.
  skyfallet(r) {
    const moln = []
    for (const [cx, cy] of [[72, 152], [180, 128], [288, 152]]) {
      const m = [...linje(cx - 36, cy + 8, cx + 36, cy + 8, 5), ...linje(cx - 27, cy - 9, cx + 27, cy - 9, 4), ...linje(cx - 9, cy - 26, cx + 9, cy - 26, 2)]
      m[1].farg0 = 'gron'
      m[6].farg0 = 'gron'
      moln.push(...m)
    }
    const paraply = [[70, 296], [180, 296], [290, 296], [125, 412], [235, 412]]
    const tak = []
    for (const [cx, cy] of paraply) tak.push(...tegelBage(cx, cy, 34, 200, 340, 3), ...tegelLinje(cx, cy - 27, cx, cy + 6, 1))
    const droppar = gitter(26, 200, 9, 10, 38.5, 34).filter((o) => o.y > 186 && paraply.every(([cx, cy]) => Math.hypot(o.x - cx, o.y - cy + 8) > 52))
    return farga([...moln, ...f('bla', tak), ...droppar], r, { gron: 14, minAvst: 44 })
  },

  // Fontänen: vattenbågar av pinnar. En grön sprutar kulor rakt upp, och de
  // regnar ner över bågarna ovanför.
  fontanen(r) {
    const obj = []
    for (const [R, s] of [[110, 80], [165, 82], [220, 48], [275, 36], [330, 29]]) {
      const n = Math.round(((2 * s * Math.PI) / 180) * R / 30) + 1
      obj.push(...ring(180, 560, R, n, 270 - s, 270 + s))
    }
    obj.push(...gitter(40, 128, 8, 3, 40, 34).filter((o) => o.y < 200))
    return farga(obj, r, { gron: 18, minAvst: 40 })
  },

  // Popcornen: en gryta full av majskorn. Gröna poppar kulor åt alla håll,
  // och de studsar runt mellan grytans väggar.
  popcornen(r) {
    // grytans kant lutar in från väggarna, så att allt som studsar ut rullar tillbaka
    const gryta = [...tegelLinje(52, 300, 74, 522, 6), ...tegelLinje(308, 300, 286, 522, 6), ...tegelLinje(2, 262, 52, 300, 2), ...tegelLinje(358, 262, 308, 300, 2)]
    const korn = gitter(100, 330, 7, 7, 27, 28)
    const botten = linje(100, 534, 260, 534, 6)
    const anga = [...sinus(80, 280, 236, 12, 1.5, 9), ...sinus(60, 300, 176, 14, 1.5, 10, Math.PI)]
    const korn2 = farga([...korn, ...botten], r, { gron: 14, minAvst: 34, orange: 3 })
    return [...f('bla', gryta), ...korn2, ...farga(anga, r, { gron: 3, minAvst: 60, orange: 6 })]
  },

  // Flipperspelet: stora studsare som skjuter iväg kulorna, och slangbellor
  // längst ner. Gröna studsare ger nya kulor mitt i flipprandet.
  flipperspelet(r) {
    const stor = (x, y, farg) => P(x, y, { r: 13, kick: 360, kickAntal: 14, farg0: farg })
    const studsare = [stor(180, 196, 'gron'), stor(126, 258, 'orange'), stor(234, 258, 'orange'), stor(72, 372, 'gron'), stor(288, 372, 'gron'), stor(180, 330, 'orange')]
    const slangbella = { kick: 320, kickAntal: 14 }
    const nere = [...tegelLinje(30, 432, 92, 492, 2, slangbella), ...tegelLinje(330, 432, 268, 492, 2, slangbella)]
    const bage = ring(180, 290, 158, 15, 205, 335)
    const pinnar = [...bage, ...linje(34, 262, 44, 330, 3), ...linje(326, 262, 316, 330, 3), ...gitter(122, 404, 5, 5, 29, 28), ...ring(180, 330, 52, 8, 0, 360)]
    return farga([...studsare, ...f('orange', nere.filter((_, i) => i % 2 === 0)), ...f('bla', nere.filter((_, i) => i % 2 === 1)), ...pinnar], r, { gron: 14, minAvst: 36 })
  },

  // Kulhjulen: tre snurrande hjul som slungar kulorna vidare.
  kulhjulen(r) {
    const hjul = [
      [92, 222, 2.0],
      [268, 222, -2.0],
      [180, 398, 1.6],
    ]
    const obj = []
    const grupper = []
    hjul.forEach(([cx, cy, w], g) => {
      const delar = [...ring(cx, cy, 58, 12, 15, 375), P(cx, cy)]
      for (const a of [0, 90, 180, 270]) for (const R of [21, 39]) delar.push(P(cx + Math.cos((a * Math.PI) / 180) * R, cy + Math.sin((a * Math.PI) / 180) * R))
      delar.forEach((o, i) => (o.farg0 = i < 12 ? (i % 2 === 0 ? 'gron' : i % 4 === 1 ? 'orange' : 'bla') : i === 12 ? 'gron' : 'bla'))
      obj.push(...iGrupp(g, delar))
      grupper.push({ typ: 'rotera', cx, cy, w })
    })
    const fasta = [...linje(40, 112, 320, 112, 9), ...linje(180, 170, 180, 278, 4), P(118, 322), P(242, 322), P(180, 304), ...ring(180, 398, 102, 9, 22, 158), ...linje(24, 330, 30, 520, 6), ...linje(336, 330, 330, 520, 6)]
    return { objekt: farga([...obj, ...fasta], r, { gron: 5, minAvst: 60 }), grupper }
  },

  // Plinkot: tratten släpper kulan i toppen av en pyramid av pinnar. De
  // gröna delar kulorna, och de studsar ner åt alla håll.
  plinkot(r) {
    const pyr = []
    for (let k = 0; k <= 13; k++) {
      const n = k <= 10 ? k + 1 : k % 2 ? 12 : 11
      for (let j = 0; j < n; j++) pyr.push(P(180 + (j - (n - 1) / 2) * 30, 192 + 26 * k, { rad: k }))
    }
    // rad 0, 1, 3, 5 och 7 är gröna: kulorna delar sig rad för rad
    for (const o of pyr) if (o.rad <= 1 || (o.rad % 2 === 1 && o.rad <= 7)) o.farg0 = 'gron'
    const obj = farga(pyr, r, { gron: 5, minAvst: 60, orange: 4, far: (o) => o.rad >= 9 })
    // en kort ränna under tratten, så att kulan faller rakt ner på toppen
    const ranna = [...tegelLinje(167.5, 146, 167.5, 174, 1), ...tegelLinje(192.5, 146, 192.5, 174, 1)]
    return [...f('bla', [...tratt(100, 30), ...ranna]), ...obj.map(({ rad, ...o }) => o)]
  },

  // Studsmattan: studsmattor längst ner skjuter upp kulorna igen och igen,
  // tills de är utslitna.
  studsmattan(r) {
    const matta = { kick: 540, kickAntal: 12 }
    const mattor = [22, 94, 160, 226, 298].map((x, i) => ({ ...tegelLinje(x, 506, x + 40, 506, 1, matta)[0], farg0: i % 2 ? 'orange' : 'bla' }))
    const pinnar = gitter(36, 150, 9, 10, 36, 32)
    return farga([...mattor, ...pinnar], r, { gron: 20, minAvst: 36 })
  },

  // Kaskaden: hyllor i sicksack som kulorna rinner nedför. Vid varje kant
  // sitter gröna, så att kulorna blir fler för varje steg.
  kaskaden(r) {
    const hyllor = []
    const kanter = []
    for (let i = 0; i < 5; i++) {
      const y = 170 + 78 * i
      const [x0, x1] = i % 2 ? [324, 130] : [36, 230]
      hyllor.push([x0, y, x1, y + 30])
      kanter.push(P(x1 + (i % 2 ? -40 : 40), y + 46, { farg0: 'gron' }))
    }
    const tegel = []
    hyllor.forEach(([x0, y0, x1, y1]) =>
      tegelLinje(x0, y0, x1, y1, 6).forEach((o, k) => tegel.push({ ...o, farg0: k === 1 || k === 4 ? 'gron' : k === 2 ? 'orange' : 'bla' })),
    )
    // inga pinnar i skuggan under hyllorna (dit når kulorna sällan)
    const under = (o) => hyllor.some(([x0, y0, x1, y1]) => {
      const k = (o.x - x0) / (x1 - x0)
      return k > 0.06 && k < 0.94 && o.y > y0 + (y1 - y0) * k && o.y < y0 + (y1 - y0) * k + 60
    })
    const fyll = gitter(24, 160, 10, 12, 34.7, 32).filter((o) => !under(o) && hyllor.every(([x0, y0, x1, y1]) => tillStracka(o.x, o.y, x0, y0, x1, y1) > 24) && kanter.every((k) => Math.hypot(o.x - k.x, o.y - k.y) > 28))
    return farga([...tegel, ...kanter, ...fyll], r, { gron: 5, minAvst: 70, orange: 3, orangeFar: (o) => o.y > 400 })
  },

  // Galaxen: en snurrande galax med tre spiralarmar och stjärnor runt om.
  // Gröna stjärnor exploderar i nya kulor åt alla håll.
  galaxen(r) {
    const C = [180, 330]
    const armar = []
    for (let j = 0; j < 3; j++) {
      const a0 = (j * 2 * Math.PI) / 3
      armar.push(...langs((t) => [C[0] + Math.cos(a0 + t * 3.4) * (30 + 124 * t), C[1] + Math.sin(a0 + t * 3.4) * (30 + 124 * t)], 27))
    }
    const karna = [P(C[0], C[1], { farg0: 'gron' })]
    const galax = farga([...karna, ...armar], r, { gron: 14, minAvst: 34, orange: 3 })
    const stjarnor = []
    for (let i = 0; i < 400 && stjarnor.length < 18; i++) {
      const x = 24 + r() * 312
      const y = 100 + r() * 444
      if (Math.hypot(x - C[0], y - C[1]) < 194) continue
      if (stjarnor.some((s) => Math.hypot(s.x - x, s.y - y) < 34)) continue
      stjarnor.push(P(x, y))
    }
    return { objekt: [...iGrupp(0, galax), ...farga(stjarnor, r, { gron: 4, minAvst: 80, orange: 6 })], grupper: [{ typ: 'rotera', cx: C[0], cy: C[1], w: 0.5 }] }
  },

  // Kulstormen: en tornado av pinnar med massor av gröna — upp till 60
  // kulor på en gång.
  kulstormen(r) {
    const obj = []
    for (let k = 0; k <= 14; k++) {
      const bredd = 324 - k * 17
      const n = Math.floor(bredd / 30) + 1
      const cx = 180 + Math.sin(k * 0.55) * 28
      for (let j = 0; j < n; j++) obj.push(P(cx + (j - (n - 1) / 2) * 30 + (k % 2 ? 7 : -7), 122 + 28 * k))
    }
    return farga(obj.filter((o) => o.x > 14 && o.x < W - 14), r, { gron: 26, minAvst: 30 })
  },
}

export const BONUS = [
  { id: 'kulbanan', namn: 'Kulbanan', text: 'Sikta i tratten och se kulan rulla hela vägen ner', kraft: 'small', mall: 'kulbanan' },
  { id: 'kedjan', namn: 'Kedjereaktionen', text: 'En grön smäll startar en våg över hela tavlan', kraft: 'small', mall: 'kedjan' },
  { id: 'spiralen', namn: 'Spiralen', text: 'Pricka spiralen och se stubinen brinna in mot mitten', kraft: 'small', mall: 'spiralen' },
  { id: 'kulregnet', namn: 'Kulregnet', text: 'Varje grön pinne ger två kulor till', kraft: 'multi', mall: 'kulregnet', multi: 2 },
  { id: 'eldsolen', namn: 'Eldsolen', text: 'Första kulan är en eldboll som bränner rakt igenom', kraft: 'small', mall: 'eldsolen', start: { eld: 1 } },
  { id: 'skateparken', namn: 'Skateparken', text: 'Glid i halfpipen och låt stubinen brinna', kraft: 'small', mall: 'skateparken' },
  // kulregnsbanorna: varje grön ger fler kulor (familj: egen rad i menyn)
  { id: 'skyfallet', namn: 'Skyfallet', text: 'Varje grön får det att regna tre kulor från himlen', kraft: 'multi', mall: 'skyfallet', multi: 3, multiStil: 'regn', familj: 'kulregn', varld: 0, ikon: '🌧️' },
  { id: 'fontanen', namn: 'Fontänen', text: 'Gröna pinnar sprutar kulor rakt upp som en fontän', kraft: 'multi', mall: 'fontanen', multi: 2, multiStil: 'fontan', familj: 'kulregn', varld: 5, ikon: '⛲' },
  { id: 'popcornen', namn: 'Popcornen', text: 'Kulorna poppar åt alla håll i popcorngrytan', kraft: 'multi', mall: 'popcornen', multi: 3, multiStil: 'stjarna', familj: 'kulregn', varld: 1, ikon: '🍿' },
  { id: 'flipperspelet', namn: 'Flipperspelet', text: 'Studsarna skjuter iväg kulorna, se dem flippra runt', kraft: 'multi', mall: 'flipperspelet', multi: 2, familj: 'kulregn', varld: 2, ikon: '🕹️' },
  { id: 'kulhjulen', namn: 'Kulhjulen', text: 'Snurrande hjul slungar kulorna över hela planen', kraft: 'multi', mall: 'kulhjulen', multi: 2, familj: 'kulregn', varld: 1, ikon: '🎡' },
  { id: 'plinkot', namn: 'Plinkot', text: 'Kulorna delar sig och studsar ner genom pyramiden', kraft: 'multi', mall: 'plinkot', multi: 3, multiStil: 'dela', familj: 'kulregn', varld: 5, ikon: '🔺' },
  { id: 'studsmattan', namn: 'Studsmattan', text: 'Studsmattorna skjuter upp kulorna igen och igen', kraft: 'multi', mall: 'studsmattan', multi: 2, familj: 'kulregn', varld: 0, ikon: '🤸' },
  { id: 'kaskaden', namn: 'Kaskaden', text: 'Kulorna forsar ner för trappan och blir fler för varje steg', kraft: 'multi', mall: 'kaskaden', multi: 2, familj: 'kulregn', varld: 3, ikon: '🌊' },
  { id: 'galaxen', namn: 'Galaxen', text: 'Gröna stjärnor i den snurrande galaxen exploderar i kulor', kraft: 'multi', mall: 'galaxen', multi: 2, multiStil: 'stjarna', familj: 'kulregn', varld: 2, ikon: '🌌' },
  { id: 'kulstormen', namn: 'Kulstormen', text: 'Upp till 60 kulor på en gång — den stora finalen', kraft: 'multi', mall: 'kulstormen', multi: 3, multiStil: 'stjarna', maxKulor: 60, familj: 'kulregn', varld: 4, ikon: '🌪️' },
]

// Hämtar en bonusbana. variant 0 är originalet; andra varianter speglas och
// får lite andra pinnar. En mall ger en lista objekt, eller { objekt,
// grupper } om något snurrar.
export function hamtaBonus(id, variant = 0) {
  const d = BONUS.find((b) => b.id === id) || BONUS[0]
  const r = mulberry32(variant * 7919 + d.id.length)
  const m = MALLAR[d.mall](r, variant)
  let obj = Array.isArray(m) ? m : m.objekt
  let grupper = Array.isArray(m) ? [] : m.grupper
  if (variant % 2 === 1) {
    obj = spegla(obj)
    // speglat snurrar åt andra hållet
    grupper = grupper.map((g) => ({ ...g, cx: W - g.cx, w: -g.w }))
  }
  return bonus(d.id, d.namn, d.text, d.kraft, obj, {
    kulor: 3,
    start: d.start,
    multi: d.multi,
    multiStil: d.multiStil,
    maxKulor: d.maxKulor,
    grupper,
    variant,
    varld: d.varld ?? BONUS.indexOf(d) % 6,
  })
}
