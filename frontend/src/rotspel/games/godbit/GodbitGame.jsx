import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { skapaSpel, W, H, STEG, BUBBLA_R, FYSIK, MUN_R, GODBIT_R } from './motor.js'
import { BANOR, ANTAL_BANOR, PER_VARLD, LAS_UPP, hamtaBana, varldFor, kortNamn, totalStjarnor, oppen } from './banor.js'
import * as R from './rita.js'
import { skapaGodbitLjud } from './ljud.js'
import { useSpelyta } from '../delat/useSpelyta.js'
import { skapaFx, rundRekt } from '../delat/fx.js'
import { useSpar, useMynt, belona, betala, skickaNiva } from '../delat/meta.js'
import { Vinstkort, Notis, useNotis, MyntChip, Mynt } from '../delat/Ui.jsx'
import { ALBUM_CAPTIONS } from '../revir/config.js'
import './godbit.css'

// Godbiten — Cut the Rope med Happy.
//
// Godbiten hänger i rep. Dra fingret över repen för att klippa dem, så att
// godbiten svänger, flyger och landar i munnen på Happy. Tre stjärnor per
// bana. Happy följer godbiten med blicken, gapar när den kommer nära, mumsar
// när den landar och blir ledsen när den försvinner — då börjar banan om
// direkt. Stjärnorna låser upp nya världar, och i några banor gömmer sig
// ett foto på Happy som man kan hitta.
//
// Tipset spelar upp lösningen (motorn är deterministisk, så samma drag vid
// samma tid ger alltid samma resultat) och sedan är det spelarens tur.
// Sista biten innan godbiten landar går i slow motion.

const ID = 'godbiten'
const START = { niva: 1, banor: {}, svit: 0, kista: 0, boost: { tips: 3 }, foton: [] }
const TIPS_PRIS = 30
const BOOST = { tips: { ikon: '💡', namn: 'Tips', pris: TIPS_PRIS } }

const FILER = import.meta.glob('../revir/album/*.{webp,jpg,jpeg,png}', { eager: true, import: 'default' })
const FOTON = Object.keys(FILER)
  .sort()
  .map((k) => {
    const fil = k.split('/').pop()
    return { fil, src: FILER[k], namn: ALBUM_CAPTIONS[fil] || fil.replace(/^\d+-/, '').replace(/\.\w+$/, '') }
  })

// Banor med ett gömt foto, och vilket foto.
const GOMDA = BANOR.map((b, i) => (b.foto ? i + 1 : 0)).filter(Boolean)
const fotoFor = (nr) => FOTON[GOMDA.indexOf(nr) % Math.max(1, FOTON.length)]

const klamp = (v, a, b) => (v < a ? a : v > b ? b : v)

