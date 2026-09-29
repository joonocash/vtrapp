// Genererar alla banor till Trassel och skriver dem som JSON.
//
//   node frontend/tests/trassel-banor.gen.mjs              allt
//   node frontend/tests/trassel-banor.gen.mjs paket        bara banpaketen
//   node frontend/tests/trassel-banor.gen.mjs dagliga      bara Dagens Trassel
//   node frontend/tests/trassel-banor.gen.mjs tidsjakt     bara tidsjakten
//
// Samma frön ger samma banor, så en omkörning ändrar ingenting om inget i
// generatorn eller listorna nedan har ändrats. Vill du ha fler dagliga banor:
// höj DAGLIGA_PER_VECKODAG och kör "dagliga" igen (tar en stund, 11×11 är dyra).
//
// Kör på alla kärnor via worker_threads.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { writeFileSync, mkdirSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const GAME = path.join(here, '../src/rotspel/games/trassel')
const OUT = path.join(GAME, 'banor')

// Varje grupp: storlek, färger, hinder och antal banor (n).
export const PAKET = [
  {
    id: 'nyborjare', namn: 'Nybörjare', text: 'Lär dig knyta ihop färgerna.',
    grupper: [
      { w: 5, h: 5, colors: [4, 5], n: 10 },
      { w: 6, h: 6, colors: [5, 6], n: 10 },
      { w: 7, h: 7, colors: [6, 7], n: 5 },
    ],
  },
  {
    id: 'klassiskt', namn: 'Klassiskt', text: 'Rena rutnät, längre linjer.',
    grupper: [
      { w: 7, h: 7, colors: [5, 7], n: 10 },
      { w: 8, h: 8, colors: [6, 8], n: 10 },
      { w: 9, h: 9, colors: [7, 9], n: 10 },
    ],
  },
  {
    id: 'stenar', namn: 'Stenar & staket', text: 'Stenar stänger rutor, staket stänger kanter.',
    grupper: [
      { w: 7, h: 7, colors: [5, 7], blocks: [2, 4], walls: [1, 3], n: 8 },
      { w: 8, h: 8, colors: [6, 8], blocks: [2, 5], walls: [2, 4], n: 9 },
      { w: 9, h: 9, colors: [7, 9], blocks: [3, 6], walls: [3, 6], n: 8 },
    ],
  },
  {
    id: 'broar', namn: 'Broar', text: 'Två färger får korsa varandra på en bro.',
    grupper: [
      { w: 7, h: 7, colors: [5, 7], bridges: [1, 2], n: 8 },
      { w: 8, h: 8, colors: [6, 8], bridges: [1, 3], n: 9 },
      { w: 9, h: 9, colors: [7, 9], bridges: [2, 4], n: 8 },
    ],
  },
  {
    id: 'portaler', namn: 'Portaler', text: 'Ut på ena sidan, in på den andra.',
    grupper: [
      { w: 7, h: 7, colors: [5, 7], warpRows: [1, 2], n: 8 },
      { w: 8, h: 8, colors: [6, 8], warpRows: [1, 2], warpCols: [0, 1], n: 9 },
      { w: 9, h: 9, colors: [7, 9], warpRows: [1, 2], warpCols: [1, 2], n: 8 },
    ],
  },
  {
    id: 'blandat', namn: 'Blandat', text: 'Allt på en gång.',
    grupper: [
      { w: 9, h: 9, colors: [7, 9], blocks: [1, 3], walls: [1, 3], bridges: [1, 2], warpRows: [0, 1], warpCols: [0, 1], n: 10 },
      { w: 10, h: 10, colors: [8, 11], blocks: [1, 3], walls: [1, 3], bridges: [1, 2], warpRows: [0, 1], n: 10 },
    ],
  },
  {
    id: 'jumbo', namn: 'Jumbo', text: 'Stora bräden för långa kvällar.',
    grupper: [
      { w: 10, h: 10, colors: [8, 11], n: 10 },
      { w: 11, h: 11, colors: [9, 12], n: 10 },
    ],
  },
]

