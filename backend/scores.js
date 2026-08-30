import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Highscores sparas i en JSON-fil så de överlever pm2 restart.
// Formen: { "<gameId>": { "<player>": { score, updatedAt } } }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const FILE = path.join(DATA_DIR, 'scores.json')

let store = {}
let writeTimer = null

function load() {
  try {
    if (fs.existsSync(FILE)) {
      store = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    }
  } catch (err) {
    console.error('[scores] kunde inte läsa scores.json, börjar tomt:', err.message)
    store = {}
  }
}

function persist() {
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(FILE, JSON.stringify(store, null, 2))
    } catch (err) {
      console.error('[scores] kunde inte skriva scores.json:', err.message)
    }
  }, 500)
}

load()

const router = express.Router()

// Alla personbästa för en spelare
router.get('/me', (req, res) => {
  const player = String(req.query.player || '').trim()
  if (!player) return res.status(400).json({ error: 'player saknas' })

  const bests = {}
  for (const [gameId, players] of Object.entries(store)) {
    if (players[player]) bests[gameId] = players[player].score
  }
  res.json({ player, bests })
})

// Topplista för ett spel
// Riktningen kommer från anroparen (registret i games/index.js är sanningen).
// Tidsspel vill ha lägst först.
router.get('/:gameId', (req, res) => {
  const lowerIsBetter = req.query.lowerIsBetter === 'true'
  const players = store[req.params.gameId] || {}
  const entries = Object.entries(players)
    .map(([player, rec]) => ({ player, score: rec.score, updatedAt: rec.updatedAt }))
    .sort((a, b) => (lowerIsBetter ? a.score - b.score : b.score - a.score))
    .slice(0, 50)
  res.json({ gameId: req.params.gameId, entries })
})

// Skicka in ett resultat
router.post('/', (req, res) => {
  const { gameId, player, score, lowerIsBetter } = req.body || {}

  const cleanGame = String(gameId || '').trim()
  const cleanPlayer = String(player || '').trim().slice(0, 20)
  const value = Number(score)

  if (!cleanGame || !cleanPlayer) {
    return res.status(400).json({ error: 'gameId och player krävs' })
  }
  if (!Number.isFinite(value) || value < 0 || value > 1e12) {
    return res.status(400).json({ error: 'ogiltig poäng' })
  }

  if (!store[cleanGame]) store[cleanGame] = {}
  const current = store[cleanGame][cleanPlayer]

  const better =
    !current || (lowerIsBetter ? value < current.score : value > current.score)

  if (better) {
    store[cleanGame][cleanPlayer] = { score: value, updatedAt: Date.now() }
    persist()
  }

  res.json({
    gameId: cleanGame,
    player: cleanPlayer,
    score: value,
    best: store[cleanGame][cleanPlayer].score,
    isPersonalBest: better,
  })
})

export default router
