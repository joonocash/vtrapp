// Pinnbollen — allt som ritas på canvasen. Ingen spellogik här.
//
// Pinnarna är förritade bilder (blanka kulor med glans, och tända med en
// glöd runt sig) så att hundra pinnar per bildruta kostar nästan ingenting.
// Bakgrunden för varje värld ritas en gång till en egen canvas.

import { W, H, PINNE_R, KANON, HINK, FACK_POANG, FACK_TOPP, KULA_R } from './motor.js'
import { mulberry32 } from '../delat/rng.js'
import { rundRekt, ljusare } from '../delat/fx.js'

export const FARG = {
  bla: { bas: '#2f7cf6', mork: '#12368f', ljus: '#bfe0ff', glod: '#5aa8ff' },
  orange: { bas: '#ff7a1a', mork: '#9c3500', ljus: '#ffe0b8', glod: '#ff9a3c' },
  gron: { bas: '#22c55e', mork: '#0b6229', ljus: '#c8ffd8', glod: '#4dff8a' },
  lila: { bas: '#b44cff', mork: '#521690', ljus: '#f0d6ff', glod: '#cf7bff' },
}

const SPRITE = 96 // pixlar i bilden
const SPRITE_R = 30 // pinnens radie i bilden (resten är glöd)

function canvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function pinnbild(farg, lit) {
  const c = canvas(SPRITE, SPRITE)
  const g = c.getContext('2d')
  const m = SPRITE / 2
  const f = FARG[farg]
  if (lit) {
    const glod = g.createRadialGradient(m, m, SPRITE_R * 0.6, m, m, m)
    glod.addColorStop(0, f.glod + 'cc')
    glod.addColorStop(0.5, f.glod + '55')
    glod.addColorStop(1, f.glod + '00')
    g.fillStyle = glod
    g.beginPath()
    g.arc(m, m, m, 0, Math.PI * 2)
    g.fill()
  } else {
    // mjuk skugga
    g.fillStyle = 'rgba(0,0,0,0.35)'
    g.beginPath()
    g.arc(m + 3, m + 5, SPRITE_R, 0, Math.PI * 2)
    g.fill()
  }
  // själva kulan
  const yta = g.createRadialGradient(m - SPRITE_R * 0.35, m - SPRITE_R * 0.4, SPRITE_R * 0.1, m, m, SPRITE_R)
  if (lit) {
    yta.addColorStop(0, '#ffffff')
    yta.addColorStop(0.45, f.ljus)
    yta.addColorStop(1, f.glod)
  } else {
    yta.addColorStop(0, ljusare(f.bas, 0.55))
    yta.addColorStop(0.5, f.bas)
    yta.addColorStop(1, f.mork)
  }
  g.fillStyle = yta
  g.beginPath()
  g.arc(m, m, SPRITE_R, 0, Math.PI * 2)
  g.fill()
  // kant
  g.lineWidth = 3
  g.strokeStyle = lit ? 'rgba(255,255,255,0.85)' : ljusare(f.mork, -0.3)
  g.stroke()
  // glans
  g.fillStyle = 'rgba(255,255,255,0.75)'
  g.beginPath()
  g.ellipse(m - SPRITE_R * 0.32, m - SPRITE_R * 0.42, SPRITE_R * 0.34, SPRITE_R * 0.2, -0.5, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(255,255,255,0.35)'
  g.beginPath()
  g.arc(m + SPRITE_R * 0.38, m + SPRITE_R * 0.4, SPRITE_R * 0.12, 0, Math.PI * 2)
  g.fill()
  return c
}

const pinnar = {}
export function pinne(farg, lit) {
  const k = farg + (lit ? 1 : 0)
  if (!pinnar[k]) pinnar[k] = pinnbild(farg, lit)
  return pinnar[k]
}

// Ritar en pinne med radie r (i spelets koordinater) och skala s.
export function ritaPinne(ctx, x, y, r, farg, lit, s = 1, alfa = 1) {
  const bild = pinne(farg, lit)
  const st = (SPRITE / SPRITE_R) * r * s
  ctx.globalAlpha = alfa
  ctx.drawImage(bild, x - st / 2, y - st / 2, st, st)
  ctx.globalAlpha = 1
}

/* ----------------------------------------------------------------- tegel */

function tegelVag(ctx, o, forskj = 0) {
  ctx.beginPath()
  if (o.form === 'segment') {
    ctx.moveTo(o.wx1, o.wy1 + forskj)
    ctx.lineTo(o.wx2, o.wy2 + forskj)
  } else {
    ctx.arc(o.wcx, o.wcy + forskj, o.R, o.wa0, o.wa0 + o.span)
  }
}

export function ritaTegel(ctx, o, farg, lit, s = 1, alfa = 1) {
  const f = FARG[farg]
  const tj = o.tj * 2 * s
  ctx.globalAlpha = alfa
  ctx.lineCap = 'round'
  if (lit) {
    tegelVag(ctx, o)
    ctx.strokeStyle = f.glod + '55'
    ctx.lineWidth = tj + 10
    ctx.stroke()
    ctx.strokeStyle = f.glod + '88'
    ctx.lineWidth = tj + 5
    ctx.stroke()
  } else {
    tegelVag(ctx, o, 3)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = tj
    ctx.stroke()
  }
  tegelVag(ctx, o)
  ctx.strokeStyle = lit ? f.glod : ljusare(f.mork, -0.25)
  ctx.lineWidth = tj + 1.5
  ctx.stroke()
  ctx.strokeStyle = lit ? f.ljus : f.bas
  ctx.lineWidth = tj - 1
  ctx.stroke()
  tegelVag(ctx, o, -tj * 0.18)
  ctx.strokeStyle = lit ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'
  ctx.lineWidth = Math.max(1, tj * 0.22)
  ctx.stroke()
  ctx.globalAlpha = 1
}

/* ----------------------------------------------------------- bakgrunder */

const bakgrunder = new Map()

export function bakgrund(varld) {
  if (bakgrunder.has(varld.id)) return bakgrunder.get(varld.id)
  const K = 2
  const c = canvas(W * K, H * K)
  const g = c.getContext('2d')
  g.scale(K, K)
  const r = mulberry32(varld.id.length * 977 + varld.id.charCodeAt(0))
  const himmel = g.createLinearGradient(0, 0, 0, H)
  himmel.addColorStop(0, varld.himmel[0])
  himmel.addColorStop(1, varld.himmel[1])
  g.fillStyle = himmel
  g.fillRect(0, 0, W, H)
  const tema = TEMAN[varld.tema]
  if (tema) tema(g, r, varld)
  // dämpa så att pinnarna syns
  const vin = g.createRadialGradient(W / 2, H * 0.45, 80, W / 2, H * 0.5, H * 0.75)
  vin.addColorStop(0, 'rgba(8,10,30,0.18)')
  vin.addColorStop(1, 'rgba(8,10,30,0.55)')
  g.fillStyle = vin
  g.fillRect(0, 0, W, H)
  // väggar
  for (const x of [0, W]) {
    const vg = g.createLinearGradient(x === 0 ? 0 : W - 8, 0, x === 0 ? 8 : W, 0)
    vg.addColorStop(x === 0 ? 0 : 1, 'rgba(255,255,255,0.28)')
    vg.addColorStop(x === 0 ? 1 : 0, 'rgba(255,255,255,0)')
    g.fillStyle = vg
    g.fillRect(x === 0 ? 0 : W - 8, 0, 8, H)
  }
  bakgrunder.set(varld.id, c)
  return c
}

function moln(g, x, y, s, alfa) {
  g.fillStyle = `rgba(255,255,255,${alfa})`
  g.beginPath()
  g.arc(x, y, 18 * s, 0, Math.PI * 2)
  g.arc(x + 20 * s, y - 8 * s, 22 * s, 0, Math.PI * 2)
  g.arc(x + 44 * s, y, 17 * s, 0, Math.PI * 2)
  g.rect(x, y, 44 * s, 16 * s)
  g.fill()
}

function kulle(g, y, amp, farg, fas) {
  g.fillStyle = farg
  g.beginPath()
  g.moveTo(0, H)
  for (let x = 0; x <= W; x += 6) g.lineTo(x, y + Math.sin(x / 70 + fas) * amp + Math.sin(x / 31 + fas * 2) * amp * 0.3)
  g.lineTo(W, H)
  g.fill()
}

const TEMAN = {
  park(g, r) {
    g.fillStyle = 'rgba(255,240,170,0.9)'
    g.beginPath()
    g.arc(300, 70, 34, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(255,240,170,0.25)'
    g.beginPath()
    g.arc(300, 70, 58, 0, Math.PI * 2)
    g.fill()
    for (let i = 0; i < 5; i++) moln(g, r() * W - 20, 60 + r() * 220, 0.7 + r() * 0.6, 0.55)
    kulle(g, 470, 22, '#5fbf6a', 0.4)
    // träd
    for (let i = 0; i < 6; i++) {
      const x = 20 + r() * 320
      const y = 470 + Math.sin(x / 70 + 0.4) * 22 - 4
      g.fillStyle = '#6b4a2b'
      g.fillRect(x - 3, y - 30, 6, 30)
      g.fillStyle = i % 2 ? '#2f8f3e' : '#3aa24a'
      g.beginPath()
      g.arc(x, y - 40, 20, 0, Math.PI * 2)
      g.arc(x - 12, y - 30, 14, 0, Math.PI * 2)
      g.arc(x + 12, y - 30, 14, 0, Math.PI * 2)
      g.fill()
    }
    kulle(g, 520, 16, '#3f9d4c', 2)
    // tassavtryck
    g.fillStyle = 'rgba(255,255,255,0.12)'
    for (let i = 0; i < 9; i++) {
      const x = 30 + r() * 300
      const y = 120 + r() * 380
      g.beginPath()
      g.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2)
      for (const [dx, dy] of [[-7, -8], [-2, -11], [3, -11], [8, -8]]) g.arc(x + dx, y + dy, 2.6, 0, Math.PI * 2)
      g.fill()
    }
  },
  godis(g, r) {
    g.save()
    g.globalAlpha = 0.14
    g.fillStyle = '#ffffff'
    for (let x = -H; x < W + H; x += 46) {
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x + 22, 0)
      g.lineTo(x + 22 + H * 0.6, H)
      g.lineTo(x + H * 0.6, H)
      g.fill()
    }
    g.restore()
    const strossel = ['#ff4d8d', '#ffd43b', '#5ce1e6', '#9b7bff', '#ffffff', '#5bd96b']
    for (let i = 0; i < 70; i++) {
      g.save()
      g.translate(r() * W, r() * H)
      g.rotate(r() * 6.28)
      g.fillStyle = strossel[i % strossel.length]
      g.globalAlpha = 0.45
      rundRekt(g, -5, -1.6, 10, 3.2, 1.6)
      g.fill()
      g.restore()
    }
    // klubbor nertill
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 92 + r() * 20
      const y = 500 + r() * 40
      g.fillStyle = '#f5f5f5'
      g.fillRect(x - 2, y, 4, 120)
      for (let k = 0; k < 5; k++) {
        g.fillStyle = k % 2 ? '#ff4d8d' : '#ffffff'
        g.beginPath()
        g.arc(x, y, 26 - k * 5, 0, Math.PI * 2)
        g.fill()
      }
    }
  },
  rymd(g, r) {
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.7})`
      const s = r() < 0.1 ? 1.8 : 0.9
      g.fillRect(r() * W, r() * H, s, s)
    }
    for (const [x, y, rr, f] of [[70, 160, 120, '#ec4899'], [300, 430, 140, '#22d3ee']]) {
      const n = g.createRadialGradient(x, y, 0, x, y, rr)
      n.addColorStop(0, f + '40')
      n.addColorStop(1, f + '00')
      g.fillStyle = n
      g.fillRect(0, 0, W, H)
    }
    // planet med ring
    const px = 290
    const py = 110
    const pl = g.createRadialGradient(px - 12, py - 12, 4, px, py, 34)
    pl.addColorStop(0, '#fde68a')
    pl.addColorStop(1, '#b45309')
    g.fillStyle = pl
    g.beginPath()
    g.arc(px, py, 30, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(253,230,138,0.6)'
    g.lineWidth = 4
    g.beginPath()
    g.ellipse(px, py, 52, 12, -0.35, 0, Math.PI * 2)
    g.stroke()
  },
  spok(g, r) {
    g.fillStyle = 'rgba(255,250,220,0.95)'
    g.beginPath()
    g.arc(80, 90, 30, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(49,46,129,1)'
    g.beginPath()
    g.arc(92, 82, 26, 0, Math.PI * 2)
    g.fill()
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.5})`
      g.fillRect(r() * W, r() * 300, 1, 1)
    }
    // slott
    g.fillStyle = '#111432'
    g.beginPath()
    g.moveTo(0, H)
    g.lineTo(0, 500)
    for (const [x, h] of [[30, 470], [60, 500], [90, 430], [130, 480], [170, 400], [210, 480], [250, 440], [290, 500], [330, 460], [360, 490]]) {
      g.lineTo(x - 14, h)
      g.lineTo(x - 14, h - 10)
      g.lineTo(x - 7, h - 10)
      g.lineTo(x - 7, h)
      g.lineTo(x, h)
    }
    g.lineTo(W, H)
    g.fill()
    g.fillStyle = 'rgba(255,214,102,0.55)'
    for (let i = 0; i < 12; i++) g.fillRect(20 + r() * 320, 480 + r() * 90, 4, 6)
    // fladdermöss
    g.fillStyle = '#0b0d24'
    for (let i = 0; i < 5; i++) {
      const x = 40 + r() * 280
      const y = 150 + r() * 200
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x - 8, y - 8, x - 16, y - 2)
      g.quadraticCurveTo(x - 9, y, x, y + 4)
      g.quadraticCurveTo(x + 9, y, x + 16, y - 2)
      g.quadraticCurveTo(x + 8, y - 8, x, y)
      g.fill()
    }
  },
  vulkan(g, r) {
    g.fillStyle = '#2a0f06'
    g.beginPath()
    g.moveTo(0, H)
    g.lineTo(40, 470)
    g.lineTo(140, 380)
    g.lineTo(220, 380)
    g.lineTo(320, 470)
    g.lineTo(W, 500)
    g.lineTo(W, H)
    g.fill()
    const lava = g.createRadialGradient(180, 380, 4, 180, 380, 120)
    lava.addColorStop(0, 'rgba(255,200,60,0.85)')
    lava.addColorStop(1, 'rgba(255,90,20,0)')
    g.fillStyle = lava
    g.fillRect(0, 240, W, 300)
    g.strokeStyle = 'rgba(255,120,30,0.7)'
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(170, 382)
    g.quadraticCurveTo(150, 440, 120, 520)
    g.moveTo(200, 382)
    g.quadraticCurveTo(220, 450, 250, 540)
    g.stroke()
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,${150 + r() * 100},60,${0.3 + r() * 0.5})`
      g.beginPath()
      g.arc(r() * W, r() * 380, 1 + r() * 1.5, 0, Math.PI * 2)
      g.fill()
    }
  },
  trad(g, r) {
    g.fillStyle = 'rgba(255,236,120,0.9)'
    g.beginPath()
    g.arc(70, 70, 30, 0, Math.PI * 2)
    g.fill()
    for (let i = 0; i < 4; i++) moln(g, 120 + r() * 220, 50 + r() * 120, 0.6 + r() * 0.4, 0.5)
    kulle(g, 505, 14, '#4caf50', 1)
    const fl = ['#ff6fa8', '#ffd43b', '#ffffff', '#b28dff', '#ff8a3d']
    for (let i = 0; i < 18; i++) {
      const x = 10 + r() * 340
      const y = 515 + r() * 70
      g.strokeStyle = '#2e7d32'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(x, y + 20)
      g.lineTo(x, y)
      g.stroke()
      g.fillStyle = fl[i % fl.length]
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2
        g.beginPath()
        g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = '#ffb300'
      g.beginPath()
      g.arc(x, y, 3, 0, Math.PI * 2)
      g.fill()
    }
    // honungsvax
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    g.lineWidth = 1.5
    for (let y = 120; y < 460; y += 34) {
      for (let x = (y / 34) % 2 ? 0 : 20; x < W; x += 40) {
        g.beginPath()
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2
          g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * 12, y + Math.sin(a) * 12)
        }
        g.closePath()
        g.stroke()
      }
    }
  },
}

/* ---------------------------------------------------------------- kanonen */

export function ritaKanon(ctx, vinkel, laddad, ikon, t, eld) {
  const { x, y } = KANON
  ctx.save()
  // fäste
  const fot = ctx.createLinearGradient(0, 0, 0, y + 10)
  fot.addColorStop(0, '#4b5563')
  fot.addColorStop(1, '#1f2937')
  ctx.fillStyle = fot
  rundRekt(ctx, x - 34, -6, 68, y + 2, 14)
  ctx.fill()
  ctx.strokeStyle = '#facc15'
  ctx.lineWidth = 2
  ctx.stroke()
  // pipan
  ctx.translate(x, y)
  ctx.rotate(vinkel - Math.PI / 2)
  const pipa = ctx.createLinearGradient(-9, 0, 9, 0)
  pipa.addColorStop(0, '#9ca3af')
  pipa.addColorStop(0.45, '#f3f4f6')
  pipa.addColorStop(1, '#4b5563')
  ctx.fillStyle = pipa
  rundRekt(ctx, -9, 0, 18, 30, 5)
  ctx.fill()
  ctx.fillStyle = '#facc15'
  ctx.fillRect(-10, 24, 20, 5)
  if (laddad) {
    ctx.fillStyle = eld ? '#ff8a00' : '#e5e7eb'
    ctx.beginPath()
    ctx.arc(0, 22, KULA_R, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  // kupolen med mästaren
  ctx.save()
  const kup = ctx.createRadialGradient(x - 6, y - 8, 2, x, y, 20)
  kup.addColorStop(0, '#fde68a')
  kup.addColorStop(1, '#b45309')
  ctx.fillStyle = kup
  ctx.beginPath()
  ctx.arc(x, y, 17, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#78350f'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.font = '18px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ikon, x, y + 1 + Math.sin(t * 3) * 0.8)
  ctx.restore()
}

/* ------------------------------------------------------------------ hinken */

export function ritaHink(ctx, x, t, glod) {
  const b = HINK.bredd
  const y = HINK.y
  ctx.save()
  const kropp = ctx.createLinearGradient(x - b / 2, 0, x + b / 2, 0)
  kropp.addColorStop(0, '#7c2d12')
  kropp.addColorStop(0.5, '#ea580c')
  kropp.addColorStop(1, '#7c2d12')
  ctx.fillStyle = kropp
  ctx.beginPath()
  ctx.moveTo(x - b / 2, y)
  ctx.lineTo(x + b / 2, y)
  ctx.lineTo(x + b / 2 - 6, H + 2)
  ctx.lineTo(x - b / 2 + 6, H + 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  for (let i = 0; i < 3; i++) ctx.fillRect(x - b / 2 + 8 + i * 16, y + 5, 6, H - y)
  // öppningen
  ctx.fillStyle = glod > 0 ? `rgba(255,240,150,${0.5 + glod * 0.5})` : 'rgba(20,10,0,0.55)'
  ctx.beginPath()
  ctx.ellipse(x, y + 1, b / 2 - 3, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fde68a'
    ctx.beginPath()
    ctx.arc(x + (s * b) / 2, y, 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#92400e'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ctx.restore()
}

/* ------------------------------------------------------------ feberfacken */

const FACK_FARG = ['#38bdf8', '#a855f7', '#facc15', '#a855f7', '#38bdf8']

export function ritaFack(ctx, upp, rensat, t, traff) {
  if (upp <= 0) return
  const n = FACK_POANG.length
  const bw = W / n
  const topp = H - (H - FACK_TOPP) * upp
  ctx.save()
  for (let i = 0; i < n; i++) {
    const x = i * bw
    const lys = traff && traff.index === i ? Math.max(0, 1 - traff.tid / 1.2) : 0
    const g = ctx.createLinearGradient(0, topp, 0, H)
    g.addColorStop(0, ljusare(FACK_FARG[i], 0.25 + lys * 0.6))
    g.addColorStop(1, ljusare(FACK_FARG[i], -0.45))
    ctx.fillStyle = g
    ctx.globalAlpha = 0.92
    ctx.fillRect(x + 1, topp, bw - 2, H - topp)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#fff'
    ctx.font = `900 ${i === 2 ? 15 : 13}px ui-rounded, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = 3
    const txt = (rensat ? 100000 : FACK_POANG[i]).toLocaleString('sv-SE')
    const ty = topp + (H - topp) / 2 + 2 + Math.sin(t * 6 + i) * 1.2
    ctx.strokeText(txt, x + bw / 2, ty)
    ctx.fillText(txt, x + bw / 2, ty)
  }
  for (let i = 1; i < n; i++) {
    ctx.fillStyle = '#fef3c7'
    ctx.beginPath()
    ctx.arc(i * bw, topp, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(i * bw - 2, topp, 4, H - topp)
  }
  ctx.restore()
}

