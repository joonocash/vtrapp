import { useEffect, useRef, useState } from 'react'

// Stack Tower. En input: tap eller mellanslag. Blocket glider fram och
// tillbaka, du släpper det, överhänget kapas bort och nästa block blir
// smalare. Missar du helt är det slut.
//
// Perfekt mobilspel — hela styrningen är att peka var som helst.

const W = 320
const H = 480
const BLOCK_H = 24
const START_WIDTH = 200
const VISIBLE_ROWS = Math.floor(H / BLOCK_H) - 2

const HUES = [160, 175, 190, 205, 220, 235, 250, 265, 280, 295]

export default function StackTower({ onGameOver }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [score, setScore] = useState(0)
  const [dead, setDead] = useState(false)

  const overRef = useRef(onGameOver)
  useEffect(() => {
    overRef.current = onGameOver
  })

  const state = useRef({
    stack: [{ x: (W - START_WIDTH) / 2, width: START_WIDTH }],
    current: { x: 0, width: START_WIDTH, dir: 1, speed: 2 },
    score: 0,
    dead: false,
    reported: false,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = null

    function drop() {
      const s = state.current
      if (s.dead) return

      const below = s.stack[s.stack.length - 1]
      const cur = s.current

      const left = Math.max(cur.x, below.x)
      const right = Math.min(cur.x + cur.width, below.x + below.width)
      const overlap = right - left

      if (overlap <= 0) {
        s.dead = true
        setDead(true)
        if (!s.reported) {
          s.reported = true
          overRef.current(s.score)
        }
        return
      }

      s.stack.push({ x: left, width: overlap })
      s.score += 1
      setScore(s.score)

      s.current = {
        x: 0,
        width: overlap,
        dir: 1,
        // snabbare för varje block, taket ligger på 6 px per frame
        speed: Math.min(6, 2 + s.score * 0.12),
      }
    }

    function tick() {
      const s = state.current
      if (!s.dead) {
        const cur = s.current
        cur.x += cur.dir * cur.speed
        if (cur.x <= 0) {
          cur.x = 0
          cur.dir = 1
        } else if (cur.x + cur.width >= W) {
          cur.x = W - cur.width
          cur.dir = -1
        }
      }
      draw()
      raf = requestAnimationFrame(tick)
    }

    function draw() {
      const s = state.current
      ctx.fillStyle = '#0b1220'
      ctx.fillRect(0, 0, W, H)

      // rita bara de översta raderna, kameran följer tornet uppåt
      const start = Math.max(0, s.stack.length - VISIBLE_ROWS)

      for (let i = start; i < s.stack.length; i++) {
        const block = s.stack[i]
        const rowFromTop = s.stack.length - 1 - i
        const y = H - BLOCK_H * 2 - rowFromTop * BLOCK_H
        ctx.fillStyle = `hsl(${HUES[i % HUES.length]} 60% 55%)`
        ctx.fillRect(block.x, y, block.width, BLOCK_H - 2)
      }

      if (!s.dead) {
        const cur = s.current
        const y = H - BLOCK_H * 2 - Math.min(s.stack.length, VISIBLE_ROWS) * BLOCK_H
        ctx.fillStyle = `hsl(${HUES[s.stack.length % HUES.length]} 65% 65%)`
        ctx.fillRect(cur.x, y, cur.width, BLOCK_H - 2)
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#f3f4f6'
        ctx.font = '500 20px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Missade', W / 2, H / 2)
      }
    }

    function onKey(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        drop()
      }
    }

    function onPointer(e) {
      e.preventDefault()
      drop()
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
        <span className="text-gray-400">Höjd</span>
        <span className="text-gray-100 font-medium">{score}</span>
      </div>
      <div ref={wrapRef} className="touch-none select-none w-full max-w-[320px]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="rounded-lg w-full h-auto"
        />
      </div>
      <p className="text-xs text-gray-500">
        {dead ? 'Tryck "Igen" nedanför.' : 'Peka på tornet eller tryck mellanslag.'}
      </p>
    </div>
  )
}
