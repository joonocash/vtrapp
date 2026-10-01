import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  skapaSpel,
  spelaDrag,
  giltigtByte,
  kanBytas,
  kanBytasFritt,
  arGrannar,
  hittaTips,
  hittaDrag,
  malStatus,
  malKlara,
  arPoangbana,
  godisregn,
  slutsmall,
  tassen,
  bytFritt,
  blandaBradet,
  laggUtSpecialer,
  stjarnorFor,
  skapaRng,
  hittaHappy,
  happyRedo,
  kanLanda,
  happyHopp,
  planteraMonster,
  HAR_MONSTER,
  HAPPY_MATT,
} from './engine.js'
import { skapaFx } from './fx.js'
import { Pjas, Koppel, Lera, MalIkon, Stjarna, Mynt, FARGER } from './pieces.jsx'
import { HappyBild } from './happy.jsx'
import { TIPS, SORTER, varldFor } from './levels.js'
import { BOOSTERS, BOOSTER_FRAN, EXTRA_DRAG, anvandBooster, belonning, dagensKlar, DAGENS_BELONNING, SVAR_BONUS } from './store.js'
import { skickaPoang, hamtaTopplista } from './synk.js'
import { readSettings } from '../../useSettings.js'

// En spelomgång på en bana: brädet, statusraden, boostrarna och rutorna
// som kommer upp när banan är vunnen eller förlorad.
//
// Motorn kör varje drag som en generator (se engine.js). Den här filen
// animerar stegen ett i taget: effekten spelas upp på det som syns, sedan
// renderas brädets nya läge, sedan nästa steg.

const TIPS_EFTER_MS = 6000
const BEROM = ['', '', '', 'Gott!', 'Ljuvligt!', 'Himmelskt!', 'Gudomligt!']

const fargFor = (f) => (f === undefined || f === null ? '#ffffff' : FARGER[f]?.bas || '#ffffff')

function ta(s) {
  return {
    tiles: s.tiles.map((t) => (t ? { ...t } : null)),
    lera: [...s.lera],
    koppel: [...s.koppel],
    drag: s.drag,
    poang: s.poang,
    mal: malStatus(s),
  }
}

