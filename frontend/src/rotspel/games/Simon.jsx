import { useState, useRef, useEffect, useCallback } from 'react'

// Färgminne. Sekvensen växer med ett steg per runda, du upprepar den.
// Ren tap-styrning, så den är identisk på mobil och desktop.
//
// Tonerna gör hälften av jobbet — utan ljud blir det bara ett minnestest,
// med ljud fastnar mönstret i örat och det blir mycket beroendeframkallande.

const PADS = [
  { id: 0, base: 'bg-green-700', lit: 'bg-green-400', freq: 329.63 },
  { id: 1, base: 'bg-red-700', lit: 'bg-red-400', freq: 261.63 },
  { id: 2, base: 'bg-amber-600', lit: 'bg-amber-300', freq: 220.0 },
  { id: 3, base: 'bg-blue-700', lit: 'bg-blue-400', freq: 164.81 },
]

const SHOW_MS = 420
const GAP_MS = 180

export default function Simon({ onGameOver }) {
  const overRef = useRef(onGameOver)
  useEffect(() => {
    overRef.current = onGameOver
  })

  const [sequence, setSequence] = useState([])
  const [lit, setLit] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | visar | dinTur | slut
  const [round, setRound] = useState(0)

  const inputIndex = useRef(0)
  const timers = useRef([])
  const audioCtx = useRef(null)
  const reported = useRef(false)

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
      if (audioCtx.current) audioCtx.current.close().catch(() => {})
    }
  }, [])

  function tone(freq, ms = 300) {
    try {
      if (!audioCtx.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return
        audioCtx.current = new Ctx()
      }
      const ctx = audioCtx.current
      // iOS kräver att kontexten återupptas efter en användargest
      if (ctx.state === 'suspended') ctx.resume()

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + ms / 1000)
    } catch {
      // ljud är valfritt, spelet funkar utan
    }
  }

  const playSequence = useCallback((seq) => {
    setPhase('visar')
    timers.current.forEach(clearTimeout)
    timers.current = []

    seq.forEach((padId, i) => {
      const at = i * (SHOW_MS + GAP_MS)
      timers.current.push(
        setTimeout(() => {
          setLit(padId)
          tone(PADS[padId].freq, SHOW_MS)
        }, at)
      )
      timers.current.push(setTimeout(() => setLit(null), at + SHOW_MS))
    })

    timers.current.push(
      setTimeout(() => {
        inputIndex.current = 0
        setPhase('dinTur')
      }, seq.length * (SHOW_MS + GAP_MS))
    )
  }, [])

  function start() {
    reported.current = false
    const first = [Math.floor(Math.random() * 4)]
    setSequence(first)
    setRound(1)
    playSequence(first)
  }

  function press(padId) {
    if (phase !== 'dinTur') return

    setLit(padId)
    tone(PADS[padId].freq, 220)
    // måste spåras som alla andra, annars överlever den unmount
    timers.current.push(setTimeout(() => setLit(null), 180))

    if (sequence[inputIndex.current] !== padId) {
      setPhase('slut')
      if (!reported.current) {
        reported.current = true
        // poängen är hur många rundor du klarade, alltså sekvensen minus den du sket i
        overRef.current(sequence.length - 1)
      }
      tone(80, 500)
      return
    }

    inputIndex.current += 1

    if (inputIndex.current === sequence.length) {
      const next = [...sequence, Math.floor(Math.random() * 4)]
      setSequence(next)
      setRound(next.length)
      timers.current.push(setTimeout(() => playSequence(next), 600))
    }
  }

  const statusText = {
    idle: 'Tryck start.',
    visar: 'Titta.',
    dinTur: 'Din tur.',
    slut: 'Fel. Tryck "Igen" nedanför.',
  }[phase]

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full flex items-center justify-between text-sm px-1">
        <span className="text-gray-400">Runda</span>
        <span className="text-gray-100 font-medium">{round}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-[320px] touch-none select-none">
        {PADS.map((pad) => (
          <button
            key={pad.id}
            onPointerDown={() => press(pad.id)}
            disabled={phase !== 'dinTur'}
            aria-label={`Platta ${pad.id + 1}`}
            className={`aspect-square rounded-xl transition-colors duration-100 ${
              lit === pad.id ? pad.lit : pad.base
            } ${phase === 'dinTur' ? 'cursor-pointer' : 'cursor-default'}`}
          />
        ))}
      </div>

      <p className="text-xs text-gray-500 h-4">{statusText}</p>

      {(phase === 'idle' || phase === 'slut') && (
        <button
          onClick={start}
          className="bg-blue-600 hover:bg-blue-500 text-blue-50 text-sm px-5 py-2 rounded-lg"
        >
          {phase === 'idle' ? 'Start' : 'Ny sekvens'}
        </button>
      )}
    </div>
  )
}
