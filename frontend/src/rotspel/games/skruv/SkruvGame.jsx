import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { genereraBana, skapaSpel, FARGER, HAL_PER_LADA, AKTIVA, RESERV, SKRUV_R, KOL, RAD, PX, PY } from './engine.js'
import { useSpelyta } from '../delat/useSpelyta.js'
import { skapaLjud } from '../delat/ljud.js'
import { skapaFx, rundRekt, ljusare, easeOut, easeInOut, lerp } from '../delat/fx.js'
import { useSpar, useMynt, belona, forlust, betala } from '../delat/meta.js'
import { Topprad, BoostKnapp, Banner, Vinstkort, Forlustkort, Notis, useNotis } from '../delat/Ui.jsx'
import './skruv.css'

// Skruvat — Screw Jam i Rötspel.
// Tryck på en skruv som inte har någon platta över sig. Den flyger till
// lådan med samma färg, annars till ett reservhål. Fulla reservhål = slut.

const ID = 'skruvat'
const W = 360
const H = 600
const SLOT_X = [96, 264]
const LADA_Y = 44
const LADA_B = 128
const LADA_H = 52
const HAL_DX = [-36, 0, 36]
const RES_Y = 116
const RES_STEG = 40
const MAX_EXTRA = 2
const START = { niva: 1, basta: 0, svit: 0, kista: 0, boost: { hal: 1, magnet: 1 } }
const BOOST = {
  hal: { ikon: '🔩', namn: '+1 hål', pris: 80 },
  magnet: { ikon: '🧲', namn: 'Magnet', pris: 120 },
}
const FORTSATT_PRIS = 80

const farg = (f) => FARGER[f]?.hex ?? '#888'

