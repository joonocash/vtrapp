// Godbitens ljud, ovanpå det delade ljudlagret (allt syntas, inga filer).

import { skapaLjud } from '../delat/ljud.js'

export function skapaGodbitLjud() {
  const l = skapaLjud()
  const { ton, brus } = l
  return {
    ...l,
    klipp() {
      brus(0.07, 0.12, 5200, 0, 9000, 1.4)
      ton(2400, 0.03, 'square', 0.03)
      ton(180, 0.12, 'triangle', 0.05, 0.01, 90)
    },
    krok() {
      ton(220, 0.25, 'triangle', 0.08, 0, 330)
      ton(660, 0.1, 'sine', 0.04, 0.02)
    },
    stjarna(nr) {
      const f = [880, 1108.73, 1318.51][Math.min(2, nr - 1)] || 1318.51
      ton(f, 0.22, 'triangle', 0.11)
      ton(f * 2, 0.3, 'sine', 0.05, 0.04)
      ton(f * 1.5, 0.35, 'sine', 0.035, 0.08)
      brus(0.25, 0.03, 7000, 0.02, 10000, 0.5)
    },
    mums() {
      for (let i = 0; i < 3; i++) {
        brus(0.07, 0.14, 900, i * 0.16, 400, 1)
        ton(130, 0.06, 'square', 0.04, i * 0.16)
      }
    },
    voff() {
      for (const [d, f] of [[0, 520], [0.18, 600]]) {
        ton(f, 0.09, 'sawtooth', 0.07, d, f * 0.6)
        ton(f * 2.1, 0.06, 'square', 0.025, d, f * 1.2)
        brus(0.06, 0.05, 1600, d, 900, 1.5)
      }
    },
    gnall() {
      ton(980, 0.55, 'sine', 0.07, 0, 520)
      ton(1300, 0.4, 'triangle', 0.025, 0.05, 700)
    },
    bubbla() {
      ton(320, 0.18, 'sine', 0.09, 0, 640)
    },
    pop() {
      ton(900, 0.06, 'sine', 0.1, 0, 1600)
      brus(0.06, 0.06, 4000, 0, 7000, 1)
    },
    puff() {
      brus(0.3, 0.11, 900, 0, 300, 0.7)
    },
    studs() {
      ton(170, 0.22, 'sine', 0.14, 0, 420)
      ton(340, 0.15, 'triangle', 0.04, 0.02, 700)
    },
    hatt() {
      ton(500, 0.3, 'sine', 0.06, 0, 1500)
      ;[1567.98, 2093, 2637].forEach((f, i) => ton(f, 0.12, 'triangle', 0.04, 0.12 + i * 0.05))
    },
    ekorre() {
      for (let i = 0; i < 4; i++) ton(2200 + i * 160, 0.03, 'square', 0.025, i * 0.05)
    },
    gravitation() {
      ton(200, 0.4, 'sawtooth', 0.04, 0, 900)
      ton(900, 0.4, 'sine', 0.04, 0.05, 200)
    },
    stjarnaBorta() {
      ton(600, 0.2, 'triangle', 0.04, 0, 300)
    },
    hittat() {
      ;[1046.5, 1318.51, 1567.98, 2093].forEach((f, i) => ton(f, 0.3, 'triangle', 0.08, i * 0.07))
    },
  }
}
