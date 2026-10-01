// Krossen — det som sparas: stjärnor, mynt, boosters, sedda tips, de
// dagliga belöningarna, vinstsviten och stjärnkistorna. Allt i en nyckel i
// webbläsaren, och samma sparläge synkas till servern (se synk.js).
//
// Allt här är rena funktioner som tar ett sparläge och ger ett nytt, så de
// går att testa utan webbläsare.

const KEY = 'krossen-v2'

export const BOOSTERS = {
  // under banan
  tass: { namn: 'Tassen', text: 'Krossa valfri ruta', pris: 60 },
  byt: { namn: 'Byt fritt', text: 'Byt två grannar utan matchning', pris: 50 },
  blanda: { namn: 'Blanda', text: 'Blanda om brädet', pris: 30 },
  // före första draget
  plus3: { namn: '+3 drag', text: 'Tre extra drag', pris: 50 },
  raketbomb: { namn: 'Raket + bomb', text: 'Börja med en raket och en bomb', pris: 70 },
  skal: { namn: 'Godisskål', text: 'Börja med en godisskål', pris: 100 },
}

// Boostrarna dyker upp först när grunderna är lärda.
export const BOOSTER_FRAN = { tass: 4, byt: 6, blanda: 4, plus3: 7, raketbomb: 9, skal: 12 }

export const EXTRA_DRAG = { antal: 5, pris: [80, 160, 240] }

const tom = () => ({
  stjarnor: {},
  poang: {},
  mynt: 150,
  boosters: { tass: 2, byt: 2, blanda: 2, plus3: 1, raketbomb: 1, skal: 0 },
  sett: {},
  musik: false,
  svit: 0,
  kistor: 0,
  dagligt: { serie: 0, inloggad: null, hjul: null, dagens: null, dagensPoang: 0 },
  oandlig: 0,
  album: 1,
  albumSett: 1,
  garderob: { agda: [], pa: { huvud: null, hals: null, ogon: null } },
  godis: 0,
  skalNiva: 0,
  stat: tomStat(),
  uppdaterad: 0,
})

function tomStat() {
  return {
    farg: [0, 0, 0, 0, 0, 0],
    special: { raket: 0, bomb: 0, skal: 0, frisbee: 0 },
    storstaKedja: 0,
    storstaDrag: 0,
    vunna: 0,
    forlorade: 0,
    hopp: 0,
    paket: 0,
    hinder: 0,
  }
}

// Gör ett sparläge komplett: fält som tillkommit sedan det sparades får
// sina startvärden.
export function komplettera(s) {
  const t = tom()
  if (!s || typeof s !== 'object') return t
  return {
    ...t,
    ...s,
    boosters: { ...t.boosters, ...(s.boosters || {}) },
    dagligt: { ...t.dagligt, ...(s.dagligt || {}) },
    garderob: {
      agda: (s.garderob && s.garderob.agda) || [],
      pa: { ...t.garderob.pa, ...((s.garderob && s.garderob.pa) || {}) },
    },
    stat: { ...tomStat(), ...(s.stat || {}), special: { ...tomStat().special, ...((s.stat && s.stat.special) || {}) } },
    stjarnor: s.stjarnor || {},
    poang: s.poang || {},
    sett: s.sett || {},
  }
}

export function ladda() {
  try {
    const raw = localStorage.getItem(KEY)
    return komplettera(raw ? JSON.parse(raw) : null)
  } catch {
    return tom()
  }
}

export function spara(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // privat läge, strunt samma
  }
}

// ----------------------------------------------------------------- banorna

export const stjarnorFor = (s, nr) => s.stjarnor[nr] || 0

// En bana är öppen om den förra är klarad. Som på kartan i Candy Crush:
// ingen hoppar över en bana.
export const oppen = (s, nr) => nr === 1 || stjarnorFor(s, nr - 1) > 0

export function hogstaOppna(s, antal) {
  let n = 1
  while (n < antal && oppen(s, n + 1)) n++
  return n
}

export function totaltStjarnor(s) {
  return Object.values(s.stjarnor).reduce((a, b) => a + b, 0)
}

// Belöning i mynt för en vunnen bana. Första gången ger mest, fler stjärnor
// än förra gången ger lite till, en omspelning ger en slant.
// Svåra banor ger extra första gången: +20 för svår, +40 för supersvår.
export const SVAR_BONUS = [0, 20, 40]

