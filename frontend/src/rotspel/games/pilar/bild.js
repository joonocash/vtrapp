// Pilflykt — bilden under brädet. Bara för webbläsaren (import.meta.glob).
//
// En siluettbana döljer samma emoji som siluetten är gjord av (pixelbilden
// från Pixelkanon, samma Fluent-emoji). En geometrisk bana döljer en annan
// emoji, och var sjätte bana ett foto på Happy. Allt man hittar hamnar i
// albumet.

import { BILDER, PALETT } from '../pixel/bilder.js'
import { ALBUM_CAPTIONS } from '../revir/config.js'
import { arHappy, HAPPY_VAR } from './engine.js'

const FILER = import.meta.glob('../revir/album/*.{webp,jpg,jpeg,png}', { eager: true, import: 'default' })
export const FOTON = Object.keys(FILER)
  .sort()
  .map((k) => {
    const fil = k.split('/').pop()
    return { fil, src: FILER[k], namn: ALBUM_CAPTIONS[fil] || fil.replace(/^\d+-/, '').replace(/\.\w+$/, '') }
  })

const T = '0123456789abcdefghijkl'

export function bildFor(niva, bana) {
  if (arHappy(niva) && FOTON.length) {
    const f = FOTON[Math.floor(niva / HAPPY_VAR) % FOTON.length]
    return { typ: 'happy', id: 'happy-' + f.fil, namn: f.namn, src: f.src, fil: f.fil }
  }
  let b = bana.formId ? BILDER.find((x) => x.id === bana.formId) : null
  const passar = Boolean(b)
  if (!b) b = BILDER[(niva * 37 + 11) % BILDER.length]
  return { typ: 'emoji', id: b.id, namn: b.namn, rader: b.storlekar['24'], passar }
}

// Alla bilder som går att hitta, i albumets ordning.
export function allaBilder() {
  return [
    ...BILDER.map((b) => ({ typ: 'emoji', id: b.id, namn: b.namn, rader: b.storlekar['20'] })),
    ...FOTON.map((f) => ({ typ: 'happy', id: 'happy-' + f.fil, namn: f.namn, src: f.src, fil: f.fil })),
  ]
}

const fotoCache = new Map()
export function laddaFoto(src, klar) {
  if (fotoCache.has(src)) {
    const img = fotoCache.get(src)
    if (img.complete && img.naturalWidth) klar(img)
    else img.addEventListener('load', () => klar(img), { once: true })
    return
  }
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  fotoCache.set(src, img)
  img.addEventListener('load', () => klar(img), { once: true })
}

// Ritar bilden till en egen canvas som är bw × bh (spelets koordinater) med
// skala k. Siluettbilder sträcks över hela brädet (de har samma form),
// andra bilder centreras på en mjuk bakgrund.
export function ritaBild(bild, bw, bh, k, hue, foto) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bw * k))
  c.height = Math.max(1, Math.round(bh * k))
  const g = c.getContext('2d')
  g.scale(k, k)
  const bak = g.createRadialGradient(bw * 0.5, bh * 0.4, 4, bw * 0.5, bh * 0.5, Math.max(bw, bh) * 0.75)
  bak.addColorStop(0, `hsl(${hue} 85% 88%)`)
  bak.addColorStop(1, `hsl(${(hue + 40) % 360} 70% 70%)`)
  g.fillStyle = bak
  g.fillRect(0, 0, bw, bh)
  if (bild.typ === 'happy') {
    if (foto) {
      // täck hela brädet, beskär resten
      const s = Math.max(bw / foto.naturalWidth, bh / foto.naturalHeight)
      const w = foto.naturalWidth * s
      const h = foto.naturalHeight * s
      g.drawImage(foto, (bw - w) / 2, (bh - h) / 2, w, h)
    }
    return c
  }
  const rader = bild.rader
  const ah = rader.length
  const aw = rader[0].length
  let px
  let py
  let ox
  let oy
  if (bild.passar) {
    px = bw / aw
    py = bh / ah
    ox = 0
    oy = 0
  } else {
    const s = Math.min(bw / aw, bh / ah) * 0.92
    px = py = s
    ox = (bw - aw * s) / 2
    oy = (bh - ah * s) / 2
  }
  for (let y = 0; y < ah; y++)
    for (let x = 0; x < aw; x++) {
      const ch = rader[y][x]
      if (ch === '.') continue
      g.fillStyle = PALETT[T.indexOf(ch)].hex
      // en hårfin överlappning så att inga glipor syns mellan pixlarna
      g.fillRect(ox + x * px, oy + y * py, px + 0.4, py + 0.4)
    }
  return c
}

const tumCache = new Map()
export function tumnagel(rader) {
  const k = rader.join('|')
  if (tumCache.has(k)) return tumCache.get(k)
  const h = rader.length
  const w = rader[0].length
  const s = 4
  const cv = document.createElement('canvas')
  cv.width = w * s
  cv.height = h * s
  const ctx = cv.getContext('2d')
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rader[y][x]
      if (ch === '.') continue
      ctx.fillStyle = PALETT[T.indexOf(ch)].hex
      ctx.fillRect(x * s, y * s, s, s)
    }
  const url = cv.toDataURL()
  tumCache.set(k, url)
  return url
}
