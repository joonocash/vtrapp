// Krossen — allt som ritas på brädet: Happys godis, specialpjäserna,
// hindren och ikonerna till målen. Rena SVG-komponenter, inga bilder.
//
// Alla pjäser ritas i en 100×100-ruta. Gradienterna och urklippen ligger en
// gång i <KrossenDefs /> och pekas ut med id, så det blir billigt att rita
// 81 pjäser samtidigt.

import happyGlad from '../revir/img/happy-glad.webp'
import happyNojd from '../revir/img/happy-nojd.webp'
import happyLedsen from '../revir/img/happy-ledsen.webp'

export const HAPPY = { glad: happyGlad, nojd: happyNojd, ledsen: happyLedsen }

// Sex sorters godis. Både färg och form skiljer sig, så de går att hålla
// isär även för den som har svårt för färger.
export const FARGER = [
  { namn: 'Hjärtkex', bas: '#f03a5f', ljus: '#ffb3c2', mork: '#9c0f30' },
  { namn: 'Ben', bas: '#ff8a1c', ljus: '#ffd9a0', mork: '#a8470a' },
  { namn: 'Ostbit', bas: '#ffd21f', ljus: '#fff6b8', mork: '#b98400' },
  { namn: 'Tass', bas: '#34c05a', ljus: '#b2f5bf', mork: '#146a2c' },
  { namn: 'Fiskkex', bas: '#2f8af0', ljus: '#a9d6ff', mork: '#154c9e' },
  { namn: 'Munk', bas: '#a452ec', ljus: '#e3c2ff', mork: '#571e93' },
]

// ------------------------------------------------------------------- former

// Formen för varje sort, utan färg. Används både till själva pjäsen, till
// skuggan under och som urklipp för raketens ränder.
function Form({ k }) {
  switch (k) {
    case 0:
      return <path d="M50 88 C 20 68, 6 48, 16 30 C 25 14, 44 14, 50 30 C 56 14, 75 14, 84 30 C 94 48, 80 68, 50 88 Z" />
    case 1:
      // Inga <g> här: formen används också i <clipPath>, och där får bara
      // rena former stå. Rotationen sitter därför på varje del.
      return (
        <>
          <circle cx="20" cy="37" r="13" transform="rotate(-20 50 50)" />
          <circle cx="20" cy="63" r="13" transform="rotate(-20 50 50)" />
          <circle cx="80" cy="37" r="13" transform="rotate(-20 50 50)" />
          <circle cx="80" cy="63" r="13" transform="rotate(-20 50 50)" />
          <rect x="18" y="38" width="64" height="24" rx="8" transform="rotate(-20 50 50)" />
        </>
      )
    case 2:
      return <path d="M16 74 Q10 74 14 68 L52 20 Q56 15 60 20 L88 68 Q92 74 84 74 Z M16 74 L84 74 L84 82 Q84 86 80 86 L20 86 Q16 86 16 82 Z" />
    case 3:
      return (
        <>
          <path d="M50 50 C 66 50, 80 64, 75 77 C 71 88, 60 85, 50 85 C 40 85, 29 88, 25 77 C 20 64, 34 50, 50 50 Z" />
          <ellipse cx="23" cy="46" rx="9.5" ry="12" transform="rotate(-25 23 46)" />
          <ellipse cx="40" cy="28" rx="9.5" ry="12" transform="rotate(-8 40 28)" />
          <ellipse cx="60" cy="28" rx="9.5" ry="12" transform="rotate(8 60 28)" />
          <ellipse cx="77" cy="46" rx="9.5" ry="12" transform="rotate(25 77 46)" />
        </>
      )
    case 4:
      return <path d="M12 50 C 20 28, 52 24, 66 40 L 86 25 Q 91 23 90 30 L 84 50 L 90 70 Q 91 77 86 75 L 66 60 C 52 76, 20 72, 12 50 Z" />
    case 5:
      return <path fillRule="evenodd" d="M12 50 A38 38 0 1 0 88 50 A38 38 0 1 0 12 50 Z M40 50 A10 10 0 1 1 60 50 A10 10 0 1 1 40 50 Z" />
    default:
      return <circle cx="50" cy="50" r="36" />
  }
}

