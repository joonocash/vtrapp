// Pilflykt — regler och bangenerator. Ingen DOM.
//
// Som Arrows – Puzzle Escape: brädet är fullt av pilar som ormar sig genom
// flera rutor. Trycker man på en pil åker den ut ur brädet åt det håll
// huvudet pekar, och kroppen följer efter. Står någon annan pil i vägen
// krockar den, studsar tillbaka och man förlorar ett av tre hjärtan.
//
// Att ta bort en pil gör aldrig en annan pil sämre — vägar blir bara friare.
// Därför är en bana lösbar exakt när det inte finns någon cirkel av pilar
// som blockerar varandra, och då löser girig borttagning den alltid.
//
// Generatorn bygger baklänges: pilarna läggs ut i omvänd ordning mot hur
// de ska tas bort. Varje ny pil måste ha fri väg ut förbi allt som redan
// ligger, så banan är lösbar per konstruktion.

import { slump, blanda, klamp, heltal } from '../delat/rng.js'
import { svarighet } from '../delat/svarighet.js'
import FORMER from './former.js'

export const DX = [0, 1, 0, -1]
export const DY = [-1, 0, 1, 0]
export const HJARTAN = 3

/* ------------------------------------------------------------------ former */

// Skalar en siluett (40 rutor) till s rutor på längsta sidan.
export function formMask(form, s) {
  const k = s / Math.max(form.w, form.h)
  const w = Math.max(2, Math.round(form.w * k))
  const h = Math.max(2, Math.round(form.h * k))
  const bit = (x, y) => {
    const rad = form.rader[y]
    const ch = parseInt(rad[Math.floor(x / 4)], 16)
    return (ch >> (3 - (x % 4))) & 1
  }
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // andel täckta fina rutor
      const x0 = Math.floor((x * form.w) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * form.w) / w))
      const y0 = Math.floor((y * form.h) / h)
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * form.h) / h))
      let n = 0
      let t = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        n += bit(xx, yy)
        t++
      }
      mask[y * w + x] = n / t >= 0.45 ? 1 : 0
    }
  }
  return rensaMask({ w, h, mask })
}

// Tar bort små öar (färre än 4 rutor) och trimmar tomma kanter.
function rensaMask({ w, h, mask }) {
  const sett = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || sett[i]) continue
    const ko = [i]
    const del = []
    sett[i] = 1
    while (ko.length) {
      const c = ko.pop()
      del.push(c)
      const x = c % w
      const y = (c - x) / w
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d]
        const ny = y + DY[d]
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const n = ny * w + nx
        if (mask[n] && !sett[n]) {
          sett[n] = 1
          ko.push(n)
        }
      }
    }
    if (del.length < 4) for (const c of del) mask[c] = 0
  }
  let x0 = w, x1 = -1, y0 = h, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  const nw = x1 - x0 + 1
  const nh = y1 - y0 + 1
  const ny = new Uint8Array(nw * nh)
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) ny[y * nw + x] = mask[(y + y0) * w + x + x0]
  return { w: nw, h: nh, mask: ny }
}

function geometrisk(typ, w, h) {
  const mask = new Uint8Array(w * h)
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x - cx) / (w / 2)
      const v = (y - cy) / (h / 2)
      let in_ = true
      if (typ === 'cirkel') in_ = u * u + v * v <= 1.02
      if (typ === 'romb') in_ = Math.abs(u) + Math.abs(v) <= 1.08
      if (typ === 'ring') in_ = u * u + v * v <= 1.02 && u * u + v * v >= 0.16
      if (typ === 'kors') in_ = Math.abs(u) <= 0.38 || Math.abs(v) <= 0.38
      if (typ === 'timglas') in_ = Math.abs(u) <= Math.abs(v) * 1.05 + 0.18
      mask[y * w + x] = in_ ? 1 : 0
    }
  }
  return rensaMask({ w, h, mask })
}

