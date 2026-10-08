import { useEffect, useRef } from 'react'

// Delad canvas för de nya rötspelen.
//
// Spelet ritar i en fast logisk storlek (t.ex. 360 × 560). Hooken skalar
// canvasen till behållarens bredd, tar hänsyn till skärmens pixeltäthet och
// räknar om pekarens position till logiska koordinater. Ritloopen går med
// requestAnimationFrame och får dt i sekunder (högst 1/20 s, så en flik som
// legat i bakgrunden inte hoppar).
//
// Callbackarna läses via en ref, så spelet kan skicka nya funktioner varje
// render utan att canvasen sätts upp igen.

export function useSpelyta({ bredd, hojd, rita, uppdatera, ner, flytta, upp }) {
  const canvasRef = useRef(null)
  const cb = useRef({})
  cb.current = { rita, uppdatera, ner, flytta, upp }
  const mat = useRef({ bredd, hojd, skala: 1 })
  mat.current.bredd = bredd
  mat.current.hojd = hojd

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let dpr = 1
    let cssW = 0

    function anpassa() {
      const { bredd: B, hojd: H } = mat.current
      dpr = Math.min(2.5, window.devicePixelRatio || 1)
      const forald = canvas.parentElement
      cssW = Math.max(200, forald ? forald.clientWidth : B)
      const cssH = (cssW * H) / B
      canvas.style.width = cssW + 'px'
      canvas.style.height = cssH + 'px'
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      mat.current.skala = cssW / B
    }
    anpassa()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(anpassa) : null
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('resize', anpassa)

    let raf = 0
    let forra = performance.now()
    function loop(nu) {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, Math.max(0, (nu - forra) / 1000))
      forra = nu
      const { bredd: B, hojd: H } = mat.current
      if (canvas.width !== Math.round(cssW * dpr) || Math.abs(canvas.height - Math.round(((cssW * H) / B) * dpr)) > 1) anpassa()
      try {
        cb.current.uppdatera && cb.current.uppdatera(dt)
        const k = mat.current.skala * dpr
        ctx.setTransform(k, 0, 0, k, 0, 0)
        cb.current.rita && cb.current.rita(ctx, dt)
      } catch (fel) {
        console.error('[rötspel] fel i ritloopen', fel)
      }
    }
    raf = requestAnimationFrame(loop)

    function pos(e) {
      const r = canvas.getBoundingClientRect()
      const { bredd: B } = mat.current
      const k = B / r.width
      return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, e }
    }
    const pn = (e) => {
      if (e.button != null && e.button > 0) return
      e.preventDefault()
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        /* spelar ingen roll */
      }
      cb.current.ner && cb.current.ner(pos(e))
    }
    const pm = (e) => cb.current.flytta && cb.current.flytta(pos(e))
    const pu = (e) => cb.current.upp && cb.current.upp(pos(e))
    canvas.addEventListener('pointerdown', pn)
    canvas.addEventListener('pointermove', pm)
    canvas.addEventListener('pointerup', pu)
    canvas.addEventListener('pointercancel', pu)

    return () => {
      cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
      window.removeEventListener('resize', anpassa)
      canvas.removeEventListener('pointerdown', pn)
      canvas.removeEventListener('pointermove', pm)
      canvas.removeEventListener('pointerup', pu)
      canvas.removeEventListener('pointercancel', pu)
    }
  }, [])

  return canvasRef
}
