import { useState } from 'react'
import { HappyBild, KLADER, PLATSER, kladFor } from './happy.jsx'
import { MalIkon, Mynt, FARGER } from './pieces.jsx'
import { SORTER, ANTAL_BANOR } from './levels.js'
import { totaltStjarnor, skalLage, skalBelonning, beskrivBelonning } from './store.js'
import { ALBUM_CAPTIONS } from '../revir/config.js'

// Krossen — samlingen: Happys album, garderoben, godisskålen och
// statistiken. Alla nås från kartan.

// --------------------------------------------------------------- albumet

// Samma foton som i Happys revir, i filnamnsordning.
const albumFiler = import.meta.glob('../revir/album/*.{webp,jpg,jpeg,png}', { eager: true, import: 'default' })
export const ALBUM = Object.keys(albumFiler)
  .sort()
  .map((sokvag) => {
    const fil = sokvag.split('/').pop()
    const reserv = fil.replace(/^\d+-/, '').replace(/\.\w+$/, '').replace(/-/g, ' ')
    return { src: albumFiler[sokvag], text: ALBUM_CAPTIONS[fil] || reserv.charAt(0).toUpperCase() + reserv.slice(1) }
  })

function Panel({ titel, onStang, children, bred = false }) {
  return (
    <div className="kr-ruta-bakgrund" onClick={onStang}>
      <div className={'kr-ruta kr-ark kr-panel' + (bred ? ' kr-panel-bred' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="kr-panel-rad">
          <div className="kr-ruta-titel">{titel}</div>
          <button className="kr-panel-stang" onClick={onStang} aria-label="Stäng">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Album({ upplasta, onStang }) {
  const [stor, setStor] = useState(null)
  const antal = Math.min(upplasta, ALBUM.length)
  return (
    <Panel titel="Happys album" onStang={onStang} bred>
      <div className="kr-ruta-sma">
        {antal} av {ALBUM.length} foton. Bossbanor och stjärnkistor låser upp nya.
      </div>
      <div className="kr-album">
        {ALBUM.map((f, k) =>
          k < antal ? (
            <button key={k} className="kr-albumfoto" onClick={() => setStor(k)} style={{ '--lut': ((k * 7) % 9) - 4 + 'deg' }}>
              <img src={f.src} alt={f.text} loading="lazy" />
            </button>
          ) : (
            <div key={k} className="kr-albumfoto kr-albumfoto-last" aria-label="Låst foto">
              <span>?</span>
            </div>
          )
        )}
      </div>
      {stor !== null && (
        <div className="kr-albumstor" onClick={() => setStor(null)}>
          <img src={ALBUM[stor].src} alt={ALBUM[stor].text} />
          <div>{ALBUM[stor].text}</div>
        </div>
      )}
    </Panel>
  )
}

// ------------------------------------------------------------ garderoben

export function Garderob({ save, onKop, onTaPa, onStang }) {
  const [flik, setFlik] = useState('huvud')
  const [prova, setProva] = useState(null)
  const pa = { ...save.garderob.pa, ...(prova ? { [prova.plats]: prova.id } : {}) }
  return (
    <Panel titel="Happys garderob" onStang={onStang} bred>
      <div className="kr-garderob-topp">
        <HappyBild storlek={110} pa={pa} ramBredd={5} />
        <div className="kr-garderob-mynt">
          <Mynt storlek={18} /> {save.mynt}
        </div>
      </div>
      <div className="kr-flikar">
        {PLATSER.map((p) => (
          <button
            key={p.id}
            className={'kr-flik' + (flik === p.id ? ' kr-flik-vald' : '')}
            onClick={() => {
              setFlik(p.id)
              setProva(null)
            }}
          >
            {p.namn}
          </button>
        ))}
      </div>
      <div className="kr-klader">
        {KLADER.filter((k) => k.plats === flik).map((k) => {
          const agd = save.garderob.agda.includes(k.id)
          const pa_ = save.garderob.pa[k.plats] === k.id
          const provas = prova?.id === k.id
          return (
            <div key={k.id} className={'kr-plagg' + (pa_ ? ' kr-plagg-pa' : '') + (provas ? ' kr-plagg-provas' : '')}>
              <button className="kr-plagg-bild" onClick={() => (agd ? onTaPa(k) : setProva(provas ? null : k))} aria-label={k.namn}>
                <HappyBild storlek={58} pa={{ [k.plats]: k.id }} ramBredd={3} />
              </button>
              <div className="kr-plagg-namn">{k.namn}</div>
              {agd ? (
                <button className="kr-knapp kr-knapp-liten kr-knapp-sekundar" onClick={() => onTaPa(k)}>
                  {pa_ ? 'Ta av' : 'Ta på'}
                </button>
              ) : (
                <button className="kr-knapp kr-knapp-liten" disabled={save.mynt < k.pris} onClick={() => onKop(k) && setProva(null)}>
                  <Mynt storlek={12} /> {k.pris}
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="kr-ruta-sma">Tryck på ett plagg du inte har för att prova det.</div>
    </Panel>
  )
}

// ------------------------------------------------------------ godisskålen

export function SkalBild({ andel, storlek = 34 }) {
  const fyll = Math.max(0, Math.min(1, andel))
  const y = 86 - fyll * 40
  return (
    <svg viewBox="0 0 100 100" width={storlek} height={storlek} aria-hidden="true">
      <defs>
        <clipPath id="kr-skalklipp">
          <path d="M12 46 L88 46 L78 84 Q76 90 69 90 L31 90 Q24 90 22 84 Z" />
        </clipPath>
      </defs>
      <ellipse cx="50" cy="92" rx="34" ry="5" fill="#000" opacity=".2" />
      <path d="M12 46 L88 46 L78 84 Q76 90 69 90 L31 90 Q24 90 22 84 Z" fill="#5d6b80" />
      <g clipPath="url(#kr-skalklipp)">
        <rect x="0" y={y} width="100" height="100" fill="#ffb347" />
        {Array.from({ length: 9 }, (_, k) => (
          <circle key={k} cx={18 + k * 8} cy={y + 2 + (k % 2) * 3} r="6" fill={FARGER[k % 6].bas} stroke="#fff" strokeWidth="1" />
        ))}
      </g>
      <path d="M12 46 L88 46 L78 84 Q76 90 69 90 L31 90 Q24 90 22 84 Z" fill="none" stroke="#c3cedb" strokeWidth="4" />
      <ellipse cx="50" cy="46" rx="38" ry="7" fill="none" stroke="#eef3f8" strokeWidth="4" />
      <text x="50" y="76" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff" stroke="#3b4656" strokeWidth="2" paintOrder="stroke">
        HAPPY
      </text>
    </svg>
  )
}

export function SkalKnapp({ godis, onClick }) {
  const l = skalLage(godis)
  return (
    <button className="kr-skalknapp" onClick={onClick} title="Happys godisskål">
      <SkalBild andel={l.fyllt / l.krav} storlek={30} />
      <span className="kr-skalknapp-niva">Nivå {l.niva + 1}</span>
      <span className="kr-kistmatare">
        <span style={{ width: (l.fyllt / l.krav) * 100 + '%' }} />
      </span>
    </button>
  )
}

export function Skal({ godis, onStang }) {
  const l = skalLage(godis)
  const nasta = skalBelonning(l.niva + 1)
  return (
    <Panel titel="Happys godisskål" onStang={onStang}>
      <SkalBild andel={l.fyllt / l.krav} storlek={140} />
      <div className="kr-ruta-text">Allt godis du samlar fyller skålen. När den är full går den upp en nivå och du får en belöning.</div>
      <div className="kr-skalmatare">
        <div style={{ width: (l.fyllt / l.krav) * 100 + '%' }} />
        <span>
          {l.fyllt} / {l.krav}
        </span>
      </div>
      <div className="kr-ruta-sma">
        Nivå {l.niva + 1}. Full skål ger {beskrivBelonning(nasta)}.
      </div>
    </Panel>
  )
}

// ------------------------------------------------------------- statistik

export function Statistik({ save, onStang }) {
  const st = save.stat
  const godis = st.farg.reduce((a, b) => a + b, 0)
  const treStjarnor = Object.values(save.stjarnor).filter((x) => x >= 3).length
  const klarade = Object.keys(save.stjarnor).filter((k) => Number(k) <= ANTAL_BANOR && save.stjarnor[k] > 0).length
  const rad = (namn, varde) => (
    <div className="kr-statrad">
      <span>{namn}</span>
      <b>{typeof varde === 'number' ? varde.toLocaleString('sv-SE') : varde}</b>
    </div>
  )
  return (
    <Panel titel="Statistik" onStang={onStang}>
      <div className="kr-statgrupp">
        {rad('Klarade banor', `${klarade} av ${ANTAL_BANOR}`)}
        {rad('Stjärnor', totaltStjarnor(save))}
        {rad('Banor med tre stjärnor', treStjarnor)}
        {save.oandlig > 0 && rad('Oändliga promenaden', save.oandlig)}
        {rad('Vunna / förlorade', `${st.vunna} / ${st.forlorade}`)}
      </div>
      <div className="kr-statgrupp">
        <div className="kr-statrubrik">Godis till Happy · {godis.toLocaleString('sv-SE')}</div>
        <div className="kr-statsorter">
          {SORTER.map((namn, k) => (
            <div key={namn} className="kr-statsort" title={namn}>
              <MalIkon mal={{ typ: 'farg', farg: k }} storlek={26} />
              <b>{st.farg[k].toLocaleString('sv-SE')}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="kr-statgrupp">
        <div className="kr-statrubrik">Specialpjäser</div>
        <div className="kr-statsorter">
          {['raket', 'bomb', 'frisbee', 'skal'].map((sp) => (
            <div key={sp} className="kr-statsort">
              <MalIkon mal={{ typ: 'special', special: sp }} storlek={26} />
              <b>{(st.special[sp] || 0).toLocaleString('sv-SE')}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="kr-statgrupp">
        {rad('Längsta kedja', st.storstaKedja ? '×' + st.storstaKedja : '–')}
        {rad('Flest godis i ett drag', st.storstaDrag)}
        {rad('Happys hopp', st.hopp)}
        {rad('Öppnade paket', st.paket)}
        {rad('Hinder borta', st.hinder)}
      </div>
      <div className="kr-statgrupp">
        <div className="kr-statrubrik">Garderoben</div>
        <div className="kr-ruta-sma">
          {save.garderob.agda.length} av {KLADER.length} plagg
          {save.garderob.agda.length > 0 && ': ' + save.garderob.agda.map((id) => kladFor(id)?.namn).filter(Boolean).join(', ')}
        </div>
      </div>
    </Panel>
  )
}

// Ett nytt foto visas när det låses upp.
export function NyttFoto({ foto, onStang }) {
  return (
    <div className="kr-ruta-bakgrund" onClick={onStang}>
      <div className="kr-ruta kr-nyttfoto" onClick={(e) => e.stopPropagation()}>
        <div className="kr-ruta-titel">Nytt foto i albumet!</div>
        <img src={foto.src} alt={foto.text} />
        <div className="kr-ruta-text">{foto.text}</div>
        <button className="kr-knapp kr-knapp-stor" onClick={onStang}>
          Gulligt!
        </button>
      </div>
    </div>
  )
}