export function belonning(s, nr, stjarnor, svarighet = 0) {
  const forut = stjarnorFor(s, nr)
  if (!forut) return 20 + stjarnor * 10 + SVAR_BONUS[svarighet]
  if (stjarnor > forut) return (stjarnor - forut) * 10
  return 5
}

export function registreraVinst(s, nr, stjarnor, poang, svarighet = 0) {
  const mynt = belonning(s, nr, stjarnor, svarighet)
  return {
    ...s,
    stjarnor: { ...s.stjarnor, [nr]: Math.max(stjarnorFor(s, nr), stjarnor) },
    poang: { ...s.poang, [nr]: Math.max(s.poang[nr] || 0, poang) },
    mynt: s.mynt + mynt,
    svit: (s.svit || 0) + 1,
  }
}

// Använd en booster: ur förrådet om det finns, annars köp den för mynt.
// Returnerar det nya sparläget, eller null om det inte gick.
export function anvandBooster(s, typ) {
  if ((s.boosters[typ] || 0) > 0) {
    return { ...s, boosters: { ...s.boosters, [typ]: s.boosters[typ] - 1 } }
  }
  const pris = BOOSTERS[typ].pris
  if (s.mynt < pris) return null
  return { ...s, mynt: s.mynt - pris }
}

// En belöning är { mynt, booster } (båda valfria). Läggs på sparläget.
export function geBelonning(s, b) {
  let ny = { ...s, mynt: s.mynt + (b.mynt || 0) }
  if (b.booster) ny = { ...ny, boosters: { ...ny.boosters, [b.booster]: (ny.boosters[b.booster] || 0) + (b.antal || 1) } }
  return ny
}

export function beskrivBelonning(b) {
  const delar = []
  if (b.booster) delar.push((b.antal > 1 ? b.antal + ' × ' : '') + BOOSTERS[b.booster].namn)
  if (b.mynt) delar.push(b.mynt + ' mynt')
  return delar.join(' + ')
}

// -------------------------------------------------------------- vinstsvit

// Vinner man banor i rad börjar nästa bana med allt fler specialpjäser.
// En förlorad (eller lämnad) bana nollställer sviten.
export const SVIT_BOOST = [[], ['raket'], ['raket', 'bomb'], ['raket', 'bomb', 'skal']]
export const svitBoost = (s) => SVIT_BOOST[Math.min(SVIT_BOOST.length - 1, s.svit || 0)]
export const brytSvit = (s) => (s.svit ? { ...s, svit: 0 } : s)

// --------------------------------------------------------------- dagar

