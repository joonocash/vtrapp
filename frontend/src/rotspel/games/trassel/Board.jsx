import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { BRIDGE, DX, DY } from './board.js'
import { geometry, drawFrame, effectsActive, pruneEffects, burst } from './render.js'
import { readSettings } from '../../useSettings.js'

// Trassel — brädet. Äger canvasen, pekarhanteringen och ritloopen.
// Spelmotorn (game) kommer utifrån; brädet anropar den för varje steg och
// säger till föräldern när något har ändrats eller när banan är löst.
//
// Ritloopen går bara när något rör sig (drag eller effekt), annars vilar den.

const vibrate = (ms) => {
  try { if (readSettings().skak && navigator.vibrate) navigator.vibrate(ms) } catch { /* inget stöd */ }
}

const Board = forwardRef(function Board({ game, audio, symbols, locked, light, onChange, onWin, onFirstTouch, onAlmost }, ref) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const geoRef = useRef(null)
  const fxRef = useRef({ pops: [], pulses: [], particles: [], wave: null, finger: null, shake: null, growth: null, portalFlash: null })
  const rafRef = useRef(0)
  const dragRef = useRef(null) // { pointerId, lastCell, pendingBridge }
  const propsRef = useRef({})
  propsRef.current = { game, audio, symbols, locked, light, onChange, onWin, onFirstTouch, onAlmost }
  const lastCellRef = useRef(-1)

  function frame(now) {
    rafRef.current = 0
    const canvas = canvasRef.current
    const geo = geoRef.current
    if (!canvas || !geo) return
    const ctx = canvas.getContext('2d')
    const dpr = geo.dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const fx = fxRef.current
    pruneEffects(fx, now)
    drawFrame(ctx, geo, propsRef.current.game, fx, now, { symbols: propsRef.current.symbols })
    if (effectsActive(fx, now)) kick()
  }
  function kick() {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(frame)
  }

  // Storlek efter behållaren
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const resize = () => {
      const width = wrap.clientWidth
      if (!width) return
      const geo = geometry(width, game.B)
      geo.dpr = Math.min(3, window.devicePixelRatio || 1)
      geoRef.current = geo
      canvas.style.width = `${geo.width}px`
      canvas.style.height = `${geo.height}px`
      canvas.width = Math.round(geo.width * geo.dpr)
      canvas.height = Math.round(geo.height * geo.dpr)
      kick()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [game])

  useEffect(() => { kick() }, [symbols])

  // Nollställ även flaggan: React StrictMode monterar av och på i utvecklingsläget,
  // och en kvarglömd flagga skulle få kick() att tro att en ruta redan är beställd.
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])

  // Ny bana: nollställ effekter och drag.
  useEffect(() => {
    const fx = fxRef.current
    fx.pops = []; fx.pulses = []; fx.particles = []; fx.wave = null; fx.growth = null; fx.shake = null
    dragRef.current = null
    kick()
  }, [game])

  function celebrate(perfect) {
    const g = propsRef.current.game
    const geo = geoRef.current
    const fx = fxRef.current
    const now = performance.now()
    for (let k = 0; k < g.K; k++) fx.pulses.push({ color: k, t0: now + k * 40, dur: 650 })
    // Tidsjakten byter bräde direkt efter, så där blir det bara pulsen.
    if (!propsRef.current.light) {
      // Vågen startar där fingret var sist.
      const last = lastCellRef.current >= 0 ? lastCellRef.current : Math.floor(g.B.n / 2)
      fx.wave = { t0: now, x: last % g.B.w, y: (last / g.B.w) | 0 }
      if (geo) burst(fx, geo, g.B, now + 150, [...Array(g.K).keys()])
    }
    if (perfect) for (let k = 0; k < g.K; k++) for (const v of g.B.ends[k]) fx.pops.push({ node: v, t0: now + 200 + k * 50, dur: 380 })
    kick()
  }

  useImperativeHandle(ref, () => ({
    redraw: kick,
    celebrate,
    hintGrow(k) {
      const now = performance.now()
      fxRef.current.growth = { color: k, t0: now, dur: Math.min(900, 120 + game.paths[k].length * 45) }
      fxRef.current.pulses.push({ color: k, t0: now + 500, dur: 500 })
      kick()
    },
    shake() {
      fxRef.current.shake = { t0: performance.now(), dur: 380, amp: 7 }
      kick()
    },
  }), [game])

  /* ---------- pekare ---------- */

  function cellAt(e) {
    const canvas = canvasRef.current
    const geo = geoRef.current
    const B = propsRef.current.game.B
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left, y = e.clientY - rect.top
    let col = Math.floor((x - geo.M) / geo.cell)
    let row = Math.floor((y - geo.M) / geo.cell)
    // Utanför kanten på en portalrad räknas som rutan på andra sidan.
    if (row >= 0 && row < B.h && (col === -1 || col === B.w) && B.wr[row]) col = (col + B.w) % B.w
    if (col >= 0 && col < B.w && (row === -1 || row === B.h) && B.wc[col]) row = (row + B.h) % B.h
    if (col < 0 || col >= B.w || row < 0 || row >= B.h) return { cell: -1, x, y }
    return { cell: row * B.w + col, x, y }
  }

  const screenAdjacent = (B, a, b, d) => (a % B.w) + DX[d] === b % B.w && ((a / B.w) | 0) + DY[d] === ((b / B.w) | 0)

  function report(ev) {
    const { game: g, audio: a } = propsRef.current
    const k = g.dragging
    const now = performance.now()
    const fx = fxRef.current
    if (ev === 'grow') a.tick(g.paths[k]?.length || 0)
    else if (ev === 'cut') { a.cut(); vibrate(6) }
    else if (ev === 'blocked') a.blocked()
    else if (ev === 'connect') {
      let n = 0
      for (let j = 0; j < g.K; j++) if (g.complete(j)) n++
      a.connect(n)
      vibrate(14)
      for (const v of g.B.ends[k]) fx.pops.push({ node: v, t0: now, dur: 320 })
      fx.pulses.push({ color: k, t0: now, dur: 420 })
    }
  }

  // Ta huvudet mot ruta t, ett steg i taget.
  function stepToward(t) {
    const g = propsRef.current.game
    const B = g.B
    for (let guard = 0; guard < 40; guard++) {
      const head = g.head
      if (head < 0) return
      const hc = B.nodeCell[head]
      if (hc === t) return
      // Direkt granne, även genom en portal?
      let d = -1
      for (let dd = 0; dd < 4; dd++) if (B.step(hc, dd) === t) { d = dd; break }
      if (d >= 0) {
        const viaPortal = !screenAdjacent(B, hc, t, d)
        const ev = g.stepDir(d)
        if (ev) report(ev)
        if (viaPortal && ev && ev !== 'blocked') {
          propsRef.current.audio.warp()
          fxRef.current.portalFlash = { t0: performance.now() }
        }
        if (ev === 'connect') checkDone()
        return
      }
      // Längre bort (snabbt drag): gå längs skärmen, den längsta axeln först.
      const hx = hc % B.w, hy = (hc / B.w) | 0, tx = t % B.w, ty = (t / B.w) | 0
      const dx = tx - hx, dy = ty - hy
      const horiz = Math.abs(dx) >= Math.abs(dy)
      const first = horiz ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3
      const second = horiz ? (dy ? (dy > 0 ? 1 : 3) : -1) : dx ? (dx > 0 ? 0 : 2) : -1
      let ev = null
      for (const dd of [first, second]) {
        if (dd < 0) continue
        const nc = B.step(hc, dd)
        if (nc < 0 || !screenAdjacent(B, hc, nc, dd)) continue
        ev = g.stepDir(dd)
        if (ev && ev !== 'blocked') break
      }
      if (!ev || ev === 'blocked') { if (ev) report(ev); return }
      report(ev)
      if (ev === 'connect') { checkDone(); return }
    }
  }

  function checkDone() {
    const g = propsRef.current.game
    const s = g.status()
    if (!s.won) return
    // Vunnet mitt i draget: släpp direkt.
    g.end()
    fxRef.current.finger = null
    propsRef.current.onChange?.()
    const s2 = g.status()
    celebrate(s2.perfect)
    propsRef.current.onWin?.(s2)
  }

  function onPointerDown(e) {
    const { game: g, locked: lk } = propsRef.current
    if (lk || dragRef.current) return
    const { cell, x, y } = cellAt(e)
    if (cell < 0) return
    const B = g.B
    let pendingBridge = -1
    if (B.kind[cell] === BRIDGE) {
      const own = g.owner()
      const h = own[B.nodeH[cell]], v = own[B.nodeV[cell]]
      if (h < 0 && v < 0) return
      if (h >= 0 && v >= 0) pendingBridge = cell // välj fil när man börjar röra sig
      else if (g.begin(h >= 0 ? B.nodeH[cell] : B.nodeV[cell]) < 0) return
    } else if (g.begin(B.nodeH[cell]) < 0) return
    e.preventDefault()
    try { canvasRef.current.setPointerCapture(e.pointerId) } catch { /* äldre webbläsare */ }
    dragRef.current = { pointerId: e.pointerId, lastCell: cell, pendingBridge }
    lastCellRef.current = cell
    fxRef.current.finger = { x, y }
    propsRef.current.onFirstTouch?.()
    propsRef.current.onChange?.()
    kick()
  }

  function onPointerMove(e) {
    const dr = dragRef.current
    if (!dr || e.pointerId !== dr.pointerId) return
    const g = propsRef.current.game
    const { cell, x, y } = cellAt(e)
    fxRef.current.finger = { x, y }
    if (cell >= 0 && cell !== dr.lastCell) {
      if (dr.pendingBridge >= 0) {
        const B = g.B
        let d = -1
        for (let dd = 0; dd < 4; dd++) if (B.step(dr.pendingBridge, dd) === cell) { d = dd; break }
        if (d < 0) { kick(); return }
        const lane = d % 2 === 0 ? B.nodeH[dr.pendingBridge] : B.nodeV[dr.pendingBridge]
        dr.pendingBridge = -1
        if (g.begin(lane) < 0) { dragRef.current = null; kick(); return }
      }
      if (g.dragging >= 0) stepToward(cell)
      dr.lastCell = cell
      lastCellRef.current = cell
      propsRef.current.onChange?.()
    }
    kick()
  }

  function onPointerUp(e) {
    const dr = dragRef.current
    if (!dr || e.pointerId !== dr.pointerId) return
    dragRef.current = null
    fxRef.current.finger = null
    const g = propsRef.current.game
    if (g.dragging >= 0) {
      g.end()
      const s = g.status()
      propsRef.current.onChange?.()
      if (s.won) {
        celebrate(s.perfect)
        propsRef.current.onWin?.(s)
      } else if (s.connected === s.total) {
        // Alla färger ihop men tomma rutor kvar.
        propsRef.current.audio.almost()
        fxRef.current.shake = { t0: performance.now(), dur: 380, amp: 6 }
        propsRef.current.onAlmost?.()
      }
    }
    kick()
  }

  return (
    <div ref={wrapRef} className="tr-boardwrap">
      <canvas
        ref={canvasRef}
        className="tr-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
})

export default Board
