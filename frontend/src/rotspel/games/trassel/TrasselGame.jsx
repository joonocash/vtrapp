import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Board from './Board.jsx'
import { createGame } from './game.js'
import { createAudio } from './audio.js'
import { PALETTE } from './render.js'
import { readSettings } from '../../useSettings.js'
import {
  load, save as persist, setStars, starsFor, packProgress, unlocked, nextLevel,
  dailyFor, streak, formatMs, submitScore, topList, playerName,
} from './store.js'
import paket from './banor/paket.json'
import dagliga from './banor/dagliga.json'
import tidsjakt from './banor/tidsjakt.json'
import './trassel.css'

// Trassel — spelets skal: lägen, statusrad, knappar, resultatrutor och topplistor.
//
// Tre lägen:
//   Banor     sju paket med stigande svårighet, 1–3 stjärnor per bana
//   Dagens    samma bana för alla i dag, tid mot topplistan, veckodagstema
//   Tidsjakt  lös så många bräden du hinner, varje bräde ger tid tillbaka
//
// Spelet öppnar direkt i en bana (där man slutade), inga menyer först.

const HINT_PENALTY_MS = 20000 // Dagens: tips kostar tid
const RUSH_START_MS = 60000
const RUSH_SKIP_MS = 5000
const RUSH_BONUS_S = { 5: 4, 6: 6, 7: 8, 8: 10 }
const rushSize = (solved) => (solved < 3 ? 5 : solved < 6 ? 6 : solved < 10 ? 7 : 8)
const RUSH_ID = 'trassel-tidsjakt'
const dailyId = (date) => `trassel-dag-${date}`

const levelKey = (lv) => lv.g + (lv.wl || []).join() + (lv.wr || []).join() + (lv.wc || []).join()

