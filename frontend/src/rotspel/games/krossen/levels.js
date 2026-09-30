// Krossen — banorna. Hundra banor på Happys promenad, fem världar à tjugo.
//
// En bana är en karta (vilka rutor som finns och vad som ligger i dem), ett
// antal drag, hur många sorters pjäser som används, och målen. Kartorna byggs
// av en form och ett par lager ovanpå, så att varje rad nedan kan vara kort.
//
// Dragantal och stjärngränser är provspelade: en enkel robot spelade varje
// bana många gånger, och siffrorna i STAMNING är vad som kom ut av det. Ändrar
// man en bana här bör man provspela den igen.

import { skapaRng } from './engine.js'

// rubrik är textfärgen ovanpå himlen — vit där himlen är mörk.
export const VARLDAR = [
  { namn: 'Trädgården', farg: '#4caf50', mork: '#1d4d22', rubrik: '#1d4d22', himmel: ['#8fd3ff', '#d8f5c8'] },
  { namn: 'Parken', farg: '#2fa8c9', mork: '#123f52', rubrik: '#123f52', himmel: ['#7cc8f2', '#e2f4d4'] },
  { namn: 'Skogen', farg: '#3d7d45', mork: '#132a18', rubrik: '#ffffff', himmel: ['#4b8a5f', '#c3dfa8'] },
  { namn: 'Stranden', farg: '#e8a33c', mork: '#5a3a10', rubrik: '#5a3a10', himmel: ['#65c3ef', '#fbe7b8'] },
  { namn: 'Stan', farg: '#8a5cd6', mork: '#2a1850', rubrik: '#ffffff', himmel: ['#3b2a73', '#a58bd8'] },
]

export const BANOR_PER_VARLD = 20

// Pjäsernas namn, i samma ordning som färgindex i motorn.
export const SORTER = ['hjärtkex', 'ben', 'ostbitar', 'tassar', 'fiskkex', 'munkar']

// ------------------------------------------------------------------ former

const FORMER = {
  r7: rektangel(7, 7),
  r7x8: rektangel(7, 8),
  r8: rektangel(8, 8),
  r9: rektangel(9, 9),
  r9x8: rektangel(9, 8),
  hus: ['####.####', '###...###', '##.....##', '#.......#', '.........', '.........', '.........', '.........', '.........'],
  ben: ['...###...', '...###...', '.........', '.........', '.........', '...###...', '...###...'],
  kors: ['##.....##', '##.....##', '.........', '.........', '.........', '.........', '.........', '##.....##', '##.....##'],
  diamant: ['###...###', '##.....##', '#.......#', '.........', '.........', '.........', '#.......#', '##.....##', '###...###'],
  timglas: ['.........', '.........', '#.......#', '##.....##', '###...###', '##.....##', '#.......#', '.........', '.........'],
  ram: ['.........', '.........', '.........', '...###...', '...###...', '...###...', '.........', '.........', '.........'],
  pelare: ['.........', '.........', '.........', '..#...#..', '..#...#..', '..#...#..', '.........', '.........', '.........'],
  tvilling: ['....#....', '....#....', '....#....', '.........', '.........', '....#....', '....#....', '....#....'],
  trappa: ['......###', '.......##', '........#', '.........', '.........', '.........', '#........', '##.......', '###......'],
  skal: ['.........', '.........', '.........', '.........', '#.......#', '##.....##', '###...###'],
  hjarta: ['#...#...#', '.........', '.........', '.........', '#.......#', '##.....##', '###...###', '####.####'],
  tass: ['#..#.#..#', '#..#.#..#', '.........', '.........', '.........', '.........', '#.......#', '##.....##', '###...###'],
}

function rektangel(w, h) {
  return Array.from({ length: h }, () => '.'.repeat(w))
}

// ------------------------------------------------------------------- lager

