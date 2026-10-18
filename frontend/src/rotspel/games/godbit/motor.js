// Godbiten — motorn. Ren fysik och regler som i Cut the Rope, ingen DOM.
//
// En godbit hänger i rep från spikar i väggen. Klipp repen (dra fingret
// över dem) så att godbiten svänger, faller och landar i munnen på Happy.
// Tre stjärnor per bana — godbiten måste nudda dem på vägen.
//
// Repen är styva fjädrar som bara drar när de är sträckta, så en godbit i
// ett rep svänger som en pendel och ett sträckt rep (rött) fungerar som en
// slangbella när man klipper de andra. Själva repen ritas som kedjor av
// punkter (Verlet) som hänger och dinglar; det är kedjan man klipper i.
//
// Hinder och hjälp (en ny sak i taget, som i originalet):
//   krok      en spik med en ring: när godbiten åker in i ringen fäster ett nytt rep
//   bubbla    godbiten flyter uppåt i den tills man trycker på bubblan
//   kudde     luftkudde: tryck så blåser den godbiten åt sitt håll
//   taggar    nuddar godbiten dem går den sönder
//   studs     studsmatta: godbiten studsar iväg
//   hatt      två magiska hattar: in i den ena, ut ur den andra med samma fart
//   ekorre    kryper nerför ett rep mot godbiten — klipp repet innan den hinner fram
//   knapp     vänder tyngdkraften
//   tidStjarna stjärna som försvinner efter några sekunder
//   rörliga spikar och taggar som glider fram och tillbaka eller snurrar
//
// Allt räknas med fast tidssteg, så samma klipp vid samma tid ger alltid
// samma resultat — det är så boten i testerna kan visa att banorna går.

export const W = 360
export const H = 600
export const STEG = 1 / 120
const SUB = 4

export const FYSIK = {
  G: 900, // px/s²
  K: 950, // repets styvhet
  DAMP: 11, // dämpning längs repet
  LUFT: 0.1, // luftmotstånd
  MAXFART: 1500,
  BUBBLA_LYFT: 380,
  BUBBLA_DRAG: 3.2,
  STUDS_MIN: 500, // minsta fart ut från en studsmatta
}

export const GODBIT_R = 13
export const STJARNA_R = 15
export const MUN_R = 20
export const BUBBLA_R = 24
export const TAGG_R = 7
export const STUDS_TJ = 6
export const HATT_R = 20
export const KNAPP_R = 20
export const KUDDE = { rackvidd: 240, halvvinkel: 0.6, kraft: 640, r: 22 }
export const EKORRE = { fart: 34, vanta: 0.7 }

const TVAPI = Math.PI * 2

/* ---------------------------------------------------------------- hjälp */

// Avstånd från punkt till sträcka, och närmaste punkt.
function tillStracka(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1
  const vy = y2 - y1
  const L2 = vx * vx + vy * vy || 1
  let k = ((px - x1) * vx + (py - y1) * vy) / L2
  k = k < 0 ? 0 : k > 1 ? 1 : k
  const qx = x1 + vx * k
  const qy = y1 + vy * k
  return [Math.hypot(px - qx, py - qy), qx, qy]
}

// Skär sträckorna p1–p2 och p3–p4 varandra?
function skar(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3)
  if (Math.abs(d) < 1e-9) return false
  const u = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d
  const v = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d
  return u >= 0 && u <= 1 && v >= 0 && v <= 1
}

