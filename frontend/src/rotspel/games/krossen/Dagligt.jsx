import { useEffect, useRef, useState } from 'react'
import { HJUL, SERIE, kanSnurra, dagensKlar, snurra, beskrivBelonning, DAGENS_BELONNING } from './store.js'
import { hamtaTopplista, dagensId } from './synk.js'
import { Mynt, HAPPY } from './pieces.jsx'
import { BoosterIkon, Topplista } from './Spelplan.jsx'

// Det dagliga: inloggningsserien, lyckohjulet och dagens bana, samlat i en
// ruta som öppnas med presentknappen. Inget av det står i vägen när man
// öppnar spelet — presentknappen lyser när det finns något att hämta.

function Belonning({ b, storlek = 24 }) {
  return (
    <span className="kr-belonning">
      {b.booster && <BoosterIkon typ={b.booster} />}
      {b.mynt ? (
        <span className="kr-belonning-mynt">
          <Mynt storlek={storlek * 0.6} />
          {b.mynt}
        </span>
      ) : null}
    </span>
  )
}

export function Dagligt({ save, idag, spelare, onSnurra, onDagens, onStang }) {
  const [topp, setTopp] = useState(null)
  useEffect(() => {
    let levande = true
    hamtaTopplista(dagensId(idag)).then((l) => levande && setTopp(l))
    return () => {
      levande = false
    }
  }, [idag])

  const serie = save.dagligt.serie || 1
  const snurr = kanSnurra(save, idag)
  const klar = dagensKlar(save, idag)

  return (
    <div className="kr-ruta-bakgrund" onClick={onStang}>
      <div className="kr-ruta kr-ark" onClick={(e) => e.stopPropagation()}>
        <img src={HAPPY.glad} alt="" className="kr-happy kr-happy-liten" />
        <div className="kr-ruta-titel">Dagens godis</div>

        <div className="kr-sektion">
          <div className="kr-sektion-rubrik">Dag {serie} i rad</div>
          <div className="kr-serie">
            {SERIE.map((b, k) => (
              <div
                key={k}
                className={'kr-seriedag' + (k + 1 < serie ? ' kr-seriedag-tagen' : '') + (k + 1 === serie ? ' kr-seriedag-idag' : '')}
                title={beskrivBelonning(b)}
              >
                <span className="kr-seriedag-nr">{k + 1}</span>
                <Belonning b={b} storlek={20} />
              </div>
            ))}
          </div>
          <div className="kr-ruta-sma">Kom tillbaka i morgon för dag {(serie % SERIE.length) + 1}. Missar du en dag börjar serien om.</div>
        </div>

        <div className="kr-sektion">
          <div className="kr-sektion-rubrik">Lyckohjulet</div>
          <button className="kr-knapp" disabled={!snurr} onClick={onSnurra}>
            {snurr ? 'Snurra!' : 'Nytt snurr i morgon'}
          </button>
        </div>

        <div className="kr-sektion">
          <div className="kr-sektion-rubrik">Dagens bana</div>
          <div className="kr-ruta-sma">
            Samma bräde för alla i dag. Första vinsten ger {DAGENS_BELONNING} mynt.
            {klar && ` Ditt bästa: ${save.dagligt.dagensPoang.toLocaleString('sv-SE')} poäng.`}
          </div>
          <Topplista lista={topp} spelare={spelare} antal={3} />
          <button className="kr-knapp kr-knapp-sekundar" onClick={onDagens}>
            {klar ? 'Spela igen' : 'Spela dagens bana'}
          </button>
        </div>

        <button className="kr-knapp kr-knapp-lank" onClick={onStang}>
          Stäng
        </button>
      </div>
    </div>
  )
}

