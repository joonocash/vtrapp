import { lazy } from 'react';
import { TramFront, Grid3x3, VenetianMask, Gamepad2, Truck } from 'lucide-react';
import DeparturesPage from '../components/DeparturesPage.jsx';

export const SAJTNAMN = 'vtrapp';

// Alla appar i menyn. Ny app = ny rad här.
//
//   id      hamnar i adressen (#/id) — byt inte i efterhand, länkar slutar funka
//   namn    visas i menyn och fliktiteln
//   ikon    lucide-react-ikon
//   bredd   hur mycket av skärmen appen får:
//             'normal' — centrerad kolumn (max ~1150 px)
//             'spel'   — som normal men nästan kant-i-kant på mobil (Agenter)
//             'smal'   — telefonkolumn, kant-i-kant på mobil (Imposter)
//             'full'   — hela bredden (Cassie behöver plats för karta + panel)
//
// Allt utom startsidan laddas först när man går dit, så Cassies three.js och
// spelen inte gör förstasidan långsam.
export const APPAR = [
  {
    id: 'avgangar',
    namn: 'Avgångar',
    ikon: TramFront,
    bredd: 'normal',
    Komponent: DeparturesPage,
  },
  {
    id: 'agenter',
    namn: 'Agenter',
    ikon: Grid3x3,
    bredd: 'spel',
    Komponent: lazy(() => import('../components/agents/AgentsGame.jsx')),
  },
  {
    id: 'imposter',
    namn: 'Imposter',
    ikon: VenetianMask,
    bredd: 'smal',
    Komponent: lazy(() => import('../components/ImpostorGame.jsx')),
  },
  {
    id: 'rotspel',
    namn: 'Rötspel',
    ikon: Gamepad2,
    bredd: 'normal',
    Komponent: lazy(() => import('../rotspel/RotspelPage.jsx')),
  },
  {
    id: 'cassie',
    namn: 'Cassie',
    ikon: Truck,
    bredd: 'full',
    Komponent: lazy(() => import('../cassie/CassiePage.jsx')),
  },
];

export const STARTAPP = APPAR[0];

// Gamla flik-id:n från innan appen låg i adressen, ifall någon sparat en länk.
const ALIAS = { departures: 'avgangar', agents: 'agenter', 'rötspel': 'rotspel' };

export function hittaApp(id) {
  const rent = ALIAS[id] || id;
  return APPAR.find((a) => a.id === rent) || null;
}

// En Cassie-länk utan hash (t.ex. ?r=min-rutt från innan hash-routingen)
// ska öppna Cassie, inte startsidan.
export function gissaAppUtanHash() {
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.has('r') || p.has('from') || p.has('to')) return hittaApp('cassie');
  } catch {
    // ingen query
  }
  return STARTAPP;
}
