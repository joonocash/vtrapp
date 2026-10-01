import { useEffect, useMemo, useRef, useState } from 'react'
import { BANOR, VARLDAR, BANOR_PER_VARLD, OANDLIG_VARLD } from './levels.js'
import { stjarnorFor, oppen, totaltStjarnor, kistStatus, KISTA_VAR, SVAR_BONUS } from './store.js'
import { Stjarna, Mynt, MalIkon } from './pieces.jsx'
import { HappyBild } from './happy.jsx'
import { SkalKnapp } from './Samling.jsx'
import { skapaRng } from './engine.js'
import { hamtaTopplista, banaId, spelarfarg } from './synk.js'
import { Topplista } from './Spelplan.jsx'
import { KistBild } from './Dagligt.jsx'

// Kartan: Happys promenad genom tio världar. Bana 1 längst ner, stigen
// slingrar sig uppåt, och överst väntar den oändliga promenaden. Kartan är
// också navet för albumet, garderoben, skålen och statistiken.

const STEG = 74 // pixlar mellan två banor på höjden
const TOPP = 90 // luft ovanför sista banan
const BOTTEN = 70

const xFor = (nr) => 50 + Math.sin(nr * 0.78) * 30 + Math.sin(nr * 0.23) * 6
// åt vilket håll mitten av kartan ligger från en bana: +1 höger, -1 vänster
const mot = (nr) => (xFor(nr) > 50 ? -1 : 1)

