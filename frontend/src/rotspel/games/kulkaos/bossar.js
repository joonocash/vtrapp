// Kulkaos — bossarna. Ingen DOM.
//
// En bossbana avslutar varje akt. Bossen är en stor pinne med en livmätare
// (bana.boss.hp) som aldrig tänds: efter varje skott tar den skada av allt
// skottet tände (blå 1, orange 2, grön 3, lila 5) och av varje direktträff
// (4). När det mesta är borta fylls planen på igen. Bossen är besegrad när
// livet är slut, och rundan är slut om kulorna tar slut innan dess.

import { P, ring, linje, gitter, tegelLinje, iGrupp, byggObjekt } from '../pinnboll/former.js'

const boss = (x, y, r, o = {}) => ({ typ: 'pinne', form: 'cirkel', x, y, r, boss: true, ejOrange: true, ...o })

// Liv per boss (akt 1, 2, 3). Efter seger kommer de tillbaka, starkare.
export const BOSS_HP = [120, 260, 450]

export const BOSSAR = [
  {
    id: 'rattkungen',
    namn: 'Råttkungen',
    ikon: '🐀',
    varld: 3,
    text: 'Springer fram och tillbaka mitt på planen',
    bygg() {
      // bossen glider i sidled längs y = 236: där får inga pinnar ligga
      const b = iGrupp(0, [boss(180, 236, 28)])
      const pinnar = [
        ...linje(40, 128, 320, 128, 9),
        ...linje(58, 162, 302, 162, 8),
        P(26, 236),
        P(334, 236),
        ...gitter(32, 300, 10, 7, 32.9, 34),
      ]
      return { objekt: [...b, ...pinnar], grupper: [{ typ: 'glid', ax: 95, T: 7 }] }
    },
  },
  {
    id: 'krabban',
    namn: 'Krabban Klo',
    ikon: '🦀',
    varld: 2,
    text: 'Viftar med två klor som slår undan kulan',
    bygg() {
      const b = boss(180, 236, 30)
      // klorna pendlar runt varsin led bredvid bossen och slår undan kulan
      // (hårda: de tänds aldrig och försvinner inte)
      const v = iGrupp(0, tegelLinje(146, 250, 92, 300, 2, { hard: true, kick: 300 }))
      const h = iGrupp(1, tegelLinje(214, 250, 268, 300, 2, { hard: true, kick: 300 }))
      const pinnar = [
        ...linje(36, 116, 324, 116, 9),
        ...linje(54, 150, 306, 150, 8),
        ...linje(22, 200, 22, 340, 4),
        ...linje(338, 200, 338, 340, 4),
        ...gitter(36, 380, 9, 5, 36, 34),
      ]
      return {
        objekt: [b, ...v, ...h, ...pinnar],
        grupper: [
          { typ: 'pendel', cx: 146, cy: 250, A: 0.55, T: 2.6 },
          { typ: 'pendel', cx: 214, cy: 250, A: -0.55, T: 2.6 },
        ],
      }
    },
  },
  {
    id: 'trollet',
    namn: 'Pinntrollet',
    ikon: '🧌',
    varld: 4,
    text: 'Går runt i en cirkel innanför en snurrande ring',
    bygg() {
      // bossen går runt mittpunkten (180, 300) med radien 70, och en ring
      // av pinnar snurrar utanför
      const b = iGrupp(0, [boss(250, 300, 28)])
      const ringen = iGrupp(1, ring(180, 300, 140, 20))
      const pinnar = [P(180, 300), ...linje(40, 112, 320, 112, 9), ...gitter(30, 470, 10, 3, 33.3, 30), P(26, 160), P(334, 160), P(26, 430), P(334, 430)]
      return {
        objekt: [...b, ...ringen, ...pinnar],
        grupper: [
          { typ: 'bana', R: 70, T: 8, fas: 0 },
          { typ: 'rotera', cx: 180, cy: 300, w: 0.45 },
        ],
      }
    },
  },
]

// Bossbanan i akt nr (1, 2, 3, 4 …). Efter akt 3 börjar bossarna om, med
// mer liv för varje varv. hpFaktor kommer från svårigheten.
export function bossBana(akt, { hpFaktor = 1, orange = 10 } = {}) {
  const i = (akt - 1) % BOSSAR.length
  const varv = Math.floor((akt - 1) / BOSSAR.length)
  const d = BOSSAR[i]
  const { objekt, grupper } = d.bygg()
  const byggd = byggObjekt(objekt, { orange })
  const hp = Math.round(BOSS_HP[i] * Math.pow(1.7, varv) * hpFaktor)
  return {
    namn: d.namn,
    varld: d.varld,
    kraft: 'small',
    objekt: byggd.objekt,
    grupper,
    orange: byggd.orange,
    guldpinnar: 3,
    boss: { id: d.id, namn: d.namn, ikon: d.ikon, hp, text: d.text },
  }
}
