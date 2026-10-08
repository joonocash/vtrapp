// Hållplatsen — regler och bangenerator. Ingen DOM.
//
// Som Bus Jam, fast med spårvagnar: rutnätet är fullt av resenärer i olika
// färger. Tryck på en resenär som har fri väg upp till perrongen. Har den
// spårvagn som står inne samma färg kliver resenären på, annars sätter den
// sig på bänken. Tre resenärer fyller en vagn, sedan går den och nästa rullar
// in — och de på bänken i den färgen kliver på direkt. Blir bänken full är
// det slut.
//
// Extra som i originalet: hemliga resenärer (syns först när en granne gått),
// is (smälter efter några drag när en sida är fri) och rulltrappor som
// släpper ut nya resenärer när rutan framför är tom.
//
// Vägar blir bara friare av att resenärer går, så generatorn kan först välja
// en ordning resenärerna kan gå i och sedan färga dem så att vagnarna går
// ihop med en lagom full bänk. Varje bana har alltså en lösning.

import { slump, blanda, heltal, klamp, valj } from '../delat/rng.js'
import { svarighet } from '../delat/svarighet.js'

export const KAPACITET = 3
export const BANK = 5
export const DX = [0, 1, 0, -1]
export const DY = [-1, 0, 1, 0]

// Färgerna och vilket linjenummer vagnen i den färgen har.
export const FARGER = [
  { namn: 'röd', hex: '#ef4444', linje: 5 },
  { namn: 'blå', hex: '#3b82f6', linje: 3 },
  { namn: 'gul', hex: '#facc15', linje: 2 },
  { namn: 'grön', hex: '#22c55e', linje: 4 },
  { namn: 'lila', hex: '#a855f7', linje: 8 },
  { namn: 'orange', hex: '#fb923c', linje: 6 },
  { namn: 'rosa', hex: '#f472b6', linje: 13 },
  { namn: 'turkos', hex: '#2dd4bf', linje: 9 },
  { namn: 'brun', hex: '#a16207', linje: 7 },
  { namn: 'vit', hex: '#e5e7eb', linje: 1 },
]

export const HALLPLATSER = [
  'Ullevi Norra', 'Centralstationen', 'Nordstan', 'Brunnsparken', 'Domkyrkan', 'Grönsakstorget',
  'Järntorget', 'Masthuggstorget', 'Stigbergstorget', 'Majvallen', 'Mariaplan', 'Ostindiegatan',
  'Klippan', 'Jaegerdorffsplatsen', 'Hagen', 'Långedrag', 'Saltholmen', 'Korsvägen',
  'Berzeliigatan', 'Valand', 'Kungsportsplatsen', 'Vasaplatsen', 'Hagakyrkan', 'Linnéplatsen',
  'Botaniska trädgården', 'Marklandsgatan', 'Chalmers', 'Kapellplatsen', 'Wavrinskys plats',
  'Ullevi Södra', 'Svingeln', 'Olskrokstorget', 'Redbergsplatsen', 'Ekmanska',
  'Hjalmar Brantingsplatsen', 'Frihamnsporten', 'Vågmästareplatsen', 'Kvilletorget', 'Lindholmen',
  'Eketrägatan', 'Wieselgrensplatsen', 'Brunnsgatan', 'Sanna', 'Mölndals Innerstad', 'Krokslätts torg',
  'Lackarebäck', 'Gamlestadstorget', 'Kaggeledstorget', 'Beväringsgatan', 'Komettorget', 'Rymdtorget',
  'Bergsjön', 'Hammarkullen', 'Angered centrum', 'Sahlgrenska', 'Mossen', 'Mölndalsvägen', 'Liseberg Södra',
]
export const hallplatsFor = (niva) => HALLPLATSER[(niva - 1) % HALLPLATSER.length]

/* --------------------------------------------------------------- spelet */

