import { useEffect, useMemo, useRef, useState } from 'react'
import { skapaSpel, KRAFTER } from '../pinnboll/motor.js'
import { VARLDAR } from '../pinnboll/banor.js'
import { skapaPinnLjud } from '../pinnboll/ljud.js'
import { skapaFx } from '../delat/fx.js'
import { useSpar, skickaNiva, laggTillMynt } from '../delat/meta.js'
import { Notis, useNotis } from '../delat/Ui.jsx'
import Spelplan from './Spelplan.jsx'
import * as R from './runda.js'
import * as M from './meta.js'
import { HJALTAR, hjalte, UPPGRADERINGAR, RELIKER, GRADER, ingarI, HJALTE_PRIS } from './innehall.js'
import { HANDELSER } from './handelser.js'
import happyGlad from '../revir/img/happy-glad.webp'
import './kulkaos.css'

// Kulkaos — ett roguelike byggt på Pinnbollens motor. Välj hjälte, spela dig
// genom tre akter med dörrval, butiker, händelser och bossar, och bli
// starkare och starkare med uppgraderingar, evolutioner och reliker. Mellan
// rundorna: ben i Hundkojan, utmaningar som låser upp hjältar, samlingen,
// Feber 1–10 och dagens runda. Logiken finns i runda.js och meta.js; den här
// filen är skärmarna. Spelplanen för en bana är Spelplan.jsx.

const fmt = (n) => Math.round(n).toLocaleString('sv-SE')
const FLIKAR = [
  { id: 'hjaltar', ikon: '🦸', namn: 'Hjältar' },
  { id: 'koja', ikon: '🏠', namn: 'Hundkojan' },
  { id: 'utmaningar', ikon: '🏆', namn: 'Utmaningar' },
  { id: 'samling', ikon: '📖', namn: 'Samling' },
  { id: 'topp', ikon: '📊', namn: 'Topplista' },
]

function Portratt({ id, stor }) {
  const h = hjalte(id)
  if (h.id === 'happy') return <img className={`kk-portratt${stor ? ' stor' : ''}`} src={happyGlad} alt="Happy" />
  return (
    <span className={`kk-portratt emoji${stor ? ' stor' : ''}`} aria-hidden="true">
      {h.ikon}
    </span>
  )
}

