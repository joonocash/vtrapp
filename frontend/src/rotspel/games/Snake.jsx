import { useCallback, useEffect, useRef, useState } from 'react'
import { useSwipe, useArrowKeys } from '../useSwipe.js'

// Referensimplementation. Kopiera mönstret för nya spel:
//   - all speltillstånd i en ref, inte i state (state ger rerender varje frame)
//   - onGameOver(score) anropas exakt en gång per runda
//   - städa upp alla listeners och timers i useEffect-returen

const GRID = 20
const CELL = 20
const SIZE = GRID * CELL

export default function Snake({ onGameOver }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [score, setScore] = useState(0)
  const [dead, setDead] = useState(false)

  const state = useRef({
    snake: [{ x: 10, y: 10 }],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 15, y: 10 },
    score: 0,
    dead: false,
  })

  // En enda riktningsfunktion för både svep och tangenter. Ligger på
  // komponentnivå och läser state-refen, så den behöver inga deps.
  const handleDirection = useCallback((dir) => {
    const s = state.current
    const map = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    }
    const next = map[dir]
    if (!next) return
    // förhindra att man vänder rakt in i sig själv
    if (next.x === -s.dir.x && next.y === -s.dir.y) return
    s.nextDir = next
  }, [])

  useArrowKeys(handleDirection)
  useSwipe(wrapRef, { onSwipe: handleDirection })

  // onGameOver hålls i en ref så huvudeffekten kan ha tom dependency-array.
  // Föräldern skapar om callbacken vid varje render; låg den kvar i arrayen skulle
  // effekten rivas och byggas upp mitt i en runda — maten flyttas och intervallet
  // nollställs. Kopiera det här mönstret till nya spel.
  const overRef = useRef(onGameOver)
  useEffect(() => {
    overRef.current = onGameOver
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let timer = null
    let reported = false

    function placeFood() {
      const s = state.current
      let spot
      do {
        spot = {
          x: Math.floor(Math.random() * GRID),
          y: Math.floor(Math.random() * GRID),
        }
      } while (s.snake.some((p) => p.x === spot.x && p.y === spot.y))
      s.food = spot
    }

    function step() {
      const s = state.current
      if (s.dead) return

      s.dir = s.nextDir
      const head = {
        x: s.snake[0].x + s.dir.x,
        y: s.snake[0].y + s.dir.y,
      }

      const hitWall =
        head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID
      const hitSelf = s.snake.some((p) => p.x === head.x && p.y === head.y)

      if (hitWall || hitSelf) {
        s.dead = true
        setDead(true)
        if (!reported) {
          reported = true
          overRef.current(s.score)
        }
        draw()
        return
      }

      s.snake.unshift(head)

      if (head.x === s.food.x && head.y === s.food.y) {
        s.score += 10
        setScore(s.score)
        placeFood()
        schedule()
      } else {
        s.snake.pop()
      }

      draw()
    }

    function draw() {
      const s = state.current
      ctx.fillStyle = '#0b1220'
      ctx.fillRect(0, 0, SIZE, SIZE)

      ctx.fillStyle = '#f87171'
      ctx.fillRect(s.food.x * CELL + 4, s.food.y * CELL + 4, CELL - 8, CELL - 8)

      s.snake.forEach((p, i) => {
        ctx.fillStyle = i === 0 ? '#4ade80' : '#22a95a'
        ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2)
      })

      if (s.dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(0, 0, SIZE, SIZE)
        ctx.fillStyle = '#f3f4f6'
        ctx.font = '500 20px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Död', SIZE / 2, SIZE / 2)
      }
    }

    function speed() {
      // startar på 130 ms, snabbar upp mot 60 ms
      return Math.max(60, 130 - state.current.snake.length * 2)
    }

    function schedule() {
      if (timer) clearInterval(timer)
      timer = setInterval(step, speed())
    }

    placeFood()
    draw()
    schedule()

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full flex items-center justify-between text-sm px-1">
        <span className="text-gray-400">Poäng</span>
        <span className="text-gray-100 font-medium">{score}</span>
      </div>
      <div ref={wrapRef} className="touch-none select-none w-full max-w-[400px]">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="rounded-lg w-full h-auto"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <p className="text-xs text-gray-500">
        {dead ? 'Tryck "Igen" nedanför.' : 'Svep eller piltangenter.'}
      </p>
    </div>
  )
}