export default function GodbitGame() {
  const [spar, setSpar, sparRef] = useSpar('godbiten-v1', START)
  const mynt = useMynt()
  const ljud = useMemo(() => skapaGodbitLjud(), [])
  useEffect(() => () => ljud.stang(), [ljud])
  const fx = useMemo(() => skapaFx(), [])

  const [nr, setNr] = useState(() => {
    const n = Math.max(1, Math.min(ANTAL_BANOR, spar.niva || 1))
    return oppen(n, spar.banor) ? n : 1
  })
  const [omgang, setOmgang] = useState(0)
  const bana = useMemo(() => hamtaBana(nr), [nr])
  const varld = varldFor(nr)
  const spel = useMemo(() => skapaSpel(bana), [bana, omgang]) // eslint-disable-line react-hooks/exhaustive-deps
  const [, rendera] = useReducer((x) => x + 1, 0)
  const [vinst, setVinst] = useState(null)
  const [karta, setKarta] = useState(false)
  const [album, setAlbum] = useState(false)
  const [foto, setFoto] = useState(null)
  const [notis, visaNotis] = useNotis()

  const a = useRef(null)
  // Ska nästa försök vara en uppspelning av lösningen? { nr, omgang, riktig }
  // (riktig = som om spelaren gjorde dragen, bara för testerna)
  const demoFor = useRef(null)
  if (!a.current || a.current.spel !== spel) {
    a.current = nyttLage(spel)
    const d = demoFor.current
    if (d && d.nr === nr && d.omgang === omgang && bana.losning) a.current.demo = { plan: bana.losning, i: 0, riktig: d.riktig }
  }
  function nyttLage(sp) {
    return {
      spel: sp,
      t: 0,
      acc: 0,
      svep: null,
      spar: [], // fingrets spår
      happy: { mun: 0, blick: [0, 0], blink: 0, nastaBlink: 2, ledsen: 0, glad: 0, tugga: 0, mumsT: -10 },
      omstart: 0,
      vinstVid: 0,
      demo: null, // { plan, i, riktig } när lösningen spelas upp
      demoSlut: 0,
      slow: 0, // slow motion till den här tiden
      slowKlar: false,
      narmast: Infinity, // närmaste avstånd till munnen (för "Så nära!")
      stjarnPop: [], // HUD-stjärnor som fylls
      dump: 0,
    }
  }

  // ny bana eller nytt försök
  useEffect(() => {
    fx.tom()
    setVinst(null)
    if (a.current.demo && !a.current.demo.riktig) visaNotis('Så här gör man. Tryck när du vill spela själv.', 3000)
    else if (omgang === 0 && bana.tips) {
      const id = setTimeout(() => visaNotis(bana.tips, 3200), 500)
      return () => clearTimeout(id)
    }
  }, [spel]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // för webbläsartesterna: auto() spelar lösningen som om spelaren gjorde det
    if (import.meta.env.DEV)
      window.__godbit = {
        spel,
        bana,
        a: a.current,
        nr,
        auto: () => {
          demoFor.current = { nr, omgang: omgang + 1, riktig: true }
          setOmgang(omgang + 1)
        },
      }
  })

  /* --------------------------------------------------------------- händelser */

  function hantera(lista) {
    const s = a.current
    for (const e of lista) {
      switch (e.typ) {
        case 'klipp':
          ljud.klipp()
          fx.sprut(e.x, e.y, ['#fff7e0', '#d9b07a'], 8, { fart: 110, liv: 0.3, form: 'gnista', gravitation: 200, storlek: 2 })
          break
        case 'krok':
          ljud.krok()
          fx.ring(e.x, e.y, '#7dd3fc', 40, 0.4, 3)
          break
        case 'stjarna': {
          ljud.stjarna(e.nr)
          fx.sprut(e.x, e.y, ['#fff6b8', '#ffd43b', '#ffffff'], 18, { fart: 200, liv: 0.6, form: 'stjarna', storlek: 2.6 })
          fx.ring(e.x, e.y, '#ffe08a', 34, 0.4, 3)
          s.stjarnPop.push(s.t)
          rendera()
          break
        }
        case 'stjarnaBorta':
          ljud.stjarnaBorta()
          fx.sprut(e.x, e.y, ['#cbd5e1', '#ffffff'], 10, { fart: 80, liv: 0.5, form: 'cirkel', gravitation: -40 })
          break
        case 'bubbla':
          ljud.bubbla()
          break
        case 'pop':
          ljud.pop()
          fx.sprut(e.x, e.y, ['#e0f2fe', '#bae6fd', '#ffffff'], 14, { fart: 160, liv: 0.35, form: 'cirkel', storlek: 2.2 })
          fx.ring(e.x, e.y, '#e0f2fe', BUBBLA_R + 10, 0.25, 2)
          break
        case 'puff':
          ljud.puff()
          break
        case 'studs':
          ljud.studs()
          break
        case 'hatt':
          ljud.hatt()
          fx.sprut(e.fran[0], e.fran[1], ['#fde68a', '#c4b5fd', '#ffffff'], 14, { fart: 140, liv: 0.5, form: 'stjarna' })
          fx.sprut(e.till[0], e.till[1], ['#fde68a', '#c4b5fd', '#ffffff'], 14, { fart: 140, liv: 0.5, form: 'stjarna' })
          break
        case 'ekorreFaller':
          ljud.ekorre()
          break
        case 'gravitation':
          ljud.gravitation()
          fx.skaka(4)
          break
        case 'mums':
          mums(e)
          break
        case 'forlust':
          tappad(e)
          break
        default:
          break
      }
    }
  }

  function mums(e) {
    const s = a.current
    s.happy.mumsT = s.t
    s.happy.tugga = 1
    ljud.mums()
    setTimeout(() => ljud.voff(), 520)
    fx.sprut(e.x, e.y + 4, ['#d9a560', '#f6d49a', '#a8723a'], 14, { fart: 120, liv: 0.6, storlek: 2.2 })
    fx.skaka(3)
    if (e.stjarnor === 3) fx.konfetti(W / 2, H * 0.7, 80, W)
    if (s.demo && !s.demo.riktig) s.demoSlut = s.t + 1.4
    else s.vinstVid = s.t + 1.5
  }

  function tappad(e) {
    const s = a.current
    s.happy.ledsen = 1
    ljud.gnall()
    if (e.orsak === 'tagg') {
      fx.sprut(e.x, e.y, ['#d9a560', '#f6d49a', '#7d4f23'], 22, { fart: 220, liv: 0.6, storlek: 2.6 })
      fx.skaka(5)
      fx.text(e.x, e.y - 20, 'Krasch!', { farg: '#ffffff', storlek: 18, liv: 0.9 })
    } else if (e.orsak === 'ekorre') {
      fx.text(W / 2, H * 0.4, 'Ekorren tog den!', { farg: '#ffffff', storlek: 20, liv: 1.2 })
    }
    // nästan i munnen? Då ska det kännas att nästa försök sitter.
    if (s.narmast < 60 && e.orsak !== 'ekorre') {
      const upp = spel.happy.upp
      fx.text(spel.happy.x, spel.happy.y + (upp ? 70 : -70), 'Så nära!', { farg: '#ffe08a', storlek: 22, liv: 1.3 })
    }
    s.omstart = s.t + 1.5
  }

  /* --------------------------------------------------------------- styrning */

  const overlagg = karta || album || vinst || foto
  function ner(p) {
    const s = a.current
    if (overlagg) return
    // under uppspelningen: tryck för att spela själv direkt
    if (s.demo && !s.demo.riktig) {
      igen()
      return
    }
    if (spel.status() !== 'spelar') {
      // efter en tappad godbit: tryck för att börja om direkt
      if (spel.status() === 'forlorat') igen()
      return
    }
    // gömt foto?
    if (bana.foto && !(sparRef.current.foton || []).includes(nr) && Math.hypot(p.x - bana.foto.x, p.y - bana.foto.y) < 24) {
      hittaFoto()
      return
    }
    if (spel.tryck(p.x, p.y)) hantera(spel.tomHandelser())
    s.svep = { x: p.x, y: p.y }
    s.spar = [{ x: p.x, y: p.y, t: s.t }]
  }

  function flytta(p) {
    const s = a.current
    if (!s.svep || overlagg) return
    if (Math.hypot(p.x - s.svep.x, p.y - s.svep.y) < 2) return
    if (spel.klipp(s.svep.x, s.svep.y, p.x, p.y)) hantera(spel.tomHandelser())
    s.svep = { x: p.x, y: p.y }
    s.spar.push({ x: p.x, y: p.y, t: s.t })
    if (s.spar.length > 24) s.spar.shift()
  }

  function upp() {
    a.current.svep = null
  }

  function igen() {
    setOmgang((o) => o + 1)
  }

  function hittaFoto() {
    const f = fotoFor(nr)
    if (!f) return
    setSpar((sp) => ({ ...sp, foton: [...new Set([...(sp.foton || []), nr])] }))
    ljud.hittat()
    fx.konfetti(bana.foto.x, bana.foto.y, 40, 120)
    setFoto(f)
  }

  function visaTips() {
    if (!bana.losning || overlagg) return
    const har = sparRef.current.boost?.tips || 0
    if (har > 0) setSpar((sp) => ({ ...sp, boost: { ...sp.boost, tips: (sp.boost?.tips || 0) - 1 } }))
    else if (!betala(TIPS_PRIS)) {
      visaNotis('För få mynt', 1400)
      return
    }
    // tipset spelar upp lösningen från början, sedan är det din tur
    ljud.booster()
    demoFor.current = { nr, omgang: omgang + 1, riktig: false }
    setOmgang(omgang + 1)
  }

  /* --------------------------------------------------------------- vinst */

  function visaVinst() {
    const stj = spel.tagna()
    const fore = sparRef.current.banor?.[nr] ?? null
    const { spar: ny, resultat } = belona(sparRef.current, {
      gameId: null,
      niva: nr,
      perfekt: stj === 3,
      extra: stj * 3,
      boostTyper: ['tips'],
    })
    const banor = { ...(sparRef.current.banor || {}), [nr]: Math.max(fore ?? 0, stj) }
    const totalt = totalStjarnor(banor)
    const nasta = Math.min(ANTAL_BANOR, nr + 1)
    setSpar({ ...ny, banor, niva: oppen(nasta, banor) ? nasta : nr, basta: Math.max(sparRef.current.basta || 0, nr) })
    if ((fore ?? -1) < stj) skickaNiva(ID, totalt)
    // låstes en ny värld upp?
    const nyVarld = LAS_UPP.findIndex((g, i) => i > 0 && totalStjarnor(sparRef.current.banor) < g && totalt >= g)
    setVinst({ resultat, stj, fore, totalt, nyVarld, nastaOppen: nr < ANTAL_BANOR && oppen(nr + 1, banor), sista: nr === ANTAL_BANOR })
  }

  function nasta() {
    setVinst(null)
    if (nr < ANTAL_BANOR && oppen(nr + 1, sparRef.current.banor)) {
      setNr(nr + 1)
      setOmgang(0)
    } else setKarta(true)
  }

  function valj(n) {
    setKarta(false)
    setVinst(null)
    if (n === nr) setOmgang((o) => o + 1)
    else {
      setNr(n)
      setOmgang(0)
    }
  }

  /* --------------------------------------------------------------- loopen */

  // Uppspelningen gör dragen på exakt rätt tid i motorn, och visar dem som
  // ett finger som sveper eller trycker.
  function korDemo(s) {
    const d = s.demo
    while (d.i < d.plan.length && d.plan[d.i].t <= spel.t() + 1e-9) {
      const x = d.plan[d.i++]
      if (x.typ === 'klipp') {
        const r = spel.rep.find((q) => q.id === x.id && q.aktiv)
        if (r) {
          const m = r.kedja[Math.max(0, Math.floor(r.kedja.length / 2) - 1)]
          const n = r.kedja[Math.floor(r.kedja.length / 2)] || m
          const L = Math.hypot(n.x - m.x, n.y - m.y) || 1
          const [nx, ny] = [-(n.y - m.y) / L, (n.x - m.x) / L]
          for (let k = -1; k <= 1; k += 0.25) s.spar.push({ x: m.x + nx * 28 * k, y: m.y + ny * 28 * k, t: s.t + (k + 1) * 0.02 })
        }
        spel.klippRep(x.id)
      } else if (x.typ === 'pop') {
        fx.ring(spel.godbit.x, spel.godbit.y, '#ffffff', 30, 0.35, 3)
        spel.pop()
      } else if (x.typ === 'puff') {
        const k = spel.kuddar[x.id]
        if (k) fx.ring(k.x, k.y, '#ffffff', 30, 0.35, 3)
        spel.puffa(x.id)
      } else if (x.typ === 'knapp') {
        if (spel.knapp) fx.ring(spel.knapp.x, spel.knapp.y, '#ffffff', 30, 0.35, 3)
        spel.knappa()
      }
    }
  }

  // Är godbiten på väg rakt in i munnen (fri, ingen bubbla, inom en kvarts sekund)?
  function traffSnart(sp) {
    const g = sp.godbit
    if (sp.status() !== 'spelar' || g.bubbla >= 0 || sp.aktivaRep().length) return false
    const ay = FYSIK.G * sp.grav()
    const h = sp.happy
    for (let tau = 0.01; tau <= 0.25; tau += 0.01) {
      const x = g.x + g.vx * tau
      const y = g.y + g.vy * tau + 0.5 * ay * tau * tau
      if (Math.hypot(x - h.x, y - h.y) < MUN_R + GODBIT_R * 0.6) return true
    }
    return false
  }

  function uppdatera(dt) {
    const s = a.current
    s.t += dt
    fx.uppdatera(dt)
    if (!overlagg && !fx.fryst()) {
      s.acc += dt * (s.slow > s.t ? 0.3 : 1)
      let n = 0
      while (s.acc >= STEG && n < 8) {
        s.acc -= STEG
        n++
        if (s.demo) korDemo(s)
        const h = spel.steg(STEG)
        if (h.length) hantera(h)
        const g = spel.godbit
        // hur nära munnen den varit nyligen (glöms bort med 80 px/s)
        if (g.kvar) s.narmast = Math.min(s.narmast + STEG * 80, Math.hypot(g.x - spel.happy.x, g.y - spel.happy.y))
        if (!s.slowKlar && traffSnart(spel)) {
          s.slowKlar = true
          s.slow = s.t + 0.5
        }
      }
      if (n >= 8) s.acc = 0
    }
    // Happys ansikte
    const hp = s.happy
    const g = spel.godbit
    const upp = spel.happy.upp
    const hx = spel.happy.x
    const hy = spel.happy.y + (upp ? 22 : -22) * 0.9
    if (g.kvar) {
      const d = Math.hypot(g.x - spel.happy.x, g.y - spel.happy.y)
      const mal = klamp((175 - d) / 125, 0, 1)
      hp.mun += (mal - hp.mun) * (1 - Math.exp(-dt * 10))
      const bx = (g.x - hx) / 70
      const by = (g.y - hy) / 70
      const mx = upp ? -bx : bx
      const my = upp ? -by : by
      hp.blick[0] += (klamp(mx, -1, 1) - hp.blick[0]) * (1 - Math.exp(-dt * 12))
      hp.blick[1] += (klamp(my, -1, 1) - hp.blick[1]) * (1 - Math.exp(-dt * 12))
    } else hp.mun += (0 - hp.mun) * (1 - Math.exp(-dt * 8))
    hp.nastaBlink -= dt
    if (hp.nastaBlink <= 0) {
      hp.blink = 1
      hp.nastaBlink = 2 + Math.random() * 3
    }
    hp.blink = Math.max(0, hp.blink - dt * 7)
    if (hp.mumsT > -1) {
      const k = s.t - hp.mumsT
      hp.tugga = k < 1.1 ? 0.5 + 0.5 * Math.sin(k * 26) : 0
      hp.glad = k < 2.4 ? 1 : 0.4
      if (k > 0.3 && k < 1.6 && Math.random() < dt * 5) fx.text(hx + (Math.random() - 0.5) * 50, hy - 40, '♥', { farg: '#ff6b8a', storlek: 16, liv: 1, stig: 40 })
    }
    if (s.omstart && s.t >= s.omstart) {
      s.omstart = 0
      igen()
    }
    if (s.vinstVid && s.t >= s.vinstVid) {
      s.vinstVid = 0
      visaVinst()
    }
    if (s.demoSlut && s.t >= s.demoSlut) {
      s.demoSlut = 0
      visaNotis('Nu är det din tur!', 1600)
      igen()
    }
    s.spar = s.spar.filter((p) => s.t - p.t < 0.25)
  }

  /* --------------------------------------------------------------- ritning */

  function rita(ctx) {
    const s = a.current
    const t = s.t
    ctx.save()
    ctx.translate(fx.skakX(), fx.skakY())
    // slow motion: zooma in lite mot Happy
    if (s.slow > t) {
      const k = Math.sin(Math.PI * klamp(1 - (s.slow - t) / 0.5, 0, 1))
      const z = 1 + 0.07 * k
      ctx.translate(spel.happy.x, spel.happy.y)
      ctx.scale(z, z)
      ctx.translate(-spel.happy.x, -spel.happy.y)
    }
    ctx.drawImage(R.bakgrund(varld), 0, 0, W, H)

    // gömt foto: en liten tass som syns om man tittar noga
    if (bana.foto && !(spar.foton || []).includes(nr)) {
      ctx.globalAlpha = 0.18 + Math.sin(t * 2) * 0.06
      ctx.fillStyle = '#5b3a20'
      ctx.font = '18px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🐾', bana.foto.x, bana.foto.y)
      ctx.globalAlpha = 1
    }

    for (const st of spel.studs) R.ritaStuds(ctx, st, t)
    for (const tg of spel.taggar) R.ritaTaggar(ctx, tg)
    for (const h of spel.hattar) {
      R.ritaHatt(ctx, h.a, t, 0)
      R.ritaHatt(ctx, h.b, t, 0)
    }
    for (const k of spel.kuddar) R.ritaKudde(ctx, k, t)
    if (spel.knapp) R.ritaKnapp(ctx, spel.knapp, spel.grav(), t)

    // rep: avklippta bitar tonar bort
    for (const r of spel.rep) {
      if (r.aktiv) R.ritaRep(ctx, r.kedja, r.strackt)
      else if (r.delar) {
        const k = (spel.t() - r.delar.t0) / 1.2
        if (k < 1) {
          R.ritaRep(ctx, r.delar.a, false, 1 - k)
          R.ritaRep(ctx, r.delar.b, false, 1 - k)
        }
      }
    }
    for (const r of spel.rep) if (r.kalla === 'start') R.ritaSpik(ctx, r.ax, r.ay)
    for (const k of spel.krokar) R.ritaKrok(ctx, k, t)

    for (const st of spel.stjarnor) R.ritaStjarna(ctx, st, t)

    const hp = s.happy
    R.ritaHappy(ctx, spel.happy.x, spel.happy.y, { t, mun: hp.mun, blick: hp.blick, blink: hp.blink, ledsen: hp.ledsen, glad: hp.glad, tugga: hp.tugga, upp: spel.happy.upp })

    const g = spel.godbit
    if (g.kvar || spel.status() === 'spelar') {
      R.ritaGodbit(ctx, g.x, g.y, g.rot)
      if (g.bubbla >= 0) R.ritaBubbla(ctx, g.x, g.y, t, true)
    }
    for (const b of spel.bubblor) if (!b.borta) R.ritaBubbla(ctx, b.x, b.y, t, false)
    for (const e of spel.ekorrar) R.ritaEkorre(ctx, e, t)

    // uppspelningen: nästa drag lyser upp strax innan det görs
    if (s.demo && !s.demo.riktig) ritaDemo(ctx, t)

    // fingrets spår
    if (s.spar.length > 1) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 1; i < s.spar.length; i++) {
        const p0 = s.spar[i - 1]
        const p1 = s.spar[i]
        const k = 1 - (t - p1.t) / 0.25
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * k})`
        ctx.lineWidth = 2 + 5 * k * (i / s.spar.length)
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
      }
    }

    fx.rita(ctx)
    ctx.restore()

    // under uppspelningen: en liten skylt i hörnet
    if (s.demo && !s.demo.riktig) {
      ctx.fillStyle = 'rgba(10,10,25,0.6)'
      rundRekt(ctx, 8, H - 34, 108, 24, 12)
      ctx.fill()
      text(ctx, '💡 Lösningen', 62, H - 22, 12, '#ffe08a')
    }

    if (spel.status() === 'forlorat' && s.omstart) {
      ctx.fillStyle = 'rgba(10,10,25,0.25)'
      ctx.fillRect(0, 0, W, H)
      text(ctx, 'Hoppsan!', W / 2, H * 0.42, 30, '#ffffff')
      text(ctx, 'Tryck för att börja om', W / 2, H * 0.42 + 30, 13, 'rgba(255,255,255,0.85)')
    }
  }

  function ritaDemo(ctx, t) {
    const d = a.current.demo
    const nasta = d.plan[d.i]
    if (!nasta || nasta.t - spel.t() > 0.7) return
    let x
    let y
    if (nasta.typ === 'klipp') {
      const r = spel.rep.find((q) => q.id === nasta.id && q.aktiv)
      if (r) ({ x, y } = r.kedja[Math.floor(r.kedja.length / 2)])
    } else if (nasta.typ === 'puff') ({ x, y } = spel.kuddar[nasta.id])
    else if (nasta.typ === 'pop') ({ x, y } = spel.godbit)
    else if (nasta.typ === 'knapp' && spel.knapp) ({ x, y } = spel.knapp)
    if (x == null) return
    // en ring som drar ihop sig till draget
    const k = klamp((nasta.t - spel.t()) / 0.7, 0, 1)
    ctx.save()
    ctx.strokeStyle = `rgba(255,255,255,${0.9 - k * 0.5})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, 14 + k * 30, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    text(ctx, nasta.typ === 'klipp' ? '✂' : '👆', x, y - 30 - k * 10, 18, '#ffffff')
  }

  function text(ctx, txt, x, y, storlek, farg, kant = 'rgba(0,0,0,0.6)') {
    ctx.font = `900 ${storlek}px ui-rounded, "Outfit Variable", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(3, storlek * 0.2)
    ctx.strokeStyle = kant
    ctx.strokeText(txt, x, y)
    ctx.fillStyle = farg
    ctx.fillText(txt, x, y)
  }

  const canvasRef = useSpelyta({ bredd: W, hojd: H, rita, uppdatera, ner, flytta, upp, avbryt: upp })

  /* --------------------------------------------------------------- HUD */

  const tagna = spel.tagna()
  const s = a.current
  const tipsAntal = spar.boost?.tips || 0
  return (
    <div className="ds-rot gb-rot">
      <header className="gb-topp">
        <button className="gb-ikonknapp" onClick={() => setKarta(true)} aria-label="Alla banor">
          ☰
        </button>
        <div className="gb-titel">
          <b>
            {kortNamn(nr)} · {bana.namn}
          </b>
          <small>
            {R.VARLDAR[varld].ikon} {R.VARLDAR[varld].namn}
          </small>
        </div>
        <div className="gb-stjarnor" aria-label={`${tagna} av 3 stjärnor`}>
          {[0, 1, 2].map((i) => (
            <span key={i + '-' + (i < tagna ? s.stjarnPop.length : 0)} className={i < tagna ? 'pa' : ''}>
              ★
            </span>
          ))}
        </div>
        <MyntChip mynt={mynt} />
      </header>

      <div className="ds-yta gb-yta">
        <canvas ref={canvasRef} aria-label={`Godbiten bana ${kortNamn(nr)}`} />
        <Notis notis={notis} />
      </div>

      <div className="gb-reglage">
        <button className="gb-knapp" onClick={igen} aria-label="Börja om banan">
          ↻ Igen
        </button>
        <button className="gb-knapp tips" onClick={visaTips} disabled={!bana.losning}>
          💡 Tips
          <span className="gb-pris">
            {tipsAntal > 0 ? (
              tipsAntal
            ) : (
              <>
                <Mynt /> {TIPS_PRIS}
              </>
            )}
          </span>
        </button>
        <button className="gb-knapp" onClick={() => setAlbum(true)} aria-label="Hittade foton">
          📷 {(spar.foton || []).length}/{GOMDA.length}
        </button>
      </div>

      {karta && <Karta spar={spar} nu={nr} onValj={valj} onStang={() => setKarta(false)} />}
      {album && <Album hittade={spar.foton || []} onStang={() => setAlbum(false)} />}
      {foto && (
        <div className="ds-kort-bak" role="dialog" aria-modal="true" onClick={() => setFoto(null)}>
          <div className="ds-kort gb-foto">
            <div className="ds-kort-titel">Hittat!</div>
            <img src={foto.src} alt={foto.namn} />
            <div className="ds-kort-sub">{foto.namn}</div>
            <button className="ds-knapp ds-knapp-stor" onClick={() => setFoto(null)}>
              Fortsätt
            </button>
          </div>
        </div>
      )}
      {vinst && (
        <Vinstkort
          resultat={vinst.resultat}
          titel={vinst.stj === 3 ? 'Mums!' : vinst.stj === 0 ? 'Mätt!' : 'Gott!'}
          ljud={ljud}
          boostInfo={BOOST}
          onNasta={nasta}
          nastaText={vinst.nastaOppen ? 'Nästa bana' : 'Till kartan'}
          rader={vinst.stj ? [['Stjärnor', `+${vinst.stj * 3}`]] : []}
          barn={<Stjarnrad vinst={vinst} ljud={ljud} onIgen={() => valj(nr)} onKarta={() => { setVinst(null); setKarta(true) }} />}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ delar */

function Stjarnrad({ vinst, ljud, onIgen, onKarta }) {
  const [visade, setVisade] = useState(0)
  useEffect(() => {
    const ids = []
    for (let i = 0; i < vinst.stj; i++)
      ids.push(
        setTimeout(() => {
          setVisade(i + 1)
          ljud.stjarna(i + 1)
        }, 300 + i * 300)
      )
    return () => ids.forEach(clearTimeout)
  }, [vinst.stj, ljud])
  return (
    <div className="gb-vinst">
      <div className="gb-vinst-stj">
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < visade ? 'pa' : ''}>
            ★
          </span>
        ))}
      </div>
      {vinst.fore != null && vinst.stj <= vinst.fore && vinst.fore > 0 && <div className="gb-vinst-text">Ditt bästa: {'★'.repeat(vinst.fore)}</div>}
      {vinst.stj < 3 && <div className="gb-vinst-text">Kan du ta alla tre?</div>}
      {vinst.nyVarld > 0 && (
        <div className="gb-vinst-ny">
          {R.VARLDAR[vinst.nyVarld].ikon} {R.VARLDAR[vinst.nyVarld].namn} är upplåst!
        </div>
      )}
      <div className="gb-vinst-knappar">
        <button className="gb-liten" onClick={onIgen}>
          ↻ Igen
        </button>
        <button className="gb-liten" onClick={onKarta}>
          ☰ Banor
        </button>
      </div>
    </div>
  )
}

function Karta({ spar, nu, onValj, onStang }) {
  const banor = spar.banor || {}
  const totalt = totalStjarnor(banor)
  const antalVarldar = Math.ceil(ANTAL_BANOR / PER_VARLD)
  return (
    <div className="ds-kort-bak gb-karta-bak" role="dialog" aria-modal="true" aria-label="Alla banor">
      <div className="gb-karta">
        <div className="gb-karta-topp">
          <div>
            <b>Happys äventyr</b>
            <small>
              ★ {totalt} av {ANTAL_BANOR * 3}
            </small>
          </div>
          <button className="gb-stang" onClick={onStang} aria-label="Stäng">
            ✕
          </button>
        </div>
        <div className="gb-karta-lista">
          {Array.from({ length: antalVarldar }, (_, v) => {
            const info = R.VARLDAR[v]
            const last = totalt < LAS_UPP[v]
            const stj = Array.from({ length: PER_VARLD }, (_, k) => banor[v * PER_VARLD + k + 1] || 0).reduce((s, n) => s + n, 0)
            return (
              <section key={info.id} className={`gb-varld${last ? ' last' : ''}`} style={{ '--v1': info.farg[0], '--v2': info.farg[1] }}>
                <header>
                  <span className="gb-varld-ikon" aria-hidden="true">
                    {info.ikon}
                  </span>
                  <div>
                    <b>{info.namn}</b>
                    <small>{last ? `🔒 Behöver ${LAS_UPP[v]} ★ — du har ${totalt}` : `${info.text} · ★ ${stj}/${PER_VARLD * 3}`}</small>
                  </div>
                </header>
                <div className="gb-banknappar">
                  {Array.from({ length: PER_VARLD }, (_, k) => {
                    const n = v * PER_VARLD + k + 1
                    if (n > ANTAL_BANOR) return null
                    const ok = oppen(n, banor)
                    const st = banor[n]
                    return (
                      <button key={n} className={`gb-bank${n === nu ? ' nu' : ''}`} disabled={!ok} onClick={() => onValj(n)} title={hamtaBana(n).namn}>
                        <span className="gb-bank-nr">{ok ? k + 1 : '🔒'}</span>
                        <span className="gb-bank-stj">
                          {[0, 1, 2].map((i) => (
                            <i key={i} className={st != null && i < st ? 'pa' : ''}>
                              ★
                            </i>
                          ))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Album({ hittade, onStang }) {
  return (
    <div className="ds-kort-bak gb-karta-bak" role="dialog" aria-modal="true" aria-label="Hittade foton">
      <div className="gb-karta">
        <div className="gb-karta-topp">
          <div>
            <b>Hemliga foton</b>
            <small>
              {hittade.length} av {GOMDA.length} — leta efter en liten tass 🐾 i banorna
            </small>
          </div>
          <button className="gb-stang" onClick={onStang} aria-label="Stäng">
            ✕
          </button>
        </div>
        <div className="gb-album">
          {GOMDA.map((n) => {
            const f = fotoFor(n)
            const har = hittade.includes(n)
            return (
              <figure key={n} className={har ? '' : 'last'} title={har ? f?.namn : `Gömt i bana ${kortNamn(n)}`}>
                {har && f ? <img src={f.src} alt={f.namn} /> : <span>{kortNamn(n)}</span>}
              </figure>
            )
          })}
        </div>
      </div>
    </div>
  )
}

