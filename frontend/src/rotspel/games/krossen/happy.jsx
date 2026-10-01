// Krossen — Happy själv: fotot, kläderna från garderoben, och Happy som
// pjäs på brädet.
//
// Kläderna ritas i en 100×100-ruta ovanpå det runda fotot. Hattar får sticka
// upp ovanför cirkeln, därför har SVG:n overflow: visible.

import happyGlad from '../revir/img/happy-glad.webp'
import happyNojd from '../revir/img/happy-nojd.webp'
import happyLedsen from '../revir/img/happy-ledsen.webp'

export const HAPPY = { glad: happyGlad, nojd: happyNojd, ledsen: happyLedsen }

// Vad Happy har på sig just nu. Sätts av KrossenGame när sparläget ändras,
// så att varje Happy i spelet (pjäsen, kartan, rutorna) bär samma kläder
// utan att kläderna behöver skickas genom alla komponenter.
let nuvarande = { huvud: null, hals: null, ogon: null }
export function setKlader(pa) {
  nuvarande = { ...nuvarande, ...(pa || {}) }
}

export const PLATSER = [
  { id: 'huvud', namn: 'Huvud' },
  { id: 'hals', namn: 'Hals' },
  { id: 'ogon', namn: 'Ögon' },
]

// ------------------------------------------------------------------- hattar

const Partyhatt = () => (
  <g>
    <path d="M30 22 L52 -24 L72 20 Z" fill="#ff5fa2" stroke="#9b1d5a" strokeWidth="2" strokeLinejoin="round" />
    <path d="M37 8 L66 6 M43 -6 L61 -7" stroke="#ffe066" strokeWidth="5" strokeLinecap="round" />
    <circle cx="52" cy="-26" r="6" fill="#ffe066" stroke="#b98400" strokeWidth="1.5" />
    <path d="M28 22 Q51 30 74 20" stroke="#9b1d5a" strokeWidth="3" fill="none" />
  </g>
)

const Krona = () => (
  <g>
    <path d="M24 20 L28 -8 L40 8 L52 -14 L64 8 L76 -8 L80 20 Z" fill="url(#kr-guld)" stroke="#9a5b00" strokeWidth="2" strokeLinejoin="round" />
    <rect x="24" y="14" width="56" height="8" rx="2" fill="#ffc928" stroke="#9a5b00" strokeWidth="1.5" />
    <circle cx="52" cy="4" r="4" fill="#f03a5f" />
    <circle cx="36" cy="12" r="3" fill="#2f8af0" />
    <circle cx="68" cy="12" r="3" fill="#34c05a" />
  </g>
)

const Mossa = () => (
  <g>
    <path d="M22 24 Q22 -10 52 -10 Q82 -10 82 24 Z" fill="#e04848" stroke="#8a1e1e" strokeWidth="2" />
    <rect x="20" y="16" width="64" height="12" rx="6" fill="#fff4e6" stroke="#c9b8a3" strokeWidth="1.5" />
    <path d="M30 2 L30 14 M40 -4 L40 14 M52 -6 L52 14 M64 -4 L64 14 M74 2 L74 14" stroke="#b83232" strokeWidth="2" />
    <circle cx="52" cy="-14" r="8" fill="#fff4e6" stroke="#c9b8a3" strokeWidth="1.5" />
  </g>
)

const Cowboy = () => (
  <g>
    <ellipse cx="52" cy="18" rx="44" ry="9" fill="#8a5a2b" stroke="#4a2c10" strokeWidth="2" />
    <path d="M32 18 Q30 -10 52 -8 Q74 -10 72 18 Z" fill="#a86e36" stroke="#4a2c10" strokeWidth="2" />
    <path d="M33 10 Q52 14 71 10" stroke="#4a2c10" strokeWidth="4" fill="none" />
    <path d="M45 -6 Q52 2 59 -6" stroke="#6e431d" strokeWidth="2" fill="none" />
  </g>
)

const Kockmossa = () => (
  <g>
    <circle cx="36" cy="-6" r="13" fill="#fff" stroke="#c7ccd6" strokeWidth="2" />
    <circle cx="52" cy="-14" r="15" fill="#fff" stroke="#c7ccd6" strokeWidth="2" />
    <circle cx="68" cy="-6" r="13" fill="#fff" stroke="#c7ccd6" strokeWidth="2" />
    <rect x="30" y="0" width="44" height="22" rx="4" fill="#fff" stroke="#c7ccd6" strokeWidth="2" />
    <path d="M40 6 V18 M52 6 V18 M64 6 V18" stroke="#e3e7ee" strokeWidth="2" />
  </g>
)