export default function KulkaosGame() {
  const [meta, setMeta, metaRef] = useSpar('kulkaos-v1', M.START_META)
  const ljud = useMemo(() => skapaPinnLjud(), [])
  useEffect(() => () => ljud.stang(), [ljud])
  const fx = useMemo(() => skapaFx(), [])
  const [vy, setVy] = useState(() => (metaRef.current.runda && !metaRef.current.runda.slut ? 'spel' : 'meny'))
  const [flik, setFlik] = useState('hjaltar')
  const [ny, setNy] = useState(null) // { steg: 'hjalte' | 'feber', hjalte }
  const [kort, setKort] = useState(null) // { typ: 'andra' } | { typ: 'slut', ... } | { typ: 'paus' } | { typ: 'build' }
  const [notis, visaNotis] = useNotis()
  const [omgang, setOmgang] = useState(0)
  const runda = meta.runda
  const statsRef = useRef({})

  // Banan i rundans rum skapas när man går in i rummet (och vid omladdning).
  const aktivt = useMemo(() => {
    if (!runda || runda.steg !== 'spel') return null
    const bana = R.rumBana(runda)
    const fro = (Date.now() ^ Math.imul(runda.nr, 104729) ^ omgang) >>> 0
    statsRef.current = {}
    return { bana, spel: skapaSpel(bana, { fro, ...R.spelVal(runda, bana) }), nyckel: `${runda.fro}-${runda.nr}-${omgang}` }
  }, [runda?.fro, runda?.nr, runda?.steg === 'spel', omgang]) // eslint-disable-line react-hooks/exhaustive-deps
  const [senast, setSenast] = useState(null)
  useEffect(() => {
    if (aktivt) setSenast(aktivt)
  }, [aktivt])
  const plan = aktivt || senast

  function sparaRunda(r) {
    setMeta((m) => ({ ...m, runda: r }))
  }

  // Utmaningar som klaras mitt i en runda (30 kulor, 200 guld …).
  function kollaMitt(r) {
    const { m, nya } = M.kollaUtmaningar(metaRef.current, r)
    if (nya.length) {
      setMeta({ ...m, runda: r })
      nya.forEach((id, i) => {
        const u = M.UTMANINGAR.find((x) => x.id === id)
        setTimeout(() => visaNotis(`🏆 ${u.namn}! +${u.ben} 🦴`, 2200), i * 2300)
      })
      ljud.extraKula()
    } else sparaRunda(r)
  }

  /* ------------------------------------------------------------ rundan */

  function startaRunda(hid, feber = 0, dag = null) {
    // en pågående runda avslutas först, så att man får ben för den
    let m = metaRef.current
    if (m.runda && !m.runda.slut) m = M.avslutaRunda(m, R.avsluta(m.runda)).m
    const opt = dag ? M.dagensRunda(dag) : { hjalte: hid, feber, meta: M.rundMeta(m) }
    const r = R.nyRunda(opt)
    setMeta({ ...m, runda: r })
    setNy(null)
    setKort(null)
    setVy('spel')
    setOmgang((o) => o + 1)
  }

  function banaKlar(typ) {
    const r = metaRef.current.runda
    const p = aktivt
    if (!r || !p) return
    const s = p.spel
    const st = { ...statsRef.current }
    if (typ === 'vinst' || p.bana.bonus) {
      const res = { poang: s.poang, kulorKvar: s.kulorKvar, guld: s.guld, feber: Boolean(st.feber), rensat: s.rensat, stats: st }
      const nyR = R.rumKlart(r, res)
      if (typ === 'vinst') ljud.extraKula()
      kollaMitt(nyR)
      return
    }
    ljud.forlust?.()
    if (r.andraChans > 0) {
      setKort({ typ: 'andra' })
      return
    }
    rundaSlut({ ...r, poang: r.poang + s.poang, stats: { ...r.stats, maxKulor: Math.max(r.stats.maxKulor, st.maxKulor || 0), maxTraffar: Math.max(r.stats.maxTraffar, st.maxTraffar || 0) } })
  }

  function andraChansen() {
    const s = aktivt?.spel
    const r = metaRef.current.runda
    if (!s || !r) return
    if (s.fortsatt(6)) {
      sparaRunda({ ...r, andraChans: r.andraChans - 1 })
      ljud.extraKula()
      setKort(null)
    }
  }

  function rundaSlut(r) {
    const fore = metaRef.current
    const slut = R.avsluta(r)
    const { m, ben, nya } = M.avslutaRunda(fore, slut)
    setMeta(m)
    laggTillMynt(Math.max(1, slut.klara))
    skickaNiva(M.ID, slut.poang)
    if (slut.dag && fore.dag !== slut.dag) skickaNiva(M.dagensId(slut.dag), slut.poang)
    setKort({ typ: 'slut', runda: slut, ben, nya, rekord: slut.poang > (fore.bast || 0), mynt: Math.max(1, slut.klara) })
  }

  function gorRunda(f) {
    const r = metaRef.current.runda
    if (!r) return
    const nyR = f(r)
    if (nyR === r) return
    if (nyR.steg === 'spel' && r.steg !== 'spel') setOmgang((o) => o + 1)
    kollaMitt(nyR)
  }

  function geUpp() {
    const r = metaRef.current.runda
    setKort(null)
    if (r) rundaSlut({ ...r, poang: r.poang + (aktivt?.spel.poang || 0) })
  }

  function tillMenyn() {
    setKort(null)
    setVy('meny')
  }

  /* ---------------------------------------------------------- skärmarna */

  if (vy === 'meny' || !runda) {
    return (
      <div className="ds-rot kk-rot">
        {ny ? (
          <NyRunda
            meta={meta}
            steg={ny}
            onHjalte={(id) => (meta.feber > 0 ? setNy({ steg: 'feber', hjalte: id }) : startaRunda(id, 0))}
            onFeber={(f) => startaRunda(ny.hjalte, f)}
            onStang={() => setNy(null)}
          />
        ) : (
        <Huvudmeny
          meta={meta}
          flik={flik}
          setFlik={setFlik}
          onFortsatt={() => setVy('spel')}
          onNy={() => setNy({ steg: 'hjalte' })}
          onDagens={() => startaRunda(null, 0, M.idag())}
          onKopVerkstad={(id) => {
            const m = M.kopVerkstad(metaRef.current, id)
            if (m !== metaRef.current) {
              ljud.extraKula()
              setMeta(m)
            }
          }}
          onAterbetala={() => setMeta(M.aterbetala(metaRef.current))}
          onKopHjalte={(id) => {
            const k = M.kollaUtmaningar(M.kopHjalte(metaRef.current, id))
            setMeta(k.m)
          }}
        />
        )}
        <Notis notis={notis} />
      </div>
    )
  }

  const h = hjalte(runda.hjalte)
  const rumNamn = runda.typ === 'boss' ? 'Boss' : `Rum ${runda.rum}/${R.RUM}`
  const rubrik = `Akt ${runda.akt}${runda.oandlig ? ' ∞' : ''} · ${rumNamn}`
  const varld = plan ? VARLDAR[plan.bana.varld || 0] : VARLDAR[0]
  const intro = plan
    ? {
        topp: `${R.RUMTYPER[runda.typ]?.ikon || '⚔️'} ${R.RUMTYPER[runda.typ]?.namn || 'Bana'}${runda.mod ? ` · ${R.ELIT_MOD[runda.mod].ikon} ${R.ELIT_MOD[runda.mod].namn}` : ''}`,
        namn: plan.bana.boss ? `${plan.bana.boss.ikon} ${plan.bana.boss.namn}` : plan.bana.namn,
        mal: plan.bana.boss ? `${plan.bana.boss.text}. Bossen har ${fmt(plan.bana.boss.hp)} liv` : plan.bana.bonus ? plan.bana.text : `Träffa alla ${plan.spel.antalOrange} orange pinnar`,
      }
    : null

  return (
    <div className="ds-rot pb-rot kk-rot" style={{ '--h1': varld.himmel[0], '--h2': varld.himmel[1] }}>
      {plan ? (
        <Spelplan
          key={plan.nyckel}
          spel={plan.spel}
          bana={plan.bana}
          varld={varld}
          kanonIkon={h.ikon}
          hjalteNamn={h.namn}
          rubrik={rubrik}
          underrubrik={`${h.ikon} ${h.namn} · ${fmt(runda.poang + (aktivt ? 0 : 0))} poäng${runda.feber ? ` · 🌡️ Feber ${runda.feber}` : ''}`}
          guldFore={aktivt ? runda.guld : runda.guld - (plan.spel.guld || 0)}
          introRader={intro}
          overlagg={runda.steg !== 'spel' || Boolean(kort)}
          statsRef={statsRef}
          ljud={ljud}
          fx={fx}
          onKlar={banaKlar}
          onRedo={(n) => {
            const r = metaRef.current.runda
            if (r && r.steg === 'spel' && !plan.bana.bonus && r.kulor !== n) sparaRunda({ ...r, kulor: n })
          }}
          onMeny={() => setKort({ typ: 'paus' })}
        />
      ) : (
        <div className="kk-scen">
          <header className="pb-topp">
            <button className="pb-kartknapp" onClick={() => setKort({ typ: 'paus' })} aria-label="Paus">
              <span aria-hidden="true">☰</span>
            </button>
            <div className="pb-titel">
              <b>{rubrik}</b>
              <small>
                {h.ikon} {h.namn}
              </small>
            </div>
          </header>
        </div>
      )}

      {!kort && runda.steg === 'belo' && <Belo runda={runda} gor={gorRunda} />}
      {!kort && runda.steg === 'dorrar' && <Dorrar runda={runda} gor={gorRunda} onBuild={() => setKort({ typ: 'build' })} />}
      {!kort && runda.steg === 'butik' && <Butik runda={runda} gor={gorRunda} ljud={ljud} />}
      {!kort && runda.steg === 'handelse' && <Handelse runda={runda} gor={gorRunda} />}
      {!kort && runda.steg === 'vila' && <Vila runda={runda} gor={gorRunda} />}
      {!kort && runda.steg === 'seger' && <Seger runda={runda} gor={gorRunda} onAvsluta={() => rundaSlut(runda)} />}

      {kort?.typ === 'andra' && (
        <Kort titel="Andra chansen" sub="Kulorna tog slut, men du har en andra chans">
          <div className="kk-stor-ikon">❤️</div>
          <button className="ds-knapp ds-knapp-stor" onClick={andraChansen}>
            Sex nya kulor
          </button>
          <button className="pb-litenknapp" onClick={() => (setKort(null), rundaSlut({ ...runda, poang: runda.poang + (aktivt?.spel.poang || 0) }))}>
            Avsluta rundan
          </button>
        </Kort>
      )}
      {kort?.typ === 'paus' && (
        <Kort titel="Paus" sub={`${h.namn} · Akt ${runda.akt} · ${fmt(runda.poang)} poäng`}>
          <Build runda={runda} rubrik />
          <button className="ds-knapp ds-knapp-stor" onClick={() => setKort(null)}>
            Fortsätt
          </button>
          <div className="pb-tavla-knappar">
            <button className="pb-litenknapp" onClick={tillMenyn}>
              ☰ Menyn (sparas)
            </button>
            <button className="pb-litenknapp kk-farlig" onClick={() => setKort({ typ: 'geupp' })}>
              Ge upp
            </button>
          </div>
        </Kort>
      )}
      {kort?.typ === 'geupp' && (
        <Kort titel="Ge upp rundan?" sub="Du får ben för det du har klarat hittills">
          <div className="pb-tavla-knappar">
            <button className="pb-litenknapp" onClick={() => setKort({ typ: 'paus' })}>
              Nej
            </button>
            <button className="pb-litenknapp kk-farlig" onClick={geUpp}>
              Ja, ge upp
            </button>
          </div>
        </Kort>
      )}
      {kort?.typ === 'build' && (
        <Kort titel="Din build" sub={`${h.ikon} ${h.namn}`}>
          <Build runda={runda} detalj />
          <button className="ds-knapp ds-knapp-stor" onClick={() => setKort(null)}>
            Tillbaka
          </button>
        </Kort>
      )}
      {kort?.typ === 'slut' && (
        <Slut
          kort={kort}
          onNy={() => {
            setKort(null)
            setVy('meny')
            setNy({ steg: 'hjalte' })
          }}
          onMeny={() => {
            setKort(null)
            setVy('meny')
          }}
        />
      )}
      <Notis notis={notis} />
    </div>
  )
}

