import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { skapaSpel, W, H, KANON, STARTKULOR, KRAFTER, multiplikator, mitt, ANTAL_ORANGE } from './motor.js'
import { hamtaBana, ANTAL_BANOR, VARLDAR, stjarnor } from './banor.js'
import { useSpelyta } from '../delat/useSpelyta.js'
import { skapaFx, easeOut, easeOutBack, rundRekt } from '../delat/fx.js'
import { useSpar, useMynt, belona, forlust, betala, svitHjalp, skickaNiva } from '../delat/meta.js'
import { BoostKnapp, Vinstkort, Forlustkort, Notis, useNotis, SvitChip, MyntChip } from '../delat/Ui.jsx'
import { skapaPinnLjud } from './ljud.js'
import * as R from './rita.js'
import happyGlad from '../revir/img/happy-glad.webp'
import happyLedsen from '../revir/img/happy-ledsen.webp'
import './pinnboll.css'

// Pinnbollen — Peggle i Rötspel.
//
// Sikta, skjut. Kulan studsar ner genom pinnarna och tänder allt den
// träffar. Alla orange pinnar ska bort. Tio kulor, hinken längst ner ger
// en kula tillbaka. Sista orange: slowmotion och zoom, och träffar man blir
// det Extreme Fever med regnbåge, fyrverkeri och Ode till glädjen, och
// kulan landar i ett av feberfacken.
//
// Allt som rör sig ligger i refs (a.current); React renderas bara när
// HUD:en (mätaren, knapparna) ändras.

const ID = 'pinnbollen'
const START = { niva: 1, upplast: 1, banor: {}, svit: 0, kista: 0, boost: { spar: 1, kula: 1 } }
const BOOST = {
  spar: { ikon: '🔮', namn: 'Superspår', pris: 60 },
  kula: { ikon: '➕', namn: '+1 kula', pris: 90 },
}
const FORTSATT_PRIS = 100
const STEG = 1 / 120

// Pekskärm: siktet är relativt. Dra åt sidan var som helst på planen så
// vrids kanonen, släpp så skjuter den. Dra neråt för finläge.
const RAD_PER_PX = (Math.PI * 0.93) / W
const KANSLIGHET = 3
const FIN_FAKTOR = 0.3
const FIN_GRANS = 70

const fmt = (n) => Math.round(n).toLocaleString('sv-SE')
const PARK = 'park'

function Portratt({ varld, ledsen, liten }) {
  if (varld.id === PARK) return <img className={`pb-portratt${liten ? ' liten' : ''}`} src={ledsen ? happyLedsen : happyGlad} alt="Happy" />
  return (
    <span className={`pb-portratt emoji${liten ? ' liten' : ''}`} aria-hidden="true">
      {varld.ikon}
    </span>
  )
}

