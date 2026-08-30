import { useEffect, useRef, useState } from 'react'

// Stoppet. Visaren snurrar, du trycker när den är i den gröna zonen.
// Träffar du krymper zonen och farten ökar. Missar du är det slut.
//
// Enklaste möjliga spel att bygga, och ett av de mest rötiga: en input,
// omedelbar dom, och känslan att man var precis nästan framme.

const SIZE = 300
const CENTER = SIZE / 2
const RADIUS = 118

const START_ZONE = 0.42 // radianer, halva zonens bredd
const MIN_ZONE = 0.07
const START_SPEED = 0.028
const MAX_SPEED = 0.095

export default function Stoppet({ onGameOver }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [hits, setHits] = useState(0)
  const [dead, setDead] = useState(false)
  const [perfect, setPerfect] = useState(false)

  const overRef = useRef(onGameOver)
  useEffect(() => {
    overRef.current = onGameOver
  })

  const state = useRef({
    angle: 0,
    speed: START_SPEED,
    dir: 1,
    target: Math.PI * 1.5,
    zone: START_ZONE,
    hits: 0,
    dead: false,
    reported: false,
    flash: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = null

    function angleDistance(a, b) {
      let d = Math.abs(a - b) % (Math.PI * 2)
      if (d > Math.PI) d = Math.PI * 2 - d
      return d
    }

    function attempt() {
      const s = state.current
      if (s.dead) return

      const dist = angleDistance(s.angle, s.target)

      if (dist > s.zone) {
        s.dead = true
        setDead(true)
        if (!s.reported) {
          s.reported = true
          overRef.current(s.hits)
        }
        return
      }

      s.hits += 1
      setHits(s.hits)
      // perfekt = inom en tiondel av zonen
      const wasPerfect = dist < s.zone * 0.1
      setPerfect(wasPerfect)
      s.flash = wasPerfect ? 20 : 10

      // ny position för zonen, aldrig för nära den gamla
      let next
      do {
        next = Math.random() * Math.PI * 2
      } while (angleDistance(next, s.target) < 1.2)
      s.target = next

      s.zone = Math.max(MIN_ZONE, START_ZONE * Math.pow(0.93, s.hits))
      s.speed = Math.min(MAX_SPEED, START_SPEED + s.hits * 0.0022)
      // byt riktning ibland så man inte kan lära sig rytmen
      if (Math.random() < 0.3) s.dir *= -1
    }

    function draw() {
      const s = state.current
      ctx.clearRect(0, 0, SIZE, SIZE)

      // yttre ring
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 22
      ctx.beginPath()
      ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2)
      ctx.stroke()

      // målzonen
      if (!s.dead) {
        ctx.strokeStyle = s.flash > 0 ? '#86efac' : '#22c55e'
        ctx.lineWidth = 22
        ctx.beginPath()
        ctx.arc(CENTER, CENTER, RADIUS, s.target - s.zone, s.target + s.zone)
        ctx.stroke()
      }

      // visaren
      ctx.strokeStyle = s.dead ? '#6b7280' : '#f3f4f6'
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(CENTER, CENTER)
      ctx.lineTo(
        CENTER + Math.cos(s.angle) * (RADIUS + 4),
        CENTER + Math.sin(s.angle) * (RADIUS + 4)
      )
      ctx.stroke()

      // nav
      ctx.fillStyle = '#374151'
      ctx.beginPath()
      ctx.arc(CENTER, CENTER, 8, 0, Math.PI * 2)
      ctx.fill()

      // räknare i mitten
      ctx.fillStyle = s.dead ? '#9ca3af' : '#f3f4f6'
      ctx.font = '500 44px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(s.hits), CENTER, CENTER - 34)

      if (s.flash > 0) s.flash -= 1
    }

    function tick() {
      const s = state.current
      if (!s.dead) {
        s.angle += s.speed * s.dir
        if (s.angle > Math.PI * 2) s.angle -= Math.PI * 2
        if (s.angle < 0) s.angle += Math.PI * 2
      }
      draw()
      raf = requestAnimationFrame(tick)
    }

    function onKey(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        attempt()
      }
    }

    function onPointer(e) {
      e.preventDefault()
      attempt()
    }

    const el = wrapRef.current
    window.addEventListener('keydown', onKey)
    if (el) el.addEventListener('pointerdown', onPointer)
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('keydown', onKey)
      if (el) el.removeEventListener('pointerdown', onPointer)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full flex items-center justify-between text-sm px-1">
        <span className="text-gray-400">Träffar</span>
        <span className="text-gray-100 font-medium">{hits}</span>
      </div>

      <div
        ref={wrapRef}
        className="touch-none select-none w-full max-w-[300px] cursor-pointer"
      >
        <canvas ref={canvasRef} width={SIZE} height={SIZE} className="w-full h-auto" />
      </div>

      <p className="text-xs h-4">
        {dead ? (
          <span className="text-gray-500">Missade. Tryck "Igen" nedanför.</span>
        ) : perfect && hits > 0 ? (
          <span className="text-green-400">Mitt i prick.</span>
        ) : (
          <span className="text-gray-500">Peka eller tryck mellanslag i den gröna zonen.</span>
        )}
      </p>
    </div>
  )
}
