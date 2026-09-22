// Happys revir — spelets DOM-lager.
//
// mountRevir(root, options) bygger hela spelet inuti root och returnerar { destroy }.
// All logik för brädet och tipsen ligger i engine.js och hints.js (rena moduler).
// Här finns rendering, input, animationer, Happy-maskoten, årstider och resultatrutan.
//
// Alla timers, requestAnimationFrame och listeners spåras och städas i destroy(),
// så att inget lever kvar när man lämnar spelet i Rötspel.
//
// options:
//   images      { glad, ledsen, nojd }            bild-URL:er (krävs)
//   album       [{ src, text }]                    bilder som låses upp av Dagens revir
//   isMuted     () => boolean                      läses vid varje ljud
//   shake       () => boolean                      false stänger av brädskak vid fel
//   scores      adapter, se localScores() nedan    standard: localStorage
//   soundToggle boolean                            visa spelets egen ljudknapp (av när GameShell har reglaget)
//   theme       'auto' | 'light' | 'dark'          'auto' följer systemets mörka läge
//   seasonOverride  t.ex. 'vinter-natt'            för att testa årstider
//   onRoundEnd  ({ won, ms, mode, variant }) => void

import { generate, hashStr, mulberry32, shuffle } from './engine.js'
import { findHint } from './hints.js'
import { COLORS, MODES, NAMES, PENALTY_MS, HINT_COST_MS, IDLE_MS } from './config.js'
import { SEASONS, TOD_GREET, currentSeason, currentTod, seasonSvg } from './seasons.js'
import { createAudio } from './audio.js'