export default function Karta({
  save,
  aktuell,
  hoppFran,
  kompisar = [],
  spelare,
  albumNya = 0,
  onValj,
  onTillbaka,
  onKista,
  onOandlig,
  onAlbum,
  onGarderob,
  onStatistik,
  onSkal,
}) {
  const [vald, setVald] = useState(null)
  const skrollRef = useRef(null)
  // en plats extra överst för den oändliga promenaden
  const hojd = TOPP + BANOR.length * STEG + BOTTEN
  const oandligOppen = stjarnorFor(save, BANOR.length) > 0
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

  const stig = useMemo(
    () => [...BANOR.map((b) => b.nr), BANOR.length + 1].map((nr) => `${xFor(nr)},${yFor(nr)}`).join(' '),
    [hojd] // eslint-disable-line react-hooks/exhaustive-deps
  )

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
          <KistKnapp save={save} onKista={onKista} />
          <span>
            <Stjarna fylld storlek={16} /> {totaltStjarnor(save)}
          </span>
          <span>
            <Mynt storlek={16} /> {save.mynt}
          </span>
        </div>
      </div>
      <div className="kr-kartnav">
        <button className="kr-navknapp" onClick={onAlbum}>
          <span className="kr-navikon">📷</span>
          Album
          {albumNya > 0 && <span className="kr-booster-bricka">{albumNya}</span>}
        </button>
        <button className="kr-navknapp" onClick={onGarderob}>
          <span className="kr-navikon">🎩</span>
          Garderob
        </button>
        <button className="kr-navknapp" onClick={onStatistik}>
          <span className="kr-navikon">📊</span>
          Statistik
        </button>
        <SkalKnapp godis={save.godis || 0} onClick={onSkal} />
      </div>

      <div className="kr-kartskroll" ref={skrollRef}>
        <div className="kr-kartinnehall" style={{ height: hojd }}>
          <div
            className="kr-varld"
            style={{ top: 0, height: yFor(BANOR.length) - STEG / 2, background: `linear-gradient(180deg, ${OANDLIG_VARLD.himmel[0]}, ${OANDLIG_VARLD.himmel[1]})` }}
          >
            <div className="kr-varldnamn" style={{ color: OANDLIG_VARLD.mork }}>
              ∞ {OANDLIG_VARLD.namn}
            </div>
          </div>
          {VARLDAR.map((v, k) => {
            const topp = yFor((k + 1) * BANOR_PER_VARLD) - STEG / 2
            const botten = k === 0 ? hojd : yFor(k * BANOR_PER_VARLD + 1) + STEG / 2
            return (
              <div
                key={v.namn}
                className="kr-varld"
                style={{ top: topp, height: botten - topp, background: `linear-gradient(180deg, ${v.himmel[0]}, ${v.himmel[1]})` }}
              />
            )
          })}

          {dekor.map((d, k) => (
            <Dekor key={k} {...d} />
          ))}

          {/* världens namn ovanpå dekoren, på motsatt sida mot världens sista bana */}
          {VARLDAR.map((v, k) => {
            const sista = (k + 1) * BANOR_PER_VARLD
            return (
              <div
                key={v.namn}
                className={'kr-varldnamn' + (xFor(sista) < 50 ? ' kr-varldnamn-hoger' : '')}
                style={{ top: yFor(sista) - STEG / 2 + 10, color: v.mork }}
              >
                {k + 1}. {v.namn}
              </div>
            )
          })}

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
                className={
                  'kr-nod' +
                  (b.boss ? ' kr-nod-boss' : '') +
                  (b.svarighet === 1 ? ' kr-nod-svar' : b.svarighet === 2 && !b.boss ? ' kr-nod-supersvar' : '') +
                  (!oppnad ? ' kr-nod-last' : '') +
                  (b.nr === aktuell ? ' kr-nod-aktuell' : '')
                }
                style={{ left: xFor(b.nr) + '%', top: yFor(b.nr), '--nodfarg': v.farg, '--nodmork': v.mork }}
                onClick={() => oppnad && setVald(b.nr)}
                disabled={!oppnad}
                aria-label={`Bana ${b.nr}${oppnad ? '' : ', låst'}${st ? `, ${st} stjärnor` : ''}`}
              >
                <span className="kr-nodtal">{oppnad ? b.nr : '🔒'}</span>
                {b.svarighet > 0 && oppnad && <span className="kr-nodsvar">{b.svarighet === 2 ? '💀' : '!'}</span>}
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

          <button
            className={'kr-nod kr-nod-oandlig' + (!oandligOppen ? ' kr-nod-last' : '')}
            style={{ left: xFor(BANOR.length + 1) + '%', top: yFor(BANOR.length + 1) }}
            onClick={() => oandligOppen && onOandlig()}
            disabled={!oandligOppen}
            aria-label={oandligOppen ? 'Oändliga promenaden' : 'Oändliga promenaden, låst'}
          >
            <span className="kr-nodtal">{oandligOppen ? '∞' : '🔒'}</span>
            {oandligOppen && <span className="kr-nod-oandlig-text">{save.oandlig ? `${save.oandlig} klarade` : 'Börja!'}</span>}
          </button>

          <div
            className="kr-kartahappy"
            style={{ left: `calc(${xFor(happyNr)}% ${mot(happyNr) > 0 ? '+' : '-'} 50px)`, top: yFor(happyNr) - 24 }}
          >
            <HappyBild storlek={48} ramBredd={4} />
          </div>

          {kompisarPaKartan(kompisar, spelare).map((k) => {
            // mot mitten av kartan, efter Happy om Happy står på samma bana
            const avstand = (k.nr === happyNr ? 96 : 42) + k.plats * 36
            return (
              <div
                key={k.player}
                className="kr-kompis"
                style={{ left: `calc(${xFor(k.nr)}% ${mot(k.nr) > 0 ? '+' : '-'} ${avstand}px)`, top: yFor(k.nr) - 13, '--kompisfarg': k.fler ? '#6b7280' : spelarfarg(k.player) }}
                title={k.fler ? k.namn.join(', ') : `${k.player} är på bana ${k.nr}`}
              >
                <span className="kr-kompis-boll">{k.fler ? '+' + k.fler : k.player.slice(0, 1).toUpperCase()}</span>
                {!k.fler && <span className="kr-kompis-namn">{k.player}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {vald !== null && <BanKort nr={vald} save={save} spelare={spelare} onSpela={() => onValj(vald)} onStang={() => setVald(null)} />}
    </div>
  )
}

// Kompisarna står vid banan de är på (den efter deras högsta klarade).
// Flera på samma bana läggs bredvid varandra, på den sida av stigen där det
// finns plats.
// Högst två bubblor per bana, resten samlas i en "+3".
function kompisarPaKartan(kompisar, spelare) {
  const perBana = new Map()
  for (const k of kompisar) {
    if (k.player === spelare) continue
    const nr = Math.min(BANOR.length, (k.hogsta || 0) + 1)
    if (!perBana.has(nr)) perBana.set(nr, [])
    perBana.get(nr).push(k)
  }
  const ut = []
  for (const [nr, lista] of perBana) {
    lista.slice(0, 2).forEach((k, plats) => ut.push({ ...k, nr, plats }))
    if (lista.length > 2) {
      const rest = lista.slice(2)
      ut.push({ player: 'fler-' + nr, nr, plats: 2, fler: rest.length, namn: rest.map((k) => k.player) })
    }
  }
  return ut
}

function KistKnapp({ save, onKista }) {
  const { redo, mot } = kistStatus(save)
  return (
    <button className={'kr-kistknapp' + (redo ? ' kr-kistknapp-redo' : '')} onClick={() => redo && onKista()} title="Stjärnkistan: var tjugonde stjärna fyller den">
      <KistBild storlek={26} />
      {redo ? (
        <span className="kr-kistknapp-text">Öppna!</span>
      ) : (
        <span className="kr-kistmatare">
          <span style={{ width: (mot / KISTA_VAR) * 100 + '%' }} />
        </span>
      )}
    </button>
  )
}

// Kortet som kommer upp när man trycker på en bana: målen, ens stjärnor och
// kompisarnas bästa, och en knapp för att spela.
function BanKort({ nr, save, spelare, onSpela, onStang }) {
  const bana = BANOR[nr - 1]
  const varld = VARLDAR[bana.varld]
  const st = stjarnorFor(save, nr)
  const [lista, setLista] = useState(null)
  useEffect(() => {
    let levande = true
    hamtaTopplista(banaId(nr)).then((l) => levande && setLista(l))
    return () => {
      levande = false
    }
  }, [nr])
  return (
    <div className="kr-ruta-bakgrund" onClick={onStang}>
      <div className="kr-ruta kr-bankort" onClick={(e) => e.stopPropagation()}>
        <div className="kr-bankort-varld" style={{ color: varld.mork }}>
          {varld.namn}
        </div>
        <div className="kr-ruta-titel">
          Bana {nr}
          {bana.boss ? ' · Boss' : ''}
        </div>
        {bana.svarighet > 0 && (
          <div className={'kr-svarmarke kr-svarmarke-' + bana.svarighet}>
            {bana.svarighet === 2 ? 'Supersvår' : 'Svår'}
            {!st && ` · +${SVAR_BONUS[bana.svarighet]} mynt extra`}
          </div>
        )}
        <div className="kr-resultat-stjarnor">
          {[0, 1, 2].map((k) => (
            <Stjarna key={k} fylld={st > k} storlek={30} />
          ))}
        </div>
        <div className="kr-mallista">
          {bana.mal.map((m, k) => (
            <div key={k} className="kr-malpost kr-malpost-stor">
              {m.typ === 'poang' ? (
                <span className="kr-malpoang">{m.antal.toLocaleString('sv-SE')}</span>
              ) : (
                <>
                  <MalIkon mal={m} storlek={30} />
                  {m.antal ? <span className="kr-malantal">{m.antal}</span> : null}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="kr-ruta-sma">{bana.drag} drag</div>
        <Topplista lista={lista} spelare={spelare} />
        <div className="kr-ruta-knappar">
          <button className="kr-knapp kr-knapp-stor" onClick={onSpela}>
            Spela
          </button>
          <button className="kr-knapp kr-knapp-lank" onClick={onStang}>
            Stäng
          </button>
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
  } else if (varld === 5) {
    // Snön: granar med snö och snögubbar
    svg =
      typ === 0 ? (
        <svg viewBox="0 0 40 56" width="40" height="56">
          <rect x="17" y="40" width="6" height="14" fill="#6b4b2a" />
          <path d="M20 2 L36 30 H27 L36 44 H4 L13 30 H4 Z" fill="#2f6e4f" />
          <path d="M20 2 L28 16 L20 13 L12 16 Z M10 30 L20 26 L30 30 L27 33 L13 33 Z" fill="#fff" />
        </svg>
      ) : (
        <svg viewBox="0 0 36 50" width="36" height="50">
          <circle cx="18" cy="36" r="12" fill="#fff" stroke="#cfe3f5" strokeWidth="2" />
          <circle cx="18" cy="17" r="9" fill="#fff" stroke="#cfe3f5" strokeWidth="2" />
          <path d="M18 17 l7 2 -7 1 z" fill="#ff8a1c" />
          <circle cx="15" cy="14" r="1.4" fill="#1f2937" />
          <circle cx="21" cy="14" r="1.4" fill="#1f2937" />
          <rect x="10" y="4" width="16" height="5" fill="#1f2937" />
          <rect x="13" y="-2" width="10" height="7" fill="#1f2937" />
        </svg>
      )
  } else if (varld === 6) {
    // Hundutställningen: rosetter och pokaler
    svg =
      typ === 0 ? (
        <svg viewBox="0 0 40 50" width="40" height="50">
          <path d="M14 26 L8 48 L16 42 L20 50 L22 28 Z M26 26 L32 48 L24 42 L20 50 L18 28 Z" fill="#2f8af0" />
          <circle cx="20" cy="18" r="15" fill="#ffd21f" stroke="#b98400" strokeWidth="2" />
          <circle cx="20" cy="18" r="8" fill="#fff6c2" />
          <text x="20" y="22" textAnchor="middle" fontSize="11" fontWeight="900" fill="#b98400">1</text>
        </svg>
      ) : (
        <svg viewBox="0 0 40 50" width="40" height="50">
          <path d="M8 6 H32 V16 Q32 30 20 30 Q8 30 8 16 Z" fill="url(#kr-guld)" stroke="#9a5b00" strokeWidth="2" />
          <path d="M8 10 Q0 10 2 18 Q4 24 10 22 M32 10 Q40 10 38 18 Q36 24 30 22" stroke="#9a5b00" strokeWidth="2.5" fill="none" />
          <rect x="17" y="30" width="6" height="8" fill="#c99a1a" />
          <rect x="10" y="38" width="20" height="8" rx="2" fill="#7a4d22" />
        </svg>
      )
  } else if (varld === 7) {
    // Veterinären: plåster och kors
    svg =
      typ === 0 ? (
        <svg viewBox="0 0 40 40" width="40" height="40">
          <rect x="4" y="4" width="32" height="32" rx="8" fill="#fff" stroke="#bfe3dc" strokeWidth="2" />
          <path d="M16 10 H24 V16 H30 V24 H24 V30 H16 V24 H10 V16 H16 Z" fill="#e5333f" />
        </svg>
      ) : (
        <svg viewBox="0 0 50 26" width="50" height="26">
          <rect x="2" y="4" width="46" height="18" rx="9" fill="#f6c99a" transform="rotate(-12 25 13)" />
          <rect x="17" y="6" width="16" height="14" rx="2" fill="#f9dcbf" transform="rotate(-12 25 13)" />
        </svg>
      )
  } else if (varld === 8) {
    // Stugan: stockar och lyktor
    svg =
      typ === 0 ? (
        <svg viewBox="0 0 50 50" width="50" height="50">
          <path d="M4 24 L25 6 L46 24 Z" fill="#7a2e12" />
          <rect x="8" y="24" width="34" height="24" fill="#a86e36" />
          <path d="M8 30 H42 M8 36 H42 M8 42 H42" stroke="#7a4d22" strokeWidth="1.5" />
          <rect x="20" y="32" width="10" height="16" fill="#5a3616" />
          <rect x="11" y="28" width="7" height="7" fill="#ffe28a" />
        </svg>
      ) : (
        <svg viewBox="0 0 50 22" width="50" height="22">
          <rect x="2" y="4" width="40" height="14" rx="7" fill="#8a5a2b" />
          <ellipse cx="42" cy="11" rx="6" ry="7" fill="#d9a066" stroke="#8a5a2b" strokeWidth="2" />
          <circle cx="42" cy="11" r="3" fill="none" stroke="#8a5a2b" strokeWidth="1" />
        </svg>
      )
  } else if (varld === 9) {
    // Rymden: planeter och stjärnor
    svg =
      typ === 0 ? (
        <svg viewBox="0 0 50 40" width="50" height="40">
          <circle cx="25" cy="20" r="13" fill="#ff8a5c" />
          <ellipse cx="25" cy="20" rx="23" ry="6" fill="none" stroke="#ffd35c" strokeWidth="3" transform="rotate(-15 25 20)" />
          <circle cx="20" cy="15" r="3" fill="#ffb08f" />
        </svg>
      ) : (
        <svg viewBox="0 0 30 30" width="30" height="30">
          <path d="M15 1 l3.5 9.5 10 .5 -8 6 3 10 -8.5 -6 -8.5 6 3 -10 -8 -6 10 -.5 z" fill="#fff6c2" />
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
