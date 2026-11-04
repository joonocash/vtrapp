// Kulkaos — bossarna. Ingen DOM.
//
// En bossbana avslutar varje akt. Bossen är en stor pinne med en livmätare
// (bana.boss.hp) som aldrig tänds: efter varje skott tar den skada av allt
// skottet tände (blå 1, orange 2, grön 3, lila 5) och av varje direktträff
// (4). När det mesta är borta fylls planen på igen. Bossen är besegrad när
// livet är slut, och rundan är slut om kulorna tar slut innan dess.
//
// Sex bossar, två per akt (niva). Varje boss har sina attacker mellan
// skotten (motor.js: bossAttack) och släpper sin egen relik (BOSSRELIKER).

import { P, ring, linje, gitter, tegelLinje, iGrupp, byggObjekt } from '../pinnboll/former.js'

const boss = (x, y, r, o = {}) => ({ typ: 'pinne', form: 'cirkel', x, y, r, boss: true, ejOrange: true, ...o })

// Liv per boss (akt 1, 2, 3). Efter seger kommer de tillbaka, starkare.
export const BOSS_HP = [120, 260, 450]
// arc(cx, cy, R, n, a0, a1): pinnar längs en båge (grader), utan de som hamnar utanför planen
const bage = (cx, cy, R, n, a0, a1) => ring(cx, cy, R, n, a0, a1).filter((o) => o.x > 16 && o.x < 344 && o.y > 96 && o.y < 546)

export const BOSSAR = [
  {
    id: 'rattkungen',
    namn: 'Råttkungen',
    ikon: '🐀',
    niva: 1,
    varld: 3,
    attacker: ['stenar'],
    relik: 'ost',
    text: 'Springer fram och tillbaka och gnager fram stenar',
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
    niva: 2,
    varld: 2,
    attacker: ['skold'],
    relik: 'skal',
    text: 'Viftar med klorna och gömmer sig bakom sitt skal',
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
    niva: 3,
    varld: 4,
    attacker: ['flytta', 'stenar'],
    relik: 'trollkula',
    text: 'Går runt i en snurrande ring och flyttar de orange pinnarna',
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
  {
    id: 'spindeln',
    namn: 'Spindeldrottningen',
    ikon: '🕷️',
    niva: 1,
    varld: 3,
    attacker: ['slem'],
    relik: 'nat',
    text: 'Gungar i sin tråd och slemmar ner pinnarna',
    bygg() {
      // spindeln gungar i en tråd från (180, 96); nätet sitter under henne
      const b = iGrupp(0, [boss(180, 226, 27)])
      const nat = [...bage(180, 400, 70, 10, 0, 360), ...bage(180, 400, 125, 18, 0, 360), P(180, 400)]
      for (const a of [30, 90, 150, 210, 270, 330]) {
        const v = (a * Math.PI) / 180
        nat.push(P(180 + Math.cos(v) * 98, 400 + Math.sin(v) * 98))
      }
      const pinnar = [...linje(40, 120, 120, 120, 3), ...linje(240, 120, 320, 120, 3), ...linje(26, 170, 26, 280, 4), ...linje(334, 170, 334, 280, 4)]
      return { objekt: [...b, ...nat, ...pinnar], grupper: [{ typ: 'pendel', cx: 180, cy: 96, A: 0.42, T: 4.2 }] }
    },
  },
  {
    id: 'stormfageln',
    namn: 'Stormfågeln',
    ikon: '🦅',
    niva: 2,
    varld: 0,
    attacker: ['flytta', 'hela'],
    relik: 'fjader',
    text: 'Flyger runt i cirklar och blåser omkring de orange pinnarna',
    bygg() {
      // fågeln flyger runt (180, 250) med radien 85
      const b = iGrupp(0, [boss(265, 250, 27)])
      const pinnar = [
        ...linje(40, 112, 320, 112, 9),
        P(180, 250),
        ...bage(180, 250, 30, 6, 0, 360),
        ...linje(24, 190, 24, 330, 5),
        ...linje(336, 190, 336, 330, 5),
        ...gitter(34, 392, 9, 5, 36.5, 34),
      ]
      return { objekt: [...b, ...pinnar], grupper: [{ typ: 'bana', R: 85, T: 6.5, fas: 0 }] }
    },
  },
  {
    id: 'draken',
    namn: 'Kaosdraken',
    ikon: '🐉',
    niva: 3,
    varld: 4,
    attacker: ['skold', 'stenar', 'slem', 'hela'],
    relik: 'drakhjarta',
    hpX: 0.9,
    text: 'Snurrar sina vingar, gömmer sig, slemmar, lägger stenar och läker sig',
    bygg() {
      // två snurrande vingar som slår undan kulan (hårda, tänds aldrig)
      const b = boss(180, 250, 31)
      const vingar = iGrupp(0, [...tegelLinje(222, 250, 300, 250, 2, { hard: true, kick: 330 }), ...tegelLinje(138, 250, 60, 250, 2, { hard: true, kick: 330 })])
      const pinnar = [...linje(40, 112, 320, 112, 9), ...linje(58, 146, 302, 146, 8), ...linje(20, 210, 20, 300, 3), ...linje(340, 210, 340, 300, 3), ...gitter(32, 392, 10, 5, 32.9, 34)]
      return { objekt: [b, ...vingar, ...pinnar], grupper: [{ typ: 'rotera', cx: 180, cy: 250, w: 1.1 }] }
    },
  },
]

// Bossarna i akt nr: två att välja mellan (rundan väljer en med sitt frö).
export const bossarIAkt = (akt) => BOSSAR.filter((b) => b.niva === ((akt - 1) % 3) + 1)

// Bossbanan i akt nr (1, 2, 3, 4 …). Efter akt 3 börjar bossarna om, med
// mer liv för varje varv. hpFaktor kommer från svårigheten, val väljer
// vilken av aktens två bossar det blir (eller id direkt).
export function bossBana(akt, { hpFaktor = 1, orange = 10, val = 0, id = null } = {}) {
  const pool = bossarIAkt(akt)
  const d = (id && BOSSAR.find((b) => b.id === id)) || pool[val % pool.length]
  const i = d.niva - 1
  const varv = Math.floor((akt - 1) / 3)
  const { objekt, grupper } = d.bygg()
  const byggd = byggObjekt(objekt, { orange })
  const hp = Math.round(BOSS_HP[i] * Math.pow(1.7, varv) * hpFaktor * (d.hpX || 1))
  return {
    namn: d.namn,
    varld: d.varld,
    kraft: 'small',
    objekt: byggd.objekt,
    grupper,
    orange: byggd.orange,
    guldpinnar: 3,
    boss: { id: d.id, namn: d.namn, ikon: d.ikon, hp, text: d.text, attacker: d.attacker, relik: d.relik },
  }
}
