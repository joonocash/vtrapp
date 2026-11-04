import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { W, H, KANON, KRAFTER, HAL_R, multiplikator, mitt, ANTAL_ORANGE, botSkott, zenVinkel } from '../pinnboll/motor.js'
import { useSpelyta } from '../delat/useSpelyta.js'
import { easeOut, easeOutBack, rundRekt } from '../delat/fx.js'
import { Notis, useNotis } from '../delat/Ui.jsx'
import * as R from '../pinnboll/rita.js'
import '../pinnboll/pinnboll.css'
import { KULTYPER } from './innehall.js'

// Kulkaos — spelplanen för en bana: canvasen, siktet, effekterna och
// reglagen. Byggd på Pinnbollens spelyta (samma motor och samma ritning),
// med det Kulkaos behöver ovanpå: bossen med livmätare, guld och
// guldpinnar, blixtar, studsgolv och hjälten i kanonen — och kulväskan:
// kultyperna i färg, nästa kulor vid kanonen, lasrar, svarta hål,
// specialpinnarna, flipprarna, zenskottet och bossens attacker.
//
// Föräldern skapar spelet (skapaSpel) och får veta när banan är slut via
// onKlar('vinst' | 'slut'). statsRef fylls med det utmaningarna vill veta.

const STEG = 1 / 120
const RAD_PER_PX = (Math.PI * 0.93) / W
const KANSLIGHET = 3
const FIN_FAKTOR = 0.3
const FIN_GRANS = 70
const fmt = (n) => Math.round(n).toLocaleString('sv-SE')

function nyttLage(spel) {
  return {
    spel,
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
    tryck: null,
    snabb: false,
    vantarKort: null,
    hinkGlod: 0,
    kulPuls: -10,
    nastaFyr: 0,
    smutsig: false,
    sistaVarnad: false,
    zonY: 24,
    studs: new Map(),
    kulTopp: 0,
    kulPulsN: 0,
    guldPuls: -10,
    bossT: -10,
    bossSkada: null,
    blixtar: [],
    raketer: [], // Orangestormen: orange pinnar och kulor som flyger in i bossen
    stormSkada: null,
    golvT: -10,
    skottStart: 0,
    lasrar: [],
    attack: null,
  }
}

// Kultypens färg (småkulorna har sin förälders färg).
const BABY = { baby: 'agg', spokbaby: 'spokagg', jarnbaby: 'jarn' }
const kulFarg = (typ) => KULTYPER[BABY[typ] || typ]?.farg
const ATTACK = {
  stenar: '🪨 Bossen kastar stenar!',
  skold: '🛡️ Bossen tar fram en sköld!',
  flytta: '🔀 Bossen flyttar de orange!',
  slem: '🫧 Bossen slemmar ner pinnarna!',
  hela: '💚 Bossen läker sig!',
}

