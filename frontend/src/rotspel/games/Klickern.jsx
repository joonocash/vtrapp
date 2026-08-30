import { useState, useEffect, useRef, useCallback } from 'react'

// Klickern v2. Skillnaden mot v1 är de tre sakerna som gör att incrementals
// inte tar slut efter tjugo minuter:
//
//   1. Prestige — nollställ frivilligt mot en permanent multiplikator.
//      Första gången känns det som en förlust, femte gången passerar du din
//      gamla topp på en bråkdel av tiden. Det är hela loopen.
//   2. Offline-vinster — du får något när du kommer tillbaka, så det finns
//      en anledning att öppna fliken igen imorgon.
//   3. Guldavgångar — slumpad bonus som dyker upp i tio sekunder och ger
//      en stor klumpsumma. Belönar att man faktiskt tittar på skärmen.

const SAVE_KEY = 'rotspel_klickern'
const REPORT_INTERVAL = 15000
const OFFLINE_CAP_HOURS = 8
const OFFLINE_RATE = 0.5 // du får halva produktionen medan du är borta

const UPGRADES = [
  { id: 'skylt', name: 'Avgångsskylt', baseCost: 15, rate: 0.1 },
  { id: 'hallplats', name: 'Hållplats', baseCost: 100, rate: 1 },
  { id: 'sparvagn', name: 'Spårvagn', baseCost: 1100, rate: 8 },
  { id: 'linje', name: 'Hel linje', baseCost: 12000, rate: 47 },
  { id: 'depa', name: 'Depå', baseCost: 130000, rate: 260 },
  { id: 'trafikledning', name: 'Trafikledning', baseCost: 1.4e6, rate: 1400 },
  { id: 'region', name: 'Regionalt nät', baseCost: 2e7, rate: 7800 },
  { id: 'kollektivet', name: 'Hela kollektivtrafiken', baseCost: 3.3e8, rate: 44000 },
]

const COST_GROWTH = 1.15
const PRESTIGE_THRESHOLD = 1e6 // minst så mycket totalt innan du får nollställa
const PRESTIGE_DIVISOR = 1e6

const GOLDEN_MIN_MS = 45000
const GOLDEN_MAX_MS = 120000
const GOLDEN_LIFETIME_MS = 10000

function costOf(upgrade, owned) {
  return Math.ceil(upgrade.baseCost * Math.pow(COST_GROWTH, owned))
}

// Guldkort du får vid prestige. Varje kort ger +10% produktion, permanent.
function guldkortFor(total) {
  if (total < PRESTIGE_THRESHOLD) return 0
  return Math.floor(Math.sqrt(total / PRESTIGE_DIVISOR))
}

function formatNumber(n) {
  if (n < 1000) return Math.floor(n).toString()
  if (n < 1e6) return `${(n / 1000).toFixed(1)}k`
  if (n < 1e9) return `${(n / 1e6).toFixed(2)}M`
  if (n < 1e12) return `${(n / 1e9).toFixed(2)}mdr`
  return `${(n / 1e12).toFixed(2)}bn`
}

