import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { genereraBana, skapaSpel, hallplatsFor, FARGER, KAPACITET, DX, DY } from './engine.js'
import { useSpelyta } from '../delat/useSpelyta.js'
import { skapaLjud } from '../delat/ljud.js'
import { skapaFx, rundRekt, ljusare, easeOut, easeInOut, lerp } from '../delat/fx.js'
import { useSpar, useMynt, belona, forlust, betala } from '../delat/meta.js'
import { Topprad, BoostKnapp, Banner, Vinstkort, Forlustkort, Notis, useNotis } from '../delat/Ui.jsx'
import './hallplats.css'

// Hållplatsen — Bus Jam med spårvagnar.
// Tryck på en resenär med fri väg upp till perrongen. Rätt färg kliver på
// vagnen, fel färg sätter sig på bänken. Full bänk = slut.

const ID = 'hallplatsen'
const W = 360
const GRID_Y = 150
const VAGN_Y = 16
const VAGN_H = 46
const VAGN_B = 216
const DOCK_X = (W - VAGN_B) / 2
const PERRONG_Y = 82
const BANK_Y = 116
const MAX_EXTRA = 2
const START = { niva: 1, basta: 0, svit: 0, kista: 0, boost: { plats: 1, lyft: 2, vinka: 1 } }
const BOOST = {
  plats: { ikon: '🪑', namn: '+1 plats', pris: 80 },
  lyft: { ikon: '🚁', namn: 'Lyft', pris: 100 },
  vinka: { ikon: '👋', namn: 'Vinka', pris: 120 },
}
const FORTSATT_PLATS = 80
const FORTSATT_TID = 60
const HUD = '#f6d2b0'

const farg = (f) => (f >= 0 && FARGER[f] ? FARGER[f].hex : '#6b7280')

