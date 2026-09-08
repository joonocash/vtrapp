// Krafterna i Pinnbollen. Ren data och en dragning — inga beroenden, inget
// tillstånd. Motorn importerar den här filen och tillämpar effekterna;
// komponenten importerar den för att rita lådan.
//
// Sällsynthetsgraden gör lådan meningsfull. Öppnar man den och alltid får
// något likvärdigt finns det ingen anledning att bry sig om vad som kom.

export const GRADER = {
  vanlig: { namn: 'Vanlig', farg: '#60a5fa', bakgrund: '#172554' },
  ovanlig: { namn: 'Ovanlig', farg: '#a855f7', bakgrund: '#2e1065' },
  sallsynt: { namn: 'Sällsynt', farg: '#fbbf24', bakgrund: '#451a03' },
}

// vikt är relativ chans inom hela tabellen, inte procent
export const KRAFTER = [
  {
    id: 'extra',
    namn: 'Extra kula',
    grad: 'vanlig',
    vikt: 30,
    text: 'En kula till i lagret.',
    // gäller direkt, inte nästa skott
    direkt: true,
  },
  {
    id: 'hink',
    namn: 'Bred hink',
    grad: 'vanlig',
    vikt: 25,
    text: 'Hinken blir dubbelt så bred nästa skott.',
  },
  {
    id: 'stor',
    namn: 'Storkula',
    grad: 'ovanlig',
    vikt: 14,
    text: 'Kulan blir dubbelt så stor och träffar mycket mer.',
  },
  {
    id: 'magnet',
    namn: 'Magnet',
    grad: 'ovanlig',
    vikt: 11,
    text: 'Kulan dras mot närmaste orange pinne.',
  },
  {
    id: 'golv',
    namn: 'Studsgolv',
    grad: 'ovanlig',
    vikt: 8,
    text: 'En gratis studs från botten, en gång.',
  },
  {
    id: 'trippel',
    namn: 'Trippel',
    grad: 'sallsynt',
    vikt: 7,
    text: 'Kulan delas i tre som studsar var för sig.',
  },
  {
    id: 'genom',
    namn: 'Genomborrare',
    grad: 'sallsynt',
    vikt: 5,
    text: 'Kulan går rakt igenom pinnarna utan att studsa.',
  },
]

export const TOTALVIKT = KRAFTER.reduce((s, k) => s + k.vikt, 0)

export function kraftMedId(id) {
  return KRAFTER.find((k) => k.id === id) || null
}

// rnd injiceras så tester kan vara deterministiska.
export function draKraft(rnd = Math.random) {
  let r = rnd() * TOTALVIKT
  for (const k of KRAFTER) {
    r -= k.vikt
    if (r <= 0) return k
  }
  return KRAFTER[KRAFTER.length - 1]
}

// Sammanlagd chans per grad, för att visa i lådan och för att testa att
// vikterna summerar som avsett.
export function chansPerGrad() {
  const ut = {}
  for (const g of Object.keys(GRADER)) {
    const vikt = KRAFTER.filter((k) => k.grad === g).reduce((s, k) => s + k.vikt, 0)
    ut[g] = Math.round((vikt / TOTALVIKT) * 100)
  }
  return ut
}
