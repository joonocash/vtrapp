import { useEffect, useRef } from 'react'

// Delad input-hook för mobil. Fäster touch-lyssnare på ett element och
// anropar onSwipe('up'|'down'|'left'|'right') respektive onTap().
//
// Viktigt: touchmove måste ha { passive: false } för att preventDefault ska
// funka, annars scrollar sidan under spelet. React-props (onTouchMove) är
// alltid passiva, så lyssnarna måste sättas manuellt.
//
// Användning:
//   const boardRef = useRef(null)
//   useSwipe(boardRef, { onSwipe: dir => move(dir) })
//   <div ref={boardRef}> ... </div>

const MIN_DISTANCE = 24 // px innan ett svep räknas
const MAX_TAP = 12 // px rörelse som fortfarande räknas som tap
const MAX_TAP_MS = 300

export function useSwipe(targetRef, { onSwipe, onTap } = {}) {
  const handlers = useRef({ onSwipe, onTap })
  useEffect(() => {
    handlers.current = { onSwipe, onTap }
  })

  useEffect(() => {
    const el = targetRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let tracking = false

    function onStart(e) {
      if (e.touches.length !== 1) return
      tracking = true
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startTime = Date.now()
    }

    function onMove(e) {
      if (!tracking) return
      e.preventDefault()
    }

    function onEnd(e) {
      if (!tracking) return
      tracking = false

      const touch = e.changedTouches[0]
      if (!touch) return

      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      const elapsed = Date.now() - startTime

      if (absX < MAX_TAP && absY < MAX_TAP && elapsed < MAX_TAP_MS) {
        if (handlers.current.onTap) handlers.current.onTap()
        return
      }

      if (!handlers.current.onSwipe) return
      if (Math.max(absX, absY) < MIN_DISTANCE) return

      if (absX > absY) {
        handlers.current.onSwipe(dx > 0 ? 'right' : 'left')
      } else {
        handlers.current.onSwipe(dy > 0 ? 'down' : 'up')
      }
    }

    function onCancel() {
      tracking = false
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onCancel, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onCancel)
    }
  }, [targetRef])
}

// Piltangenter + WASD mappade till samma riktningar som useSwipe.
// Så slipper varje spel skriva samma keymap.
export function useArrowKeys(onDirection) {
  const handler = useRef(onDirection)
  useEffect(() => {
    handler.current = onDirection
  })

  useEffect(() => {
    const map = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
      W: 'up',
      S: 'down',
      A: 'left',
      D: 'right',
    }
    function onKey(e) {
      const dir = map[e.key]
      if (!dir) return
      e.preventDefault()
      handler.current(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
