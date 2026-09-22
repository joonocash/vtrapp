import { useEffect, useRef } from 'react'
import { mountRevir } from './revir/revir.js'
import { ALBUM_CAPTIONS } from './revir/config.js'
import { readSettings } from '../useSettings.js'
import './revir/revir.css'
import glad from './revir/img/happy-glad.webp'
import ledsen from './revir/img/happy-ledsen.webp'
import nojd from './revir/img/happy-nojd.webp'

// Happys revir i Rötspel.
//
// Spelet är skrivet som en vanilla-modul (revir/revir.js) som monteras i en div.
// Den här komponenten kopplar ihop den med Rötspel:
//   - ljud och skärmskak följer reglagen i GameShell (useSettings)
//   - topplistan går mot /api/scores med spelarnamnet från Rötspel
//   - albumet byggs av alla bilder i revir/album/
//
// Spelet har en egen resultatruta och egen topplista per läge, så registret har
// scoreFormat: 'none' och onGameOver anropas inte. Annars skulle GameShell visa en
// andra resultatpanel under spelet.

// Alla bilder i revir/album/ blir albumbilder, i filnamnsordning.
const albumFiles = import.meta.glob('./revir/album/*.{webp,jpg,jpeg,png}', { eager: true, import: 'default' })
const ALBUM = Object.keys(albumFiles)
  .sort()
  .map((path) => {
    const file = path.split('/').pop()
    const fallback = file.replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ')
    return { src: albumFiles[path], text: ALBUM_CAPTIONS[file] || fallback.charAt(0).toUpperCase() + fallback.slice(1) }
  })

const PLAYER_KEY = 'rotspel_player' // samma nyckel som usePlayer() i useHighscore.js
const idFor = (variant) => `happys-revir-${variant}` // t.ex. happys-revir-daily-2026-09-22, happys-revir-normal

// Poängen är tid i millisekunder, lägre är bättre.
const backendScores = {
  playerName() {
    try { return localStorage.getItem(PLAYER_KEY) || null } catch { return null }
  },
  setPlayerName(name) {
    try { localStorage.setItem(PLAYER_KEY, name) } catch { /* privat läge */ }
  },
  async submit({ variant, ms, name }) {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: idFor(variant), player: name, score: Math.round(ms), lowerIsBetter: true }),
    })
    if (!res.ok) throw new Error(`kunde inte spara (${res.status})`)
  },
  async top({ variant, limit = 10 }) {
    // lowerIsBetter=true: GET sorterar annars fallande (högst poäng först) och kapar
    // till 50 — utan den skulle de snabbaste tiderna kunna falla bort om fler än 50
    // spelare har en tid i det här läget.
    const res = await fetch(`/api/scores/${encodeURIComponent(idFor(variant))}?lowerIsBetter=true`)
    if (!res.ok) throw new Error(`kunde inte hämta (${res.status})`)
    const data = await res.json()
    return (data.entries || [])
      .map((e) => ({ name: e.player, ms: e.score }))
      .sort((a, b) => a.ms - b.ms)
      .slice(0, limit)
  },
}

export default function HappysRevir() {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let override = ''
    try { override = new URLSearchParams(window.location.search).get('revir') || '' } catch { /* ingen query */ }
    const game = mountRevir(host, {
      images: { glad, ledsen, nojd },
      album: ALBUM,
      isMuted: () => !readSettings().ljud,
      shake: () => readSettings().skak,
      scores: backendScores,
      soundToggle: false, // ljudreglaget finns i GameShell
      theme: 'auto',
      seasonOverride: override,
    })
    return () => game.destroy()
  }, [])

  return <div ref={hostRef} />
}