function formatDuration(ms) {
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${min % 60} min`
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed.total !== 'number') return null
    return {
      bank: parsed.bank || 0,
      total: parsed.total || 0,
      owned: parsed.owned || {},
      guldkort: parsed.guldkort || 0,
      livstid: parsed.livstid || parsed.total || 0,
      lastSeen: parsed.lastSeen || Date.now(),
    }
  } catch {
    return null
  }
}

export default function Klickern({ onGameOver }) {
  const overRef = useRef(onGameOver)
  useEffect(() => {
    overRef.current = onGameOver
  })

  const initial = useRef(null)
  if (initial.current === null) {
    const saved = loadSave()
    let offlineGain = 0

    if (saved) {
      const away = Math.min(
        Date.now() - saved.lastSeen,
        OFFLINE_CAP_HOURS * 3600 * 1000
      )
      const rate = UPGRADES.reduce(
        (sum, u) => sum + (saved.owned[u.id] || 0) * u.rate,
        0
      )
      const multiplier = 1 + saved.guldkort * 0.1
      if (away > 60000 && rate > 0) {
        offlineGain = (away / 1000) * rate * multiplier * OFFLINE_RATE
      }
    }

    initial.current = {
      bank: (saved?.bank || 0) + offlineGain,
      total: (saved?.total || 0) + offlineGain,
      livstid: (saved?.livstid || 0) + offlineGain,
      owned: saved?.owned || {},
      guldkort: saved?.guldkort || 0,
      offlineGain,
      awayMs: saved ? Date.now() - saved.lastSeen : 0,
    }
  }

  const [bank, setBank] = useState(initial.current.bank)
  const [total, setTotal] = useState(initial.current.total)
  const [livstid, setLivstid] = useState(initial.current.livstid)
  const [owned, setOwned] = useState(initial.current.owned)
  const [guldkort, setGuldkort] = useState(initial.current.guldkort)
  const [offlineNotice, setOfflineNotice] = useState(
    initial.current.offlineGain > 0
      ? {
          gain: initial.current.offlineGain,
          away: initial.current.awayMs,
        }
      : null
  )
  const [golden, setGolden] = useState(null)
  const [flash, setFlash] = useState(null)
  const flashTimer = useRef(null)
  const [confirmPrestige, setConfirmPrestige] = useState(false)
  const confirmTimer = useRef(null)

  const multiplier = 1 + guldkort * 0.1
  const perSecond =
    UPGRADES.reduce((sum, u) => sum + (owned[u.id] || 0) * u.rate, 0) * multiplier

  const stateRef = useRef({})
  stateRef.current = { bank, total, livstid, owned, guldkort, perSecond }

  // produktion
  useEffect(() => {
    const interval = setInterval(() => {
      const rate = stateRef.current.perSecond
      if (rate <= 0) return
      const gain = rate / 10
      setBank((b) => b + gain)
      setTotal((t) => t + gain)
      setLivstid((l) => l + gain)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  // autospar
  useEffect(() => {
    function save() {
      try {
        const s = stateRef.current
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({
            bank: s.bank,
            total: s.total,
            livstid: s.livstid,
            owned: s.owned,
            guldkort: s.guldkort,
            lastSeen: Date.now(),
          })
        )
      } catch {
        // privat läge
      }
    }
    const interval = setInterval(save, 2000)
    window.addEventListener('beforeunload', save)
    return () => {
      save()
      clearInterval(interval)
      window.removeEventListener('beforeunload', save)
    }
  }, [])

  // rapportera livstidstotalen, eftersom rundan aldrig tar slut
  useEffect(() => {
    const interval = setInterval(() => {
      overRef.current(Math.floor(stateRef.current.livstid))
    }, REPORT_INTERVAL)
    return () => {
      overRef.current(Math.floor(stateRef.current.livstid))
      clearInterval(interval)
    }
  }, [])

  // guldavgångar
  useEffect(() => {
    let spawnTimer = null
    let hideTimer = null

    function schedule() {
      const delay =
        GOLDEN_MIN_MS + Math.random() * (GOLDEN_MAX_MS - GOLDEN_MIN_MS)
      spawnTimer = setTimeout(() => {
        setGolden({
          left: 10 + Math.random() * 70,
          top: 10 + Math.random() * 70,
          id: Date.now(),
        })
        hideTimer = setTimeout(() => {
          setGolden(null)
          schedule()
        }, GOLDEN_LIFETIME_MS)
      }, delay)
    }

    schedule()
    return () => {
      if (spawnTimer) clearTimeout(spawnTimer)
      if (hideTimer) clearTimeout(hideTimer)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
  }, [])

  const click = useCallback(() => {
    const gain = 1 * (1 + stateRef.current.guldkort * 0.1)
    setBank((b) => b + gain)
    setTotal((t) => t + gain)
    setLivstid((l) => l + gain)
  }, [])

  function grabGolden() {
    // 15 minuters produktion, eller 50 om du inte har någon
    const s = stateRef.current
    const reward = Math.max(50, s.perSecond * 900)
    setBank((b) => b + reward)
    setTotal((t) => t + reward)
    setLivstid((l) => l + reward)
    setGolden(null)
    setFlash(`+${formatNumber(reward)}`)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 2000)
  }

  function buy(upgrade) {
    const have = owned[upgrade.id] || 0
    const cost = costOf(upgrade, have)
    if (bank < cost) return
    setBank((b) => b - cost)
    setOwned((o) => ({ ...o, [upgrade.id]: have + 1 }))
  }

  const pendingKort = guldkortFor(total)
  const canPrestige = pendingKort > 0

  // Tvåstegsbekräftelse i själva knappen: första klicket arm-ar den, andra
  // genomför. Återgår av sig själv efter 4 sekunder så den inte blir liggande
  // arm-ad nästa gång man råkar sikta där.
  function prestige() {
    if (!canPrestige) return

    if (!confirmPrestige) {
      setConfirmPrestige(true)
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmPrestige(false), 4000)
      return
    }

    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    setConfirmPrestige(false)
    setGuldkort((g) => g + pendingKort)
    setBank(0)
    setTotal(0)
    setOwned({})
  }

  return (
    <div className="flex flex-col gap-4 relative">
      {offlineNotice && (
        <button
          onClick={() => setOfflineNotice(null)}
          className="w-full text-left bg-blue-950 border border-blue-800 rounded-lg px-3 py-2.5"
        >
          <div className="text-sm text-blue-100">
            Medan du var borta: +{formatNumber(offlineNotice.gain)} avgångar
          </div>
          <div className="text-xs text-blue-300/70 mt-0.5">
            {formatDuration(offlineNotice.away)} sedan sist. Tryck för att stänga.
          </div>
        </button>
      )}

      <div className="text-center">
        <div className="text-3xl text-gray-100 font-medium">{formatNumber(bank)}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          avgångar · {perSecond.toFixed(1)}/s
          {guldkort > 0 && (
            <span className="text-amber-400 ml-2">×{multiplier.toFixed(1)}</span>
          )}
        </div>
      </div>

      <div className="relative">
        <button
          onClick={click}
          className="mx-auto block w-40 h-40 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-transform text-blue-50 text-lg font-medium touch-none select-none"
        >
          Avgång
        </button>

        {flash && (
          <div className="absolute inset-x-0 top-0 text-center text-amber-400 font-medium pointer-events-none">
            {flash}
          </div>
        )}

        {golden && (
          <button
            onClick={grabGolden}
            aria-label="Guldavgång"
            className="absolute w-12 h-12 rounded-full bg-amber-400 hover:bg-amber-300 animate-pulse shadow-lg shadow-amber-500/40"
            style={{ left: `${golden.left}%`, top: `${golden.top}%` }}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {UPGRADES.map((u) => {
          const have = owned[u.id] || 0
          const cost = costOf(u, have)
          const canAfford = bank >= cost
          // dölj uppgraderingar som ligger långt utanför räckhåll
          if (have === 0 && bank < u.baseCost * 0.4) return null
          return (
            <button
              key={u.id}
              onClick={() => buy(u)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
                canAfford
                  ? 'bg-gray-800 border-gray-600 hover:border-gray-500'
                  : 'bg-gray-900 border-gray-800 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm text-gray-100">
                  {u.name}
                  {have > 0 && <span className="text-gray-500 ml-2">×{have}</span>}
                </div>
                <div className="text-xs text-gray-500">
                  +{(u.rate * multiplier).toFixed(1)}/s
                </div>
              </div>
              <div
                className={`text-sm shrink-0 ml-3 ${
                  canAfford ? 'text-amber-400' : 'text-gray-600'
                }`}
              >
                {formatNumber(cost)}
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={prestige}
        disabled={!canPrestige}
        className={`rounded-lg px-3 py-2.5 text-sm border transition-colors ${
          !canPrestige
            ? 'bg-gray-900 border-gray-800 text-gray-600'
            : confirmPrestige
            ? 'bg-red-950 border-red-600 text-red-200 hover:border-red-400'
            : 'bg-amber-950 border-amber-700 text-amber-200 hover:border-amber-500'
        }`}
      >
        {!canPrestige
          ? `Nollställ vid ${formatNumber(PRESTIGE_THRESHOLD)} avgångar`
          : confirmPrestige
          ? `Säker? Allt utom livstid och guldkort nollställs`
          : `Nollställ för ${pendingKort} guldkort (+${pendingKort * 10}%)`}
      </button>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Livstid: {formatNumber(livstid)}
          {guldkort > 0 && ` · ${guldkort} guldkort`}
        </span>
      </div>
    </div>
  )
}