/* ------------------------------------------------------------------ kulan */

export function ritaKula(ctx, k, spar, typ) {
  const r = k.r
  // spåret
  for (let i = 0; i < spar.length; i++) {
    const [x, y] = spar[i]
    const a = (i + 1) / (spar.length + 1)
    ctx.globalAlpha = a * (typ === 'eld' ? 0.7 : 0.35)
    ctx.fillStyle = typ === 'eld' ? (i % 2 ? '#ffb020' : '#ff5a1f') : typ === 'spok' ? '#c4b5fd' : '#e0f2fe'
    ctx.beginPath()
    ctx.arc(x, y, r * (0.35 + a * 0.6), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = typ === 'spok' && k.spokad === true ? 0.45 : 1
  if (typ === 'eld') {
    const glod = ctx.createRadialGradient(k.x, k.y, r * 0.3, k.x, k.y, r * 2.4)
    glod.addColorStop(0, 'rgba(255,200,60,0.8)')
    glod.addColorStop(1, 'rgba(255,80,0,0)')
    ctx.fillStyle = glod
    ctx.beginPath()
    ctx.arc(k.x, k.y, r * 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  const g = ctx.createRadialGradient(k.x - r * 0.4, k.y - r * 0.45, r * 0.1, k.x, k.y, r)
  if (typ === 'eld') {
    g.addColorStop(0, '#fffbe6')
    g.addColorStop(0.5, '#ffb020')
    g.addColorStop(1, '#d9480f')
  } else {
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.55, '#cbd5e1')
    g.addColorStop(1, '#475569')
  }
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(k.x, k.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(15,23,42,0.6)'
  ctx.lineWidth = 0.8
  ctx.stroke()
  ctx.globalAlpha = 1
}

/* ------------------------------------------------------------------ siktet */

export function ritaSikte(ctx, pts, lang, t) {
  if (!pts.length) return
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const [x, y, traff] = pts[i]
    const a = lang ? 0.95 - (i / n) * 0.6 : 0.9 - (i / n) * 0.55
    ctx.globalAlpha = Math.max(0.15, a)
    ctx.fillStyle = lang ? '#86efac' : '#ffffff'
    const puls = traff ? 3.4 + Math.sin(t * 10) * 0.6 : 2.1
    ctx.beginPath()
    ctx.arc(x, y, puls, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export { PINNE_R }
