// Trassel — lösaren.
// Ren logik utan DOM. Används av generatorn (bevisa att en bana har exakt en
// lösning och mäta hur svår den är), av tipsen i spelet och av testerna.
//
// Varje kant i grafen är okänd, på eller av. Lösaren drar slutsatser tills den
// kör fast och gissar bara då (sätter en kant på, sedan av). Reglerna är samma
// som en människa använder:
//   - en ändpunkt har exakt en koppling, alla andra rutor exakt två
//   - två olika färger får aldrig kopplas ihop
//   - en linje får aldrig bita sig själv i svansen (ingen slinga)
//   - varje färg måste fortfarande kunna nå sin andra ändpunkt
//   - ingen ruta får bli kvar som ingen färg kan nå
// Med framåtblick (lookahead) provar den dessutom varje drag från ett
// linjehuvud: leder draget direkt till en motsägelse är det fel.
//
// Allt tillstånd ligger i platta arrayer och ändringar loggas i ett spår
// (trail), så att en gissning kan ångras utan att kopiera något.
//
// solve(board, { limit, maxNodes, lookahead, fixed }) -> {
//   count      antal lösningar som hittades (slutar räkna vid limit)
//   solution   kantstatus för den första lösningen (Uint8Array, 1 = på) eller null
//   solutions  alla hittade lösningar
//   nodes      antal gissningar som behövdes
//   rootFrac   andel kanter som enkla regler avgör utan att gissa
//   probeFrac  andel kanter som enkla regler + framåtblick avgör
//   aborted    true om maxNodes tog slut innan svaret var säkert
// }

const UNK = -1