// Bana: { w, h, celler: [...], vagnar: [färgindex], bank, tid }
// cell: null = tom, { t: 'v' } = vägg/planterat, { t: 'r', f, dold, is } = resenär,
//       { t: 't', dir, ko: [f...] } = rulltrappa
export function skapaSpel(bana) {
  const { w, h } = bana
  const celler = bana.celler.map((c) => (c ? { ...c, ko: c.ko ? [...c.ko] : undefined } : null))
  const vagnar = [...bana.vagnar]
  const bank = new Array(bana.bank ?? BANK).fill(null)
  let aktiv = 0
  let ombord = 0
  let drag = 0
  let lostVid = -1

  const inne = (x, y) => x >= 0 && y >= 0 && x < w && y < h
  const tom = (i) => celler[i] === null

  // Kortaste vägen från ruta i till översta raden, genom tomma rutor.
  function vag(i) {
    const x0 = i % w
    const y0 = (i - x0) / w
    if (y0 === 0) return [i]
    const fran = new Int32Array(w * h).fill(-2)
    fran[i] = -1
    const ko = [i]
    for (let k = 0; k < ko.length; k++) {
      const c = ko[k]
      const x = c % w
      const y = (c - x) / w
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d]
        const ny = y + DY[d]
        if (!inne(nx, ny)) continue
        const n = ny * w + nx
        if (fran[n] !== -2 || !tom(n)) continue
        fran[n] = c
        if (ny === 0) {
          const ut = [n]
          let p = c
          while (p !== -1) {
            ut.push(p)
            p = fran[p]
          }
          return ut.reverse()
        }
        ko.push(n)
      }
    }
    return null
  }

  const resenar = (i) => celler[i] && celler[i].t === 'r'
  const kanGa = (i) => resenar(i) && !celler[i].dold && !(celler[i].is > 0) && vag(i) !== null

  function harTomGranne(i) {
    const x = i % w
    const y = (i - x) / w
    if (y === 0) return true // perrongen räknas som öppen
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]
      const ny = y + DY[d]
      if (inne(nx, ny) && tom(ny * w + nx)) return true
    }
    return false
  }

  // Det som händer efter varje drag: rulltrappor, avslöjanden, is.
  function varlden(handelser, raknaDrag) {
    for (let i = 0; i < celler.length; i++) {
      const c = celler[i]
      if (!c || c.t !== 't' || !c.ko.length) continue
      const x = i % w
      const y = (i - x) / w
      const nx = x + DX[c.dir]
      const ny = y + DY[c.dir]
      if (!inne(nx, ny)) continue
      const n = ny * w + nx
      if (!tom(n)) continue
      celler[n] = { t: 'r', f: c.ko.shift(), dold: false, is: 0 }
      handelser.push({ typ: 'rulltrappa', fran: i, till: n, f: celler[n].f })
    }
    if (raknaDrag) {
      for (let i = 0; i < celler.length; i++) {
        const c = celler[i]
        if (!c || c.t !== 'r' || !(c.is > 0)) continue
        if (!harTomGranne(i)) continue
        c.is--
        handelser.push({ typ: c.is === 0 ? 'tinat' : 'spricka', i, kvar: c.is })
      }
    }
    for (let i = 0; i < celler.length; i++) {
      const c = celler[i]
      if (!c || c.t !== 'r' || !c.dold) continue
      if (!harTomGranne(i)) continue
      c.dold = false
      handelser.push({ typ: 'avslojd', i, f: c.f })
    }
  }

  // Vagnar som fylls går, nästa rullar in och tar med sig bänkens folk.
  function vagnarna(handelser) {
    while (aktiv < vagnar.length && ombord >= KAPACITET) {
      handelser.push({ typ: 'avgang', vagn: aktiv })
      aktiv++
      ombord = 0
      if (aktiv >= vagnar.length) break
      for (let p = 0; p < bank.length && ombord < KAPACITET; p++) {
        if (bank[p] === vagnar[aktiv]) {
          bank[p] = null
          ombord++
          handelser.push({ typ: 'byte', plats: p, vagn: aktiv, f: vagnar[aktiv] })
        }
      }
    }
  }

  function skicka(i, vagen) {
    const c = celler[i]
    celler[i] = null
    drag++
    const handelser = []
    let mal
    if (aktiv < vagnar.length && vagnar[aktiv] === c.f && ombord < KAPACITET) {
      mal = { typ: 'vagn', vagn: aktiv, plats: ombord }
      ombord++
    } else {
      const p = bank.indexOf(null)
      mal = { typ: 'bank', plats: p }
      bank[p] = c.f
    }
    vagnarna(handelser)
    varlden(handelser, true)
    const vunnit = aktiv >= vagnar.length
    const forlorat = !vunnit && bank.indexOf(null) === -1
    if (forlorat) lostVid = drag
    return { typ: 'gar', i, f: c.f, vag: vagen, mal, handelser, vunnit, forlorat }
  }

  function tryck(i) {
    if (status() !== 'spelar') return null
    if (!resenar(i)) return null
    const c = celler[i]
    if (c.dold || c.is > 0) return { typ: 'last', i }
    const v = vag(i)
    if (!v) return { typ: 'blockerad', i }
    return skicka(i, v)
  }

  // Booster: lyft valfri resenär rakt upp, väg eller inte.
  function lyft(i) {
    if (status() !== 'spelar' || !resenar(i)) return null
    const c = celler[i]
    c.dold = false
    c.is = 0
    return skicka(i, [i])
  }

  // Booster "Vinka" (originalets Color Picker): alla i den inne vagnens färg
  // kliver på, var de än står — så många som det finns platser kvar.
  // Synliga först, närmast perrongen först; hemliga bara om det inte räcker.
  function vinka() {
    if (status() !== 'spelar' || aktiv >= vagnar.length) return []
    const f = vagnar[aktiv]
    const n = KAPACITET - ombord
    const kand = []
    for (let i = 0; i < celler.length; i++) {
      const c = celler[i]
      if (c && c.t === 'r' && c.f === f) kand.push(i)
    }
    kand.sort((p, q) => (celler[p].dold ? 1 : 0) - (celler[q].dold ? 1 : 0) || Math.floor(p / w) - Math.floor(q / w))
    const ut = []
    for (const i of kand.slice(0, n)) {
      celler[i].dold = false
      celler[i].is = 0
      ut.push(skicka(i, [i]))
    }
    return ut
  }

  function status() {
    if (aktiv >= vagnar.length) return 'vunnit'
    if (bank.indexOf(null) === -1) return 'forlorat'
    return 'spelar'
  }

  // Startläget: rulltrappor med tom ruta framför släpper ut direkt, och
  // hemliga med öppen granne avslöjas.
  const start = []
  varlden(start, false)

  return {
    w,
    h,
    celler,
    vagnar,
    bank,
    startHandelser: start,
    vag,
    kanGa,
    tryck,
    lyft,
    vinka,
    status,
    aktiv: () => aktiv,
    ombord: () => ombord,
    drag: () => drag,
    kvar: () => celler.reduce((s, c) => s + (c && c.t === 'r' ? 1 : c && c.t === 't' ? c.ko.length : 0), 0),
    extraPlats() {
      bank.push(null)
    },
    lostVid: () => lostVid,
  }
}

