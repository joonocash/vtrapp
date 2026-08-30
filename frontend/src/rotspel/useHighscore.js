import { useState, useEffect, useCallback } from 'react'

const API = '/api/scores'
const PLAYER_KEY = 'rotspel_player'

// Enkel identitet: ett namn i localStorage. Inget lösenord, inget konto.
// Räcker för en sida bara du och kompisar når via Tailscale.
export function usePlayer() {
  const [player, setPlayerState] = useState(() => {
    try {
      return localStorage.getItem(PLAYER_KEY) || ''
    } catch {
      return ''
    }
  })

  const setPlayer = useCallback((name) => {
    const clean = String(name || '').trim().slice(0, 20)
    if (!clean) return
    try {
      localStorage.setItem(PLAYER_KEY, clean)
    } catch {
      // privat läge, strunt samma
    }
    setPlayerState(clean)
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(PLAYER_KEY)
    } catch {
      // ignorera
    }
    setPlayerState('')
  }, [])

  return { player, setPlayer, logout }
}

// Alla personbästa för en spelare, som { [gameId]: score }
export function useMyBests(player) {
  const [bests, setBests] = useState({})
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    if (!player) {
      setBests({})
      return
    }
    setLoading(true)
    fetch(`${API}/me?player=${encodeURIComponent(player)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('kunde inte hämta'))))
      .then((data) => setBests(data.bests || {}))
      .catch(() => setBests({}))
      .finally(() => setLoading(false))
  }, [player])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { bests, loading, refresh }
}

// Topplista för ett spel
export function useLeaderboard(gameId, lowerIsBetter = false) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!gameId) return
    setLoading(true)
    fetch(`${API}/${encodeURIComponent(gameId)}?lowerIsBetter=${lowerIsBetter ? 'true' : 'false'}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('kunde inte hämta'))))
      .then((data) => setEntries(data.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [gameId, lowerIsBetter])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { entries, loading, refresh }
}

export async function submitScore(gameId, player, score, lowerIsBetter = false) {
  if (!gameId || !player || typeof score !== 'number' || !Number.isFinite(score)) return null
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, player, score: Math.round(score), lowerIsBetter }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Formatering av poäng till text
export function formatScore(value, format = 'number') {
  if (value === null || value === undefined) return '—'
  if (format === 'time') {
    const total = Math.max(0, Math.round(value))
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return Math.round(value).toLocaleString('sv-SE')
}
