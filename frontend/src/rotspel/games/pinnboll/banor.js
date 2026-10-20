// Pinnbollen — banorna. Ingen DOM.
//
// Sex världar med fem banor var, som Peggles äventyr. Varje värld har en
// mästare vars kraft de gröna pinnarna ger. Banorna byggs med små hjälpare
// (bågar, linjer, spiraler, kurvade tegel) i en plan som är 360 × 600.
//
// Vinklar anges i grader med y nedåt: 90° är rakt ner, så en halfpipe (ett
// U) är bågen 0°–180°. Pinnar som hamnar för nära något annat tas bort
// automatiskt (se stada), så att kulan aldrig kilas fast mellan två saker.

import { rad, P, ring, ellips, linje, gitter, spiral, sinus, tegelBage, tegelLinje, medSpegel, iGrupp, stada, nabara, utanfor } from './former.js'

export { nabara, MIN_SPRINGA } from './former.js'

/* --------------------------------------------------------------- världar */

export const VARLDAR = [
  { id: 'park', namn: 'Hundparken', mastare: 'Happy', kraft: 'spar', ikon: '🐶', himmel: ['#7dd3fc', '#a7f3d0'], mark: '#4ade80', tema: 'park' },
  { id: 'godis', namn: 'Godisfabriken', mastare: 'Kaninen Konfekt', kraft: 'multi', ikon: '🐰', himmel: ['#f9a8d4', '#fde68a'], mark: '#f472b6', tema: 'godis' },
  { id: 'rymd', namn: 'Rymden', mastare: 'Rymdkatten', kraft: 'small', ikon: '🐱', himmel: ['#1e1b4b', '#4c1d95'], mark: '#6366f1', tema: 'rymd' },
  { id: 'spok', namn: 'Spökslottet', mastare: 'Spöket Svea', kraft: 'spok', ikon: '👻', himmel: ['#312e81', '#0f172a'], mark: '#64748b', tema: 'spok' },
  { id: 'vulkan', namn: 'Vulkanen', mastare: 'Draken Glöd', kraft: 'eld', ikon: '🐲', himmel: ['#7c2d12', '#fb923c'], mark: '#451a03', tema: 'vulkan' },
  { id: 'trad', namn: 'Trädgården', mastare: 'Biet Blom', kraft: 'blomma', ikon: '🐝', himmel: ['#bbf7d0', '#fef9c3'], mark: '#16a34a', tema: 'trad' },
]

function bygg(varld, namn, objekt, grupper = [], extra = {}) {
  const st = stada(objekt)
  const nas = nabara(st)
  const objektUt = st.map((o, i) => (nas.has(i) ? o : { ...o, ejOrange: true }))
  const kand = objektUt.filter((o) => !o.ejOrange).length
  // Runt en fjärdedel orange, som i Peggle (25 av ungefär 100). Första
  // världen är snällare.
  const andel = varld === 0 ? 0.21 : varld === 1 ? 0.25 : 0.28
  const orange = extra.orange ?? Math.max(12, Math.min(25, Math.round(st.length * andel), kand))
  return { varld, namn, kraft: VARLDAR[varld].kraft, objekt: objektUt, grupper, ...extra, orange }
}