export default function Spelplan({
  bana,
  save,
  setSave,
  ljud,
  fullskarmSparrad,
  svitBoost = [],
  topplistaId = null,
  spelare = null,
  onVinst,
  onForlust,
  onStartad,
  onKarta,
  onNasta,
  onIgen,
}) {
  const sRef = useRef(null)
  const svitCeller = useRef([])
  const handStart = useRef(null)
  // Vinstsviten gäller som den var när banan började, även om den bryts.
  const [svitVidStart] = useState(svitBoost)
  if (sRef.current === null) {
    // Dagens bana slumpas med dagens frö, så alla får samma bräde.
    sRef.current = skapaSpel(bana, bana.fro ? skapaRng(bana.fro) : Math.random)
    if (svitBoost.length) svitCeller.current = laggUtSpecialer(sRef.current, svitBoost)
    // Handledning första gången: på banan där en specialpjäs introduceras
    // målas mönstret in så att handen kan visa exakt draget som ger den, och
    // på de allra första banorna visar handen ett bra drag.
    const forstaGangen = !save.stjarnor[bana.nr] && !bana.dagens && !bana.oandlig
    if (forstaGangen && HAR_MONSTER.includes(bana.tips)) handStart.current = planteraMonster(sRef.current, bana.tips)
    if (forstaGangen && !handStart.current && bana.nr <= 3) {
      const t = hittaTips(sRef.current)
      if (t) handStart.current = [t.a, t.b]
    }
  }
  const s = sRef.current
  const varld = varldFor(bana)

  const [visat, setVisat] = useState(() => ta(s))
  const visatRef = useRef(visat)
  const [fas, setFas] = useState('start') // start, spel, regn, nastan, vunnen, forlorad
  const fasRef = useRef('start')
  const [vald, setVald] = useState(null)
  const [lage, setLage] = useState(null) // null, 'tass', 'byt'
  const [bytForst, setBytForst] = useState(null)
  const [tips, setTips] = useState(() => (bana.tips && !save.sett[bana.tips] ? TIPS[bana.tips] : null))
  const [startAnvand, setStartAnvand] = useState({})
  const [extraKop, setExtraKop] = useState(0)
  const [resultat, setResultat] = useState(null)
  const [forlustOrsak, setForlustOrsak] = useState('drag')
  const [topplista, setTopplista] = useState(null)
  const [meddelande, setMeddelande] = useState(null)
  const [hand, setHand] = useState(null)
  const handDrag = useRef(0)
  const flygRef = useRef(null)
  const spelplanRef = useRef(null)
  const happyKlon = useRef(null)
  const varnat = useRef({})
  // statistik för den här banan
  const rekord = useRef({ storstaKedja: 0, storstaDrag: 0, hinder: 0 })
  const dragetsBitar = useRef(0)

  const bradRef = useRef(null)
  const lagerRef = useRef(null)
  const canvasRef = useRef(null)
  const textRef = useRef(null)
  const dragRef = useRef(null)
  const fxRef = useRef(null)
  const busy = useRef(false)
  const levande = useRef(true)
  const tipsTimer = useRef(null)
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  }, [save])

  const byt = (f) => {
    fasRef.current = f
    setFas(f)
  }

  const visa = useCallback(() => {
    const v = ta(sRef.current)
    visatRef.current = v
    flushSync(() => setVisat(v))
    // Efter att React ritat om är pjäserna som skulle bort borta. Det som
    // finns kvar ska stå still på sin plats.
    fxRef.current?.stada()
  }, [])

  // ------------------------------------------------------------ uppsättning

  useEffect(() => {
    levande.current = true
    const fx = skapaFx({
      bradet: bradRef.current,
      lager: lagerRef.current,
      canvas: canvasRef.current,
      textlager: textRef.current,
      w: s.w,
      h: s.h,
    })
    fx.setInstallningar(readSettings())
    fxRef.current = fx
    fx.senare(() => {
      if (bana.dagens) fx.banner('Dagens bana', { farg: '#ffe066', storlek: 1.1, ms: 1300 })
      else if (bana.boss) fx.banner('Bossbana!', { farg: '#ff6b8a', storlek: 1.1, ms: 1500 })
      else if (bana.svarighet === 2) fx.banner('Supersvår!', { farg: '#ff5c5c', storlek: 1.1, ms: 1500 })
      else if (bana.svarighet === 1) fx.banner('Svår bana!', { farg: '#c792ff', storlek: 1.05, ms: 1400 })
      else if (bana.oandlig) fx.banner('Promenad ' + bana.oandlig, { farg: '#ffb347', ms: 1200 })
      else fx.banner('Bana ' + bana.nr, { ms: 1100 })
    }, 250)
    if (svitCeller.current.length) {
      // vinstsvitens specialpjäser ligger redan på brädet — visa var
      fx.senare(() => {
        fx.banner('Vinstsvit! ×' + svitVidStart.length, { farg: '#ffb347', storlek: 0.9, ms: 1200 })
        ljud.special()
        for (const i of svitCeller.current) fx.visaNy(visatRef.current.tiles[i]?.id, '#ffb347')
      }, 1500)
    }
    const glimtar = setInterval(() => {
      if (busy.current || document.hidden) return
      const v = visatRef.current.tiles.filter((t) => t && t.typ === 'bit')
      if (!v.length) return
      fx.glimt(v[Math.floor(Math.random() * v.length)].id)
    }, 1700)
    return () => {
      levande.current = false
      clearInterval(glimtar)
      if (tipsTimer.current) clearTimeout(tipsTimer.current)
      fx.forstor()
      if (fullskarmSparrad) fullskarmSparrad.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bara i utvecklingsläget: låter webbläsartester läsa brädet och hitta
  // drag. Försvinner i bygget.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__krossen = {
      s: () => sRef.current,
      drag: () => hittaDrag(sRef.current),
      tips: () => hittaTips(sRef.current),
      upptagen: () => busy.current,
      fas: () => fasRef.current,
      visa: () => visa(),
      hand: () => handDrag.current,
    }
  }, [visa])

  // ----------------------------------------------------------------- tipset

  const avbrytTips = useCallback(() => {
    if (tipsTimer.current) clearTimeout(tipsTimer.current)
    tipsTimer.current = null
    fxRef.current?.slutaVagga()
    setHand(null)
  }, [])

  const schemalaggTips = useCallback(() => {
    avbrytTips()
    tipsTimer.current = setTimeout(() => {
      if (!levande.current || busy.current) return
      if (fasRef.current !== 'spel' && fasRef.current !== 'start') return
      const t = hittaTips(sRef.current)
      if (!t) return
      const ids = t.celler.map((i) => visatRef.current.tiles[i]?.id).filter(Boolean)
      fxRef.current?.vagga(ids)
      // på de första tio banorna visar handen också hur
      if (bana.nr <= 10 && !bana.dagens) setHand([t.a, t.b])
    }, TIPS_EFTER_MS)
  }, [avbrytTips, bana])

  useEffect(() => {
    if (!tips) schemalaggTips()
    return avbrytTips
  }, [tips, schemalaggTips, avbrytTips])

  // Handledningen: handen visas när tipsrutan är stängd och spelet väntar.
  useEffect(() => {
    if (!tips && handStart.current && fasRef.current === 'start') {
      const t = setTimeout(() => levande.current && setHand(handStart.current), 700)
      return () => clearTimeout(t)
    }
  }, [tips])

  // --------------------------------------------------------- stegen animeras

  const beromNiva = useRef(0)

  async function animeraRensa(steg) {
    const fx = fxRef.current
    const V = visatRef.current
    const idVid = (i) => V.tiles[i]?.id
    const fargVid = (i) => V.tiles[i]?.farg

    // 1. nya specialpjäser: gruppen dras ihop först.
    //
    // Bara pjäser som faktiskt försvinner får dras in. Ett godis i koppel
    // ingår i gruppen men blir kvar på brädet — det är bara kopplet som går
    // sönder. Drogs det också in hängde det sedan kvar krympt ovanpå
    // specialpjäsen, och dess egen ruta såg tom ut.
    const forsvinner = new Set(steg.borta.map((b) => b.i))
    const samlade = new Set()
    if (steg.nya.length) {
      for (const n of steg.nya) {
        const dras = n.celler.filter((c) => forsvinner.has(c))
        dras.forEach((c) => samlade.add(c))
        fx.samla(dras, n.i, idVid)
        for (const c of n.celler) if (!forsvinner.has(c)) fx.rycka(idVid(c), c, n.i)
      }
      await fx.vila(170)
    }

    // två specialpjäser byttes med varandra: den ena glider in i den andra
    if (steg.sammanslagen) {
      const { fran, till } = steg.sammanslagen
      samlade.add(fran)
      fx.samla([fran], till, idVid)
      await fx.vila(170)
    }

    // statistik
    if (!steg.sekvens && fasRef.current !== 'regn') rekord.current.storstaKedja = Math.max(rekord.current.storstaKedja, steg.kaskad)
    dragetsBitar.current += steg.borta.length
    rekord.current.hinder +=
      steg.lador.filter((l) => l.hp <= 0).length + steg.ograss.length + steg.koppel.length + (steg.bollar || []).length + steg.lera.length

    // Happy hoppade hit: en stor smäll som sprider sig utåt
    if (steg.hopp) {
      ljud.bomb(true)
      fx.ring(steg.hopp.till, 3.2, '#ffe066', { bredd: 7, ms: 480 })
      fx.ring(steg.hopp.till, 2.2, '#ffffff', { bredd: 4, ms: 380 })
      fx.skaka(9, 380)
    }

    // 2. ljud och beröm
    const storsta = Math.max(3, ...steg.grupper.map((g) => g.celler.length))
    if (steg.grupper.length) ljud.match(steg.kaskad, storsta)
    if (steg.kombobeskrivning) fx.banner(steg.kombobeskrivning, { farg: '#ffe066', storlek: 0.9, ms: 1000 })
    if (!steg.sekvens && steg.kaskad >= 3 && steg.kaskad > beromNiva.current && BEROM[Math.min(6, steg.kaskad)]) {
      beromNiva.current = steg.kaskad
      const niva = Math.min(4, steg.kaskad - 2)
      fx.berom(BEROM[Math.min(6, steg.kaskad)], niva)
      ljud.berom(niva)
    }

    // 3. tider: varje ruta smäller när den nås av det som träffar den
    const tider = new Map()
    for (const g of steg.grupper) for (const c of g.celler) tider.set(c, 0)
    if (steg.tass !== undefined) tider.set(steg.tass, 0)
    const w = sRef.current.w
    const rc = (i) => [Math.floor(i / w), i % w]
    const avst = (a, b) => {
      const [ar, ac] = rc(a)
      const [br, bc] = rc(b)
      return { man: Math.abs(ar - br) + Math.abs(ac - bc), cheb: Math.max(Math.abs(ar - br), Math.abs(ac - bc)), eukl: Math.hypot(ar - br, ac - bc) }
    }

    let harSmall = false
    for (const k of steg.kallor) {
      const t0 = tider.has(k.i) ? tider.get(k.i) : 0
      const start = t0 + 80
      const farg = fargFor(k.farg)
      harSmall = true
      fx.senare(() => fx.pulsera(k.id, 1.45, 180), t0)
      const satt = (j, t) => {
        if (!tider.has(j) || tider.get(j) > t) tider.set(j, t)
      }
      switch (k.special) {
        case 'raket-h':
        case 'raket-v':
        case 'kors':
        case 'kors3': {
          // motorn säger exakt hur långt varje raket hinner (tennisbollar
          // stoppar dem), så animationen stannar på samma ställe
          for (const l of k.linjer || []) fx.raket(l.i, l.lodrat, farg, { fordrojning: start, minus: l.minus, plus: l.plus })
          fx.senare(() => ljud.raket(), start)
          for (const j of k.omrade) satt(j, start + avst(k.i, j).man * 26)
          break
        }
        case 'bomb': {
          fx.bomb(k.i, farg, k.radie, start)
          fx.senare(() => ljud.bomb(k.radie > 1), start)
          for (const j of k.omrade) satt(j, start + avst(k.i, j).cheb * 40)
          break
        }
        case 'skal':
        case 'skal-skal': {
          const mal = [...k.omrade].filter((j) => j !== k.i).sort((a, b) => avst(k.i, a).eukl - avst(k.i, b).eukl)
          fx.senare(() => {
            ljud.skal()
            fx.ring(k.i, 3, '#ff9ecb', { bredd: 6, ms: 520 })
            fx.ring(k.i, 4.5, '#9fe7ff', { bredd: 4, ms: 620 })
            fx.skaka(6, 360)
          }, start)
          const steg2 = k.special === 'skal-skal' ? 8 : 22
          mal.forEach((j, n) => {
            const t = start + 120 + n * steg2
            if (k.special === 'skal' || n % 3 === 0) {
              fx.stral(k.i, j, ['#ffe9ff', '#fff6c2', '#c9f3ff'][n % 3], { fordrojning: t - 90 })
              if (n % 2 === 0) fx.senare(() => ljud.zapp(n), t - 90)
            }
            satt(j, t)
          })
          satt(k.i, start + 120 + mal.length * steg2)
          break
        }
        case 'frisbee': {
          fx.senare(() => ljud.frisbee(), start)
          const plus = k.omrade.filter((j) => !(k.mal || []).includes(j) && avst(k.i, j).man <= 1)
          for (const j of plus) satt(j, start)
          const flyg = 540
          ;(k.mal || []).forEach((m, n) => {
            fx.senare(() => fx.frisbee(k.i, m, k.id, { ms: flyg }), start + n * 90)
            const ank = start + n * 90 + flyg
            satt(m, ank)
            if (k.last === 'raket-h' || k.last === 'raket-v') {
              const l = (k.linjer || []).find((x) => x.i === m)
              fx.raket(m, k.last === 'raket-v', farg, { fordrojning: ank, minus: l?.minus ?? null, plus: l?.plus ?? null })
              fx.senare(() => ljud.raket(), ank)
            }
            if (k.last === 'bomb') {
              fx.bomb(m, farg, 1, ank)
              fx.senare(() => ljud.bomb(false), ank)
            }
            for (const j of k.omrade) {
              if (plus.includes(j)) continue
              const d = avst(m, j)
              satt(j, ank + (k.last === 'bomb' ? d.cheb * 40 : d.man * 26))
            }
          })
          break
        }
        default:
          for (const j of k.omrade) satt(j, start)
      }
    }
    if (steg.hopp) for (const j of steg.rensas) tider.set(j, avst(steg.hopp.till, j).cheb * 60)
    for (const j of steg.rensas) if (!tider.has(j)) tider.set(j, 0)

    if (harSmall) await fx.hitstop(60)

    // godis och hinder som räknas mot ett mål flyger upp till målrutan
    {
      const mal = visatRef.current.mal
      const index = (pred) => mal.findIndex((m) => !m.klar && pred(m))
      const flyg = []
      const lagg = (i, k) => k >= 0 && flyg.push({ i, mal: k, t: tider.get(i) ?? 0 })
      for (const b of steg.borta) {
        if (!b.special) lagg(b.i, index((m) => m.typ === 'farg' && m.farg === b.farg))
        if (b.klocka) lagg(b.i, index((m) => m.typ === 'klocka'))
      }
      for (const l of steg.lera) lagg(l.i, index((m) => m.typ === 'lera'))
      for (const l of steg.lador) if (l.hp <= 0) lagg(l.i, index((m) => m.typ === 'lada'))
      for (const o of steg.ograss) lagg(o.i, index((m) => m.typ === 'ograss'))
      for (const i of steg.koppel) lagg(i, index((m) => m.typ === 'koppel'))
      for (const b of steg.bollar || []) lagg(b.i, index((m) => m.typ === 'boll'))
      for (const p of steg.paket || []) lagg(p.i, index((m) => m.typ === 'paket'))
      for (const k of steg.kallor) {
        const typ = (k.orig || k.special || '').startsWith('raket') ? 'raket' : k.orig || k.special
        lagg(k.i, index((m) => m.typ === 'special' && m.special === typ))
      }
      flygTillMal(flyg)
    }

    // 4. varje ruta får sin effekt vid sin tid
    let slut = 0
    const kraft = steg.kallor.length ? 1.2 : 1
    for (const b of steg.borta) {
      const t = tider.get(b.i) ?? 0
      slut = Math.max(slut, t)
      if (samlade.has(b.i)) continue
      fx.popp(b.id, b.i, fargFor(b.farg), t, { kraft })
    }
    for (const l of steg.lador) {
      const t = tider.get(l.i) ?? 0
      slut = Math.max(slut, t)
      fx.lada(l.i, l.hp, t, l.id)
      fx.senare(() => ljud.lada(l.hp <= 0), t)
    }
    for (const o of steg.ograss) {
      const t = tider.get(o.i) ?? 0
      slut = Math.max(slut, t)
      fx.popp(o.id, o.i, '#2b7431', t)
      fx.ograss(o.i, t)
      fx.senare(() => ljud.ograss(), t)
    }
    for (const b of steg.bollar || []) {
      const t = tider.get(b.i) ?? 0
      slut = Math.max(slut, t)
      fx.popp(b.id, b.i, '#d4ec2c', t, { kraft: 1.3 })
      fx.senare(() => ljud.boll(), t)
    }
    for (const i of steg.koppel) {
      const t = tider.get(i) ?? 0
      slut = Math.max(slut, t)
      fx.koppel(i, t)
      fx.senare(() => ljud.koppel(), t)
    }
    for (const l of steg.lera) {
      const t = tider.get(l.i) ?? 0
      fx.lera(l.i, t)
      if (l === steg.lera[0]) fx.senare(() => ljud.lera(), t)
    }
    for (const i of steg.armerade) {
      const id = idVid(i)
      fx.senare(() => fx.pulsera(id, 1.3, 300), tider.get(i) ?? 0)
    }

    // poäng som flyter upp
    for (const g of steg.grupper) {
      const mittCell = g.celler[Math.floor(g.celler.length / 2)]
      fx.poang(mittCell, '+' + g.celler.length * 20 * steg.kaskad, fargFor(g.farg))
    }
    for (const k of steg.kallor) {
      if (k.omrade.length > 6) fx.senare(() => fx.poang(k.i, '+' + k.omrade.length * 20 * steg.kaskad, '#fff6c2'), (tider.get(k.i) ?? 0) + 200)
    }
    if (steg.rensas.length >= 12 && !steg.sekvens) fx.skaka(4, 240)

    await fx.vila(slut + (steg.sekvens ? 200 : 260))
    if (!levande.current) return

    const fore = visatRef.current
    visa()

    // Happy åt: magen fylls, och är han mätt säger han till
    for (const m of steg.matad || []) {
      fx.pulsera(m.id, 1.22, 280)
      const var_ = fore.tiles.find((t) => t && t.id === m.id)
      if (m.mage >= HAPPY_MATT && (!var_ || var_.mage < HAPPY_MATT)) {
        ljud.vov()
        fx.banner('Happy är mätt! Tryck på honom', { farg: '#ffe066', storlek: 0.72, ms: 1600 })
      }
    }

    // överraskningspaketen visar vad de innehöll
    if (steg.paket?.length) {
      ljud.paket()
      const text = { raket: 'Raket!', bomb: 'Bomb!', frisbee: 'Frisbee!', skal: 'Godisskål!', drag: '+3 drag', mynt: '+25 mynt', boll: 'Tennisboll …' }
      for (const pk of steg.paket) {
        if (pk.nyId) fx.visaNy(pk.nyId, pk.utfall === 'boll' ? '#d4ec2c' : '#ffe066')
        fx.poang(pk.i, text[pk.utfall] || '', pk.utfall === 'boll' ? '#ffd0d0' : pk.utfall === 'drag' ? '#8ef0a8' : '#ffe066')
        if (pk.utfall === 'drag') fx.banner('+3 drag!', { farg: '#8ef0a8', storlek: 0.8, ms: 900 })
      }
    }

    if (steg.nya.length) {
      ljud.special()
      for (const n of steg.nya) fx.visaNy(n.id, fargFor(n.farg))
      await fx.vila(300)
    }
  }

  async function spelaSteg(steg) {
    const fx = fxRef.current
    if (!fx || !levande.current) return
    switch (steg.typ) {
      case 'byte': {
        const V = visatRef.current
        ljud.byte()
        const klar = await fx.byte(V.tiles[steg.a]?.id, V.tiles[steg.b]?.id, steg.a, steg.b, true)
        visa()
        klar()
        break
      }
      case 'rensa':
        await animeraRensa(steg)
        break
      case 'fall':
        visa()
        await fx.fall(steg.moves, fasRef.current === 'regn' ? 48 : 60)
        break
      case 'leverans': {
        for (const l of steg.celler) {
          const n = lagerRef.current.querySelector('[data-id="' + l.id + '"]')
          if (n) {
            n.animate(
              [
                { transform: 'translateY(0) scale(1)', opacity: 1 },
                { transform: 'translateY(-20%) scale(1.3)', opacity: 1, offset: 0.3 },
                { transform: 'translateY(140%) scale(.6)', opacity: 0 },
              ],
              { duration: 480, fill: 'forwards', easing: 'ease-in' }
            )
          }
          fx.poang(l.i, 'Mums!', '#ffe066')
          fx.splittra(l.i, '#f0a468', { antal: 10 })
        }
        {
          const k = visatRef.current.mal.findIndex((m) => m.typ === 'kott' && !m.klar)
          if (k >= 0) flygTillMal(steg.celler.map((l) => ({ i: l.i, mal: k, t: 0 })))
        }
        ljud.vov()
        await fx.vila(480)
        visa()
        break
      }
      case 'omvandla': {
        if (steg.fran === 'drag') {
          const p = fx.punktFor(dragRef.current)
          ljud.zapp(steg.celler[0])
          await fx.flygIn(p.x, p.y, steg.celler[0], '#fff6c2', 220)
          visa()
          fx.pulsera(visatRef.current.tiles[steg.celler[0]]?.id, 1.35, 220)
        } else {
          if (steg.kombobeskrivning) fx.banner(steg.kombobeskrivning, { farg: '#ffe066', ms: 1200 })
          if (steg.bort) fx.popp(steg.bort.id, steg.bort.i, '#ff9ecb', 0, { kraft: 1.4 })
          ljud.skal()
          steg.celler.forEach((j, n) => {
            fx.stral(steg.fran, j, '#ffe9ff', { fordrojning: n * 45 })
            fx.senare(() => ljud.zapp(n), n * 45)
          })
          await fx.vila(steg.celler.length * 45 + 200)
          visa()
          for (const j of steg.celler) {
            const id = visatRef.current.tiles[j]?.id
            fx.pulsera(id, 1.35, 260)
          }
          await fx.vila(380)
        }
        break
      }
      case 'ograss': {
        visa()
        const id = visatRef.current.tiles[steg.till]?.id
        const n = lagerRef.current.querySelector('[data-id="' + id + '"]')
        if (n) n.firstElementChild?.animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.2)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' })
        ljud.ograssVaxer()
        fx.banner('Ogräset växer!', { farg: '#b9f28a', storlek: 0.7, ms: 900 })
        await fx.vila(430)
        break
      }
      case 'klocka': {
        visa()
        const V = visatRef.current
        for (const i of steg.celler) {
          const t = V.tiles[i]
          if (t && t.klocka <= 3) fx.pulsera(t.id, 1.2, 260)
        }
        if (steg.ringde !== null) {
          const id = V.tiles[steg.ringde]?.id
          ljud.ring()
          fx.skaka(9, 600)
          for (let k = 0; k < 4; k++) fx.senare(() => fx.pulsera(id, 1.5, 200), k * 220)
          fx.banner('Klockan ringde!', { farg: '#ff6b6b', storlek: 1.1, ms: 1400 })
          await fx.vila(1100)
        } else {
          ljud.tick(Math.min(...steg.celler.map((i) => V.tiles[i]?.klocka ?? 9)))
          await fx.vila(160)
        }
        break
      }
      case 'hopp': {
        ljud.hopp()
        happyKlon.current = await fx.hopp(steg.fran, steg.till, steg.id)
        break
      }
      case 'landa': {
        happyKlon.current?.remove()
        happyKlon.current = null
        visa()
        fx.pulsera(steg.id, 1.35, 300)
        const k = visatRef.current.mal.findIndex((m) => m.typ === 'hopp' && !m.klar)
        if (k >= 0) flygTillMal([{ i: steg.i, mal: k, t: 0 }])
        await fx.vila(160)
        break
      }
      case 'blanda':
        fx.banner('Blandar om', { farg: '#e2e8f0', storlek: 0.8, ms: 900 })
        await fx.vila(450)
        visa()
        ljud.blanda()
        await fx.blanda()
        break
      case 'vag':
        if (steg.vag > 1) {
          fx.banner('Våg ' + steg.vag, { farg: '#ffe066', storlek: 0.8, ms: 800 })
          await fx.vila(280)
        }
        break
      default:
        break
    }
  }

  // --------------------------------------------------------- drag och loop

  async function kor(gen) {
    busy.current = true
    if (fullskarmSparrad) fullskarmSparrad.current = true
    avbrytTips()
    beromNiva.current = 0
    dragetsBitar.current = 0
    fxRef.current?.setInstallningar(readSettings())
    try {
      for (const steg of gen) {
        await spelaSteg(steg)
        if (!levande.current) return
      }
      visa()
    } finally {
      busy.current = false
      if (fullskarmSparrad) fullskarmSparrad.current = false
      happyKlon.current?.remove()
      happyKlon.current = null
    }
    rekord.current.storstaDrag = Math.max(rekord.current.storstaDrag, dragetsBitar.current)
    await efterDrag()
  }

  async function efterDrag() {
    const st = sRef.current
    if (!levande.current) return
    if (st.klockaRingde !== null) return forlora('klocka')
    if (!arPoangbana(st) && malKlara(st)) return vinna()
    if (st.drag <= 0) {
      if (arPoangbana(st)) {
        busy.current = true
        byt('regn')
        for (const steg of slutsmall(st)) {
          await spelaSteg(steg)
          if (!levande.current) return
        }
        visa()
        busy.current = false
        if (st.poang >= bana.stjarnor[0]) return vinna(true)
        return forlora()
      }
      byt('nastan')
      ljud.forlust()
      return
    }
    if (st.drag <= 5) ljud.lagDrag()
    // Varna en gång när det börjar bli tajt — men inte om banan bara hade
    // så få drag från början.
    const fx = fxRef.current
    // Lite längre ner och en stund efter draget, så att den inte krockar med
    // berömmet från en kedja.
    if (st.drag === 5 && bana.drag > 8 && !varnat.current[5]) {
      varnat.current[5] = true
      fx?.senare(() => {
        fx.banner('5 drag kvar!', { farg: '#ff9d5c', storlek: 0.95, ms: 1400, nere: true })
        ljud.varning()
      }, 350)
    } else if (st.drag === 1 && !varnat.current[1]) {
      varnat.current[1] = true
      fx?.senare(() => {
        fx.banner('Sista draget!', { farg: '#ff5c5c', storlek: 0.95, ms: 1400, nere: true })
        ljud.varning()
      }, 350)
    }
    // handledningen på de första banorna fortsätter ett par drag till
    handDrag.current++
    if (handStart.current && bana.nr <= 3 && handDrag.current < 3) {
      setTimeout(() => {
        if (!levande.current || busy.current || fasRef.current !== 'spel') return
        const t = hittaTips(sRef.current)
        if (t) setHand([t.a, t.b])
      }, 900)
    }
    schemalaggTips()
  }

  async function vinna(utanRegn = false) {
    const st = sRef.current
    const fx = fxRef.current
    busy.current = true
    byt('regn')
    avbrytTips()
    if (!utanRegn) {
      fx.banner('Godisregn!', { farg: '#ffe066', storlek: 1.2, ms: 1300 })
      ljud.godisregn()
      await fx.vila(900)
      for (const steg of godisregn(st)) {
        await spelaSteg(steg)
        if (!levande.current) return
      }
      visa()
    }
    const stjarnor = Math.max(1, stjarnorFor(st.poang, bana.stjarnor))
    const forsta = !saveRef.current.stjarnor[bana.nr]
    const mynt = bana.dagens
      ? dagensKlar(saveRef.current, bana.dag)
        ? 0
        : DAGENS_BELONNING
      : belonning(saveRef.current, bana.nr, stjarnor, bana.svarighet || 0)
    const extra = onVinst({ stjarnor, poang: st.poang, sammanfattning: sammanfattning() }) || {}
    setResultat({
      stjarnor,
      poang: st.poang,
      mynt: mynt + st.paketMynt,
      svarBonus: forsta && !bana.dagens ? SVAR_BONUS[bana.svarighet || 0] : 0,
      paketMynt: st.paketMynt,
      ...extra,
    })
    byt('vunnen')
    busy.current = false
    ljud.vinst()
    fx.konfetti()
    if (topplistaId && spelare) {
      skickaPoang(topplistaId, spelare, st.poang)
        .then(() => hamtaTopplista(topplistaId))
        .then((lista) => levande.current && setTopplista(lista))
    }
  }

  function startaSpel() {
    byt('spel')
    if (onStartad) onStartad()
  }

  function forlora(orsak = 'drag') {
    setForlustOrsak(orsak)
    byt('forlorad')
    ljud.forlust()
    if (onForlust) onForlust(orsak, sammanfattning())
  }

  // Det banan gav, för statistiken och Happys godisskål.
  function sammanfattning() {
    const st = sRef.current
    return {
      farg: [...st.samlat.farg],
      special: { ...st.samlat.special },
      hopp: st.samlat.hopp,
      paket: st.samlat.paket,
      godis: st.samlat.farg.reduce((a, b) => a + b, 0),
      paketMynt: st.paketMynt,
      ...rekord.current,
    }
  }

  // Flygande mål: en kopia av målets ikon flyger från rutan upp till målet
  // i statusraden, och målet studsar till när den kommer fram.
  function flygTillMal(lista) {
    const fx = fxRef.current
    const lager = flygRef.current
    const plan = spelplanRef.current
    if (!fx || !lager || !plan || !lista.length) return
    const pr = plan.getBoundingClientRect()
    const br = bradRef.current.getBoundingClientRect()
    const w = sRef.current.w
    const cell = br.width / w
    const perMal = {}
    let n = 0
    for (const f of lista) {
      perMal[f.mal] = (perMal[f.mal] || 0) + 1
      if (perMal[f.mal] > 12) continue
      const malEl = plan.querySelector('[data-mal="' + f.mal + '"]')
      const ikon = malEl && malEl.querySelector('.kr-malikon')
      if (!ikon) continue
      const mr = ikon.getBoundingClientRect()
      const x0 = br.left - pr.left + ((f.i % w) + 0.5) * cell
      const y0 = br.top - pr.top + (Math.floor(f.i / w) + 0.5) * cell
      const x1 = mr.left - pr.left + mr.width / 2
      const y1 = mr.top - pr.top + mr.height / 2
      const storlek = Math.max(18, cell * 0.62)
      const fordrojning = f.t + 70 + n * 18
      const nr = n++
      fx.senare(() => {
        const el = document.createElement('div')
        el.className = 'kr-flygmal'
        el.style.cssText = `left:${x0 - storlek / 2}px;top:${y0 - storlek / 2}px;width:${storlek}px;height:${storlek}px`
        el.innerHTML = ikon.innerHTML
        lager.appendChild(el)
        const dx = x1 - x0
        const dy = y1 - y0
        const sida = (nr % 2 ? 1 : -1) * cell * 0.8
        const kf = []
        for (let k = 0; k <= 12; k++) {
          const t = k / 12
          const e = t * t * (3 - 2 * t)
          const x = dx * e + Math.sin(t * Math.PI) * sida
          const y = dy * e - Math.sin(t * Math.PI) * cell * 0.9
          const sk = 1 + Math.sin(t * Math.PI) * 0.35 - t * 0.45
          kf.push({ transform: `translate(${x}px,${y}px) scale(${sk})`, opacity: t > 0.92 ? 0.6 : 1 })
        }
        el.animate(kf, { duration: 600, easing: 'linear', fill: 'forwards' })
        fx.senare(() => {
          el.remove()
          malEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' })
          if (nr % 3 === 0) ljud.samla(nr)
        }, 600)
      }, fordrojning)
    }
  }

  function kopExtraDrag() {
    const pris = EXTRA_DRAG.pris[Math.min(extraKop, EXTRA_DRAG.pris.length - 1)]
    if (saveRef.current.mynt < pris) return
    setSave((x) => ({ ...x, mynt: x.mynt - pris }))
    ljud.mynt()
    sRef.current.drag += EXTRA_DRAG.antal
    setExtraKop((k) => k + 1)
    visa()
    byt('spel')
    fxRef.current?.banner('+5 drag', { farg: '#8ef0a8', ms: 900 })
    schemalaggTips()
  }

  const forsok = (a, b) => {
    if (busy.current) return
    const st = sRef.current
    setVald(null)
    if (!arGrannar(st, a, b)) return
    const fx = fxRef.current
    const V = visatRef.current
    if (!kanBytas(st, a) || !kanBytas(st, b) || !giltigtByte(st, a, b)) {
      ljud.nej()
      avbrytTips()
      busy.current = true
      fx.byte(V.tiles[a]?.id, V.tiles[b]?.id, a, b, false).then(() => {
        busy.current = false
        schemalaggTips()
      })
      return
    }
    if (fasRef.current === 'start') startaSpel()
    kor(spelaDrag(st, a, b))
  }

  // ------------------------------------------------------------- boosters

  function forsokAnvanda(typ) {
    const ny = anvandBooster(saveRef.current, typ)
    if (!ny) {
      setMeddelande('För få mynt')
      setTimeout(() => setMeddelande(null), 1400)
      return false
    }
    setSave(() => ny)
    saveRef.current = ny
    return true
  }

  function valjBooster(typ) {
    if (busy.current || (fasRef.current !== 'spel' && fasRef.current !== 'start')) return
    ljud.klick()
    if (typ === 'blanda') {
      if (!forsokAnvanda('blanda')) return
      busy.current = true
      avbrytTips()
      blandaBradet(sRef.current)
      ljud.blanda()
      visa()
      fxRef.current.blanda().then(() => {
        busy.current = false
        schemalaggTips()
      })
      return
    }
    setVald(null)
    setBytForst(null)
    setLage((x) => (x === typ ? null : typ))
  }

  function startBooster(typ) {
    if (busy.current || fasRef.current !== 'start' || startAnvand[typ]) return
    if (!forsokAnvanda(typ)) return
    setStartAnvand((x) => ({ ...x, [typ]: true }))
    const st = sRef.current
    const fx = fxRef.current
    ljud.special()
    if (typ === 'plus3') {
      st.drag += 3
      visa()
      fx.banner('+3 drag', { farg: '#8ef0a8', ms: 900 })
      return
    }
    const celler = laggUtSpecialer(st, typ === 'skal' ? ['skal'] : ['raket', 'bomb'])
    visa()
    for (const i of celler) fx.visaNy(visatRef.current.tiles[i]?.id, '#fff6c2')
  }

  // -------------------------------------------------------------- input

  const pekare = useRef(null)

  function cellVid(e) {
    const r = bradRef.current.getBoundingClientRect()
    const p = r.width / s.w
    const c = Math.floor((e.clientX - r.left) / p)
    const rr = Math.floor((e.clientY - r.top) / p)
    if (c < 0 || c >= s.w || rr < 0 || rr >= s.h) return -1
    const i = rr * s.w + c
    return s.mask[i] ? i : -1
  }

  function nerTryck(e) {
    if (fasRef.current !== 'spel' && fasRef.current !== 'start') return
    if (tips) return
    const i = cellVid(e)
    if (i < 0) return
    pekare.current = { i, x: e.clientX, y: e.clientY, klar: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // gammal webbläsare
    }
  }

  function flytta(e) {
    const p = pekare.current
    if (!p || p.klar || lage) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    const cell = bradRef.current.clientWidth / s.w
    if (Math.max(Math.abs(dx), Math.abs(dy)) < cell * 0.32) return
    p.klar = true
    const r = Math.floor(p.i / s.w)
    const c = p.i % s.w
    let j
    if (Math.abs(dx) > Math.abs(dy)) j = dx > 0 ? (c + 1 < s.w ? p.i + 1 : -1) : c > 0 ? p.i - 1 : -1
    else j = dy > 0 ? (r + 1 < s.h ? p.i + s.w : -1) : r > 0 ? p.i - s.w : -1
    if (j >= 0 && s.mask[j]) forsok(p.i, j)
  }

  function uppTryck() {
    const p = pekare.current
    pekare.current = null
    if (!p || p.klar) return
    tryck(p.i)
  }

  function tryck(i) {
    if (busy.current) return
    const st = sRef.current
    avbrytTips()
    if (lage === 'happy') {
      const hi = hittaHappy(st)
      if (i === hi || hi < 0) return setLage(null)
      if (!kanLanda(st, i)) return
      setLage(null)
      if (fasRef.current === 'start') startaSpel()
      kor(happyHopp(st, hi, i))
      return
    }
    if (!lage && st.tiles[i]?.happy && happyRedo(st, i)) {
      // Happy är mätt: nästa tryck väljer var han ska hoppa
      setVald(null)
      setLage('happy')
      ljud.vov()
      return
    }
    if (lage === 'tass') {
      if (!st.tiles[i]) return
      if (!forsokAnvanda('tass')) return
      setLage(null)
      if (fasRef.current === 'start') startaSpel()
      tassEffekt(i)
      return
    }
    if (lage === 'byt') {
      if (bytForst === null) {
        if (kanBytas(st, i)) setBytForst(i)
        return
      }
      if (bytForst === i) return setBytForst(null)
      if (!kanBytasFritt(st, bytForst, i)) {
        if (kanBytas(st, i)) setBytForst(i)
        return
      }
      if (!forsokAnvanda('byt')) return
      const a = bytForst
      setBytForst(null)
      setLage(null)
      if (fasRef.current === 'start') startaSpel()
      kor(bytFritt(st, a, i))
      return
    }
    if (vald === null) {
      if (kanBytas(st, i)) {
        setVald(i)
        ljud.klick()
      }
      schemalaggTips()
      return
    }
    if (vald === i) return setVald(null)
    if (arGrannar(st, vald, i)) forsok(vald, i)
    else if (kanBytas(st, i)) setVald(i)
  }

  async function tassEffekt(i) {
    const fx = fxRef.current
    const p = fx.cell()
    const { x, y } = fx.mitt(i)
    const el = document.createElement('div')
    el.className = 'kr-tass'
    el.style.cssText = `left:${x - p * 0.8}px;top:${y - p * 0.8}px;width:${p * 1.6}px;height:${p * 1.6}px`
    el.innerHTML =
      '<svg viewBox="0 0 100 100"><g fill="#f3d2b3" stroke="#8a5a2b" stroke-width="3"><path d="M50 50 C 66 50, 80 64, 75 77 C 71 88, 60 85, 50 85 C 40 85, 29 88, 25 77 C 20 64, 34 50, 50 50 Z"/><ellipse cx="23" cy="46" rx="9.5" ry="12" transform="rotate(-25 23 46)"/><ellipse cx="40" cy="28" rx="9.5" ry="12" transform="rotate(-8 40 28)"/><ellipse cx="60" cy="28" rx="9.5" ry="12" transform="rotate(8 60 28)"/><ellipse cx="77" cy="46" rx="9.5" ry="12" transform="rotate(25 77 46)"/></g></svg>'
    textRef.current.appendChild(el)
    busy.current = true
    el.animate(
      [
        { transform: 'translateY(-120%) scale(1.6)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.6 },
        { transform: 'translateY(0) scale(1.05)', opacity: 1, offset: 0.8 },
        { transform: 'translateY(0) scale(1)', opacity: 0 },
      ],
      { duration: 520, easing: 'ease-in' }
    )
    await fx.vila(320)
    ljud.tass()
    fx.skaka(6, 220)
    fx.ring(i, 1.4, '#fff6c2', { bredd: 5, ms: 320 })
    setTimeout(() => el.remove(), 260)
    busy.current = false
    kor(tassen(sRef.current, i))
  }

  // -------------------------------------------------------------- vyn

  const stjarnorNu = stjarnorFor(visat.poang, bana.stjarnor)
  const matare = useMemo(() => matarskala(bana.stjarnor), [bana])
  const cellBredd = 100 / s.w
  const cellHojd = 100 / s.h
  const poangbana = arPoangbana(s)

  const utgangar = useMemo(() => [...s.utgangar], [s])

  const inGame = fas === 'spel' || fas === 'start'
  const synligaBoosters = ['tass', 'byt', 'blanda'].filter((b) => bana.nr >= BOOSTER_FRAN[b])
  const synligaStart = ['plus3', 'raketbomb', 'skal'].filter((b) => bana.nr >= BOOSTER_FRAN[b])

  return (
    <div className="kr-spelplan" ref={spelplanRef}>
      <div className="kr-flyglager" ref={flygRef} aria-hidden="true" />
      {/* ------------------------------------------------------ statusrad */}
      <div className="kr-hud">
        <div className={'kr-mal' + (visat.mal.length >= 3 ? ' kr-mal-manga' : '')} aria-label="Mål">
          {visat.mal.map((m, k) => (
            <div key={k} data-mal={k} className={'kr-malpost' + (m.klar ? ' kr-klar' : '')}>
              {m.typ === 'poang' ? (
                <span className="kr-malpoang">{m.antal.toLocaleString('sv-SE')}</span>
              ) : (
                <>
                  <span className="kr-malikon">
                    <MalIkon mal={m} storlek={26} />
                  </span>
                  <span className="kr-malantal">{m.klar ? '✓' : m.kvar}</span>
                </>
              )}
            </div>
          ))}
        </div>
        <div className={'kr-drag' + (visat.drag <= 5 && inGame ? ' kr-drag-lag' : '')} ref={dragRef}>
          <div className="kr-drag-tal">{visat.drag}</div>
          <div className="kr-drag-text">drag</div>
        </div>
        <div className="kr-poangruta">
          <div className="kr-poangtal">{visat.poang.toLocaleString('sv-SE')}</div>
          <div className="kr-matare">
            <div className="kr-matare-fyll" style={{ width: matare.lage(visat.poang) * 100 + '%' }} />
            {bana.stjarnor.map((g, k) => (
              <div key={k} className="kr-matare-stjarna" style={{ left: `calc(${matare.punkter[k] * 100}% - 8px)` }}>
                <Stjarna fylld={stjarnorNu > k} storlek={16} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- brädet */}
      <div className="kr-bradram">
        <div
          ref={bradRef}
          className="kr-bradet"
          style={{ aspectRatio: `${s.w} / ${s.h}` }}
          onPointerDown={nerTryck}
          onPointerMove={flytta}
          onPointerUp={uppTryck}
          onPointerCancel={() => (pekare.current = null)}
        >
          <div className="kr-celler" aria-hidden="true">
            {s.mask.map((m, i) =>
              m ? (
                <div
                  key={i}
                  className={'kr-cell' + ((Math.floor(i / s.w) + (i % s.w)) % 2 ? ' kr-cell-b' : '')}
                  style={{ left: (i % s.w) * cellBredd + '%', top: Math.floor(i / s.w) * cellHojd + '%', width: cellBredd + '%', height: cellHojd + '%' }}
                >
                  {visat.lera[i] > 0 && (
                    <div className="kr-lera" data-lera={i}>
                      <Lera niva={visat.lera[i]} />
                    </div>
                  )}
                </div>
              ) : null
            )}
            {utgangar.map((i) => (
              <div
                key={'u' + i}
                className="kr-utgang"
                style={{ left: (i % s.w) * cellBredd + '%', top: (Math.floor(i / s.w) + 1) * cellHojd + '%', width: cellBredd + '%' }}
              >
                ▼
              </div>
            ))}
          </div>

          <div className="kr-lager" ref={lagerRef}>
            {visat.tiles.map((t, i) =>
              t ? (
                <div
                  key={t.id}
                  data-id={t.id}
                  data-cell={i}
                  className={
                    'kr-bit' +
                    (vald === i || bytForst === i ? ' kr-vald' : '') +
                    (t.special ? ' kr-sp-' + t.special : '') +
                    (t.armerad ? ' kr-armerad' : '')
                  }
                  style={{
                    left: (i % s.w) * cellBredd + '%',
                    top: Math.floor(i / s.w) * cellHojd + '%',
                    width: cellBredd + '%',
                    height: cellHojd + '%',
                  }}
                >
                  <div className="kr-inre">
                    <Pjas tile={t} />
                    {t.klocka > 0 && <div className={'kr-klocka' + (t.klocka <= 3 ? ' kr-klocka-snart' : '')}>{t.klocka}</div>}
                  </div>
                </div>
              ) : null
            )}
          </div>

          <div className="kr-koppellager" aria-hidden="true">
            {visat.koppel.map((k, i) =>
              k ? (
                <div
                  key={i}
                  data-koppel={i}
                  className="kr-koppel"
                  style={{ left: (i % s.w) * cellBredd + '%', top: Math.floor(i / s.w) * cellHojd + '%', width: cellBredd + '%', height: cellHojd + '%' }}
                >
                  <Koppel />
                </div>
              ) : null
            )}
          </div>

          <canvas ref={canvasRef} className="kr-canvas" aria-hidden="true" />
          <div ref={textRef} className="kr-textlager" aria-hidden="true" />
          {hand && <Hand fran={hand[0]} till={hand[1]} w={s.w} h={s.h} />}
        </div>
      </div>

      {/* -------------------------------------------------------- boosters */}
      <div className="kr-nedre">
        {lage ? (
          <div className="kr-lagetext">
            {lage === 'happy'
              ? 'Tryck där Happy ska hoppa'
              : lage === 'tass'
                ? 'Tryck på rutan Tassen ska krossa'
                : bytForst === null
                  ? 'Tryck på första pjäsen'
                  : 'Tryck på en granne att byta med'}
            <button className="kr-knapp kr-knapp-liten" onClick={() => setLage(null)}>
              Avbryt
            </button>
          </div>
        ) : (
          <>
            {/* Startboostrarna ligger under brädet, så när raden försvinner
                efter första draget flyttar sig inget på själva brädet. */}
            {fas === 'start' && synligaStart.length > 0 && (
              <div className="kr-boosters kr-startboost">
                <span className="kr-startboost-rubrik">Starta med</span>
                {synligaStart.map((b) => (
                  <BoosterKnapp key={b} typ={b} save={save} anvand={startAnvand[b]} onClick={() => startBooster(b)} />
                ))}
              </div>
            )}
            {synligaBoosters.length > 0 && (
              <div className="kr-boosters">
                {synligaBoosters.map((b) => (
                  <BoosterKnapp key={b} typ={b} save={save} aktiv={lage === b} onClick={() => valjBooster(b)} />
                ))}
              </div>
            )}
          </>
        )}
        {meddelande && <div className="kr-meddelande">{meddelande}</div>}
      </div>

      {/* --------------------------------------------------------- rutorna */}
      {tips && (
        <Ruta>
          <HappyRam humor="nojd" liten />
          <div className="kr-ruta-titel">{tips.titel}</div>
          <p className="kr-ruta-text">{tips.text}</p>
          <button
            className="kr-knapp kr-knapp-stor"
            onClick={() => {
              ljud.klick()
              setSave((x) => ({ ...x, sett: { ...x.sett, [bana.tips]: true } }))
              setTips(null)
            }}
          >
            Okej!
          </button>
        </Ruta>
      )}

      {fas === 'nastan' && (
        <Ruta>
          <HappyRam humor="ledsen" />
          <div className="kr-ruta-titel">Nästan!</div>
          <p className="kr-ruta-text">Det här fattas:</p>
          <MalLista mal={visat.mal} />
          <button className="kr-knapp kr-knapp-stor" disabled={save.mynt < EXTRA_DRAG.pris[Math.min(extraKop, 2)]} onClick={kopExtraDrag}>
            +5 drag · <Mynt storlek={16} /> {EXTRA_DRAG.pris[Math.min(extraKop, 2)]}
          </button>
          <div className="kr-ruta-sma">Du har {save.mynt} mynt</div>
          <button className="kr-knapp kr-knapp-lank" onClick={() => forlora('drag')}>
            Ge upp
          </button>
        </Ruta>
      )}

      {fas === 'forlorad' && (
        <Ruta>
          <HappyRam humor="ledsen" />
          <div className="kr-ruta-titel">{forlustOrsak === 'klocka' ? 'Klockan ringde!' : 'Happy blev utan godis'}</div>
          {forlustOrsak === 'klocka' && <p className="kr-ruta-text">Happy vaknade av väckarklockan. Ta bort godis med klocka innan tiden går ut.</p>}
          {svitVidStart.length > 0 && <p className="kr-ruta-text">Vinstsviten är bruten.</p>}
          {!poangbana && forlustOrsak !== 'klocka' && <MalLista mal={visat.mal} />}
          {poangbana && <p className="kr-ruta-text">Du fick {visat.poang.toLocaleString('sv-SE')} av {bana.stjarnor[0].toLocaleString('sv-SE')} poäng.</p>}
          <div className="kr-ruta-knappar">
            <button className="kr-knapp kr-knapp-stor" onClick={onIgen}>
              Försök igen
            </button>
            <button className="kr-knapp kr-knapp-sekundar" onClick={() => onKarta(false)}>
              Karta
            </button>
          </div>
        </Ruta>
      )}

      {fas === 'vunnen' && resultat && (
        <Ruta>
          <HappyRam humor="glad" hoppar />
          <div className="kr-ruta-titel">{bana.dagens ? 'Dagens bana klar!' : bana.boss ? 'Bossen besegrad!' : 'Happy fick godis!'}</div>
          <div className="kr-resultat-stjarnor">
            {[0, 1, 2].map((k) => (
              <ResultatStjarna key={k} fylld={resultat.stjarnor > k} fordrojning={400 + k * 380} onVisa={() => resultat.stjarnor > k && ljud.stjarna(k)} />
            ))}
          </div>
          <div className="kr-resultat-poang">{resultat.poang.toLocaleString('sv-SE')} poäng</div>
          {resultat.mynt > 0 && (
            <div className="kr-resultat-mynt">
              <Mynt storlek={18} /> +{resultat.mynt}
              {resultat.svarBonus > 0 && <span className="kr-resultat-extra">varav {resultat.svarBonus} för {bana.svarighet === 2 ? 'supersvår' : 'svår'} bana</span>}
              {resultat.paketMynt > 0 && <span className="kr-resultat-extra">varav {resultat.paketMynt} från paket</span>}
            </div>
          )}
          {resultat.foto && (
            <div className="kr-resultat-foto">
              <img src={resultat.foto.src} alt="" />
              <span>Nytt foto i Happys album!</span>
            </div>
          )}
          {topplistaId && <Topplista lista={topplista} spelare={spelare} />}
          <div className="kr-ruta-knappar">
            <button className="kr-knapp kr-knapp-stor" onClick={onNasta}>
              {bana.dagens ? 'Till banorna' : 'Nästa bana'}
            </button>
            <button className="kr-knapp kr-knapp-sekundar" onClick={onIgen}>
              Igen
            </button>
            <button className="kr-knapp kr-knapp-sekundar" onClick={() => onKarta(true)}>
              Karta
            </button>
          </div>
        </Ruta>
      )}

      {/* dold hjälp för skärmläsare: vad som ska göras */}
      <p className="sr-only">
        {varld.namn}, bana {bana.nr}.{' '}
        {visat.mal.map((m) => (m.typ === 'farg' ? `${m.kvar} ${SORTER[m.farg]} kvar. ` : '')).join('')}
        {visat.drag} drag kvar.
      </p>
    </div>
  )
}

// Stjärnmätaren. Gränserna ligger ibland tätt ihop, så stjärnorna får
// minst lite luft emellan, och fyllnaden följer samma skala styckvis.
function matarskala(grans) {
  const max = grans[2] * 1.08
  const punkter = grans.map((g) => g / max)
  punkter[2] = Math.min(0.94, punkter[2])
  punkter[1] = Math.min(punkter[1], punkter[2] - 0.2)
  punkter[0] = Math.max(0.1, Math.min(punkter[0], punkter[1] - 0.2))
  const lage = (poang) => {
    const x = [0, ...grans, max]
    const y = [0, ...punkter, 1]
    for (let k = 1; k < x.length; k++) {
      if (poang <= x[k]) return y[k - 1] + ((poang - x[k - 1]) / Math.max(1, x[k] - x[k - 1])) * (y[k] - y[k - 1])
    }
    return 1
  }
  return { punkter, lage }
}

// Topp fem för banan, med spelarens egen rad markerad. Ligger man utanför
// topp fem visas ens egen placering sist.
export function Topplista({ lista, spelare, antal = 5 }) {
  if (lista === null) return <div className="kr-topplista kr-topplista-tom">Hämtar topplistan …</div>
  if (!lista.length) return null
  const min = lista.findIndex((e) => e.player === spelare)
  const visas = lista.slice(0, antal).map((e, k) => ({ ...e, plats: k + 1 }))
  if (min >= antal) visas.push({ ...lista[min], plats: min + 1 })
  return (
    <ol className="kr-topplista">
      {visas.map((e) => (
        <li key={e.player} className={e.player === spelare ? 'kr-topplista-jag' : ''}>
          <span className="kr-topplista-plats">{e.plats}</span>
          <span className="kr-topplista-namn">{e.player}</span>
          <span className="kr-topplista-poang">{e.score.toLocaleString('sv-SE')}</span>
        </li>
      ))}
    </ol>
  )
}

// Happy överst i rutorna, med kläderna på.
function HappyRam({ humor, liten = false, hoppar = false }) {
  return (
    <div className={'kr-happyram' + (liten ? ' kr-happyram-liten' : '') + (hoppar ? ' kr-happy-hopp' : '')}>
      <HappyBild humor={humor} storlek={liten ? 70 : 92} ramBredd={5} />
    </div>
  )
}

// Handen som visar ett drag: trycker på pjäsen och drar den till grannen.
function Hand({ fran, till, w, h }) {
  const cw = 100 / w
  const ch = 100 / h
  const dx = (till % w) - (fran % w)
  const dy = Math.floor(till / w) - Math.floor(fran / w)
  return (
    <div
      className="kr-hand"
      style={{
        left: (fran % w) * cw + '%',
        top: Math.floor(fran / w) * ch + '%',
        width: cw + '%',
        height: ch + '%',
        // bilden är 95 % av rutan och procent i translate räknas på bilden
        '--dx': (dx * 100) / 0.95 + '%',
        '--dy': (dy * 100) / 0.95 + '%',
      }}
    >
      <div className="kr-hand-ring" />
      <svg viewBox="0 0 64 64" className="kr-hand-bild" aria-hidden="true">
        <path
          d="M22 30 V12 a5 5 0 0 1 10 0 V28 V22 a5 5 0 0 1 10 0 V30 V26 a5 5 0 0 1 9 0 V32 V30 a4.5 4.5 0 0 1 9 0 V44 C60 54 54 62 42 62 H34 C26 62 22 58 16 50 L7 38 a5 5 0 0 1 8 -6 Z"
          fill="#fff"
          stroke="#1f2937"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function Ruta({ children }) {
  return (
    <div className="kr-ruta-bakgrund">
      <div className="kr-ruta">{children}</div>
    </div>
  )
}

function MalLista({ mal }) {
  return (
    <div className="kr-mallista">
      {mal
        .filter((m) => !m.klar)
        .map((m, k) => (
          <div key={k} className="kr-malpost kr-malpost-stor">
            {m.typ === 'poang' ? <span className="kr-malpoang">{m.kvar.toLocaleString('sv-SE')} poäng</span> : <MalIkon mal={m} storlek={34} />}
            {m.typ !== 'poang' && <span className="kr-malantal">{m.kvar}</span>}
          </div>
        ))}
    </div>
  )
}

function BoosterKnapp({ typ, save, onClick, aktiv, anvand }) {
  const b = BOOSTERS[typ]
  const antal = save.boosters[typ] || 0
  return (
    <button className={'kr-booster' + (aktiv ? ' kr-booster-aktiv' : '') + (anvand ? ' kr-booster-anvand' : '')} onClick={onClick} disabled={anvand} title={b.text}>
      <BoosterIkon typ={typ} />
      <span className="kr-booster-namn">{b.namn}</span>
      <span className="kr-booster-bricka">
        {anvand ? '✓' : antal > 0 ? antal : (
          <>
            <Mynt storlek={11} />
            {b.pris}
          </>
        )}
      </span>
    </button>
  )
}

export function BoosterIkon({ typ }) {
  if (typ === 'plus3') return <span className="kr-booster-ikon kr-booster-plus">+3</span>
  if (typ === 'raketbomb') return <MalIkon mal={{ typ: 'special', special: 'raket' }} storlek={26} />
  if (typ === 'skal') return <MalIkon mal={{ typ: 'special', special: 'skal' }} storlek={26} />
  if (typ === 'blanda') return <span className="kr-booster-ikon">🔀</span>
  if (typ === 'byt') return <span className="kr-booster-ikon">⇄</span>
  return (
    <svg viewBox="0 0 100 100" width="26" height="26" aria-hidden="true">
      <g fill="#f3d2b3" stroke="#8a5a2b" strokeWidth="4">
        <path d="M50 50 C 66 50, 80 64, 75 77 C 71 88, 60 85, 50 85 C 40 85, 29 88, 25 77 C 20 64, 34 50, 50 50 Z" />
        <ellipse cx="23" cy="46" rx="9.5" ry="12" transform="rotate(-25 23 46)" />
        <ellipse cx="40" cy="28" rx="9.5" ry="12" transform="rotate(-8 40 28)" />
        <ellipse cx="60" cy="28" rx="9.5" ry="12" transform="rotate(8 60 28)" />
        <ellipse cx="77" cy="46" rx="9.5" ry="12" transform="rotate(25 77 46)" />
      </g>
    </svg>
  )
}

function ResultatStjarna({ fylld, fordrojning, onVisa }) {
  const [synlig, setSynlig] = useState(false)
  const ref = useRef(onVisa)
  ref.current = onVisa
  useEffect(() => {
    const t = setTimeout(() => {
      setSynlig(true)
      ref.current()
    }, fordrojning)
    return () => clearTimeout(t)
  }, [fordrojning])
  return (
    <div className={'kr-rstjarna' + (synlig && fylld ? ' kr-rstjarna-in' : '')}>
      <Stjarna fylld={synlig && fylld} storlek={46} />
    </div>
  )
}
