import { useRef, useEffect, useCallback } from 'react'
import { readSettings } from './useSettings.js'

// Delad ljudhook. Simon hade en egen kopia av det här — nu använder båda
// den här, och mute-inställningen gäller därmed hela fliken.
//
// AudioContext skapas först vid första tonen, aldrig vid mount. iOS vägrar
// starta ljud som inte kommer efter en användargest, och en kontext som
// skapas vid mount räknas inte.

export function useLjud() {
  const ctxRef = useRef(null)

  const ton = useCallback((freq, ms = 120, typ = 'sine', vol = 0.14) => {
    if (!readSettings().ljud) return
    try {
      if (!ctxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return
        ctxRef.current = new Ctx()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') ctx.resume()

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = typ
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + ms / 1000)
    } catch {
      // ljud är valfritt, spelet funkar utan
    }
  }, [])

  useEffect(() => {
    return () => {
      if (ctxRef.current) ctxRef.current.close().catch(() => {})
    }
  }, [])

  return ton
}
