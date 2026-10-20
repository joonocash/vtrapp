import { useEffect, useMemo, useRef, useState } from 'react'
import { W, H, skapaSpel } from './motor.js'
import { VARLDAR } from './banor.js'
import { genereraBana } from './generator.js'
import { TOM, STAMPLAR, byggEgen, kanSpelas, dragVid, jamna } from './editor.js'
import { useSpelyta } from '../delat/useSpelyta.js'
import * as R from './rita.js'
import { rundRekt } from '../delat/fx.js'

// Baneditorn: rita prickar och streck, så gör motorn en bana av det.
//
//   Pinnar  tryck = en pinne, dra = en rad pinnar längs strecket
//   Tegel   dra = tegel (raka, bågar eller kurvor)
//   Former  tryck för att stämpla en ring, spiral, halfpipe, galler, ett
//           snurrhjul eller en glidande rad
//   Sudd    tryck eller dra över det som ska bort
//
// Spegeln ritar allt dubbelt (symmetriskt som i Peggle). Det man ser är den
// riktiga banan, städad: för täta pinnar tas bort och strecken rätas ut.

const VERKTYG = [
  { id: 'pinne', ikon: '✏️', namn: 'Pinnar' },
  { id: 'tegel', ikon: '▬', namn: 'Tegel' },
  { id: 'form', ikon: '⭕', namn: 'Former' },
  { id: 'sudd', ikon: '🧽', namn: 'Sudd' },
]

// Gör en genererad bana till något man kan redigera.
function slumpRitning(fro, varld) {
  const b = genereraBana(fro, { niva: 3 + (fro % 6) })
  const drag = []
  for (const o of b.objekt) {
    if (o.form === 'cirkel') drag.push({ t: 'p', x: Math.round(o.x), y: Math.round(o.y) })
    else if (o.form === 'segment') drag.push({ t: 'l', k: 'tegel', pts: [[o.x1, o.y1], [o.x2, o.y2]].map((p) => p.map(Math.round)) })
    else {
      const pts = []
      for (let k = 0; k <= 8; k++) {
        const a = o.a0 + ((o.a1 - o.a0) * k) / 8
        pts.push([Math.round(o.cx + Math.cos(a) * o.R), Math.round(o.cy + Math.sin(a) * o.R)])
      }
      drag.push({ t: 'l', k: 'tegel', pts })
    }
  }
  return { ...TOM, namn: b.namn, varld, spegel: false, drag }
}

