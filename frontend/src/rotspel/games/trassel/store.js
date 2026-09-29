// Trassel — det som sparas i webbläsaren, och Dagens Trassel.

const KEY = 'trassel-v1'
const PLAYER_KEY = 'rotspel_player' // samma som usePlayer() i useHighscore.js

const tom = () => ({ stars: {}, senast: null, dagar: {}, symboler: false, tidsjaktBast: 0 })

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return tom()
    return { ...tom(), ...JSON.parse(raw) }
  } catch {
    return tom()
  }
}

export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* privat läge */ }
}

export function playerName() {
  try { return localStorage.getItem(PLAYER_KEY) || null } catch { return null }
}

// Stjärnor för en bana: 'paketId:index' -> 1..3. Behåll alltid det bästa.
export function setStars(s, packId, index, stars) {
  const k = `${packId}:${index}`
  if ((s.stars[k] || 0) >= stars) return s
  return { ...s, stars: { ...s.stars, [k]: stars } }
}

export const starsFor = (s, packId, index) => s.stars[`${packId}:${index}`] || 0

export function packProgress(s, pack) {
  let solved = 0, stars = 0
  pack.banor.forEach((_, i) => {
    const st = starsFor(s, pack.id, i)
    if (st) solved++
    stars += st
  })
  return { solved, stars, total: pack.banor.length }
}

// En bana är öppen om den är bland de tre första olösta i paketet — man kan
// hoppa över en jobbig bana eller två, men inte hela paketet.
export function unlocked(s, pack, index) {
  let unsolvedBefore = 0
  for (let i = 0; i < index; i++) if (!starsFor(s, pack.id, i)) unsolvedBefore++
  return unsolvedBefore < 3
}

export function nextLevel(s, packs) {
  // Fortsätt där man slutade, annars första olösta banan i första paketet med olösta.
  if (s.senast) {
    const p = packs.find((x) => x.id === s.senast.pack)
    if (p && s.senast.index < p.banor.length) return s.senast
  }
  for (const p of packs) {
    const i = p.banor.findIndex((_, j) => !starsFor(s, p.id, j))
    if (i >= 0) return { pack: p.id, index: i }
  }
  return { pack: packs[0].id, index: 0 }
}

/* ---------- Dagens Trassel ---------- */

const pad = (n) => String(n).padStart(2, '0')
export const dateStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Samma bana för alla samma dag: veckodagen väljer tema, veckonumret väljer bana.
export function dailyFor(dagliga, d = new Date()) {
  const weekday = (d.getDay() + 6) % 7 // måndag = 0
  const epoch = Date.UTC(2026, 0, 5) // en måndag
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const week = Math.floor((today - epoch) / (7 * 86400000))
  const day = dagliga[weekday]
  const idx = ((week % day.banor.length) + day.banor.length) % day.banor.length
  return { level: day.banor[idx], tema: day.tema, date: dateStr(d), weekday }
}

// Antal dagar i rad med löst Dagens Trassel, som slutar i dag eller i går.
export function streak(s, d = new Date()) {
  const has = (x) => Boolean(s.dagar[dateStr(x)])
  const cur = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (!has(cur)) cur.setDate(cur.getDate() - 1)
  let n = 0
  while (has(cur)) { n++; cur.setDate(cur.getDate() - 1) }
  return n
}

export function formatMs(ms) {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${m}:${pad(sec)}`
}

/* ---------- topplistor mot /api/scores ---------- */

export async function submitScore(gameId, score, lowerIsBetter) {
  const player = playerName()
  if (!player) return null
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, player, score: Math.round(score), lowerIsBetter }),
    })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

export async function topList(gameId, lowerIsBetter, limit = 10) {
  try {
    const res = await fetch(`/api/scores/${encodeURIComponent(gameId)}?lowerIsBetter=${lowerIsBetter ? 'true' : 'false'}`)
    if (!res.ok) return null
    const data = await res.json()
    return (data.entries || []).slice(0, limit)
  } catch {
    return null
  }
}
