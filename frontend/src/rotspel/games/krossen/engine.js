// Krossen — motorn. Ren logik: ingen React, inga DOM-anrop.
//
// Ett drag är en sekvens: byte, rensning, fall, ny kedja, fall igen ...
// Motorn kör hela sekvensen som en generator. Den ändrar brädet och yieldar
// en beskrivning av varje steg. Komponenten animerar steget och ber sedan om
// nästa, så animationen och reglerna kan aldrig komma i otakt. Tester och
// simuleringar tömmer bara generatorn utan att rita något.
//
// Brädet
//   s.w, s.h         bredd och höjd, högst 9×9
//   s.mask[i]        1 = spelbar ruta, 0 = hål i brädet
//   s.tiles[i]       det som ligger i rutan, eller null:
//                      { id, typ: 'bit', farg, special, armerad, radie }
//                      { id, typ: 'lada', hp }      låda, 1–3 lager
//                      { id, typ: 'ograss' }        växer om man inte tar bort något
//                      { id, typ: 'kott' }          köttben som ska ner till botten
//                      { id, typ: 'boll' }          tennisboll: faller, stoppar raketer
//                    en bit kan ha klocka: n — den tickar ner ett steg per drag,
//                    och når den noll är banan förlorad
//                    en bit kan vara Happy (happy: true, mage): matchas som sin
//                    färg men äter i stället för att försvinna; med full mage
//                    kan spelaren låta honom hoppa och smälla 3×3
//                    en bit kan vara ett paket (paket: true): när det smäller
//                    blir det en överraskning i rutan
//   s.lera[i]        lera under rutan, 0–2 lager
//   s.koppel[i]      pjäsen i rutan sitter fast
//
// Specialpjäser (special på en bit):
//   raket-h / raket-v   rensar raden / kolumnen             4 i rad
//   bomb                3×3, faller, smäller 3×3 igen        5 i L eller T
//   skal                godisskålen: tar alla av en sort     5 i rad
//   frisbee             rensar ett plus och flyger till      2×2
//                       något banan behöver

export const SIDA_MAX = 9

// Poäng. Bitar gånger kedjenivån, hinder och leverans är fasta.
export const POANG = { bit: 20, lera: 100, lada: 40, ograss: 40, koppel: 40, kott: 1000, boll: 60, hopp: 500 }

// Så många godis Happy ska äta innan han kan hoppa.
export const HAPPY_MATT = 10

// Vad ett paket kan innehålla, och hur ofta.
export const PAKET = [
  { utfall: 'raket', vikt: 28 },
  { utfall: 'bomb', vikt: 18 },
  { utfall: 'frisbee', vikt: 18 },
  { utfall: 'skal', vikt: 6 },
  { utfall: 'drag', vikt: 12 },
  { utfall: 'mynt', vikt: 12 },
  { utfall: 'boll', vikt: 6 },
]

// Vanlig bit utan något extra: ingen special, inte Happy, inget paket.
const enkel = (t) => t && t.typ === 'bit' && !t.special && !t.happy && !t.paket

const arRaket = (x) => x === 'raket-h' || x === 'raket-v'

// Grundtypen för mål och statistik: båda raketerna räknas som raket.
export const grundtyp = (special) => (arRaket(special) ? 'raket' : special)

// ------------------------------------------------------------------- slump

// mulberry32. Deterministisk, så tester och banbygget ger samma resultat
// varje gång. Spelet självt kör med Math.random.
export function skapaRng(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ----------------------------------------------------------------- bygget

// Tecken i banans karta:
//   #  hål (ingen ruta)          .  vanlig ruta
//   l  lera                      L  dubbel lera
//   1 2 3  låda med så många lager
//   k  pjäs i koppel             K  pjäs i koppel på lera
//   o  ogräs                     e  köttben
//   b  tennisboll                t  pjäs med klocka
//   h  Happy                     q  överraskningspaket
export function skapaSpel(bana, rng = Math.random) {
  const rader = bana.karta
  const h = rader.length
  const w = Math.max(...rader.map((r) => r.length))
  const n = w * h

  const klockCeller = []
  const happyCeller = []
  const paketCeller = []
  const s = {
    w,
    h,
    rng,
    farger: bana.farger || 5,
    mask: new Array(n).fill(0),
    tiles: new Array(n).fill(null),
    lera: new Array(n).fill(0),
    koppel: new Array(n).fill(false),
    nextId: 1,
    drag: bana.drag,
    poang: 0,
    mal: (bana.mal || []).map((m) => ({ ...m })),
    samlat: { farg: new Array(6).fill(0), special: { raket: 0, bomb: 0, skal: 0, frisbee: 0 }, boll: 0, klocka: 0, hopp: 0, paket: 0 },
    paket: bana.paket || null,
    paketMynt: 0,
    kott: null,
    bollar: bana.bollar || null,
    klockor: bana.klockor || null,
    klockaRingde: null,
    levererade: 0,
    ograsBortDettaDrag: false,
    utgangar: new Set(),
  }

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c
      const ch = rader[r][c] ?? '#'
      if (ch === '#' || ch === ' ') continue
      s.mask[i] = 1
      if (ch === 'l') s.lera[i] = 1
      if (ch === 'L') s.lera[i] = 2
      if (ch === '1' || ch === '2' || ch === '3') s.tiles[i] = { id: s.nextId++, typ: 'lada', hp: Number(ch) }
      if (ch === 'k' || ch === 'K') s.koppel[i] = true
      if (ch === 'K') s.lera[i] = 1
      if (ch === 'o') s.tiles[i] = { id: s.nextId++, typ: 'ograss' }
      if (ch === 'e') s.tiles[i] = { id: s.nextId++, typ: 'kott' }
      if (ch === 'b') s.tiles[i] = { id: s.nextId++, typ: 'boll' }
      if (ch === 't') klockCeller.push(i)
      if (ch === 'h') happyCeller.push(i)
      if (ch === 'q') paketCeller.push(i)
    }
  }

  forberaGrannar(s)

  if (bana.kott) {
    const paBradet = s.tiles.filter((t) => t && t.typ === 'kott').length
    s.kott = {
      antal: bana.kott.antal,
      kvar: Math.max(0, bana.kott.antal - paBradet),
      max: bana.kott.max || 2,
    }
    const kolumner = bana.kott.utgangar || [...Array(w).keys()]
    for (const c of kolumner) {
      // längst ner i kolumnen
      for (let r = h - 1; r >= 0; r--) {
        if (s.mask[r * w + c]) {
          s.utgangar.add(r * w + c)
          break
        }
      }
    }
  }

  fyllStart(s)
  const tid = (bana.klockor && bana.klockor.tid) || 15
  for (const i of klockCeller) if (s.tiles[i] && s.tiles[i].typ === 'bit') s.tiles[i].klocka = tid
  for (const i of paketCeller) if (enkel(s.tiles[i])) s.tiles[i].paket = true
  if (bana.happy) {
    // Happy börjar där kartan säger, annars på en vanlig ruta nära mitten
    let i = happyCeller.find((j) => enkel(s.tiles[j]) && !s.koppel[j])
    if (i === undefined) {
      const mitt = (s.h / 2) * w + w / 2
      const kandidater = s.tiles.map((t, j) => j).filter((j) => enkel(s.tiles[j]) && !s.koppel[j] && !s.tiles[j].klocka)
      kandidater.sort((a, b) => Math.abs(a - mitt) - Math.abs(b - mitt))
      i = kandidater[Math.floor(rng() * Math.min(6, kandidater.length))]
    }
    if (i !== undefined) Object.assign(s.tiles[i], { happy: true, mage: 0 })
  }
  return s
}

