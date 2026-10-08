// Pixelkanon — regler och simulering. Ingen DOM.
//
// Som Pixel Flow: en pixelbild av kuber, ett band runt bilden och grisar i
// köer under den. Tryck på en gris så hoppar den upp på bandet och åker ett
// varv. Varje gång den passerar en rad eller kolumn skjuter den på den
// första kuben i den linjen — men bara om kuben har grisens färg. Siffran
// på grisen är dess ammo. Tom gris hoppar av. Har den ammo kvar efter
// varvet sätter den sig i en av fem väntplatser och kan skickas igen.
// Kommer en gris runt när alla platser är fulla är det slut.
//
// Bandet har en kapacitet (hur många grisar som får åka samtidigt).
// Allt räknas i rutor och sekunder, så samma kod kör spelet och boten som
// kollar att banorna går.
//
// Regel som håller banorna lösbara: för varje färg är grisarnas ammo
// tillsammans exakt lika med antalet kuber i den färgen. Allt som tar bort
// kuber utan att en gris i den färgen skjuter (enhörningen, supergrisen)
// drar därför lika mycket ammo från grisar i samma färg — helst från dem i
// väntplatserna, så att platserna töms. Annars skulle grisar komma tillbaka
// med ammo som inte längre har något att träffa.

export const SLOTS = 5
export const KAPACITET = 5
export const MAX_KAP = 7
export const VARVTID = 4.2 // sekunder per varv
export const AVSTAND = 2.2 // minsta avstånd mellan grisar på bandet, i rutor
export const REGNBAGE = -2 // färg för regnbågsgrisen, träffar allt

// Bandets väg runt bilden. Börjar i nedre vänstra hörnet och går medurs:
// upp längs vänster sida, höger längs toppen, ner längs höger, vänster längs
// botten. Varje sidoruta vet vilken linje den skjuter längs.
export function byggVag(w, h) {
  const vag = []
  vag.push({ x: -1, y: h, sida: null })
  for (let y = h - 1; y >= 0; y--) vag.push({ x: -1, y, sida: 'v', linje: y })
  vag.push({ x: -1, y: -1, sida: null })
  for (let x = 0; x < w; x++) vag.push({ x, y: -1, sida: 'o', linje: x })
  vag.push({ x: w, y: -1, sida: null })
  for (let y = 0; y < h; y++) vag.push({ x: w, y, sida: 'h', linje: y })
  vag.push({ x: w, y: h, sida: null })
  for (let x = w - 1; x >= 0; x--) vag.push({ x, y: h, sida: 'n', linje: x })
  return vag
}

