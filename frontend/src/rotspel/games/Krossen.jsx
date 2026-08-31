import { useState, useRef, useEffect, useCallback } from 'react'
import {
  SIZE,
  createBoard,
  planSwap,
  resolveMatches,
  applyClear,
  applyOmvandla,
  planGravity,
  listSpecials,
  findHint,
  hasValidMove,
  shuffle,
  cloneBoard,
  poangFor,
} from './krossenEngine.js'
import { flushSync } from 'react-dom'
import { createAnimator } from './krossenAnim.js'
import { useLjud } from '../useLjud.js'
import { readSettings } from '../useSettings.js'

// Krossen. Egen match-3: egna former, egna färger, eget namn.
//
// Uppdelningen är tre lager:
//   krossenEngine.js  reglerna — vilka rutor träffas
//   krossenAnim.js    ritandet — hur det ser ut och i vilken ordning
//   den här filen     loopen — vad som händer när, och spelets tillstånd
//
// Brädet ligger i en ref som sanningskälla. React ser en kopia per
// animationssteg. Anledningen är att ett drags upplösning är en sekvens
// (rensa, vänta, falla, vänta, kolla igen) som måste köra klart utan att
// renders stör den.

const MOVES = 30
const TIPS_EFTER_MS = 6000
const FINAL_MAX_VAGOR = 8

const PIECES = [
  { fill: '#ef4444', shape: 'cirkel' },
  { fill: '#3b82f6', shape: 'ruta' },
  { fill: '#22c55e', shape: 'triangel' },
  { fill: '#eab308', shape: 'romb' },
  { fill: '#a855f7', shape: 'sexhorning' },
  { fill: '#ec4899', shape: 'stjarna' },
]

const fargFor = (tile) =>
  tile ? (tile.special === 'prisma' ? '#f472b6' : PIECES[tile.color].fill) : '#9ca3af'

// ------------------------------------------------------------------ former