// Förberäknade grannar i kolumnen. Hål hoppas över: en pjäs faller rakt
// igenom ett hål i brädet och landar på andra sidan.
function forberaGrannar(s) {
  const { w, h, mask } = s
  s.ovanfor = new Array(w * h).fill(-1)
  s.nedanfor = new Array(w * h).fill(-1)
  for (let c = 0; c < w; c++) {
    let senast = -1
    for (let r = 0; r < h; r++) {
      const i = r * w + c
      if (!mask[i]) continue
      s.ovanfor[i] = senast
      if (senast >= 0) s.nedanfor[senast] = i
      senast = i
    }
  }
}

function nyBit(s, farg, special = null) {
  return { id: s.nextId++, typ: 'bit', farg, special, armerad: false, radie: 1 }
}

// Fyller alla tomma spelbara rutor utan att skapa färdiga matchningar, och
// ser till att det finns minst ett drag.
function fyllStart(s) {
  const tomma = []
  for (let i = 0; i < s.tiles.length; i++) if (s.mask[i] && !s.tiles[i]) tomma.push(i)

  for (let forsok = 0; forsok < 80; forsok++) {
    for (const i of tomma) s.tiles[i] = null
    for (const i of tomma) s.tiles[i] = nyBit(s, sakerFarg(s, i))
    if (hittaGrupper(s).length === 0 && harDrag(s)) return
  }
  // Nödutgång: extremt trånga banor. Blanda tills det går.
  blandaBradet(s)
}

// En färg som inte bildar tre i rad eller en 2×2-ruta med det som redan
// ligger till vänster och ovanför.
function sakerFarg(s, i) {
  const { w } = s
  const r = Math.floor(i / w)
  const c = i % w
  const f = (rr, cc) => {
    if (rr < 0 || cc < 0 || cc >= w) return -1
    const t = s.tiles[rr * w + cc]
    return t && t.typ === 'bit' ? t.farg : -1
  }
  const forbjudna = new Set()
  if (f(r, c - 1) >= 0 && f(r, c - 1) === f(r, c - 2)) forbjudna.add(f(r, c - 1))
  if (f(r - 1, c) >= 0 && f(r - 1, c) === f(r - 2, c)) forbjudna.add(f(r - 1, c))
  if (f(r, c - 1) >= 0 && f(r, c - 1) === f(r - 1, c) && f(r, c - 1) === f(r - 1, c - 1)) forbjudna.add(f(r, c - 1))
  const val = []
  for (let k = 0; k < s.farger; k++) if (!forbjudna.has(k)) val.push(k)
  return val[Math.floor(s.rng() * val.length)] ?? 0
}

// --------------------------------------------------------------- hjälpare

export const rad = (s, i) => Math.floor(i / s.w)
export const kol = (s, i) => i % s.w

function grannar(s, i) {
  const { w, h } = s
  const r = Math.floor(i / w)
  const c = i % w
  const ut = []
  if (r > 0 && s.mask[i - w]) ut.push(i - w)
  if (r < h - 1 && s.mask[i + w]) ut.push(i + w)
  if (c > 0 && s.mask[i - 1]) ut.push(i - 1)
  if (c < w - 1 && s.mask[i + 1]) ut.push(i + 1)
  return ut
}

export function arGrannar(s, a, b) {
  if (a === b || !s.mask[a] || !s.mask[b]) return false
  const dr = Math.abs(rad(s, a) - rad(s, b))
  const dc = Math.abs(kol(s, a) - kol(s, b))
  return dr + dc === 1
}

const matchbar = (t) => t && t.typ === 'bit' && !t.armerad

// Faller pjäsen i rutan när det blir tomt under den?
function rorlig(s, i) {
  const t = s.tiles[i]
  if (!t) return false
  if (t.typ === 'kott' || t.typ === 'boll') return true
  return t.typ === 'bit' && !s.koppel[i]
}

// Kan spelaren flytta den? Tennisbollar faller men går inte att byta.
export function kanBytas(s, i) {
  const t = s.tiles[i]
  if (!s.mask[i] || !t) return false
  if (t.typ === 'kott') return true
  return t.typ === 'bit' && !s.koppel[i]
}

// ---------------------------------------------------------------- matchning

// Alla matchningar på brädet, grupperade. En grupp är sammanhängande rutor
// i samma färg som ingår i minst en löpa på tre eller en 2×2-ruta.
//
// flyttade är [dit, fran] för spelarens byte — specialpjäsen hamnar där
// man drog, om den rutan ingår i gruppen.
export function hittaGrupper(s, flyttade = null) {
  const { w, h, tiles } = s
  const farg = (i) => (matchbar(tiles[i]) ? tiles[i].farg : -1)

  const hLopor = []
  const vLopor = []
  const rutor = []

  for (let r = 0; r < h; r++) {
    let c = 0
    while (c < w) {
      const f = farg(r * w + c)
      if (f < 0) {
        c++
        continue
      }
      let e = c + 1
      while (e < w && farg(r * w + e) === f) e++
      if (e - c >= 3) {
        const celler = []
        for (let x = c; x < e; x++) celler.push(r * w + x)
        hLopor.push(celler)
      }
      c = e
    }
  }
  for (let c = 0; c < w; c++) {
    let r = 0
    while (r < h) {
      const f = farg(r * w + c)
      if (f < 0) {
        r++
        continue
      }
      let e = r + 1
      while (e < h && farg(e * w + c) === f) e++
      if (e - r >= 3) {
        const celler = []
        for (let y = r; y < e; y++) celler.push(y * w + c)
        vLopor.push(celler)
      }
      r = e
    }
  }
  for (let r = 0; r < h - 1; r++) {
    for (let c = 0; c < w - 1; c++) {
      const i = r * w + c
      const f = farg(i)
      if (f >= 0 && farg(i + 1) === f && farg(i + w) === f && farg(i + w + 1) === f) {
        rutor.push([i, i + 1, i + w, i + w + 1])
      }
    }
  }

  const matchade = new Set()
  for (const l of hLopor) l.forEach((i) => matchade.add(i))
  for (const l of vLopor) l.forEach((i) => matchade.add(i))
  for (const q of rutor) q.forEach((i) => matchade.add(i))
  if (matchade.size === 0) return []

  // sammanhängande komponenter i samma färg
  const gruppAv = new Map()
  const grupper = []
  for (const start of matchade) {
    if (gruppAv.has(start)) continue
    const f = farg(start)
    const g = { celler: [], farg: f }
    const ko = [start]
    gruppAv.set(start, g)
    while (ko.length) {
      const i = ko.pop()
      g.celler.push(i)
      for (const n of grannar(s, i)) {
        if (matchade.has(n) && !gruppAv.has(n) && farg(n) === f) {
          gruppAv.set(n, g)
          ko.push(n)
        }
      }
    }
    grupper.push(g)
  }

  for (const g of grupper) {
    const hL = hLopor.filter((l) => gruppAv.get(l[0]) === g)
    const vL = vLopor.filter((l) => gruppAv.get(l[0]) === g)
    const qs = rutor.filter((q) => gruppAv.get(q[0]) === g)
    const maxH = Math.max(0, ...hL.map((l) => l.length))
    const maxV = Math.max(0, ...vL.map((l) => l.length))
    const iH = new Set(hL.flat())
    const korsning = vL.flat().find((i) => iH.has(i))

    let special = null
    let standard = null
    if (maxH >= 5 || maxV >= 5) {
      special = 'skal'
      const l = maxH >= maxV ? hL.find((x) => x.length === maxH) : vL.find((x) => x.length === maxV)
      standard = l[Math.floor(l.length / 2)]
    } else if (korsning !== undefined) {
      special = 'bomb'
      standard = korsning
    } else if (maxH === 4 || maxV === 4) {
      special = maxH === 4 ? 'raket-h' : 'raket-v'
      const l = maxH === 4 ? hL.find((x) => x.length === 4) : vL.find((x) => x.length === 4)
      standard = l[1]
    } else if (qs.length > 0) {
      special = 'frisbee'
      standard = qs[0][3]
    }

    g.special = special
    g.plats = null
    if (special) {
      const fria = g.celler.filter((i) => !s.koppel[i] && !s.tiles[i].happy)
      if (flyttade && fria.includes(flyttade[0])) g.plats = flyttade[0]
      else if (flyttade && fria.includes(flyttade[1])) g.plats = flyttade[1]
      else if (fria.includes(standard)) g.plats = standard
      else g.plats = fria[0] ?? null
      if (g.plats === null) g.special = null
    }
  }

  return grupper
}