const GEO = [
  ['rekt', 'Rektangel'],
  ['cirkel', 'Cirkel'],
  ['romb', 'Romb'],
  ['ring', 'Ring'],
  ['kors', 'Kors'],
  ['timglas', 'Timglas'],
]

/* -------------------------------------------------------------- parametrar */

export function parametrar(niva) {
  const svar = svarighet(niva)
  const tidig = [
    [4, 4],
    [4, 5],
    [5, 5],
    [5, 6],
    [6, 6],
    [6, 7],
  ]
  let storlek = niva <= tidig.length ? null : klamp(7 + Math.floor((niva - 6) / 4), 7, 15)
  if (storlek && svar === 'svår') storlek = Math.min(17, storlek + 2)
  if (storlek && svar === 'supersvår') storlek = Math.min(18, storlek + 3)
  const maxLangd = klamp(2 + Math.floor(niva / 5), 3, 9) + (svar === 'svår' ? 2 : svar === 'supersvår' ? 3 : 0)
  const svang = klamp(0.25 + niva * 0.006, 0.25, 0.5) + (svar !== 'normal' ? 0.1 : 0)
  return { svar, tidig: niva <= tidig.length ? tidig[niva - 1] : null, storlek, maxLangd, svang }
}

export function valjForm(niva) {
  const p = parametrar(niva)
  if (p.tidig) {
    const [w, h] = p.tidig
    return { namn: 'Rektangel', ...geometrisk('rekt', w, h) }
  }
  const r = slump('pilflykt-form', niva)
  const s = p.storlek
  // Från bana 16 är varannan bana en bild (siluetter syns inte i små bräden),
  // varannan en geometrisk form.
  if (niva % 2 === 0 && s >= 10) {
    const form = FORMER[(Math.floor(niva / 2) * 7 + heltal(r, 0, 2)) % FORMER.length]
    return { namn: form.namn, ...formMask(form, s + 1) }
  }
  const [typ, namn] = GEO[Math.floor(niva / 2) % GEO.length]
  if (typ === 'rekt') return { namn, ...geometrisk('rekt', s, Math.round(s * 1.25)) }
  return { namn, ...geometrisk(typ, s, Math.round(s * 1.15)) }
}

/* -------------------------------------------------------------- generator */

export function genereraBana(niva) {
  const p = parametrar(niva)
  const form = valjForm(niva)
  // Några försök med olika frön; behåll det tätaste.
  let bast = null
  for (let f = 0; f < 4; f++) {
    const r = slump('pilflykt', niva, f)
    const pilar = bygg(form.w, form.h, form.mask, p, r)
    const fyllt = pilar.reduce((s, x) => s + x.celler.length, 0)
    const yta = form.mask.reduce((s, v) => s + v, 0)
    const tathet = fyllt / yta
    if (!bast || tathet > bast.tathet) bast = { pilar, tathet }
    if (tathet > 0.97) break
  }
  return { niva, svar: p.svar, namn: form.namn, w: form.w, h: form.h, mask: form.mask, pilar: bast.pilar }
}

