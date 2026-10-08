import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { genereraBana, skapaSpel, DX, DY, HJARTAN } from './engine.js'
import { useSpelyta } from '../delat/useSpelyta.js'
import { skapaLjud } from '../delat/ljud.js'
import { skapaFx, easeOut, easeOutBack } from '../delat/fx.js'
import { useSpar, useMynt, belona, forlust, betala } from '../delat/meta.js'
import { Topprad, Hjartan, BoostKnapp, Banner, Vinstkort, Forlustkort, Notis, useNotis } from '../delat/Ui.jsx'
import './pilar.css'

// Pilflykt — Arrows – Puzzle Escape i Rötspel.
// Spelet öppnar direkt i banan man är på. Tryck på en pil: är vägen fri
// flyger den ut, annars krockar den och ett hjärta går.

const ID = 'pilflykt'
const W = 360
const PAD = 12
// Höjden följer brädet så att det inte blir tomma fält ovanför och under.
const hojdFor = (bana) => Math.round(Math.max(300, Math.min(470, ((W - PAD * 2) * bana.h) / bana.w + PAD * 2)))
const START = { niva: 1, basta: 0, svit: 0, kista: 0, boost: { tips: 3, blixt: 1 } }
const BOOST = {
  tips: { ikon: '💡', namn: 'Tips', pris: 40 },
  blixt: { ikon: '⚡', namn: 'Blixt', pris: 120 },
}
const FORTSATT_PRIS = 60
const KOMBO_FONSTER = 1.15 // sekunder mellan lyckade tryck för att kombon ska hålla
const HALL_MS = 320 // håll så länge för att se vägen ut
const KOMBO_ORD = { 5: 'Snyggt!', 10: 'Grymt!', 15: 'Galet!', 20: 'Ostoppbar!', 30: 'PILREGN!' }