// Mönster: vilka rutor ett lager hamnar på. Får (r, c, w, h, rng) och svarar
// sant eller falskt. Rutor som redan har något hoppas över.
const MONSTER = {
  allt: () => true,
  mitt: (r, c, w, h) => r >= Math.floor(h / 3) && r < Math.ceil((2 * h) / 3) && c >= Math.floor(w / 3) && c < Math.ceil((2 * w) / 3),
  kant: (r, c, w, h) => r === 0 || c === 0 || r === h - 1 || c === w - 1,
  botten: (r, c, w, h) => r === h - 1,
  botten2: (r, c, w, h) => r >= h - 2,
  botten3: (r, c, w, h) => r >= h - 3,
  topp: (r) => r <= 2,
  x: (r, c, w, h) => r === Math.round((c * (h - 1)) / (w - 1)) || r === Math.round(((w - 1 - c) * (h - 1)) / (w - 1)),
  rader: (r) => r % 2 === 0,
  ruter: (r, c) => (r + c) % 2 === 0,
  ring: (r, c, w, h) => {
    const d = Math.max(Math.abs(r - (h - 1) / 2), Math.abs(c - (w - 1) / 2))
    return d >= 1.4 && d <= 2.6
  },
  ringInre: (r, c, w, h) => Math.max(Math.abs(r - (h - 1) / 2), Math.abs(c - (w - 1) / 2)) <= 1,
  horn: (r, c, w, h) => (r < 2 || r >= h - 2) && (c < 2 || c >= w - 2),
  hornUppe: (r, c, w) => r < 2 && (c < 2 || c >= w - 2),
  rad: (r, c, w, h) => r === Math.floor(h / 2),
  radGap: (r, c, w, h) => r === Math.floor(h / 2) && c % 3 !== 1,
  pelare: (r, c, w, h) => (c === 1 || c === w - 2) && r >= 2 && r <= h - 3,
  spridd: (r, c, w, h, rng) => rng() < 0.28,
  glest: (r, c, w, h, rng) => rng() < 0.12,
  kottRad: (r, c, w) => r === 0 && (c === 2 || c === w - 3),
}

const TECKEN = {
  lera: ['l', 'L'],
  lada: ['1', '2', '3'],
  koppel: ['k'],
  ograss: ['o'],
  kott: ['e'],
}

function bygg(form, lagerSpec, nr) {
  const grid = FORMER[form].map((r) => r.split(''))
  const h = grid.length
  const w = Math.max(...grid.map((r) => r.length))
  const rng = skapaRng(nr * 7919)

  for (const del of lagerSpec.split(' ').filter(Boolean)) {
    const [typ, monster, niva = '1'] = del.split(':')
    const test = MONSTER[monster]
    if (!test) throw new Error(`bana ${nr}: okänt mönster ${monster}`)
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const x = grid[r][c]
        if (x === '#' || x === undefined) continue
        if (!test(r, c, w, h, rng)) continue
        if (typ === 'lera') {
          const ch = niva === '2' ? 'L' : 'l'
          if (x === '.') grid[r][c] = ch
          else if (x === 'k') grid[r][c] = 'K'
        } else if (typ === 'koppel') {
          if (x === '.') grid[r][c] = 'k'
          else if (x === 'l') grid[r][c] = 'K'
        } else if (x === '.') {
          if (typ === 'lada') grid[r][c] = niva
          else grid[r][c] = TECKEN[typ][0]
        }
      }
    }
  }
  return grid.map((r) => r.join(''))
}

// ------------------------------------------------------------------- mål

function tolkaMal(text) {
  const mal = []
  let kott = null
  for (const del of text.split(' ').filter(Boolean)) {
    if (del === 'p') mal.push({ typ: 'poang', antal: 0 })
    else if (del === 'l') mal.push({ typ: 'lera' })
    else if (del === 'b') mal.push({ typ: 'lada' })
    else if (del === 'o') mal.push({ typ: 'ograss' })
    else if (del === 'k') mal.push({ typ: 'koppel' })
    else if (del.startsWith('e')) {
      const antal = Number(del.slice(1))
      mal.push({ typ: 'kott', antal })
      kott = { antal, max: 2 }
    } else if (/^(raket|bomb|skal|frisbee)\d+$/.test(del)) {
      const m = del.match(/^(raket|bomb|skal|frisbee)(\d+)$/)
      mal.push({ typ: 'special', special: m[1], antal: Number(m[2]) })
    } else if (/^f\d:\d+$/.test(del)) {
      const [f, antal] = del.slice(1).split(':').map(Number)
      mal.push({ typ: 'farg', farg: f, antal })
    } else {
      throw new Error('okänt mål ' + del)
    }
  }
  return { mal, kott }
}