function bygg(w, h, mask, p, r) {
  const N = w * h
  const occ = new Int32Array(N).fill(-1)
  const ifyllt = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1
  const pilar = []
  // laneHit[c] = index för pilar vars väg ut går genom ruta c
  const laneHit = Array.from({ length: N }, () => [])

  const vagFri = (c, d) => {
    let x = c % w
    let y = (c - x) / w
    for (;;) {
      x += DX[d]
      y += DY[d]
      if (x < 0 || y < 0 || x >= w || y >= h) return true
      if (occ[y * w + x] !== -1) return false
    }
  }
  const vag = (c, d) => {
    const ut = []
    let x = c % w
    let y = (c - x) / w
    for (;;) {
      x += DX[d]
      y += DY[d]
      if (x < 0 || y < 0 || x >= w || y >= h) return ut
      ut.push(y * w + x)
    }
  }

  // Djupa rutor först: de har fortfarande fri väg ut när de läggs.
  const ordning = []
  for (let c = 0; c < N; c++) {
    if (!mask[c]) continue
    const x = c % w
    const y = (c - x) / w
    const djup = Math.min(x, y, w - 1 - x, h - 1 - y)
    ordning.push([c, djup + r() * 2.2])
  }
  ordning.sort((a, b) => b[1] - a[1])

  const lagg = (kropp, d) => {
    const id = pilar.length
    const huvud = kropp[0]
    const celler = kropp.slice().reverse().map((c) => [c % w, (c - (c % w)) / w])
    pilar.push({ celler, dir: d })
    for (const c of kropp) occ[c] = id
    for (const c of vag(huvud, d)) laneHit[c].push(id)
  }

  for (const [c] of ordning) {
    if (occ[c] !== -1) continue
    const dirs = blanda([0, 1, 2, 3], r)
    for (const d of dirs) {
      if (!vagFri(c, d)) continue
      const egenVag = new Set(vag(c, d))
      const langd = heltal(r, 2, p.maxLangd)
      const kropp = [c]
      const iKropp = new Set(kropp)
      let cur = c
      let rikt = (d + 2) % 4
      while (kropp.length < langd) {
        const x = cur % w
        const y = (cur - x) / w
        const alt = kropp.length === 1 ? [rikt] : r() < p.svang ? blanda([(rikt + 1) % 4, (rikt + 3) % 4, rikt], r) : [rikt, ...blanda([(rikt + 1) % 4, (rikt + 3) % 4], r)]
        let gick = false
        for (const nd of alt) {
          const nx = x + DX[nd]
          const ny = y + DY[nd]
          if (!ifyllt(nx, ny)) continue
          const n = ny * w + nx
          if (occ[n] !== -1 || iKropp.has(n) || egenVag.has(n)) continue
          kropp.push(n)
          iKropp.add(n)
          cur = n
          rikt = nd
          gick = true
          break
        }
        if (!gick) break
      }
      if (kropp.length < 2) continue
      lagg(kropp, d)
      break
    }
  }

  // Fyll hål genom att förlänga svansar. En ruta får bli svans åt pil X om
  // den inte ligger i vägen för X själv eller för någon pil som lagts efter
  // X (de tas bort före X och behöver fri väg).
  for (let varv = 0; varv < 6; varv++) {
    let andrat = false
    for (let c = 0; c < N; c++) {
      if (!mask[c] || occ[c] !== -1) continue
      const x = c % w
      const y = (c - x) / w
      const kand = []
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d]
        const ny = y + DY[d]
        if (!ifyllt(nx, ny)) continue
        const id = occ[ny * w + nx]
        if (id < 0) continue
        const svans = pilar[id].celler[0]
        if (svans[0] !== nx || svans[1] !== ny) continue
        if (pilar[id].celler.length >= p.maxLangd + 3) continue
        if (laneHit[c].some((j) => j >= id)) continue
        kand.push(id)
      }
      if (!kand.length) continue
      const id = kand[Math.floor(r() * kand.length)]
      pilar[id].celler.unshift([x, y])
      occ[c] = id
      andrat = true
    }
    if (!andrat) break
  }

  // Sista chansen: ensamma rutor med fri väg blir små pilar (tas bort först).
  for (let c = 0; c < N; c++) {
    if (!mask[c] || occ[c] !== -1) continue
    for (const d of blanda([0, 1, 2, 3], r)) {
      if (vagFri(c, d)) {
        lagg([c], d)
        break
      }
    }
  }

  return pilar
}

/* ------------------------------------------------------------ lösare (test) */

// Girig lösning: ta bort valfri fri pil tills inget finns kvar.
export function losGirigt(bana) {
  const s = skapaSpel(bana)
  const ordning = []
  let andrat = true
  while (s.kvar() > 0 && andrat) {
    andrat = false
    for (const p of s.pilar) {
      if (p.kvar && s.fri(p.id)) {
        s.tryck(p.id)
        ordning.push(p.id)
        andrat = true
      }
    }
  }
  return s.kvar() === 0 ? ordning : null
}

/* ------------------------------------------------------------------ spelet */