/* --------------------------------------------------------------- generator */

export function parametrar(niva) {
  const svar = svarighet(niva)
  const tidiga = [
    [3, 3, 3],
    [3, 4, 3],
    [4, 4, 3],
    [4, 4, 4],
    [4, 5, 4],
  ]
  let w, h, farger
  if (niva <= tidiga.length) [w, h, farger] = tidiga[niva - 1]
  else {
    w = klamp(4 + Math.floor((niva - 5) / 9), 5, 8)
    h = klamp(5 + Math.floor((niva - 5) / 6), 5, 9)
    farger = klamp(4 + Math.floor((niva - 5) / 7), 4, 9)
  }
  if (svar === 'svår') {
    h = Math.min(10, h + 1)
    farger = Math.min(10, farger + 1)
  }
  if (svar === 'supersvår') {
    w = Math.min(8, w + 1)
    h = Math.min(10, h + 1)
    farger = Math.min(10, farger + 1)
  }
  return {
    svar,
    w,
    h,
    farger,
    vaggar: niva < 4 ? 0 : klamp(0.04 + niva * 0.002, 0.04, 0.12),
    dolda: niva < 8 ? 0 : klamp(0.08 + niva * 0.002, 0.08, 0.25),
    is: niva < 14 ? 0 : klamp(Math.floor(niva / 14), 1, 4),
    tunnlar: niva < 20 ? 0 : klamp(Math.floor((niva - 12) / 12), 1, 3),
    fonster: niva < 4 ? 1 : klamp(2 + Math.floor(niva / 8), 2, 9) + (svar === 'normal' ? 0 : 2),
    marginal: svar === 'normal' ? (niva < 30 ? 2 : 1) : svar === 'svår' ? 1 : 0,
  }
}

