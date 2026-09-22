// Registret över alla rötspel.
//
// Lägg till ett spel = lägg till ett objekt här. Inget annat behöver ändras.
//
// Fält:
//   id            unikt, används som nyckel i highscore-databasen. Byt aldrig i efterhand.
//   name          visas på kortet
//   blurb         en rad under namnet i spelvyn
//   category      dyker upp som filter automatiskt
//   accent        tailwind-klass för kortets ikonfärg
//   scoreLabel    vad poängen heter, t.ex. 'poäng', 'meter', 'tid'
//   scoreFormat   'number' | 'time' | 'none'  ('none' = spelet sparar ingen poäng)
//   higherIsBetter  false för tidsspel (minröj m.m.)
//   reglage       vilka inställningar spelet faktiskt använder, t.ex.
//                 ['ljud', 'skak', 'hitstop']. GameShell visar bara dessa.
//                 Utan fältet visas inga reglage alls.
//   idle          true för spel som aldrig tar slut — GameShell hoppar över
//                 resultatrutan med "Igen" men skickar poängen som vanligt
//   forhallande   bredd/höjd-förhållandet på spelytan, t.ex. 300/420 för en
//                 stående plan. Styr hur bred GameShells --spelbredd-variabel
//                 får bli i fullskärm i liggande läge, där höjden är
//                 begränsningen. Saknas fältet antas 1 (kvadratiskt). Bara
//                 relevant för spel som faktiskt använder var(--spelbredd)
//                 istället för ett hårdkodat max-w.
//   load          () => import(...) för React-spel
//   iframe        sökväg till statiskt spel, används istället för load
//
// Ett spel-komponent får propen onGameOver(score) och anropar den när rundan tar slut.

export const GAMES = [
  {
    id: 'krossen',
    name: 'Krossen',
    blurb: 'Matcha tre. Fyra ger raket, fem i L ger bomb, fem i rad ger prisma.',
    category: 'pussel',
    accent: 'text-fuchsia-400',
    scoreLabel: 'poäng',
    scoreFormat: 'number',
    higherIsBetter: true,
    reglage: ['ljud', 'skak', 'hitstop'],
    forhallande: 1,
    load: () => import('./Krossen.jsx'),
  },
  {
    id: 'pinnbollen',
    name: 'Pinnbollen',
    blurb: 'Sikta och släpp kulan. Träffa alla orange pinnar.',
    category: 'arkad',
    accent: 'text-orange-400',
    scoreLabel: 'poäng',
    scoreFormat: 'number',
    higherIsBetter: true,
    reglage: ['ljud', 'skak'],
    forhallande: 300 / 420,
    load: () => import('./Pinnbollen.jsx'),
  },
  {
    id: 'rotblast',
    name: 'Rötblast',
    blurb: 'Lägg ut tre bitar i taget. Fyll en rad eller kolumn så sprängs den.',
    category: 'pussel',
    accent: 'text-cyan-400',
    scoreLabel: 'poäng',
    scoreFormat: 'number',
    higherIsBetter: true,
    forhallande: 1,
    load: () => import('./Rotblast.jsx'),
  },
  {
    id: 'happys-revir',
    name: 'Happys revir',
    blurb: 'En Happy per revir, rad och kolumn. Nytt dagligt bräde varje dag.',
    category: 'pussel',
    accent: 'text-pink-400',
    scoreFormat: 'none',
    reglage: ['ljud', 'skak'],
    load: () => import('./HappysRevir.jsx'),
  },

  // --- Exempel: spel från GitHub som iframe ---
  // Bygg spelet, lägg de statiska filerna i frontend/public/spel/<id>/
  //
  // {
  //   id: 'nagot',
  //   name: 'Något',
  //   blurb: 'En rad om hur man spelar.',
  //   category: 'arkad',
  //   accent: 'text-blue-400',
  //   scoreFormat: 'none',
  //   iframe: '/spel/nagot/index.html',
  // },
]

export const CATEGORIES = ['alla', ...new Set(GAMES.map((g) => g.category).filter(Boolean))]

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null
}
