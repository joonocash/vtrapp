import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { skapaSpel, REGNBAGE, SLOTS, MAX_KAP } from './engine.js'
import { byggBana, HAPPY_VAR } from './banor.js'
import { PALETT, BILDER, HAPPY } from './bilder.js'
import { useSpelyta } from '../delat/useSpelyta.js'
import { skapaLjud } from '../delat/ljud.js'
import { skapaFx, rundRekt, ljusare, easeOut, lerp } from '../delat/fx.js'
import { slump, blanda } from '../delat/rng.js'
import { useSpar, useMynt, belona, forlust, betala } from '../delat/meta.js'
import { Topprad, BoostKnapp, Banner, Vinstkort, Forlustkort, Notis, useNotis } from '../delat/Ui.jsx'
import { ALBUM_CAPTIONS } from '../revir/config.js'
import foto17 from '../revir/album/17-snopromenad.webp'
import foto15 from '../revir/album/15-rodhalsduk.webp'
import foto04 from '../revir/album/04-kandisen.webp'
import foto23 from '../revir/album/23-angsvandring.webp'
import './pixel.css'

// Pixelkanon — Pixel Flow i Rötspel.
// Tryck på grisen längst fram i en kö så åker den ett varv runt bilden och
// skjuter på kuber i sin färg. Grisar med ammo kvar sätter sig i
// väntplatserna. Fulla platser när en gris kommer runt = slut.
//
// Utöver originalet, för dopaminet: kuberna flyger iväg när de träffas,
// kombomätare som klättrar i tonhöjd, "Rött klart!" när en färg är borta,
// guldkuber som ger mynt, och Superenhörningen som laddas av träffar och
// sveper runt bilden och skjuter på allt.

const ID = 'pixelkanon'
const W = 360
const H = 610
const BRADE = 264
const BELT = 20
const SLOT_Y = 356
const KO_Y = 420
const KO_STEG = 48
const MAX_EXTRA = 2
const ENHORNING_MAX = 120 // träffar för en full mätare
const ENHORNING_AMMO = 36
const GULD_MYNT = 5
const FARG_MYNT = 2
const FOTON = { '17-snopromenad.webp': foto17, '15-rodhalsduk.webp': foto15, '04-kandisen.webp': foto04, '23-angsvandring.webp': foto23 }
const START = { niva: 1, basta: 0, svit: 0, kista: 0, boost: { hand: 1, bricka: 1, super: 1 }, galleri: [], enhorning: 0 }
const BOOST = {
  hand: { ikon: '🖐', namn: 'Handen', pris: 90 },
  bricka: { ikon: '🛹', namn: '+1 band', pris: 80 },
  super: { ikon: '💥', namn: 'Supergris', pris: 150 },
}
const FORTSATT_PRIS = 80
const KOMBO_ORD = [
  [15, 'Snyggt!'],
  [30, 'Grymt!'],
  [50, 'Galet!'],
  [80, 'PIXELREGN!'],
  [120, 'OSTOPPBAR!'],
]
const RB = ['#ff4d6d', '#ff9f43', '#ffd43b', '#5bd96b', '#4dabf7', '#9b7bff']
// "Rött klart!" — färgnamnen i neutrum.
const NEUTRUM = {
  vit: 'Vitt', ljusgrå: 'Ljusgrått', grå: 'Grått', svart: 'Svart', röd: 'Rött', mörkröd: 'Mörkrött', rosa: 'Rosa',
  ljusrosa: 'Ljusrosa', orange: 'Orange', gul: 'Gult', beige: 'Beige', brun: 'Brunt', mörkbrun: 'Mörkbrunt', lime: 'Lime',
  grön: 'Grönt', mörkgrön: 'Mörkgrönt', turkos: 'Turkos', ljusblå: 'Ljusblått', blå: 'Blått', mörkblå: 'Mörkblått',
  lila: 'Lila', ljuslila: 'Ljuslila',
}

const hex = (f) => (f === REGNBAGE ? '#ffffff' : PALETT[f]?.hex ?? '#888')
// Ljus text får mörk kant och tvärtom, så "Vitt klart!" syns också.
const ljus = (h) => {
  const n = parseInt(h.slice(1), 16)
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 150
}

