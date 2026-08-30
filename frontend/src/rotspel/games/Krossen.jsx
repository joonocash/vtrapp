import { useState, useRef, useEffect, useCallback } from 'react'
import {
  SIZE,
  createBoard,
  planSwap,
  resolveMatches,
  applyClear,
  applyGravity,
  applyOmvandla,
  hasValidMove,
  shuffle,
  cloneBoard,
  poangFor,
} from './krossenEngine.js'

// Krossen. Egen match-3: egna former, egna färger, eget namn.
//
// Brädet ligger i en ref som sanningskälla — React ser bara en kopia per
// animationssteg. Anledningen är att en drags upplösning är en sekvens
// (rensa, vänta, falla, vänta, kolla igen) och den sekvensen måste kunna
// köra klart utan att renders stör den.
//
// Formerna är olika per färg, inte bara olika kulör. Dels för att det ser
// bättre ut, dels för att spelet då går att spela om man är färgblind.

const MOVES = 30

const PIECES = [
  { fill: '#ef4444', shape: 'cirkel' },
  { fill: '#3b82f6', shape: 'ruta' },
  { fill: '#22c55e', shape: 'triangel' },
  { fill: '#eab308', shape: 'romb' },
  { fill: '#a855f7', shape: 'sexhorning' },
  { fill: '#ec4899', shape: 'stjarna' },
]

const CLEAR_MS = 260
const FALL_MS = 240
const SWAP_MS = 160

// ------------------------------------------------------------------- ljud

function useLjud() {
  const ctxRef = useRef(null)

  const ton = useCallback((freq, ms = 120, typ = 'sine', vol = 0.14) => {
    try {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return
        ctxRef.current = new Ctx()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = typ
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + ms / 1000)
    } catch {
      // ljud är valfritt
    }
  }, [])

  useEffect(() => {
    return () => {
      if (ctxRef.current) ctxRef.current.close().catch(() => {})
    }
  }, [])

  return ton
}

// ------------------------------------------------------------------ former

function Piece({ tile, popping }) {
  if (!tile) return null
  const p = PIECES[tile.color]
  const s = tile.special

  return (
    <svg
      viewBox="0 0 40 40"
      className={`w-full h-full transition-transform duration-200 ${
        popping ? 'scale-0 opacity-0' : 'scale-100'
      }`}
    >
      {s === 'prisma' ? (
        <>
          <circle cx="20" cy="20" r="16" fill="#1f2937" />
          <circle cx="20" cy="20" r="13" fill="none" stroke="#f472b6" strokeWidth="2.5" />
          <circle cx="20" cy="20" r="8" fill="none" stroke="#60a5fa" strokeWidth="2.5" />
          <circle cx="20" cy="20" r="3.5" fill="#fbbf24" />
        </>
      ) : (
        <>
          {p.shape === 'cirkel' && <circle cx="20" cy="20" r="15" fill={p.fill} />}
          {p.shape === 'ruta' && <rect x="6" y="6" width="28" height="28" rx="6" fill={p.fill} />}
          {p.shape === 'triangel' && <path d="M20 5 L36 33 L4 33 Z" fill={p.fill} />}
          {p.shape === 'romb' && <path d="M20 4 L36 20 L20 36 L4 20 Z" fill={p.fill} />}
          {p.shape === 'sexhorning' && (
            <path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z" fill={p.fill} />
          )}
          {p.shape === 'stjarna' && (
            <path
              d="M20 3 L24.5 15 L37 15 L27 23 L31 35 L20 27.5 L9 35 L13 23 L3 15 L15.5 15 Z"
              fill={p.fill}
            />
          )}

          {s === 'raket-h' && (
            <>
              <rect x="2" y="16" width="36" height="3" fill="#fff" opacity="0.95" />
              <rect x="2" y="22" width="36" height="3" fill="#fff" opacity="0.95" />
            </>
          )}
          {s === 'raket-v' && (
            <>
              <rect x="16" y="2" width="3" height="36" fill="#fff" opacity="0.95" />
              <rect x="22" y="2" width="3" height="36" fill="#fff" opacity="0.95" />
            </>
          )}
          {s === 'bomb' && (
            <>
              <circle cx="20" cy="20" r="17" fill="none" stroke="#fff" strokeWidth="2.5" />
              <circle cx="20" cy="20" r="6" fill="#fff" opacity="0.9" />
            </>
          )}
        </>
      )}
    </svg>
  )
}

// -------------------------------------------------------------- komponenten