export default function BanEditor({ start, onTesta, onSpara, onDela, onStang }) {
  const [data, setData] = useState(() => ({ ...TOM, ...(start || {}), drag: [...(start?.drag || [])] }))
  const [hist, setHist] = useState([])
  const [verktyg, setVerktyg] = useState('pinne')
  const [form, setForm] = useState('ring')
  const [varldar, setVarldar] = useState(false)
  const bana = useMemo(() => byggEgen(data), [data])
  // färgerna som spelet skulle slumpa, så att man ser ungefär hur det blir
  const visning = useMemo(() => skapaSpel(bana, { fro: 7 }), [bana])
  const fel = kanSpelas(bana)
  const varld = VARLDAR[data.varld || 0]

  const a = useRef({ streck: null, t: 0, sudd: false })
  // rulla upp editorn så att planen och verktygen ryms på en telefon
  const rot = useRef(null)
  useEffect(() => {
    rot.current?.scrollIntoView?.({ block: 'start' })
  }, [])

  function andra(f) {
    setHist((h) => [...h.slice(-40), data])
    setData((d) => f(d))
  }
  function angra() {
    if (!hist.length) return
    setData(hist[hist.length - 1])
    setHist((h) => h.slice(0, -1))
  }

  function ner(p) {
    const s = a.current
    if (verktyg === 'sudd') {
      s.sudd = true
      sudda(p.x, p.y, true)
      return
    }
    if (verktyg === 'form') {
      andra((d) => ({ ...d, drag: [...d.drag, { t: 's', form, x: Math.round(p.x), y: Math.round(p.y) }] }))
      return
    }
    s.streck = { k: verktyg, pts: [[p.x, p.y]] }
  }
  function flytta(p) {
    const s = a.current
    if (s.sudd) {
      sudda(p.x, p.y, false)
      return
    }
    if (!s.streck) return
    const sist = s.streck.pts[s.streck.pts.length - 1]
    if (Math.hypot(p.x - sist[0], p.y - sist[1]) >= 3) s.streck.pts.push([p.x, p.y])
  }
  function upp() {
    const s = a.current
    s.sudd = false
    const st = s.streck
    s.streck = null
    if (!st) return
    const [x0, y0] = st.pts[0]
    const langd = st.pts.reduce((L, p, i) => (i ? L + Math.hypot(p[0] - st.pts[i - 1][0], p[1] - st.pts[i - 1][1]) : 0), 0)
    if (langd < 10) {
      if (st.k === 'pinne') andra((d) => ({ ...d, drag: [...d.drag, { t: 'p', x: Math.round(x0), y: Math.round(y0) }] }))
      return
    }
    // sparas glesat och avrundat, så att en delad länk blir exakt samma bana
    const pts = jamna(st.pts, 6).map(([x, y]) => [Math.round(x), Math.round(y)])
    const slut = st.pts[st.pts.length - 1].map(Math.round)
    if (Math.hypot(slut[0] - pts[pts.length - 1][0], slut[1] - pts[pts.length - 1][1]) > 2) pts.push(slut)
    andra((d) => ({ ...d, drag: [...d.drag, { t: 'l', k: st.k, pts }] }))
  }
  function sudda(x, y, forst) {
    const i = dragVid(data, x, y)
    if (i < 0) return
    if (forst) setHist((h) => [...h.slice(-40), data])
    setData((d) => ({ ...d, drag: d.drag.filter((_, j) => j !== i) }))
  }

  function uppdatera(dt) {
    a.current.t += dt
  }

  function rita(ctx) {
    const t = a.current.t
    ctx.drawImage(R.bakgrund(varld), 0, 0, W, H)
    // där pinnar inte får ligga: vid kanonen och hinken
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.fillRect(0, 0, W, 86)
    ctx.fillRect(0, H - 48, W, 48)
    if (data.spegel) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.setLineDash([6, 8])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(W / 2, 90)
      ctx.lineTo(W / 2, H - 50)
      ctx.stroke()
      ctx.setLineDash([])
    }
    for (const o of visning.objekt) {
      if (o.form === 'cirkel') R.ritaPinne(ctx, o.wx, o.wy, o.r, o.farg, false)
      else R.ritaTegel(ctx, o, o.farg, false)
      if (o.grupp != null) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)'
        ctx.beginPath()
        ctx.arc(o.wx ?? (o.wx1 + o.wx2) / 2, o.wy ?? (o.wy1 + o.wy2) / 2, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    R.ritaHink(ctx, W / 2, t, 0)
    R.ritaKanon(ctx, Math.PI / 2, true, varld.ikon, t, false)
    // strecket man ritar just nu
    const st = a.current.streck
    if (st && st.pts.length > 1) {
      ctx.strokeStyle = st.k === 'tegel' ? 'rgba(255,214,120,0.9)' : 'rgba(255,255,255,0.9)'
      ctx.lineWidth = st.k === 'tegel' ? 6 : 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const rad = (pts) => {
        ctx.beginPath()
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.stroke()
      }
      rad(st.pts)
      if (data.spegel) {
        ctx.globalAlpha = 0.4
        rad(st.pts.map(([x, y]) => [W - x, y]))
        ctx.globalAlpha = 1
      }
    }
    // tom plan: en liten uppmaning
    if (!data.drag.length) {
      ctx.fillStyle = 'rgba(8,12,28,0.7)'
      rundRekt(ctx, W / 2 - 150, 262, 300, 74, 14)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = '900 16px ui-rounded, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Rita prickar och streck här', W / 2, 286)
      ctx.font = '700 12px ui-rounded, system-ui, sans-serif'
      ctx.fillStyle = '#cbd5e1'
      ctx.fillText('eller tryck 🎲 Slumpa för att börja', W / 2, 308)
      ctx.fillText('från en färdig bana', W / 2, 324)
    }
  }

  const canvasRef = useSpelyta({ bredd: W, hojd: H, rita, uppdatera, ner, flytta, upp, avbryt: upp })

  return (
    <div className="pb-editor" ref={rot}>
      <header className="pb-ed-topp">
        <button className="pb-ed-tillbaka" onClick={() => onStang(data)} aria-label="Stäng editorn">
          ←
        </button>
        <input className="pb-ed-namn" value={data.namn} maxLength={28} placeholder="Namn på banan" onChange={(e) => setData((d) => ({ ...d, namn: e.target.value }))} />
        <button className="pb-ed-varld" onClick={() => setVarldar((v) => !v)} aria-label="Välj värld" title={varld.namn}>
          {varld.ikon}
        </button>
        <button className="pb-ed-varld" onClick={() => onSpara(data)} disabled={!data.drag.length} aria-label="Spara" title="Spara">
          💾
        </button>
        <button className="pb-ed-varld" onClick={() => onDela(data)} disabled={Boolean(fel)} aria-label="Dela" title="Dela som länk">
          🔗
        </button>
      </header>
      {varldar && (
        <div className="pb-ed-varldar">
          {VARLDAR.map((v, i) => (
            <button key={v.id} className={i === data.varld ? 'pa' : ''} onClick={() => (setData((d) => ({ ...d, varld: i })), setVarldar(false))}>
              <span>{v.ikon}</span>
              {v.namn}
            </button>
          ))}
        </div>
      )}
      <div className="ds-yta pb-yta pb-ed-yta">
        <canvas ref={canvasRef} aria-label="Rita banan" />
      </div>
      <div className={`pb-ed-status${fel ? ' fel' : ''}`}>{fel || `${bana.objekt.length} pinnar och tegel · ${bana.orange} blir orange`}</div>
      {verktyg === 'form' && (
        <div className="pb-ed-former">
          {Object.entries(STAMPLAR).map(([id, s]) => (
            <button key={id} className={form === id ? 'pa' : ''} onClick={() => setForm(id)}>
              <span>{s.ikon}</span>
              {s.namn}
            </button>
          ))}
        </div>
      )}
      <div className="pb-ed-verktyg">
        {VERKTYG.map((v) => (
          <button key={v.id} className={verktyg === v.id ? 'pa' : ''} onClick={() => setVerktyg(v.id)}>
            <span>{v.ikon}</span>
            {v.namn}
          </button>
        ))}
      </div>
      <div className="pb-ed-knappar">
        <button onClick={angra} disabled={!hist.length} aria-label="Ångra">
          ↶<small>Ångra</small>
        </button>
        <button className={data.spegel ? 'pa' : ''} onClick={() => andra((d) => ({ ...d, spegel: !d.spegel }))} aria-label="Spegla">
          🪞<small>Spegel</small>
        </button>
        <button onClick={() => andra(() => slumpRitning((Date.now() & 0xffff) + 1, data.varld || 0))} aria-label="Slumpa en bana">
          🎲<small>Slumpa</small>
        </button>
        <button onClick={() => andra((d) => ({ ...d, drag: [] }))} disabled={!data.drag.length} aria-label="Rensa">
          🗑<small>Rensa</small>
        </button>
        <button className="testa" onClick={() => onTesta(data)} disabled={Boolean(fel)}>
          ▶<small>Testa</small>
        </button>
      </div>
    </div>
  )
}