export default function PinnbollGame() {
  const [spar, setSpar, sparRef] = useSpar('pinnbollen-v2', START)
  const mynt = useMynt()
  const ljud = useMemo(() => skapaPinnLjud(), [])
  useEffect(() => () => ljud.stang(), [ljud])
  const fx = useMemo(() => skapaFx(), [])

  const [nr, setNr] = useState(() => Math.max(1, Math.min(ANTAL_BANOR, spar.niva || 1, spar.upplast || 1)))
  const [omgang, setOmgang] = useState(0)
  const bana = useMemo(() => hamtaBana(nr), [nr])
  const varld = VARLDAR[bana.varld]
  // Vinstsvitens hjälp: extra kulor från start (tappas vid förlust).
  const hjalp = useMemo(() => svitHjalp(sparRef.current.svit || 0), [omgang, nr]) // eslint-disable-line react-hooks/exhaustive-deps
  const spel = useMemo(
    () => skapaSpel(bana, { fro: (Date.now() ^ (nr * 7919) ^ (omgang * 104729)) >>> 0, kulor: STARTKULOR + hjalp.extra }),
    [bana, omgang] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [, rendera] = useReducer((x) => x + 1, 0)
  const [vinst, setVinst] = useState(null)
  const [slut, setSlut] = useState(null)
  const [karta, setKarta] = useState(false)
  const [intro, setIntro] = useState(true)
  const [mastare, setMastare] = useState(null)
  const [notis, visaNotis] = useNotis()

  const a = useRef(null)
  if (!a.current || a.current.spel !== spel) a.current = nyttLage(spel)

  function nyttLage(sp) {
    return {
      spel: sp,
      t: 0,
      acc: 0,
      skala: 1,
      zoom: 1,
      kamX: W / 2,
      kamY: H / 2,
      fokus: null,
      fokusTill: 0,
      slowTill: 0,
      blixt: new Map(),
      pop: new Map(),
      popKo: [],
      blockTill: 0.4,
      spar: new Map(),
      visadPoang: 0,
      skottText: null,
      feberT: null,
      fackUpp: 0,
      fackTraff: null,
      slant: null,
      stilar: [],
      allaStilar: [],
      tryck: null,
      snabb: false,
      vantarKort: null,
      hinkGlod: 0,
      kulPuls: -10,
      multPuls: -10,
      nastaFyr: 0,
      smutsig: false,
      sistaVarnad: false,
      zonY: 24,
    }
  }

  // Ny bana eller nytt försök
  useEffect(() => {
    fx.tom()
    ljud.tystaMusik()
    setVinst(null)
    setSlut(null)
    setMastare(null)
    setIntro(true)
    const id = setTimeout(() => setIntro(false), 2800)
    const id2 = hjalp.extra > 0 ? setTimeout(() => visaNotis(`🔥 Vinstsvit ${sparRef.current.svit}: +${hjalp.extra} ${hjalp.extra === 1 ? 'kula' : 'kulor'}`, 2200), 2700) : 0
    return () => {
      clearTimeout(id)
      clearTimeout(id2)
    }
  }, [spel]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mastare) return
    const id = setTimeout(() => setMastare(null), mastare.ms || 1900)
    return () => clearTimeout(id)
  }, [mastare])

  useEffect(() => {
    if (import.meta.env.DEV) window.__pinn = { spel, a: a.current, skjut: () => skjut(), sikta: (v) => spel.sikta(v), nr }
  })

  /* --------------------------------------------------------------- händelser */

  function hantera(lista) {
    const s = a.current
    for (const e of lista) {
      switch (e.typ) {
        case 'traff': {
          s.blixt.set(e.id, s.t)
          ljud.traff(e.nr, e.farg, e.tegel)
          const f = R.FARG[e.farg]
          fx.sprut(e.x, e.y, [f.ljus, f.glod], e.farg === 'bla' ? 4 : 8, { fart: 90, liv: 0.3, storlek: 2 })
          fx.text(e.x, e.y - 9, fmt(e.poang), {
            storlek: e.farg === 'bla' ? 10 : e.farg === 'lila' ? 16 : e.farg === 'gron' ? 11 : 13,
            farg: e.farg === 'bla' ? '#dbeafe' : f.ljus,
            liv: 0.7,
            stig: 22,
            studs: e.farg !== 'bla',
          })
          if (e.farg === 'orange') fx.ring(e.x, e.y, f.glod, 22, 0.3, 2.5)
          if (e.farg === 'lila') {
            fx.ring(e.x, e.y, f.glod, 34, 0.45, 3)
            fx.sprut(e.x, e.y, ['#f0d6ff', '#cf7bff', '#ffffff'], 14, { fart: 150, liv: 0.5, form: 'stjarna', storlek: 2.4 })
          }
          if (e.mult > (s.senastMult || 1)) {
            s.senastMult = e.mult
            s.multPuls = s.t
            ljud.multi(e.mult)
            fx.text(W / 2, 150, `${e.mult}x!`, { storlek: 34, farg: '#ffd43b', liv: 1.1, stig: 30 })
          }
          s.smutsig = true
          break
        }
        case 'extraKula':
          s.kulPuls = s.t
          ljud.extraKula()
          fx.text(W / 2, e.orsak === 'hink' ? 520 : 200, 'EXTRA KULA!', { storlek: 24, farg: '#86efac', liv: 1.3, stig: 40 })
          s.smutsig = true
          break
        case 'hink':
          s.hinkGlod = 1
          ljud.hink()
          fx.sprut(e.x, 575, ['#fde68a', '#ffffff', '#86efac'], 22, { fart: 200, liv: 0.7, form: 'stjarna', lyft: 120 })
          break
        case 'stil':
          s.stilar.push({ namn: e.namn, poang: e.poang, t: s.t })
          s.allaStilar.push(e.namn)
          ljud.stil()
          break
        case 'kraft':
          krafteffekt(e)
          break
        case 'narSista':
          s.fokus = { kula: e.kula, id: e.id }
          ljud.virvel(true)
          break
        case 'missadeSista':
          if (s.fokus && !spel.feber) {
            s.fokus = null
            ljud.virvel(false)
            ljud.miss()
          }
          break
        case 'feberStart': {
          ljud.virvel(false)
          ljud.feber()
          s.feberT = s.t
          s.slowTill = s.t + 1.1
          s.fokusTill = s.t + 1.25
          if (!s.fokus) s.fokus = { kula: spel.kulor[0]?.id, id: e.id }
          fx.hitstop(150)
          fx.skaka(9)
          fx.konfetti(e.x, e.y, 90)
          fx.ring(e.x, e.y, '#ffffff', 90, 0.6, 5)
          fx.sprut(e.x, e.y, ['#ff7a1a', '#ffd43b', '#ffffff'], 40, { fart: 260, liv: 0.8, form: 'gnista' })
          setMastare({ text: 'EXTREME FEVER!', key: s.t, ms: 2600 })
          s.smutsig = true
          break
        }
        case 'fack': {
          s.fackTraff = { index: e.index, tid: 0 }
          ljud.fack(e.poang)
          fx.skaka(e.poang >= 100000 ? 10 : 6)
          const x = (W / 5) * (e.index + 0.5)
          fx.konfetti(x, 560, e.poang >= 100000 ? 120 : 70, 160)
          fx.text(x, 520, `+${fmt(e.poang)}`, { storlek: e.poang >= 100000 ? 30 : 24, farg: '#ffd43b', liv: 1.8, stig: 70 })
          break
        }
        case 'spok':
          ljud.spok()
          fx.sprut(e.x, 12, ['#ede9fe', '#c4b5fd', '#ffffff'], 16, { fart: 120, liv: 0.6, form: 'cirkel', gravitation: -40 })
          fx.text(e.x, 40, '👻 Tillbaka!', { storlek: 16, farg: '#ede9fe', liv: 1, stig: 20 })
          break
        case 'fast':
          ljud.fast()
          s.pop.set(e.id, s.t)
          s.popKo.push({ id: e.id, tid: s.t, i: 0 })
          break
        case 'skottSlut':
          skottSlut(e)
          break
        case 'slut':
          s.vantarKort = { typ: 'slut', vid: s.blockTill + 0.35, orangeKvar: e.orangeKvar }
          break
        case 'banaKlar':
          s.vantarKort = { typ: 'vinst', vid: s.blockTill + 1.1, e }
          fx.text(W / 2, 300, `Kulor kvar ${e.kulor} × 10 000`, { storlek: 18, farg: '#bfdbfe', liv: 2, stig: 30 })
          break
        case 'redo':
          s.smutsig = true
          if (spel.kulorKvar === 0 && !s.sistaVarnad) {
            s.sistaVarnad = true
            visaNotis('Sista kulan!', 1500)
          }
          break
        default:
          break
      }
    }
  }

  function krafteffekt(e) {
    const s = a.current
    const k = KRAFTER[e.kraft]
    ljud.kraft()
    setMastare({ text: k.namn, key: s.t })
    fx.ring(e.x, e.y, '#4dff8a', 48, 0.55, 4)
    fx.sprut(e.x, e.y, ['#c8ffd8', '#4dff8a', '#ffffff'], 20, { fart: 170, liv: 0.6, form: 'stjarna', storlek: 2.6 })
    if (e.kraft === 'small') {
      ljud.small()
      fx.skaka(8)
      fx.ring(e.x, e.y, '#a5b4fc', 66, 0.5, 6)
      fx.ring(e.x, e.y, '#ffffff', 40, 0.35, 3)
    } else if (e.kraft === 'blomma') {
      for (const id of e.tanda || []) {
        const [x, y] = mitt(spel.objekt[id])
        fx.sprut(x, y, ['#ff6fa8', '#ffd1e3', '#ffffff'], 10, { fart: 110, liv: 0.6, form: 'cirkel', storlek: 2.4 })
      }
    }
    s.smutsig = true
  }

  function skottSlut(e) {
    const s = a.current
    ljud.virvel(false)
    if (!spel.feber) s.fokus = null
    const n = e.lista.length
    const mellan = n ? Math.min(0.055, 1.3 / n) : 0
    const start = s.t + 0.22
    e.lista.forEach((id, i) => {
      if (s.pop.has(id)) return
      s.pop.set(id, start + i * mellan)
      s.popKo.push({ id, tid: start + i * mellan, i })
    })
    s.popKo.sort((x, y) => x.tid - y.tid)
    let till = start + n * mellan + 0.15
    if (e.poang > 0) {
      s.skottText = { poang: e.poang, traffar: e.traffar, t: s.t }
    }
    if (e.slant != null) {
      s.slant = { vann: e.slant, t: s.t }
      ljud.slant(e.slant)
      till = Math.max(till, s.t + 1.5)
      if (e.slant) setTimeout(() => (a.current.kulPuls = a.current.t), 900)
    }
    s.blockTill = till
    s.senastMult = spel.mult()
    s.smutsig = true
  }

  /* ---------------------------------------------------------------- vinst & slut */

  function visaVinst(v) {
    const s = a.current
    const poang = spel.poang
    const st = stjarnor(nr, poang, true)
    const nu = sparRef.current
    const fore = nu.banor?.[nr]
    const rekord = !fore || poang > fore.basta
    const { spar: ny, resultat } = belona(nu, {
      gameId: null,
      niva: nr,
      perfekt: spel.rensat,
      extra: st * 5,
      boostTyper: Object.keys(BOOST),
    })
    const banor = { ...(nu.banor || {}), [nr]: { basta: Math.max(fore?.basta || 0, poang), stjarnor: Math.max(fore?.stjarnor || 0, st) } }
    const upplast = Math.max(nu.upplast || 1, Math.min(ANTAL_BANOR, nr + 1))
    setSpar({ ...ny, banor, upplast, niva: Math.min(ANTAL_BANOR, nr + 1), basta: Math.max(nu.basta || 0, nr) })
    const total = Object.values(banor).reduce((t, b) => t + (b.basta || 0), 0)
    if (rekord) skickaNiva(ID, total)
    setVinst({ resultat, poang, st, rekord, fore: fore?.basta || 0, fack: v.e.fack, kulor: v.e.kulor, kulBonus: v.e.kulBonus, stilar: [...new Set(s.allaStilar)], total, sista: nr === ANTAL_BANOR })
  }

  function visaSlut(v) {
    ljud.forlust()
    setSlut({ orangeKvar: v.orangeKvar })
  }

  function fortsatt() {
    if (!betala(FORTSATT_PRIS)) return
    if (spel.fortsatt(3)) {
      const s = a.current
      s.vantarKort = null
      s.blockTill = s.t + 0.3
      s.sistaVarnad = false
      s.kulPuls = s.t
      ljud.extraKula()
      setSlut(null)
    }
  }

  function igen() {
    setSpar(forlust(sparRef.current))
    setSlut(null)
    setOmgang((o) => o + 1)
  }

  function spelaIgen() {
    setVinst(null)
    setOmgang((o) => o + 1)
  }

  function nasta() {
    setVinst(null)
    if (nr >= ANTAL_BANOR) {
      setKarta(true)
      setOmgang((o) => o + 1)
      return
    }
    setNr((n) => Math.min(ANTAL_BANOR, n + 1))
    setOmgang((o) => o + 1)
  }

  function valjBana(n) {
    // Att lämna en påbörjad bana räknas som förlust (som att ge upp).
    if (spel.skott > 0 && spel.lage !== 'klar' && !vinst) setSpar(forlust(sparRef.current))
    setKarta(false)
    setVinst(null)
    setSlut(null)
    if (n === nr) setOmgang((o) => o + 1)
    else setNr(n)
  }

  /* ---------------------------------------------------------------- styrning */

  const overlagg = karta || vinst || slut
  function kanSkjuta() {
    const s = a.current
    return !overlagg && spel.lage === 'siktar' && spel.iKanonen && s.t >= s.blockTill
  }

  function skjut() {
    const s = a.current
    if (!kanSkjuta()) return
    if (spel.skjut()) {
      ljud.skott()
      s.senastMult = spel.mult()
      s.spar.clear()
      s.skottText = null
      s.stilar = []
      const tx = KANON.x + Math.cos(spel.vinkel) * 30
      const ty = KANON.y + Math.sin(spel.vinkel) * 30
      fx.sprut(tx, ty, ['#ffffff', '#fde68a'], 8, { vinkel: spel.vinkel, spridning: 0.8, fart: 140, liv: 0.25, storlek: 2 })
      setIntro(false)
      s.smutsig = true
    }
  }

  function sikta(v) {
    spel.sikta(v)
  }

  function ner(p) {
    const s = a.current
    if (overlagg || s.tryck) return
    const e = p.e
    setIntro(false)
    const r = e.target.getBoundingClientRect?.()
    s.zonY = Math.max(24, r && r.width ? (44 * W) / r.width : 24)
    const mus = e.pointerType === 'mouse'
    if (spel.lage === 'siktar') {
      s.tryck = { id: e.pointerId, typ: 'sikta', x0: p.x, y0: p.y, v0: spel.vinkel, x: p.x, y: p.y, mus, fin: false }
      if (mus) sikta(Math.atan2(p.y - KANON.y, p.x - KANON.x))
    } else {
      s.tryck = { id: e.pointerId, typ: 'snabb', mus }
      s.snabb = true
    }
  }

  function flytta(p) {
    const s = a.current
    const e = p.e
    const t = s.tryck
    if (e.pointerType === 'mouse' && !overlagg && (!t || t.typ === 'sikta')) {
      if (p.y > KANON.y - 10) sikta(Math.atan2(p.y - KANON.y, p.x - KANON.x))
      if (t) {
        t.x = p.x
        t.y = p.y
      }
      return
    }
    if (!t || e.pointerId !== t.id || t.typ !== 'sikta') return
    t.x = p.x
    t.y = p.y
    const dx = p.x - t.x0
    const dy = p.y - t.y0
    t.fin = dy > FIN_GRANS
    sikta(t.v0 - dx * RAD_PER_PX * KANSLIGHET * (t.fin ? FIN_FAKTOR : 1))
  }

  function upp(p) {
    const s = a.current
    const t = s.tryck
    if (!t || p.e.pointerId !== t.id) return
    s.tryck = null
    s.snabb = false
    if (t.typ !== 'sikta') return
    if (p.y < s.zonY && !t.mus) return // släppt uppe vid kanonen: avbryt
    skjut()
  }

  function avbryt(p) {
    const s = a.current
    if (s.tryck && p.e.pointerId === s.tryck.id) {
      s.tryck = null
      s.snabb = false
    }
  }

  // Tangentbord: pilar siktar (shift = fint), mellanslag/enter skjuter.
  const tangent = useRef(null)
  tangent.current = (e) => {
    if (overlagg) return
    const steg = e.shiftKey ? 0.0035 : 0.017
    if (e.key === 'ArrowLeft') sikta(spel.vinkel + steg)
    else if (e.key === 'ArrowRight') sikta(spel.vinkel - steg)
    else if (e.key === ' ' || e.key === 'Enter') skjut()
    else return
    e.preventDefault()
  }
  useEffect(() => {
    const f = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return
      tangent.current(e)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

  function anvandBoost(typ) {
    if (spel.lage !== 'siktar' || overlagg) return
    const b = BOOST[typ]
    const har = sparRef.current.boost?.[typ] || 0
    if (har > 0) setSpar((sp) => ({ ...sp, boost: { ...sp.boost, [typ]: (sp.boost[typ] || 0) - 1 } }))
    else if (!betala(b.pris)) {
      visaNotis('För få mynt', 1400)
      return
    }
    ljud.booster()
    if (typ === 'spar') {
      spel.sparKvar += 3
      visaNotis('🔮 Superspår i tre skott', 1600)
    } else {
      spel.kulorKvar += 1
      a.current.kulPuls = a.current.t
      visaNotis('➕ En kula till', 1400)
    }
    rendera()
  }

  /* ---------------------------------------------------------------- loopen */

  function uppdatera(dt) {
    const s = a.current
    s.t += dt
    fx.uppdatera(dt)
    if (!karta && !fx.fryst()) {
      const slow = s.fokus || s.t < s.slowTill
      const snabb = s.snabb && !slow && !spel.feber
      const mal = slow ? 0.2 : snabb ? 2.8 : 1
      s.skala += (mal - s.skala) * (1 - Math.exp(-dt * (mal < s.skala ? 16 : 5)))
      s.acc += dt * s.skala
      let n = 0
      while (s.acc >= STEG && n < 40) {
        s.acc -= STEG
        n++
        const h = spel.steg(STEG)
        if (h.length) hantera(h)
      }
      if (n >= 40) s.acc = 0
    }
    // spår efter kulorna
    const levande = new Set()
    for (const k of spel.kulor) {
      levande.add(k.id)
      let sp = s.spar.get(k.id)
      if (!sp) s.spar.set(k.id, (sp = []))
      sp.push([k.x, k.y])
      if (sp.length > (spel.eldNu ? 14 : 9)) sp.shift()
    }
    for (const id of s.spar.keys()) if (!levande.has(id)) s.spar.delete(id)
    // fokus efter feberstarten släpps efter en stund
    if (s.fokusTill && s.t > s.fokusTill) {
      s.fokus = null
      s.fokusTill = 0
    }
    // kameran
    let zm = 1
    let cx = W / 2
    let cy = H / 2
    if (s.fokus) {
      const k = spel.kulor.find((q) => q.id === s.fokus.kula)
      const o = spel.objekt[s.fokus.id]
      if (k && o) {
        const [ox, oy] = mitt(o)
        cx = (k.x + ox) / 2
        cy = (k.y + oy) / 2
        zm = 2.1
      } else if (k) {
        cx = k.x
        cy = k.y
        zm = 1.7
      }
    }
    s.zoom += (zm - s.zoom) * (1 - Math.exp(-dt * (zm > s.zoom ? 4 : 3)))
    s.kamX += (cx - s.kamX) * (1 - Math.exp(-dt * 7))
    s.kamY += (cy - s.kamY) * (1 - Math.exp(-dt * 7))
    const hx = W / (2 * s.zoom)
    const hy = H / (2 * s.zoom)
    s.kamX = Math.max(hx, Math.min(W - hx, s.kamX))
    s.kamY = Math.max(hy, Math.min(H - hy, s.kamY))
    // feber
    if (spel.feber && s.feberT != null && s.t > s.feberT + 0.45) s.fackUpp = Math.min(1, s.fackUpp + dt / 0.5)
    if (s.fackTraff) s.fackTraff.tid += dt
    s.hinkGlod = Math.max(0, s.hinkGlod - dt * 1.4)
    if (spel.feber && s.feberT != null && s.t - s.feberT < 6 && s.t > s.nastaFyr) {
      s.nastaFyr = s.t + 0.28 + Math.random() * 0.3
      const x = 40 + Math.random() * 280
      const y = 90 + Math.random() * 260
      fx.sprut(x, y, ['#ff5a7a', '#ffd43b', '#5ce1e6', '#9b7bff', '#5bd96b', '#ffffff'], 28, { fart: 210, liv: 0.95, form: 'gnista', gravitation: 120, storlek: 2.6 })
      ljud.brus(0.25, 0.05, 2500, 0, 600)
    }
    // pinnarna poppar i träffordning
    while (s.popKo.length && s.popKo[0].tid <= s.t) {
      const p = s.popKo.shift()
      const o = spel.objekt[p.id]
      if (!o) continue
      const [x, y] = mitt(o)
      const f = R.FARG[o.farg]
      fx.sprut(x, y, [f.ljus, f.bas, '#ffffff'], o.typ === 'tegel' ? 9 : 6, { fart: 130, liv: 0.35, storlek: 2.4 })
      ljud.poppa(p.i)
    }
    if (s.vantarKort && s.t >= s.vantarKort.vid && !s.popKo.length) {
      const v = s.vantarKort
      s.vantarKort = null
      if (v.typ === 'vinst') visaVinst(v)
      else visaSlut(v)
    }
    if (s.smutsig) {
      s.smutsig = false
      rendera()
    }
  }

  /* ---------------------------------------------------------------- ritning */

  function rita(ctx) {
    const s = a.current
    const t = s.t
    ctx.fillStyle = '#0b1020'
    ctx.fillRect(-20, -20, W + 40, H + 40)
    ctx.save()
    ctx.translate(fx.skakX(), fx.skakY())
    ctx.translate(W / 2, H / 2)
    ctx.scale(s.zoom, s.zoom)
    ctx.translate(-s.kamX, -s.kamY)
    ctx.drawImage(R.bakgrund(varld), 0, 0, W, H)
    if (spel.feber && s.feberT != null) ritaRegnbage(ctx, t - s.feberT)

    // pinnar och tegel
    const ensam = !spel.feber && spel.lage === 'siktar' ? sistaOrange() : null
    for (const o of spel.objekt) {
      let lit = o.lit
      let skal = 1
      let alfa = 1
      if (o.borta) {
        const pt = s.pop.get(o.id)
        if (pt == null) continue
        if (t < pt) lit = true
        else if (t < pt + 0.14) {
          const k = (t - pt) / 0.14
          lit = true
          skal = 1 + k * 0.6
          alfa = 1 - k
        } else continue
      }
      const bt = s.blixt.get(o.id)
      if (bt != null && t - bt < 0.2) skal *= 1 + 0.4 * (1 - (t - bt) / 0.2)
      if (o.form === 'cirkel') R.ritaPinne(ctx, o.wx, o.wy, o.r, o.farg, lit, skal, alfa)
      else R.ritaTegel(ctx, o, o.farg, lit, 1 + (skal - 1) * 0.35, alfa)
    }
    if (ensam) {
      const [x, y] = mitt(ensam)
      const r = 15 + Math.sin(t * 6) * 3
      ctx.strokeStyle = 'rgba(255,170,60,0.9)'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // siktet
    const visaSikte = !overlagg && spel.lage === 'siktar' && spel.iKanonen && t >= s.blockTill
    if (visaSikte) {
      const lang = spel.sparKvar > 0
      R.ritaSikte(ctx, spel.siktlinje(lang ? 2 : 0, 1.1), lang, t)
    }

    if (!spel.feber) R.ritaHink(ctx, spel.hinkX, t, s.hinkGlod)
    R.ritaFack(ctx, s.fackUpp, spel.rensat, t, s.fackTraff)

    const typ = spel.eldNu ? 'eld' : spel.spokNu ? 'spok' : 'vanlig'
    for (const k of spel.kulor) R.ritaKula(ctx, k, s.spar.get(k.id) || [], typ)

    R.ritaKanon(ctx, spel.vinkel, visaSikte, varld.ikon, t, spel.eldKvar > 0)
    fx.rita(ctx)
    ctx.restore()

    ritaHud(ctx, t, visaSikte)
  }

  function sistaOrange() {
    let hittad = null
    for (const o of spel.objekt) {
      if (o.farg === 'orange' && !o.lit && !o.borta) {
        if (hittad) return null
        hittad = o
      }
    }
    return hittad
  }

  function ritaRegnbage(ctx, k) {
    ctx.save()
    ctx.globalAlpha = Math.min(0.32, k * 0.6)
    ctx.translate(W / 2, H * 0.42)
    ctx.rotate(k * 0.35)
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `hsl(${(i * 26 + k * 90) % 360} 95% 60%)`
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, 700, (i / 14) * Math.PI * 2, ((i + 0.5) / 14) * Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  function text(ctx, txt, x, y, storlek, farg, just = 'center', kant = 'rgba(0,0,0,0.7)') {
    ctx.font = `900 ${storlek}px ui-rounded, "Outfit Variable", system-ui, sans-serif`
    ctx.textAlign = just
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(3, storlek * 0.2)
    ctx.strokeStyle = kant
    ctx.strokeText(txt, x, y)
    ctx.fillStyle = farg
    ctx.fillText(txt, x, y)
  }

  function ritaHud(ctx, t, siktar) {
    const s = a.current
    // poängen räknas upp
    const mal = spel.poang
    s.visadPoang += (mal - s.visadPoang) * 0.12
    if (Math.abs(mal - s.visadPoang) < 1) s.visadPoang = mal
    text(ctx, fmt(s.visadPoang), 10, 18, 18, '#ffffff', 'left')
    text(ctx, 'POÄNG', 11, 34, 8.5, 'rgba(255,255,255,0.65)', 'left', 'rgba(0,0,0,0.4)')

    // kulor kvar
    const kvar = spel.kulorKvar + (spel.iKanonen && spel.lage === 'siktar' ? 1 : 0)
    const puls = Math.max(0, 1 - (t - s.kulPuls) / 0.6)
    ctx.save()
    ctx.translate(W - 30, 20)
    ctx.scale(1 + puls * 0.35, 1 + puls * 0.35)
    R.ritaKula(ctx, { x: -16, y: 0, r: 7 }, [], 'vanlig')
    text(ctx, `${kvar}`, 4, 0, 18, kvar <= 1 ? '#fca5a5' : '#ffffff', 'center')
    ctx.restore()
    text(ctx, 'KULOR', W - 32, 34, 8.5, 'rgba(255,255,255,0.65)', 'center', 'rgba(0,0,0,0.4)')

    // aktiva krafter
    let ky = 50
    const chip = (txt, farg) => {
      text(ctx, txt, 10, ky, 10.5, farg, 'left')
      ky += 14
    }
    if (spel.sparKvar > 0) chip(`🔮 Superspår ×${spel.sparKvar}`, '#bbf7d0')
    if (spel.eldKvar > 0 || spel.eldNu) chip('🔥 Eldboll', '#fdba74')
    if (spel.spokKvar > 0 || spel.spokNu) chip('👻 Spöksboll', '#ddd6fe')

    // skottets poäng medan kulan är ute
    if ((spel.lage === 'skjuter' || spel.lage === 'feber') && spel.skottTraffar > 0) {
      const sp = spel.skottPoang()
      const st = Math.min(30, 13 + Math.log10(Math.max(10, sp)) * 3)
      text(ctx, `+${fmt(sp)}`, W / 2, 72, st, sp >= 25000 ? '#86efac' : '#fde68a')
      text(ctx, `${spel.skottTraffar} ${spel.skottTraffar === 1 ? 'träff' : 'träffar'}`, W / 2, 72 + st * 0.75, 9.5, 'rgba(255,255,255,0.8)', 'center', 'rgba(0,0,0,0.5)')
    }
    // skottets slutsumma
    if (s.skottText) {
      const k = (t - s.skottText.t) / 1.5
      if (k >= 1) s.skottText = null
      else {
        const stor = Math.min(32, 16 + Math.log10(Math.max(10, s.skottText.poang)) * 3.2)
        const sk = k < 0.15 ? easeOutBack(k / 0.15) : 1
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1
        text(ctx, `+${fmt(s.skottText.poang)}`, W / 2, 330 - easeOut(k) * 50, stor * sk, s.skottText.poang >= 25000 ? '#86efac' : '#ffffff')
        ctx.globalAlpha = 1
      }
    }
    // stilskott
    s.stilar = s.stilar.filter((x) => t - x.t < 2)
    s.stilar.forEach((x, i) => {
      const k = (t - x.t) / 2
      const sk = k < 0.1 ? easeOutBack(k / 0.1) : 1
      ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1
      const y = 118 + i * 40
      text(ctx, x.namn.toUpperCase(), W / 2, y, 21 * sk, '#fef08a')
      text(ctx, `+${fmt(x.poang)}`, W / 2, y + 18, 13 * sk, '#ffffff')
      ctx.globalAlpha = 1
    })
    // EXTREME FEVER
    if (s.feberT != null) {
      const k = t - s.feberT
      if (k < 3.2) {
        const sk = k < 0.4 ? easeOutBack(k / 0.4) : 1 + Math.sin(k * 8) * 0.03
        ctx.save()
        ctx.translate(W / 2, 250)
        ctx.scale(sk, sk)
        ctx.rotate(Math.sin(k * 3) * 0.04)
        ctx.globalAlpha = k > 2.7 ? (3.2 - k) / 0.5 : 1
        const g = ctx.createLinearGradient(-150, 0, 150, 0)
        for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(i * 55 + k * 240) % 360} 100% 62%)`)
        ctx.font = '900 40px ui-rounded, "Outfit Variable", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 9
        ctx.strokeStyle = 'rgba(20,0,40,0.8)'
        ctx.strokeText('EXTREME', 0, -22)
        ctx.strokeText('FEVER', 0, 22)
        ctx.fillStyle = g
        ctx.fillText('EXTREME', 0, -22)
        ctx.fillText('FEVER', 0, 22)
        ctx.restore()
        ctx.globalAlpha = 1
      }
    }
    // slanten
    if (s.slant) {
      const k = t - s.slant.t
      if (k > 1.6) s.slant = null
      else {
        const x = W / 2
        const y = 470
        if (k < 0.9) {
          const w = Math.abs(Math.cos(k * 22)) * 16 + 1
          ctx.fillStyle = '#facc15'
          ctx.strokeStyle = '#a16207'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.ellipse(x, y - Math.sin((k / 0.9) * Math.PI) * 50, w, 16, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        } else {
          text(ctx, s.slant.vann ? 'GRATIS KULA!' : 'Ingen tur…', x, y, s.slant.vann ? 22 : 16, s.slant.vann ? '#86efac' : '#cbd5e1')
        }
      }
    }
    // pekarens hjälplinjer (relativt sikte)
    const tr = s.tryck
    if (tr && tr.typ === 'sikta' && !tr.mus) {
      const avbryter = tr.y < s.zonY
      ctx.strokeStyle = avbryter ? 'rgba(248,113,113,0.95)' : 'rgba(255,255,255,0.35)'
      ctx.setLineDash([4, 5])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(tr.x0, tr.y0)
      ctx.lineTo(tr.x, tr.y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      ctx.arc(tr.x0, tr.y0, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = avbryter ? '#f87171' : tr.fin ? '#93c5fd' : 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(tr.x, tr.y, 16, 0, Math.PI * 2)
      ctx.stroke()
      if (tr.fin) text(ctx, 'fint', tr.x, tr.y - 26, 10, '#93c5fd')
      ctx.fillStyle = avbryter ? 'rgba(248,113,113,0.22)' : 'rgba(255,255,255,0.06)'
      ctx.fillRect(0, 0, W, s.zonY)
      if (avbryter) text(ctx, 'Släpp här = avbryt', W / 2, s.zonY + 12, 11, '#fecaca')
    }
    // snabbspolning
    if (s.snabb && s.skala > 1.5) text(ctx, '⏩', W - 18, H - 46, 16, '#ffffff')
    // första skottet: hur man siktar
    if (nr === 1 && spel.skott === 0 && siktar && !intro) {
      ctx.globalAlpha = 0.75 + Math.sin(t * 3) * 0.2
      ctx.fillStyle = 'rgba(8,12,28,0.72)'
      rundRekt(ctx, W / 2 - 128, 528, 256, 40, 14)
      ctx.fill()
      text(ctx, 'Dra åt sidan för att sikta', W / 2, 541, 13, '#ffffff')
      text(ctx, 'släpp för att skjuta', W / 2, 557, 11, '#cbd5e1')
      ctx.globalAlpha = 1
    }
  }

  const canvasRef = useSpelyta({ bredd: W, hojd: H, rita, uppdatera, ner, flytta, upp, avbryt })

  /* ---------------------------------------------------------------- HUD */

  const antal = spel.antalOrange
  const traffade = Math.min(antal, spel.orangeTraffade)
  const kvarOrange = spel.orangeKvar()
  const mult = spel.mult()
  const granser = useMemo(() => {
    const g = []
    let forra = 1
    for (let i = 0; i < antal; i++) {
      const m = multiplikator(Math.round(((i + 1) * ANTAL_ORANGE) / antal))
      g.push(m > forra ? m : 0)
      forra = m
    }
    return g
  }, [antal])
  const siktlage = spel.lage === 'siktar' && !overlagg

  return (
    <div className="ds-rot pb-rot" style={{ '--h1': varld.himmel[0], '--h2': varld.himmel[1] }}>
      <header className="pb-topp">
        <button className="pb-kartknapp" onClick={() => setKarta(true)} aria-label="Alla banor">
          <span aria-hidden="true">☰</span>
        </button>
        <div className="pb-titel">
          <b>
            {nr}. {bana.namn}
          </b>
          <small>
            {varld.ikon} {varld.namn}
          </small>
        </div>
        <div className="ds-hoger">
          <SvitChip svit={spar.svit || 0} />
          <MyntChip mynt={mynt} />
        </div>
      </header>

      <div className="pb-mater" aria-label={`${kvarOrange} orange kvar, multiplikator ${mult}x`}>
        <span className="pb-kvar" title="Orange kvar">
          <i aria-hidden="true" />
          {kvarOrange}
        </span>
        <div className="pb-mater-rad">
          {granser.map((g, i) => (
            <span key={i} className={`${i < traffade ? 'pa' : ''}${g ? ' grans' : ''}`}>
              {g ? <em>{g}x</em> : null}
            </span>
          ))}
        </div>
        <span key={mult} className={`pb-mult m${mult}`}>
          {mult}x
        </span>
      </div>

      <div className="ds-yta pb-yta">
        <canvas ref={canvasRef} aria-label="Pinnbollen — spelplan" />
        {intro && (
          <div className="pb-intro" key={`${nr}-${omgang}`} aria-live="polite">
            <div className="pb-intro-varld">
              <Portratt varld={varld} liten /> {varld.namn}
            </div>
            <div className="pb-intro-namn">
              Bana {nr}: {bana.namn}
            </div>
            <div className="pb-intro-mal">Träffa alla {antal} orange pinnar</div>
            <div className="pb-intro-kraft">
              <i aria-hidden="true" /> Grön pinne ger <b>{KRAFTER[bana.kraft].namn}</b>
              <small>{KRAFTER[bana.kraft].text}</small>
            </div>
          </div>
        )}
        {mastare && (
          <div className={`pb-mastare${mastare.text === 'EXTREME FEVER!' ? ' feber' : ''}`} key={mastare.key}>
            <Portratt varld={varld} />
            <div>
              <b>{mastare.text}</b>
              <small>{varld.mastare}</small>
            </div>
          </div>
        )}
        <Notis notis={notis} />
      </div>

      <div className="pb-reglage">
        <FinKnapp tecken="◀" etikett="Sikta åt vänster" onSteg={(k) => sikta(spel.vinkel + k)} />
        <button className="pb-skjut" onClick={skjut} disabled={!siktlage} aria-label="Skjut">
          Skjut
        </button>
        <FinKnapp tecken="▶" etikett="Sikta åt höger" onSteg={(k) => sikta(spel.vinkel - k)} />
        <div className="pb-boostar">
          {Object.entries(BOOST).map(([typ, b]) => (
            <BoostKnapp key={typ} ikon={b.ikon} namn={b.namn} antal={spar.boost?.[typ] || 0} pris={b.pris} mynt={mynt} disabled={!siktlage} onClick={() => anvandBoost(typ)} />
          ))}
        </div>
      </div>

      {karta && <Karta spar={spar} nu={nr} varning={spel.skott > 0 && !vinst && spel.lage !== 'klar' && (spar.svit || 0) >= 2} onValj={valjBana} onStang={() => setKarta(false)} />}

      {vinst && (
        <Vinstkort
          resultat={vinst.resultat}
          titel={vinst.rekord && vinst.fore ? 'Nytt rekord!' : spel.rensat ? 'Rent hus!' : 'Extreme Fever!'}
          ljud={ljud}
          boostInfo={BOOST}
          onNasta={nasta}
          nastaText={vinst.sista ? 'Till kartan' : 'Nästa bana'}
          barn={<Poangtavla vinst={vinst} ljud={ljud} onIgen={spelaIgen} onKarta={() => { setVinst(null); setKarta(true); setOmgang((o) => o + 1) }} />}
        />
      )}

      {slut && (
        <Forlustkort
          titel={slut.orangeKvar <= 2 ? 'Så nära!' : 'Slut på kulor'}
          text={`${slut.orangeKvar} orange ${slut.orangeKvar === 1 ? 'pinne' : 'pinnar'} kvar · ${fmt(spel.poang)} poäng`}
          ikon={<Portratt varld={varld} ledsen />}
          fortsatt={{ text: 'Fortsätt med 3 kulor', pris: FORTSATT_PRIS, onClick: fortsatt }}
          onIgen={igen}
          mynt={mynt}
          svit={spar.svit || 0}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ delar */

// Håll in för att vrida kanonen fint; ju längre man håller, desto fortare.
function FinKnapp({ tecken, etikett, onSteg }) {
  const timer = useRef(null)
  const start = useRef(0)
  const cb = useRef(onSteg)
  cb.current = onSteg
  function stopp() {
    clearTimeout(timer.current)
    timer.current = null
  }
  function ner(e) {
    e.preventDefault()
    stopp()
    start.current = performance.now()
    cb.current(0.007)
    const tick = () => {
      const hallen = (performance.now() - start.current) / 1000
      cb.current(Math.min(0.035, 0.007 + hallen * 0.012))
      timer.current = setTimeout(tick, 40)
    }
    timer.current = setTimeout(tick, 280)
  }
  useEffect(() => stopp, [])
  return (
    <button className="pb-fin" aria-label={etikett} onPointerDown={ner} onPointerUp={stopp} onPointerLeave={stopp} onPointerCancel={stopp} onContextMenu={(e) => e.preventDefault()}>
      {tecken}
    </button>
  )
}

function Poangtavla({ vinst, ljud, onIgen, onKarta }) {
  const [visade, setVisade] = useState(0)
  useEffect(() => {
    const ids = []
    for (let i = 0; i < vinst.st; i++)
      ids.push(
        setTimeout(() => {
          setVisade(i + 1)
          ljud.stjarna(i)
        }, 350 + i * 320)
      )
    return () => ids.forEach(clearTimeout)
  }, [vinst.st, ljud])
  return (
    <div className="pb-tavla">
      <div className="pb-stjarnor" aria-label={`${vinst.st} av 3 stjärnor`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < visade ? 'pa' : ''}>
            ★
          </span>
        ))}
      </div>
      <div className="pb-tavla-poang">
        {fmt(vinst.poang)}
        {vinst.rekord && vinst.fore > 0 && <em>Rekord!</em>}
      </div>
      <div className="pb-tavla-chips">
        <span>
          Feberfack <b>+{fmt(vinst.fack)}</b>
        </span>
        {vinst.kulor > 0 && (
          <span>
            {vinst.kulor} {vinst.kulor === 1 ? 'kula' : 'kulor'} kvar <b>+{fmt(vinst.kulBonus)}</b>
          </span>
        )}
        {vinst.stilar.map((x) => (
          <span key={x} className="stil">
            {x}
          </span>
        ))}
      </div>
      <div className="pb-tavla-total">
        Alla banor: <b>{fmt(vinst.total)}</b>
        {vinst.fore > 0 && !vinst.rekord && <> · rekord här {fmt(vinst.fore)}</>}
      </div>
      <div className="pb-tavla-knappar">
        <button className="pb-litenknapp" onClick={onIgen}>
          ↻ Spela igen
        </button>
        <button className="pb-litenknapp" onClick={onKarta}>
          ☰ Banor
        </button>
      </div>
    </div>
  )
}

function Karta({ spar, nu, varning, onValj, onStang }) {
  const banor = spar.banor || {}
  const totalStj = Object.values(banor).reduce((t, b) => t + (b.stjarnor || 0), 0)
  const total = Object.values(banor).reduce((t, b) => t + (b.basta || 0), 0)
  return (
    <div className="ds-kort-bak pb-karta-bak" role="dialog" aria-modal="true" aria-label="Alla banor">
      <div className="pb-karta">
        <div className="pb-karta-topp">
          <div>
            <b>Äventyret</b>
            <small>
              ★ {totalStj}/{ANTAL_BANOR * 3} · {fmt(total)} poäng
            </small>
          </div>
          <button className="pb-stang" onClick={onStang} aria-label="Stäng">
            ✕
          </button>
        </div>
        {varning && <div className="pb-karta-varning">🔥 Byter du bana nu tappar du vinstsviten.</div>}
        <div className="pb-karta-lista">
          {VARLDAR.map((v, vi) => (
            <section key={v.id} className="pb-varldkort" style={{ '--h1': v.himmel[0], '--h2': v.himmel[1] }}>
              <header>
                <Portratt varld={v} liten />
                <div>
                  <b>{v.namn}</b>
                  <small>
                    {v.mastare} · {KRAFTER[v.kraft].namn}
                  </small>
                </div>
              </header>
              <div className="pb-banknappar">
                {[1, 2, 3, 4, 5].map((k) => {
                  const n = vi * 5 + k
                  const info = banor[n]
                  const last = n > (spar.upplast || 1)
                  const st = info?.stjarnor || 0
                  return (
                    <button key={n} className={`pb-bank${n === nu ? ' nu' : ''}${info ? ' klar' : ''}`} disabled={last} onClick={() => onValj(n)} title={last ? 'Låst' : `Bana ${n}: ${hamtaBana(n).namn}`}>
                      <span className="pb-bank-nr">{last ? '🔒' : n}</span>
                      <span className="pb-bank-stj" aria-label={`${st} stjärnor`}>
                        {[0, 1, 2].map((i) => (
                          <i key={i} className={i < st ? 'pa' : ''}>
                            ★
                          </i>
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
