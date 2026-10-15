import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { genereraBana, avkoda, skapaSpel, FARGER, HAL_PER_LADA, RESERV, SKRUV_R, KOL, RAD, PX, PY } from './engine.js'
import BANOR from './banor.json'
import { useSpelyta } from '../delat/useSpelyta.js'
import { skapaLjud } from '../delat/ljud.js'
import { skapaFx, rundRekt, ljusare, easeOut, easeInOut, easeOutBack, lerp } from '../delat/fx.js'
import { useSpar, useMynt, belona, forlust, betala, svitHjalp } from '../delat/meta.js'
import { Topprad, BoostKnapp, Banner, Vinstkort, Forlustkort, Notis, useNotis, SvitChip } from '../delat/Ui.jsx'
import './skruv.css'

// Skruvat — Screw Jam i Rötspel.
//
// Tryck på en skruv som inte har någon platta över sig. Den flyger till
// lådan med samma färg, annars till ett reservhål. Fulla reservhål = slut.
// Lådkön syns uppe till höger: gräv där färgerna som kommer snart sitter.
//
// Känslan: skruven snurrar upp ur hålet med gängorna synliga (spärrklick),
// flyger i en båge till lådan som studsar till, full låda slår igen locket
// och flyger iväg, plattor faller och tumlar, och skruvar som just blev fria
// poppar till så man ser vad grävandet gav.

const ID = 'skruvat'
const W = 360
const H = 600
const LADA_Y = 50
const LADA_H = 58
const RES_Y = 124
const RES_STEG = 42
const KO_X = 276
const MAX_EXTRA = 2
const START = { niva: 1, basta: 0, svit: 0, kista: 0, boost: { hal: 1, magnet: 1, angra: 2 } }
const BOOST = {
  angra: { ikon: '↶', namn: 'Ångra', pris: 50 },
  hal: { ikon: '🔩', namn: '+1 hål', pris: 80 },
  magnet: { ikon: '🧲', namn: 'Magnet', pris: 120 },
}
const FORTSATT_PRIS = 80

const farg = (f) => FARGER[f]?.hex ?? '#888'

function hamtaBana(niva) {
  if (niva <= BANOR.length) return avkoda(niva, BANOR[niva - 1])
  return genereraBana(niva)
}

// Lådornas placering beror på hur många som står framme.
function ladGeo(antal) {
  if (antal === 1) return { x: [132], b: 176 }
  return { x: [74, 196], b: 116 }
}