export default function Krossen({ onGameOver }) {
  const overRef = useRef(onGameOver)
  useEffect(() => {
    overRef.current = onGameOver
  })

  const ton = useLjud()
  const boardRef = useRef(null)
  if (boardRef.current === null) boardRef.current = createBoard()

  const [board, setBoard] = useState(() => cloneBoard(boardRef.current))
  const [score, setScore] = useState(0)
  const [moves, setMoves] = useState(MOVES)
  const [vald, setVald] = useState(null)
  const [popping, setPopping] = useState(new Set())
  const [skakar, setSkakar] = useState(false)
  const [banner, setBanner] = useState(null)
  const [poppar, setPoppar] = useState([])
  const [slut, setSlut] = useState(false)

  const busy = useRef(false)
  const reported = useRef(false)
  const scoreRef = useRef(0)
  const movesRef = useRef(MOVES)
  const timers = useRef([])
  const levande = useRef(true)

  useEffect(() => {
    return () => {
      levande.current = false
      timers.current.forEach(clearTimeout)
    }
  }, [])

  function senare(fn, ms) {
    timers.current.push(setTimeout(fn, ms))
  }

  // sleep måste också gå genom timers.current. Rensas timern vid unmount
  // resolvar promisen aldrig, och den pågående kaskaden överges där den står
  // i stället för att köra vidare på en avmonterad komponent.
  const sova = useCallback(
    (ms) => new Promise((resolve) => {
      timers.current.push(setTimeout(resolve, ms))
    }),
    []
  )

  function visaBanner(text) {
    setBanner(text)
    senare(() => levande.current && setBanner(null), 1100)
  }

  function poangPopp(index, poang) {
    const id = Math.random()
    setPoppar((p) => [...p, { id, index, poang }])
    senare(() => levande.current && setPoppar((p) => p.filter((x) => x.id !== id)), 900)
  }

  function skaka() {
    setSkakar(true)
    senare(() => levande.current && setSkakar(false), 300)
  }

  // Kör hela kaskaden efter ett drag. Sekventiell med await mellan stegen.
  const koorKaskad = useCallback(
    async (swapIndex) => {
      let kaskad = 0

      while (levande.current) {
        const resultat = resolveMatches(boardRef.current, kaskad === 0 ? swapIndex : null)
        if (!resultat) break

        kaskad += 1
        const poang = poangFor(resultat.antal, kaskad)
        scoreRef.current += poang
        setScore(scoreRef.current)

        // stigande tonhöjd per kaskadnivå — det är den här detaljen som
        // gör att en lång kedja känns som en belöning i sig
        ton(320 + kaskad * 90, 130, 'triangle', 0.16)

        if (kaskad >= 2) {
          visaBanner(`Kedja ×${kaskad}`)
          poangPopp([...resultat.traffade][0], poang)
        }
        if (resultat.antal >= 8) skaka()

        setPopping(new Set(resultat.traffade))
        await sova(CLEAR_MS)
        if (!levande.current) return

        boardRef.current = applyClear(boardRef.current, resultat.traffade, resultat.specialer)
        setPopping(new Set())
        setBoard(cloneBoard(boardRef.current))

        if (resultat.specialer.length > 0) {
          ton(680, 220, 'square', 0.1)
        }

        await sova(60)
        if (!levande.current) return

        const efterFall = applyGravity(boardRef.current)
        boardRef.current = efterFall.board
        setBoard(cloneBoard(boardRef.current))
        await sova(FALL_MS)
        if (!levande.current) return
      }

      // slut på drag att göra? blanda om istället för att avsluta
      if (levande.current && !hasValidMove(boardRef.current)) {
        visaBanner('Blandar om')
        await sova(500)
        if (!levande.current) return
        boardRef.current = shuffle(boardRef.current)
        setBoard(cloneBoard(boardRef.current))
        ton(200, 300, 'sawtooth', 0.08)
      }
    },
    [ton, sova]
  )

  const gorDrag = useCallback(
    async (a, b) => {
      if (busy.current || slut) return
      busy.current = true
      setVald(null)

      // try/finally: busy MÅSTE släppas oavsett hur vi lämnar funktionen.
      // Utan den låser ett kastat undantag var som helst i kedjan brädet
      // permanent, utan väg tillbaka för spelaren.
      try {
        const plan = planSwap(boardRef.current, a, b)

        if (!plan) {
          // ogiltigt drag: visa bytet och ta tillbaka det
          ton(150, 90, 'square', 0.06)
          const test = cloneBoard(boardRef.current)
          const tmp = test[a]
          test[a] = test[b]
          test[b] = tmp
          setBoard(test)
          await sova(SWAP_MS)
          if (!levande.current) return
          setBoard(cloneBoard(boardRef.current))
          return
        }

        movesRef.current -= 1
        setMoves(movesRef.current)
        ton(420, 80, 'sine', 0.1)

        boardRef.current = plan.board
        setBoard(cloneBoard(boardRef.current))
        await sova(SWAP_MS)
        if (!levande.current) return

        if (plan.kombo) {
          if (plan.beskrivning) visaBanner(plan.beskrivning)
          skaka()
          ton(180, 400, 'sawtooth', 0.16)

          let traffade = plan.traffade

          if (plan.omvandla) {
            const om = applyOmvandla(boardRef.current, plan.omvandla)
            boardRef.current = om.board
            setBoard(cloneBoard(boardRef.current))
            await sova(220)
            if (!levande.current) return
            traffade = new Set([...om.platser, plan.omvandla.prismaIndex])
          }

          const poang = poangFor(traffade.size, 2)
          scoreRef.current += poang
          setScore(scoreRef.current)
          poangPopp([...traffade][0], poang)

          setPopping(new Set(traffade))
          await sova(CLEAR_MS + 80)
          if (!levande.current) return

          boardRef.current = applyClear(boardRef.current, traffade, [])
          setPopping(new Set())
          const efterFall = applyGravity(boardRef.current)
          boardRef.current = efterFall.board
          setBoard(cloneBoard(boardRef.current))
          await sova(FALL_MS)
          if (!levande.current) return
        }

        await koorKaskad(b)
        if (!levande.current) return

        if (movesRef.current <= 0) {
          setSlut(true)
          if (!reported.current) {
            reported.current = true
            overRef.current(scoreRef.current)
          }
          ton(520, 160, 'sine', 0.14)
          senare(() => levande.current && ton(660, 400, 'sine', 0.14), 170)
        }
      } finally {
        busy.current = false
      }
    },
    [koorKaskad, ton, slut, sova]
  )

  function klicka(index) {
    if (busy.current || slut) return

    if (vald === null) {
      setVald(index)
      return
    }
    if (vald === index) {
      setVald(null)
      return
    }

    const r1 = Math.floor(vald / SIZE)
    const c1 = vald % SIZE
    const r2 = Math.floor(index / SIZE)
    const c2 = index % SIZE
    const grannar = Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1

    if (grannar) {
      gorDrag(vald, index)
    } else {
      setVald(index)
    }
  }

  const cellProcent = 100 / SIZE

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="w-full max-w-[400px] flex items-center justify-between text-sm px-1">
        <div>
          <div className="text-xs text-gray-500">Poäng</div>
          <div className="text-gray-100 font-medium text-lg">
            {score.toLocaleString('sv-SE')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Drag kvar</div>
          <div
            className={`font-medium text-lg ${
              moves <= 5 ? 'text-red-400' : 'text-gray-100'
            }`}
          >
            {moves}
          </div>
        </div>
      </div>

      <div
        className={`relative w-full max-w-[400px] bg-gray-900 rounded-xl p-1.5 touch-none select-none transition-transform ${
          skakar ? 'animate-pulse' : ''
        }`}
        style={{
          aspectRatio: '1 / 1',
          transform: skakar ? 'translateX(2px)' : 'none',
        }}
      >
        <div className="relative w-full h-full">
          {board.map((tile, i) => {
            if (!tile) return null
            const r = Math.floor(i / SIZE)
            const c = i % SIZE
            return (
              <button
                key={tile.id}
                onPointerDown={() => klicka(i)}
                aria-label={`Ruta ${r + 1},${c + 1}`}
                className="absolute p-0.5 transition-all duration-200 ease-out"
                style={{
                  left: `${c * cellProcent}%`,
                  top: `${r * cellProcent}%`,
                  width: `${cellProcent}%`,
                  height: `${cellProcent}%`,
                  transform: vald === i ? 'scale(1.15)' : 'scale(1)',
                  zIndex: vald === i ? 10 : 1,
                }}
              >
                <div
                  className={`w-full h-full rounded-lg ${
                    vald === i ? 'ring-2 ring-white/70 bg-white/10' : ''
                  }`}
                >
                  <Piece tile={tile} popping={popping.has(i)} />
                </div>
              </button>
            )
          })}

          {poppar.map((p) => {
            const r = Math.floor(p.index / SIZE)
            const c = p.index % SIZE
            return (
              <div
                key={p.id}
                className="absolute pointer-events-none text-amber-300 font-medium text-sm animate-bounce"
                style={{
                  left: `${c * cellProcent}%`,
                  top: `${r * cellProcent}%`,
                  width: `${cellProcent}%`,
                  textAlign: 'center',
                }}
              >
                +{p.poang}
              </div>
            )
          })}
        </div>

        {banner && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="bg-black/70 text-amber-300 text-xl font-medium px-5 py-2 rounded-xl">
              {banner}
            </div>
          </div>
        )}

        {slut && (
          <div className="absolute inset-0 bg-black/75 rounded-xl grid place-items-center">
            <div className="text-center">
              <div className="text-gray-400 text-sm">Slut på drag</div>
              <div className="text-gray-100 text-3xl font-medium mt-1">
                {score.toLocaleString('sv-SE')}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center max-w-[400px]">
        {slut
          ? 'Tryck "Igen" nedanför.'
          : 'Tryck på två brickor bredvid varandra. Fyra i rad ger raket, fem i L ger bomb, fem i rad ger prisma.'}
      </p>
    </div>
  )
}
