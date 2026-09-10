import { useState, useEffect, useCallback, useRef } from 'react'

// Fullskärm för rötspelen.
//
// Varför det inte räcker med requestFullscreen: iPhone stöder inte
// Fullscreen API överhuvudtaget. iPad gör det, Safari på Mac gör det, men på
// iPhone finns metoden inte. Det är den enhet där fullskärm behövs mest, så
// hooken faller tillbaka på en CSS-overlay som täcker hela fönstret.
//
// Skillnaden mellan lägena är att adressfältet blir kvar vid reservlösningen.
// Spelet fyller resten.
//
// Användning:
//   const { arFullskarm, stods, vaxla } = useFullskarm(ref)
//   <div ref={ref} className={arFullskarm ? 'fixed inset-0 z-50 ...' : ''}>

function harNativtStod(el) {
  if (!el) return false
  return !!(
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.msRequestFullscreen
  )
}

function nuvarandeElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.webkitCurrentFullScreenElement ||
    document.msFullscreenElement ||
    null
  )
}

export function useFullskarm(elementRef) {
  const [arFullskarm, setArFullskarm] = useState(false)
  // true = webbläsarens riktiga fullskärm, false = vår CSS-overlay
  const nativt = useRef(false)

  // Följ med när användaren går ur med Esc eller en svepgest. Utan den här
  // lyssnaren fastnar knappen i fel läge.
  useEffect(() => {
    function vidAndring() {
      const inne = !!nuvarandeElement()
      if (nativt.current) setArFullskarm(inne)
      if (!inne) nativt.current = false
    }
    const handelser = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'MSFullscreenChange',
    ]
    handelser.forEach((h) => document.addEventListener(h, vidAndring))
    return () => handelser.forEach((h) => document.removeEventListener(h, vidAndring))
  }, [])

  // Escape stänger reservlösningen. Riktig fullskärm sköter det själv.
  useEffect(() => {
    if (!arFullskarm || nativt.current) return
    function vidTangent(e) {
      if (e.key === 'Escape') setArFullskarm(false)
    }
    window.addEventListener('keydown', vidTangent)
    return () => window.removeEventListener('keydown', vidTangent)
  }, [arFullskarm])

  // Lämna alltid fullskärm när komponenten försvinner, annars blir sidan
  // kvar i fullskärm efter att man gått tillbaka till spellistan.
  useEffect(() => {
    return () => {
      if (nuvarandeElement()) {
        const ut =
          document.exitFullscreen ||
          document.webkitExitFullscreen ||
          document.webkitCancelFullScreen ||
          document.msExitFullscreen
        if (ut) {
          try {
            ut.call(document)
          } catch {
            // vissa webbläsare kastar om anropet inte kom från en gest
          }
        }
      }
    }
  }, [])

  const vaxla = useCallback(() => {
    const el = elementRef.current
    if (!el) return

    if (arFullskarm) {
      if (nativt.current && nuvarandeElement()) {
        const ut =
          document.exitFullscreen ||
          document.webkitExitFullscreen ||
          document.webkitCancelFullScreen ||
          document.msExitFullscreen
        try {
          ut.call(document)
        } catch {
          setArFullskarm(false)
        }
      } else {
        setArFullskarm(false)
      }
      return
    }

    const be =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.webkitRequestFullScreen ||
      el.msRequestFullscreen

    if (be) {
      try {
        const res = be.call(el)
        nativt.current = true
        setArFullskarm(true)
        // Promise-varianten kan avvisas, t.ex. om anropet inte räknas som
        // en användargest. Då tar vi reservlösningen i stället.
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            nativt.current = false
            setArFullskarm(true)
          })
        }
        return
      } catch {
        // faller igenom till reservlösningen
      }
    }

    nativt.current = false
    setArFullskarm(true)
  }, [arFullskarm, elementRef])

  return {
    arFullskarm,
    nativt: nativt.current,
    stods: true, // reservlösningen fungerar överallt
    harNativt: harNativtStod(elementRef.current),
    vaxla,
  }
}