export default function Spelplan({ spel, bana, varld, kanonIkon, hjalteNamn, rubrik, underrubrik, guldFore = 0, introRader, overlagg, statsRef, ljud, fx, onKlar, onRedo, onMeny, zen = 0 }) {
  const [, rendera] = useReducer((x) => x + 1, 0)
  const [intro, setIntro] = useState(true)
  const [mastare, setMastare] = useState(null)
  const [notis, visaNotis] = useNotis()
  const a = useRef(null)
  if (!a.current || a.current.spel !== spel) a.current = nyttLage(spel)
  const klarRef = useRef(onKlar)
  klarRef.current = onKlar
  const harFlipper = useMemo(() => spel.objekt.some((o) => o.flipper), [spel])

  useEffect(() => {
    fx.tom()
    setMastare(null)
    setIntro(true)
    const id = setTimeout(() => setIntro(false), 2600)
    return () => clearTimeout(id)
  }, [spel]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mastare) return
    const id = setTimeout(() => setMastare(null), mastare.ms || 1700)
    return () => clearTimeout(id)
  }, [mastare])

  useEffect(() => {
    // för webbläsartesterna: bot() ger en vinkel som tänder mycket
    if (import.meta.env.DEV) window.__kaos = { spel, bana, a: a.current, skjut: () => skjut(), sikta: (v) => spel.sikta(v), bot: () => botSkott(spel, { vinklar: 16 }) }
  })

  const st = (k, v) => {
    if (statsRef?.current) statsRef.current[k] = Math.max(statsRef.current[k] || 0, v)
  }

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
          fx.text(e.x, e.y - 9, fmt(e.poang), { storlek: e.farg === 'bla' ? 10 : e.farg === 'lila' ? 16 : 13, farg: e.farg === 'bla' ? '#dbeafe' : f.ljus, liv: 0.7, stig: 22, studs: e.farg !== 'bla' })
          if (e.farg === 'orange') fx.ring(e.x, e.y, f.glod, 22, 0.3, 2.5)
          if (e.farg === 'lila') fx.ring(e.x, e.y, f.glod, 34, 0.45, 3)
          if (spel.eldNu && statsRef?.current) statsRef.current.eldTand = (statsRef.current.eldTand || 0) + 1
          st('maxTraffar', e.nr)
          if (e.mult > (s.senastMult || 1)) {
            s.senastMult = e.mult
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
        case 'gratisKula':
          s.kulPuls = s.t
          ljud.extraKula()
          fx.text(W / 2, 470, '🎰 GRATIS SKOTT!', { storlek: 20, farg: '#fde047', liv: 1.3, stig: 30 })
          break
        case 'hink':
          s.hinkGlod = 1
          ljud.hink()
          fx.sprut(e.x, 575, ['#fde68a', '#ffffff', '#86efac'], 22, { fart: 200, liv: 0.7, form: 'stjarna', lyft: 120 })
          break
        case 'guldhink':
          fx.text(e.x, 500, `🏆 +${fmt(e.poang)}`, { storlek: 20, farg: '#fde047', liv: 1.4, stig: 40 })
          break
        case 'guld':
          s.guldPuls = s.t
          ljud.mynt?.()
          fx.text(e.x, e.y - 12, `+${e.n}🪙`, { storlek: 12, farg: '#fde047', liv: 0.8, stig: 26 })
          fx.sprut(e.x, e.y, ['#fde047', '#f59e0b', '#ffffff'], 6, { fart: 110, liv: 0.4, form: 'stjarna', storlek: 2 })
          s.smutsig = true
          break
        case 'stil':
          s.stilar.push({ namn: e.namn, poang: e.poang, t: s.t })
          ljud.stil()
          break
        case 'kraft':
          krafteffekt(e)
          break
        case 'studs':
          s.studs.set(e.id, s.t)
          ljud.studs(e.kvar)
          fx.ring(e.x, e.y, '#ffffff', 26, 0.25, 3)
          break
        case 'small': {
          const f =
            e.orsak === 'bomb'
              ? ['#ffd43b', '#ff7a1a', '#ffffff']
              : e.orsak === 'meteor'
                ? ['#ffb020', '#ff5a1f', '#fff7d6']
                : e.orsak === 'guld'
                  ? ['#fde047', '#f59e0b', '#ffffff']
                  : e.orsak === 'jord'
                    ? ['#f5d0a9', '#b45309', '#ffffff']
                    : e.orsak === 'hal'
                      ? ['#e9d5ff', '#7c3aed', '#ffffff']
                      : ['#c8ffd8', '#4dff8a', '#ffffff']
          ljud.small()
          fx.skaka(e.orsak === 'bomb' ? 7 : 5)
          fx.ring(e.x, e.y, f[1], e.radie, 0.45, 5)
          fx.sprut(e.x, e.y, f, 18, { fart: 220, liv: 0.5, form: 'gnista', storlek: 2.4 })
          break
        }
        case 'blixt':
          s.blixtar.push({ x: e.x, y: e.y, till: e.till, t: s.t })
          ljud.blixt?.()
          break
        case 'delning':
          ljud.nyKula()
          if (e.nya.length) fx.text(e.x, e.y - 14, `×${e.nya.length + 1}`, { storlek: 15, farg: '#e0f2fe', liv: 0.7, stig: 20 })
          fx.ring(e.x, e.y, '#e0f2fe', 24, 0.3, 2.5)
          break
        case 'golv':
          s.golvT = s.t
          ljud.studs(6)
          fx.sprut(e.x, H - 4, ['#a5f3fc', '#ffffff'], 10, { fart: 160, liv: 0.4, lyft: 140 })
          break
        case 'bossTraff':
          s.bossT = s.t
          ljud.studs(10)
          fx.ring(e.x, e.y, '#fca5a5', 30, 0.3, 3)
          fx.sprut(e.x, e.y, ['#fecaca', '#ef4444', '#ffffff'], 8, { fart: 160, liv: 0.35, storlek: 2.2 })
          break
        case 'bossSkada': {
          const b = spel.objekt.find((o) => o.boss)
          const [bx, by] = b ? [b.wx, b.wy] : [W / 2, 200]
          s.bossSkada = { skada: e.skada, t: s.t, x: bx, y: by }
          s.bossT = s.t
          ljud.small()
          fx.skaka(Math.min(12, 3 + e.skada / 12))
          fx.text(bx, by - 46, `−${e.skada}`, { storlek: Math.min(40, 18 + e.skada / 4), farg: '#fca5a5', liv: 1.3, stig: 40, studs: true })
          s.smutsig = true
          break
        }
        case 'bossDod': {
          const b = spel.objekt.find((o) => o.boss)
          const [bx, by] = b ? [b.wx, b.wy] : [W / 2, 250]
          ljud.feber()
          fx.hitstop(220)
          fx.skaka(14)
          fx.konfetti(bx, by, 140)
          fx.ring(bx, by, '#ffffff', 120, 0.7, 6)
          fx.sprut(bx, by, ['#ff7a1a', '#ffd43b', '#ffffff', '#ef4444'], 60, { fart: 300, liv: 1, form: 'gnista' })
          s.slowTill = s.t + 1
          setMastare({ text: `${bana.boss?.namn || 'Bossen'} är besegrad!`, key: s.t, ms: 2600 })
          s.smutsig = true
          break
        }
        case 'bossStorm': {
          // Orangestormen: allt orange (och kulorna) flyger in i bossen
          const [bx, by] = e.till
          const lista = [...e.fran.map((p) => ({ p, kula: false })), ...e.kulor.map((p) => ({ p, kula: true }))]
          lista.forEach(({ p, kula }, i) => s.raketer.push({ x0: p[0], y0: p[1], x1: bx, y1: by, t0: s.t + 0.15 + i * 0.045, dur: 0.42 + Math.random() * 0.12, kula, sida: Math.random() < 0.5 ? -1 : 1, klar: false }))
          s.stormSkada = { skada: e.skada, t: s.t + 0.6 + lista.length * 0.045, x: bx, y: by }
          s.fokus = null
          s.slowTill = 0
          s.storm = true
          ljud.stil()
          fx.hitstop(90)
          fx.skaka(6)
          for (const [x, y] of e.fran) fx.ring(x, y, '#ff9a3c', 20, 0.3, 2.5)
          setMastare({ text: 'ORANGESTORMEN!', key: s.t, ms: 1800 })
          s.smutsig = true
          break
        }
        case 'aterstall':
          ljud.extraKula()
          visaNotis(s.storm ? '🌊 Ny våg!' : '✨ Planen fylls på!', 1500)
          s.storm = false
          for (const o of spel.objekt) s.pop.delete(o.id)
          s.smutsig = true
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
          if (statsRef?.current) statsRef.current.feber = true
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
        case 'krit':
          ljud.multi(5)
          fx.ring(e.x, e.y, '#fde047', 36, 0.4, 4)
          fx.sprut(e.x, e.y, ['#fef08a', '#facc15', '#ffffff'], 14, { fart: 180, liv: 0.5, form: 'gnista', storlek: 2.2 })
          fx.text(e.x, e.y - 16, '⚡ KRIT ×2', { storlek: 16, farg: '#fde047', liv: 1, stig: 30, studs: true })
          s.smutsig = true
          break
        case 'fornyTraff':
          ljud.kraft()
          fx.ring(e.x, e.y, '#5eead4', 34, 0.45, 4)
          fx.text(e.x, e.y - 16, '♻️ Förnyas!', { storlek: 14, farg: '#99f6e4', liv: 1, stig: 26 })
          break
        case 'forny':
          visaNotis(`♻️ ${e.antal} pinnar kom tillbaka!`, 1500)
          for (const o of spel.objekt) s.pop.delete(o.id)
          s.smutsig = true
          break
        case 'laser':
          s.lasrar.push({ x: e.x, y: e.y, horisontell: e.horisontell, t: s.t })
          ljud.blixt?.()
          fx.skaka(3)
          break
        case 'agg':
          ljud.nyKula()
          fx.sprut(e.x, e.y, e.spoke ? ['#ede9fe', '#c4b5fd', '#ffffff'] : ['#fef3c7', '#fde68a', '#ffffff'], 14, { fart: 160, liv: 0.45, storlek: 2.4 })
          fx.text(e.x, e.y - 14, `🥚 ×${e.n}`, { storlek: 15, farg: '#fef3c7', liv: 0.8, stig: 22, studs: true })
          break
        case 'cell':
          ljud.nyKula()
          fx.ring(e.x, e.y, '#4ade80', 22, 0.3, 2.5)
          break
        case 'hagel':
          ljud.small()
          fx.skaka(4)
          fx.sprut(e.x, e.y, ['#e2e8f0', '#94a3b8', '#ffffff'], 12, { fart: 240, liv: 0.3, form: 'gnista', storlek: 2 })
          break
        case 'svartHal':
          ljud.small()
          fx.skaka(7)
          fx.ring(e.x, e.y, '#a855f7', 70, 0.6, 6)
          fx.sprut(e.x, e.y, ['#c084fc', '#7c3aed', '#ffffff'], 30, { fart: 240, liv: 0.6, form: 'gnista' })
          fx.text(e.x, e.y - 24, '🌀 SVART HÅL!', { storlek: 17, farg: '#e9d5ff', liv: 1.1, stig: 30 })
          break
        case 'halBorta':
          ljud.poppa?.(6)
          fx.ring(e.x, e.y, '#e9d5ff', 40, 0.5, 4)
          fx.sprut(e.x, e.y, ['#e9d5ff', '#a855f7', '#ffffff'], 24, { fart: 160, liv: 0.6, form: 'stjarna' })
          fx.text(e.x, e.y + 22, 'Hålet stängs', { storlek: 13, farg: '#e9d5ff', liv: 1.2, stig: 20 })
          s.smutsig = true
          break
        case 'slem':
          ljud.studs(4)
          fx.sprut(e.x, e.y, ['#bef264', '#84cc16', '#ecfccb'], 9, { fart: 120, liv: 0.4, form: 'cirkel', storlek: 2.2 })
          break
        case 'slosa':
          s.kulPuls = s.t
          fx.text(W / 2, 470, `🦚 ${e.n} kulor tillbaka`, { storlek: 17, farg: '#a5f3fc', liv: 1.3, stig: 30 })
          break
        case 'moln':
          ljud.nyKula()
          fx.text(W / 2, 96, '☁️ Molnet!', { storlek: 18, farg: '#e0f2fe', liv: 1.1, stig: 20 })
          fx.sprut(W / 2, 72, ['#ffffff', '#e0f2fe', '#bae6fd'], 20, { fart: 120, liv: 0.6, form: 'cirkel' })
          break
        case 'bossAttack': {
          const b = spel.objekt.find((o) => o.boss)
          const [bx, by] = b ? [b.wx, b.wy] : [W / 2, 200]
          s.attack = { typ: e.attack, t: s.t }
          ljud.small()
          fx.skaka(6)
          fx.ring(bx, by, e.attack === 'hela' ? '#4ade80' : e.attack === 'skold' ? '#67e8f9' : '#f87171', 60, 0.5, 5)
          for (const [x, y] of e.pos || []) {
            fx.ring(x, y, '#fca5a5', 20, 0.4, 3)
            fx.sprut(x, y, ['#fecaca', '#ffffff'], 6, { fart: 100, liv: 0.35, storlek: 2 })
          }
          setMastare({ text: ATTACK[e.attack] || 'Bossen slår tillbaka!', key: s.t, ms: 1500, ikon: bana.boss?.ikon, namn: bana.boss?.namn })
          s.smutsig = true
          break
        }
        case 'skottSlut':
          skottSlut(e)
          break
        case 'slut':
          s.vantarKort = { typ: 'slut', vid: s.blockTill + 0.35 }
          break
        case 'banaKlar':
          s.vantarKort = { typ: 'vinst', vid: s.blockTill + (bana.boss ? 1.6 : 1.1) }
          break
        case 'redo':
          s.smutsig = true
          onRedo?.(spel.kulorKvar + 1)
          if (spel.kulorKvar === 0 && !s.sistaVarnad && !bana.bonus) {
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
    st('langsta', s.t - s.skottStart)
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
    if (e.poang > 0) s.skottText = { poang: e.poang, traffar: e.traffar, t: s.t }
    if (e.slant != null) {
      s.slant = { vann: e.slant, t: s.t }
      ljud.slant(e.slant)
      till = Math.max(till, s.t + 1.5)
    }
    s.blockTill = till
    s.senastMult = spel.mult()
    s.smutsig = true
  }

  /* ---------------------------------------------------------------- styrning */

  function kanSkjuta() {
    const s = a.current
    return !overlagg && spel.lage === 'siktar' && spel.iKanonen && s.t >= s.blockTill
  }

  function skjut() {
    const s = a.current
    if (!kanSkjuta()) return
    // Zenskottet: kanonen hittar en lite bättre vinkel alldeles intill
    if (zen > 0) {
      const fore = spel.vinkel
      const v = zenVinkel(spel, fore, { bredd: zen, n: 5 })
      if (Math.abs(v - fore) > 0.002) {
        spel.sikta(v)
        fx.text(KANON.x, KANON.y + 46, '🧘', { storlek: 16, farg: '#ffffff', liv: 0.7, stig: 16 })
      }
    }
    if (spel.skjut()) {
      ljud.skott()
      s.senastMult = spel.mult()
      s.spar.clear()
      s.skottText = null
      s.stilar = []
      s.skottStart = s.t
      const tx = KANON.x + Math.cos(spel.vinkel) * 30
      const ty = KANON.y + Math.sin(spel.vinkel) * 30
      fx.sprut(tx, ty, ['#ffffff', '#fde68a'], 8, { vinkel: spel.vinkel, spridning: 0.8, fart: 140, liv: 0.25, storlek: 2 })
      setIntro(false)
      s.smutsig = true
    }
  }

  const sikta = (v) => spel.sikta(v)

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
    } else if (harFlipper) {
      s.tryck = { id: e.pointerId, typ: 'flipper', mus }
      spel.flippa(true)
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
    t.fin = p.y - t.y0 > FIN_GRANS
    sikta(t.v0 - (p.x - t.x0) * RAD_PER_PX * KANSLIGHET * (t.fin ? FIN_FAKTOR : 1))
  }

  function upp(p) {
    const s = a.current
    const t = s.tryck
    if (!t || p.e.pointerId !== t.id) return
    s.tryck = null
    s.snabb = false
    if (t.typ === 'flipper') spel.flippa(false)
    if (t.typ !== 'sikta') return
    if (p.y < s.zonY && !t.mus) return // släppt uppe vid kanonen: avbryt
    skjut()
  }

  function avbryt(p) {
    const s = a.current
    if (s.tryck && p.e.pointerId === s.tryck.id) {
      if (s.tryck.typ === 'flipper') spel.flippa(false)
      s.tryck = null
      s.snabb = false
    }
  }

  const tangent = useRef(null)
  tangent.current = (e, upp) => {
    if (overlagg) return
    // flipprarna: håll in mellanslag (eller pil ner) medan kulorna är ute
    const flipKnapp = e.key === ' ' || e.key === 'ArrowDown'
    if (harFlipper && flipKnapp && (upp || spel.lage !== 'siktar')) {
      spel.flippa(!upp)
      e.preventDefault()
      return
    }
    if (upp) return
    const steg = e.shiftKey ? 0.0035 : 0.017
    if (e.key === 'ArrowLeft') sikta(spel.vinkel + steg)
    else if (e.key === 'ArrowRight') sikta(spel.vinkel - steg)
    else if (e.key === ' ' || e.key === 'Enter') {
      if (!e.repeat) skjut()
    } else return
    e.preventDefault()
  }
  useEffect(() => {
    const f = (upp) => (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return
      tangent.current(e, upp)
    }
    const ner = f(false)
    const upp = f(true)
    window.addEventListener('keydown', ner)
    window.addEventListener('keyup', upp)
    return () => {
      window.removeEventListener('keydown', ner)
      window.removeEventListener('keyup', upp)
    }
  }, [])

  /* ---------------------------------------------------------------- loopen */

  function uppdatera(dt) {
    const s = a.current
    s.t += dt
    fx.uppdatera(dt)
    if (!fx.fryst()) {
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
    st('maxKulor', spel.kulor.length)
    // spår efter kulorna (färre när planen är full av kulor)
    const levande = new Set()
    const langd = spel.kulor.length > 20 ? 5 : spel.eldNu ? 14 : 9
    for (const k of spel.kulor) {
      levande.add(k.id)
      let sp = s.spar.get(k.id)
      if (!sp) s.spar.set(k.id, (sp = []))
      sp.push([k.x, k.y])
      while (sp.length > langd) sp.shift()
    }
    for (const id of s.spar.keys()) if (!levande.has(id)) s.spar.delete(id)
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
    if (spel.feber && s.feberT != null && s.t > s.feberT + 0.45) s.fackUpp = Math.min(1, s.fackUpp + dt / 0.5)
    if (s.fackTraff) s.fackTraff.tid += dt
    s.hinkGlod = Math.max(0, s.hinkGlod - dt * 1.4)
    if (spel.feber && s.feberT != null && s.t - s.feberT < 6 && s.t > s.nastaFyr) {
      s.nastaFyr = s.t + 0.28 + Math.random() * 0.3
      fx.sprut(40 + Math.random() * 280, 90 + Math.random() * 260, ['#ff5a7a', '#ffd43b', '#5ce1e6', '#9b7bff', '#5bd96b', '#ffffff'], 28, { fart: 210, liv: 0.95, form: 'gnista', gravitation: 120, storlek: 2.6 })
    }
    while (s.popKo.length && s.popKo[0].tid <= s.t) {
      const p = s.popKo.shift()
      const o = spel.objekt[p.id]
      if (!o) continue
      const [x, y] = mitt(o)
      const f = R.FARG[o.farg]
      fx.sprut(x, y, [f.ljus, f.bas, '#ffffff'], o.typ === 'tegel' ? 9 : 6, { fart: 130, liv: 0.35, storlek: 2.4 })
      ljud.poppa(p.i)
    }
    s.blixtar = s.blixtar.filter((b) => s.t - b.t < 0.35)
    s.lasrar = s.lasrar.filter((l) => s.t - l.t < 0.4)
    if (spel.lage === 'siktar' && spel.flipperUppe && s.tryck?.typ !== 'flipper') spel.flippa(false)
    // raketerna i Orangestormen slår ner i bossen en efter en
    for (const r of s.raketer) {
      if (r.klar || s.t < r.t0 + r.dur) continue
      r.klar = true
      s.bossT = s.t
      ljud.traff(8 + (r.kula ? 4 : 0), 'orange', false)
      fx.sprut(r.x1, r.y1, ['#ffd43b', '#ff7a1a', '#ffffff'], 7, { fart: 200, liv: 0.4, form: 'gnista', storlek: 2.2 })
      fx.skaka(2.5)
    }
    s.raketer = s.raketer.filter((r) => !r.klar)
    if (s.stormSkada && s.t >= s.stormSkada.t) {
      const d = s.stormSkada
      s.stormSkada = null
      ljud.small()
      fx.skaka(11)
      fx.ring(d.x, d.y, '#ff9a3c', 90, 0.55, 6)
      fx.ring(d.x, d.y, '#ffffff', 55, 0.35, 3)
      fx.konfetti(d.x, d.y, 60)
      fx.text(d.x, d.y - 50, `−${d.skada}`, { storlek: Math.min(46, 22 + d.skada / 4), farg: '#ffb366', liv: 1.5, stig: 44, studs: true })
      s.smutsig = true
    }
    if (s.vantarKort && s.t >= s.vantarKort.vid && !s.popKo.length) {
      const v = s.vantarKort
      s.vantarKort = null
      klarRef.current?.(v.typ)
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

    ritaHal(ctx, t)
    for (const o of spel.objekt) {
      if (o.boss) continue
      if (o.flipper || o.pyramid) {
        ritaFlipper(ctx, o)
        continue
      }
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
      const stt = o.kick ? s.studs.get(o.id) : null
      const studsK = stt != null && t - stt < 0.18 ? 1 - (t - stt) / 0.18 : 0
      if (studsK) skal *= 1 + 0.25 * studsK
      if (o.form === 'cirkel') R.ritaPinne(ctx, o.wx, o.wy, o.r, o.farg, lit, skal, alfa)
      else R.ritaTegel(ctx, o, o.hard ? 'lila' : o.farg, lit, 1 + (skal - 1) * 0.35, alfa)
      if (o.kick && !o.hard && !o.borta) R.ritaStudsare(ctx, o, studsK, o.kickKvar / (o.kickAntal || 10))
      if (o.bomb && !o.lit && !o.borta) R.ritaBomb(ctx, o, t)
      if (o.guld && !o.lit && !o.borta) ritaGuldpinne(ctx, o, t)
      if (!o.borta) ritaSpecial(ctx, o, t)
    }
    for (const o of spel.objekt) if (o.boss) ritaBoss(ctx, o, t)
    ritaBlixtar(ctx, t)
    ritaLasrar(ctx, t)
    ritaRaketer(ctx, t)

    const visaSikte = !overlagg && spel.lage === 'siktar' && spel.iKanonen && t >= s.blockTill
    if (visaSikte) {
      const lang = spel.sparKvar > 0
      R.ritaSikte(ctx, spel.siktlinje(lang ? 2 : 0, 1.1), lang, t)
    }
    if (!spel.feber && spel.hinkBredd > 0) R.ritaHink(ctx, spel.hinkX, t, s.hinkGlod, spel.hinkBredd)
    if (spel.perk.golv && t - s.golvT < 0.3) {
      ctx.fillStyle = `rgba(165,243,252,${0.6 * (1 - (t - s.golvT) / 0.3)})`
      ctx.fillRect(0, H - 4, W, 4)
    }
    R.ritaFack(ctx, s.fackUpp, spel.rensat, t, s.fackTraff)
    const typ = spel.eldNu ? 'eld' : spel.spokNu ? 'spok' : 'vanlig'
    for (const k of spel.kulor) {
      R.ritaKula(ctx, k, s.spar.get(k.id) || [], typ)
      if (k.typ && typ === 'vanlig') ritaKulTyp(ctx, k)
    }
    R.ritaKanon(ctx, spel.vinkel, visaSikte, kanonIkon, t, spel.eldKvar > 0)
    fx.rita(ctx)
    ctx.restore()
    ritaHud(ctx, t)
  }

  // Kultypens färg ovanpå kulan, med en ring.
  function ritaKulTyp(ctx, k) {
    const f = kulFarg(k.typ)
    if (!f) return
    ctx.save()
    ctx.globalAlpha = k.genom ? 0.55 : 0.6
    ctx.fillStyle = f
    ctx.beginPath()
    ctx.arc(k.x, k.y, k.r * 0.92, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = f
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(k.x, k.y, k.r + 1.4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 0.85
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(k.x - k.r * 0.35, k.y - k.r * 0.4, k.r * 0.25, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Kritpinnar, förnyare, slempinnar och bossens stenar.
  function ritaSpecial(ctx, o, t) {
    const [x, y] = o.form === 'cirkel' ? [o.wx, o.wy] : mitt(o)
    const r = o.form === 'cirkel' ? o.r : 7
    if (o.krit && !o.lit) {
      const g = 0.5 + 0.5 * Math.sin(t * 7 + o.id)
      ctx.save()
      ctx.strokeStyle = `rgba(250,204,21,${0.6 + 0.4 * g})`
      ctx.shadowColor = '#facc15'
      ctx.shadowBlur = 6 + 6 * g
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.arc(x, y, r + 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      emoji(ctx, '⚡', x, y + 0.5, r * 1.3)
    }
    if (o.forny && !o.lit) {
      ctx.save()
      ctx.strokeStyle = '#5eead4'
      ctx.lineWidth = 2.2
      ctx.setLineDash([3, 3])
      ctx.lineDashOffset = -t * 12
      ctx.beginPath()
      ctx.arc(x, y, r + 3.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      emoji(ctx, '♻️', x, y + 0.5, r * 1.15)
    }
    if (o.slem > 0) {
      const w = Math.sin(t * 4 + o.id) * 0.12
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.fillStyle = '#84cc16'
      ctx.beginPath()
      ctx.ellipse(x, y, r * (1.35 + w), r * (1.35 - w), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = '#d9f99d'
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.restore()
    }
    if (o.sten) {
      ctx.save()
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r + 1)
      g.addColorStop(0, '#d6d3d1')
      g.addColorStop(1, '#57534e')
      ctx.fillStyle = g
      ctx.beginPath()
      for (let i = 0; i < 7; i++) {
        const v = (i / 7) * Math.PI * 2
        const rr = (r + 1.5) * (0.85 + 0.15 * Math.sin(i * 2.7 + o.id))
        ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(v) * rr, y + Math.sin(v) * rr)
      }
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#292524'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
      text(ctx, `${o.stenKvar}`, x, y + 0.5, 8, '#fafaf9', 'center', 'rgba(0,0,0,0.6)')
    }
  }

  function emoji(ctx, tecken, x, y, storlek) {
    ctx.font = `${storlek}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(tecken, x, y)
  }

  // Flipprarna och pyramidens väggar.
  function ritaFlipper(ctx, o) {
    const upp = o.flipper && spel.flipperUppe
    ctx.save()
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = o.tj * 2 + 3
    ctx.beginPath()
    ctx.moveTo(o.wx1 + 2, o.wy1 + 3)
    ctx.lineTo(o.wx2 + 2, o.wy2 + 3)
    ctx.stroke()
    const g = ctx.createLinearGradient(o.wx1, o.wy1 - o.tj, o.wx1, o.wy1 + o.tj)
    if (o.flipper) {
      g.addColorStop(0, upp ? '#fff7ed' : '#ffffff')
      g.addColorStop(1, upp ? '#fb923c' : '#ef4444')
    } else {
      g.addColorStop(0, '#fde68a')
      g.addColorStop(1, '#d97706')
    }
    ctx.strokeStyle = g
    ctx.lineWidth = o.tj * 2
    ctx.beginPath()
    ctx.moveTo(o.wx1, o.wy1)
    ctx.lineTo(o.wx2, o.wy2)
    ctx.stroke()
    if (o.flipper) {
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      ctx.arc(o.wx1, o.wy1, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // Svarta hål: en virvel som drar till sig kulorna.
  function ritaHal(ctx, t) {
    for (const h of spel.hal || []) {
      if (h.borta) continue
      const aktiv = h.redo && !spel.feber
      ctx.save()
      const dragZon = ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, HAL_R)
      dragZon.addColorStop(0, aktiv ? 'rgba(124,58,237,0.28)' : 'rgba(124,58,237,0.08)')
      dragZon.addColorStop(1, 'rgba(124,58,237,0)')
      ctx.fillStyle = dragZon
      ctx.beginPath()
      ctx.arc(h.x, h.y, HAL_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.translate(h.x, h.y)
      ctx.rotate(t * (aktiv ? 2.4 : 0.8))
      ctx.globalAlpha = aktiv ? 0.9 : 0.4
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2)
        ctx.strokeStyle = i % 2 ? '#c084fc' : '#7c3aed'
        ctx.lineWidth = 2.2
        ctx.beginPath()
        ctx.arc(6, 0, 10, Math.PI * 0.9, Math.PI * 1.9)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = '#05010d'
      ctx.beginPath()
      ctx.arc(0, 0, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = aktiv ? '#e9d5ff' : '#6b21a8'
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
      // laddningarna som är kvar: små prickar under hålet
      for (let i = 0; i < h.kvar; i++) {
        ctx.fillStyle = aktiv ? '#e9d5ff' : 'rgba(233,213,255,0.45)'
        ctx.beginPath()
        ctx.arc(h.x + (i - (h.kvar - 1) / 2) * 7, h.y + 19, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // Laserstrålar längs en rad eller en kolumn.
  function ritaLasrar(ctx, t) {
    for (const l of a.current.lasrar) {
      const k = 1 - (t - l.t) / 0.4
      ctx.save()
      ctx.globalAlpha = Math.max(0, k)
      ctx.shadowColor = '#f87171'
      ctx.shadowBlur = 14
      for (const [bredd, farg] of [
        [12 * k + 2, 'rgba(248,113,113,0.5)'],
        [3, '#fff1f2'],
      ]) {
        ctx.strokeStyle = farg
        ctx.lineWidth = bredd
        ctx.beginPath()
        if (l.horisontell) {
          ctx.moveTo(0, l.y)
          ctx.lineTo(W, l.y)
        } else {
          ctx.moveTo(l.x, 0)
          ctx.lineTo(l.x, H)
        }
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  function ritaGuldpinne(ctx, o, t) {
    const g = 0.5 + 0.5 * Math.sin(t * 5 + o.id)
    ctx.save()
    ctx.strokeStyle = `rgba(253,224,71,${0.7 + 0.3 * g})`
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(o.wx, o.wy, o.r + 2.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fde047'
    ctx.font = `900 ${o.r * 1.2}px ui-rounded, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('$', o.wx, o.wy + 0.5)
    ctx.restore()
  }

  function ritaBoss(ctx, o, t) {
    const traff = Math.max(0, 1 - (t - a.current.bossT) / 0.25)
    const andel = spel.bossMax ? bossHpVisat() / spel.bossMax : 1
    const r = o.r * (1 + 0.12 * traff)
    ctx.save()
    // skugga och kropp
    const g = ctx.createRadialGradient(o.wx - r * 0.3, o.wy - r * 0.35, r * 0.1, o.wx, o.wy, r)
    g.addColorStop(0, traff > 0.5 ? '#ffffff' : '#fecaca')
    g.addColorStop(0.6, '#ef4444')
    g.addColorStop(1, '#7f1d1d')
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.arc(o.wx + 3, o.wy + 5, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(o.wx, o.wy, r, 0, Math.PI * 2)
    ctx.fill()
    // livet som en ring runt bossen
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(o.wx, o.wy, r + 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = andel > 0.5 ? '#4ade80' : andel > 0.25 ? '#facc15' : '#f87171'
    ctx.beginPath()
    ctx.arc(o.wx, o.wy, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, andel))
    ctx.stroke()
    // ansiktet
    ctx.font = `${r * 1.25}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.translate(o.wx, o.wy + 1)
    ctx.rotate(Math.sin(t * 3) * 0.08 + traff * 0.3 * Math.sin(t * 40))
    ctx.fillText(bana.boss?.ikon || '👹', 0, 0)
    ctx.restore()
    if (spel.bossSkold > 0) {
      // skölden: en blå sexhörning runt bossen
      ctx.save()
      ctx.translate(o.wx, o.wy)
      ctx.rotate(t * 0.6)
      ctx.strokeStyle = `rgba(103,232,249,${0.7 + 0.25 * Math.sin(t * 6)})`
      ctx.fillStyle = 'rgba(103,232,249,0.12)'
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const v = (i / 6) * Math.PI * 2
        ctx[i ? 'lineTo' : 'moveTo'](Math.cos(v) * (r + 14), Math.sin(v) * (r + 14))
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      text(ctx, `🛡️ ${spel.bossSkold}`, o.wx, o.wy + r + 24, 11, '#a5f3fc')
    }
  }

  // Livet som visas: Orangestormens skada syns först när raketerna slår ner.
  function bossHpVisat() {
    return Math.min(spel.bossMax, spel.bossHp + (a.current.stormSkada?.skada || 0))
  }

  function ritaRaketer(ctx, t) {
    const s = a.current
    for (const r of s.raketer) {
      if (t < r.t0) {
        // väntar på sin tur: pinnen glöder
        ctx.fillStyle = 'rgba(255,170,60,0.55)'
        ctx.beginPath()
        ctx.arc(r.x0, r.y0, 9 + Math.sin(t * 30) * 2, 0, Math.PI * 2)
        ctx.fill()
        continue
      }
      const k = Math.min(1, (t - r.t0) / r.dur)
      const p = k * k
      // en båge åt sidan, så att raketerna sveper in från olika håll
      const cx = (r.x0 + r.x1) / 2 + r.sida * 90
      const cy = Math.min(r.y0, r.y1) - 60
      const pos = (q) => [(1 - q) * (1 - q) * r.x0 + 2 * (1 - q) * q * cx + q * q * r.x1, (1 - q) * (1 - q) * r.y0 + 2 * (1 - q) * q * cy + q * q * r.y1]
      ctx.save()
      ctx.lineCap = 'round'
      for (let i = 6; i >= 1; i--) {
        const [x, y] = pos(Math.max(0, p - i * 0.035))
        ctx.globalAlpha = 0.12 * (7 - i)
        ctx.fillStyle = r.kula ? '#e0f2fe' : i % 2 ? '#ffb020' : '#ff5a1f'
        ctx.beginPath()
        ctx.arc(x, y, 3 + (6 - i) * 0.7, 0, Math.PI * 2)
        ctx.fill()
      }
      const [x, y] = pos(p)
      ctx.globalAlpha = 1
      const g = ctx.createRadialGradient(x, y, 1, x, y, 10)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.4, r.kula ? '#bae6fd' : '#ffd43b')
      g.addColorStop(1, r.kula ? 'rgba(125,211,252,0)' : 'rgba(255,122,26,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  function ritaBlixtar(ctx, t) {
    const s = a.current
    for (const b of s.blixtar) {
      const k = 1 - (t - b.t) / 0.35
      ctx.save()
      ctx.globalAlpha = k
      ctx.strokeStyle = '#e0f2fe'
      ctx.shadowColor = '#7dd3fc'
      ctx.shadowBlur = 10
      ctx.lineWidth = 2.2
      for (const [tx, ty] of b.till) {
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        const n = 5
        for (let i = 1; i < n; i++) {
          const f = i / n
          const jx = (Math.sin(b.t * 50 + i * 7 + tx) * 9) | 0
          const jy = (Math.cos(b.t * 40 + i * 5 + ty) * 9) | 0
          ctx.lineTo(b.x + (tx - b.x) * f + jx, b.y + (ty - b.y) * f + jy)
        }
        ctx.lineTo(tx, ty)
        ctx.stroke()
      }
      ctx.restore()
    }
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

  function ritaHud(ctx, t) {
    const s = a.current
    const mal = spel.poang
    s.visadPoang += (mal - s.visadPoang) * 0.12
    if (Math.abs(mal - s.visadPoang) < 1) s.visadPoang = mal
    text(ctx, fmt(s.visadPoang), 10, 18, 18, '#ffffff', 'left')
    text(ctx, 'POÄNG', 11, 34, 8.5, 'rgba(255,255,255,0.65)', 'left', 'rgba(0,0,0,0.4)')
    // guldet
    const gp = Math.max(0, 1 - (t - s.guldPuls) / 0.4)
    text(ctx, `🪙 ${fmt(guldFore + spel.guld)}`, 10, 52, 13 + gp * 4, '#fde047', 'left')
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
    // kulväskan: de nästa kulorna bredvid kanonen
    const vaska = spel.vaska
    if (vaska?.length && vaska.some((k) => k.typ !== 'vanlig')) {
      // spel.skott är antalet skott hittills: nästa kula är vaska[skott % längd]
      for (let i = 0; i < Math.min(3, vaska.length); i++) {
        const kt = vaska[(spel.skott + i) % vaska.length]
        const x = 232 + i * 21
        const r = i === 0 ? 8 : 6.5
        ctx.globalAlpha = i === 0 ? 1 : 0.75
        R.ritaKula(ctx, { x, y: 17, r }, [], 'vanlig')
        if (kt.typ !== 'vanlig') {
          ritaKulTyp(ctx, { x, y: 17, r, typ: kt.typ })
          if (kt.niva > 1) text(ctx, `${kt.niva}`, x + r * 0.8, 17 + r * 0.8, 8, '#ffffff', 'center')
        }
        ctx.globalAlpha = 1
      }
      text(ctx, 'NÄSTA', 253, 34, 7.5, 'rgba(255,255,255,0.6)', 'center', 'rgba(0,0,0,0.4)')
    }
    // aktiva krafter
    let ky = 70
    const chip = (txt, farg) => {
      text(ctx, txt, 10, ky, 10.5, farg, 'left')
      ky += 14
    }
    if (spel.sparKvar > 99) chip('🔮 Siktet', '#bbf7d0')
    else if (spel.sparKvar > 0) chip(`🔮 Superspår ×${spel.sparKvar}`, '#bbf7d0')
    if (spel.eldKvar > 0 || spel.eldNu) chip('🔥 Eldboll', '#fdba74')
    if (spel.spokKvar > 0 || spel.spokNu) chip('👻 Spöksboll', '#ddd6fe')
    if (spel.krit && spel.lage !== 'siktar') chip('⚡ Krit ×2', '#fde047')
    if (spel.kulTyp && spel.kulTyp.typ !== 'vanlig' && spel.lage !== 'siktar') {
      const kt = KULTYPER[spel.kulTyp.typ]
      if (kt) chip(`${kt.ikon} ${kt.namn}${spel.kulTyp.niva > 1 ? ` ${spel.kulTyp.niva}` : ''}`, kt.farg)
    }
    // kulräknaren och rutorna vid 10, 20, 30 … kulor
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
      const pk = Math.max(0, 1 - (t - s.kulPulsN) / 0.25)
      ctx.save()
      ctx.translate(W - 30, 56)
      ctx.scale(1 + pk * 0.3, 1 + pk * 0.3)
      text(ctx, `×${n}`, 0, 0, 15 + Math.min(9, n / 5), n >= 30 ? '#fde047' : '#e0f2fe', 'center')
      ctx.restore()
    }
    if ((spel.lage === 'skjuter' || spel.lage === 'feber') && spel.skottTraffar > 0) {
      const sp = spel.skottPoang()
      const stl = Math.min(30, 13 + Math.log10(Math.max(10, sp)) * 3)
      text(ctx, `+${fmt(sp)}`, W / 2, 72, stl, sp >= 25000 ? '#86efac' : '#fde68a')
      text(ctx, `${spel.skottTraffar} ${spel.skottTraffar === 1 ? 'träff' : 'träffar'}`, W / 2, 72 + stl * 0.75, 9.5, 'rgba(255,255,255,0.8)', 'center', 'rgba(0,0,0,0.5)')
    }
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
    if (s.slant) {
      const k = t - s.slant.t
      if (k > 1.6) s.slant = null
      else if (k < 0.9) {
        const w = Math.abs(Math.cos(k * 22)) * 16 + 1
        ctx.fillStyle = '#facc15'
        ctx.strokeStyle = '#a16207'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.ellipse(W / 2, 470 - Math.sin((k / 0.9) * Math.PI) * 50, w, 16, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      } else text(ctx, s.slant.vann ? 'GRATIS KULA!' : 'Ingen tur…', W / 2, 470, s.slant.vann ? 22 : 16, s.slant.vann ? '#86efac' : '#cbd5e1')
    }
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
    if (s.snabb && s.skala > 1.5) text(ctx, '⏩', W - 18, H - 46, 16, '#ffffff')
    if (harFlipper && spel.lage === 'skjuter' && t - s.skottStart < 2.5) text(ctx, 'Håll in för flipprarna', W / 2, H - 70, 11, 'rgba(255,255,255,0.8)')
    // skada på bossen: en stor siffra en stund
    if (s.bossSkada && t - s.bossSkada.t > 2) s.bossSkada = null
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
  const boss = bana.boss
  const kraft = KRAFTER[bana.kraft] || KRAFTER.spar

  return (
    <div className="pb-spel">
      <header className="pb-topp">
        <button className="pb-kartknapp" onClick={onMeny} aria-label="Paus">
          <span aria-hidden="true">☰</span>
        </button>
        <div className="pb-titel">
          <b>{rubrik}</b>
          <small>{underrubrik}</small>
        </div>
        <div className="ds-hoger">
          <span className="kk-guldchip" title="Guld">
            🪙 {fmt(guldFore + spel.guld)}
          </span>
        </div>
      </header>

      {boss ? (
        <div className="kk-bossbar" aria-label={`${boss.namn}: ${bossHpVisat()} av ${spel.bossMax} liv`}>
          <b>
            {boss.ikon} {boss.namn}
          </b>
          <div>
            <i style={{ width: `${(100 * bossHpVisat()) / Math.max(1, spel.bossMax)}%` }} />
          </div>
          <span>
            {spel.bossSkold > 0 && <em className="kk-skold">🛡️{fmt(spel.bossSkold)}</em>}
            {fmt(bossHpVisat())}
          </span>
        </div>
      ) : (
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
      )}

      <div className="ds-yta pb-yta">
        <canvas ref={canvasRef} aria-label="Kulkaos — spelplan" />
        {intro && !overlagg && (
          <div className={`pb-intro${bana.bonus || boss ? ' bonus' : ''}`} aria-live="polite">
            <div className="pb-intro-varld">{introRader.topp}</div>
            <div className="pb-intro-namn">{introRader.namn}</div>
            <div className="pb-intro-mal">{introRader.mal}</div>
            {harFlipper && <div className="pb-intro-mal">🕹️ Håll in på planen (eller mellanslag) för flipprarna</div>}
            {!bana.bonus && (
              <div className="pb-intro-kraft">
                <i aria-hidden="true" /> Grön pinne ger <b>{kraft.namn}</b>
                <small>{kraft.text}</small>
              </div>
            )}
          </div>
        )}
        {mastare && (
          <div className={`pb-mastare${mastare.text === 'EXTREME FEVER!' ? ' feber' : ''}`} key={mastare.key}>
            <span className="pb-portratt emoji" aria-hidden="true">
              {mastare.ikon || kanonIkon}
            </span>
            <div>
              <b>{mastare.text}</b>
              <small>{mastare.namn || hjalteNamn}</small>
            </div>
          </div>
        )}
        <Notis notis={notis} />
      </div>

      <div className="pb-reglage">
        <FinKnapp tecken="◀" etikett="Sikta åt vänster" onSteg={(k) => sikta(spel.vinkel + k)} />
        {harFlipper && !siktlage && !overlagg ? (
          <button
            className="pb-skjut kk-flippknapp"
            aria-label="Flippa"
            onPointerDown={(e) => {
              e.preventDefault()
              spel.flippa(true)
            }}
            onPointerUp={() => spel.flippa(false)}
            onPointerLeave={() => spel.flippa(false)}
            onPointerCancel={() => spel.flippa(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            🕹️ Flippa
          </button>
        ) : (
          <button className="pb-skjut" onClick={skjut} disabled={!siktlage} aria-label="Skjut">
            Skjut
          </button>
        )}
        <FinKnapp tecken="▶" etikett="Sikta åt höger" onSteg={(k) => sikta(spel.vinkel - k)} />
      </div>
    </div>
  )
}

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
