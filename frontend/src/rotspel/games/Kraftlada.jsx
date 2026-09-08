import { useEffect, useRef, useState } from 'react'
import { KRAFTER, GRADER, kraftMedId } from './pinnbollenKrafter.js'

// Lådan som öppnas när man träffat en grön pinne.
//
// Två detaljer som gör att det känns rätt:
//   - remsan stannar inte exakt på markören, utan med en slumpad förskjutning.
//     Landar den alltid perfekt centrerat syns det att resultatet var bestämt
//     i förväg — vilket det är, men det ska inte märkas.
//   - klicken kommer från remsans faktiska position, inte från en fast takt,
//     så de saktar in tillsammans med den.
//
// Vinnaren är redan dragen av motorn när den här komponenten monteras.
// Animationen visar bara upp den.

const KORT_BREDD = 98
const VINSTINDEX = 46
const ANTAL_KORT = 54
const SNURR_MS = 4200

function Ikon({ kraft, farg }) {
  const p = { fill: 'none', stroke: farg, strokeWidth: 2.2 }
  switch (kraft.id) {
    case 'trippel':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <circle cx="7" cy="10" r="3.5" fill={farg} />
          <circle cx="17" cy="10" r="3.5" fill={farg} />
          <circle cx="12" cy="17" r="3.5" fill={farg} />
        </svg>
      )
    case 'stor':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" {...p} />
          <circle cx="12" cy="12" r="4" fill={farg} />
        </svg>
      )
    case 'magnet':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M6 18V10a6 6 0 0112 0v8" {...p} />
          <path d="M4 18h4M16 18h4" {...p} />
        </svg>
      )
    case 'genom':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M3 12h18" stroke={farg} strokeWidth="2.2" strokeDasharray="3 3" />
          <circle cx="6" cy="12" r="3" fill={farg} />
        </svg>
      )
    case 'golv':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M4 19h16" {...p} />
          <path d="M12 15V5M8 9l4-4 4 4" {...p} />
        </svg>
      )
    case 'hink':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M4 9h16l-2 10H6z" {...p} />
        </svg>
      )
    default:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="6" fill={farg} />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" {...p} />
        </svg>
      )
  }
}

function Kort({ kraft }) {
  const g = GRADER[kraft.grad]
  return (
    <div
      className="flex-shrink-0 mx-[3px] h-[70px] w-[92px] rounded-lg flex flex-col items-center justify-center gap-1 text-[11px] text-gray-200"
      style={{ background: g.bakgrund, borderBottom: '3px solid ' + g.farg }}
    >
      <Ikon kraft={kraft} farg={g.farg} />
      <span>{kraft.namn}</span>
    </div>
  )
}

export default function Kraftlada({ kraftId, onKlar, ton }) {
  const stripRef = useRef(null)
  const boxRef = useRef(null)
  const [klar, setKlar] = useState(false)
  const timers = useRef([])
  const levande = useRef(true)

  const vinst = kraftMedId(kraftId) || KRAFTER[0]

  // Remsan byggs en gång. Vinnaren placeras på VINSTINDEX, resten är slump.
  const kort = useRef(null)
  if (kort.current === null) {
    kort.current = Array.from({ length: ANTAL_KORT }, (_, i) =>
      i === VINSTINDEX ? vinst : KRAFTER[Math.floor(Math.random() * KRAFTER.length)]
    )
  }

  useEffect(() => {
    const strip = stripRef.current
    const box = boxRef.current
    if (!strip || !box) return

    const mitt = box.clientWidth / 2
    const slump = (Math.random() - 0.5) * 44
    const mal = -(VINSTINDEX * KORT_BREDD + KORT_BREDD / 2 - mitt) + slump

    strip.style.transition = 'none'
    strip.style.transform = 'translateX(0px)'

    const raf = requestAnimationFrame(() => {
      strip.style.transition = 'transform ' + SNURR_MS + 'ms cubic-bezier(.08,.72,.16,1)'
      strip.style.transform = 'translateX(' + mal + 'px)'
    })

    // klicken följer remsans faktiska position
    let sistaKort = 0
    const t0 = performance.now()
    let bevakning = null
    function bevaka(nu) {
      if (!levande.current) return
      const t = Math.min(1, (nu - t0) / SNURR_MS)
      const e = 1 - Math.pow(1 - t, 3.1)
      const kortNu = Math.floor(Math.abs(mal * e) / KORT_BREDD)
      if (kortNu !== sistaKort) {
        sistaKort = kortNu
        if (ton) ton(1400, 30, 'square', 0.03)
      }
      if (t < 1) bevakning = requestAnimationFrame(bevaka)
    }
    bevakning = requestAnimationFrame(bevaka)

    const t = setTimeout(() => {
      if (!levande.current) return
      setKlar(true)
      if (ton) {
        const g = vinst.grad
        ton(g === 'sallsynt' ? 720 : g === 'ovanlig' ? 560 : 440, 300, 'sine', 0.15)
      }
    }, SNURR_MS + 60)
    timers.current.push(t)

    return () => {
      levande.current = false
      cancelAnimationFrame(raf)
      if (bevakning) cancelAnimationFrame(bevakning)
      timers.current.forEach(clearTimeout)
    }
  }, [ton, vinst])

  const g = GRADER[vinst.grad]

  return (
    <div className="absolute inset-0 z-40 bg-black/85 rounded-lg flex flex-col justify-center gap-3 p-3">
      <div
        ref={boxRef}
        className="relative h-[88px] bg-gray-950 rounded-lg overflow-hidden border border-gray-800"
        style={{
          boxShadow: klar && vinst.grad === 'sallsynt' ? '0 0 26px rgba(251,191,36,.5)' : 'none',
          transition: 'box-shadow 400ms',
        }}
      >
        <div ref={stripRef} className="absolute inset-y-0 left-0 flex items-center">
          {kort.current.map((k, i) => (
            <Kort key={i} kraft={k} />
          ))}
        </div>
        <div
          className="absolute left-1/2 inset-y-0 w-0.5 -translate-x-px z-10"
          style={{ background: '#fbbf24', boxShadow: '0 0 10px rgba(251,191,36,.8)' }}
        />
      </div>

      <div
        className="rounded-lg p-3 border transition-opacity duration-300"
        style={{
          borderColor: klar ? g.farg : '#1f2937',
          background: '#0b1120',
          opacity: klar ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-lg grid place-items-center flex-shrink-0"
            style={{ background: g.bakgrund }}
          >
            <Ikon kraft={vinst} farg={g.farg} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px]" style={{ color: g.farg }}>
              {g.namn}
            </div>
            <div className="text-[15px] font-medium text-gray-100">{vinst.namn}</div>
            <div className="text-xs text-gray-400 mt-0.5">{vinst.text}</div>
          </div>
        </div>
      </div>

      <button
        onClick={onKlar}
        disabled={!klar}
        className="mx-auto text-sm px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-blue-50 disabled:opacity-40"
      >
        {klar ? 'Fortsätt' : '…'}
      </button>
    </div>
  )
}
