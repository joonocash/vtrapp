// Delat för de nya rötspelen — slump med frö. Samma frö ger samma bana på
// alla datorer, så "bana 37" är samma bana för alla som spelar.

export function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashStr(s) {
  let h = 2166136261
  for (const c of String(s)) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const slump = (...delar) => mulberry32(hashStr(delar.join(':')))

export function blanda(a, r) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const heltal = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1))
export const valj = (r, a) => a[Math.floor(r() * a.length)]
export const klamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Viktat val: [[vikt, värde], ...]
export function viktat(r, lista) {
  const tot = lista.reduce((s, [v]) => s + v, 0)
  let x = r() * tot
  for (const [v, varde] of lista) {
    x -= v
    if (x < 0) return varde
  }
  return lista[lista.length - 1][1]
}
