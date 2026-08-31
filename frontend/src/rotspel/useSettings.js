import { useState, useEffect, useCallback } from 'react'

// Delade inställningar för hela rötspel-fliken. Gäller alla spel, inte ett,
// så de bor här och inte i en spelkomponent.
//
// Skärmskaket har systemets prefers-reduced-motion som förval. Folk med
// vestibulära besvär kan bli åksjuka av skärmskak, och webbläsaren vet redan
// vad de har svarat på den frågan — då ska vi inte fråga igen.

const KEY = 'rotspel_installningar'

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function load() {
  const reduce = prefersReducedMotion()
  const standard = { ljud: true, skak: !reduce, hitstop: !reduce }

  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return standard
    const sparat = JSON.parse(raw)
    return {
      ljud: typeof sparat.ljud === 'boolean' ? sparat.ljud : standard.ljud,
      skak: typeof sparat.skak === 'boolean' ? sparat.skak : standard.skak,
      hitstop: typeof sparat.hitstop === 'boolean' ? sparat.hitstop : standard.hitstop,
    }
  } catch {
    return standard
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // privat läge
    }
  }, [settings])

  const toggle = useCallback((namn) => {
    setSettings((s) => ({ ...s, [namn]: !s[namn] }))
  }, [])

  return { settings, toggle }
}

// Läser inställningarna utan att prenumerera på dem. Animationslagret och
// ljudhooken behöver aktuellt värde vid anropstillfället, inte en render
// varje gång något ändras.
export function readSettings() {
  return load()
}