const PAWPATH = '<ellipse cx="12" cy="16" rx="5.2" ry="4.4"/><circle cx="5.5" cy="10" r="2.2"/><circle cx="9.5" cy="6" r="2.2"/><circle cx="14.5" cy="6" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/>'
const XSVG = '<svg class="x" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
const PAW = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="var(--tongue)" stroke="var(--wall)" stroke-width="1.2">${PAWPATH}</g></svg>`
const SVGNS = 'http://www.w3.org/2000/svg'

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* privat läge */ } },
}

// Topplistan bakom ett litet gränssnitt, så att Rötspel kan koppla in backend.
// Poängen är tid i millisekunder, lägre är bättre. En rad per spelare (bästa tiden).
//   playerName()                 -> string | null
//   setPlayerName(name)
//   submit({ variant, ms, name }) -> Promise
//   top({ variant, limit })       -> Promise<[{ name, ms }]>, sorterad snabbast först
export function localScores() {
  return {
    playerName: () => store.get('revir:name', '') || null,
    setPlayerName: (n) => store.set('revir:name', n),
    async submit({ variant, ms, name }) {
      const k = 'revir:lb:' + variant
      const list = store.get(k, []).filter((e) => e.name !== name || e.ms <= ms)
      if (!list.some((e) => e.name === name)) list.push({ name, ms })
      list.sort((a, b) => a.ms - b.ms)
      store.set(k, list.slice(0, 50))
    },
    async top({ variant, limit = 10 }) { return store.get('revir:lb:' + variant, []).slice(0, limit) },
  }
}

export function mountRevir(root, options = {}) {
  const o = {
    album: null, isMuted: () => false, shake: () => true, scores: localScores(), soundToggle: true,
    theme: 'auto', seasonOverride: '', onRoundEnd: null, ...options,
  }
  const IMG = o.images
  const ALBUM = o.album && o.album.length ? o.album : [
    { src: IMG.glad, text: 'Vårsol och påskliljor' },
    { src: IMG.nojd, text: 'Toarullens beskyddare' },
    { src: IMG.ledsen, text: 'Den där blicken' },
  ]

  /* ---------- livscykel: allt som ska städas ---------- */
  const timers = new Set(), rafs = new Set(), offs = []
  let dead = false
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn() }, ms); timers.add(id); return id }
  const cancel = (id) => { clearTimeout(id); timers.delete(id) }
  const every = (fn, ms) => { const id = setInterval(() => { if (!dead) fn() }, ms); timers.add(-id); return id }
  const stopEvery = (id) => { clearInterval(id); timers.delete(-id) }
  const frame = (fn) => { const id = requestAnimationFrame((t) => { rafs.delete(id); if (!dead) fn(t) }); rafs.add(id); return id }
  const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); offs.push(() => t.removeEventListener(ev, fn, opt)) }

  /* ---------- årstid ---------- */
  const SEASON = currentSeason(new Date(), o.seasonOverride)
  const TOD = currentTod(new Date(), o.seasonOverride)
  const IDLE = TOD === 'kvall' || TOD === 'natt' ? IDLE_MS.evening : IDLE_MS.day

  /* ---------- markup ---------- */
  root.classList.add('rv-root')
  root.dataset.tod = TOD
  root.dataset.theme = o.theme
  root.innerHTML = `
  <canvas class="rv-amb" data-el="amb" aria-hidden="true"></canvas>
  <div class="rv-wrap">
    <header>
      <div class="mascot" data-el="mascot">
        <img src="${IMG.glad}" alt="Happy" data-el="mascotImg">
        <span class="zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>
      </div>
      <div>
        <h1>Happys revir</h1>
        <p class="sub" data-el="sub" aria-live="polite"></p>
      </div>
    </header>
    <div class="modes" role="group" aria-label="Spelläge">
      ${Object.entries(MODES).map(([k, m]) => `<button type="button" data-mode="${k}">${m.label}</button>`).join('')}
      <button type="button" class="cozy" data-el="cozyBtn" aria-pressed="false">Mysläge</button>
    </div>
    <div class="status">
      <div class="lives" data-el="lives"></div>
      <div class="progress" data-el="progress"></div>
      <div class="timer" data-el="timer">0:00</div>
    </div>
    <div class="boardbox" data-el="boardbox">
      <div class="board" data-el="board" role="grid"></div>
      <svg class="walls" data-el="walls" preserveAspectRatio="none"></svg>
      <svg class="hintsvg" data-el="hintsvg" preserveAspectRatio="none"></svg>
      <div class="nameslayer" data-el="nameslayer"></div>
      <div class="fxlayer" data-el="fxlayer"></div>
    </div>
    <div class="hintbar" data-el="hintbar" hidden>
      <p data-el="hinttext"></p>
      <button type="button" class="btn" data-el="hintOk">Okej</button>
    </div>
    <p class="help" data-el="help"></p>
    <div class="actions">
      <button type="button" class="btn" data-el="newBtn">Nytt bräde</button>
      <button type="button" class="btn" data-el="undoBtn" disabled>Ångra</button>
      <button type="button" class="btn" data-el="hintBtn">Tips</button>
      <button type="button" class="btn" data-el="soundBtn" aria-pressed="true">Ljud på</button>
      <label class="toggle"><input type="checkbox" data-el="autoX" checked> Autokryss</label>
    </div>
    <section class="panel" data-el="lbSection">
      <h2>Topplistan</h2>
      <p data-el="lbSub"></p>
      <ol class="list" data-el="lbList"></ol>
    </section>
    <section class="panel">
      <h2>Happys album</h2>
      <p data-el="albumSub"></p>
      <div class="albumgrid" data-el="albumGrid"></div>
    </section>
    <details>
      <summary>Regler</summary>
      <p>Varje färgat område är ett revir. Placera exakt en Happy i varje revir, varje rad och varje kolumn. Två Happy får inte stå i rutor som nuddar varandra, inte ens snett. Längre bort på samma diagonal går bra. Varje bräde har bara en lösning, så du behöver aldrig gissa.</p>
      <p>Du har tre liv. En Happy på fel ruta kostar ett liv och lägger till 15 sekunder på tiden. Tips visar nästa logiska steg och förklarar varför, och kostar 20 sekunder.</p>
      <p>I Mysläget finns inga liv, ingen klocka och ingen topplista. Dagens revir är alltid tävlingsläget, och varje dagligt pussel du klarar låser upp en ny bild i Happys album.</p>
    </details>
  </div>
  <div class="overlay" data-el="overlay" role="dialog" aria-modal="true">
    <div class="card" data-el="card"></div>
  </div>
  <canvas class="rv-fx" data-el="fx" aria-hidden="true"></canvas>`
  const el = {}
  root.querySelectorAll('[data-el]').forEach((n) => (el[n.dataset.el] = n))
  el.soundBtn.hidden = !o.soundToggle

  /* ---------- tillstånd ---------- */
  let S = null
  let mode = store.get('revir:mode', 'daily')
  if (!MODES[mode]) mode = 'daily'
  let cozyPref = store.get('revir:cozy', false)
  let soundOn = store.get('revir:sound', true)
  let timerId = null
  const cozy = () => cozyPref && mode !== 'daily'
  const isMuted = () => o.isMuted() || (o.soundToggle && !soundOn)
  const sfx = createAudio(isMuted)

  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
  const variant = () => (mode === 'daily' ? 'daily-' + todayStr() : mode)
  const elapsed = () => (S.t0 ? (S.done ? S.endT : Date.now()) - S.t0 + S.penalty : S.penalty)
  const fmt = (ms) => { const s = Math.floor(ms / 1000), m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0') }
  const fmtLong = (ms) => { const s = ms / 1000, m = Math.floor(s / 60); return m + ':' + (s % 60).toFixed(1).padStart(4, '0') }
  const isSolution = (i) => S.solution[(i / S.n) | 0] === i % S.n

  function newGame(sameBoard) {
    const n = MODES[mode].n
    let puzzle
    if (sameBoard && S) puzzle = { n: S.n, regions: S.regions, solution: S.solution, seed: S.seed }
    else {
      const seed = mode === 'daily' ? hashStr('happy-revir-' + todayStr()) : (Math.random() * 4294967296) >>> 0
      puzzle = generate(n, seed)
    }
    const names = shuffle([...NAMES], mulberry32(puzzle.seed ^ 0x9e3779b9)).slice(0, n)
    names[(puzzle.seed >>> 3) % n] = SEASONS[SEASON].extra // ett revir per bräde får ett årstidsnamn
    if (stopWalk) stopWalk()
    el.fxlayer.innerHTML = ''
    el.board.classList.remove('finished')
    // cells: 0 tom, 1 kryss, 2 autokryss, 3 Happy
    S = { ...puzzle, names, cells: new Array(n * n).fill(0), hearts: 3, t0: 0, endT: 0, penalty: 0, done: false, combo: 0, dogs: 0,
      lastDog: null, lastTap: null, claimed: new Set(), undo: [], stroke: null, xSinceDog: 0, curiousShown: false }
    clearHint(); hideOverlay(); setFace('glad'); wake(true)
    render(true); updateStatus(); renderLeaderboard(); renderAlbum()
    if (timerId) stopEvery(timerId)
    timerId = every(tick, 100); tick()
  }
  function tick() {
    el.timer.textContent = fmt(elapsed())
    if (!S.done && !sleeping && Date.now() - lastActivity > IDLE) sleep()
  }
  const start = () => { if (!S.t0) S.t0 = Date.now() }

  /* ---------- Happy (maskoten) ---------- */
  let lastActivity = Date.now(), sleeping = false, talkTimer = null, faceTimer = null
  const defaultSub = () => (cozy() ? 'Mysläge. Inga liv, ingen klocka.' : 'En Happy per revir, rad och kolumn.')
  function say(text, ms = 2400) {
    el.sub.textContent = text; el.sub.classList.add('talk')
    if (talkTimer) cancel(talkTimer)
    talkTimer = later(() => { el.sub.textContent = defaultSub(); el.sub.classList.remove('talk') }, ms)
  }
  function setFace(f, ms) {
    el.mascotImg.src = IMG[f]
    if (faceTimer) cancel(faceTimer)
    if (ms) faceTimer = later(() => { if (!S.done) el.mascotImg.src = IMG.glad }, ms)
  }
  function hopMascot() { const m = el.mascot; m.classList.remove('hop', 'curious'); void m.offsetWidth; m.classList.add('hop') }
  function sleep() { sleeping = true; el.mascot.classList.add('sleep'); el.mascot.classList.remove('curious') }
  function wake(silent) {
    const was = sleeping; sleeping = false; lastActivity = Date.now(); el.mascot.classList.remove('sleep')
    if (was && !silent) { hopMascot(); say(pick(['Jag sov inte!', 'Va? Är det min tur nu?', 'Mmh… revir?', 'Jag vilade bara ögonen.'])) }
  }
  function activity() { lastActivity = Date.now(); if (sleeping) wake() }
  function curious() {
    S.curiousShown = true; el.mascot.classList.add('curious')
    say(pick(['Hmm, var ska jag bo?', 'Så många kryss…', 'Jag nosar runt lite.', 'Något revir måste väl vara ledigt?']), 2800)
    later(() => el.mascot.classList.remove('curious'), 2800)
  }

  /* ---------- rendering ---------- */
  function render(full) {
    const n = S.n
    if (full) {
      el.board.style.gridTemplateColumns = `repeat(${n},1fr)`
      el.board.style.gridTemplateRows = `repeat(${n},1fr)`
      el.board.innerHTML = ''
      for (let i = 0; i < n * n; i++) {
        const c = document.createElement('div')
        c.className = 'cell'; c.dataset.i = i; c.tabIndex = i === 0 ? 0 : -1; c.setAttribute('role', 'gridcell')
        c.style.backgroundColor = COLORS[S.regions[i] % COLORS.length]
        el.board.appendChild(c)
      }
      drawWalls()
    }
    for (let i = 0; i < n * n; i++) paintCell(i)
  }
  function paintCell(i, anim) {
    const c = el.board.children[i], v = S.cells[i], y = ((i / S.n) | 0) + 1, x = (i % S.n) + 1, nm = S.names[S.regions[i]]
    c.classList.toggle('auto', v === 2)
    c.classList.toggle('claimed', S.claimed.has(S.regions[i]))
    if (v >= 3) { c.innerHTML = `<img src="${IMG.glad}" alt="" class="${anim ? 'pop' : ''}">`; c.setAttribute('aria-label', `${nm}, rad ${y}, kolumn ${x}: Happy`) }
    else if (v === 1 || v === 2) { c.innerHTML = XSVG; c.setAttribute('aria-label', `${nm}, rad ${y}, kolumn ${x}: kryss`) }
    else { c.innerHTML = ''; c.setAttribute('aria-label', `${nm}, rad ${y}, kolumn ${x}: tom`) }
  }
  function regionPath(rg) {
    const n = S.n, g = S.regions
    let d = ''
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const j = y * n + x
      if (g[j] !== rg) continue
      if (y === 0 || g[j - n] !== rg) d += `M${x} ${y}H${x + 1}`
      if (y === n - 1 || g[j + n] !== rg) d += `M${x} ${y + 1}H${x + 1}`
      if (x === 0 || g[j - 1] !== rg) d += `M${x} ${y}V${y + 1}`
      if (x === n - 1 || g[j + 1] !== rg) d += `M${x + 1} ${y}V${y + 1}`
    }
    return d
  }
  function drawWalls() {
    const n = S.n, g = S.regions
    el.walls.setAttribute('viewBox', `0 0 ${n} ${n}`)
    el.hintsvg.setAttribute('viewBox', `0 0 ${n} ${n}`)
    let thin = '', thick = ''
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x
      if (x < n - 1) { const seg = `M${x + 1} ${y}V${y + 1}`; g[i] !== g[i + 1] ? (thick += seg) : (thin += seg) }
      if (y < n - 1) { const seg = `M${x} ${y + 1}H${x + 1}`; g[i] !== g[i + n] ? (thick += seg) : (thin += seg) }
    }
    el.walls.innerHTML = `<path d="${thin}" stroke="rgba(31,46,27,.18)" stroke-width="0.025" fill="none"/><path d="${thick}" stroke="var(--wall)" stroke-width="0.09" stroke-linecap="square" fill="none"/>`
  }
  function updateStatus() {
    el.lives.innerHTML = ''
    for (let i = 0; i < 3; i++) { el.lives.insertAdjacentHTML('beforeend', PAW); if (i >= S.hearts) el.lives.lastChild.classList.add('lost') }
    el.lives.setAttribute('aria-label', `${S.hearts} liv kvar`)
    el.lives.style.visibility = cozy() ? 'hidden' : ''
    el.timer.style.visibility = cozy() ? 'hidden' : ''
    el.progress.textContent = `${S.dogs} av ${S.n} revir`
    root.querySelectorAll('.modes button[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === mode))
    el.cozyBtn.setAttribute('aria-pressed', cozy())
    el.cozyBtn.setAttribute('aria-disabled', mode === 'daily')
    el.cozyBtn.title = mode === 'daily' ? 'Dagens revir är alltid tävlingsläget' : ''
    el.newBtn.hidden = mode === 'daily'
    el.hintBtn.textContent = cozy() ? 'Tips' : 'Tips (+20 s)'
    el.undoBtn.disabled = !S.undo.length || S.done
    el.soundBtn.textContent = soundOn ? 'Ljud på' : 'Ljud av'
    el.soundBtn.setAttribute('aria-pressed', soundOn)
    el.lbSection.hidden = cozy()
    el.help.textContent = 'Tryck för kryss, dubbeltryck för Happy. Dra för att kryssa flera rutor.' +
      (cozy() ? ' Fel Happy kostar ingenting här.' : ' Fel Happy kostar ett liv och 15 sekunder.')
    if (!el.sub.classList.contains('talk')) el.sub.textContent = defaultSub()
  }
  function floatText(i, text, cls) {
    const n = S.n, f = document.createElement('div')
    f.className = 'float' + (cls ? ' ' + cls : ''); f.textContent = text
    f.style.left = Math.min(84, Math.max(16, (((i % n) + 0.5) / n) * 100)) + '%'
    f.style.top = ((((i / n) | 0) + 0.1) / n) * 100 + '%'
    el.boardbox.appendChild(f); later(() => f.remove(), 1000)
  }

  /* ---------- regler ---------- */
  function recomputeAuto() {
    const n = S.n
    for (let i = 0; i < n * n; i++) if (S.cells[i] === 2) S.cells[i] = 0
    if (!el.autoX.checked) return
    for (let i = 0; i < n * n; i++) {
      if (S.cells[i] < 3) continue
      const y = (i / n) | 0, x = i % n, rg = S.regions[i]
      for (let j = 0; j < n * n; j++) {
        if (S.cells[j] !== 0) continue
        const yy = (j / n) | 0, xx = j % n
        if (yy === y || xx === x || S.regions[j] === rg || (Math.abs(yy - y) <= 1 && Math.abs(xx - x) <= 1)) S.cells[j] = 2
      }
    }
  }
  function placeDog(i) {
    S.cells[i] = 3; S.dogs++; S.lastDog = i; S.claimed.add(S.regions[i]); S.xSinceDog = 0; S.curiousShown = false
    recomputeAuto(); clearHint()
    const n = S.n, y = (i / n) | 0, x = i % n, rg = S.regions[i], cells = el.board.children, nm = S.names[rg]
    for (let j = 0; j < n * n; j++) {
      if (S.regions[j] !== rg) continue
      const d = Math.hypot(((j / n) | 0) - y, (j % n) - x), c = cells[j]
      c.classList.remove('glow'); void c.offsetWidth; c.style.animationDelay = Math.round(d * 55) + 'ms'; c.classList.add('glow')
    }
    for (let j = 0; j < n * n; j++) paintCell(j, j === i)
    claimFx(i); floatText(i, nm + '!', 'name')
    try { navigator.vibrate && navigator.vibrate([18, 40, 18]) } catch { /* ingen vibration */ }
    S.combo++; sfx.good(S.combo - 1); hopMascot()
    say(S.combo >= 3 ? `${S.combo} i rad! ${nm} är mitt!` : pick([`${nm} är mitt!`, `Nu är ${nm} mitt revir.`, `${nm}, check!`, `Här bor jag nu: ${nm}.`]))
    updateStatus()
    if (S.dogs === n) win()
  }
  function claimFx(i) {
    if (reduced()) return
    const n = S.n, layer = el.fxlayer, cx = (((i % n) + 0.5) / n) * 100, cy = ((((i / n) | 0) + 0.5) / n) * 100, cellPct = 100 / n
    const rg = S.regions[i], col = COLORS[rg % COLORS.length], cellPx = el.boardbox.clientWidth / n
    const ring = document.createElement('div')
    ring.className = 'rv-ring'; ring.style.left = cx + '%'; ring.style.top = cy + '%'; ring.style.width = ring.style.height = cellPct + '%'
    layer.appendChild(ring); later(() => ring.remove(), 800)
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * Math.PI * 2 + Math.random() * 0.5, dist = cellPx * (1.1 + Math.random() * 1.3)
      const sp = document.createElement('div'), sz = cellPx * (0.42 + Math.random() * 0.22)
      sp.className = 'spark'
      sp.style.cssText = `left:${cx}%;top:${cy}%;width:${sz}px;height:${sz}px;--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist}px;--rot:${(Math.random() - 0.5) * 120}deg;animation-delay:${Math.random() * 60}ms`
      sp.innerHTML = `<svg viewBox="0 0 24 24"><g fill="${col}" stroke="#1F2E1B" stroke-width="1.4">${PAWPATH}</g></svg>`
      layer.appendChild(sp); later(() => sp.remove(), 1000)
    }
    const se = SEASONS[SEASON]
    for (let k = 0; k < 7; k++) {
      const s = document.createElement('div'), sz = cellPx * (0.38 + Math.random() * 0.25)
      s.className = 'season'
      s.style.cssText = `left:${cx + (Math.random() - 0.5) * cellPct * 2}%;top:${cy - cellPct * 0.4}%;width:${sz}px;height:${sz}px;--dx:${(Math.random() - 0.5) * cellPx * 2.4}px;--dy:${cellPx * (1.2 + Math.random() * 1.6)}px;--rot:${(Math.random() - 0.5) * 540}deg;animation-delay:${80 + Math.random() * 250}ms`
      s.innerHTML = seasonSvg(se.shape, pick(se.colors))
      layer.appendChild(s); later(() => s.remove(), 2000)
    }
    const path = document.createElementNS(SVGNS, 'path')
    path.setAttribute('d', regionPath(rg)); path.setAttribute('stroke', '#fff'); path.setAttribute('stroke-width', '0.11')
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('fill', 'none'); path.setAttribute('class', 'rv-outline')
    el.walls.appendChild(path); later(() => path.remove(), 1050)
  }
  function attemptDog(i) {
    if (S.done || S.cells[i] >= 3) return
    start(); clearHint()
    if (isSolution(i)) { placeDog(i); return }
    S.combo = 0
    el.board.children[i].innerHTML = `<img src="${IMG.ledsen}" alt="" class="sad">`
    if (o.shake()) { const b = el.boardbox; b.classList.remove('hurt'); void b.offsetWidth; b.classList.add('hurt') }
    setFace('ledsen', 1400)
    later(() => { if (S.cells[i] < 3) { S.cells[i] = 1; paintCell(i) } }, 750)
    if (cozy()) { sfx.soft(); say(pick(['Nej, inte där!', 'Hmm, där trivs jag inte.', 'Fel ställe, men ingen fara.'])); return }
    S.hearts--; S.penalty += PENALTY_MS; sfx.bad(); floatText(i, '+15 s')
    say(S.hearts > 0 ? pick(['Aj! Inte där.', 'Där bor redan någon annan…']) : 'Mitt revir…')
    updateStatus()
    if (S.hearts <= 0) lose()
  }
  // Kryss: val=true sätter, false suddar. Ändringarna samlas i S.stroke så att Ångra tar ett helt drag.
  function setMark(i, val) {
    if (S.done || S.cells[i] >= 3) return false
    const was = S.cells[i]
    if (val && was !== 0) return false
    if (!val && was === 0) return false
    S.cells[i] = val ? 1 : 0; paintCell(i); start()
    if (S.stroke) S.stroke.push({ i, prev: was })
    if (val) { S.xSinceDog++; if (S.xSinceDog >= 8 && !S.curiousShown) curious() }
    return true
  }
  function commitStroke() {
    if (S.stroke && S.stroke.length) { S.undo.push(S.stroke); if (S.undo.length > 200) S.undo.shift() }
    S.stroke = null; updateStatus()
  }
  function undo() {
    if (S.done) return
    const a = S.undo.pop()
    if (!a) return
    clearHint()
    for (let k = a.length - 1; k >= 0; k--) { const { i, prev } = a[k]; if (S.cells[i] <= 2) S.cells[i] = prev }
    recomputeAuto(); render(false); sfx.undo(); updateStatus()
  }

  /* ---------- tips ---------- */
  function showHint() {
    if (S.done) return
    activity(); start(); clearHint()
    const h = findHint(S)
    if (!h) return
    if (!cozy()) { S.penalty += HINT_COST_MS; S.combo = 0; floatText(h.place ?? (h.cross ? h.cross[0] : h.unmark[0]), '+20 s') }
    if (h.unmark) h.unmark.forEach((i) => { S.cells[i] = 0; paintCell(i) })
    if (h.cross) { S.stroke = []; h.cross.forEach((i) => setMark(i, true)); S.xSinceDog = 0; commitStroke() }
    const n = S.n
    let g = ''
    for (const u of h.units) {
      const d = u.type === 'region' ? regionPath(u.idx) : u.type === 'row' ? `M0 ${u.idx}H${n}V${u.idx + 1}H0Z` : `M${u.idx} 0V${n}H${u.idx + 1}V0Z`
      g += `<path d="${d}" class="hint-unit" fill="none" stroke="var(--tongue)" stroke-width="0.1" stroke-dasharray="0.4 0.2" stroke-linecap="round"/>`
    }
    const cells = [...(h.cross || []), ...(h.unmark || [])]
    cells.forEach((i) => { g += `<rect class="hint-cell" x="${(i % n) + 0.12}" y="${((i / n) | 0) + 0.12}" width=".76" height=".76" rx=".15" fill="var(--tongue)" fill-opacity=".35"/>` })
    if (h.place != null) g += `<circle class="hint-cell" cx="${(h.place % n) + 0.5}" cy="${((h.place / n) | 0) + 0.5}" r=".4" fill="none" stroke="var(--tongue)" stroke-width="0.1"/>`
    el.hintsvg.innerHTML = g
    const hot = new Set(h.units.filter((u) => u.type === 'region').map((u) => u.idx))
    showNames(hot, new Set([...cells, ...(h.place != null ? [h.place] : [])]))
    let html = esc(h.text)
    hot.forEach((rg) => { const nm = esc(S.names[rg]); html = html.split(nm).join(`<b>${nm}</b>`) })
    el.hinttext.innerHTML = html
    el.hintbar.hidden = false
    sfx.hint(); updateStatus()
  }
  function clearHint() { el.hintsvg.innerHTML = ''; el.nameslayer.innerHTML = ''; el.hintbar.hidden = true }
  // Namnetiketter för de revir tipset pratar om
  function showNames(hot, avoid) {
    const n = S.n, layer = el.nameslayer, W = el.boardbox.clientWidth, cellPx = W / n, fs = Math.max(10, Math.min(15, cellPx * 0.3))
    layer.innerHTML = ''
    for (const rg of hot) {
      const cells = [...Array(n * n).keys()].filter((i) => S.regions[i] === rg)
      let best = cells[0], bestScore = Infinity
      for (const c of cells) {
        let d = 0
        for (const q of cells) d += Math.abs(((c / n) | 0) - ((q / n) | 0)) + Math.abs((c % n) - (q % n))
        if (avoid.has(c)) d += cells.length * 2
        if (d < bestScore) { bestScore = d; best = c }
      }
      const e = document.createElement('div')
      e.className = 'rname'; e.textContent = S.names[rg]; e.style.fontSize = fs + 'px'
      let cy = (((best / n) | 0) + 0.5) * cellPx
      if (avoid.has(best)) cy += ((best / n) | 0) > 0 ? -cellPx * 0.62 : cellPx * 0.62
      e._x = ((best % n) + 0.5) * cellPx; e._y = cy
      layer.appendChild(e)
    }
    const placed = []
    for (const e of layer.children) {
      const w = e.offsetWidth, h = e.offsetHeight
      const x = Math.min(W - w / 2 - 3, Math.max(w / 2 + 3, e._x))
      let y = e._y
      const hit = (yy) => placed.some((r) => Math.abs(r.x - x) < (r.w + w) / 2 + 2 && Math.abs(r.y - yy) < (r.h + h) / 2 + 1)
      if (hit(y)) for (let k = 1; k < 6; k++) {
        if (!hit(y + k * (h + 2)) && y + k * (h + 2) < W - h / 2) { y += k * (h + 2); break }
        if (!hit(y - k * (h + 2)) && y - k * (h + 2) > h / 2) { y -= k * (h + 2); break }
      }
      y = Math.min(W - h / 2 - 3, Math.max(h / 2 + 3, y))
      e.style.left = x + 'px'; e.style.top = y + 'px'; placed.push({ x, y, w, h })
    }
  }

  /* ---------- input ---------- */
  let drag = null
  const cellFrom = (e) => { const t = document.elementFromPoint(e.clientX, e.clientY); return t && t.closest ? t.closest('.cell') : null }
  const popSingleTapUndo = (i) => { const top = S.undo[S.undo.length - 1]; if (top && top.length === 1 && top[0].i === i) S.undo.pop() }
  on(el.board, 'pointerdown', (e) => {
    const c = e.target.closest('.cell')
    if (!c || S.done) return
    e.preventDefault(); activity()
    const i = +c.dataset.i, now = performance.now(), lt = S.lastTap
    if (lt && lt.i === i && now - lt.t < 330 && !lt.dragged) { // dubbeltryck -> Happy
      popSingleTapUndo(i); S.cells[i] = lt.prev; paintCell(i); S.lastTap = null; attemptDog(i); updateStatus(); return
    }
    const prev = S.cells[i]
    if (prev >= 3) { S.lastTap = null; return }
    clearHint()
    const mark = prev === 0
    S.stroke = []
    if (setMark(i, mark)) sfx.x()
    drag = { mark, last: i }
    S.lastTap = { i, t: now, prev, dragged: false }
  })
  on(window, 'pointermove', (e) => {
    if (!drag) return
    const c = cellFrom(e)
    if (!c || !el.board.contains(c)) return
    const i = +c.dataset.i
    if (i === drag.last) return
    drag.last = i
    if (S.lastTap) S.lastTap.dragged = true
    if (setMark(i, drag.mark)) sfx.x()
  })
  on(window, 'pointerup', () => { if (drag) { drag = null; commitStroke() } })
  on(el.board, 'contextmenu', (e) => {
    const c = e.target.closest('.cell')
    if (!c) return
    e.preventDefault(); activity()
    const i = +c.dataset.i, lt = S.lastTap
    if (lt && lt.i === i) { popSingleTapUndo(i); S.cells[i] = lt.prev; paintCell(i) }
    S.lastTap = null; attemptDog(i); updateStatus()
  })
  on(el.board, 'keydown', (e) => {
    const c = e.target.closest('.cell')
    if (!c) return
    activity()
    const i = +c.dataset.i, n = S.n
    let j = i
    if (e.key === 'ArrowRight' && i % n < n - 1) j = i + 1
    else if (e.key === 'ArrowLeft' && i % n > 0) j = i - 1
    else if (e.key === 'ArrowDown' && i + n < n * n) j = i + n
    else if (e.key === 'ArrowUp' && i - n >= 0) j = i - n
    else if (e.key === ' ' || e.key === 'x') {
      e.preventDefault()
      if (S.cells[i] < 3) { clearHint(); S.stroke = []; if (setMark(i, S.cells[i] === 0) || setMark(i, false)) sfx.x(); commitStroke() }
      return
    } else if (e.key === 'Enter' || e.key === 'h') { e.preventDefault(); attemptDog(i); return }
    else return
    e.preventDefault(); c.tabIndex = -1
    const t = el.board.children[j]; t.tabIndex = 0; t.focus()
  })
  // Ctrl/Cmd+Z och Escape gäller bara när spelet syns på skärmen
  on(document, 'keydown', (e) => {
    if (!root.isConnected || root.offsetParent === null) return
    activity()
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo() }
    if (e.key === 'Escape') hideOverlay()
  })

  /* ---------- knappar ---------- */
  root.querySelectorAll('.modes button[data-mode]').forEach((b) => on(b, 'click', () => { mode = b.dataset.mode; store.set('revir:mode', mode); newGame() }))
  on(el.cozyBtn, 'click', () => {
    if (mode === 'daily') { mode = 'normal'; store.set('revir:mode', mode); cozyPref = true } else cozyPref = !cozyPref
    store.set('revir:cozy', cozyPref); newGame()
    if (cozy()) say('Mysläge på. Ta den tid du behöver.', 2600)
  })
  on(el.newBtn, 'click', () => newGame())
  on(el.hintBtn, 'click', showHint)
  on(el.hintOk, 'click', clearHint)
  on(el.undoBtn, 'click', () => { activity(); undo() })
  on(el.soundBtn, 'click', () => { soundOn = !soundOn; store.set('revir:sound', soundOn); updateStatus() })
  el.autoX.checked = store.get('revir:autox', true)
  on(el.autoX, 'change', () => { store.set('revir:autox', el.autoX.checked); recomputeAuto(); render(false) })
  on(el.overlay, 'click', (e) => { if (e.target === el.overlay && !(S.done && S.hearts <= 0)) hideOverlay() })

  /* ---------- topplista ---------- */
  let lbToken = 0
  async function renderLeaderboard(highlightName) {
    const token = ++lbToken, v = variant()
    el.lbSub.textContent = mode === 'daily' ? `Dagens revir, ${todayStr()}. Samma bräde för alla i dag.` : `${MODES[mode].label}. Nytt bräde varje runda.`
    let list = []
    try { list = await o.scores.top({ variant: v, limit: 10 }) } catch { list = null }
    if (dead || token !== lbToken) return
    const ol = el.lbList
    ol.innerHTML = ''
    if (list === null) { ol.innerHTML = '<li class="empty">Topplistan gick inte att hämta just nu.</li>'; return }
    if (!list.length) { ol.innerHTML = '<li class="empty">Ingen tid än. Bli först.</li>'; return }
    const me = highlightName || o.scores.playerName()
    list.slice(0, 10).forEach((e, k) => {
      const li = document.createElement('li')
      if (me && e.name === me) li.className = 'me'
      li.innerHTML = `<span class="r">${k + 1}</span><span class="n">${esc(e.name)}</span><span class="t">${fmtLong(e.ms)}</span>`
      ol.appendChild(li)
    })
  }

  /* ---------- album ---------- */
  const dailyWins = () => store.get('revir:dailyWins', [])
  function renderAlbum() {
    const open = Math.min(dailyWins().length, ALBUM.length), g = el.albumGrid
    el.albumSub.textContent = open >= ALBUM.length ? `Alla ${ALBUM.length} bilder upplåsta. Fler kommer!` : `${open} av ${ALBUM.length} bilder. Klara Dagens revir för att låsa upp nästa.`
    g.innerHTML = ''
    ALBUM.forEach((a, k) => {
      const b = document.createElement('button')
      b.type = 'button'
      if (k < open) {
        b.innerHTML = `<img src="${a.src}" alt=""><span>${esc(a.text)}</span>`
        b.setAttribute('aria-label', `Visa bild: ${a.text}`)
        on(b, 'click', () => showPhoto(k))
      } else {
        b.disabled = true
        b.innerHTML = `<div class="locked"><svg viewBox="0 0 24 24"><g fill="var(--muted)">${PAWPATH}</g></svg></div><span>Dag ${k + 1}</span>`
        b.setAttribute('aria-label', `Låst bild, dag ${k + 1}`)
      }
      g.appendChild(b)
    })
  }
  function showPhoto(k) {
    const a = ALBUM[k]
    showOverlay(`<img src="${a.src}" alt="${esc(a.text)}"><h3>${esc(a.text)}</h3><p class="detail">Bild ${k + 1} i Happys album</p><div class="row"><button type="button" class="btn" data-act="close">Stäng</button></div>`)
  }

  /* ---------- slut på rundan ---------- */
  function showOverlay(html, cls) {
    el.card.className = 'card ' + (cls || ''); el.card.innerHTML = html
    el.overlay.classList.add('show')
    el.card.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.act
      if (act === 'close') hideOverlay()
      if (act === 'again') newGame()
      if (act === 'retry') newGame(true)
    }))
    // spelet kan vara högre än skärmen, så se till att rutan syns
    frame(() => { try { el.card.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }) } catch { /* äldre webbläsare */ } })
  }
  // Stängs resultatrutan/albumbilden efter att sidan skrollat ner till den
  // (se showOverlay), skrolla tillbaka till brädet — annars blir man kvar
  // längre ner på sidan och måste skrolla upp för hand för att spela vidare.
  // wasShown-vakten hindrar att newGame() (som alltid anropar hideOverlay,
  // även vid första monteringen då ingen ruta någonsin visats) skrollar sidan.
  function hideOverlay() {
    const wasShown = el.overlay.classList.contains('show')
    el.overlay.classList.remove('show')
    if (wasShown) frame(() => { try { el.boardbox.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }) } catch { /* äldre webbläsare */ } })
  }

  function win() {
    wake(true)
    S.done = true; S.endT = Date.now(); tick(); stopEvery(timerId); timerId = null
    const ms = elapsed()
    setFace('nojd'); say('Hela reviret är mitt!', 4000)
    let unlocked = null
    if (mode === 'daily') {
      const w = dailyWins()
      if (!w.includes(todayStr())) { w.push(todayStr()); store.set('revir:dailyWins', w); if (w.length <= ALBUM.length) unlocked = ALBUM[w.length - 1] }
      renderAlbum()
    }
    if (o.onRoundEnd) try { o.onRoundEnd({ won: true, ms, mode, variant: variant(), cozy: cozy() }) } catch { /* callbackfel ska inte stoppa spelet */ }
    el.board.classList.add('finished') // revirens tassmönster tonar ut så att bara promenaden syns
    updateStatus()
    later(() => walkRound(() => winOverlay(ms, unlocked)), 650)
  }

  async function winOverlay(ms, unlocked) {
    sfx.win(); confetti()
    const unl = unlocked ? `<p class="unlock"><img src="${unlocked.src}" alt="">Ny bild i albumet: ${esc(unlocked.text)}</p>` : ''
    if (cozy()) {
      showOverlay(`<img src="${IMG.nojd}" alt="Nöjd Happy"><h3>Revir säkrat!</h3><p class="detail">Alla ${S.n} revir är Happys nu.</p>
        <div class="row"><button type="button" class="btn primary" data-act="again">Nytt bräde</button><button type="button" class="btn" data-act="close">Stäng</button></div>`, 'win')
      return
    }
    const v = variant()
    let before = []
    try { before = await o.scores.top({ variant: v, limit: 100 }) } catch { before = [] }
    if (dead) return
    const name = o.scores.playerName()
    const others = before.filter((e) => e.name !== name)
    const myOld = before.find((e) => e.name === name)
    const rank = others.filter((e) => e.ms < ms).length + 1
    const record = !before.length || ms < before[0].ms
    const personal = myOld && ms >= myOld.ms ? `Ditt rekord är ${fmtLong(myOld.ms)}` : null
    const again = mode === 'daily' ? '' : '<button type="button" class="btn" data-act="again">Nytt bräde</button>'
    showOverlay(`<img src="${IMG.nojd}" alt="Nöjd Happy">
      <h3>Revir säkrat!</h3>
      <div class="big">${fmtLong(ms)}</div>
      <p class="rank ${record ? 'record' : ''}">${record ? 'Nytt rekord!' : personal || `Plats ${rank} på topplistan`}</p>
      <p class="detail">${S.hearts} av 3 liv kvar${S.penalty ? `, ${Math.round(S.penalty / 1000)} s i straff` : ''}</p>
      ${unl}
      <div data-el2="save"></div>
      <div class="row">${again}<button type="button" class="btn" data-act="close">Stäng</button></div>`, 'win')
    const slot = el.card.querySelector('[data-el2="save"]')
    const save = async (nm) => {
      slot.innerHTML = '<p class="detail">Sparar…</p>'
      try {
        await o.scores.submit({ variant: v, ms, name: nm })
        if (dead) return
        slot.innerHTML = `<p class="detail">Sparad som ${esc(nm)}.</p>`
        renderLeaderboard(nm)
      } catch {
        if (dead) return
        slot.innerHTML = '<p class="detail">Tiden gick inte att spara just nu.</p><div class="row" style="margin-bottom:12px"><button type="button" class="btn" data-retry>Försök igen</button></div>'
        slot.querySelector('[data-retry]').addEventListener('click', () => save(nm))
      }
    }
    if (name) save(name)
    else {
      slot.innerHTML = `<form><input type="text" maxlength="16" placeholder="Ditt namn" aria-label="Ditt namn" required><button class="btn primary">Spara tid</button></form>`
      const form = slot.querySelector('form'), input = form.querySelector('input')
      form.addEventListener('submit', (ev) => {
        ev.preventDefault()
        const nm = input.value.trim().slice(0, 16)
        if (!nm) return
        o.scores.setPlayerName(nm); save(nm)
      })
      later(() => input.focus(), 300)
    }
  }

  function lose() {
    wake(true)
    S.done = true; S.endT = Date.now(); stopEvery(timerId); timerId = null
    sfx.lose(); setFace('ledsen'); updateStatus()
    if (o.onRoundEnd) try { o.onRoundEnd({ won: false, ms: elapsed(), mode, variant: variant(), cozy: cozy() }) } catch { /* ignorera */ }
    later(() => {
      const again = mode === 'daily' ? '' : '<button type="button" class="btn" data-act="again">Nytt bräde</button>'
      showOverlay(`<img src="${IMG.ledsen}" alt="Ledsen Happy">
        <h3>Happy förlorade reviret</h3>
        <p class="detail">Alla tre liv är slut. Samma bräde går att köra om direkt.</p>
        <div class="row"><button type="button" class="btn primary" data-act="retry">Försök igen</button>${again}</div>`)
      const r = el.card.querySelector('[data-act="retry"]'); if (r) r.focus()
    }, 650)
  }

  /* ---------- promenaden: Happy går ett varv mellan sina revir ---------- */
  let stopWalk = null
  function walkRound(done) {
    const n = S.n, dogs = []
    for (let i = 0; i < n * n; i++) if (S.cells[i] >= 3) dogs.push(i)
    const hop = (i, k) => {
      const im = el.board.children[i].querySelector('img')
      if (im) { im.classList.remove('pop', 'hop'); void im.offsetWidth; im.classList.add('hop') }
      sfx.tone(660 + k * 80, 0.12, 'sine', 0.08)
    }
    if (reduced()) { dogs.forEach(hop); later(done, 500); return }
    // närmaste-granne-varv som börjar vid sista placerade Happy
    const route = [S.lastDog ?? dogs[0]], left = new Set(dogs)
    left.delete(route[0])
    const P = (i) => ({ x: (i % n) + 0.5, y: ((i / n) | 0) + 0.5 })
    while (left.size) {
      const a = P(route[route.length - 1])
      let best = null, bd = 1e9
      for (const j of left) { const b = P(j), d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd) { bd = d; best = j } }
      route.push(best); left.delete(best)
    }
    const pts = route.map(P)
    let total = 0
    for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y)
    const msPerCell = Math.min(260, Math.max(90, 3000 / Math.max(1, total)))
    const box = el.boardbox, cellPx = box.clientWidth / n
    const svg = document.createElementNS(SVGNS, 'svg')
    svg.setAttribute('class', 'prints'); svg.setAttribute('viewBox', `0 0 ${n} ${n}`); el.fxlayer.appendChild(svg)
    const wk = document.createElement('div')
    wk.className = 'walker'; wk.style.width = wk.style.height = cellPx * 0.95 + 'px'; wk.innerHTML = `<img src="${IMG.glad}" alt="">`
    el.fxlayer.appendChild(wk)
    const printCol = getComputedStyle(root).getPropertyValue('--wall').trim() || '#1F2E1B'
    let seg = 0, segT0 = performance.now(), walked = 0, nextPrint = 0.2, side = 1, raf = 0, finished = false
    hop(route[0], 0)
    const detach = () => { cancelAnimationFrame(raf); rafs.delete(raf); box.removeEventListener('pointerdown', finish); document.removeEventListener('keydown', finish) }
    function finish() {
      if (finished) return
      finished = true; detach(); stopWalk = null
      try { wk.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }], { duration: 250, fill: 'forwards' }) } catch { /* ingen WAAPI */ }
      later(() => wk.remove(), 260)
      done()
    }
    stopWalk = () => { finished = true; detach(); stopWalk = null }
    box.addEventListener('pointerdown', finish); document.addEventListener('keydown', finish)
    const step = (now) => {
      if (finished) return
      if (seg >= pts.length - 1) { later(finish, 350); return }
      const a = pts[seg], b = pts[seg + 1], len = Math.hypot(b.x - a.x, b.y - a.y), t = Math.min(1, (now - segT0) / (len * msPerCell))
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, dist = walked + len * t, ang = Math.atan2(b.y - a.y, b.x - a.x)
      const bob = Math.abs(Math.sin(dist * Math.PI * 2.4)) * cellPx * 0.12
      wk.style.left = x * cellPx + 'px'; wk.style.top = y * cellPx - bob + 'px'
      wk.style.transform = `translate(-50%,-50%) scaleX(${b.x < a.x ? -1 : 1})`
      while (nextPrint < dist) {
        const pt = nextPrint - walked
        if (pt > len) break
        const px = a.x + Math.cos(ang) * pt - Math.sin(ang) * side * 0.13, py = a.y + Math.sin(ang) * pt + Math.cos(ang) * side * 0.13
        svg.insertAdjacentHTML('beforeend', `<g transform="translate(${px} ${py}) rotate(${(ang * 180) / Math.PI + 90}) scale(.012) translate(-12 -13)" fill="${printCol}" fill-opacity=".38">${PAWPATH}</g>`)
        side = -side; nextPrint += 0.36
      }
      if (t >= 1) { walked += len; seg++; segT0 = now; hop(route[seg], seg) }
      raf = frame(step)
    }
    raf = frame(step)
  }

  /* ---------- konfetti: tassar i revir- och årstidsfärger ---------- */
  function confetti() {
    if (reduced()) return
    const cv = el.fx, ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1
    const W = root.clientWidth, H = root.clientHeight
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const rr = root.getBoundingClientRect(), cr = el.card.getBoundingClientRect()
    const ox = cr.width ? cr.left - rr.left + cr.width / 2 : W / 2, oy = cr.height ? cr.top - rr.top + 40 : H * 0.45
    const P = [...Array(90)].map(() => ({ x: ox, y: oy, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: 4 + Math.random() * 5,
      c: Math.random() < 0.5 ? pick(SEASONS[SEASON].colors) : pick(COLORS), a: Math.random() * 6 }))
    let f = 0
    const step = () => {
      ctx.clearRect(0, 0, W, H)
      P.forEach((p) => {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.a += 0.1
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.strokeStyle = '#1F2E1B'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.ellipse(0, p.r * 0.4, p.r, p.r * 0.8, 0, 0, 7); ctx.fill(); ctx.stroke()
        for (const [dx, dy] of [[-0.9, -0.7], [-0.3, -1.2], [0.3, -1.2], [0.9, -0.7]]) { ctx.beginPath(); ctx.arc(dx * p.r, dy * p.r, p.r * 0.35, 0, 7); ctx.fill(); ctx.stroke() }
        ctx.restore()
      })
      if (++f < 130) frame(step); else ctx.clearRect(0, 0, W, H)
    }
    frame(step)
  }

  /* ---------- bakgrund: löv, snö, kronblad, pollen eller eldflugor ---------- */
  function ambient() {
    if (reduced()) return
    const cv = el.amb, ctx = cv.getContext('2d')
    let W = 0, H = 0
    const size = () => { const dpr = devicePixelRatio || 1; W = root.clientWidth; H = root.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    size()
    let ro = null
    try { ro = new ResizeObserver(size); ro.observe(root); offs.push(() => ro.disconnect()) } catch { on(window, 'resize', size) }
    const se = SEASONS[SEASON], night = TOD === 'natt' || TOD === 'kvall', fireflies = SEASON === 'sommar' && night
    const pollen = se.shape === 'flower' && !fireflies
    const count = se.shape === 'snow' ? 34 : fireflies ? 16 : 14
    const mk = (init) => ({ x: Math.random() * W, y: init ? Math.random() * H : pollen ? H + 20 : -20,
      r: se.shape === 'snow' ? 1.5 + Math.random() * 2.5 : 5 + Math.random() * 5,
      vy: fireflies ? (Math.random() - 0.5) * 0.2 : se.shape === 'snow' ? 0.35 + Math.random() * 0.5 : 0.3 + Math.random() * 0.4,
      sw: Math.random() * 6, ss: 0.004 + Math.random() * 0.01, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.03, c: pick(se.colors), ph: Math.random() * 6 })
    const P = [...Array(count)].map(() => mk(true))
    const draw = (p, t) => {
      ctx.save(); ctx.translate(p.x + Math.sin(p.sw + t * p.ss * 60) * 14, p.y); ctx.rotate(p.a)
      if (fireflies) { const g = 0.5 + 0.5 * Math.sin(t * 2 + p.ph); ctx.fillStyle = `rgba(255,226,120,${0.25 + 0.6 * g})`; ctx.shadowColor = '#FFE278'; ctx.shadowBlur = 10 * g; ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 7); ctx.fill() }
      else if (se.shape === 'snow') { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.strokeStyle = 'rgba(80,110,130,.35)'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill(); ctx.stroke() }
      else if (se.shape === 'leaf') { ctx.globalAlpha = 0.55; ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.quadraticCurveTo(p.r * 0.9, 0, 0, p.r); ctx.quadraticCurveTo(-p.r * 0.9, 0, 0, -p.r); ctx.fill() }
      else if (se.shape === 'petal') { ctx.globalAlpha = 0.6; ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.45, p.r * 0.8, 0, 0, 7); ctx.fill() }
      else { ctx.globalAlpha = 0.45; ctx.fillStyle = '#F6D458'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, 7); ctx.fill() }
      ctx.restore()
    }
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(50, now - last) / 16.7
      last = now
      if (!document.hidden) {
        ctx.clearRect(0, 0, W, H)
        const t = now / 1000
        P.forEach((p, k) => {
          p.y += p.vy * dt * (pollen ? -0.4 : 1); p.a += p.va * dt
          if (fireflies) { p.x += Math.cos(t * 0.3 + p.ph) * 0.25 * dt; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10 }
          else if (p.y > H + 20 || p.y < -30) P[k] = mk(false)
          draw(p, t)
        })
      }
      frame(loop)
    }
    frame(loop)
  }

  /* ---------- start ---------- */
  ambient()
  newGame()
  later(() => say(pick([...SEASONS[SEASON].greet, ...TOD_GREET[TOD]]), 3200), 700)

  function destroy() {
    if (dead) return
    dead = true
    for (const id of timers) id < 0 ? clearInterval(-id) : clearTimeout(id)
    timers.clear()
    for (const id of rafs) cancelAnimationFrame(id)
    rafs.clear()
    offs.forEach((f) => f()); offs.length = 0
    if (stopWalk) stopWalk()
    sfx.close()
    root.innerHTML = ''
    root.classList.remove('rv-root')
  }

  // Används av testerna och av wrappern
  return { destroy, get state() { return S }, _debug: { attemptDog, findHint: () => findHint(S), showHint, newGame, setMode: (m) => { mode = m; newGame() } } }
}
