import { useEffect, useRef, useState } from 'react'

// Sandlådan. Cellulär automat: sand faller, vatten rinner, eld sprider sig,
// växter växer i vatten. Ingen poäng, ingen runda — bara något att pilla med.
//
// Rita med fingret eller musen. Perfekt mobilspel just för att touch är
// det naturliga sättet att styra.
//
// Prestanda: rutnätet ligger i en Uint8Array och ritas via ImageData, inte
// med fillRect per cell. Med 120×160 celler är det 19 200 uppdateringar per
// frame och det klarar en telefon utan problem.

const COLS = 120
const ROWS = 160
const CELL = 3

const EMPTY = 0
const SAND = 1
const WATER = 2
const STONE = 3
const FIRE = 4
const PLANT = 5
const SMOKE = 6

const MATERIALS = [
  { id: SAND, name: 'Sand', swatch: '#d4a843' },
  { id: WATER, name: 'Vatten', swatch: '#3b82f6' },
  { id: STONE, name: 'Sten', swatch: '#6b7280' },
  { id: PLANT, name: 'Växt', swatch: '#22c55e' },
  { id: FIRE, name: 'Eld', swatch: '#ef4444' },
  { id: EMPTY, name: 'Sudda', swatch: '#111827' },
]

// rgb per materialtyp, indexerat på id
const COLORS = [
  [17, 24, 39],
  [212, 168, 67],
  [59, 130, 246],
  [107, 114, 128],
  [239, 68, 68],
  [34, 197, 94],
  [75, 85, 99],
]

export default function Sandladan() {
  const canvasRef = useRef(null)
  const [material, setMaterial] = useState(SAND)
  const [brush, setBrush] = useState(3)

  const materialRef = useRef(material)
  materialRef.current = material
  const brushRef = useRef(brush)
  brushRef.current = brush

  const gridRef = useRef(new Uint8Array(COLS * ROWS))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const image = ctx.createImageData(COLS, ROWS)
    const grid = gridRef.current
    let raf = null
    let drawing = false

    const idx = (x, y) => y * COLS + x
    const inside = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS

    function swap(a, b) {
      const tmp = grid[a]
      grid[a] = grid[b]
      grid[b] = tmp
    }

    function step() {
      // nerifrån och upp, annars faller allt hela vägen på en frame
      for (let y = ROWS - 2; y >= 0; y--) {
        // växla riktning per rad så det inte driver åt ett håll
        const leftFirst = Math.random() < 0.5
        for (let i = 0; i < COLS; i++) {
          const x = leftFirst ? i : COLS - 1 - i
          const here = idx(x, y)
          const type = grid[here]
          if (type === EMPTY || type === STONE) continue

          const below = idx(x, y + 1)

          if (type === SAND) {
            if (grid[below] === EMPTY || grid[below] === WATER) {
              swap(here, below)
            } else {
              const dir = Math.random() < 0.5 ? -1 : 1
              if (inside(x + dir, y + 1) && grid[idx(x + dir, y + 1)] === EMPTY) {
                swap(here, idx(x + dir, y + 1))
              }
            }
          } else if (type === WATER) {
            if (grid[below] === EMPTY) {
              swap(here, below)
            } else {
              const dir = Math.random() < 0.5 ? -1 : 1
              if (inside(x + dir, y + 1) && grid[idx(x + dir, y + 1)] === EMPTY) {
                swap(here, idx(x + dir, y + 1))
              } else if (inside(x + dir, y) && grid[idx(x + dir, y)] === EMPTY) {
                swap(here, idx(x + dir, y))
              }
            }
          } else if (type === FIRE) {
            // eld tänder växter och slocknar av sig själv
            let spread = false
            for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
              if (!inside(x + dx, y + dy)) continue
              const n = idx(x + dx, y + dy)
              if (grid[n] === PLANT && Math.random() < 0.35) {
                grid[n] = FIRE
                spread = true
              } else if (grid[n] === WATER) {
                grid[here] = SMOKE
                spread = true
                break
              }
            }
            if (!spread && Math.random() < 0.06) grid[here] = SMOKE
            else if (Math.random() < 0.02) grid[here] = EMPTY
          } else if (type === SMOKE) {
            if (y > 0 && grid[idx(x, y - 1)] === EMPTY) {
              swap(here, idx(x, y - 1))
            }
            if (Math.random() < 0.04) grid[here] = EMPTY
          } else if (type === PLANT) {
            // växer uppåt om det finns vatten intill
            if (y > 0 && grid[idx(x, y - 1)] === EMPTY && Math.random() < 0.012) {
              let hasWater = false
              for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]]) {
                if (inside(x + dx, y + dy) && grid[idx(x + dx, y + dy)] === WATER) {
                  hasWater = true
                  break
                }
              }
              if (hasWater) grid[idx(x, y - 1)] = PLANT
            }
          }
        }
      }
    }

    function render() {
      const data = image.data
      for (let i = 0; i < grid.length; i++) {
        const c = COLORS[grid[i]] || COLORS[0]
        const p = i * 4
        data[p] = c[0]
        data[p + 1] = c[1]
        data[p + 2] = c[2]
        data[p + 3] = 255
      }
      ctx.putImageData(image, 0, 0)
    }

    function paint(clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      const x = Math.floor(((clientX - rect.left) / rect.width) * COLS)
      const y = Math.floor(((clientY - rect.top) / rect.height) * ROWS)
      const r = brushRef.current
      const mat = materialRef.current

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue
          const nx = x + dx
          const ny = y + dy
          if (!inside(nx, ny)) continue
          // gles utfyllnad för vätskor så det inte blir en solid klump
          if (mat !== EMPTY && mat !== STONE && Math.random() < 0.25) continue
          grid[idx(nx, ny)] = mat
        }
      }
    }

    function onDown(e) {
      e.preventDefault()
      drawing = true
      canvas.setPointerCapture(e.pointerId)
      paint(e.clientX, e.clientY)
    }
    function onMove(e) {
      if (!drawing) return
      e.preventDefault()
      paint(e.clientX, e.clientY)
    }
    function onUp() {
      drawing = false
    }

    function loop() {
      step()
      render()
      raf = requestAnimationFrame(loop)
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    loop()

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  function clear() {
    gridRef.current.fill(EMPTY)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full max-w-[360px] touch-none select-none">
        <canvas
          ref={canvasRef}
          width={COLS}
          height={ROWS}
          className="w-full h-auto rounded-lg bg-gray-900 touch-none select-none"
          style={{ imageRendering: 'pixelated', aspectRatio: `${COLS} / ${ROWS}` }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 justify-center w-full max-w-[360px]">
        {MATERIALS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMaterial(m.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
              material === m.id
                ? 'bg-gray-700 text-gray-100'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
            }`}
          >
            <span
              className="w-3 h-3 rounded-sm border border-gray-600"
              style={{ backgroundColor: m.swatch }}
            />
            {m.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 w-full max-w-[360px]">
        <span className="text-xs text-gray-500 shrink-0">Pensel</span>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={brush}
          onChange={(e) => setBrush(Number(e.target.value))}
          className="flex-1"
        />
        <button
          onClick={clear}
          className="text-xs text-gray-500 hover:text-red-400 shrink-0"
        >
          Töm
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Rita med fingret. Växter växer om de står i vatten.
      </p>
    </div>
  )
}