// ------------------------------------------------------------ utlösningar

// Vilka rutor en specialpjäs träffar. Returnerar en källa som komponenten
// kan spela upp: { i, id, special, farg, omrade, mal }.
function omrade(s, i, t, ctx, redan) {
  const { w, h } = s
  const r = Math.floor(i / w)
  const c = i % w
  const ut = new Set()
  const ruta = (mr, mc, radie) => {
    for (let y = mr - radie; y <= mr + radie; y++) {
      for (let x = mc - radie; x <= mc + radie; x++) {
        if (y >= 0 && y < h && x >= 0 && x < w && s.mask[y * w + x]) ut.add(y * w + x)
      }
    }
  }

  const kalla = {
    i,
    id: t.id,
    special: t.special,
    orig: t.orig || null,
    farg: t.farg,
    omrade: null,
    mal: null,
    radie: t.radie || 1,
    linjer: [],
  }

  // En raket far åt båda hållen från (rr, cc) tills den når kanten eller en
  // tennisboll. Bollen tar smällen och stoppar raketen. Hål i brädet flyger
  // den rakt över. Linjerna sparas så att animationen stannar på samma ställe.
  const linje = (rr, cc, lodrat) => {
    if (rr < 0 || rr >= h || cc < 0 || cc >= w) return
    const start = rr * w + cc
    const langd = { minus: 0, plus: 0 }
    if (s.mask[start]) ut.add(start)
    for (const [riktning, nyckel] of [
      [-1, 'minus'],
      [1, 'plus'],
    ]) {
      let y = rr
      let x = cc
      for (;;) {
        if (lodrat) y += riktning
        else x += riktning
        if (y < 0 || y >= h || x < 0 || x >= w) break
        langd[nyckel]++
        const j = y * w + x
        if (!s.mask[j]) continue
        ut.add(j)
        const q = s.tiles[j]
        if (q && q.typ === 'boll') break
      }
    }
    kalla.linjer.push({ i: start, lodrat, minus: langd.minus, plus: langd.plus })
  }

  switch (t.special) {
    case 'raket-h':
      linje(r, c, false)
      break
    case 'raket-v':
      linje(r, c, true)
      break
    case 'kors':
      linje(r, c, false)
      linje(r, c, true)
      break
    case 'kors3':
      for (const d of [-1, 0, 1]) {
        linje(r + d, c, false)
        linje(r, c + d, true)
      }
      break
    case 'bomb':
      ruta(r, c, t.radie || 1)
      break
    case 'skal': {
      const f = ctx.skalFarg ?? vanligasteFarg(s, redan)
      kalla.farg = f
      ut.add(i)
      s.tiles.forEach((x, j) => {
        if (x && x.typ === 'bit' && x.farg === f) ut.add(j)
      })
      break
    }
    case 'frisbee': {
      ut.add(i)
      for (const n of grannar(s, i)) ut.add(n)
      const antal = t.antal || 1
      const mal = []
      const undvik = new Set([...redan, ...ut])
      for (let k = 0; k < antal; k++) {
        const m = valjMal(s, undvik, i)
        if (m === null) break
        mal.push(m)
        undvik.add(m)
        ut.add(m)
        // frisbeen kan bära med sig en raket eller en bomb
        const mr = Math.floor(m / w)
        const mc = m % w
        if (t.last === 'raket-h') linje(mr, mc, false)
        if (t.last === 'raket-v') linje(mr, mc, true)
        if (t.last === 'bomb') ruta(mr, mc, 1)
      }
      kalla.mal = mal
      kalla.last = t.last || null
      break
    }
    default:
      ut.add(i)
  }

  kalla.omrade = [...ut]
  return kalla
}

function vanligasteFarg(s, undvik) {
  const rakning = new Array(s.farger).fill(0)
  s.tiles.forEach((t, j) => {
    if (t && t.typ === 'bit' && !t.special && !(undvik && undvik.has(j))) rakning[t.farg]++
  })
  return rakning.indexOf(Math.max(...rakning))
}

// Frisbeen letar upp det banan behöver mest: lera, hinder, koppel, rutan
// under ett köttben, sedan färger man ska samla. Annars en slumpad pjäs.
function valjMal(s, undvik, fran) {
  const { w } = s
  const behovFarg = new Set(
    s.mal.filter((m) => m.typ === 'farg' && s.samlat.farg[m.farg] < m.antal).map((m) => m.farg)
  )
  const underKott = new Set()
  s.tiles.forEach((t, j) => {
    if (t && t.typ === 'kott' && s.nedanfor[j] >= 0) underKott.add(s.nedanfor[j])
  })

  let bast = null
  let bastVarde = -1
  for (let j = 0; j < s.tiles.length; j++) {
    if (!s.mask[j] || undvik.has(j) || j === fran) continue
    const t = s.tiles[j]
    let v = 0
    if (t && t.typ === 'lada') v = 60 + t.hp
    else if (t && t.typ === 'ograss') v = 62
    else if (t && t.typ === 'boll') v = 56
    else if (t && t.typ === 'bit' && t.klocka) v = 64 - t.klocka
    else if (s.koppel[j]) v = 58
    else if (s.lera[j] > 0 && (!t || t.typ === 'bit')) v = 50 + s.lera[j] * 5
    else if (underKott.has(j) && t && t.typ === 'bit') v = 40
    else if (t && t.typ === 'bit' && behovFarg.has(t.farg)) v = 20
    else if (t && t.typ === 'bit' && t.happy) continue
    else if (t && t.typ === 'bit' && t.paket) v = 30
    else if (t && t.typ === 'bit') v = 1
    else continue
    v += s.rng() * 4
    // lite hellre något i närheten, så flygturen inte alltid går tvärs över
    v -= (Math.abs(rad(s, j) - rad(s, fran)) + Math.abs(kol(s, j) - kol(s, fran))) * 0.05 * (w / 9)
    if (v > bastVarde) {
      bastVarde = v
      bast = j
    }
  }
  return bast
}

