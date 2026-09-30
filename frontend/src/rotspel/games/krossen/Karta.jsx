import { useEffect, useMemo, useRef, useState } from 'react'
import { BANOR, VARLDAR, BANOR_PER_VARLD } from './levels.js'
import { stjarnorFor, oppen, totaltStjarnor } from './store.js'
import { Stjarna, Mynt, HAPPY } from './pieces.jsx'
import { skapaRng } from './engine.js'

// Kartan: Happys promenad genom fem världar. Bana 1 längst ner, stigen
// slingrar sig uppåt. Tryck på en öppen bana för att spela den direkt.

const STEG = 74 // pixlar mellan två banor på höjden
const TOPP = 90 // luft ovanför sista banan
const BOTTEN = 70

const xFor = (nr) => 50 + Math.sin(nr * 0.78) * 30 + Math.sin(nr * 0.23) * 6

export default function Karta({ save, aktuell, hoppFran, onValj, onTillbaka }) {
  const skrollRef = useRef(null)
  const hojd = TOPP + (BANOR.length - 1) * STEG + BOTTEN
  const yFor = (nr) => hojd - BOTTEN - (nr - 1) * STEG
  const [happyNr, setHappyNr] = useState(hoppFran || aktuell)

  // skrolla så att aktuell bana hamnar mitt i bild
  useEffect(() => {
    const el = skrollRef.current
    if (!el) return
    el.scrollTop = yFor(hoppFran || aktuell) - el.clientHeight / 2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Happy skuttar från förra banan till nästa
  useEffect(() => {
    if (!hoppFran || hoppFran === aktuell) return
    const t = setTimeout(() => {
      setHappyNr(aktuell)
      const el = skrollRef.current
      if (el) el.scrollTo({ top: yFor(aktuell) - el.clientHeight / 2, behavior: 'smooth' })
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoppFran, aktuell])

  const stig = useMemo(() => BANOR.map((b) => `${xFor(b.nr)},${yFor(b.nr)}`).join(' '), [hojd]) // eslint-disable-line react-hooks/exhaustive-deps

  const dekor = useMemo(() => {
    const ut = []
    VARLDAR.forEach((v, k) => {
      const rng = skapaRng(k + 11)
      const fran = yFor(k * BANOR_PER_VARLD + BANOR_PER_VARLD)
      const till = yFor(k * BANOR_PER_VARLD + 1)
      for (let n = 0; n < 24; n++) {
        const sida = n % 2 ? 1 : -1
        ut.push({
          varld: k,
          x: sida > 0 ? 80 + rng() * 16 : 4 + rng() * 16,
          y: fran + (till - fran) * rng(),
          s: 0.8 + rng() * 0.7,
          typ: Math.floor(rng() * 2),
        })
      }
    })
    return ut
  }, [hojd]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="kr-karta">
      <div className="kr-kartrad">
        <button className="kr-knapp kr-knapp-sekundar kr-knapp-liten" onClick={onTillbaka}>
          ← Spela
        </button>
        <div className="kr-kartstat">
          <span>
            <Stjarna fylld storlek={16} /> {totaltStjarnor(save)}
          </span>
          <span>
            <Mynt storlek={16} /> {save.mynt}
          </span>
        </div>
      </div>

      <div className="kr-kartskroll" ref={skrollRef}>
        <div className="kr-kartinnehall" style={{ height: hojd }}>
          {VARLDAR.map((v, k) => {
            const topp = k === VARLDAR.length - 1 ? 0 : yFor((k + 1) * BANOR_PER_VARLD) - STEG / 2
            const botten = k === 0 ? hojd : yFor(k * BANOR_PER_VARLD + 1) + STEG / 2
            return (
              <div
                key={v.namn}
                className="kr-varld"
                style={{ top: topp, height: botten - topp, background: `linear-gradient(180deg, ${v.himmel[0]}, ${v.himmel[1]})` }}
              >
                <div className="kr-varldnamn" style={{ color: v.mork }}>
                  {k + 1}. {v.namn}
                </div>
              </div>
            )
          })}

          {dekor.map((d, k) => (
            <Dekor key={k} {...d} />
          ))}

          <svg className="kr-stig" width="100%" height={hojd} viewBox={`0 0 100 ${hojd}`} preserveAspectRatio="none" aria-hidden="true">
            <polyline points={stig} fill="none" stroke="rgba(60,40,20,.35)" strokeWidth="9" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <polyline
              points={stig}
              fill="none"
              stroke="#fff7e6"
              strokeWidth="5"
              strokeDasharray="2 10"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>

          {BANOR.map((b) => {
            const oppnad = oppen(save, b.nr)
            const st = stjarnorFor(save, b.nr)
            const v = VARLDAR[b.varld]
            return (
              <button
                key={b.nr}
                className={'kr-nod' + (b.boss ? ' kr-nod-boss' : '') + (!oppnad ? ' kr-nod-last' : '') + (b.nr === aktuell ? ' kr-nod-aktuell' : '')}
                style={{ left: xFor(b.nr) + '%', top: yFor(b.nr), '--nodfarg': v.farg, '--nodmork': v.mork }}
                onClick={() => oppnad && onValj(b.nr)}
                disabled={!oppnad}
                aria-label={`Bana ${b.nr}${oppnad ? '' : ', låst'}${st ? `, ${st} stjärnor` : ''}`}
              >
                <span className="kr-nodtal">{oppnad ? b.nr : '🔒'}</span>
                {st > 0 && (
                  <span className="kr-nodstjarnor">
                    {[0, 1, 2].map((k) => (
                      <Stjarna key={k} fylld={st > k} storlek={12} />
                    ))}
                  </span>
                )}
              </button>
            )
          })}

          <div className="kr-kartahappy" style={{ left: xFor(happyNr) + '%', top: yFor(happyNr) - 74 }}>
            <img src={HAPPY.nojd} alt="Happy" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Små kulisser längs stigen: träd, buskar, parasoller, hus.
function Dekor({ varld, x, y, s, typ }) {
  const stil = { left: x + '%', top: y, transform: `translate(-50%,-100%) scale(${s})` }
  let svg
  if (varld === 0 || varld === 2) {
    const krona = varld === 2 ? '#1f5a2e' : '#3f9d4a'
    svg =
      typ === 0 || varld === 2 ? (
        <svg viewBox="0 0 40 56" width="40" height="56">
          <rect x="17" y="36" width="6" height="18" rx="2" fill="#7a4d22" />
          {varld === 2 ? (
            <path d="M20 2 L36 30 H26 L34 44 H6 L14 30 H4 Z" fill={krona} />
          ) : (
            <>
              <circle cx="20" cy="24" r="16" fill={krona} />
              <circle cx="12" cy="30" r="10" fill="#57b85f" />
              <circle cx="27" cy="16" r="6" fill="#7ccf7f" opacity=".6" />
            </>
          )}
        </svg>
      ) : (
        <svg viewBox="0 0 40 30" width="40" height="30">
          <circle cx="12" cy="20" r="10" fill="#4caf50" />
          <circle cx="26" cy="18" r="12" fill="#5cbf60" />
          <circle cx="16" cy="12" r="3" fill="#f06a8a" />
          <circle cx="30" cy="10" r="3" fill="#ffd21f" />
        </svg>
      )
  } else if (varld === 1) {
    svg =
      typ === 0 ? (
        <svg viewBox="0 0 44 50" width="44" height="50">
          <rect x="20" y="30" width="4" height="20" fill="#6b4b2a" />
          <circle cx="22" cy="20" r="18" fill="#2f9e5e" />
          <circle cx="14" cy="24" r="9" fill="#3fb86f" />
        </svg>
      ) : (
        <svg viewBox="0 0 50 26" width="50" height="26">
          <rect x="4" y="8" width="42" height="5" rx="2" fill="#9a6b3c" />
          <rect x="4" y="15" width="42" height="4" rx="2" fill="#b07d48" />
          <rect x="8" y="19" width="3" height="7" fill="#444" />
          <rect x="39" y="19" width="3" height="7" fill="#444" />
        </svg>
      )
  } else if (varld === 3) {
    svg =
      typ === 0 ? (
        <svg viewBox="0 0 44 52" width="44" height="52">
          <rect x="21" y="16" width="3" height="36" fill="#8a6a44" />
          <path d="M2 18 Q22 -6 42 18 Z" fill="#ff6b6b" />
          <path d="M12 18 Q22 0 32 18 Z" fill="#fff" />
        </svg>
      ) : (
        <svg viewBox="0 0 50 30" width="50" height="30">
          <path d="M0 22 Q12 12 25 22 T50 22 V30 H0 Z" fill="#4fb8e8" opacity=".8" />
          <path d="M0 26 Q12 18 25 26 T50 26" stroke="#fff" strokeWidth="2" fill="none" />
        </svg>
      )
  } else {
    const hus = typ === 0 ? '#5b3fa0' : '#44307a'
    svg = (
      <svg viewBox="0 0 36 60" width="36" height="60">
        <rect x="2" y="8" width="32" height="52" rx="2" fill={hus} />
        {[14, 26, 38, 50].map((yy) =>
          [8, 20].map((xx) => <rect key={xx + '-' + yy} x={xx} y={yy} width="7" height="7" rx="1" fill={(xx + yy) % 3 ? '#ffe28a' : '#6f58b8'} />)
        )}
      </svg>
    )
  }
  return (
    <div className="kr-dekor" style={stil} aria-hidden="true">
      {svg}
    </div>
  )
}