// Detaljer ovanpå formen: glans, hål i osten, ögat på fisken, strössel.
function Detaljer({ k }) {
  const f = FARGER[k]
  switch (k) {
    case 0:
      return (
        <>
          <circle cx="38" cy="52" r="3" fill={f.mork} opacity=".45" />
          <circle cx="50" cy="63" r="3" fill={f.mork} opacity=".45" />
          <circle cx="62" cy="52" r="3" fill={f.mork} opacity=".45" />
          <ellipse cx="30" cy="33" rx="9" ry="5.5" transform="rotate(-38 30 33)" fill="#fff" opacity=".6" />
          <circle cx="72" cy="30" r="3" fill="#fff" opacity=".45" />
        </>
      )
    case 1:
      return (
        <g transform="rotate(-20 50 50)">
          <rect x="26" y="41" width="48" height="5" rx="2.5" fill="#fff" opacity=".5" />
          <circle cx="16" cy="32" r="4" fill="#fff" opacity=".55" />
          <circle cx="76" cy="32" r="4" fill="#fff" opacity=".55" />
          <circle cx="40" cy="54" r="2.2" fill={f.mork} opacity=".4" />
          <circle cx="52" cy="54" r="2.2" fill={f.mork} opacity=".4" />
          <circle cx="64" cy="54" r="2.2" fill={f.mork} opacity=".4" />
        </g>
      )
    case 2:
      return (
        <>
          <circle cx="47" cy="52" r="6.5" fill={f.mork} opacity=".5" />
          <circle cx="64" cy="60" r="4.5" fill={f.mork} opacity=".5" />
          <circle cx="36" cy="64" r="3.8" fill={f.mork} opacity=".5" />
          <circle cx="58" cy="37" r="3.6" fill={f.mork} opacity=".5" />
          <rect x="16" y="74" width="68" height="3" fill={f.mork} opacity=".35" />
          <ellipse cx="44" cy="36" rx="8" ry="3.5" transform="rotate(-52 44 36)" fill="#fff" opacity=".65" />
        </>
      )
    case 3:
      return (
        <>
          <ellipse cx="42" cy="60" rx="9" ry="4.5" transform="rotate(-25 42 60)" fill="#fff" opacity=".45" />
          <ellipse cx="20" cy="41" rx="3" ry="4.5" transform="rotate(-25 20 41)" fill="#fff" opacity=".55" />
          <ellipse cx="37" cy="23" rx="3" ry="4.5" transform="rotate(-8 37 23)" fill="#fff" opacity=".55" />
          <ellipse cx="57" cy="23" rx="3" ry="4.5" transform="rotate(8 57 23)" fill="#fff" opacity=".55" />
          <ellipse cx="74" cy="41" rx="3" ry="4.5" transform="rotate(25 74 41)" fill="#fff" opacity=".55" />
        </>
      )
    case 4:
      return (
        <>
          <path d="M46 36 Q 39 50 46 64" stroke={f.mork} strokeWidth="3.2" fill="none" strokeLinecap="round" opacity=".6" />
          <circle cx="29" cy="46" r="7" fill="#fff" />
          <circle cx="30.5" cy="46.5" r="3.8" fill="#15203a" />
          <circle cx="32" cy="45" r="1.4" fill="#fff" />
          <circle cx="58" cy="50" r="2.3" fill={f.mork} opacity=".4" />
          <circle cx="66" cy="46" r="2.3" fill={f.mork} opacity=".4" />
          <ellipse cx="40" cy="34" rx="11" ry="3.8" transform="rotate(-12 40 34)" fill="#fff" opacity=".55" />
        </>
      )
    case 5:
      return (
        <>
          {/* degen syns som en kant runt glasyren */}
          <path
            fillRule="evenodd"
            d="M12 50 A38 38 0 1 0 88 50 A38 38 0 1 0 12 50 Z M17 50 A33 33 0 1 1 83 50 A33 33 0 1 1 17 50 Z"
            fill="#e9b47c"
          />
          <rect x="30" y="28" width="9" height="3.5" rx="1.7" transform="rotate(30 34 30)" fill="#fff" />
          <rect x="58" y="24" width="9" height="3.5" rx="1.7" transform="rotate(-20 62 26)" fill="#ffe066" />
          <rect x="68" y="50" width="9" height="3.5" rx="1.7" transform="rotate(70 72 52)" fill="#7fe0ff" />
          <rect x="24" y="56" width="9" height="3.5" rx="1.7" transform="rotate(-50 28 58)" fill="#ffe066" />
          <rect x="44" y="70" width="9" height="3.5" rx="1.7" transform="rotate(15 48 72)" fill="#fff" />
          <rect x="62" y="68" width="9" height="3.5" rx="1.7" transform="rotate(-35 66 70)" fill="#ff8fb1" />
          <path d="M26 36 A 28 28 0 0 1 44 22" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".55" />
        </>
      )
    default:
      return null
  }
}