/* --------------------------------------------------------------- delar */

function Kort({ titel, sub, children, klass = '', sida }) {
  // sida: visas som en egen sida i menyn i stället för ovanpå något
  return (
    <div className={sida ? 'kk-sida' : 'ds-kort-bak'} role="dialog" aria-modal={sida ? undefined : 'true'} aria-label={titel}>
      <div className={`ds-kort kk-kort ${klass}`}>
        <div className="ds-kort-titel">{titel}</div>
        {sub && <div className="ds-kort-sub">{sub}</div>}
        {children}
      </div>
    </div>
  )
}

// Spärr så att man inte råkar trycka på ett kort i samma ögonblick som det dyker upp.
function useKlar(ms = 450, nyckel = 0) {
  const [klar, setKlar] = useState(false)
  useEffect(() => {
    setKlar(false)
    const id = setTimeout(() => setKlar(true), ms)
    return () => clearTimeout(id)
  }, [nyckel]) // eslint-disable-line react-hooks/exhaustive-deps
  return klar
}

function UppgKort({ id, runda, disabled, onClick, pris, sald, kanInte, onSlang }) {
  const u = UPPGRADERINGAR[id]
  const n = runda.varig?.[id] || 0
  const evo = u.grad < 4 ? ingarI(id).filter((e) => !(runda.varig?.[e.id] > 0)) : []
  return (
    <div className={`kk-uppg-vagga${sald ? ' sald' : ''}`}>
      <button className={`pb-uppg grad-${u.grad}`} disabled={disabled || sald || kanInte} onClick={onClick}>
        <em>{u.grad === 4 ? '🌟 Evolution' : u.direkt ? GRADER[u.grad] : n ? `Nivå ${n} → ${n + 1}` : `Ny · ${GRADER[u.grad]}`}</em>
        <span aria-hidden="true">{u.ikon}</span>
        <b>{u.namn}</b>
        <small>{u.text(n + 1)}</small>
        {evo.length > 0 && <i className="pb-uppg-evo">{evo.map((e) => `${e.ikon} ${e.namn}`).join(', ')}</i>}
        {pris != null && <strong className="kk-pris">{sald ? 'Såld' : `🪙 ${pris}`}</strong>}
      </button>
      {onSlang && (
        <button className="kk-slang" onClick={onSlang} aria-label={`Släng ${u.namn}`} title="Släng för resten av rundan">
          🗑️
        </button>
      )}
    </div>
  )
}