// Rörelse för spikar, taggar och studsmattor:
//   { typ: 'glid', dx, dy, T, fas }  fram och tillbaka (dx, dy = hela vägen)
//   { typ: 'snurr', cx, cy, w }      runt en punkt (rad/s)
function forflyttning(r, t) {
  if (!r) return null
  if (r.typ === 'glid') {
    const k = 0.5 - 0.5 * Math.cos((TVAPI * t) / r.T + (r.fas || 0))
    return { dx: r.dx * k, dy: r.dy * k, c: 1, s: 0, cx: 0, cy: 0 }
  }
  const v = (r.v0 || 0) + r.w * t
  return { dx: 0, dy: 0, c: Math.cos(v), s: Math.sin(v), cx: r.cx, cy: r.cy }
}
function flytta(x, y, f) {
  if (!f) return [x, y]
  if (f.cx || f.cy || f.s) {
    const ux = x - f.cx
    const uy = y - f.cy
    return [f.cx + ux * f.c - uy * f.s, f.cy + ux * f.s + uy * f.c]
  }
  return [x + f.dx, y + f.dy]
}

/* ---------------------------------------------------------------- spelet */

// bana: {
//   godbit: { x, y, bubbla? }, happy: { x, y, upp? } (munnens mitt; upp = sitter i taket)
//   rep: [{ x, y, langd?, rorelse? }]   spikar med rep till godbiten från start
//   krokar: [{ x, y, r, rorelse? }]
//   stjarnor: [{ x, y, tid? }]
//   bubblor: [{ x, y }]
//   kuddar: [{ x, y, vinkel }]          vinkel = åt vilket håll den blåser (rad, 0 = höger)
//   taggar: [{ x1, y1, x2, y2, rorelse? }]
//   studs: [{ x1, y1, x2, y2, rorelse? }]
//   hattar: [[{ x, y, vinkel }, { x, y, vinkel }]]  vinkel = åt vilket håll öppningen vetter
//   ekorrar: [{ rep, fart? }]          sitter på rep nummer `rep`
//   knapp: { x, y } | null
//   grav: -1                          (valfritt) tyngdkraften pekar uppåt från start
// }
export function skapaSpel(bana, { utseende = true } = {}) {
  const g = { x: bana.godbit.x, y: bana.godbit.y, vx: 0, vy: 0, rot: 0, vrot: 0, bubbla: -1, kvar: true }
  let grav = bana.grav === -1 ? -1 : 1 // -1: banan börjar uppochner
  let t = 0
  let status = 'spelar'
  let orsak = null
  let tagna = 0
  let hattPaus = 0
  const handelser = []
  const rep = []
  const happy = { x: bana.happy.x, y: bana.happy.y, upp: Boolean(bana.happy.upp) }

  const stjarnor = (bana.stjarnor || []).map((s, i) => ({ ...s, i, tagen: false, borta: false, kvarTid: s.tid ?? null }))
  const krokar = (bana.krokar || []).map((k, i) => ({ ...k, i, anvand: false, wx: k.x, wy: k.y }))
  const bubblor = (bana.bubblor || []).map((b, i) => ({ ...b, i, borta: false, haller: false }))
  // godbiten kan börja inne i en bubbla
  if (bana.godbit.bubbla) {
    bubblor.push({ x: g.x, y: g.y, i: bubblor.length, borta: true, haller: true })
    g.bubbla = bubblor.length - 1
  }
  const kuddar = (bana.kuddar || []).map((k, i) => ({ ...k, i, puff: -10 }))
  const taggar = (bana.taggar || []).map((s, i) => ({ ...s, i, w: [s.x1, s.y1, s.x2, s.y2] }))
  const studs = (bana.studs || []).map((s, i) => ({ ...s, i, w: [s.x1, s.y1, s.x2, s.y2], senast: -10 }))
  const hattar = (bana.hattar || []).map((p, i) => ({ i, a: p[0], b: p[1] }))
  const knapp = bana.knapp ? { ...bana.knapp, tryckt: 0 } : null

  // repets id: startrepen 0..n-1, krokarnas rep n + krokens nummer
  const antalStart = (bana.rep || []).length

  function nyttRep(id, ax, ay, L, rorelse, kalla) {
    const d = Math.hypot(g.x - ax, g.y - ay)
    const langd = L ?? d
    const n = Math.max(5, Math.min(34, Math.round(Math.max(langd, d) / 11)))
    const kedja = []
    for (let i = 0; i <= n; i++) {
      const k = i / n
      const x = ax + (g.x - ax) * k
      const y = ay + (g.y - ay) * k
      kedja.push({ x, y, px: x, py: y })
    }
    const r = { id, kalla, ax, ay, ax0: ax, ay0: ay, rorelse, L: langd, aktiv: true, kedja, seg: langd / n, delar: null, strackt: d > langd * 1.03 }
    rep.push(r)
    return r
  }

  ;(bana.rep || []).forEach((r, i) => nyttRep(i, r.x, r.y, r.langd, r.rorelse, 'start'))

  const ekorrar = (bana.ekorrar || []).map((e, i) => ({ i, rep: e.rep, fart: e.fart ?? EKORRE.fart, s: 0, vanta: e.vanta ?? EKORRE.vanta, fallande: false, x: 0, y: 0, vy: 0, borta: false, har: false }))

  const repMedId = (id) => rep.find((r) => r.id === id && r.aktiv)
  const aktivaRep = () => rep.filter((r) => r.aktiv)

  /* ------------------------------------------------------- rörliga saker */

  function uppdateraRorelse() {
    for (const r of rep) {
      if (!r.rorelse) continue
      const f = forflyttning(r.rorelse, t)
      ;[r.ax, r.ay] = flytta(r.ax0, r.ay0, f)
    }
    for (const k of krokar) {
      if (!k.rorelse) continue
      ;[k.wx, k.wy] = flytta(k.x, k.y, forflyttning(k.rorelse, t))
      for (const r of rep) if (r.kalla === 'krok' && r.krok === k.i) [r.ax, r.ay] = [k.wx, k.wy]
    }
    for (const s of [...taggar, ...studs]) {
      if (!s.rorelse) continue
      const f = forflyttning(s.rorelse, t)
      const [x1, y1] = flytta(s.x1, s.y1, f)
      const [x2, y2] = flytta(s.x2, s.y2, f)
      s.w = [x1, y1, x2, y2]
    }
  }

  /* ------------------------------------------------------- fysiken */

  function forlora(varfor, extra = {}) {
    if (status !== 'spelar') return
    status = 'forlorat'
    orsak = varfor
    g.kvar = false
    handelser.push({ typ: 'forlust', orsak: varfor, x: g.x, y: g.y, ...extra })
    // repen släpper (de som sitter i godbiten)
    for (const r of rep) if (r.aktiv) klippVid(r, Math.floor(r.kedja.length / 2), false)
  }

  function delsteg(dt) {
    let ax = 0
    let ay = FYSIK.G * grav
    if (g.bubbla >= 0) ay = -FYSIK.BUBBLA_LYFT * grav
    for (const r of rep) {
      if (!r.aktiv) continue
      const dx = g.x - r.ax
      const dy = g.y - r.ay
      const d = Math.hypot(dx, dy)
      if (d > r.L && d > 1e-6) {
        const nx = dx / d
        const ny = dy / d
        const vn = g.vx * nx + g.vy * ny
        const f = FYSIK.K * (d - r.L) + FYSIK.DAMP * vn
        ax -= nx * f
        ay -= ny * f
      }
    }
    g.vx += ax * dt
    g.vy += ay * dt
    const drag = g.bubbla >= 0 ? Math.exp(-FYSIK.BUBBLA_DRAG * dt) : 1 - FYSIK.LUFT * dt
    g.vx *= drag
    g.vy *= drag
    const fart = Math.hypot(g.vx, g.vy)
    if (fart > FYSIK.MAXFART) {
      g.vx *= FYSIK.MAXFART / fart
      g.vy *= FYSIK.MAXFART / fart
    }
    g.x += g.vx * dt
    g.y += g.vy * dt
    kollisioner()
  }

  function kollisioner() {
    if (status !== 'spelar') return
    // studsmattor
    for (const s of studs) {
      const [x1, y1, x2, y2] = s.w
      const [d, qx, qy] = tillStracka(g.x, g.y, x1, y1, x2, y2)
      const grans = GODBIT_R + STUDS_TJ
      if (d >= grans) continue
      let nx = g.x - qx
      let ny = g.y - qy
      const nd = Math.hypot(nx, ny) || 1
      nx /= nd
      ny /= nd
      g.x = qx + nx * (grans + 0.1)
      g.y = qy + ny * (grans + 0.1)
      const vn = g.vx * nx + g.vy * ny
      if (vn < FYSIK.STUDS_MIN) {
        const tx = g.vx - vn * nx
        const ty = g.vy - vn * ny
        const ut = Math.max(FYSIK.STUDS_MIN, -vn * 0.92)
        g.vx = tx + nx * ut
        g.vy = ty + ny * ut
        if (t - s.senast > 0.12) handelser.push({ typ: 'studs', i: s.i, x: qx, y: qy })
        s.senast = t
      }
    }
    // taggar
    for (const s of taggar) {
      const [x1, y1, x2, y2] = s.w
      if (tillStracka(g.x, g.y, x1, y1, x2, y2)[0] < GODBIT_R + TAGG_R - 3) {
        forlora('tagg', { tagg: s.i })
        return
      }
    }
    // stjärnor
    for (const s of stjarnor) {
      if (s.tagen || s.borta) continue
      if (Math.hypot(g.x - s.x, g.y - s.y) < GODBIT_R + STJARNA_R - 2) {
        s.tagen = true
        tagna++
        handelser.push({ typ: 'stjarna', i: s.i, nr: tagna, x: s.x, y: s.y })
      }
    }
    // krokar fäster nya rep
    for (const k of krokar) {
      if (k.anvand) continue
      if (Math.hypot(g.x - k.wx, g.y - k.wy) < k.r) {
        k.anvand = true
        const r = nyttRep(antalStart + k.i, k.wx, k.wy, k.r, null, 'krok')
        r.krok = k.i
        handelser.push({ typ: 'krok', i: k.i, rep: r.id, x: k.wx, y: k.wy })
      }
    }
    // bubblor
    if (g.bubbla < 0) {
      for (const b of bubblor) {
        if (b.borta) continue
        if (Math.hypot(g.x - b.x, g.y - b.y) < GODBIT_R + BUBBLA_R * 0.7) {
          b.borta = true
          b.haller = true
          g.bubbla = b.i
          handelser.push({ typ: 'bubbla', i: b.i, x: g.x, y: g.y })
          break
        }
      }
    }
    // hattar: bara när godbiten är fri (inga rep)
    if (hattPaus <= 0 && !rep.some((r) => r.aktiv)) {
      for (const h of hattar) {
        for (const [fran, till] of [
          [h.a, h.b],
          [h.b, h.a],
        ]) {
          if (Math.hypot(g.x - fran.x, g.y - fran.y) > HATT_R + GODBIT_R * 0.4) continue
          // in genom öppningen: farten pekar in i hatten
          const ox = Math.cos(fran.vinkel)
          const oy = Math.sin(fran.vinkel)
          if (g.vx * ox + g.vy * oy > 40) continue
          const vrid = till.vinkel - fran.vinkel + Math.PI
          const c = Math.cos(vrid)
          const s = Math.sin(vrid)
          const vx = g.vx * c - g.vy * s
          const vy = g.vx * s + g.vy * c
          // minst lite fart ut så att den inte fastnar i hatten
          const fart = Math.max(220, Math.hypot(vx, vy))
          const ux = Math.cos(till.vinkel)
          const uy = Math.sin(till.vinkel)
          g.x = till.x + ux * (HATT_R + GODBIT_R + 2)
          g.y = till.y + uy * (HATT_R + GODBIT_R + 2)
          const n = Math.hypot(vx, vy) || 1
          g.vx = (vx / n) * fart * 0.7 + ux * fart * 0.3
          g.vy = (vy / n) * fart * 0.7 + uy * fart * 0.3
          hattPaus = 0.35
          handelser.push({ typ: 'hatt', i: h.i, fran: [fran.x, fran.y], till: [till.x, till.y] })
          return
        }
      }
    }
    // Happy
    if (Math.hypot(g.x - happy.x, g.y - happy.y) < MUN_R + GODBIT_R * 0.6) {
      status = 'vunnit'
      g.kvar = false
      handelser.push({ typ: 'mums', x: happy.x, y: happy.y, stjarnor: tagna })
      for (const r of rep) if (r.aktiv) klippVid(r, Math.floor(r.kedja.length / 2), false)
      return
    }
    // utanför skärmen
    if (g.x < -50 || g.x > W + 50 || g.y > H + 50 || g.y < -70) forlora('ute')
  }

  /* ------------------------------------------------------- kedjorna (bara utseende) */

  function kedjeSteg(dt) {
    if (!utseende) return
    const gg = FYSIK.G * grav * dt * dt
    for (const r of rep) {
      const kedjor = r.aktiv ? [r.kedja] : r.delar ? [r.delar.a, r.delar.b] : []
      for (const k of kedjor) {
        for (const p of k) {
          const vx = (p.x - p.px) * 0.985
          const vy = (p.y - p.py) * 0.985
          p.px = p.x
          p.py = p.y
          p.x += vx
          p.y += vy + gg
        }
      }
      const seg = r.seg
      for (let it = 0; it < 8; it++) {
        for (const k of kedjor) {
          if (!k.length) continue
          if (k === r.kedja || (r.delar && k === r.delar.a)) {
            k[0].x = r.ax
            k[0].y = r.ay
          }
          if (r.aktiv) {
            const sista = k[k.length - 1]
            sista.x = g.x
            sista.y = g.y
          } else if (r.delar && k === r.delar.b && g.kvar && t - r.delar.t0 < 0.3) {
            const sista = k[k.length - 1]
            sista.x = g.x
            sista.y = g.y
          }
          for (let i = 0; i < k.length - 1; i++) {
            const a = k[i]
            const b = k[i + 1]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const d = Math.hypot(dx, dy) || 1e-6
            const diff = (d - seg) / d
            const fastA = i === 0 && (k === r.kedja || (r.delar && k === r.delar.a))
            const fastB = i + 1 === k.length - 1 && r.aktiv
            const wa = fastA ? 0 : fastB ? 1 : 0.5
            const wb = fastB ? 0 : fastA ? 1 : 0.5
            a.x += dx * diff * wa
            a.y += dy * diff * wa
            b.x -= dx * diff * wb
            b.y -= dy * diff * wb
          }
        }
      }
      if (r.aktiv) r.strackt = Math.hypot(g.x - r.ax, g.y - r.ay) > r.L * 1.03
    }
  }

  /* ------------------------------------------------------- ekorrar */

  function ekorrSteg(dt) {
    for (const e of ekorrar) {
      if (e.borta) continue
      if (e.fallande) {
        e.vy += FYSIK.G * dt
        e.y += e.vy * dt
        if (e.y > H + 60 || e.y < -60) e.borta = true
        continue
      }
      const r = rep.find((q) => q.id === e.rep)
      if (!r || !r.aktiv) {
        e.fallande = true
        e.vy = -120
        handelser.push({ typ: 'ekorreFaller', i: e.i })
        continue
      }
      if (status !== 'spelar') continue
      if (e.vanta > 0) e.vanta -= dt
      else e.s += e.fart * dt
      // läge längs kedjan
      const k = r.kedja
      const langd = Math.max(1, Math.min(r.L, Math.hypot(g.x - r.ax, g.y - r.ay)))
      const andel = Math.min(1, e.s / langd)
      const f = andel * (k.length - 1)
      const i0 = Math.min(k.length - 2, Math.floor(f))
      const u = f - i0
      e.x = k[i0].x + (k[i0 + 1].x - k[i0].x) * u
      e.y = k[i0].y + (k[i0 + 1].y - k[i0].y) * u
      if (andel >= 0.97) {
        e.har = true
        forlora('ekorre', { ekorre: e.i })
      }
    }
  }

  /* ------------------------------------------------------- steget */

  function steg(dt = STEG) {
    if (status !== 'spelar') {
      t += dt
      kedjeSteg(dt)
      ekorrSteg(dt)
      return tomma()
    }
    const d = dt / SUB
    for (let i = 0; i < SUB && status === 'spelar'; i++) {
      t += d
      if (hattPaus > 0) hattPaus -= d
      uppdateraRorelse()
      delsteg(d)
    }
    // bubblan följer godbiten
    if (g.bubbla >= 0) {
      const b = bubblor[g.bubbla]
      b.x = g.x
      b.y = g.y
    }
    // tidsstjärnor
    for (const s of stjarnor) {
      if (s.kvarTid == null || s.tagen || s.borta) continue
      s.kvarTid -= dt
      if (s.kvarTid <= 0) {
        s.borta = true
        handelser.push({ typ: 'stjarnaBorta', i: s.i, x: s.x, y: s.y })
      }
    }
    // rotation för utseendet: följer repet om det finns ett, annars snurrar fritt
    const aktiv = rep.filter((r) => r.aktiv)
    if (aktiv.length === 1) {
      const r = aktiv[0]
      const mal = Math.atan2(g.y - r.ay, g.x - r.ax) - Math.PI / 2
      let dv = mal - g.rot
      while (dv > Math.PI) dv -= TVAPI
      while (dv < -Math.PI) dv += TVAPI
      g.vrot = dv * 8
    } else if (!aktiv.length) g.vrot *= 0.995
    else g.vrot *= 0.9
    g.rot += g.vrot * dt
    kedjeSteg(dt)
    ekorrSteg(dt)
    return tomma()
  }

  function tomma() {
    const ut = handelser.slice()
    handelser.length = 0
    return ut
  }

  /* ------------------------------------------------------- spelarens drag */

  function klippVid(r, i, avSpelaren = true) {
    r.aktiv = false
    const k = r.kedja
    const a = k.slice(0, i + 1)
    const b = k.slice(i + 1).map((p) => ({ ...p }))
    if (!b.length) b.push({ ...k[k.length - 1] })
    r.delar = { a, b, t0: t }
    if (avSpelaren) handelser.push({ typ: 'klipp', rep: r.id, x: k[i].x, y: k[i].y })
  }

  // Ett svep från (x1, y1) till (x2, y2): klipper alla rep det korsar.
  function klipp(x1, y1, x2, y2) {
    if (status !== 'spelar') return 0
    let n = 0
    for (const r of rep) {
      if (!r.aktiv) continue
      const k = r.kedja
      for (let i = 0; i < k.length - 1; i++) {
        if (skar(x1, y1, x2, y2, k[i].x, k[i].y, k[i + 1].x, k[i + 1].y)) {
          klippVid(r, i)
          n++
          break
        }
      }
    }
    return n
  }

  // För boten (och tipsen): klipp ett visst rep mitt på.
  function klippRep(id) {
    const r = repMedId(id)
    if (!r || status !== 'spelar') return false
    klippVid(r, Math.max(0, Math.floor(r.kedja.length / 2) - 1))
    return true
  }

  function pop() {
    if (g.bubbla < 0 || status !== 'spelar') return false
    const b = bubblor[g.bubbla]
    b.haller = false
    g.bubbla = -1
    handelser.push({ typ: 'pop', i: b.i, x: g.x, y: g.y })
    return true
  }

  function puffa(i) {
    const k = kuddar[i]
    if (!k || status !== 'spelar') return false
    k.puff = t
    const ux = Math.cos(k.vinkel)
    const uy = Math.sin(k.vinkel)
    const dx = g.x - k.x
    const dy = g.y - k.y
    const d = Math.hypot(dx, dy)
    let traff = false
    if (d < KUDDE.rackvidd && d > 1) {
      const cos = (dx * ux + dy * uy) / d
      if (cos > Math.cos(KUDDE.halvvinkel)) {
        const styrka = KUDDE.kraft * (1 - (d / KUDDE.rackvidd) * 0.55)
        // mest i kuddens riktning, lite bort från kudden
        g.vx += (ux * 0.8 + (dx / d) * 0.2) * styrka
        g.vy += (uy * 0.8 + (dy / d) * 0.2) * styrka
        traff = true
      }
    }
    handelser.push({ typ: 'puff', i, traff })
    return true
  }

  function knappa() {
    if (!knapp || status !== 'spelar') return false
    grav = -grav
    knapp.tryckt = t
    handelser.push({ typ: 'gravitation', grav })
    return true
  }

  // Ett tryck (inte svep): knapp, kudde eller bubbla under fingret.
  function tryck(x, y) {
    if (status !== 'spelar') return null
    if (knapp && Math.hypot(x - knapp.x, y - knapp.y) < KNAPP_R + 10) return knappa() ? 'knapp' : null
    for (const k of kuddar) if (Math.hypot(x - k.x, y - k.y) < KUDDE.r + 12) return puffa(k.i) ? 'kudde' : null
    if (g.bubbla >= 0 && Math.hypot(x - g.x, y - g.y) < BUBBLA_R + 18) return pop() ? 'pop' : null
    // en fri bubbla kan också spräckas
    for (const b of bubblor) {
      if (b.borta) continue
      if (Math.hypot(x - b.x, y - b.y) < BUBBLA_R + 10) {
        b.borta = true
        handelser.push({ typ: 'pop', i: b.i, x: b.x, y: b.y, tom: true })
        return 'pop'
      }
    }
    return null
  }

  return {
    bana,
    godbit: g,
    rep,
    happy,
    stjarnor,
    krokar,
    bubblor,
    kuddar,
    taggar,
    studs,
    hattar,
    ekorrar,
    knapp,
    steg,
    klipp,
    klippRep,
    pop,
    puffa,
    knappa,
    tryck,
    aktivaRep,
    tomHandelser: tomma,
    t: () => t,
    grav: () => grav,
    status: () => status,
    orsak: () => orsak,
    tagna: () => tagna,
  }
}

