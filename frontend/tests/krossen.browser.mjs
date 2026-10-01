// Webbläsartest för Krossen: startar sajten i en riktig (huvudlös) Chromium,
// spelar slumpade drag på banor med koppel, Happy och paket och kollar efter
// varje drag att det som syns på brädet stämmer med spelmotorn. Det är
// "glitchdetektorn" som hittade koppelbuggen i PR 3: osynliga pjäser, pjäser
// som hamnat snett eller i fel storlek, och koppel som ligger kvar eller fattas.
//
// Körs inte av `npm test` (den är snabb och behöver ingen webbläsare) utan med
//   npm run test:browser
// GitHub kör det på varje pull request. Lokalt behövs Chromium en gång:
//   npx playwright install chromium
// eller peka på en egen med CHROMIUM_PATH=/sökväg/till/chrome.
// KROSSEN_DRAG=40 ger fler drag per bana (standard 22), KROSSEN_BANOR=101,135
// provar just de banorna.

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { BANOR } from '../src/rotspel/games/krossen/levels.js'
import { HAPPY_MATT } from '../src/rotspel/games/krossen/engine.js'

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DRAG = Number(process.env.KROSSEN_DRAG) || 22
const ALLA_TIPS = Object.fromEntries([...new Set(BANOR.map((b) => b.tips).filter(Boolean)), 'start'].map((t) => [t, true]))

// Samma slump varje körning, så att ett fel går att återskapa.
function slump(fro) {
  let a = fro >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Körs i sidan efter varje drag. Returnerar en lista med allt som ser fel ut.
function detektor() {
  const k = window.__krossen
  const s = k.s()
  const fel = []
  const br = document.querySelector('.kr-bradet').getBoundingClientRect()
  const cell = br.width / s.w
  const ids = new Set()
  for (const n of document.querySelectorAll('.kr-lager .kr-bit')) {
    const inre = n.firstElementChild
    const a = n.getBoundingClientRect()
    const b = inre.getBoundingClientRect()
    const synlig = parseFloat(getComputedStyle(inre).opacity) * parseFloat(getComputedStyle(n).opacity)
    const dx = Math.abs(a.left + a.width / 2 - (b.left + b.width / 2))
    const dy = Math.abs(a.top + a.height / 2 - (b.top + b.height / 2))
    const skala = b.width / a.width
    const i = Number(n.dataset.cell)
    const mittX = br.left + ((i % s.w) + 0.5) * cell
    const mittY = br.top + (Math.floor(i / s.w) + 0.5) * cell
    const t = s.tiles[i]
    ids.add(Number(n.dataset.id))
    const orsak = []
    if (synlig < 0.9) orsak.push('osynlig (' + synlig.toFixed(2) + ')')
    if (dx > cell * 0.15 || dy > cell * 0.15) orsak.push('förskjuten')
    if (skala < 0.85 || skala > 1.2) orsak.push('fel storlek (' + skala.toFixed(2) + ')')
    if (Math.abs(a.left + a.width / 2 - mittX) > 2 || Math.abs(a.top + a.height / 2 - mittY) > 2) orsak.push('i fel ruta')
    if (!t || t.id !== Number(n.dataset.id)) orsak.push('motorn har något annat i rutan')
    if (orsak.length) fel.push(`ruta ${i} (${t ? t.typ + (t.happy ? ' happy' : '') : 'tom'}${s.koppel[i] ? ', koppel' : ''}): ${orsak.join(', ')}`)
  }
  s.tiles.forEach((t, i) => {
    if (t && !ids.has(t.id)) fel.push(`ruta ${i}: pjäsen syns inte alls`)
  })
  const kopplen = [...document.querySelectorAll('[data-koppel]')].map((n) => Number(n.dataset.koppel))
  s.koppel.forEach((x, i) => {
    if (x && !kopplen.includes(i)) fel.push(`ruta ${i}: koppel saknas på skärmen`)
  })
  kopplen.forEach((i) => {
    if (!s.koppel[i]) fel.push(`ruta ${i}: koppel ligger kvar fast det är borta`)
  })
  if (document.querySelector('.kr-hoppare')) fel.push('Happys hoppkopia ligger kvar')
  return fel
}

async function vantaTillsLugnt(sida) {
  let lugna = 0
  for (let k = 0; k < 400 && lugna < 2; k++) {
    await sida.waitForTimeout(100)
    lugna = (await sida.evaluate(() => window.__krossen.upptagen())) ? 0 : lugna + 1
  }
  // målikonerna som flyger upp till mätaren hinner landa
  for (let k = 0; k < 30; k++) {
    if (!(await sida.evaluate(() => document.querySelector('.kr-flyglager')?.childElementCount))) break
    await sida.waitForTimeout(100)
  }
}

async function oppnaSpel(webblasare, url, save) {
  const ctx = await webblasare.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  // Ingen backend här: alla API-anrop svarar direkt med ett fel och spelet
  // kör som utan nät.
  await ctx.route(/\/api\//, (r) => r.fulfill({ status: 503, body: '' }))
  await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('test-klar')) return
    sessionStorage.setItem('test-klar', '1')
    localStorage.setItem('rotspel_player', 'testhund')
    if (s) localStorage.setItem('krossen-v2', s)
    else localStorage.removeItem('krossen-v2')
  }, save ? JSON.stringify(save) : null)
  const sida = await ctx.newPage()
  const fel = []
  sida.on('pageerror', (e) => fel.push('Sidfel: ' + e.message))
  sida.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|status of 503|\/api\//.test(m.text())) fel.push('Konsolfel: ' + m.text())
  })
  await sida.goto(url + '#/rotspel/krossen')
  await sida.waitForSelector('.kr-bradet', { timeout: 20000 })
  await sida.waitForFunction(() => window.__krossen)
  return { ctx, sida, fel }
}

