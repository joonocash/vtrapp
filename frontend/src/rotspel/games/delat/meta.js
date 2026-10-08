// Delat för de nya rötspelen: plånbok, sparläge per spel, vinstsviter,
// kistor och topplistan "högsta bana".
//
// Mynten är gemensamma för Pilflykt, Pixelkanon, Skruvat och Hållplatsen —
// man tjänar i ett spel och handlar boosters i ett annat. Allt sparas i
// webbläsaren. Topplistan går mot den vanliga /api/scores.

import { useCallback, useEffect, useRef, useState } from 'react'
import { mulberry32, viktat, heltal } from './rng.js'

const PLANBOK = 'rotspel-planbok-v1'
const PLAYER_KEY = 'rotspel_player'
export const STARTMYNT = 150
export const KISTA_VAR = 5 // vinster per kista

/* ---------------------------------------------------------------- plånbok */

const lyssnare = new Set()

export function lasMynt() {
  try {
    const raw = localStorage.getItem(PLANBOK)
    if (!raw) return STARTMYNT
    const v = JSON.parse(raw).mynt
    return Number.isFinite(v) ? v : STARTMYNT
  } catch {
    return STARTMYNT
  }
}

function skrivMynt(v) {
  try {
    localStorage.setItem(PLANBOK, JSON.stringify({ mynt: v }))
  } catch {
    /* privat läge */
  }
  lyssnare.forEach((f) => f(v))
}

export function laggTillMynt(n) {
  skrivMynt(Math.max(0, lasMynt() + Math.round(n)))
}

// Drar mynt om det finns. Returnerar true om köpet gick igenom.
export function betala(n) {
  const nu = lasMynt()
  if (nu < n) return false
  skrivMynt(nu - n)
  return true
}

export function useMynt() {
  const [mynt, setMynt] = useState(lasMynt)
  useEffect(() => {
    const f = (v) => setMynt(v)
    lyssnare.add(f)
    const s = (e) => e.key === PLANBOK && setMynt(lasMynt())
    window.addEventListener('storage', s)
    return () => {
      lyssnare.delete(f)
      window.removeEventListener('storage', s)
    }
  }, [])
  return mynt
}

/* ----------------------------------------------------------- sparläge */

export function laddaSpar(id, standard) {
  try {
    const raw = localStorage.getItem(id)
    if (!raw) return { ...standard }
    const s = JSON.parse(raw)
    return { ...standard, ...s, boost: { ...standard.boost, ...(s.boost || {}) } }
  } catch {
    return { ...standard }
  }
}

// Sparläget skrivs till localStorage direkt i set-anropet, inte i en effekt
// efteråt — annars kan en vinst gå förlorad om man lämnar spelet samma
// ögonblick (komponenten hinner försvinna innan effekten körs).
export function useSpar(id, standard) {
  const [spar, setState] = useState(() => laddaSpar(id, standard))
  const ref = useRef(spar)
  const setSpar = useCallback(
    (u) => {
      const ny = typeof u === 'function' ? u(ref.current) : u
      ref.current = ny
      try {
        localStorage.setItem(id, JSON.stringify(ny))
      } catch {
        /* privat läge */
      }
      setState(ny)
    },
    [id]
  )
  // Tredje värdet: alltid det senaste sparläget, även före nästa render.
  return [spar, setSpar, ref]
}

export { svarighet } from './svarighet.js'

/* ------------------------------------------------------- belöningar */

// Räknar ut vinsten för en klarad bana och uppdaterar sparläget.
// Returnerar { spar, resultat } där resultat beskriver allt vinstkortet visar.
export function belona(spar, { gameId, niva, svar = 'normal', perfekt = false, extra = 0, boostTyper = [] }) {
  // Svår = dubbla mynt, supersvår = tredubbla (det banderollen lovar).
  const bas = 10 * (svar === 'svår' ? 2 : svar === 'supersvår' ? 3 : 1)
  const perfektBonus = perfekt ? 5 : 0
  const svit = (spar.svit || 0) + 1
  const svitBonus = Math.min(svit - 1, 5) * 4
  const kistaFore = spar.kista || 0
  let kista = kistaFore + 1
  let kistaVinst = null
  if (kista >= KISTA_VAR) {
    kista = 0
    kistaVinst = oppnaKista(niva, boostTyper)
  }
  const mynt = bas + perfektBonus + svitBonus + Math.round(extra)
  const boost = { ...(spar.boost || {}) }
  if (kistaVinst) {
    for (const [typ, n] of Object.entries(kistaVinst.boost)) boost[typ] = (boost[typ] || 0) + n
  }
  laggTillMynt(mynt + (kistaVinst ? kistaVinst.mynt : 0))
  const nySpar = {
    ...spar,
    niva: niva + 1,
    basta: Math.max(spar.basta || 0, niva),
    svit,
    kista,
    boost,
    vinster: (spar.vinster || 0) + 1,
  }
  skickaNiva(gameId, niva)
  return {
    spar: nySpar,
    resultat: { niva, svar, perfekt, bas, perfektBonus, svitBonus, extra: Math.round(extra), svit, mynt, kistaFore, kista, kistaVinst },
  }
}

export function forlust(spar) {
  return { ...spar, svit: 0, forluster: (spar.forluster || 0) + 1 }
}

// Kistan är slumpad — det är hela poängen. Mest mynt, ibland boosters,
// sällan jackpott.
export function oppnaKista(niva, boostTyper) {
  const r = mulberry32((Date.now() ^ (niva * 7919)) >>> 0)
  const typ = viktat(r, [
    [46, 'mynt'],
    [26, 'boost'],
    [16, 'mycket'],
    [9, 'dubbel'],
    [3, 'jackpott'],
  ])
  const valjBoost = () => boostTyper[Math.floor(r() * boostTyper.length)]
  const ut = { typ, mynt: 0, boost: {} }
  if (typ === 'mynt') ut.mynt = heltal(r, 25, 60)
  if (typ === 'mycket') ut.mynt = heltal(r, 80, 150)
  if (typ === 'jackpott') ut.mynt = 400
  if ((typ === 'boost' || typ === 'dubbel') && boostTyper.length) {
    const a = valjBoost()
    ut.boost[a] = (ut.boost[a] || 0) + 1
    if (typ === 'dubbel') {
      const b = valjBoost()
      ut.boost[b] = (ut.boost[b] || 0) + 1
      ut.mynt = heltal(r, 20, 40)
    }
  }
  if ((typ === 'boost' || typ === 'dubbel') && !boostTyper.length) ut.mynt = heltal(r, 40, 80)
  return ut
}

/* ------------------------------------------------------- topplista */

export function spelarnamn() {
  try {
    return localStorage.getItem(PLAYER_KEY) || null
  } catch {
    return null
  }
}

// Topplistan i GameShell visar högsta klarade bana. Servern sparar bara
// spelarens bästa, så det gör inget att skicka samma siffra igen.
export async function skickaNiva(gameId, niva) {
  const player = spelarnamn()
  if (!gameId || !player) return
  try {
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, player, score: niva, lowerIsBetter: false }),
    })
  } catch {
    /* offline, spela vidare */
  }
}

// Kombinerad hook för spelets state som ofta behövs.
export function useBoostKop(setSpar) {
  return useCallback(
    (typ, pris) => {
      if (!betala(pris)) return false
      setSpar((s) => ({ ...s, boost: { ...s.boost, [typ]: (s.boost[typ] || 0) + 1 } }))
      return true
    },
    [setSpar]
  )
}
