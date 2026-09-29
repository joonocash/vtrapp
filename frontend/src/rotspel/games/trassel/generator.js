// Trassel — bangeneratorn.
// Ren logik utan DOM. Körs av skriptet frontend/tests/trassel-banor.gen.mjs,
// som skriver banorna till JSON. Spelet själv genererar aldrig något, det
// läser bara JSON-filerna — så telefonen slipper allt räknande.
//
// Så går det till:
//   1. Lägg ut stenar, broar, väggar och portaler slumpvis.
//   2. Fyll hela brädet med linjer: börja med en linje per ruta och slå ihop
//      eller koppla om dem slumpvis tills antalet färger är nära målet (cover).
//   3. Linjernas ändar blir prickarna.
//   4. Låt lösaren leta efter en ANNAN lösning. Finns det en, dela en linje
//      där lösningarna skiljer sig och försök igen, tills banan är unik.
//   5. Slå sedan ihop linjer ände mot ände, en i taget, och behåll bara de
//      hopslagningar där banan fortfarande har exakt en lösning. Färre färger
//      ger längre linjer och svårare banor.

import { buildBoard, encodeSolution, BLOCK, BRIDGE, END, EMPTY } from './board.js'
import { solve, difficulty } from './solver.js'
import { shuffle, randInt } from './rng.js'

const LETTERS = 'abcdefghijklmnop'

// opts:
//   w, h                  storlek
//   colors: [min, max]    antal färger
//   blocks, bridges, walls, warpRows, warpCols   antal av varje hinder (tal eller [min, max])
//   touch                 0–1, hur gärna en linje får löpa tätt intill sig själv
//   mergeTries            misslyckade hopslagningar i rad innan generatorn ger upp
//   headroom              hur många färger under målet täckningen börjar
//   solver                inställningar till solve() för unikhetskollen
//   maxNodes              gräns för lösaren per försök
//   minRoot               kräv att minst så här stor andel av banan inte går att
//                         lösa med enkla regler + framåtblick (0–1)
//   minD                  lägsta svårighetstal
//   tries                 antal försök innan null
//   stats                 valfritt objekt som räknar varför försöken misslyckas (för finjustering)
export function generate(opts, r) {
  // Stora bräden: framåtblick i unikhetskollen (annars kör lösaren fast),
  // färre hopslagningsförsök och mer marginal för delningar.
  const big = opts.w * opts.h >= 100
  const o = {
    touch: 0.02,
    mergeTries: big ? 8 : 24,
    headroom: big ? 2 : 1,
    solver: big ? { lookahead: true, probePasses: 1 } : { lookahead: false },
    // Unika banor bevisas oftast på några hundra gissningar. Ett försök som
    // behöver fler kastas hellre direkt än att bränna minuter på det.
    maxNodes: big ? 3000 : 20000,
    tries: 60,
    minRoot: 0,
    minD: 0,
    ...opts,
  }
  for (let t = 0; t < o.tries; t++) {
    const lv = attempt(o, r)
    if (lv) return lv
  }
  return null
}

const pickCount = (v, r) => (Array.isArray(v) ? randInt(r, v[0], v[1]) : v || 0)