export default function SkruvGame() {
  const [spar, setSpar] = useSpar('skruvat-v1', START)
  const sparRef = useRef(spar)
  sparRef.current = spar
  const mynt = useMynt()
  const ljud = useMemo(() => skapaLjud(), [])
  useEffect(() => () => ljud.stang(), [ljud])
  const fx = useMemo(() => skapaFx(), [])

  const [aktivNiva, setAktivNiva] = useState(spar.niva)
  const [omgang, setOmgang] = useState(0)
  const bana = useMemo(() => genereraBana(aktivNiva), [aktivNiva])
  const spel = useMemo(() => skapaSpel(bana), [bana, omgang]) // eslint-disable-line react-hooks/exhaustive-deps
  const [, rendera] = useReducer((x) => x + 1, 0)
  const [vinst, setVinst] = useState(null)
  const [slut, setSlut] = useState(false)
  const [notis, visaNotis] = useNotis()

  const a = useRef(null)
  if (!a.current || a.current.spel !== spel) {
    a.current = {
      spel,
      t: 0,
      slots: Array.from({ length: AKTIVA }, (_, s) => ({
        lador: spel.aktiva[s] ? [{ serie: spel.aktiva[s].serie, f: spel.aktiva[s].f, hal: [], fas: 'in', t: -0.15 * s }] : [],
      })),
      skruvar: [], // lossade skruvar på väg någonstans
      fallande: [],
      svaj: new Map(), // platta -> starttid när en skruv är kvar
      vicka: new Map(), // skruv -> starttid (låst skruv vickar)
      kombo: 0,
      bastaKombo: 0,
      ladaKedja: 0,
      senastLada: -10,
      klar: false,
      firat: false,
      slutVantar: false,
      anvandeReserv: false,
    }
  }
  useEffect(() => {
    fx.tom()
    setVinst(null)
    setSlut(false)
  }, [spel, fx])

  useEffect(() => {
    if (import.meta.env.DEV) window.__skruv = { spel, bana, tryck: (id) => tryckSkruv(id) }
  })

  const antalRes = spel.reserv.length
  const resX = (p) => W / 2 + (p - (antalRes - 1) / 2) * RES_STEG
  const halPos = (slot, hal) => [SLOT_X[slot] + HAL_DX[hal], LADA_Y + 4]

  /* ---------------------------------------------------------------- logik -> bild */

  function hantera(res, fordrojning = 0) {
    const s = a.current
    const k = spel.skruvar[res.id]
    const sprite = { id: res.id, f: res.f, x: k.x, y: k.y, mal: res.mal, fas: 'skruva', t: -fordrojning, rot: 0 }
    s.skruvar.push(sprite)
    if (res.mal.typ === 'lada') {
      s.kombo++
      s.bastaKombo = Math.max(s.bastaKombo, s.kombo)
    } else {
      s.kombo = 0
      s.anvandeReserv = true
    }
    if (res.foll != null) {
      const p = spel.plattor[res.foll]
      s.fallande.push({ p, t: -fordrojning - 0.12, dx: 0, dy: 0, vx: (Math.random() - 0.5) * 120, vy: -90, rot: 0, vr: (Math.random() - 0.5) * 5 })
    }
    // plattor med en skruv kvar börjar svaja
    const pl = spel.plattor[k.platta]
    if (pl.kvar && pl.skruvar.filter((x) => spel.skruvar[x].kvar).length === 1) s.svaj.set(pl.id, s.t)

    for (const e of res.handelser) {
      if (e.typ === 'spricka' || e.typ === 'tinat') {
        const k2 = spel.skruvar[e.id]
        fx.sprut(k2.x, k2.y, ['#bfe9ff', '#ffffff', '#7fd3ff'], e.typ === 'tinat' ? 18 : 6, { fart: e.typ === 'tinat' ? 170 : 80, liv: 0.45, storlek: 2.6 })
        if (e.typ === 'tinat') {
          fx.ring(k2.x, k2.y, '#bfe9ff', 26, 0.4, 3)
          ljud.brus(0.12, 0.09, 6000, 0, 10000, 2)
          ljud.ton(1318, 0.12, 'triangle', 0.08, 0.03)
        } else ljud.brus(0.05, 0.05, 5000, 0, 8000, 2)
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
      s.slutVantar = true
    }
  }

  function tryckSkruv(id) {
    const s = a.current
    if (s.klar || vinst || slut) return
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
    ljud.ton(900 + Math.random() * 120, 0.05, 'square', 0.035)
    ljud.ton(1500, 0.05, 'square', 0.025, 0.05)
    hantera(res)
    rendera()
  }

  function ner({ x, y }) {
    let bast = null
    for (const k of spel.skruvar) {
      if (!k.kvar) continue
      const d = Math.hypot(k.x - x, k.y - y)
      if (d > 19) continue
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
    if (spel.reserv.length >= RESERV + MAX_EXTRA) {
      visaNotis('Redan max antal hål')
      return
    }
    anvand('hal', () => {
      spel.extraHal()
      fx.text(W / 2, RES_Y - 14, '+1 hål', { farg: '#7dffb0', storlek: 20 })
      rendera()
    })
  }

  function magnet() {
    if (a.current.klar) return
    const kan = spel.skruvar.some((k) => spel.kanLossa(k.id) && spel.aktiva.some((l) => l && l.f === k.f && l.fyllda < HAL_PER_LADA))
    if (!kan) {
      visaNotis('Inget för magneten att ta just nu')
      return
    }
    anvand('magnet', () => {
      const lista = spel.magnet(9)
      lista.forEach((res, i) => {
        hantera(res, i * 0.08)
        setTimeout(() => ljud.pop(5 + i, 0.1), i * 80)
      })
      fx.skaka(4)
      rendera()
    })
  }

  /* ---------------------------------------------------------------- vinst/förlust */

  function vinna() {
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
    setVinst({ ...res.resultat, bastaKombo: s.bastaKombo })
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
    setSlut(false)
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

    // lådorna — står många skruvar och väntar på sin låda (snabbt spel,
    // magneten) byts lådorna fortare så kön inte växer.
    const vantar = s.skruvar.filter((sp) => sp.fas === 'vanta').length
    const brad = vantar > 3 ? 2 : 1
    for (let slot = 0; slot < AKTIVA; slot++) {
      const st = s.slots[slot]
      const b = st.lador[0]
      if (!b) continue
      b.t += dt * brad
      if (b.fas === 'vantar') {
        b.fas = 'in'
        b.t = 0
      }
      if (b.fas === 'in' && b.t >= 0.32) {
        b.fas = 'star'
        b.t = 0
      }
      if (b.fas === 'star' && antal(b) >= HAL_PER_LADA) {
        b.fas = 'stang'
        b.t = 0
        const kedja = s.t - s.senastLada < 1.6 ? s.ladaKedja + 1 : 1
        s.ladaKedja = kedja
        s.senastLada = s.t
        ljud.ton(523.25 * Math.pow(1.122, Math.min(kedja, 8)), 0.12, 'triangle', 0.12)
        ljud.ton(784 * Math.pow(1.122, Math.min(kedja, 8)), 0.2, 'triangle', 0.1, 0.08)
        fx.sprut(SLOT_X[slot], LADA_Y, [farg(b.f), '#ffffff', '#ffd43b'], 22, { fart: 220, form: 'stjarna', liv: 0.6 })
        fx.ring(SLOT_X[slot], LADA_Y, farg(b.f), 70, 0.45, 4)
        if (kedja >= 2) fx.text(SLOT_X[slot], LADA_Y + 44, kedja === 2 ? 'Dubbel!' : kedja === 3 ? 'Trippel!' : `x${kedja}!`, { farg: '#fff', storlek: 22, liv: 0.9, stig: 22 })
      }
      if (b.fas === 'stang' && b.t >= 0.22) {
        b.fas = 'ut'
        b.t = 0
        ljud.swisch(2)
      }
      if (b.fas === 'ut' && b.t >= 0.3) {
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
      if (sp.fas === 'skruva') {
        sp.rot += dt * 30
        if (sp.t >= 0.16) {
          sp.fas = 'vanta'
          sp.t = 0
          sp.lyftY = sp.y - 8
        }
      }
      if (sp.fas === 'vanta' || sp.fas === 'reserv') {
        const mal = sp.fas === 'reserv' && sp.nyMal ? sp.nyMal : sp.mal
        const kan = mal.typ === 'reserv' ? sp.fas === 'vanta' : ladaRedo(mal.slot, mal.serie)
        if (kan) {
          const franY = sp.fas === 'vanta' ? sp.y - 8 : sp.y
          if (sp.fas === 'reserv') sp.mal = sp.nyMal
          sp.fas = 'flyg'
          sp.t = 0
          sp.fx0 = sp.x
          sp.fy0 = franY
          const [tx, ty] = sp.mal.typ === 'lada' ? halPos(sp.mal.slot, sp.mal.hal) : [resX(sp.mal.plats), RES_Y]
          sp.tx = tx
          sp.ty = ty
          sp.dur = 0.2 + Math.hypot(tx - sp.x, ty - sp.y) / 1500
          if (sp.mal.typ === 'lada') sp.reserverad = true
        }
      }
      if (sp.fas === 'flyg') {
        const k = Math.min(1, sp.t / sp.dur)
        const e = easeInOut(k)
        const kx = (sp.fx0 + sp.tx) / 2
        const ky = Math.min(sp.fy0, sp.ty) - 50
        sp.x = (1 - e) * (1 - e) * sp.fx0 + 2 * (1 - e) * e * kx + e * e * sp.tx
        sp.y = (1 - e) * (1 - e) * sp.fy0 + 2 * (1 - e) * e * ky + e * e * sp.ty
        sp.rot += dt * 18
        if (k >= 1) {
          if (sp.mal.typ === 'lada') {
            const b = s.slots[sp.mal.slot].lador[0]
            if (b && b.serie === sp.mal.serie) b.hal[sp.mal.hal] = sp.f
            sp.fas = 'klar'
            ljud.ton(1318 + (b ? antal(b) : 0) * 180, 0.06, 'triangle', 0.08)
            fx.sprut(sp.tx, sp.ty, [farg(sp.f), '#fff'], 6, { fart: 80, liv: 0.3, storlek: 2 })
            if (s.kombo >= 3 && sp.mal.hal === 2) fx.text(sp.tx, sp.ty + 34, `x${s.kombo}`, { farg: '#ffe066', storlek: 16, liv: 0.6, stig: 18 })
          } else {
            sp.fas = 'reserv'
            sp.x = sp.tx
            sp.y = sp.ty
            ljud.ton(330, 0.08, 'triangle', 0.09)
          }
        }
      }
    }
    s.skruvar = s.skruvar.filter((sp) => sp.fas !== 'klar')

    // fallande plattor
    for (const f of s.fallande) {
      f.t += dt
      if (f.t < 0) continue
      if (!f.ljud) {
        f.ljud = true
        ljud.dunk()
        ljud.swisch(1)
      }
      f.vy += 1500 * dt
      f.dx += f.vx * dt
      f.dy += f.vy * dt
      f.rot += f.vr * dt
    }
    s.fallande = s.fallande.filter((f) => f.dy < H + 200)

    // varning när reservhålen nästan är fulla
    const fyllda = spel.reserv.filter(Boolean).length
    if (fyllda >= spel.reserv.length - 1 && !s.klar) ljud.varning()

    if (s.slutVantar && !s.skruvar.some((sp) => sp.fas !== 'reserv')) {
      s.slutVantar = false
      fx.skaka(7)
      ljud.forlust()
      setTimeout(() => setSlut(true), 350)
    }

    if (spel.status() === 'vunnit' && !s.firat && !s.skruvar.length && s.slots.every((st) => !st.lador.length)) {
      s.firat = true
      fx.konfetti(W / 2, H * 0.6, 100, W)
      ljud.vinst()
      setTimeout(vinna, 900)
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

    // brädet
    ctx.fillStyle = 'rgba(255,255,255,0.025)'
    rundRekt(ctx, 8, 146, W - 16, H - 152, 18)
    ctx.fill()
    ctx.fillStyle = 'rgba(160, 180, 230, 0.1)'
    for (let j = 0; j < RAD; j++) for (let i = 0; i < KOL; i++) {
      ctx.beginPath()
      ctx.arc(PX(i), PY(j), 2, 0, Math.PI * 2)
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
      ritaPlatta(ctx, f.p, t, { x: f.dx, y: f.dy, rot: f.rot, alfa: Math.max(0, 1 - f.t / 0.9), utanSkruvar: true })
    }

    // lossade skruvar överst
    for (const sp of s.skruvar) {
      if (sp.t < 0) {
        ritaSkruv(ctx, sp.x, sp.y, sp.f, 0, 1)
        continue
      }
      let skal = 1
      let y = sp.y
      if (sp.fas === 'skruva') {
        const k = sp.t / 0.16
        skal = 1 + k * 0.28
        y = sp.y - k * 8
      } else if (sp.fas === 'vanta') {
        skal = 1.28
        y = sp.y - 8 + Math.sin(t * 8 + sp.id) * 1.5
      } else if (sp.fas === 'flyg') {
        const k = sp.t / sp.dur
        skal = lerp(1.28, sp.mal.typ === 'lada' ? 0.86 : 0.95, k)
      } else if (sp.fas === 'reserv') {
        skal = 0.95
      }
      ritaSkruv(ctx, sp.x, y, sp.f, sp.rot, skal, sp.fas !== 'reserv')
    }

    fx.rita(ctx)
    ctx.restore()
  }

  function ritaLador(ctx, t) {
    const s = a.current
    for (let slot = 0; slot < AKTIVA; slot++) {
      const b = s.slots[slot].lador[0]
      // tom plats
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      rundRekt(ctx, SLOT_X[slot] - LADA_B / 2, LADA_Y - LADA_H / 2, LADA_B, LADA_H, 12)
      ctx.fill()
      if (!b || b.fas === 'vantar') continue
      let dx = 0
      let dy = 0
      let alfa = 1
      if (b.fas === 'in') {
        const k = Math.max(0, b.t) / 0.32
        dx = (1 - easeOut(Math.min(1, k))) * (slot === 0 ? -200 : 200)
      }
      if (b.fas === 'ut') {
        const k = b.t / 0.3
        dy = -k * k * 90
        alfa = 1 - k
      }
      const x = SLOT_X[slot] + dx
      const y = LADA_Y + dy
      const c = farg(b.f)
      ctx.globalAlpha = alfa
      ctx.fillStyle = ljusare(c, -0.35)
      rundRekt(ctx, x - LADA_B / 2, y - LADA_H / 2 + 4, LADA_B, LADA_H, 12)
      ctx.fill()
      ctx.fillStyle = c
      rundRekt(ctx, x - LADA_B / 2, y - LADA_H / 2, LADA_B, LADA_H - 2, 12)
      ctx.fill()
      ctx.fillStyle = ljusare(c, 0.35)
      rundRekt(ctx, x - LADA_B / 2 + 8, y - LADA_H / 2 + 4, LADA_B - 16, 5, 3)
      ctx.fill()
      for (let h = 0; h < HAL_PER_LADA; h++) {
        const hx = x + HAL_DX[h]
        const hy = y + 4
        ctx.fillStyle = ljusare(c, -0.55)
        ctx.beginPath()
        ctx.arc(hx, hy, 12, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.beginPath()
        ctx.arc(hx, hy + 1.5, 9, 0, Math.PI * 2)
        ctx.fill()
        if (b.hal[h] !== undefined) ritaSkruv(ctx, hx, hy, b.hal[h], h * 0.7, 0.86)
      }
      if (b.fas === 'stang' || b.fas === 'ut') {
        const k = b.fas === 'stang' ? easeOut(Math.min(1, b.t / 0.22)) : 1
        ctx.fillStyle = ljusare(c, 0.12)
        rundRekt(ctx, x - LADA_B / 2, y - LADA_H / 2, LADA_B, (LADA_H - 2) * k, 12)
        ctx.fill()
        if (k >= 1) {
          ctx.fillStyle = '#fff'
          ctx.font = '900 22px ui-rounded, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('✓', x, y + 1)
        }
      }
      ctx.globalAlpha = 1
    }
    // antal lådor kvar
    const kvar = spel.kvarLador()
    ctx.fillStyle = 'rgba(10,14,28,0.7)'
    ctx.beginPath()
    ctx.arc(W / 2, LADA_Y, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#eef2ff'
    ctx.font = '900 13px ui-rounded, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(kvar), W / 2, LADA_Y + 0.5)
    void t
  }

  function ritaReserv(ctx, t) {
    const n = spel.reserv.length
    const fyllda = spel.reserv.filter(Boolean).length
    const fara = fyllda >= n - 1 && !a.current.klar
    const bredd = n * RES_STEG + 8
    ctx.fillStyle = fara ? `rgba(255, 60, 90, ${0.16 + Math.sin(t * 9) * 0.08})` : 'rgba(0,0,0,0.3)'
    rundRekt(ctx, W / 2 - bredd / 2, RES_Y - 20, bredd, 40, 20)
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
      ctx.arc(x, RES_Y, 13, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  function ritaPlatta(ctx, p, t, o = {}) {
    const s = a.current
    const g = p.geo
    ctx.save()
    ctx.globalAlpha = o.alfa ?? 1
    // svaj kring sista skruven
    const sv = s.svaj.get(p.id)
    if (o.x != null) {
      const cx = g.r != null ? g.cx : (g.x0 + g.x1) / 2
      const cy = g.r != null ? g.cy : (g.y0 + g.y1) / 2
      ctx.translate(cx + o.x, cy + o.y)
      ctx.rotate(o.rot)
      ctx.translate(-cx, -cy)
    } else if (sv != null && p.kvar) {
      const sista = p.skruvar.map((k) => spel.skruvar[k]).find((k) => k.kvar)
      if (sista) {
        const k = t - sv
        const v = Math.sin(k * 7) * Math.exp(-k * 1.6) * 0.1 + 0.015 * Math.sin(t * 2)
        ctx.translate(sista.x, sista.y)
        ctx.rotate(v)
        ctx.translate(-sista.x, -sista.y)
      }
    }
    const ton = p.ton || '#9ad8ff'
    ctx.fillStyle = hexAlfa(ton, 0.3)
    ctx.strokeStyle = hexAlfa(ton, 0.9)
    ctx.lineWidth = 2
    if (g.r != null) {
      ctx.beginPath()
      ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2)
    } else {
      rundRekt(ctx, g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, 14)
    }
    ctx.fill()
    ctx.stroke()
    // glansstrimma
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 2
    ctx.beginPath()
    if (g.r != null) ctx.arc(g.cx, g.cy, g.r - 5, Math.PI * 1.1, Math.PI * 1.45)
    else {
      ctx.moveTo(g.x0 + 10, g.y0 + 5)
      ctx.lineTo(Math.min(g.x1 - 10, g.x0 + 40), g.y0 + 5)
    }
    ctx.stroke()
    // hål och skruvar
    for (const kid of p.skruvar) {
      const k = spel.skruvar[kid]
      ctx.fillStyle = 'rgba(5, 8, 18, 0.55)'
      ctx.beginPath()
      ctx.arc(k.x, k.y, 7.5, 0, Math.PI * 2)
      ctx.fill()
      if (!o.utanSkruvar && k.kvar) {
        let x = k.x
        const vk = s.vicka.get(kid)
        if (vk != null) {
          const kk = (t - vk) / 0.3
          if (kk >= 1) s.vicka.delete(kid)
          else x += Math.sin(kk * 34) * (1 - kk) * 3
        }
        ritaSkruv(ctx, x, k.y, k.f, kid * 0.9, 1)
        if (k.is > 0) ritaIs(ctx, x, k.y, k.is)
        // Skruvar under en annan platta är lite matta, så de fria syns.
        if (spel.blockerad(kid)) {
          ctx.fillStyle = 'rgba(12, 16, 32, 0.32)'
          ctx.beginPath()
          ctx.arc(x, k.y, SKRUV_R + 0.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.restore()
  }

  const canvasRef = useSpelyta({ bredd: W, hojd: H, rita, uppdatera, ner })

  const kvarSkruvar = spel.kvarSkruvar()
  const totalt = bana.skruvar.length

  return (
    <div className="ds-rot sk-rot">
      <Topprad niva={aktivNiva} svar={bana.svar} mynt={mynt}>
        <span className="ds-chip">
          🔩 <b>{kvarSkruvar}</b> kvar
        </span>
      </Topprad>
      <div className="sk-mater" aria-hidden="true">
        <i style={{ width: `${((totalt - kvarSkruvar) / Math.max(1, totalt)) * 100}%` }} />
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
            titel="Slut på hål!"
            text={`${kvarSkruvar} ${kvarSkruvar === 1 ? 'skruv' : 'skruvar'} kvar.`}
            ikon="🔩"
            mynt={mynt}
            fortsatt={spel.reserv.length < RESERV + MAX_EXTRA ? { text: 'Fortsätt med +1 hål', pris: FORTSATT_PRIS, onClick: fortsatt } : null}
            onIgen={forsokIgen}
          />
        )}
      </div>
      <div className="ds-boostrad">
        <BoostKnapp {...BOOST.hal} antal={spar.boost.hal || 0} mynt={mynt} onClick={extraHal} disabled={Boolean(vinst || slut)} />
        <BoostKnapp {...BOOST.magnet} antal={spar.boost.magnet || 0} mynt={mynt} onClick={magnet} disabled={Boolean(vinst || slut)} />
      </div>
      <p className="ds-hjalp">Skruva loss skruvar som inte har någon platta över sig. De flyger till lådan i samma färg — annars till reservhålen. Fulla hål = slut. Is smälter efter några skruvar.</p>
    </div>
  )
}

/* ---------------------------------------------------------------- ritverktyg */

const antal = (b) => b.hal.filter((x) => x !== undefined).length

// Isblock över en skruv, med hur många skruvar som är kvar innan den tinar.
function ritaIs(ctx, x, y, n) {
  const r = SKRUV_R + 3
  ctx.fillStyle = 'rgba(190, 233, 255, 0.72)'
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
  ctx.font = '900 13px ui-rounded, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), x, y + 0.5)
}

function ritaSkruv(ctx, x, y, f, rot, skal = 1, skugga = false) {
  const c = farg(f)
  const r = SKRUV_R * skal
  if (skugga) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.arc(x + 2, y + 4, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = ljusare(c, -0.4)
  ctx.beginPath()
  ctx.arc(x, y + 1.5 * skal, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = c
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = ljusare(c, 0.45)
  ctx.beginPath()
  ctx.arc(x - r * 0.35, y - r * 0.38, r * 0.32, 0, Math.PI * 2)
  ctx.fill()
  // kryssspår
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.strokeStyle = ljusare(c, -0.5)
  ctx.lineWidth = 2.6 * skal
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-r * 0.5, 0)
  ctx.lineTo(r * 0.5, 0)
  ctx.moveTo(0, -r * 0.5)
  ctx.lineTo(0, r * 0.5)
  ctx.stroke()
  ctx.restore()
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
