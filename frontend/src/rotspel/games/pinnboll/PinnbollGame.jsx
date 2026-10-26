import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { skapaSpel, botSkott, W, H, KANON, STARTKULOR, KRAFTER, multiplikator, mitt, ANTAL_ORANGE } from './motor.js'
import { hamtaBana, ANTAL_BANOR, VARLDAR, stjarnor } from './banor.js'
import { BONUS, hamtaBonus } from './bonus.js'
import { nyRunda, rundaBana, spelVal, rundaKlar, bonusVal, valjBonus, slaOm, oppnaKista, build, ingarI, hjalte, HJALTAR, UPPGRADERINGAR, GRADER, NYA_KULOR } from './runda.js'
import { byggEgen, koda, avkoda } from './editor.js'
import BanEditor from './BanEditor.jsx'
import { useSpelyta } from '../delat/useSpelyta.js'
import { skapaFx, easeOut, easeOutBack, rundRekt } from '../delat/fx.js'
import { useSpar, useMynt, belona, forlust, betala, svitHjalp, skickaNiva, laggTillMynt } from '../delat/meta.js'
import { BoostKnapp, Vinstkort, Forlustkort, Notis, useNotis, SvitChip, MyntChip, Mynt } from '../delat/Ui.jsx'
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
// Fyra lägen: äventyret (30 banor och en bonusbana efter varje värld),
// oändligt läge (ett roguelike: välj hjälte, banor som byggs av sig själva,
// uppgraderingar efter varje bana, en bonusbana och en skattkista var femte
// bana — se runda.js), bonusbanorna för sig (världarnas sex och tio
// kulregnsbanor) och egna banor från baneditorn (som går att dela som länk).
//
// Allt som rör sig ligger i refs (a.current); React renderas bara när
// HUD:en (mätaren, knapparna) ändras.

const ID = 'pinnbollen'
const ID_OANDLIG = 'pinnbollen-oandlig'
const START = { niva: 1, upplast: 1, banor: {}, svit: 0, kista: 0, boost: { spar: 1, kula: 1 }, runda: null, rundaBast: { niva: 0, poang: 0 }, bonus: {}, egna: [], flik: 'aventyr' }
const MAX_EGNA = 40