export default function TrasselGame() {
  const [save, setSave] = useState(load)
  useEffect(() => { persist(save) }, [save])
  const audio = useMemo(() => createAudio(() => !readSettings().ljud), [])
  useEffect(() => () => audio.close(), [audio])

  const [mode, setMode] = useState('banor')
  const [cur, setCur] = useState(() => nextLevel(load(), paket))
  const daily = useMemo(() => dailyFor(dagliga), [])
  const [rush, setRush] = useState(() => newRush())
  const [nonce, setNonce] = useState(0) // börja om samma bana
  const [picker, setPicker] = useState(false)
  const [win, setWin] = useState(null)
  const [toast, setToast] = useState(null)
  const [, bump] = useReducer((x) => x + 1, 0)
  const boardRef = useRef(null)

  const pack = paket.find((p) => p.id === cur.pack) || paket[0]
  const level =
    mode === 'banor' ? pack.banor[cur.index] :
    mode === 'dagens' ? daily.level :
    rush.level

  const game = useMemo(() => createGame(level), [levelKey(level), level.w, nonce, mode]) // eslint-disable-line react-hooks/exhaustive-deps
  const status = game.status()
  // Bara i utvecklingsläget: låter webbläsartester läsa brädet. Försvinner i bygget.
  useEffect(() => { if (import.meta.env.DEV) window.__trassel = { game, mode } }, [game, mode])

  /* ---------- klocka ---------- */
  const startRef = useRef(0) // performance.now() vid första draget, 0 = inte startad
  const [, tick] = useReducer((x) => x + 1, 0)
  const alreadyDaily = Boolean(save.dagar[daily.date])

  useEffect(() => {
    startRef.current = 0
    setWin(null)
  }, [game])

  // Dagens klocka överlever omladdning: startpunkten sparas.
  const dailyElapsed = () => {
    const ds = save.dagStart
    if (!ds || ds.date !== daily.date) return 0
    return Date.now() - ds.t + game.status().hints * HINT_PENALTY_MS
  }
  const elapsed = () => {
    if (mode === 'dagens' && !alreadyDaily) return dailyElapsed()
    return startRef.current ? performance.now() - startRef.current : 0
  }

  const running = !win && (mode === 'tidsjakt' ? rush.phase === 'running' : startRef.current > 0 || (mode === 'dagens' && save.dagStart?.date === daily.date && !alreadyDaily))
  useEffect(() => {
    if (!running) return
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [running])

  /* ---------- tidsjakt ---------- */
  function newRush() {
    return { phase: 'ready', endsAt: 0, left: RUSH_START_MS, score: 0, solved: 0, used: [], level: pickRush(5, []), float: null }
  }
  function pickRush(size, used) {
    const pool = tidsjakt[size]
    const free = pool.map((_, i) => i).filter((i) => !used.includes(`${size}:${i}`))
    const list = free.length ? free : pool.map((_, i) => i)
    const i = list[Math.floor(Math.random() * list.length)]
    return { ...pool[i], _id: `${size}:${i}` }
  }
  const rushLeft = rush.phase === 'running' ? Math.max(0, rush.endsAt - performance.now()) : rush.left
  const lastSecond = useRef(99)
  useEffect(() => {
    if (mode !== 'tidsjakt' || rush.phase !== 'running') return
    const s = Math.ceil(rushLeft / 1000)
    if (s <= 10 && s !== lastSecond.current && s > 0) audio.secondTick()
    lastSecond.current = s
    if (rushLeft <= 0) endRush()
  })
  function endRush() {
    setRush((r) => ({ ...r, phase: 'over', left: 0 }))
    audio.gameOver()
    const score = rush.score
    const best = Math.max(save.tidsjaktBast || 0, score)
    setSave((s) => ({ ...s, tidsjaktBast: best }))
    setWin({ kind: 'rushOver', score, record: score > (save.tidsjaktBast || 0) && score > 0, solved: rush.solved })
    if (score > 0) submitScore(RUSH_ID, score, false).then(() => setWin((w) => (w ? { ...w, lbKey: Date.now() } : w)))
  }

  /* ---------- händelser från brädet ---------- */
  const onFirstTouch = useCallback(() => {
    if (!startRef.current) startRef.current = performance.now()
    if (mode === 'dagens' && !alreadyDaily && save.dagStart?.date !== daily.date) {
      setSave((s) => ({ ...s, dagStart: { date: daily.date, t: Date.now() } }))
    }
    if (mode === 'tidsjakt' && rush.phase === 'ready') {
      setRush((r) => ({ ...r, phase: 'running', endsAt: performance.now() + r.left }))
    }
  }, [mode, alreadyDaily, save.dagStart, daily.date, rush.phase])

  function onWin(s) {
    const ms = elapsed()
    if (mode === 'tidsjakt') {
      const pts = level.w * level.h * (s.perfect ? 2 : 1)
      const bonus = RUSH_BONUS_S[level.w] || 5
      audio.win(false)
      setTimeout(() => audio.timeBonus(), 250)
      setRush((r) => {
        const solved = r.solved + 1
        const used = [...r.used, r.level._id]
        return {
          ...r, solved, used,
          score: r.score + pts,
          endsAt: r.endsAt + bonus * 1000,
          float: { text: `+${pts}${s.perfect ? ' perfekt!' : ''}`, sub: `+${bonus} s`, key: Date.now() },
          nextLevel: pickRush(rushSize(solved), used),
        }
      })
      return
    }
    audio.win(s.perfect)
    const stars = s.perfect ? 3 : s.hints === 0 ? 2 : 1
    if (mode === 'banor') {
      const next = setStars(save, pack.id, cur.index, stars)
      const packDone = pack.banor.every((_, i) => starsFor(next, pack.id, i))
      const wasDone = pack.banor.every((_, i) => starsFor(save, pack.id, i))
      setSave(next)
      setWin({ kind: 'level', stars, perfect: s.perfect, ms, moves: s.moves, total: s.total, hints: s.hints, packDone: packDone && !wasDone })
    } else {
      const first = !alreadyDaily
      if (first) {
        setSave((sv) => ({ ...sv, dagar: { ...sv.dagar, [daily.date]: { ms, hints: s.hints, perfect: s.perfect } }, dagStart: null }))
        submitScore(dailyId(daily.date), ms, true).then(() => setWin((w) => (w ? { ...w, lbKey: Date.now() } : w)))
      }
      setWin({ kind: 'daily', stars, perfect: s.perfect, ms: first ? ms : elapsed(), first, hints: s.hints })
    }
    stars && [0, 1, 2].slice(0, stars).forEach((i) => setTimeout(() => audio.star(i), 700 + i * 260))
  }

  // Tidsjakt: byt till nästa bräde en stund efter vinsten.
  useEffect(() => {
    if (!rush.nextLevel) return
    const id = setTimeout(() => setRush((r) => ({ ...r, level: r.nextLevel, nextLevel: null })), 650)
    return () => clearTimeout(id)
  }, [rush.nextLevel])

  function onAlmost() {
    setToast({ text: 'Alla färger är ihop — fyll hela brädet!', key: Date.now() })
  }
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(id)
  }, [toast])

  /* ---------- knappar ---------- */
  function undo() {
    if (game.undo()) { audio.undo(); boardRef.current?.redraw(); bump() }
  }
  function restart() {
    game.reset()
    boardRef.current?.redraw()
    bump()
  }
  function hint() {
    if (mode === 'tidsjakt') {
      // Hoppa över: nytt bräde, kostar tid.
      if (rush.phase !== 'running') return
      setRush((r) => ({ ...r, endsAt: r.endsAt - RUSH_SKIP_MS, level: pickRush(rushSize(r.solved), [...r.used, r.level._id]), used: [...r.used, r.level._id], float: { text: 'Hoppat', sub: `−${RUSH_SKIP_MS / 1000} s`, key: Date.now() } }))
      return
    }
    const k = game.hint()
    if (k < 0) return
    audio.hint()
    if (mode === 'dagens' && !alreadyDaily && !startRef.current) onFirstTouch()
    boardRef.current?.hintGrow(k)
    bump()
    const s = game.status()
    if (s.won) {
      setTimeout(() => { boardRef.current?.celebrate(false); onWin(s) }, 700)
    }
  }
  function goLevel(packId, index) {
    setCur({ pack: packId, index })
    setSave((s) => ({ ...s, senast: { pack: packId, index } }))
    setMode('banor')
    setPicker(false)
    setNonce((n) => n + 1)
  }
  function nextInPack() {
    if (cur.index + 1 < pack.banor.length) return goLevel(pack.id, cur.index + 1)
    const pi = paket.findIndex((p) => p.id === pack.id)
    const np = paket[(pi + 1) % paket.length]
    goLevel(np.id, 0)
  }
  function switchMode(m) {
    if (m === mode) return
    // Lämnar man tidsjakten mitt i pausas den; nästa drag fortsätter där den var.
    if (mode === 'tidsjakt' && rush.phase === 'running') {
      setRush((r) => ({ ...r, phase: 'ready', left: Math.max(0, r.endsAt - performance.now()) }))
    }
    setMode(m)
    setWin(null)
    setPicker(false)
    if (m === 'tidsjakt' && rush.phase === 'over') setRush(newRush())
    setNonce((n) => n + 1)
  }

  const canNext = cur.index + 1 < pack.banor.length && unlocked(save, pack, cur.index + 1)
  const canPrev = cur.index > 0
  const locked = Boolean(win) || (mode === 'tidsjakt' && (rush.phase === 'over' || Boolean(rush.nextLevel)))
  const st = streak(save)
  const totalStars = paket.reduce((a, p) => a + packProgress(save, p).stars, 0)

  return (
    <div className="tr-root">
      <header className="tr-head">
        <Logo />
        <div className="tr-modes" role="tablist" aria-label="Spelläge">
          {[['banor', 'Banor'], ['dagens', 'Dagens'], ['tidsjakt', 'Tidsjakt']].map(([id, name]) => (
            <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => switchMode(id)}>
              {name}
              {id === 'dagens' && !alreadyDaily && <span className="tr-dot" aria-label="olöst" />}
            </button>
          ))}
        </div>
      </header>

      {/* Rad under lägesväljaren: var man är */}
      {mode === 'banor' && (
        <div className="tr-where">
          <button className="tr-nav" onClick={() => canPrev && goLevel(pack.id, cur.index - 1)} disabled={!canPrev} aria-label="Förra banan">‹</button>
          <button className="tr-where-main" onClick={() => setPicker(true)}>
            <span className="tr-where-title">{pack.namn} {cur.index + 1}</span>
            <span className="tr-where-sub">{level.w}×{level.h} · <Stars n={starsFor(save, pack.id, cur.index)} small /> · alla banor ▾</span>
          </button>
          <button className="tr-nav" onClick={() => canNext && goLevel(pack.id, cur.index + 1)} disabled={!canNext} aria-label="Nästa bana">›</button>
        </div>
      )}
      {mode === 'dagens' && (
        <div className="tr-where tr-where-daily">
          <div>
            <div className="tr-where-title">{daily.tema}</div>
            <div className="tr-where-sub">{new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'short' })} · {level.w}×{level.h} · samma för alla</div>
          </div>
          {st > 0 && <div className="tr-streak" title="Dagar i rad">🔥 {st}</div>}
        </div>
      )}
      {mode === 'tidsjakt' && (
        <div className="tr-where tr-rushbar">
          <div className={`tr-rushclock${rushLeft < 10000 && rush.phase === 'running' ? ' hot' : ''}`}>{formatMs(rushLeft)}</div>
          <div className="tr-rushscore">
            <b>{rush.score.toLocaleString('sv-SE')}</b>
            <span>poäng · {rush.solved} lösta</span>
          </div>
        </div>
      )}

      <div className="tr-stats" aria-live="polite">
        <Chip label="Färger" value={`${status.connected}/${status.total}`} good={status.connected === status.total} />
        <Chip label="Fyllt" value={`${status.fillPct}%`} good={status.fillPct === 100} />
        <Chip label="Drag" value={status.moves} sub={`mål ${status.total}`} good={status.moves > 0 && status.moves <= status.total} />
        {mode !== 'tidsjakt' && <Chip label="Tid" value={formatMs(win?.ms ?? elapsed())} />}
      </div>

      <div className="tr-boardbox">
        <Board
          ref={boardRef}
          game={game}
          audio={audio}
          symbols={save.symboler}
          locked={locked}
          light={mode === 'tidsjakt'}
          onChange={bump}
          onWin={onWin}
          onFirstTouch={onFirstTouch}
          onAlmost={onAlmost}
        />
        {mode === 'tidsjakt' && rush.float && (
          <div key={rush.float.key} className="tr-float">
            {rush.float.text} <em>{rush.float.sub}</em>
          </div>
        )}
        {mode === 'tidsjakt' && rush.phase === 'ready' && (
          <div className="tr-ready">
            <b>{rush.left < RUSH_START_MS ? 'Dra för att fortsätta' : 'Dra för att starta'}</b>
            <span>{RUSH_START_MS / 1000} sekunder. Varje löst bräde ger poäng och tid tillbaka. Perfekt ger dubbelt.</span>
          </div>
        )}
        {mode === 'dagens' && alreadyDaily && !win && (
          <div className="tr-banner">Löst i dag på {formatMs(save.dagar[daily.date].ms)}. Omspel räknas inte.</div>
        )}
        {toast && <div key={toast.key} className="tr-toast">{toast.text}</div>}
        {win && (
          <WinCard
            win={win}
            mode={mode}
            pack={pack}
            index={cur.index}
            save={save}
            streakDays={st}
            date={daily.date}
            onNext={nextInPack}
            onAgain={() => { setWin(null); if (mode === 'tidsjakt') setRush(newRush()); setNonce((n) => n + 1) }}
            onClose={() => setWin(null)}
            onPicker={() => { setWin(null); setPicker(true) }}
            onMode={switchMode}
          />
        )}
      </div>

      <div className="tr-actions">
        <button className="tr-btn" onClick={undo} disabled={!game.canUndo || locked}>Ångra</button>
        <button className="tr-btn" onClick={restart} disabled={locked}>Börja om</button>
        <button className="tr-btn tr-btn-hint" onClick={hint} disabled={locked || (mode === 'tidsjakt' && rush.phase !== 'running')}>
          {mode === 'tidsjakt' ? `Hoppa −${RUSH_SKIP_MS / 1000} s` : mode === 'dagens' && !alreadyDaily ? `Tips +${HINT_PENALTY_MS / 1000} s` : 'Tips'}
        </button>
      </div>

      <p className="tr-help">
        Dra från en prick till pricken i samma färg. Alla färger ihop och hela brädet fyllt = klart.
        {(level.g.includes('#') || level.wl) && ' Stenar och vita staket går inte att dra igenom.'}
        {level.g.includes('+') && ' På en bro får två färger korsa varandra, en vågrätt och en lodrätt — båda ska fyllas.'}
        {(level.wr || level.wc) && ' Lila portaler i kanten leder rakt över till andra sidan: dra ut över kanten, släpp och fortsätt från andra sidan.'}
      </p>

      {mode === 'dagens' && <Topplista title="Dagens topplista" gameId={dailyId(daily.date)} lowerIsBetter format="time" refreshKey={win?.lbKey} />}
      {mode === 'tidsjakt' && (
        <Topplista title={`Tidsjakt · ditt rekord ${(save.tidsjaktBast || 0).toLocaleString('sv-SE')}`} gameId={RUSH_ID} format="number" refreshKey={win?.lbKey} />
      )}
      {mode === 'banor' && (
        <div className="tr-progress">
          <span>★ {totalStars} av {paket.reduce((a, p) => a + p.banor.length * 3, 0)}</span>
          <label className="tr-toggle">
            <input type="checkbox" checked={save.symboler} onChange={() => setSave((s) => ({ ...s, symboler: !s.symboler }))} />
            Bokstäver i prickarna
          </label>
        </div>
      )}
      {mode !== 'banor' && (
        <div className="tr-progress">
          <span />
          <label className="tr-toggle">
            <input type="checkbox" checked={save.symboler} onChange={() => setSave((s) => ({ ...s, symboler: !s.symboler }))} />
            Bokstäver i prickarna
          </label>
        </div>
      )}

      {picker && <Picker save={save} current={cur} onPick={goLevel} onClose={() => setPicker(false)} />}
    </div>
  )
}

