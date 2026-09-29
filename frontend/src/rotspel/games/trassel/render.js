// Trassel — ritlagret. Ritar brädet på en canvas utifrån spelmotorns läge och
// en lista med pågående effekter. Ingen React här, bara canvas-anrop.

import { DX, DY, BLOCK, BRIDGE } from './board.js'

// Färgerna i den ordning banorna använder dem. De första är de tydligaste,
// så små banor alltid får lättskilda färger.
export const PALETTE = [
  '#ff3b30', // röd
  '#34c759', // grön
  '#2f7bff', // blå
  '#ffd60a', // gul
  '#ff9500', // orange
  '#32d7f0', // cyan
  '#e040fb', // magenta
  '#b86b3c', // brun
  '#8e5cff', // lila
  '#f5f5f7', // vit
  '#8e8e93', // grå
  '#b4f000', // lime
  '#e8c9a0', // sand
  '#ff6fae', // rosa
  '#14b8a6', // blågrön
  '#6b7cff', // blåviol
]
export const SYMBOLS = 'ABCDEFGHIJKLMNOP'

const BG = '#0b1020'
const CELL = '#131a2c'
const CELL_EDGE = '#1a2338'

export function geometry(cssWidth, B) {
  const hasWarp = B.warpRows.length || B.warpCols.length
  // Marginal runt brädet, större när det finns portaler att rita i kanten.
  const unit = cssWidth / (Math.max(B.w, B.h) + (hasWarp ? 1.1 : 0.3))
  const cell = Math.floor(unit * 100) / 100
  const M = hasWarp ? cell * 0.55 : cell * 0.15
  return {
    cell, M,
    width: M * 2 + cell * B.w,
    height: M * 2 + cell * B.h,
    warpPad: M,
  }
}

const cx = (geo, B, c) => geo.M + ((c % B.w) + 0.5) * geo.cell
const cy = (geo, B, c) => geo.M + (((c / B.w) | 0) + 0.5) * geo.cell

// Punktlista för en linje i skärmkoordinater, med avbrott vid portaler.
// Returnerar en lista av delsträckor (varje delsträcka är en lista punkter).
export function pathStrokes(geo, B, p) {
  const strokes = []
  if (p.length === 0) return strokes
  let cur = [[cx(geo, B, B.nodeCell[p[0]]), cy(geo, B, B.nodeCell[p[0]])]]
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i]
    const ca = B.nodeCell[a], cb = B.nodeCell[b]
    let d = -1
    for (const e of B.adj[a]) if (B.other(e, a) === b) { d = B.dirFrom(e, a); break }
    const ax = ca % B.w, ay = (ca / B.w) | 0, bx = cb % B.w, by = (cb / B.w) | 0
    const screenAdj = d >= 0 && ax + DX[d] === bx && ay + DY[d] === by
    const pb = [cx(geo, B, cb), cy(geo, B, cb)]
    if (screenAdj || d < 0) {
      cur.push(pb)
    } else {
      // Genom en portal: ut till kanten här, in från kanten på andra sidan.
      const reach = geo.cell / 2 + geo.warpPad * 0.85
      const pa = cur[cur.length - 1]
      cur.push([pa[0] + DX[d] * reach, pa[1] + DY[d] * reach])
      strokes.push(cur)
      cur = [[pb[0] - DX[d] * reach, pb[1] - DY[d] * reach], pb]
    }
  }
  strokes.push(cur)
  return strokes
}

function strokePolyline(ctx, pts) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// Punkt en bit (0–1) längs en uppsättning delsträckor.
function pointAlong(strokes, f) {
  let total = 0
  const lens = strokes.map((s) => {
    let L = 0
    for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1])
    total += L
    return L
  })
  let want = f * total
  for (let k = 0; k < strokes.length; k++) {
    const s = strokes[k]
    if (want > lens[k]) { want -= lens[k]; continue }
    for (let i = 1; i < s.length; i++) {
      const seg = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1])
      if (want <= seg) {
        const t = seg ? want / seg : 0
        return [s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t]
      }
      want -= seg
    }
  }
  const last = strokes[strokes.length - 1]
  return last ? last[last.length - 1] : [0, 0]
}

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