const Blomkrans = () => {
  const blommor = [
    [22, 22, '#ff8fb1'],
    [32, 12, '#ffd21f'],
    [44, 6, '#7fd0ff'],
    [56, 5, '#ff8fb1'],
    [68, 9, '#ffd21f'],
    [79, 18, '#b388ff'],
  ]
  return (
    <g>
      <path d="M18 26 Q50 -4 84 22" stroke="#3f9d4a" strokeWidth="4" fill="none" />
      {blommor.map(([x, y, f]) => (
        <g key={x}>
          {[0, 72, 144, 216, 288].map((v) => (
            <circle key={v} cx={x + Math.cos((v * Math.PI) / 180) * 4.5} cy={y + Math.sin((v * Math.PI) / 180) * 4.5} r="4" fill={f} />
          ))}
          <circle cx={x} cy={y} r="2.8" fill="#fff6c2" />
        </g>
      ))}
    </g>
  )
}

const Rymdhjalm = () => (
  <g>
    <circle cx="50" cy="48" r="58" fill="#bfe6ff" opacity=".28" stroke="#e8f6ff" strokeWidth="5" />
    <path d="M14 18 A58 58 0 0 1 60 -8" stroke="#fff" strokeWidth="5" fill="none" opacity=".7" strokeLinecap="round" />
    <path d="M2 86 Q50 112 98 86" stroke="#c7ccd6" strokeWidth="9" fill="none" />
    <circle cx="50" cy="-12" r="4" fill="#ff5f5f" />
    <path d="M50 -8 V0" stroke="#c7ccd6" strokeWidth="2" />
  </g>
)

// ------------------------------------------------------------------- halsen

const Halsduk = () => (
  <g>
    <path d="M14 80 Q50 98 88 80 L90 90 Q50 110 12 90 Z" fill="#e02a44" stroke="#7a0f1f" strokeWidth="2" />
    <path d="M66 92 L74 120 L84 118 L78 90 Z" fill="#e02a44" stroke="#7a0f1f" strokeWidth="2" />
    <path d="M20 86 Q50 100 82 86" stroke="#ff8a9c" strokeWidth="2" strokeDasharray="4 5" fill="none" />
  </g>
)

const Fluga = () => (
  <g>
    <path d="M50 92 L30 82 L30 104 Z" fill="#2f3a8f" stroke="#151c55" strokeWidth="2" strokeLinejoin="round" />
    <path d="M50 92 L70 82 L70 104 Z" fill="#2f3a8f" stroke="#151c55" strokeWidth="2" strokeLinejoin="round" />
    <rect x="45" y="87" width="10" height="10" rx="3" fill="#4a59c4" stroke="#151c55" strokeWidth="2" />
    <circle cx="36" cy="90" r="1.8" fill="#fff" />
    <circle cx="64" cy="96" r="1.8" fill="#fff" />
  </g>
)

const Bandana = () => (
  <g>
    <path d="M12 78 Q50 92 90 78 L52 116 Z" fill="#2f8af0" stroke="#154c9e" strokeWidth="2" strokeLinejoin="round" />
    {[
      [40, 92],
      [56, 94],
      [48, 104],
      [30, 86],
      [70, 86],
    ].map(([x, y]) => (
      <circle key={x + '-' + y} cx={x} cy={y} r="2.2" fill="#fff" />
    ))}
  </g>
)

const Medalj = () => (
  <g>
    <path d="M30 76 L48 104 M72 76 L54 104" stroke="#2f8af0" strokeWidth="7" />
    <circle cx="51" cy="108" r="11" fill="url(#kr-guld)" stroke="#9a5b00" strokeWidth="2" />
    <path d="M51 101 l2.2 4.6 5 .7 -3.6 3.4 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.4 5 -.7 z" fill="#fff6c2" />
  </g>
)

const Parlor = () => (
  <g>
    {Array.from({ length: 13 }, (_, k) => {
      const t = k / 12
      const x = 16 + t * 70
      const y = 82 + Math.sin(t * Math.PI) * 14
      return <circle key={k} cx={x} cy={y} r="4" fill="#fffaf0" stroke="#d9cdb8" strokeWidth="1" />
    })}
  </g>
)

// -------------------------------------------------------------------- ögonen

const Glasogon = ({ glas, bage, form = 'rund' }) => {
  const lins = (cx) =>
    form === 'hjarta' ? (
      <path
        d={`M${cx} 46 C ${cx - 18} 36, ${cx - 16} 20, ${cx - 6} 22 C ${cx - 2} 22, ${cx} 26, ${cx} 28 C ${cx} 26, ${cx + 2} 22, ${cx + 6} 22 C ${cx + 16} 20, ${cx + 18} 36, ${cx} 46 Z`}
        fill={glas}
        stroke={bage}
        strokeWidth="3"
      />
    ) : form === 'stjarna' ? (
      <path
        d={Array.from({ length: 10 }, (_, k) => {
          const r = k % 2 ? 7 : 15
          const v = (k / 10) * Math.PI * 2 - Math.PI / 2
          return `${k ? 'L' : 'M'}${cx + Math.cos(v) * r} ${33 + Math.sin(v) * r}`
        }).join(' ') + 'Z'}
        fill={glas}
        stroke={bage}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    ) : (
      <rect x={cx - 14} y="22" width="28" height="22" rx={form === 'rund' ? 11 : 4} fill={glas} stroke={bage} strokeWidth="3" />
    )
  return (
    <g>
      {lins(34)}
      {lins(72)}
      <path d="M48 32 Q53 28 58 32" stroke={bage} strokeWidth="3" fill="none" />
      <path d="M20 30 L6 26 M86 30 L98 26" stroke={bage} strokeWidth="3" strokeLinecap="round" />
      <path d="M24 28 L30 24 M62 28 L68 24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
    </g>
  )
}