function attempt(o, r) {
  const why = (k) => { if (o.stats) o.stats[k] = (o.stats[k] || 0) + 1; return null }
  const { w, h } = o
  const n = w * h
  const kind = new Uint8Array(n)
  const walls = new Uint8Array(n)

  const warpRows = shuffle([...Array(h).keys()], r).slice(0, pickCount(o.warpRows, r)).sort((a, b) => a - b)
  const warpCols = shuffle([...Array(w).keys()], r).slice(0, pickCount(o.warpCols, r)).sort((a, b) => a - b)

  // Hinder: stenar
  const nBlocks = pickCount(o.blocks, r)
  if (nBlocks) {
    const cells = shuffle([...Array(n).keys()], r)
    let placed = 0
    for (const c of cells) {
      if (placed >= nBlocks) break
      kind[c] = BLOCK
      if (!connected(w, h, kind, walls, warpRows, warpCols)) { kind[c] = EMPTY; continue }
      placed++
    }
  }

  // Broar: alla fyra grannar måste finnas och vara vanliga rutor, och två
  // broar får inte dela granne.
  const nBridges = pickCount(o.bridges, r)
  if (nBridges) {
    const probe = buildBoard({ w, h, kind, endColor: new Int8Array(n).fill(-1), colors: 0, walls, warpRows, warpCols })
    const bridges = []
    for (const c of shuffle([...Array(n).keys()], r)) {
      if (bridges.length >= nBridges) break
      if (kind[c] !== EMPTY) continue
      let ok = true
      for (let d = 0; d < 4 && ok; d++) {
        const nc = probe.step(c, d)
        if (nc < 0 || kind[nc] !== EMPTY) ok = false
      }
      for (const b of bridges) {
        const dx = Math.abs((b % w) - (c % w)), dy = Math.abs(((b / w) | 0) - ((c / w) | 0))
        const ddx = Math.min(dx, w - dx), ddy = Math.min(dy, h - dy)
        if (ddx + ddy <= 2) ok = false
      }
      if (ok) { kind[c] = BRIDGE; bridges.push(c) }
    }
    if (bridges.length < nBridges) return why('bridges')
  }

  // Tunna väggar mellan två vanliga rutor
  const nWalls = pickCount(o.walls, r)
  if (nWalls) {
    const cand = []
    for (let c = 0; c < n; c++) {
      const x = c % w, y = (c / w) | 0
      if (kind[c] !== EMPTY) continue
      if (x < w - 1 && kind[c + 1] === EMPTY) cand.push(c * 2)
      if (y < h - 1 && kind[c + w] === EMPTY) cand.push(c * 2 + 1)
    }
    let placed = 0
    for (const v of shuffle(cand, r)) {
      if (placed >= nWalls) break
      const c = v >> 1, bit = v & 1 ? 2 : 1
      walls[c] |= bit
      if (!connected(w, h, kind, walls, warpRows, warpCols)) { walls[c] &= ~bit; continue }
      placed++
    }
  }

  const base = buildBoard({ w, h, kind, endColor: new Int8Array(n).fill(-1), colors: 0, walls, warpRows, warpCols })
  // En vanlig ruta med färre än två möjliga grannar måste bli ändpunkt; det
  // tillåter vi, men en med noll grannar går aldrig.
  for (let v = 0; v < base.N; v++) if (base.adj[v].length === 0) return why('isolated')

  const target = randInt(r, o.colors[0], o.colors[1])
  // Täckningen siktar lite lägre än målet: delningarna som gör banan unik
  // lägger till färger.
  let paths = cover(base, Math.max(2, target - o.headroom), o, r)
  if (!paths) return why('cover')
  if (paths.some((p) => p.length < 3)) return why('short')

  const check = (ps) => {
    const built = toLevel(base, ps, kind, walls, warpRows, warpCols)
    const res = solve(built.B, { limit: 2, maxNodes: o.maxNodes, ...o.solver })
    return { built, res }
  }

  // Steg 1: gör banan unik genom att dela linjer där lösningarna skiljer sig.
  let cur = null
  for (let rep = 0; rep < 12; rep++) {
    // Så många delningar att hopslagningen knappast tar oss tillbaka: ge upp.
    if (paths.length > o.colors[1] + 3 || paths.length > LETTERS.length) return why('too-many')
    const c = check(paths)
    if (c.res.aborted) return why('aborted')
    if (c.res.count === 0) {
      const err = new Error('Generatorn gjorde en bana utan lösning — bugg')
      err.level = c.built.level
      throw err
    }
    if (c.res.count === 1) { cur = c; break }
    const other = c.res.solutions.find((s) => s.some((v, i) => v !== c.built.on[i]))
    const split = splitWhereDifferent(c.built.B, paths, c.built.on, other, r)
    if (!split) return why('no-split')
    paths = split
  }
  if (!cur) return why('repairs')

  // Steg 2: slå ihop linjer ände mot ände så länge banan förblir unik.
  // Färre färger = längre linjer = svårare.
  const maxLen = o.maxLen || Math.max(8, Math.ceil((base.N / target) * 2.4))
  let failedInRow = 0
  while (paths.length > target && failedInRow < o.mergeTries) {
    const cands = mergeCandidates(base, paths, maxLen, r, o.touch)
    if (!cands.length) break
    let merged = false
    for (const [pi, qi, flipP, flipQ] of cands.slice(0, 6)) {
      const P = flipP ? paths[pi].slice().reverse() : paths[pi]
      const Q = flipQ ? paths[qi].slice().reverse() : paths[qi]
      const next = paths.filter((_, i) => i !== pi && i !== qi)
      next.push(P.concat(Q))
      const c = check(next)
      if (c.res.count === 1 && !c.res.aborted) {
        paths = next
        cur = c
        merged = true
        failedInRow = 0
        break
      }
      failedInRow++
      if (failedInRow >= o.mergeTries) break
    }
    if (!merged && failedInRow >= o.mergeTries) break
  }

  if (paths.length > o.colors[1]) return why('too-many')
  if (paths.length < o.colors[0]) return why('too-few')
  const { built } = cur
  // Svårigheten mäts med framåtblick påslagen, som en människa skulle tänka.
  // Full framåtblick i roten, ett varv per gissning därunder (annars blir stora bräden dyra).
  const res = solve(built.B, { limit: 1, maxNodes: o.maxNodes, probePasses: 1 })
  if (1 - res.probeFrac < o.minRoot) return why('too-easy')
  built.level.d = difficulty(built.B, res)
  if (o.minD && built.level.d < o.minD) return why('too-easy')
  return built.level
}

