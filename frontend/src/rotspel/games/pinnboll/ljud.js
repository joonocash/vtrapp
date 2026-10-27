// Pinnbollens ljud, ovanpå det delade ljudlagret (allt syntas, inga filer).
//
// Det viktigaste ljudet i Peggle är att varje träff i ett skott spelar nästa
// ton i en durskala, så en lång serie låter som en klättring. Skalan börjar
// om vid varje nytt skott. Pinnarna som tänts poppar sedan i samma ordning
// med en egen liten klättring. Sista orange: trumvirvel i slowmotion, och
// träffar man blir det Extreme Fever med "Ode till glädjen" (Beethoven,
// fri att använda).

import { skapaLjud } from '../delat/ljud.js'

const DUR = [0, 2, 4, 5, 7, 9, 11]
const BAS = 392 // G4
function durton(i) {
  const n = Math.max(0, Math.min(19, i))
  const semi = 12 * Math.floor(n / 7) + DUR[n % 7]
  return BAS * Math.pow(2, semi / 12)
}

// Ode till glädjen i C-dur. [ton, längd i fjärdedelar]
const E5 = 659.25
const F5 = 698.46
const G5 = 783.99
const D5 = 587.33
const C5 = 523.25
const ODE = [
  [E5, 1], [E5, 1], [F5, 1], [G5, 1], [G5, 1], [F5, 1], [E5, 1], [D5, 1],
  [C5, 1], [C5, 1], [D5, 1], [E5, 1], [E5, 1.5], [D5, 0.5], [D5, 2],
  [E5, 1], [E5, 1], [F5, 1], [G5, 1], [G5, 1], [F5, 1], [E5, 1], [D5, 1],
  [C5, 1], [C5, 1], [D5, 1], [E5, 1], [D5, 1.5], [C5, 0.5], [C5, 2],
]
// basen, en ton per takt (fyra fjärdedelar)
const ODE_BAS = [130.81, 98.0, 130.81, 98.0, 130.81, 98.0, 130.81, 130.81]
const FJARDEDEL = 0.26

