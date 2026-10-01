// Krossen — effektlagret. Vet ingenting om React och ingenting om reglerna.
// Det får rutnummer och pjäs-id och ritar saker.
//
// Två sorters effekter:
//   DOM   pjäserna själva: byten, fall, smällar. Web Animations API, så
//         React kan rendera klart läget och vi bara spelar upp vägen dit.
//   canvas  allt som flyger: splitter, gnistor, chockvågor, raketer,
//           blixtar och konfetti. En enda canvas med en enda loop.

const OVER = 'cubic-bezier(.34,1.56,.64,1)'
const SNAP = 'cubic-bezier(.2,.9,.3,1)'
const KOLLAPS = 'cubic-bezier(.5,0,.9,.5)'
const MARGINAL = 48 // canvasen sticker ut så mycket utanför brädet

export function skapaFx({ bradet, lager, canvas, textlager, w, h }) {
  let installningar = { ljud: true, skak: true, hitstop: true }
  let levande = true
  const timers = new Set()
  const partiklar = []
  let raf = null
  let dpr = 1

  const ctx = canvas.getContext('2d')

  // --------------------------------------------------------------- geometri

  const cell = () => bradet.clientWidth / w
  const mitt = (i) => {
    const p = cell()
    return { x: ((i % w) + 0.5) * p, y: (Math.floor(i / w) + 0.5) * p }
  }
  const nod = (id) => lager.querySelector('[data-id="' + id + '"]')
  const inre = (id) => {
    const n = nod(id)
    return n ? n.firstElementChild || n : null
  }

  function anpassaCanvas() {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    const bw = bradet.clientWidth + MARGINAL * 2
    const bh = bradet.clientHeight + MARGINAL * 2
    canvas.width = Math.round(bw * dpr)
    canvas.height = Math.round(bh * dpr)
    canvas.style.width = bw + 'px'
    canvas.style.height = bh + 'px'
  }
  anpassaCanvas()
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(anpassaCanvas) : null
  if (ro) ro.observe(bradet)

  // ----------------------------------------------------------------- timers

  function senare(fn, ms) {
    const t = setTimeout(() => {
      timers.delete(t)
      if (levande) fn()
    }, ms)
    timers.add(t)
    return t
  }

  function vila(ms) {
    return new Promise((resolve) => {
      if (ms <= 0) return resolve()
      const t = setTimeout(() => {
        timers.delete(t)
        resolve()
      }, ms)
      timers.add(t)
    })
  }

  const tvaFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

  // --------------------------------------------------------------- partiklar

  // Partiklar kan läggas till inifrån loopen (raketens gnistspår). Utan
  // spärren skulle varje sådan schemalägga en egen extra loop, och antalet
  // loopar per bildruta växa för varje bildruta.
  let iLoop = false
  function starta() {
    if (raf === null && levande && !iLoop) raf = requestAnimationFrame(loop)
  }

  let senast = 0
  function loop(nu) {
    raf = null
    if (!levande) return
    iLoop = true
    try {
      steg(nu)
    } finally {
      iLoop = false
    }
    if (partiklar.length) raf = requestAnimationFrame(loop)
    else {
      senast = 0
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  function steg(nu) {
    const raa = senast ? (nu - senast) / 1000 : 0.016
    const dt = Math.min(0.05, raa)
    senast = nu
    snittDt = snittDt * 0.85 + Math.min(0.2, raa) * 0.15
    if (snittDt > 0.028) tak = Math.max(60, tak - 25)
    else if (snittDt < 0.019) tak = Math.min(TAK_MAX, tak + 4)
    if (partiklar.length > tak) partiklar.splice(0, partiklar.length - tak)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    bas()

    for (let k = partiklar.length - 1; k >= 0; k--) {
      const p = partiklar[k]
      if (p.fordrojning > 0) {
        p.fordrojning -= dt * 1000
        continue
      }
      p.liv += dt
      if (p.liv >= p.max) {
        partiklar.splice(k, 1)
        continue
      }
      const t = p.liv / p.max
      if (p.steg) p.steg(p, dt)
      p.vx += (p.ax || 0) * dt
      p.vy += (p.ay || 0) * dt
      if (p.drag) {
        p.vx *= 1 - p.drag * dt
        p.vy *= 1 - p.drag * dt
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot = (p.rot || 0) + (p.vr || 0) * dt
      rita(p, t)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  // Allt som roterar eller är fyllt ritas som färdiga små bilder: en per
  // form och färg, skapade en gång. drawImage är mycket billigare än att
  // bygga en ny bana per partikel och bildruta.
  const former = new Map()
  function form(typ, farg) {
    const nyckel = typ + farg
    let c = former.get(nyckel)
    if (c) return c
    c = document.createElement('canvas')
    c.width = c.height = 24
    const g = c.getContext('2d')
    g.fillStyle = farg
    g.beginPath()
    if (typ === 'rund') g.arc(12, 12, 11, 0, Math.PI * 2)
    else if (typ === 'splitter') {
      g.moveTo(1, 5)
      g.lineTo(23, 9)
      g.lineTo(9, 23)
    } else if (typ === 'stjarna') {
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 5 : 11.5
        const v = (k / 10) * Math.PI * 2 - Math.PI / 2
        g.lineTo(12 + Math.cos(v) * r, 12 + Math.sin(v) * r)
      }
    } else if (typ === 'konfetti') g.rect(1, 7, 22, 10)
    else if (typ === 'blad') g.ellipse(12, 12, 11, 5, 0, 0, Math.PI * 2)
    g.closePath()
    g.fill()
    former.set(nyckel, c)
    return c
  }

  function bas() {
    ctx.setTransform(dpr, 0, 0, dpr, dpr * MARGINAL, dpr * MARGINAL)
  }

  // Roterad och skalad bild centrerad på (x, y). sx/sy är halva bredden.
  function stampel(bild, x, y, rot, sx, sy) {
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const kx = sx / 12
    const ky = sy / 12
    ctx.setTransform(dpr * cos * kx, dpr * sin * kx, -dpr * sin * ky, dpr * cos * ky, dpr * (x + MARGINAL), dpr * (y + MARGINAL))
    ctx.drawImage(bild, -12, -12)
    bas()
  }

  function rita(p, t) {
    const alfa = p.tona === false ? 1 : 1 - Math.pow(t, p.tonaExp || 1.6)
    ctx.globalAlpha = Math.max(0, alfa) * (p.alfa ?? 1)
    ctx.globalCompositeOperation = p.glod ? 'lighter' : 'source-over'
    switch (p.typ) {
      case 'prick': {
        const s = p.storlek * (p.krymp ? 1 - t * 0.7 : 1)
        ctx.drawImage(form('rund', p.farg), p.x - s, p.y - s, s * 2, s * 2)
        break
      }
      case 'splitter': {
        const s = p.storlek * (1 - t * 0.5)
        stampel(form('splitter', p.farg), p.x, p.y, p.rot, s, s)
        break
      }
      case 'gnista': {
        const s = p.storlek * (1 - t) * 3
        ctx.drawImage(sprite(p.farg), p.x - s, p.y - s, s * 2, s * 2)
        break
      }
      case 'stjarna': {
        const s = p.storlek * (p.krymp === false ? 1 : 1 - t * 0.6)
        stampel(form('stjarna', p.farg), p.x, p.y, p.rot, s, s)
        break
      }
      case 'konfetti': {
        const s = p.storlek / 2
        stampel(form('konfetti', p.farg), p.x, p.y, p.rot, s, s * Math.cos(p.liv * p.flipp))
        break
      }
      case 'blad':
        stampel(form('blad', p.farg), p.x, p.y, p.rot, p.storlek, p.storlek)
        break
      case 'ring': {
        const e = 1 - Math.pow(1 - t, 3)
        const r = p.r0 + (p.r1 - p.r0) * e
        ctx.strokeStyle = p.farg
        ctx.lineWidth = p.bredd * (1 - t * 0.7)
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'blixt': {
        ctx.strokeStyle = p.farg
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        const langd = Math.min(1, p.liv / (p.ritTid || 0.001))
        const pts = p.punkter
        const n = Math.max(2, Math.ceil(pts.length * langd))
        for (const [bredd, a] of [
          [p.bredd * 3, 0.35],
          [p.bredd, 1],
        ]) {
          ctx.globalAlpha = Math.max(0, 1 - t) * a
          ctx.lineWidth = bredd
          ctx.beginPath()
          ctx.moveTo(pts[0][0], pts[0][1])
          for (let k = 1; k < n; k++) ctx.lineTo(pts[k][0], pts[k][1])
          ctx.stroke()
        }
        break
      }
    }
  }

  // Glöden ritas från färdiga små bilder i stället för en ny gradient per
  // partikel och bildruta — annars orkar en telefon inte ett godisregn.
  const sprites = new Map()
  function sprite(farg) {
    let c = sprites.get(farg)
    if (c) return c
    c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, farg)
    grad.addColorStop(0.35, farg)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 32, 32)
    sprites.set(farg, c)
    return c
  }

  // Taket skyddar mot att tusentals partiklar samlas under en lång kedja.
  // Det som överskrider det är bara pynt, så det får helt enkelt utebli.
  // Taket sänks av sig självt om bildrutorna blir långsamma (en äldre
  // telefon) och kryper upp igen när det går lätt.
  const TAK_MAX = 450
  let tak = TAK_MAX
  let snittDt = 0.016
  function lagg(p) {
    if (partiklar.length >= tak) return
    partiklar.push({ liv: 0, fordrojning: 0, rot: 0, vr: 0, ...p })
    starta()
  }

  // Splitter och gnistor från en ruta. Färgen är pjäsens.
  function splittra(i, farg, { antal = 10, kraft = 1, fordrojning = 0, ljus } = {}) {
    const { x, y } = mitt(i)
    const p = cell()
    for (let k = 0; k < antal; k++) {
      const v = Math.random() * Math.PI * 2
      const fart = (80 + Math.random() * 220) * kraft * (p / 44)
      lagg({
        typ: k % 3 === 0 ? 'prick' : 'splitter',
        x: x + Math.cos(v) * p * 0.15,
        y: y + Math.sin(v) * p * 0.15,
        vx: Math.cos(v) * fart,
        vy: Math.sin(v) * fart - 60,
        ay: 520,
        drag: 1.2,
        vr: (Math.random() - 0.5) * 18,
        storlek: (2.5 + Math.random() * 4) * (p / 44),
        farg,
        max: 0.5 + Math.random() * 0.35,
        fordrojning,
        krymp: true,
      })
    }
    for (let k = 0; k < Math.ceil(antal / 3); k++) {
      const v = Math.random() * Math.PI * 2
      const fart = (40 + Math.random() * 120) * kraft
      lagg({
        typ: 'gnista',
        glod: true,
        x,
        y,
        vx: Math.cos(v) * fart,
        vy: Math.sin(v) * fart,
        drag: 3,
        storlek: 2 + Math.random() * 2.5,
        farg: ljus || '#fffbe6',
        max: 0.35 + Math.random() * 0.25,
        fordrojning,
      })
    }
  }

  function ring(i, radieCeller, farg = '#fff6c2', { bredd = 5, ms = 420, fordrojning = 0 } = {}) {
    const { x, y } = mitt(i)
    lagg({ typ: 'ring', glod: true, x, y, vx: 0, vy: 0, r0: cell() * 0.2, r1: cell() * radieCeller, farg, bredd, max: ms / 1000, fordrojning })
  }

  function gnistor(x, y, farg, antal = 6, fart = 90) {
    for (let k = 0; k < antal; k++) {
      const v = Math.random() * Math.PI * 2
      lagg({
        typ: 'gnista',
        glod: true,
        x,
        y,
        vx: Math.cos(v) * fart * Math.random(),
        vy: Math.sin(v) * fart * Math.random(),
        drag: 2.5,
        storlek: 1.5 + Math.random() * 2,
        farg,
        max: 0.3 + Math.random() * 0.3,
      })
    }
  }

  // ------------------------------------------------------------- signaturer

  // Raketen: två glödande huvuden flyger åt var sitt håll längs raden eller
  // kolumnen och drar gnistor efter sig. msPerCell styr hur fort — pjäserna
  // i vägen spricker i samma takt.
  // minus och plus är hur många rutor raketen hinner åt vardera hållet innan
  // den tar slut (vid kanten eller en tennisboll). Utan dem far den ut över
  // hela brädet.
  function raket(i, lodrat, farg, { msPerCell = 26, fordrojning = 0, minus = null, plus = null } = {}) {
    const { x, y } = mitt(i)
    const p = cell()
    const fart = p / (msPerCell / 1000)
    const helt = (lodrat ? h : w) * p + p
    const langd = Math.max(minus ?? 99, plus ?? 99) >= 99 ? helt : Math.max(minus, plus) * p + p * 0.5
    for (const riktning of [-1, 1]) {
      const n = riktning < 0 ? minus : plus
      const stracka = n === null ? helt : n * p + p * 0.4
      lagg({
        typ: 'gnista',
        glod: true,
        x,
        y,
        vx: lodrat ? 0 : fart * riktning,
        vy: lodrat ? fart * riktning : 0,
        storlek: p * 0.22,
        farg: '#ffffff',
        max: stracka / fart,
        tona: false,
        fordrojning,
        steg: (q) => {
          if (Math.random() < 0.55) {
            lagg({
              typ: 'prick',
              glod: true,
              x: q.x + (Math.random() - 0.5) * p * 0.2,
              y: q.y + (Math.random() - 0.5) * p * 0.2,
              vx: (Math.random() - 0.5) * 60 - q.vx * 0.05,
              vy: (Math.random() - 0.5) * 60 - q.vy * 0.05,
              drag: 2,
              storlek: 1.5 + Math.random() * 2.5,
              farg: Math.random() < 0.5 ? farg : '#fff3b0',
              max: 0.28,
              krymp: true,
            })
          }
        },
      })
    }
    // en ljusstrimma längs den bit av linjen raketen hinner
    const kol = i % w
    const rad = Math.floor(i / w)
    const fore = minus ?? (lodrat ? rad : kol)
    const efter = plus ?? (lodrat ? h - 1 - rad : w - 1 - kol)
    const strimma = document.createElement('div')
    strimma.className = 'kr-strimma'
    const pos = lodrat
      ? `left:${(kol + 0.5) * (100 / w)}%;top:${(rad - fore) * (100 / h)}%;height:${(fore + efter + 1) * (100 / h)}%;width:${p * 0.5}px;margin-left:${-p * 0.25}px;transform:scaleY(0)`
      : `top:${(rad + 0.5) * (100 / h)}%;left:${(kol - fore) * (100 / w)}%;width:${(fore + efter + 1) * (100 / w)}%;height:${p * 0.5}px;margin-top:${-p * 0.25}px;transform:scaleX(0)`
    strimma.style.cssText = pos + `;background:linear-gradient(${lodrat ? '90deg' : '0deg'},transparent,${farg}aa,#fff,${farg}aa,transparent)`
    strimma.style.transformOrigin = lodrat ? `50% ${((fore + 0.5) / (fore + efter + 1)) * 100}%` : `${((fore + 0.5) / (fore + efter + 1)) * 100}% 50%`
    senare(() => {
      textlager.appendChild(strimma)
      strimma.animate(
        [
          { transform: lodrat ? 'scaleY(0)' : 'scaleX(0)', opacity: 1 },
          { transform: lodrat ? 'scaleY(1)' : 'scaleX(1)', opacity: 0.9, offset: 0.5 },
          { transform: lodrat ? 'scaleY(1)' : 'scaleX(1)', opacity: 0 },
        ],
        { duration: Math.max(260, (langd / fart) * 1000 * 1.1), easing: 'ease-out' }
      )
      senare(() => strimma.remove(), Math.max(300, (langd / fart) * 1100) + 40)
    }, fordrojning)
  }

  function bomb(i, farg, radie = 1, fordrojning = 0) {
    ring(i, 1.6 + radie * 1.2, '#fff4c4', { bredd: 7, ms: 420, fordrojning })
    ring(i, 1.2 + radie, farg, { bredd: 4, ms: 360, fordrojning: fordrojning + 50 })
    splittra(i, farg, { antal: 16 + radie * 8, kraft: 1.5, fordrojning, ljus: '#fff1a8' })
    senare(() => skaka(5 + radie * 3, 260), fordrojning)
    senare(() => blixt(i), fordrojning)
  }

  // En blixt från A till B. Punkterna skakas i sidled så det ser elektriskt ut.
  function stral(fran, till, farg = '#ffe9ff', { fordrojning = 0, ms = 260, bredd = 2.6 } = {}) {
    const a = mitt(fran)
    const b = mitt(till)
    const pts = [[a.x, a.y]]
    const n = 7
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    for (let k = 1; k < n; k++) {
      const t = k / n
      const off = (Math.random() - 0.5) * cell() * 0.5
      pts.push([a.x + dx * t + nx * off, a.y + dy * t + ny * off])
    }
    pts.push([b.x, b.y])
    lagg({ typ: 'blixt', glod: true, x: 0, y: 0, vx: 0, vy: 0, punkter: pts, farg, bredd, max: ms / 1000, ritTid: 0.08, fordrojning })
  }

  // Frisbeen: en kopia av pjäsen flyger i en båge till målet och snurrar.
  async function frisbee(fran, till, idFran, { ms = 520 } = {}) {
    const kalla = nod(idFran)
    const p = cell()
    const a = mitt(fran)
    const b = mitt(till)
    const flyg = document.createElement('div')
    flyg.className = 'kr-flygare'
    flyg.style.cssText = `width:${p}px;height:${p}px;left:${a.x - p / 2}px;top:${a.y - p / 2}px`
    flyg.innerHTML = kalla ? kalla.innerHTML : ''
    textlager.appendChild(flyg)
    const topp = -Math.max(p * 1.5, Math.abs(b.x - a.x) * 0.35)
    const steg = []
    for (let k = 0; k <= 12; k++) {
      const t = k / 12
      const x = (b.x - a.x) * t
      const y = (b.y - a.y) * t + topp * 4 * t * (1 - t)
      steg.push({ transform: `translate(${x}px,${y}px) rotate(${t * 720}deg) scale(${1 + Math.sin(t * Math.PI) * 0.35})` })
    }
    const anim = flyg.animate(steg, { duration: ms, easing: 'cubic-bezier(.3,.1,.4,1)', fill: 'forwards' })
    const spar = setInterval(() => {
      const r = flyg.getBoundingClientRect()
      const br = bradet.getBoundingClientRect()
      gnistor(r.left - br.left + r.width / 2, r.top - br.top + r.height / 2, '#fff6c2', 2, 40)
    }, 40)
    await vila(ms)
    clearInterval(spar)
    anim.cancel()
    flyg.remove()
    ring(till, 1.4, '#ffffff', { bredd: 4, ms: 300 })
  }

  // Skärmblixt över en ruta.
  function blixt(i) {
    const p = cell()
    const { x, y } = mitt(i)
    const f = document.createElement('div')
    f.className = 'kr-ljus'
    f.style.cssText = `left:${x - p * 1.5}px;top:${y - p * 1.5}px;width:${p * 3}px;height:${p * 3}px`
    textlager.appendChild(f)
    f.animate([{ opacity: 0.95, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.3)' }], { duration: 320, easing: 'ease-out' })
    senare(() => f.remove(), 340)
  }

  // --------------------------------------------------------------- pjäserna

  function popp(id, i, farg, fordrojning = 0, { kraft = 1 } = {}) {
    const n = inre(id)
    senare(() => {
      if (n) {
        n.animate(
          [
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(1.28)', opacity: 1, offset: 0.35, easing: KOLLAPS },
            { transform: 'scale(0) rotate(25deg)', opacity: 0 },
          ],
          { duration: 210, fill: 'forwards' }
        )
      }
      senare(() => splittra(i, farg, { antal: 7, kraft }), 70)
    }, fordrojning)
  }

  // Pjäserna i en grupp dras ihop mot rutan där specialpjäsen föds.
  function samla(celler, plats, idVid) {
    const p = cell()
    const m = mitt(plats)
    for (const i of celler) {
      if (i === plats) continue
      const n = inre(idVid(i))
      if (!n) continue
      const c = mitt(i)
      n.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${m.x - c.x}px,${m.y - c.y}px) scale(.45)`, opacity: 0.8 },
        ],
        { duration: 190, easing: 'cubic-bezier(.55,0,.75,.2)', fill: 'forwards' }
      )
    }
    const mn = inre(idVid(plats))
    if (mn) mn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }], { duration: 190, fill: 'forwards' })
    return p
  }

  // En pjäs som ingår i gruppen men blir kvar (ett godis i koppel) rycker
  // till mot specialpjäsen och studsar tillbaka. Ingen fill — den ska stå
  // på sin egen plats efteråt.
  function rycka(id, fran, mot) {
    const n = inre(id)
    if (!n) return
    const a = mitt(fran)
    const b = mitt(mot)
    const dx = (b.x - a.x) * 0.22
    const dy = (b.y - a.y) * 0.22
    n.animate(
      [
        { transform: 'translate(0,0) scale(1)' },
        { transform: `translate(${dx}px,${dy}px) scale(.9)`, offset: 0.45 },
        { transform: 'translate(0,0) scale(1)' },
      ],
      { duration: 320, easing: 'ease-out' }
    )
  }

  // Säkerhetsnät. En animation med fill: 'forwards' håller kvar sitt
  // slutläge så länge elementet finns. Det är meningen för pjäser som
  // spricker eller dras ihop — de försvinner när React ritar nästa läge.
  // Finns elementet kvar efter det var slutläget aldrig menat att hålla, så
  // det släpps. Då kan ingen pjäs bli hängande osynlig eller förskjuten, hur
  // en framtida effekt än råkar se ut.
  function stada() {
    const behall = (a) => a.playState !== 'finished' || a.effect?.getComputedTiming?.().fill !== 'forwards'
    for (const n of bradet.querySelectorAll('[data-id], [data-koppel], [data-lera]')) {
      for (const el of [n, n.firstElementChild]) {
        if (!el || !el.getAnimations) continue
        for (const a of el.getAnimations()) if (!behall(a)) a.cancel()
      }
    }
  }

  async function visaNy(id, farg) {
    const n = inre(id)
    if (!n) return
    n.animate(
      [
        { transform: 'scale(.2) rotate(-30deg)', filter: 'brightness(3)' },
        { transform: 'scale(1.45) rotate(8deg)', filter: 'brightness(1.6)', offset: 0.4 },
        { transform: 'scale(1) rotate(0)', filter: 'brightness(1)' },
      ],
      { duration: 460, easing: OVER }
    )
    const node = nod(id)
    if (node) {
      const i = Number(node.dataset.cell)
      ring(i, 1.3, farg || '#fff', { bredd: 4, ms: 380 })
      const { x, y } = mitt(i)
      for (let k = 0; k < 8; k++) {
        const v = (k / 8) * Math.PI * 2
        lagg({ typ: 'stjarna', glod: true, x, y, vx: Math.cos(v) * 120, vy: Math.sin(v) * 120, drag: 3, storlek: 4, farg: '#fff6c2', max: 0.5, vr: 4 })
      }
    }
  }

  function pulsera(id, skala = 1.25, ms = 260) {
    const n = inre(id)
    if (!n) return
    n.animate([{ transform: 'scale(1)' }, { transform: `scale(${skala})`, offset: 0.4 }, { transform: 'scale(1)' }], { duration: ms, easing: SNAP })
  }

  // Byte: pjäserna glider förbi varandra. Returnerar en funktion som tar bort
  // förflyttningen — anropa den när React har renderat det nya läget.
  async function byte(idA, idB, a, b, giltigt) {
    const na = nod(idA)
    const nb = nod(idB)
    const p = cell()
    const dx = ((b % w) - (a % w)) * p
    const dy = (Math.floor(b / w) - Math.floor(a / w)) * p
    const anims = []
    if (giltigt) {
      if (na) anims.push(na.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)` }], { duration: 170, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }))
      if (nb) anims.push(nb.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-dx}px,${-dy}px)` }], { duration: 170, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }))
      if (na) na.style.zIndex = 5
      await vila(175)
      return () => {
        anims.forEach((x) => x.cancel())
        if (na) na.style.zIndex = ''
      }
    }
    const fram = [{ transform: 'translate(0,0)' }, { transform: `translate(${dx * 0.42}px,${dy * 0.42}px)`, offset: 0.4 }, { transform: 'translate(0,0)' }]
    const bak = [{ transform: 'translate(0,0)' }, { transform: `translate(${-dx * 0.42}px,${-dy * 0.42}px)`, offset: 0.4 }, { transform: 'translate(0,0)' }]
    if (na) na.animate(fram, { duration: 330, easing: 'ease-in-out' })
    if (nb) nb.animate(bak, { duration: 330, easing: 'ease-in-out' })
    await vila(340)
    return () => {}
  }

  // Fallet. moves kommer från motorn: varje pjäs har ett spår av
  // { t, r, c } per takt. React har redan ritat slutläget, så varje pjäs
  // förskjuts bakåt längs sitt spår och animeras till noll.
  async function fall(moves, taktMs = 62) {
    const p = cell()
    let slut = 0
    const landningar = []
    for (const m of moves) {
      const n = nod(m.id)
      if (!n) continue
      const s = m.spar
      const sista = s[s.length - 1]
      const t0 = s[0].t
      const t1 = sista.t
      if (t1 <= t0) continue
      const kf = s.map((q, k) => ({
        transform: `translate(${(q.c - sista.c) * p}px,${(q.r - sista.r) * p}px)`,
        offset: (q.t - t0) / (t1 - t0),
        opacity: m.ny && k === 0 ? 0 : 1,
        easing: k === 0 ? 'cubic-bezier(.5,0,1,1)' : 'linear',
      }))
      const dur = (t1 - t0) * taktMs
      n.animate(kf, { duration: dur, delay: t0 * taktMs, fill: 'backwards' })
      slut = Math.max(slut, t0 * taktMs + dur)
      landningar.push([n, t0 * taktMs + dur])
    }
    for (const [n, ms] of landningar) {
      const i = n.firstElementChild
      if (!i) continue
      i.animate(
        [
          { transform: 'scale(1,1)' },
          { transform: 'scale(1.12,.86) translateY(6%)', offset: 0.3 },
          { transform: 'scale(.96,1.05)', offset: 0.65 },
          { transform: 'scale(1,1)' },
        ],
        { duration: 210, delay: ms, easing: 'ease-out' }
      )
    }
    await vila(slut + 60)
  }

  // Omblandning: allt krymper mot mitten och flyger ut till nya platser.
  async function blanda() {
    const noder = [...lager.querySelectorAll('[data-id]')]
    const br = bradet.getBoundingClientRect()
    for (const n of noder) {
      const r = n.getBoundingClientRect()
      const dx = br.left + br.width / 2 - (r.left + r.width / 2)
      const dy = br.top + br.height / 2 - (r.top + r.height / 2)
      n.animate(
        [
          { transform: `translate(${dx}px,${dy}px) scale(.2) rotate(180deg)`, opacity: 0.3 },
          { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
        ],
        { duration: 520, easing: OVER, delay: Math.random() * 120 }
      )
    }
    await vila(660)
  }

  function skakaNod(id, styrka = 4) {
    const n = inre(id)
    if (!n) return
    n.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: `translate(${-styrka}px,0) rotate(-4deg)` },
        { transform: `translate(${styrka}px,0) rotate(4deg)` },
        { transform: `translate(${-styrka / 2}px,0)` },
        { transform: 'translate(0,0)' },
      ],
      { duration: 240 }
    )
  }

  // -------------------------------------------------------------- hinder

  function lada(i, kvar, fordrojning = 0, id) {
    senare(() => {
      if (kvar > 0 && id) skakaNod(id, 5)
      splittra(i, kvar > 0 ? '#c99256' : '#a86e36', { antal: kvar > 0 ? 7 : 16, kraft: kvar > 0 ? 0.7 : 1.2, ljus: '#ffe7c2' })
    }, fordrojning)
  }

  function ograss(i, fordrojning = 0) {
    senare(() => {
      const { x, y } = mitt(i)
      for (let k = 0; k < 12; k++) {
        const v = Math.random() * Math.PI * 2
        lagg({
          typ: 'blad',
          x,
          y,
          vx: Math.cos(v) * (60 + Math.random() * 120),
          vy: Math.sin(v) * (60 + Math.random() * 120) - 80,
          ay: 360,
          drag: 1.4,
          vr: (Math.random() - 0.5) * 10,
          storlek: 3 + Math.random() * 4,
          farg: ['#2b7431', '#35883a', '#b9d98a', '#c65bdc'][k % 4],
          max: 0.7,
        })
      }
    }, fordrojning)
  }

  function koppel(i, fordrojning = 0) {
    senare(() => {
      const n = lager.parentElement.querySelector('[data-koppel="' + i + '"]')
      if (n) n.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.5) rotate(20deg)', opacity: 0 }], { duration: 260, fill: 'forwards' })
      splittra(i, '#e02a44', { antal: 8, kraft: 0.8, ljus: '#dfe6ee' })
    }, fordrojning)
  }

  function lera(i, fordrojning = 0) {
    senare(() => {
      const { x, y } = mitt(i)
      for (let k = 0; k < 9; k++) {
        const v = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
        lagg({
          typ: 'prick',
          x,
          y: y + cell() * 0.2,
          vx: Math.cos(v) * (60 + Math.random() * 90),
          vy: Math.sin(v) * (90 + Math.random() * 120),
          ay: 600,
          storlek: 2 + Math.random() * 3.5,
          farg: ['#7a5028', '#916236', '#5e3a1b'][k % 3],
          max: 0.55,
          krymp: true,
        })
      }
      const n = lager.parentElement.querySelector('[data-lera="' + i + '"]')
      if (n) n.animate([{ transform: 'scale(1)' }, { transform: 'scale(.85)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 260 })
    }, fordrojning)
  }

  // --------------------------------------------------------------- text

  // Poäng som flyter upp där det smällde.
  function poang(i, text, farg) {
    const { x, y } = mitt(i)
    const el = document.createElement('div')
    el.className = 'kr-poang'
    el.textContent = text
    el.style.cssText = `left:${x}px;top:${y}px;color:${farg}`
    textlager.appendChild(el)
    el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: 'translate(-50%,-80%) scale(1.1)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%,-200%) scale(1)', opacity: 0 },
      ],
      { duration: 900, easing: 'ease-out' }
    )
    senare(() => el.remove(), 920)
  }

  // Stora berömord mitt på brädet: Gott! Ljuvligt! Himmelskt!
  function berom(text, niva = 1) {
    const el = document.createElement('div')
    el.className = 'kr-berom kr-berom-' + Math.min(4, niva)
    el.textContent = text
    textlager.appendChild(el)
    el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.2) rotate(-12deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.25) rotate(4deg)', opacity: 1, offset: 0.18 },
        { transform: 'translate(-50%,-50%) scale(1) rotate(-2deg)', opacity: 1, offset: 0.32 },
        { transform: 'translate(-50%,-50%) scale(1.04) rotate(0)', opacity: 1, offset: 0.75 },
        { transform: 'translate(-50%,-90%) scale(1.3)', opacity: 0 },
      ],
      { duration: 1250, easing: 'ease-out' }
    )
    senare(() => el.remove(), 1270)
    const bw = bradet.clientWidth
    const bh = bradet.clientHeight
    for (let k = 0; k < 10 + niva * 6; k++) {
      const v = Math.random() * Math.PI * 2
      lagg({
        typ: 'stjarna',
        glod: true,
        x: bw / 2 + Math.cos(v) * bw * 0.2,
        y: bh * 0.42 + Math.sin(v) * bh * 0.08,
        vx: Math.cos(v) * (120 + Math.random() * 200),
        vy: Math.sin(v) * (80 + Math.random() * 160),
        drag: 2,
        vr: (Math.random() - 0.5) * 8,
        storlek: 3 + Math.random() * 4,
        farg: ['#fff6c2', '#ffd35c', '#ff9ecb', '#9fe7ff'][k % 4],
        max: 0.8,
      })
    }
  }

  function banner(text, { farg = '#ffffff', storlek = 1, ms = 1100 } = {}) {
    const el = document.createElement('div')
    el.className = 'kr-banner'
    el.textContent = text
    el.style.color = farg
    el.style.fontSize = `calc(${storlek} * min(7vw, 30px))`
    textlager.appendChild(el)
    el.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-50%,-70%) scale(1)', opacity: 0 },
      ],
      { duration: ms, easing: 'ease-out' }
    )
    senare(() => el.remove(), ms + 20)
  }

  // Konfetti över hela brädet när banan är klar.
  function konfetti(antal = 90) {
    const bw = bradet.clientWidth
    const f = ['#f03a5f', '#ff8a1c', '#ffd21f', '#34c05a', '#2f8af0', '#a452ec', '#ffffff']
    for (let k = 0; k < antal; k++) {
      lagg({
        typ: 'konfetti',
        x: Math.random() * bw,
        y: -MARGINAL * 0.5 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 80,
        vy: 60 + Math.random() * 120,
        ay: 90,
        drag: 0.6,
        vr: (Math.random() - 0.5) * 8,
        flipp: 6 + Math.random() * 8,
        storlek: 6 + Math.random() * 6,
        farg: f[k % f.length],
        max: 2.6 + Math.random() * 1.2,
        tonaExp: 6,
        fordrojning: Math.random() * 500,
      })
    }
  }

  // En glödande prick som flyger från en punkt utanför brädet (t.ex.
  // dragräknaren) till en ruta. Används av godisregnet.
  async function flygIn(franX, franY, till, farg, ms = 360) {
    const b = mitt(till)
    const x0 = franX
    const y0 = franY
    const t0 = performance.now()
    await new Promise((resolve) => {
      function steg() {
        if (!levande) return resolve()
        const t = Math.min(1, (performance.now() - t0) / ms)
        const e = t * t * (3 - 2 * t)
        const x = x0 + (b.x - x0) * e
        const y = y0 + (b.y - y0) * e - Math.sin(t * Math.PI) * 60
        gnistor(x, y, farg, 3, 30)
        lagg({ typ: 'gnista', glod: true, x, y, vx: 0, vy: 0, storlek: 5, farg: '#ffffff', max: 0.08 })
        if (t < 1) requestAnimationFrame(steg)
        else resolve()
      }
      steg()
    })
    ring(till, 1.1, farg, { bredd: 3, ms: 300 })
  }

  // Punkt i brädets koordinater för ett element utanför brädet.
  function punktFor(el) {
    if (!el) return { x: bradet.clientWidth / 2, y: -20 }
    const r = el.getBoundingClientRect()
    const br = bradet.getBoundingClientRect()
    return { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 }
  }

  // ------------------------------------------------------------ tips/idle

  function vagga(ids) {
    ids.forEach((id, k) => {
      const n = inre(id)
      if (!n) return
      n.classList.add('kr-vagga')
      n.style.animationDelay = k * 90 + 'ms'
    })
  }

  function slutaVagga() {
    lager.querySelectorAll('.kr-vagga').forEach((n) => {
      n.classList.remove('kr-vagga')
      n.style.animationDelay = ''
    })
  }

  function glimt(id) {
    const n = inre(id)
    if (!n) return
    n.animate(
      [
        { transform: 'scale(1) rotate(0)', filter: 'brightness(1)' },
        { transform: 'scale(1.08,.94) rotate(-4deg)', filter: 'brightness(1.25)', offset: 0.3 },
        { transform: 'scale(.97,1.05) rotate(3deg)', filter: 'brightness(1.1)', offset: 0.6 },
        { transform: 'scale(1) rotate(0)', filter: 'brightness(1)' },
      ],
      { duration: 520, easing: 'ease-in-out' }
    )
  }

  // ------------------------------------------------------------- övrigt

  function skaka(styrka, ms) {
    if (!installningar.skak) return
    bradet.animate(
      Array.from({ length: 8 }, (_, k) => {
        const d = styrka * (1 - k / 8)
        return { transform: `translate(${(Math.random() * 2 - 1) * d}px,${(Math.random() * 2 - 1) * d}px)` }
      }).concat([{ transform: 'translate(0,0)' }]),
      { duration: ms }
    )
  }

  function hitstop(ms = 70) {
    if (!installningar.hitstop) return Promise.resolve()
    return vila(ms)
  }

  function forstor() {
    levande = false
    timers.forEach(clearTimeout)
    timers.clear()
    if (raf !== null) cancelAnimationFrame(raf)
    if (ro) ro.disconnect()
    partiklar.length = 0
  }

  return {
    cell,
    mitt,
    vila,
    senare,
    tvaFrames,
    setInstallningar: (x) => (installningar = x),
    splittra,
    ring,
    raket,
    bomb,
    stral,
    frisbee,
    blixt,
    popp,
    samla,
    rycka,
    stada,
    visaNy,
    pulsera,
    byte,
    fall,
    blanda,
    skakaNod,
    lada,
    ograss,
    koppel,
    lera,
    poang,
    berom,
    banner,
    konfetti,
    flygIn,
    punktFor,
    vagga,
    slutaVagga,
    glimt,
    skaka,
    hitstop,
    forstor,
  }
}