export function skapaSpel(bana) {
  const { w, h } = bana
  const pilar = bana.pilar.map((p, i) => ({ celler: p.celler, dir: p.dir, id: i, kvar: true }))
  const occ = new Int32Array(w * h).fill(-1)
  for (const p of pilar) for (const [x, y] of p.celler) occ[y * w + x] = p.id
  let hjartan = HJARTAN
  let kvar = pilar.length
  let misstag = 0

  const huvud = (p) => p.celler[p.celler.length - 1]

  function blockerare(p) {
    let [x, y] = huvud(p)
    let steg = 0
    for (;;) {
      x += DX[p.dir]
      y += DY[p.dir]
      if (x < 0 || y < 0 || x >= w || y >= h) return null
      const o = occ[y * w + x]
      if (o >= 0) return { id: o, steg }
      steg++
    }
  }

  // Avstånd från huvudet till kanten (rutor), för animationen.
  function vagLangd(p) {
    const [x, y] = huvud(p)
    return [y, w - 1 - x, h - 1 - y, x][p.dir]
  }

  function tryck(id) {
    const p = pilar[id]
    if (!p || !p.kvar || hjartan <= 0 || kvar === 0) return null
    const b = blockerare(p)
    if (!b) {
      p.kvar = false
      for (const [x, y] of p.celler) occ[y * w + x] = -1
      kvar--
      return { typ: 'ut', id, vunnit: kvar === 0 }
    }
    hjartan--
    misstag++
    return { typ: 'krock', id, mot: b.id, steg: b.steg, forlorat: hjartan === 0 }
  }

  // Tips: en fri pil, helst en som släpper loss andra.
  function tips() {
    let bast = -1
    let bastPoang = -1
    for (const p of pilar) {
      if (!p.kvar || blockerare(p)) continue
      let poang = 0
      for (const q of pilar) {
        if (!q.kvar || q === p) continue
        const b = blockerare(q)
        if (b && b.id === p.id) poang++
      }
      if (poang > bastPoang) {
        bastPoang = poang
        bast = p.id
      }
    }
    return bast
  }

  // Närmaste pil till en punkt i rutkoordinater (rutans mitt = i + 0.5).
  function pilVid(fx, fy, max = 0.8) {
    const cx = Math.floor(fx)
    const cy = Math.floor(fy)
    const kandidater = new Set()
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      const o = occ[y * w + x]
      if (o >= 0) kandidater.add(o)
    }
    let bast = -1
    let bastD = max
    for (const id of kandidater) {
      const d = avstandTillPil(pilar[id], fx, fy)
      if (d < bastD) {
        bastD = d
        bast = id
      }
    }
    return bast
  }

  return {
    w,
    h,
    pilar,
    occ,
    fri: (id) => pilar[id].kvar && !blockerare(pilar[id]),
    blockerare: (id) => blockerare(pilar[id]),
    vagLangd: (id) => vagLangd(pilar[id]),
    tryck,
    tips,
    pilVid,
    kvar: () => kvar,
    hjartan: () => hjartan,
    misstag: () => misstag,
    extraHjarta() {
      hjartan++
    },
  }
}

function avstandTillPil(p, fx, fy) {
  const c = p.celler
  if (c.length === 1) {
    // ensam pil: rita från bakkant till huvud
    const [x, y] = c[0]
    return Math.hypot(fx - (x + 0.5), fy - (y + 0.5))
  }
  let bast = Infinity
  for (let i = 0; i < c.length - 1; i++) {
    const ax = c[i][0] + 0.5
    const ay = c[i][1] + 0.5
    const bx = c[i + 1][0] + 0.5
    const by = c[i + 1][1] + 0.5
    const vx = bx - ax
    const vy = by - ay
    const t = Math.max(0, Math.min(1, ((fx - ax) * vx + (fy - ay) * vy) / (vx * vx + vy * vy)))
    bast = Math.min(bast, Math.hypot(fx - (ax + vx * t), fy - (ay + vy * t)))
  }
  return bast
}
