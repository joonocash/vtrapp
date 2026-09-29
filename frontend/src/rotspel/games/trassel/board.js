// Trassel — brädmodellen.
// Ren logik utan DOM, delas av generatorn, lösaren, spelmotorn och ritlagret.
//
// Ett bräde är ett rutnät där varje ruta är en eller två noder i en graf:
//   vanlig ruta   en nod
//   ändpunkt      en nod som ska ha exakt en koppling
//   bro           två noder: en vågrät fil och en lodrät fil som korsar varandra
//   sten          ingen nod alls
// Tunna väggar tar bort kanten mellan två rutor. Portalrader och portalkolumner
// kopplar ihop ytterkanterna, så en linje som går ut till höger kommer in till vänster.
//
// Med allt uttryckt som en graf behöver lösaren och spelmotorn inte veta
// något om broar eller portaler — de ser bara noder och kanter.
//
// Banformatet (det som ligger i JSON-filerna):
//   w, h   bredd och höjd
//   g      en tecken per ruta, radvis: '.' tom, '#' sten, '+' bro, 'a'–'n' ändpunkt i färg 0–13
//   wl     tunna väggar som tal: ruta*2 + 0 (vägg till höger om rutan) eller + 1 (vägg under)
//   wr     portalrader (index), wc  portalkolumner (index)
//   s      lösningen: ett hex-tecken per ruta med riktningarna den kopplar åt
//          (1 höger, 2 ner, 4 vänster, 8 upp). Broar och stenar har '0'.
//   d      svårighetstal från lösaren, bara för sorteringen

export const DX = [1, 0, -1, 0]
export const DY = [0, 1, 0, -1]
export const OPP = [2, 3, 0, 1]
export const DIR_BIT = [1, 2, 4, 8]

export const EMPTY = 0
export const BLOCK = 1
export const BRIDGE = 2
export const END = 3

const A = 'a'.charCodeAt(0)

export function parseLevel(lv) {
  const { w, h } = lv
  const n = w * h
  const kind = new Uint8Array(n)
  const endColor = new Int8Array(n).fill(-1)
  let colors = 0
  for (let i = 0; i < n; i++) {
    const ch = lv.g[i]
    if (ch === '#') kind[i] = BLOCK
    else if (ch === '+') kind[i] = BRIDGE
    else if (ch === '.') kind[i] = EMPTY
    else {
      kind[i] = END
      endColor[i] = ch.charCodeAt(0) - A
      colors = Math.max(colors, endColor[i] + 1)
    }
  }
  const walls = new Uint8Array(n) // bit 1 = vägg höger, bit 2 = vägg under
  for (const v of lv.wl || []) walls[v >> 1] |= v & 1 ? 2 : 1
  return buildBoard({ w, h, kind, endColor, colors, walls, warpRows: lv.wr || [], warpCols: lv.wc || [] })
}

