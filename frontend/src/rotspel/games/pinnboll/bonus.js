// Pinnbollen — bonusbanorna. Ingen DOM.
//
// Banor gjorda för att smälla: sikta i tratten så tar kulbanan, spiralen
// eller kedjereaktionen hand om resten, och nästan allt tänds i ett enda
// skott. Färgerna är bestämda (fasta), så de orange ligger längs vägen.
// Varje bonusbana finns i varianter (speglad, andra pinnar), så att oändligt
// läge kan bjuda på en ny var femte bana.

import { P, ring, linje, gitter, spiralJamn, tegelLinje, tegelBage, spegla, stada, nabara } from './former.js'
import { W } from './motor.js'
import { mulberry32 } from '../delat/rng.js'

const f = (farg, lista) => lista.map((o) => ({ ...o, farg0: farg }))

// Var n:te i listan får färgen (de andra behålls).
const varannan = (lista, n, farg, start = 0) => lista.map((o, i) => (i % n === start ? { ...o, farg0: farg } : o))

// Stubin: väljer gröna rymdsmällar i en mängd pinnar så att varje pinne
// ligger inom smällens räckvidd från en grön och de gröna når varandra —
// en enda grön smäll tänder då allt, som en våg som börjar där kulan slår i.
function stubin(lista, { start = [180, 300], rackvidd = 56, lank = 58, orange = 0.22 } = {}) {
  const mid = (o) => (o.form === 'cirkel' ? [o.x, o.y] : o.form === 'segment' ? [(o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2] : [o.cx + Math.cos((o.a0 + o.a1) / 2) * o.R, o.cy + Math.sin((o.a0 + o.a1) / 2) * o.R])
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
}

export const BONUS = [
  { id: 'kulbanan', namn: 'Kulbanan', text: 'Sikta i tratten och se kulan rulla hela vägen ner', kraft: 'small', mall: 'kulbanan' },
  { id: 'kedjan', namn: 'Kedjereaktionen', text: 'En grön smäll startar en våg över hela tavlan', kraft: 'small', mall: 'kedjan' },
  { id: 'spiralen', namn: 'Spiralen', text: 'Pricka spiralen och se stubinen brinna in mot mitten', kraft: 'small', mall: 'spiralen' },
  { id: 'kulregnet', namn: 'Kulregnet', text: 'Varje grön pinne ger två kulor till', kraft: 'multi', mall: 'kulregnet', multi: 2 },
  { id: 'eldsolen', namn: 'Eldsolen', text: 'Första kulan är en eldboll som bränner rakt igenom', kraft: 'small', mall: 'eldsolen', start: { eld: 1 } },
  { id: 'skateparken', namn: 'Skateparken', text: 'Glid i halfpipen och låt stubinen brinna', kraft: 'small', mall: 'skateparken' },
]

// Hämtar en bonusbana. variant 0 är originalet; andra varianter speglas och
// får lite andra pinnar.
export function hamtaBonus(id, variant = 0) {
  const d = BONUS.find((b) => b.id === id) || BONUS[0]
  const r = mulberry32(variant * 7919 + d.id.length)
  let obj = MALLAR[d.mall](r, variant)
  if (variant % 2 === 1) obj = spegla(obj)
  return bonus(d.id, d.namn, d.text, d.kraft, obj, { kulor: 3, start: d.start, multi: d.multi, variant, varld: BONUS.indexOf(d) % 6 })
}
