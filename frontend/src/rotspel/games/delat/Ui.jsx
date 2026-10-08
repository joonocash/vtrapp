import { useEffect, useRef, useState } from 'react'
import { KISTA_VAR } from './meta.js'
import './delat.css'

// Delade UI-delar för de nya rötspelen: topprad, myntchip, vinst- och
// förlustkort, boosterknappar och "Svår bana"-banderollen.

export function Topprad({ niva, svar, mynt, children, hoger }) {
  return (
    <header className="ds-topp">
      <div className="ds-niva">
        <span className="ds-niva-tal">Bana {niva}</span>
        {svar !== 'normal' && <span className={`ds-svar ds-svar-${svar === 'svår' ? 'svar' : 'super'}`}>{svar === 'svår' ? 'Svår' : 'Supersvår'}</span>}
      </div>
      <div className="ds-mitt">{children}</div>
      <div className="ds-hoger">
        {hoger}
        <MyntChip mynt={mynt} />
      </div>
    </header>
  )
}

export function MyntChip({ mynt }) {
  const [visa, setVisa] = useState(mynt)
  const [studs, setStuds] = useState(0)
  const visaRef = useRef(mynt)
  useEffect(() => {
    const fran = visaRef.current
    if (fran === mynt) return
    if (mynt < fran) {
      visaRef.current = mynt
      setVisa(mynt)
      return
    }
    const start = performance.now()
    const tid = Math.min(900, 250 + (mynt - fran) * 8)
    let raf
    const steg = (nu) => {
      const k = Math.min(1, (nu - start) / tid)
      const v = Math.round(fran + (mynt - fran) * (1 - Math.pow(1 - k, 2)))
      visaRef.current = v
      setVisa(v)
      if (k < 1) raf = requestAnimationFrame(steg)
    }
    raf = requestAnimationFrame(steg)
    setStuds((s) => s + 1)
    return () => cancelAnimationFrame(raf)
  }, [mynt])
  return (
    <span key={studs} className={`ds-mynt${studs ? ' ds-studs' : ''}`} aria-label={`${mynt} mynt`}>
      <Mynt /> {visa.toLocaleString('sv-SE')}
    </span>
  )
}

export function Mynt({ stor }) {
  return (
    <svg className={stor ? 'ds-myntikon stor' : 'ds-myntikon'} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#f5b81c" />
      <circle cx="10" cy="10" r="6.6" fill="#ffd84a" stroke="#e09a12" strokeWidth="1.2" />
      <path d="M8.2 6.4h2.4v7.2" stroke="#c97f0a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="6.6" cy="5.8" r="1.4" fill="#fff6c8" />
    </svg>
  )
}

export function Hjartan({ antal, max = 3, forlorat }) {
  return (
    <span className="ds-hjartan" aria-label={`${antal} hjärtan kvar`}>
      {Array.from({ length: Math.max(max, antal) }, (_, i) => (
        <span key={i} className={`ds-hjarta${i < antal ? '' : ' tomt'}${forlorat && i === antal ? ' brast' : ''}`}>
          ❤
        </span>
      ))}
    </span>
  )
}