// Samlar ihop allt som träffas när startcellerna rensas: specialpjäser i
// vägen utlöses och drar med sig sina områden. Brädet ändras inte här.
function samla(s, start, ctx = {}) {
  const rensas = new Set()
  const kallor = []
  const aktiverade = ctx.aktiverade || new Set()
  const ko = [...start]

  while (ko.length) {
    const i = ko.shift()
    if (rensas.has(i)) continue
    rensas.add(i)
    const t = s.tiles[i]
    if (ctx.utanKedja) continue
    if (t && t.typ === 'bit' && t.special && !aktiverade.has(t.id) && !s.koppel[i]) {
      aktiverade.add(t.id)
      const k = omrade(s, i, t, ctx, rensas)
      kallor.push(k)
      for (const j of k.omrade) if (!rensas.has(j)) ko.push(j)
    }
  }
  return { rensas, kallor, aktiverade }
}

// Rensar på riktigt. Returnerar vad som hände, för animation och poäng.
// matning: ruta -> hur mycket Happy i den rutan äter (en hel grupp han
// ingår i). Utan post äter han ett godis per träff.
function tillampa(s, rensas, kallor, kaskad = 1, matning = null) {
  const utlosta = new Set(kallor.map((k) => k.id))
  const res = {
    borta: [],
    lador: [],
    ograss: [],
    koppel: [],
    lera: [],
    armerade: [],
    bollar: [],
    matad: [],
    paket: [],
    poang: 0,
  }

  const skadaLera = (i) => {
    if (s.lera[i] > 0) {
      s.lera[i]--
      res.lera.push({ i, niva: s.lera[i] })
      res.poang += POANG.lera
    }
  }

  for (const k of kallor) {
    // en laddad bomb som smäller sin andra gång är redan räknad
    const t = s.tiles[k.i]
    if (t && t.id === k.id && t.armerad) continue
    const typ = grundtyp(k.orig || k.special)
    if (typ in s.samlat.special) s.samlat.special[typ]++
  }

  for (const i of rensas) {
    const t = s.tiles[i]
    if (!t) {
      skadaLera(i)
      continue
    }
    if (t.typ === 'lada') {
      t.hp--
      res.lador.push({ i, id: t.id, hp: t.hp })
      res.poang += POANG.lada
      if (t.hp <= 0) s.tiles[i] = null
      continue
    }
    if (t.typ === 'ograss') {
      s.tiles[i] = null
      s.ograsBortDettaDrag = true
      res.ograss.push({ i, id: t.id })
      res.poang += POANG.ograss
      continue
    }
    if (t.typ === 'kott') continue
    if (t.typ === 'boll') {
      s.tiles[i] = null
      s.samlat.boll++
      res.bollar.push({ i, id: t.id })
      res.poang += POANG.boll
      continue
    }

    // en vanlig bit
    if (s.koppel[i]) {
      s.koppel[i] = false
      res.koppel.push(i)
      res.poang += POANG.koppel
      skadaLera(i)
      continue
    }
    if (t.happy) {
      // Happy försvinner aldrig. Han äter, och byter färg när han ätit.
      const fore = t.mage
      t.mage = Math.min(HAPPY_MATT, t.mage + (matning?.get(i) ?? 1))
      if (t.mage > fore) {
        const andra = [...Array(s.farger).keys()].filter((f) => f !== t.farg)
        t.farg = andra[Math.floor(s.rng() * andra.length)]
      }
      res.matad.push({ i, id: t.id, mage: t.mage, farg: t.farg })
      skadaLera(i)
      continue
    }
    if (t.special === 'bomb' && !t.armerad && utlosta.has(t.id)) {
      // första smällen: bomben ligger kvar, laddad, och smäller igen efter fallet
      t.armerad = true
      res.armerade.push(i)
      skadaLera(i)
      continue
    }
    s.tiles[i] = null
    res.borta.push({ i, id: t.id, farg: t.farg, special: t.special, klocka: t.klocka ? 1 : 0 })
    s.samlat.farg[t.farg]++
    if (t.klocka) s.samlat.klocka++
    res.poang += POANG.bit * kaskad
    skadaLera(i)
    if (t.paket) res.paket.push(oppnaPaket(s, i, t))
  }

  // Happy äter också godis som smäller precis bredvid honom
  if (res.borta.length) {
    const hi = hittaHappy(s)
    if (hi >= 0 && !rensas.has(hi)) {
      const h = s.tiles[hi]
      const runt = new Set(grannar(s, hi))
      const n = res.borta.filter((b) => runt.has(b.i)).length
      if (n && h.mage < HAPPY_MATT) {
        h.mage = Math.min(HAPPY_MATT, h.mage + n)
        res.matad.push({ i: hi, id: h.id, mage: h.mage, farg: h.farg, bredvid: true })
      }
    }
  }

  s.poang += res.poang
  return res
}

// Ett paket smäller: dra en överraskning och lägg den i rutan. Specialpjäser
// och tennisbollar hamnar på brädet, drag och mynt räknas direkt.
function oppnaPaket(s, i, gammal) {
  s.samlat.paket++
  const lista = PAKET.filter((x) => !(s.iFinal && (x.utfall === 'drag' || x.utfall === 'boll')))
  const summa = lista.reduce((a, x) => a + x.vikt, 0)
  let r = s.rng() * summa
  let utfall = lista[lista.length - 1].utfall
  for (const x of lista) {
    r -= x.vikt
    if (r < 0) {
      utfall = x.utfall
      break
    }
  }
  const ut = { i, id: gammal.id, utfall, nyId: null }
  if (utfall === 'drag') s.drag += 3
  else if (utfall === 'mynt') s.paketMynt += 25
  else if (utfall === 'boll') {
    const t = { id: s.nextId++, typ: 'boll' }
    s.tiles[i] = t
    ut.nyId = t.id
  } else {
    const special = utfall === 'raket' ? (s.rng() < 0.5 ? 'raket-h' : 'raket-v') : utfall
    const t = nyBit(s, Math.floor(s.rng() * s.farger), special)
    s.tiles[i] = t
    ut.nyId = t.id
  }
  return ut
}

// Rensar en uppsättning celler med kedjor och allt. Bekvämlighet för
// boosters och kombos.
function rensa(s, start, ctx = {}, kaskad = 1) {
  const { rensas, kallor } = samla(s, start, ctx)
  const res = tillampa(s, rensas, kallor, kaskad)
  return { typ: 'rensa', kaskad, kallor, rensas: [...rensas], ...res, grupper: [], nya: [] }
}

// ---------------------------------------------------------------- tyngdkraft