export function genereraBana(niva) {
  const p = parametrar(niva)
  for (let forsok = 0; forsok < 60; forsok++) {
    const r = slump('hallplatsen', niva, forsok)
    const fonster = Math.max(1, p.fonster - Math.floor(forsok / 8))
    const bana = forsokBygga(niva, p, r, fonster)
    if (bana) return bana
  }
  // Nödutgång: helt utan krångel (ska aldrig behövas, testerna kollar).
  return forsokBygga(niva, { ...p, dolda: 0, is: 0, tunnlar: 0, vaggar: 0 }, slump('hallplatsen-nod', niva), 1)
}

function forsokBygga(niva, p, r, fonster) {
  const { w, h } = p
  const N = w * h
  const celler = new Array(N).fill(null)
  const inne = (x, y) => x >= 0 && y >= 0 && x < w && y < h

  // Väggar (planteringar), gärna spegelvända så det ser byggt ut.
  const antalVaggar = Math.round(N * p.vaggar)
  for (let k = 0; k < antalVaggar * 3 && celler.filter(Boolean).length < antalVaggar; k++) {
    const x = heltal(r, 0, w - 1)
    const y = heltal(r, 1, h - 1)
    const i = y * w + x
    const spegel = y * w + (w - 1 - x)
    if (celler[i]) continue
    celler[i] = { t: 'v' }
    if (r() < 0.7) celler[spegel] = { t: 'v' }
    if (!sammanhangande(celler, w, h)) {
      celler[i] = null
      celler[spegel] = null
    }
  }

  // Rulltrappor: vid sidokanterna eller nederkanten, pekar in mot brädet.
  const trappor = []
  for (let k = 0; k < p.tunnlar; k++) {
    for (let f = 0; f < 30; f++) {
      const sida = valj(r, ['v', 'h', 'n'])
      let x, y, dir
      if (sida === 'v') [x, y, dir] = [0, heltal(r, 2, h - 1), 1]
      else if (sida === 'h') [x, y, dir] = [w - 1, heltal(r, 2, h - 1), 3]
      else [x, y, dir] = [heltal(r, 0, w - 1), h - 1, 0]
      const i = y * w + x
      const fram = (y + DY[dir]) * w + x + DX[dir]
      if (celler[i] || !inne(x + DX[dir], y + DY[dir]) || (celler[fram] && celler[fram].t !== 'r')) continue
      celler[i] = { t: 't', dir, ko: [] }
      if (!sammanhangande(celler, w, h)) {
        celler[i] = null
        continue
      }
      trappor.push(i)
      break
    }
  }

  // Resenärer överallt annars, med ett par tomma rutor i större banor.
  const fria = []
  for (let i = 0; i < N; i++) if (!celler[i]) fria.push(i)
  const tomma = niva <= 2 ? 0 : heltal(r, 0, Math.min(3, Math.floor(fria.length / 12)))
  blanda(fria, r)
  const resenarer = fria.slice(tomma)
  let id = 0
  for (const i of resenarer) celler[i] = { t: 'r', f: -1, dold: false, is: 0, id: id++ }
  for (const t of trappor) {
    const n = heltal(r, 2, 4)
    for (let k = 0; k < n; k++) celler[t].ko.push(-1 - id++) // tillfälliga id, färgas nedan
  }
  // Totalt antal måste vara delbart med tre: plocka bort några resenärer.
  let total = id
  while (total % 3 !== 0) {
    const kand = []
    for (let i = 0; i < N; i++) if (celler[i] && celler[i].t === 'r') kand.push(i)
    const i = valj(r, kand)
    celler[i] = null
    total--
  }
  if (total < 6) return null

  // Hemliga: inre resenärer utan tom granne.
  const tomGranne = (i) => {
    const x = i % w
    const y = (i - x) / w
    if (y === 0) return true
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]
      const ny = y + DY[d]
      if (inne(nx, ny) && celler[ny * w + nx] === null) return true
    }
    return false
  }
  for (let i = 0; i < N; i++) {
    const c = celler[i]
    if (c && c.t === 'r' && !tomGranne(i) && r() < p.dolda) c.dold = true
  }
  // Is på några resenärer som inte står överst.
  for (let k = 0; k < p.is; k++) {
    const kand = []
    for (let i = w; i < N; i++) if (celler[i] && celler[i].t === 'r' && !celler[i].dold && !celler[i].is) kand.push(i)
    if (!kand.length) break
    celler[valj(r, kand)].is = heltal(r, 2, 4)
  }

  // En ordning resenärerna kan gå i (färgerna spelar ingen roll för vägarna).
  const tankt = tankbarOrdning(celler, w, h, r)
  if (!tankt) return null
  const ordning = tankt.ids

  // Vagnarnas färger, sedan resenärernas: vagn för vagn i ordningen, lite
  // omblandat inom ett fönster så att bänken behövs.
  const antalVagnar = total / 3
  const farger = Math.min(p.farger, antalVagnar)
  const fargval = blanda(Array.from({ length: FARGER.length }, (_, i) => i), r).slice(0, farger)
  const vagnar = []
  while (vagnar.length < antalVagnar) vagnar.push(...blanda([...fargval], r))
  vagnar.length = antalVagnar
  for (let i = 1; i < vagnar.length; i++) {
    if (vagnar[i] === vagnar[i - 1]) {
      const j = vagnar.findIndex((v, k) => k > i && v !== vagnar[i - 1])
      if (j > 0) [vagnar[i], vagnar[j]] = [vagnar[j], vagnar[i]]
    }
  }
  // Ryckig sortering: varje plats får en nyckel i + slump(0..fönster), så
  // ingen färg flyttar mer än fönstret.
  const seq = vagnar
    .flatMap((v) => [v, v, v])
    .map((v, i) => [v, i + r() * fonster])
    .sort((a, b) => a[1] - b[1])
    .map(([v]) => v)
  const fargFor = new Map(ordning.map((id, k) => [id, seq[k]]))
  for (const c of celler) {
    if (!c) continue
    if (c.t === 'r') c.f = fargFor.get(c.id)
    if (c.t === 't') c.ko = c.ko.map((tid) => fargFor.get(tid))
  }

  const bana = {
    niva,
    svar: p.svar,
    namn: hallplatsFor(niva),
    w,
    h,
    celler: celler.map((c) => (c ? stada(c) : null)),
    vagnar,
    bank: BANK,
    tid: Math.round((25 + total * 2.6 * (p.svar === 'normal' ? 1 : 0.9)) / 5) * 5,
    // En lösning (rutor att trycka på i tur och ordning). Används av testerna.
    losning: tankt.rutor,
  }

  // Den tänkta lösningen ska gå med marginal på bänken.
  const maxBank = bankBehov(seq, vagnar)
  if (maxBank === null || maxBank > BANK - 1 - p.marginal) return null
  // Tidiga banor ska dessutom gå för en vanlig, girig spelare.
  if (botKrav(niva, p.svar) && !girigBot(bana)) return null
  return bana
}