/* ---------------------------------------------------------------- spela en plan */

// En plan är en lista drag med tider: { t, typ: 'klipp'|'pop'|'puff'|'knapp', id? }
// Kör banan med planen och returnerar { vann, stjarnor, tid, orsak }.
export function spelaPlan(bana, plan, { maxTid = 14, utseende = false } = {}) {
  const s = skapaSpel(bana, { utseende })
  const drag = [...plan].sort((a, b) => a.t - b.t)
  let i = 0
  let stilla = 0
  while (s.status() === 'spelar' && s.t() < maxTid) {
    while (i < drag.length && drag[i].t <= s.t() + 1e-9) {
      const d = drag[i++]
      if (d.typ === 'klipp') s.klippRep(d.id)
      else if (d.typ === 'pop') s.pop()
      else if (d.typ === 'puff') s.puffa(d.id)
      else if (d.typ === 'knapp') s.knappa()
    }
    s.steg(STEG)
    // fast för evigt (hänger stilla och planen är slut)?
    const g = s.godbit
    if (i >= drag.length && Math.hypot(g.vx, g.vy) < 4) stilla += STEG
    else stilla = 0
    if (stilla > 1.5) break
  }
  return { vann: s.status() === 'vunnit', stjarnor: s.tagna(), tid: s.t(), orsak: s.orsak() || (s.status() === 'spelar' ? 'fast' : null) }
}
