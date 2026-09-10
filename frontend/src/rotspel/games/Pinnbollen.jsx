import { useEffect, useRef, useState, useCallback } from 'react'
import {
  BREDD,
  HOJD,
  PINNE_R,
  skapaSpel,
  nastaBana,
  sikta,
  skjut,
  steg,
  siktlinje,
  orangeKvar,
  oppnaFack,
  rensaPinnar,
  FACK_POANG,
  FACK_HOJD,
  VAGG_R,
} from './pinnbollenEngine.js'
import { GRADER } from './pinnbollenKrafter.js'
import Kraftlada from './Kraftlada.jsx'
import { useLjud } from '../useLjud.js'
import { readSettings } from '../useSettings.js'

// Pinnbollen. Sikta, släpp kulan, träffa alla orange pinnar.
//
// Motorn sköter fysik och regler och returnerar händelser. Den här filen
// ritar och spelar upp dem. Allt speltillstånd ligger i refs — en runda är
// 60 uppdateringar i sekunden och state hade gett 60 renders. spel.kulor är
// numera en array (se pinnbollenEngine.js) — allt som ritar en kula loopar
// över den i stället för att anta att det bara finns en.

const FARG_BLA = '#3b82f6'
const FARG_ORANGE = '#f97316'
const FARG_GRON = '#22c55e'
const FARG_ROD = '#f87171'

// Avbrytzonen: släpper man ovanför den här höjden avfyras inget skott.
// ZON_MIN_LOGISK (24 = ~6 % av HOJD) är golvet på en normalstor skärm, men
// zonen mäts om i verkliga pixlar varje gång (se logiskPosition()) eftersom
// en logisk pixel kan bli mycket liten i fullskärm i liggande läge.
const ZON_MIN_LOGISK = 24
const ZON_MIN_REAL_PX = 44 // vedertagen minsta träffyta för ett finger

// Ringarna för det relativa siktet. Fasta i logiska pixlar (inte omräknade
// som zonen) — "ungefär" stort nog att synas vid normal visningsstorlek.
const ANKARE_RING_RADIE = 5
const FINGER_RING_RADIE = 17

// Relativt sikte: vinkeln följer INTE fingrets absoluta position (den
// gamla modellen krävde att tummen nådde skärmens hörn för extrema vinklar,
// och fingret skymde alltid det man siktade på). I stället är det en ren
// förflyttning — dx sidledes från ankarpunkten där man tryckte ner —
// omräknad till en vinkeländring.
const MIN_VINKEL = Math.PI * 0.08
const MAX_VINKEL = Math.PI * 0.92
// Hela svängen (MIN till MAX) över hela planens bredd, vid känslighet 1.
const RAD_PER_PX = (MAX_VINKEL - MIN_VINKEL) / BREDD
// Speltestad, inte uträknad — känns rätt i handen på en telefon. Utan
// förstärkningen känns dragningen trög eftersom en hel sidledes
// fingerrörelse annars bara svänger siktet en bråkdel av hela registret.
const KANSLIGHET = 4.5
// Finläge: drar man fingret neråt förbi det här (i logiska pixlar, från
// ankaret) sänks känsligheten kraftigt för precisionssikte. Kompenserar för
// att det relativa siktet, till skillnad från det gamla absoluta, inte
// längre ger exakt vinkelupplösning nära kanonen.
const FINLAGE_TROSKEL_PX = 70
const FINLAGE_FAKTOR = 0.35

// Fysiktakten loopen strävar efter i millisekunder. steg() rör kulan lika
// mycket per anrop oavsett vilket dtMs man skickar in (det används bara av
// vakthunden), så det här är bara hur ofta vi väljer att anropa den.
const TAKT_MS = 1000 / 60

// ------------------------------------------------------------ feberfinalen
//
// Exakt tidslinje från att feberStart-händelsen kommer (se spelaHandelse):
// 0ms slowmo+zoom+banner+skärmskakning+fyrverkeri, 900ms pinnarna städas i
// en våg, 1900ms facken öppnas, 2600ms slowmo av. Facken öppnas medvetet
// SIST, inte samtidigt som resten — allt på en gång blir för mycket på en
// gång för spelaren att hänga med i.
const FEBER_STAD_MS = 900
const FEBER_FACK_MS = 1900
const FEBER_SLUT_MS = 2600
const FEBER_PINNE_VAG_MS = 28 // ungefärligt mellanrum mellan varje pinne i städvågen