// Par av linjer vars ändar ligger bredvid varandra. [p, q, vändP, vändQ] där
// P (ev. vänd) slutar i rutan bredvid där Q (ev. vänd) börjar.
function mergeCandidates(B, paths, maxLen, r, touch) {
  const endOf = new Map() // nod -> [pathIndex, 0 = början, 1 = slutet]
  paths.forEach((p, i) => {
    endOf.set(p[0], [i, 0])
    endOf.set(p[p.length - 1], [i, 1])
  })
  const pathOf = new Int32Array(B.N)
  paths.forEach((p, i) => { for (const v of p) pathOf[v] = i })
  const out = []
  for (const [v, [pi, sideP]] of endOf) {
    for (const e of B.adj[v]) {
      const u = B.other(e, v)
      const hit = endOf.get(u)
      if (!hit) continue
      const [qi, sideQ] = hit
      if (qi <= pi) continue
      const len = paths[pi].length + paths[qi].length
      if (len > maxLen) continue
      const pFar = sideP === 0 ? paths[pi][paths[pi].length - 1] : paths[pi][0]
      const qFar = sideQ === 0 ? paths[qi][paths[qi].length - 1] : paths[qi][0]
      if (B.adj[pFar].some((e2) => B.other(e2, pFar) === qFar)) continue
      // Löper den nya linjen tätt intill sig själv? Då blir banan oftare tvetydig.
      let t = 0
      for (const x of paths[pi]) {
        for (const e2 of B.adj[x]) {
          const y = B.other(e2, x)
          if (pathOf[y] === qi && !(x === v && y === u)) t++
        }
      }
      if (t && r() > touch) continue
      // P ska sluta i v och Q börja i u.
      out.push([pi, qi, sideP === 0, sideQ === 1, len + t * 4 + r() * 6])
    }
  }
  // Korta linjer först, så längderna blir jämna.
  out.sort((a, b) => a[4] - b[4])
  return out
}

// Hänger alla vanliga rutor ihop?
function connected(w, h, kind, walls, warpRows, warpCols) {
  const B = buildBoard({ w, h, kind, endColor: new Int8Array(w * h).fill(-1), colors: 0, walls, warpRows, warpCols })
  if (B.N === 0) return false
  const seen = new Uint8Array(B.N)
  const stack = [0]
  seen[0] = 1
  let count = 1
  while (stack.length) {
    const v = stack.pop()
    for (const e of B.adj[v]) {
      const u = B.other(e, v)
      if (!seen[u]) { seen[u] = 1; count++; stack.push(u) }
    }
  }
  // Broarnas två filer räknas separat; de hänger ihop via grannarna.
  return count === B.N
}