/* ---------- små delar ---------- */

function Logo() {
  return (
    <div className="tr-logo" aria-label="Trassel">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <path d="M8 10 H26 V22 H14 V34 H36" fill="none" stroke={PALETTE[5]} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M36 10 V26" fill="none" stroke={PALETTE[6]} strokeWidth="5" strokeLinecap="round" />
        <circle cx="8" cy="10" r="4.5" fill={PALETTE[5]} />
        <circle cx="36" cy="34" r="4.5" fill={PALETTE[5]} />
        <circle cx="36" cy="10" r="4.5" fill={PALETTE[6]} />
        <circle cx="36" cy="26" r="4.5" fill={PALETTE[6]} />
      </svg>
      <span>Trassel</span>
    </div>
  )
}

function Chip({ label, value, sub, good }) {
  return (
    <div className={`tr-chip${good ? ' good' : ''}`}>
      <b>{value}</b>
      <span>{label}{sub ? ` · ${sub}` : ''}</span>
    </div>
  )
}

function Stars({ n, small, animate }) {
  return (
    <span className={`tr-stars${small ? ' small' : ''}${animate ? ' animate' : ''}`} aria-label={`${n} av 3 stjärnor`}>
      {[0, 1, 2].map((i) => (
        <i key={i} className={i < n ? 'on' : ''} style={animate ? { animationDelay: `${0.7 + i * 0.26}s` } : undefined}>★</i>
      ))}
    </span>
  )
}

