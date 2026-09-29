// Trassel — spelmotorn.
// Ren logik utan DOM, så den går att testa i Node (frontend/tests/trassel.test.mjs).
//
// Varje färg har en linje: en lista med noder som börjar i en av färgens
// prickar. Man drar alltid från en prick eller från en befintlig linje.
//
// Under ett drag gäller Flow-reglerna:
//   - drar man tillbaka över sin egen linje blir den kortare
//   - drar man över en annan färg klipps den av, men bara tillfälligt: backar
//     man ut igen kommer den tillbaka. Först när man släpper blir klippet kvar.
//   - en linje kan inte gå in i en annan färgs prick
//   - när linjen når sin andra prick är den klar och kan bara backas
//
// Ett "drag" räknas som i Flow: varje gång man börjar dra en annan färg än
// förra gången. Perfekt = lika många drag som färger.

import { parseLevel, decodeSolution, DIR_BIT } from './board.js'

export function createGame(level) {
  const B = parseLevel(level)
  const K = B.colors
  let solution = null
  const sol = () => (solution ||= decodeSolution(B, level.s))

  let paths = Array.from({ length: K }, () => [])
  const hinted = new Uint8Array(K)
  let moves = 0
  let lastColor = -1
  let hints = 0
  const history = [] // ögonblicksbilder för ångra

  // Pågående drag
  let drag = null // { color, path, snap, startPaths }

  const isEnd = (v) => B.deg[v] === 1
  const endColor = (v) => B.nodeColor[v]

  function otherEnd(k, v) {
    const [a, b] = B.ends[k]
    return v === a ? b : a
  }

  function complete(k, ps = currentPaths()) {
    const p = ps[k]
    return p.length >= 2 && isEnd(p[0]) && isEnd(p[p.length - 1]) && p[0] !== p[p.length - 1]
  }

  // Linjerna som de ser ut just nu, inklusive ett pågående drag.
  function currentPaths() {
    if (!drag) return paths
    const inDrag = new Set(drag.path)
    return drag.snap.map((p, k) => {
      if (k === drag.color) return drag.path
      // Klipp andra färger vid första noden som dragets linje använder.
      const i = p.findIndex((v) => inDrag.has(v))
      return i < 0 ? p : p.slice(0, i)
    })
  }

  function ownerArray(ps = currentPaths()) {
    const own = new Int8Array(B.N).fill(-1)
    ps.forEach((p, k) => { for (const v of p) own[v] = k })
    return own
  }

  function neighborInDir(v, d) {
    for (const e of B.adj[v]) if (B.dirFrom(e, v) === d) return B.other(e, v)
    return -1
  }

  // Börja dra från nod v. Returnerar färgen, eller -1 om det inte går.
  function begin(v) {
    if (v < 0) return -1
    let k = -1
    let start
    if (isEnd(v)) {
      k = endColor(v)
      start = [v] // en prick börjar alltid om linjen
    } else {
      const own = ownerArray(paths)
      k = own[v]
      if (k < 0) return -1
      const p = paths[k]
      start = p.slice(0, p.indexOf(v) + 1)
    }
    drag = { color: k, path: start, snap: paths.map((p) => p.slice()), startPaths: paths.map((p) => p.slice()) }
    // Själva börjandet kan redan klippa (om linjen kortades), men inte andra färger.
    return k
  }

  // Ett steg till grannod v. Returnerar en händelse: null (inget hände),
  // 'grow', 'shrink', 'connect', 'cut' eller 'blocked'.
  function stepTo(v) {
    if (!drag || v < 0) return null
    const p = drag.path
    const head = p[p.length - 1]
    // Måste vara en granne i grafen.
    let adjacent = false
    for (const e of B.adj[head]) if (B.other(e, head) === v) { adjacent = true; break }
    if (!adjacent) return null

    const i = p.indexOf(v)
    if (i >= 0) {
      // Tillbaka över egen linje.
      drag.path = p.slice(0, i + 1)
      return 'shrink'
    }
    const k = drag.color
    if (isEnd(head) && p.length > 1) return 'blocked' // redan klar
    if (isEnd(v)) {
      if (endColor(v) !== k) return 'blocked'
      if (v === p[0]) return 'blocked'
      drag.path = p.concat([v])
      return 'connect'
    }
    // Kolla om vi klipper någon (utifrån hur det såg ut när draget började).
    const before = currentPaths()
    const cutsSomeone = before.some((q, j) => j !== k && q.includes(v))
    drag.path = p.concat([v])
    return cutsSomeone ? 'cut' : 'grow'
  }

  function stepDir(d) {
    if (!drag) return null
    const head = drag.path[drag.path.length - 1]
    return stepTo(neighborInDir(head, d))
  }

  // Släpp. Returnerar { changed, color, connected } där connected är sant om
  // färgen blev klar i det här draget.
  function end() {
    if (!drag) return { changed: false }
    // En linje som bara är en prick räknas som ingen linje.
    const next = currentPaths().map((p) => (p.length < 2 ? [] : p.slice()))
    const k = drag.color
    const wasComplete = complete(k, drag.startPaths)
    const changed = next.some((p, j) => p.length !== drag.startPaths[j].length || p.some((v, i) => v !== drag.startPaths[j][i]))
    if (changed) {
      history.push({ paths: drag.startPaths })
      if (history.length > 100) history.shift()
      if (k !== lastColor) moves++
      lastColor = k
      paths = next
    }
    drag = null
    return { changed, color: k, connected: changed && complete(k) && !wasComplete }
  }

  function cancel() {
    drag = null
  }

  function undo() {
    if (drag || !history.length) return false
    paths = history.pop().paths
    lastColor = -1
    return true
  }

  function reset() {
    drag = null
    if (paths.some((p) => p.length)) history.push({ paths })
    paths = Array.from({ length: K }, () => [])
    moves = 0
    lastColor = -1
  }

  // Samma nodlista oavsett riktning?
  const samePath = (a, b) => a.length === b.length && (a.every((v, i) => v === b[i]) || a.every((v, i) => v === b[b.length - 1 - i]))

  // Tips: rita en hel färg rätt. Tar i första hand en färg som inte är
  // påbörjad, annars en som är fel. Returnerar färgen eller -1.
  function hint() {
    if (drag) return -1
    const S = sol()
    const wrong = []
    for (let k = 0; k < K; k++) if (!samePath(paths[k], S[k])) wrong.push(k)
    if (!wrong.length) return -1
    // Hellre en färg som inte är påbörjad, sedan den kortaste (lättast att se).
    wrong.sort((a, b) => (paths[a].length > 1) - (paths[b].length > 1) || S[a].length - S[b].length)
    const k = wrong[0]
    history.push({ paths: paths.map((p) => p.slice()) })
    const used = new Set(S[k])
    paths = paths.map((p, j) => {
      if (j === k) return S[k].slice()
      const i = p.findIndex((v) => used.has(v))
      return i < 0 ? p : p.slice(0, i)
    })
    hinted[k] = 1
    hints++
    lastColor = -1
    return k
  }

  function status() {
    const ps = currentPaths()
    const own = ownerArray(ps)
    let filled = 0
    for (let v = 0; v < B.N; v++) if (own[v] >= 0 || isEnd(v)) filled++
    let connected = 0
    for (let k = 0; k < K; k++) if (complete(k, ps)) connected++
    const full = own.every((x) => x >= 0)
    return {
      connected,
      total: K,
      fillPct: Math.round((filled / B.N) * 100),
      full,
      won: connected === K && full,
      moves,
      hints,
      perfect: connected === K && full && moves === K && hints === 0,
    }
  }

  // Hur rutan ska ritas: vilka riktningar varje nod har kopplingar åt.
  function connections(ps = currentPaths()) {
    const mask = new Uint8Array(B.N)
    for (const p of ps) {
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], b = p[i]
        for (const e of B.adj[a]) {
          if (B.other(e, a) !== b) continue
          mask[a] |= DIR_BIT[B.dirFrom(e, a)]
          mask[b] |= DIR_BIT[B.dirFrom(e, b)]
          break
        }
      }
    }
    return mask
  }

  return {
    B, level, K,
    get paths() { return currentPaths() },
    get committed() { return paths },
    get dragging() { return drag ? drag.color : -1 },
    get head() { return drag ? drag.path[drag.path.length - 1] : -1 },
    get canUndo() { return !drag && history.length > 0 },
    hinted,
    begin, stepTo, stepDir, end, cancel, undo, reset, hint, status,
    owner: () => ownerArray(),
    connections,
    complete: (k) => complete(k),
    neighborInDir,
    otherEnd,
    solution: sol,
  }
}