function RelikKort({ id, disabled, onClick, pris, sald }) {
  const r = RELIKER[id]
  return (
    <button className={`pb-uppg grad-${r.grad} kk-relik${sald ? ' sald' : ''}`} disabled={disabled || sald} onClick={onClick}>
      <em>Relik · {GRADER[r.grad]}</em>
      <span aria-hidden="true">{r.ikon}</span>
      <b>{r.namn}</b>
      <small>{r.text}</small>
      {pris != null && <strong className="kk-pris">{sald ? 'Såld' : `🪙 ${pris}`}</strong>}
    </button>
  )
}

// Buildet: hjälten, uppgraderingarna med nivåer och relikerna.
function Build({ runda, rubrik, detalj }) {
  const h = hjalte(runda.hjalte)
  const lista = R.build(runda)
  return (
    <div className="pb-build kk-build" aria-label="Din build">
      {rubrik && <small>Din build</small>}
      <div>
        <span className="hjalte" title={h.namn}>
          {h.ikon}
        </span>
        {lista.map((u) => (
          <span key={u.id} className={`grad-${u.grad}`} title={u.namn}>
            {u.ikon}
            {!u.max || u.max > 1 ? <b>{u.n}</b> : null}
          </span>
        ))}
        {runda.reliker.map((id) => (
          <span key={id} className="kk-relikchip" title={RELIKER[id].namn}>
            {RELIKER[id].ikon}
          </span>
        ))}
      </div>
      {detalj && (
        <ul className="kk-build-lista">
          {lista.map((u) => (
            <li key={u.id}>
              <span>{u.ikon}</span>
              <b>
                {u.namn} {u.max === 1 ? '' : u.n}
              </b>
              <small>{u.text(u.n)}</small>
            </li>
          ))}
          {runda.reliker.map((id) => (
            <li key={id}>
              <span>{RELIKER[id].ikon}</span>
              <b>{RELIKER[id].namn}</b>
              <small>{RELIKER[id].text}</small>
            </li>
          ))}
          {!lista.length && !runda.reliker.length && <li className="kk-tom">Inget än — välj dina första uppgraderingar efter banan.</li>}
        </ul>
      )}
    </div>
  )
}

function Resurser({ runda }) {
  return (
    <div className="kk-resurser">
      <span>🎱 {runda.kulor}</span>
      <span>🪙 {fmt(runda.guld)}</span>
      <span>✨ {fmt(runda.poang)}</span>
    </div>
  )
}

