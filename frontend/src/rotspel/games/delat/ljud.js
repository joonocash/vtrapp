// Delat ljud för de nya rötspelen. Allt syntas med Web Audio, inga filer.
//
// readSettings().ljud läses vid varje ljud, så reglaget i GameShell gäller
// direkt. AudioContext skapas först vid första ljudet: iOS vägrar starta ljud
// som inte kommer efter en användargest.
//
// Allt går genom en kompressor så att tjugo samtidiga pop (Pixelkanon) inte
// klipper.

import { readSettings } from '../../useSettings.js'

// Pentatonisk skala: staplar man toner på den låter det aldrig fel. Kombor
// klättrar uppför den.
export const PENTA = [
  261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66,
  1318.51, 1567.98, 1760.0, 2093.0, 2349.32, 2637.02, 3135.96, 3520.0,
]
export const skala = (i) => PENTA[Math.max(0, Math.min(PENTA.length - 1, Math.round(i)))]

export function skapaLjud() {
  let ctx = null
  let ut = null
  let brusBuffer = null
  const senast = {}

  function ac() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return null
      ctx = new Ctx()
      const komp = ctx.createDynamicsCompressor()
      komp.threshold.value = -14
      komp.knee.value = 8
      komp.ratio.value = 6
      komp.attack.value = 0.003
      komp.release.value = 0.12
      ut = ctx.createGain()
      ut.gain.value = 0.9
      ut.connect(komp).connect(ctx.destination)
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  const tyst = () => !readSettings().ljud

  // Hindrar att samma ljud spelas oftare än var ms:e millisekund.
  function strypt(nyckel, ms) {
    const nu = performance.now()
    if (senast[nyckel] && nu - senast[nyckel] < ms) return true
    senast[nyckel] = nu
    return false
  }

  function ton(freq, dur = 0.12, typ = 'sine', vol = 0.15, delay = 0, glideTo = 0) {
    if (tyst()) return
    try {
      const c = ac()
      if (!c) return
      const t = c.currentTime + delay
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = typ
      o.frequency.setValueAtTime(freq, t)
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(ut)
      o.start(t)
      o.stop(t + dur + 0.03)
    } catch {
      /* inget ljud, inget problem */
    }
  }

  // Filtrerat brus: sus, swisch, dunsar.
  function brus(dur = 0.2, vol = 0.1, frekv = 1200, delay = 0, frekvTill = 0, q = 0.8) {
    if (tyst()) return
    try {
      const c = ac()
      if (!c) return
      if (!brusBuffer) {
        brusBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate)
        const d = brusBuffer.getChannelData(0)
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      }
      const t = c.currentTime + delay
      const src = c.createBufferSource()
      src.buffer = brusBuffer
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.Q.value = q
      f.frequency.setValueAtTime(frekv, t)
      if (frekvTill) f.frequency.exponentialRampToValueAtTime(frekvTill, t + dur)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3))
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      src.connect(f).connect(g).connect(ut)
      src.start(t, Math.random() * 0.5)
      src.stop(t + dur + 0.03)
    } catch {
      /* tyst */
    }
  }

  return {
    ton,
    brus,
    strypt,

    // Kort pop. steg = position på skalan, så kedjor klättrar.
    pop(steg = 5, vol = 0.12) {
      const f = skala(steg)
      ton(f, 0.09, 'triangle', vol)
      ton(f * 2, 0.06, 'sine', vol * 0.35, 0.01)
    },
    // Liten tick för snabba serier (Pixelkanon). Stryps.
    tick(steg = 8) {
      if (strypt('tick', 28)) return
      ton(skala(steg), 0.05, 'square', 0.035)
      ton(skala(steg) * 2, 0.04, 'sine', 0.03)
    },
    swisch(langd = 1) {
      brus(0.22 + langd * 0.02, 0.09, 900, 0, 3200, 1.2)
    },
    klick() {
      ton(1800, 0.025, 'square', 0.04)
    },
    dunk() {
      ton(110, 0.14, 'sine', 0.22, 0, 60)
      brus(0.08, 0.06, 300)
    },
    fel() {
      ton(196, 0.12, 'sawtooth', 0.06, 0, 140)
      ton(185, 0.16, 'square', 0.04, 0.05, 120)
    },
    hjarta() {
      ton(330, 0.12, 'triangle', 0.12, 0, 220)
      ton(220, 0.25, 'triangle', 0.1, 0.1, 150)
    },
    mynt(i = 0) {
      const f = 1568 * Math.pow(1.06, i % 8)
      ton(f, 0.07, 'square', 0.035)
      ton(f * 1.5, 0.14, 'triangle', 0.06, 0.05)
    },
    kombo(n) {
      const f = skala(4 + Math.min(n, 14))
      ton(f, 0.18, 'triangle', 0.12)
      ton(f * 1.5, 0.22, 'sine', 0.06, 0.04)
    },
    // Stort jubel: "Snyggt!", "Galet!"
    hurra(niva = 1) {
      const bas = [523.25, 659.25, 783.99, 1046.5]
      bas.forEach((f, i) => ton(f * (1 + niva * 0.06), 0.2, 'triangle', 0.11, i * 0.05))
      brus(0.35, 0.05, 4000, 0.05, 8000, 0.5)
    },
    vinst() {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0]
      seq.forEach((f, i) => ton(f, 0.26, 'triangle', 0.13, i * 0.07))
      ;[2637.02, 3135.96, 3520.0].forEach((f, i) => ton(f, 0.4, 'sine', 0.05, 0.55 + i * 0.07))
      brus(0.8, 0.04, 6000, 0.5, 9000, 0.4)
    },
    forlust() {
      ;[392, 330, 262, 196].forEach((f, i) => ton(f, 0.3, 'triangle', 0.12, i * 0.14))
    },
    varning() {
      if (strypt('varning', 700)) return
      ton(98, 0.1, 'sine', 0.16)
      ton(98, 0.12, 'sine', 0.13, 0.16)
    },
    kista() {
      ton(220, 0.08, 'square', 0.05)
      ton(330, 0.08, 'square', 0.05, 0.08)
      ton(440, 0.08, 'square', 0.05, 0.16)
      ;[880, 1108.73, 1318.51, 1760].forEach((f, i) => ton(f, 0.35, 'triangle', 0.1, 0.3 + i * 0.06))
      brus(0.6, 0.06, 5000, 0.3, 9000, 0.5)
    },
    booster() {
      ton(440, 0.3, 'sawtooth', 0.04, 0, 1760)
      ton(880, 0.25, 'triangle', 0.08, 0.15)
      brus(0.3, 0.05, 2000, 0, 7000)
    },
    stang() {
      try {
        if (ctx) ctx.close()
      } catch {
        /* redan stängd */
      }
      ctx = null
      ut = null
      brusBuffer = null
    },
  }
}
