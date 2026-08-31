// Motorn för Krossen. Ren logik, ingen React, inga DOM-anrop.
//
// Anledningen att den ligger separat: match-3 är den enda delen av spelet
// som är svår att få rätt, och den går att testa utan att rendera något.
// Komponenten sköter animation och input, den här filen sköter reglerna.
//
// Brickor: { id, color, special }
//   special: null | 'raket-h' | 'raket-v' | 'bomb' | 'prisma'
//
// Regler för att skapa specialbrickor:
//   4 i rad            -> raket (rensar hela raden eller kolumnen)
//   5 i L eller T      -> bomb (3x3 två gånger)
//   5 i rad            -> prisma (tar alla brickor av en färg)
//
// Kombinationer när två specialbrickor byts med varandra:
//   raket + raket      -> kors: hela raden och hela kolumnen
//   raket + bomb       -> tre rader och tre kolumner
//   bomb + bomb        -> 5x5
//   prisma + raket     -> alla av den färgen blir raketer och smäller
//   prisma + bomb      -> alla av den färgen blir bomber och smäller
//   prisma + prisma    -> hela brädet
//   prisma + vanlig    -> alla av den vanligas färg

export const SIZE = 8
export const COLORS = 6

let nextId = 1
function makeTile(color, special = null) {
  return { id: nextId++, color, special }
}

export function resetIds() {
  nextId = 1
}

const idx = (r, c) => r * SIZE + c
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

export function cloneBoard(board) {
  return board.map((t) => (t ? { ...t } : null))
}

// ---------------------------------------------------------------- matchning

// Hittar alla löpor på tre eller fler. Returnerar { horisontella, vertikala }
// där varje löpa är en lista av index.
function findRuns(board) {
  const horisontella = []
  const vertikala = []

  for (let r = 0; r < SIZE; r++) {
    let run = [idx(r, 0)]
    for (let c = 1; c < SIZE; c++) {
      const here = board[idx(r, c)]
      const prev = board[idx(r, c - 1)]
      if (here && prev && here.color === prev.color) {
        run.push(idx(r, c))
      } else {
        if (run.length >= 3) horisontella.push(run)
        run = [idx(r, c)]
      }
    }
    if (run.length >= 3) horisontella.push(run)
  }

  for (let c = 0; c < SIZE; c++) {
    let run = [idx(0, c)]
    for (let r = 1; r < SIZE; r++) {
      const here = board[idx(r, c)]
      const prev = board[idx(r - 1, c)]
      if (here && prev && here.color === prev.color) {
        run.push(idx(r, c))
      } else {
        if (run.length >= 3) vertikala.push(run)
        run = [idx(r, c)]
      }
    }
    if (run.length >= 3) vertikala.push(run)
  }

  return { horisontella, vertikala }
}

export function hasMatch(board) {
  const { horisontella, vertikala } = findRuns(board)
  return horisontella.length > 0 || vertikala.length > 0
}

// Grupperar löpor som korsar varandra. En L- eller T-form är en horisontell
// och en vertikal löpa som delar minst ett index.
//
// Returnerar en lista av grupper: { celler: Set, hRun, vRun, langd }
function groupRuns(board) {
  const { horisontella, vertikala } = findRuns(board)
  const grupper = []
  const anvandaV = new Set()

  for (const h of horisontella) {
    const hSet = new Set(h)
    let korsande = null

    for (let i = 0; i < vertikala.length; i++) {
      if (anvandaV.has(i)) continue
      if (vertikala[i].some((v) => hSet.has(v))) {
        korsande = i
        break
      }
    }

    if (korsande !== null) {
      anvandaV.add(korsande)
      const celler = new Set([...h, ...vertikala[korsande]])
      grupper.push({
        celler,
        hRun: h,
        vRun: vertikala[korsande],
        korsning: true,
      })
    } else {
      grupper.push({ celler: new Set(h), hRun: h, vRun: null, korsning: false })
    }
  }

  vertikala.forEach((v, i) => {
    if (anvandaV.has(i)) return
    grupper.push({ celler: new Set(v), hRun: null, vRun: v, korsning: false })
  })

  return grupper
}

