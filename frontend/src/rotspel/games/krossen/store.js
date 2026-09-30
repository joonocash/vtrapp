// Krossen — det som sparas i webbläsaren: stjärnor, mynt, boosters och
// vilka tips man redan sett. Allt i en nyckel.

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
})

export function ladda() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return tom()
    const s = JSON.parse(raw)
    const t = tom()
    return { ...t, ...s, boosters: { ...t.boosters, ...(s.boosters || {}) } }
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
export function belonning(s, nr, stjarnor) {
  const forut = stjarnorFor(s, nr)
  if (!forut) return 20 + stjarnor * 10
  if (stjarnor > forut) return (stjarnor - forut) * 10
  return 5
}

export function registreraVinst(s, nr, stjarnor, poang) {
  const mynt = belonning(s, nr, stjarnor)
  return {
    ...s,
    stjarnor: { ...s.stjarnor, [nr]: Math.max(stjarnorFor(s, nr), stjarnor) },
    poang: { ...s.poang, [nr]: Math.max(s.poang[nr] || 0, poang) },
    mynt: s.mynt + mynt,
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
