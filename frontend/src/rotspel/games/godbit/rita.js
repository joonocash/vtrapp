// Godbiten — allt som ritas på canvasen. Ingen spellogik.
//
// Happy är ritad för hand (en liten chihuahuablandning med stora ögon,
// spetsiga öron, mörk nos och tungan ute). Ögonen följer godbiten, munnen
// öppnar sig när den närmar sig, svansen viftar, öronen hänger när den
// försvinner. Bakgrunderna ritas en gång per värld till en egen canvas.

import { W, H, GODBIT_R, STJARNA_R, BUBBLA_R, TAGG_R, STUDS_TJ, HATT_R, KNAPP_R, KUDDE } from './motor.js'
import { mulberry32 } from '../delat/rng.js'
import { rundRekt, ljusare, stjarna as stjarnform } from '../delat/fx.js'

const TVAPI = Math.PI * 2
const klamp = (v, a, b) => (v < a ? a : v > b ? b : v)

function canvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/* ---------------------------------------------------------------- Happy */

const FARG = {
  pals: '#c88a4c',
  palsMork: '#6e4527',
  palsLjus: '#e9c08a',
  brost: '#f3dcb8',
  nos: '#33231b',
  ora: '#e7a98a',
  tunga: '#f07a92',
  mun: '#5a1f22',
  bad: '#d9475b',
  badKant: '#f2a0aa',
}