// Fyller grafen med linjer (en lista med noder per linje, från ände till ände).
//
// En slumpvandring över linjetäckningar. Varje linje hålls "ren": den får
// aldrig ha två rutor bredvid varandra som inte följer direkt på varandra i
// linjen. En sådan linje kan inte genas, och det är den vanligaste orsaken
// till att en bana får flera lösningar. Två drag:
//   slå ihop   en linjes ände ligger bredvid en annan linjes ände
//   koppla om  en linjes ände ligger bredvid mitten av en annan linje: klipp
//              den andra linjen där och ta över ena halvan
// Sammanslagningar minskar antalet linjer, omkopplingar rör om så att nya
// sammanslagningar blir möjliga.
function cover(B, target, o, r) {
  const N = B.N
  const paths = new Map()
  const pid = new Int32Array(N)
  let nextId = 0
  const put = (arr) => {
    const id = nextId++
    paths.set(id, arr)
    for (const v of arr) pid[v] = id
    return id
  }
  for (let v = 0; v < N; v++) put([v])

  const stamp = new Int32Array(N)
  let st = 0
  // Är linjen ren (inga rutor bredvid varandra utom grannarna i linjen)?
  const clean = (arr) => {
    st++
    for (const v of arr) stamp[v] = st
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i]
      for (const e of B.adj[v]) {
        const y = B.other(e, v)
        if (stamp[y] !== st) continue
        if (y === arr[i - 1] || y === arr[i + 1]) continue
        return false
      }
    }
    return true
  }
  const orientEndLast = (arr, v) => (arr[arr.length - 1] === v ? arr : arr.slice().reverse())
  const isEnd = (v) => {
    const a = paths.get(pid[v])
    return a[0] === v || a[a.length - 1] === v
  }

  // Broarnas filer har bara två grannar och måste ligga mitt i en linje.
  for (let v = 0; v < N; v++) {
    if (B.nodeLane[v] === 0) continue
    const [e1, e2] = B.adj[v]
    const u1 = B.other(e1, v), u2 = B.other(e2, v)
    if (pid[u1] === pid[u2] || !isEnd(u1) || !isEnd(u2)) return null
    const A = orientEndLast(paths.get(pid[u1]), u1)
    const C = orientEndLast(paths.get(pid[u2]), u2).slice().reverse()
    paths.delete(pid[u1]); paths.delete(pid[u2]); paths.delete(pid[v])
    put(A.concat([v], C))
  }

  const maxLen = o.maxLen || Math.max(6, Math.ceil((N / Math.max(1, target)) * 2.2))
  const maxIter = o.coverIter || N * 300
  const ids = () => [...paths.keys()]
  for (let iter = 0; iter < maxIter; iter++) {
    const all = ids()
    const shorts = all.filter((id) => paths.get(id).length < 3)
    if (all.length <= target && !shorts.length) break
    // Välj en linje: helst en kort.
    let id
    if (shorts.length) id = shorts[Math.floor(r() * shorts.length)]
    else {
      id = all[Math.floor(r() * all.length)]
      for (let k = 0; k < 2; k++) {
        const j = all[Math.floor(r() * all.length)]
        if (paths.get(j).length < paths.get(id).length) id = j
      }
    }
    const P0 = paths.get(id)
    const p = r() < 0.5 ? P0[0] : P0[P0.length - 1]
    if (B.nodeLane[p] !== 0) continue
    const nb = B.adj[p]
    const x = B.other(nb[Math.floor(r() * nb.length)], p)
    if (pid[x] === id) continue
    const P = orientEndLast(P0, p)
    const qid = pid[x]
    const Q = paths.get(qid)
    const needFewer = all.length > target || P.length < 3 || Q.length < 3

    if (isEnd(x)) {
      if (!needFewer) continue
      const C = P.concat(orientEndLast(Q, x).slice().reverse())
      if (C.length > maxLen) continue
      if (!clean(C) && r() > o.touch) continue
      paths.delete(id); paths.delete(qid)
      put(C)
      continue
    }
    // x ligger mitt i Q: klipp Q vid x och ta över ena halvan.
    if (B.nodeLane[x] !== 0) continue
    const i = Q.indexOf(x)
    const keepForward = r() < 0.5
    const R = keepForward ? Q.slice(i) : Q.slice(0, i + 1).reverse()
    const rest = keepForward ? Q.slice(0, i) : Q.slice(i + 1)
    // Den nya änden på den avklippta delen får inte vara en bro-fil.
    const restEnd = keepForward ? rest[rest.length - 1] : rest[0]
    if (B.nodeLane[restEnd] !== 0) continue
    const C = P.concat(R)
    if (C.length > maxLen) continue
    // Byt bara om det inte gör en redan kort linje ännu kortare.
    if (rest.length < 3 && P.length >= 3 && r() < 0.7) continue
    if (!clean(C) && r() > o.touch) continue
    paths.delete(id); paths.delete(qid)
    put(C); put(rest)
  }

  const out = [...paths.values()]
  for (const p of out) {
    if (B.nodeLane[p[0]] !== 0 || B.nodeLane[p[p.length - 1]] !== 0) return null // bro som ände går inte
  }
  return out
}