// fx: { pops, pulses, wave, particles, finger, shake, growth, portalFlash }
export function drawFrame(ctx, geo, game, fx, now, opts = {}) {
  const B = game.B
  const { cell, M } = geo
  const W = geo.width, H = geo.height
  ctx.clearRect(0, 0, W, H)
  ctx.save()

  if (fx.shake) {
    const t = (now - fx.shake.t0) / fx.shake.dur
    if (t < 1) ctx.translate(Math.sin(t * 40) * fx.shake.amp * (1 - t), 0)
  }

  // Bakgrund
  roundRect(ctx, 0, 0, W, H, Math.min(18, cell * 0.4))
  ctx.fillStyle = BG
  ctx.fill()

  let paths = game.paths
  if (fx.growth) {
    const t = ease((now - fx.growth.t0) / fx.growth.dur)
    const k = fx.growth.color
    const p = paths[k]
    paths = paths.map((q, j) => (j === k ? p.slice(0, Math.max(1, Math.ceil(p.length * t))) : q))
  }
  const own = new Int8Array(B.N).fill(-1)
  paths.forEach((p, k) => { for (const v of p) own[v] = k })

  // Rutor
  const gap = Math.max(1, cell * 0.05)
  const rr = cell * 0.14
  const waveT = fx.wave ? now - fx.wave.t0 : -1
  for (let c = 0; c < B.n; c++) {
    const x = M + (c % B.w) * cell, y = M + ((c / B.w) | 0) * cell
    if (B.kind[c] === BLOCK) {
      roundRect(ctx, x + gap, y + gap, cell - gap * 2, cell - gap * 2, rr)
      ctx.fillStyle = '#05070e'
      ctx.fill()
      roundRect(ctx, x + gap * 2.5, y + gap * 2.5, cell - gap * 5, cell - gap * 5, rr * 0.8)
      const g = ctx.createLinearGradient(x, y, x, y + cell)
      g.addColorStop(0, '#3a4258')
      g.addColorStop(1, '#1c2131')
      ctx.fillStyle = g
      ctx.fill()
      continue
    }
    roundRect(ctx, x + gap, y + gap, cell - gap * 2, cell - gap * 2, rr)
    ctx.fillStyle = CELL
    ctx.fill()
    const k = B.kind[c] === BRIDGE ? -1 : own[B.nodeH[c]]
    if (k >= 0) {
      ctx.fillStyle = hexA(PALETTE[k], 0.2)
      ctx.fill()
    } else {
      ctx.strokeStyle = CELL_EDGE
      ctx.lineWidth = 1
      ctx.stroke()
    }
    // Vinstvågen sveper över brädet.
    if (waveT >= 0) {
      const dx = (c % B.w) - fx.wave.x, dy = ((c / B.w) | 0) - fx.wave.y
      const dist = Math.hypot(dx, dy)
      const front = waveT / 55
      const a = Math.max(0, 1 - Math.abs(dist - front) / 1.6) * 0.55
      if (a > 0.01) {
        roundRect(ctx, x + gap, y + gap, cell - gap * 2, cell - gap * 2, rr)
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.fill()
      }
    }
  }

  // Broar: ett upphöjt däck med ett kryss, så man ser att två linjer får korsa här.
  for (let c = 0; c < B.n; c++) {
    if (B.kind[c] !== BRIDGE) continue
    const x = M + (c % B.w) * cell, y = M + ((c / B.w) | 0) * cell
    roundRect(ctx, x + cell * 0.1, y + cell * 0.1, cell * 0.8, cell * 0.8, cell * 0.16)
    ctx.fillStyle = '#1f2a49'
    ctx.fill()
    ctx.strokeStyle = '#5a6d9e'
    ctx.lineWidth = Math.max(1.5, cell * 0.05)
    ctx.stroke()
    ctx.strokeStyle = '#34426a'
    ctx.lineWidth = Math.max(2, cell * 0.1)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + cell * 0.3, y + cell * 0.5); ctx.lineTo(x + cell * 0.7, y + cell * 0.5)
    ctx.moveTo(x + cell * 0.5, y + cell * 0.3); ctx.lineTo(x + cell * 0.5, y + cell * 0.7)
    ctx.stroke()
  }

  // Portaler i kanterna
  const flash = fx.portalFlash && now - fx.portalFlash.t0 < 400 ? 1 - (now - fx.portalFlash.t0) / 400 : 0
  const drawPortal = (x, y, vertical) => {
    const len = cell * 0.78, thick = Math.max(3, cell * 0.12)
    ctx.save()
    ctx.lineCap = 'round'
    ctx.strokeStyle = `rgba(142,92,255,${0.35 + flash * 0.5})`
    ctx.lineWidth = thick * 2.6
    ctx.beginPath()
    if (vertical) { ctx.moveTo(x, y - len / 2); ctx.lineTo(x, y + len / 2) } else { ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y) }
    ctx.stroke()
    ctx.strokeStyle = flash ? '#ffffff' : '#c7b3ff'
    ctx.lineWidth = thick
    ctx.stroke()
    ctx.restore()
  }
  for (const r of B.warpRows) {
    const y = M + (r + 0.5) * cell
    drawPortal(M * 0.45, y, true)
    drawPortal(W - M * 0.45, y, true)
  }
  for (const col of B.warpCols) {
    const x = M + (col + 0.5) * cell
    drawPortal(x, M * 0.45, false)
    drawPortal(x, H - M * 0.45, false)
  }

  // Staket (tunna väggar)
  ctx.strokeStyle = '#d7deec'
  ctx.lineWidth = Math.max(3, cell * 0.11)
  ctx.lineCap = 'round'
  for (let c = 0; c < B.n; c++) {
    const wv = B.walls[c]
    if (!wv) continue
    const x = M + (c % B.w) * cell, y = M + ((c / B.w) | 0) * cell
    if (wv & 1) { ctx.beginPath(); ctx.moveTo(x + cell, y + cell * 0.08); ctx.lineTo(x + cell, y + cell * 0.92); ctx.stroke() }
    if (wv & 2) { ctx.beginPath(); ctx.moveTo(x + cell * 0.08, y + cell); ctx.lineTo(x + cell * 0.92, y + cell); ctx.stroke() }
  }

  // Linjer. Först allt utom broarnas vågräta filer, sedan en mörk kant över
  // broarna, sedan de vågräta filerna ovanpå — så syns vem som går över vem.
  const pipeW = cell * 0.34
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const splitAtBridgeH = (p) => {
    // Dela linjen i bitar som ligger under (0) eller på (1) en bro.
    const parts = []
    let cur = [p[0]], layer = B.nodeLane[p[0]] === 1 ? 1 : 0
    for (let i = 1; i < p.length; i++) {
      const L = B.nodeLane[p[i]] === 1 || B.nodeLane[p[i - 1]] === 1 ? 1 : 0
      if (L !== layer) { parts.push({ layer, nodes: cur }); cur = [p[i - 1]]; layer = L }
      cur.push(p[i])
    }
    parts.push({ layer, nodes: cur })
    return parts
  }
  const layers = [[], []]
  paths.forEach((p, k) => {
    if (p.length < 2) return
    for (const part of splitAtBridgeH(p)) layers[part.layer].push({ k, strokes: pathStrokes(geo, B, part.nodes) })
  })
  const drawLayer = (items) => {
    for (const { k, strokes } of items) {
      const col = PALETTE[k]
      ctx.strokeStyle = hexA(col, game.dragging === k ? 0.34 : 0.22)
      ctx.lineWidth = pipeW * 1.9
      for (const s of strokes) strokePolyline(ctx, s)
      ctx.strokeStyle = col
      ctx.lineWidth = pipeW
      for (const s of strokes) strokePolyline(ctx, s)
    }
  }
  drawLayer(layers[0])
  if (layers[1].length) {
    for (let c = 0; c < B.n; c++) {
      if (B.kind[c] !== BRIDGE || own[B.nodeH[c]] < 0) continue
      const x = M + (c % B.w) * cell, y = M + ((c / B.w) | 0) * cell
      ctx.fillStyle = BG
      ctx.fillRect(x + cell * 0.08, y + cell * 0.5 - pipeW * 0.95, cell * 0.84, pipeW * 1.9)
    }
    drawLayer(layers[1])
  }

  // Puls längs en nyss kopplad linje
  for (const pu of fx.pulses) {
    const t = (now - pu.t0) / pu.dur
    if (t < 0 || t > 1) continue
    const p = paths[pu.color]
    if (!p || p.length < 2) continue
    const strokes = pathStrokes(geo, B, p)
    ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - t)})`
    ctx.lineWidth = pipeW * 0.55
    for (const s of strokes) strokePolyline(ctx, s)
    const [px, py] = pointAlong(strokes, ease(t))
    const g = ctx.createRadialGradient(px, py, 0, px, py, pipeW * 1.6)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(px, py, pipeW * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  // Prickar
  const R = cell * 0.33
  for (let k = 0; k < B.colors; k++) {
    const done = game.complete(k)
    for (const v of B.ends[k]) {
      const c = B.nodeCell[v]
      const x = cx(geo, B, c), y = cy(geo, B, c)
      let s = 1
      for (const pop of fx.pops) {
        if (pop.node !== v) continue
        const t = (now - pop.t0) / pop.dur
        if (t >= 0 && t < 1) s = Math.max(s, 1 + Math.sin(t * Math.PI) * 0.35)
      }
      if (done) {
        ctx.fillStyle = hexA(PALETTE[k], 0.28)
        ctx.beginPath()
        ctx.arc(x, y, R * 1.32 * s, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = PALETTE[k]
      ctx.beginPath()
      ctx.arc(x, y, R * s, 0, Math.PI * 2)
      ctx.fill()
      // Blank glans uppe till vänster
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.beginPath()
      ctx.arc(x - R * 0.3 * s, y - R * 0.32 * s, R * 0.34 * s, 0, Math.PI * 2)
      ctx.fill()
      if (game.hinted[k]) {
        ctx.fillStyle = '#0b1020'
        ctx.beginPath()
        ctx.arc(x, y, R * 0.22, 0, Math.PI * 2)
        ctx.fill()
      }
      if (opts.symbols) {
        ctx.fillStyle = k === 9 || k === 3 || k === 11 || k === 12 ? '#1a1a1a' : 'rgba(0,0,0,0.72)'
        ctx.font = `800 ${Math.round(R * 1.05)}px ui-rounded, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(SYMBOLS[k], x, y + R * 0.06)
      }
    }
  }

  // Fingret: en stor genomskinlig ring där man drar, eftersom fingret själv
  // skymmer rutan man står på.
  if (fx.finger && game.dragging >= 0) {
    const col = PALETTE[game.dragging]
    ctx.fillStyle = hexA(col, 0.16)
    ctx.beginPath()
    ctx.arc(fx.finger.x, fx.finger.y, cell * 0.95, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = hexA(col, 0.4)
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Konfetti
  for (const pt of fx.particles) {
    const t = (now - pt.t0) / 1000
    if (t < 0 || t > pt.life) continue
    const x = pt.x + pt.vx * t
    const y = pt.y + pt.vy * t + 420 * t * t
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(pt.rot + pt.spin * t)
    ctx.globalAlpha = Math.max(0, 1 - t / pt.life)
    ctx.fillStyle = pt.color
    ctx.fillRect(-pt.size / 2, -pt.size / 4, pt.size, pt.size / 2)
    ctx.restore()
  }

  ctx.restore()
}

// Är någon effekt fortfarande igång? Annars kan ritloopen vila.
export function effectsActive(fx, now) {
  if (fx.shake && now - fx.shake.t0 < fx.shake.dur) return true
  if (fx.growth && now - fx.growth.t0 < fx.growth.dur) return true
  if (fx.wave && now - fx.wave.t0 < 1600) return true
  if (fx.portalFlash && now - fx.portalFlash.t0 < 400) return true
  if (fx.pops.some((p) => now - p.t0 < p.dur)) return true
  if (fx.pulses.some((p) => now - p.t0 < p.dur)) return true
  if (fx.particles.some((p) => (now - p.t0) / 1000 < p.life)) return true
  return false
}

// Städar bort färdiga effekter så listorna inte växer.
export function pruneEffects(fx, now) {
  fx.pops = fx.pops.filter((p) => now - p.t0 < p.dur)
  fx.pulses = fx.pulses.filter((p) => now - p.t0 < p.dur)
  fx.particles = fx.particles.filter((p) => (now - p.t0) / 1000 < p.life)
  if (fx.growth && now - fx.growth.t0 >= fx.growth.dur) fx.growth = null
  if (fx.wave && now - fx.wave.t0 >= 1600) fx.wave = null
  if (fx.shake && now - fx.shake.t0 >= fx.shake.dur) fx.shake = null
}

export function burst(fx, geo, B, now, colors) {
  const W = geo.width, H = geo.height
  for (let i = 0; i < 90; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = 180 + Math.random() * 420
    fx.particles.push({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.45,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 260,
      color: PALETTE[colors[i % colors.length]],
      size: 5 + Math.random() * 7,
      rot: Math.random() * 6,
      spin: (Math.random() - 0.5) * 14,
      life: 1.2 + Math.random() * 0.8,
      t0: now + Math.random() * 120,
    })
  }
}
