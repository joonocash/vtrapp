// Happys revir — tips som förklarar.
// Ren logik utan DOM. findHint tar ett tillstånd och returnerar nästa logiska steg:
//   { text, units, place? , cross?, unmark? }
//   units  = revir/rader/kolumner som ska ringas in, t.ex. { type: 'region', idx: 3 }
//   place  = ruta där Happy måste stå (spelaren placerar själv)
//   cross  = rutor som kan kryssas (läggs som kryss direkt)
//   unmark = kryss som står fel och tas bort
//
// Tillståndets cells: 0 tom, 1 kryss, 2 autokryss, 3 Happy.

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const joinList = (a) => (a.length < 2 ? a[0] : a.slice(0, -1).join(', ') + ' och ' + a[a.length - 1])

export function unitName(st, u) {
  return u.type === 'region' ? st.names[u.idx] : (u.type === 'row' ? 'rad ' : 'kolumn ') + (u.idx + 1)
}

function isSolution(st, i) {
  return st.solution[(i / st.n) | 0] === i % st.n
}

// Vilka rutor som fortfarande kan ha en Happy, givet placerade Happy och spelarens korrekta kryss.
export function analyse(st) {
  const n = st.n
  const row = new Array(n).fill(false), col = new Array(n).fill(false), reg = new Array(n).fill(false), dogs = []
  for (let i = 0; i < n * n; i++) if (st.cells[i] >= 3) { dogs.push(i); row[(i / n) | 0] = col[i % n] = reg[st.regions[i]] = true }
  const cand = st.cells.map((v, i) => {
    if (v >= 3) return false
    if (v === 1 && !isSolution(st, i)) return false
    const y = (i / n) | 0, x = i % n
    if (row[y] || col[x] || reg[st.regions[i]]) return false
    return !dogs.some((d) => Math.abs(((d / n) | 0) - y) <= 1 && Math.abs((d % n) - x) <= 1)
  })
  const units = []
  for (let k = 0; k < n; k++) {
    if (!reg[k]) units.push({ type: 'region', idx: k, cells: [...Array(n * n).keys()].filter((i) => st.regions[i] === k) })
    if (!row[k]) units.push({ type: 'row', idx: k, cells: [...Array(n).keys()].map((x) => k * n + x) })
    if (!col[k]) units.push({ type: 'col', idx: k, cells: [...Array(n).keys()].map((y) => y * n + k) })
  }
  units.forEach((u) => (u.cands = u.cells.filter((i) => cand[i])))
  return { cand, units }
}

function lineOf(st, type, i) {
  return type === 'row' ? (i / st.n) | 0 : type === 'col' ? i % st.n : st.regions[i]
}

function combos(arr, k) {
  const out = []
  ;(function go(s, acc) {
    if (acc.length === k) { out.push([...acc]); return }
    for (let j = s; j < arr.length; j++) { acc.push(arr[j]); go(j + 1, acc); acc.pop() }
  })(0, [])
  return out
}

export function findHint(st, rand = Math.random) {
  const n = st.n
  const name = (u) => unitName(st, u)

  // 0. ett kryss som står där Happy måste stå
  for (let i = 0; i < n * n; i++)
    if (st.cells[i] === 1 && isSolution(st, i))
      return { text: 'Det här krysset stämmer inte, så jag tar bort det. Titta en gång till på reviret.', units: [{ type: 'region', idx: st.regions[i] }], unmark: [i] }

  const { cand, units } = analyse(st)

  // 1–2. ett revir, en rad eller en kolumn med bara en ruta kvar
  for (const t of ['region', 'row', 'col'])
    for (const u of units.filter((u) => u.type === t))
      if (u.cands.length === 1)
        return { text: `${cap(name(u))} har bara en ruta kvar där Happy kan stå. Dubbeltryck på den!`, units: [u], place: u.cands[0] }

  // 3. grupper: k revir som bara får plats i k rader/kolumner, och tvärtom
  const pairs = [['region', 'row'], ['region', 'col'], ['row', 'region'], ['col', 'region']]
  for (let k = 1; k <= 3; k++)
    for (const [A, B] of pairs) {
      const As = units.filter((u) => u.type === A && u.cands.length)
      if (As.length <= k) continue
      for (const combo of combos(As, k)) {
        const lines = new Set()
        combo.forEach((u) => u.cands.forEach((i) => lines.add(lineOf(st, B, i))))
        if (lines.size !== k) continue
        const inCombo = new Set(combo.map((u) => u.idx))
        const cross = []
        for (let i = 0; i < n * n; i++) if (cand[i] && lines.has(lineOf(st, B, i)) && !inCombo.has(lineOf(st, A, i))) cross.push(i)
        if (!cross.length) continue
        const Bunits = [...lines].map((idx) => ({ type: B, idx }))
        const an = joinList(combo.map(name)), bn = joinList(Bunits.map(name))
        let text
        if (A === 'region')
          text = k === 1
            ? `${an} får bara plats i ${bn}. Då går inget annat revir att få in där, så resten av ${bn} kan kryssas.`
            : `${an} får bara plats i ${bn}. ${B === 'col' ? 'De kolumnerna' : 'De raderna'} behövs till dem, så resten av ${bn} kan kryssas.`
        else
          text = k === 1
            ? `${cap(an)} har bara rutor kvar i ${bn}. Då måste Happy i ${bn} stå i ${an}, så resten av ${bn} kan kryssas.`
            : `${cap(an)} har bara rutor kvar i ${bn}. Då fyller de reviren, så resten av ${bn} kan kryssas.`
        return { text, units: [...combo, ...Bunits], cross }
      }
    }

  // 4. en ruta som skulle tömma ett annat revir, en rad eller en kolumn
  const order = [...units.filter((u) => u.type === 'region'), ...units.filter((u) => u.type !== 'region')]
  for (let i = 0; i < n * n; i++) {
    if (!cand[i]) continue
    const y = (i / n) | 0, x = i % n, rg = st.regions[i]
    const gone = (j) => ((j / n) | 0) === y || j % n === x || st.regions[j] === rg || (Math.abs(((j / n) | 0) - y) <= 1 && Math.abs((j % n) - x) <= 1)
    for (const u of order) {
      if (u.cells.includes(i)) continue
      if (u.cands.length && u.cands.every(gone))
        return { text: `Om Happy står här blir det ingen plats kvar i ${name(u)}. Därför kan rutan kryssas.`, units: [u], cross: [i] }
    }
  }

  // 5. reserv: visa en rätt ruta
  const free = []
  for (let y = 0; y < n; y++) { const i = y * n + st.solution[y]; if (st.cells[i] < 3) free.push(i) }
  if (!free.length) return null
  const i = free[Math.floor(rand() * free.length)]
  return { text: 'Nu blir det klurigt, här behövs flera steg i huvudet. Jag visar var Happy ska stå.', units: [{ type: 'region', idx: st.regions[i] }], place: i, fallback: true }
}