// Ritar Happy med munnen i (x, y). lage: { t, mun (0–1), blick: [dx, dy],
// blink (0–1), ledsen (0–1), glad (0–1), tugga (0–1), upp (upp och ner) }
export function ritaHappy(ctx, x, y, l) {
  ctx.save()
  ctx.translate(x, y)
  if (l.upp) ctx.rotate(Math.PI)
  const hopp = l.glad > 0 ? -Math.abs(Math.sin(l.t * 9)) * 10 * l.glad : 0
  const andas = Math.sin(l.t * 2.4) * 0.8
  ctx.scale(0.9, 0.9)

  // korgen
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(0, 70, 54, 12, 0, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = FARG.bad
  ctx.beginPath()
  ctx.ellipse(0, 62, 52, 15, 0, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = FARG.badKant
  ctx.beginPath()
  ctx.ellipse(0, 57, 46, 9, 0, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = '#b8303f'
  ctx.beginPath()
  ctx.ellipse(0, 59, 38, 6, 0, 0, TVAPI)
  ctx.fill()

  ctx.translate(0, hopp)

  // svansen (bakom kroppen)
  const vifta = Math.sin(l.t * (l.glad > 0 || l.mun > 0.3 ? 22 : 7)) * (l.ledsen > 0 ? 0.08 : 0.45)
  ctx.save()
  ctx.translate(20, 44)
  ctx.rotate(-0.5 + vifta - l.ledsen * 0.9)
  ctx.strokeStyle = FARG.palsMork
  ctx.lineWidth = 9
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(18, -6, 22, -26)
  ctx.stroke()
  ctx.strokeStyle = FARG.pals
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.restore()

  // kroppen
  ctx.fillStyle = FARG.palsMork
  ctx.beginPath()
  ctx.ellipse(0, 36 + andas * 0.3, 27, 25, 0, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = FARG.pals
  ctx.beginPath()
  ctx.ellipse(0, 38 + andas * 0.3, 24, 22, 0, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = FARG.brost
  ctx.beginPath()
  ctx.ellipse(0, 40, 13, 17, 0, 0, TVAPI)
  ctx.fill()
  // framtassar
  for (const s of [-1, 1]) {
    ctx.fillStyle = FARG.pals
    rundRekt(ctx, s * 11 - 6, 44, 12, 18, 6)
    ctx.fill()
    ctx.fillStyle = FARG.brost
    ctx.beginPath()
    ctx.ellipse(s * 11, 61, 7.5, 4.5, 0, 0, TVAPI)
    ctx.fill()
  }

  // huvudet (lutar lite åt godbiten)
  ctx.save()
  ctx.translate(0, -2)
  ctx.rotate(klamp(l.blick[0] * 0.04, -0.12, 0.12) - (l.ledsen > 0 ? 0.05 : 0))
  ctx.translate(0, 2)

  // öronen
  for (const s of [-1, 1]) {
    ctx.save()
    ctx.translate(s * 20, -34)
    // hänger när han är ledsen, spetsas när han är sugen
    ctx.rotate(s * (0.38 + l.ledsen * 1.1 - l.mun * 0.12 + Math.sin(l.t * 3 + s) * 0.02))
    ctx.fillStyle = FARG.palsMork
    ctx.beginPath()
    ctx.moveTo(-11, 6)
    ctx.quadraticCurveTo(-8, -26, 0, -40)
    ctx.quadraticCurveTo(9, -24, 12, 6)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = FARG.ora
    ctx.beginPath()
    ctx.moveTo(-6, 3)
    ctx.quadraticCurveTo(-4, -20, 0, -31)
    ctx.quadraticCurveTo(5, -19, 7, 3)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // skallen
  ctx.fillStyle = FARG.palsMork
  ctx.beginPath()
  ctx.ellipse(0, -18, 33, 29, 0, 0, TVAPI)
  ctx.fill()
  const huvud = ctx.createRadialGradient(-8, -30, 4, 0, -16, 34)
  huvud.addColorStop(0, FARG.palsLjus)
  huvud.addColorStop(0.7, FARG.pals)
  huvud.addColorStop(1, '#9a6334')
  ctx.fillStyle = huvud
  ctx.beginPath()
  ctx.ellipse(0, -17, 31, 27, 0, 0, TVAPI)
  ctx.fill()
  // mörka strimmor i pälsen (sobel)
  ctx.strokeStyle = 'rgba(70,40,20,0.35)'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  for (const [x1, y1, x2, y2] of [[-6, -42, -3, -32], [2, -43, 1, -33], [9, -41, 6, -31], [-20, -32, -14, -27], [20, -32, 14, -27]]) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // ögonen
  for (const s of [-1, 1]) {
    const ex = s * 13
    const ey = -22
    ctx.fillStyle = '#2b1a10'
    ctx.beginPath()
    ctx.ellipse(ex, ey, 10.5, 10.5 * (1 - l.blink * 0.92), 0, 0, TVAPI)
    ctx.fill()
    if (l.blink < 0.7) {
      const bx = klamp(l.blick[0], -1, 1) * 3
      const by = klamp(l.blick[1], -1, 1) * 2.6
      ctx.fillStyle = '#5b3a24'
      ctx.beginPath()
      ctx.ellipse(ex + bx, ey + by, 7.5, 7.5 * (1 - l.blink), 0, 0, TVAPI)
      ctx.fill()
      ctx.fillStyle = '#120a06'
      ctx.beginPath()
      ctx.arc(ex + bx, ey + by, 4.6 + l.mun * 1.2, 0, TVAPI)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ex + bx - 2.6, ey + by - 2.8, 2.6, 0, TVAPI)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex + bx + 2.4, ey + by + 2.2, 1.1, 0, TVAPI)
      ctx.fill()
    }
    // ledsna ögonbryn
    if (l.ledsen > 0) {
      ctx.strokeStyle = `rgba(60,35,18,${l.ledsen})`
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(ex - s * 7, ey - 15)
      ctx.lineTo(ex + s * 5, ey - 11)
      ctx.stroke()
    }
  }
  // tår
  if (l.ledsen > 0.5) {
    const k = (l.t * 1.5) % 1
    ctx.fillStyle = `rgba(140,200,255,${0.8 * (1 - k)})`
    ctx.beginPath()
    ctx.ellipse(-17, -12 + k * 14, 2.4, 3.4, 0, 0, TVAPI)
    ctx.fill()
  }

  // nospartiet
  ctx.fillStyle = '#4a3326'
  ctx.beginPath()
  ctx.ellipse(0, -6, 17, 13, 0, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = '#5c4031'
  ctx.beginPath()
  ctx.ellipse(0, -8, 13, 9, 0, 0, TVAPI)
  ctx.fill()
  // munnen
  const oppen = Math.max(l.mun, l.tugga)
  if (oppen > 0.05) {
    const h = 3 + oppen * 15
    ctx.fillStyle = FARG.mun
    ctx.beginPath()
    ctx.ellipse(0, 0 + h * 0.35, 11 + oppen * 4, h * 0.6, 0, 0, TVAPI)
    ctx.fill()
    ctx.fillStyle = FARG.tunga
    ctx.beginPath()
    ctx.ellipse(0, h * 0.6, 7 + oppen * 2, 4 + oppen * 3, 0, 0, TVAPI)
    ctx.fill()
    // små tänder
    ctx.fillStyle = '#fff'
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(s * 7, -1)
      ctx.lineTo(s * 5, 3)
      ctx.lineTo(s * 9, 2)
      ctx.fill()
    }
  } else {
    ctx.strokeStyle = '#1d120c'
    ctx.lineWidth = 1.8
    ctx.beginPath()
    if (l.ledsen > 0) {
      ctx.moveTo(-6, 3)
      ctx.quadraticCurveTo(0, -1, 6, 3)
    } else {
      ctx.moveTo(-7, -1)
      ctx.quadraticCurveTo(-3.5, 3, 0, 0)
      ctx.quadraticCurveTo(3.5, 3, 7, -1)
    }
    ctx.stroke()
    // tungan ute (flåsar) när han är glad och väntar
    if (l.ledsen <= 0) {
      const fl = 0.5 + Math.sin(l.t * 7) * 0.5
      ctx.fillStyle = FARG.tunga
      rundRekt(ctx, -4, 0.5, 8, 6 + fl * 3, 4)
      ctx.fill()
      ctx.strokeStyle = 'rgba(160,40,60,0.6)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, 2)
      ctx.lineTo(0, 5 + fl * 2)
      ctx.stroke()
    }
  }
  // nosen
  ctx.fillStyle = '#120c09'
  ctx.beginPath()
  ctx.ellipse(0, -13, 7, 5, 0, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(-2, -15, 2.4, 1.3, -0.3, 0, TVAPI)
  ctx.fill()
  ctx.restore()

  ctx.restore()
}

/* ---------------------------------------------------------------- godbiten */

export function ritaGodbit(ctx, x, y, rot, skala = 1, alfa = 1) {
  ctx.save()
  ctx.globalAlpha = alfa
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(skala, skala)
  // skugga
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  benform(ctx, 2, 3)
  ctx.fill()
  const g = ctx.createLinearGradient(0, -9, 0, 9)
  g.addColorStop(0, '#f6d49a')
  g.addColorStop(0.55, '#d9a560')
  g.addColorStop(1, '#a8723a')
  ctx.fillStyle = g
  benform(ctx, 0, 0)
  ctx.fill()
  ctx.strokeStyle = '#7d4f23'
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  rundRekt(ctx, -8, -5, 16, 2.6, 1.3)
  ctx.fill()
  // små hål som på ett riktigt kex
  ctx.fillStyle = 'rgba(125,79,35,0.55)'
  for (const [hx, hy] of [[-5, 1.5], [0, 2.5], [5, 1.5]]) {
    ctx.beginPath()
    ctx.arc(hx, hy, 1, 0, TVAPI)
    ctx.fill()
  }
  ctx.restore()
}

function benform(ctx, ox, oy) {
  ctx.beginPath()
  ctx.moveTo(-10 + ox, -4.5 + oy)
  ctx.lineTo(10 + ox, -4.5 + oy)
  ctx.arc(13 + ox, -4.5 + oy, 5, Math.PI * 0.85, Math.PI * 2.05)
  ctx.arc(13 + ox, 4.5 + oy, 5, Math.PI * 1.95, Math.PI * 1.15 + Math.PI)
  ctx.lineTo(-10 + ox, 4.5 + oy)
  ctx.arc(-13 + ox, 4.5 + oy, 5, Math.PI * -0.15, Math.PI * 1.05)
  ctx.arc(-13 + ox, -4.5 + oy, 5, Math.PI * 0.95, Math.PI * 2.15)
  ctx.closePath()
}

/* ---------------------------------------------------------------- rep och spikar */

export function ritaRep(ctx, kedja, strackt, alfa = 1) {
  if (kedja.length < 2) return
  ctx.save()
  ctx.globalAlpha = alfa
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const vag = () => {
    ctx.beginPath()
    ctx.moveTo(kedja[0].x, kedja[0].y)
    for (let i = 1; i < kedja.length - 1; i++) {
      const mx = (kedja[i].x + kedja[i + 1].x) / 2
      const my = (kedja[i].y + kedja[i + 1].y) / 2
      ctx.quadraticCurveTo(kedja[i].x, kedja[i].y, mx, my)
    }
    const s = kedja[kedja.length - 1]
    ctx.lineTo(s.x, s.y)
  }
  vag()
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 6
  ctx.translate(1.5, 2)
  ctx.stroke()
  ctx.translate(-1.5, -2)
  vag()
  ctx.strokeStyle = strackt ? '#8c2f24' : '#6b4a2a'
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.strokeStyle = strackt ? '#e86a50' : '#d9b07a'
  ctx.lineWidth = 3
  ctx.stroke()
  // tvinnade ränder
  ctx.setLineDash([3, 4])
  ctx.strokeStyle = strackt ? '#ffb9a8' : '#f5dcb2'
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

export function ritaSpik(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.arc(x + 1.5, y + 2, 7, 0, TVAPI)
  ctx.fill()
  const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 7)
  g.addColorStop(0, '#fff4cf')
  g.addColorStop(0.5, '#d8a93a')
  g.addColorStop(1, '#8a6316')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, 6.5, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = '#6b4c10'
  ctx.beginPath()
  ctx.arc(x, y, 2, 0, TVAPI)
  ctx.fill()
}

export function ritaKrok(ctx, k, t) {
  if (!k.anvand) {
    ctx.save()
    ctx.strokeStyle = 'rgba(120, 200, 255, 0.75)'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 6])
    ctx.lineDashOffset = -t * 14
    ctx.beginPath()
    ctx.arc(k.wx, k.wy, k.r, 0, TVAPI)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(120, 200, 255, 0.07)'
    ctx.fill()
    ctx.restore()
  }
  ritaSpik(ctx, k.wx, k.wy)
}

/* ---------------------------------------------------------------- stjärnor */

export function ritaStjarna(ctx, s, t) {
  if (s.tagen || s.borta) return
  const bob = Math.sin(t * 2.6 + s.i * 1.7) * 2
  ctx.save()
  ctx.translate(s.x, s.y + bob)
  const glod = ctx.createRadialGradient(0, 0, 2, 0, 0, STJARNA_R * 1.9)
  glod.addColorStop(0, 'rgba(255,236,140,0.55)')
  glod.addColorStop(1, 'rgba(255,236,140,0)')
  ctx.fillStyle = glod
  ctx.beginPath()
  ctx.arc(0, 0, STJARNA_R * 1.9, 0, TVAPI)
  ctx.fill()
  ctx.rotate(Math.sin(t * 1.3 + s.i) * 0.2)
  ctx.fillStyle = '#b8860b'
  stjarnform(ctx, STJARNA_R + 1.5)
  const g = ctx.createLinearGradient(0, -STJARNA_R, 0, STJARNA_R)
  g.addColorStop(0, '#fff6b8')
  g.addColorStop(0.5, '#ffd43b')
  g.addColorStop(1, '#f59f00')
  ctx.fillStyle = g
  stjarnform(ctx, STJARNA_R)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.ellipse(-3, -5, 3, 1.6, -0.5, 0, TVAPI)
  ctx.fill()
  ctx.restore()
  // tidsstjärna: en ring som tar slut
  if (s.kvarTid != null) {
    const k = Math.max(0, s.kvarTid / s.tid)
    ctx.strokeStyle = k < 0.3 ? '#ff6b6b' : '#ffe08a'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(s.x, s.y + bob, STJARNA_R + 7, -Math.PI / 2, -Math.PI / 2 + TVAPI * k)
    ctx.stroke()
  }
}

/* ---------------------------------------------------------------- hinder */

export function ritaBubbla(ctx, x, y, t, haller) {
  const w = Math.sin(t * 5) * 1.2
  ctx.save()
  ctx.translate(x, y)
  const g = ctx.createRadialGradient(-7, -8, 3, 0, 0, BUBBLA_R + w)
  g.addColorStop(0, 'rgba(255,255,255,0.35)')
  g.addColorStop(0.7, haller ? 'rgba(170,220,255,0.18)' : 'rgba(170,220,255,0.12)')
  g.addColorStop(1, 'rgba(120,190,255,0.5)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, BUBBLA_R + w, BUBBLA_R - w, 0, 0, TVAPI)
  ctx.fill()
  ctx.strokeStyle = 'rgba(220,240,255,0.8)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.ellipse(-9, -10, 5, 3, -0.6, 0, TVAPI)
  ctx.fill()
  ctx.restore()
}

export function ritaKudde(ctx, k, t) {
  const sedan = t - k.puff
  const tryck = sedan < 0.25 ? 1 - sedan / 0.25 : 0
  ctx.save()
  ctx.translate(k.x, k.y)
  ctx.rotate(k.vinkel)
  // luftstrålar
  if (sedan < 0.5) {
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - sedan / 0.5)})`
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (const dy of [-8, 0, 8]) {
      const s = 20 + sedan * 160
      ctx.beginPath()
      ctx.moveTo(s, dy * (1 + sedan * 2))
      ctx.lineTo(s + 24, dy * (1 + sedan * 2.5))
      ctx.stroke()
    }
  }
  // kudden: en liten blåsbälg
  ctx.scale(1 - tryck * 0.25, 1 + tryck * 0.1)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  rundRekt(ctx, -KUDDE.r + 2, -15 + 3, KUDDE.r * 1.6, 30, 10)
  ctx.fill()
  const g = ctx.createLinearGradient(0, -15, 0, 15)
  g.addColorStop(0, '#7dd3fc')
  g.addColorStop(1, '#0284c7')
  ctx.fillStyle = g
  rundRekt(ctx, -KUDDE.r, -15, KUDDE.r * 1.6, 30, 10)
  ctx.fill()
  ctx.strokeStyle = '#075985'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#e0f2fe'
  rundRekt(ctx, KUDDE.r * 0.45, -6, 10, 12, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'
  ctx.lineWidth = 1.5
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(-KUDDE.r + 8 + (i + 1) * 9, -12)
    ctx.lineTo(-KUDDE.r + 8 + (i + 1) * 9, 12)
    ctx.stroke()
  }
  ctx.restore()
}

export function ritaTaggar(ctx, s) {
  const [x1, y1, x2, y2] = s.w
  const L = Math.hypot(x2 - x1, y2 - y1)
  const v = Math.atan2(y2 - y1, x2 - x1)
  ctx.save()
  ctx.translate(x1, y1)
  ctx.rotate(v)
  ctx.fillStyle = '#3f3f46'
  rundRekt(ctx, -TAGG_R, -4, L + TAGG_R * 2, 8, 4)
  ctx.fill()
  const n = Math.max(2, Math.round(L / 10))
  for (const sida of [-1, 1]) {
    for (let i = 0; i <= n; i++) {
      const x = (L * i) / n
      const g = ctx.createLinearGradient(x, 0, x, sida * 13)
      g.addColorStop(0, '#9ca3af')
      g.addColorStop(1, '#f4f4f5')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(x - 4.5, 0)
      ctx.lineTo(x, sida * (TAGG_R + 7))
      ctx.lineTo(x + 4.5, 0)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()
}

export function ritaStuds(ctx, s, t) {
  const [x1, y1, x2, y2] = s.w
  const L = Math.hypot(x2 - x1, y2 - y1)
  const v = Math.atan2(y2 - y1, x2 - x1)
  const k = t - s.senast
  const gung = k < 0.4 ? Math.sin(k * 40) * (1 - k / 0.4) * 6 : 0
  ctx.save()
  ctx.translate(x1, y1)
  ctx.rotate(v)
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = STUDS_TJ * 1.4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(L / 2, gung, L, 0)
  ctx.stroke()
  ctx.strokeStyle = '#4b5563'
  ctx.lineWidth = 2
  ctx.stroke()
  for (const x of [0, L]) {
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(x, 0, 7, 0, TVAPI)
    ctx.fill()
    ctx.fillStyle = '#fecaca'
    ctx.beginPath()
    ctx.arc(x - 2, -2, 2.4, 0, TVAPI)
    ctx.fill()
  }
  ctx.restore()
}

export function ritaHatt(ctx, h, t, glans) {
  ctx.save()
  ctx.translate(h.x, h.y)
  ctx.rotate(h.vinkel - Math.PI / 2)
  // öppningen pekar mot +y efter rotationen
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.ellipse(0, 8, HATT_R + 4, 7, 0, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = '#1f1f2e'
  rundRekt(ctx, -HATT_R + 4, -22, (HATT_R - 4) * 2, 30, 4)
  ctx.fill()
  ctx.fillStyle = '#b91c1c'
  ctx.fillRect(-HATT_R + 4, 0, (HATT_R - 4) * 2, 6)
  ctx.fillStyle = '#2d2d44'
  ctx.beginPath()
  ctx.ellipse(0, 9, HATT_R - 2, 5, 0, 0, TVAPI)
  ctx.fill()
  ctx.restore()
  // gnistor runt öppningen
  for (let i = 0; i < 3; i++) {
    const a = t * 2 + i * 2.1
    const x = h.x + Math.cos(h.vinkel) * 12 + Math.cos(a) * 16
    const y = h.y + Math.sin(h.vinkel) * 12 + Math.sin(a) * 16
    ctx.fillStyle = `rgba(250, 230, 120, ${0.4 + 0.4 * Math.sin(t * 5 + i) + glans})`
    ctx.beginPath()
    ctx.arc(x, y, 1.8, 0, TVAPI)
    ctx.fill()
  }
}

export function ritaEkorre(ctx, e, t) {
  if (e.borta) return
  ctx.save()
  ctx.translate(e.x, e.y)
  if (e.fallande) ctx.rotate(t * 8)
  const k = Math.sin(t * 16) * 1.5
  // svansen
  ctx.fillStyle = '#b45309'
  ctx.beginPath()
  ctx.ellipse(-9, -10 + k * 0.5, 7, 13, -0.6, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = '#d97706'
  ctx.beginPath()
  ctx.ellipse(-8, -11 + k * 0.5, 4, 9, -0.6, 0, TVAPI)
  ctx.fill()
  // kroppen
  ctx.fillStyle = '#92400e'
  ctx.beginPath()
  ctx.ellipse(1, 0, 8, 9, 0, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = '#fde68a'
  ctx.beginPath()
  ctx.ellipse(3, 2, 4, 6, 0, 0, TVAPI)
  ctx.fill()
  // huvud
  ctx.fillStyle = '#92400e'
  ctx.beginPath()
  ctx.arc(4, -9, 6, 0, TVAPI)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(1, -14)
  ctx.lineTo(2, -19)
  ctx.lineTo(5, -14)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(6, -10, 1.5, 0, TVAPI)
  ctx.fill()
  ctx.restore()
}

export function ritaKnapp(ctx, k, grav, t) {
  const tryckt = t - k.tryckt < 0.2
  ctx.save()
  ctx.translate(k.x, k.y)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.arc(1.5, 3, KNAPP_R, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = '#7f1d1d'
  ctx.beginPath()
  ctx.arc(0, 0, KNAPP_R, 0, TVAPI)
  ctx.fill()
  const g = ctx.createRadialGradient(-5, -6, 2, 0, tryckt ? 2 : 0, KNAPP_R - 3)
  g.addColorStop(0, '#fca5a5')
  g.addColorStop(1, '#dc2626')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, tryckt ? 2 : 0, KNAPP_R - 3, 0, TVAPI)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.rotate(grav > 0 ? Math.PI : 0)
  ctx.beginPath()
  ctx.moveTo(0, -9)
  ctx.lineTo(7, 2)
  ctx.lineTo(2.5, 2)
  ctx.lineTo(2.5, 8)
  ctx.lineTo(-2.5, 8)
  ctx.lineTo(-2.5, 2)
  ctx.lineTo(-7, 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/* ---------------------------------------------------------------- världar */

export const VARLDAR = [
  { id: 'hemma', namn: 'Hemma', ikon: '🏠', text: 'Rep och krokar', farg: ['#fde6c8', '#f6c99a'] },
  { id: 'parken', namn: 'Parken', ikon: '🌳', text: 'Såpbubblor och taggar', farg: ['#bfe7ff', '#9be29a'] },
  { id: 'stranden', namn: 'Stranden', ikon: '🏖️', text: 'Luftkuddar och stjärnor på tid', farg: ['#a5e4ff', '#fde7a6'] },
  { id: 'skogen', namn: 'Skogen', ikon: '🌲', text: 'Ekorrar och rörliga spikar', farg: ['#cde8c5', '#7fae78'] },
  { id: 'lekrummet', namn: 'Lekrummet', ikon: '🧸', text: 'Studsmattor och trollhattar', farg: ['#e9d5ff', '#fbcfe8'] },
  { id: 'rymden', namn: 'Rymden', ikon: '🚀', text: 'Tyngdkraftsknappen', farg: ['#1e1b4b', '#4338ca'] },
]

const bakgrunder = new Map()
export function bakgrund(varld) {
  if (bakgrunder.has(varld)) return bakgrunder.get(varld)
  const v = VARLDAR[varld]
  const K = 2
  const c = canvas(W * K, H * K)
  const g = c.getContext('2d')
  g.scale(K, K)
  const r = mulberry32(varld * 7919 + 13)
  const himmel = g.createLinearGradient(0, 0, 0, H)
  himmel.addColorStop(0, v.farg[0])
  himmel.addColorStop(1, v.farg[1])
  g.fillStyle = himmel
  g.fillRect(0, 0, W, H)
  TEMAN[v.id](g, r)
  // mjuk vinjett så att mitten lyser
  const vin = g.createRadialGradient(W / 2, H * 0.45, 120, W / 2, H * 0.5, H * 0.8)
  vin.addColorStop(0, 'rgba(0,0,0,0)')
  vin.addColorStop(1, v.id === 'rymden' ? 'rgba(0,0,10,0.45)' : 'rgba(60,30,10,0.22)')
  g.fillStyle = vin
  g.fillRect(0, 0, W, H)
  bakgrunder.set(varld, c)
  return c
}

const TEMAN = {
  hemma(g, r) {
    // tapet med ränder och små tassar
    g.fillStyle = 'rgba(255,255,255,0.25)'
    for (let x = 0; x < W; x += 36) g.fillRect(x, 0, 14, H * 0.8)
    g.fillStyle = 'rgba(190,120,70,0.12)'
    for (let i = 0; i < 26; i++) tass(g, 20 + r() * 320, 30 + r() * 400, 0.6 + r() * 0.4)
    // fönster
    g.fillStyle = '#fff7ed'
    rundRekt(g, 230, 70, 100, 120, 6)
    g.fill()
    const fon = g.createLinearGradient(0, 78, 0, 182)
    fon.addColorStop(0, '#93c5fd')
    fon.addColorStop(1, '#dbeafe')
    g.fillStyle = fon
    g.fillRect(238, 78, 84, 104)
    g.fillStyle = '#fff7ed'
    g.fillRect(278, 78, 4, 104)
    g.fillRect(238, 128, 84, 4)
    g.fillStyle = 'rgba(255,255,255,0.7)'
    g.beginPath()
    g.arc(258, 100, 9, 0, TVAPI)
    g.arc(268, 98, 11, 0, TVAPI)
    g.arc(279, 101, 8, 0, TVAPI)
    g.fill()
    // golv och matta
    g.fillStyle = '#b07a4f'
    g.fillRect(0, H * 0.8, W, H * 0.2)
    g.strokeStyle = 'rgba(80,45,20,0.35)'
    g.lineWidth = 1.5
    for (let y = H * 0.8; y < H; y += 18) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(W, y)
      g.stroke()
    }
    g.fillStyle = 'rgba(80,45,20,0.25)'
    g.fillRect(0, H * 0.8 - 3, W, 6)
    g.fillStyle = '#7c9cbf'
    g.beginPath()
    g.ellipse(W / 2, H * 0.92, 150, 26, 0, 0, TVAPI)
    g.fill()
    g.strokeStyle = 'rgba(255,255,255,0.35)'
    g.lineWidth = 3
    g.beginPath()
    g.ellipse(W / 2, H * 0.92, 135, 19, 0, 0, TVAPI)
    g.stroke()
    // tavla
    g.fillStyle = '#8b5a2b'
    rundRekt(g, 40, 90, 70, 56, 4)
    g.fill()
    g.fillStyle = '#fde68a'
    g.fillRect(47, 97, 56, 42)
    g.fillStyle = '#d97706'
    tass(g, 75, 120, 1.3)
  },
  parken(g, r) {
    g.fillStyle = 'rgba(255,255,255,0.85)'
    for (let i = 0; i < 4; i++) moln(g, r() * W, 40 + r() * 160, 0.7 + r() * 0.5)
    kulle(g, H * 0.78, 20, '#6cc070', 0.4)
    for (let i = 0; i < 5; i++) trad(g, 20 + r() * 320, H * 0.78 - 4, 0.8 + r() * 0.5)
    kulle(g, H * 0.86, 14, '#4fa857', 2)
    g.fillStyle = 'rgba(255,255,255,0.6)'
    for (let i = 0; i < 30; i++) {
      g.beginPath()
      g.arc(r() * W, H * 0.86 + r() * H * 0.14, 1.6, 0, TVAPI)
      g.fill()
    }
  },
  stranden(g, r) {
    g.fillStyle = 'rgba(255,250,200,0.9)'
    g.beginPath()
    g.arc(290, 80, 30, 0, TVAPI)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.8)'
    for (let i = 0; i < 3; i++) moln(g, r() * W, 40 + r() * 120, 0.6 + r() * 0.4)
    g.fillStyle = '#38bdf8'
    g.fillRect(0, H * 0.62, W, H * 0.12)
    g.strokeStyle = 'rgba(255,255,255,0.6)'
    g.lineWidth = 2
    for (let y = H * 0.64; y < H * 0.74; y += 10) {
      g.beginPath()
      for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x / 14 + y) * 2)
      g.stroke()
    }
    g.fillStyle = '#fcd9a0'
    g.fillRect(0, H * 0.74, W, H * 0.26)
    g.fillStyle = 'rgba(200,150,80,0.35)'
    for (let i = 0; i < 60; i++) g.fillRect(r() * W, H * 0.74 + r() * H * 0.26, 2, 2)
    // parasoll
    g.fillStyle = '#ef4444'
    g.beginPath()
    g.arc(60, H * 0.76, 46, Math.PI, TVAPI)
    g.fill()
    g.fillStyle = '#fff'
    g.beginPath()
    g.moveTo(60, H * 0.76)
    g.arc(60, H * 0.76, 46, Math.PI * 1.25, Math.PI * 1.5)
    g.fill()
    g.beginPath()
    g.moveTo(60, H * 0.76)
    g.arc(60, H * 0.76, 46, Math.PI * 1.75, Math.PI * 2)
    g.fill()
    g.fillStyle = '#78350f'
    g.fillRect(58, H * 0.76, 4, 60)
  },
  skogen(g, r) {
    for (let lager = 0; lager < 3; lager++) {
      const farg = ['#a7cf9b', '#7fae78', '#5b8f57'][lager]
      for (let i = 0; i < 7; i++) gran(g, r() * W, H * (0.62 + lager * 0.1), 0.8 + lager * 0.3 + r() * 0.3, farg)
    }
    g.fillStyle = '#5b4636'
    g.fillRect(0, H * 0.9, W, H * 0.1)
    g.fillStyle = 'rgba(255,255,255,0.18)'
    for (let i = 0; i < 6; i++) {
      g.beginPath()
      g.moveTo(r() * W, 0)
      g.lineTo(r() * W - 40, H)
      g.lineTo(r() * W - 10, H)
      g.closePath()
      g.fill()
    }
  },
  lekrummet(g, r) {
    g.fillStyle = 'rgba(255,255,255,0.3)'
    for (let y = 0; y < H * 0.8; y += 40)
      for (let x = (y / 40) % 2 ? 20 : 0; x < W; x += 40) {
        g.beginPath()
        g.arc(x, y, 6, 0, TVAPI)
        g.fill()
      }
    g.fillStyle = '#c084fc'
    g.fillRect(0, H * 0.82, W, H * 0.18)
    const farger = ['#f87171', '#fbbf24', '#34d399', '#60a5fa']
    for (let i = 0; i < 6; i++) {
      g.fillStyle = farger[i % 4]
      const x = 10 + r() * 330
      rundRekt(g, x, H * 0.82 - 22, 22, 22, 3)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.8)'
      g.font = '900 12px system-ui'
      g.fillText('ABCD'[i % 4], x + 7, H * 0.82 - 7)
    }
  },
  rymden(g, r) {
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.8})`
      const s = r() < 0.1 ? 2 : 1
      g.fillRect(r() * W, r() * H, s, s)
    }
    const n = g.createRadialGradient(90, 180, 0, 90, 180, 150)
    n.addColorStop(0, 'rgba(236,72,153,0.35)')
    n.addColorStop(1, 'rgba(236,72,153,0)')
    g.fillStyle = n
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#fcd34d'
    g.beginPath()
    g.arc(300, 90, 26, 0, TVAPI)
    g.fill()
    g.strokeStyle = 'rgba(252,211,77,0.6)'
    g.lineWidth = 3
    g.beginPath()
    g.ellipse(300, 90, 44, 10, -0.4, 0, TVAPI)
    g.stroke()
    g.fillStyle = '#94a3b8'
    g.beginPath()
    g.arc(W / 2, H + 380, 460, 0, TVAPI)
    g.fill()
    g.fillStyle = 'rgba(71,85,105,0.6)'
    for (let i = 0; i < 6; i++) {
      g.beginPath()
      g.arc(r() * W, H * 0.9 + r() * 40, 6 + r() * 10, 0, TVAPI)
      g.fill()
    }
  },
}