function Belo({ runda, gor }) {
  const f = runda.ko[0]
  const klar = useKlar(450, `${runda.nr}-${runda.ko.length}-${runda.slag}`)
  if (!f) return null
  if (f.typ === 'kista') {
    return (
      <Kort titel={f.auto ? '🃏 Kaos-Kalle väljer' : 'Skattkista!'} sub={f.fick.length === 1 ? 'En uppgradering' : `${f.fick.length} uppgraderingar`} klass="kk-kistkort">
        <div className="pb-kista-ikon" aria-hidden="true">
          {f.auto ? '🃏' : '🎁'}
        </div>
        <div className="pb-kista-fick">
          {f.fick.map((id, i) => (
            <span key={id} className={`grad-${UPPGRADERINGAR[id].grad}`} style={{ animationDelay: `${0.3 + i * 0.35}s` }}>
              <i aria-hidden="true">{UPPGRADERINGAR[id].ikon}</i>
              {UPPGRADERINGAR[id].namn}
            </span>
          ))}
        </div>
        <Build runda={runda} />
        <button className="ds-knapp ds-knapp-stor" disabled={!klar} onClick={() => gor((r) => R.valjBelo(r))}>
          Vidare
        </button>
      </Kort>
    )
  }
  if (f.typ === 'relik') {
    return (
      <Kort titel="Välj en relik" sub="Reliker gäller resten av rundan">
        <div className="pb-val">
          {f.val.map((id) => (
            <RelikKort key={id} id={id} disabled={!klar} onClick={() => gor((r) => R.valjBelo(r, id))} />
          ))}
        </div>
      </Kort>
    )
  }
  return (
    <Kort titel={runda.typ === 'boss' ? 'Bossen är besegrad!' : `${R.RUMTYPER[runda.typ]?.namn || 'Bana'} klar!`} sub="Välj en uppgradering">
      <Resurser runda={runda} />
      <Build runda={runda} />
      <div className={`pb-val${f.val.length > 3 ? ' fyra' : ''}`}>
        {f.val.map((id) => (
          <UppgKort key={`${runda.slag}-${id}`} id={id} runda={runda} disabled={!klar} onClick={() => gor((r) => R.valjBelo(r, id))} onSlang={runda.slang > 0 && UPPGRADERINGAR[id].grad < 4 ? () => gor((r) => R.sling(r, id)) : null} />
        ))}
      </div>
      <div className="pb-tavla-knappar">
        <button className="pb-litenknapp" disabled={!klar || !(runda.omslag > 0)} onClick={() => gor(R.slaOm)}>
          🎲 Slå om <b>{runda.omslag}</b>
        </button>
        {runda.hoppa > 0 && (
          <button className="pb-litenknapp" disabled={!klar} onClick={() => gor(R.hoppa)}>
            ⏭️ Hoppa över (+15 🪙) <b>{runda.hoppa}</b>
          </button>
        )}
      </div>
      {runda.slang > 0 && <small className="kk-tips">🗑️ Släng tar bort en uppgradering resten av rundan ({runda.slang} kvar)</small>}
    </Kort>
  )
}

function Dorrar({ runda, gor, onBuild }) {
  const klar = useKlar(450, runda.nr)
  const boss = runda.dorrar?.[0]?.typ === 'boss'
  return (
    <Kort titel={boss ? 'Bossen väntar' : 'Välj väg'} sub={`Akt ${runda.akt} · rum ${runda.rum + 1} av ${R.RUM}`} klass="kk-dorrkort">
      <Resurser runda={runda} />
      <div className="kk-akt" aria-hidden="true">
        {Array.from({ length: R.RUM }, (_, i) => (
          <i key={i} className={i < runda.rum ? 'klar' : i === runda.rum ? 'nu' : ''}>
            {i === R.RUM - 1 ? '👹' : ''}
          </i>
        ))}
      </div>
      <div className="kk-dorrar">
        {runda.dorrar.map((d, i) => {
          const t = R.RUMTYPER[d.typ]
          return (
            <button key={i} className={`kk-dorr ${d.typ}`} disabled={!klar} onClick={() => gor((r) => R.valjDorr(r, i))}>
              <span aria-hidden="true">{d.boss ? d.boss.ikon : t.ikon}</span>
              <b>{d.boss ? d.boss.namn : t.namn}</b>
              {d.mod && (
                <em>
                  {R.ELIT_MOD[d.mod].ikon} {R.ELIT_MOD[d.mod].namn}
                </em>
              )}
              <small>{d.boss ? d.boss.text : t.belo}</small>
            </button>
          )
        })}
      </div>
      <button className="pb-litenknapp" onClick={onBuild}>
        🎒 Din build
      </button>
    </Kort>
  )
}

function Butik({ runda, gor, ljud }) {
  const b = runda.butik
  const klar = useKlar(350, runda.nr)
  const kop = (i) => {
    ljud.extraKula()
    gor((r) => R.kop(r, i))
  }
  return (
    <Kort titel="🛒 Butiken" sub="Handla för guldet du har samlat" klass="kk-butikkort">
      <Resurser runda={runda} />
      <div className="pb-val kk-varor">
        {b.varor.map((v, i) => {
          const fattig = runda.guld < v.pris
          if (v.typ === 'uppg') return <UppgKort key={i} id={v.id} runda={runda} disabled={!klar || fattig} pris={v.pris} sald={v.sald} kanInte={!R.mojlig(runda, v.id)} onClick={() => kop(i)} />
          if (v.typ === 'relik') return <RelikKort key={i} id={v.id} disabled={!klar || fattig} pris={v.pris} sald={v.sald} onClick={() => kop(i)} />
          return (
            <button key={i} className={`pb-uppg grad-1 kk-vara${v.sald ? ' sald' : ''}`} disabled={!klar || fattig || v.sald} onClick={() => kop(i)}>
              <em>{v.typ === 'kulor' ? 'Kulor' : 'Omslag'}</em>
              <span aria-hidden="true">{v.typ === 'kulor' ? '🎱' : '🎲'}</span>
              <b>{v.typ === 'kulor' ? `+${v.n} kulor` : `+${v.n} omslag`}</b>
              <small>{v.typ === 'kulor' ? 'Fler kulor till nästa bana' : 'Slå om valen fler gånger'}</small>
              <strong className="kk-pris">{v.sald ? 'Såld' : `🪙 ${v.pris}`}</strong>
            </button>
          )
        })}
      </div>
      <div className="pb-tavla-knappar">
        <button className="pb-litenknapp" disabled={runda.guld < b.omslagPris} onClick={() => gor(R.slaOmButik)}>
          🎲 Byt varor · {b.omslagPris} 🪙
        </button>
        <button className="pb-litenknapp" onClick={() => gor(R.lamna)}>
          Gå vidare →
        </button>
      </div>
    </Kort>
  )
}

