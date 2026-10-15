// Genererar Hållplatsens banor 1–ANTAL i förväg och skriver dem till
// frontend/src/rotspel/games/hallplats/banor.json.
//
//   node frontend/tests/hallplatsen-banor.gen.mjs
//
// Varje bana ska klaras av en tänkande (girig) spelare men inte för ofta av
// en "rytmklickare" som bara tar resenärer i vagnens färg. Att hitta sådana
// banor kräver många försök, för många för webbläsaren, därav filen. Samma
// frön ger samma banor. Kör på alla kärnor.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { genereraBana, koda } from '../src/rotspel/games/hallplats/engine.js'

export const ANTAL = 200
const FORSOK = 120
const here = path.dirname(fileURLToPath(import.meta.url))
const UT = path.join(here, '../src/rotspel/games/hallplats/banor.json')

if (isMainThread) {
  const karnor = Math.max(1, Math.min(availableParallelism(), 12))
  const nivaer = Array.from({ length: ANTAL }, (_, i) => i + 1)
  const ut = new Array(ANTAL)
  let klara = 0
  await Promise.all(
    Array.from({ length: karnor }, (_, w) =>
      new Promise((ok, fel) => {
        const mina = nivaer.filter((n) => n % karnor === w)
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
  for (const n of workerData) parentPort.postMessage([n, koda(genereraBana(n, { forsok: FORSOK }))])
}
