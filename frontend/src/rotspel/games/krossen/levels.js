// Krossen — banorna. Tvåhundra banor på Happys promenad, tio världar à tjugo,
// och efter det den oändliga promenaden där nya banor skapas av de gamla.
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
  { namn: 'Snön', farg: '#4a9ede', mork: '#163a5c', rubrik: '#163a5c', himmel: ['#bfe3ff', '#f7fbff'] },
  { namn: 'Hundutställningen', farg: '#b0408f', mork: '#4a0f3a', rubrik: '#ffffff', himmel: ['#7a2c66', '#e8b4d8'] },
  { namn: 'Veterinären', farg: '#2fa898', mork: '#0f4a44', rubrik: '#0f4a44', himmel: ['#bdeee6', '#f5fffd'] },
  { namn: 'Stugan', farg: '#c0612b', mork: '#4a1f08', rubrik: '#ffffff', himmel: ['#7a4a2a', '#f3c9a0'] },
  { namn: 'Rymden', farg: '#6a7cff', mork: '#0b1240', rubrik: '#ffffff', himmel: ['#0b1240', '#4a3a8a'] },
]

// Den oändliga promenaden efter sista världen.
export const OANDLIG_VARLD = { namn: 'Oändliga promenaden', farg: '#ffb347', mork: '#3a1d00', rubrik: '#ffffff', himmel: ['#2a1640', '#ff9a5a'] }

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
  pokal: ['.........', '.........', '#.......#', '##.....##', '###...###', '####.####', '###...###', '##.....##', '##.....##'],
  stjarna: ['####.####', '###...###', '.........', '#.......#', '##.....##', '#.......#', '.........', '###...###', '####.####'],
  mane: ['##.....##', '#.....###', '.....####', '....#####', '....#####', '....#####', '.....####', '#.....###', '##.....##'],
  raket: ['####.####', '###...###', '##.....##', '##.....##', '##.....##', '##.....##', '#.......#', '.........', '..#...#..'],
  plus: ['###...###', '###...###', '###...###', '.........', '.........', '.........', '###...###', '###...###', '###...###'],
  bricka: ['.........', '.#.....#.', '.........', '...#.#...', '.........', '...#.#...', '.........', '.#.....#.', '.........'],
  tand: ['#.......#', '.........', '.........', '.........', '.........', '#.......#', '#...#...#', '#..###..#', '#..###..#'],
  hund: ['..#####..', '...###...', '.........', '.........', '.........', '.........', '#.......#', '##.....##', '###...###'],
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
  boll: ['b'],
  klocka: ['t'],
  paket: ['q'],
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
    else if (/^boll\d+$/.test(del)) mal.push({ typ: 'boll', antal: Number(del.slice(4)) })
    else if (/^klocka\d+$/.test(del)) mal.push({ typ: 'klocka', antal: Number(del.slice(6)) })
    else if (/^hopp\d+$/.test(del)) mal.push({ typ: 'hopp', antal: Number(del.slice(4)) })
    else if (/^paket\d+$/.test(del)) mal.push({ typ: 'paket', antal: Number(del.slice(5)) })
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
// Flaggor: boss, latt (en andningsbana), tips:<nyckel>,
//   svar / supersvar  märks på kartan och ger extra mynt (bossar är alltid supersvåra)
//   bollar[:chans]   tennisbollar ramlar in ovanifrån
//   klockor:<tid>    ibland kommer godis med en klocka som börjar på <tid>
//   happy            Happy finns på brädet
//   paket[:chans]    överraskningspaket ramlar in ovanifrån
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
  ['hjarta', 5, 'l', 'lera:allt', 'svar'],
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
  ['r9', 5, 'e3 b', 'lada:pelare', 'svar'],
  ['r8', 5, 'p', '', 'latt'],
  ['diamant', 5, 'l k', 'koppel:glest lera:mitt', ''],
  ['pelare', 5, 'e4', '', ''],
  ['r9', 5, 'l b', 'lada:ring:2 lera:ringInre', ''],
  ['hjarta', 5, 'frisbee2 raket4', '', ''],
  ['r8', 5, 'k f0:25 f3:25', 'koppel:horn', ''],
  ['r9', 5, 'l b', 'lada:glest lera:mitt:2', ''],
  ['tvilling', 5, 'e3 k', 'koppel:rad', 'svar'],
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
  ['r8', 5, 'boll18', 'boll:glest', 'tips:boll bollar'],
  ['r8', 5, 'p', '', 'latt'],
  ['trappa', 5, 'l', 'lera:allt', ''],
  ['r9', 5, 'o k', 'ograss:mitt koppel:x', 'svar'],
  ['diamant', 5, 'f0:30 f2:30 f4:30 o', 'ograss:ringInre', ''],
  ['r9', 5, 'l b', 'lada:ring:3 lera:ringInre:2', ''],
  ['hus', 5, 'o', 'ograss:botten2', ''],
  ['r8', 5, 'frisbee4 bomb2 b', 'lada:spridd', 'bollar'],
  ['pelare', 5, 'e3 b', 'lada:pelare:2', ''],
  ['r9', 5, 'l o', 'ograss:horn lera:allt', ''],
  ['kors', 6, 'p', '', 'tips:farger6'],
  ['timglas', 5, 'o k', 'ograss:botten koppel:rad', 'bollar:0.04 svar'],
  ['r9', 5, 'l b', 'lada:ringInre:3 lera:ring:2', ''],
  ['r8', 5, 'e3 k', 'koppel:spridd', 'bollar:0.05'],
  ['tass', 5, 'o l b', 'ograss:radGap lada:hornUppe:2 lera:allt', 'boss'],

  // --- Stranden
  ['r9', 5, 'l', 'lera:allt', 'latt'],
  ['skal', 5, 'e3', '', ''],
  ['hjarta', 6, 'l', 'lera:mitt', ''],
  ['r9', 5, 'l', 'klocka:glest lera:allt', 'tips:klocka klockor:16'],
  ['diamant', 5, 'f0:25 f1:25 f2:25 f3:25', '', ''],
  ['tvilling', 5, 'l k', 'koppel:x lera:allt', ''],
  ['r8', 6, 'raket5', '', ''],
  ['ram', 5, 'e4', '', ''],
  ['r9', 5, 'o b', 'ograss:mitt lada:horn:2', 'klockor:14 svar'],
  ['trappa', 5, 'l', 'lera:allt:2', ''],
  ['r9', 5, 'k', 'koppel:spridd', ''],
  ['skal', 5, 'l b', 'lada:radGap lera:topp', 'bollar'],
  ['r8', 5, 'p', 'lada:glest:2', ''],
  ['kors', 5, 'e4 o', 'ograss:ringInre', ''],
  ['r9', 6, 'l b', 'lada:ring lera:ringInre:2', ''],
  ['ben', 5, 'f4:30 bomb2 frisbee2', '', 'svar'],
  ['pelare', 5, 'l k', 'koppel:mitt lera:allt', ''],
  ['r9', 5, 'o l', 'ograss:botten2 lera:topp', 'klockor:15'],
  ['hus', 5, 'e3 b', 'lada:pelare:2', ''],
  ['diamant', 5, 'l k b o', 'ograss:ringInre lada:pelare:2 koppel:x lera:allt', 'boss'],

  // --- Stan
  ['r9', 5, 'l', 'lera:allt:2', ''],
  ['r9', 5, 'e5', '', ''],
  ['hjarta', 6, 'l b', 'lada:glest:3 lera:allt', 'bollar:0.03'],
  ['timglas', 5, 'o k l', 'ograss:hornUppe koppel:rad lera:botten3', ''],
  ['r8', 5, 'p', '', 'latt'],
  ['tass', 5, 'l', 'lera:allt:2', ''],
  ['r9', 6, 'f1:32 f3:32 f5:32', '', 'klockor:14'],
  ['ram', 5, 'b o', 'lada:ring ograss:horn', ''],
  ['kors', 5, 'e4 k', 'koppel:glest', 'svar'],
  ['r9', 5, 'skal2 bomb3', '', ''],
  ['diamant', 5, 'l b', 'lada:mitt:3 lera:allt', 'bollar'],
  ['pelare', 5, 'o e3', 'ograss:hornUppe ograss:radGap', ''],
  ['r9', 6, 'l k', 'koppel:x lera:ring:2', 'klockor:18'],
  ['skal', 5, 'b', 'lada:botten2:3 lada:radGap:2', ''],
  ['r8', 5, 'p', '', 'latt'],
  ['hjarta', 5, 'e4 l', 'lera:botten3', 'svar'],
  ['r9', 5, 'o b l', 'ograss:ringInre lada:ring:2 lera:kant', 'klockor:18'],
  ['ben', 5, 'l k', 'koppel:hornUppe lera:allt:2', ''],
  ['tvilling', 5, 'e2 o l', 'ograss:hornUppe lera:botten2', ''],
  ['tass', 6, 'l b o k', 'ograss:radGap lada:hornUppe:3 koppel:ringInre lera:allt', 'boss'],
  // --- Snön (Happy kommer med)
  ['r8', 5, 'hopp1', '', 'tips:happy happy latt'],
  ['r8', 5, 'hopp2 l', 'lera:mitt', 'happy'],
  ['hund', 5, 'l', 'lera:allt', 'happy'],
  ['r9', 5, 'hopp2 b', 'lada:horn:2', 'happy'],
  ['pokal', 5, 'p', '', ''],
  ['r9', 5, 'hopp2 k', 'koppel:glest', 'happy'],
  ['stjarna', 5, 'l', 'lera:allt', 'happy'],
  ['r8', 5, 'e3 hopp1', '', 'happy'],
  ['plus', 5, 'b', 'lada:mitt:2', 'happy svar'],
  ['r9', 6, 'f0:30 f4:30', '', 'happy'],
  ['hund', 5, 'o hopp2', 'ograss:botten', 'happy'],
  ['r8', 5, 'p', '', 'latt happy'],
  ['tand', 5, 'l k', 'koppel:x lera:allt', 'happy'],
  ['r9', 5, 'hopp2 boll8', 'boll:glest', 'happy bollar'],
  ['pokal', 5, 'l b', 'lada:ringInre:2 lera:kant', 'happy'],
  ['r9', 6, 'hopp2', '', 'happy svar'],
  ['raket', 5, 'e3', '', 'happy'],
  ['stjarna', 5, 'l o', 'ograss:mitt lera:allt', 'happy'],
  ['r9', 5, 'klocka6 hopp2', 'klocka:glest', 'happy klockor:16'],
  ['hund', 5, 'l b hopp2', 'lada:hornUppe:3 lera:allt', 'boss happy'],

  // --- Hundutställningen (överraskningspaket)
  ['r8', 5, 'paket4', 'paket:glest', 'tips:paket paket latt'],
  ['pokal', 5, 'l', 'lera:allt', 'paket'],
  ['r9', 5, 'paket12 b', 'lada:horn paket:glest', 'paket'],
  ['stjarna', 5, 'f1:28 f3:28', '', 'paket'],
  ['r9', 5, 'k', 'koppel:spridd', 'paket'],
  ['hund', 5, 'l', 'lera:allt:2', 'paket'],
  ['r8', 5, 'paket14 raket6', 'paket:glest', 'paket'],
  ['plus', 5, 'e3', '', 'paket'],
  ['r9', 5, 'l b', 'lada:ring:2 lera:ringInre', 'paket svar'],
  ['r8', 5, 'p', '', 'latt paket'],
  ['tand', 5, 'o', 'ograss:botten2', 'paket'],
  ['r9', 5, 'hopp2 paket8', 'paket:glest', 'happy paket'],
  ['raket', 5, 'l', 'lera:allt', 'paket'],
  ['pokal', 5, 'b k', 'lada:mitt:2 koppel:glest', 'paket'],
  ['r9', 6, 'paket26', 'paket:glest', 'paket:0.08'],
  ['bricka', 5, 'l', 'lera:allt', 'paket svar'],
  ['r9', 5, 'boll20', 'boll:glest', 'bollar paket'],
  ['stjarna', 5, 'e4 l', 'lera:botten3', 'paket'],
  ['hund', 5, 'klocka10 l', 'klocka:glest lera:mitt', 'klockor:16 paket'],
  ['pokal', 5, 'l b paket6', 'lada:ringInre:3 paket:glest lera:allt', 'boss paket'],

  // --- Veterinären
  ['r9', 5, 'k', 'koppel:x', 'happy'],
  ['tand', 5, 'l', 'lera:allt', 'happy'],
  ['r9', 5, 'klocka14', 'klocka:glest', 'klockor:16'],
  ['plus', 5, 'b hopp2', 'lada:mitt:2', 'happy'],
  ['r8', 5, 'l k', 'koppel:glest lera:allt', 'paket'],
  ['hund', 5, 'e3', '', 'happy'],
  ['r9', 5, 'o b', 'ograss:hornUppe ograss:radGap lada:horn:2', 'paket'],
  ['bricka', 5, 'p', '', 'latt'],
  ['tand', 5, 'b', 'lada:botten2:3 lada:radGap:2', 'happy svar'],
  ['r9', 6, 'l', 'lera:allt:2', 'happy'],
  ['raket', 5, 'klocka10 k', 'klocka:glest koppel:glest', 'klockor:16'],
  ['r9', 5, 'hopp3', '', 'happy'],
  ['pokal', 5, 'f0:30 f2:30 f4:30', '', 'paket'],
  ['r9', 5, 'l b', 'lada:pelare:2 lera:allt', 'happy'],
  ['stjarna', 5, 'e4 k', 'koppel:glest', ''],
  ['r9', 5, 'o l', 'ograss:mitt lera:kant', 'happy svar'],
  ['hund', 5, 'boll10 l', 'boll:glest lera:botten3', 'bollar'],
  ['r8', 5, 'p', '', 'latt paket'],
  ['plus', 6, 'l k', 'koppel:mitt lera:allt', 'happy'],
  ['tand', 5, 'l b k', 'lada:horn:2 koppel:x lera:allt', 'boss happy klockor:18'],

  // --- Stugan
  ['r9', 5, 'e4', '', 'paket'],
  ['hund', 5, 'l b', 'lada:glest:2 lera:allt', 'happy'],
  ['r9', 5, 'o b', 'ograss:botten lada:horn:3', ''],
  ['stjarna', 5, 'paket6 e2', 'paket:glest', 'paket'],
  ['r9', 5, 'l', 'lera:allt:2', 'happy'],
  ['pokal', 5, 'k o', 'koppel:glest ograss:hornUppe', ''],
  ['r8', 5, 'p', '', 'latt'],
  ['raket', 5, 'l b', 'lada:radGap:2 lera:allt', 'happy'],
  ['r9', 6, 'e4', '', 'happy svar'],
  ['tand', 5, 'o l', 'ograss:botten2 lera:topp', 'klockor:16'],
  ['r9', 5, 'b paket5', 'lada:ring:2 paket:glest', 'paket'],
  ['bricka', 5, 'l k', 'koppel:glest lera:allt', 'happy'],
  ['r9', 5, 'boll10 e2', 'boll:glest', 'bollar'],
  ['hund', 6, 'l', 'lera:allt', 'happy'],
  ['plus', 5, 'o b', 'ograss:mitt lada:radGap:2', ''],
  ['r9', 5, 'hopp3 l', 'lera:allt', 'happy svar'],
  ['stjarna', 5, 'e3 o', 'ograss:ringInre', ''],
  ['r8', 5, 'p', '', 'latt paket'],
  ['pokal', 5, 'klocka6 b', 'klocka:glest lada:ringInre:2', 'klockor:20'],
  ['hund', 5, 'l b o', 'ograss:radGap lada:hornUppe:3 lera:allt', 'boss happy paket'],

  // --- Rymden
  ['raket', 5, 'l', 'lera:allt', 'happy'],
  ['mane', 5, 'p', '', ''],
  ['r9', 6, 'hopp2', '', 'happy'],
  ['stjarna', 5, 'b paket5', 'lada:ring:2 paket:glest', 'paket'],
  ['r9', 5, 'l k', 'koppel:x lera:ring:2', 'happy'],
  ['mane', 5, 'l', 'lera:allt', 'happy'],
  ['r8', 5, 'p', '', 'latt'],
  ['bricka', 6, 'e4', '', 'happy'],
  ['raket', 5, 'o b', 'ograss:mitt lada:botten:2', 'svar'],
  ['r9', 6, 'l b', 'lada:ringInre:3 lera:ring:2', 'happy'],
  ['stjarna', 5, 'klocka6 l', 'klocka:glest lera:allt', 'klockor:15'],
  ['r9', 5, 'boll12 hopp2', 'boll:glest', 'happy bollar'],
  ['pokal', 6, 'f1:30 f3:30 f5:30', '', 'paket'],
  ['mane', 5, 'e3 l', 'lera:botten3', 'happy'],
  ['r9', 5, 'l b k', 'lada:radGap:2 koppel:glest lera:allt', 'happy svar'],
  ['hund', 6, 'o paket6', 'ograss:mitt paket:glest', 'paket'],
  ['r8', 5, 'p', '', 'latt'],
  ['tand', 6, 'l k', 'koppel:x lera:allt:2', 'happy'],
  ['raket', 5, 'e4 o', 'ograss:mitt', ''],
  ['stjarna', 6, 'l b k hopp2', 'lada:ring:2 koppel:ringInre lera:allt', 'boss happy'],
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
  16: [19, 4750, 14500, 18000],
  17: [20, 8500, 22000, 33000],
  18: [14, 3250, 10000, 15500],
  19: [34, 6000, 14500, 18500],
  20: [23, 6500, 17500, 21000],
  21: [13, 2500, 9000, 14000],
  22: [18, 3750, 10500, 17000],
  23: [24, 6000, 17500, 22000],
  24: [18, 4500, 16000, 30000],
  25: [24, 1750, 5500, 8000],
  26: [16, 2500, 8500, 14500],
  27: [27, 7000, 18500, 25000],
  28: [14, 4500, 18000, 29000],
  29: [20, 8500, 22000, 33000],
  30: [12, 1750, 6500, 12500],
  31: [28, 5500, 17000, 24000],
  32: [20, 3750, 14000, 20000],
  33: [17, 1500, 6500, 8500],
  34: [22, 3500, 13500, 17500],
  35: [12, 3000, 13500, 22000],
  36: [24, 3500, 11500, 15500],
  37: [20, 13500, 19000, 21000],
  38: [21, 8000, 25000, 29000],
  39: [23, 5500, 21000, 28000],
  40: [26, 8000, 22000, 26000],
  41: [12, 2250, 7500, 11000],
  42: [20, 4250, 14000, 24000],
  43: [37, 10000, 31000, 46000],
  44: [42, 2000, 6000, 9500],
  45: [24, 6000, 24000, 40000],
  46: [18, 3500, 9500, 15000],
  47: [20, 8500, 22000, 33000],
  48: [20, 9000, 25000, 30000],
  49: [15, 4250, 16500, 26000],
  50: [18, 3250, 9000, 13500],
  51: [26, 5500, 17500, 23000],
  52: [20, 3750, 11500, 15500],
  53: [23, 4250, 13000, 17500],
  54: [33, 6500, 17000, 22000],
  55: [23, 9000, 26000, 42000],
  56: [22, 6000, 8000, 11000],
  57: [20, 2750, 10000, 13000],
  58: [19, 5500, 17500, 31000],
  59: [29, 5500, 15000, 22000],
  60: [20, 7000, 16500, 24000],
  61: [29, 10000, 31000, 39000],
  62: [18, 3750, 9500, 12000],
  63: [12, 1500, 4000, 6000],
  64: [19, 10000, 28000, 37000],
  65: [13, 2500, 7000, 11500],
  66: [29, 7000, 17000, 20000],
  67: [23, 2250, 5500, 7500],
  68: [26, 4750, 13500, 17000],
  69: [24, 6000, 27000, 37000],
  70: [27, 13000, 34000, 44000],
  71: [18, 5500, 17500, 29000],
  72: [22, 3250, 11000, 13000],
  73: [24, 13500, 19500, 26000],
  74: [23, 5000, 16500, 22000],
  75: [18, 3000, 9500, 11500],
  76: [27, 2250, 7500, 9000],
  77: [30, 8500, 19500, 25000],
  78: [24, 6500, 21000, 27000],
  79: [21, 5000, 14000, 18500],
  80: [22, 5500, 15000, 19500],
  81: [25, 17000, 42000, 54000],
  82: [23, 9000, 28000, 34000],
  83: [34, 4500, 13000, 14000],
  84: [26, 4750, 14500, 20000],
  85: [20, 8500, 22000, 33000],
  86: [32, 10500, 30000, 38000],
  87: [24, 3250, 9000, 11500],
  88: [31, 4250, 12000, 16000],
  89: [21, 6000, 18000, 25000],
  90: [23, 6500, 19000, 29000],
  91: [30, 6500, 15000, 19000],
  92: [31, 6500, 18500, 25000],
  93: [32, 6000, 14000, 16500],
  94: [26, 3250, 12000, 14000],
  95: [20, 8500, 22000, 33000],
  96: [25, 4750, 13000, 16500],
  97: [29, 9000, 21000, 27000],
  98: [35, 8000, 19000, 20000],
  99: [41, 5500, 15500, 18000],
  100: [44, 7500, 16500, 18000],
  101: [19, 1250, 10500, 18500],
  102: [21, 5500, 17000, 24000],
  103: [22, 6500, 17000, 26000],
  104: [28, 8500, 26000, 35000],
  105: [24, 9000, 10500, 11500],
  106: [24, 9000, 29000, 44000],
  107: [21, 5000, 13000, 20000],
  108: [17, 4250, 14000, 23000],
  109: [12, 1000, 3250, 4500],
  110: [20, 3750, 8500, 12000],
  111: [28, 4250, 14500, 19000],
  112: [20, 14000, 24000, 41000],
  113: [24, 7500, 21000, 28000],
  114: [32, 7500, 23000, 34000],
  115: [25, 3250, 9000, 12500],
  116: [28, 2750, 11500, 17500],
  117: [20, 3000, 9500, 13500],
  118: [22, 5000, 11500, 13500],
  119: [28, 5500, 29000, 43000],
  120: [40, 11500, 26000, 33000],
  121: [12, 3000, 11000, 15000],
  122: [18, 4750, 14500, 18500],
  123: [17, 6500, 22000, 42000],
  124: [13, 2750, 6500, 13000],
  125: [14, 3750, 16000, 26000],
  126: [26, 12000, 36000, 47000],
  127: [14, 4000, 15000, 28000],
  128: [18, 3250, 9000, 12000],
  129: [15, 5500, 19000, 31000],
  130: [20, 11000, 35000, 52000],
  131: [18, 3750, 14500, 23000],
  132: [16, 5000, 33000, 72000],
  133: [20, 5500, 13000, 17000],
  134: [22, 2000, 7500, 10500],
  135: [29, 8000, 25000, 33000],
  136: [22, 6500, 22000, 30000],
  137: [13, 6000, 18500, 30000],
  138: [23, 4250, 13500, 17500],
  139: [17, 4250, 13500, 22000],
  140: [23, 6000, 14000, 18500],
  141: [14, 4500, 17000, 28000],
  142: [22, 7500, 20000, 23000],
  143: [14, 4500, 21000, 30000],
  144: [35, 3250, 10000, 15000],
  145: [16, 9000, 25000, 35000],
  146: [16, 2750, 9500, 11500],
  147: [18, 7500, 21000, 35000],
  148: [20, 6000, 10500, 14500],
  149: [34, 8000, 19500, 26000],
  150: [42, 15000, 35000, 37000],
  151: [12, 1500, 6000, 8000],
  152: [36, 9500, 40000, 57000],
  153: [17, 2750, 8500, 10500],
  154: [18, 9000, 31000, 48000],
  155: [25, 4500, 11000, 13000],
  156: [16, 5000, 24000, 32000],
  157: [15, 3500, 10500, 16000],
  158: [20, 11000, 35000, 52000],
  159: [31, 4250, 10000, 12500],
  160: [24, 8000, 19000, 25000],
  161: [13, 8500, 28000, 41000],
  162: [20, 6500, 17500, 22000],
  163: [30, 8000, 28000, 41000],
  164: [14, 3000, 10000, 14000],
  165: [21, 17000, 42000, 49000],
  166: [24, 2250, 5500, 7500],
  167: [20, 9000, 23000, 31000],
  168: [21, 4750, 12000, 15000],
  169: [28, 6500, 14500, 22000],
  170: [28, 6500, 17500, 26000],
  171: [14, 4750, 16000, 28000],
  172: [28, 7500, 18000, 24000],
  173: [18, 4250, 15000, 24000],
  174: [32, 7000, 15000, 17000],
  175: [17, 1500, 4500, 6000],
  176: [33, 15000, 48000, 66000],
  177: [20, 3500, 8500, 12000],
  178: [20, 11000, 35000, 52000],
  179: [18, 1500, 5000, 8000],
  180: [31, 9500, 32000, 37000],
  181: [19, 4750, 12500, 18500],
  182: [24, 9000, 9500, 11500],
  183: [29, 4000, 11500, 18500],
  184: [18, 2750, 8000, 10500],
  185: [14, 6500, 19500, 28000],
  186: [19, 4500, 11000, 13000],
  187: [20, 9000, 23000, 31000],
  188: [56, 6500, 15000, 18000],
  189: [23, 2750, 7000, 9500],
  190: [23, 4500, 11500, 14500],
  191: [24, 4500, 13000, 15500],
  192: [23, 8000, 23000, 32000],
  193: [29, 2750, 7500, 8500],
  194: [21, 4250, 10500, 13000],
  195: [17, 9500, 25000, 34000],
  196: [16, 2000, 6000, 9500],
  197: [20, 9000, 23000, 31000],
  198: [52, 11000, 25000, 28000],
  199: [23, 4250, 11000, 13000],
  200: [43, 5500, 13500, 16500],
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
  boll: { titel: 'Tennisbollar', text: 'Bollar går inte att matcha. Matcha precis bredvid dem, eller skjut på dem. De stoppar raketer!' },
  happy: {
    titel: 'Happy är med!',
    text: 'Happy matchas som godiset han har runt sig. Han äter i stället för att försvinna. När magen är full: tryck på honom och sedan där han ska hoppa!',
  },
  paket: { titel: 'Överraskningspaket', text: 'Matcha paketen och se vad som finns i. Oftast något bra — men inte alltid.' },
  klocka: {
    titel: 'Väckarklockor',
    text: 'Godis med en klocka räknar ner för varje drag. Ta bort det innan klockan ringer, annars vaknar Happy!',
  },
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
  const bollFlagga = flagga.find((f) => f === 'bollar' || f.startsWith('bollar:'))
  const klockFlagga = flagga.find((f) => f.startsWith('klockor:'))
  const klockTid = klockFlagga ? Number(klockFlagga.slice(8)) : 15
  const paketFlagga = flagga.find((f) => f === 'paket' || f.startsWith('paket:'))
  const boss = flagga.includes('boss')
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
    boss,
    latt: flagga.includes('latt'),
    svarighet: boss || flagga.includes('supersvar') ? 2 : flagga.includes('svar') ? 1 : 0,
    happy: flagga.includes('happy'),
    paket: paketFlagga || lager.includes('paket') ? { chans: paketFlagga?.includes(':') ? Number(paketFlagga.slice(6)) : 0.04, max: 3 } : null,
    tips: tips ? tips.slice(5) : null,
    bollar: bollFlagga ? { chans: bollFlagga.includes(':') ? Number(bollFlagga.slice(7)) : 0.07, max: 6 } : null,
    klockor: klockFlagga || lager.includes('klocka') ? { chans: 0.05, max: 3, tid: klockTid } : null,
  }
})