// Vad ska gruppen ge för specialbricka, och var?
// swapIndex är rutan spelaren själv flyttade — specialbrickan hamnar där om
// den ingår i gruppen, annars mitt i löpan. Det känns rättvist: du får din
// belöning där du tryckte.
function specialForGroup(grupp, swapIndex) {
  const antal = grupp.celler.size

  let special = null
  if (grupp.korsning && antal >= 5) {
    special = 'bomb'
  } else if (grupp.hRun && grupp.hRun.length >= 5) {
    special = 'prisma'
  } else if (grupp.vRun && grupp.vRun.length >= 5) {
    special = 'prisma'
  } else if (grupp.hRun && grupp.hRun.length === 4) {
    special = 'raket-h'
  } else if (grupp.vRun && grupp.vRun.length === 4) {
    special = 'raket-v'
  }

  if (!special) return null

  const plats =
    swapIndex !== null && grupp.celler.has(swapIndex)
      ? swapIndex
      : [...grupp.celler][Math.floor(grupp.celler.size / 2)]

  return { special, plats }
}

// ------------------------------------------------------- specialaktivering

// Räknar ut vilka rutor en specialbricka träffar. Aktiverar kedjor: träffar
// den en annan specialbricka aktiveras även den.
//
// redanAktiverade skyddar mot oändliga loopar när två specialbrickor pekar
// på varandra.
export function detonate(board, start, redanAktiverade = new Set()) {
  const traffade = new Set()
  const ko = [start]

  while (ko.length > 0) {
    const i = ko.shift()
    if (redanAktiverade.has(i)) continue
    const tile = board[i]
    if (!tile) continue

    redanAktiverade.add(i)
    traffade.add(i)

    const r = Math.floor(i / SIZE)
    const c = i % SIZE

    let nya = []

    if (tile.special === 'raket-h') {
      for (let x = 0; x < SIZE; x++) nya.push(idx(r, x))
    } else if (tile.special === 'raket-v') {
      for (let y = 0; y < SIZE; y++) nya.push(idx(y, c))
    } else if (tile.special === 'bomb') {
      // 3x3 två gånger blir i praktiken 5x5 med tunnare kanter — vi kör
      // 3x3 här och låter komponenten spela upp det som två smällar
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (inside(r + dr, c + dc)) nya.push(idx(r + dr, c + dc))
        }
      }
    } else if (tile.special === 'prisma') {
      // ensam prisma som råkar sprängas tar den vanligaste färgen
      const rakning = new Array(COLORS).fill(0)
      board.forEach((t) => {
        if (t && !t.special) rakning[t.color]++
      })
      const farg = rakning.indexOf(Math.max(...rakning))
      board.forEach((t, j) => {
        if (t && t.color === farg) nya.push(j)
      })
    }

    for (const j of nya) {
      traffade.add(j)
      const t = board[j]
      if (t && t.special && !redanAktiverade.has(j)) ko.push(j)
    }
  }

  return traffade
}

