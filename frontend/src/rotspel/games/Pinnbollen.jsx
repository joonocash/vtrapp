import { useEffect, useRef, useState, useCallback } from 'react'
import {
  BREDD,
  HOJD,
  PINNE_R,
  KULA_R,
  skapaSpel,
  nastaBana,
  sikta,
  skjut,
  steg,
  siktlinje,
  orangeKvar,
} from './pinnbollenEngine.js'
import { useLjud } from '../useLjud.js'
import { readSettings } from '../useSettings.js'

// Pinnbollen. Sikta, släpp kulan, träffa alla orange pinnar.
//
// Motorn sköter fysik och regler och returnerar händelser. Den här filen
// ritar och spelar upp dem. Allt speltillstånd ligger i refs — en runda är
// 60 uppdateringar i sekunden och state hade gett 60 renders.

const FARG_BLA = '#3b82f6'
const FARG_ORANGE = '#f97316'

// Fysiktakten loopen strävar efter i millisekunder. steg() rör kulan lika
// mycket per anrop oavsett vilket dtMs man skickar in (det används bara av
// vakthunden), så det här är bara hur ofta vi väljer att anropa den.
const TAKT_MS = 1000 / 60

export default function Pinnbollen({ onGameOver }) {
  const overRef = useRef(onGameOver)
  useEffect(() => {
    overRef.current = onGameOver
  })

  const ton = useLjud()
  const canvasRef = useRef(null)
  const spelRef = useRef(null)
  if (spelRef.current === null) spelRef.current = skapaSpel(1)

  const [hud, setHud] = useState({ poang: 0, kulor: 10, orange: 0, niva: 1 })
  const [slut, setSlut] = useState(false)

  const partiklar = useRef([])
  const popp = useRef([])
  const flyt = useRef([])
  const banner = useRef(null)
  const slowmo = useRef(0)
  const ackumulator = useRef(0)
  const skak = useRef(0)
  const levande = useRef(true)
  const rapporterat = useRef(false)
  const timers = useRef([])

  const senare = useCallback((fn, ms) => {
    const t = setTimeout(() => {
      if (levande.current) fn()
    }, ms)
    timers.current.push(t)
  }, [])

  const uppdateraHud = useCallback(() => {
    const s = spelRef.current
    setHud({
      poang: s.poang,
      kulor: s.kulor,
      orange: orangeKvar(s),
      niva: s.niva,
    })
  }, [])

  // ------------------------------------------------------- händelser -> effekt

  const spelaHandelse = useCallback(
    (h) => {
      const s = spelRef.current

      if (h.typ === 'traff') {
        const farg = h.orange ? FARG_ORANGE : FARG_BLA
        for (let i = 0; i < (h.orange ? 9 : 5); i++) {
          partiklar.current.push({
            x: h.pinne.x,
            y: h.pinne.y,
            vx: (Math.random() - 0.5) * (h.orange ? 4 : 2.6),
            vy: (Math.random() - 0.5) * (h.orange ? 4 : 2.6),
            t: 0,
            f: farg,
          })
        }
        if (h.mult > 1) {
          flyt.current.push({ x: h.pinne.x, y: h.pinne.y, text: '×' + h.mult, t: 0 })
        }
        // tonhöjden stiger med antalet orange i skottet — samma trick som
        // kaskaderna i Krossen
        ton(h.orange ? 380 + s.orangeIskottet * 60 : 240, 90, 'triangle', 0.1)
        return
      }

      if (h.typ === 'raddning') {
        popp.current.push({ x: h.pinne.x, y: h.pinne.y, t: 0, raddning: true })
        banner.current = { text: 'Fastnade', farg: '#fbbf24', t: 0, ms: 900, storlek: 18 }
        ton(160, 220, 'square', 0.09)
        return
      }

      if (h.typ === 'knuff') {
        ton(140, 180, 'square', 0.08)
        return
      }

      if (h.typ === 'feber') {
        slowmo.current = 1
        banner.current = { text: 'FEBER!', farg: '#fb923c', t: 0, ms: 1400, storlek: 30 }
        if (readSettings().skak) skak.current = 12
        ton(560, 500, 'sawtooth', 0.16)
        return
      }

      if (h.typ === 'hink') {
        banner.current = { text: 'Extra kula', farg: '#4ade80', t: 0, ms: 1000, storlek: 20 }
        ton(700, 260, 'sine', 0.14)
        return
      }

      if (h.typ === 'skottSlut') {
        h.pinnar.forEach((p, i) => {
          popp.current.push({ x: p.x, y: p.y, t: -i * 2, orange: p.orange })
        })
        slowmo.current = 0
        uppdateraHud()
        return
      }

      if (h.typ === 'banaKlar') {
        banner.current = { text: 'Banan klar', farg: '#4ade80', t: 0, ms: 1600, storlek: 24 }
        ton(520, 200, 'sine', 0.15)
        senare(() => ton(660, 400, 'sine', 0.15), 200)
        senare(() => {
          if (!levande.current) return
          spelRef.current = nastaBana(spelRef.current)
          uppdateraHud()
        }, 1700)
        return
      }

      if (h.typ === 'slut') {
        setSlut(true)
        if (!rapporterat.current) {
          rapporterat.current = true
          overRef.current(spelRef.current.poang)
        }
        ton(220, 500, 'sawtooth', 0.12)
      }
    },
    [senare, ton, uppdateraHud]
  )

  // ------------------------------------------------------------------ loopen

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = null
    let sist = performance.now()

    function rita(dt) {
      const s = spelRef.current
      ctx.save()

      if (skak.current > 0) {
        const d = skak.current
        ctx.translate((Math.random() * 2 - 1) * d * 0.4, (Math.random() * 2 - 1) * d * 0.4)
        skak.current = Math.max(0, skak.current - 0.6)
      }

      ctx.fillStyle = '#0b1120'
      ctx.fillRect(-20, -20, BREDD + 40, HOJD + 40)

      if (slowmo.current) {
        ctx.fillStyle = 'rgba(251,146,60,.08)'
        ctx.fillRect(0, 0, BREDD, HOJD)
      }

      // pinnar som just försvann
      popp.current = popp.current.filter((p) => {
        p.t += 1
        if (p.t < 0) return true
        if (p.t > 18) return false
        const skala = 1 + p.t / 6
        ctx.globalAlpha = 1 - p.t / 18
        ctx.strokeStyle = p.raddning ? '#fbbf24' : p.orange ? FARG_ORANGE : FARG_BLA
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, PINNE_R * skala, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
        return true
      })

      // pinnarna
      for (const p of s.pinnar) {
        if (p.traffad) {
          ctx.fillStyle = p.orange ? '#fed7aa' : '#dbeafe'
          ctx.beginPath()
          ctx.arc(p.x, p.y, PINNE_R + 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = p.orange ? FARG_ORANGE : FARG_BLA
        ctx.beginPath()
        ctx.arc(p.x, p.y, PINNE_R, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,.35)'
        ctx.beginPath()
        ctx.arc(p.x - 2, p.y - 2, PINNE_R * 0.35, 0, Math.PI * 2)
        ctx.fill()
      }

      partiklar.current = partiklar.current.filter((p) => {
        p.t += 1
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.1
        if (p.t > 24) return false
        ctx.globalAlpha = 1 - p.t / 24
        ctx.fillStyle = p.f
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
        ctx.globalAlpha = 1
        return true
      })

      // hinken
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(s.hink.x - s.hink.bredd / 2, HOJD - 15, s.hink.bredd, 11)
      ctx.fillStyle = '#065f46'
      ctx.fillRect(s.hink.x - s.hink.bredd / 2 + 3, HOJD - 15, s.hink.bredd - 6, 4)

      // siktlinjen
      if (s.lage === 'siktar' && !slut) {
        const pts = siktlinje(s)
        ctx.fillStyle = 'rgba(255,255,255,.32)'
        pts.forEach(([x, y], i) => {
          if (i % 3) return
          ctx.beginPath()
          ctx.arc(x, y, 1.7, 0, Math.PI * 2)
          ctx.fill()
        })
      }

      // kanonen
      ctx.fillStyle = '#4b5563'
      ctx.beginPath()
      ctx.arc(BREDD / 2, 22, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#d1d5db'
      ctx.lineWidth = 3.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(BREDD / 2, 22)
      ctx.lineTo(BREDD / 2 + Math.cos(s.vinkel) * 16, 22 + Math.sin(s.vinkel) * 16)
      ctx.stroke()

      // kulan och vakthundens ring
      if (s.kula) {
        ctx.fillStyle = '#f3f4f6'
        ctx.beginPath()
        ctx.arc(s.kula.x, s.kula.y, KULA_R, 0, Math.PI * 2)
        ctx.fill()

        if (s.utanFramsteg > 600) {
          const andel = Math.min(1, s.utanFramsteg / 2500)
          ctx.strokeStyle = andel > 0.8 ? '#f87171' : '#fbbf24'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(
            s.kula.x,
            s.kula.y,
            KULA_R + 7,
            -Math.PI / 2,
            -Math.PI / 2 + andel * Math.PI * 2
          )
          ctx.stroke()
        }
      }

      // flygande multiplikatorer
      flyt.current = flyt.current.filter((f) => {
        f.t += 1
        if (f.t > 40) return false
        ctx.globalAlpha = 1 - f.t / 40
        ctx.fillStyle = '#fbbf24'
        ctx.font = '500 14px system-ui,sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(f.text, f.x, f.y - f.t * 0.7)
        ctx.globalAlpha = 1
        return true
      })

      // banner
      if (banner.current) {
        const b = banner.current
        b.t += dt
        if (b.t > b.ms) banner.current = null
        else {
          const in_ = Math.min(1, b.t / 200)
          ctx.globalAlpha = b.t > b.ms - 300 ? (b.ms - b.t) / 300 : 1
          ctx.fillStyle = b.farg
          ctx.font = '500 ' + b.storlek * (0.7 + in_ * 0.3) + 'px system-ui,sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(b.text, BREDD / 2, HOJD * 0.4)
          ctx.globalAlpha = 1
        }
      }

      if (slut) {
        ctx.fillStyle = 'rgba(0,0,0,.78)'
        ctx.fillRect(0, 0, BREDD, HOJD)
        ctx.fillStyle = '#9ca3af'
        ctx.font = '500 14px system-ui,sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Slut på kulor', BREDD / 2, HOJD / 2 - 16)
        ctx.fillStyle = '#f3f4f6'
        ctx.font = '500 28px system-ui,sans-serif'
        ctx.fillText(s.poang.toLocaleString('sv-SE'), BREDD / 2, HOJD / 2 + 18)
      }

      ctx.restore()
    }

    function loop(nu) {
      const dt = Math.min(50, nu - sist)
      sist = nu

      const s = spelRef.current
      if (!slut) {
        // Fysiktakten är frikopplad från bildrutetakten via en ackumulator:
        // steg() flyttar kulan lika mycket per anrop oavsett dtMs (dtMs
        // används bara till vakthundens tidtagning), så för att spela i
        // slowmotion måste vi anropa steg() mer sällan — inte med mindre
        // kraft. Att göra det med en ackumulator i stället för att hoppa
        // över steg baserat på Math.floor(nu/100) ger jämna, förutsägbara
        // pauser i stället för ryck, och gör dessutom den vanliga farten
        // oberoende av skärmens uppdateringsfrekvens.
        const hastighet = slowmo.current ? 4 : 1
        const stegStorlek = TAKT_MS * hastighet
        ackumulator.current += dt
        let vakt = 0
        while (ackumulator.current >= stegStorlek && vakt++ < 8) {
          const handelser = steg(s, stegStorlek)
          handelser.forEach(spelaHandelse)
          ackumulator.current -= stegStorlek
        }
      } else {
        ackumulator.current = 0
      }

      rita(dt)
      raf = requestAnimationFrame(loop)
    }

    uppdateraHud()
    raf = requestAnimationFrame(loop)

    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [slut, spelaHandelse, uppdateraHud])

  useEffect(() => {
    return () => {
      levande.current = false
      timers.current.forEach(clearTimeout)
    }
  }, [])

  // ------------------------------------------------------------------- input

  function pekare(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    const x = (e.clientX - r.left) * (BREDD / r.width)
    const y = (e.clientY - r.top) * (HOJD / r.height)
    sikta(spelRef.current, Math.atan2(y - 22, x - BREDD / 2))
  }

  function tryck(e) {
    if (slut) return
    pekare(e)
    if (skjut(spelRef.current)) {
      ton(300, 70, 'sine', 0.1)
      uppdateraHud()
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="w-full max-w-[400px] flex items-center justify-between text-xs px-1">
        <div>
          <div className="text-gray-500">Poäng</div>
          <div className="text-gray-100 font-medium text-base tabular-nums">
            {hud.poang.toLocaleString('sv-SE')}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Orange</div>
          <div className="text-orange-400 font-medium text-base tabular-nums">{hud.orange}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-500">Kulor</div>
          <div
            className={`font-medium text-base tabular-nums ${
              hud.kulor <= 2 ? 'text-red-400' : 'text-gray-100'
            }`}
          >
            {hud.kulor}
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={BREDD}
        height={HOJD}
        onPointerMove={pekare}
        onPointerDown={tryck}
        className="w-full max-w-[400px] h-auto rounded-lg touch-none select-none cursor-crosshair"
      />

      <p className="text-xs text-gray-500 text-center max-w-[400px]">
        {slut
          ? 'Tryck "Igen" nedanför.'
          : `Bana ${hud.niva}. Träffa alla orange pinnar. Flera orange i samma skott ger multiplikator.`}
      </p>
    </div>
  )
}