// Låter allt falla, i takt. Varje takt flyttar varje pjäs högst ett steg:
// rakt ner i första hand, snett ner om rutan under inte kan fyllas uppifrån
// (en låda eller ett koppel är i vägen). Nya pjäser kommer in överst.
//
// Returnerar spåren så komponenten kan animera exakt samma väg:
// [{ id, ny, spar: [{ t, r, c }] }]
export function gravitation(s) {
  const { w, h, mask, tiles } = s
  const spar = new Map()
  const nya = new Set()

  const noter = (t, takt, r, c) => {
    let a = spar.get(t.id)
    if (!a) {
      a = []
      spar.set(t.id, a)
    }
    a.push({ t: takt, r, c })
  }
  const flytta = (t, fran, till, takt) => {
    const a = spar.get(t.id)
    const fr = Math.floor(fran / w)
    const fc = fran % w
    if (!a) noter(t, takt - 1, fr, fc)
    else if (a[a.length - 1].t < takt - 1) noter(t, takt - 1, fr, fc)
    noter(t, takt, Math.floor(till / w), till % w)
  }

  // Kan rutan fyllas uppifrån? Följ kolumnen uppåt förbi tomma rutor.
  const blockeradOvan = (i) => {
    let j = s.ovanfor[i]
    while (j >= 0) {
      const t = tiles[j]
      if (t) return !rorlig(s, j)
      j = s.ovanfor[j]
    }
    return false
  }

  for (let takt = 1; takt < 400; takt++) {
    let andrat = false
    const flyttad = new Set()

    for (let r = h - 1; r >= 0; r--) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c
        if (!mask[i] || tiles[i]) continue
        const o = s.ovanfor[i]
        if (o < 0) {
          const t = inkommande(s, c)
          tiles[i] = t
          nya.add(t.id)
          noter(t, takt - 1, r - 1, c)
          noter(t, takt, r, c)
          flyttad.add(t.id)
          andrat = true
          continue
        }
        const t = tiles[o]
        if (t && rorlig(s, o) && !flyttad.has(t.id)) {
          tiles[i] = t
          tiles[o] = null
          flytta(t, o, i, takt)
          flyttad.add(t.id)
          andrat = true
        }
      }
    }

    for (let r = h - 1; r >= 1; r--) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c
        if (!mask[i] || tiles[i] || !blockeradOvan(i)) continue
        const ordning = (takt + c) % 2 ? [-1, 1] : [1, -1]
        for (const dc of ordning) {
          const c2 = c + dc
          if (c2 < 0 || c2 >= w) continue
          const j = (r - 1) * w + c2
          if (!mask[j] || !rorlig(s, j)) continue
          const t = tiles[j]
          if (flyttad.has(t.id)) continue
          // snett bara om den inte kan falla rakt ner
          const under = s.nedanfor[j]
          if (under >= 0 && !tiles[under]) continue
          tiles[i] = t
          tiles[j] = null
          flytta(t, j, i, takt)
          flyttad.add(t.id)
          andrat = true
          break
        }
      }
    }

    if (!andrat) break
  }

  return [...spar].map(([id, a]) => ({ id, ny: nya.has(id), spar: a }))
}

// Vad som kommer in överst i en kolumn: oftast en slumpad pjäs, ibland ett
// köttben om banan har sådana kvar att släppa.
function inkommande(s, c) {
  const k = s.kott
  if (k && k.kvar > 0) {
    const paBradet = s.tiles.filter((t) => t && t.typ === 'kott').length
    if (paBradet < k.max && (paBradet === 0 || s.rng() < 0.12)) {
      k.kvar--
      return { id: s.nextId++, typ: 'kott' }
    }
  }
  const b = s.bollar
  if (b) {
    const antal = s.tiles.filter((t) => t && t.typ === 'boll').length
    if (antal < (b.max || 6) && s.rng() < (b.chans || 0.07)) return { id: s.nextId++, typ: 'boll' }
  }
  const bit = nyBit(s, Math.floor(s.rng() * s.farger))
  const pk = s.paket
  if (pk && !s.iFinal) {
    const antal = s.tiles.filter((t) => t && t.paket).length
    if (antal < (pk.max || 3) && s.rng() < (pk.chans || 0.04)) bit.paket = true
  }
  const kl = s.klockor
  if (kl && !s.iFinal && !bit.paket) {
    const antal = s.tiles.filter((t) => t && t.typ === 'bit' && t.klocka).length
    if (antal < (kl.max || 3) && s.rng() < (kl.chans || 0.04)) bit.klocka = kl.tid || 15
  }
  return bit
}

// Köttben som nått botten lämnas till Happy.
function leverera(s) {
  const ut = []
  for (const i of s.utgangar) {
    const t = s.tiles[i]
    if (t && t.typ === 'kott') {
      s.tiles[i] = null
      s.levererade++
      s.poang += POANG.kott
      ut.push({ i, id: t.id })
    }
  }
  return ut
}

function* fall(s) {
  for (let varv = 0; varv < 12; varv++) {
    const moves = gravitation(s)
    if (moves.length) yield { typ: 'fall', moves }
    const lev = leverera(s)
    if (!lev.length) return
    yield { typ: 'leverans', celler: lev }
  }
}

// --------------------------------------------------------------- dragen

function arKombo(ta, tb) {
  if (!ta || !tb || ta.typ !== 'bit' || tb.typ !== 'bit') return false
  if (ta.special && tb.special) return true
  return ta.special === 'skal' || tb.special === 'skal'
}

// Ger bytet något? Muterar inte brädet.
export function giltigtByte(s, a, b) {
  if (!arGrannar(s, a, b) || !kanBytas(s, a) || !kanBytas(s, b)) return false
  const ta = s.tiles[a]
  const tb = s.tiles[b]
  if (arKombo(ta, tb)) return true
  s.tiles[a] = tb
  s.tiles[b] = ta
  const ok = hittaGrupper(s).length > 0
  s.tiles[a] = ta
  s.tiles[b] = tb
  return ok
}

export function harDrag(s) {
  return hittaDrag(s, true).length > 0
}

// Alla giltiga drag, eller bara det första om forsta är satt.
export function hittaDrag(s, forsta = false) {
  const { w, h } = s
  const ut = []
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c
      if (!kanBytas(s, i)) continue
      for (const j of [c + 1 < w ? i + 1 : -1, r + 1 < h ? i + w : -1]) {
        if (j < 0 || !kanBytas(s, j)) continue
        if (giltigtByte(s, i, j)) {
          ut.push([i, j])
          if (forsta) return ut
        }
      }
    }
  }
  return ut
}

// Bästa draget att visa som tips: kombos först, sedan det som skapar en
// specialpjäs, sedan det som tar flest pjäser.
export function hittaTips(s) {
  let bast = null
  for (const [a, b] of hittaDrag(s)) {
    const ta = s.tiles[a]
    const tb = s.tiles[b]
    let varde
    let celler
    if (arKombo(ta, tb)) {
      varde = 100
      celler = [a, b]
    } else {
      s.tiles[a] = tb
      s.tiles[b] = ta
      const g = hittaGrupper(s, [b, a]).filter((x) => x.celler.includes(a) || x.celler.includes(b))
      s.tiles[a] = ta
      s.tiles[b] = tb
      celler = g.flatMap((x) => x.celler)
      varde = celler.length + g.filter((x) => x.special).length * 10
      // cellerna gäller efter bytet, men tipset vaggar pjäserna där de
      // ligger nu: byt plats på a och b i listan
      celler = celler.map((x) => (x === a ? b : x === b ? a : x))
    }
    varde += s.rng() * 0.5
    if (!bast || varde > bast.varde) bast = { a, b, celler, varde }
  }
  return bast
}

// Ett drag från början till slut. a är där spelaren tog tag, b dit den drogs.
export function* spelaDrag(s, a, b) {
  s.drag--
  s.ograsBortDettaDrag = false
  yield* byteOchUpplosning(s, a, b)
  yield* efterDrag(s)
}

function* byteOchUpplosning(s, a, b) {
  const ta = s.tiles[a]
  s.tiles[a] = s.tiles[b]
  s.tiles[b] = ta
  yield { typ: 'byte', a, b }

  if (arKombo(s.tiles[b], s.tiles[a])) yield* kombo(s, b, a)
  yield* kaskad(s, [b, a])
}