// En vanlig pjäs: skugga, form med gradient, detaljer.
function Godis({ k, skala = 1 }) {
  const t = skala === 1 ? undefined : `translate(50 50) scale(${skala}) translate(-50 -50)`
  return (
    <g transform={t}>
      <g fill={FARGER[k].mork} transform="translate(50 54) scale(1.05) translate(-50 -50)" opacity=".9">
        <Form k={k} />
      </g>
      <g fill={`url(#kr-g${k})`}>
        <Form k={k} />
      </g>
      <Detaljer k={k} />
    </g>
  )
}

// ---------------------------------------------------------------- specialer

function Rander({ k, lodrat }) {
  const band = [26, 43, 60]
  return (
    <g clipPath={`url(#kr-c${k})`} className="kr-rander">
      {band.map((y) =>
        lodrat ? (
          <rect key={y} x={y} y="0" width="9" height="100" fill="#fff" opacity=".92" />
        ) : (
          <rect key={y} x="0" y={y} width="100" height="9" fill="#fff" opacity=".92" />
        )
      )}
    </g>
  )
}

function Pase({ k }) {
  const f = FARGER[k]
  return (
    <>
      <path d="M18 50 L3 36 Q1 50 3 64 Z" fill={f.ljus} stroke={f.mork} strokeWidth="2" strokeLinejoin="round" />
      <path d="M82 50 L97 36 Q99 50 97 64 Z" fill={f.ljus} stroke={f.mork} strokeWidth="2" strokeLinejoin="round" />
      <rect x="15" y="15" width="70" height="70" rx="18" fill={f.bas} opacity=".5" stroke="#fff" strokeWidth="3.5" />
      <path d="M24 28 Q30 20 40 20" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity=".8" />
      <circle cx="74" cy="74" r="2.5" fill="#fff" opacity=".8" />
      <rect x="15" y="15" width="70" height="70" rx="18" fill="none" stroke={f.mork} strokeWidth="1.5" opacity=".5" />
    </>
  )
}

export function Skal() {
  const mini = ['#f03a5f', '#ff8a1c', '#ffd21f', '#34c05a', '#2f8af0', '#a452ec']
  return (
    <g>
      <circle cx="50" cy="50" r="46" fill="url(#kr-regnbage)" opacity=".85" className="kr-skalring" />
      <ellipse cx="50" cy="86" rx="32" ry="5" fill="#000" opacity=".25" />
      <path d="M14 52 L86 52 L76 80 Q74 86 67 86 L33 86 Q26 86 24 80 Z" fill="url(#kr-metall)" stroke="#5d6b80" strokeWidth="2" />
      {mini.map((c, j) => (
        <circle key={c} cx={24 + j * 10.5} cy={j % 2 ? 42 : 46} r="7.5" fill={c} stroke="#fff" strokeWidth="1.2" />
      ))}
      <circle cx="44" cy="36" r="7" fill="#ffd21f" stroke="#fff" strokeWidth="1.2" />
      <circle cx="58" cy="35" r="7" fill="#f03a5f" stroke="#fff" strokeWidth="1.2" />
      <ellipse cx="50" cy="52" rx="36" ry="7" fill="none" stroke="#eef3f8" strokeWidth="4" />
      <ellipse cx="50" cy="52" rx="36" ry="7" fill="none" stroke="#5d6b80" strokeWidth="1.5" />
      {/* Happys tass på skålen */}
      <g fill="#f03a5f" transform="translate(50 70) scale(.16) translate(-50 -56)">
        <Form k={3} />
      </g>
      <path d="M30 60 L34 76" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <path d="M78 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#fff" className="kr-glimt" />
    </g>
  )
}