const BANOR = [
  /* --------------------------------------------------- 1. Hundparken */
  () =>
    bygg(
      0,
      'Första kastet',
      [
        ...ring(180, 30, 160, 13, 30, 150),
        ...ring(180, 140, 160, 13, 30, 150),
        ...ring(180, 250, 160, 13, 30, 150),
        ...ring(180, 360, 140, 11, 35, 145),
        ...[245, 355, 458].flatMap((y) => [P(180, y), P(146, y + 9), P(214, y + 9)]),
        ...[165, 275, 385, 470].flatMap((y) => [P(24, y), P(336, y)]),
      ],
      [],
      { orange: 12 }
    ),
  () =>
    bygg(
      0,
      'Tassen',
      [
        ...ring(180, 410, 66, 14),
        ...ring(180, 410, 30, 6, 90, 450),
        P(180, 410),
        ...[[86, 284], [146, 222], [214, 222], [274, 284]].flatMap(([x, y]) => [...ring(x, y, 26, 6, -90, 270), P(x, y)]),
        P(64, 238),
        P(128, 172),
        P(232, 172),
        P(296, 238),
        ...linje(40, 118, 320, 118, 9),
        ...linje(26, 360, 26, 520, 5),
        ...linje(334, 360, 334, 520, 5),
      ],
      [],
      { orange: 12 }
    ),
  () =>
    bygg(
      0,
      'Rutschkanan',
      [
        ...tegelLinje(18, 150, 150, 270, 11),
        ...tegelLinje(342, 150, 210, 270, 11),
        ...linje(46, 116, 132, 194, 3),
        ...linje(314, 116, 228, 194, 3),
        ...ring(180, 165, 30, 8),
        ...gitter(52, 326, 7, 5, 43, 34),
        ...tegelLinje(16, 500, 86, 532, 3),
        ...tegelLinje(344, 500, 274, 532, 3),
      ],
      [],
      { orange: 14 }
    ),
  () =>
    bygg(0, 'Benet', [
      ...ring(62, 250, 28, 7),
      ...ring(62, 310, 28, 7, 90, 450),
      ...ring(298, 250, 28, 7),
      ...ring(298, 310, 28, 7, 90, 450),
      ...linje(100, 262, 260, 262, 6),
      ...linje(100, 298, 260, 298, 6),
      ...tegelBage(180, 400, 100, 18, 162, 14),
      ...ring(180, 400, 60, 7, 25, 155),
      ...linje(60, 125, 300, 125, 8),
      ...linje(80, 180, 280, 180, 6),
      ...linje(22, 380, 22, 520, 4),
      ...linje(338, 380, 338, 520, 4),
    ]),
  () =>
    bygg(0, 'Halfpipen', [
      ...tegelBage(180, 320, 152, 12, 168, 22),
      ...ring(180, 320, 106, 13, 22, 158),
      ...ring(180, 320, 62, 7, 30, 150),
      ...gitter(44, 130, 8, 3, 39, 34),
      ...linje(26, 260, 26, 380, 4),
      ...linje(334, 260, 334, 380, 4),
      P(180, 330),
      P(150, 300),
      P(210, 300),
    ]),

  /* --------------------------------------------------- 2. Godisfabriken */
  () =>
    bygg(1, 'Klubban', [
      ...spiral(180, 245, 16, 118, 2.3, 44, -90),
      ...tegelLinje(180, 380, 180, 530, 6),
      ...ring(60, 430, 26, 6, -90, 270),
      P(60, 430),
      ...ring(300, 430, 26, 6, -90, 270),
      P(300, 430),
      ...linje(36, 120, 104, 120, 3),
      ...linje(256, 120, 324, 120, 3),
      ...tegelLinje(16, 500, 70, 530, 2),
      ...tegelLinje(344, 500, 290, 530, 2),
    ]),
  () =>
    bygg(1, 'Strutarna', [
      ...[70, 180, 290].flatMap((x) => [
        ...ring(x, 200, 36, 9, 180, 360),
        ...linje(x - 34, 236, x, 380, 6),
        ...linje(x + 34, 236, x, 380, 6),
        ...linje(x - 18, 262, x + 18, 262, 2),
        ...linje(x - 10, 300, x + 10, 300, 2),
      ]),
      ...linje(40, 450, 320, 450, 8),
      ...linje(70, 500, 290, 500, 6),
      ...linje(60, 118, 300, 118, 7),
    ]),
  () =>
    bygg(
      1,
      'Löpande bandet',
      [
        ...iGrupp(0, linje(30, 170, 250, 170, 9)),
        ...iGrupp(1, linje(110, 260, 330, 260, 9)),
        ...iGrupp(2, linje(30, 350, 250, 350, 9)),
        ...iGrupp(3, linje(110, 440, 330, 440, 9)),
        ...tegelLinje(40, 510, 150, 530, 5),
        ...tegelLinje(320, 510, 210, 530, 5),
        ...ring(180, 118, 24, 6),
        ...[[310, 200], [330, 300], [40, 300], [24, 400], [320, 380], [40, 470]].map(([x, y]) => P(x, y)),
      ],
      [
        { typ: 'glid', ax: 50, T: 4.2, fas: 0 },
        { typ: 'glid', ax: 50, T: 4.2, fas: Math.PI },
        { typ: 'glid', ax: 50, T: 4.2, fas: Math.PI / 2 },
        { typ: 'glid', ax: 50, T: 4.2, fas: (Math.PI * 3) / 2 },
      ],
      { orange: 13 }
    ),
  () =>
    bygg(1, 'Godispåsen', [
      ...tegelBage(180, 290, 140, 16, 164, 20),
      ...gitter(90, 300, 6, 4, 36, 32),
      ...ring(180, 175, 40, 10),
      ...linje(30, 125, 110, 125, 3),
      ...linje(250, 125, 330, 125, 3),
      ...linje(24, 200, 24, 330, 4),
      ...linje(336, 200, 336, 330, 4),
      ...linje(60, 500, 300, 500, 6),
    ]),
  () =>
    bygg(1, 'Sockervadden', [
      ...[[70, 170], [180, 140], [290, 170], [125, 250], [235, 250]].flatMap(([x, y]) => [...ring(x, y, 28, 6, -90, 270), P(x, y)]),
      ...tegelBage(92, 420, 64, 10, 170, 11),
      ...tegelBage(268, 420, 64, 10, 170, 11),
      ...ring(92, 420, 30, 5, 30, 150),
      ...ring(268, 420, 30, 5, 30, 150),
      ...linje(40, 330, 320, 330, 8),
      P(180, 380),
      P(180, 430),
      P(180, 480),
      ...linje(26, 230, 26, 290, 2),
      ...linje(334, 230, 334, 290, 2),
    ]),

  /* --------------------------------------------------- 3. Rymden */
  () =>
    bygg(2, 'Planeten', [
      ...ring(180, 300, 64, 14),
      ...ring(180, 300, 30, 6, 90, 450),
      P(180, 300),
      ...utanfor(ellips(180, 300, 166, 40, 34, -12), 180, 300, 86),
      ...ring(62, 148, 18, 5),
      ...ring(298, 478, 18, 5),
      ...[[140, 125], [220, 118], [300, 140], [250, 190], [100, 200], [40, 250], [320, 260], [60, 400], [120, 450], [200, 420], [250, 510], [80, 520], [320, 380], [170, 500]].map(([x, y]) => P(x, y)),
    ]),
  () =>
    bygg(
      2,
      'Omloppsbanan',
      [
        ...ring(180, 320, 46, 10),
        P(180, 320),
        ...iGrupp(0, ring(180, 320, 112, 20)),
        ...iGrupp(1, ring(60, 150, 18, 5)),
        ...iGrupp(2, ring(300, 150, 18, 5)),
        ...linje(40, 500, 320, 500, 8),
        ...linje(100, 125, 260, 125, 5),
        P(26, 300),
        P(334, 300),
        P(30, 420),
        P(330, 420),
      ],
      [
        { typ: 'rotera', cx: 180, cy: 320, w: 0.55 },
        { typ: 'bana', R: 22, T: 3.6, fas: 0 },
        { typ: 'bana', R: 22, T: 3.6, fas: Math.PI },
      ]
    ),
  () =>
    bygg(2, 'Raketen', [
      ...ring(180, 236, 44, 7, 195, 345),
      ...linje(138, 250, 138, 400, 5),
      ...linje(222, 250, 222, 400, 5),
      ...linje(180, 262, 180, 380, 4),
      ...tegelLinje(132, 360, 86, 430, 3),
      ...tegelLinje(228, 360, 274, 430, 3),
      ...ring(180, 452, 30, 7, 20, 160),
      P(160, 500),
      P(200, 500),
      P(180, 530),
      ...[[40, 130], [90, 175], [300, 130], [266, 180], [50, 270], [310, 270], [86, 330], [276, 330], [40, 520], [320, 520], [40, 400], [320, 400], [110, 520], [250, 520], [180, 140]].map(([x, y]) => P(x, y)),
    ]),
  () =>
    bygg(
      2,
      'Asteroidbältet',
      [
        ...iGrupp(0, ring(80, 180, 24, 7)),
        ...iGrupp(1, ring(260, 220, 24, 7)),
        ...iGrupp(2, ring(110, 320, 24, 7)),
        ...iGrupp(3, ring(270, 380, 24, 7)),
        ...iGrupp(4, ring(150, 450, 24, 7)),
        ...gitter(40, 125, 8, 1, 40, 0, false),
        ...linje(40, 530, 320, 530, 8),
        ...[[200, 160], [180, 260], [60, 250], [320, 300], [210, 330], [40, 400], [200, 400], [320, 460], [60, 480], [30, 320], [330, 160], [250, 470]].map(([x, y]) => P(x, y)),
      ],
      [
        { typ: 'glid', ax: 34, T: 6, fas: 0 },
        { typ: 'glid', ax: 40, T: 6, fas: 1 },
        { typ: 'glid', ax: 50, T: 4.5, fas: 2 },
        { typ: 'glid', ax: 40, T: 5.5, fas: 3 },
        { typ: 'glid', ax: 60, T: 7, fas: 4 },
      ],
      { orange: 14 }
    ),
  () =>
    bygg(2, 'Svarta hålet', [
      ...Array.from({ length: 22 }, (_, i) => {
        const a0 = -100 + i * 40
        return tegelBage(180, 320, 150 - i * 4.4, a0, a0 + 34, 1)[0]
      }),
      ...ring(180, 320, 22, 6),
      ...gitter(40, 122, 8, 1, 40, 0, false),
      ...linje(26, 200, 26, 480, 7),
      ...linje(334, 200, 334, 480, 7),
      ...linje(90, 520, 270, 520, 5),
    ]),

  /* --------------------------------------------------- 4. Spökslottet */
  () =>
    bygg(3, 'Fladdermusen', [
      ...ring(180, 260, 26, 8),
      ...medSpegel([...ring(122, 230, 44, 6, 200, 340), ...ring(62, 250, 34, 5, 190, 340), ...ring(108, 300, 30, 5, 20, 160), ...ring(48, 310, 24, 4, 20, 160)]),
      ...linje(60, 410, 300, 410, 8),
      ...ring(180, 470, 46, 9, 0, 180),
      ...linje(90, 140, 270, 140, 6),
      ...linje(30, 360, 30, 520, 4),
      ...linje(330, 360, 330, 520, 4),
    ]),
  () =>
    bygg(3, 'Tornen', [
      ...[70, 180, 290].flatMap((x, i) => [
        ...linje(x - 20, 230 + i * 30, x - 20, 470, 6),
        ...linje(x + 20, 230 + i * 30, x + 20, 470, 6),
        ...tegelLinje(x - 28, 214 + i * 30, x - 10, 214 + i * 30, 1),
        ...tegelLinje(x + 10, 214 + i * 30, x + 28, 214 + i * 30, 1),
      ]),
      ...linje(40, 140, 320, 140, 8),
      ...linje(110, 520, 250, 520, 4),
      P(125, 300),
      P(235, 300),
      P(125, 400),
      P(235, 400),
    ]),
  () =>
    bygg(3, 'Spöket', [
      ...ring(180, 262, 96, 11, 180, 360),
      ...linje(84, 290, 84, 430, 4),
      ...linje(276, 290, 276, 430, 4),
      ...[0, 1, 2, 3].flatMap((i) => ring(108 + i * 48, 456, 24, 4, 20, 160)),
      ...ring(146, 252, 16, 5),
      ...ring(214, 252, 16, 5),
      ...ring(180, 336, 22, 5, 200, 340),
      ...linje(30, 160, 30, 380, 6),
      ...linje(330, 160, 330, 380, 6),
      ...linje(140, 530, 220, 530, 3),
      P(180, 400),
      P(132, 400),
      P(228, 400),
    ]),
  () =>
    bygg(3, 'Labyrinten', [
      ...tegelLinje(20, 180, 240, 180, 8),
      ...tegelLinje(120, 270, 340, 270, 8),
      ...tegelLinje(20, 360, 240, 360, 8),
      ...tegelLinje(120, 450, 340, 450, 8),
      ...linje(60, 125, 300, 125, 7),
      ...linje(130, 225, 330, 225, 6),
      ...linje(30, 315, 230, 315, 6),
      ...linje(130, 405, 330, 405, 6),
      ...linje(30, 500, 230, 500, 6),
    ]),
  () =>
    bygg(
      3,
      'Pendlarna',
      [
        ...iGrupp(0, [...linje(110, 160, 110, 300, 5), ...ring(110, 330, 28, 8)]),
        ...iGrupp(1, [...linje(250, 160, 250, 300, 5), ...ring(250, 330, 28, 8)]),
        ...linje(40, 440, 320, 440, 8),
        ...ring(180, 500, 34, 8, 0, 180),
        ...linje(30, 200, 30, 380, 5),
        ...linje(330, 200, 330, 380, 5),
        ...linje(180, 180, 180, 380, 6),
        ...linje(60, 125, 300, 125, 7),
      ],
      [
        { typ: 'pendel', cx: 110, cy: 130, A: 0.55, T: 3.2 },
        { typ: 'pendel', cx: 250, cy: 130, A: -0.55, T: 3.2 },
      ],
      { orange: 15 }
    ),

  /* --------------------------------------------------- 5. Vulkanen */
  () =>
    bygg(4, 'Kratern', [
      ...tegelLinje(150, 262, 26, 500, 12),
      ...tegelLinje(210, 262, 334, 500, 12),
      ...ring(180, 224, 44, 9, 190, 350),
      ...linje(180, 120, 180, 190, 3),
      ...linje(150, 140, 150, 180, 2),
      ...linje(210, 140, 210, 180, 2),
      ...gitter(30, 130, 3, 4, 34, 36),
      ...gitter(262, 130, 3, 4, 34, 36),
      ...linje(26, 300, 100, 300, 3),
      ...linje(334, 300, 260, 300, 3),
      ...linje(130, 360, 230, 360, 4),
      ...linje(120, 420, 240, 420, 5),
      ...linje(150, 480, 210, 480, 3),
    ], [], { orange: 17 }),
  () =>
    bygg(4, 'Lavaflödet', [
      ...sinus(30, 330, 160, 26, 1.5, 12),
      ...sinus(30, 330, 260, 26, 1.5, 12, Math.PI),
      ...sinus(30, 330, 360, 26, 1.5, 12),
      ...sinus(30, 330, 460, 26, 1.5, 12, Math.PI),
      ...linje(90, 525, 270, 525, 5),
      ...linje(100, 112, 260, 112, 5),
    ]),
  () =>
    bygg(
      4,
      'Eldhjulet',
      [
        ...iGrupp(0, [0, 90, 180, 270].flatMap((v) => linje(180 + Math.cos(rad(v)) * 34, 320 + Math.sin(rad(v)) * 34, 180 + Math.cos(rad(v)) * 120, 320 + Math.sin(rad(v)) * 120, 5))),
        ...ring(180, 320, 16, 4),
        ...ring(180, 320, 158, 28, 200, 340),
        ...ring(180, 320, 158, 12, 20, 160),
        ...linje(30, 480, 30, 530, 2),
        ...linje(330, 480, 330, 530, 2),
        ...linje(110, 530, 250, 530, 4),
        P(40, 380),
        P(320, 380),
      ],
      [{ typ: 'rotera', cx: 180, cy: 320, w: 0.7 }],
      { orange: 14 }
    ),
  () =>
    bygg(4, 'Skidbacken', [
      ...tegelLinje(18, 145, 250, 205, 12),
      ...tegelLinje(342, 245, 110, 305, 12),
      ...tegelLinje(18, 345, 250, 405, 12),
      ...tegelLinje(342, 445, 110, 505, 12),
      ...linje(280, 160, 330, 160, 2),
      ...linje(30, 260, 80, 260, 2),
      ...linje(280, 360, 330, 360, 2),
      ...linje(30, 460, 80, 460, 2),
      ...linje(90, 240, 220, 270, 4),
      ...linje(140, 440, 270, 470, 4),
      ...linje(140, 340, 270, 370, 4),
      ...linje(100, 115, 260, 115, 5),
    ]),
  () =>
    bygg(4, 'Utbrottet', [
      ...tegelBage(180, 430, 82, 12, 168, 13),
      ...ring(180, 430, 44, 6, 30, 150),
      ...[-1, 1].flatMap((sida) => [0, 1, 2].flatMap((k) => ring(180 + sida * (60 + k * 40), 360, 70 + k * 40, 7, sida > 0 ? 200 : -20, sida > 0 ? 270 : -90 + 0))),
      ...linje(60, 125, 300, 125, 7),
      ...linje(26, 420, 26, 520, 3),
      ...linje(334, 420, 334, 520, 3),
      P(180, 400),
    ]),

  /* --------------------------------------------------- 6. Trädgården */
  () =>
    bygg(5, 'Blomman', [
      ...ring(180, 290, 28, 6, -90, 270),
      P(180, 290),
      ...[0, 60, 120, 180, 240, 300].flatMap((v) => [...ring(180 + Math.cos(rad(v)) * 84, 290 + Math.sin(rad(v)) * 84, 30, 6, v, v + 360), P(180 + Math.cos(rad(v)) * 84, 290 + Math.sin(rad(v)) * 84)]),
      ...tegelLinje(180, 410, 180, 530, 5),
      ...ring(140, 470, 22, 5, 180, 360),
      ...ring(220, 470, 22, 5, 180, 360),
      ...linje(40, 120, 120, 120, 3),
      ...linje(240, 120, 320, 120, 3),
    ]),
  () =>
    bygg(5, 'Bikupan', [
      ...gitter(40, 150, 8, 10, 40, 36),
      ...tegelBage(180, 520, 60, 200, 340, 6),
    ]),
  () =>
    bygg(5, 'Snigeln', [
      ...spiral(200, 280, 14, 104, 2.4, 42, 0),
      ...tegelLinje(30, 420, 330, 420, 12),
      ...linje(40, 480, 320, 480, 8),
      ...linje(60, 140, 120, 140, 3),
      P(60, 300),
      P(48, 230),
      ...linje(250, 125, 330, 125, 3),
    ]),
  () =>
    bygg(5, 'Skateparken', [
      ...tegelBage(96, 260, 66, 10, 170, 12),
      ...tegelBage(264, 260, 66, 10, 170, 12),
      ...tegelBage(180, 400, 128, 18, 162, 20),
      ...ring(96, 260, 30, 5, 30, 150),
      ...ring(264, 260, 30, 5, 30, 150),
      ...ring(180, 400, 86, 11, 25, 155),
      ...linje(60, 140, 300, 140, 7),
      P(180, 240),
      P(180, 290),
    ]),
  () =>
    bygg(
      5,
      'Finalen',
      [
        ...iGrupp(0, ring(180, 230, 70, 16)),
        ...ring(180, 230, 30, 7),
        ...tegelBage(180, 360, 150, 22, 158, 20),
        ...iGrupp(1, linje(70, 410, 290, 410, 8)),
        ...linje(30, 130, 120, 130, 3),
        ...linje(240, 130, 330, 130, 3),
        ...ring(60, 230, 18, 5),
        ...ring(300, 230, 18, 5),
      ],
      [
        { typ: 'rotera', cx: 180, cy: 230, w: -0.6 },
        { typ: 'glid', ax: 36, T: 4, fas: 0 },
      ]
    ),
]

