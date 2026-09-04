// audio.js — allt ljud genereras i Web Audio. Inga ljudfiler, inga licensfrågor,
// noll extra nedladdning. Den viktiga effekten är stigande tonhöjd per rensning i rad.

let ctx = null;
let master = null;
let enabled = true;

const semitone = (n) => 440 * Math.pow(2, n / 12);

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return ctx;
}

// Måste kallas från en riktig klick-/touch-händelse, annars startar inte ljudet.
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function setSoundEnabled(v) {
  enabled = v;
  if (master) master.gain.value = v ? 0.35 : 0;
}

export const isSoundEnabled = () => enabled;

function tone({ freq, dur = 0.16, type = 'triangle', gain = 0.5, delay = 0, glide = 0 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.18, gain = 0.25, hp = 900, delay = 0 }) {
  const c = ensure();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t0);
}

export const sfx = {
  pickup() {
    tone({ freq: semitone(-14), dur: 0.05, type: 'square', gain: 0.12 });
  },
  drop() {
    tone({ freq: semitone(-20), dur: 0.07, type: 'square', gain: 0.22 });
    noise({ dur: 0.05, gain: 0.06, hp: 1800 });
  },
  invalid() {
    tone({ freq: semitone(-26), dur: 0.12, type: 'sawtooth', gain: 0.14, glide: 0.7 });
  },

  // Kärnan i dopaminkicken: varje rensning i rad ligger ett halvtonssteg högre.
  clear({ lines = 1, streak = 1 }) {
    const base = -5 + Math.min(streak - 1, 14);
    for (let i = 0; i < lines; i++) {
      tone({ freq: semitone(base + i * 4), dur: 0.22, type: 'triangle', gain: 0.4, delay: i * 0.055 });
      tone({ freq: semitone(base + 12 + i * 4), dur: 0.16, type: 'sine', gain: 0.18, delay: i * 0.055 });
    }
    noise({ dur: 0.22, gain: 0.1 + lines * 0.03, hp: 1200 });
  },

  gem(i = 0) {
    tone({ freq: semitone(19 + i * 2), dur: 0.3, type: 'sine', gain: 0.3, delay: i * 0.04 });
  },
  crack() {
    noise({ dur: 0.12, gain: 0.2, hp: 2600 });
    tone({ freq: semitone(10), dur: 0.08, type: 'square', gain: 0.1 });
  },
  bombTick(n) {
    tone({ freq: semitone(n < 4 ? -2 : -9), dur: 0.06, type: 'square', gain: 0.12 });
  },
  levelWin() {
    [0, 4, 7, 12, 16].forEach((n, i) =>
      tone({ freq: semitone(n), dur: 0.4, type: 'triangle', gain: 0.32, delay: i * 0.08 })
    );
  },
  levelFail() {
    [0, -3, -7].forEach((n, i) =>
      tone({ freq: semitone(n - 5), dur: 0.35, type: 'sawtooth', gain: 0.2, delay: i * 0.11 })
    );
  },
  newBest() {
    [0, 7, 12, 19, 24].forEach((n, i) =>
      tone({ freq: semitone(n), dur: 0.5, type: 'sine', gain: 0.3, delay: i * 0.07 })
    );
  },
};

// Vibration på mobil. Ignoreras tyst där det inte finns.
export function buzz(pattern) {
  if (!enabled) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* strunt samma */ }
  }
}