export function skapaSpel(bana) {
  const { w, h } = bana
  const kuber = Int16Array.from(bana.kuber)
  let kvarKuber = kuber.reduce((s, v) => s + (v >= 0 ? 1 : 0), 0)
  const totalt = kvarKuber
  const vag = byggVag(w, h)
  const L = vag.length
  let nastaId = 1
  const kolumner = bana.kolumner.map((k) => k.map((g) => ({ ...g, id: nastaId++ })))
  // länkade grisar: lank = gemensamt nummer i banan
  const slots = new Array(bana.slots ?? SLOTS).fill(null)
  let kap = bana.kap ?? KAPACITET
  const band = [] // { id, f, ammo, s, sist, traffar }
  const inkommande = [] // väntar på plats vid starten
  let vantande = null // gris som kom runt när platserna var fulla
  let status = 'spelar'
  let tid = 0
  const handelser = []

  for (const k of kolumner) if (k[0]) k[0].dold = false

  const fart = () => (L / VARVTID) * (kvarKuber < totalt * 0.08 ? 1.7 : 1)

  // Första kuben i en linje från en sida.
  function forsta(sida, linje) {
    if (sida === 'v') {
      for (let x = 0; x < w; x++) if (kuber[linje * w + x] >= 0) return linje * w + x
    } else if (sida === 'h') {
      for (let x = w - 1; x >= 0; x--) if (kuber[linje * w + x] >= 0) return linje * w + x
    } else if (sida === 'o') {
      for (let y = 0; y < h; y++) if (kuber[y * w + linje] >= 0) return y * w + linje
    } else if (sida === 'n') {
      for (let y = h - 1; y >= 0; y--) if (kuber[y * w + linje] >= 0) return y * w + linje
    }
    return -1
  }

  // Kuber som går att träffa just nu, per färg.
  function synliga() {
    const ut = new Map()
    const sett = new Uint8Array(w * h)
    const lagg = (i) => {
      if (i < 0 || sett[i]) return
      sett[i] = 1
      const f = kuber[i]
      ut.set(f, (ut.get(f) || 0) + 1)
    }
    for (let y = 0; y < h; y++) {
      lagg(forsta('v', y))
      lagg(forsta('h', y))
    }
    for (let x = 0; x < w; x++) {
      lagg(forsta('o', x))
      lagg(forsta('n', x))
    }
    return ut
  }

  function framre(kol) {
    const k = kolumner[kol]
    return k && k.length ? k[0] : null
  }

  // Länkade grisar måste båda stå först i sina köer.
  function partner(g) {
    if (g.lank == null) return null
    for (let c = 0; c < kolumner.length; c++) {
      const f = kolumner[c][0]
      if (f && f !== g && f.lank === g.lank) return { kol: c, gris: f }
    }
    return { kol: -1, gris: null }
  }

  const ombord = () => band.length + inkommande.length

  function skickaKolumn(kol) {
    if (status !== 'spelar') return { ok: false, varfor: 'slut' }
    const g = framre(kol)
    if (!g) return { ok: false, varfor: 'tom' }
    const p = partner(g)
    const behov = p ? 2 : 1
    if (p && !p.gris) return { ok: false, varfor: 'lankad' }
    if (ombord() + behov > kap) return { ok: false, varfor: 'fullt' }
    const ut = []
    for (const [c, gris] of p ? [[kol, g], [p.kol, p.gris]] : [[kol, g]]) {
      kolumner[c].shift()
      const ny = framre(c)
      if (ny && ny.dold) {
        ny.dold = false
        handelser.push({ typ: 'avslojd', kol: c, id: ny.id, f: ny.f })
      }
      inkommande.push({ id: gris.id, f: gris.f, ammo: gris.ammo, s: 0, sist: 0, traffar: 0 })
      ut.push({ id: gris.id, kol: c })
    }
    return { ok: true, grisar: ut }
  }

  function skickaSlot(p) {
    if (status !== 'spelar') return { ok: false, varfor: 'slut' }
    const g = slots[p]
    if (!g) return { ok: false, varfor: 'tom' }
    if (ombord() + 1 > kap) return { ok: false, varfor: 'fullt' }
    slots[p] = null
    inkommande.push({ id: g.id, f: g.f, ammo: g.ammo, s: 0, sist: 0, traffar: 0 })
    return { ok: true, grisar: [{ id: g.id, slot: p }] }
  }

  // Enhörningen: en regnbågsgris som skjuter på allt. Hoppar upp på bandet
  // direkt, även om bandet är fullt.
  function regnbage(ammo) {
    if (status !== 'spelar') return { ok: false }
    const g = { id: nastaId++, f: REGNBAGE, ammo: Math.min(ammo, kvarKuber), s: 0, sist: 0, traffar: 0 }
    inkommande.push(g)
    return { ok: true, var: 'band', id: g.id }
  }

  // Booster "Handen": valfri gris i en kö, inte bara den främsta.
  function hand(kol, djup) {
    if (status !== 'spelar') return { ok: false, varfor: 'slut' }
    const k = kolumner[kol]
    const g = k && k[djup]
    if (!g) return { ok: false, varfor: 'tom' }
    if (ombord() + 1 > kap) return { ok: false, varfor: 'fullt' }
    k.splice(djup, 1)
    if (g.lank != null) lossaLank(g.lank)
    const ny = framre(kol)
    if (djup === 0 && ny && ny.dold) {
      ny.dold = false
      handelser.push({ typ: 'avslojd', kol, id: ny.id, f: ny.f })
    }
    inkommande.push({ id: g.id, f: g.f, ammo: g.ammo, s: 0, sist: 0, traffar: 0 })
    return { ok: true, grisar: [{ id: g.id, kol, djup }] }
  }

  function lossaLank(lank) {
    for (const k of kolumner) for (const x of k) if (x.lank === lank) delete x.lank
  }

  // Booster "Supergris": alla kuber i färgen f som syns just nu sprängs.
  function supergris(f) {
    if (status !== 'spelar') return []
    const mal = []
    const sett = new Set()
    const lagg = (i) => {
      if (i >= 0 && !sett.has(i) && kuber[i] === f) {
        sett.add(i)
        mal.push(i)
      }
    }
    for (let y = 0; y < h; y++) {
      lagg(forsta('v', y))
      lagg(forsta('h', y))
    }
    for (let x = 0; x < w; x++) {
      lagg(forsta('o', x))
      lagg(forsta('n', x))
    }
    for (const i of mal) {
      kuber[i] = -1
      kvarKuber--
      handelser.push({ typ: 'super', mal: i, f })
    }
    if (mal.length) drajAmmo(f, mal.length, -1)
    if (kvarKuber === 0) {
      status = 'vunnit'
      handelser.push({ typ: 'vinst' })
    }
    return mal
  }

  // Drar n ammo från grisar i färgen f (se regeln överst). Väntplatserna
  // först, sedan köerna bakifrån, sist de som åker. `utom` = grisen som
  // skjuter just nu.
  function drajAmmo(f, n, utom) {
    for (let p = 0; p < slots.length && n > 0; p++) {
      const g = slots[p]
      if (!g || g.f !== f) continue
      const d = Math.min(n, g.ammo)
      g.ammo -= d
      n -= d
      handelser.push({ typ: 'gratis', var: 'slot', slot: p, id: g.id, f, d, kvar: g.ammo })
      if (g.ammo <= 0) slots[p] = null
    }
    const djupast = Math.max(0, ...kolumner.map((k) => k.length))
    for (let d = djupast - 1; d >= 0 && n > 0; d--) {
      for (let c = 0; c < kolumner.length && n > 0; c++) {
        const g = kolumner[c][d]
        if (!g || g.f !== f) continue
        const dd = Math.min(n, g.ammo)
        g.ammo -= dd
        n -= dd
        handelser.push({ typ: 'gratis', var: 'ko', kol: c, djup: d, id: g.id, f, d: dd, kvar: g.ammo })
        if (g.ammo <= 0) {
          kolumner[c].splice(d, 1)
          if (g.lank != null) lossaLank(g.lank)
          const ny = framre(c)
          if (d === 0 && ny && ny.dold) {
            ny.dold = false
            handelser.push({ typ: 'avslojd', kol: c, id: ny.id, f: ny.f })
          }
        }
      }
    }
    for (const lista of [inkommande, band]) {
      for (let i = 0; i < lista.length && n > 0; i++) {
        const g = lista[i]
        if (g.f !== f || g.id === utom) continue
        const d = Math.min(n, g.ammo)
        g.ammo -= d
        n -= d
        handelser.push({ typ: 'gratis', var: 'band', id: g.id, f, d, kvar: g.ammo })
        // Tomma grisar på bandet hoppar av i nästa steg (se steg()).
        if (g.ammo <= 0 && lista === inkommande) lista.splice(i--, 1)
      }
    }
  }

  function extraBricka() {
    if (kap >= MAX_KAP) return false
    kap++
    return true
  }

  function steg(dt) {
    if (status !== 'spelar') return
    tid += dt
    // in på bandet när starten är fri
    while (inkommande.length && !band.some((g) => g.s < AVSTAND)) {
      const g = inkommande.shift()
      band.push(g)
      handelser.push({ typ: 'in', id: g.id, f: g.f })
    }
    const v = fart() * dt
    for (let i = 0; i < band.length; i++) {
      const g = band[i]
      const fore = g.s
      g.s += v
      // passerade rutor
      for (let k = Math.floor(fore) + 1; k <= Math.floor(g.s) && k < L; k++) {
        const ruta = vag[k]
        if (!ruta.sida || g.ammo <= 0) continue
        const mal = forsta(ruta.sida, ruta.linje)
        if (mal < 0) continue
        if (g.f !== REGNBAGE && kuber[mal] !== g.f) continue
        const f = kuber[mal]
        kuber[mal] = -1
        kvarKuber--
        g.ammo--
        g.traffar++
        handelser.push({ typ: 'skott', id: g.id, gf: g.f, f, mal, ruta: k, traffar: g.traffar, kvar: kvarKuber })
        if (g.f === REGNBAGE) drajAmmo(f, 1, g.id)
        if (kvarKuber === 0) break
      }
      if (g.ammo <= 0) {
        band.splice(i--, 1)
        handelser.push({ typ: 'tom', id: g.id, s: Math.min(g.s, L - 0.001) })
        continue
      }
      if (g.s >= L && g.f === REGNBAGE) {
        // Enhörningen åker bara ett varv och tar aldrig en väntplats.
        band.splice(i--, 1)
        handelser.push({ typ: 'tom', id: g.id, s: L - 0.001, enhorning: true })
        continue
      }
      if (g.s >= L) {
        band.splice(i--, 1)
        const p = slots.indexOf(null)
        if (p < 0) {
          vantande = { id: g.id, f: g.f, ammo: g.ammo }
          status = 'forlorat'
          handelser.push({ typ: 'forlust', id: g.id })
          return
        }
        slots[p] = { id: g.id, f: g.f, ammo: g.ammo }
        handelser.push({ typ: 'slot', id: g.id, slot: p, ammo: g.ammo })
      }
    }
    if (kvarKuber === 0) {
      status = 'vunnit'
      handelser.push({ typ: 'vinst' })
    }
  }

  function extraSlot() {
    slots.push(null)
    if (status === 'forlorat' && vantande) {
      const p = slots.indexOf(null)
      slots[p] = vantande
      handelser.push({ typ: 'slot', id: vantande.id, slot: p, ammo: vantande.ammo })
      vantande = null
      status = 'spelar'
    }
  }

  return {
    w,
    h,
    vag,
    L,
    kuber,
    kolumner,
    slots,
    band,
    inkommande,
    get kap() {
      return kap
    },
    totalt,
    skickaKolumn,
    skickaSlot,
    regnbage,
    hand,
    supergris,
    extraBricka,
    steg,
    extraSlot,
    // Kuber kvar per färg (för "Rött klart!").
    perFarg() {
      const ut = new Map()
      for (const f of kuber) if (f >= 0) ut.set(f, (ut.get(f) || 0) + 1)
      return ut
    },
    // Grisarnas ammo per färg — ska alltid vara lika med perFarg().
    ammoPerFarg() {
      const ut = new Map()
      const lagg = (g) => g && g.f !== REGNBAGE && g.ammo > 0 && ut.set(g.f, (ut.get(g.f) || 0) + g.ammo)
      for (const k of kolumner) k.forEach(lagg)
      slots.forEach(lagg)
      band.forEach(lagg)
      inkommande.forEach(lagg)
      if (vantande) lagg(vantande)
      return ut
    },
    synliga,
    partner,
    // Händelser sedan förra anropet (renderaren och ljudet lyssnar).
    tomHandelser() {
      return handelser.splice(0, handelser.length)
    },
    status: () => status,
    kvar: () => kvarKuber,
    tid: () => tid,
    ombord,
    fart,
  }
}