// En delad bana i adressen: ?pbana=…
function lasDelad() {
  try {
    const kod = new URLSearchParams(window.location.search).get('pbana')
    return kod ? avkoda(kod) : null
  } catch {
    return null
  }
}
function rensaDelad() {
  try {
    const u = new URL(window.location.href)
    if (!u.searchParams.has('pbana')) return
    u.searchParams.delete('pbana')
    window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash)
  } catch {
    /* spelar ingen roll */
  }
}
// Bonusbana k (0–5) är öppen när värld k är klar i äventyret (den första
// direkt), eller när oändligt läge har kommit så långt.
const KULREGN = BONUS.findIndex((b) => b.id === 'kulregnet')
// Världarnas bonusbanor öppnas efter varje värld; kulregnsbanorna öppnas
// alla på en gång, samtidigt som Kulregnet.
const bonusOppen = (k, spar) => (BONUS[k]?.familj === 'kulregn' ? bonusOppen(KULREGN, spar) : k === 0 || (spar.upplast || 1) > k * 5 || (spar.rundaBast?.niva || 0) > (k + 1) * 5)
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
  // lage: { typ: 'aventyr' } | { typ: 'oandlig' } | { typ: 'bonus', id, variant, efter? } | { typ: 'egen', data, id?, delad? }
  const [lage, setLage] = useState(() => {
    const delad = lasDelad()
    return delad ? { typ: 'egen', data: delad, delad: true } : { typ: 'aventyr' }
  })
  const runda = spar.runda
  const bana = useMemo(() => {
    if (lage.typ === 'bonus') return hamtaBonus(lage.id, lage.variant || 0)
    if (lage.typ === 'oandlig' && runda) return rundaBana(runda)
    if (lage.typ === 'egen') return byggEgen(lage.data)
    return hamtaBana(nr)
  }, [lage, nr, runda?.fro, runda?.niva]) // eslint-disable-line react-hooks/exhaustive-deps
  const varld = VARLDAR[bana.varld || 0]
  const aventyr = lage.typ === 'aventyr'
  const iRunda = lage.typ === 'oandlig' && runda
  // Vinstsvitens hjälp: extra kulor från start (tappas vid förlust). Bara i äventyret.
  const hjalp = useMemo(() => (aventyr ? svitHjalp(sparRef.current.svit || 0) : { niva: 0, extra: 0 }), [omgang, nr, aventyr]) // eslint-disable-line react-hooks/exhaustive-deps
  const spel = useMemo(() => {
    const fro = (Date.now() ^ (nr * 7919) ^ (omgang * 104729)) >>> 0
    if (iRunda) return skapaSpel(bana, { fro, ...spelVal(sparRef.current.runda, bana) })
    if (bana.bonus) return skapaSpel(bana, { fro, kulor: bana.kulor || 3 })
    if (!aventyr) return skapaSpel(bana, { fro, kulor: STARTKULOR })
    return skapaSpel(bana, { fro, kulor: STARTKULOR + hjalp.extra })
  }, [bana, omgang]) // eslint-disable-line react-hooks/exhaustive-deps
  const [editor, setEditor] = useState(null) // { data, id } när baneditorn är öppen
  const [, rendera] = useReducer((x) => x + 1, 0)
  const [vinst, setVinst] = useState(null)
  const [slut, setSlut] = useState(null)
  const [kort, setKort] = useState(null) // resultatkort för bonus, runda och egna banor
  const [karta, setKarta] = useState(false)
  const [hjalteVal, setHjalteVal] = useState(false)
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
      studs: new Map(),
      kulTopp: 0,
    }
  }

  // Ny bana eller nytt försök
  useEffect(() => {
    fx.tom()
    ljud.tystaMusik()
    setVinst(null)
    setSlut(null)
    setKort(null)
    setMastare(null)
    setIntro(true)
    const id = setTimeout(() => setIntro(false), 2800)
    const id2 = hjalp.extra > 0 ? setTimeout(() => visaNotis(`🔥 Vinstsvit ${sparRef.current.svit}: +${hjalp.extra} ${hjalp.extra === 1 ? 'kula' : 'kulor'}`, 2200), 2700) : 0
    if (lage.delad && omgang === 0) {
      rensaDelad()
      visaNotis(`🔗 Delad bana: ${bana.namn}`, 2400)
    }
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
    // för webbläsartesterna: bot() ger en vinkel som tänder många orange
    if (import.meta.env.DEV) window.__pinn = { spel, a: a.current, skjut: () => skjut(), sikta: (v) => spel.sikta(v), bot: () => botSkott(spel, { vinklar: 24 }), nr, lage, bana }
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
          fx.text(W / 2, e.orsak === 'hink' ? 520 : 200, e.orsak === 'lila' ? '🟣 EXTRA KULA!' : 'EXTRA KULA!', { storlek: 24, farg: '#86efac', liv: 1.3, stig: 40 })
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
        case 'studs': {
          // en studsare i flipperspelet
          s.studs.set(e.id, s.t)
          ljud.studs(e.kvar)
          fx.ring(e.x, e.y, '#ffffff', 26, 0.25, 3)
          break
        }
        case 'small': {
          // bomb, Storsmäll eller meteor
          const f = e.orsak === 'bomb' ? ['#ffd43b', '#ff7a1a', '#ffffff'] : e.orsak === 'meteor' ? ['#ffb020', '#ff5a1f', '#fff7d6'] : ['#c8ffd8', '#4dff8a', '#ffffff']
          ljud.small()
          fx.skaka(e.orsak === 'bomb' ? 7 : 5)
          fx.ring(e.x, e.y, f[1], e.radie, 0.45, 5)
          fx.sprut(e.x, e.y, f, 18, { fart: 220, liv: 0.5, form: 'gnista', storlek: 2.4 })
          break
        }
        case 'delning':
          ljud.nyKula()
          fx.text(e.x, e.y - 14, `×${e.nya.length + 1}`, { storlek: 15, farg: '#e0f2fe', liv: 0.7, stig: 20 })
          fx.ring(e.x, e.y, '#e0f2fe', 24, 0.3, 2.5)
          break
        case 'guldhink':
          fx.text(e.x, 500, `🏆 +${fmt(e.poang)}`, { storlek: 20, farg: '#fde047', liv: 1.4, stig: 40 })
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
          // rundans bank: det som är kvar (så att man inte kan börja om banan med full bank)
          if (iRunda && !bana.bonus) setSpar((sp) => (sp.runda ? { ...sp, runda: { ...sp.runda, kulor: spel.kulorKvar + 1 } } : sp))
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
    // nya kulor ur gröna (kulregnsbanorna och Kulregn): ett plopp och +n
    // i stället för en ruta per grön
    const nya = [...(e.nya || []), ...(e.regn || [])]
    for (const [x, y] of nya) fx.sprut(x, y, ['#ffffff', '#c8ffd8', '#4dff8a'], 5, { fart: 90, liv: 0.35, storlek: 2 })
    if (nya.length) fx.text(e.x, e.y - 14, `+${nya.length}`, { storlek: 15, farg: '#bbf7d0', liv: 0.8, stig: 24, studs: true })
    if ((bana.multi || 1) > 1) {
      ljud.nyKula()
      fx.ring(e.x, e.y, '#4dff8a', 34, 0.4, 3)
      s.smutsig = true
      return
    }
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
    s.kulTopp = 0
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
    if (!aventyr) return vinstAnnan(true)
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
    // en bonusbana kan inte förloras: slut på kulor = färdigt
    if (bana.bonus || lage.typ === 'egen') return vinstAnnan(false)
    ljud.forlust()
    if (iRunda) return rundaSlut()
    setSlut({ orangeKvar: v.orangeKvar })
  }

  // Resultat i alla lägen utom äventyret.
  function vinstAnnan(klar) {
    const s = a.current
    const poang = spel.poang
    const stilar = [...new Set(s.allaStilar)]
    if (iRunda) {
      const r = sparRef.current.runda
      const mynt = bana.bonus ? 10 : 5
      laggTillMynt(mynt)
      const total = r.poang + poang
      const bast = sparRef.current.rundaBast || { niva: 0, poang: 0 }
      setSpar((sp) => ({ ...sp, rundaBast: { niva: Math.max(bast.niva, r.niva), poang: Math.max(bast.poang, total) } }))
      if (total > bast.poang) skickaNiva(ID_OANDLIG, total)
      // efter en bonusbana: en skattkista med gratis uppgraderingar
      const kista = bana.bonus ? oppnaKista(r).fick : null
      setKort({ typ: 'runda', poang, klar, bonus: Boolean(bana.bonus), kulorKvar: spel.kulorKvar, val: bana.bonus ? [] : bonusVal(r), runda: r, mynt, stilar, rensat: spel.rensat, total, kista })
      return
    }
    if (bana.bonus) {
      const fore = sparRef.current.bonus?.[bana.id]?.basta || 0
      setSpar((sp) => ({ ...sp, bonus: { ...(sp.bonus || {}), [bana.id]: { basta: Math.max(fore, poang), klar: (sp.bonus?.[bana.id]?.klar || 0) + (klar ? 1 : 0) } } }))
      setKort({ typ: 'bonus', poang, fore, rekord: poang > fore, klar, rensat: spel.rensat, stilar, efter: lage.efter })
      return
    }
    if (lage.id) setSpar((sp) => ({ ...sp, egna: (sp.egna || []).map((e) => (e.id === lage.id ? { ...e, basta: Math.max(e.basta || 0, poang) } : e)) }))
    setKort({ typ: 'egen', poang, klar, stilar, rensat: spel.rensat })
  }

  // Oändligt läge: kulorna tog slut.
  function rundaSlut() {
    const r = sparRef.current.runda
    const total = r.poang + spel.poang
    const bast = sparRef.current.rundaBast || { niva: 0, poang: 0 }
    const rekord = total > bast.poang
    // rundan märks som slut (annars kunde man börja om banan med full bank);
    // köper man fortsättning lever den vidare
    setSpar((sp) => ({ ...sp, runda: { ...r, slut: true }, rundaBast: { niva: Math.max(bast.niva, r.niva), poang: Math.max(bast.poang, total) } }))
    if (rekord) skickaNiva(ID_OANDLIG, total)
    setKort({ typ: 'rundaSlut', total, niva: r.niva, klara: r.klara, rekord, fore: bast.poang, orangeKvar: spel.orangeKvar(), runda: r })
  }

  function fortsattRunda() {
    const k = kort
    if (!k || !betala(FORTSATT_PRIS)) return
    if (spel.fortsatt(3)) {
      setSpar((sp) => ({ ...sp, runda: { ...k.runda, kulor: 0, slut: false } }))
      const s = a.current
      s.vantarKort = null
      s.blockTill = s.t + 0.3
      s.sistaVarnad = false
      s.kulPuls = s.t
      ljud.extraKula()
      setKort(null)
    }
  }

  // Efter en bana i rundan: välj en bonus (eller bara vidare efter en bonusbana).
  function rundaVidare(id) {
    const k = kort
    if (!k) return
    let r = rundaKlar(k.runda, { poang: k.poang, kulorKvar: k.kulorKvar, bonus: k.bonus })
    for (const kid of k.kista || []) r = valjBonus(r, kid)
    if (id) r = valjBonus(r, id)
    setSpar((sp) => ({ ...sp, runda: r }))
    setKort(null)
    setOmgang((o) => o + 1)
  }

  // En ny runda börjar med att man väljer hjälte.
  function startaRunda(ny) {
    if (ny || !sparRef.current.runda || sparRef.current.runda.slut) {
      setKarta(false)
      setKort(null)
      setHjalteVal(true)
      return
    }
    setLage({ typ: 'oandlig' })
    setKarta(false)
    setVinst(null)
    setSlut(null)
    setKort(null)
    setOmgang((o) => o + 1)
  }

  function valjHjalte(id) {
    setSpar((sp) => ({ ...sp, runda: nyRunda(undefined, id) }))
    setHjalteVal(false)
    setLage({ typ: 'oandlig' })
    setKarta(false)
    setVinst(null)
    setSlut(null)
    setKort(null)
    setOmgang((o) => o + 1)
  }

  // Slå om valen (kostar ett omslag). Rundan sparas, så att samma val
  // kommer tillbaka om man laddar om.
  function slaOmVal() {
    const k = kort
    if (!k || !(k.runda.omslag > 0)) return
    const r = slaOm(k.runda)
    setSpar((sp) => ({ ...sp, runda: { ...sp.runda, omslag: r.omslag, slag: r.slag } }))
    setKort({ ...k, runda: r, val: bonusVal(r) })
    ljud.slant(true)
  }

  function startaBonus(k, efter = null) {
    setLage({ typ: 'bonus', id: BONUS[k].id, variant: 0, efter })
    setKarta(false)
    setVinst(null)
    setSlut(null)
    setKort(null)
    setOmgang((o) => o + 1)
  }

  function spelaEgen(data, id = null, delad = false) {
    setSpar((sp) => ({ ...sp, utkast: id ? sp.utkast : { data, id: null } }))
    setLage({ typ: 'egen', data, id, delad })
    setEditor(null)
    setKarta(false)
    setVinst(null)
    setSlut(null)
    setKort(null)
    setOmgang((o) => o + 1)
  }

  function sparaEgen(data, id) {
    const lista = sparRef.current.egna || []
    const finns = id && lista.find((e) => e.id === id)
    const nyId = finns ? id : `b${Date.now().toString(36)}`
    const namn = (data.namn || '').trim() || `Min bana ${lista.length + 1}`
    const post = { id: nyId, namn, data: { ...data, namn }, basta: finns?.basta || 0, andrad: Date.now() }
    const egna = finns ? lista.map((e) => (e.id === id ? post : e)) : [post, ...lista].slice(0, MAX_EGNA)
    setSpar((sp) => ({ ...sp, egna, utkast: null }))
    visaNotis(`💾 Sparad: ${namn}`, 1500)
    return nyId
  }

  async function delaEgen(data) {
    const url = `${window.location.origin}${window.location.pathname}?pbana=${koda(data)}#/rotspel/pinnbollen`
    try {
      if (navigator.share) {
        await navigator.share({ title: `Pinnbollen: ${data.namn || 'min bana'}`, text: 'Spela min bana i Pinnbollen!', url })
        return
      }
    } catch {
      /* avbrutet, prova urklipp */
    }
    try {
      await navigator.clipboard.writeText(url)
      visaNotis('🔗 Länken är kopierad', 1600)
    } catch {
      window.prompt('Kopiera länken:', url)
    }
  }

  function taBortEgen(id) {
    setSpar((sp) => ({ ...sp, egna: (sp.egna || []).filter((e) => e.id !== id) }))
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
    if (aventyr) setSpar(forlust(sparRef.current))
    setSlut(null)
    setKort(null)
    setOmgang((o) => o + 1)
  }

  function spelaIgen() {
    setVinst(null)
    setOmgang((o) => o + 1)
  }

  function nasta() {
    setVinst(null)
    // efter varje värld: en bonusbana
    if (nr % 5 === 0 && nr / 5 <= BONUS.length) {
      startaBonus(nr / 5 - 1, nr < ANTAL_BANOR ? nr + 1 : null)
      return
    }
    if (nr >= ANTAL_BANOR) {
      setKarta(true)
      setOmgang((o) => o + 1)
      return
    }
    setNr((n) => Math.min(ANTAL_BANOR, n + 1))
    setOmgang((o) => o + 1)
  }

  function tillAventyr(n) {
    setLage({ typ: 'aventyr' })
    setKort(null)
    setKarta(false)
    if (n) setNr(n)
    setOmgang((o) => o + 1)
  }

  function valjBana(n) {
    // Att lämna en påbörjad bana räknas som förlust (som att ge upp).
    if (aventyr && spel.skott > 0 && spel.lage !== 'klar' && !vinst) setSpar(forlust(sparRef.current))
    setKarta(false)
    setVinst(null)
    setSlut(null)
    setKort(null)
    setLage({ typ: 'aventyr' })
    if (n === nr) setOmgang((o) => o + 1)
    else setNr(n)
    if (!aventyr) setOmgang((o) => o + 1)
  }

  /* ---------------------------------------------------------------- styrning */

  const overlagg = karta || vinst || slut || kort || editor
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
    if (!karta && !editor && !fx.fryst()) {
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
      const st = o.kick ? s.studs.get(o.id) : null
      const studsK = st != null && t - st < 0.18 ? 1 - (t - st) / 0.18 : 0
      if (studsK) skal *= 1 + 0.25 * studsK
      if (o.form === 'cirkel') R.ritaPinne(ctx, o.wx, o.wy, o.r, o.farg, lit, skal, alfa)
      else R.ritaTegel(ctx, o, o.farg, lit, 1 + (skal - 1) * 0.35, alfa)
      if (o.kick && !o.borta) R.ritaStudsare(ctx, o, studsK, o.kickKvar / (o.kickAntal || 10))
      if (o.bomb && !o.lit && !o.borta) R.ritaBomb(ctx, o, t)
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

    if (!spel.feber) R.ritaHink(ctx, spel.hinkX, t, s.hinkGlod, spel.hinkBredd)
    R.ritaFack(ctx, s.fackUpp, spel.rensat, t, s.fackTraff)

    const typ = spel.eldNu ? 'eld' : spel.spokNu ? 'spok' : 'vanlig'
    for (const k of spel.kulor) R.ritaKula(ctx, k, s.spar.get(k.id) || [], typ)

    // i rundan sitter hjälten i kanonen
    R.ritaKanon(ctx, spel.vinkel, visaSikte, (iRunda && !bana.bonus && hjalte(runda.hjalte)?.ikon) || varld.ikon, t, spel.eldKvar > 0)
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
    if (spel.sparKvar > 99) chip('🔮 Siktet', '#bbf7d0')
    else if (spel.sparKvar > 0) chip(`🔮 Superspår ×${spel.sparKvar}`, '#bbf7d0')
    if (spel.eldKvar > 0 || spel.eldNu) chip('🔥 Eldboll', '#fdba74')
    if (spel.spokKvar > 0 || spel.spokNu) chip('👻 Spöksboll', '#ddd6fe')

    // kulräknaren när det är många kulor ute, med en ruta vid 10, 20, 30 …
    const n = spel.kulor.length
    if (n >= 3 && (spel.lage === 'skjuter' || spel.lage === 'feber')) {
      if (n > s.kulTopp) {
        const steg = Math.floor(n / 10) * 10
        if (steg >= 10 && steg > Math.floor(s.kulTopp / 10) * 10) {
          setMastare({ text: steg >= 50 ? `KULSTORM! ${steg} kulor` : steg >= 30 ? `KULREGN! ${steg} kulor` : `${steg} kulor!`, key: t, ms: 1500 })
          ljud.multi(Math.min(10, steg / 5))
        }
        s.kulTopp = n
        s.kulPulsN = t
      }
      const pk = Math.max(0, 1 - (t - (s.kulPulsN || 0)) / 0.25)
      ctx.save()
      ctx.translate(W - 30, 56)
      ctx.scale(1 + pk * 0.3, 1 + pk * 0.3)
      text(ctx, `×${n}`, 0, 0, 15 + Math.min(9, n / 5), n >= 30 ? '#fde047' : '#e0f2fe', 'center')
      ctx.restore()
    }

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
    if (aventyr && nr === 1 && spel.skott === 0 && siktar && !intro) {
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
  const rubrik = bana.bonus ? `⚡ ${bana.namn}` : iRunda ? `∞ ${runda.niva}. ${bana.namn}` : aventyr ? `${nr}. ${bana.namn}` : `✏️ ${bana.namn}`
  const underrubrik = bana.bonus
    ? lage.efter
      ? `Bonusbana efter ${VARLDAR[Math.max(0, Math.floor((lage.efter - 2) / 5))].namn}`
      : 'Bonusbana'
    : iRunda
      ? `Oändligt läge · ${fmt(runda.poang)} poäng`
      : aventyr
        ? `${varld.ikon} ${varld.namn}`
        : lage.delad
          ? 'Delad bana'
          : 'Egen bana'

  return (
    <div className="ds-rot pb-rot" style={{ '--h1': varld.himmel[0], '--h2': varld.himmel[1] }}>
      <div className="pb-spel" hidden={Boolean(editor)}>
      <header className="pb-topp">
        <button className="pb-kartknapp" onClick={() => setKarta(true)} aria-label="Alla banor">
          <span aria-hidden="true">☰</span>
        </button>
        <div className="pb-titel">
          <b>{rubrik}</b>
          <small>{underrubrik}</small>
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
          <div className={`pb-intro${bana.bonus ? ' bonus' : ''}`} key={`${nr}-${omgang}`} aria-live="polite">
            <div className="pb-intro-varld">
              {bana.bonus ? (
                '⚡ Bonusbana'
              ) : iRunda ? (
                `∞ ${hjalte(runda.hjalte)?.ikon || ''} Oändligt läge · ${runda.kulor} kulor`
              ) : lage.typ === 'egen' ? (
                lage.delad ? '🔗 Delad bana' : '✏️ Egen bana'
              ) : (
                <>
                  <Portratt varld={varld} liten /> {varld.namn}
                </>
              )}
            </div>
            <div className="pb-intro-namn">{iRunda ? `Bana ${runda.niva}: ${bana.namn}` : aventyr ? `Bana ${nr}: ${bana.namn}` : bana.namn}</div>
            <div className="pb-intro-mal">{bana.bonus ? bana.text : `Träffa alla ${antal} orange pinnar`}</div>
            <div className="pb-intro-kraft">
              <i aria-hidden="true" /> Grön pinne ger <b>{KRAFTER[bana.kraft].namn}</b>
              <small>{KRAFTER[bana.kraft].text}</small>
            </div>
          </div>
        )}
        {mastare && (
          <div className={`pb-mastare${mastare.text === 'EXTREME FEVER!' ? ' feber' : ''}`} key={mastare.key}>
            <Portratt varld={iRunda && hjalte(runda.hjalte) ? VARLDAR[hjalte(runda.hjalte).varld] : varld} />
            <div>
              <b>{mastare.text}</b>
              <small>{bana.bonus ? 'Bonusbana' : iRunda && hjalte(runda.hjalte) ? hjalte(runda.hjalte).namn : varld.mastare}</small>
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

      </div>

      {editor && (
        <BanEditor
          key={editor.nyckel}
          start={editor.data}
          onStang={(data) => {
            // osparat blir ett utkast som finns kvar under Bygg
            const sparad = editor.id && (sparRef.current.egna || []).find((e) => e.id === editor.id)
            const andrad = data.drag.length && (!sparad || JSON.stringify(sparad.data) !== JSON.stringify({ ...data, namn: sparad.namn }))
            setSpar((sp) => ({ ...sp, utkast: andrad ? { data, id: editor.id || null } : null }))
            setEditor(null)
            setKarta(true)
          }}
          onTesta={(data) => spelaEgen(data, editor.id)}
          onSpara={(data) => setEditor((e) => ({ ...e, id: sparaEgen(data, e.id) }))}
          onDela={delaEgen}
        />
      )}

      {karta && (
        <Meny
          spar={spar}
          nu={nr}
          lage={lage}
          flik={spar.flik || 'aventyr'}
          setFlik={(f) => setSpar((sp) => ({ ...sp, flik: f }))}
          varning={aventyr && spel.skott > 0 && !vinst && spel.lage !== 'klar' && (spar.svit || 0) >= 2}
          onValj={valjBana}
          onBonus={(k) => startaBonus(k)}
          onRunda={startaRunda}
          onBygg={(data, id) => {
            setKarta(false)
            setEditor({ data, id, nyckel: Date.now() })
          }}
          onSpelaEgen={(e) => spelaEgen(e.data, e.id)}
          onDela={(e) => delaEgen(e.data)}
          onTaBort={taBortEgen}
          onStang={() => setKarta(false)}
        />
      )}

      {kort && (
        <Resultat
          kort={kort}
          mynt={mynt}
          ljud={ljud}
          sparad={lage.typ === 'egen' && Boolean(lage.id)}
          onRundaVal={rundaVidare}
          onSlaOm={slaOmVal}
          onFortsattRunda={fortsattRunda}
          onNyRunda={() => startaRunda(true)}
          onMeny={(flik) => {
            setKort(null)
            if (flik) setSpar((sp) => ({ ...sp, flik }))
            setKarta(true)
          }}
          onIgen={igen}
          onVidare={() => tillAventyr(kort.efter)}
          onRedigera={() => {
            setKort(null)
            setEditor({ data: lage.data, id: lage.id, nyckel: Date.now() })
          }}
          onSpara={() => setLage((l) => ({ ...l, id: sparaEgen(l.data, l.id), delad: false }))}
        />
      )}

      {hjalteVal && <HjalteVal onValj={valjHjalte} onStang={() => (setHjalteVal(false), setKarta(true))} />}

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

const FLIKAR = [
  { id: 'aventyr', ikon: '🗺️', namn: 'Äventyr' },
  { id: 'oandlig', ikon: '∞', namn: 'Oändligt' },
  { id: 'bonus', ikon: '⚡', namn: 'Bonus' },
  { id: 'bygg', ikon: '✏️', namn: 'Bygg' },
]

function Meny({ spar, nu, lage, flik, setFlik, varning, onValj, onBonus, onRunda, onBygg, onSpelaEgen, onDela, onTaBort, onStang }) {
  return (
    <div className="ds-kort-bak pb-karta-bak" role="dialog" aria-modal="true" aria-label="Meny">
      <div className="pb-karta">
        <div className="pb-karta-topp">
          <div>
            <b>Pinnbollen</b>
            <small>Välj vad du vill spela</small>
          </div>
          <button className="pb-stang" onClick={onStang} aria-label="Stäng">
            ✕
          </button>
        </div>
        <div className="pb-flikar" role="tablist">
          {FLIKAR.map((f) => (
            <button key={f.id} role="tab" aria-selected={flik === f.id} className={flik === f.id ? 'pa' : ''} onClick={() => setFlik(f.id)}>
              <span aria-hidden="true">{f.ikon}</span>
              {f.namn}
            </button>
          ))}
        </div>
        {varning && <div className="pb-karta-varning">🔥 Byter du bana nu tappar du vinstsviten.</div>}
        {flik === 'aventyr' && <Aventyret spar={spar} nu={lage.typ === 'aventyr' ? nu : 0} onValj={onValj} onBonus={onBonus} />}
        {flik === 'oandlig' && <Oandligt spar={spar} onRunda={onRunda} />}
        {flik === 'bonus' && <Bonusbanor spar={spar} onBonus={onBonus} />}
        {flik === 'bygg' && <Bygget spar={spar} onBygg={onBygg} onSpelaEgen={onSpelaEgen} onDela={onDela} onTaBort={onTaBort} />}
      </div>
    </div>
  )
}

function Aventyret({ spar, nu, onValj, onBonus }) {
  const banor = spar.banor || {}
  const totalStj = Object.values(banor).reduce((t, b) => t + (b.stjarnor || 0), 0)
  const total = Object.values(banor).reduce((t, b) => t + (b.basta || 0), 0)
  return (
    <div className="pb-karta-lista">
      <div className="pb-flik-info">
        ★ {totalStj}/{ANTAL_BANOR * 3} · {fmt(total)} poäng
      </div>
      {VARLDAR.map((v, vi) => {
        const b = BONUS[vi]
        const bonusLast = !bonusOppen(vi, spar) && (spar.upplast || 1) <= (vi + 1) * 5
        return (
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
            {b && (
              <button className="pb-bonusrad" disabled={bonusLast} onClick={() => onBonus(vi)}>
                <span>⚡</span> Bonus: {b.namn}
                <small>{bonusLast ? '🔒 Klara världen' : spar.bonus?.[b.id] ? `Rekord ${fmt(spar.bonus[b.id].basta)}` : b.text}</small>
              </button>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Oandligt({ spar, onRunda }) {
  const r = spar.runda && !spar.runda.slut ? spar.runda : null
  const bast = spar.rundaBast || { niva: 0, poang: 0 }
  const [lista, setLista] = useState(null)
  useEffect(() => {
    let av = false
    fetch(`/api/scores/${ID_OANDLIG}`)
      .then((x) => (x.ok ? x.json() : null))
      .then((d) => !av && setLista(d?.entries || []))
      .catch(() => !av && setLista([]))
    return () => {
      av = true
    }
  }, [])
  return (
    <div className="pb-karta-lista">
      <div className="pb-oandlig">
        <div className="pb-oandlig-ikon" aria-hidden="true">
          ∞
        </div>
        <p>
          Välj en hjälte och bli starkare för varje bana. Efter varje bana väljer du en uppgradering, och de flesta går att ta igen och igen: hinken växer, gröna blir fler och kulan blir större. Rätt kombination låser upp en evolution. Var femte bana är en bonusbana med en skattkista. Banorna blir svårare hela tiden, och kulorna du har kvar följer med.
        </p>
        {r ? (
          <>
            <button className="ds-knapp ds-knapp-stor" onClick={() => onRunda(false)}>
              Fortsätt rundan
              <small>
                Bana {r.niva} · {r.kulor} kulor · {fmt(r.poang)} poäng
              </small>
            </button>
            <Build runda={r} />
            <button className="ds-knapp ds-knapp-sek" onClick={() => onRunda(true)}>
              Ny runda
            </button>
          </>
        ) : (
          <button className="ds-knapp ds-knapp-stor" onClick={() => onRunda(true)}>
            Starta en runda
          </button>
        )}
        <div className="pb-oandlig-rekord">
          <span>
            Längst: <b>bana {bast.niva || '–'}</b>
          </span>
          <span>
            Bäst: <b>{fmt(bast.poang)}</b>
          </span>
        </div>
      </div>
      <div className="pb-topplista">
        <b>Topplista</b>
        {lista == null ? (
          <small>Hämtar …</small>
        ) : lista.length ? (
          <ol>
            {lista.slice(0, 10).map((e, i) => (
              <li key={e.player}>
                <span>{i + 1}.</span> {e.player} <b>{fmt(e.score)}</b>
              </li>
            ))}
          </ol>
        ) : (
          <small>Ingen har spelat än — bli först!</small>
        )}
      </div>
    </div>
  )
}

function Bonusbanor({ spar, onBonus }) {
  const kort = (b, k) => {
    const oppen = bonusOppen(k, spar)
    const info = spar.bonus?.[b.id]
    const v = VARLDAR[b.varld ?? k % VARLDAR.length]
    const las = b.familj === 'kulregn' ? 'Öppnas med Kulregnet' : `Klara ${VARLDAR[k - 1]?.namn || 'förra världen'} i äventyret`
    return (
      <button key={b.id} className={`pb-bonuskort${b.familj ? ' kulregn' : ''}`} disabled={!oppen} onClick={() => onBonus(k)} style={{ '--h1': v.himmel[0], '--h2': v.himmel[1] }}>
        <b>
          {oppen ? b.ikon || '⚡' : '🔒'} {b.namn}
        </b>
        <small>{oppen ? b.text : las}</small>
        {info && <em>Rekord {fmt(info.basta)}</em>}
      </button>
    )
  }
  return (
    <div className="pb-karta-lista">
      <div className="pb-flik-info">Sikta rätt och se allt smälla. En ny bonusbana öppnas efter varje värld i äventyret.</div>
      <div className="pb-bonuslista">{BONUS.map((b, k) => (b.familj ? null : kort(b, k)))}</div>
      <div className="pb-flik-info pb-kulregn-rubrik">
        <b>🎱 Kulregn</b> Varje grön pinne ger fler kulor, tills hela planen är full. Öppnas samtidigt som Kulregnet.
      </div>
      <div className="pb-bonuslista">{BONUS.map((b, k) => (b.familj === 'kulregn' ? kort(b, k) : null))}</div>
    </div>
  )
}

function Bygget({ spar, onBygg, onSpelaEgen, onDela, onTaBort }) {
  const egna = spar.egna || []
  const [fraga, setFraga] = useState(null)
  const utkast = spar.utkast
  return (
    <div className="pb-karta-lista">
      <div className="pb-bygg-ny">
        {utkast?.data?.drag?.length > 0 && (
          <button className="ds-knapp ds-knapp-stor" onClick={() => onBygg(utkast.data, utkast.id)}>
            ✏️ Fortsätt rita
            <small>{utkast.data.namn || 'Ditt osparade utkast'}</small>
          </button>
        )}
        <button className={`ds-knapp ds-knapp-stor${utkast?.data?.drag?.length ? ' ds-knapp-sek' : ''}`} onClick={() => onBygg(null, null)}>
          ✏️ Rita en ny bana
        </button>
        <small>Rita prickar och streck — motorn gör en bana av det. Dela den med en länk.</small>
      </div>
      {egna.length > 0 && <div className="pb-flik-info">Mina banor</div>}
      {egna.map((e) => (
        <div key={e.id} className="pb-egen">
          <div>
            <b>{e.namn}</b>
            <small>{e.basta ? `Rekord ${fmt(e.basta)}` : 'Inte spelad än'}</small>
          </div>
          <button onClick={() => onSpelaEgen(e)} aria-label={`Spela ${e.namn}`}>
            ▶
          </button>
          <button onClick={() => onBygg(e.data, e.id)} aria-label={`Redigera ${e.namn}`}>
            ✏️
          </button>
          <button onClick={() => onDela(e)} aria-label={`Dela ${e.namn}`}>
            🔗
          </button>
          {fraga === e.id ? (
            <button className="farlig" onClick={() => (onTaBort(e.id), setFraga(null))}>
              Ta bort?
            </button>
          ) : (
            <button onClick={() => setFraga(e.id)} aria-label={`Ta bort ${e.namn}`}>
              🗑
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// Ett uppgraderingskort: ikon, namn, nivå och vad nästa nivå gör.
function UppgKort({ id, runda, disabled, onClick }) {
  const u = UPPGRADERINGAR[id]
  const n = runda.varig?.[id] || 0
  const evo = u.grad < 4 ? ingarI(id).filter((e) => !(runda.varig?.[e.id] > 0)) : []
  return (
    <button className={`pb-uppg grad-${u.grad}`} disabled={disabled} onClick={onClick}>
      <em>{u.grad === 4 ? '🌟 Evolution' : u.direkt ? GRADER[u.grad] : n ? `Nivå ${n} → ${n + 1}` : `Ny · ${GRADER[u.grad]}`}</em>
      <span aria-hidden="true">{u.ikon}</span>
      <b>{u.namn}</b>
      <small>{u.text(n + 1)}</small>
      {evo.length > 0 && (
        <i className="pb-uppg-evo">
          {evo.map((e) => `${e.ikon} ${e.namn}`).join(', ')}
        </i>
      )}
    </button>
  )
}

// Rundans build: hjälten och uppgraderingarna med nivåer.
function Build({ runda, rubrik }) {
  const h = hjalte(runda?.hjalte)
  const lista = runda ? build(runda) : []
  if (!h && !lista.length) return null
  return (
    <div className="pb-build" aria-label="Din build">
      {rubrik && <small>Din build</small>}
      <div>
        {h && (
          <span className="hjalte" title={h.namn}>
            {h.ikon}
          </span>
        )}
        {lista.map((u) => (
          <span key={u.id} className={`grad-${u.grad}`} title={u.namn}>
            {u.ikon}
            {!u.max || u.max > 1 ? <b>{u.n}</b> : null}
          </span>
        ))}
      </div>
    </div>
  )
}

// Hjältevalet när en ny runda börjar.
function HjalteVal({ onValj, onStang }) {
  return (
    <div className="ds-kort-bak" role="dialog" aria-modal="true" aria-label="Välj hjälte">
      <div className="ds-kort pb-hjaltar">
        <button className="pb-stang" onClick={onStang} aria-label="Stäng">
          ✕
        </button>
        <div className="ds-kort-titel">Välj hjälte</div>
        <div className="ds-kort-sub">Hjälten bestämmer vad gröna pinnar gör hela rundan</div>
        <div className="pb-hjalte-lista">
          {HJALTAR.map((h) => {
            const v = VARLDAR[h.varld]
            return (
              <button key={h.id} onClick={() => onValj(h.id)} style={{ '--h1': v.himmel[0], '--h2': v.himmel[1] }}>
                <Portratt varld={v} liten />
                <b>{h.namn}</b>
                <small>
                  Grön: <strong>{KRAFTER[h.kraft].namn}</strong>
                </small>
                <span className="pb-hjalte-start">
                  {Object.keys(h.start).map((id) => (
                    <i key={id}>
                      {UPPGRADERINGAR[id].ikon} {UPPGRADERINGAR[id].namn}
                    </i>
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Resultat({ kort, mynt, sparad, onRundaVal, onSlaOm, onFortsattRunda, onNyRunda, onMeny, onIgen, onVidare, onRedigera, onSpara }) {
  const [klar, setKlar] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setKlar(true), 500)
    return () => clearTimeout(id)
  }, [])
  const chips = (kort.stilar || []).map((x) => (
    <span key={x} className="stil">
      {x}
    </span>
  ))
  let titel
  let innehall
  if (kort.typ === 'runda') {
    titel = kort.bonus ? (kort.rensat ? 'Rent hus!' : 'Bonus!') : `Bana ${kort.runda.niva} klar!`
    innehall = (
      <>
        <div className="pb-tavla-poang">+{fmt(kort.poang)}</div>
        <div className="pb-tavla-chips">
          <span>
            Rundan <b>{fmt(kort.total)}</b>
          </span>
          <span>
            Kulor <b>{kort.bonus ? `${kort.runda.kulor} + 3` : `${kort.kulorKvar} + ${NYA_KULOR + (kort.runda.varig?.bank || 0)}`}</b>
          </span>
          <span>
            Mynt <b>+{kort.mynt}</b>
          </span>
          {chips}
        </div>
        {kort.bonus ? (
          <>
            {kort.kista?.length > 0 && (
              <div className="pb-kista">
                <div className="pb-kista-ikon" aria-hidden="true">
                  🎁
                </div>
                <div className="pb-val-rubrik">Skattkista! {kort.kista.length === 1 ? 'En uppgradering' : `${kort.kista.length} uppgraderingar`}</div>
                <div className="pb-kista-fick">
                  {kort.kista.map((id, i) => (
                    <span key={i} className={`grad-${UPPGRADERINGAR[id].grad}`} style={{ animationDelay: `${0.3 + i * 0.35}s` }}>
                      <i aria-hidden="true">{UPPGRADERINGAR[id].ikon}</i>
                      {UPPGRADERINGAR[id].namn}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button className="ds-knapp ds-knapp-stor" disabled={!klar} onClick={() => onRundaVal(null)}>
              Vidare till bana {kort.runda.niva + 1}
            </button>
          </>
        ) : (
          <>
            <Build runda={kort.runda} />
            <div className="pb-val-rubrik">Välj en uppgradering</div>
            <div className={`pb-val${kort.val.length > 3 ? ' fyra' : ''}`}>
              {kort.val.map((id) => (
                <UppgKort key={`${kort.runda.slag || 0}-${id}`} id={id} runda={kort.runda} disabled={!klar} onClick={() => onRundaVal(id)} />
              ))}
            </div>
            <button className="pb-litenknapp pb-omslag" disabled={!klar || !(kort.runda.omslag > 0)} onClick={onSlaOm}>
              🎲 Slå om <b>{kort.runda.omslag || 0}</b>
            </button>
          </>
        )}
      </>
    )
  } else if (kort.typ === 'rundaSlut') {
    titel = kort.orangeKvar <= 2 ? 'Så nära!' : 'Rundan är slut'
    innehall = (
      <>
        <div className="ds-kort-sub">
          Du kom till bana {kort.niva} · {kort.orangeKvar} orange kvar
        </div>
        <div className="pb-tavla-poang">
          {fmt(kort.total)}
          {kort.rekord && <em>Rekord!</em>}
        </div>
        {!kort.rekord && kort.fore > 0 && <div className="pb-tavla-total">Ditt bästa: {fmt(kort.fore)}</div>}
        <Build runda={kort.runda} rubrik />
        <button className="ds-knapp ds-knapp-stor ds-knapp-guld" disabled={!klar || mynt < FORTSATT_PRIS} onClick={onFortsattRunda}>
          <span>Fortsätt med 3 kulor</span>
          <span className="ds-knapp-pris">
            <Mynt /> {FORTSATT_PRIS}
          </span>
        </button>
        <div className="pb-tavla-knappar">
          <button className="pb-litenknapp" disabled={!klar} onClick={onNyRunda}>
            ∞ Ny runda
          </button>
          <button className="pb-litenknapp" disabled={!klar} onClick={() => onMeny('oandlig')}>
            ☰ Menyn
          </button>
        </div>
      </>
    )
  } else if (kort.typ === 'bonus') {
    titel = kort.rensat ? 'Rent hus!' : kort.klar ? 'Bonus!' : 'Bonusbanan klar'
    innehall = (
      <>
        <div className="pb-tavla-poang">
          {fmt(kort.poang)}
          {kort.rekord && kort.fore > 0 && <em>Rekord!</em>}
        </div>
        <div className="pb-tavla-chips">{chips}</div>
        {kort.fore > 0 && !kort.rekord && <div className="pb-tavla-total">Rekord här: {fmt(kort.fore)}</div>}
        {kort.efter ? (
          <button className="ds-knapp ds-knapp-stor" disabled={!klar} onClick={onVidare}>
            Vidare till bana {kort.efter}
          </button>
        ) : (
          <button className="ds-knapp ds-knapp-stor" disabled={!klar} onClick={() => onMeny('bonus')}>
            Fler bonusbanor
          </button>
        )}
        <div className="pb-tavla-knappar">
          <button className="pb-litenknapp" disabled={!klar} onClick={onIgen}>
            ↻ Spela igen
          </button>
        </div>
      </>
    )
  } else {
    titel = kort.rensat ? 'Rent hus!' : kort.klar ? 'Klarad!' : 'Slut på kulor'
    innehall = (
      <>
        <div className="pb-tavla-poang">{fmt(kort.poang)}</div>
        <div className="pb-tavla-chips">{chips}</div>
        <button className="ds-knapp ds-knapp-stor" disabled={!klar} onClick={onIgen}>
          ↻ {kort.klar ? 'Spela igen' : 'Försök igen'}
        </button>
        <div className="pb-tavla-knappar">
          <button className="pb-litenknapp" disabled={!klar} onClick={onRedigera}>
            ✏️ Redigera
          </button>
          {!sparad && (
            <button className="pb-litenknapp" disabled={!klar} onClick={onSpara}>
              💾 Spara
            </button>
          )}
          <button className="pb-litenknapp" disabled={!klar} onClick={() => onMeny('bygg')}>
            ☰ Menyn
          </button>
        </div>
      </>
    )
  }
  return (
    <div className="ds-kort-bak" role="dialog" aria-modal="true">
      <div className={`ds-kort pb-resultat ${kort.typ}`}>
        <div className="ds-kort-titel">{titel}</div>
        <div className="pb-tavla">{innehall}</div>
      </div>
    </div>
  )
}