export const ANTAL_BANOR = BANOR.length
const cache = new Map()
export function hamtaBana(nr) {
  if (!cache.has(nr)) {
    const b = BANOR[nr - 1]()
    b.nr = nr
    cache.set(nr, b)
  }
  return cache.get(nr)
}

// Stjärngränser per bana: [två stjärnor, tre stjärnor]. Mätta med en bot
// som siktar med siktspåret på orange pinnar (45:e och 85:e percentilen av
// poängen när den klarar banan), så tre stjärnor kräver ett riktigt bra parti.
export const STJARNOR = {
  1: [220000, 285000], 2: [205000, 290000], 3: [295000, 395000], 4: [300000, 370000], 5: [290000, 395000],
  6: [285000, 305000], 7: [280000, 335000], 8: [255000, 400000], 9: [295000, 440000], 10: [360000, 460000],
  11: [255000, 375000], 12: [245000, 355000], 13: [210000, 310000], 14: [240000, 335000], 15: [290000, 355000],
  16: [305000, 395000], 17: [260000, 365000], 18: [255000, 340000], 19: [335000, 430000], 20: [250000, 325000],
  21: [245000, 330000], 22: [260000, 360000], 23: [235000, 310000], 24: [285000, 420000], 25: [230000, 355000],
  26: [220000, 350000], 27: [245000, 360000], 28: [270000, 380000], 29: [335000, 470000], 30: [310000, 425000],
}
export function stjarnor(nr, poang, klar) {
  if (!klar) return 0
  const g = STJARNOR[nr] || [150000, 300000]
  return poang >= g[1] ? 3 : poang >= g[0] ? 2 : 1
}
