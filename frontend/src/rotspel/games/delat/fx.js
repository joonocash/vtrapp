// Delat effektlager för de nya rötspelen: partiklar, konfetti, flygande text,
// ringar och skärmskak. Ritas på spelets egen canvas i spelets logiska
// koordinater, så det vet ingenting om skärmstorlek.
//
// Skak och hit-stop följer reglagen i GameShell (readSettings).

import { readSettings } from '../../useSettings.js'

const KONFETTI = ['#ff5a7a', '#ffd43b', '#5ce1e6', '#9b7bff', '#5bd96b', '#ff9f43', '#ffffff']

export function skapaFx() {
  const partiklar = []
  const texter = []
  const ringar = []
  let skak = 0
  let skakX = 0
  let skakY = 0
  let frys = 0

  function sprut(x, y, farg, n = 10, o = {}) {
    const fart = o.fart ?? 160
    for (let i = 0; i < n; i++) {
      const v = (o.vinkel ?? Math.random() * Math.PI * 2) + (o.spridning ?? Math.PI * 2) * (Math.random() - 0.5) * (o.vinkel != null ? 1 : 0)
      const s = fart * (0.35 + Math.random() * 0.75)
      partiklar.push({
        x,
        y,
        vx: Math.cos(v) * s,
        vy: Math.sin(v) * s - (o.lyft ?? 0),
        g: o.gravitation ?? 420,
        liv: (o.liv ?? 0.55) * (0.7 + Math.random() * 0.6),
        tid: 0,
        r: (o.storlek ?? 3.2) * (0.6 + Math.random() * 0.8),
        farg: Array.isArray(farg) ? farg[Math.floor(Math.random() * farg.length)] : farg,
        form: o.form ?? 'ruta',
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 14,
        drag: o.drag ?? 0.985,
      })
    }
    if (partiklar.length > 900) partiklar.splice(0, partiklar.length - 900)
  }

  return {
    sprut,

    konfetti(x, y, n = 70, bredd = 360) {
      for (let i = 0; i < n; i++) {
        const v = -Math.PI / 2 + (Math.random() - 0.5) * 1.6
        const s = 260 + Math.random() * 380
        partiklar.push({
          x: x + (Math.random() - 0.5) * bredd * 0.3,
          y,
          vx: Math.cos(v) * s,
          vy: Math.sin(v) * s,
          g: 520,
          liv: 1.6 + Math.random() * 1.2,
          tid: 0,
          r: 3 + Math.random() * 3.5,
          farg: KONFETTI[Math.floor(Math.random() * KONFETTI.length)],
          form: 'konfetti',
          rot: Math.random() * 6.28,
          vr: (Math.random() - 0.5) * 18,
          drag: 0.975,
        })
      }
    },

    // Flygande text: "+3", "Kombo x5", "Snyggt!"
    text(x, y, txt, o = {}) {
      texter.push({
        x,
        y,
        txt,
        farg: o.farg ?? '#ffd43b',
        storlek: o.storlek ?? 20,
        liv: o.liv ?? 0.9,
        tid: 0,
        stig: o.stig ?? 46,
        studs: o.studs ?? true,
        kant: o.kant ?? 'rgba(0,0,0,0.75)',
      })
      if (texter.length > 40) texter.shift()
    },

    ring(x, y, farg = '#ffffff', maxR = 40, liv = 0.4, bredd = 3) {
      ringar.push({ x, y, farg, maxR, liv, tid: 0, bredd })
    },

    skaka(styrka = 6) {
      if (!readSettings().skak) return
      skak = Math.max(skak, styrka)
    },

    // Fryser spelet ett ögonblick så en smäll känns tung. Spelet frågar fx.fryst().
    hitstop(ms = 70) {
      if (!readSettings().hitstop) return
      frys = Math.max(frys, ms / 1000)
    },
    fryst: () => frys > 0,

    uppdatera(dt) {
      if (frys > 0) frys = Math.max(0, frys - dt)
      for (let i = partiklar.length - 1; i >= 0; i--) {
        const p = partiklar[i]
        p.tid += dt
        if (p.tid >= p.liv) {
          partiklar.splice(i, 1)
          continue
        }
        p.vx *= p.drag
        p.vy = p.vy * p.drag + p.g * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rot += p.vr * dt
      }
      for (let i = texter.length - 1; i >= 0; i--) {
        const t = texter[i]
        t.tid += dt
        if (t.tid >= t.liv) texter.splice(i, 1)
      }
      for (let i = ringar.length - 1; i >= 0; i--) {
        const r = ringar[i]
        r.tid += dt
        if (r.tid >= r.liv) ringar.splice(i, 1)
      }
      if (skak > 0) {
        skak = Math.max(0, skak - dt * 40)
        skakX = (Math.random() - 0.5) * skak * 2
        skakY = (Math.random() - 0.5) * skak * 2
      } else {
        skakX = skakY = 0
      }
    },

    // Förskjutning för skak. Spelet gör ctx.translate(fx.skakX(), fx.skakY()).
    skakX: () => skakX,
    skakY: () => skakY,

    rita(ctx) {
      for (const r of ringar) {
        const k = r.tid / r.liv
        ctx.globalAlpha = (1 - k) * 0.9
        ctx.strokeStyle = r.farg
        ctx.lineWidth = r.bredd * (1 - k) + 0.5
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.maxR * (0.2 + 0.8 * (1 - Math.pow(1 - k, 3))), 0, Math.PI * 2)
        ctx.stroke()
      }
      for (const p of partiklar) {
        const k = p.tid / p.liv
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1
        ctx.fillStyle = p.farg
        if (p.form === 'cirkel') {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2)
          ctx.fill()
        } else if (p.form === 'gnista') {
          ctx.strokeStyle = p.farg
          ctx.lineWidth = p.r * 0.6
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03)
          ctx.stroke()
        } else if (p.form === 'stjarna') {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          stjarna(ctx, p.r * 1.6 * (1 - k * 0.4))
          ctx.restore()
        } else {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          const b = p.form === 'konfetti' ? p.r * 1.6 : p.r * 2 * (1 - k * 0.4)
          const h = p.form === 'konfetti' ? p.r * 0.8 * Math.abs(Math.cos(p.rot * 1.3)) + 0.6 : b
          ctx.fillRect(-b / 2, -h / 2, b, h)
          ctx.restore()
        }
      }
      ctx.globalAlpha = 1
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const t of texter) {
        const k = t.tid / t.liv
        const skal = t.studs ? (k < 0.15 ? 0.4 + (k / 0.15) * 0.85 : k < 0.3 ? 1.25 - ((k - 0.15) / 0.15) * 0.25 : 1) : 1
        ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1
        ctx.font = `900 ${Math.round(t.storlek * skal)}px ui-rounded, "Outfit Variable", system-ui, sans-serif`
        const y = t.y - t.stig * easeUt(k)
        ctx.lineWidth = Math.max(3, t.storlek * 0.22)
        ctx.lineJoin = 'round'
        ctx.strokeStyle = t.kant
        ctx.strokeText(t.txt, t.x, y)
        ctx.fillStyle = t.farg
        ctx.fillText(t.txt, t.x, y)
      }
      ctx.globalAlpha = 1
    },

    tom() {
      partiklar.length = 0
      texter.length = 0
      ringar.length = 0
      skak = 0
    },
    antal: () => partiklar.length,
  }
}

function easeUt(k) {
  return 1 - Math.pow(1 - k, 3)
}

export function stjarna(ctx, r) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r
    const v = -Math.PI / 2 + (i * Math.PI) / 5
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(v) * rr, Math.sin(v) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

// Hjälpare som flera spel behöver
export function rundRekt(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// Ljusare/mörkare variant av en hexfärg. k > 0 ljusare, k < 0 mörkare.
const ljusCache = new Map()
export function ljusare(hex, k) {
  const nyckel = hex + k
  const c = ljusCache.get(nyckel)
  if (c) return c
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  if (k >= 0) {
    r += (255 - r) * k
    g += (255 - g) * k
    b += (255 - b) * k
  } else {
    r *= 1 + k
    g *= 1 + k
    b *= 1 + k
  }
  const ut = '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  ljusCache.set(nyckel, ut)
  return ut
}

export const lerp = (a, b, t) => a + (b - a) * t
export const easeOut = (k) => 1 - Math.pow(1 - k, 3)
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
export const easeOutBack = (k) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2)
}