function Frisbee({ k }) {
  const f = FARGER[k]
  return (
    <g className="kr-sval">
      <ellipse cx="50" cy="60" rx="40" ry="21" fill={f.mork} />
      <ellipse cx="50" cy="55" rx="40" ry="21" fill={`url(#kr-g${k})`} />
      <ellipse cx="50" cy="54" rx="27" ry="13" fill="none" stroke={f.ljus} strokeWidth="3" opacity=".9" />
      <ellipse cx="50" cy="54" rx="14" ry="6.5" fill={f.ljus} opacity=".55" />
      <ellipse cx="36" cy="44" rx="12" ry="3.5" transform="rotate(-10 36 44)" fill="#fff" opacity=".7" />
      {/* bitmärke — Happy har redan testat den */}
      <path d="M84 46 q -4 3 0 6 q -4 3 0 6" stroke={f.mork} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  )
}

// ------------------------------------------------------------------- hinder

export function Lada({ hp }) {
  if (hp >= 3) {
    return (
      <g>
        <rect x="6" y="8" width="88" height="86" rx="7" fill="#4a2b12" />
        <rect x="6" y="6" width="88" height="84" rx="7" fill="url(#kr-tra)" stroke="#3b220d" strokeWidth="2.5" />
        <path d="M8 34 H92 M8 62 H92" stroke="#5a3616" strokeWidth="3" />
        <path d="M14 82 L86 14" stroke="#6e431d" strokeWidth="9" strokeLinecap="round" />
        <path d="M14 82 L86 14" stroke="#b27a45" strokeWidth="4" strokeLinecap="round" />
        {[
          [14, 14],
          [86, 14],
          [14, 82],
          [86, 82],
        ].map(([x, y]) => (
          <circle key={x + '-' + y} cx={x} cy={y} r="3" fill="#cfd6df" stroke="#57616e" strokeWidth="1" />
        ))}
      </g>
    )
  }
  return (
    <g>
      <rect x="7" y="10" width="86" height="84" rx="6" fill="#7a4d22" />
      <rect x="7" y="8" width="86" height="82" rx="6" fill="url(#kr-kartong)" stroke="#8a5a2b" strokeWidth="2" />
      <path d="M7 30 H93" stroke="#a36d38" strokeWidth="2.5" />
      <path d="M50 8 V30" stroke="#a36d38" strokeWidth="2.5" />
      <rect x="36" y="52" width="28" height="9" rx="4.5" fill="#8a5a2b" opacity=".55" />
      <path d="M16 70 l6 -6 m0 6 l-6 -6" stroke="#8a5a2b" strokeWidth="2" opacity=".6" />
      {hp >= 2 && (
        <>
          <rect x="7" y="40" width="86" height="12" fill="#f2e6b8" opacity=".92" />
          <rect x="44" y="8" width="12" height="82" fill="#f2e6b8" opacity=".92" />
          <path d="M7 40 h86 M7 52 h86" stroke="#d9c98f" strokeWidth="1" />
        </>
      )}
    </g>
  )
}

