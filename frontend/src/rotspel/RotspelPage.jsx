import { useState, useMemo, Suspense, lazy, useRef, useEffect } from 'react'
import { GAMES, CATEGORIES, getGame } from './games/index.js'
import {
  usePlayer,
  useMyBests,
  useLeaderboard,
  submitScore,
  formatScore,
} from './useHighscore.js'

export default function RotspelPage() {
  const { player, setPlayer, logout } = usePlayer()
  const { bests, refresh } = useMyBests(player)
  const [activeId, setActiveId] = useState(null)
  const [category, setCategory] = useState('alla')

  if (!player) return <NameGate onSubmit={setPlayer} />

  if (activeId) {
    return (
      <GameShell
        gameId={activeId}
        player={player}
        onExit={() => {
          setActiveId(null)
          refresh()
        }}
      />
    )
  }

  const visible =
    category === 'alla' ? GAMES : GAMES.filter((g) => g.category === category)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-wrap gap-2 mb-5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              category === c
                ? 'bg-blue-600 text-blue-50'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-gray-500 text-sm">Inga spel i den kategorin än.</p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:[grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          {visible.map((g) => (
            <GameCard
              key={g.id}
              game={g}
              best={bests[g.id]}
              onClick={() => setActiveId(g.id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-6 pt-3 border-t border-gray-700 text-xs text-gray-500">
        <span>Inloggad som {player}</span>
        <button onClick={logout} className="text-blue-400 hover:text-blue-300">
          Byt spelare
        </button>
      </div>
    </div>
  )
}

function NameGate({ onSubmit }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function handle() {
    if (!value.trim()) {
      setError('Skriv ett namn först')
      return
    }
    onSubmit(value)
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <h2 className="text-lg text-gray-100 font-medium mb-1">Vem spelar?</h2>
      <p className="text-sm text-gray-400 mb-4">
        Namnet används för dina rekord och topplistan.
      </p>
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError('')
        }}
        onKeyDown={(e) => e.key === 'Enter' && handle()}
        placeholder="joono"
        maxLength={20}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      <button
        onClick={handle}
        className="mt-3 w-full bg-blue-600 hover:bg-blue-500 text-blue-50 text-sm font-medium py-2 rounded-lg"
      >
        Kör
      </button>
    </div>
  )
}

function GameCard({ game, best, onClick }) {
  const hasScore = game.scoreFormat && game.scoreFormat !== 'none'
  return (
    <button
      onClick={onClick}
      className="text-left bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-500 hover:bg-gray-750 transition-colors focus:outline-none focus:border-blue-500"
    >
      <div
        className={`w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-sm font-medium ${
          game.accent || 'text-gray-300'
        }`}
      >
        {game.name.slice(0, 2)}
      </div>
      <div className="text-sm text-gray-100 font-medium mt-2.5">{game.name}</div>
      <div className="text-xs text-gray-500 mt-0.5">
        {hasScore
          ? best !== undefined
            ? `Bästa: ${formatScore(best, game.scoreFormat)}`
            : 'Inget rekord än'
          : game.category || ''}
      </div>
    </button>
  )
}

function GameShell({ gameId, player, onExit }) {
  const game = getGame(gameId)
  const [lastScore, setLastScore] = useState(null)
  const [isRecord, setIsRecord] = useState(false)
  const [round, setRound] = useState(0)
  const lowerIsBetter = game && game.higherIsBetter === false
  // Spel utan poäng (scoreFormat 'none') har ingen topplista att hämta — skicka
  // null så hooken hoppar över anropet i stället för att fråga efter en tom lista.
  const tracksScore = Boolean(game && game.scoreFormat && game.scoreFormat !== 'none')
  const { entries, refresh: refreshBoard } = useLeaderboard(
    tracksScore ? gameId : null,
    lowerIsBetter
  )

  const Component = useMemo(() => {
    if (!game || !game.load) return null
    return lazy(game.load)
  }, [game])

  if (!game) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-400 text-sm">Spelet finns inte.</p>
        <button onClick={onExit} className="text-blue-400 text-sm mt-2">
          Tillbaka
        </button>
      </div>
    )
  }

  async function handleGameOver(score) {
    if (game.scoreFormat === 'none' || typeof score !== 'number') return
    setLastScore(score)
    const result = await submitScore(gameId, player, score, lowerIsBetter)
    setIsRecord(Boolean(result && result.isPersonalBest))
    refreshBoard()
  }

  function restart() {
    setLastScore(null)
    setIsRecord(false)
    setRound((r) => r + 1)
  }

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-5">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onExit}
          className="text-gray-400 hover:text-gray-200 text-sm"
          aria-label="Tillbaka till spellistan"
        >
          ← Alla spel
        </button>
        <div className="min-w-0">
          <div className="text-gray-100 font-medium leading-tight">{game.name}</div>
          {game.blurb && (
            <div className="text-xs text-gray-500 truncate">{game.blurb}</div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
        {game.iframe ? (
          <iframe
            src={game.iframe}
            title={game.name}
            className="w-full h-[520px] rounded-lg border-0 bg-black"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <Suspense
            fallback={<div className="h-64 grid place-items-center text-gray-500 text-sm">Laddar…</div>}
          >
            {Component && (
              <Component key={round} onGameOver={handleGameOver} />
            )}
          </Suspense>
        )}
      </div>

      {/* Idle-spel rapporterar löpande, så resultatrutan med "Igen" vore fel där.
          Poängen skickas ändå in och topplistan visas som vanligt. */}
      {lastScore !== null && !game.idle && (
        <div className="flex items-center justify-between mt-3 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3">
          <div className="text-sm text-gray-200">
            {isRecord ? 'Nytt personbästa: ' : 'Resultat: '}
            <span className={isRecord ? 'text-amber-400 font-medium' : 'font-medium'}>
              {formatScore(lastScore, game.scoreFormat)}
            </span>{' '}
            <span className="text-gray-500">{game.scoreLabel || ''}</span>
          </div>
          <button
            onClick={restart}
            className="bg-blue-600 hover:bg-blue-500 text-blue-50 text-sm px-4 py-1.5 rounded-lg"
          >
            Igen
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-2">Topplista</div>
          <ol className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
            {entries.slice(0, 10).map((e, i) => (
              <li
                key={e.player}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="text-gray-300">
                  <span className="text-gray-600 mr-2">{i + 1}</span>
                  {e.player}
                </span>
                <span className="text-gray-400">
                  {formatScore(e.score, game.scoreFormat)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