export function BoostKnapp({ ikon, namn, antal, pris, mynt, onClick, disabled, aktiv }) {
  const harEgna = antal > 0
  const kanKopa = !harEgna && mynt >= pris
  return (
    <button
      className={`ds-boost${aktiv ? ' aktiv' : ''}${!harEgna && !kanKopa ? ' fattig' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={harEgna ? `${namn} (${antal} kvar)` : `${namn} — ${pris} mynt`}
    >
      <span className="ds-boost-ikon" aria-hidden="true">{ikon}</span>
      <span className="ds-boost-namn">{namn}</span>
      {harEgna ? (
        <span className="ds-boost-antal">{antal}</span>
      ) : (
        <span className="ds-boost-pris">
          <Mynt /> {pris}
        </span>
      )}
    </button>
  )
}

export function Banner({ svar, niva }) {
  if (svar === 'normal') return null
  return (
    <div key={niva} className={`ds-banner ds-banner-${svar === 'svår' ? 'svar' : 'super'}`} aria-live="polite">
      <div className="ds-banner-band">
        <span className="ds-banner-skalle" aria-hidden="true">
          {svar === 'svår' ? '🔥' : '💀'}
        </span>
        {svar === 'svår' ? 'Svår bana' : 'Supersvår bana'}
        <span className="ds-banner-sub">{svar === 'svår' ? 'Dubbla mynt' : 'Tredubbla mynt'}</span>
      </div>
    </div>
  )
}

const TITLAR = ['Snyggt!', 'Grymt!', 'Klart!', 'Bra jobbat!', 'Toppen!', 'Smidigt!']

// Vinstkortet: mynten räknas upp ett i taget, kistmätaren fylls och öppnas
// var femte vinst. Knappen "Nästa" är spärrad en kort stund så ett snabbt
// extra tryck i spelet inte råkar hoppa över alltihop.
export function Vinstkort({ resultat, titel, rader = [], ljud, boostInfo = {}, onNasta, nastaText = 'Nästa bana', barn }) {
  const [klar, setKlar] = useState(false)
  const [visadeMynt, setVisadeMynt] = useState(0)
  const [kistaOppen, setKistaOppen] = useState(false)
  const t = useRef(titel || (resultat.perfekt ? 'Perfekt!' : TITLAR[resultat.niva % TITLAR.length]))

  useEffect(() => {
    const id = setTimeout(() => setKlar(true), 650)
    return () => clearTimeout(id)
  }, [])

  // Mynten räknas upp
  useEffect(() => {
    let i = 0
    const mal = resultat.mynt
    const steg = Math.max(1, Math.round(mal / 18))
    let v = 0
    const id = setInterval(() => {
      v = Math.min(mal, v + steg)
      setVisadeMynt(v)
      ljud && ljud.mynt(i++)
      if (v >= mal) clearInterval(id)
    }, 55)
    return () => clearInterval(id)
  }, [resultat.mynt, ljud])

  // Kistan öppnas av sig själv
  useEffect(() => {
    if (!resultat.kistaVinst) return
    const id = setTimeout(() => {
      setKistaOppen(true)
      ljud && ljud.kista()
    }, 1300)
    return () => clearTimeout(id)
  }, [resultat.kistaVinst, ljud])

  const pips = resultat.kistaVinst ? KISTA_VAR : resultat.kista
  const kv = resultat.kistaVinst

  return (
    <div className="ds-kort-bak" role="dialog" aria-modal="true">
      <div className="ds-kort ds-kort-vinst">
        <div className="ds-stralar" aria-hidden="true" />
        <div className="ds-kort-titel">{t.current}</div>
        <div className="ds-kort-sub">Bana {resultat.niva} klar</div>
        {barn}
        <ul className="ds-rader">
          <li>
            <span>Bana klar{resultat.svar !== 'normal' ? ` (${resultat.svar})` : ''}</span>
            <b>+{resultat.bas}</b>
          </li>
          {resultat.perfektBonus > 0 && (
            <li>
              <span>Perfekt</span>
              <b>+{resultat.perfektBonus}</b>
            </li>
          )}
          {rader.map((r, i) => (
            <li key={i}>
              <span>{r[0]}</span>
              <b>{r[1]}</b>
            </li>
          ))}
          {resultat.svit > 1 && (
            <li className="ds-svit">
              <span>🔥 Vinstsvit {resultat.svit}</span>
              <b>+{resultat.svitBonus}</b>
            </li>
          )}
        </ul>
        <div className="ds-summa">
          <Mynt stor /> <b>+{visadeMynt}</b>
        </div>
        <div className={`ds-kista${kv ? ' full' : ''}${kistaOppen ? ' oppen' : ''}`}>
          <div className="ds-kista-ikon" aria-hidden="true">
            {kistaOppen ? '🎁' : '🧰'}
          </div>
          <div className="ds-kista-matare">
            {Array.from({ length: KISTA_VAR }, (_, i) => (
              <i key={i} className={i < pips ? (i === pips - 1 ? 'pa ny' : 'pa') : ''} />
            ))}
          </div>
          <div className="ds-kista-text">
            {kistaOppen ? (
              <span className="ds-kista-vinst">
                {kv.typ === 'jackpott' && 'JACKPOTT! '}
                {kv.mynt > 0 && (
                  <span>
                    +{kv.mynt} <Mynt />
                  </span>
                )}
                {Object.entries(kv.boost).map(([typ, n]) => (
                  <span key={typ}>
                    {' '}
                    +{n} {boostInfo[typ]?.ikon} {boostInfo[typ]?.namn}
                  </span>
                ))}
              </span>
            ) : kv ? (
              'Kistan öppnas…'
            ) : (
              `Kista om ${KISTA_VAR - resultat.kista} ${KISTA_VAR - resultat.kista === 1 ? 'vinst' : 'vinster'}`
            )}
          </div>
        </div>
        <button className="ds-knapp ds-knapp-stor" onClick={onNasta} disabled={!klar} autoFocus>
          {nastaText} ›
        </button>
      </div>
    </div>
  )
}

export function Forlustkort({ titel, text, ikon = '😵', fortsatt, onIgen, mynt }) {
  const [klar, setKlar] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setKlar(true), 450)
    return () => clearTimeout(id)
  }, [])
  const kanKopa = fortsatt && (fortsatt.gratis || mynt >= fortsatt.pris)
  return (
    <div className="ds-kort-bak" role="dialog" aria-modal="true">
      <div className="ds-kort ds-kort-forlust">
        <div className="ds-forlust-ikon" aria-hidden="true">
          {ikon}
        </div>
        <div className="ds-kort-titel">{titel}</div>
        {text && <div className="ds-kort-sub">{text}</div>}
        {fortsatt && (
          <button className="ds-knapp ds-knapp-stor ds-knapp-guld" onClick={fortsatt.onClick} disabled={!klar || !kanKopa}>
            <span>{fortsatt.text}</span>
            <span className="ds-knapp-pris">
              {fortsatt.gratis ? (
                'gratis'
              ) : (
                <>
                  <Mynt /> {fortsatt.pris}
                </>
              )}
            </span>
          </button>
        )}
        {fortsatt && !kanKopa && <div className="ds-kort-liten">Du har {mynt} mynt.</div>}
        <button className="ds-knapp ds-knapp-sek" onClick={onIgen} disabled={!klar}>
          Försök igen
        </button>
      </div>
    </div>
  )
}

// Liten notis mitt på spelet ("Ingen plats på bandet")
export function Notis({ notis }) {
  if (!notis) return null
  return (
    <div key={notis.key} className="ds-notis">
      {notis.text}
    </div>
  )
}

export function useNotis() {
  const [notis, setNotis] = useState(null)
  useEffect(() => {
    if (!notis) return
    const id = setTimeout(() => setNotis(null), notis.ms || 1600)
    return () => clearTimeout(id)
  }, [notis])
  return [notis, (text, ms) => setNotis({ text, ms, key: Date.now() + Math.random() })]
}