export function Ograss() {
  return (
    <g>
      <ellipse cx="50" cy="88" rx="38" ry="7" fill="#000" opacity=".25" />
      <circle cx="30" cy="62" r="22" fill="#1f5a26" />
      <circle cx="70" cy="62" r="22" fill="#1f5a26" />
      <circle cx="50" cy="48" r="26" fill="#2b7431" />
      <circle cx="28" cy="58" r="17" fill="#35883a" />
      <circle cx="72" cy="58" r="17" fill="#35883a" />
      <circle cx="50" cy="70" r="20" fill="#2b7431" />
      {[
        [18, 44, -40],
        [82, 44, 40],
        [50, 22, 0],
        [30, 80, -140],
        [70, 80, 140],
      ].map(([x, y, rot]) => (
        <path key={x + '-' + y} d={`M${x} ${y} l3 -9 3 9 z`} fill="#b9d98a" transform={`rotate(${rot} ${x + 3} ${y - 4})`} />
      ))}
      <circle cx="40" cy="34" r="9" fill="#c65bdc" />
      <circle cx="40" cy="34" r="4" fill="#f0b8ff" />
      <circle cx="64" cy="40" r="7" fill="#c65bdc" />
      <circle cx="64" cy="40" r="3" fill="#f0b8ff" />
      <ellipse cx="36" cy="54" rx="8" ry="3" transform="rotate(-30 36 54)" fill="#fff" opacity=".2" />
    </g>
  )
}

export function Kott() {
  return (
    <g>
      <ellipse cx="50" cy="90" rx="30" ry="5" fill="#000" opacity=".25" />
      <path d="M46 56 L26 76" stroke="#d8ccb0" strokeWidth="13" strokeLinecap="round" />
      <path d="M46 56 L26 76" stroke="#fbf6ea" strokeWidth="9" strokeLinecap="round" />
      <circle cx="19" cy="74" r="8" fill="#fbf6ea" stroke="#d8ccb0" strokeWidth="2" />
      <circle cx="28" cy="84" r="8" fill="#fbf6ea" stroke="#d8ccb0" strokeWidth="2" />
      <ellipse cx="60" cy="40" rx="30" ry="24" transform="rotate(-40 60 40)" fill="#7a2e12" />
      <ellipse cx="60" cy="37" rx="29" ry="23" transform="rotate(-40 60 37)" fill="url(#kr-kott)" />
      <ellipse cx="52" cy="28" rx="11" ry="5" transform="rotate(-40 52 28)" fill="#fff" opacity=".45" />
      <path d="M58 52 q6 -4 12 -2 M66 44 q6 -4 10 -1" stroke="#8a3616" strokeWidth="2" fill="none" opacity=".5" />
    </g>
  )
}

// Tennisbollen: faller som en pjäs men går inte att matcha, och stoppar
// raketer.
export function Boll() {
  return (
    <g>
      <ellipse cx="50" cy="88" rx="26" ry="5" fill="#000" opacity=".25" />
      <circle cx="50" cy="52" r="33" fill="#6b7d10" />
      <circle cx="50" cy="50" r="33" fill="url(#kr-boll)" />
      <path d="M22 32 C 40 40, 40 62, 22 70" stroke="#fdfdf2" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M78 30 C 60 40, 60 62, 78 70" stroke="#fdfdf2" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="40" cy="30" rx="9" ry="5" transform="rotate(-30 40 30)" fill="#fff" opacity=".45" />
    </g>
  )
}

export function Koppel() {
  return (
    <svg viewBox="0 0 100 100" className="kr-full" aria-hidden="true">
      <path d="M4 22 Q50 58 96 82" stroke="#7a0f1f" strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M4 22 Q50 58 96 82" stroke="#e02a44" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M4 82 Q50 46 96 22" stroke="#7a0f1f" strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M4 82 Q50 46 96 22" stroke="#e02a44" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M4 82 Q50 46 96 22" stroke="#ff8a9c" strokeWidth="2" fill="none" strokeDasharray="5 6" />
      <circle cx="50" cy="52" r="9" fill="none" stroke="#5f6b7a" strokeWidth="6" />
      <circle cx="50" cy="52" r="9" fill="none" stroke="#dfe6ee" strokeWidth="3" />
    </svg>
  )
}

