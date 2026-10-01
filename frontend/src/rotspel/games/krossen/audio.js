// Krossen — ljudet. Allt syntas i webbläsaren, inga ljudfiler.
//
// AudioContext skapas först vid första ljudet (iOS kräver en användargest),
// och allt går genom en kompressor så att tjugo samtidiga smällar inte
// spricker.

// Pentatonisk skala: stigande toner för kedjor låter alltid rätt, hur långt
// kedjan än blir.
const SKALA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31]
const hz = (halvtoner, bas = 523.25) => bas * Math.pow(2, halvtoner / 12)

export function skapaLjud(arTyst) {
  let ctx = null
  let ut = null
  let brus = null
  let musik = null

  function kontext() {
    if (arTyst()) return null
    try {
      if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return null
        ctx = new Ctx()
        const komp = ctx.createDynamicsCompressor()
        komp.threshold.value = -14
        komp.ratio.value = 6
        ut = ctx.createGain()
        ut.gain.value = 0.8
        ut.connect(komp)
        komp.connect(ctx.destination)
        const len = ctx.sampleRate
        brus = ctx.createBuffer(1, len, ctx.sampleRate)
        const d = brus.getChannelData(0)
        for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1
      }
      if (ctx.state === 'suspended') ctx.resume()
      return ctx
    } catch {
      return null
    }
  }

  function ton(freq, ms, { typ = 'sine', vol = 0.12, glid = null, fordrojning = 0, attack = 0.006, mal = null } = {}) {
    const c = kontext()
    if (!c) return
    const t = c.currentTime + fordrojning / 1000
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = typ
    o.frequency.setValueAtTime(freq, t)
    if (glid) o.frequency.exponentialRampToValueAtTime(glid, t + ms / 1000)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
    o.connect(g)
    g.connect(mal || ut)
    o.start(t)
    o.stop(t + ms / 1000 + 0.02)
  }

  function brusa(ms, { filter = 'bandpass', frekvens = 1200, q = 1, vol = 0.12, svep = null, fordrojning = 0 } = {}) {
    const c = kontext()
    if (!c) return
    const t = c.currentTime + fordrojning / 1000
    const s = c.createBufferSource()
    s.buffer = brus
    const f = c.createBiquadFilter()
    f.type = filter
    f.frequency.setValueAtTime(frekvens, t)
    if (svep) f.frequency.exponentialRampToValueAtTime(svep, t + ms / 1000)
    f.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
    s.connect(f)
    f.connect(g)
    g.connect(ut)
    s.start(t, Math.random() * 0.5)
    s.stop(t + ms / 1000 + 0.02)
  }

  const ljud = {
    // byte och nej
    byte() {
      brusa(120, { frekvens: 900, svep: 2400, q: 0.8, vol: 0.06 })
      ton(660, 70, { typ: 'triangle', vol: 0.05 })
    },
    nej() {
      ton(220, 90, { typ: 'square', vol: 0.05 })
      ton(180, 120, { typ: 'square', vol: 0.05, fordrojning: 90 })
    },
    // en matchning — tonen stiger med kedjan
    match(kaskad, antal = 3) {
      const n = Math.min(SKALA.length - 1, kaskad - 1 + (antal > 3 ? 1 : 0))
      const f = hz(SKALA[n])
      ton(f, 180, { typ: 'triangle', vol: 0.11 })
      ton(f * 2, 120, { typ: 'sine', vol: 0.05, fordrojning: 15 })
      ton(f * 1.5, 160, { typ: 'sine', vol: 0.04, fordrojning: 40 })
      brusa(60, { frekvens: 5000, q: 2, vol: 0.03 })
    },
    special() {
      ;[0, 4, 7, 12, 16].forEach((s, k) => ton(hz(s + 7), 140, { typ: 'triangle', vol: 0.07, fordrojning: k * 45 }))
    },
    raket() {
      ton(420, 320, { typ: 'sawtooth', vol: 0.06, glid: 1600 })
      brusa(360, { frekvens: 800, svep: 5000, q: 1.2, vol: 0.12 })
    },
    bomb(stor = false) {
      ton(stor ? 110 : 150, 420, { typ: 'sine', vol: 0.3, glid: 38 })
      brusa(stor ? 600 : 420, { filter: 'lowpass', frekvens: 1400, svep: 90, q: 0.7, vol: stor ? 0.4 : 0.3 })
      ton(80, 200, { typ: 'triangle', vol: 0.15, fordrojning: 10 })
    },
    skal() {
      ;[0, 7, 12, 16, 19, 24].forEach((s, k) => ton(hz(s), 700, { typ: 'sine', vol: 0.05, fordrojning: k * 30 }))
      brusa(500, { frekvens: 3000, svep: 9000, q: 3, vol: 0.06 })
    },
    zapp(k = 0) {
      ton(1200 + (k % 6) * 140, 70, { typ: 'square', vol: 0.025, glid: 400 })
    },
    frisbee() {
      brusa(420, { frekvens: 600, svep: 3000, q: 4, vol: 0.09 })
      ton(500, 380, { typ: 'sine', vol: 0.05, glid: 1100 })
    },
    lada(sonder) {
      brusa(sonder ? 220 : 120, { frekvens: sonder ? 700 : 1100, q: 1.4, vol: sonder ? 0.22 : 0.14 })
      ton(sonder ? 130 : 190, 90, { typ: 'triangle', vol: 0.1 })
    },
    ograss() {
      brusa(240, { filter: 'highpass', frekvens: 3000, q: 0.7, vol: 0.08 })
    },
    koppel() {
      ton(1800, 160, { typ: 'sine', vol: 0.06 })
      ton(2700, 220, { typ: 'sine', vol: 0.04, fordrojning: 20 })
    },
    lera() {
      brusa(140, { filter: 'lowpass', frekvens: 900, svep: 300, q: 2, vol: 0.12 })
      ton(160, 120, { typ: 'sine', vol: 0.06, glid: 90 })
    },
    // ett litet vov när köttbenet når Happy
    vov() {
      const c = kontext()
      if (!c) return
      for (const [start, t0] of [
        [0, 0],
        [0.18, 1],
      ]) {
        const t = c.currentTime + start
        const o = c.createOscillator()
        const f = c.createBiquadFilter()
        const g = c.createGain()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(t0 ? 520 : 460, t)
        o.frequency.exponentialRampToValueAtTime(230, t + 0.14)
        f.type = 'bandpass'
        f.frequency.value = 900
        f.Q.value = 2.5
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.015)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
        o.connect(f)
        f.connect(g)
        g.connect(ut)
        o.start(t)
        o.stop(t + 0.18)
      }
    },
    ograssVaxer() {
      brusa(260, { filter: 'bandpass', frekvens: 400, svep: 1600, q: 3, vol: 0.07 })
    },
    tass() {
      ton(120, 200, { typ: 'sine', vol: 0.3, glid: 50 })
      brusa(160, { filter: 'lowpass', frekvens: 600, q: 1, vol: 0.2 })
    },
    blanda() {
      ;[0, 3, 5, 7, 10, 12].forEach((s, k) => ton(hz(s - 12), 90, { typ: 'triangle', vol: 0.06, fordrojning: k * 50 }))
    },
    berom(niva) {
      const bas = [0, 4, 7, 12][Math.min(3, niva - 1)]
      ;[0, 4, 7, 12].forEach((s, k) => ton(hz(s + bas), 360, { typ: 'triangle', vol: 0.07, fordrojning: k * 60 }))
    },
    stjarna(n) {
      ton(hz(12 + n * 4), 420, { typ: 'triangle', vol: 0.12 })
      ton(hz(19 + n * 4), 380, { typ: 'sine', vol: 0.06, fordrojning: 60 })
    },
    mynt() {
      ton(1320, 80, { typ: 'square', vol: 0.04 })
      ton(1760, 220, { typ: 'square', vol: 0.04, fordrojning: 70 })
    },
    klick() {
      ton(900, 40, { typ: 'triangle', vol: 0.05 })
    },
    vinst() {
      const m = [0, 4, 7, 12, 7, 12, 16, 19]
      m.forEach((s, k) => ton(hz(s), 220, { typ: 'triangle', vol: 0.1, fordrojning: k * 110 }))
      ton(hz(-12), 900, { typ: 'sine', vol: 0.08 })
      ton(hz(-5), 900, { typ: 'sine', vol: 0.06, fordrojning: 440 })
    },
    forlust() {
      ;[7, 6, 5, 0].forEach((s, k) => ton(hz(s - 12), k === 3 ? 600 : 280, { typ: 'triangle', vol: 0.1, fordrojning: k * 260 }))
    },
    godisregn() {
      ;[0, 4, 7, 12, 16, 19, 24].forEach((s, k) => ton(hz(s), 260, { typ: 'triangle', vol: 0.07, fordrojning: k * 55 }))
    },
    lagDrag() {
      ton(880, 90, { typ: 'square', vol: 0.03 })
    },
    // tennisbollen: ett studsigt "pock"
    boll() {
      ton(420, 120, { typ: 'sine', vol: 0.14, glid: 180 })
      brusa(50, { frekvens: 2500, q: 2, vol: 0.06 })
    },
    // klockorna tickar — fortare och ljusare ju närmare noll
    tick(kvar = 9) {
      const f = kvar <= 3 ? 2000 : 1500
      ton(f, 35, { typ: 'square', vol: 0.03 })
      ton(f * 0.75, 35, { typ: 'square', vol: 0.03, fordrojning: 120 })
    },
    ring() {
      for (let k = 0; k < 10; k++) {
        ton(k % 2 ? 1900 : 2300, 60, { typ: 'square', vol: 0.05, fordrojning: k * 70 })
      }
    },
    paket() {
      brusa(260, { frekvens: 2400, svep: 6000, q: 2, vol: 0.07 })
      ;[0, 4, 7, 12].forEach((st, k) => ton(hz(st + 12), 160, { typ: 'triangle', vol: 0.06, fordrojning: 90 + k * 50 }))
    },
    samla(k = 0) {
      ton(hz(SKALA[k % SKALA.length] + 12), 70, { typ: 'sine', vol: 0.05 })
    },
    hopp() {
      ton(220, 300, { typ: 'sine', vol: 0.12, glid: 880 })
      brusa(300, { frekvens: 500, svep: 2400, q: 1.5, vol: 0.08 })
      ton(660, 160, { typ: 'triangle', vol: 0.06, fordrojning: 260, glid: 330 })
    },
    varning() {
      ton(740, 110, { typ: 'square', vol: 0.05 })
      ton(740, 110, { typ: 'square', vol: 0.05, fordrojning: 160 })
    },
    hjulTick() {
      ton(1200, 25, { typ: 'triangle', vol: 0.05 })
    },
    kista() {
      brusa(300, { filter: 'lowpass', frekvens: 600, q: 1, vol: 0.12 })
      ;[0, 4, 7, 12, 16, 19, 24].forEach((st, k) => ton(hz(st + 7), 300, { typ: 'triangle', vol: 0.07, fordrojning: 250 + k * 60 }))
    },
  }

  // --------------------------------------------------------------- musiken

  // En liten slinga per värld: bas, ackord och en melodi som slumpas ur
  // skalan. Tyst som standard — slås på med notknappen.
  const TEMA = [
    { bas: 261.63, bpm: 104, ackord: [0, 5, 3, 4] },
    { bas: 293.66, bpm: 98, ackord: [0, 3, 5, 4] },
    { bas: 220.0, bpm: 90, ackord: [0, 5, 3, 4] },
    { bas: 329.63, bpm: 110, ackord: [0, 4, 5, 3] },
    { bas: 246.94, bpm: 96, ackord: [0, 3, 4, 5] },
  ]
  const DUR = [0, 2, 4, 5, 7, 9, 11, 12]

  function startaMusik(varld = 0) {
    stoppaMusik()
    const c = kontext()
    if (!c) return
    const tema = TEMA[varld % TEMA.length]
    const gain = c.createGain()
    gain.gain.value = 0.0001
    gain.connect(ut)
    gain.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 1.5)
    const takt = 60 / tema.bpm / 2
    let steg = 0
    let nasta = c.currentTime + 0.1
    let melodi = 0
    const id = setInterval(() => {
      if (arTyst()) return
      while (nasta < c.currentTime + 0.25) {
        const ackord = tema.ackord[Math.floor(steg / 16) % 4]
        const grund = tema.bas * Math.pow(2, DUR[ackord] / 12)
        const pos = steg % 16
        const tid = (nasta - c.currentTime) * 1000
        if (pos % 4 === 0) ton(grund / 2, takt * 1800, { typ: 'triangle', vol: 0.09, fordrojning: tid, mal: gain })
        if (pos % 8 === 4) {
          ;[0, 4, 7].forEach((s) => ton(grund * Math.pow(2, s / 12), takt * 1400, { typ: 'sine', vol: 0.025, fordrojning: tid, mal: gain }))
        }
        if (pos % 2 === 0 && Math.random() < 0.7) {
          melodi = Math.max(0, Math.min(9, melodi + Math.floor(Math.random() * 5) - 2))
          const f = grund * 2 * Math.pow(2, SKALA[melodi] / 12)
          ton(f, takt * 900, { typ: 'triangle', vol: 0.035, fordrojning: tid, mal: gain })
        }
        nasta += takt
        steg++
      }
    }, 90)
    musik = { id, gain }
  }

  function stoppaMusik() {
    if (!musik) return
    clearInterval(musik.id)
    try {
      musik.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)
      const g = musik.gain
      setTimeout(() => g.disconnect(), 500)
    } catch {
      // ingen fara
    }
    musik = null
  }

  function stang() {
    stoppaMusik()
    if (ctx) ctx.close().catch(() => {})
    ctx = null
  }

  return { ...ljud, startaMusik, stoppaMusik, stang, musikPa: () => Boolean(musik) }
}