// Vanliga banor ska klaras av boten; svåra bara tidigt — där är det
// meningen att man ska behöva tänka.
function botKrav(niva, svar) {
  if (svar === 'normal') return niva <= 80
  if (svar === 'svår') return niva <= 35
  return niva <= 20
}

function stada(c) {
  if (c.t === 'v') return { t: 'v' }
  if (c.t === 't') return { t: 't', dir: c.dir, ko: c.ko }
  const ut = { t: 'r', f: c.f }
  if (c.dold) ut.dold = true
  if (c.is) ut.is = c.is
  return ut
}

function sammanhangande(celler, w, h) {
  // Alla rutor som inte är väggar/trappor måste nå översta raden.
  const ok = (i) => !celler[i] || celler[i].t === 'r'
  const sett = new Uint8Array(w * h)
  const ko = []
  for (let x = 0; x < w; x++) if (ok(x)) {
    sett[x] = 1
    ko.push(x)
  }
  for (let k = 0; k < ko.length; k++) {
    const c = ko[k]
    const x = c % w
    const y = (c - x) / w
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]
      const ny = y + DY[d]
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const n = ny * w + nx
      if (!sett[n] && ok(n)) {
        sett[n] = 1
        ko.push(n)
      }
    }
  }
  for (let i = 0; i < w * h; i++) if (ok(i) && !sett[i]) return false
  return true
}