// Lyckohjulet. Vinsten slumpas när man trycker, hjulet snurrar dit, och
// först när det stannat läggs belöningen till.
export function Hjul({ ljud, onVinst, onStang }) {
  const [vinkel, setVinkel] = useState(0)
  const [lage, setLage] = useState('redo') // redo, snurrar, klar
  const [vinst, setVinst] = useState(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const SEKTOR = 360 / HJUL.length
  const TID = 4600

  function starta() {
    if (lage !== 'redo') return
    const k = snurra()
    const jitter = (Math.random() - 0.5) * SEKTOR * 0.6
    const mal = 360 * 6 + (360 - k * SEKTOR) + jitter
    setVinkel(mal)
    setLage('snurrar')
    // ett tick varje gång en sektor passerar pilen, glesare mot slutet
    const passager = Math.floor(mal / SEKTOR)
    for (let j = 1; j <= passager; j++) {
      const p = (j * SEKTOR) / mal
      const t = 1 - Math.cbrt(1 - p)
      timers.current.push(setTimeout(() => ljud.hjulTick(), t * TID))
    }
    timers.current.push(
      setTimeout(() => {
        setLage('klar')
        setVinst(k)
        ljud.vinst()
        onVinst(k)
      }, TID + 100)
    )
  }

  // sektor k har sin mitt rakt upp när hjulet står på k * SEKTOR grader
  const bakgrund = `conic-gradient(from ${-SEKTOR / 2}deg, ${HJUL.map((x, k) => `${x.farg} ${k * SEKTOR}deg ${(k + 1) * SEKTOR}deg`).join(',')})`

  return (
    <div className="kr-ruta-bakgrund">
      <div className="kr-ruta kr-ark">
        <div className="kr-ruta-titel">Lyckohjulet</div>
        <div className="kr-hjul-ram">
          <div className="kr-hjul-pil" />
          <div
            className="kr-hjul"
            style={{
              background: bakgrund,
              transform: `rotate(${vinkel}deg)`,
              transition: lage === 'snurrar' ? `transform ${TID}ms cubic-bezier(.15,.85,.25,1)` : 'none',
            }}
          >
            {HJUL.map((x, k) => (
              <div key={k} className="kr-hjul-sektor" style={{ transform: `rotate(${k * SEKTOR}deg)` }}>
                <div className="kr-hjul-innehall">
                  <Belonning b={x} storlek={22} />
                </div>
              </div>
            ))}
            <div className="kr-hjul-nav">
              <img src={HAPPY.nojd} alt="" />
            </div>
          </div>
        </div>
        {lage === 'klar' && vinst !== null ? (
          <>
            <div className="kr-ruta-text">Du vann {beskrivBelonning(HJUL[vinst])}!</div>
            <button className="kr-knapp kr-knapp-stor" onClick={onStang}>
              Hämta
            </button>
          </>
        ) : (
          <button className="kr-knapp kr-knapp-stor" onClick={starta} disabled={lage !== 'redo'}>
            {lage === 'redo' ? 'Snurra!' : 'Snurrar …'}
          </button>
        )}
      </div>
    </div>
  )
}

// Stjärnkistan öppnas. Innehållet är redan bestämt av den som öppnade den.
export function Kista({ innehall, ljud, onStang }) {
  const [oppen, setOppen] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => {
      setOppen(true)
      ljud.kista()
    }, 450)
    return () => clearTimeout(t)
  }, [ljud])
  return (
    <div className="kr-ruta-bakgrund">
      <div className="kr-ruta kr-ark">
        <div className="kr-ruta-titel">Stjärnkistan</div>
        <div className={'kr-kista' + (oppen ? ' kr-kista-oppen' : '')}>
          <KistBild />
        </div>
        <div className={'kr-kista-innehall' + (oppen ? ' kr-kista-innehall-in' : '')}>
          {innehall.map((b, k) => (
            <div key={k} className="kr-kista-sak" style={{ animationDelay: 600 + k * 180 + 'ms' }}>
              <Belonning b={b} storlek={30} />
              <span>{beskrivBelonning(b)}</span>
            </div>
          ))}
        </div>
        <button className="kr-knapp kr-knapp-stor" onClick={onStang}>
          Toppen!
        </button>
      </div>
    </div>
  )
}

export function KistBild({ storlek = 120 }) {
  return (
    <svg viewBox="0 0 120 110" width={storlek} height={storlek * 0.92} aria-hidden="true">
      <ellipse cx="60" cy="104" rx="44" ry="5" fill="#000" opacity=".2" />
      <rect x="14" y="52" width="92" height="50" rx="6" fill="#a0612b" stroke="#5c3412" strokeWidth="3" />
      <rect x="14" y="66" width="92" height="7" fill="#ffc928" stroke="#9a6a00" strokeWidth="1.5" />
      <rect x="52" y="60" width="16" height="20" rx="3" fill="#ffc928" stroke="#9a6a00" strokeWidth="2" />
      <g className="kr-kistlock">
        <path d="M14 54 Q14 22 60 22 Q106 22 106 54 Z" fill="#b8733a" stroke="#5c3412" strokeWidth="3" />
        <path d="M40 24 V54 M80 24 V54" stroke="#ffc928" strokeWidth="6" />
      </g>
      <circle cx="30" cy="38" r="3" fill="#fff" opacity=".7" />
    </svg>
  )
}

// Liten notis som glider in överst, t.ex. dagens inloggningsbelöning.
export function Notis({ text, onKlar }) {
  useEffect(() => {
    const t = setTimeout(onKlar, 3200)
    return () => clearTimeout(t)
  }, [onKlar])
  return <div className="kr-notis">{text}</div>
}
