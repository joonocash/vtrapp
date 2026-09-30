import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Spelplan from './Spelplan.jsx'
import Karta from './Karta.jsx'
import { Dagligt, Hjul, Kista, Notis } from './Dagligt.jsx'
import { BANOR, VARLDAR, ANTAL_BANOR, dagensBana } from './levels.js'
import {
  ladda,
  spara,
  komplettera,
  oppen,
  hogstaOppna,
  registreraVinst,
  registreraDagens,
  brytSvit,
  svitBoost,
  nyDag,
  datum,
  taHjul,
  kanSnurra,
  dagensKlar,
  oppnaKista,
  sammanfoga,
  beskrivBelonning,
} from './store.js'
import { spelarnamn, hamtaFramsteg, skickaFramsteg, hamtaSpelare, banaId, dagensId } from './synk.js'
import { skapaLjud } from './audio.js'
import { KrossenDefs, Mynt } from './pieces.jsx'
import { readSettings } from '../../useSettings.js'
import './krossen.css'

// Krossen — hjälp Happy få godis. Hundra banor på Happys promenad.
//
// Spelet öppnar direkt i nästa bana man inte klarat (rötspelens husregel:
// inget ska stå i vägen när man klickar in). Kartan och det dagliga når man
// med knappar i toppraden.

const SYNK_FORDROJNING = 1500