function Handelse({ runda, gor }) {
  const h = HANDELSER.find((x) => x.id === runda.handelse?.id)
  const klar = useKlar(450, runda.nr)
  if (!h) return null
  const svar = runda.handelse.svar
  return (
    <Kort titel={`${h.ikon} ${h.namn}`} sub={svar ? null : h.text} klass="kk-handelsekort">
      <Resurser runda={runda} />
      {svar ? (
        <>
          <p className="kk-svar">{svar}</p>
          <button className="ds-knapp ds-knapp-stor" onClick={() => gor(R.lamna)}>
            Vidare
          </button>
        </>
      ) : (
        <div className="kk-handelseval">
          {h.val.map((v, i) => (
            <button key={i} className="ds-knapp" disabled={!klar || (v.kan && !v.kan(runda))} onClick={() => gor((r) => R.svaraHandelse(r, i))}>
              {v.text}
            </button>
          ))}
        </div>
      )}
    </Kort>
  )
}

function Vila({ runda, gor }) {
  const klar = useKlar(400, runda.nr)
  const kan = Object.keys(runda.varig).some((id) => runda.varig[id] > 0 && R.kanHoja(runda, id))
  return (
    <Kort titel="🔥 Lägereld" sub="Vila en stund innan du går vidare">
      <Resurser runda={runda} />
      <div className="kk-handelseval">
        <button className="ds-knapp" disabled={!klar} onClick={() => gor((r) => R.vila(r, 'vila'))}>
          😴 Vila: +6 kulor
        </button>
        <button className="ds-knapp" disabled={!klar || !kan} onClick={() => gor((r) => R.vila(r, 'trana'))}>
          💪 Träna: en av dina krafter går upp en nivå
        </button>
      </div>
    </Kort>
  )
}

function Seger({ runda, gor, onAvsluta }) {
  const klar = useKlar(900, runda.nr)
  return (
    <Kort titel="🏆 Seger!" sub="Du klarade alla tre akterna" klass="kk-segerkort">
      <div className="kk-stor-ikon">🏆</div>
      <div className="pb-tavla-poang">{fmt(runda.poang)}</div>
      <Build runda={runda} />
      <button className="ds-knapp ds-knapp-stor ds-knapp-guld" disabled={!klar} onClick={onAvsluta}>
        Ta emot belöningen
        <small>Ben för hela rundan, och nästa Feber låses upp</small>
      </button>
      <button className="pb-litenknapp" disabled={!klar} onClick={() => gor(R.fortsattOandligt)}>
        ♾️ Fortsätt i det oändliga (bossarna blir starkare)
      </button>
    </Kort>
  )
}

function Slut({ kort, onNy, onMeny }) {
  const r = kort.runda
  const klar = useKlar(700, 1)
  return (
    <Kort titel={r.seger ? '🏆 Rundan vunnen!' : 'Rundan är slut'} sub={`${hjalte(r.hjalte).ikon} ${hjalte(r.hjalte).namn} · akt ${r.akt}, ${r.klara} banor, ${r.bossar} ${r.bossar === 1 ? 'boss' : 'bossar'}`}>
      <div className="pb-tavla-poang">
        {fmt(r.poang)}
        {kort.rekord && <em>Rekord!</em>}
      </div>
      <div className="kk-ben">
        +{fmt(kort.ben)} 🦴 <small>+{kort.mynt} mynt</small>
      </div>
      {kort.nya.length > 0 && (
        <div className="kk-nya">
          {kort.nya.map((id) => {
            const u = M.UTMANINGAR.find((x) => x.id === id)
            return (
              <span key={id}>
                {u.ikon} {u.namn} <b>+{u.ben} 🦴</b>
                {u.las?.hjalte && <small>Ny hjälte: {hjalte(u.las.hjalte).ikon} {hjalte(u.las.hjalte).namn}</small>}
                {u.las?.uppg && <small>Ny uppgradering: {UPPGRADERINGAR[u.las.uppg].ikon} {UPPGRADERINGAR[u.las.uppg].namn}</small>}
                {u.las?.feber && <small>Feber {u.las.feber} är upplåst</small>}
              </span>
            )
          })}
        </div>
      )}
      <Build runda={r} rubrik />
      <button className="ds-knapp ds-knapp-stor" disabled={!klar} onClick={onNy}>
        Ny runda
      </button>
      <button className="pb-litenknapp" disabled={!klar} onClick={onMeny}>
        🏠 Till Hundkojan
      </button>
    </Kort>
  )
}

