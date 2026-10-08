// Registret över alla rötspel.
//
// Lägg till ett spel = lägg till ett objekt här. Inget annat behöver ändras.
//
// Fält:
//   id            unikt, används som nyckel i highscore-databasen. Byt aldrig i efterhand.
//   name          visas på kortet
//   blurb         en rad under namnet i spelvyn
//   category      dyker upp som filter automatiskt
//   accent        tailwind-klass för kortets ikonfärg (reserv om farg saknas)
//   ikon          emoji som visas på kortet och i spelets rubrik
//   farg          hex-färg för kortets glöd och ikonruta, t.ex. '#e879f9'
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
    blurb: 'Hjälp Happy få godis! Matcha tre. 100 banor på Happys promenad.',
    category: 'pussel',
    accent: 'text-fuchsia-400',
    ikon: '🦴',
    farg: '#e879f9',
    // Banor med egna stjärnor, sparas i webbläsaren. Ingen topplista.
    scoreFormat: 'none',
    reglage: ['ljud', 'skak', 'hitstop'],
    forhallande: 0.7,
    load: () => import('./Krossen.jsx'),
  },
  {
    id: 'pinnbollen',
    name: 'Pinnbollen',
    blurb: 'Sikta och släpp kulan. Träffa alla orange pinnar.',
    category: 'arkad',
    accent: 'text-orange-400',
    ikon: '🎯',
    farg: '#fb923c',
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
    ikon: '🧱',
    farg: '#22d3ee',
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
    ikon: '🐶',
    farg: '#f472b6',
    scoreFormat: 'none',
    reglage: ['ljud', 'skak'],
    load: () => import('./HappysRevir.jsx'),
  },
  {
    id: 'trassel',
    name: 'Trassel',
    blurb: 'Dra ihop prickarna i samma färg. Fyll hela brädet. Banor, dagens bräde och tidsjakt.',
    category: 'pussel',
    accent: 'text-cyan-400',
    ikon: '🧶',
    farg: '#2dd4bf',
    // Egna topplistor per läge inne i spelet (trassel-dag-<datum>, trassel-tidsjakt).
    scoreFormat: 'none',
    reglage: ['ljud', 'skak'],
    forhallande: 0.72,
    load: () => import('./Trassel.jsx'),
  },
  {
    id: 'pilflykt',
    name: 'Pilflykt',
    blurb: 'Tryck ut pilarna åt rätt håll. Krockar du förlorar du ett hjärta.',
    category: 'pussel',
    accent: 'text-cyan-400',
    ikon: '🏹',
    farg: '#6ee7ff',
    // Banorna sparas i webbläsaren. Topplistan visar högsta klarade bana,
    // spelet skickar in den självt (onGameOver anropas aldrig).
    scoreLabel: 'bana',
    scoreFormat: 'number',
    higherIsBetter: true,
    reglage: ['ljud', 'skak', 'hitstop'],
    forhallande: 0.64,
    load: () => import('./pilar/PilarGame.jsx'),
  },
  {
    id: 'hallplatsen',
    name: 'Hållplatsen',
    blurb: 'Få resenärerna på rätt spårvagn. Tre per vagn — bänken rymmer fem.',
    category: 'pussel',
    accent: 'text-amber-400',
    ikon: '🚋',
    farg: '#facc15',
    scoreLabel: 'bana',
    scoreFormat: 'number',
    higherIsBetter: true,
    reglage: ['ljud', 'skak'],
    forhallande: 0.56,
    load: () => import('./hallplats/HallplatsGame.jsx'),
  },
  {
    id: 'skruvat',
    name: 'Skruvat',
    blurb: 'Skruva loss i rätt ordning. Tre skruvar per låda, plattorna faller.',
    category: 'pussel',
    accent: 'text-orange-400',
    ikon: '🔩',
    farg: '#fb923c',
    scoreLabel: 'bana',
    scoreFormat: 'number',
    higherIsBetter: true,
    reglage: ['ljud', 'skak'],
    forhallande: 0.52,
    load: () => import('./skruv/SkruvGame.jsx'),
  },
  {
    id: 'pixelkanon',
    name: 'Pixelkanon',
    blurb: 'Skicka ut grisarna och skjut sönder pixelbilden. Ladda Superenhörningen. Var sjunde bild är Happy.',
    category: 'pussel',
    accent: 'text-pink-400',
    ikon: '🐷',
    farg: '#ff7ab6',
    scoreLabel: 'bana',
    scoreFormat: 'number',
    higherIsBetter: true,
    reglage: ['ljud', 'skak', 'hitstop'],
    forhallande: 0.5,
    load: () => import('./pixel/PixelGame.jsx'),
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
  //   ikon: '🕹️',
  //   farg: '#60a5fa',
  //   scoreFormat: 'none',
  //   iframe: '/spel/nagot/index.html',
  // },
]

export const CATEGORIES = ['alla', ...new Set(GAMES.map((g) => g.category).filter(Boolean))]

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null
}
