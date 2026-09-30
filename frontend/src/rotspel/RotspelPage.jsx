import { Component, useState, useMemo, Suspense, lazy, useRef, useEffect } from 'react'
import { ArrowLeft, Maximize2, X, Trophy, UserRound, RotateCcw } from 'lucide-react'
import { GAMES, CATEGORIES, getGame } from './games/index.js'
import {
  usePlayer,
  useMyBests,
  useLeaderboard,
  submitScore,
  formatScore,
} from './useHighscore.js'
import { useSettings } from './useSettings.js'
import { useFullskarm } from './useFullskarm.js'

const REGLAGE = [
  { id: 'ljud', namn: 'Ljud' },
  { id: 'skak', namn: 'Skärmskak' },
  { id: 'hitstop', namn: 'Hit-stop' },
]

// Reservfärger för spel som bara har en accent-klass i registret.
const ACCENT_FARG = {
  'text-fuchsia-400': '#e879f9',
  'text-orange-400': '#fb923c',
  'text-cyan-400': '#22d3ee',
  'text-pink-400': '#f472b6',
  'text-blue-400': '#60a5fa',
  'text-emerald-400': '#34d399',
  'text-amber-400': '#fbbf24',
}
const spelFarg = (g) => g?.farg || ACCENT_FARG[g?.accent] || '#8e99b1'

function SpelIkon({ game, storlek = 'lg' }) {
  const farg = spelFarg(game)
  const klass =
    storlek === 'lg' ? 'h-14 w-14 rounded-2xl text-[28px]' : 'h-9 w-9 rounded-xl text-lg'
  return (
    <span
      className={`grid shrink-0 place-items-center ${klass}`}
      style={{
        background: `linear-gradient(145deg, ${farg}40, ${farg}12)`,
        boxShadow: `inset 0 0 0 1px ${farg}40, 0 8px 24px -12px ${farg}`,
      }}
      aria-hidden="true"
    >
      {game.ikon || (
        <span className="font-display text-base font-semibold" style={{ color: farg }}>
          {game.name.slice(0, 2)}
        </span>
      )}
    </span>
  )
}

// sub/ga kommer från skalet: sub är spel-id:t i adressen (#/rotspel/krossen),
// ga('krossen') öppnar ett spel. Utan skalet (ga saknas) fungerar sidan som
// förut med vanlig state.
export default function RotspelPage({ sub, ga }) {
  const { player, setPlayer, logout } = usePlayer()
  const { bests, refresh } = useMyBests(player)
  const [lokaltId, setLokaltId] = useState(null)
  const [category, setCategory] = useState('alla')
  const activeId = ga ? sub || null : lokaltId

  // Öppnades spelet från listan går "tillbaka" bakåt i historiken, så
  // telefonens bakåtgest och knappen gör samma sak. Kom man via en länk
  // direkt till spelet byts adressen ut mot listan i stället.
  const franListan = useRef(false)
  function oppna(id) {
    if (!ga) return setLokaltId(id)
    franListan.current = true
    ga(id)
  }
  function stang() {
    if (!ga) return setLokaltId(null)
    if (franListan.current) {
      franListan.current = false
      window.history.back()
    } else {
      ga('', { ersatt: true })
    }
  }

  // Hämta rekorden igen när man kommer tillbaka till listan.
  const forstaGangen = useRef(true)
  useEffect(() => {
    if (forstaGangen.current) {
      forstaGangen.current = false
      return
    }
    if (!activeId) refresh()
  }, [activeId, refresh])

  if (!player) return <NameGate onSubmit={setPlayer} />

  if (activeId) {
    return <GameShell key={activeId} gameId={activeId} player={player} onExit={stang} />
  }

  const visible =
    category === 'alla' ? GAMES : GAMES.filter((g) => g.category === category)

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Rötspel
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Småspel med rekord och topplistor · {GAMES.length} spel
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-ink-line bg-white/[0.03] py-1 pl-3 pr-1 text-sm">
          <UserRound className="h-4 w-4 text-gray-500" aria-hidden="true" />
          <span className="ml-1 text-gray-400">Spelar som</span>
          <span className="font-medium text-white">{player}</span>
          <button
            onClick={logout}
            className="ml-1 rounded-full px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
          >
            Byt
          </button>
        </div>
      </header>

      {CATEGORIES.length > 2 && (
        <div className="utan-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm capitalize transition-colors ${
                category === c
                  ? 'bg-white text-gray-900'
                  : 'border border-ink-line bg-white/[0.03] text-gray-400 hover:bg-white/[0.06] hover:text-gray-100'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-gray-500">Inga spel i den kategorin än.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((g, i) => (
            <GameCard key={g.id} game={g} best={bests[g.id]} onClick={() => oppna(g.id)} index={i} />
          ))}
        </div>
      )}
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
    <div className="panel mx-auto mt-6 max-w-sm p-6 sm:mt-12">
      <div className="mb-4 flex -space-x-2" aria-hidden="true">
        {GAMES.slice(0, 4).map((g) => (
          <span key={g.id} className="rounded-2xl ring-4 ring-ink-raised">
            <SpelIkon game={g} storlek="sm" />
          </span>
        ))}
      </div>
      <h2 className="font-display text-2xl font-semibold text-white">Vem spelar?</h2>
      <p className="mb-4 mt-1 text-sm text-gray-400">
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
        autoFocus
        className="w-full rounded-xl border border-ink-line bg-black/20 px-4 py-3 text-base text-white placeholder-gray-500 outline-none focus:border-accent/60"
      />
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button
        onClick={handle}
        className="mt-3 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
      >
        Kör
      </button>
    </div>
  )
}