export default function SkruvGame() {
  const [spar, setSpar, sparRef] = useSpar('skruvat-v1', START)
  const mynt = useMynt()
  const ljud = useMemo(() => skapaLjud(), [])
  useEffect(() => () => ljud.stang(), [ljud])
  const fx = useMemo(() => skapaFx(), [])

  const [aktivNiva, setAktivNiva] = useState(spar.niva)
  const [omgang, setOmgang] = useState(0)
  const bana = useMemo(() => hamtaBana(aktivNiva), [aktivNiva])
  // Vinstsvitens hjälp: extra reservhål från start (tappas vid förlust).
  const hjalp = useMemo(() => svitHjalp(spar.svit || 0), [omgang, aktivNiva]) // eslint-disable-line react-hooks/exhaustive-deps
  const spel = useMemo(() => {
    const s = skapaSpel(bana)
    for (let i = 0; i < hjalp.extra; i++) s.extraHal()
    return s
  }, [bana, omgang]) // eslint-disable-line react-hooks/exhaustive-deps
  const [, rendera] = useReducer((x) => x + 1, 0)
  const [vinst, setVinst] = useState(null)
  const [slut, setSlut] = useState(null) // null | 'reserv' | 'bomb'
  const [notis, visaNotis] = useNotis()
  const geo = ladGeo(spel.aktiva.length)
  const halDX = [-geo.b * 0.28, 0, geo.b * 0.28]

  const a = useRef(null)
  if (!a.current || a.current.spel !== spel) {
    a.current = nyttLage(spel)
    a.current.historik = []
    a.current.hjalpVisad = false
  }

  function nyttLage(sp) {
    return {
      spel: sp,
      t: 0,
      slots: sp.aktiva.map((l, s) => ({ lador: l ? [{ serie: l.serie, f: l.f, hal: new Array(l.fyllda).fill(l.f), fas: 'in', t: -0.12 * s }] : [] })),
      // lossade skruvar på väg någonstans, och de som sitter i reserven
      skruvar: sp.reserv.map((x, p) => (x ? { id: x.id, f: x.f, x: 0, y: RES_Y, x0: 0, y0: RES_Y, mal: { typ: 'reserv', plats: p }, fas: 'reserv', t: 0, rot: 0, spar: [] } : null)).filter(Boolean),
      fallande: [],
      pop: new Map(), // skruv -> starttid (blev just fri)
      vicka: new Map(), // skruv -> starttid (låst skruv vickar)
      svaj: new Map(), // platta -> starttid (en skruv kvar)
      studs: new Map(), // slot -> starttid (låda tog emot)
      kombo: 0,
      bastaKombo: 0,
      ladaKedja: 0,
      senastLada: -10,
      klar: false,
      firat: false,
      slutVantar: false,
      anvandeReserv: false,
      historik: [],
    }
  }

  useEffect(() => {
    fx.tom()
    setVinst(null)
    setSlut(null)
  }, [spel, fx])

  // Svithjälpen visas en gång när banan startar.
  useEffect(() => {
    if (hjalp.extra > 0 && !a.current.hjalpVisad) {
      const id = setTimeout(() => {
        a.current.hjalpVisad = true
        visaNotis(`🔥 Vinstsvit ${spar.svit}: +${hjalp.extra} reservhål`, 2200)
      }, bana.svar !== 'normal' ? 2400 : 400)
      return () => clearTimeout(id)
    }
  }, [spel]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (import.meta.env.DEV) window.__skruv = { spel, bana, tryck: (id) => tryckSkruv(id), lage: () => a.current }
  })

  const antalRes = spel.reserv.length
  const resX = (p) => W / 2 + (p - (antalRes - 1) / 2) * RES_STEG
  const halPos = (slot, hal) => [geo.x[slot] + halDX[hal], LADA_Y + 6]

  /* ---------------------------------------------------------------- logik -> bild */

  function hantera(res, fordrojning = 0) {
    const s = a.current
    res.losta.forEach((l, k) => {
      const sk = spel.skruvar[l.id]
      const sprite = { id: l.id, f: l.f, x: sk.x, y: sk.y, x0: sk.x, y0: sk.y, mal: l.mal, fas: 'skruva', t: -fordrojning - k * 0.06, rot: 0, spar: [] }
      s.skruvar.push(sprite)
      if (l.mal.typ === 'lada') {
        s.kombo++
        s.bastaKombo = Math.max(s.bastaKombo, s.kombo)
      } else {
        s.kombo = 0
        s.anvandeReserv = true
      }
      if (l.foll != null) {
        const p = spel.plattor[l.foll]
        const g = p.geo
        const cx = g.r != null ? g.cx : (g.x0 + g.x1) / 2
        // tippar åt det håll sista skruven satt
        const sida = sk.x < cx ? 1 : -1
        s.fallande.push({ p, t: -fordrojning - 0.2, dx: 0, dy: 0, vx: sida * (40 + Math.random() * 60), vy: -60, rot: 0, vr: sida * (2 + Math.random() * 3), studsat: false })
        s.svaj.delete(p.id)
      } else {
        // plattor med en skruv kvar börjar svaja
        const pl = spel.plattor[sk.platta]
        if (pl.kvar && pl.skruvar.filter((x) => spel.skruvar[x].kvar).length === 1) s.svaj.set(pl.id, s.t)
      }
    })
    // skruvar som just blev fria poppar till (efter att plattan fallit)
    res.nyaFria.forEach((id, k) => s.pop.set(id, s.t + 0.32 + fordrojning + k * 0.05))
    if (res.nyaFria.length) {
      setTimeout(() => {
        res.nyaFria.slice(0, 6).forEach((_, k) => ljud.ton(1318 * Math.pow(1.12, k), 0.09, 'sine', 0.045, k * 0.05))
      }, 320 + fordrojning * 1000)
    }

    for (const e of res.handelser) {
      if (e.typ === 'spricka' || e.typ === 'tinat') {
        const k2 = spel.skruvar[e.id]
        fx.sprut(k2.x, k2.y, ['#bfe9ff', '#ffffff', '#7fd3ff'], e.typ === 'tinat' ? 20 : 6, { fart: e.typ === 'tinat' ? 180 : 80, liv: 0.45, storlek: 2.8 })
        if (e.typ === 'tinat') {
          fx.ring(k2.x, k2.y, '#bfe9ff', 28, 0.4, 3)
          ljud.brus(0.14, 0.1, 6000, 0, 10000, 2)
          ljud.ton(1318, 0.12, 'triangle', 0.08, 0.03)
          s.pop.set(e.id, s.t + 0.05)
        } else ljud.brus(0.05, 0.05, 5000, 0, 8000, 2)
      } else if (e.typ === 'upplast') {
        for (const id of e.ids) {
          const k2 = spel.skruvar[id]
          fx.sprut(k2.x, k2.y, ['#ffd43b', '#fff6c8'], 12, { fart: 140, form: 'stjarna', liv: 0.6, gravitation: 0 })
          s.pop.set(id, s.t + 0.15)
        }
        ljud.ton(988, 0.1, 'square', 0.05)
        ljud.ton(1318, 0.18, 'triangle', 0.08, 0.08)
        visaNotis('🔓 Låsen öppnade!', 1300)
      } else if (e.typ === 'bomb') {
        if (e.kvar <= 3 && e.kvar > 0) ljud.varning()
        if (e.kvar === 0) {
          const k2 = spel.skruvar[e.id]
          fx.sprut(k2.x, k2.y, ['#ff5a1f', '#ffd43b', '#3a2a20', '#ffffff'], 60, { fart: 320, liv: 0.9, storlek: 4 })
          fx.ring(k2.x, k2.y, '#ff9f43', 120, 0.6, 8)
          fx.skaka(14)
          fx.hitstop(160)
          ljud.ton(70, 0.6, 'sawtooth', 0.2, 0, 35)
          ljud.brus(0.9, 0.25, 400, 0, 80, 0.6)
        }
      } else if (e.typ === 'ladaKlar') {
        const b = s.slots[e.slot].lador.find((l) => l.serie === e.serie)
        if (b) b.klarLogik = true
      } else if (e.typ === 'nyLada') {
        s.slots[e.slot].lador.push({ serie: e.serie, f: e.f, hal: [], fas: 'vantar', t: 0 })
      } else if (e.typ === 'flytt') {
        const sp = s.skruvar.find((x) => x.id === e.skruv)
        if (sp) sp.nyMal = { typ: 'lada', slot: e.slot, serie: e.serie, hal: e.hal }
      }
    }
    if (res.vunnit) s.klar = true
    if (res.forlorat) {
      s.klar = true
      s.slutVantar = res.orsak || 'reserv'
    }
  }

  function tryckSkruv(id) {
    const s = a.current
    if (s.klar || vinst || slut) return
    const fore = spel.spara()
    const res = spel.tryck(id)
    if (!res) return
    if (res.typ === 'last') {
      s.vicka.set(id, s.t)
      ljud.dunk()
      return
    }
    if (res.typ === 'is') {
      s.vicka.set(id, s.t)
      ljud.brus(0.1, 0.08, 5000, 0, 9000, 2)
      ljud.ton(1760, 0.06, 'sine', 0.05)
      visaNotis(`Isen smälter efter ${res.kvar} ${res.kvar === 1 ? 'skruv' : 'skruvar'} till`, 1500)
      return
    }
    if (res.typ === 'lasad') {
      s.vicka.set(id, s.t)
      ljud.ton(220, 0.08, 'square', 0.06)
      ljud.ton(196, 0.1, 'square', 0.05, 0.06)
      visaNotis('🔒 Låst — lossa nyckelskruven först', 1600)
      return
    }
    if (res.typ === 'rep') {
      s.vicka.set(id, s.t)
      s.vicka.set(res.partner, s.t)
      ljud.dunk()
      visaNotis('Repet: båda skruvarna måste vara fria', 1600)
      return
    }
    s.historik.push(fore)
    if (s.historik.length > 30) s.historik.shift()
    // spärrklick: tre snabba tick, uppåt i tonhöjd
    for (let k = 0; k < 3; k++) ljud.ton(1150 + k * 160 + Math.random() * 60, 0.03, 'square', 0.035, k * 0.06)
    ljud.brus(0.16, 0.035, 3500, 0, 7000, 3)
    hantera(res)
    rendera()
  }

  function ner({ x, y }) {
    let bast = null
    for (const k of spel.skruvar) {
      if (!k.kvar) continue
      const d = Math.hypot(k.x - x, k.y - y)
      if (d > 21) continue
      const fri = !spel.blockerad(k.id)
      const z = spel.plattor[k.platta].z
      const p = (fri ? 1000 : 0) + z * 10 - d
      if (!bast || p > bast.p) bast = { id: k.id, p }
    }
    if (bast) tryckSkruv(bast.id)
  }

  /* ---------------------------------------------------------------- boosters */

  function anvand(typ, fn) {
    const sp = sparRef.current
    if ((sp.boost[typ] || 0) > 0) setSpar((x) => ({ ...x, boost: { ...x.boost, [typ]: x.boost[typ] - 1 } }))
    else if (!betala(BOOST[typ].pris)) {
      visaNotis('För lite mynt')
      return
    }
    ljud.booster()
    fn()
  }

  function extraHal() {
    if (a.current.klar) return
    if (spel.reserv.length >= RESERV + MAX_EXTRA + hjalp.extra) {
      visaNotis('Redan max antal hål')
      return
    }
    anvand('hal', () => {
      spel.extraHal()
      fx.text(W / 2, RES_Y - 16, '+1 hål', { farg: '#7dffb0', storlek: 20 })
      rendera()
    })
  }

  function magnet() {
    if (a.current.klar) return
    const kan = spel.skruvar.some((k) => spel.kanLossa(k.id) && k.rep == null && !(k.bomb > 0) && spel.aktiva.some((l) => l && l.f === k.f && l.fyllda < HAL_PER_LADA))
    if (!kan) {
      visaNotis('Inget för magneten att ta just nu')
      return
    }
    anvand('magnet', () => {
      a.current.historik.push(spel.spara())
      const lista = spel.magnet(9)
      lista.forEach((res, i) => {
        hantera(res, i * 0.09)
        setTimeout(() => ljud.pop(5 + i, 0.1), i * 90)
      })
      fx.skaka(4)
      rendera()
    })
  }

  // Ångra: tillbaka ett drag. Motorn laddar ögonblicksbilden, bilden byggs om.
  function angra() {
    const s = a.current
    if (s.klar || !s.historik.length) {
      if (!s.historik.length) visaNotis('Inget att ångra')
      return
    }
    if (s.skruvar.some((sp) => sp.fas !== 'reserv') || s.fallande.some((f) => f.t < 0.3)) return
    anvand('angra', () => {
      const st = s.historik.pop()
      spel.ladda(st)
      const ny = nyttLage(spel)
      ny.historik = s.historik
      ny.hjalpVisad = true
      ny.t = s.t
      ny.slots.forEach((sl) => sl.lador.forEach((l) => (l.fas = 'star')))
      a.current = ny
      fx.tom()
      fx.text(W / 2, H / 2, '↶', { farg: '#ffffff', storlek: 46, liv: 0.6 })
      ljud.swisch(2)
      rendera()
    })
  }

  /* ---------------------------------------------------------------- vinst/förlust */

  const vinstTimer = useRef(0)
  useEffect(() => () => clearTimeout(vinstTimer.current), [])
  function vinna(fordrojning = 0) {
    const s = a.current
    const res = belona(sparRef.current, {
      gameId: ID,
      niva: aktivNiva,
      svar: bana.svar,
      perfekt: !s.anvandeReserv,
      extra: Math.floor(s.bastaKombo / 2),
      boostTyper: Object.keys(BOOST),
    })
    setSpar(res.spar)
    const visa = { ...res.resultat, bastaKombo: s.bastaKombo }
    vinstTimer.current = setTimeout(() => setVinst(visa), fordrojning)
  }
  function nasta() {
    setAktivNiva(sparRef.current.niva)
    setOmgang((o) => o + 1)
  }
  function forsokIgen() {
    setSpar((s) => forlust(s))
    setOmgang((o) => o + 1)
  }
  function fortsatt() {
    if (!betala(FORTSATT_PRIS)) return
    spel.extraHal()
    a.current.klar = false
    a.current.slutVantar = false
    setSlut(null)
    ljud.booster()
    rendera()
  }

  /* ---------------------------------------------------------------- uppdatera */

  function ladaRedo(slot, serie) {
    const b = a.current.slots[slot].lador[0]
    return b && b.serie === serie && b.fas === 'star' && antal(b) < HAL_PER_LADA
  }

  function uppdatera(dt) {
    const s = a.current
    fx.uppdatera(dt)
    if (fx.fryst()) return
    s.t += dt

    // lådorna — står många skruvar och väntar på sin låda byts de fortare
    const vantar = s.skruvar.filter((sp) => sp.fas === 'vanta').length
    const brad = vantar > 3 ? 2 : 1
    for (let slot = 0; slot < s.slots.length; slot++) {
      const st = s.slots[slot]
      const b = st.lador[0]
      if (!b) continue
      b.t += dt * brad
      if (b.fas === 'vantar') {
        b.fas = 'in'
        b.t = 0
        ljud.brus(0.2, 0.05, 900, 0, 400)
      }
      if (b.fas === 'in' && b.t >= 0.36) {
        b.fas = 'star'
        b.t = 0
      }
      if (b.fas === 'star' && antal(b) >= HAL_PER_LADA && !s.skruvar.some((sp) => sp.fas === 'flyg' && sp.mal.typ === 'lada' && sp.mal.slot === slot && sp.mal.serie === b.serie)) {
        b.fas = 'stang'
        b.t = 0
        const kedja = s.t - s.senastLada < 1.6 ? s.ladaKedja + 1 : 1
        s.ladaKedja = kedja
        s.senastLada = s.t
        const k = Math.min(kedja, 8)
        ljud.ton(523.25 * Math.pow(1.122, k), 0.12, 'triangle', 0.12)
        ljud.ton(659.25 * Math.pow(1.122, k), 0.14, 'triangle', 0.1, 0.06)
        ljud.ton(784 * Math.pow(1.122, k), 0.24, 'triangle', 0.1, 0.12)
        ljud.ton(140, 0.12, 'sine', 0.2)
      }
      if (b.fas === 'stang' && b.t >= 0.26) {
        b.fas = 'ut'
        b.t = 0
        const kedja = s.ladaKedja
        fx.sprut(geo.x[slot], LADA_Y, [farg(b.f), '#ffffff', '#ffd43b'], 26, { fart: 240, form: 'stjarna', liv: 0.7 })
        fx.ring(geo.x[slot], LADA_Y, farg(b.f), 80, 0.45, 4)
        if (kedja >= 2) fx.text(geo.x[slot], LADA_Y + 52, kedja === 2 ? 'Dubbel!' : kedja === 3 ? 'Trippel!' : `x${kedja}!`, { farg: '#fff', storlek: 22, liv: 0.9, stig: 22 })
        if (kedja >= 3) fx.skaka(3)
        ljud.swisch(2)
      }
      if (b.fas === 'ut' && b.t >= 0.34) {
        st.lador.shift()
        if (st.lador[0]) {
          st.lador[0].fas = 'in'
          st.lador[0].t = 0
        }
      }
    }

    // lossade skruvar
    for (const sp of s.skruvar) {
      sp.t += dt
      if (sp.t < 0) continue
      if (sp.fas === 'reserv') {
        sp.x = resX(sp.mal.plats)
        sp.y = RES_Y
      }
      if (sp.fas === 'skruva') {
        sp.rot += dt * 34
        if (sp.t >= 0.24) {
          sp.fas = 'vanta'
          sp.t = 0
        }
      }
      if (sp.fas === 'vanta' || sp.fas === 'reserv') {
        const mal = sp.fas === 'reserv' && sp.nyMal ? sp.nyMal : sp.mal
        const kan = mal.typ === 'reserv' ? sp.fas === 'vanta' : ladaRedo(mal.slot, mal.serie)
        if (kan) {
          const franY = sp.fas === 'vanta' ? sp.y0 - 12 : sp.y
          if (sp.fas === 'reserv') sp.mal = sp.nyMal
          sp.fas = 'flyg'
          sp.t = 0
          sp.fx0 = sp.x
          sp.fy0 = franY
          const [tx, ty] = sp.mal.typ === 'lada' ? halPos(sp.mal.slot, sp.mal.hal) : [resX(sp.mal.plats), RES_Y]
          sp.tx = tx
          sp.ty = ty
          sp.dur = 0.24 + Math.hypot(tx - sp.x, ty - franY) / 1400
        } else if (sp.fas === 'vanta') {
          sp.x = sp.x0
          sp.y = sp.y0 - 12 + Math.sin(s.t * 8 + sp.id) * 1.5
        }
      }
      if (sp.fas === 'flyg') {
        const k = Math.min(1, sp.t / sp.dur)
        const e = easeInOut(k)
        const kx = (sp.fx0 + sp.tx) / 2
        const ky = Math.min(sp.fy0, sp.ty) - 60
        sp.x = (1 - e) * (1 - e) * sp.fx0 + 2 * (1 - e) * e * kx + e * e * sp.tx
        sp.y = (1 - e) * (1 - e) * sp.fy0 + 2 * (1 - e) * e * ky + e * e * sp.ty
        sp.rot += dt * 22
        sp.spar.push([sp.x, sp.y])
        if (sp.spar.length > 6) sp.spar.shift()
        if (k >= 1) {
          sp.spar = []
          if (sp.mal.typ === 'lada') {
            const b = s.slots[sp.mal.slot].lador[0]
            if (b && b.serie === sp.mal.serie) b.hal[sp.mal.hal] = sp.f
            sp.fas = 'klar'
            s.studs.set(sp.mal.slot, s.t)
            const n = b ? antal(b) : 1
            ljud.ton(1046 * Math.pow(1.122, Math.min(s.kombo, 10)) * (1 + n * 0.06), 0.07, 'triangle', 0.09)
            ljud.ton(180, 0.06, 'sine', 0.14)
            fx.sprut(sp.tx, sp.ty, [farg(sp.f), '#fff'], 8, { fart: 90, liv: 0.32, storlek: 2.2 })
            if (s.kombo >= 3 && sp.mal.hal === 2) fx.text(sp.tx, sp.ty + 40, `x${s.kombo}`, { farg: '#ffe066', storlek: 17, liv: 0.6, stig: 18 })
          } else {
            sp.fas = 'reserv'
            sp.x = sp.tx
            sp.y = sp.ty
            ljud.ton(262, 0.09, 'triangle', 0.1)
            ljud.ton(120, 0.08, 'sine', 0.12)
          }
        }
      }
    }
    s.skruvar = s.skruvar.filter((sp) => sp.fas !== 'klar')

    // fallande plattor: tumlar, studsar en gång mot botten, ut ur bild
    for (const f of s.fallande) {
      f.t += dt
      if (f.t < 0) continue
      if (!f.ljud) {
        f.ljud = true
        ljud.dunk()
        ljud.brus(0.25, 0.08, 700, 0, 250, 1.2)
        fx.skaka(2)
      }
      f.vy += 1500 * dt
      f.dx += f.vx * dt
      f.dy += f.vy * dt
      f.rot += f.vr * dt
    }
    s.fallande = s.fallande.filter((f) => f.dy < H + 260)

    // varning när reservhålen nästan är fulla
    const fyllda = spel.reserv.filter(Boolean).length
    if (fyllda >= spel.reserv.length - 1 && !s.klar) ljud.varning()

    if (s.slutVantar && !s.skruvar.some((sp) => sp.fas !== 'reserv')) {
      const orsak = s.slutVantar
      s.slutVantar = false
      fx.skaka(7)
      ljud.forlust()
      setTimeout(() => setSlut(orsak), 380)
    }

    if (spel.status() === 'vunnit' && !s.firat && !s.skruvar.length && s.slots.every((st) => !st.lador.length)) {
      s.firat = true
      fx.konfetti(W / 2, H * 0.6, 110, W)
      ljud.vinst()
      vinna(900)
    }
  }

  /* ---------------------------------------------------------------- ritning */

  function rita(ctx) {
    const s = a.current
    const t = s.t
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    ctx.translate(fx.skakX(), fx.skakY())

    ritaLador(ctx, t)
    ritaReserv(ctx, t)

    // brädet: en perforerad metallskiva
    const grad = ctx.createLinearGradient(0, 148, 0, H)
    grad.addColorStop(0, '#273150')
    grad.addColorStop(1, '#1b2238')
    ctx.fillStyle = grad
    rundRekt(ctx, 8, 150, W - 16, H - 156, 18)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = 'rgba(6, 9, 20, 0.45)'
    for (let j = 0; j < RAD; j++) for (let i = 0; i < KOL; i++) {
      ctx.beginPath()
      ctx.arc(PX(i), PY(j), 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // plattor från botten och upp, varje plattas skruvar direkt efter den
    const ordning = spel.plattor.filter((p) => p.kvar).sort((p, q) => p.z - q.z)
    for (const p of ordning) ritaPlatta(ctx, p, t)

    for (const f of s.fallande) {
      if (f.t < 0) {
        ritaPlatta(ctx, f.p, t, { x: 0, y: 0, rot: 0, alfa: 1, utanSkruvar: true })
        continue
      }
      ritaPlatta(ctx, f.p, t, { x: f.dx, y: f.dy, rot: f.rot, alfa: Math.max(0, 1 - f.t / 1.1), utanSkruvar: true })
    }

    // rep mellan bundna skruvar
    for (const k of spel.skruvar) {
      if (!k.kvar || k.rep == null || k.rep < k.id) continue
      const b = spel.skruvar[k.rep]
      if (!b.kvar) continue
      ritaRep(ctx, k.x, k.y, b.x, b.y, t)
    }

    // bomber syns alltid, även under plattor — det är ju dem man måste hinna fram till
    for (const k of spel.skruvar) if (k.kvar && k.bomb > 0) ritaBomb(ctx, k.x, k.y, k.bomb, t, spel.blockerad(k.id))

    // lossade skruvar överst
    for (const sp of s.skruvar) {
      if (sp.t < 0) {
        ritaSkruv(ctx, sp.x, sp.y, sp.f, 0, 1)
        continue
      }
      let skal = 1
      let y = sp.y
      let skaft = 0
      if (sp.fas === 'skruva') {
        const k = sp.t / 0.24
        skal = 1 + easeOut(k) * 0.28
        y = sp.y0 - easeOut(k) * 12
        skaft = easeOut(k) * 15
      } else if (sp.fas === 'vanta') {
        skal = 1.28
        skaft = 15
      } else if (sp.fas === 'flyg') {
        const k = sp.t / sp.dur
        skal = lerp(1.28, sp.mal.typ === 'lada' ? 0.84 : 0.95, k)
        skaft = 15 * (1 - k)
        // svans
        sp.spar.forEach(([x, yy], i) => {
          ctx.globalAlpha = ((i + 1) / sp.spar.length) * 0.35
          ctx.fillStyle = farg(sp.f)
          ctx.beginPath()
          ctx.arc(x, yy, SKRUV_R * skal * 0.7 * ((i + 1) / sp.spar.length), 0, Math.PI * 2)
          ctx.fill()
        })
        ctx.globalAlpha = 1
      } else if (sp.fas === 'reserv') {
        skal = 0.95
      }
      if (skaft > 0.5) ritaSkaft(ctx, sp.x, y, skaft * skal, skal, sp.rot)
      ritaSkruv(ctx, sp.x, y, sp.f, sp.rot, skal, sp.fas !== 'reserv')
    }

    fx.rita(ctx)
    ctx.restore()
  }

  function ritaLada(ctx, x, y, b, f, { hal = [], lock = 0, alfa = 1, skalY = 1 } = {}) {
    const c = farg(f)
    const B = b
    ctx.save()
    ctx.globalAlpha = alfa
    ctx.translate(x, y + LADA_H / 2)
    ctx.scale(1, skalY)
    ctx.translate(-x, -(y + LADA_H / 2))
    const x0 = x - B / 2
    const y0 = y - LADA_H / 2 + 8
    // handtag
    ctx.strokeStyle = ljusare(c, -0.45)
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - B * 0.16, y0 + 2)
    ctx.lineTo(x - B * 0.12, y0 - 8)
    ctx.lineTo(x + B * 0.12, y0 - 8)
    ctx.lineTo(x + B * 0.16, y0 + 2)
    ctx.stroke()
    // kropp med tjocklek och skugga
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    rundRekt(ctx, x0 + 2, y0 + 7, B, LADA_H - 6, 12)
    ctx.fill()
    ctx.fillStyle = ljusare(c, -0.38)
    rundRekt(ctx, x0, y0 + 4, B, LADA_H - 6, 12)
    ctx.fill()
    ctx.fillStyle = c
    rundRekt(ctx, x0, y0, B, LADA_H - 8, 12)
    ctx.fill()
    ctx.fillStyle = ljusare(c, 0.38)
    rundRekt(ctx, x0 + 8, y0 + 4, B - 16, 5, 3)
    ctx.fill()
    // nitar i hörnen
    ctx.fillStyle = ljusare(c, -0.25)
    for (const [nx, ny] of [[x0 + 8, y0 + 13], [x0 + B - 8, y0 + 13], [x0 + 8, y0 + LADA_H - 18], [x0 + B - 8, y0 + LADA_H - 18]]) {
      ctx.beginPath()
      ctx.arc(nx, ny, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    // hålen
    for (let h = 0; h < HAL_PER_LADA; h++) {
      const hx = x + halDX[h] * (B / geo.b)
      const hy = y + 6
      ctx.fillStyle = ljusare(c, -0.6)
      ctx.beginPath()
      ctx.arc(hx, hy, 13, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.beginPath()
      ctx.arc(hx, hy + 2, 10, 0, Math.PI * 2)
      ctx.fill()
      if (hal[h] !== undefined) ritaSkruv(ctx, hx, hy, hal[h], h * 0.7, 0.84)
    }
    // locket fälls ner
    if (lock > 0) {
      const lh = (LADA_H - 8) * lock
      ctx.fillStyle = ljusare(c, 0.12)
      rundRekt(ctx, x0, y0, B, lh, 12)
      ctx.fill()
      ctx.fillStyle = ljusare(c, 0.45)
      rundRekt(ctx, x0 + 8, y0 + 4, B - 16, 4, 2)
      ctx.fill()
      if (lock >= 1) {
        ctx.fillStyle = '#fff'
        ctx.font = '900 24px ui-rounded, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('✓', x, y + 4)
      }
    }
    ctx.restore()
  }

  function ritaLador(ctx, t) {
    const s = a.current
    for (let slot = 0; slot < s.slots.length; slot++) {
      const b = s.slots[slot].lador[0]
      // tom plats
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      rundRekt(ctx, geo.x[slot] - geo.b / 2, LADA_Y - LADA_H / 2 + 8, geo.b, LADA_H - 8, 12)
      ctx.fill()
      if (!b || b.fas === 'vantar') continue
      let dx = 0
      let dy = 0
      let alfa = 1
      let lock = 0
      let skalY = 1
      if (b.fas === 'in') {
        const k = Math.max(0, b.t) / 0.36
        dx = (1 - easeOutBack(Math.min(1, k))) * 230
      }
      if (b.fas === 'stang') lock = easeOut(Math.min(1, b.t / 0.18))
      if (b.fas === 'ut') {
        lock = 1
        const k = b.t / 0.34
        dy = -Math.sin(Math.min(1, k * 2) * Math.PI * 0.5) * 18 - Math.max(0, k - 0.3) * 160
        dx = -Math.max(0, k - 0.3) * 260
        alfa = 1 - Math.max(0, k - 0.5) * 2
      }
      const st = s.studs.get(slot)
      if (st != null && b.fas === 'star') {
        const k = (t - st) / 0.22
        if (k < 1) skalY = 1 - Math.sin(k * Math.PI) * 0.1
      }
      ritaLada(ctx, geo.x[slot] + dx, LADA_Y + dy, geo.b, b.f, { hal: b.hal, lock, alfa, skalY })
    }
    // kön: nästa tre lådor
    const ko = spel.kommandeLador()
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '800 10px ui-rounded, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(ko.length ? 'SEN' : 'SISTA', KO_X - 4, LADA_Y - 24)
    ko.slice(0, 3).forEach((f, i) => {
      const x = KO_X + i * 27
      const y = LADA_Y + 6
      const c = farg(f)
      ctx.globalAlpha = i === 0 ? 1 : 0.7 - i * 0.12
      ctx.fillStyle = ljusare(c, -0.38)
      rundRekt(ctx, x, y - 9, 23, 22, 6)
      ctx.fill()
      ctx.fillStyle = c
      rundRekt(ctx, x, y - 11, 23, 20, 6)
      ctx.fill()
      ctx.fillStyle = ljusare(c, -0.55)
      for (let h = 0; h < 3; h++) {
        ctx.beginPath()
        ctx.arc(x + 5.5 + h * 6, y - 1, 2.3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    })
    if (ko.length > 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '800 11px ui-rounded, system-ui, sans-serif'
      ctx.fillText(`+${ko.length - 3}`, KO_X + 2, LADA_Y + 30)
    }
    void t
  }

  function ritaReserv(ctx, t) {
    const n = spel.reserv.length
    const fyllda = spel.reserv.filter(Boolean).length
    const fara = fyllda >= n - 1 && !a.current.klar
    const bredd = n * RES_STEG + 10
    ctx.fillStyle = fara ? `rgba(255, 60, 90, ${0.18 + Math.sin(t * 9) * 0.09})` : 'rgba(0,0,0,0.32)'
    rundRekt(ctx, W / 2 - bredd / 2, RES_Y - 21, bredd, 42, 21)
    ctx.fill()
    if (fara) {
      ctx.strokeStyle = `rgba(255, 77, 109, ${0.6 + Math.sin(t * 9) * 0.3})`
      ctx.lineWidth = 2
      ctx.stroke()
    }
    for (let p = 0; p < n; p++) {
      const x = resX(p)
      ctx.fillStyle = p >= RESERV ? '#3b2f66' : '#0d1220'
      ctx.beginPath()
      ctx.arc(x, RES_Y, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.beginPath()
      ctx.arc(x, RES_Y + 3, 8, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function ritaPlatta(ctx, p, t, o = {}) {
    const s = a.current
    const g = p.geo
    ctx.save()
    ctx.globalAlpha = o.alfa ?? 1
    const sv = s.svaj.get(p.id)
    if (o.x != null) {
      const cx = g.r != null ? g.cx : (g.x0 + g.x1) / 2
      const cy = g.r != null ? g.cy : (g.y0 + g.y1) / 2
      ctx.translate(cx + o.x, cy + o.y)
      ctx.rotate(o.rot)
      ctx.translate(-cx, -cy)
    } else if (sv != null && p.kvar) {
      // svajar kring sista skruven
      const sista = p.skruvar.map((k) => spel.skruvar[k]).find((k) => k.kvar)
      if (sista) {
        const k = t - sv
        const v = Math.sin(k * 6) * Math.exp(-k * 1.4) * 0.12 + 0.02 * Math.sin(t * 2.2)
        ctx.translate(sista.x, sista.y)
        ctx.rotate(v)
        ctx.translate(-sista.x, -sista.y)
      }
    }
    const ton = p.ton || '#8ec9ff'
    const form = () => {
      ctx.beginPath()
      if (g.r != null) ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2)
      else rundRekt(ctx, g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, 13)
    }
    // skugga på det som ligger under — det är den som visar lagren
    ctx.save()
    ctx.translate(3, 6)
    ctx.fillStyle = 'rgba(4, 6, 16, 0.42)'
    form()
    ctx.fill()
    ctx.restore()
    // tjockleken
    ctx.save()
    ctx.translate(0, 4)
    ctx.fillStyle = ljusare(ton, -0.42)
    form()
    ctx.fill()
    ctx.restore()
    // själva plattan: halvgenomskinlig plast
    ctx.fillStyle = hexAlfa(ton, 0.86)
    form()
    ctx.fill()
    ctx.strokeStyle = ljusare(ton, 0.4)
    ctx.lineWidth = 1.6
    ctx.stroke()
    // glans
    ctx.save()
    form()
    ctx.clip()
    const gl = ctx.createLinearGradient(0, g.r != null ? g.cy - g.r : g.y0, 0, g.r != null ? g.cy + g.r : g.y1)
    gl.addColorStop(0, 'rgba(255,255,255,0.32)')
    gl.addColorStop(0.35, 'rgba(255,255,255,0.05)')
    gl.addColorStop(1, 'rgba(0,0,0,0.12)')
    ctx.fillStyle = gl
    ctx.fill()
    ctx.restore()
    // hål och skruvar
    for (const kid of p.skruvar) {
      const k = spel.skruvar[kid]
      ctx.fillStyle = 'rgba(5, 8, 18, 0.6)'
      ctx.beginPath()
      ctx.arc(k.x, k.y, 8, 0, Math.PI * 2)
      ctx.fill()
      if (!o.utanSkruvar && k.kvar) {
        let x = k.x
        const vk = s.vicka.get(kid)
        if (vk != null) {
          const kk = (t - vk) / 0.3
          if (kk >= 1) s.vicka.delete(kid)
          else x += Math.sin(kk * 34) * (1 - kk) * 3.5
        }
        let skal = 1
        const po = s.pop.get(kid)
        if (po != null && t >= po) {
          const kk = (t - po) / 0.4
          if (kk >= 1) s.pop.delete(kid)
          else {
            skal = 1 + Math.sin(kk * Math.PI) * 0.3
            ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - kk)})`
            ctx.lineWidth = 3 * (1 - kk) + 0.5
            ctx.beginPath()
            ctx.arc(x, k.y, SKRUV_R + 3 + kk * 12, 0, Math.PI * 2)
            ctx.stroke()
          }
        }
        ritaSkruv(ctx, x, k.y, k.f, kid * 0.9, skal, false, k)
        if (k.is > 0) ritaIs(ctx, x, k.y, k.is)
        if (k.last && spel.lasad(kid)) ritaLas(ctx, x, k.y)
      }
    }
    ctx.restore()
  }

  const canvasRef = useSpelyta({ bredd: W, hojd: H, rita, uppdatera, ner })

  const kvarSkruvar = spel.kvarSkruvar()
  const totalt = bana.skruvar.length
  const andel = Math.round(((totalt - kvarSkruvar) / Math.max(1, totalt)) * 100)

  return (
    <div className="ds-rot sk-rot">
      <Topprad niva={aktivNiva} svar={bana.svar} mynt={mynt} hoger={<SvitChip svit={spar.svit || 0} />}>
        <span className="ds-chip" title={`${kvarSkruvar} skruvar kvar`} aria-label={`${kvarSkruvar} skruvar kvar`}>
          🔩 <b>{kvarSkruvar}</b>
        </span>
      </Topprad>
      <div className="sk-mater" aria-hidden="true">
        <i style={{ width: `${andel}%` }} />
      </div>
      <div className="ds-yta sk-yta">
        <canvas ref={canvasRef} aria-label={`Skruvat bana ${aktivNiva}`} />
        <Banner svar={bana.svar} niva={`${aktivNiva}-${omgang}`} />
        <Notis notis={notis} />
        {vinst && (
          <Vinstkort
            resultat={vinst}
            ljud={ljud}
            boostInfo={BOOST}
            rader={vinst.bastaKombo >= 2 ? [[`Bästa kombo x${vinst.bastaKombo}`, `+${vinst.extra}`]] : []}
            onNasta={nasta}
          />
        )}
        {slut && (
          <Forlustkort
            titel={slut === 'bomb' ? 'Bomben smällde!' : 'Slut på hål!'}
            text={`${andel} % klart — ${kvarSkruvar} ${kvarSkruvar === 1 ? 'skruv' : 'skruvar'} kvar.`}
            ikon={slut === 'bomb' ? '💣' : '🔩'}
            mynt={mynt}
            svit={spar.svit || 0}
            fortsatt={slut === 'reserv' && spel.reserv.length < RESERV + MAX_EXTRA + hjalp.extra ? { text: 'Fortsätt med +1 hål', pris: FORTSATT_PRIS, onClick: fortsatt } : null}
            onIgen={forsokIgen}
          />
        )}
      </div>
      <div className="ds-boostrad kompakt">
        <BoostKnapp {...BOOST.angra} antal={spar.boost.angra || 0} mynt={mynt} onClick={angra} disabled={Boolean(vinst || slut)} />
        <BoostKnapp {...BOOST.hal} antal={spar.boost.hal || 0} mynt={mynt} onClick={extraHal} disabled={Boolean(vinst || slut)} />
        <BoostKnapp {...BOOST.magnet} antal={spar.boost.magnet || 0} mynt={mynt} onClick={magnet} disabled={Boolean(vinst || slut)} />
      </div>
      <p className="ds-hjalp">Skruva loss skruvar som inte har någon platta över sig. De flyger till lådan i samma färg — annars till reservhålen. Fulla hål = slut. Kolla lådkön och gräv där färgerna som kommer snart sitter.</p>
    </div>
  )
}

/* ---------------------------------------------------------------- ritverktyg */

const antal = (b) => b.hal.filter((x) => x !== undefined).length

function ritaSkruv(ctx, x, y, f, rot, skal = 1, skugga = false, k = null) {
  const c = farg(f)
  const r = SKRUV_R * skal
  const nyckel = k && k.nyckel
  if (skugga) {
    ctx.fillStyle = 'rgba(0,0,0,0.32)'
    ctx.beginPath()
    ctx.arc(x + 2, y + 5, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // metallkant
  ctx.fillStyle = '#5b6478'
  ctx.beginPath()
  ctx.arc(x, y + 1.6 * skal, r + 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = nyckel ? '#ffd43b' : '#c8d0de'
  ctx.beginPath()
  ctx.arc(x, y, r + 1, 0, Math.PI * 2)
  ctx.fill()
  // färgad topp
  ctx.fillStyle = ljusare(c, -0.32)
  ctx.beginPath()
  ctx.arc(x, y + 0.8 * skal, r * 0.84, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = c
  ctx.beginPath()
  ctx.arc(x, y, r * 0.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ljusare(c, 0.5)
  ctx.beginPath()
  ctx.arc(x - r * 0.32, y - r * 0.36, r * 0.26, 0, Math.PI * 2)
  ctx.fill()
  // kryssspår
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.strokeStyle = ljusare(c, -0.55)
  ctx.lineWidth = 2.8 * skal
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-r * 0.46, 0)
  ctx.lineTo(r * 0.46, 0)
  ctx.moveTo(0, -r * 0.46)
  ctx.lineTo(0, r * 0.46)
  ctx.stroke()
  ctx.restore()
  if (nyckel) {
    ctx.font = `${Math.round(11 * skal)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🔑', x + r * 0.75, y - r * 0.75)
  }
}

// Gängat skaft under skruvhuvudet medan den skruvas upp.
function ritaSkaft(ctx, x, y, langd, skal, rot) {
  const b = 6 * skal
  ctx.fillStyle = '#8b94a8'
  ctx.fillRect(x - b / 2, y, b, langd + 4)
  ctx.strokeStyle = '#5b6478'
  ctx.lineWidth = 1.4
  const fas = (rot * 2) % 4
  for (let k = fas; k < langd + 2; k += 4) {
    ctx.beginPath()
    ctx.moveTo(x - b / 2, y + k)
    ctx.lineTo(x + b / 2, y + k + 2)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.ellipse(x, y + langd + 5, b * 0.9, 2.5, 0, 0, Math.PI * 2)
  ctx.fill()
}

function ritaRep(ctx, x1, y1, x2, y2, t) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2 + 12 + Math.sin(t * 2) * 2
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#6b4a2b'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.quadraticCurveTo(mx, my, x2, y2)
  ctx.stroke()
  ctx.strokeStyle = '#c99a5b'
  ctx.lineWidth = 2.5
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.quadraticCurveTo(mx, my, x2, y2)
  ctx.stroke()
  ctx.setLineDash([])
}

function ritaLas(ctx, x, y) {
  ctx.fillStyle = 'rgba(10, 14, 28, 0.55)'
  ctx.beginPath()
  ctx.arc(x, y, SKRUV_R + 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#ffd43b'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.arc(x, y - 3, 4.5, Math.PI, 0)
  ctx.stroke()
  ctx.fillStyle = '#ffd43b'
  rundRekt(ctx, x - 6.5, y - 3, 13, 10, 2.5)
  ctx.fill()
  ctx.fillStyle = '#7a5a00'
  ctx.fillRect(x - 1, y, 2, 4)
}

function ritaBomb(ctx, x, y, n, t, begravd = false) {
  const fara = n <= 3
  const r = 10
  if (begravd) {
    // en streckad ring visar var bomben ligger under plattorna
    ctx.strokeStyle = fara ? 'rgba(255, 77, 109, 0.9)' : 'rgba(255, 179, 71, 0.75)'
    ctx.lineWidth = 2
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(x, y, SKRUV_R + 3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.save()
  ctx.translate(x + 11, y - 12)
  const puls = fara ? 1 + Math.sin(t * 14) * 0.12 : 1
  ctx.scale(puls, puls)
  ctx.fillStyle = '#1b1b24'
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = fara ? '#ff4d6d' : '#ffb347'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.font = '900 11px ui-rounded, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), 0, 0.5)
  // gnista på stubinen
  ctx.fillStyle = Math.sin(t * 30) > 0 ? '#ffd43b' : '#ff7a1a'
  ctx.beginPath()
  ctx.arc(6, -9, 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Isblock över en skruv, med hur många skruvar som är kvar innan den tinar.
function ritaIs(ctx, x, y, n) {
  const r = SKRUV_R + 3
  ctx.fillStyle = 'rgba(190, 233, 255, 0.74)'
  rundRekt(ctx, x - r, y - r, r * 2, r * 2, 5)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.beginPath()
  ctx.moveTo(x - r + 3, y - r + 7)
  ctx.lineTo(x - r + 7, y - r + 3)
  ctx.moveTo(x + r - 8, y + r - 3)
  ctx.lineTo(x + r - 3, y + r - 8)
  ctx.stroke()
  ctx.fillStyle = '#0b3a5c'
  ctx.font = '900 14px ui-rounded, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), x, y + 0.5)
}

const alfaCache = new Map()
function hexAlfa(hex, a) {
  const k = hex + a
  if (alfaCache.has(k)) return alfaCache.get(k)
  const n = parseInt(hex.slice(1), 16)
  const v = `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
  alfaCache.set(k, v)
  return v
}
