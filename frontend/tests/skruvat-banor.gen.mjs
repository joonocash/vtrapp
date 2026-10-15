// Genererar Skruvats banor 1–ANTAL i förväg och skriver dem till
// frontend/src/rotspel/games/skruv/banor.json.
//
//   node frontend/tests/skruvat-banor.gen.mjs
//
// Varje bana provas av en "rytmklickare" (tar alltid en skruv som passar
// lådan) och av en tänkande bot med ett drag framförhållning. Banan behålls
// bara om den tänkande boten klarar den och rytmklickaren inte klarar den för
// ofta — det är så banorna kräver tänkande men går att lösa utan facit. Det
// tar för lång tid för att göras i webbläsaren, därav filen. Samma frön ger
// samma banor. Kör på alla kärnor.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { genereraBana, koda } from '../src/rotspel/games/skruv/engine.js'

export const ANTAL = 200
const here = path.dirname(fileURLToPath(import.meta.url))
const UT = path.join(here, '../src/rotspel/games/skruv/banor.json')

if (isMainThread) {
  const kärnor = Math.max(1, Math.min(availableParallelism() - 1, 12))
  const nivaer = Array.from({ length: ANTAL }, (_, i) => i + 1)
  const ut = new Array(ANTAL)
  let klara = 0
  await Promise.all(
    Array.from({ length: kärnor }, (_, w) =>
      new Promise((ok, fel) => {
        const mina = nivaer.filter((n) => n % kärnor === w)
        const worker = new Worker(fileURLToPath(import.meta.url), { workerData: mina })
        worker.on('message', ([n, d]) => {
          ut[n - 1] = d
          if (++klara % 20 === 0) console.log(`${klara}/${ANTAL}`)
        })
        worker.on('error', fel)
        worker.on('exit', ok)
      })
    )
  )
  writeFileSync(UT, '[\n' + ut.map((d) => JSON.stringify(d)).join(',\n') + '\n]\n')
  console.log('skrev', UT)
} else {
  for (const n of workerData) parentPort.postMessage([n, koda(genereraBana(n, { smart: true }))])
}