function GameCard({ game, best, onClick, index }) {
  const hasScore = game.scoreFormat && game.scoreFormat !== 'none'
  const farg = spelFarg(game)
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${index * 40}ms` }}
      className="group relative animate-fade-up overflow-hidden rounded-2xl border border-ink-line bg-ink-raised p-4 text-left shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-line-strong focus-visible:border-accent sm:p-5"
    >
      <span
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-[0.16] blur-2xl transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: farg }}
        aria-hidden="true"
      />
      <div className="relative flex items-start gap-4">
        <SpelIkon game={game} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg font-semibold text-white">{game.name}</h3>
            {game.category && (
              <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] capitalize text-gray-400">
                {game.category}
              </span>
            )}
          </div>
          {game.blurb && <p className="mt-1 line-clamp-2 text-sm leading-snug text-gray-400">{game.blurb}</p>}
          {hasScore && (
            <p className="mt-2.5 flex items-center gap-1.5 text-xs">
              <Trophy className="h-3.5 w-3.5" style={{ color: best !== undefined ? '#fbbf24' : '#4d5770' }} aria-hidden="true" />
              {best !== undefined ? (
                <span className="text-gray-300">
                  Ditt rekord <span className="font-semibold text-white tabular">{formatScore(best, game.scoreFormat)}</span>
                </span>
              ) : (
                <span className="text-gray-500">Inget rekord än</span>
              )}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

// Ett spel som kastar ska bara ta ner sig själv, inte hela fliken — utan den
// här spärrar React av hela trädet vid ett obehandlat fel i vilket spel som
// helst, och man kan inte ens navigera bort. Måste vara en klasskomponent —
// React har inget hook-motsvarighet till getDerivedStateFromError/
// componentDidCatch. Fångar bara fel som kastas UNDER RENDERING (det är vad
// getDerivedStateFromError/componentDidCatch är till för) — ett fel i en
// timeout- eller click-callback i själva spelet fångas inte här.
class SpelFelgrans extends Component {
  state = { fel: null }

  static getDerivedStateFromError(fel) {
    return { fel }
  }

  componentDidCatch(fel, info) {
    // Loggas så felsökning fortfarande går att göra, trots att UI:t bara
    // visar ett kort meddelande.
    console.error('[Rötspel] Spelet kraschade:', fel, info)
  }

  componentDidUpdate(forraProps) {
    // Om resetKey ändras (t.ex. en omstart) ska felläget inte sitta kvar
    // och blockera en annan instans av samma spel.
    if (this.state.fel && forraProps.resetKey !== this.props.resetKey) {
      this.setState({ fel: null })
    }
  }

  render() {
    if (this.state.fel) {
      return (
        <div className="h-64 flex flex-col items-center justify-center gap-3 text-center px-6">
          <p className="text-gray-300 text-sm">Något gick fel i spelet.</p>
          <p className="text-gray-600 text-xs break-words">
            {String(this.state.fel?.message || this.state.fel)}
          </p>
          <button
            onClick={this.props.onExit}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong"
          >
            Tillbaka till spellistan
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function GameShell({ gameId, player, onExit }) {
  const game = getGame(gameId)
  const [lastScore, setLastScore] = useState(null)
  const [isRecord, setIsRecord] = useState(false)
  const [round, setRound] = useState(0)
  const lowerIsBetter = game && game.higherIsBetter === false
  // Spel utan poäng (scoreFormat 'none') har ingen topplista att hämta — skicka
  // null så hooken hoppar över anropet i stället för att fråga efter en tom lista.
  const { settings, toggle } = useSettings()
  const tracksScore = Boolean(game && game.scoreFormat && game.scoreFormat !== 'none')
  const { entries, refresh: refreshBoard } = useLeaderboard(
    tracksScore ? gameId : null,
    lowerIsBetter
  )

  const Component = useMemo(() => {
    if (!game || !game.load) return null
    return lazy(game.load)
  }, [game])

  // Fullskärm gäller alla spel, så den hör hemma här och inte i varje spel.
  // wrapperRef omsluter bara spelytan (rubrikraden + spelrutan) — resultat,
  // topplista och reglage ligger utanför den, dels så äkta fullskärm
  // (requestFullscreen) aldrig tar med dem, dels så CSS-reservlösningen
  // döljer dem explicit nedan.
  const wrapperRef = useRef(null)
  const { arFullskarm, vaxla } = useFullskarm(wrapperRef)
  // Sätts av spelet självt (via fullskarmSparrad-propen) om en pågående
  // animation skulle bli fel av att spelytan byter storlek mitt i — se
  // Krossens kaskader. Växlingsknappen ignorerar klick medan den är satt.
  const fullskarmSparrad = useRef(false)

  if (!game) {
    return (
      <div className="panel mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-gray-400">Spelet finns inte.</p>
        <button onClick={onExit} className="mt-3 text-sm font-medium text-accent">
          Till spellistan
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

  function vaxlaFullskarm() {
    if (fullskarmSparrad.current) return
    vaxla()
  }

  // Bredd/höjd-förhållandet styr hur brett --spelbredd får bli i fullskärm i
  // liggande läge, där höjden är begränsningen — se games/index.js.
  const forhallande = game.forhallande || 1

  // Utanför fullskärm: så brett som får plats (max 440 px), men inte högre än
  // att spelet ryms under toppbaren/över bottenmenyn på en vanlig skärm.
  // Golvet på 300 px gör att en liggande telefon hellre scrollar än krymper
  // spelet till oläslighet.
  const vanligBredd = `min(100%, 440px, max(300px, (100dvh - 12.5rem) * ${forhallande}))`

  const topp = tracksScore ? entries.slice(0, 10) : []

  return (
    <div className="mx-auto max-w-3xl">
      <div
        ref={wrapperRef}
        data-fullskarm={arFullskarm ? '' : undefined}
        className={
          // overflow-y-auto utöver de angivna klasserna: spel utan
          // var(--spelbredd)-behandlingen (t.ex. Happys revir) kan bli
          // högre än en kort liggande skärm — utan skroll skulle innehåll
          // helt enkelt klippas bort och bli oåtkomligt i fullskärm.
          // Påverkar inte spel som redan får plats.
          //
          // items/justify sätts som inline style nedan (safe center), inte
          // som Tailwind-klasser här — se förklaringen vid style-objektet.
          arFullskarm
            ? 'fixed inset-0 z-50 bg-ink flex flex-col p-2 overflow-y-auto'
            : ''
        }
        style={{
          '--spelbredd': arFullskarm
            ? `min(100vw - 1rem, (100vh - 7rem) * ${forhallande})`
            : vanligBredd,
          // "safe center" i stället för Tailwinds justify-center/items-center:
          // en flexbox som centrerar innehåll som är högre än containern gör
          // annars den bortcentrerade delen oåtkomlig för scroll i vissa
          // webbläsare (klassisk centered-overflow-bugg) — Happys revir är
          // högre än en kort skärm i fullskärm (bräde + topplista + album).
          // "safe" faller tillbaka till start-justering just när innehållet
          // inte får plats, annars fungerar centreringen som förut. Satt som
          // inline style, inte en Tailwind-klass — Tailwind 3.4 genererar
          // ingen CSS för godtyckliga justify-content/align-items-nyckelord
          // via bracket-syntax, klassen skulle tyst falla bort.
          ...(arFullskarm && { justifyContent: 'safe center', alignItems: 'safe center' }),
        }}
      >
        {/* Rubrikraden döljs helt i fullskärm i stället för att bara tappa
            tillbaka-knappen och blurben — se stäng-knappen nedan för
            förklaringen till varför den flyttar, inte bara byter ikon. */}
        {!arFullskarm && (
          <div className="mb-3 flex items-center gap-3 sm:mb-4">
            <button
              onClick={onExit}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-line bg-white/[0.03] text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Tillbaka till spellistan"
              title="Alla spel"
            >
              <ArrowLeft className="h-[18px] w-[18px]" />
            </button>
            <SpelIkon game={game} storlek="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-lg font-semibold leading-tight text-white">{game.name}</div>
              {game.blurb && (
                <div className="truncate text-xs text-gray-500">{game.blurb}</div>
              )}
            </div>
            <button
              onClick={vaxlaFullskarm}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ink-line bg-white/[0.03] text-gray-300 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Fullskärm"
              title="Fullskärm"
            >
              <Maximize2 className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}

        {/* isolate: spelens egna z-index (dialoger, notiser) stannar inne i
            spelrutan och kan inte hamna ovanpå menyerna när man scrollar. */}
        <div className="isolate rounded-2xl border border-ink-line bg-gray-800/60 p-3 shadow-panel">
          {game.iframe ? (
            <iframe
              src={game.iframe}
              title={game.name}
              className="w-full h-[520px] rounded-lg border-0 bg-black"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <SpelFelgrans resetKey={round} onExit={onExit}>
              <Suspense
                fallback={<div className="h-64 grid place-items-center text-gray-500 text-sm">Laddar…</div>}
              >
                {Component && (
                  <Component
                    key={round}
                    onGameOver={handleGameOver}
                    fullskarmSparrad={fullskarmSparrad}
                  />
                )}
              </Suspense>
            </SpelFelgrans>
          )}
        </div>

        {/* Stäng-knappen ligger som en flytande cirkel i nedre hörnet i
            fullskärm i stället för i en rubrikrad ovanför spelet. Två skäl:
            det sparar en hel rad höjd i liggande läge på en telefon, där
            varje pixel räknas, och det håller den borta från spelens egna
            avbrytzoner uppe vid kanonen (Pinnbollen) — två interaktiva ytor
            på samma ställe hade varit förvirrande även om de facto inte
            krockar (ett tryck på knappen träffar alltid knappen, aldrig
            canvasen under). Nedre hörnet är den plats minst spel har någon
            egen interaktion att krocka med. */}
        {arFullskarm && (
          <button
            onClick={vaxlaFullskarm}
            className="absolute bottom-4 right-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-gray-800/85 text-gray-200 ring-1 ring-white/10 backdrop-blur hover:bg-gray-700"
            aria-label="Stäng fullskärm"
            title="Stäng fullskärm"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Utanför wrapperRef med flit: äkta fullskärm (requestFullscreen) tar
          bara med sig det som ligger i elementet den anropas på, så det här
          exkluderas automatiskt där. !arFullskarm-vakten täcker dessutom
          CSS-reservlösningen, som bara är en stil på samma wrapper och inte
          skiljer på inne/utanför på det viset. */}

      {/* Idle-spel rapporterar löpande, så resultatrutan med "Igen" vore fel där.
          Poängen skickas ändå in och topplistan visas som vanligt. Döljs i
          fullskärm. */}
      {!arFullskarm && lastScore !== null && !game.idle && (
        <div
          className={`mt-3 flex animate-fade-up items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
            isRecord ? 'border-amber-400/30 bg-amber-400/[0.07]' : 'border-ink-line bg-ink-raised'
          }`}
        >
          <div className="flex items-center gap-3 text-sm text-gray-200">
            {isRecord && <Trophy className="h-5 w-5 text-amber-400" aria-hidden="true" />}
            <span>
              {isRecord ? 'Nytt personbästa: ' : 'Resultat: '}
              <span className={`font-semibold tabular ${isRecord ? 'text-amber-300' : 'text-white'}`}>
                {formatScore(lastScore, game.scoreFormat)}
              </span>{' '}
              <span className="text-gray-500">{game.scoreLabel || ''}</span>
            </span>
          </div>
          <button
            onClick={restart}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Igen
          </button>
        </div>
      )}

      {/* Bara de reglage spelet faktiskt använder. Ett spel utan reglage-fält
          i registret visar ingenting alls här. Döljs i fullskärm. */}
      {!arFullskarm && Array.isArray(game.reglage) && game.reglage.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {REGLAGE.filter((r) => game.reglage.includes(r.id)).map((r) => (
            <label
              key={r.id}
              className={`flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                settings[r.id]
                  ? 'border-accent/40 bg-accent-soft text-gray-100'
                  : 'border-ink-line bg-white/[0.02] text-gray-500'
              }`}
            >
              <input
                type="checkbox"
                checked={settings[r.id]}
                onChange={() => toggle(r.id)}
                className="h-3.5 w-3.5 accent-accent"
              />
              {r.namn}
            </label>
          ))}
        </div>
      )}

      {/* Döljs i fullskärm. */}
      {!arFullskarm && topp.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Topplista
          </h2>
          <ol className="divide-y divide-ink-line overflow-hidden rounded-2xl border border-ink-line bg-ink-raised">
            {topp.map((e, i) => {
              const jag = e.player === player
              return (
                <li
                  key={e.player}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm ${jag ? 'bg-accent-soft' : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular ${
                        i === 0
                          ? 'bg-amber-400/20 text-amber-300'
                          : i === 1
                          ? 'bg-gray-300/15 text-gray-200'
                          : i === 2
                          ? 'bg-orange-400/15 text-orange-300'
                          : 'text-gray-600'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className={`truncate ${jag ? 'font-medium text-white' : 'text-gray-300'}`}>{e.player}</span>
                  </span>
                  <span className="font-medium text-gray-200 tabular">
                    {formatScore(e.score, game.scoreFormat)}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}