// Kombination av två specialbrickor som byts direkt med varandra.
// Returnerar { traffade: Set, beskrivning } eller null om det inte är en kombo.
export function comboEffect(board, a, b) {
  const ta = board[a]
  const tb = board[b]
  if (!ta || !tb) return null

  const sa = ta.special
  const sb = tb.special
  if (!sa && !sb) return null

  const arRaket = (s) => s === 'raket-h' || s === 'raket-v'
  const traffade = new Set()
  const rad = Math.floor(b / SIZE)
  const kol = b % SIZE

  const laggRad = (r) => {
    if (r < 0 || r >= SIZE) return
    for (let x = 0; x < SIZE; x++) traffade.add(idx(r, x))
  }
  const laggKol = (c) => {
    if (c < 0 || c >= SIZE) return
    for (let y = 0; y < SIZE; y++) traffade.add(idx(y, c))
  }

  // prisma + prisma: hela brädet
  if (sa === 'prisma' && sb === 'prisma') {
    board.forEach((t, i) => t && traffade.add(i))
    return { traffade, beskrivning: 'Hela brädet', omvandla: null }
  }

  // prisma + special: alla av den färgen blir den specialtypen och smäller
  if (sa === 'prisma' || sb === 'prisma') {
    const andra = sa === 'prisma' ? tb : ta
    const prismaIndex = sa === 'prisma' ? a : b

    if (andra.special && arRaket(andra.special)) {
      return {
        traffade: new Set([prismaIndex]),
        beskrivning: 'Alla blir raketer',
        omvandla: { farg: andra.color, till: 'raket', prismaIndex },
      }
    }
    if (andra.special === 'bomb') {
      return {
        traffade: new Set([prismaIndex]),
        beskrivning: 'Alla blir bomber',
        omvandla: { farg: andra.color, till: 'bomb', prismaIndex },
      }
    }

    // prisma + vanlig bricka: alla av den färgen bort
    board.forEach((t, i) => {
      if (t && t.color === andra.color) traffade.add(i)
    })
    traffade.add(prismaIndex)
    return { traffade, beskrivning: 'Färgen bort', omvandla: null }
  }

  // raket + raket: kors
  if (arRaket(sa) && arRaket(sb)) {
    laggRad(rad)
    laggKol(kol)
    return { traffade, beskrivning: 'Kors', omvandla: null }
  }

  // raket + bomb: tre rader och tre kolumner
  if ((arRaket(sa) && sb === 'bomb') || (sa === 'bomb' && arRaket(sb))) {
    laggRad(rad - 1)
    laggRad(rad)
    laggRad(rad + 1)
    laggKol(kol - 1)
    laggKol(kol)
    laggKol(kol + 1)
    return { traffade, beskrivning: 'Trippelkors', omvandla: null }
  }

  // bomb + bomb: 5x5
  if (sa === 'bomb' && sb === 'bomb') {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (inside(rad + dr, kol + dc)) traffade.add(idx(rad + dr, kol + dc))
      }
    }
    return { traffade, beskrivning: 'Storsmäll', omvandla: null }
  }

  return null
}

// ------------------------------------------------------------ brädoperationer

// Låter brickor falla ner i tomma rutor och fyller på uppifrån.
// Returnerar { board, fall } där fall är en map index -> antal steg brickan
// föll, så komponenten kan animera.
export function applyGravity(board) {
  const nytt = cloneBoard(board)
  const fall = new Map()

  for (let c = 0; c < SIZE; c++) {
    let skrivRad = SIZE - 1

    for (let r = SIZE - 1; r >= 0; r--) {
      const tile = nytt[idx(r, c)]
      if (tile) {
        if (skrivRad !== r) {
          nytt[idx(skrivRad, c)] = tile
          nytt[idx(r, c)] = null
          fall.set(idx(skrivRad, c), skrivRad - r)
        }
        skrivRad--
      }
    }

    // fyll på uppifrån
    for (let r = skrivRad; r >= 0; r--) {
      nytt[idx(r, c)] = makeTile(Math.floor(Math.random() * COLORS))
      fall.set(idx(r, c), skrivRad + 1)
    }
  }

  return { board: nytt, fall }
}

// Skapar ett bräde utan färdiga matchningar och med minst ett giltigt drag.
export function createBoard() {
  let board
  let forsok = 0
  do {
    board = []
    for (let i = 0; i < SIZE * SIZE; i++) {
      board.push(makeTile(Math.floor(Math.random() * COLORS)))
    }
    // ta bort startmatchningar genom att färga om
    let varv = 0
    while (hasMatch(board) && varv++ < 200) {
      const grupper = groupRuns(board)
      for (const g of grupper) {
        const i = [...g.celler][0]
        board[i] = makeTile(Math.floor(Math.random() * COLORS))
      }
    }
    forsok++
  } while (!hasValidMove(board) && forsok < 40)

  return board
}

