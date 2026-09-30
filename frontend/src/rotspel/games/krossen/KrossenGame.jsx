import { useEffect, useMemo, useState } from 'react'
import Spelplan from './Spelplan.jsx'
import Karta from './Karta.jsx'
import { BANOR, VARLDAR, ANTAL_BANOR } from './levels.js'
import { ladda, spara, oppen, hogstaOppna, registreraVinst } from './store.js'
import { skapaLjud } from './audio.js'
import { KrossenDefs, Mynt } from './pieces.jsx'
import { readSettings } from '../../useSettings.js'
import './krossen.css'

// Krossen — hjälp Happy få godis. Hundra banor på Happys promenad.
//
// Spelet öppnar direkt i nästa bana man inte klarat (rötspelens husregel:
// inget ska stå i vägen när man klickar in). Kartan når man med en knapp.

export default function KrossenGame({ fullskarmSparrad }) {
  const [save, setSave] = useState(ladda)
  useEffect(() => spara(save), [save])

  const ljud = useMemo(() => skapaLjud(() => !readSettings().ljud), [])
  useEffect(() => () => ljud.stang(), [ljud])

  const [vy, setVy] = useState('spel')
  const [nr, setNr] = useState(() => {
    const s = ladda()
    return Math.min(ANTAL_BANOR, hogstaOppna(s, ANTAL_BANOR))
  })
  const [omgang, setOmgang] = useState(0)
  const [hoppFran, setHoppFran] = useState(null)

  const bana = BANOR[nr - 1]
  const varld = VARLDAR[bana.varld]

  // musiken följer världen
  useEffect(() => {
    if (save.musik) ljud.startaMusik(bana.varld)
    else ljud.stoppaMusik()
  }, [save.musik, bana.varld, ljud])

  function spela(n) {
    setHoppFran(null)
    setNr(n)
    setOmgang((x) => x + 1)
    setVy('spel')
  }

  function vunnen({ stjarnor, poang }) {
    setSave((s) => registreraVinst(s, nr, stjarnor, poang))
  }

  function nasta() {
    if (nr >= ANTAL_BANOR) {
      setHoppFran(null)
      setVy('karta')
      return
    }
    spela(nr + 1)
  }

  function tillKartan() {
    ljud.klick()
    setHoppFran(null)
    setVy('karta')
  }

  // Från vinstrutan: visa Happy som skuttar vidare till nästa bana.
  function tillKartanEfterVinst() {
    ljud.klick()
    setHoppFran(nr)
    setVy('karta')
  }

  const aktuell = Math.min(ANTAL_BANOR, hogstaOppna(save, ANTAL_BANOR))

  return (
    <div className="kr-spel" style={{ '--varld': varld.farg, '--varldmork': varld.mork, '--rubrik': varld.rubrik, '--himmel1': varld.himmel[0], '--himmel2': varld.himmel[1] }}>
      <KrossenDefs />
      {vy === 'karta' ? (
        <Karta
          save={save}
          aktuell={hoppFran ? Math.min(ANTAL_BANOR, hoppFran + 1) : aktuell}
          hoppFran={hoppFran}
          onValj={(n) => {
            ljud.klick()
            if (oppen(save, n)) spela(n)
          }}
          onTillbaka={() => {
            ljud.klick()
            setVy('spel')
          }}
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
              <span className="kr-toppvarld">{varld.namn}</span>
              <span className="kr-toppbana">
                Bana {bana.nr}
                {bana.boss ? ' · Boss' : ''}
              </span>
            </div>
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
            key={nr + ':' + omgang}
            bana={bana}
            save={save}
            setSave={setSave}
            ljud={ljud}
            fullskarmSparrad={fullskarmSparrad}
            onVinst={vunnen}
            onKarta={(vann) => (vann ? tillKartanEfterVinst() : tillKartan())}
            onNasta={() => {
              ljud.klick()
              nasta()
            }}
            onIgen={() => {
              ljud.klick()
              setOmgang((x) => x + 1)
            }}
          />
        </>
      )}
    </div>
  )
}