// Spelar banan utan färger och väljer slumpvis bland de som kan gå, med
// förkärlek för de som står nära perrongen. Ger { ids, rutor } eller null.
function tankbarOrdning(celler0, w, h, r) {
  const fake = {
    w,
    h,
    celler: celler0.map((c) => (c ? (c.t === 'r' ? { t: 'r', f: 0, dold: c.dold, is: c.is, id: c.id } : c.t === 't' ? { t: 't', dir: c.dir, ko: c.ko.map(() => 0), ids: [...c.ko] } : c) : null)),
    vagnar: [],
    bank: 999,
  }
  // Egen enkel simulering (färgfri): samma regler för väg, is, dolda och trappor.
  const celler = fake.celler
  const s = skapaSpel({ ...fake, vagnar: new Array(10000).fill(0) })
  // skapaSpel kopierar cellerna; vi behöver id:n, så följ dem via en egen karta.
  const idVid = celler.map((c) => (c && c.t === 'r' ? c.id : null))
  const trappIds = celler.map((c) => (c && c.t === 't' ? [...c.ids] : null))
  for (const e of s.startHandelser) if (e.typ === 'rulltrappa') idVid[e.till] = trappIds[e.fran].shift()
  const ordning = []
  const rutor = []
  for (;;) {
    const kand = []
    for (let i = 0; i < w * h; i++) if (s.kanGa(i)) kand.push(i)
    if (!kand.length) break
    // vikt: närmare toppen är mer sannolikt
    let tot = 0
    const vikter = kand.map((i) => {
      const v = 1 / (1 + Math.floor(i / w) * 0.8)
      tot += v
      return v
    })
    let x = r() * tot
    let val = kand[kand.length - 1]
    for (let k = 0; k < kand.length; k++) {
      x -= vikter[k]
      if (x < 0) {
        val = kand[k]
        break
      }
    }
    const res = s.tryck(val)
    ordning.push(idVid[val])
    rutor.push(val)
    idVid[val] = null
    for (const e of res.handelser) if (e.typ === 'rulltrappa') idVid[e.till] = trappIds[e.fran].shift()
  }
  if (s.kvar() > 0) return null
  return { ids: ordning, rutor }
}