// Spelar slumpade drag och kör detektorn efter varje. Matar Happy och låter
// honom hoppa när han är mätt, och lägger ibland ut specialpjäser för att få
// fart på kedjor och kombinationer.
async function spela(sida, fro, antal) {
  const rnd = slump(fro)
  const fel = []
  await sida.waitForTimeout(2600) // startbannern
  // Gott om drag och ett extra mål som inte går att nå, så att banan inte tar
  // slut innan alla drag är spelade.
  await sida.evaluate(() => {
    const s = window.__krossen.s()
    s.drag = 99
    s.mal.push({ typ: 'poang', antal: 1e12 })
    window.__krossen.visa()
  })
  const { x0, y0, cell, w } = await sida.evaluate(() => {
    const b = document.querySelector('.kr-bradet').getBoundingClientRect()
    const s = window.__krossen.s()
    return { x0: b.left, y0: b.top, cell: b.width / s.w, w: s.w }
  })
  const pos = (i) => [x0 + ((i % w) + 0.5) * cell, y0 + (Math.floor(i / w) + 0.5) * cell]
  let spelade = 0
  let hopp = 0
  for (let k = 0; k < antal; k++) {
    const fas = await sida.evaluate(() => window.__krossen.fas())
    if (!['spel', 'start'].includes(fas)) {
      fel.push(`banan tog slut (${fas}) efter ${k} drag`)
      break
    }
    // Slumpade drag matar sällan Happy hela vägen, så var femte drag fylls
    // magen på riktigt för att hoppet ska testas.
    if (k % 5 === 4)
      await sida.evaluate((matt) => {
        const t = window.__krossen.s().tiles.find((x) => x && x.happy)
        if (t) {
          t.mage = matt
          window.__krossen.visa()
        }
      }, HAPPY_MATT)

    const happy = await sida.evaluate((matt) => {
      const s = window.__krossen.s()
      const i = s.tiles.findIndex((t) => t && t.happy && t.mage >= matt)
      if (i < 0) return null
      const mal = s.tiles.map((t, j) => (s.mask[j] && t && t.typ === 'bit' && !t.happy && !s.koppel[j] ? j : -1)).filter((j) => j >= 0)
      return { i, mal }
    }, HAPPY_MATT)

    const fore = await sida.evaluate(() => ({ drag: window.__krossen.s().drag, hopp: window.__krossen.s().samlat.hopp }))
    if (happy && happy.mal.length) {
      const till = happy.mal[Math.floor(rnd() * happy.mal.length)]
      await sida.mouse.click(...pos(happy.i))
      await sida.waitForTimeout(150)
      await sida.mouse.click(...pos(till))
      hopp++
    } else {
      if (k % 4 === 3) {
        await sida.evaluate((f) => {
          let a = f
          const r = () => ((a = (a * 1103515245 + 12345) % 2147483648) / 2147483648)
          const s = window.__krossen.s()
          const sorter = ['raket-h', 'raket-v', 'bomb', 'frisbee', 'skal']
          let n = 0
          s.tiles.forEach((t, i) => {
            if (t && t.typ === 'bit' && !t.special && !t.happy && !t.paket && !s.koppel[i] && n < 3 && r() < 0.06) {
              t.special = sorter[Math.floor(r() * sorter.length)]
              n++
            }
          })
          window.__krossen.visa()
        }, Math.floor(rnd() * 1e9))
        await sida.waitForTimeout(100)
      }
      const drag = await sida.evaluate(() => window.__krossen.drag())
      if (!drag.length) break
      // oftare drag intill ett koppel, det är där buggarna har gömt sig
      const koppel = await sida.evaluate(() => window.__krossen.s().koppel.map((x, i) => (x ? i : -1)).filter((i) => i >= 0))
      const nara = drag.filter(([a, b]) => koppel.some((c) => [1, w, 2, 2 * w].includes(Math.abs(a - c)) || [1, w].includes(Math.abs(b - c))))
      const urval = nara.length && rnd() < 0.7 ? nara : drag
      const [a, b] = urval[Math.floor(rnd() * urval.length)]
      const [ax, ay] = pos(a)
      const [bx, by] = pos(b)
      await sida.mouse.move(ax, ay)
      await sida.mouse.down()
      await sida.mouse.move(bx, by, { steps: 3 })
      await sida.mouse.up()
    }
    spelade++
    await sida.waitForTimeout(250)
    await vantaTillsLugnt(sida)
    await sida.waitForTimeout(120)
    // gick draget igenom? Ett byte kostar ett drag, ett hopp räknas.
    const efter = await sida.evaluate(() => ({ drag: window.__krossen.s().drag, hopp: window.__krossen.s().samlat.hopp }))
    if (happy && happy.mal.length ? efter.hopp === fore.hopp : efter.drag === fore.drag)
      fel.push(`drag ${k + 1}: ${happy ? 'Happy hoppade inte' : 'bytet gick inte igenom'}`)
    const nya = await sida.evaluate(detektor)
    if (nya.length) {
      fel.push(`drag ${k + 1}: ${nya.slice(0, 4).join('; ')}${nya.length > 4 ? ` (+${nya.length - 4} till)` : ''}`)
      // nollställ så att nästa fel inte bara är samma fel igen
      await sida.evaluate(() => document.querySelectorAll('.kr-lager .kr-bit, .kr-lager .kr-bit > *').forEach((n) => n.getAnimations().forEach((a) => a.cancel())))
    }
  }
  return { fel, spelade, hopp }
}