// Kamerans zoomlägen under finalen — in vid feberstart, ut lite när facken
// öppnas (man behöver se hela bredden av dem), tillbaka till normalt när allt
// är klart.
const ZOOM_FEBER = 2.3
const ZOOM_FACK = 1.35
const ZOOM_NORMAL = 1
// Hur snabbt kameran (position/zoom) hinner ikapp sitt mål varje bildruta —
// en enkel exponentiell glidning, inte en riktig kamera. Speltestade värden:
// för lågt känns det trögt/laggigt, för högt rycker det till vid varje studs.
const KAM_LERP = 0.09
const ZOOM_LERP = 0.07

export default function Pinnbollen({ onGameOver }) {
  const overRef = useRef(onGameOver)
  useEffect(() => {
    overRef.current = onGameOver
  })

  const ton = useLjud()
  const canvasRef = useRef(null)
  const spelRef = useRef(null)
  if (spelRef.current === null) spelRef.current = skapaSpel(1)

  const [hud, setHud] = useState({ poang: 0, kulor: 10, orange: 0, niva: 1, aktivKraft: null })
  const [slut, setSlut] = useState(false)
  const [ladaKraftId, setLadaKraftId] = useState(null)

  const partiklar = useRef([])
  const popp = useRef([])
  const flyt = useRef([])
  const fyrverkeri = useRef([])
  const banner = useRef(null)
  const slowmo = useRef(0)
  const ackumulator = useRef(0)
  const skak = useRef(0)
  // Kameran under feberfinalen — se ZOOM_*/KAM_LERP-kommentaren ovan. Vilar
  // på (mitten, zoom 1) resten av tiden, vilket gör transformen till en
  // no-op (translate(BREDD/2,HOJD/2) scale(1) translate(-BREDD/2,-HOJD/2)).
  const kamX = useRef(BREDD / 2)
  const kamY = useRef(HOJD / 2)
  const zoom = useRef(ZOOM_NORMAL)
  const zoomMal = useRef(ZOOM_NORMAL)
  const levande = useRef(true)
  const rapporterat = useRef(false)
  const timers = useRef([])
  // Grön pinne träffad mitt i skottet — kraften är redan dragen av motorn,
  // men lådan ska inte poppa upp förrän flykten är klar (skottSlut).
  const vantandeLadaKraft = useRef(null)
  // Speglar ladaKraftId synkront i en ref, så den fördröjda banaKlar-timern
  // (se nedan) läser aktuellt läge i stället för det som gällde när timern
  // schemalades.
  const ladaOppen = useRef(false)
  // Sant om banbytet väntar på att lådan ska stängas. Ordningen ska alltid
  // vara lådan först, banbytet sedan — annars kan spelaren vinna en kraft
  // som försvinner i bytet innan den hunnit visas.
  const bytBanaVantar = useRef(false)

  // ---- siktning: håll, dra, släpp (se pekarNer/pekarFlytta/pekarSlapp) ----
  // En aktiv nedtryckning pågår (finger eller nedtryckt musknapp). Skiljer
  // "sikta" (bara flytta vinkeln) från "hovra" nedan, som bara gäller mus.
  const siktar = useRef(false)
  // Musen rör sig över planen UTAN att vara nedtryckt. Bara mus kan hovra —
  // det finns ingen touch-motsvarighet, en pekskärm har inget "innan man rör
  // vid den"-läge. Håller det gamla hovringsbeteendet för mus intakt.
  const hovrarMus = useRef(false)
  // Senaste pekarposition i logiska canvas-koordinater, för att rita ringen
  // och den streckade linjen där fingret faktiskt är.
  const pekarLogisk = useRef({ x: BREDD / 2, y: 0 })
  // Är den senaste positionen innanför avbrytzonen just nu? Uppdateras
  // löpande under en pågående siktning, inte bara vid släpp, så
  // återkopplingen (röd ring/linje/pipa) hänger med i realtid.
  const iAvbrottzon = useRef(false)
  // Senast uppmätta zonhöjd i logiska pixlar, sparad för att rita zonens
  // linje på samma ställe som skjut-logiken faktiskt använder.
  const avbrottzonHojd = useRef(ZON_MIN_LOGISK)
  // pointerId på fingret som faktiskt siktar. Rör en andra pekare vid
  // canvasen mitt i en dragning (två fingrar samtidigt) ska den ignoreras
  // helt — annars kan den kapa siktet eller lösa ut ett oavsiktligt släpp
  // för det första fingret.
  const aktivPekarId = useRef(null)
  // Ankarpunkten (där fingret tryckte ner) och vinkeln som gällde just då —
  // det relativa siktet mäter allt som en förflyttning från de här två.
  const siktAnkare = useRef({ x: BREDD / 2, y: 0 })
  const siktStartVinkel = useRef(Math.PI / 2)
  // Finläge just nu (se FINLAGE_TROSKEL_PX) — styr både känsligheten och
  // fingerringens färg/text.
  const finlage = useRef(false)

  const senare = useCallback((fn, ms) => {
    const t = setTimeout(() => {
      if (levande.current) fn()
    }, ms)
    timers.current.push(t)
  }, [])

  const uppdateraHud = useCallback(() => {
    const s = spelRef.current
    setHud({
      poang: s.poang,
      kulor: s.kulorKvar,
      orange: orangeKvar(s),
      niva: s.niva,
      aktivKraft: s.aktivKraft,
    })
  }, [])

  // Ett fyrverkeri-utbrott (feberstart och fackTraff). Bara refs inblandade
  // så den behöver inte vara ett useCallback.
  const FYRVERKERI_FARGER = ['#fb923c', '#facc15', '#4ade80', '#38bdf8', '#f472b6']
  function skapaFyrverkeri(x, y, antal, skala = 1) {
    for (let i = 0; i < antal; i++) {
      const vinkel = Math.random() * Math.PI * 2
      const fart = (1.5 + Math.random() * 3) * skala
      fyrverkeri.current.push({
        x,
        y,
        vx: Math.cos(vinkel) * fart,
        vy: Math.sin(vinkel) * fart,
        t: 0,
        f: FYRVERKERI_FARGER[Math.floor(Math.random() * FYRVERKERI_FARGER.length)],
      })
    }
  }

  // ------------------------------------------------------- händelser -> effekt

  const spelaHandelse = useCallback(
    (h) => {
      const s = spelRef.current

      if (h.typ === 'traff') {
        const farg = h.pinne.gron ? FARG_GRON : h.orange ? FARG_ORANGE : FARG_BLA
        for (let i = 0; i < (h.orange ? 9 : 5); i++) {
          partiklar.current.push({
            x: h.pinne.x,
            y: h.pinne.y,
            vx: (Math.random() - 0.5) * (h.orange ? 4 : 2.6),
            vy: (Math.random() - 0.5) * (h.orange ? 4 : 2.6),
            t: 0,
            f: farg,
          })
        }
        if (h.mult > 1) {
          flyt.current.push({ x: h.pinne.x, y: h.pinne.y, text: '×' + h.mult, t: 0 })
        }
        // tonhöjden stiger med antalet orange i skottet — samma trick som
        // kaskaderna i Krossen
        ton(h.orange ? 380 + s.orangeIskottet * 60 : 240, 90, 'triangle', 0.1)
        return
      }

      if (h.typ === 'kraft') {
        // Kraften är redan avgjord av motorn — lådan visas först vid
        // skottSlut, så flykten som pågår aldrig avbryts.
        vantandeLadaKraft.current = h.kraft.id
        ton(620, 140, 'sine', 0.12)
        return
      }

      if (h.typ === 'raddning') {
        popp.current.push({ x: h.pinne.x, y: h.pinne.y, t: 0, raddning: true })
        banner.current = { text: 'Fastnade', farg: '#fbbf24', t: 0, ms: 900, storlek: 18 }
        ton(160, 220, 'square', 0.09)
        return
      }

      if (h.typ === 'knuff') {
        ton(140, 180, 'square', 0.08)
        return
      }

      if (h.typ === 'feberStart') {
        // Sista orange pinnen föll — finalen börjar. Facken öppnas
        // medvetet inte förrän FEBER_FACK_MS (se konstanterna ovan): allt på
        // en gång (zoom+fyrverkeri+städning+fack) hade känts som kaos i
        // stället för en tydlig sekvens.
        slowmo.current = 1
        zoomMal.current = ZOOM_FEBER
        banner.current = { text: 'FEBER!', farg: '#fb923c', t: 0, ms: 1400, storlek: 30 }
        if (readSettings().skak) skak.current = 14
        ton(560, 500, 'sawtooth', 0.16)
        skapaFyrverkeri(h.pinne.x, h.pinne.y, 26)

        senare(() => {
          if (!levande.current) return
          const s = spelRef.current
          const borttagna = rensaPinnar(s)
          borttagna.forEach((p, i) => {
            popp.current.push({ x: p.x, y: p.y, t: -i * 1.7, orange: p.orange, gron: p.gron })
          })
        }, FEBER_STAD_MS)

        senare(() => {
          if (!levande.current) return
          oppnaFack(spelRef.current)
          banner.current = { text: 'Bonusfack', farg: '#38bdf8', t: 0, ms: 1300, storlek: 24 }
          zoomMal.current = ZOOM_FACK
        }, FEBER_FACK_MS)

        senare(() => {
          if (!levande.current) return
          slowmo.current = 0
        }, FEBER_SLUT_MS)
        return
      }

      if (h.typ === 'fackTraff') {
        const arMitten = h.index === Math.floor(FACK_POANG.length / 2)
        banner.current = {
          text: '+' + h.poang.toLocaleString('sv-SE'),
          farg: arMitten ? '#facc15' : '#4ade80',
          t: 0,
          ms: arMitten ? 2200 : 1500,
          storlek: arMitten ? 40 : 24,
        }
        const fackBredd = BREDD / FACK_POANG.length
        const fx = fackBredd * (h.index + 0.5)
        const fy = HOJD - FACK_HOJD / 2
        skapaFyrverkeri(fx, fy, arMitten ? 60 : 22, arMitten ? 1.6 : 1)
        if (readSettings().skak) skak.current = arMitten ? 16 : 6
        ton(arMitten ? 900 : 650, arMitten ? 500 : 260, 'sine', 0.16)
        uppdateraHud()
        return
      }

      if (h.typ === 'golv') {
        banner.current = { text: 'Studs!', farg: '#38bdf8', t: 0, ms: 900, storlek: 18 }
        ton(500, 150, 'square', 0.12)
        return
      }

      if (h.typ === 'hink') {
        banner.current = { text: 'Extra kula', farg: '#4ade80', t: 0, ms: 1000, storlek: 20 }
        ton(700, 260, 'sine', 0.14)
        return
      }

      if (h.typ === 'skottSlut') {
        h.pinnar.forEach((p, i) => {
          popp.current.push({ x: p.x, y: p.y, t: -i * 2, orange: p.orange, gron: p.gron })
        })
        slowmo.current = 0
        uppdateraHud()
        if (vantandeLadaKraft.current) {
          setLadaKraftId(vantandeLadaKraft.current)
          ladaOppen.current = true
          vantandeLadaKraft.current = null
        }
        return
      }

      if (h.typ === 'banaKlar') {
        // Kameran hör bara hemma i feberfinalen — så fort banan är klar
        // (feber-vägen eller den vanliga) ska den glida tillbaka till
        // normalläget. Ofarligt att sätta även när den redan står på 1.
        zoomMal.current = ZOOM_NORMAL
        uppdateraHud()
        banner.current = { text: 'Banan klar', farg: '#4ade80', t: 0, ms: 1600, storlek: 24 }
        ton(520, 200, 'sine', 0.15)
        senare(() => ton(660, 400, 'sine', 0.15), 200)
        senare(() => {
          if (!levande.current) return
          // Lådan går alltid före banbytet. Är den öppen (kraften som just
          // vanns visas fortfarande upp) väntar bytet till onKlar i stället
          // — annars kan spelaren se lådan försvinna mitt i ett banbyte,
          // eller (värre) missa att den fanns alls.
          if (ladaOppen.current) {
            bytBanaVantar.current = true
            return
          }
          spelRef.current = nastaBana(spelRef.current)
          uppdateraHud()
        }, 1700)
        return
      }

      if (h.typ === 'slut') {
        setSlut(true)
        if (!rapporterat.current) {
          rapporterat.current = true
          overRef.current(spelRef.current.poang)
        }
        ton(220, 500, 'sawtooth', 0.12)
      }
    },
    [senare, ton, uppdateraHud, setLadaKraftId]
  )

  // ------------------------------------------------------------------ loopen

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = null
    let sist = performance.now()

    function rita(dt) {
      const s = spelRef.current

      // Kameran under feberfinalen: följ första kulan i luften, annars glid
      // tillbaka mot mitten. Ren exponentiell glidning (inte en riktig
      // kamera) — se KAM_LERP/ZOOM_LERP-kommentaren där de definieras.
      const iFinalen = s.lage === 'feber' || s.lage === 'fack'
      const kamMalX = iFinalen && s.kulor.length > 0 ? s.kulor[0].x : BREDD / 2
      const kamMalY = iFinalen && s.kulor.length > 0 ? s.kulor[0].y : HOJD / 2
      kamX.current += (kamMalX - kamX.current) * KAM_LERP
      kamY.current += (kamMalY - kamY.current) * KAM_LERP
      zoom.current += (zoomMal.current - zoom.current) * ZOOM_LERP

      ctx.save()

      if (skak.current > 0) {
        const d = skak.current
        ctx.translate((Math.random() * 2 - 1) * d * 0.4, (Math.random() * 2 - 1) * d * 0.4)
        skak.current = Math.max(0, skak.current - 0.6)
      }

      // Kameratransformen (se komponentens uppdrag: översätt/skala/översätt)
      // omsluter ENDAST spelvärlden. Banner och "Slut på kulor"-skärmen
      // ritas efter motsvarande ctx.restore() nedan, så de aldrig zoomas.
      ctx.save()
      ctx.translate(BREDD / 2, HOJD / 2)
      ctx.scale(zoom.current, zoom.current)
      ctx.translate(-kamX.current, -kamY.current)

      ctx.fillStyle = '#0b1120'
      ctx.fillRect(-20, -20, BREDD + 40, HOJD + 40)

      if (slowmo.current) {
        ctx.fillStyle = 'rgba(251,146,60,.08)'
        ctx.fillRect(0, 0, BREDD, HOJD)
      }

      // pinnar som just försvann
      popp.current = popp.current.filter((p) => {
        p.t += 1
        if (p.t < 0) return true
        if (p.t > 18) return false
        const skala = 1 + p.t / 6
        ctx.globalAlpha = 1 - p.t / 18
        ctx.strokeStyle = p.raddning ? '#fbbf24' : p.gron ? FARG_GRON : p.orange ? FARG_ORANGE : FARG_BLA
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, PINNE_R * skala, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
        return true
      })

      // pinnarna
      for (const p of s.pinnar) {
        if (p.traffad) {
          ctx.fillStyle = p.gron ? '#bbf7d0' : p.orange ? '#fed7aa' : '#dbeafe'
          ctx.beginPath()
          ctx.arc(p.x, p.y, PINNE_R + 2.5, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = p.gron ? FARG_GRON : p.orange ? FARG_ORANGE : FARG_BLA
        ctx.beginPath()
        ctx.arc(p.x, p.y, PINNE_R, 0, Math.PI * 2)
        ctx.fill()

        // gröna pinnar får en tydlig vit ring runt om — annars är de svåra
        // att skilja från orange på en liten, blank telefonskärm
        if (p.gron) {
          ctx.strokeStyle = 'rgba(255,255,255,.9)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, PINNE_R + 2, 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.fillStyle = 'rgba(255,255,255,.35)'
        ctx.beginPath()
        ctx.arc(p.x - 2, p.y - 2, PINNE_R * 0.35, 0, Math.PI * 2)
        ctx.fill()
      }

      partiklar.current = partiklar.current.filter((p) => {
        p.t += 1
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.1
        if (p.t > 24) return false
        ctx.globalAlpha = 1 - p.t / 24
        ctx.fillStyle = p.f
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
        ctx.globalAlpha = 1
        return true
      })

      // fyrverkerierna (feberstart och fackTraff)
      fyrverkeri.current = fyrverkeri.current.filter((p) => {
        p.t += 1
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.06
        p.vx *= 0.98
        if (p.t > 46) return false
        ctx.globalAlpha = 1 - p.t / 46
        ctx.fillStyle = p.f
        ctx.beginPath()
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        return true
      })

      // hinken — eller, efter oppnaFack(), de fem bonusfacken och deras
      // skiljeväggar i stället. s.hink är null i fack-läget (se motorn).
      if (s.hink) {
        ctx.fillStyle = '#22c55e'
        ctx.fillRect(s.hink.x - s.hink.bredd / 2, HOJD - 15, s.hink.bredd, 11)
        ctx.fillStyle = '#065f46'
        ctx.fillRect(s.hink.x - s.hink.bredd / 2 + 3, HOJD - 15, s.hink.bredd - 6, 4)
      } else if (s.fack) {
        const n = s.fack.length
        const fackBredd = BREDD / n
        for (let i = 0; i < n; i++) {
          const fx = i * fackBredd
          ctx.fillStyle = i === Math.floor(n / 2) ? '#facc15' : '#22c55e'
          ctx.fillRect(fx + 2, HOJD - FACK_HOJD, fackBredd - 4, FACK_HOJD - 4)
          ctx.fillStyle = '#0b1120'
          ctx.font = '600 11px system-ui,sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(s.fack[i].poang.toLocaleString('sv-SE'), fx + fackBredd / 2, HOJD - 10)
        }
        ctx.fillStyle = '#e5e7eb'
        for (const vx of s.fackVaggar) {
          ctx.beginPath()
          ctx.moveTo(vx - 3, HOJD + 20)
          ctx.lineTo(vx - 3, HOJD - FACK_HOJD + VAGG_R)
          ctx.arc(vx, HOJD - FACK_HOJD, VAGG_R, Math.PI, 0)
          ctx.lineTo(vx + 3, HOJD + 20)
          ctx.closePath()
          ctx.fill()
        }
      }

      // Avbryts skottet om man släpper nu? Bara relevant medan man siktar,
      // men beräknad här uppe så både pipan och siktlinjen kan fråga samma sak.
      const avbryterNu = siktar.current && iAvbrottzon.current

      // siktlinjen — bara medan man faktiskt siktar (håller nere) eller
      // hovrar med mus, inte hela tiden. Döljs också om man skulle avbryta,
      // så det syns att inget kommer att hända.
      if ((siktar.current || hovrarMus.current) && !avbryterNu && s.lage === 'siktar' && !slut) {
        const pts = siktlinje(s)
        ctx.fillStyle = 'rgba(255,255,255,.32)'
        pts.forEach(([x, y], i) => {
          if (i % 3) return
          ctx.beginPath()
          ctx.arc(x, y, 1.7, 0, Math.PI * 2)
          ctx.fill()
        })
      }

      // avbrytzonen — bara medan man siktar. En tunn linje och en text som
      // förklarar att ett släpp ovanför den inte avfyrar något.
      if (siktar.current) {
        const zonFarg = avbryterNu ? FARG_ROD : 'rgba(255,255,255,.4)'
        ctx.strokeStyle = zonFarg
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, avbrottzonHojd.current)
        ctx.lineTo(BREDD, avbrottzonHojd.current)
        ctx.stroke()
        ctx.fillStyle = zonFarg
        ctx.font = '500 10px system-ui,sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Släpp här för att avbryta', BREDD / 2, Math.max(10, avbrottzonHojd.current - 6))
      }

      // kanonen
      ctx.fillStyle = '#4b5563'
      ctx.beginPath()
      ctx.arc(BREDD / 2, 22, 10, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = avbryterNu ? FARG_ROD : '#d1d5db'
      ctx.lineWidth = 3.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(BREDD / 2, 22)
      ctx.lineTo(BREDD / 2 + Math.cos(s.vinkel) * 16, 22 + Math.sin(s.vinkel) * 16)
      ctx.stroke()

      // Ankarringen, den streckade linjen och fingerringen — bara medan man
      // siktar. Sikte är relativt nu (se KANSLIGHET-kommentaren ovan): linjen
      // går från ANKARET till fingret, inte från kanonen, eftersom det är
      // den förflyttningen som faktiskt styr vinkeln.
      if (siktar.current) {
        const linjeFarg = avbryterNu ? FARG_ROD : 'rgba(255,255,255,.85)'
        const fingerFarg = avbryterNu ? FARG_ROD : finlage.current ? FARG_BLA : 'rgba(255,255,255,.85)'
        ctx.save()

        ctx.strokeStyle = linjeFarg
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(siktAnkare.current.x, siktAnkare.current.y, ANKARE_RING_RADIE, 0, Math.PI * 2)
        ctx.stroke()

        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(siktAnkare.current.x, siktAnkare.current.y)
        ctx.lineTo(pekarLogisk.current.x, pekarLogisk.current.y)
        ctx.stroke()
        ctx.setLineDash([])

        ctx.strokeStyle = fingerFarg
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(pekarLogisk.current.x, pekarLogisk.current.y, FINGER_RING_RADIE, 0, Math.PI * 2)
        ctx.stroke()

        if (finlage.current) {
          ctx.fillStyle = fingerFarg
          ctx.font = '500 9px system-ui,sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('fin', pekarLogisk.current.x, pekarLogisk.current.y)
          ctx.textBaseline = 'alphabetic'
        }

        ctx.restore()
      }

      // kulorna och deras vakthundsringar — ett skott kan ha flera (trippel)
      for (const k of s.kulor) {
        ctx.fillStyle = '#f3f4f6'
        ctx.beginPath()
        ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2)
        ctx.fill()

        if (k.utanFramsteg > 600) {
          const andel = Math.min(1, k.utanFramsteg / 2500)
          ctx.strokeStyle = andel > 0.8 ? '#f87171' : '#fbbf24'
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(k.x, k.y, k.r + 7, -Math.PI / 2, -Math.PI / 2 + andel * Math.PI * 2)
          ctx.stroke()
        }
      }

      // flygande multiplikatorer
      flyt.current = flyt.current.filter((f) => {
        f.t += 1
        if (f.t > 40) return false
        ctx.globalAlpha = 1 - f.t / 40
        ctx.fillStyle = '#fbbf24'
        ctx.font = '500 14px system-ui,sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(f.text, f.x, f.y - f.t * 0.7)
        ctx.globalAlpha = 1
        return true
      })

      // Kameratransformen slutar här — bannern och "Slut på kulor" nedan
      // ritas i skärmkoordinater, aldrig zoomade.
      ctx.restore()

      // banner
      if (banner.current) {
        const b = banner.current
        b.t += dt
        if (b.t > b.ms) banner.current = null
        else {
          const in_ = Math.min(1, b.t / 200)
          ctx.globalAlpha = b.t > b.ms - 300 ? (b.ms - b.t) / 300 : 1
          ctx.fillStyle = b.farg
          ctx.font = '500 ' + b.storlek * (0.7 + in_ * 0.3) + 'px system-ui,sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(b.text, BREDD / 2, HOJD * 0.4)
          ctx.globalAlpha = 1
        }
      }

      if (slut) {
        ctx.fillStyle = 'rgba(0,0,0,.78)'
        ctx.fillRect(0, 0, BREDD, HOJD)
        ctx.fillStyle = '#9ca3af'
        ctx.font = '500 14px system-ui,sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Slut på kulor', BREDD / 2, HOJD / 2 - 16)
        ctx.fillStyle = '#f3f4f6'
        ctx.font = '500 28px system-ui,sans-serif'
        ctx.fillText(s.poang.toLocaleString('sv-SE'), BREDD / 2, HOJD / 2 + 18)
      }

      ctx.restore()
    }

    function loop(nu) {
      const dt = Math.min(50, nu - sist)
      sist = nu

      const s = spelRef.current
      if (!slut) {
        // Fysiktakten är frikopplad från bildrutetakten via en ackumulator:
        // steg() flyttar kulan lika mycket per anrop oavsett dtMs (dtMs
        // används bara till vakthundens tidtagning), så för att spela i
        // slowmotion måste vi anropa steg() mer sällan — inte med mindre
        // kraft. Att göra det med en ackumulator i stället för att hoppa
        // över steg baserat på Math.floor(nu/100) ger jämna, förutsägbara
        // pauser i stället för ryck, och gör dessutom den vanliga farten
        // oberoende av skärmens uppdateringsfrekvens.
        const hastighet = slowmo.current ? 4 : 1
        const stegStorlek = TAKT_MS * hastighet
        ackumulator.current += dt
        let vakt = 0
        while (ackumulator.current >= stegStorlek && vakt++ < 8) {
          const handelser = steg(s, stegStorlek)
          handelser.forEach(spelaHandelse)
          ackumulator.current -= stegStorlek
        }
      } else {
        ackumulator.current = 0
      }

      rita(dt)
      raf = requestAnimationFrame(loop)
    }

    uppdateraHud()
    raf = requestAnimationFrame(loop)

    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [slut, spelaHandelse, uppdateraHud])

  useEffect(() => {
    return () => {
      levande.current = false
      timers.current.forEach(clearTimeout)
    }
  }, [])

  // Stänger lådan och utför ett banbyte som väntade på just det.
  function stangLada() {
    setLadaKraftId(null)
    ladaOppen.current = false
    if (bytBanaVantar.current) {
      bytBanaVantar.current = false
      spelRef.current = nastaBana(spelRef.current)
      uppdateraHud()
    }
  }

  // ------------------------------------------------------------------- input
  //
  // Håll, dra, släpp — inte klicka. onPointerMove ensam räcker inte på en
  // pekskärm: det finns ingen hovring innan man rör vid glaset, så det gamla
  // "sikta med move, skjut med down" avfyrade skottet direkt i vilken vinkel
  // fingret råkade landa. Nu bara siktar nedtryckningen; skottet går av när
  // man släpper — och inte alls om man släpper i avbrytzonen.
  //
  // setPointerCapture låser pointermove/up/cancel till canvasen så att en
  // dragrörelse ut utanför kanten fortfarande styr siktet. Det är en ren
  // DOM-grej mellan pekaren och elementet — det bryr sig inte om vilket
  // element som råkar vara Fullscreen API:ets fullskärmselement (en
  // förfaderdiv i GameShell, inte canvasen), och överlever därför att
  // fullskärm växlas. En riktig fullskärmsväxling mitt i en dragning skulle
  // i värsta fall trigga pointercancel, vilket redan avbryter siktet säkert
  // utan att skjuta.

  // Räknar om en pekarhändelse till logiska canvas-koordinater plus hur hög
  // avbrytzonen är just nu i logiska pixlar. Mäts om varje gång i stället
  // för cachat, eftersom skalfaktorn ändras med elementets faktiska storlek
  // (t.ex. fullskärm) — allt bygger på getBoundingClientRect(), inget
  // hårdkodat.
  function logiskPosition(e) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return null
    const x = (e.clientX - r.left) * (BREDD / r.width)
    const y = (e.clientY - r.top) * (HOJD / r.height)
    // 44 verkliga pixlar omräknat till logiska, med det gamla värdet (24,
    // ~6 % av planhöjden) som golv på normalstora skärmar.
    const zonHojd = Math.max(ZON_MIN_LOGISK, ZON_MIN_REAL_PX * (HOJD / r.height))
    return { x, y, zonHojd }
  }

  // Uppdaterar bara pekarens position/avbrytzon, inte vinkeln — används av
  // både nedtryckning (som INTE ska ändra vinkeln) och den relativa
  // flyttlogiken (som beräknar vinkeln separat).
  function uppdateraPekarlage(pos) {
    pekarLogisk.current = { x: pos.x, y: pos.y }
    avbrottzonHojd.current = pos.zonHojd
    iAvbrottzon.current = pos.y < pos.zonHojd
  }

  function pekarNer(e) {
    if (slut || ladaKraftId) return
    // Redan en siktning igång (annat pointerId)? En andra pekare mot
    // canvasen ignoreras helt i stället för att kapa den första.
    if (siktar.current && e.pointerId !== aktivPekarId.current) return
    const pos = logiskPosition(e)
    if (!pos) return
    e.currentTarget.setPointerCapture(e.pointerId)
    siktar.current = true
    aktivPekarId.current = e.pointerId
    hovrarMus.current = false
    // Spara ankaret och vinkeln som redan gällde — man ska kunna börja dra
    // var som helst på planen utan att siktet hoppar till den positionen.
    siktAnkare.current = { x: pos.x, y: pos.y }
    siktStartVinkel.current = spelRef.current.vinkel
    finlage.current = false
    uppdateraPekarlage(pos)
  }

  function pekarFlytta(e) {
    if (siktar.current && e.pointerId !== aktivPekarId.current) return
    const pos = logiskPosition(e)
    if (!pos) return
    if (siktar.current) {
      uppdateraPekarlage(pos)

      const dx = pos.x - siktAnkare.current.x
      const dy = pos.y - siktAnkare.current.y
      finlage.current = dy > FINLAGE_TROSKEL_PX
      const kanslighet = finlage.current ? KANSLIGHET * FINLAGE_FAKTOR : KANSLIGHET
      const vinkel = siktStartVinkel.current + dx * RAD_PER_PX * kanslighet
      sikta(spelRef.current, vinkel)
    } else if (e.pointerType === 'mouse') {
      // Hovringssiktet för mus är oförändrat och fortfarande absolut —
      // musen har ingen fingertopp som skymmer sikteslinjen, så det gamla
      // beteendet är fortfarande det rätta där.
      hovrarMus.current = true
      pekarLogisk.current = { x: pos.x, y: pos.y }
      sikta(spelRef.current, Math.atan2(pos.y - 22, pos.x - BREDD / 2))
    }
  }

  function pekarSlapp(e) {
    if (!siktar.current || e.pointerId !== aktivPekarId.current) return
    siktar.current = false
    aktivPekarId.current = null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (slut || ladaKraftId) return
    if (iAvbrottzon.current) return // släppt ovanför kanonen — inget skott, ingen förlorad kula
    if (skjut(spelRef.current)) {
      ton(300, 70, 'sine', 0.1)
      uppdateraHud()
    }
  }

  function pekarAvbryt(e) {
    if (e.pointerId !== aktivPekarId.current) return
    siktar.current = false
    aktivPekarId.current = null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function pekarLamnar(e) {
    // Bara relevant för musens hovringsläge — en pågående siktning (med
    // pointer capture) ska inte påverkas av att pekaren fysiskt lämnar
    // elementets gränser.
    if (!siktar.current && e.pointerType === 'mouse') {
      hovrarMus.current = false
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div
        className="flex items-center justify-between text-xs px-1"
        style={{ width: 'var(--spelbredd, 400px)' }}
      >
        <div>
          <div className="text-gray-500">Poäng</div>
          <div className="text-gray-100 font-medium text-base tabular-nums">
            {hud.poang.toLocaleString('sv-SE')}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Orange</div>
          <div className="text-orange-400 font-medium text-base tabular-nums">{hud.orange}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-500">Kulor</div>
          <div
            className={`font-medium text-base tabular-nums ${
              hud.kulor <= 2 ? 'text-red-400' : 'text-gray-100'
            }`}
          >
            {hud.kulor}
          </div>
        </div>
      </div>

      {hud.aktivKraft && (
        <div
          className="flex items-center gap-1.5 text-xs px-1 -mt-1"
          style={{ width: 'var(--spelbredd, 400px)' }}
        >
          <span className="text-gray-500">Nästa skott:</span>
          <span style={{ color: GRADER[hud.aktivKraft.grad]?.farg }}>{hud.aktivKraft.namn}</span>
        </div>
      )}

      <div className="relative" style={{ width: 'var(--spelbredd, 400px)' }}>
        <canvas
          ref={canvasRef}
          width={BREDD}
          height={HOJD}
          onPointerDown={pekarNer}
          onPointerMove={pekarFlytta}
          onPointerUp={pekarSlapp}
          onPointerCancel={pekarAvbryt}
          onPointerLeave={pekarLamnar}
          className="w-full h-auto rounded-lg touch-none select-none cursor-crosshair"
        />
        {ladaKraftId && (
          <Kraftlada kraftId={ladaKraftId} onKlar={stangLada} ton={ton} />
        )}
      </div>

      <p className="text-xs text-gray-500 text-center max-w-[400px]">
        {slut
          ? 'Tryck "Igen" nedanför.'
          : `Bana ${hud.niva}. Träffa alla orange pinnar. Flera orange i samma skott ger multiplikator.`}
      </p>
    </div>
  )
}
