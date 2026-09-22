// Happys revir — pusselmotorn.
// Ren logik utan DOM, så den går att testa i Node (se frontend/tests/revir.*.test.mjs).
//
// Reglerna: n×n-bräde uppdelat i n revir. Exakt en Happy per rad, kolumn och revir,
// och två Happy får aldrig stå i rutor som nuddar varandra, inte ens snett.
// generate() ger alltid ett bräde med exakt en lösning.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashStr(s) {
  let h = 2166136261
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function shuffle(a, r) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// En giltig placering: en Happy per rad och kolumn, ingen som nuddar grannraden.
export function placeDogs(n, r) {
  const p = []
  const used = new Array(n).fill(false)
  ;(function go(row) {
    if (row === n) return true
    for (const c of shuffle([...Array(n).keys()], r)) {
      if (used[c]) continue
      if (row > 0 && Math.abs(p[row - 1] - c) <= 1) continue
      used[c] = true; p[row] = c
      if (go(row + 1)) return true
      used[c] = false
    }
    return false
  })(0)
  return p
}

// Reviren växer ut från varje Happy. Vikterna gör vissa revir giriga och andra små.
export function growRegions(n, p, r) {
  const g = new Array(n * n).fill(-1)
  const fr = []
  for (let i = 0; i < n; i++) { g[i * n + p[i]] = i; fr.push([i * n + p[i]]) }
  const w = [...Array(n)].map(() => 0.2 + r() * r() * 3)
  let left = n * n - n
  while (left > 0) {
    let tot = 0
    for (let i = 0; i < n; i++) if (fr[i].length) tot += w[i]
    let x = r() * tot, k = 0
    for (; k < n; k++) { if (!fr[k].length) continue; x -= w[k]; if (x <= 0) break }
    if (k >= n) k = fr.findIndex((f) => f.length)
    const f = fr[k]
    const idx = Math.floor(r() * f.length)
    const cell = f[idx]
    const y = (cell / n) | 0, xx = cell % n
    const nb = []
    if (y > 0) nb.push(cell - n)
    if (y < n - 1) nb.push(cell + n)
    if (xx > 0) nb.push(cell - 1)
    if (xx < n - 1) nb.push(cell + 1)
    const free = nb.filter((c) => g[c] === -1)
    if (!free.length) { f.splice(idx, 1); continue }
    const c = free[Math.floor(r() * free.length)]
    g[c] = k; f.push(c); left--
  }
  return g
}

// Räknar lösningar upp till limit. out (valfri array) får den första lösningen.
export function countSolutions(n, g, limit = 2, out) {
  let cnt = 0
  const col = new Array(n).fill(false), reg = new Array(n).fill(false), p = []
  ;(function go(row) {
    if (cnt >= limit) return
    if (row === n) { cnt++; if (out && cnt === 1) out.push(...p); return }
    for (let c = 0; c < n; c++) {
      if (col[c]) continue
      if (row > 0 && Math.abs(p[row - 1] - c) <= 1) continue
      const rg = g[row * n + c]
      if (reg[rg]) continue
      col[c] = reg[rg] = true; p[row] = c
      go(row + 1)
      col[c] = reg[rg] = false
      if (cnt >= limit) return
    }
  })(0)
  return cnt
}

function connectedWithout(n, g, rg, skip) {
  let start = -1, total = 0
  for (let i = 0; i < n * n; i++) if (g[i] === rg && i !== skip) { total++; if (start < 0) start = i }
  if (total === 0) return false
  const seen = new Set([start]), st = [start]
  while (st.length) {
    const c = st.pop(), y = (c / n) | 0, x = c % n
    for (const d of [y > 0 ? c - n : -1, y < n - 1 ? c + n : -1, x > 0 ? c - 1 : -1, x < n - 1 ? c + 1 : -1]) {
      if (d < 0 || d === skip || seen.has(d) || g[d] !== rg) continue
      seen.add(d); st.push(d)
    }
  }
  return seen.size === total
}

function otherSolution(n, g, p) {
  let found = null
  const col = new Array(n).fill(false), reg = new Array(n).fill(false), q = []
  ;(function go(row) {
    if (found) return
    if (row === n) { if (q.some((c, i) => c !== p[i])) found = [...q]; return }
    for (let c = 0; c < n; c++) {
      if (col[c]) continue
      if (row > 0 && Math.abs(q[row - 1] - c) <= 1) continue
      const rg = g[row * n + c]
      if (reg[rg]) continue
      col[c] = reg[rg] = true; q[row] = c
      go(row + 1)
      col[c] = reg[rg] = false
      if (found) return
    }
  })(0)
  return found
}

// Så länge det finns en annan lösning: flytta en ruta från den lösningen till ett grannrevir
// (utan att något revir går sönder i två delar). Happy-rutorna flyttas aldrig.
function repair(n, g, p, r, maxSteps) {
  const cats = new Set(p.map((c, i) => i * n + c))
  for (let step = 0; step < maxSteps; step++) {
    const q = otherSolution(n, g, p)
    if (!q) return true
    const cand = shuffle(q.map((c, i) => i * n + c).filter((c) => !cats.has(c)), r)
    let moved = false
    for (const cell of cand) {
      const y = (cell / n) | 0, x = cell % n
      const nbr = shuffle(
        [y > 0 ? cell - n : -1, y < n - 1 ? cell + n : -1, x > 0 ? cell - 1 : -1, x < n - 1 ? cell + 1 : -1]
          .filter((d) => d >= 0 && g[d] !== g[cell]), r)
      if (!nbr.length) continue
      if (!connectedWithout(n, g, g[cell], cell)) continue
      g[cell] = g[nbr[0]]; moved = true; break
    }
    if (!moved) return false
  }
  return countSolutions(n, g) === 1
}

// Samma seed ger alltid samma bräde (Dagens revir seedas med datumet).
export function generate(n, seed) {
  const r = mulberry32(seed)
  for (;;) {
    const p = placeDogs(n, r)
    const g = growRegions(n, p, r)
    if (repair(n, g, p, r, n * n * 2)) return { n, regions: g, solution: p, seed }
  }
}

// Kontrollerar att en placering följer alla regler. solution[rad] = kolumn.
export function isValidSolution(n, regions, solution) {
  if (solution.length !== n) return false
  const cols = new Set(solution), regs = new Set(solution.map((c, y) => regions[y * n + c]))
  if (cols.size !== n || regs.size !== n) return false
  for (let y = 1; y < n; y++) if (Math.abs(solution[y] - solution[y - 1]) <= 1) return false
  return true
}