const forsta = (f) => BANOR.find(f)?.nr
const harKoppel = (b) => b.karta.some((rad) => rad.includes('k'))
const banor = [
  { namn: 'koppel', nr: forsta(harKoppel) },
  { namn: 'Happy', nr: forsta((b) => b.happy) },
  { namn: 'paket', nr: forsta((b) => b.paket) },
  { namn: 'koppel + Happy', nr: forsta((b) => b.happy && harKoppel(b)) },
  { namn: 'boss', nr: BANOR.length },
].filter((b, k, alla) => b.nr && alla.findIndex((x) => x.nr === b.nr) === k)
// KROSSEN_BANOR=101,135,176 provar de banorna i stället.
if (process.env.KROSSEN_BANOR) banor.splice(0, banor.length, ...process.env.KROSSEN_BANOR.split(',').map((nr) => ({ namn: 'vald', nr: Number(nr) })))

let server
let webblasare
let misslyckade = 0
const resultat = (ok, namn, text = '') => {
  if (!ok) misslyckade++
  console.log(`  ${ok ? 'ok' : 'FEL'} ${namn}${text ? ' — ' + text : ''}`)
}

try {
  process.chdir(FRONTEND) // Tailwind letar efter sin konfiguration härifrån
  server = await createServer({ root: FRONTEND, logLevel: 'silent', server: { port: 0, strictPort: false } })
  await server.listen()
  const url = server.resolvedUrls.local[0]
  webblasare = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})

  // 1. Första banan för en ny spelare: tipsrutan och sedan handen som visar draget.
  {
    const { ctx, sida, fel } = await oppnaSpel(webblasare, url, null)
    await sida.getByText('Okej!').click({ timeout: 8000 })
    const hand = await sida.waitForSelector('.kr-hand', { timeout: 6000 }).then(() => true, () => false)
    resultat(hand && !fel.length, 'bana 1 visar handen för en ny spelare', [hand ? '' : 'ingen hand', ...fel].filter(Boolean).join('; '))
    await ctx.close()
  }

  // 2. Slumpade drag med glitchdetektorn.
  for (const [k, b] of banor.entries()) {
    const save = { stjarnor: Object.fromEntries(BANOR.slice(0, b.nr - 1).map((x) => [x.nr, 2])), sett: ALLA_TIPS, mynt: 2000 }
    const { ctx, sida, fel } = await oppnaSpel(webblasare, url, save)
    const bana = await sida.locator('.kr-toppbana').innerText()
    const r = await spela(sida, 1000 + k, DRAG)
    const alla = [...fel, ...r.fel]
    resultat(
      !alla.length && r.spelade >= 3,
      `bana ${b.nr} (${b.namn}): ${r.spelade} drag${r.hopp ? `, ${r.hopp} hopp` : ''}`,
      [bana.includes(String(b.nr)) ? '' : `öppnade "${bana}"`, r.spelade < 3 ? 'för få drag' : '', ...alla].filter(Boolean).join('\n      ')
    )
    await ctx.close()
  }

  // 3. När alla banor är klara öppnar spelet oändliga promenaden.
  {
    const save = { stjarnor: Object.fromEntries(BANOR.map((x) => [x.nr, 3])), sett: ALLA_TIPS, mynt: 100, oandlig: 4 }
    const { ctx, sida, fel } = await oppnaSpel(webblasare, url, save)
    const topp = await sida.locator('.kr-toppbana').innerText()
    const r = await spela(sida, 99, Math.min(DRAG, 10))
    const alla = [...fel, ...r.fel]
    const ratt = /Promenad 5/.test(topp)
    resultat(ratt && !alla.length, `oändliga promenaden: ${r.spelade} drag`, [ratt ? '' : `öppnade "${topp}"`, ...alla].filter(Boolean).join('\n      '))
    await ctx.close()
  }
} catch (e) {
  misslyckade++
  console.error(e)
} finally {
  await webblasare?.close()
  await server?.close()
}

if (misslyckade) {
  console.log(`krossen i webbläsaren: ${misslyckade} fel`)
  process.exit(1)
}
console.log('krossen i webbläsaren: allt ser rätt ut')