export function solve(B, { limit = 2, maxNodes = 200000, fixed = null, lookahead = true, probeDepth = 1e9, probePasses = 60 } = {}) {
  const { N, E, edgeA, edgeB, adj, deg, colors, ends } = B
  const es = new Int8Array(E).fill(UNK)
  const on = new Uint8Array(N)
  const unk = new Uint8Array(N)
  const parent = new Int32Array(N)
  const size = new Int32Array(N)
  const ccol = new Int8Array(N)
  for (let v = 0; v < N; v++) {
    unk[v] = adj[v].length
    parent[v] = v
    size[v] = 1
    ccol[v] = B.nodeColor[v]
  }

  // Spåret: [typ, a, b, c] per post. typ 0 = kant satt, 1 = sammanslagning.
  const cap = (E + N) * 4 + 16
  const tr = new Int32Array(cap * 4)
  let tp = 0
  let dirty = true

  const find = (v) => { while (parent[v] !== v) v = parent[v]; return v }

  function setEdge(e, val, queue) {
    const cur = es[e]
    if (cur !== UNK) return cur === val
    es[e] = val
    tr[tp++] = 0; tr[tp++] = e; tr[tp++] = 0; tr[tp++] = 0
    const a = edgeA[e], b = edgeB[e]
    unk[a]--; unk[b]--
    queue.push(a, b)
    if (val === 1) {
      on[a]++; on[b]++
      let ra = find(a), rb = find(b)
      if (ra === rb) return false // slinga
      const ca = ccol[ra], cb = ccol[rb]
      if (ca >= 0 && cb >= 0 && ca !== cb) return false // två färger möts
      if (size[ra] > size[rb]) { const t = ra; ra = rb; rb = t }
      tr[tp++] = 1; tr[tp++] = ra; tr[tp++] = rb; tr[tp++] = ccol[rb]
      parent[ra] = rb
      size[rb] += size[ra]
      if (ccol[rb] < 0) ccol[rb] = ccol[ra]
      dirty = true
    }
    return true
  }

  function undo(mark) {
    while (tp > mark) {
      tp -= 4
      if (tr[tp] === 0) {
        const e = tr[tp + 1]
        const a = edgeA[e], b = edgeB[e]
        if (es[e] === 1) { on[a]--; on[b]-- }
        unk[a]++; unk[b]++
        es[e] = UNK
      } else {
        const ra = tr[tp + 1], rb = tr[tp + 2]
        parent[ra] = ra
        size[rb] -= size[ra]
        ccol[rb] = tr[tp + 3]
      }
    }
  }

  // Drar alla slutsatser som går. false = motsägelse.
  function propagate(queue) {
    for (;;) {
      while (queue.length) {
        const v = queue.pop()
        const need = deg[v] - on[v]
        const u = unk[v]
        if (need < 0 || need > u) return false
        if (u === 0) continue
        if (need === 0 || need === u) {
          const val = need === 0 ? 0 : 1
          for (const e of adj[v]) {
            if (es[e] === UNK && !setEdge(e, val, queue)) return false
          }
        }
      }
      if (!dirty) break
      dirty = false
      // Kanter som skulle skapa en slinga eller koppla ihop två färger stängs.
      for (let e = 0; e < E; e++) {
        if (es[e] !== UNK) continue
        const ra = find(edgeA[e]), rb = find(edgeB[e])
        if (ra === rb || (ccol[ra] >= 0 && ccol[rb] >= 0 && ccol[ra] !== ccol[rb])) {
          if (!setEdge(e, 0, queue)) return false
        }
      }
      if (!queue.length) break
    }
    return reachable()
  }

  // Varje ofärdig färg måste kunna nå sin andra ände, och varje ruta utan färg
  // måste kunna nås av någon färg. Räknar generöst (en övre gräns), så den
  // underkänner aldrig ett läge som faktiskt går att lösa.
  //
  // Görs i ett svep: märk upp de fria områdena (sammanhängande rutor utan färg)
  // och notera vilka linjeändar varje område gränsar till. En färg når sin
  // andra ände om ett område gränsar till båda dess halvor, eller om halvorna
  // ligger direkt bredvid varandra.
  const rootOf = new Int32Array(N)
  const rootCol = new Int8Array(N)
  const region = new Int32Array(N)
  const regionMask = new Int32Array(N + 1)
  const directOk = new Uint8Array(Math.max(1, colors))
  const endRoot = new Int32Array(Math.max(1, colors) * 2)
  const stack = new Int32Array(N + 1)
  function reachable() {
    for (let v = 0; v < N; v++) {
      const r = find(v)
      rootOf[v] = r
      rootCol[v] = ccol[r]
      region[v] = -1
    }
    let incompleteBits = 0
    for (let k = 0; k < colors; k++) {
      const ra = rootOf[ends[k][0]], rb = rootOf[ends[k][1]]
      endRoot[k * 2] = ra
      endRoot[k * 2 + 1] = rb
      directOk[k] = 0
      if (ra !== rb) incompleteBits |= 3 << (k * 2)
    }
    // Fria områden
    let nReg = 0
    for (let s = 0; s < N; s++) {
      if (rootCol[s] >= 0 || region[s] >= 0) continue
      const id = nReg++
      regionMask[id] = 0
      region[s] = id
      let sp = 0
      stack[sp++] = s
      while (sp) {
        const v = stack[--sp]
        for (const e of adj[v]) {
          if (es[e] === 0) continue
          const o = edgeA[e] === v ? edgeB[e] : edgeA[e]
          if (rootCol[o] >= 0 || region[o] >= 0) continue
          region[o] = id
          stack[sp++] = o
        }
      }
    }
    // Vilka linjeändar gränsar varje område till?
    for (let e = 0; e < E; e++) {
      if (es[e] === 0) continue
      const a = edgeA[e], b = edgeB[e]
      const ca = rootCol[a], cb = rootCol[b]
      if (ca < 0 && cb >= 0) {
        regionMask[region[a]] |= 1 << (cb * 2 + (rootOf[b] === endRoot[cb * 2] ? 0 : 1))
      } else if (cb < 0 && ca >= 0) {
        regionMask[region[b]] |= 1 << (ca * 2 + (rootOf[a] === endRoot[ca * 2] ? 0 : 1))
      } else if (ca >= 0 && ca === cb && rootOf[a] !== rootOf[b]) {
        directOk[ca] = 1
      }
    }
    // Varje område måste nås av någon ofärdig färg.
    let bothSides = 0
    for (let i = 0; i < nReg; i++) {
      const m = regionMask[i]
      if (!(m & incompleteBits)) return false
      // Bitpar där båda bitarna är satta: området förbinder färgens två halvor.
      bothSides |= m & (m >>> 1) & 0x55555555
    }
    for (let k = 0; k < colors; k++) {
      if (!(incompleteBits & (1 << (k * 2)))) continue
      if (!directOk[k] && !(bothSides & (1 << (k * 2)))) return false
    }
    return true
  }

  // Framåtblick från linjehuvuden: prova varje okänd kant vid en färgad ruta
  // som fortfarande behöver en koppling. Leder ett val direkt till en
  // motsägelse sätts det motsatta. Returnerar false vid motsägelse.
  function probe(res, passes = 60) {
    for (let pass = 0; pass < passes; pass++) {
      let progress = false
      for (let v = 0; v < N; v++) {
        if (unk[v] === 0 || deg[v] - on[v] <= 0) continue
        if (ccol[find(v)] < 0) continue
        for (const e of adj[v]) {
          if (es[e] !== UNK) continue
          for (const val of [1, 0]) {
            const mark = tp
            if (res) res.probes++
            const q = []
            const ok = setEdge(e, val, q) && propagate(q)
            undo(mark)
            dirty = true // propagate kan ha avbrutits mitt i; låt nästa runda skanna igen
            if (ok) continue
            const q2 = []
            if (!setEdge(e, 1 - val, q2) || !propagate(q2)) return false
            progress = true
            break
          }
        }
      }
      if (!progress) break
    }
    return true
  }

  const res = { count: 0, solution: null, solutions: [], nodes: 0, rootFrac: 0, probeFrac: 0, probes: 0, aborted: false }
  const countKnown = () => { let k = 0; for (let e = 0; e < E; e++) if (es[e] !== UNK) k++; return k }

  const queue = []
  for (let v = 0; v < N; v++) queue.push(v)
  if (fixed) {
    for (const [e, val] of fixed) if (!setEdge(e, val, queue)) return res
  }
  if (!propagate(queue)) return res
  res.rootFrac = E ? countKnown() / E : 1
  if (lookahead && !probe(res)) return res
  res.probeFrac = E ? countKnown() / E : 1

  function pickEdge() {
    // Hellre en kant vid ett linjehuvud (färg känd) med få val kvar.
    let best = -1, bestScore = 1e9
    for (let v = 0; v < N; v++) {
      const u = unk[v]
      if (u === 0) continue
      if (deg[v] - on[v] <= 0) continue
      const score = u * 2 + (ccol[find(v)] >= 0 ? 0 : 3)
      if (score < bestScore) {
        bestScore = score
        best = v
        if (score <= 2) break
      }
    }
    if (best < 0) return -1
    for (const e of adj[best]) if (es[e] === UNK) return e
    return -1
  }

  function rec(depth) {
    const e = pickEdge()
    if (e < 0) {
      res.count++
      const sol = Uint8Array.from(es, (x) => (x === 1 ? 1 : 0))
      if (!res.solution) res.solution = sol
      res.solutions.push(sol)
      return
    }
    if (++res.nodes > maxNodes) { res.aborted = true; return }
    for (const val of [1, 0]) {
      const mark = tp
      const q = []
      if (setEdge(e, val, q) && propagate(q) && (!lookahead || depth >= probeDepth || probe(null, probePasses))) rec(depth + 1)
      undo(mark)
      dirty = true
      if (res.count >= limit || res.aborted) return
    }
  }
  rec(0)
  return res
}

// Svårighetstal för sorteringen. Högre = svårare.
// Bygger på hur mycket som gick att räkna ut med enkla regler, hur mycket som
// krävde framåtblick, hur många gissningar som behövdes och hur långa
// linjerna är i snitt. res ska komma från solve med lookahead påslaget.
export function difficulty(B, res) {
  const cells = B.N
  const avgLen = cells / Math.max(1, B.colors)
  return Math.round(
    (1 - res.rootFrac) * 30 +
    (1 - res.probeFrac) * 40 +
    Math.log2(1 + res.nodes) * 10 +
    avgLen * 1.5 +
    Math.sqrt(cells) * 2
  )
}