// Kedjorna: matcha, rensa, skapa specialer, fall, om och om igen tills
// brädet står still. Laddade bomber smäller en andra gång efter fallet.
function* kaskad(s, flyttade = null, kaskadStart = 0) {
  let k = kaskadStart
  for (let varv = 0; varv < 60; varv++) {
    const grupper = hittaGrupper(s, flyttade)
    flyttade = null

    if (grupper.length === 0) {
      const laddade = []
      s.tiles.forEach((t, i) => {
        if (t && t.typ === 'bit' && t.armerad) laddade.push(i)
      })
      if (!laddade.length) return
      k++
      // andra smällen: bomben är redan utlöst, så den rensar sig själv
      const aktiverade = new Set()
      const start = new Set()
      const kallor = []
      for (const i of laddade) {
        const t = s.tiles[i]
        aktiverade.add(t.id)
        const kalla = omrade(s, i, t, {}, start)
        kalla.andra = true
        kallor.push(kalla)
        kalla.omrade.forEach((j) => start.add(j))
      }
      const rest = samla(s, start, { aktiverade })
      const alla = [...kallor, ...rest.kallor]
      // räkna inte bomben två gånger i statistiken
      const res = tillampa(s, rest.rensas, rest.kallor, k)
      yield { typ: 'rensa', kaskad: k, kallor: alla, rensas: [...rest.rensas], ...res, grupper: [], nya: [] }
      yield* fall(s)
      continue
    }

    k++
    const start = new Set()
    for (const g of grupper) g.celler.forEach((i) => start.add(i))
    // lådor och ogräs bredvid en matchning tar skada
    for (const g of grupper) {
      for (const i of g.celler) {
        for (const n of grannar(s, i)) {
          const t = s.tiles[n]
          if (t && (t.typ === 'lada' || t.typ === 'ograss' || t.typ === 'boll')) start.add(n)
        }
      }
    }

    const { rensas, kallor } = samla(s, start)
    // Happy i en grupp äter hela gruppen
    const matning = new Map()
    for (const g of grupper) {
      for (const i of g.celler) if (s.tiles[i]?.happy) matning.set(i, (matning.get(i) || 0) + g.celler.length - 1)
    }
    const res = tillampa(s, rensas, kallor, k, matning)

    const nya = []
    for (const g of grupper) {
      if (!g.special) continue
      let plats = g.plats
      if (s.tiles[plats]) plats = g.celler.find((i) => !s.tiles[i] && !s.koppel[i]) ?? null
      if (plats === null) continue
      const t = nyBit(s, g.farg, g.special)
      s.tiles[plats] = t
      nya.push({ i: plats, id: t.id, special: g.special, farg: g.farg, celler: g.celler })
    }

    yield {
      typ: 'rensa',
      kaskad: k,
      grupper: grupper.map((g) => ({ celler: g.celler, farg: g.farg, special: g.special })),
      kallor,
      rensas: [...rensas],
      ...res,
      nya,
    }
    yield* fall(s)
  }
}

// Två specialpjäser (eller godisskålen och vad som helst) byter plats.
// c är där spelaren drog pjäsen, o är den andra rutan.
function* kombo(s, c, o) {
  const A = s.tiles[c]
  const B = s.tiles[o]
  const sa = A.special
  const sb = B.special

  // Pjäser som kombon förbrukar direkt. De rapporteras i stegets borta så
  // att de spricker på skärmen i stället för att bara försvinna.
  const taBort = (i) => {
    const t = s.tiles[i]
    s.tiles[i] = null
    s.samlat.farg[t.farg]++
    const typ = grundtyp(t.special)
    if (typ in s.samlat.special) s.samlat.special[typ]++
    return { i, id: t.id, farg: t.farg, special: t.special }
  }

  // skål + skål: hela brädet
  if (sa === 'skal' && sb === 'skal') {
    const forbrukade = [taBort(o), taBort(c)]
    const alla = []
    for (let i = 0; i < s.tiles.length; i++) if (s.mask[i]) alla.push(i)
    const steg = rensa(s, alla, { utanKedja: true }, 2)
    steg.borta.unshift(...forbrukade)
    steg.sammanslagen = { fran: o, till: c }
    steg.kombo = 'skal-skal'
    steg.kallor = [{ i: c, id: A.id, special: 'skal-skal', farg: A.farg, omrade: alla }]
    steg.kombobeskrivning = 'Hela brädet!'
    yield steg
    yield* fall(s)
    return
  }

  if (sa === 'skal' || sb === 'skal') {
    const si = sa === 'skal' ? c : o
    const ti = sa === 'skal' ? o : c
    const annan = s.tiles[ti]
    const skal = s.tiles[si]

    if (!annan.special) {
      // skålen tar alla av den sorten
      const forbrukad = taBort(si)
      const celler = []
      s.tiles.forEach((t, j) => {
        if (t && t.typ === 'bit' && t.farg === annan.farg) celler.push(j)
      })
      const { rensas, kallor } = samla(s, celler)
      kallor.unshift({ i: si, id: skal.id, special: 'skal', farg: annan.farg, omrade: celler })
      const res = tillampa(s, rensas, kallor.slice(1), 2)
      res.borta.unshift(forbrukad)
      yield { typ: 'rensa', kaskad: 2, kallor, rensas: [...rensas], ...res, grupper: [], nya: [], kombo: 'skal' }
      yield* fall(s)
      return
    }

    // skål + special: alla av den sorten blir samma special och avfyras
    const forbrukad = taBort(si)
    const till = grundtyp(annan.special)
    const celler = []
    s.tiles.forEach((t, j) => {
      if (enkel(t) && t.farg === annan.farg && !s.koppel[j]) {
        t.special = till === 'raket' ? (s.rng() < 0.5 ? 'raket-h' : 'raket-v') : till
        celler.push(j)
      }
    })
    yield {
      typ: 'omvandla',
      fran: si,
      celler,
      special: till,
      farg: annan.farg,
      bort: forbrukad,
      kombobeskrivning: till === 'raket' ? 'Raketregn!' : till === 'bomb' ? 'Bombregn!' : 'Frisbeeregn!',
    }
    const aktiverade = new Set()
    for (const j of [ti, ...celler]) {
      const t = s.tiles[j]
      if (!t || t.typ !== 'bit' || !t.special || aktiverade.has(t.id)) continue
      const { rensas, kallor } = samla(s, [j], { aktiverade })
      const res = tillampa(s, rensas, kallor, 2)
      yield { typ: 'rensa', kaskad: 2, kallor, rensas: [...rensas], ...res, grupper: [], nya: [], sekvens: true }
    }
    yield* fall(s)
    return
  }

  // två specialpjäser utan skål: B glider in i A, A blir kombinationen
  const forbrukad = taBort(o)
  A.orig = sa
  let beskrivning = ''
  if (arRaket(sa) && arRaket(sb)) {
    A.special = 'kors'
    beskrivning = 'Kors!'
  } else if ((arRaket(sa) && sb === 'bomb') || (sa === 'bomb' && arRaket(sb))) {
    A.special = 'kors3'
    beskrivning = 'Trippelkors!'
  } else if (sa === 'bomb' && sb === 'bomb') {
    A.special = 'bomb'
    A.radie = 2
    beskrivning = 'Storsmäll!'
  } else if (sa === 'frisbee' && sb === 'frisbee') {
    A.special = 'frisbee'
    A.antal = 3
    beskrivning = 'Tre frisbees!'
  } else {
    // frisbee + raket eller bomb: frisbeen tar med sig den andra
    A.special = 'frisbee'
    A.last = sa === 'frisbee' ? sb : sa
    beskrivning = arRaket(A.last) ? 'Frisbee med raket!' : 'Frisbee med bomb!'
  }
  const { rensas, kallor } = samla(s, [c])
  const res = tillampa(s, rensas, kallor, 2)
  res.borta.unshift(forbrukad)
  yield {
    typ: 'rensa',
    kaskad: 2,
    kallor,
    rensas: [...rensas],
    ...res,
    grupper: [],
    nya: [],
    kombo: A.special,
    kombobeskrivning: beskrivning,
    sammanslagen: { fran: o, till: c },
  }
  yield* fall(s)
}