// ----------------------------------------------------------------- banorna

// [form, sorter, mål, lager, flaggor]
// Flaggor: boss, latt (en andningsbana), tips:<nyckel>
const SPEC = [
  // --- Trädgården
  ['r7', 4, 'p', '', 'tips:start latt'],
  ['r7', 4, 'raket2', '', 'tips:raket latt'],
  ['r8', 5, 'l', 'lera:mitt', 'tips:lera'],
  ['r7x8', 5, 'p', '', ''],
  ['r8', 5, 'f0:22 f1:22', '', 'tips:farg'],
  ['hus', 5, 'l', 'lera:botten3', ''],
  ['r8', 5, 'raket3', '', 'tips:specialmal'],
  ['r8', 5, 'b', 'lada:botten', 'tips:lada'],
  ['ben', 5, 'l', 'lera:allt', ''],
  ['r8', 5, 'bomb2', 'lada:horn', 'tips:bomb'],
  ['diamant', 5, 'p', '', ''],
  ['r8', 5, 'l b', 'lada:mitt lera:x', ''],
  ['r9x8', 5, 'frisbee3', '', 'tips:frisbee'],
  ['kors', 5, 'l', 'lera:mitt:2', 'tips:lera2'],
  ['r8', 5, 'b', 'lada:botten:2 lada:botten2', 'tips:lada2'],
  ['hjarta', 5, 'l', 'lera:allt', ''],
  ['r8', 5, 'p', '', 'latt tips:skal'],
  ['r9x8', 5, 'f2:22 f3:22 f4:22', 'lada:glest', ''],
  ['ram', 5, 'l b', 'lada:horn:2 lera:ring', ''],
  ['tass', 5, 'l b', 'lada:mitt:2 lera:allt', 'boss'],

  // --- Parken
  ['r8', 5, 'e2', '', 'tips:kott'],
  ['r8', 5, 'k', 'koppel:x', 'tips:koppel'],
  ['hus', 5, 'l k', 'koppel:mitt lera:allt', ''],
  ['r9', 5, 'e3', '', ''],
  ['ben', 5, 'f1:25 bomb1', '', ''],
  ['r8', 5, 'k b', 'lada:botten koppel:rad', ''],
  ['timglas', 5, 'l', 'lera:allt', ''],
  ['r9', 5, 'e3 b', 'lada:pelare', ''],
  ['r8', 5, 'p', '', 'latt'],
  ['diamant', 5, 'l k', 'koppel:glest lera:mitt', ''],
  ['pelare', 5, 'e4', '', ''],
  ['r9', 5, 'l b', 'lada:ring:2 lera:ringInre', ''],
  ['hjarta', 5, 'frisbee2 raket4', '', ''],
  ['r8', 5, 'k f0:25 f3:25', 'koppel:horn', ''],
  ['r9', 5, 'l b', 'lada:glest lera:mitt:2', ''],
  ['tvilling', 5, 'e3 k', 'koppel:rad', ''],
  ['r8', 5, 'p', 'lada:horn', ''],
  ['kors', 5, 'l k', 'koppel:x lera:allt', ''],
  ['r9', 5, 'e2 b', 'lada:botten:2', ''],
  ['hjarta', 5, 'l k b', 'lada:radGap:2 koppel:glest lera:allt:2', 'boss'],

  // --- Skogen
  ['r8', 5, 'o', 'ograss:mitt', 'tips:ograss'],
  ['r8', 5, 'o l', 'ograss:botten lera:topp', ''],
  ['r9', 5, 'b', 'lada:horn:3 lada:mitt', 'tips:lada3'],
  ['ben', 5, 'o', 'ograss:hornUppe ograss:radGap', ''],
  ['r9', 5, 'e3 o', 'ograss:hornUppe', ''],
  ['ram', 5, 'l', 'lera:allt:2', ''],
  ['r8', 5, 'p', '', 'latt'],
  ['trappa', 5, 'l', 'lera:allt', ''],
  ['r9', 5, 'o k', 'ograss:mitt koppel:x', ''],
  ['diamant', 5, 'f0:30 f2:30 f4:30 o', 'ograss:ringInre', ''],
  ['r9', 5, 'l b', 'lada:ring:3 lera:ringInre:2', ''],
  ['hus', 5, 'o', 'ograss:botten2', ''],
  ['r8', 5, 'frisbee4 bomb2 b', 'lada:spridd', ''],
  ['pelare', 5, 'e3 b', 'lada:pelare:2', ''],
  ['r9', 5, 'l o', 'ograss:horn lera:allt', ''],
  ['kors', 6, 'p', '', 'tips:farger6'],
  ['timglas', 5, 'o k', 'ograss:botten koppel:rad', ''],
  ['r9', 5, 'l b', 'lada:ringInre:3 lera:ring:2', ''],
  ['r8', 5, 'e3 k', 'koppel:spridd', ''],
  ['tass', 5, 'o l b', 'ograss:radGap lada:hornUppe:2 lera:allt', 'boss'],

  // --- Stranden
  ['r9', 5, 'l', 'lera:allt', 'latt'],
  ['skal', 5, 'e3', '', ''],
  ['hjarta', 6, 'l', 'lera:mitt', ''],
  ['r9', 5, 'l b', 'lada:radGap lera:botten3', ''],
  ['diamant', 5, 'f0:25 f1:25 f2:25 f3:25', '', ''],
  ['tvilling', 5, 'l k', 'koppel:x lera:allt', ''],
  ['r8', 6, 'raket5', '', ''],
  ['ram', 5, 'e4', '', ''],
  ['r9', 5, 'o b', 'ograss:mitt lada:horn:2', ''],
  ['trappa', 5, 'l', 'lera:allt:2', ''],
  ['r9', 5, 'k', 'koppel:spridd', ''],
  ['skal', 5, 'l b', 'lada:radGap lera:topp', ''],
  ['r8', 5, 'p', 'lada:glest:2', ''],
  ['kors', 5, 'e4 o', 'ograss:ringInre', ''],
  ['r9', 6, 'l b', 'lada:ring lera:ringInre:2', ''],
  ['ben', 5, 'f4:30 bomb2 frisbee2', '', ''],
  ['pelare', 5, 'l k', 'koppel:mitt lera:allt', ''],
  ['r9', 5, 'o l', 'ograss:botten2 lera:topp', ''],
  ['hus', 5, 'e3 b', 'lada:pelare:2', ''],
  ['diamant', 5, 'l k b o', 'ograss:ringInre lada:pelare:2 koppel:x lera:allt', 'boss'],

  // --- Stan
  ['r9', 5, 'l', 'lera:allt:2', ''],
  ['r9', 5, 'e5', '', ''],
  ['hjarta', 6, 'l b', 'lada:glest:3 lera:allt', ''],
  ['timglas', 5, 'o k l', 'ograss:hornUppe koppel:rad lera:botten3', ''],
  ['r8', 5, 'p', '', 'latt'],
  ['tass', 5, 'l', 'lera:allt:2', ''],
  ['r9', 6, 'f1:32 f3:32 f5:32', '', ''],
  ['ram', 5, 'b o', 'lada:ring ograss:horn', ''],
  ['kors', 5, 'e4 k', 'koppel:glest', ''],
  ['r9', 5, 'skal2 bomb3', '', ''],
  ['diamant', 5, 'l b', 'lada:mitt:3 lera:allt', ''],
  ['pelare', 5, 'o e3', 'ograss:hornUppe ograss:radGap', ''],
  ['r9', 6, 'l k', 'koppel:x lera:ring:2', ''],
  ['skal', 5, 'b', 'lada:botten2:3 lada:radGap:2', ''],
  ['r8', 5, 'p', '', 'latt'],
  ['hjarta', 5, 'e4 l', 'lera:botten3', ''],
  ['r9', 5, 'o b l', 'ograss:ringInre lada:ring:2 lera:kant', ''],
  ['ben', 5, 'l k', 'koppel:hornUppe lera:allt:2', ''],
  ['tvilling', 5, 'e2 o l', 'ograss:hornUppe lera:botten2', ''],
  ['tass', 6, 'l b o k', 'ograss:radGap lada:hornUppe:3 koppel:ringInre lera:allt', 'boss'],
]