export function skapaPinnLjud() {
  const l = skapaLjud()
  const { ton, brus } = l
  let timers = []
  let virvel = null

  function senare(fn, s) {
    const id = setTimeout(fn, s * 1000)
    timers.push(id)
  }

  return {
    ...l,

    // Träff nummer nr (1, 2, 3 …) i skottet.
    traff(nr, farg, tegel) {
      if (l.strypt('traff' + (nr % 3), 18)) return
      const f = durton(nr - 1)
      if (tegel) {
        ton(f, 0.11, 'triangle', 0.11)
        ton(f * 0.5, 0.08, 'square', 0.025)
      } else {
        ton(f, 0.2, 'sine', 0.14)
        ton(f * 2.01, 0.1, 'sine', 0.045)
        ton(f * 3.02, 0.05, 'triangle', 0.02)
      }
      if (farg === 'orange') ton(f * 1.5, 0.12, 'triangle', 0.04, 0.02)
      if (farg === 'lila') {
        ton(f * 1.25, 0.25, 'sine', 0.06, 0.03)
        ton(f * 1.5, 0.3, 'sine', 0.05, 0.07)
      }
    },

    // Pinnarna som försvinner efter skottet.
    poppa(i) {
      if (l.strypt('poppa', 22)) return
      const f = durton(Math.min(i, 14)) * 1.5
      ton(f, 0.05, 'triangle', 0.05)
      ton(f * 2, 0.035, 'sine', 0.02)
    },

    skott() {
      ton(170, 0.14, 'sine', 0.22, 0, 80)
      brus(0.1, 0.07, 1400, 0, 500)
    },

    // "Aaah" — en liten kör när kulan landar i hinken.
    hink() {
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        ton(f, 0.7, 'triangle', 0.05, i * 0.03)
        ton(f * 1.004, 0.7, 'sine', 0.03, i * 0.03)
      })
      brus(0.5, 0.03, 3000, 0, 6000, 0.6)
    },

    extraKula() {
      ;[783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => ton(f, 0.16, 'square', 0.035, i * 0.07))
      ;[2093, 2637].forEach((f, i) => ton(f, 0.3, 'sine', 0.05, 0.3 + i * 0.06))
    },

    multi(m) {
      const f = 440 * Math.pow(2, Math.log2(m) / 2)
      ton(f, 0.18, 'sawtooth', 0.04, 0, f * 2)
      ton(f * 2, 0.3, 'triangle', 0.08, 0.12)
    },

    // En ny kula ur en grön pinne (kulregn): ett litet plopp uppåt.
    nyKula() {
      if (l.strypt('nyKula', 45)) return
      const f = 520 + Math.random() * 260
      ton(f, 0.09, 'sine', 0.07, 0, f * 1.8)
      ton(f * 2, 0.05, 'triangle', 0.02, 0.02)
    },

    // Kulkaos: guld (ett litet klirr) och kedjeblixten (ett sprak).
    mynt() {
      if (l.strypt('mynt', 50)) return
      ton(1318.5, 0.07, 'square', 0.025)
      ton(1975.5, 0.12, 'triangle', 0.035, 0.05)
    },
    blixt() {
      if (l.strypt('blixt', 60)) return
      brus(0.12, 0.06, 4000, 0, 9000)
      ton(880, 0.08, 'sawtooth', 0.025, 0, 220)
    },

    // En studsare i flipperspelet: "boing", lite lägre när den är sliten.
    studs(kvar = 10) {
      if (l.strypt('studs', 40)) return
      const f = 260 + Math.min(10, kvar) * 18
      ton(f, 0.12, 'square', 0.035, 0, f * 2.2)
      ton(f * 1.5, 0.08, 'sine', 0.05, 0.01)
    },

    kraft() {
      ton(330, 0.35, 'sawtooth', 0.04, 0, 1320)
      ton(660, 0.3, 'triangle', 0.08, 0.15)
      ton(990, 0.3, 'triangle', 0.06, 0.25)
      brus(0.4, 0.05, 2000, 0, 8000)
    },

    small() {
      ton(90, 0.5, 'sine', 0.3, 0, 40)
      brus(0.6, 0.16, 900, 0, 200, 0.6)
    },

    spok() {
      ton(620, 0.6, 'sine', 0.06, 0, 310)
      ton(930, 0.6, 'sine', 0.04, 0.05, 460)
    },

    stil() {
      ;[880, 1108.73, 1318.51].forEach((f, i) => ton(f, 0.22, 'triangle', 0.08, i * 0.05))
      brus(0.3, 0.04, 5000, 0.05, 9000, 0.5)
    },

    // Slantsingling efter ett skott utan träffar.
    slant(vann) {
      for (let i = 0; i < 6; i++) ton(1800 + i * 90, 0.02, 'square', 0.02, i * 0.09)
      if (vann) {
        ton(1318.51, 0.2, 'triangle', 0.1, 0.6)
        ton(1975.53, 0.4, 'triangle', 0.08, 0.7)
      } else {
        ton(220, 0.2, 'triangle', 0.08, 0.6, 160)
      }
    },

    fast() {
      ton(300, 0.08, 'square', 0.03, 0, 200)
    },

    // Trumvirveln medan kulan är på väg mot sista orange.
    virvel(pa) {
      if (pa && !virvel) {
        let n = 0
        const slag = () => {
          brus(0.045, 0.05 + Math.min(0.06, n * 0.002), 2200, 0, 1400, 1.2)
          n++
          virvel = setTimeout(slag, Math.max(28, 60 - n * 1.2))
        }
        slag()
        ton(55, 2.5, 'sine', 0.12)
      } else if (!pa && virvel) {
        clearTimeout(virvel)
        virvel = null
      }
    },

    miss() {
      ton(392, 0.7, 'triangle', 0.09, 0, 233)
      ton(311, 0.7, 'triangle', 0.06, 0.02, 196)
    },

    // Extreme Fever: cymbalkrasch, kör och Ode till glädjen.
    feber() {
      brus(1.6, 0.2, 7000, 0, 3000, 0.35)
      ton(65, 0.9, 'sine', 0.3, 0, 40)
      ;[523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => ton(f, 0.9, 'triangle', 0.06, 0.05 + i * 0.04))
      let t = 0.7
      ODE.forEach(([f, d]) => {
        const start = t
        senare(() => {
          ton(f, d * FJARDEDEL * 0.95, 'triangle', 0.11)
          ton(f * 2, d * FJARDEDEL * 0.7, 'sine', 0.035)
        }, start)
        t += d * FJARDEDEL
      })
      ODE_BAS.forEach((f, i) => {
        senare(() => {
          ton(f, FJARDEDEL * 3.6, 'triangle', 0.08)
          ton(f * 1.5, FJARDEDEL * 3.6, 'sine', 0.035)
        }, 0.7 + i * 4 * FJARDEDEL)
      })
    },

    fack(poang) {
      const stor = poang >= 100000
      ton(stor ? 98 : 130, 0.5, 'sine', 0.28, 0, 50)
      brus(0.8, 0.12, 5000, 0, 2500, 0.4)
      const seq = stor ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093] : [523.25, 659.25, 783.99, 1046.5]
      seq.forEach((f, i) => ton(f, 0.25, 'triangle', 0.1, 0.05 + i * 0.06))
    },

    stjarna(i) {
      const f = [1046.5, 1318.51, 1567.98][i] || 1567.98
      ton(f, 0.3, 'triangle', 0.1)
      ton(f * 1.5, 0.35, 'sine', 0.05, 0.05)
    },

    tystaMusik() {
      timers.forEach(clearTimeout)
      timers = []
      if (virvel) clearTimeout(virvel)
      virvel = null
    },

    stang() {
      timers.forEach(clearTimeout)
      timers = []
      if (virvel) clearTimeout(virvel)
      virvel = null
      l.stang()
    },
  }
}