export function Lera({ niva }) {
  return (
    <svg viewBox="0 0 100 100" className="kr-full" aria-hidden="true" preserveAspectRatio="none">
      <rect x="3" y="3" width="94" height="94" rx="18" fill={niva >= 2 ? '#4b2c12' : '#7a5028'} opacity={niva >= 2 ? '.95' : '.85'} />
      <circle cx="26" cy="30" r="9" fill={niva >= 2 ? '#5e3a1b' : '#916236'} />
      <circle cx="72" cy="68" r="12" fill={niva >= 2 ? '#5e3a1b' : '#916236'} />
      <circle cx="70" cy="24" r="5" fill={niva >= 2 ? '#5e3a1b' : '#916236'} />
      {niva >= 2 && (
        <g fill="#2e1a08" opacity=".7" transform="translate(22 60) scale(.22)">
          <Form k={3} />
        </g>
      )}
    </svg>
  )
}

// ------------------------------------------------------------------ pjäsen

// Allt som kan ligga i en ruta. tile kommer direkt från motorn.
export function Pjas({ tile }) {
  if (!tile) return null
  if (tile.typ === 'lada') {
    return (
      <svg viewBox="0 0 100 100" className="kr-full">
        <Lada hp={tile.hp} />
      </svg>
    )
  }
  if (tile.typ === 'ograss') {
    return (
      <svg viewBox="0 0 100 100" className="kr-full">
        <Ograss />
      </svg>
    )
  }
  if (tile.typ === 'kott') {
    return (
      <svg viewBox="0 0 100 100" className="kr-full">
        <Kott />
      </svg>
    )
  }
  if (tile.typ === 'boll') {
    return (
      <svg viewBox="0 0 100 100" className="kr-full">
        <Boll />
      </svg>
    )
  }
  const k = tile.farg
  const s = tile.special
  if (s === 'skal') {
    return (
      <svg viewBox="0 0 100 100" className="kr-full">
        <Skal />
      </svg>
    )
  }
  if (s === 'frisbee') {
    return (
      <svg viewBox="0 0 100 100" className="kr-full">
        <Frisbee k={k} />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 100 100" className="kr-full">
      {s === 'bomb' && <Pase k={k} />}
      <Godis k={k} skala={s === 'bomb' ? 0.72 : 0.92} />
      {(s === 'raket-h' || s === 'raket-v') && (
        <g transform="translate(50 50) scale(.92) translate(-50 -50)">
          <Rander k={k} lodrat={s === 'raket-v'} />
        </g>
      )}
    </svg>
  )
}

// Liten ikon för målen och butiken.
export function MalIkon({ mal, storlek = 28 }) {
  let inner
  switch (mal.typ) {
    case 'farg':
      inner = <Godis k={mal.farg} />
      break
    case 'lera':
      return (
        <div style={{ width: storlek, height: storlek }} className="relative">
          <Lera niva={1} />
        </div>
      )
    case 'lada':
      inner = <Lada hp={1} />
      break
    case 'ograss':
      inner = <Ograss />
      break
    case 'koppel':
      return (
        <div style={{ width: storlek, height: storlek }} className="relative">
          <svg viewBox="0 0 100 100" className="kr-full">
            <Godis k={3} skala={0.8} />
          </svg>
          <div className="absolute inset-0">
            <Koppel />
          </div>
        </div>
      )
    case 'kott':
      inner = <Kott />
      break
    case 'boll':
      inner = <Boll />
      break
    case 'klocka':
      inner = <KlockIkon />
      break
    case 'special':
      if (mal.special === 'skal') inner = <Skal />
      else if (mal.special === 'frisbee') inner = <Frisbee k={4} />
      else if (mal.special === 'bomb') {
        inner = (
          <>
            <Pase k={1} />
            <Godis k={1} skala={0.66} />
          </>
        )
      } else {
        inner = (
          <>
            <Godis k={0} skala={0.92} />
            <g transform="translate(50 50) scale(.92) translate(-50 -50)">
              <Rander k={0} lodrat={false} />
            </g>
          </>
        )
      }
      break
    default:
      inner = <circle cx="50" cy="50" r="30" fill="#fbbf24" />
  }
  return (
    <svg viewBox="0 0 100 100" width={storlek} height={storlek} aria-hidden="true">
      {inner}
    </svg>
  )
}

// Väckarklockan som sitter på pjäser med nedräkning.
export function KlockIkon() {
  return (
    <g>
      <circle cx="26" cy="22" r="11" fill="#f5b400" stroke="#8a5a00" strokeWidth="3" />
      <circle cx="74" cy="22" r="11" fill="#f5b400" stroke="#8a5a00" strokeWidth="3" />
      <circle cx="50" cy="56" r="36" fill="#e5333f" stroke="#7a1018" strokeWidth="4" />
      <circle cx="50" cy="56" r="27" fill="#fffaf0" />
      <path d="M50 56 V36 M50 56 L64 64" stroke="#1f2937" strokeWidth="5" strokeLinecap="round" />
      <path d="M28 92 l8 -10 M72 92 l-8 -10" stroke="#7a1018" strokeWidth="6" strokeLinecap="round" />
    </g>
  )
}

// Stjärna till mätaren, resultatet och kartan.
export function Stjarna({ fylld, storlek = 20, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={storlek} height={storlek} className={className} aria-hidden="true">
      <path
        d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8z"
        fill={fylld ? 'url(#kr-guld)' : '#475569'}
        stroke={fylld ? '#9a5b00' : '#1e293b'}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {fylld && <path d="M9 8.5l1.5-.3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />}
    </svg>
  )
}

export function Mynt({ storlek = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={storlek} height={storlek} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="url(#kr-guld)" stroke="#9a5b00" strokeWidth="1.3" />
      <circle cx="12" cy="12" r="6.8" fill="none" stroke="#b87500" strokeWidth="1" opacity=".7" />
      <g fill="#b87500" transform="translate(12 12.4) scale(.1) translate(-50 -56)">
        <Form k={3} />
      </g>
    </svg>
  )
}

// Delade gradienter och urklipp. Renderas en gång per spel.
export function KrossenDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {FARGER.map((f, k) => (
          <radialGradient key={k} id={`kr-g${k}`} gradientUnits="userSpaceOnUse" cx="36" cy="30" r="72">
            <stop offset="0" stopColor={f.ljus} />
            <stop offset=".5" stopColor={f.bas} />
            <stop offset="1" stopColor={f.mork} />
          </radialGradient>
        ))}
        {FARGER.map((_, k) => (
          <clipPath key={k} id={`kr-c${k}`}>
            <Form k={k} />
          </clipPath>
        ))}
        <linearGradient id="kr-metall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6f9fc" />
          <stop offset=".45" stopColor="#c3cedb" />
          <stop offset="1" stopColor="#7d8ca1" />
        </linearGradient>
        <linearGradient id="kr-kartong" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e3ad6f" />
          <stop offset="1" stopColor="#c08447" />
        </linearGradient>
        <linearGradient id="kr-tra" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9834d" />
          <stop offset="1" stopColor="#7a4b22" />
        </linearGradient>
        <radialGradient id="kr-boll" cx=".38" cy=".32" r=".75">
          <stop offset="0" stopColor="#f6ff9e" />
          <stop offset=".55" stopColor="#d4ec2c" />
          <stop offset="1" stopColor="#8fa512" />
        </radialGradient>
        <radialGradient id="kr-kott" cx=".4" cy=".3" r=".8">
          <stop offset="0" stopColor="#f0a468" />
          <stop offset=".55" stopColor="#c45a27" />
          <stop offset="1" stopColor="#8a3313" />
        </radialGradient>
        <linearGradient id="kr-guld" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3a0" />
          <stop offset=".5" stopColor="#ffc928" />
          <stop offset="1" stopColor="#f08c00" />
        </linearGradient>
        <radialGradient id="kr-regnbage" cx=".5" cy=".5" r=".5">
          <stop offset=".55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset=".72" stopColor="#ff7eb6" stopOpacity=".7" />
          <stop offset=".82" stopColor="#ffd35c" stopOpacity=".7" />
          <stop offset=".9" stopColor="#6ee7ff" stopOpacity=".6" />
          <stop offset="1" stopColor="#b388ff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  )
}