export default function KrossenGame({ fullskarmSparrad }) {
  const [save, setSaveRa] = useState(ladda)
  const saveRef = useRef(save)
  saveRef.current = save

  // Varje ändring spelaren gör stämplas med tiden, så att synken vet vilket
  // sparläge som är nyast när två enheter möts.
  const setSave = useCallback((fn) => {
    setSaveRa((s) => {
      const ny = typeof fn === 'function' ? fn(s) : fn
      return ny === s ? s : { ...ny, uppdaterad: Date.now() }
    })
  }, [])

  const ljud = useMemo(() => skapaLjud(() => !readSettings().ljud), [])
  useEffect(() => () => ljud.stang(), [ljud])

  const spelare = useMemo(() => spelarnamn(), [])
  const idag = useMemo(() => datum(), [])

  const [vy, setVy] = useState('spel')
  const [lage, setLage] = useState('bana') // 'bana' eller 'dagens'
  const [nr, setNr] = useState(() => Math.min(ANTAL_BANOR, hogstaOppna(ladda(), ANTAL_BANOR)))
  const [omgang, setOmgang] = useState(0)
  const [hoppFran, setHoppFran] = useState(null)
  const [panel, setPanel] = useState(null) // 'dagligt', 'hjul', 'kista', 'lamna'
  const [kistInnehall, setKistInnehall] = useState(null)
  const [notis, setNotis] = useState(null)
  const [kompisar, setKompisar] = useState([])
  const [synkKlar, setSynkKlar] = useState(false)
  const startad = useRef(false)

  const dagens = useMemo(() => dagensBana(idag), [idag])
  const bana = lage === 'dagens' ? dagens : BANOR[nr - 1]
  const varld = VARLDAR[bana.varld]

  // ------------------------------------------------------------ uppstart

  // Först hämtas det som finns på servern och slås ihop med det lokala. Sedan
  // räknas dagens inloggning — i den ordningen, så att samma dag inte kan
  // hämtas en gång per enhet.
  useEffect(() => {
    let levande = true
    const timeout = new Promise((r) => setTimeout(() => r(null), 3000))
    Promise.race([hamtaFramsteg(spelare), timeout]).then((server) => {
      if (!levande) return
      if (server) {
        const ihop = sammanfoga(saveRef.current, komplettera(server))
        setSaveRa(ihop)
        // Har man kommit längre på en annan enhet ska spelet öppna där —
        // så länge man inte redan hunnit börja på banan här.
        if (!startad.current) {
          const hogsta = Math.min(ANTAL_BANOR, hogstaOppna(ihop, ANTAL_BANOR))
          setNr((n) => {
            if (hogsta > n) setOmgang((x) => x + 1)
            return Math.max(n, hogsta)
          })
        }
      }
      setSynkKlar(true)
      setTimeout(() => {
        if (!levande) return
        const r = nyDag(saveRef.current, idag)
        if (!r) return
        setSave(r.save)
        setNotis(`Dag ${r.dag} i rad! ${beskrivBelonning(r.belonning)}`)
        ljud.mynt()
      }, 0)
    })
    return () => {
      levande = false
    }
  }, [spelare, idag, setSave, ljud])

  // Spara lokalt direkt, till servern en stund efter senaste ändringen.
  useEffect(() => {
    spara(save)
    if (!synkKlar || !spelare) return
    const t = setTimeout(async () => {
      const svar = await skickaFramsteg(spelare, saveRef.current)
      if (svar && svar.konflikt) setSaveRa((s) => sammanfoga(s, komplettera(svar.konflikt)))
    }, SYNK_FORDROJNING)
    return () => clearTimeout(t)
  }, [save, synkKlar, spelare])

  // musiken följer världen
  useEffect(() => {
    if (save.musik) ljud.startaMusik(bana.varld)
    else ljud.stoppaMusik()
  }, [save.musik, bana.varld, ljud])

  // --------------------------------------------------------- navigering

  function spela(n) {
    setHoppFran(null)
    setLage('bana')
    setNr(n)
    setOmgang((x) => x + 1)
    startad.current = false
    setVy('spel')
  }

  function spelaDagens() {
    ljud.klick()
    setPanel(null)
    setHoppFran(null)
    setLage('dagens')
    setOmgang((x) => x + 1)
    startad.current = false
    setVy('spel')
  }

  function vunnen({ stjarnor, poang }) {
    if (lage === 'dagens') setSave((s) => registreraDagens(s, idag, poang))
    else setSave((s) => registreraVinst(s, nr, stjarnor, poang))
    startad.current = false
  }

  function forlorad() {
    if (lage === 'bana') setSave(brytSvit)
    startad.current = false
  }

  function nasta() {
    if (lage === 'dagens') return spela(Math.min(ANTAL_BANOR, hogstaOppna(saveRef.current, ANTAL_BANOR)))
    if (nr >= ANTAL_BANOR) {
      setHoppFran(null)
      return oppnaKarta()
    }
    spela(nr + 1)
  }

  function oppnaKarta() {
    setVy('karta')
    hamtaSpelare().then(setKompisar)
  }

  // Att lämna en påbörjad bana räknas som förlust för vinstsviten — annars
  // kunde man alltid hoppa ur precis innan det går illa.
  function tillKartan() {
    ljud.klick()
    if (startad.current && lage === 'bana' && (saveRef.current.svit || 0) > 0) {
      setPanel('lamna')
      return
    }
    setHoppFran(null)
    oppnaKarta()
  }

  function lamnaBanan() {
    setSave(brytSvit)
    startad.current = false
    setPanel(null)
    setHoppFran(null)
    oppnaKarta()
  }

  // Från vinstrutan: visa Happy som skuttar vidare till nästa bana.
  function tillKartanEfterVinst() {
    ljud.klick()
    setHoppFran(lage === 'bana' ? nr : null)
    oppnaKarta()
  }

  function oppnaKistan() {
    const r = oppnaKista(saveRef.current)
    if (!r) return
    setSave(r.save)
    setKistInnehall(r.innehall)
    setPanel('kista')
  }

  const aktuell = Math.min(ANTAL_BANOR, hogstaOppna(save, ANTAL_BANOR))
  const dagligtLyser = kanSnurra(save, idag) || !dagensKlar(save, idag)
  const svit = save.svit || 0

  return (
    <div
      className="kr-spel"
      style={{
        '--varld': varld.farg,
        '--varldmork': varld.mork,
        '--rubrik': varld.rubrik,
        '--himmel1': varld.himmel[0],
        '--himmel2': varld.himmel[1],
      }}
    >
      <KrossenDefs />
      {notis && <Notis text={notis} onKlar={() => setNotis(null)} />}

      {vy === 'karta' ? (
        <Karta
          save={save}
          aktuell={hoppFran ? Math.min(ANTAL_BANOR, hoppFran + 1) : aktuell}
          hoppFran={hoppFran}
          kompisar={kompisar}
          spelare={spelare}
          onValj={(n) => {
            ljud.klick()
            if (oppen(save, n)) spela(n)
          }}
          onTillbaka={() => {
            ljud.klick()
            setVy('spel')
          }}
          onKista={oppnaKistan}
        />
      ) : (
        <>
          <div className="kr-topprad">
            <button className="kr-ikonknapp" onClick={tillKartan} aria-label="Karta" title="Karta">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="kr-toppnamn">
              <span className="kr-toppvarld">{lage === 'dagens' ? 'Samma för alla' : varld.namn}</span>
              <span className="kr-toppbana">{lage === 'dagens' ? 'Dagens bana' : `Bana ${bana.nr}${bana.boss ? ' · Boss' : ''}`}</span>
            </div>
            {svit > 0 && lage === 'bana' && (
              <div className="kr-svit" title={`Vinstsvit: ${svit} vunna i rad. Förlorar du börjar den om.`}>
                <span className="kr-svit-ikon" aria-hidden="true">
                  ★
                </span>
                {svit}
              </div>
            )}
            <button
              className={'kr-ikonknapp' + (dagligtLyser ? ' kr-ikonknapp-lyser' : '')}
              onClick={() => {
                ljud.klick()
                setPanel('dagligt')
              }}
              aria-label="Dagens godis"
              title="Dagens godis"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <rect x="3" y="9" width="18" height="12" rx="2" fill="#f03a5f" />
                <rect x="2" y="7" width="20" height="4" rx="1.5" fill="#ff6b8a" />
                <rect x="10.5" y="7" width="3" height="14" fill="#ffd21f" />
                <path d="M12 7 C 9 2, 5 4, 8 7 M12 7 C 15 2, 19 4, 16 7" stroke="#ffd21f" strokeWidth="2" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            <div className="kr-toppmynt">
              <Mynt storlek={16} />
              {save.mynt}
            </div>
            <button
              className={'kr-ikonknapp' + (save.musik ? ' kr-ikonknapp-pa' : '')}
              onClick={() => setSave((s) => ({ ...s, musik: !s.musik }))}
              aria-label={save.musik ? 'Stäng av musiken' : 'Slå på musiken'}
              title="Musik"
            >
              ♪
            </button>
          </div>
          <Spelplan
            key={lage + ':' + nr + ':' + omgang}
            bana={bana}
            save={save}
            setSave={setSave}
            ljud={ljud}
            fullskarmSparrad={fullskarmSparrad}
            svitBoost={lage === 'bana' ? svitBoost(save) : []}
            topplistaId={lage === 'dagens' ? dagensId(idag) : banaId(nr)}
            spelare={spelare}
            onStartad={() => (startad.current = true)}
            onVinst={vunnen}
            onForlust={forlorad}
            onKarta={(vann) => (vann ? tillKartanEfterVinst() : tillKartan())}
            onNasta={() => {
              ljud.klick()
              nasta()
            }}
            onIgen={() => {
              ljud.klick()
              startad.current = false
              setOmgang((x) => x + 1)
            }}
          />
        </>
      )}

      {panel === 'dagligt' && (
        <Dagligt
          save={save}
          idag={idag}
          spelare={spelare}
          onSnurra={() => {
            ljud.klick()
            setPanel('hjul')
          }}
          onDagens={spelaDagens}
          onStang={() => setPanel(null)}
        />
      )}
      {panel === 'hjul' && <Hjul ljud={ljud} onVinst={(k) => setSave((s) => taHjul(s, idag, k))} onStang={() => setPanel('dagligt')} />}
      {panel === 'kista' && kistInnehall && (
        <Kista
          innehall={kistInnehall}
          ljud={ljud}
          onStang={() => {
            setPanel(null)
            setKistInnehall(null)
          }}
        />
      )}
      {panel === 'lamna' && (
        <div className="kr-ruta-bakgrund">
          <div className="kr-ruta">
            <div className="kr-ruta-titel">Lämna banan?</div>
            <p className="kr-ruta-text">Du har vunnit {svit} i rad. Lämnar du banan nu räknas den som förlorad och vinstsviten börjar om.</p>
            <div className="kr-ruta-knappar">
              <button className="kr-knapp kr-knapp-stor" onClick={() => setPanel(null)}>
                Spela vidare
              </button>
              <button className="kr-knapp kr-knapp-lank" onClick={lamnaBanan}>
                Lämna ändå
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