function tass(g, x, y, s) {
  g.beginPath()
  g.ellipse(x, y, 6 * s, 5 * s, 0, 0, TVAPI)
  for (const [dx, dy] of [[-6, -7], [-2, -10], [2, -10], [6, -7]]) g.ellipse(x + dx * s, y + dy * s, 2.2 * s, 2.6 * s, 0, 0, TVAPI)
  g.fill()
}

function moln(g, x, y, s) {
  g.beginPath()
  g.arc(x, y, 18 * s, 0, TVAPI)
  g.arc(x + 20 * s, y - 8 * s, 22 * s, 0, TVAPI)
  g.arc(x + 44 * s, y, 17 * s, 0, TVAPI)
  g.rect(x, y, 44 * s, 16 * s)
  g.fill()
}

function kulle(g, y, amp, farg, fas) {
  g.fillStyle = farg
  g.beginPath()
  g.moveTo(0, H)
  for (let x = 0; x <= W; x += 6) g.lineTo(x, y + Math.sin(x / 70 + fas) * amp)
  g.lineTo(W, H)
  g.fill()
}

function trad(g, x, y, s) {
  g.fillStyle = '#7c5132'
  g.fillRect(x - 3 * s, y - 34 * s, 6 * s, 34 * s)
  g.fillStyle = '#3f9b4c'
  g.beginPath()
  g.arc(x, y - 44 * s, 20 * s, 0, TVAPI)
  g.arc(x - 13 * s, y - 33 * s, 14 * s, 0, TVAPI)
  g.arc(x + 13 * s, y - 33 * s, 14 * s, 0, TVAPI)
  g.fill()
}

function gran(g, x, y, s, farg) {
  g.fillStyle = farg
  g.beginPath()
  g.moveTo(x, y - 90 * s)
  g.lineTo(x + 28 * s, y)
  g.lineTo(x - 28 * s, y)
  g.closePath()
  g.fill()
}

export { ljusare }