function WinCard({ win, mode, pack, index, save, streakDays, date, onNext, onAgain, onClose, onPicker, onMode }) {
  if (win.kind === 'rushOver') {
    return (
      <div className="tr-win" role="dialog" aria-modal="true">
        <div className="tr-win-card">
          <div className="tr-win-title">{win.record ? 'Nytt rekord!' : 'Tiden är ute'}</div>
          <div className="tr-win-big">{win.score.toLocaleString('sv-SE')}</div>
          <div className="tr-win-sub">poäng · {win.solved} bräden lösta</div>
          <Rank gameId={RUSH_ID} lowerIsBetter={false} active={win.score > 0} lbKey={win.lbKey} suffix="på topplistan" />
          <div className="tr-win-btns">
            <button className="tr-btn tr-btn-main" onClick={onAgain}>Igen</button>
          </div>
        </div>
      </div>
    )
  }
  const title = win.perfect ? 'Perfekt!' : win.hints ? 'Löst med tips' : 'Löst!'
  return (
    <div className="tr-win" role="dialog" aria-modal="true">
      <div className="tr-win-card">
        <div className="tr-win-title">{title}</div>
        <Stars n={win.stars} animate />
        {mode === 'banor' && (
          <>
            <div className="tr-win-sub">
              {win.moves} drag{win.perfect ? ', perfekt' : ` — perfekt är ${win.total}`} · {formatMs(win.ms)}
            </div>
            {win.packDone && <div className="tr-win-pack">Hela {pack.namn} klart! 🎉</div>}
            <div className="tr-win-btns">
              <button className="tr-btn" onClick={onAgain}>Igen</button>
              <button className="tr-btn" onClick={onPicker}>Banor</button>
              <button className="tr-btn tr-btn-main" onClick={onNext} autoFocus>
                {index + 1 < pack.banor.length ? 'Nästa ›' : 'Nytt paket ›'}
              </button>
            </div>
          </>
        )}
        {mode === 'dagens' && (
          <>
            <div className="tr-win-big">{formatMs(win.ms)}</div>
            <div className="tr-win-sub">
              {win.first
                ? `${win.hints ? `inklusive ${win.hints} tips à ${HINT_PENALTY_MS / 1000} s · ` : ''}${streakDays > 0 ? `🔥 ${streakDays} ${streakDays === 1 ? 'dag' : 'dagar'} i rad` : ''}`
                : 'Omspel — tiden räknas inte'}
            </div>
            <Rank gameId={dailyId(date)} lowerIsBetter active={win.first} lbKey={win.lbKey} suffix="i dag" />
            <div className="tr-win-sub">Nytt bräde om {untilMidnight()}</div>
            <div className="tr-win-btns">
              <button className="tr-btn" onClick={onClose}>Stäng</button>
              <button className="tr-btn tr-btn-main" onClick={() => onMode('tidsjakt')}>Tidsjakt ›</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function untilMidnight() {
  const now = new Date()
  const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const min = Math.max(1, Math.round((mid - now) / 60000))
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
}

// Var hamnade jag? Hämtas efter att resultatet skickats (lbKey ändras då).
function Rank({ gameId, lowerIsBetter, active, lbKey, suffix }) {
  const [rank, setRank] = useState(null)
  useEffect(() => {
    if (!active) return
    let alive = true
    topList(gameId, lowerIsBetter, 50).then((list) => {
      if (!alive || !list) return
      const me = playerName()
      const i = list.findIndex((e) => e.player === me)
      setRank(i >= 0 ? { place: i + 1, of: list.length } : null)
    })
    return () => { alive = false }
  }, [gameId, lowerIsBetter, active, lbKey])
  if (!rank) return null
  return <div className="tr-win-rank">Plats {rank.place} av {rank.of} {suffix}</div>
}

function Topplista({ title, gameId, lowerIsBetter = false, format, refreshKey }) {
  const [list, setList] = useState(null)
  useEffect(() => {
    let alive = true
    topList(gameId, lowerIsBetter, 10).then((l) => { if (alive) setList(l) })
    return () => { alive = false }
  }, [gameId, lowerIsBetter, refreshKey])
  const me = playerName()
  return (
    <section className="tr-panel">
      <h3>{title}</h3>
      {list === null ? (
        <p className="tr-muted">Kunde inte hämta topplistan.</p>
      ) : list.length === 0 ? (
        <p className="tr-muted">Ingen har satt ett resultat än. Bli först!</p>
      ) : (
        <ol className="tr-list">
          {list.map((e, i) => (
            <li key={e.player} className={e.player === me ? 'me' : ''}>
              <span><i>{i + 1}</i>{e.player}</span>
              <b>{format === 'time' ? formatMs(e.score) : Math.round(e.score).toLocaleString('sv-SE')}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Picker({ save, current, onPick, onClose }) {
  const [open, setOpen] = useState(current.pack)
  return (
    <div className="tr-picker" role="dialog" aria-modal="true" aria-label="Välj bana">
      <div className="tr-picker-head">
        <b>Banor</b>
        <button className="tr-btn" onClick={onClose}>Stäng</button>
      </div>
      <div className="tr-picker-body">
        {paket.map((p) => {
          const pr = packProgress(save, p)
          const isOpen = open === p.id
          return (
            <div key={p.id} className={`tr-pack${isOpen ? ' open' : ''}`}>
              <button className="tr-pack-head" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
                <span className="tr-pack-name">{p.namn}</span>
                <span className="tr-pack-meta">{pr.solved}/{pr.total} · ★ {pr.stars}/{pr.total * 3}</span>
                <span className="tr-pack-bar"><i style={{ width: `${(pr.solved / pr.total) * 100}%` }} /></span>
                <span className="tr-pack-text">{p.text}</span>
              </button>
              {isOpen && (
                <div className="tr-levels">
                  {p.banor.map((lv, i) => {
                    const ok = unlocked(save, p, i)
                    const s = starsFor(save, p.id, i)
                    const here = current.pack === p.id && current.index === i
                    return (
                      <button
                        key={i}
                        className={`tr-lv${s ? ' done' : ''}${here ? ' here' : ''}`}
                        disabled={!ok}
                        onClick={() => onPick(p.id, i)}
                        aria-label={`Bana ${i + 1}, ${lv.w}×${lv.h}${s ? `, ${s} stjärnor` : ''}${ok ? '' : ', låst'}`}
                      >
                        <b>{ok ? i + 1 : '🔒'}</b>
                        <Stars n={s} small />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