// Bygger grafen. Används både av parseLevel och direkt av generatorn.
export function buildBoard({ w, h, kind, endColor, colors, walls, warpRows = [], warpCols = [] }) {
  const n = w * h
  const wr = new Uint8Array(h)
  const wc = new Uint8Array(w)
  for (const r of warpRows) wr[r] = 1
  for (const c of warpCols) wc[c] = 1

  // Noder: vanlig ruta och ändpunkt får en nod, bro får två (vågrät först).
  const nodeH = new Int32Array(n).fill(-1) // nod för vågrät rörelse genom rutan
  const nodeV = new Int32Array(n).fill(-1) // nod för lodrät rörelse
  const nodeCell = []
  const nodeLane = [] // 0 hel ruta, 1 vågrät bro-fil, 2 lodrät bro-fil
  for (let c = 0; c < n; c++) {
    if (kind[c] === BLOCK) continue
    if (kind[c] === BRIDGE) {
      nodeH[c] = nodeCell.length; nodeCell.push(c); nodeLane.push(1)
      nodeV[c] = nodeCell.length; nodeCell.push(c); nodeLane.push(2)
    } else {
      nodeH[c] = nodeV[c] = nodeCell.length; nodeCell.push(c); nodeLane.push(0)
    }
  }
  const N = nodeCell.length

  // Grannruta i en riktning, med portaler, väggar och stenar. -1 om det inte går.
  function step(c, d) {
    const x = c % w, y = (c / w) | 0
    let nx = x + DX[d], ny = y + DY[d]
    if (nx < 0 || nx >= w) {
      if (!wr[y]) return -1
      nx = (nx + w) % w
    }
    if (ny < 0 || ny >= h) {
      if (!wc[x]) return -1
      ny = (ny + h) % h
    }
    const nc = ny * w + nx
    if (kind[nc] === BLOCK) return -1
    // Tunna väggar gäller bara mellan grannar inne på brädet, inte genom portaler.
    if (d === 0 && x < w - 1 && walls[c] & 1) return -1
    if (d === 2 && x > 0 && walls[nc] & 1) return -1
    if (d === 1 && y < h - 1 && walls[c] & 2) return -1
    if (d === 3 && y > 0 && walls[nc] & 2) return -1
    return nc
  }
  const nodeAt = (c, d) => (d % 2 === 0 ? nodeH[c] : nodeV[c])

  // Kanter. En kant per nodpar, lagrad med riktningen från a.
  const edgeA = [], edgeB = [], edgeDir = []
  const adj = Array.from({ length: N }, () => [])
  const edgeKey = new Map()
  for (let c = 0; c < n; c++) {
    if (kind[c] === BLOCK) continue
    for (let d = 0; d < 4; d++) {
      // nodeAt väljer filen efter riktningen, så en bro-fil får bara kanter rakt igenom.
      const nc = step(c, d)
      if (nc < 0) continue
      const a = nodeAt(c, d), b = nodeAt(nc, OPP[d])
      if (a === b) continue
      const key = a < b ? a * N + b : b * N + a
      if (edgeKey.has(key)) continue
      const e = edgeA.length
      edgeKey.set(key, e)
      edgeA.push(a); edgeB.push(b); edgeDir.push(d)
      adj[a].push(e); adj[b].push(e)
    }
  }

  const deg = new Uint8Array(N)
  const nodeColor = new Int8Array(N).fill(-1)
  const ends = Array.from({ length: colors }, () => [])
  for (let v = 0; v < N; v++) {
    const c = nodeCell[v]
    if (kind[c] === END) {
      deg[v] = 1
      nodeColor[v] = endColor[c]
      ends[endColor[c]].push(v)
    } else deg[v] = 2
  }

  return {
    w, h, n, N, E: edgeA.length, colors,
    kind, endColor, walls, warpRows: [...warpRows], warpCols: [...warpCols], wr, wc,
    nodeH, nodeV, nodeCell, nodeLane, deg, nodeColor, ends,
    edgeA, edgeB, edgeDir, adj,
    step, nodeAt,
    other: (e, v) => (edgeA[e] === v ? edgeB[e] : edgeA[e]),
    // Riktning från nod v längs kant e
    dirFrom: (e, v) => (edgeA[e] === v ? edgeDir[e] : OPP[edgeDir[e]]),
  }
}

// Kant mellan två noder, eller -1.
export function edgeBetween(B, a, b) {
  for (const e of B.adj[a]) if (B.other(e, a) === b) return e
  return -1
}

// Gör om en lösning (kantstatus per kant, 1 = på) till lösningssträngen.
export function encodeSolution(B, on) {
  const mask = new Array(B.n).fill(0)
  for (let e = 0; e < B.E; e++) {
    if (!on[e]) continue
    const a = B.edgeA[e], b = B.edgeB[e]
    if (B.nodeLane[a] === 0) mask[B.nodeCell[a]] |= DIR_BIT[B.dirFrom(e, a)]
    if (B.nodeLane[b] === 0) mask[B.nodeCell[b]] |= DIR_BIT[B.dirFrom(e, b)]
  }
  return mask.map((m) => m.toString(16)).join('')
}

// Lösningssträngen tillbaka till en väg per färg (lista med noder, från ände till ände).
export function decodeSolution(B, s) {
  const on = new Uint8Array(B.E)
  for (let e = 0; e < B.E; e++) {
    const a = B.edgeA[e], b = B.edgeB[e]
    const la = B.nodeLane[a], lb = B.nodeLane[b]
    // Broar är alltid raka, så en kant in i en bro är på om den andra sidan säger det.
    const ma = la === 0 ? parseInt(s[B.nodeCell[a]], 16) & DIR_BIT[B.dirFrom(e, a)] : -1
    const mb = lb === 0 ? parseInt(s[B.nodeCell[b]], 16) & DIR_BIT[B.dirFrom(e, b)] : -1
    if (ma > 0 || mb > 0) on[e] = 1
    else if (ma === -1 && mb === -1) on[e] = 1 // bro mot bro
  }
  return pathsFromEdges(B, on)
}

export function pathsFromEdges(B, on) {
  const paths = []
  for (let k = 0; k < B.colors; k++) {
    const start = B.ends[k][0]
    const path = [start]
    let prev = -1, cur = start
    for (let guard = 0; guard < B.N + 1; guard++) {
      let next = -1
      for (const e of B.adj[cur]) {
        if (!on[e]) continue
        const o = B.other(e, cur)
        if (o !== prev) { next = o; break }
      }
      if (next < 0) break
      path.push(next)
      prev = cur; cur = next
      if (B.deg[cur] === 1) break
    }
    paths.push(path)
  }
  return paths
}

export function levelKey(lv) {
  return `${lv.w}x${lv.h}:${lv.g}:${(lv.wl || []).join(',')}:${(lv.wr || []).join(',')}:${(lv.wc || []).join(',')}`
}
