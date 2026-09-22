// Happys revir — ljud via Web Audio, inga ljudfiler.
// isMuted() läses vid varje ton, så mute-reglaget i GameShell gäller direkt.
// AudioContext skapas först vid första tonen (iOS kräver en användargest).

export function createAudio(isMuted = () => false) {
  let ctx = null
  function tone(freq, dur = 0.12, type = 'triangle', vol = 0.18, delay = 0) {
    if (isMuted()) return
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
      if (ctx.state === 'suspended') ctx.resume()
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain()
      o.type = type; o.frequency.setValueAtTime(freq, t)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02)
    } catch { /* inget ljud, inget problem */ }
  }
  const SCALE = [523, 587, 659, 698, 784, 880, 988, 1047, 1175, 1319]
  return {
    tone,
    x: () => tone(900, 0.04, 'sine', 0.05),
    good: (combo) => { const b = SCALE[Math.min(combo, 9)]; tone(b, 0.18); tone(b * 1.25, 0.2, 'sine', 0.07, 0.06); tone(b * 1.5, 0.28, 'sine', 0.07, 0.12); tone(b * 2, 0.3, 'sine', 0.03, 0.18) },
    bad: () => { tone(180, 0.25, 'sawtooth', 0.12); tone(140, 0.3, 'square', 0.06, 0.06) },
    soft: () => { tone(330, 0.18, 'sine', 0.1); tone(294, 0.22, 'sine', 0.08, 0.1) },
    hint: () => { tone(784, 0.12, 'sine', 0.08); tone(1047, 0.16, 'sine', 0.08, 0.08) },
    undo: () => { tone(600, 0.06, 'sine', 0.06); tone(450, 0.08, 'sine', 0.05, 0.05) },
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, i * 0.09)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15, i * 0.16)),
    close: () => { try { ctx && ctx.close() } catch { /* redan stängd */ } ctx = null },
  }
}