// Bygger banobjektet (JSON-formatet) och brädet med prickar.
function toLevel(base, paths, kind, walls, warpRows, warpCols) {
  const { w, h, n } = base
  // Färgerna i läsordning, så små banor alltid får de tydligaste färgerna.
  const order = paths
    .map((p, i) => ({ i, first: Math.min(base.nodeCell[p[0]], base.nodeCell[p[p.length - 1]]) }))
    .sort((a, b) => a.first - b.first)
  const k2 = new Int8Array(n).fill(-1)
  const kind2 = kind.slice()
  order.forEach(({ i }, color) => {
    const p = paths[i]
    for (const v of [p[0], p[p.length - 1]]) {
      const c = base.nodeCell[v]
      kind2[c] = END
      k2[c] = color
    }
  })
  if (paths.length > LETTERS.length) throw new Error(`för många färger (${paths.length})`)
  const B = buildBoard({ w, h, kind: kind2, endColor: k2, colors: paths.length, walls, warpRows, warpCols })
  // Samma noder som base, eftersom noderna numreras per ruta på samma sätt.
  const on = new Uint8Array(B.E)
  for (const p of paths) {
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i]
      for (const e of B.adj[a]) if (B.other(e, a) === b) { on[e] = 1; break }
    }
  }
  let g = ''
  for (let c = 0; c < n; c++) {
    g += kind2[c] === BLOCK ? '#' : kind2[c] === BRIDGE ? '+' : kind2[c] === END ? LETTERS[k2[c]] : '.'
  }
  const level = { w, h, g }
  const wl = []
  for (let c = 0; c < n; c++) {
    if (walls[c] & 1) wl.push(c * 2)
    if (walls[c] & 2) wl.push(c * 2 + 1)
  }
  if (wl.length) level.wl = wl
  if (warpRows.length) level.wr = [...warpRows]
  if (warpCols.length) level.wc = [...warpCols]
  level.s = encodeSolution(B, on)
  return { level, B, on }
}

// Delar en linje på ett ställe där två lösningar skiljer sig.
function splitWhereDifferent(B, paths, mine, other, r) {
  if (!other) return null
  const diff = new Uint8Array(B.N)
  for (let e = 0; e < B.E; e++) {
    if (mine[e] !== other[e]) { diff[B.edgeA[e]] = 1; diff[B.edgeB[e]] = 1 }
  }
  const cands = []
  paths.forEach((p, pi) => {
    for (let i = 2; i < p.length - 3; i++) {
      // Dela mellan p[i] och p[i+1]. Ingen del får bli kortare än 3,
      // och ingen bro-fil får bli ände.
      if (!diff[p[i]] && !diff[p[i + 1]]) continue
      if (B.nodeLane[p[i]] !== 0 || B.nodeLane[p[i + 1]] !== 0) continue
      const mid = Math.abs(i + 0.5 - p.length / 2) / p.length
      cands.push([pi, i, mid + r() * 0.3])
    }
  })
  if (!cands.length) return null
  cands.sort((a, b) => a[2] - b[2])
  const [pi, i] = cands[0]
  const p = paths[pi]
  const out = paths.slice()
  out.splice(pi, 1, p.slice(0, i + 1), p.slice(i + 1))
  return out
}