const Monokel = () => (
  <g>
    <circle cx="72" cy="33" r="13" fill="#dff3ff" fillOpacity=".25" stroke="url(#kr-guld)" strokeWidth="3.5" />
    <path d="M84 40 Q92 60 86 84" stroke="#b98400" strokeWidth="1.5" fill="none" />
    <path d="M64 26 L69 23" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
  </g>
)

const Skidglasogon = () => (
  <g>
    <path d="M4 30 Q50 18 98 30" stroke="#2b2b3a" strokeWidth="6" fill="none" />
    <rect x="16" y="18" width="72" height="28" rx="14" fill="url(#kr-skidglas)" stroke="#2b2b3a" strokeWidth="3" />
    <path d="M24 26 Q40 22 50 26" stroke="#fff" strokeWidth="3" fill="none" opacity=".7" strokeLinecap="round" />
  </g>
)

// ------------------------------------------------------------- katalogen

export const KLADER = [
  { id: 'partyhatt', namn: 'Partyhatt', plats: 'huvud', pris: 80, Rita: Partyhatt },
  { id: 'mossa', namn: 'Vintermössa', plats: 'huvud', pris: 150, Rita: Mossa },
  { id: 'kock', namn: 'Kockmössa', plats: 'huvud', pris: 200, Rita: Kockmossa },
  { id: 'cowboy', namn: 'Cowboyhatt', plats: 'huvud', pris: 250, Rita: Cowboy },
  { id: 'blomkrans', namn: 'Blomkrans', plats: 'huvud', pris: 300, Rita: Blomkrans },
  { id: 'krona', namn: 'Krona', plats: 'huvud', pris: 500, Rita: Krona },
  { id: 'rymdhjalm', namn: 'Rymdhjälm', plats: 'huvud', pris: 700, Rita: Rymdhjalm },
  { id: 'halsduk', namn: 'Röd halsduk', plats: 'hals', pris: 100, Rita: Halsduk },
  { id: 'fluga', namn: 'Fluga', plats: 'hals', pris: 120, Rita: Fluga },
  { id: 'bandana', namn: 'Bandana', plats: 'hals', pris: 150, Rita: Bandana },
  { id: 'parlor', namn: 'Pärlhalsband', plats: 'hals', pris: 250, Rita: Parlor },
  { id: 'medalj', namn: 'Guldmedalj', plats: 'hals', pris: 400, Rita: Medalj },
  { id: 'sol', namn: 'Solglasögon', plats: 'ogon', pris: 150, Rita: () => <Glasogon glas="#1f2937" bage="#111827" form="fyrkant" /> },
  { id: 'monokel', namn: 'Monokel', plats: 'ogon', pris: 180, Rita: Monokel },
  { id: 'hjarta', namn: 'Hjärtglasögon', plats: 'ogon', pris: 200, Rita: () => <Glasogon glas="#ff5fa2" bage="#9b1d5a" form="hjarta" /> },
  { id: 'skid', namn: 'Skidglasögon', plats: 'ogon', pris: 250, Rita: Skidglasogon },
  { id: 'stjarna', namn: 'Stjärnglasögon', plats: 'ogon', pris: 300, Rita: () => <Glasogon glas="#ffd21f" bage="#b98400" form="stjarna" /> },
]

export const kladFor = (id) => KLADER.find((k) => k.id === id) || null

// ------------------------------------------------------------- Happy-bilden

let nextClip = 1

// Happys runda foto med kläder. pa kan skickas in för att förhandsvisa (i
// garderoben), annars bär han det som är valt.
export function HappyBild({ humor = 'nojd', storlek = 48, pa = null, ram = '#fff', ramBredd = 4, className = '', style }) {
  const kl = pa || nuvarande
  const clip = 'kr-hclip' + (nextClip++ % 100000)
  const ordning = ['hals', 'ogon', 'huvud']
  return (
    <svg viewBox="0 0 100 100" width={storlek} height={storlek} className={className} style={{ overflow: 'visible', ...style }} aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="50" fill={ram} />
      <image href={HAPPY[humor] || HAPPY.nojd} x="2" y="2" width="96" height="96" clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
      {ramBredd > 0 && <circle cx="50" cy="50" r={50 - ramBredd / 2} fill="none" stroke={ram} strokeWidth={ramBredd} />}
      {ordning.map((plats) => {
        const sak = kladFor(kl[plats])
        return sak ? <sak.Rita key={plats} /> : null
      })}
    </svg>
  )
}

// Defs som kläderna behöver utöver pjäsernas.
export function HappyDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="kr-skidglas" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd35c" />
          <stop offset=".5" stopColor="#ff7eb6" />
          <stop offset="1" stopColor="#6e7bff" />
        </linearGradient>
      </defs>
    </svg>
  )
}