// Bänkens största fyllnad om resenärerna går i färgordningen seq. Vägarna
// spelar ingen roll här — ordningen är redan känd som möjlig.
export function bankBehov(seq, vagnar) {
  let aktiv = 0
  let ombord = 0
  const bank = []
  let max = 0
  for (const f of seq) {
    if (vagnar[aktiv] === f && ombord < KAPACITET) ombord++
    else bank.push(f)
    max = Math.max(max, bank.length)
    while (aktiv < vagnar.length && ombord >= KAPACITET) {
      aktiv++
      ombord = 0
      for (let k = 0; k < bank.length && ombord < KAPACITET; ) {
        if (bank[k] === vagnar[aktiv]) {
          bank.splice(k, 1)
          ombord++
        } else k++
      }
    }
  }
  return aktiv >= vagnar.length ? max : null
}

// En girig spelare med lite framförhållning: tar vagnens färg om det går,
// annars den resenär som öppnar vägen för vagnens färg eller kompletterar
// ett par på bänken — och fyller aldrig bänken frivilligt. Används för att
// kolla att vanliga banor går att klara utan att räkna ut allt i förväg.
export function girigBot(bana) {
  const s = skapaSpel(bana)
  const { w, h } = bana
  const N = w * h
  const narbar = (bort) => {
    // tomma rutor som når toppen, med `bort` som tom
    const ok = new Uint8Array(N)
    const ko = []
    const tomt = (i) => i === bort || s.celler[i] === null
    for (let x = 0; x < w; x++) if (tomt(x)) {
      ok[x] = 1
      ko.push(x)
    }
    for (let k = 0; k < ko.length; k++) {
      const c = ko[k]
      const x = c % w
      const y = (c - x) / w
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d]
        const ny = y + DY[d]
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const n = ny * w + nx
        if (!ok[n] && tomt(n)) {
          ok[n] = 1
          ko.push(n)
        }
      }
    }
    return ok
  }
  const kanNas = (i, ok) => {
    const c = s.celler[i]
    if (!c || c.t !== 'r' || c.dold || c.is > 0) return false
    const x = i % w
    const y = (i - x) / w
    if (y === 0) return true
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]
      const ny = y + DY[d]
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && ok[ny * w + nx]) return true
    }
    return false
  }
  for (let steg = 0; steg < 2000; steg++) {
    const st = s.status()
    if (st !== 'spelar') return st === 'vunnit'
    const aktivF = s.vagnar[s.aktiv()]
    const nastaF = s.vagnar[s.aktiv() + 1]
    const fria = s.bank.filter((b) => b === null).length
    const nu = narbar(-1)
    let val = -1
    let bast = -Infinity
    for (let i = 0; i < N; i++) {
      if (!kanNas(i, nu)) continue
      const f = s.celler[i].f
      const direkt = f === aktivF
      if (!direkt && fria <= 1) continue
      const efter = narbar(i)
      let na = 0
      let nn = 0
      for (let j = 0; j < N; j++) {
        if (j === i || kanNas(j, nu) || !kanNas(j, efter)) continue
        if (s.celler[j].f === aktivF) na++
        else if (s.celler[j].f === nastaF) nn++
      }
      const avst = s.vagnar.indexOf(f, s.aktiv() + 1)
      const pa = s.bank.filter((b) => b === f).length
      const poang = (direkt ? 1000 : -60) + na * 30 + nn * 12 + pa * 25 - (avst < 0 ? 200 : (avst - s.aktiv()) * 6)
      if (poang > bast) {
        bast = poang
        val = i
      }
    }
    if (val < 0) return false
    s.tryck(val)
  }
  return false
}