export default function PixelGame() {
  const [spar, setSpar] = useSpar('pixelkanon-v1', START)
  const sparRef = useRef(spar)
  sparRef.current = spar
  const mynt = useMynt()
  const ljud = useMemo(() => skapaLjud(), [])
  useEffect(() => () => ljud.stang(), [ljud])
  const fx = useMemo(() => skapaFx(), [])

  const [aktivNiva, setAktivNiva] = useState(spar.niva)
  const [omgang, setOmgang] = useState(0)
  const bana = useMemo(() => byggBana(aktivNiva), [aktivNiva])
  const spel = useMemo(() => skapaSpel(bana), [bana, omgang]) // eslint-disable-line react-hooks/exhaustive-deps
  const [, rendera] = useReducer((x) => x + 1, 0)
  const [vinst, setVinst] = useState(null)
  const [slut, setSlut] = useState(false)
  const [galleri, setGalleri] = useState(false)
  const [valLage, setValLage] = useState(null) // null | 'hand' | 'super'
  const valRef = useRef(null)
  valRef.current = valLage
  const [notis, visaNotis] = useNotis()
  // Superenhörningens laddning. Ligger i en ref under rundan och sparas vid
  // vinst — en förlust nollar den, som i originalet.
  const laddRef = useRef(Math.min(ENHORNING_MAX, spar.enhorning || 0))

  /* ---------------------------------------------------------------- geometri */

  const geo = useMemo(() => {
    const c = BRADE / Math.max(bana.w, bana.h)
    const bx = (W - bana.w * c) / 2
    const by = 30 + (BRADE - bana.h * c) / 2
    return { c, bx, by, x0: bx - BELT, x1: bx + bana.w * c + BELT, y0: by - BELT, y1: by + bana.h * c + BELT }
  }, [bana])

  const vagPunkt = (k) => {
    const v = spel.vag[((k % spel.L) + spel.L) % spel.L]
    const x = v.x < 0 ? geo.x0 : v.x >= bana.w ? geo.x1 : geo.bx + (v.x + 0.5) * geo.c
    const y = v.y < 0 ? geo.y0 : v.y >= bana.h ? geo.y1 : geo.by + (v.y + 0.5) * geo.c
    return [x, y]
  }
  const bandPos = (s) => {
    const k = Math.floor(s)
    const f = s - k
    const [ax, ay] = vagPunkt(k)
    const [bx, by] = vagPunkt(k + 1)
    return [ax + (bx - ax) * f, ay + (by - ay) * f]
  }
  const kubMitt = (i) => [geo.bx + ((i % bana.w) + 0.5) * geo.c, geo.by + (Math.floor(i / bana.w) + 0.5) * geo.c]
  const antalKol = spel.kolumner.length
  const kolX = (c) => W / 2 + (c - (antalKol - 1) / 2) * (W / (antalKol + 0.6))
  const antalSlots = spel.slots.length
  const slotX = (p) => W / 2 + (p - (antalSlots - 1) / 2) * 46
  const startPos = () => vagPunkt(0)
  const bildMitt = () => [geo.bx + (bana.w * geo.c) / 2, geo.by + (bana.h * geo.c) / 2]

  /* ---------------------------------------------------------------- bildlagret */

  // Kuberna ritas en gång på en egen canvas; en kub suddas när kulan träffar.
  const lagerRef = useRef(null)
  function byggLager() {
    const skala = 3
    const cv = document.createElement('canvas')
    cv.width = Math.ceil(bana.w * geo.c * skala)
    cv.height = Math.ceil(bana.h * geo.c * skala)
    const ctx = cv.getContext('2d')
    ctx.scale(skala, skala)
    for (let i = 0; i < bana.kuber.length; i++) {
      const f = bana.kuber[i]
      if (f < 0) continue
      ritaKub(ctx, (i % bana.w) * geo.c, Math.floor(i / bana.w) * geo.c, geo.c, PALETT[f].hex)
    }
    lagerRef.current = { cv, ctx, skala }
  }
  function suddaKub(i) {
    const l = lagerRef.current
    if (!l) return
    const x = (i % bana.w) * geo.c
    const y = Math.floor(i / bana.w) * geo.c
    l.ctx.clearRect(x - 0.5, y - 0.5, geo.c + 1, geo.c + 1)
  }

  /* ---------------------------------------------------------------- tillstånd */

  const a = useRef(null)
  if (!a.current || a.current.spel !== spel) {
    // Guldkuber: samma kuber varje gång man spelar banan.
    const r = slump('pixelkanon-guld', aktivNiva)
    const fyllda = []
    for (let i = 0; i < bana.kuber.length; i++) if (bana.kuber[i] >= 0) fyllda.push(i)
    const guld = new Set(blanda(fyllda, r).slice(0, 2 + (aktivNiva % 3 === 0 ? 1 : 0)))
    a.current = {
      spel,
      t: 0,
      hopp: new Map(), // grisid -> { fran: [x,y], t }
      tillSlot: new Map(), // grisid -> { fran, t }
      kulor: [],
      skrot: [], // kuber som flyger iväg
      blixtar: [], // { i, t } vit blixt där en kub träffades
      superKo: [], // { i, f, vid } supergrisens smällar, i tur och ordning
      skak: new Map(), // kolumn -> starttid
      traffTider: [],
      kombo: 0,
      komboT: -10,
      bastaKombo: 0,
      ordVisat: 0,
      turbo: false,
      halva: false,
      klar: false,
      firat: false,
      avslojT: -1,
      blixtBild: 0,
      slutVantar: false,
      anvandeSlot: false,
      guld,
      guldMynt: 0,
      fargerKlara: 0,
      // Kuber kvar per färg som spelaren ser (kulorna landar efter motorn).
      fargKvar: spel.perFarg(),
      visatKvar: spel.totalt,
      enhorningAnnons: false,
    }
    lagerRef.current = null
  }
  useEffect(() => {
    fx.tom()
    setVinst(null)
    setSlut(false)
    setValLage(null)
  }, [spel, fx])

  useEffect(() => {
    if (import.meta.env.DEV)
      window.__pixel = {
        spel,
        bana,
        kolumn: (c) => tryckKolumn(c),
        slot: (p) => tryckSlot(p),
        ladda: (n) => {
          laddRef.current = Math.min(ENHORNING_MAX, n)
          rendera()
        },
        enhorning: () => slappEnhorning(),
        superFarg: (f) => superFarg(f, ...bildMitt()),
      }
  })

  /* ---------------------------------------------------------------- händelser */

  function tryckKolumn(c, djup = 0) {
    const s = a.current
    if (s.klar || vinst || slut) return
    const res = djup > 0 ? spel.hand(c, djup) : spel.skickaKolumn(c)
    if (!res.ok) {
      if (res.varfor === 'fullt') {
        visaNotis('Bandet är fullt')
        ljud.fel()
      } else if (res.varfor === 'lankad') {
        visaNotis('Länkade grisar åker ihop')
        ljud.fel()
      }
      s.skak.set(c, s.t)
      return false
    }
    for (const g of res.grisar) s.hopp.set(g.id, { fran: [kolX(g.kol), KO_Y + (g.djup || 0) * KO_STEG], t: 0 })
    ljud.ton(320, 0.16, 'triangle', 0.1, 0, 680)
    ljud.brus(0.14, 0.05, 1200, 0, 3800, 1.4)
    rendera()
    return true
  }

  function tryckSlot(p) {
    const s = a.current
    if (s.klar || vinst || slut) return
    const res = spel.skickaSlot(p)
    if (!res.ok) {
      if (res.varfor === 'fullt') {
        visaNotis('Bandet är fullt')
        ljud.fel()
      }
      return
    }
    s.hopp.set(res.grisar[0].id, { fran: [slotX(p), SLOT_Y], t: 0 })
    ljud.ton(360, 0.16, 'triangle', 0.1, 0, 760)
    ljud.brus(0.14, 0.05, 1200, 0, 3800, 1.4)
    rendera()
  }

  function ner({ x, y }) {
    const lage = valRef.current
    if (lage === 'super') {
      const cx = Math.floor((x - geo.bx) / geo.c)
      const cy = Math.floor((y - geo.by) / geo.c)
      if (cx < 0 || cy < 0 || cx >= bana.w || cy >= bana.h || spel.kuber[cy * bana.w + cx] < 0) {
        visaNotis('Tryck på en kub i bilden')
        return
      }
      valjSuper(spel.kuber[cy * bana.w + cx], x, y)
      return
    }
    if (Math.abs(y - SLOT_Y) < 24 && lage !== 'hand') {
      for (let p = 0; p < spel.slots.length; p++) if (Math.abs(x - slotX(p)) < 22 && spel.slots[p]) return tryckSlot(p)
    }
    if (y > KO_Y - 30 && y < KO_Y + KO_STEG * 4) {
      let bast = -1
      let bastD = 40
      for (let c = 0; c < antalKol; c++) {
        const d = Math.abs(x - kolX(c))
        if (d < bastD) {
          bastD = d
          bast = c
        }
      }
      if (bast < 0) return
      if (lage === 'hand') {
        const k = spel.kolumner[bast]
        const djup = Math.max(0, Math.min(3, k.length - 1, Math.round((y - KO_Y) / KO_STEG)))
        if (!k.length) return
        valjHand(bast, djup)
        return
      }
      tryckKolumn(bast)
    }
  }

  function hanteraHandelser() {
    const s = a.current
    for (const e of spel.tomHandelser()) {
      if (e.typ === 'skott') {
        const g = spel.band.find((x) => x.id === e.id)
        const [px, py] = g ? bandPos(g.s) : bandPos(e.ruta)
        const [mx, my] = kubMitt(e.mal)
        s.kulor.push({ x0: px, y0: py, x1: mx, y1: my, t: 0, dur: 0.07 + Math.hypot(mx - px, my - py) / 2600, f: e.f, gf: e.gf, mal: e.mal, traffar: e.traffar })
        if (g) g.rekyl = s.t
      } else if (e.typ === 'super') {
        // schemaläggs i superFarg()
      } else if (e.typ === 'tom') {
        const [x, y] = bandPos(e.s)
        if (e.enhorning) {
          fx.sprut(x, y, RB, 26, { fart: 200, form: 'stjarna', liv: 0.8, gravitation: -40 })
          fx.text(x, y - 14, 'Hej då! 🦄', { farg: '#fff', storlek: 14, liv: 0.9 })
        } else {
          fx.sprut(x, y, ['#ffffff', '#ffd43b', '#ffb3d1'], 16, { fart: 150, form: 'stjarna', liv: 0.5, gravitation: 60 })
        }
        fx.ring(x, y, '#ffffff', 26, 0.3, 2)
        ljud.brus(0.18, 0.08, 2500, 0, 6000)
        ljud.ton(1568, 0.1, 'sine', 0.06, 0.04)
      } else if (e.typ === 'slot') {
        s.tillSlot.set(e.id, { fran: startPos(), t: 0 })
        ljud.ton(196, 0.1, 'sine', 0.12, 0.2)
      } else if (e.typ === 'gratis') {
        // Enhörningen/supergrisen tog kuber i grisens färg: grisen blir lättare
        // eller försvinner helt. Platser och köer töms av sig själva.
        let x = null
        let y = null
        if (e.var === 'slot') [x, y] = [slotX(e.slot), SLOT_Y]
        else if (e.var === 'ko' && e.djup <= 3) [x, y] = [kolX(e.kol), KO_Y + e.djup * KO_STEG]
        if (x != null && e.kvar <= 0) {
          fx.sprut(x, y, [hex(e.f), '#ffffff', '#ffd43b'], 14, { fart: 140, form: 'stjarna', liv: 0.5, gravitation: 40 })
          fx.ring(x, y, '#ffffff', 24, 0.35, 2)
          fx.text(x, y - 18, 'Gratis!', { farg: '#7dffb0', storlek: 13, liv: 0.8 })
          ljud.pop(10, 0.08)
        }
      } else if (e.typ === 'avslojd') {
        fx.sprut(kolX(e.kol), KO_Y, ['#ffffff', hex(e.f)], 12, { fart: 120, form: 'stjarna', liv: 0.5, gravitation: 0 })
        ljud.ton(1318, 0.08, 'sine', 0.06)
      } else if (e.typ === 'forlust') {
        s.klar = true
        s.slutVantar = s.t + 0.3
      } else if (e.typ === 'vinst') {
        s.klar = true
      }
    }
  }

  // En kub träffas på riktigt (kulan landar, eller supergrisens smäll).
  function kubSmall(i, f, fran, { tyst = false, regnbage = false } = {}) {
    const s = a.current
    suddaKub(i)
    const [mx, my] = kubMitt(i)
    const c = PALETT[f].hex
    // kuben själv flyger iväg, bort från skytten
    let vx = mx - fran[0]
    let vy = my - fran[1]
    const d = Math.hypot(vx, vy) || 1
    vx = (vx / d) * (90 + Math.random() * 120) + (Math.random() - 0.5) * 80
    vy = (vy / d) * (90 + Math.random() * 120) - 140 - Math.random() * 90
    s.skrot.push({ x: mx, y: my, vx, vy, rot: 0, vr: (Math.random() - 0.5) * 16, farg: c, t: 0, liv: 0.75 + Math.random() * 0.3, c: geo.c })
    if (s.skrot.length > 380) s.skrot.splice(0, s.skrot.length - 380)
    s.blixtar.push({ i, t: s.t })
    fx.sprut(mx, my, [c, ljusare(c, 0.45), '#ffffff'], 3, { fart: 130, liv: 0.32, storlek: geo.c * 0.14 + 0.8, gravitation: 300 })

    // kombo: träffar inom 1,2 s
    s.traffTider.push(s.t)
    while (s.traffTider.length && s.t - s.traffTider[0] > 1.2) s.traffTider.shift()
    s.kombo = s.traffTider.length
    s.komboT = s.t
    s.bastaKombo = Math.max(s.bastaKombo, s.kombo)
    if (!tyst) ljud.tick(4 + Math.min(15, Math.floor(s.kombo / 3)))
    const ord = KOMBO_ORD.filter(([n]) => s.kombo >= n).pop()
    if (ord && ord[0] > s.ordVisat) {
      s.ordVisat = ord[0]
      const [cx, cy] = bildMitt()
      fx.text(cx, cy, ord[1], { farg: '#ffffff', storlek: 30 + Math.min(10, ord[0] / 12), liv: 1.1, stig: 26 })
      fx.sprut(cx, cy, RB, 18, { fart: 240, form: 'stjarna', liv: 0.7, gravitation: 80 })
      ljud.hurra(ord[0] / 30)
      fx.skaka(3 + ord[0] / 40)
    }

    // laddar enhörningen (inte enhörningens egna träffar)
    if (!regnbage && laddRef.current < ENHORNING_MAX) {
      laddRef.current = Math.min(ENHORNING_MAX, laddRef.current + 1)
      if (laddRef.current === ENHORNING_MAX) {
        ljud.kista()
        if (!s.enhorningAnnons) {
          s.enhorningAnnons = true
          visaNotis('🦄 Superenhörningen är redo!', 1900)
        }
        rendera()
      }
    }

    // guldkub
    if (s.guld.has(i)) {
      s.guld.delete(i)
      s.guldMynt += GULD_MYNT
      fx.text(mx, my - 8, `+${GULD_MYNT}`, { farg: '#ffd43b', storlek: 22, liv: 1 })
      for (let k = 0; k < 7; k++) {
        fx.sprut(mx, my, ['#ffd43b', '#fff1a8', '#f5b81c'], 1, { fart: 260, vinkel: -Math.PI / 2 - 0.5 + Math.random() * 0.9, spridning: 0.4, form: 'cirkel', storlek: 4, liv: 0.9, gravitation: 500 })
      }
      fx.ring(mx, my, '#ffd43b', 34, 0.45, 3)
      laddRef.current = Math.min(ENHORNING_MAX, laddRef.current + 8)
      ;[0, 1, 2].forEach((k) => setTimeout(() => ljud.mynt(k * 2), k * 70))
    }

    // färg klar?
    const kvar = (s.fargKvar.get(f) || 0) - 1
    s.fargKvar.set(f, kvar)
    s.visatKvar--
    if (kvar === 0 && s.visatKvar > 0) {
      s.fargerKlara++
      const [cx, cy] = bildMitt()
      const namn = NEUTRUM[PALETT[f].namn] || PALETT[f].namn
      fx.text(cx, geo.y1 - 34, `${namn} klart!`, { farg: c, storlek: 24, liv: 1.2, kant: ljus(c) ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)' })
      fx.text(cx, geo.y1 - 6, `+${FARG_MYNT}`, { farg: '#ffd43b', storlek: 15, liv: 1 })
      fx.ring(cx, cy, c, 190, 0.6, 6)
      ljud.ton(523.25, 0.16, 'triangle', 0.1)
      ljud.ton(659.25, 0.16, 'triangle', 0.1, 0.07)
      ljud.ton(783.99, 0.26, 'triangle', 0.1, 0.14)
      ljud.ton(1046.5, 0.3, 'sine', 0.06, 0.21)
    }
    if (!s.halva && s.visatKvar <= spel.totalt / 2 && s.visatKvar > 0) {
      s.halva = true
      fx.text(W / 2, geo.y0 + 30, 'Halva bilden!', { farg: '#7dffb0', storlek: 18, liv: 1 })
    }
    // sista kuben
    if (s.visatKvar === 0) {
      fx.hitstop(140)
      fx.skaka(9)
      s.blixtBild = 1
      const [cx, cy] = bildMitt()
      fx.ring(cx, cy, '#ffffff', 220, 0.7, 8)
      fx.sprut(cx, cy, RB, 40, { fart: 320, form: 'stjarna', liv: 1, gravitation: 120 })
      fx.text(cx, cy, 'KLART!', { farg: '#ffffff', storlek: 44, liv: 1.3, stig: 20 })
    }
  }

  /* ---------------------------------------------------------------- boosters */

  function harBoost(typ) {
    return (sparRef.current.boost[typ] || 0) > 0 || mynt >= BOOST[typ].pris
  }

  function betalaBoost(typ) {
    const sp = sparRef.current
    if ((sp.boost[typ] || 0) > 0) {
      setSpar((x) => ({ ...x, boost: { ...x.boost, [typ]: x.boost[typ] - 1 } }))
      return true
    }
    if (betala(BOOST[typ].pris)) return true
    visaNotis('För lite mynt')
    return false
  }

  function bricka() {
    if (a.current.klar) return
    if (spel.kap >= MAX_KAP) {
      visaNotis('Bandet är redan max långt')
      return
    }
    if (!betalaBoost('bricka')) return
    spel.extraBricka()
    ljud.booster()
    fx.text(W / 2, geo.y1 + 4, '+1 plats på bandet', { farg: '#7dffb0', storlek: 18 })
    fx.ring(...startPos(), '#7dffb0', 40, 0.5, 3)
    rendera()
  }

  function vaxlaLage(lage) {
    if (a.current.klar) return
    if (valLage === lage) {
      setValLage(null)
      return
    }
    if (!harBoost(lage)) {
      visaNotis('För lite mynt')
      return
    }
    setValLage(lage)
    visaNotis(lage === 'hand' ? 'Välj vilken gris som helst i köerna' : 'Tryck på en färg i bilden', 1800)
  }

  function valjHand(kol, djup) {
    setValLage(null)
    if (spel.ombord() + 1 > spel.kap) {
      visaNotis('Bandet är fullt')
      ljud.fel()
      return
    }
    if (!betalaBoost('hand')) return
    ljud.booster()
    fx.ring(kolX(kol), KO_Y + djup * KO_STEG, '#ffffff', 30, 0.4, 3)
    tryckKolumn(kol, djup)
  }

  function valjSuper(f, x, y) {
    setValLage(null)
    if (!betalaBoost('super')) return
    superFarg(f, x, y)
  }

  function superFarg(f, x, y) {
    const s = a.current
    const mal = spel.supergris(f)
    if (!mal.length) return
    hanteraHandelser()
    ljud.booster()
    ljud.ton(98, 0.5, 'sine', 0.2, 0, 50)
    fx.skaka(8)
    fx.hitstop(90)
    fx.ring(x, y, hex(f), 120, 0.6, 6)
    fx.text(W / 2, bildMitt()[1] - 50, 'SUPERGRIS!', { farg: hex(f), storlek: 28, liv: 1.1, kant: ljus(hex(f)) ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)' })
    // Smällarna sprider sig utåt från där man tryckte.
    const sorterade = mal.map((i) => [i, Math.hypot(kubMitt(i)[0] - x, kubMitt(i)[1] - y)]).sort((p, q) => p[1] - q[1])
    sorterade.forEach(([i, d], k) => s.superKo.push({ i, f, vid: s.t + 0.08 + d / 600 + k * 0.004, fran: [x, y] }))
    rendera()
  }

  function slappEnhorning() {
    const s = a.current
    if (s.klar || vinst || slut || laddRef.current < ENHORNING_MAX) return
    const res = spel.regnbage(ENHORNING_AMMO)
    if (!res.ok) return
    laddRef.current = 0
    setSpar((x) => ({ ...x, enhorning: 0 }))
    s.hopp.set(res.id, { fran: [W / 2, -30], t: 0 })
    ljud.booster()
    ljud.hurra(3)
    fx.skaka(7)
    fx.hitstop(80)
    fx.sprut(...startPos(), RB, 40, { fart: 260, form: 'stjarna', liv: 0.9, gravitation: 40 })
    fx.text(W / 2, bildMitt()[1] - 40, 'SUPERENHÖRNING!', { farg: '#ffffff', storlek: 26, liv: 1.3, kant: '#7c3aed' })
    rendera()
  }

  /* ---------------------------------------------------------------- vinst/förlust */

  function vinna() {
    const s = a.current
    const extraMynt = Math.floor(s.bastaKombo / 10) + s.guldMynt + s.fargerKlara * FARG_MYNT
    const res = belona(sparRef.current, {
      gameId: ID,
      niva: aktivNiva,
      svar: bana.svar,
      perfekt: !s.anvandeSlot,
      extra: extraMynt,
      boostTyper: Object.keys(BOOST),
    })
    const galleriNy = sparRef.current.galleri.includes(bana.bild.id) ? sparRef.current.galleri : [...sparRef.current.galleri, bana.bild.id]
    setSpar({ ...res.spar, galleri: galleriNy, enhorning: laddRef.current })
    const rader = []
    if (s.bastaKombo >= 10) rader.push([`Bästa kombo x${s.bastaKombo}`, `+${Math.floor(s.bastaKombo / 10)}`])
    if (s.fargerKlara) rader.push([`Färger klara x${s.fargerKlara}`, `+${s.fargerKlara * FARG_MYNT}`])
    if (s.guldMynt) rader.push([`Guldkuber ✨`, `+${s.guldMynt}`])
    setVinst({ ...res.resultat, rader, ny: !sparRef.current.galleri.includes(bana.bild.id) })
  }
  function nasta() {
    setAktivNiva(sparRef.current.niva)
    setOmgang((o) => o + 1)
  }
  function forsokIgen() {
    laddRef.current = 0
    setSpar((s) => ({ ...forlust(s), enhorning: 0 }))
    setOmgang((o) => o + 1)
  }
  function fortsatt() {
    if (!betala(FORTSATT_PRIS)) return
    spel.extraSlot()
    hanteraHandelser()
    a.current.klar = false
    a.current.slutVantar = false
    setSlut(false)
    ljud.booster()
    rendera()
  }

  /* ---------------------------------------------------------------- uppdatera */

  function uppdatera(dt) {
    const s = a.current
    fx.uppdatera(dt)
    if (fx.fryst()) return
    s.t += dt
    const fore = spel.ombord() + spel.slots.filter(Boolean).length
    const foreKvar = spel.kvar()
    spel.steg(dt)
    hanteraHandelser()
    // DOM:en (kuber kvar, mätarna) uppdateras högst sju gånger i sekunden
    if (spel.ombord() + spel.slots.filter(Boolean).length !== fore || ((spel.kvar() !== foreKvar || s.superKo.length) && s.t - (s.sistRender || 0) > 0.14)) {
      s.sistRender = s.t
      rendera()
    }
    if (spel.slots.some(Boolean)) s.anvandeSlot = true

    for (const [id, h] of s.hopp) {
      h.t += dt / 0.24
      if (h.t >= 1.6) s.hopp.delete(id)
    }
    for (const [id, h] of s.tillSlot) {
      h.t += dt / 0.28
      if (h.t >= 1) s.tillSlot.delete(id)
    }

    // kulorna
    for (const k of s.kulor) {
      k.t += dt
      if (k.t >= k.dur && !k.traff) {
        k.traff = true
        kubSmall(k.mal, k.f, [k.x0, k.y0], { regnbage: k.gf === REGNBAGE })
      }
    }
    s.kulor = s.kulor.filter((k) => k.t < k.dur + 0.02)

    // supergrisens smällar
    while (s.superKo.length && s.superKo[0].vid <= s.t) {
      const e = s.superKo.shift()
      kubSmall(e.i, e.f, e.fran, { tyst: s.superKo.length % 2 === 1 })
      if (s.superKo.length % 4 === 0) ljud.pop(4 + Math.floor(Math.random() * 8), 0.07)
    }

    // flygande kuber och blixtar
    for (const b of s.skrot) {
      b.t += dt
      b.vy += 900 * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.rot += b.vr * dt
    }
    s.skrot = s.skrot.filter((b) => b.t < b.liv)
    s.blixtar = s.blixtar.filter((b) => s.t - b.t < 0.14)
    if (s.blixtBild > 0) s.blixtBild = Math.max(0, s.blixtBild - dt * 2.2)

    if (s.kombo < 8 || s.t - s.komboT > 1.2) {
      if (s.t - s.komboT > 1.2) s.kombo = 0
      s.ordVisat = 0
    }

    if (!s.turbo && spel.status() === 'spelar' && spel.kvar() < spel.totalt * 0.08 && spel.kvar() > 0) {
      s.turbo = true
      fx.text(W / 2, geo.y1 + 12, 'Turbo!', { farg: '#7dffb0', storlek: 18, liv: 0.9 })
    }

    if (s.slutVantar && s.t >= s.slutVantar) {
      s.slutVantar = false
      fx.skaka(7)
      ljud.forlust()
      setValLage(null)
      setSlut(true)
    }

    if (spel.status() === 'vunnit' && !s.firat && !s.kulor.length && !s.superKo.length) {
      s.firat = true
      s.avslojT = s.t + 0.25
      setValLage(null)
      ljud.vinst()
      fx.konfetti(W / 2, geo.y1, 110, W)
      setTimeout(vinna, 1700)
    }
  }

  /* ---------------------------------------------------------------- ritning */

  function rita(ctx) {
    const s = a.current
    const t = s.t
    if (!lagerRef.current) byggLager()
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    ctx.translate(fx.skakX(), fx.skakY())

    // glöd bakom bilden som växer med kombon
    const glod = Math.min(1, s.kombo / 60) * Math.max(0, 1 - (t - s.komboT) / 1.2)
    if (glod > 0.02) {
      const [cx, cy] = bildMitt()
      const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, BRADE * 0.75)
      const hue = (t * 90) % 360
      g.addColorStop(0, `hsla(${hue}, 95%, 65%, ${0.38 * glod})`)
      g.addColorStop(1, 'hsla(0, 0%, 0%, 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, geo.y1 + 30)
    }

    // bandet
    ritaBand(ctx, t)

    // bildens bakgrund och kuberna
    ctx.fillStyle = '#121a30'
    rundRekt(ctx, geo.bx - 3, geo.by - 3, bana.w * geo.c + 6, bana.h * geo.c + 6, 6)
    ctx.fill()
    const l = lagerRef.current
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(l.cv, geo.bx, geo.by, bana.w * geo.c, bana.h * geo.c)

    // guldkuber glittrar
    for (const i of s.guld) {
      const [mx, my] = kubMitt(i)
      const p = 0.5 + Math.sin(t * 6 + i) * 0.5
      ctx.strokeStyle = `rgba(255, 212, 59, ${0.55 + p * 0.45})`
      ctx.lineWidth = Math.max(1.5, geo.c * 0.16)
      ctx.strokeRect(mx - geo.c / 2 + 1, my - geo.c / 2 + 1, geo.c - 2, geo.c - 2)
      ctx.save()
      ctx.translate(mx + geo.c * 0.3, my - geo.c * 0.3)
      ctx.rotate(t * 2)
      ctx.fillStyle = `rgba(255, 250, 220, ${p})`
      stjarnform(ctx, geo.c * 0.28 * (0.6 + p * 0.6))
      ctx.restore()
    }

    // välj färg: allt utom bilden mörkas
    if (valRef.current === 'super') {
      ctx.fillStyle = 'rgba(6, 9, 20, 0.5)'
      ctx.fillRect(0, geo.y1 + 6, W, H)
      ctx.strokeStyle = `rgba(255, 212, 59, ${0.6 + Math.sin(t * 8) * 0.35})`
      ctx.lineWidth = 3
      rundRekt(ctx, geo.bx - 5, geo.by - 5, bana.w * geo.c + 10, bana.h * geo.c + 10, 8)
      ctx.stroke()
    }

    // vit blixt där kuber just träffats
    for (const b of s.blixtar) {
      const k = (t - b.t) / 0.14
      const [mx, my] = kubMitt(b.i)
      const st = geo.c * (1 + k * 0.5)
      ctx.globalAlpha = (1 - k) * 0.9
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(mx - st / 2, my - st / 2, st, st)
    }
    ctx.globalAlpha = 1

    // vinst: bilden kommer tillbaka med ett glitter
    if (s.avslojT >= 0 && t >= s.avslojT) {
      const k = Math.min(1, (t - s.avslojT) / 0.9)
      ctx.globalAlpha = easeOut(k)
      for (let i = 0; i < bana.kuber.length; i++) {
        const f = bana.kuber[i]
        if (f < 0) continue
        const x = i % bana.w
        const y = Math.floor(i / bana.w)
        const d = (x + y) / (bana.w + bana.h)
        if (d > k * 1.2) continue
        ritaKub(ctx, geo.bx + x * geo.c, geo.by + y * geo.c, geo.c, PALETT[f].hex)
      }
      ctx.globalAlpha = 1
      const sv = geo.bx - 40 + (bana.w * geo.c + 80) * Math.min(1, (t - s.avslojT) / 1.1)
      const grad = ctx.createLinearGradient(sv - 30, 0, sv + 30, 0)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.45)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.fillRect(geo.bx, geo.by, bana.w * geo.c, bana.h * geo.c)
    }
    if (s.blixtBild > 0) {
      ctx.fillStyle = `rgba(255,255,255,${s.blixtBild * 0.7})`
      ctx.fillRect(geo.bx - 4, geo.by - 4, bana.w * geo.c + 8, bana.h * geo.c + 8)
    }

    // kulor med svans
    for (const k of s.kulor) {
      const e = Math.min(1, k.t / k.dur)
      const x = lerp(k.x0, k.x1, e)
      const y = lerp(k.y0, k.y1, e)
      const e2 = Math.max(0, e - 0.25)
      const sx = lerp(k.x0, k.x1, e2)
      const sy = lerp(k.y0, k.y1, e2)
      const c = k.gf === REGNBAGE ? RB[Math.floor(t * 20 + k.mal) % RB.length] : hex(k.f)
      ctx.strokeStyle = c
      ctx.globalAlpha = 0.45
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.arc(x, y, 3.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(x - 0.8, y - 0.8, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // grisarna på bandet och på väg dit
    for (const g of spel.inkommande) {
      const h = s.hopp.get(g.id)
      const [sx, sy] = startPos()
      const [x, y] = h ? hoppPos(h.fran, [sx, sy], Math.min(1, h.t)) : [sx, sy]
      ritaGris(ctx, x, y, g.f === REGNBAGE ? 16 : 13, g.f, g.ammo, { t })
    }
    for (const g of spel.band) {
      let [x, y] = bandPos(g.s)
      const h = s.hopp.get(g.id)
      if (h && h.t < 1) [x, y] = hoppPos(h.fran, [x, y], h.t)
      const rek = g.rekyl != null ? Math.max(0, 1 - (t - g.rekyl) / 0.08) : 0
      if (g.f === REGNBAGE) {
        // regnbågsspår bakom enhörningen
        for (let k = 1; k <= 5; k++) {
          const [tx, ty] = bandPos(Math.max(0, g.s - k * 0.45))
          ctx.globalAlpha = 0.5 - k * 0.08
          ctx.fillStyle = RB[k % RB.length]
          ctx.beginPath()
          ctx.arc(tx, ty, 7 - k, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
      }
      ritaGris(ctx, x, y, (g.f === REGNBAGE ? 16 : 13) * (1 + rek * 0.18), g.f, g.ammo, { t })
    }

    ritaSlots(ctx, t)
    ritaKoer(ctx, t)

    // flygande kuber överst
    for (const b of s.skrot) {
      const k = b.t / b.liv
      const st = b.c * (1 + Math.min(0.25, b.t * 2) - k * 0.55)
      ctx.save()
      ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1
      ctx.translate(b.x, b.y)
      ctx.rotate(b.rot)
      ritaKub(ctx, -st / 2, -st / 2, st, b.farg)
      ctx.restore()
    }
    ctx.globalAlpha = 1

    // kombo uppe till höger
    if (s.kombo >= 5) {
      const sedan = t - s.komboT
      const alfa = Math.max(0, 1 - Math.max(0, sedan - 0.6) / 0.6)
      if (alfa > 0) {
        const bump = Math.max(0, 1 - sedan / 0.12) * 0.25
        const varme = Math.min(1, s.kombo / 80)
        const farg = varme < 0.33 ? '#ffffff' : varme < 0.66 ? '#ffd43b' : s.kombo >= 100 ? RB[Math.floor(t * 12) % RB.length] : '#ff7ab6'
        ctx.save()
        ctx.globalAlpha = alfa
        ctx.translate(geo.x1 - 8, geo.y0 + 22)
        ctx.scale(1 + bump, 1 + bump)
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.font = `900 ${Math.round(18 + varme * 10)}px ui-rounded, "Outfit Variable", system-ui, sans-serif`
        ctx.lineWidth = 5
        ctx.lineJoin = 'round'
        ctx.strokeStyle = 'rgba(10, 12, 26, 0.85)'
        ctx.strokeText(`x${s.kombo}`, 0, 0)
        ctx.fillStyle = farg
        ctx.fillText(`x${s.kombo}`, 0, 0)
        ctx.restore()
      }
    }

    fx.rita(ctx)
    ctx.restore()
  }

  function hoppPos(fran, till, k) {
    const e = easeOut(k)
    return [lerp(fran[0], till[0], e), lerp(fran[1], till[1], e) - Math.sin(k * Math.PI) * 26]
  }

  function ritaBand(ctx, t) {
    const { x0, y0, x1, y1 } = geo
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#2b3554'
    ctx.lineWidth = 22
    rundRekt(ctx, x0, y0, x1 - x0, y1 - y0, 12)
    ctx.stroke()
    ctx.strokeStyle = '#38446a'
    ctx.lineWidth = 16
    rundRekt(ctx, x0, y0, x1 - x0, y1 - y0, 12)
    ctx.stroke()
    // rörliga ränder
    ctx.setLineDash([4, 8])
    ctx.lineDashOffset = -t * (spel.L / 4.2) * 6 * (a.current.turbo ? 1.7 : 1)
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 12
    rundRekt(ctx, x0, y0, x1 - x0, y1 - y0, 12)
    ctx.stroke()
    ctx.setLineDash([])
    // starten
    const [sx, sy] = startPos()
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.arc(sx, sy, 5, 0, Math.PI * 2)
    ctx.fill()
    // kapacitet: prickar under bandet
    const n = spel.kap
    const pa = spel.ombord()
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < pa ? '#ffd43b' : 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      ctx.arc(W / 2 + (i - (n - 1) / 2) * 11, y1 + 19, 3.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function ritaSlots(ctx, t) {
    const s = a.current
    const fyllda = spel.slots.filter(Boolean).length
    const fara = fyllda >= spel.slots.length - 1 && !s.klar
    for (let p = 0; p < spel.slots.length; p++) {
      const x = slotX(p)
      ctx.fillStyle = fara ? `rgba(255, 60, 90, ${0.2 + Math.sin(t * 9) * 0.1})` : p >= SLOTS ? '#2e2752' : '#151c33'
      rundRekt(ctx, x - 20, SLOT_Y - 20, 40, 40, 12)
      ctx.fill()
      ctx.strokeStyle = fara ? 'rgba(255, 77, 109, 0.8)' : 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      const g = spel.slots[p]
      if (!g) continue
      const ts = s.tillSlot.get(g.id)
      const [x2, y2] = ts ? hoppPos(ts.fran, [x, SLOT_Y], ts.t) : [x, SLOT_Y]
      ritaGris(ctx, x2, y2, 15, g.f, g.ammo, { t })
    }
  }

  function ritaKoer(ctx, t) {
    const s = a.current
    const hand = valRef.current === 'hand'
    for (let c = 0; c < antalKol; c++) {
      const k = spel.kolumner[c]
      let x = kolX(c)
      const sk = s.skak.get(c)
      if (sk != null) {
        const kk = (t - sk) / 0.3
        if (kk >= 1) s.skak.delete(c)
        else x += Math.sin(kk * 30) * (1 - kk) * 5
      }
      ctx.fillStyle = hand ? `rgba(255, 212, 59, ${0.08 + Math.sin(t * 7) * 0.04})` : 'rgba(255,255,255,0.035)'
      rundRekt(ctx, x - 26, KO_Y - 28, 52, KO_STEG * 4 + 6, 16)
      ctx.fill()
      for (let d = Math.min(3, k.length - 1); d >= 0; d--) {
        const g = k[d]
        const y = KO_Y + d * KO_STEG
        // länkade: kedja till grannen
        if (g.lank != null) {
          for (let c2 = c + 1; c2 < antalKol; c2++) {
            const g2 = spel.kolumner[c2][d]
            if (g2 && g2.lank === g.lank) {
              ctx.strokeStyle = '#c7cede'
              ctx.lineWidth = 3
              ctx.setLineDash([5, 4])
              ctx.beginPath()
              ctx.moveTo(x + 14, y)
              ctx.lineTo(kolX(c2) - 14, y)
              ctx.stroke()
              ctx.setLineDash([])
            }
          }
        }
        const skal = d === 0 || hand ? 1 : 0.86 - d * 0.04
        ctx.globalAlpha = d === 0 || hand ? 1 : 0.85
        ritaGris(ctx, x, y + (d === 0 ? Math.sin(t * 3 + c) * 1.5 : 0), 17 * skal, g.dold ? -1 : g.f, g.dold ? null : g.ammo, { dold: g.dold, t, lank: g.lank != null })
        ctx.globalAlpha = 1
      }
      if (k.length > 4) {
        ctx.fillStyle = '#95a1bf'
        ctx.font = '800 11px ui-rounded, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`+${k.length - 4}`, x, KO_Y + KO_STEG * 3 + 30)
      }
    }
  }

  const canvasRef = useSpelyta({ bredd: W, hojd: H, rita, uppdatera, ner })

  const kvar = spel.kvar()
  const arHappy = bana.bild.typ === 'happy'
  const samlade = spar.galleri.length
  const ladd = laddRef.current
  const redo = ladd >= ENHORNING_MAX
  const spelar = !vinst && !slut

  return (
    <div className="ds-rot px-rot">
      <Topprad
        niva={aktivNiva}
        svar={bana.svar}
        mynt={mynt}
        hoger={
          <button className="ds-knapp-liten px-galleriknapp" onClick={() => setGalleri(true)} aria-label="Galleri">
            🖼 {samlade}
          </button>
        }
      >
        <button
          className={`px-enhorning${redo ? ' redo' : ''}`}
          onClick={slappEnhorning}
          disabled={!redo || !spelar}
          aria-label={redo ? 'Släpp Superenhörningen' : `Superenhörningen laddas, ${Math.round((ladd / ENHORNING_MAX) * 100)} procent`}
          title={redo ? 'Släpp Superenhörningen!' : 'Laddas av träffar'}
        >
          <span className="px-enhorning-ikon" aria-hidden="true">
            🦄
          </span>
          <span className="px-enhorning-mater" aria-hidden="true">
            <i style={{ width: `${(ladd / ENHORNING_MAX) * 100}%` }} />
          </span>
          {redo && <span className="px-enhorning-text">Släpp!</span>}
        </button>
      </Topprad>
      <div className="px-info">
        <span className={`px-namn${arHappy ? ' happy' : ''}`}>{arHappy ? '🐶 Happy-bild!' : bana.bild.namn}</span>
        <span className="px-mater" aria-hidden="true">
          <i style={{ width: `${((spel.totalt - kvar) / Math.max(1, spel.totalt)) * 100}%` }} />
        </span>
        <span className="px-kvar">
          <b>{kvar}</b> kvar
        </span>
      </div>
      <div className="ds-yta px-yta">
        <canvas ref={canvasRef} aria-label={`Pixelkanon bana ${aktivNiva}`} />
        <Banner svar={bana.svar} niva={`${aktivNiva}-${omgang}`} />
        <Notis notis={notis} />
        {vinst && (
          <Vinstkort
            resultat={vinst}
            ljud={ljud}
            boostInfo={BOOST}
            titel={arHappy ? 'Happy!' : undefined}
            rader={vinst.rader}
            onNasta={nasta}
            barn={<Avslojande bild={bana.bild} ny={vinst.ny} />}
          />
        )}
        {slut && (
          <Forlustkort
            titel="Platserna är fulla!"
            text={`${kvar} kuber kvar.`}
            ikon="🐷"
            mynt={mynt}
            fortsatt={spel.slots.length < SLOTS + MAX_EXTRA ? { text: 'Fortsätt med +1 plats', pris: FORTSATT_PRIS, onClick: fortsatt } : null}
            onIgen={forsokIgen}
          />
        )}
        {galleri && <Galleri samlade={spar.galleri} onStang={() => setGalleri(false)} />}
      </div>
      <div className="ds-boostrad kompakt">
        <BoostKnapp {...BOOST.hand} antal={spar.boost.hand || 0} mynt={mynt} onClick={() => vaxlaLage('hand')} aktiv={valLage === 'hand'} disabled={!spelar} />
        <BoostKnapp {...BOOST.bricka} antal={spar.boost.bricka || 0} mynt={mynt} onClick={bricka} disabled={!spelar || spel.kap >= MAX_KAP} />
        <BoostKnapp {...BOOST.super} antal={spar.boost.super || 0} mynt={mynt} onClick={() => vaxlaLage('super')} aktiv={valLage === 'super'} disabled={!spelar} />
      </div>
      <p className="ds-hjalp">
        Tryck på grisen först i en kö. Den åker runt bilden och skjuter på kuber i sin färg. Grisar med ammo kvar väntar i platserna — fulla platser = slut. Träffar laddar 🦄.
        {aktivNiva % HAPPY_VAR !== 0 && ` Happy-bild om ${HAPPY_VAR - (aktivNiva % HAPPY_VAR)} ${HAPPY_VAR - (aktivNiva % HAPPY_VAR) === 1 ? 'bana' : 'banor'}.`}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------- avslöjande och galleri */

function Avslojande({ bild, ny }) {
  if (bild.typ === 'happy') {
    return (
      <div className="px-avslojd happy">
        <img src={FOTON[bild.fil]} alt={ALBUM_CAPTIONS[bild.fil] || 'Happy'} />
        <span>{ALBUM_CAPTIONS[bild.fil] || 'Happy'}</span>
      </div>
    )
  }
  return (
    <div className="px-avslojd">
      <img src={tumnagel(bild.rader)} alt={bild.namn} className="pixlad" />
      <span>
        {bild.namn}
        {ny ? ' — ny i galleriet!' : ''}
      </span>
    </div>
  )
}

function Galleri({ samlade, onStang }) {
  const har = new Set(samlade)
  const alla = [...BILDER.map((b) => ({ id: b.id, namn: b.namn, rader: b.storlekar['20'] })), ...HAPPY.map((h) => ({ id: h.id, namn: 'Happy', fil: h.fil, rader: h.rader }))]
  const antal = alla.filter((b) => har.has(b.id)).length
  return (
    <div className="ds-kort-bak px-galleri" role="dialog" aria-modal="true" aria-label="Galleri">
      <div className="px-galleri-ram">
        <div className="px-galleri-topp">
          <b>Galleri</b>
          <span>
            {antal} av {alla.length}
          </span>
          <button className="ds-knapp-liten" onClick={onStang}>
            Stäng
          </button>
        </div>
        <div className="px-galleri-rutnat">
          {alla.map((b) =>
            har.has(b.id) ? (
              <figure key={b.id} className={b.fil ? 'happy' : ''} title={b.fil ? ALBUM_CAPTIONS[b.fil] : b.namn}>
                <img src={b.fil ? FOTON[b.fil] : tumnagel(b.rader)} alt={b.namn} className={b.fil ? '' : 'pixlad'} />
              </figure>
            ) : (
              <figure key={b.id} className="last" title="Inte upplåst än">
                <span>{b.fil ? '🐶' : '?'}</span>
              </figure>
            )
          )}
        </div>
      </div>
    </div>
  )
}

const tumCache = new Map()
function tumnagel(rader) {
  const k = rader.join('|')
  if (tumCache.has(k)) return tumCache.get(k)
  const h = rader.length
  const w = rader[0].length
  const s = 4
  const cv = document.createElement('canvas')
  cv.width = w * s
  cv.height = h * s
  const ctx = cv.getContext('2d')
  const T = '0123456789abcdefghijkl'
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rader[y][x]
    if (ch === '.') continue
    ctx.fillStyle = PALETT[T.indexOf(ch)].hex
    ctx.fillRect(x * s, y * s, s, s)
  }
  const url = cv.toDataURL()
  tumCache.set(k, url)
  return url
}

/* ---------------------------------------------------------------- ritverktyg */

function ritaKub(ctx, x, y, c, farg) {
  const g = Math.max(0.6, c * 0.06)
  ctx.fillStyle = farg
  ctx.fillRect(x + g / 2, y + g / 2, c - g, c - g)
  const b = Math.max(1, c * 0.13)
  ctx.fillStyle = ljusare(farg, 0.32)
  ctx.fillRect(x + g / 2, y + g / 2, c - g, b)
  ctx.fillRect(x + g / 2, y + g / 2, b, c - g)
  ctx.fillStyle = ljusare(farg, -0.28)
  ctx.fillRect(x + g / 2, y + c - g / 2 - b, c - g, b)
  ctx.fillRect(x + c - g / 2 - b, y + g / 2, b, c - g)
}

function stjarnform(ctx, r) {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.32 : r
    const v = -Math.PI / 2 + (i * Math.PI) / 4
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(v) * rr, Math.sin(v) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

function ritaGris(ctx, x, y, r, f, ammo, { dold, t = 0, lank } = {}) {
  const regn = f === REGNBAGE
  const kropp = dold ? '#5b6478' : regn ? '#ffffff' : hex(f)
  const mork = ljusare(dold ? '#5b6478' : regn ? '#c084fc' : hex(f), -0.42)
  // öron
  ctx.fillStyle = mork
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x + s * r * 0.35, y - r * 0.82)
    ctx.lineTo(x + s * r * 0.95, y - r * 0.95)
    ctx.lineTo(x + s * r * 0.8, y - r * 0.3)
    ctx.closePath()
    ctx.fill()
  }
  // enhörningens horn
  if (regn) {
    ctx.fillStyle = '#ffd43b'
    ctx.beginPath()
    ctx.moveTo(x - r * 0.2, y - r * 0.82)
    ctx.lineTo(x, y - r * 1.75)
    ctx.lineTo(x + r * 0.2, y - r * 0.82)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#f59f00'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(x - r * 0.13, y - r * 1.05)
    ctx.lineTo(x + r * 0.11, y - r * 1.18)
    ctx.moveTo(x - r * 0.08, y - r * 1.35)
    ctx.lineTo(x + r * 0.07, y - r * 1.45)
    ctx.stroke()
  }
  // kropp
  ctx.fillStyle = mork
  ctx.beginPath()
  ctx.arc(x, y + r * 0.07, r, 0, Math.PI * 2)
  ctx.fill()
  if (regn) {
    for (let i = 0; i < RB.length; i++) {
      ctx.fillStyle = RB[i]
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.arc(x, y, r * 0.94, (i / RB.length) * Math.PI * 2 + t * 2, ((i + 1) / RB.length) * Math.PI * 2 + t * 2)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, r * 0.62, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = kropp
    ctx.beginPath()
    ctx.arc(x, y, r * 0.94, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ljusare(kropp, 0.35)
    ctx.beginPath()
    ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.24, 0, Math.PI * 2)
    ctx.fill()
  }
  if (dold) {
    ctx.fillStyle = '#ffffff'
    ctx.font = `900 ${Math.round(r * 1.1)}px ui-rounded, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('?', x, y + 1)
    return
  }
  // tryne och ögon
  ctx.fillStyle = regn ? '#ffd1e8' : ljusare(kropp, 0.25)
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.28, r * 0.4, r * 0.28, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = mork
  ctx.beginPath()
  ctx.arc(x - r * 0.13, y + r * 0.28, r * 0.07, 0, Math.PI * 2)
  ctx.arc(x + r * 0.13, y + r * 0.28, r * 0.07, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a1420'
  const blink = Math.sin(t * 1.3 + x) > 0.985 ? 0.2 : 1
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(x + s * r * 0.32, y - r * 0.12, r * 0.09, r * 0.11 * blink, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // ammo
  if (ammo != null) {
    const txt = String(ammo)
    const fs = Math.max(9, Math.round(r * 0.78))
    ctx.font = `900 ${fs}px ui-rounded, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const bw = ctx.measureText(txt).width + 8
    const by = y - r - fs * 0.45 - (regn ? r * 0.7 : 0)
    ctx.fillStyle = 'rgba(10, 14, 28, 0.85)'
    rundRekt(ctx, x - bw / 2, by - fs * 0.55, bw, fs * 1.1, fs * 0.5)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(txt, x, by + 0.5)
  }
  if (lank) {
    ctx.strokeStyle = '#c7cede'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x + r * 0.85, y + r * 0.65, r * 0.22, 0, Math.PI * 2)
    ctx.stroke()
  }
}