// Efter draget: klockorna tickar, ogräset växer om man inte tog bort något,
// och brädet blandas om det inte finns några drag kvar.
function* efterDrag(s) {
  if (!malKlara(s)) {
    const tick = tickaKlockor(s)
    if (tick) {
      yield tick
      if (s.klockaRingde !== null) return
    }
  }
  if (!s.ograsBortDettaDrag && !malKlara(s)) {
    const steg = vaxOgras(s)
    if (steg) yield steg
  }
  if (!harDrag(s)) {
    blandaBradet(s)
    yield { typ: 'blanda' }
  }
}

// Varje klocka på brädet tickar ett steg. Når någon noll är banan förlorad.
function tickaKlockor(s) {
  const celler = []
  let ringde = null
  s.tiles.forEach((t, i) => {
    if (t && t.typ === 'bit' && t.klocka) {
      t.klocka--
      celler.push(i)
      if (t.klocka <= 0 && ringde === null) ringde = i
    }
  })
  if (!celler.length) return null
  s.klockaRingde = ringde
  return { typ: 'klocka', celler, ringde }
}

function vaxOgras(s) {
  const kandidater = []
  s.tiles.forEach((t, i) => {
    if (!t || t.typ !== 'ograss') return
    for (const n of grannar(s, i)) {
      const x = s.tiles[n]
      if (enkel(x) && !s.koppel[n]) kandidater.push([i, n])
    }
  })
  if (!kandidater.length) return null
  const [fran, till] = kandidater[Math.floor(s.rng() * kandidater.length)]
  const gammal = s.tiles[till]
  s.tiles[till] = { id: s.nextId++, typ: 'ograss' }
  return { typ: 'ograss', fran, till, gammalId: gammal.id }
}

// ------------------------------------------------------------ omblandning

// Blandar alla lösa pjäser (inte hinder, inte koppel, inte köttben) tills
// det inte finns några färdiga matchningar men minst ett drag.
export function blandaBradet(s) {
  const platser = []
  s.tiles.forEach((t, i) => {
    if (t && t.typ === 'bit' && !s.koppel[i]) platser.push(i)
  })
  const bitar = platser.map((i) => s.tiles[i])

  for (let forsok = 0; forsok < 120; forsok++) {
    for (let k = bitar.length - 1; k > 0; k--) {
      const j = Math.floor(s.rng() * (k + 1))
      ;[bitar[k], bitar[j]] = [bitar[j], bitar[k]]
    }
    platser.forEach((i, k) => (s.tiles[i] = bitar[k]))
    if (hittaGrupper(s).length === 0 && harDrag(s)) return true
  }

  // Färgfördelningen gick inte att blanda rätt. Måla om de vanliga pjäserna.
  for (let forsok = 0; forsok < 120; forsok++) {
    for (const i of platser) {
      const t = s.tiles[i]
      if (enkel(t)) s.tiles[i] = null
    }
    for (const i of platser) if (!s.tiles[i]) s.tiles[i] = nyBit(s, sakerFarg(s, i))
    if (hittaGrupper(s).length === 0 && harDrag(s)) return true
  }
  return false
}

// ----------------------------------------------------------------- boosters

// ------------------------------------------------------------------- Happy

export function hittaHappy(s) {
  return s.tiles.findIndex((t) => t && t.happy)
}

export const happyRedo = (s, i) => Boolean(s.tiles[i]?.happy && s.tiles[i].mage >= HAPPY_MATT)

// Happy kan landa på en vanlig pjäs som inte sitter i koppel.
export function kanLanda(s, i) {
  const t = s.tiles[i]
  return Boolean(s.mask[i] && t && t.typ === 'bit' && !t.happy && !s.koppel[i])
}

// Happy hoppar från fran till till, smäller 3×3 där han landar och börjar
// om med tom mage. Kostar inget drag — det är belöningen för att ha matat
// honom.
export function* happyHopp(s, fran, till) {
  const happy = s.tiles[fran]
  s.ograsBortDettaDrag = true
  s.samlat.hopp++
  s.tiles[fran] = null
  yield { typ: 'hopp', fran, till, id: happy.id }

  const { w, h } = s
  const r = Math.floor(till / w)
  const c = till % w
  const omr = []
  for (let y = r - 1; y <= r + 1; y++) {
    for (let x = c - 1; x <= c + 1; x++) {
      if (y >= 0 && y < h && x >= 0 && x < w && s.mask[y * w + x]) omr.push(y * w + x)
    }
  }
  const steg = rensa(s, omr, {}, 2)
  steg.poang += POANG.hopp
  s.poang += POANG.hopp
  steg.hopp = { till }
  yield steg

  // landa där han siktade, annars i en tom ruta bredvid, annars där han stod
  happy.mage = 0
  const plats = !s.tiles[till] ? till : omr.find((j) => !s.tiles[j]) ?? (!s.tiles[fran] ? fran : null)
  if (plats !== null && plats !== undefined) {
    s.tiles[plats] = happy
    yield { typ: 'landa', i: plats, id: happy.id }
  }
  yield* fall(s)
  yield* kaskad(s, null, 1)
  if (!harDrag(s)) {
    blandaBradet(s)
    yield { typ: 'blanda' }
  }
}

// ------------------------------------------------------------- handledning

// Mönster som lärs ut på banorna där en ny specialpjäs introduceras. X är
// godiset som ska matchas, Y något annat. Draget flyttar pjäsen på fran
// till till, och då ska gruppen bli specialen.
const MONSTER = {
  raket: { celler: [[0, 0, 'X'], [0, 1, 'X'], [0, 2, 'Y'], [0, 3, 'X'], [1, 2, 'X']], fran: [1, 2], till: [0, 2], special: 'raket' },
  bomb: { celler: [[0, 0, 'X'], [0, 1, 'X'], [0, 2, 'Y'], [0, 3, 'X'], [1, 2, 'X'], [2, 2, 'X']], fran: [0, 3], till: [0, 2], special: 'bomb' },
  frisbee: { celler: [[0, 0, 'X'], [0, 1, 'X'], [1, 0, 'X'], [1, 1, 'Y'], [2, 1, 'X']], fran: [2, 1], till: [1, 1], special: 'frisbee' },
  skal: { celler: [[0, 0, 'X'], [0, 1, 'X'], [0, 2, 'Y'], [0, 3, 'X'], [0, 4, 'X'], [1, 2, 'X']], fran: [1, 2], till: [0, 2], special: 'skal' },
}
export const HAR_MONSTER = Object.keys(MONSTER)