function Piece({ tile }) {
  if (!tile) return null
  const p = PIECES[tile.color]
  const s = tile.special

  return (
    <svg viewBox="0 0 40 40" className="w-full h-full">
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
  const bradRef = useRef(null)
  const animRef = useRef(null)

  const boardRef = useRef(null)
  if (boardRef.current === null) boardRef.current = createBoard()

  const [board, setBoard] = useState(() => cloneBoard(boardRef.current))
  const [score, setScore] = useState(0)
  const [visadScore, setVisadScore] = useState(0)
  const [moves, setMoves] = useState(MOVES)
  const [vald, setVald] = useState(null)
  const [slut, setSlut] = useState(false)
  const [vag, setVag] = useState(null)

  const busy = useRef(false)
  const reported = useRef(false)
  const scoreRef = useRef(0)
  const movesRef = useRef(MOVES)
  const levande = useRef(true)
  const timers = useRef([])
  const tipsCeller = useRef([])
  const tipsTimer = useRef(null)
  const scoreRaf = useRef(null)
  const visadScoreRef = useRef(0)

  // ------------------------------------------------------------ uppsättning

  useEffect(() => {
    if (bradRef.current) {
      animRef.current = createAnimator(bradRef.current, SIZE)
      animRef.current.setInstallningar(readSettings())
    } else {
      // Ska aldrig handa: React satter refar innan effekter kors. Men utan
      // animator no-op:ar varje spelhandling tyst, sa vi vill hora av oss.
      console.warn('[Krossen] bradRef saknades vid mount - inga animationer')
    }
    return () => {
      levande.current = false
      timers.current.forEach(clearTimeout)
      if (tipsTimer.current) clearTimeout(tipsTimer.current)
      if (scoreRaf.current) cancelAnimationFrame(scoreRaf.current)
      if (animRef.current) animRef.current.forstor()
    }
  }, [])

  function senare(fn, ms) {
    const t = setTimeout(() => {
      if (levande.current) fn()
    }, ms)
    timers.current.push(t)
    return t
  }

  // Renderar brädet OCH tvingar fram committen. Animationslagret pekar ut
  // DOM-noder via data-cell, så noderna måste finnas i sitt nya läge innan
  // vi rör dem. Utan flushSync hinner React inte commita, och startläget
  // sätts på noder som React sedan byter ut — nya brickor får då ingen
  // fallanimation alls, de bara dyker upp.
  const visaBrade = useCallback(() => {
    flushSync(() => setBoard(cloneBoard(boardRef.current)))
  }, [])

  // sova som går genom timerlistan, så en avmontering avbryter kedjan i
  // stället för att låta den köra vidare på en död komponent
  const vila = useCallback(
    (ms) =>
      new Promise((resolve) => {
        timers.current.push(setTimeout(resolve, ms))
      }),
    []
  )

  // --------------------------------------------------------------- poängen

  // Räknaren rullar upp i stället för att hoppa. Det kopplar ihop det som
  // händer på brädet med det som händer med siffran.
  const laggPoang = useCallback((n) => {
    scoreRef.current += n
    setScore(scoreRef.current)

    if (scoreRaf.current) cancelAnimationFrame(scoreRaf.current)
    const start = visadScoreRef.current
    const diff = scoreRef.current - start
    const t0 = performance.now()
    const dur = Math.min(800, 260 + diff / 8)
    ;(function steg(nu) {
      if (!levande.current) return
      const p = Math.min(1, (nu - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      visadScoreRef.current = Math.round(start + diff * e)
      setVisadScore(visadScoreRef.current)
      if (p < 1) scoreRaf.current = requestAnimationFrame(steg)
    })(t0)
  }, [])

  // ----------------------------------------------------------------- tipset

  const avbrytTips = useCallback(() => {
    if (tipsTimer.current) clearTimeout(tipsTimer.current)
    if (tipsCeller.current.length && animRef.current) {
      animRef.current.slutaVagga(tipsCeller.current)
      tipsCeller.current = []
    }
  }, [])

  const schemalaggTips = useCallback(() => {
    avbrytTips()
    tipsTimer.current = setTimeout(() => {
      if (!levande.current || busy.current || slut) return
      const tips = findHint(boardRef.current)
      if (!tips || !animRef.current) return
      tipsCeller.current = tips.celler
      animRef.current.vagga(tips.celler)
    }, TIPS_EFTER_MS)
  }, [avbrytTips, slut])

  // ------------------------------------------------------------ detonation

  // Spelar upp signaturen för en specialbricka och returnerar hur länge
  // uppspelningen tar innan rutorna ska rensas.
  function spelaSpecial(index, tile) {
    const anim = animRef.current
    if (!anim || !tile) return 0

    anim.pulsera(index, 1.45, 180)

    if (tile.special === 'raket-h' || tile.special === 'raket-v') {
      const lodrat = tile.special === 'raket-v'
      anim.linjeStral(index, lodrat)
      anim.skaka(4, 180)
      ton(300, 240, 'sawtooth', 0.13)
      return 140
    }

    if (tile.special === 'bomb') {
      anim.ring(index, 2.6, '#fbbf24', 400)
      anim.skaka(7, 320)
      ton(150, 400, 'sawtooth', 0.16)
      return 180
    }

    if (tile.special === 'prisma') {
      anim.ring(index, 4.5, '#f472b6', 520)
      anim.skaka(9, 420)
      ton(220, 500, 'sawtooth', 0.16)
      // strålar ut till alla brickor av samma färg
      const mal = []
      boardRef.current.forEach((t, j) => {
        if (t && t.color === tile.color && j !== index) mal.push(j)
      })
      mal.slice(0, 24).forEach((j, k) => {
        anim.stral(index, j, 170, k * 22)
        senare(() => anim.flash(j, 170, 50), k * 22 + 160)
      })
      return Math.min(600, mal.length * 22 + 220)
    }

    return 0
  }

  // Rensar en uppsättning rutor med rätt uppspelning, faller, och lämnar
  // brädet redo. Returnerar antalet rensade rutor.
  async function rensa(traffade, origin) {
    const anim = animRef.current
    if (!anim) return 0

    // specialbrickor som ligger i det som rensas ska visa sin signatur först
    const aktiverade = [...traffade].filter((i) => boardRef.current[i]?.special)
    let vantan = 0
    for (const i of aktiverade) {
      vantan = Math.max(vantan, spelaSpecial(i, boardRef.current[i]))
    }
    if (vantan > 0) {
      await anim.hitstop(70)
      await vila(vantan)
      if (!levande.current) return 0
    }

    const start = origin !== null && origin !== undefined ? origin : [...traffade][0]
    await anim.popVag(traffade, {
      origin: start,
      steg: traffade.size > 20 ? 16 : 34,
      fargFor: (i) => fargFor(boardRef.current[i]),
    })
    if (!levande.current) return 0

    boardRef.current = applyClear(boardRef.current, traffade, [])
    return traffade.size
  }

  // Fallet: motorn räknar ut var allt hamnar, React renderar slutläget,
  // animationslagret förskjuter bakåt och animerar till noll.
  async function tappa() {
    const anim = animRef.current
    if (!anim) return
    const plan = planGravity(boardRef.current)
    boardRef.current = plan.board
    visaBrade()
    ton(180, 90, 'sine', 0.05)
    await anim.fall(plan.moves)
  }

  // ------------------------------------------------------------- kaskader

  // Löser matchningar i loop tills brädet står still. vagMult är 1 under
  // vanligt spel och vågnumret under finalen.
  const koorKaskad = useCallback(
    async (swapIndex, vagMult = 1) => {
      const anim = animRef.current
      if (!anim) return 0

      let kaskad = 0
      let totalt = 0

      while (levande.current && kaskad < 20) {
        const resultat = resolveMatches(boardRef.current, kaskad === 0 ? swapIndex : null)
        if (!resultat) break

        kaskad += 1
        const poang = poangFor(resultat.antal, kaskad) * vagMult
        laggPoang(poang)
        totalt += poang

        // stigande tonhöjd per kaskadnivå — det är den detaljen som gör att
        // en lång kedja känns som en belöning i sig
        ton(320 + kaskad * 90, 130, 'triangle', 0.15)

        if (kaskad >= 2) {
          await anim.hitstop(60)
          anim.banner('Kedja ×' + kaskad, {
            storlek: 18 + kaskad * 4,
            farg: kaskad >= 3 ? '#f472b6' : '#fbbf24',
            ms: 760,
          })
          anim.skaka(2 + kaskad * 2, 160 + kaskad * 60)
        }
        if (resultat.antal >= 8) anim.skaka(6, 260)

        // kaskad ar redan upprakad har, sa forsta varvet ar 1 - inte 0
        const origin = kaskad === 1 ? swapIndex : [...resultat.traffade][0]
        await rensa(resultat.traffade, origin)
        if (!levande.current) return totalt

        // nya specialbrickor: låt brickorna resa in mot platsen först
        if (resultat.specialer.length > 0) {
          for (const s of resultat.specialer) {
            anim.flash(s.plats, 260, 70)
            anim.burst(s.plats, s.special === 'prisma' ? '#f472b6' : '#fbbf24', 12, 22)
          }
          ton(680, 220, 'square', 0.1)
          boardRef.current = applyClear(boardRef.current, new Set(), resultat.specialer)
          setBoard(cloneBoard(boardRef.current))
          await vila(40)
          if (!levande.current) return totalt
          for (const s of resultat.specialer) {
            await anim.visaSpecial(s.plats)
          }
        }

        await tappa()
        if (!levande.current) return totalt
      }

      // slut på drag att göra? blanda om i stället för att avsluta
      if (levande.current && !hasValidMove(boardRef.current)) {
        anim.banner('Blandar om', { storlek: 20, farg: '#9ca3af', ms: 800 })
        await vila(500)
        if (!levande.current) return totalt
        boardRef.current = shuffle(boardRef.current)
        setBoard(cloneBoard(boardRef.current))
        ton(200, 300, 'sawtooth', 0.08)
        await vila(300)
      }

      return totalt
    },
    [laggPoang, ton, vila]
  )

  // ---------------------------------------------------------------- finalen

  // När dragen tar slut avfyras alla specialbrickor som ligger kvar, en
  // efter en med stigande tempo. Faller det ihop till nya matchningar löses
  // de ut också, och skapar de nya specialbrickor blir det en ny våg.
  //
  // Taket finns för att brädet fylls med slumpade brickor: kedjan kan
  // teoretiskt fortsätta i all oändlighet, och en final som aldrig tar slut
  // är en låst spelrunda.
  const koorFinal = useCallback(async () => {
    const anim = animRef.current
    if (!anim) return

    anim.banner('Final!', { storlek: 30, farg: '#fbbf24', ms: 1000 })
    anim.skaka(6, 280)
    ton(520, 200, 'sine', 0.16)
    await vila(750)
    if (!levande.current) return

    let vagnr = 0

    while (levande.current && vagnr < FINAL_MAX_VAGOR) {
      const specialer = listSpecials(boardRef.current)
      if (specialer.length === 0) break

      vagnr += 1
      setVag(vagnr)

      if (vagnr > 1) {
        anim.banner('Våg ' + vagnr + ' · ×' + vagnr, {
          storlek: 18 + vagnr * 3,
          farg: vagnr > 2 ? '#f472b6' : '#fbbf24',
          ms: 760,
        })
        await vila(320)
        if (!levande.current) return
      }

      for (let k = 0; k < specialer.length; k++) {
        if (!levande.current) return
        const { index } = specialer[k]
        const tile = boardRef.current[index]
        if (!tile || !tile.special) continue

        // tempot accelererar både inom vågen och mellan vågorna
        const takt = Math.max(80, 220 - k * 28 - vagnr * 20)

        const traffade = new Set()
        const rad = Math.floor(index / SIZE)
        const kol = index % SIZE

        if (tile.special === 'raket-h') {
          for (let c = 0; c < SIZE; c++) traffade.add(rad * SIZE + c)
        } else if (tile.special === 'raket-v') {
          for (let r = 0; r < SIZE; r++) traffade.add(r * SIZE + kol)
        } else if (tile.special === 'bomb') {
          for (let r = rad - 1; r <= rad + 1; r++)
            for (let c = kol - 1; c <= kol + 1; c++)
              if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) traffade.add(r * SIZE + c)
        } else if (tile.special === 'prisma') {
          boardRef.current.forEach((t, j) => {
            if (t && t.color === tile.color) traffade.add(j)
          })
          traffade.add(index)
        }

        spelaSpecial(index, tile)
        await vila(90)
        if (!levande.current) return

        laggPoang(Math.round(traffade.size * 60 * vagnr))
        await rensa(traffade, index)
        if (!levande.current) return
        await vila(takt)
      }

      await tappa()
      if (!levande.current) return

      // Kaskader efter fallet, med vågnumret som extra multiplikator.
      // koorKaskad loopar redan internt tills brädet står still, så en gång
      // per våg räcker. Vakten finns kvar för att slippa koorKaskads
      // blanda-om-gren när det inte fanns någon matchning att börja med.
      if (levande.current && resolveMatches(boardRef.current, null)) {
        await koorKaskad(null, vagnr)
      }

      await vila(220)
    }

    setVag(null)
    await vila(400)
    if (!levande.current) return
    anim.banner('Slut', { storlek: 32, farg: '#f3f4f6', ms: 1400 })
    ton(520, 160, 'sine', 0.14)
    senare(() => ton(660, 400, 'sine', 0.14), 170)
    await vila(900)
  }, [koorKaskad, laggPoang, ton, vila])

  // ------------------------------------------------------------------ drag

  const gorDrag = useCallback(
    async (a, b) => {
      if (busy.current || slut) return
      busy.current = true
      avbrytTips()
      setVald(null)

      // busy MÅSTE släppas oavsett hur vi lämnar. Utan finally låser ett
      // kastat undantag var som helst i kedjan brädet permanent.
      try {
        const anim = animRef.current
        if (!anim) return
        anim.setInstallningar(readSettings())

        const plan = planSwap(boardRef.current, a, b)

        if (!plan) {
          ton(150, 90, 'square', 0.06)
          await anim.byte(a, b, false)
          return
        }

        movesRef.current -= 1
        setMoves(movesRef.current)
        ton(420, 80, 'sine', 0.1)

        await anim.byte(a, b, true)
        if (!levande.current) return

        boardRef.current = plan.board
        setBoard(cloneBoard(boardRef.current))
        await vila(30)
        if (!levande.current) return

        if (plan.kombo) {
          if (plan.beskrivning) {
            anim.banner(plan.beskrivning, { storlek: 22, farg: '#f472b6', ms: 900 })
          }
          await anim.hitstop(80)
          anim.skaka(8, 380)
          ton(180, 420, 'sawtooth', 0.16)

          let traffade = plan.traffade

          if (plan.omvandla) {
            // prisma-kombo: alla av färgen blir raketer eller bomber först
            const om = applyOmvandla(boardRef.current, plan.omvandla)
            om.platser.forEach((j, k) => {
              anim.stral(plan.omvandla.prismaIndex, j, 170, k * 45)
              senare(() => {
                anim.flash(j, 190, 60)
                anim.pulsera(j, 1.3, 240)
              }, k * 45 + 165)
            })
            boardRef.current = om.board
            setBoard(cloneBoard(boardRef.current))
            await vila(om.platser.length * 45 + 420)
            if (!levande.current) return

            // sedan avfyras de i tur och ordning, var och en rensar sin linje
            const alla = [plan.omvandla.prismaIndex, ...om.platser]
            for (const j of alla) {
              const t = boardRef.current[j]
              if (!t || !t.special) continue
              const traff = new Set()
              const r = Math.floor(j / SIZE)
              const c = j % SIZE
              if (t.special === 'raket-h') {
                for (let x = 0; x < SIZE; x++) traff.add(r * SIZE + x)
              } else if (t.special === 'raket-v') {
                for (let y = 0; y < SIZE; y++) traff.add(y * SIZE + c)
              } else {
                for (let rr = r - 1; rr <= r + 1; rr++)
                  for (let cc = c - 1; cc <= c + 1; cc++)
                    if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE)
                      traff.add(rr * SIZE + cc)
              }
              spelaSpecial(j, t)
              await vila(80)
              if (!levande.current) return
              laggPoang(poangFor(traff.size, 2))
              await rensa(traff, j)
              if (!levande.current) return
              await vila(120)
            }
            await tappa()
            if (!levande.current) return
          } else {
            laggPoang(poangFor(traffade.size, 2))
            await rensa(traffade, b)
            if (!levande.current) return
            await tappa()
            if (!levande.current) return
          }
        }

        await koorKaskad(b)
        if (!levande.current) return

        if (movesRef.current <= 0) {
          await koorFinal()
          if (!levande.current) return
          setSlut(true)
          if (!reported.current) {
            reported.current = true
            overRef.current(scoreRef.current)
          }
        } else {
          schemalaggTips()
        }
      } finally {
        busy.current = false
      }
    },
    [avbrytTips, koorFinal, koorKaskad, laggPoang, schemalaggTips, slut, ton, vila]
  )

  function klicka(index) {
    if (busy.current || slut) return
    avbrytTips()

    if (vald === null) {
      setVald(index)
      schemalaggTips()
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

    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
      gorDrag(vald, index)
    } else {
      setVald(index)
    }
  }

  // starta tipstimern när brädet är klart
  useEffect(() => {
    schemalaggTips()
    return avbrytTips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cellProcent = 100 / SIZE

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <style>{`@keyframes krossVagga{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-5px) rotate(-6deg)}75%{transform:translateY(-2px) rotate(6deg)}}`}</style>

      <div className="w-full max-w-[400px] flex items-center justify-between text-sm px-1">
        <div>
          <div className="text-xs text-gray-500">Poäng</div>
          <div className="text-gray-100 font-medium text-lg tabular-nums">
            {visadScore.toLocaleString('sv-SE')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">{vag ? 'Våg' : 'Drag kvar'}</div>
          <div
            className={`font-medium text-lg tabular-nums ${
              vag ? 'text-amber-400' : moves <= 3 ? 'text-red-400' : 'text-gray-100'
            }`}
          >
            {vag !== null ? vag : moves}
          </div>
        </div>
      </div>

      <div
        ref={bradRef}
        className="relative w-full max-w-[400px] bg-gray-900 rounded-xl p-1.5 touch-none select-none overflow-hidden"
        style={{
          aspectRatio: '1 / 1',
          boxShadow: moves <= 3 && !slut ? 'inset 0 0 40px rgba(248,113,113,.3)' : 'none',
          transition: 'box-shadow 600ms ease-in-out',
        }}
      >
        {board.map((tile, i) => {
          if (!tile) return null
          const r = Math.floor(i / SIZE)
          const c = i % SIZE
          return (
            <button
              key={tile.id}
              data-cell={i}
              onPointerDown={() => klicka(i)}
              aria-label={`Ruta ${r + 1},${c + 1}`}
              className="absolute p-0.5"
              style={{
                left: `${c * cellProcent}%`,
                top: `${r * cellProcent}%`,
                width: `${cellProcent}%`,
                height: `${cellProcent}%`,
                zIndex: vald === i ? 10 : 1,
              }}
            >
              <div
                className={`w-full h-full rounded-lg transition-all duration-150 ${
                  vald === i ? 'ring-2 ring-white/70 bg-white/10 scale-110' : ''
                }`}
              >
                <Piece tile={tile} />
              </div>
            </button>
          )
        })}

        {slut && (
          <div className="absolute inset-0 bg-black/75 rounded-xl grid place-items-center z-30">
            <div className="text-center">
              <div className="text-gray-400 text-sm">Slut</div>
              <div className="text-gray-100 text-3xl font-medium mt-1 tabular-nums">
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