export const ANTAL_BANOR = BANOR.length

// ---------------------------------------------------- oändliga promenaden

// Efter sista banan tar promenaden aldrig slut. Varje ny bana lånar en
// provspelad bana från de senare världarna, spegelvänd ibland, och blir lite
// snålare på drag ju längre man kommer. Samma nummer ger alltid samma bana.
const OANDLIG_POOL = BANOR.filter((b) => b.nr > 40 && !b.latt && !b.tips && !b.mal.every((m) => m.typ === 'poang'))

export function oandligBana(nr) {
  const n = nr - ANTAL_BANOR // 1, 2, 3 ...
  let fro = 0
  for (const ch of 'oandlig-' + nr) fro = (fro * 31 + ch.charCodeAt(0)) >>> 0
  const rng = skapaRng(fro)
  const bas = OANDLIG_POOL[Math.floor(rng() * OANDLIG_POOL.length)]
  const spegla = rng() < 0.5
  const faktor = Math.max(0.8, 1 - n * 0.004)
  const drag = Math.max(10, Math.round(bas.drag * faktor))
  const stjarnor = bas.stjarnor.map((x) => Math.round((x * faktor) / 250) * 250)
  const mal = bas.mal.map((m) => (m.typ === 'poang' ? { ...m, antal: stjarnor[0] } : { ...m }))
  return {
    ...bas,
    nr,
    oandlig: n,
    bas: bas.nr,
    varld: VARLDAR.length,
    karta: spegla ? bas.karta.map((r) => [...r].reverse().join('')) : bas.karta,
    farger: Math.min(6, bas.farger + (n % 7 === 0 ? 1 : 0)),
    drag,
    stjarnor,
    mal,
    tips: null,
    boss: n % 20 === 0,
    svarighet: n % 20 === 0 ? 2 : n % 7 === 0 ? 1 : 0,
    kott: bas.kott ? { ...bas.kott, utgangar: spegla && bas.kott.utgangar ? bas.kott.utgangar.map((c) => bas.karta[0].length - 1 - c) : bas.kott.utgangar } : null,
  }
}

export const banaNr = (nr) => (nr <= ANTAL_BANOR ? BANOR[nr - 1] : oandligBana(nr))
export const varldFor = (bana) => VARLDAR[bana.varld] || OANDLIG_VARLD

// Dagens bana: samma för alla i dag. Den lånar karta och mål från en av
// banorna efter Trädgården, och brädet slumpas med dagens datum som frö så
// att alla börjar med exakt samma pjäser.
export function dagensBana(dag) {
  let fro = 0
  for (const ch of 'krossen-' + dag) fro = (fro * 31 + ch.charCodeAt(0)) >>> 0
  const rng = skapaRng(fro)
  const kandidater = BANOR.filter((b) => b.nr > BANOR_PER_VARLD && !b.mal.every((m) => m.typ === 'poang'))
  const bas = kandidater[Math.floor(rng() * kandidater.length)]
  return { ...bas, dagens: true, dag, fro, tips: null, boss: false, bas: bas.nr }
}
