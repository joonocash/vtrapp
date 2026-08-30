import { useState, useRef, useEffect, useCallback } from 'react'
import { useSwipe, useArrowKeys } from '../useSwipe.js'

// 2048. DOM-baserat istället för canvas — brädet är bara 16 rutor, och
// DOM ger gratis responsivitet och läsbar text på mobil.

const SIZE = 4

const TILE_COLORS = {
  2: 'bg-gray-600 text-gray-100',
  4: 'bg-gray-500 text-gray-100',
  8: 'bg-orange-700 text-orange-50',
  16: 'bg-orange-600 text-orange-50',
  32: 'bg-red-600 text-red-50',
  64: 'bg-red-500 text-red-50',
  128: 'bg-amber-600 text-amber-50',
  256: 'bg-amber-500 text-amber-50',
  512: 'bg-yellow-500 text-yellow-900',
  1024: 'bg-green-600 text-green-50',
  2048: 'bg-green-500 text-green-900',
}

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function addRandomTile(board) {
  const free = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) free.push([r, c])
    }
  }
  if (free.length === 0) return false
  const [r, c] = free[Math.floor(Math.random() * free.length)]
  board[r][c] = Math.random() < 0.9 ? 2 : 4
  return true
}

// Slår ihop en rad åt vänster. Returnerar { row, gained, moved }.
function collapse(line) {
  const filtered = line.filter((v) => v !== 0)
  const result = []
  let gained = 0

  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2
      result.push(merged)
      gained += merged
      i++
    } else {
      result.push(filtered[i])
    }
  }

  while (result.length < SIZE) result.push(0)
  const moved = result.some((v, i) => v !== line[i])
  return { row: result, gained, moved }
}

function rotate(board) {
  // 90 grader medurs
  const out = emptyBoard()
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      out[c][SIZE - 1 - r] = board[r][c]
    }
  }
  return out
}

const ROTATIONS = { left: 0, up: 1, right: 2, down: 3 }

function move(board, direction) {
  let work = board.map((row) => [...row])
  const turns = ROTATIONS[direction]

  for (let i = 0; i < turns; i++) work = rotate(work)

  let gained = 0
  let moved = false
  work = work.map((row) => {
    const res = collapse(row)
    gained += res.gained
    if (res.moved) moved = true
    return res.row
  })

  for (let i = 0; i < (4 - turns) % 4; i++) work = rotate(work)

  return { board: work, gained, moved }
}

function hasMoves(board) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) return true
      if (c < SIZE - 1 && board[r][c] === board[r][c + 1]) return true
      if (r < SIZE - 1 && board[r][c] === board[r + 1][c]) return true
    }
  }
  return false
}

export default function Game2048({ onGameOver }) {
  const boardRef = useRef(null)
  const overRef = useRef(onGameOver)
  const reported = useRef(false)

  useEffect(() => {
    overRef.current = onGameOver
  })

  // Brädet och poängen bor i en ref — den är sanningskällan. State finns bara
  // för att rendera. Anledningen: allt räknande måste ske utanför React, aldrig
  // inuti en state-updater. StrictMode kör updaters två gånger i dev, så en
  // addRandomTile därinne hade lagt till två brickor per drag.
  const gameRef = useRef(null)
  if (gameRef.current === null) {
    const b = emptyBoard()
    addRandomTile(b)
    addRandomTile(b)
    gameRef.current = { board: b, score: 0 }
  }

  const [board, setBoard] = useState(gameRef.current.board)
  const [score, setScore] = useState(0)
  const [dead, setDead] = useState(false)

  const handleMove = useCallback((direction) => {
    const game = gameRef.current
    if (reported.current) return

    // Hela draget räknas ut synkront här, innan React får veta något.
    const result = move(game.board, direction)
    if (!result.moved) return

    addRandomTile(result.board)
    const nextScore = game.score + result.gained

    game.board = result.board
    game.score = nextScore

    // Färdiga värden in i state, inga updater-funktioner.
    setBoard(result.board)
    setScore(nextScore)

    if (!hasMoves(result.board)) {
      setDead(true)
      reported.current = true
      overRef.current(nextScore)
    }
  }, [])

  useArrowKeys(handleMove)
  useSwipe(boardRef, { onSwipe: handleMove })

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-full flex items-center justify-between text-sm px-1">
        <span className="text-gray-400">Poäng</span>
        <span className="text-gray-100 font-medium">{score.toLocaleString('sv-SE')}</span>
      </div>

      <div
        ref={boardRef}
        className="relative bg-gray-900 rounded-lg p-2 touch-none select-none w-full max-w-[340px]"
      >
        <div className="grid grid-cols-4 gap-2">
          {board.flat().map((value, i) => (
            <div
              key={i}
              className={`aspect-square rounded-md flex items-center justify-center font-medium ${
                value === 0
                  ? 'bg-gray-800'
                  : TILE_COLORS[value] || 'bg-purple-600 text-purple-50'
              } ${value >= 1024 ? 'text-lg' : value >= 128 ? 'text-xl' : 'text-2xl'}`}
            >
              {value !== 0 && value}
            </div>
          ))}
        </div>

        {dead && (
          <div className="absolute inset-0 bg-black/60 rounded-lg grid place-items-center">
            <span className="text-gray-100 text-xl font-medium">Inga drag kvar</span>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        {dead ? 'Tryck "Igen" nedanför.' : 'Svep eller använd piltangenter.'}
      </p>
    </div>
  )
}