// Provspelade dragantal och stjärngränser: nr -> [drag, en, två, tre].
// Genererat av banornas provspelning — se kommentaren överst.
export const STAMNING = {
  1: [20, 18000, 45000, 75000],
  2: [12, 2250, 11000, 25000],
  3: [12, 2750, 7500, 14000],
  4: [18, 5500, 12000, 17000],
  5: [13, 2250, 7500, 14500],
  6: [22, 3250, 11000, 15500],
  7: [13, 1000, 5500, 9500],
  8: [15, 1750, 6500, 11500],
  9: [28, 5500, 11500, 13500],
  10: [21, 3000, 9500, 15500],
  11: [18, 7500, 12500, 21000],
  12: [19, 2250, 10500, 16000],
  13: [12, 2000, 7000, 13000],
  14: [12, 3000, 8500, 15000],
  15: [28, 3250, 12500, 22000],
  16: [25, 6000, 16500, 20000],
  17: [20, 8500, 22000, 33000],
  18: [14, 3250, 10000, 15500],
  19: [34, 6000, 14500, 18500],
  20: [23, 6500, 18500, 22000],
  21: [13, 2500, 9000, 14000],
  22: [18, 3750, 10500, 17000],
  23: [24, 6000, 17500, 22000],
  24: [18, 4500, 16000, 30000],
  25: [24, 1750, 5500, 8000],
  26: [16, 2500, 8500, 14500],
  27: [27, 7000, 18500, 25000],
  28: [20, 4750, 17000, 29000],
  29: [20, 8500, 22000, 33000],
  30: [12, 1750, 6500, 12500],
  31: [28, 5500, 17000, 24000],
  32: [20, 3750, 14000, 20000],
  33: [17, 1500, 6500, 8500],
  34: [22, 3500, 13500, 17500],
  35: [12, 3000, 13500, 22000],
  36: [31, 3500, 13000, 15500],
  37: [20, 13500, 19000, 21000],
  38: [21, 8000, 25000, 29000],
  39: [23, 5500, 21000, 28000],
  40: [27, 8500, 21000, 27000],
  41: [12, 2250, 7500, 11000],
  42: [20, 4250, 14000, 24000],
  43: [37, 10000, 31000, 46000],
  44: [42, 2000, 6000, 9500],
  45: [24, 6000, 24000, 40000],
  46: [38, 13000, 33000, 42000],
  47: [20, 8500, 22000, 33000],
  48: [20, 9000, 25000, 30000],
  49: [17, 4000, 14500, 30000],
  50: [18, 3250, 9000, 13500],
  51: [26, 5500, 17500, 23000],
  52: [20, 3750, 11500, 15500],
  53: [21, 3500, 12500, 22000],
  54: [33, 6500, 17000, 22000],
  55: [23, 9000, 26000, 42000],
  56: [22, 6000, 8000, 11000],
  57: [28, 2250, 7500, 18500],
  58: [19, 5500, 17500, 31000],
  59: [24, 4750, 17000, 24000],
  60: [20, 7000, 16500, 24000],
  61: [29, 10000, 31000, 39000],
  62: [18, 3750, 9500, 12000],
  63: [12, 1500, 4000, 6000],
  64: [15, 5000, 19500, 24000],
  65: [13, 2500, 7000, 11500],
  66: [29, 7000, 17000, 20000],
  67: [23, 2250, 5500, 7500],
  68: [26, 4750, 13500, 17000],
  69: [26, 6500, 19500, 37000],
  70: [27, 13000, 34000, 44000],
  71: [18, 5500, 17500, 29000],
  72: [15, 3000, 8500, 12000],
  73: [24, 13500, 19500, 26000],
  74: [23, 5000, 16500, 22000],
  75: [18, 3000, 9500, 11500],
  76: [34, 2250, 8500, 11000],
  77: [30, 8500, 19500, 25000],
  78: [21, 5500, 17500, 27000],
  79: [21, 5000, 14000, 18500],
  80: [23, 6500, 16000, 20000],
  81: [25, 17000, 42000, 54000],
  82: [23, 9000, 28000, 34000],
  83: [31, 4750, 11000, 13000],
  84: [26, 4750, 14500, 20000],
  85: [20, 8500, 22000, 33000],
  86: [32, 10500, 30000, 38000],
  87: [22, 3750, 9500, 12500],
  88: [31, 4250, 12000, 16000],
  89: [22, 7000, 17500, 24000],
  90: [23, 6500, 19000, 29000],
  91: [24, 7000, 17000, 22000],
  92: [31, 6500, 18500, 25000],
  93: [27, 4750, 12500, 19000],
  94: [26, 3250, 12000, 14000],
  95: [20, 8500, 22000, 33000],
  96: [27, 4750, 14500, 18500],
  97: [30, 8000, 22000, 29000],
  98: [35, 8000, 19000, 20000],
  99: [41, 5500, 15500, 18000],
  100: [45, 7000, 17000, 18500],
}