export default function PilarGame() {
  const [spar, setSpar] = useSpar('pilflykt-v1', START)
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
  const [hjartaBrast, setHjartaBrast] = useState(false)
  const [notis, visaNotis] = useNotis()

  // Allt som animeras bor i en ref, ritloopen läser den.
  const a = useRef(null)
  if (!a.current || a.current.spel !== spel) {
    a.current = {
      spel,
      t: 0,
      start: 0,
      rorelse: new Map(), // id -> { typ, start, ... }
      skak: new Map(), // id -> starttid (blockerad pil skakar)
      tips: -1,
      forhands: -1, // pilen vars väg ut visas medan man håller
      kombo: 0,
      bastaKombo: 0,
      senast: -10,
      klar: false,
      vinstTid: 0,
    }
  }
  useEffect(() => {
    fx.tom()
    setVinst(null)
    setSlut(false)
  }, [spel, fx])

  // Bara i utvecklingsläget: webbläsartester kan läsa brädet.
  useEffect(() => {
    if (import.meta.env.DEV) window.__pilar = { spel, bana, tryck: (id) => tryckPil(id) }
  })

  /* ------------------------------------------------------------ geometri */
  const H = hojdFor(bana)
  const geo = useMemo(() => {
    const cs = Math.min((W - PAD * 2) / bana.w, (H - PAD * 2) / bana.h)
    return { cs, ox: (W - bana.w * cs) / 2, oy: (H - bana.h * cs) / 2 }
  }, [bana, H])
  const mitt = (x, y) => [geo.ox + (x + 0.5) * geo.cs, geo.oy + (y + 0.5) * geo.cs]

  const farg = useMemo(() => {
    const bas = (aktivNiva * 47) % 360
    const cache = new Map()
    return (p) => {
      if (cache.has(p.id)) return cache.get(p.id)
      const [x, y] = p.celler[p.celler.length - 1]
      const hue = (bas + (x / bana.w) * 80 + (y / bana.h) * 50) % 360
      const c = `hsl(${hue.toFixed(0)} 88% 70%)`
      cache.set(p.id, c)
      return c
    }
  }, [aktivNiva, bana])

  /* ------------------------------------------------------------ händelser */

  function tryckPil(id) {
    const s = a.current
    if (s.klar || vinst || slut) return
    if (s.rorelse.has(id)) return
    const res = spel.tryck(id)
    if (!res) return
    const nu = s.t
    if (res.typ === 'ut') {
      const p = spel.pilar[id]
      s.rorelse.set(id, { typ: 'ut', start: nu, langd: p.celler.length, vag: spel.vagLangd(id) })
      if (s.tips === id) s.tips = -1
      s.kombo = nu - s.senast < KOMBO_FONSTER ? s.kombo + 1 : 1
      s.senast = nu
      s.bastaKombo = Math.max(s.bastaKombo, s.kombo)
      ljud.pop(3 + Math.min(s.kombo, 14), 0.11)
      ljud.swisch(p.celler.length)
      const [hx, hy] = mitt(...p.celler[p.celler.length - 1])
      fx.ring(hx, hy, farg(p), 22, 0.3, 2.5)
      if (s.kombo >= 3) {
        fx.text(hx, hy - 10, `x${s.kombo}`, { farg: '#ffe066', storlek: 15 + Math.min(s.kombo, 20) * 0.7, liv: 0.7 })
      }
      if (KOMBO_ORD[s.kombo]) {
        fx.text(W / 2, H * 0.42, KOMBO_ORD[s.kombo], { farg: '#ffffff', storlek: 34, liv: 1.1, stig: 30 })
        ljud.hurra(s.kombo / 5)
        fx.skaka(4)
      }
      if (res.vunnit) {
        s.klar = true
        s.vinstTid = nu + 0.55
      }
    } else {
      const p = spel.pilar[id]
      s.rorelse.set(id, { typ: 'krock', start: nu, steg: res.steg, mot: res.mot, traff: false })
      s.kombo = 0
      ljud.klick()
      if (res.forlorat) {
        s.klar = true
        setTimeout(() => {
          ljud.forlust()
          setSlut(true)
        }, 700)
      }
      void p
    }
    rendera()
  }

  // Som i originalet: ett tryck skickar iväg pilen, men håller man kvar
  // fingret visas vägen ut först — och då skickas den inte när man släpper.
  const tryckRef = useRef(null)
  function ner({ x, y }) {
    const fx_ = (x - geo.ox) / geo.cs
    const fy_ = (y - geo.oy) / geo.cs
    const id = spel.pilVid(fx_, fy_)
    if (id < 0 || a.current.klar) return
    const p = { id, x, y, visar: false }
    p.timer = setTimeout(() => {
      if (tryckRef.current !== p) return
      p.visar = true
      a.current.forhands = id
      ljud.klick()
    }, HALL_MS)
    tryckRef.current = p
  }
  function flytta({ x, y }) {
    const p = tryckRef.current
    if (!p || p.visar) return
    if (Math.hypot(x - p.x, y - p.y) > geo.cs * 0.9) slapp(false)
  }
  function upp() {
    slapp(true)
  }
  function slapp(skicka) {
    const p = tryckRef.current
    if (!p) return
    clearTimeout(p.timer)
    tryckRef.current = null
    if (a.current.forhands === p.id) a.current.forhands = -1
    if (skicka && !p.visar) tryckPil(p.id)
  }
  useEffect(() => () => tryckRef.current && clearTimeout(tryckRef.current.timer), [])

  /* ------------------------------------------------------------ boosters */

  function anvand(typ, fn) {
    const s = sparRef.current
    if ((s.boost[typ] || 0) > 0) {
      setSpar((x) => ({ ...x, boost: { ...x.boost, [typ]: x.boost[typ] - 1 } }))
    } else if (!betala(BOOST[typ].pris)) {
      visaNotis('För lite mynt')
      return
    }
    ljud.booster()
    fn()
  }

  function tips() {
    if (a.current.klar) return
    const id = spel.tips()
    if (id < 0) return
    anvand('tips', () => {
      a.current.tips = id
      const p = spel.pilar[id]
      const [hx, hy] = mitt(...p.celler[p.celler.length - 1])
      fx.ring(hx, hy, '#fff3a0', 40, 0.6, 3)
    })
  }

  function blixt() {
    if (a.current.klar) return
    anvand('blixt', () => {
      fx.skaka(5)
      let n = 0
      const steg = () => {
        if (a.current.spel !== spel || a.current.klar || n >= 10) return
        const id = spel.tips()
        if (id < 0) return
        const p = spel.pilar[id]
        const [hx, hy] = mitt(...p.celler[p.celler.length - 1])
        fx.sprut(hx, hy, ['#fff3a0', '#ffffff', '#ffd43b'], 12, { fart: 220, form: 'gnista', gravitation: 0, liv: 0.35 })
        tryckPil(id)
        n++
        setTimeout(steg, 85)
      }
      steg()
    })
  }

  /* ------------------------------------------------------------ vinst/förlust */

  function vinna() {
    const s = a.current
    const res = belona(sparRef.current, {
      gameId: ID,
      niva: aktivNiva,
      svar: bana.svar,
      perfekt: spel.misstag() === 0,
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
    spel.extraHjarta()
    a.current.klar = false
    setSlut(false)
    ljud.booster()
    rendera()
  }

  /* ------------------------------------------------------------ ritning */

  function uppdatera(dt) {
    const s = a.current
    if (fx.fryst()) {
      fx.uppdatera(dt)
      return
    }
    s.t += dt
    fx.uppdatera(dt)
    // krockar: träffögonblicket
    for (const [id, r] of s.rorelse) {
      if (r.typ === 'krock' && !r.traff && s.t - r.start >= krockTid(r.steg)) {
        r.traff = true
        const p = spel.pilar[id]
        const [hx, hy] = mitt(...p.celler[p.celler.length - 1])
        const px = hx + DX[p.dir] * (r.steg + 0.4) * geo.cs
        const py = hy + DY[p.dir] * (r.steg + 0.4) * geo.cs
        fx.sprut(px, py, ['#ff4d6d', '#ffffff'], 14, { fart: 170, form: 'gnista', gravitation: 0, liv: 0.3 })
        fx.skaka(7)
        fx.hitstop(60)
        ljud.hjarta()
        s.skak.set(r.mot, s.t)
        setHjartaBrast(true)
        setTimeout(() => setHjartaBrast(false), 600)
      }
    }
    if (s.klar && s.vinstTid && s.t >= s.vinstTid && !s.firat) {
      s.firat = true
      fx.konfetti(W / 2, H * 0.75, 90, W)
      fx.skaka(5)
      ljud.vinst()
      setTimeout(vinna, 900)
    }
  }

  function rita(ctx) {
    const s = a.current
    const t = s.t
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    ctx.translate(fx.skakX(), fx.skakY())

    // brädets form: svagt ifyllda rutor och en prick i varje
    const { cs } = geo
    ctx.fillStyle = 'rgba(120, 140, 255, 0.07)'
    for (let y = 0; y < bana.h; y++) {
      for (let x = 0; x < bana.w; x++) {
        if (!bana.mask[y * bana.w + x]) continue
        ctx.fillRect(geo.ox + x * cs + 0.5, geo.oy + y * cs + 0.5, cs - 1, cs - 1)
      }
    }
    ctx.fillStyle = 'rgba(160, 180, 230, 0.16)'
    for (let y = 0; y < bana.h; y++) {
      for (let x = 0; x < bana.w; x++) {
        if (!bana.mask[y * bana.w + x]) continue
        const [mx, my] = mitt(x, y)
        ctx.beginPath()
        ctx.arc(mx, my, Math.max(1.2, cs * 0.06), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const bredd = Math.max(2.6, cs * 0.2)

    // håller man på en pil: streckad väg ut till kanten, rött kryss där den krockar
    const fh = s.forhands >= 0 ? spel.pilar[s.forhands] : null
    if (fh && fh.kvar) {
      const [hx, hy] = fh.celler[fh.celler.length - 1]
      const b = spel.blockerare(fh.id)
      const steg = b ? b.steg + 0.5 : spel.vagLangd(fh.id) + 1.2
      const [x0, y0] = mitt(hx, hy)
      const x1 = x0 + DX[fh.dir] * steg * cs
      const y1 = y0 + DY[fh.dir] * steg * cs
      ctx.setLineDash([cs * 0.18, cs * 0.22])
      ctx.lineDashOffset = -t * 30
      ctx.strokeStyle = b ? 'rgba(255, 77, 109, 0.9)' : 'rgba(125, 255, 176, 0.9)'
      ctx.lineWidth = Math.max(2, cs * 0.1)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      ctx.setLineDash([])
      if (b) {
        const k = cs * 0.2
        ctx.lineWidth = Math.max(2.5, cs * 0.12)
        ctx.beginPath()
        ctx.moveTo(x1 - k, y1 - k)
        ctx.lineTo(x1 + k, y1 + k)
        ctx.moveTo(x1 + k, y1 - k)
        ctx.lineTo(x1 - k, y1 + k)
        ctx.stroke()
      }
    }

    for (const p of spel.pilar) {
      const r = s.rorelse.get(p.id)
      if (!p.kvar && !r) continue
      // intro: pilarna ritas fram, inifrån och ut
      const [hx0, hy0] = p.celler[p.celler.length - 1]
      const avst = Math.hypot(hx0 - bana.w / 2, hy0 - bana.h / 2) / Math.max(bana.w, bana.h)
      const intro = Math.min(1, Math.max(0, (t - avst * 0.5) / 0.32))
      if (intro <= 0) continue

      let forskj = 0
      let rod = 0
      let alfa = 1
      if (r && r.typ === 'ut') {
        const dt = t - r.start
        forskj = 14 * dt + 34 * dt * dt
        const slutPos = r.vag + r.langd + 4
        if (forskj > slutPos) {
          s.rorelse.delete(p.id)
          continue
        }
        alfa = forskj > r.vag + 1 ? Math.max(0, 1 - (forskj - r.vag - 1) / (r.langd + 3)) : 1
      } else if (r && r.typ === 'krock') {
        const dt = t - r.start
        const tA = krockTid(r.steg)
        const mal = r.steg + 0.38
        if (dt < tA) forskj = mal * easeIn(dt / tA)
        else if (dt < tA + 0.06) forskj = mal
        else if (dt < tA + 0.32) forskj = mal * (1 - easeOut((dt - tA - 0.06) / 0.26))
        else {
          forskj = 0
          s.rorelse.delete(p.id)
        }
        rod = dt < tA + 0.5 ? 1 - Math.max(0, dt - tA) / 0.5 : 0
        if (dt < tA) rod = 0.35
      }

      let skakX = 0
      let skakY = 0
      const sk = s.skak.get(p.id)
      if (sk != null) {
        const k = (t - sk) / 0.35
        if (k >= 1) s.skak.delete(p.id)
        else {
          const amp = (1 - k) * cs * 0.12
          skakX = Math.sin(k * 40) * amp * (p.dir % 2 === 0 ? 1 : 0.4)
          skakY = Math.cos(k * 37) * amp * (p.dir % 2 === 1 ? 1 : 0.4)
        }
      }

      const tipsad = s.tips === p.id
      const c = rod > 0 ? blanda(farg(p), '#ff4d6d', Math.min(1, rod * 1.4)) : farg(p)
      ctx.globalAlpha = alfa
      if (tipsad) {
        ctx.shadowColor = '#fff3a0'
        ctx.shadowBlur = 14 + Math.sin(t * 7) * 6
      }
      ritaPil(ctx, p, forskj, intro, c, tipsad ? bredd * 1.35 : bredd, skakX, skakY)
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }

    fx.rita(ctx)
    ctx.restore()
  }

  // Ritar en pil som har åkt `forskj` rutor längs sin väg (kroppen följer).
  function ritaPil(ctx, p, forskj, intro, farg_, bredd, sx, sy) {
    const { cs } = geo
    const n = p.celler.length
    const spar_ = (i) => {
      // spårpunkt i (kan vara bråkdel) längs kropp + väg ut
      if (i <= n - 1) {
        const i0 = Math.max(0, Math.min(n - 1, Math.floor(i)))
        const i1 = Math.min(n - 1, i0 + 1)
        const f = i - i0
        const [ax, ay] = p.celler[i0]
        const [bx, by] = p.celler[i1]
        return [ax + (bx - ax) * f, ay + (by - ay) * f]
      }
      const [hx, hy] = p.celler[n - 1]
      const k = i - (n - 1)
      return [hx + DX[p.dir] * k, hy + DY[p.dir] * k]
    }
    const svans = n === 1 ? -0.55 : 0
    const p0 = svans + forskj
    const p1Full = n - 1 + forskj
    // intro: rita fram från svansen
    const p1 = p0 + (p1Full - p0) * easeOutBack(Math.min(1, intro))
    const pts = []
    const forsta = n === 1 ? (() => {
      const [hx, hy] = spar_(forskj)
      return [hx - DX[p.dir] * 0.55, hy - DY[p.dir] * 0.55]
    })() : spar_(p0)
    pts.push(forsta)
    for (let i = Math.floor(p0) + 1; i < p1; i++) if (i > p0) pts.push(spar_(i))
    pts.push(spar_(p1))

    const sk = (q) => [geo.ox + (q[0] + 0.5) * cs + sx, geo.oy + (q[1] + 0.5) * cs + sy]
    const huvud = sk(pts[pts.length - 1])
    const dx = DX[p.dir]
    const dy = DY[p.dir]
    const spets = [huvud[0] + dx * cs * 0.34, huvud[1] + dy * cs * 0.34]
    const bas = [huvud[0] - dx * cs * 0.06, huvud[1] - dy * cs * 0.06]

    ctx.strokeStyle = farg_
    ctx.lineWidth = bredd
    ctx.beginPath()
    pts.forEach((q, i) => {
      const [x, y] = i === pts.length - 1 ? bas : sk(q)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    const halv = cs * 0.26
    ctx.fillStyle = farg_
    ctx.beginPath()
    ctx.moveTo(spets[0], spets[1])
    ctx.lineTo(bas[0] - dy * halv - dx * cs * 0.04, bas[1] + dx * halv - dy * cs * 0.04)
    ctx.lineTo(bas[0] + dy * halv - dx * cs * 0.04, bas[1] - dx * halv - dy * cs * 0.04)
    ctx.closePath()
    ctx.fill()
  }

  const canvasRef = useSpelyta({ bredd: W, hojd: H, rita, uppdatera, ner, flytta, upp })

  const kvar = spel.kvar()
  const totalt = spel.pilar.length

  return (
    <div className="ds-rot pf-rot">
      <Topprad niva={aktivNiva} svar={bana.svar} mynt={mynt}>
        <Hjartan antal={spel.hjartan()} max={HJARTAN} forlorat={hjartaBrast} />
      </Topprad>
      <div className="pf-info">
        <span className="pf-form">{bana.namn}</span>
        <span className="pf-kvar">
          <b>{kvar}</b> av {totalt} pilar kvar
        </span>
      </div>
      <div className="pf-mater" aria-hidden="true">
        <i style={{ width: `${((totalt - kvar) / Math.max(1, totalt)) * 100}%` }} />
      </div>
      <div className="ds-yta pf-yta">
        <canvas ref={canvasRef} aria-label={`Pilflykt bana ${aktivNiva}`} />
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
            titel="Slut på hjärtan"
            text={`${kvar} ${kvar === 1 ? 'pil' : 'pilar'} kvar. Så nära!`}
            ikon="💔"
            mynt={mynt}
            fortsatt={{ text: 'Fortsätt med +1 ❤', pris: FORTSATT_PRIS, onClick: fortsatt }}
            onIgen={forsokIgen}
          />
        )}
      </div>
      <div className="ds-boostrad">
        {Object.entries(BOOST).map(([typ, b]) => (
          <BoostKnapp
            key={typ}
            ikon={b.ikon}
            namn={b.namn}
            antal={spar.boost[typ] || 0}
            pris={b.pris}
            mynt={mynt}
            onClick={typ === 'tips' ? tips : blixt}
            disabled={Boolean(vinst || slut)}
          />
        ))}
      </div>
      <p className="ds-hjalp">Tryck på en pil så flyger den ut åt det håll den pekar. Står något i vägen krockar den och du förlorar ett hjärta. Håll kvar fingret för att se vägen ut utan att skicka.</p>
    </div>
  )
}

function krockTid(steg) {
  return 0.07 + 0.035 * steg
}

function easeIn(k) {
  return k * k
}

// Blandar två färger (hsl-sträng eller hex) — enkel väg via canvas-fri tolkning.
const blandCache = new Map()
function blanda(a, b, k) {
  const nyckel = a + b + k.toFixed(2)
  if (blandCache.has(nyckel)) return blandCache.get(nyckel)
  const ra = tillRgb(a)
  const rb = tillRgb(b)
  const c = `rgb(${ra.map((v, i) => Math.round(v + (rb[i] - v) * k)).join(',')})`
  if (blandCache.size > 4000) blandCache.clear()
  blandCache.set(nyckel, c)
  return c
}

function tillRgb(c) {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = c.match(/hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)/)
  if (!m) return [255, 255, 255]
  const h = +m[1] / 360
  const s = +m[2] / 100
  const l = +m[3] / 100
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => v * 255)
}
