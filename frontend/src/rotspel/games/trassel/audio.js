// Trassel — ljud via Web Audio. Inga ljudfiler.
// isMuted() läses vid varje ton, så ljudreglaget i GameShell gäller direkt.
// AudioContext skapas först vid första tonen (iOS kräver en användargest).

// Pentatonisk skala: hur man än staplar tonerna låter det aldrig fel.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32, 2637, 3135.96]

export function createAudio(isMuted = () => false) {
  let ctx = null
  let lastTick = 0

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }

  function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0, glideTo = 0) {
    if (isMuted()) return
    try {
      const c = ac()
      const t = c.currentTime + delay
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, t)
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(c.destination)
      o.start(t)
      o.stop(t + dur + 0.02)
    } catch { /* inget ljud, inget problem */ }
  }

  return {
    // Mjukt klick för varje ny ruta. Tonhöjden stiger med linjens längd.
    tick(len) {
      const now = performance.now()
      if (now - lastTick < 28) return
      lastTick = now
      tone(420 + Math.min(len, 30) * 18, 0.035, 'triangle', 0.035)
    },
    // En färg kopplad. n = hur många som är klara nu, så varje koppling
    // klättrar ett steg i skalan.
    connect(n) {
      const f = PENTA[Math.min(n, PENTA.length - 1)]
      tone(f, 0.22, 'triangle', 0.16)
      tone(f * 1.5, 0.26, 'sine', 0.07, 0.05)
      tone(f * 2, 0.3, 'sine', 0.04, 0.1)
    },
    cut() { tone(300, 0.09, 'square', 0.05, 0, 170) },
    blocked() { tone(140, 0.07, 'sine', 0.06) },
    undo() { tone(620, 0.06, 'sine', 0.06); tone(440, 0.08, 'sine', 0.05, 0.05) },
    hint() { tone(784, 0.12, 'sine', 0.09); tone(1175, 0.18, 'sine', 0.08, 0.09) },
    almost() { tone(392, 0.12, 'triangle', 0.1); tone(370, 0.16, 'triangle', 0.08, 0.1) },
    warp() { tone(900, 0.16, 'sine', 0.07, 0, 1800) },
    win(perfect) {
      const seq = perfect ? [523, 659, 784, 1047, 1319, 1568, 2093] : [523, 659, 784, 1047, 1319]
      seq.forEach((f, i) => tone(f, 0.25, 'triangle', 0.15, i * 0.075))
      if (perfect) [2637, 3136, 3520].forEach((f, i) => tone(f, 0.35, 'sine', 0.05, 0.55 + i * 0.06))
    },
    star(i) { tone(1047 * Math.pow(1.26, i), 0.22, 'triangle', 0.12) },
    secondTick() { tone(1400, 0.03, 'square', 0.03) },
    timeBonus() { tone(1568, 0.1, 'sine', 0.08); tone(2093, 0.14, 'sine', 0.07, 0.07) },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'triangle', 0.13, i * 0.13)) },
    close() { try { ctx && ctx.close() } catch { /* redan stängd */ } ctx = null },
  }
}