// Finns det något byte som ger en matchning?
export function hasValidMove(board) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const i = idx(r, c)
      const tile = board[i]
      if (tile && tile.special) return true

      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ]) {
        if (!inside(r + dr, c + dc)) continue
        const j = idx(r + dr, c + dc)
        const test = cloneBoard(board)
        const tmp = test[i]
        test[i] = test[j]
        test[j] = tmp
        if (hasMatch(test)) return true
        // två specialbrickor bredvid varandra är alltid ett giltigt drag
        if (board[i]?.special && board[j]?.special) return true
      }
    }
  }
  return false
}

// Blandar om brädet utan att skapa matchningar. Används när det inte finns
// några drag kvar — mycket bättre än att avsluta rundan, eftersom det inte
// var spelarens fel.
export function shuffle(board) {
  const brickor = board.filter(Boolean)
  let forsok = 0
  let nytt

  do {
    for (let i = brickor.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = brickor[i]
      brickor[i] = brickor[j]
      brickor[j] = tmp
    }
    nytt = [...brickor]
    forsok++
  } while ((hasMatch(nytt) || !hasValidMove(nytt)) && forsok < 60)

  // Omblandningen lyckas inte alltid inom 60 forsok — brickornas fargfordelning
  // kan gora det svart att undvika lopor. Att da returnera ett brade med en
  // fardig matchning bryter funktionens kontrakt, sa vi delar ut ett helt nytt
  // brade i stallet. Spelaren blir andå raddad, vilket ar hela poangen.
  if (hasMatch(nytt) || !hasValidMove(nytt)) return createBoard()

  return nytt
}

// ------------------------------------------------------------ dragupplösning

// Räknar ut vad ett byte leder till. Muterar inte board.
//
// Returnerar null om bytet är ogiltigt, annars:
//   { traffade, specialer, kombo }
// där specialer är [{ plats, special }] som ska skapas efter rensningen.
export function planSwap(board, a, b) {
  const test = cloneBoard(board)
  const tmp = test[a]
  test[a] = test[b]
  test[b] = tmp

  // kombination av specialbrickor först — de kräver ingen matchning
  const kombo = comboEffect(test, b, a)
  if (kombo) return { ...kombo, board: test, kombo: true }

  // prisma som byts med en vanlig bricka
  const prismaIndex = test[a]?.special === 'prisma' ? a : test[b]?.special === 'prisma' ? b : null
  if (prismaIndex !== null) {
    const andra = test[prismaIndex === a ? b : a]
    if (andra && !andra.special) {
      const traffade = new Set([prismaIndex])
      test.forEach((t, i) => {
        if (t && t.color === andra.color) traffade.add(i)
      })
      return { traffade, beskrivning: 'Färgen bort', omvandla: null, board: test, kombo: true }
    }
  }

  if (!hasMatch(test)) return null

  return { board: test, kombo: false }
}

// Löser ut alla matchningar på brädet en gång. Anropas i loop av komponenten
// för att få kaskader.
//
// swapIndex används för att placera nya specialbrickor där spelaren tryckte.
export function resolveMatches(board, swapIndex = null) {
  const grupper = groupRuns(board)
  if (grupper.length === 0) return null

  const traffade = new Set()
  const specialer = []
  const redanAktiverade = new Set()

  for (const grupp of grupper) {
    for (const i of grupp.celler) traffade.add(i)

    const spec = specialForGroup(grupp, swapIndex)
    if (spec) specialer.push(spec)
  }

  // aktivera specialbrickor som råkar ligga i det som rensas
  for (const i of [...traffade]) {
    const tile = board[i]
    if (tile && tile.special && !redanAktiverade.has(i)) {
      for (const j of detonate(board, i, redanAktiverade)) traffade.add(j)
    }
  }

  // en ruta som ska bli en ny specialbricka får inte rensas bort
  for (const s of specialer) traffade.delete(s.plats)

  return { traffade, specialer, antal: traffade.size }
}