// Målar in ett mönster på brädet så att handen kan visa exakt draget som
// ger specialpjäsen. Returnerar [fran, till] eller null om det inte fick
// plats någonstans.
export function planteraMonster(s, typ) {
  const m = MONSTER[typ]
  if (!m) return null
  const { w, h } = s
  const hojd = Math.max(...m.celler.map((x) => x[0])) + 1
  const bredd = Math.max(...m.celler.map((x) => x[1])) + 1
  const platser = []
  for (let r = 0; r + hojd <= h; r++) for (let c = 0; c + bredd <= w; c++) platser.push([r, c])
  // helst nära mitten
  platser.sort((a, b) => Math.abs(a[0] + hojd / 2 - h / 2) + Math.abs(a[1] + bredd / 2 - w / 2) - (Math.abs(b[0] + hojd / 2 - h / 2) + Math.abs(b[1] + bredd / 2 - w / 2)))

  for (const [r0, c0] of platser) {
    const celler = m.celler.map(([dr, dc, x]) => [(r0 + dr) * w + c0 + dc, x])
    if (!celler.every(([i]) => s.mask[i] && enkel(s.tiles[i]) && !s.koppel[i] && !s.tiles[i].klocka)) continue
    const runt = new Set()
    for (const [i] of celler) for (const n of grannar(s, i)) if (!celler.some(([j]) => j === n) && enkel(s.tiles[n])) runt.add(n)
    const sparat = s.tiles.map((t) => (t ? { ...t } : null))
    const X = Math.floor(s.rng() * s.farger)
    const Y = (X + 1 + Math.floor(s.rng() * (s.farger - 1))) % s.farger
    for (let forsok = 0; forsok < 25; forsok++) {
      for (const [i, x] of celler) s.tiles[i].farg = x === 'X' ? X : Y
      for (const n of runt) {
        const val = [...Array(s.farger).keys()].filter((f) => f !== X)
        s.tiles[n].farg = val[Math.floor(s.rng() * val.length)]
      }
      if (hittaGrupper(s).length) continue
      const fran = (r0 + m.fran[0]) * w + c0 + m.fran[1]
      const till = (r0 + m.till[0]) * w + c0 + m.till[1]
      const a = s.tiles[fran]
      s.tiles[fran] = s.tiles[till]
      s.tiles[till] = a
      const g = hittaGrupper(s, [till, fran]).find((x) => x.celler.includes(till))
      s.tiles[till] = s.tiles[fran]
      s.tiles[fran] = a
      if (g && grundtyp(g.special) === m.special && harDrag(s)) return [fran, till]
    }
    sparat.forEach((t, i) => (s.tiles[i] = t))
  }
  return null
}

// Tassen: krossa valfri ruta. Räknas inte som ett drag.
export function* tassen(s, i) {
  s.ograsBortDettaDrag = true
  const steg = rensa(s, [i], {}, 1)
  steg.tass = i
  yield steg
  yield* fall(s)
  yield* kaskad(s, null, 1)
  if (!harDrag(s)) {
    blandaBradet(s)
    yield { typ: 'blanda' }
  }
}

// Byt fritt: två grannar byter plats även om det inte blir någon matchning.
export function* bytFritt(s, a, b) {
  s.ograsBortDettaDrag = true
  yield* byteOchUpplosning(s, a, b)
  if (!harDrag(s)) {
    blandaBradet(s)
    yield { typ: 'blanda' }
  }
}

export function kanBytasFritt(s, a, b) {
  return arGrannar(s, a, b) && kanBytas(s, a) && kanBytas(s, b)
}

// Startboosters läggs ut på slumpade vanliga pjäser innan första draget.
export function laggUtSpecialer(s, lista) {
  const lediga = []
  s.tiles.forEach((t, i) => {
    if (enkel(t) && !s.koppel[i]) lediga.push(i)
  })
  const ut = []
  for (const special of lista) {
    if (!lediga.length) break
    const k = Math.floor(s.rng() * lediga.length)
    const i = lediga.splice(k, 1)[0]
    s.tiles[i].special = special === 'raket' ? (s.rng() < 0.5 ? 'raket-h' : 'raket-v') : special
    ut.push(i)
  }
  return ut
}

// ----------------------------------------------------------------- finalen

// Godisregnet: när målen är klara blir varje drag som är kvar en raket,
// och sedan smäller allt som ligger på brädet. Som när man vinner i
// Candy Crush — det är där de flesta stjärnorna kommer ifrån.
export function* godisregn(s, maxDrag = 25) {
  s.iFinal = true
  const antal = Math.min(s.drag, maxDrag)
  for (let k = 0; k < antal; k++) {
    const lediga = []
    s.tiles.forEach((t, i) => {
      if (enkel(t) && !s.koppel[i]) lediga.push(i)
    })
    s.drag--
    if (!lediga.length) continue
    const i = lediga[Math.floor(s.rng() * lediga.length)]
    s.tiles[i].special = s.rng() < 0.5 ? 'raket-h' : 'raket-v'
    yield { typ: 'omvandla', fran: 'drag', celler: [i], special: 'raket', farg: s.tiles[i].farg, regn: true }
  }
  s.drag = 0
  yield* slutsmall(s)
}

// Alla specialpjäser som ligger kvar smäller, en i taget, våg efter våg.
export function* slutsmall(s, maxVagor = 20) {
  s.iFinal = true
  for (let vag = 1; vag <= maxVagor; vag++) {
    const kvar = []
    s.tiles.forEach((t, i) => {
      if (t && t.typ === 'bit' && t.special) kvar.push(t.id)
    })
    if (!kvar.length) return
    yield { typ: 'vag', vag }
    const aktiverade = new Set()
    for (const id of kvar) {
      const i = s.tiles.findIndex((t) => t && t.id === id)
      if (i < 0 || aktiverade.has(id)) continue
      const { rensas, kallor } = samla(s, [i], { aktiverade })
      const res = tillampa(s, rensas, kallor, vag)
      yield { typ: 'rensa', kaskad: vag, kallor, rensas: [...rensas], ...res, grupper: [], nya: [], sekvens: true }
    }
    yield* fall(s)
    yield* kaskad(s, null, vag)
  }
}

// -------------------------------------------------------------------- mål

// Varje mål med hur mycket som är kvar. Mål som gäller "allt av något"
// räknas om från brädet, så ogräs som växer syns direkt.
export function malStatus(s) {
  return s.mal.map((m) => {
    let kvar = 0
    let totalt = m.antal || 0
    switch (m.typ) {
      case 'poang':
        kvar = Math.max(0, m.antal - s.poang)
        break
      case 'lera':
        kvar = s.lera.reduce((a, b) => a + b, 0)
        break
      case 'lada':
        kvar = s.tiles.filter((t) => t && t.typ === 'lada').length
        break
      case 'ograss':
        kvar = s.tiles.filter((t) => t && t.typ === 'ograss').length
        break
      case 'koppel':
        kvar = s.koppel.filter(Boolean).length
        break
      case 'kott':
        kvar = Math.max(0, m.antal - s.levererade)
        break
      case 'farg':
        kvar = Math.max(0, m.antal - s.samlat.farg[m.farg])
        break
      case 'special':
        kvar = Math.max(0, m.antal - s.samlat.special[m.special])
        break
      case 'boll':
        kvar = Math.max(0, m.antal - s.samlat.boll)
        break
      case 'klocka':
        kvar = Math.max(0, m.antal - s.samlat.klocka)
        break
      case 'hopp':
        kvar = Math.max(0, m.antal - s.samlat.hopp)
        break
      case 'paket':
        kvar = Math.max(0, m.antal - s.samlat.paket)
        break
    }
    return { ...m, kvar, totalt, klar: kvar === 0 }
  })
}

export function malKlara(s) {
  return malStatus(s).every((m) => m.klar)
}

// Poängbanor spelas tills dragen är slut. Alla andra är vunna så fort
// målen är klara.
export function arPoangbana(s) {
  return s.mal.length > 0 && s.mal.every((m) => m.typ === 'poang')
}

export function stjarnorFor(poang, grans) {
  let n = 0
  for (const g of grans) if (poang >= g) n++
  return n
}