function NyRunda({ meta, steg, onHjalte, onFeber, onStang }) {
  if (steg.steg === 'feber') {
    return (
      <Kort titel="🌡️ Välj Feber" sub="Högre Feber är svårare men ger fler ben" sida>
        <div className="kk-feberlista">
          {Array.from({ length: meta.feber + 1 }, (_, f) => (
            <button key={f} className="kk-feber" onClick={() => onFeber(f)}>
              <b>{f === 0 ? 'Normal' : `Feber ${f}`}</b>
              <small>{f === 0 ? 'Som vanligt' : R.FEBER[f - 1]}</small>
              {f > 0 && <em>+{20 * f} % ben</em>}
            </button>
          ))}
        </div>
        <button className="pb-litenknapp" onClick={onStang}>
          Avbryt
        </button>
      </Kort>
    )
  }
  return (
    <Kort titel="Välj hjälte" sub="Hjälten bestämmer vad gröna pinnar gör och ändrar en regel" klass="kk-hjaltekort" sida>
      <div className="kk-hjaltar">
        {HJALTAR.map((h) => {
          const har = M.harHjalte(meta, h.id)
          return (
            <button key={h.id} className={`kk-hjalte${har ? '' : ' last'}`} disabled={!har} onClick={() => onHjalte(h.id)}>
              <Portratt id={h.id} />
              <b>{h.namn}</b>
              <em>Grön: {h.kraft === 'slump' ? 'Slumpad' : KRAFTER[h.kraft].namn}</em>
              <small>{har ? h.text : `🔒 ${M.lasText('hjalte', h.id)}`}</small>
            </button>
          )
        })}
      </div>
      <button className="pb-litenknapp" onClick={onStang}>
        Avbryt
      </button>
    </Kort>
  )
}

/* ------------------------------------------------------------ huvudmenyn */

function Huvudmeny({ meta, flik, setFlik, onFortsatt, onNy, onDagens, onKopVerkstad, onAterbetala, onKopHjalte }) {
  const r = meta.runda && !meta.runda.slut ? meta.runda : null
  const dag = M.idag()
  const dagensHjalte = hjalte(M.dagensRunda(dag).hjalte)
  const spelatIdag = meta.dag === dag
  return (
    <div className="kk-meny">
      <div className="kk-logga">
        <div className="kk-logga-kulor" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ '--i': i }} />
          ))}
        </div>
        <h2>Kulkaos</h2>
        <p>Peggle möter Vampire Survivors</p>
        <div className="kk-benrad">
          <span>🦴 {fmt(meta.ben)}</span>
          <span>🏆 {Object.keys(meta.utmaningar).length}/{M.UTMANINGAR.length}</span>
          {meta.feber > 0 && <span>🌡️ Feber {meta.feber}</span>}
        </div>
      </div>
      <div className="kk-startknappar">
        {r && (
          <button className="ds-knapp ds-knapp-stor" onClick={onFortsatt}>
            Fortsätt rundan
            <small>
              {hjalte(r.hjalte).ikon} Akt {r.akt} · rum {Math.max(1, r.rum)} · {r.kulor} kulor · {fmt(r.poang)} poäng
            </small>
          </button>
        )}
        <button className={`ds-knapp ds-knapp-stor${r ? ' ds-knapp-sek' : ''}`} onClick={onNy}>
          {r ? 'Ny runda' : 'Starta en runda'}
          {r && <small>Den pågående rundan avslutas (du får ben för den)</small>}
        </button>
        <button className="ds-knapp kk-dagens" onClick={onDagens}>
          📅 Dagens runda
          <small>
            {dagensHjalte.ikon} {dagensHjalte.namn} · Feber 2 · samma för alla idag{spelatIdag ? ` · ditt bästa ${fmt(meta.dagPoang)}` : ''}
          </small>
        </button>
      </div>
      <div className="pb-flikar kk-flikar" role="tablist">
        {FLIKAR.map((f) => (
          <button key={f.id} role="tab" aria-selected={flik === f.id} className={flik === f.id ? 'pa' : ''} onClick={() => setFlik(f.id)}>
            <span aria-hidden="true">{f.ikon}</span>
            {f.namn}
          </button>
        ))}
      </div>
      {flik === 'hjaltar' && <HjaltarFlik meta={meta} onKop={onKopHjalte} />}
      {flik === 'koja' && <Hundkojan meta={meta} onKop={onKopVerkstad} onAterbetala={onAterbetala} />}
      {flik === 'utmaningar' && <Utmaningar meta={meta} />}
      {flik === 'samling' && <Samling meta={meta} />}
      {flik === 'topp' && <Topplista />}
    </div>
  )
}