// Tar bort träffade rutor och sätter dit nya specialbrickor.
export function applyClear(board, traffade, specialer) {
  const nytt = cloneBoard(board)
  for (const i of traffade) nytt[i] = null
  for (const s of specialer) {
    const farg = board[s.plats]?.color ?? Math.floor(Math.random() * COLORS)
    nytt[s.plats] = makeTile(farg, s.special)
  }
  return nytt
}

// Omvandlar alla brickor av en färg till en specialtyp (prisma-komborna).
export function applyOmvandla(board, omvandla) {
  const nytt = cloneBoard(board)
  const platser = []

  nytt.forEach((t, i) => {
    if (!t || t.color !== omvandla.farg || t.special) return
    if (omvandla.till === 'raket') {
      t.special = Math.random() < 0.5 ? 'raket-h' : 'raket-v'
    } else {
      t.special = 'bomb'
    }
    platser.push(i)
  })

  return { board: nytt, platser }
}

export function poangFor(antal, kaskad) {
  // 60 per bricka, gånger kaskadnivån. Tredje kaskaden i rad är värd tre
  // gånger så mycket som den första — det är där känslan sitter.
  return Math.round(antal * 60 * kaskad)
}

// Alla specialbrickor på brädet, sorterade uppifrån och ner.
// Finalen behöver veta vad som ligger kvar när dragen tar slut.
export function listSpecials(board) {
  const ut = []
  board.forEach((t, i) => {
    if (t && t.special) ut.push({ index: i, special: t.special, color: t.color })
  })
  return ut
}

// Samma sökning som hasValidMove, men returnerar VILKET drag den hittade
// i stället för bara true. Används till tips-animationen efter en stunds
// stillhet.
//
// Returnerar { a, b, celler } eller null. celler är rutorna som skulle
// matcha, så tipset kan vagga rätt brickor.
export function findHint(board) {
  const idx = (r, c) => r * SIZE + c
  const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const i = idx(r, c)

      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ]) {
        if (!inside(r + dr, c + dc)) continue
        const j = idx(r + dr, c + dc)

        // två specialbrickor bredvid varandra är alltid ett giltigt drag
        if (board[i]?.special && board[j]?.special) {
          return { a: i, b: j, celler: [i, j] }
        }

        const test = cloneBoard(board)
        const tmp = test[i]
        test[i] = test[j]
        test[j] = tmp

        if (hasMatch(test)) {
          // hitta vilka rutor som faktiskt skulle matcha, så tipset vaggar rätt
          const res = resolveMatches(test, j)
          const celler = res ? [...res.traffade].slice(0, 5) : [i, j]
          return { a: i, b: j, celler }
        }
      }
    }
  }
  return null
}

// Som applyGravity, men returnerar också en flyttlista som animationslagret
// kan använda. Varje post säger var brickan hamnade och vilken rad den kom
// ifrån — negativ rad betyder att den är ny och kom in ovanför brädet.
export function planGravity(board) {
  const nytt = cloneBoard(board)
  const moves = []

  for (let c = 0; c < SIZE; c++) {
    let skrivRad = SIZE - 1

    for (let r = SIZE - 1; r >= 0; r--) {
      const tile = nytt[r * SIZE + c]
      if (tile) {
        if (skrivRad !== r) {
          nytt[skrivRad * SIZE + c] = tile
          nytt[r * SIZE + c] = null
        }
        moves.push({ till: skrivRad * SIZE + c, franRad: r })
        skrivRad--
      }
    }

    let ovanfor = -1
    for (let r = skrivRad; r >= 0; r--) {
      // makeTile ligger i samma fil och ger unika id via modulens räknare
      nytt[r * SIZE + c] = makeTile(Math.floor(Math.random() * COLORS))
      moves.push({ till: r * SIZE + c, franRad: ovanfor-- })
    }
  }

  return { board: nytt, moves }
}