/* ------------------------------------------------------------------ bot */

// Spelar en bana med fast tidssteg, ungefär som en vettig människa:
// skickar den gris som kan träffa flest kuber just nu (minus vad grisar
// som redan åker kommer att ta), helst från väntplatserna — och skickar
// bara en gris som troligen kommer tillbaka om det finns en ledig plats
// åt den. Returnerar { vann, maxSlots, tid }.
export function spelaBot(bana, { dt = 1 / 30, maxTid = 900 } = {}) {
  const s = skapaSpel(bana)
  let maxSlots = 0
  let vantaTill = 0
  const aterkommer = new Set() // id på grisar på bandet som väntas komma tillbaka
  while (s.status() === 'spelar' && s.tid() < maxTid) {
    if (s.ombord() < s.kap && s.tid() >= vantaTill) {
      const syn = s.synliga()
      const upptaget = new Map()
      for (const g of [...s.band, ...s.inkommande]) upptaget.set(g.f, (upptaget.get(g.f) || 0) + g.ammo)
      const varde = (f, ammo) => Math.min(ammo, Math.max(0, (syn.get(f) || 0) - (upptaget.get(f) || 0)))
      const lediga = s.slots.filter((x) => !x).length
      const paVag = [...s.band, ...s.inkommande].filter((g) => aterkommer.has(g.id)).length
      const plats = lediga - paVag // platser kvar för grisar som kommer tillbaka
      let bast = null
      const prova = (v, ammo, tillbaka, fran, gor) => {
        // en gris som kommer tillbaka behöver en plats (från en väntplats frigör den sin egen)
        if (tillbaka && fran !== 'slot' && plats - 1 < 1) return
        const poang = v + (fran === 'slot' ? 0.5 : 0) + (tillbaka ? 0 : 3)
        if (!bast || poang > bast.poang) bast = { poang, v, gor, tillbaka }
      }
      s.slots.forEach((g, p) => {
        if (!g) return
        const v = varde(g.f, g.ammo)
        if (v >= 1) prova(v, g.ammo, v < g.ammo, 'slot', () => s.skickaSlot(p))
      })
      s.kolumner.forEach((k, c) => {
        const g = k[0]
        if (!g) return
        const p = s.partner(g)
        if (p && !p.gris) return
        if (p && s.ombord() + 2 > s.kap) return
        const v = varde(g.f, g.ammo) + (p ? varde(p.gris.f, p.gris.ammo) : 0)
        const tillbaka = varde(g.f, g.ammo) < g.ammo || (p && varde(p.gris.f, p.gris.ammo) < p.gris.ammo)
        if (v >= 1) prova(v, g.ammo, tillbaka, 'kol', () => s.skickaKolumn(c))
      })
      if (bast) {
        const res = bast.gor()
        if (res.ok && bast.tillbaka) for (const g of res.grisar) aterkommer.add(g.id)
        vantaTill = s.tid() + 0.1
      } else if (!s.band.length && !s.inkommande.length) {
        // Inget träffar: gräv fram nästa gris (den med minst ammo först).
        let val = -1
        let minst = Infinity
        s.kolumner.forEach((k, c) => {
          const g = k[0]
          if (!g) return
          const p = s.partner(g)
          if (p && !p.gris) return
          if (g.ammo < minst) {
            minst = g.ammo
            val = c
          }
        })
        if (val >= 0 && lediga >= 1) {
          const res = s.skickaKolumn(val)
          if (res.ok) for (const g of res.grisar) aterkommer.add(g.id)
        }
        vantaTill = s.tid() + 0.3
      } else vantaTill = s.tid() + 0.15
    }
    s.steg(dt)
    for (const e of s.tomHandelser()) if (e.typ === 'slot' || e.typ === 'tom') aterkommer.delete(e.id)
    maxSlots = Math.max(maxSlots, s.slots.filter(Boolean).length)
  }
  return { vann: s.status() === 'vunnit', maxSlots, tid: s.tid() }
}