function HjaltarFlik({ meta, onKop }) {
  return (
    <div className="kk-lista">
      <div className="pb-flik-info">Varje hjälte ändrar en regel. Lås upp fler med utmaningar, eller köp dem för {HJALTE_PRIS} 🦴.</div>
      {HJALTAR.map((h) => {
        const har = M.harHjalte(meta, h.id)
        const vann = meta.vunnaFeber[h.id]
        return (
          <div key={h.id} className={`kk-rad${har ? '' : ' last'}`}>
            <Portratt id={h.id} />
            <div>
              <b>
                {h.namn} {vann != null && <em className="kk-vann">🏆{vann > 0 ? ` F${vann}` : ''}</em>}
              </b>
              <small>
                Grön: {h.kraft === 'slump' ? 'slumpad' : KRAFTER[h.kraft].namn} · {h.text}
              </small>
              {!har && <small className="kk-las">🔒 {M.lasText('hjalte', h.id)}</small>}
            </div>
            {!har && (
              <button className="kk-kop" disabled={meta.ben < HJALTE_PRIS} onClick={() => onKop(h.id)}>
                {HJALTE_PRIS} 🦴
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Hundkojan({ meta, onKop, onAterbetala }) {
  return (
    <div className="kk-lista">
      <div className="pb-flik-info">Permanenta uppgraderingar som gäller i alla rundor. Priset stiger för varje köp — och du kan alltid få tillbaka allt.</div>
      {M.VERKSTAD.map((v) => {
        const n = meta.verkstad[v.id] || 0
        const full = n >= v.max
        const pris = M.verkstadPris(meta, v.id)
        return (
          <div key={v.id} className="kk-rad">
            <span className="kk-radikon">{v.ikon}</span>
            <div>
              <b>{v.namn}</b>
              <small>{v.text(Math.max(1, full ? n : n + 1))}</small>
              <span className="kk-pips">
                {Array.from({ length: v.max }, (_, i) => (
                  <i key={i} className={i < n ? 'pa' : ''} />
                ))}
              </span>
            </div>
            <button className="kk-kop" disabled={full || meta.ben < pris} onClick={() => onKop(v.id)}>
              {full ? 'Max' : `${fmt(pris)} 🦴`}
            </button>
          </div>
        )
      })}
      {meta.betalt > 0 && (
        <button className="pb-litenknapp" onClick={onAterbetala}>
          ↩️ Få tillbaka alla ben ({fmt(meta.betalt)} 🦴)
        </button>
      )}
    </div>
  )
}

function Utmaningar({ meta }) {
  return (
    <div className="kk-lista">
      {M.UTMANINGAR.map((u) => {
        const klar = Boolean(meta.utmaningar[u.id])
        return (
          <div key={u.id} className={`kk-rad${klar ? ' klar' : ''}`}>
            <span className="kk-radikon">{klar ? u.ikon : '🔒'}</span>
            <div>
              <b>{u.namn}</b>
              <small>{u.text}</small>
              {u.las && (
                <small className="kk-las">
                  Låser upp{' '}
                  {[u.las.hjalte && `${hjalte(u.las.hjalte).ikon} ${hjalte(u.las.hjalte).namn}`, u.las.uppg && `${UPPGRADERINGAR[u.las.uppg].ikon} ${UPPGRADERINGAR[u.las.uppg].namn}`, u.las.feber && '🌡️ Feber'].filter(Boolean).join(' · ')}
                </small>
              )}
            </div>
            <span className={`kk-belo${klar ? ' klar' : ''}`}>{klar ? '✓' : `+${u.ben} 🦴`}</span>
          </div>
        )
      })}
    </div>
  )
}

function Samling({ meta }) {
  const sett = meta.samling
  const uppg = Object.entries(UPPGRADERINGAR)
  const rel = Object.entries(RELIKER)
  return (
    <div className="kk-lista">
      <div className="pb-flik-info">
        Uppgraderingar {Object.keys(sett.uppg).length}/{uppg.length} · reliker {Object.keys(sett.reliker).length}/{rel.length} · rundor {meta.stats.rundor} · vinster {meta.stats.vinster} · bossar {meta.stats.bossar}
      </div>
      <div className="kk-samling">
        {uppg.map(([id, u]) => {
          const har = sett.uppg[id] != null
          const last = u.las && !meta.uppg.includes(id)
          return (
            <div key={id} className={`kk-samlad grad-${u.grad}${har ? '' : ' osedd'}`} title={har ? `${u.namn}: ${u.text(1)}` : last ? M.lasText('uppg', id) : 'Inte hittad än'}>
              <span>{har ? u.ikon : last ? '🔒' : '❔'}</span>
              <small>{har ? u.namn : u.grad === 4 ? 'Evolution' : '???'}</small>
            </div>
          )
        })}
      </div>
      <div className="kk-samling">
        {rel.map(([id, r]) => {
          const har = sett.reliker[id] != null
          return (
            <div key={id} className={`kk-samlad grad-${r.grad}${har ? '' : ' osedd'}`} title={har ? `${r.namn}: ${r.text}` : 'Inte hittad än'}>
              <span>{har ? r.ikon : '❔'}</span>
              <small>{har ? r.namn : 'Relik'}</small>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Topplista() {
  const [lista, setLista] = useState(null)
  const [dagens, setDagens] = useState(null)
  useEffect(() => {
    let av = false
    const hamta = (id, set) =>
      fetch(`/api/scores/${id}`)
        .then((x) => (x.ok ? x.json() : null))
        .then((d) => !av && set(d?.entries || []))
        .catch(() => !av && set([]))
    hamta(M.ID, setLista)
    hamta(M.dagensId(M.idag()), setDagens)
    return () => {
      av = true
    }
  }, [])
  const visa = (l) =>
    l == null ? (
      <small>Hämtar …</small>
    ) : l.length ? (
      <ol>
        {l.slice(0, 10).map((e, i) => (
          <li key={e.player}>
            <span>{i + 1}.</span> {e.player} <b>{fmt(e.score)}</b>
          </li>
        ))}
      </ol>
    ) : (
      <small>Ingen har spelat än — bli först!</small>
    )
  return (
    <div className="kk-lista">
      <div className="pb-topplista">
        <b>📅 Dagens runda</b>
        {visa(dagens)}
      </div>
      <div className="pb-topplista">
        <b>🏆 Bästa rundan</b>
        {visa(lista)}
      </div>
    </div>
  )
}