export const TIPS = {
  start: { titel: 'Hjälp Happy få godis!', text: 'Dra en pjäs till en granne. Tre lika i rad försvinner.' },
  raket: { titel: 'Raket', text: 'Fyra i rad ger en randig raket. Den rensar en hel rad eller kolumn.' },
  lera: { titel: 'Lera', text: 'Matcha pjäserna som ligger på leran så tvättas den bort. Få bort all lera!' },
  farg: { titel: 'Happys beställning', text: 'Happy vill ha en viss sorts godis. Samla det som står uppe till vänster.' },
  specialmal: { titel: 'Smäll raketer', text: 'Den här gången ska du göra raketer och smälla dem.' },
  lada: { titel: 'Lådor', text: 'Lådor går sönder när du matchar precis bredvid dem.' },
  bomb: { titel: 'Bomb', text: 'Fem i ett L eller T ger en godispåse som smäller två gånger.' },
  frisbee: { titel: 'Frisbee', text: 'Fyra i en ruta ger en frisbee. Den flyger till det banan behöver mest.' },
  lera2: { titel: 'Dubbel lera', text: 'Mörk lera har två lager. Matcha två gånger på samma ruta.' },
  lada2: { titel: 'Tejpade lådor', text: 'Lådor med tejp tål två smällar.' },
  skal: { titel: 'Godisskålen', text: 'Fem i rad ger Godisskålen. Byt den med en pjäs så försvinner alla av den sorten.' },
  kott: { titel: 'Köttben', text: 'Få ner köttbenen till botten, där väntar Happy.' },
  koppel: { titel: 'Koppel', text: 'Pjäser i koppel sitter fast. Matcha dem så släpper kopplet.' },
  ograss: { titel: 'Ogräs', text: 'Ogräset växer ett steg varje drag du inte rensar bort något av det.' },
  lada3: { titel: 'Trälådor', text: 'Trälådor tål tre smällar.' },
  farger6: { titel: 'Alla sex', text: 'Nu är alla sex sorters godis med. Det blir svårare att hitta matchningar.' },
}

// Standardvärden när en bana inte är provspelad än.
const STANDARD_DRAG = 25

export const BANOR = SPEC.map(([form, farger, malText, lager, flaggor], k) => {
  const nr = k + 1
  const { mal, kott } = tolkaMal(malText)
  const flagga = flaggor.split(' ').filter(Boolean)
  const tips = flagga.find((f) => f.startsWith('tips:'))
  const [drag, en, tva, tre] = STAMNING[nr] || [STANDARD_DRAG, 0, 0, 0]
  for (const m of mal) if (m.typ === 'poang') m.antal = en
  return {
    nr,
    varld: Math.floor(k / BANOR_PER_VARLD),
    form,
    karta: bygg(form, lager, nr),
    farger,
    drag,
    mal,
    kott,
    stjarnor: [en, tva, tre],
    boss: flagga.includes('boss'),
    latt: flagga.includes('latt'),
    tips: tips ? tips.slice(5) : null,
  }
})

export const ANTAL_BANOR = BANOR.length
