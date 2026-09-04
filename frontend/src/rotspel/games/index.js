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
//   load          () => import(...) för React-spel
//   iframe        sökväg till statiskt spel, används istället för load
//
// Ett spel-komponent får propen onGameOver(score) och anropar den när rundan tar slut.

export const GAMES = [
  {
    id: 'snake',
    name: 'Snake',
    blurb: 'Svep eller piltangenter. Kör i väggen och du är död.',
    category: 'arkad',
    accent: 'text-green-400',
    scoreLabel: 'poäng',
    scoreFormat: 'number',
    higherIsBetter: true,
    load: () => import('./Snake.jsx'),
  },
  {
    id: 'stacktower',
    name: 'Torn',
    blurb: 'Peka för att släppa blocket. Överhänget kapas.',
    category: 'arkad',
    accent: 'text-teal-400',
    scoreLabel: 'block',
    scoreFormat: 'number',
    higherIsBetter: true,
    load: () => import('./StackTower.jsx'),
  },
  {
    id: 'stoppet',
    name: 'Stoppet',
    blurb: 'Stanna visaren i den gröna zonen. Zonen krymper.',
    category: 'reflex',
    accent: 'text-pink-400',
    scoreLabel: 'träffar',
    scoreFormat: 'number',
    higherIsBetter: true,
    load: () => import('./Stoppet.jsx'),
  },
  {
    id: 'simon',
    name: 'Färgminne',
    blurb: 'Upprepa sekvensen. Den blir ett steg längre varje gång.',
    category: 'reflex',
    accent: 'text-red-400',
    scoreLabel: 'rundor',
    scoreFormat: 'number',
    higherIsBetter: true,
    reglage: ['ljud'],
    load: () => import('./Simon.jsx'),
  },
  {
    id: '2048',
    name: '2048',
    blurb: 'Svep för att slå ihop brickor. Du stannar inte vid 2048.',
    category: 'pussel',
    accent: 'text-amber-400',
    scoreLabel: 'poäng',
    scoreFormat: 'number',
    higherIsBetter: true,
    load: () => import('./Game2048.jsx'),
  },
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
    load: () => import('./Krossen.jsx'),
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
    load: () => import('./Rotblast.jsx'),
  },
  {
    id: 'klickern',
    name: 'Klickern',
    blurb: 'Klicka fram avgångar. Uppgradera. Nollställ för guldkort.',
    category: 'idle',
    accent: 'text-purple-400',
    scoreLabel: 'avgångar',
    scoreFormat: 'number',
    higherIsBetter: true,
    idle: true,
    load: () => import('./Klickern.jsx'),
  },
  {
    id: 'sandladan',
    name: 'Sandlådan',
    blurb: 'Rita med sand, vatten, eld och växter. Ingen poäng, bara pill.',
    category: 'sandlåda',
    accent: 'text-orange-400',
    scoreFormat: 'none',
    load: () => import('./Sandladan.jsx'),
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