export default function HallplatsGame() {
  const [spar, setSpar, sparRef] = useSpar('hallplatsen-v1', START)
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
  const [slut, setSlut] = useState(null) // 'bank' | 'tid'
  const [lyftLage, setLyftLage] = useState(false)
  const [notis, visaNotis] = useNotis()

  const cs = Math.min(44, (W - 20) / bana.w)
  const gx = (W - bana.w * cs) / 2
  const H = Math.round(GRID_Y + bana.h * cs + 12)
  const cellMitt = (i) => [gx + ((i % bana.w) + 0.5) * cs, GRID_Y + (Math.floor(i / bana.w) + 0.5) * cs]

  const a = useRef(null)
  if (!a.current || a.current.spel !== spel) {
    a.current = {
      spel,
      t: 0,
      vagnar: bana.vagnar.map((f, k) => ({ k, f, fas: k === 0 ? 'kommer' : 'vantar', t: 0, x: -VAGN_B - 40, fyllda: [], tilldelade: 0 })),
      figurer: [],
      nastaId: 1,
      skak: new Map(), // cell -> starttid
      pop: new Map(), // cell -> starttid (nya från rulltrappa, avslöjade)
      kombo: 0,
      bastaKombo: 0,
      tidKvar: bana.tid,
      tidIgang: false,
      sistaSek: 99,
      klar: false,
      firat: false,
      slutVantar: false,
    }
    a.current.vagnar[0].tilldelade = 0
  }
  useEffect(() => {
    fx.tom()
    setVinst(null)
    setSlut(null)
    setLyftLage(false)
  }, [spel, fx])

  useEffect(() => {
    if (import.meta.env.DEV) window.__hallplats = { spel, bana, tryck: (i) => tryckCell(i), anim: () => a.current }
  })

  /* --------------------------------------------------------------- geometri */

  const antalPlatser = spel.bank.length
  const platsX = (p) => {
    const bredd = 38
    const gap = 6
    const tot = antalPlatser * bredd + (antalPlatser - 1) * gap
    return (W - tot) / 2 + p * (bredd + gap) + bredd / 2
  }
  const dorrX = (plats) => DOCK_X + 44 + plats * 64

  /* --------------------------------------------------------------- händelser */

  function nyFigur(f, x, y, vag, mal) {
    const s = a.current
    const fig = { id: s.nastaId++, f, x, y, vag, mal, fas: 'ga', t: 0, studs: 0 }
    s.figurer.push(fig)
    return fig
  }

  function malPunkter(mal) {
    if (mal.typ === 'bank') return [[platsX(mal.plats), BANK_Y]]
    return [[dorrX(mal.plats), PERRONG_Y + 6]]
  }

  function hanteraResultat(res, flyger = false) {
    const s = a.current
    const [sx, sy] = cellMitt(res.i)
    // väg: rutorna upp till översta raden, sedan ut ur rutnätet och fram till målet
    const pts = res.vag.map((c) => cellMitt(c))
    const sista = pts[pts.length - 1]
    pts.push([sista[0], GRID_Y - 10])
    let mal = { ...res.mal }
    if (mal.typ === 'vagn') {
      const v = s.vagnar[mal.vagn]
      mal.plats = v.tilldelade++
    }
    pts.push(...malPunkter(mal))
    const fig = nyFigur(res.f, sx, sy, pts, mal)
    fig.flyger = flyger

    // ljud och kombo
    if (mal.typ === 'vagn') {
      s.kombo++
      s.bastaKombo = Math.max(s.bastaKombo, s.kombo)
      ljud.pop(4 + Math.min(s.kombo, 12), 0.12)
      if (s.kombo >= 3) fx.text(sx, sy - 14, `x${s.kombo}`, { farg: '#ffe066', storlek: 15 + Math.min(s.kombo, 15) * 0.8, liv: 0.75 })
      if (s.kombo > 0 && s.kombo % 6 === 0) {
        fx.text(W / 2, GRID_Y + 40, ['Snyggt!', 'Grymt!', 'Rusningstrafik!', 'Ostoppbar!'][Math.min(3, s.kombo / 6 - 1)], { farg: '#fff', storlek: 30, liv: 1.1 })
        ljud.hurra(s.kombo / 6)
      }
    } else {
      s.kombo = 0
      ljud.ton(330, 0.1, 'triangle', 0.1)
      ljud.ton(262, 0.12, 'triangle', 0.08, 0.06)
    }
    fx.sprut(sx, sy, farg(res.f), 6, { fart: 90, liv: 0.35, storlek: 2.4 })

    for (const e of res.handelser) {
      if (e.typ === 'byte') {
        const fig2 = s.figurer.find((g) => g.mal.typ === 'bank' && g.mal.plats === e.plats && g.fas !== 'klar' && !g.bytt)
        const v = s.vagnar[e.vagn]
        const nyMal = { typ: 'vagn', vagn: e.vagn, plats: v.tilldelade++ }
        if (fig2) {
          fig2.bytt = true
          fig2.vantaBank = true
          fig2.nyMal = nyMal
        }
      } else if (e.typ === 'rulltrappa') {
        s.pop.set(e.till, s.t)
        ljud.pop(9, 0.08)
      } else if (e.typ === 'avslojd') {
        s.pop.set(e.i, s.t)
        const [x, y] = cellMitt(e.i)
        fx.sprut(x, y, ['#ffffff', farg(e.f)], 10, { fart: 120, form: 'stjarna', liv: 0.5, gravitation: 0 })
        ljud.ton(1318, 0.08, 'sine', 0.06)
        ljud.ton(1760, 0.12, 'sine', 0.05, 0.05)
      } else if (e.typ === 'spricka' || e.typ === 'tinat') {
        const [x, y] = cellMitt(e.i)
        fx.sprut(x, y, ['#bfe9ff', '#ffffff'], e.typ === 'tinat' ? 16 : 6, { fart: e.typ === 'tinat' ? 160 : 80, liv: 0.45 })
        ljud.brus(0.08, 0.08, 4500, 0, 9000, 2)
        if (e.typ === 'tinat') ljud.ton(1046, 0.12, 'triangle', 0.08)
      }
    }
    if (res.vunnit) s.klar = true
    if (res.forlorat) {
      s.klar = true
      s.slutVantar = true
    }
  }

  const lyftLageRef = useRef(false)
  lyftLageRef.current = lyftLage

  function tryckCell(i) {
    const s = a.current
    if (s.klar || vinst || slut) return
    const c = spel.celler[i]
    if (!c || c.t !== 'r') return
    if (lyftLageRef.current) {
      setLyftLage(false)
      const sp = sparRef.current
      if ((sp.boost.lyft || 0) > 0) setSpar((x) => ({ ...x, boost: { ...x.boost, lyft: x.boost.lyft - 1 } }))
      else if (!betala(BOOST.lyft.pris)) {
        visaNotis('För lite mynt')
        return
      }
      const res = spel.lyft(i)
      if (!res) return
      startaTid()
      ljud.booster()
      const [x, y] = cellMitt(i)
      fx.ring(x, y, '#fff', 30, 0.4)
      hanteraResultat(res, true)
      rendera()
      return
    }
    const res = spel.tryck(i)
    if (!res) return
    if (res.typ !== 'gar') {
      s.skak.set(i, s.t)
      ljud.fel()
      return
    }
    startaTid()
    hanteraResultat(res)
    rendera()
  }

  function startaTid() {
    a.current.tidIgang = true
  }

  function ner({ x, y }) {
    const cx = Math.floor((x - gx) / cs)
    const cy = Math.floor((y - GRID_Y) / cs)
    if (cx < 0 || cy < 0 || cx >= bana.w || cy >= bana.h) return
    tryckCell(cy * bana.w + cx)
  }

  /* --------------------------------------------------------------- boosters */

  function anvand(typ, fn) {
    const sp = sparRef.current
    if ((sp.boost[typ] || 0) > 0) setSpar((x) => ({ ...x, boost: { ...x.boost, [typ]: x.boost[typ] - 1 } }))
    else if (!betala(BOOST[typ].pris)) {
      visaNotis('För lite mynt')
      return false
    }
    ljud.booster()
    fn()
    return true
  }

  function plats() {
    if (a.current.klar) return
    if (spel.bank.length >= 5 + MAX_EXTRA) {
      visaNotis('Bänken är redan max lång')
      return
    }
    anvand('plats', () => {
      spel.extraPlats()
      fx.text(W / 2, BANK_Y - 6, '+1 plats', { farg: '#7dffb0', storlek: 20 })
      rendera()
    })
  }

  // Vinka: alla i vagnens färg kommer, var de än står (de flyger dit).
  function vinka() {
    const s = a.current
    if (s.klar) return
    const v = s.vagnar.find((x) => x.k === spel.aktiv())
    if (!v || v.fas !== 'star') {
      visaNotis('Vänta tills vagnen står inne')
      return
    }
    if (!spel.celler.some((c) => c && c.t === 'r' && c.f === spel.vagnar[spel.aktiv()])) {
      visaNotis('Ingen på brädet har vagnens färg')
      return
    }
    anvand('vinka', () => {
      const lista = spel.vinka()
      if (!lista.length) return
      startaTid()
      fx.text(DOCK_X + VAGN_B / 2, VAGN_Y + VAGN_H + 22, 'Alla ombord!', { farg: '#fff', storlek: 20, liv: 1 })
      for (const res of lista) {
        const [x, y] = cellMitt(res.i)
        fx.ring(x, y, farg(res.f), 30, 0.45, 3)
        hanteraResultat(res, true)
      }
      fx.skaka(4)
      rendera()
    })
  }

  function lyft() {
    if (lyftLage) {
      setLyftLage(false)
      return
    }
    if (a.current.klar) return
    if ((sparRef.current.boost.lyft || 0) <= 0 && mynt < BOOST.lyft.pris) {
      visaNotis('För lite mynt')
      return
    }
    // betalas först när man väljer någon (se tryckCell)
    setLyftLage(true)
    visaNotis('Välj en resenär att lyfta', 1800)
  }

  /* --------------------------------------------------------------- vinst/förlust */

  // Belöningen räknas och sparas direkt när banan är klar; bara kortet
  // visas efter firandet. Lämnar man spelet under tiden är vinsten kvar.
  const vinstTimer = useRef(0)
  useEffect(() => () => clearTimeout(vinstTimer.current), [])
  function vinna(fordrojning = 0) {
    const s = a.current
    const res = belona(sparRef.current, {
      gameId: ID,
      niva: aktivNiva,
      svar: bana.svar,
      perfekt: !s.anvandeBank,
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
  function fortsattPlats() {
    if (!betala(FORTSATT_PLATS)) return
    spel.extraPlats()
    a.current.klar = false
    a.current.slutVantar = false
    setSlut(null)
    ljud.booster()
    rendera()
  }
  function fortsattTid() {
    if (!betala(FORTSATT_TID)) return
    a.current.tidKvar += 30
    a.current.klar = false
    setSlut(null)
    ljud.booster()
    rendera()
  }

  /* --------------------------------------------------------------- uppdatera */

  function uppdatera(dt) {
    const s = a.current
    fx.uppdatera(dt)
    if (fx.fryst()) return
    s.t += dt

    // klockan
    if (s.tidIgang && !s.klar && !vinst && !slut && typeof document !== 'undefined' && !document.hidden) {
      s.tidKvar = Math.max(0, s.tidKvar - dt)
      const sek = Math.ceil(s.tidKvar)
      if (sek !== s.sistaSek) {
        s.sistaSek = sek
        if (sek <= 10 && sek > 0) ljud.ton(1400, 0.04, 'square', 0.04)
        rendera()
      }
      if (s.tidKvar <= 0) {
        s.klar = true
        ljud.forlust()
        setSlut('tid')
      }
    }

    // vagnarna — går det fort (eller med Vinka) hinner flera vagnar fyllas
    // innan den första ens har åkt. Då kör de snabbare så kön inte växer.
    const ko = s.vagnar.filter((v) => v.tilldelade >= KAPACITET && (v.fas === 'vantar' || v.fas === 'kommer' || v.fas === 'star')).length
    const brad = ko > 1 ? 1.9 : 1
    for (const v of s.vagnar) {
      v.t += dt * brad
      if (v.fas === 'vantar') {
        const forra = s.vagnar[v.k - 1]
        if (!forra || forra.fas === 'borta' || (forra.fas === 'aker' && forra.t > 0.18)) {
          v.fas = 'kommer'
          v.t = 0
        }
      }
      if (v.fas === 'kommer') {
        if (v.t < 0.01) {
          ljud.ton(1568, 0.25, 'sine', 0.05)
          ljud.ton(1975, 0.3, 'sine', 0.04, 0.12)
        }
        const k = Math.min(1, v.t / 0.55)
        v.x = lerp(-VAGN_B - 40, DOCK_X, easeOut(k))
        if (k >= 1) {
          v.fas = 'star'
          v.t = 0
          ljud.brus(0.25, 0.05, 700, 0, 300)
        }
      } else if (v.fas === 'star') {
        v.x = DOCK_X
        if (v.fyllda.length >= KAPACITET && v.t > 0.28) {
          v.fas = 'aker'
          v.t = 0
          ljud.ton(988, 0.18, 'sine', 0.08)
          ljud.ton(988, 0.18, 'sine', 0.08, 0.22)
          ljud.swisch(4)
          fx.text(DOCK_X + VAGN_B / 2, VAGN_Y + 30, 'Full vagn!', { farg: '#ffffff', storlek: 18, liv: 0.8, stig: 16 })
          fx.sprut(DOCK_X + VAGN_B / 2, VAGN_Y + VAGN_H / 2, [farg(v.f), '#ffffff', '#ffd43b'], 18, { fart: 200, liv: 0.6, form: 'stjarna' })
        }
      } else if (v.fas === 'aker') {
        const k = Math.min(1, v.t / 0.5)
        v.x = lerp(DOCK_X, W + 30, k * k)
        if (k >= 1) v.fas = 'borta'
      }
    }

    // figurerna
    const fart = 330
    for (const g of s.figurer) {
      g.t += dt
      if (g.fas === 'ga' || g.fas === 'bytaGa') {
        let kvar = fart * dt * (g.flyger ? 1.6 : 1)
        while (kvar > 0 && g.vag.length) {
          const [tx, ty] = g.vag[0]
          const d = Math.hypot(tx - g.x, ty - g.y)
          if (d <= kvar) {
            g.x = tx
            g.y = ty
            g.vag.shift()
            kvar -= d
          } else {
            g.x += ((tx - g.x) / d) * kvar
            g.y += ((ty - g.y) / d) * kvar
            kvar = 0
          }
        }
        if (!g.vag.length) {
          g.fas = g.mal.typ === 'bank' ? 'sitter' : 'vanta'
          g.t = 0
          if (g.mal.typ === 'bank') {
            s.anvandeBank = true
            ljud.ton(220, 0.08, 'sine', 0.1)
          }
        }
      }
      // bänken centreras om när en plats läggs till
      if (g.fas === 'sitter') {
        g.x = platsX(g.mal.plats)
        g.y = BANK_Y
      }
      if (g.fas === 'sitter' && g.vantaBank) {
        // bänken -> vagnen när vagnen står inne
        g.vantaBank = false
        g.mal = g.nyMal
        g.fas = 'bytaGa'
        g.vag = malPunkter(g.mal)
        g.t = 0
      }
      if (g.fas === 'vanta') {
        const v = s.vagnar[g.mal.vagn]
        if (v.fas === 'star') {
          g.fas = 'kliv'
          g.t = 0
        }
      }
      if (g.fas === 'kliv') {
        if (g.t >= 0.18) {
          g.fas = 'klar'
          const v = s.vagnar[g.mal.vagn]
          v.fyllda.push(g.f)
          fx.sprut(dorrX(g.mal.plats), VAGN_Y + 22, [farg(g.f), '#ffffff'], 8, { fart: 120, liv: 0.4, form: 'stjarna', gravitation: 100 })
          ljud.pop(6 + v.fyllda.length * 2, 0.09)
        }
      }
    }
    s.figurer = s.figurer.filter((g) => g.fas !== 'klar')

    // full bänk: visa förlusten när alla har satt sig
    if (s.slutVantar && !s.figurer.some((g) => g.fas === 'ga')) {
      s.slutVantar = false
      fx.skaka(6)
      ljud.forlust()
      setTimeout(() => setSlut('bank'), 350)
    }

    // vinst: när sista vagnen åkt
    if (spel.status() === 'vunnit' && !s.firat && s.vagnar.every((v) => v.fas === 'borta')) {
      s.firat = true
      fx.konfetti(W / 2, H * 0.7, 90, W)
      ljud.vinst()
      vinna(900)
    }
  }

  /* --------------------------------------------------------------- ritning */

  function rita(ctx) {
    const s = a.current
    const t = s.t
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    ctx.translate(fx.skakX(), fx.skakY())

    ritaGatan(ctx)
    for (const v of s.vagnar) if (v.fas !== 'vantar' && v.fas !== 'borta') ritaVagn(ctx, v, t)
    // nästa vagns nos tittar fram till vänster
    const nasta = s.vagnar.find((v) => v.fas === 'vantar')
    if (nasta) ritaNos(ctx, nasta, t)
    ritaPerrong(ctx)
    ritaBank(ctx)
    ritaRutnat(ctx, t)

    // figurer i rörelse (de på väg in i vagnen krymper)
    for (const g of s.figurer) {
      let skal = 1
      let y = g.y
      if (g.fas === 'kliv') {
        const k = g.t / 0.18
        skal = 1 - k * 0.6
        y = lerp(g.y, VAGN_Y + 26, easeInOut(k))
      }
      const studs = g.fas === 'ga' || g.fas === 'bytaGa' ? Math.abs(Math.sin(g.t * 18)) * 2.5 : 0
      if (g.flyger && g.fas === 'ga') {
        ritaPropeller(ctx, g.x, y - cs * 0.5, t)
      }
      ritaResenar(ctx, g.x, y - studs, cs * skal, g.f, { sitter: g.fas === 'sitter', t: t + g.id })
    }

    fx.rita(ctx)
    ctx.restore()

    if (lyftLageRef.current) {
      ctx.fillStyle = 'rgba(255, 220, 80, 0.06)'
      ctx.fillRect(0, GRID_Y, W, H - GRID_Y)
    }
  }

  function ritaGatan(ctx) {
    // asfalt och räls
    ctx.fillStyle = '#1b2236'
    ctx.fillRect(0, 0, W, PERRONG_Y - 6)
    ctx.fillStyle = '#2e3854'
    ctx.fillRect(0, VAGN_Y + VAGN_H + 1, W, 3)
    ctx.fillRect(0, VAGN_Y + VAGN_H + 9, W, 3)
    ctx.fillStyle = '#242c44'
    for (let x = 4; x < W; x += 14) ctx.fillRect(x, VAGN_Y + VAGN_H, 6, 14)
    ctx.strokeStyle = 'rgba(200, 210, 240, 0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 7)
    ctx.lineTo(W, 7)
    ctx.stroke()
  }

  function ritaPerrong(ctx) {
    ctx.fillStyle = '#39445f'
    ctx.fillRect(0, PERRONG_Y - 6, W, 22)
    ctx.fillStyle = '#facc15'
    ctx.fillRect(0, PERRONG_Y - 6, W, 3)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    for (let x = 0; x < W; x += 18) ctx.fillRect(x, PERRONG_Y - 3, 1, 19)
    // område mellan perrong och rutnät
    ctx.fillStyle = '#28314a'
    ctx.fillRect(0, PERRONG_Y + 16, W, GRID_Y - PERRONG_Y - 18)
  }

  function ritaBank(ctx) {
    const n = spel.bank.length
    const full = spel.bank.filter((b) => b !== null).length
    const fara = full >= n - 1 && !a.current.klar
    for (let p = 0; p < n; p++) {
      const x = platsX(p)
      ctx.fillStyle = p >= 5 ? '#4c3d77' : '#5b4630'
      rundRekt(ctx, x - 19, BANK_Y + 4, 38, 14, 5)
      ctx.fill()
      ctx.fillStyle = p >= 5 ? '#6a58a3' : '#7a5c3c'
      rundRekt(ctx, x - 19, BANK_Y - 2, 38, 8, 4)
      ctx.fill()
      if (fara) {
        ctx.strokeStyle = `rgba(255, 77, 109, ${0.45 + Math.sin(a.current.t * 8) * 0.35})`
        ctx.lineWidth = 2
        rundRekt(ctx, x - 21, BANK_Y - 4, 42, 24, 7)
        ctx.stroke()
      }
    }
  }

  function ritaVagn(ctx, v, t) {
    const x = v.x
    const y = VAGN_Y
    const c = farg(v.f)
    const linje = FARGER[v.f]?.linje ?? ''
    // strömavtagare
    ctx.strokeStyle = '#9aa4bf'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x + VAGN_B * 0.42, y)
    ctx.lineTo(x + VAGN_B * 0.5, y - 8)
    ctx.lineTo(x + VAGN_B * 0.58, y)
    ctx.stroke()
    // kaross
    ctx.fillStyle = ljusare(c, -0.25)
    rundRekt(ctx, x, y + 3, VAGN_B, VAGN_H, 10)
    ctx.fill()
    ctx.fillStyle = c
    rundRekt(ctx, x, y, VAGN_B, VAGN_H - 2, 10)
    ctx.fill()
    ctx.fillStyle = ljusare(c, 0.3)
    rundRekt(ctx, x + 6, y + 2, VAGN_B - 12, 5, 3)
    ctx.fill()
    // fönsterband
    ctx.fillStyle = '#0f1a2e'
    rundRekt(ctx, x + 10, y + 10, VAGN_B - 34, 20, 5)
    ctx.fill()
    // de tre platserna
    for (let p = 0; p < KAPACITET; p++) {
      const fx_ = x + 44 + p * 64
      ctx.fillStyle = 'rgba(160, 200, 255, 0.16)'
      rundRekt(ctx, fx_ - 22, y + 12, 44, 16, 4)
      ctx.fill()
      const f = v.fyllda[p]
      if (f !== undefined) {
        ctx.fillStyle = farg(f)
        rundRekt(ctx, fx_ - 9, y + 19, 18, 10, 4)
        ctx.fill()
        ctx.fillStyle = HUD
        ctx.beginPath()
        ctx.arc(fx_, y + 16, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // front med linjenummer
    ctx.fillStyle = '#0f1a2e'
    rundRekt(ctx, x + VAGN_B - 22, y + 8, 14, 24, 5)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x + VAGN_B - 15, y + 38, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ljusare(c, -0.35)
    ctx.font = '900 9px ui-rounded, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(linje), x + VAGN_B - 15, y + 38.5)
    // hjul
    ctx.fillStyle = '#0b0f1a'
    for (const hx of [0.16, 0.3, 0.7, 0.84]) {
      ctx.beginPath()
      ctx.arc(x + VAGN_B * hx, y + VAGN_H + 2, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    void t
  }

  function ritaNos(ctx, v, t) {
    const x = -VAGN_B + 34 + Math.sin(t * 2) * 1.5
    ctx.globalAlpha = 0.85
    ritaVagn(ctx, { ...v, x, fyllda: [] }, t)
    ctx.globalAlpha = 1
  }

  function ritaRutnat(ctx, t) {
    const s = a.current
    const { w, h } = bana
    // plattor
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = gx + x * cs
        const py = GRID_Y + y * cs
        ctx.fillStyle = (x + y) % 2 ? '#202842' : '#1d253d'
        ctx.fillRect(px, py, cs, cs)
      }
    }
    // utgångskant mot perrongen
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)'
    ctx.fillRect(gx, GRID_Y - 2, w * cs, 2)

    for (let i = 0; i < w * h; i++) {
      const c = spel.celler[i]
      if (!c) continue
      const [mx, my] = cellMitt(i)
      if (c.t === 'v') ritaPlantering(ctx, mx, my, i)
      else if (c.t === 't') ritaRulltrappa(ctx, mx, my, c)
    }
    // Vilka kan gå just nu? Räknas om bara när brädet ändrats.
    if (s.rorligaDrag !== spel.drag() || !s.rorliga) {
      s.rorligaDrag = spel.drag()
      s.rorliga = new Set()
      for (let i = 0; i < w * h; i++) if (spel.kanGa(i)) s.rorliga.add(i)
    }
    for (let i = 0; i < w * h; i++) {
      const c = spel.celler[i]
      if (!c || c.t !== 'r') continue
      let [mx, my] = cellMitt(i)
      const sk = s.skak.get(i)
      if (sk != null) {
        const k = (t - sk) / 0.3
        if (k >= 1) s.skak.delete(i)
        else mx += Math.sin(k * 30) * (1 - k) * 4
      }
      let skal = 1
      const po = s.pop.get(i)
      if (po != null) {
        const k = (t - po) / 0.35
        if (k >= 1) s.pop.delete(i)
        else skal = 0.4 + 0.6 * Math.min(1, k * 1.6) + Math.sin(k * Math.PI) * 0.15
      }
      const fri = s.rorliga.has(i)
      if (fri && !s.klar) {
        // ljus fläck under fötterna på de som kan gå
        ctx.fillStyle = 'rgba(255, 240, 200, 0.14)'
        ctx.beginPath()
        ctx.ellipse(mx, my + cs * 0.3, cs * 0.34, cs * 0.12, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ritaResenar(ctx, mx, my, cs * skal, c.dold ? -1 : c.f, { dold: c.dold, is: c.is, t: t + i * 0.37, matt: !fri && !c.dold && !(c.is > 0) })
    }
  }

  function ritaResenar(ctx, x, y, storlek, f, { dold, is, sitter, matt, t = 0 } = {}) {
    const k = storlek / 40
    const bob = sitter || matt ? 0 : Math.sin(t * 2.2) * 0.8 * k
    // Instängda är lite mörkare och står still, så de som kan gå syns.
    const c = dold ? '#5b6478' : matt ? ljusare(farg(f), -0.3) : farg(f)
    // skugga
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(x, y + 12 * k, 10 * k, 3.5 * k, 0, 0, Math.PI * 2)
    ctx.fill()
    // kropp
    ctx.fillStyle = ljusare(c, -0.22)
    rundRekt(ctx, x - 9 * k, y - 4 * k + bob, 18 * k, 17 * k, 7 * k)
    ctx.fill()
    ctx.fillStyle = c
    rundRekt(ctx, x - 9 * k, y - 5 * k + bob, 18 * k, 14 * k, 7 * k)
    ctx.fill()
    // huvud
    ctx.fillStyle = dold ? '#7b8499' : matt ? '#b99a80' : HUD
    ctx.beginPath()
    ctx.arc(x, y - 10 * k + bob, 6.5 * k, 0, Math.PI * 2)
    ctx.fill()
    if (!dold) {
      ctx.fillStyle = '#2a1d14'
      ctx.beginPath()
      ctx.arc(x - 2.3 * k, y - 10.5 * k + bob, 1 * k, 0, Math.PI * 2)
      ctx.arc(x + 2.3 * k, y - 10.5 * k + bob, 1 * k, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = '#ffffff'
      ctx.font = `900 ${Math.round(12 * k)}px ui-rounded, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('?', x, y + 2 * k + bob)
    }
    if (is > 0) {
      ctx.fillStyle = 'rgba(170, 225, 255, 0.55)'
      rundRekt(ctx, x - 15 * k, y - 18 * k, 30 * k, 34 * k, 6 * k)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.moveTo(x - 10 * k, y - 14 * k)
      ctx.lineTo(x - 4 * k, y - 6 * k)
      ctx.moveTo(x + 6 * k, y + 2 * k)
      ctx.lineTo(x + 11 * k, y + 9 * k)
      ctx.stroke()
      ctx.fillStyle = '#0b3a5c'
      ctx.font = `900 ${Math.round(14 * k)}px ui-rounded, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(is), x, y + 1 * k)
    }
  }

  function ritaPlantering(ctx, x, y, i) {
    const k = cs / 40
    ctx.fillStyle = '#3d2f22'
    rundRekt(ctx, x - 17 * k, y - 15 * k, 34 * k, 32 * k, 6 * k)
    ctx.fill()
    const busk = ['#2f8f4e', '#3fae61', '#277a42']
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = busk[(b + i) % 3]
      ctx.beginPath()
      ctx.arc(x + [-7, 7, -4, 6][b] * k, y + [-5, -4, 5, 6][b] * k, 8 * k, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function ritaRulltrappa(ctx, x, y, c) {
    const k = cs / 40
    ctx.fillStyle = '#3a4560'
    rundRekt(ctx, x - 18 * k, y - 18 * k, 36 * k, 36 * k, 7 * k)
    ctx.fill()
    ctx.strokeStyle = '#6b7799'
    ctx.lineWidth = 2
    for (let s = -2; s <= 2; s++) {
      ctx.beginPath()
      if (c.dir % 2 === 0) {
        ctx.moveTo(x - 12 * k, y + s * 5 * k)
        ctx.lineTo(x + 12 * k, y + s * 5 * k)
      } else {
        ctx.moveTo(x + s * 5 * k, y - 12 * k)
        ctx.lineTo(x + s * 5 * k, y + 12 * k)
      }
      ctx.stroke()
    }
    // pil åt utgången
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    const ax = x + DX[c.dir] * 13 * k
    const ay = y + DY[c.dir] * 13 * k
    ctx.moveTo(ax + DX[c.dir] * 5 * k, ay + DY[c.dir] * 5 * k)
    ctx.lineTo(ax - DY[c.dir] * 5 * k, ay + DX[c.dir] * 5 * k)
    ctx.lineTo(ax + DY[c.dir] * 5 * k, ay - DX[c.dir] * 5 * k)
    ctx.fill()
    // antal kvar
    if (c.ko.length) {
      ctx.fillStyle = '#ff4d6d'
      ctx.beginPath()
      ctx.arc(x + 12 * k, y - 12 * k, 8 * k, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `900 ${Math.round(11 * k)}px ui-rounded, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(c.ko.length), x + 12 * k, y - 12 * k + 0.5)
    }
  }

  function ritaPropeller(ctx, x, y, t) {
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 2
    const v = t * 40
    ctx.beginPath()
    ctx.moveTo(x - Math.cos(v) * 12, y - Math.sin(v) * 2)
    ctx.lineTo(x + Math.cos(v) * 12, y + Math.sin(v) * 2)
    ctx.stroke()
  }

  const canvasRef = useSpelyta({ bredd: W, hojd: H, rita, uppdatera, ner })

  /* --------------------------------------------------------------- DOM */

  const s = a.current
  const kvarVagnar = bana.vagnar.length - spel.aktiv()
  const tid = Math.ceil(s.tidKvar)
  const kommande = bana.vagnar.slice(spel.aktiv() + 1, spel.aktiv() + 5)

  return (
    <div className="ds-rot hp-rot">
      <Topprad
        niva={aktivNiva}
        svar={bana.svar}
        mynt={mynt}
        hoger={null}
      >
        <span className={`ds-chip${tid <= 10 && s.tidIgang ? ' varm' : ''}`}>
          ⏱ <b>{Math.floor(tid / 60)}:{String(tid % 60).padStart(2, '0')}</b>
        </span>
      </Topprad>
      <div className="hp-info">
        <span className="hp-skylt">
          <span className="hp-h">H</span> {bana.namn}
        </span>
        <span className="hp-nasta">
          {kommande.length > 0 && <span className="hp-nasta-text">Sen:</span>}
          {kommande.map((f, i) => (
            <i key={i} style={{ background: farg(f) }} />
          ))}
          <span className="hp-kvar">
            <b>{kvarVagnar}</b> {kvarVagnar === 1 ? 'vagn' : 'vagnar'}
          </span>
        </span>
      </div>
      <div className="ds-yta hp-yta">
        <canvas ref={canvasRef} aria-label={`Hållplatsen bana ${aktivNiva}`} />
        <Banner svar={bana.svar} niva={`${aktivNiva}-${omgang}`} />
        <Notis notis={notis} />
        {vinst && (
          <Vinstkort
            resultat={vinst}
            ljud={ljud}
            boostInfo={BOOST}
            rader={vinst.bastaKombo >= 2 ? [[`Bästa kombo x${vinst.bastaKombo}`, `+${vinst.extra}`]] : []}
            onNasta={nasta}
            nastaText={`Mot ${hallplatsFor(sparRef.current.niva)}`}
          />
        )}
        {slut === 'bank' && (
          <Forlustkort
            titel="Bänken är full!"
            text="Ingen plats kvar att vänta på."
            ikon="🪑"
            mynt={mynt}
            fortsatt={spel.bank.length < 5 + MAX_EXTRA ? { text: 'Fortsätt med +1 plats', pris: FORTSATT_PLATS, onClick: fortsattPlats } : null}
            onIgen={forsokIgen}
          />
        )}
        {slut === 'tid' && (
          <Forlustkort
            titel="Tiden är ute!"
            text={`${kvarVagnar} ${kvarVagnar === 1 ? 'vagn' : 'vagnar'} kvar.`}
            ikon="⏰"
            mynt={mynt}
            fortsatt={{ text: 'Fortsätt med +30 s', pris: FORTSATT_TID, onClick: fortsattTid }}
            onIgen={forsokIgen}
          />
        )}
      </div>
      <div className="ds-boostrad kompakt">
        <BoostKnapp {...BOOST.plats} antal={spar.boost.plats || 0} mynt={mynt} onClick={plats} disabled={Boolean(vinst || slut)} />
        <BoostKnapp
          {...BOOST.lyft}
          antal={spar.boost.lyft || 0}
          mynt={mynt}
          onClick={() => {
            if (lyftLage) setLyftLage(false)
            else lyft()
          }}
          aktiv={lyftLage}
          disabled={Boolean(vinst || slut)}
        />
        <BoostKnapp {...BOOST.vinka} antal={spar.boost.vinka || 0} mynt={mynt} onClick={vinka} disabled={Boolean(vinst || slut)} />
      </div>
      <p className="ds-hjalp">Tryck på en resenär med fri väg upp. Rätt färg kliver på spårvagnen, fel färg får vänta på bänken. Tre per vagn.</p>
    </div>
  )
}