// Index 0 = måndag. Varje veckodag har ett eget tema och en egen hög banor.
const DAGLIGA_PER_VECKODAG = 26
export const DAGLIGA = [
  { tema: 'Klassisk måndag', w: 9, h: 9, colors: [7, 9] },
  { tema: 'Stenig tisdag', w: 9, h: 9, colors: [7, 9], blocks: [3, 6], walls: [3, 6] },
  { tema: 'Bro-onsdag', w: 9, h: 9, colors: [7, 9], bridges: [2, 4] },
  { tema: 'Portaltorsdag', w: 9, h: 9, colors: [7, 9], warpRows: [1, 2], warpCols: [1, 2] },
  { tema: 'Fredagsmix', w: 10, h: 10, colors: [8, 11], blocks: [1, 3], walls: [1, 3], bridges: [1, 2], warpRows: [0, 1] },
  { tema: 'Jumbolördag', w: 11, h: 11, colors: [9, 12] },
  { tema: 'Söndagsknut', w: 10, h: 10, colors: [8, 11] },
]

export const TIDSJAKT = [
  { w: 5, h: 5, colors: [4, 5], n: 40 },
  { w: 6, h: 6, colors: [5, 6], n: 40 },
  { w: 7, h: 7, colors: [5, 7], n: 40 },
  { w: 8, h: 8, colors: [6, 8], n: 30 },
]

const CHUNK = 4 // banor per arbetsuppgift