// Datum som text i spelarens egen tidszon, YYYY-MM-DD.
export function datum(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function dagenFore(text) {
  const [y, m, d] = text.split('-').map(Number)
  return datum(new Date(y, m - 1, d - 1))
}

// Inloggningsserien: sju dagar med allt bättre belöningar. Missar man en
// dag börjar den om på dag ett.
export const SERIE = [
  { mynt: 20 },
  { mynt: 30 },
  { booster: 'tass' },
  { mynt: 50 },
  { booster: 'byt' },
  { mynt: 80 },
  { booster: 'skal', mynt: 100 },
]

// Första gången spelet öppnas en ny dag. Returnerar null om dagen redan
// är räknad, annars { save, dag, belonning }.
export function nyDag(s, idag) {
  const d = s.dagligt
  if (d.inloggad === idag) return null
  const dag = d.inloggad === dagenFore(idag) ? (d.serie % SERIE.length) + 1 : 1
  const belonning = SERIE[dag - 1]
  const save = geBelonning({ ...s, dagligt: { ...d, inloggad: idag, serie: dag } }, belonning)
  return { save, dag, belonning }
}

// Lyckohjulet: ett snurr per dag. vikt styr hur ofta en sektor vinner.
export const HJUL = [
  { mynt: 20, vikt: 20, farg: '#ffd21f' },
  { booster: 'blanda', vikt: 14, farg: '#34c05a' },
  { mynt: 50, vikt: 14, farg: '#2f8af0' },
  { booster: 'tass', vikt: 12, farg: '#ff8a1c' },
  { mynt: 100, vikt: 7, farg: '#a452ec' },
  { booster: 'byt', vikt: 12, farg: '#f03a5f' },
  { booster: 'plus3', vikt: 14, farg: '#2fc9b0' },
  { booster: 'skal', vikt: 7, farg: '#ff6bd6' },
]

export const kanSnurra = (s, idag) => s.dagligt.hjul !== idag

export function snurra(rng = Math.random) {
  const summa = HJUL.reduce((a, x) => a + x.vikt, 0)
  let r = rng() * summa
  for (let k = 0; k < HJUL.length; k++) {
    r -= HJUL[k].vikt
    if (r < 0) return k
  }
  return HJUL.length - 1
}

export function taHjul(s, idag, index) {
  return geBelonning({ ...s, dagligt: { ...s.dagligt, hjul: idag } }, HJUL[index])
}

// Dagens bana: första vinsten för dagen ger mynt. Bästa poängen sparas.
export const DAGENS_BELONNING = 50
export const dagensKlar = (s, idag) => s.dagligt.dagens === idag

export function registreraDagens(s, idag, poang) {
  const forsta = s.dagligt.dagens !== idag
  const d = { ...s.dagligt, dagens: idag, dagensPoang: forsta ? poang : Math.max(s.dagligt.dagensPoang || 0, poang) }
  return { ...s, mynt: s.mynt + (forsta ? DAGENS_BELONNING : 0), dagligt: d }
}

// ------------------------------------------------------------- stjärnkistan

// Var tjugonde stjärna fyller en kista.
export const KISTA_VAR = 20

export function kistStatus(s) {
  const total = totaltStjarnor(s)
  const fyllda = Math.floor(total / KISTA_VAR)
  return { redo: Math.max(0, fyllda - (s.kistor || 0)), mot: total % KISTA_VAR, total }
}

const KIST_BOOSTERS = ['tass', 'byt', 'blanda', 'plus3', 'raketbomb', 'skal']

export function oppnaKista(s, rng = Math.random) {
  if (kistStatus(s).redo <= 0) return null
  const b1 = KIST_BOOSTERS[Math.floor(rng() * KIST_BOOSTERS.length)]
  const b2 = KIST_BOOSTERS[Math.floor(rng() * KIST_BOOSTERS.length)]
  const innehall = [{ mynt: 60 }, { booster: b1 }, { booster: b2 }]
  let save = { ...s, kistor: (s.kistor || 0) + 1 }
  for (const b of innehall) save = geBelonning(save, b)
  return { save, innehall }
}

// ------------------------------------------------------ oändliga promenaden

export const registreraOandlig = (s, n) => ({ ...s, oandlig: Math.max(s.oandlig || 0, n) })

// ----------------------------------------------------------- Happys album

// album är hur många foton som är upplåsta (de tas i filnamnsordning),
// albumSett hur många spelaren har tittat på. Bossar och stjärnkistor låser
// upp ett nytt foto var.
export const laggTillFoto = (s) => ({ ...s, album: (s.album || 1) + 1 })
export const albumNya = (s, max) => Math.max(0, Math.min(s.album, max) - (s.albumSett || 0))
export const albumSett = (s, max) => ({ ...s, albumSett: Math.min(s.album, max) })

// ------------------------------------------------------------ garderoben

export function kopKlader(s, sak) {
  if (s.garderob.agda.includes(sak.id)) return s
  if (s.mynt < sak.pris) return null
  return {
    ...s,
    mynt: s.mynt - sak.pris,
    garderob: { agda: [...s.garderob.agda, sak.id], pa: { ...s.garderob.pa, [sak.plats]: sak.id } },
  }
}

export function taPa(s, sak) {
  if (!s.garderob.agda.includes(sak.id)) return s
  const pa = s.garderob.pa[sak.plats] === sak.id ? null : sak.id
  return { ...s, garderob: { ...s.garderob, pa: { ...s.garderob.pa, [sak.plats]: pa } } }
}

// ----------------------------------------------------- Happys godisskål

// Allt godis man samlar fyller skålen. Varje nivå kräver lite mer än förra.
export const skalKrav = (niva) => 300 + niva * 150
export function skalLage(godis) {
  let niva = 0
  let kvar = godis
  while (kvar >= skalKrav(niva)) {
    kvar -= skalKrav(niva)
    niva++
  }
  return { niva, fyllt: kvar, krav: skalKrav(niva) }
}

const SKAL_BOOSTERS = ['tass', 'byt', 'blanda', 'plus3', 'raketbomb', 'skal']
export const skalBelonning = (niva) => ({ mynt: 40 + niva * 10, booster: SKAL_BOOSTERS[niva % SKAL_BOOSTERS.length] })

// Lägger till godis och delar ut belöningar för nya nivåer. Returnerar
// { save, nivaer: [{ niva, belonning }] }.
export function registreraGodis(s, antal) {
  let save = { ...s, godis: (s.godis || 0) + antal }
  const { niva } = skalLage(save.godis)
  const nivaer = []
  for (let n = (s.skalNiva || 0) + 1; n <= niva; n++) {
    const b = skalBelonning(n)
    save = geBelonning(save, b)
    nivaer.push({ niva: n, belonning: b })
  }
  save.skalNiva = Math.max(save.skalNiva || 0, niva)
  return { save, nivaer }
}

// ------------------------------------------------------------ statistik

// sammanfattning kommer från spelplanen när en bana tar slut.
export function registreraStat(s, sammanfattning, vann) {
  const st = { ...tomStat(), ...(s.stat || {}) }
  const sm = sammanfattning
  return {
    ...s,
    stat: {
      ...st,
      farg: st.farg.map((x, k) => x + (sm.farg[k] || 0)),
      special: Object.fromEntries(Object.keys(st.special).map((k) => [k, (st.special[k] || 0) + (sm.special[k] || 0)])),
      storstaKedja: Math.max(st.storstaKedja, sm.storstaKedja || 0),
      storstaDrag: Math.max(st.storstaDrag, sm.storstaDrag || 0),
      vunna: st.vunna + (vann ? 1 : 0),
      forlorade: st.forlorade + (vann ? 0 : 1),
      hopp: st.hopp + (sm.hopp || 0),
      paket: st.paket + (sm.paket || 0),
      hinder: st.hinder + (sm.hinder || 0),
    },
  }
}

// ------------------------------------------------------------- synk

// Slår ihop två sparlägen, t.ex. från telefonen och datorn. Stjärnor och
// bästa poäng tar det bästa från båda. Resten tas från det som sparades
// senast, utom datum och kistor som aldrig får gå bakåt (annars kunde man
// ta samma dagliga belöning två gånger genom att byta enhet).
export function sammanfoga(a, b) {
  if (!b) return a
  if (!a) return b
  const [ny, gammal] = (a.uppdaterad || 0) >= (b.uppdaterad || 0) ? [a, b] : [b, a]
  const max = (x, y) => {
    const ut = { ...x }
    for (const [k, v] of Object.entries(y || {})) ut[k] = Math.max(ut[k] || 0, v)
    return ut
  }
  const senast = (x, y) => (!x ? y : !y ? x : x > y ? x : y)
  const dagligt = { ...gammal.dagligt, ...ny.dagligt }
  dagligt.inloggad = senast(ny.dagligt.inloggad, gammal.dagligt.inloggad)
  dagligt.hjul = senast(ny.dagligt.hjul, gammal.dagligt.hjul)
  dagligt.dagens = senast(ny.dagligt.dagens, gammal.dagligt.dagens)
  return komplettera({
    ...gammal,
    ...ny,
    stjarnor: max(ny.stjarnor, gammal.stjarnor),
    poang: max(ny.poang, gammal.poang),
    sett: { ...gammal.sett, ...ny.sett },
    kistor: Math.max(ny.kistor || 0, gammal.kistor || 0),
    dagligt,
    oandlig: Math.max(ny.oandlig || 0, gammal.oandlig || 0),
    album: Math.max(ny.album || 1, gammal.album || 1),
    albumSett: Math.max(ny.albumSett || 1, gammal.albumSett || 1),
    godis: Math.max(ny.godis || 0, gammal.godis || 0),
    skalNiva: Math.max(ny.skalNiva || 0, gammal.skalNiva || 0),
    garderob: {
      agda: [...new Set([...(gammal.garderob?.agda || []), ...(ny.garderob?.agda || [])])],
      pa: { ...(gammal.garderob?.pa || {}), ...(ny.garderob?.pa || {}) },
    },
  })
}