if (!isMainThread) {
  const { generate } = await import(pathToFileURL(path.join(GAME, 'generator.js')).href)
  const { mulberry32, hashStr } = await import(pathToFileURL(path.join(GAME, 'rng.js')).href)
  parentPort.on('message', ({ id, cfg, count, seed }) => {
    const r = mulberry32(hashStr(seed))
    const out = []
    let misses = 0
    while (out.length < count && misses < 20) {
      const lv = generate(cfg, r)
      if (lv) out.push(lv)
      else misses++
    }
    parentPort.postMessage({ id, levels: out })
  })
} else {
  const vilka = process.argv[2] || 'allt'
  mkdirSync(OUT, { recursive: true })

  // Bygg uppgiftslistan. Varje grupp genererar lite fler banor än den behöver
  // (extra), och sedan väljs de ut jämnt fördelade över svårighetsgraden.
  const groups = [] // { key, cfg, want, extra }
  if (vilka === 'allt' || vilka === 'paket') {
    for (const p of PAKET) p.grupper.forEach((g, gi) => groups.push({ key: `paket:${p.id}:${gi}`, cfg: strip(g), want: g.n, extra: 1.5 }))
  }
  if (vilka === 'allt' || vilka === 'dagliga') {
    DAGLIGA.forEach((d, di) => groups.push({ key: `dagliga:${di}`, cfg: strip(d), want: DAGLIGA_PER_VECKODAG, extra: 1.4, hardest: true }))
  }
  if (vilka === 'allt' || vilka === 'tidsjakt') {
    TIDSJAKT.forEach((t, ti) => groups.push({ key: `tidsjakt:${ti}`, cfg: strip(t), want: t.n, extra: 1.1 }))
  }

  const tasks = []
  for (const g of groups) {
    const total = Math.ceil(g.want * g.extra)
    for (let i = 0; i * CHUNK < total; i++) {
      tasks.push({ id: tasks.length, group: g.key, cfg: g.cfg, count: Math.min(CHUNK, total - i * CHUNK), seed: `${g.key}:${i}` })
    }
  }
  // Dyra uppgifter först så att ingen tråd blir sist kvar med en 11×11.
  tasks.sort((a, b) => b.cfg.w * b.cfg.h - a.cfg.w * a.cfg.h)

  const results = new Map(groups.map((g) => [g.key, []]))
  const nWorkers = Math.max(1, Math.min(availableParallelism(), tasks.length))
  const t0 = Date.now()
  let done = 0
  await new Promise((resolve) => {
    let next = 0
    let alive = nWorkers
    for (let i = 0; i < nWorkers; i++) {
      const w = new Worker(fileURLToPath(import.meta.url))
      const feed = () => {
        if (next >= tasks.length) { w.terminate(); if (--alive === 0) resolve(); return }
        w.postMessage(tasks[next++])
      }
      w.on('message', ({ id, levels }) => {
        const t = tasks.find((x) => x.id === id)
        results.get(t.group).push(...levels.map((lv, i) => ({ lv, order: `${t.seed}:${i}` })))
        done++
        process.stdout.write(`\r${done}/${tasks.length} uppgifter, ${((Date.now() - t0) / 1000).toFixed(0)} s   `)
        feed()
      })
      w.on('error', (e) => { console.error(e); process.exit(1) })
      feed()
    }
  })
  console.log()

  const seen = new Set()
  const key = (lv) => `${lv.w}x${lv.h}:${lv.g}:${(lv.wl || []).join(',')}:${(lv.wr || []).join(',')}:${(lv.wc || []).join(',')}`
  function pick(g) {
    // Stabil ordning oberoende av vilken tråd som blev klar först.
    const all = results.get(g.key)
      .sort((a, b) => (a.order < b.order ? -1 : 1))
      .map((x) => x.lv)
      .filter((lv) => { const k = key(lv); if (seen.has(k)) return false; seen.add(k); return true })
    all.sort((a, b) => a.d - b.d)
    // De dagliga ska vara klurigast möjligt: hoppa över den lättaste tredjedelen.
    const pool = g.hardest ? all.slice(Math.floor(all.length - Math.max(g.want, all.length * 0.7))) : all
    if (pool.length < g.want) console.warn(`${g.key}: bara ${pool.length} av ${g.want}`)
    const out = []
    const n = Math.min(g.want, pool.length)
    for (let i = 0; i < n; i++) out.push(pool[Math.floor((i * (pool.length - 1)) / Math.max(1, n - 1))])
    return out
  }

  const writeJson = (file, data) => {
    // En bana per rad, så att diffar blir läsbara.
    const body = JSON.stringify(data, null, 1)
      .replace(/\{\n\s+"w"[\s\S]*?\n\s*\}/g, (m) => JSON.stringify(JSON.parse(m)))
    writeFileSync(path.join(OUT, file), body + '\n')
    console.log(`skrev banor/${file}`)
  }

  if (vilka === 'allt' || vilka === 'paket') {
    const paket = PAKET.map((p) => {
      const levels = []
      p.grupper.forEach((g, gi) => {
        const got = pick(groups.find((x) => x.key === `paket:${p.id}:${gi}`))
        levels.push(...got) // redan sorterade lätt → svår inom storleken
      })
      return { id: p.id, namn: p.namn, text: p.text, banor: levels }
    })
    writeJson('paket.json', paket)
  }
  if (vilka === 'allt' || vilka === 'dagliga') {
    const dagliga = DAGLIGA.map((d, di) => {
      const levels = pick(groups.find((x) => x.key === `dagliga:${di}`))
      // Blanda så att veckorna inte blir svårare och svårare i tur och ordning.
      const r = mulberryLite(di + 1)
      for (let i = levels.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [levels[i], levels[j]] = [levels[j], levels[i]] }
      return { tema: d.tema, banor: levels }
    })
    writeJson('dagliga.json', dagliga)
  }
  if (vilka === 'allt' || vilka === 'tidsjakt') {
    const tj = {}
    TIDSJAKT.forEach((t, ti) => { tj[t.w] = pick(groups.find((x) => x.key === `tidsjakt:${ti}`)) })
    writeJson('tidsjakt.json', tj)
  }
  console.log(`klart på ${((Date.now() - t0) / 1000).toFixed(0)} s`)
}

function strip(g) {
  const { n, tema, ...cfg } = g
  return cfg
}

function mulberryLite(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
