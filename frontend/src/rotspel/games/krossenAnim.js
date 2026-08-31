// Animationslagret för Krossen. Vet ingenting om React och ingenting om
// spelreglerna — det tar rutnummer och ritar saker.
//
// Varför separat modul: samma sex primitiver (pop, burst, flash, beam, ring,
// fall) används av varenda specialbricka och varenda kaskad. Motorn säger
// vilka rutor som träffas, det här lagret bestämmer i vilken ordning och hur
// det ser ut.
//
// Rutor identifieras med data-cell på brickornas DOM-noder. Det gör lagret
// oberoende av hur React nycklar sina element.

const OVER = 'cubic-bezier(.34,1.56,.64,1)'
const SNAP = 'cubic-bezier(.2,.9,.3,1)'
const GRAV = 'cubic-bezier(.45,0,.75,1)'
const KOLLAPS = 'cubic-bezier(.5,0,.9,.5)'

export function createAnimator(container, size) {
  // egna lager ovanpå brickorna: ett för svg-strålar, ett för partiklar
  let svgLager = container.querySelector('[data-lager="strålar"]')
  if (!svgLager) {
    svgLager = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgLager.setAttribute('data-lager', 'strålar')
    svgLager.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:20'
    container.appendChild(svgLager)
  }

  let installningar = { ljud: true, skak: true, hitstop: true }
  const timers = new Set()
  let levande = true

  function senare(fn, ms) {
    const t = setTimeout(() => {
      timers.delete(t)
      if (levande) fn()
    }, ms)
    timers.add(t)
    return t
  }

  // Vantan som gar genom timerlistan. Rensar forstor() timern resolvar
  // promisen aldrig, och den pagaende animationskedjan overges dar den star
  // i stallet for att fortsatta pa en losryckt container.
  function vila(ms) {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        timers.delete(t)
        resolve()
      }, ms)
      timers.add(t)
    })
  }

  const cellPx = () => container.clientWidth / size
  const el = (i) => container.querySelector('[data-cell="' + i + '"]')
  const rad = (i) => Math.floor(i / size)
  const kol = (i) => i % size
  const mittX = (i) => (kol(i) + 0.5) * cellPx()
  const mittY = (i) => (rad(i) + 0.5) * cellPx()
  const procent = 100 / size

  function tr(node, ms, ease, transform, opacity) {
    if (!node) return
    node.style.transition =
      'transform ' + ms + 'ms ' + ease + ',opacity ' + ms + 'ms linear'
    node.style.transform = transform
    if (opacity !== undefined) node.style.opacity = opacity
  }

  function nollstall(node) {
    if (!node) return
    node.style.transition = 'none'
    node.style.transform = ''
    node.style.opacity = '1'
  }

  // ------------------------------------------------------------ primitiver

  function burst(i, farg, antal = 7, spridning = 18) {
    const x = (mittX(i) / container.clientWidth) * 100
    const y = (mittY(i) / container.clientHeight) * 100

    for (let k = 0; k < antal; k++) {
      const p = document.createElement('div')
      const storlek = 3 + Math.random() * 4
      p.style.cssText =
        'position:absolute;border-radius:50%;pointer-events:none;z-index:15;left:' +
        x + '%;top:' + y + '%;width:' + storlek + 'px;height:' + storlek +
        'px;background:' + farg + ';margin-left:' + (-storlek / 2) +
        'px;margin-top:' + (-storlek / 2) + 'px'
      container.appendChild(p)

      const vinkel = Math.random() * Math.PI * 2
      const avstand = spridning + Math.random() * 24
      requestAnimationFrame(() => {
        p.style.transition =
          'transform 480ms cubic-bezier(.15,.7,.3,1),opacity 480ms linear'
        p.style.transform =
          'translate(' + Math.cos(vinkel) * avstand + 'px,' +
          (Math.sin(vinkel) * avstand + 10) + 'px) scale(.3)'
        p.style.opacity = '0'
      })
      senare(() => p.remove(), 520)
    }
  }

  function flash(i, ms = 190, hall = 70) {
    const f = document.createElement('div')
    f.style.cssText =
      'position:absolute;border-radius:8px;background:#fff;pointer-events:none;opacity:0;z-index:14;left:' +
      kol(i) * procent + '%;top:' + rad(i) * procent + '%;width:' + procent +
      '%;height:' + procent + '%'
    container.appendChild(f)
    requestAnimationFrame(() => {
      f.style.transition = 'opacity 60ms linear'
      f.style.opacity = '.9'
    })
    senare(() => {
      f.style.transition = 'opacity ' + ms + 'ms linear'
      f.style.opacity = '0'
    }, hall)
    senare(() => f.remove(), ms + hall + 60)
  }

  // Enskild bricka spricker: pumpa upp först, sedan kollapsa. Föregripandet
  // är hela skillnaden mellan "raderas" och "spricker".
  function pop(i, farg) {
    const node = el(i)
    if (!node) return
    tr(node, 70, OVER, 'scale(1.3)')
    senare(() => {
      burst(i, farg || '#9ca3af')
      tr(node, 150, KOLLAPS, 'scale(0) rotate(30deg)', 0)
    }, 70)
  }

  // Flera brickor spricker i våg, sorterade efter avstånd från en punkt.
  // Det här är den enskilt viktigaste animationen i spelet: samma rutor,
  // men en våg läses som en explosion i stället för en tillståndsändring.
  async function popVag(celler, { origin = null, steg = 40, fargFor } = {}) {
    const lista = [...celler]
    if (origin !== null) {
      lista.sort(
        (a, b) =>
          Math.hypot(mittX(a) - mittX(origin), mittY(a) - mittY(origin)) -
          Math.hypot(mittX(b) - mittX(origin), mittY(b) - mittY(origin))
      )
    }
    lista.forEach((i, k) => senare(() => pop(i, fargFor ? fargFor(i) : null), k * steg))
    await vila(lista.length * steg + 240)
  }

  function stral(fran, till, ms = 180, fordrojning = 0, farg = '#f472b6') {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    l.setAttribute('x1', mittX(fran))
    l.setAttribute('y1', mittY(fran))
    l.setAttribute('x2', mittX(till))
    l.setAttribute('y2', mittY(till))
    l.setAttribute('stroke', farg)
    l.setAttribute('stroke-width', '2')
    l.setAttribute('stroke-linecap', 'round')

    const langd = Math.hypot(mittX(till) - mittX(fran), mittY(till) - mittY(fran))
    l.setAttribute('stroke-dasharray', langd)
    l.setAttribute('stroke-dashoffset', langd)
    l.style.opacity = '.9'
    svgLager.appendChild(l)

    senare(() => {
      l.style.transition =
        'stroke-dashoffset ' + ms + 'ms cubic-bezier(.2,.8,.3,1),opacity 240ms linear ' +
        (ms + 70) + 'ms'
      l.setAttribute('stroke-dashoffset', '0')
      l.style.opacity = '0'
    }, fordrojning)
    senare(() => l.remove(), fordrojning + ms + 400)
  }

  function linjeStral(i, lodrat) {
    const b = document.createElement('div')
    b.style.cssText = lodrat
      ? 'position:absolute;top:0;bottom:0;z-index:18;left:' + (kol(i) + 0.5) * procent +
        '%;width:3px;margin-left:-1.5px;background:#fff;border-radius:2px;transform:scaleY(0);opacity:.95;pointer-events:none'
      : 'position:absolute;left:0;right:0;z-index:18;top:' + (rad(i) + 0.5) * procent +
        '%;height:3px;margin-top:-1.5px;background:#fff;border-radius:2px;transform:scaleX(0);opacity:.95;pointer-events:none'
    container.appendChild(b)
    requestAnimationFrame(() => {
      b.style.transition =
        'transform 140ms cubic-bezier(.2,.8,.3,1),opacity 260ms linear 120ms'
      b.style.transform = lodrat ? 'scaleY(1)' : 'scaleX(1)'
      b.style.opacity = '0'
    })
    senare(() => b.remove(), 440)
  }

  function ring(i, storleksfaktor, farg = '#fbbf24', ms = 400) {
    const storlek = cellPx() * storleksfaktor
    const r = document.createElement('div')
    r.style.cssText =
      'position:absolute;z-index:16;pointer-events:none;border-radius:50%;border:3px solid ' +
      farg + ';left:' + (mittX(i) / container.clientWidth) * 100 + '%;top:' +
      (mittY(i) / container.clientHeight) * 100 + '%;width:' + storlek + 'px;height:' +
      storlek + 'px;margin-left:' + (-storlek / 2) + 'px;margin-top:' + (-storlek / 2) +
      'px;transform:scale(.08)'
    container.appendChild(r)
    requestAnimationFrame(() => {
      r.style.transition =
        'transform ' + ms + 'ms cubic-bezier(.15,.75,.3,1),opacity ' + ms + 'ms linear'
      r.style.transform = 'scale(1)'
      r.style.opacity = '0'
    })
    senare(() => r.remove(), ms + 60)
  }

  function skaka(styrka, ms) {
    if (!installningar.skak) return
    const start = Date.now()
    ;(function steg() {
      if (!levande) {
        container.style.transform = ''
        return
      }
      const gatt = Date.now() - start
      if (gatt > ms) {
        container.style.transform = ''
        return
      }
      const d = styrka * (1 - gatt / ms)
      container.style.transform =
        'translate(' + (Math.random() * 2 - 1) * d + 'px,' +
        (Math.random() * 2 - 1) * d + 'px)'
      requestAnimationFrame(steg)
    })()
  }

  function banner(text, { storlek = 22, farg = '#fbbf24', ms = 800 } = {}) {
    const b = document.createElement('div')
    b.style.cssText =
      'position:absolute;left:0;right:0;top:34%;text-align:center;pointer-events:none;z-index:25;font-weight:500;opacity:0;font-size:' +
      storlek + 'px;color:' + farg
    b.textContent = text
    container.appendChild(b)
    requestAnimationFrame(() => {
      b.style.transition = 'transform 220ms ' + OVER + ',opacity 160ms linear'
      b.style.transform = 'scale(1.1)'
      b.style.opacity = '1'
    })
    senare(() => {
      b.style.opacity = '0'
      b.style.transform = 'scale(1.35) translateY(-14px)'
    }, ms - 220)
    senare(() => b.remove(), ms)
  }

  // Kort frys precis före en stor smäll. Pausen skapar en förväntan som
  // smällen sedan infriar — utan den flyter uppladdning och explosion ihop.
  function hitstop(ms = 70) {
    if (!installningar.hitstop) return Promise.resolve()
    return vila(ms)
  }

  // ------------------------------------------------------------------ fall

  // Anropas EFTER att React har renderat det nya brädet. Knepet är att sätta
  // slutläget först och sedan förskjuta brickan bakåt, så animeringen bara
  // behöver gå till noll.
  //
  // moves: [{ till, franRad }] där franRad är negativ för nya brickor.
  async function fall(moves) {
    const p = cellPx()
    const fallande = moves.filter((m) => Math.floor(m.till / size) - m.franRad !== 0)
    if (fallande.length === 0) return

    for (const m of fallande) {
      const node = el(m.till)
      if (!node) continue
      const avstand = (Math.floor(m.till / size) - m.franRad) * p
      node.style.transition = 'none'
      node.style.transform = 'translateY(' + -avstand + 'px)'
      node.style.opacity = '1'
    }

    // en frame så webbläsaren hinner måla startläget
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    let langst = 0
    for (const m of fallande) {
      const node = el(m.till)
      if (!node) continue
      const steg = Math.floor(m.till / size) - m.franRad
      // längre fall tar längre tid, annars ser det ut som en kuliss som dras ner
      const ms = 165 + steg * 34
      langst = Math.max(langst, ms)
      tr(node, ms, GRAV, 'translateY(0)')
      // squash vid landning: bredden ökar när höjden minskar, ytan bevaras
      senare(() => {
        tr(node, 78, SNAP, 'scaleX(1.15) scaleY(.85)')
        senare(() => tr(node, 160, OVER, 'scaleX(1) scaleY(1)'), 78)
      }, ms)
    }

    await vila(langst + 250)
    fallande.forEach((m) => nollstall(el(m.till)))
  }

  // ----------------------------------------------------------------- byten

  async function byte(a, b, giltigt) {
    const na = el(a)
    const nb = el(b)
    if (!na || !nb) return

    const p = cellPx()
    const dx = (kol(b) - kol(a)) * p
    const dy = (rad(b) - rad(a)) * p

    if (giltigt) {
      tr(na, 190, OVER, 'translate(' + dx + 'px,' + dy + 'px)')
      tr(nb, 190, OVER, 'translate(' + -dx + 'px,' + -dy + 'px)')
      await vila(210)
      nollstall(na)
      nollstall(nb)
      return
    }

    // ogiltigt: åk halvvägs och studsa tillbaka, så man ser att det nekades
    tr(na, 130, SNAP, 'translate(' + dx * 0.45 + 'px,' + dy * 0.45 + 'px)')
    tr(nb, 130, SNAP, 'translate(' + -dx * 0.45 + 'px,' + -dy * 0.45 + 'px)')
    await vila(140)
    tr(na, 220, OVER, 'translate(0,0)')
    tr(nb, 220, OVER, 'translate(0,0)')
    await vila(240)
    nollstall(na)
    nollstall(nb)
  }

  // Brickorna reser in mot platsen där specialbrickan ska skapas. Att de
  // färdas dit förklarar visuellt var den nya brickan kom ifrån.
  async function skapaSpecial(celler, plats, typ) {
    const p = cellPx()

    for (const i of celler) {
      if (i === plats) continue
      const node = el(i)
      if (!node) continue
      const dx = (kol(plats) - kol(i)) * p
      const dy = (rad(plats) - rad(i)) * p
      tr(
        node,
        300,
        'cubic-bezier(.55,0,.75,.2)',
        'translate(' + dx + 'px,' + dy + 'px) scale(.4)' +
          (typ === 'prisma' ? ' rotate(180deg)' : ''),
        0.75
      )
    }
    const mitten = el(plats)
    tr(mitten, 300, SNAP, 'scale(.6)')

    await vila(320)
    flash(plats, 300, 60)
    burst(plats, typ === 'prisma' ? '#f472b6' : '#fbbf24', 14, 24)
    if (typ === 'prisma') {
      ring(plats, 2.4, '#f472b6', 500)
      senare(() => ring(plats, 3.2, '#60a5fa', 540), 100)
    }
  }

  // Specialbrickan poppar fram med överskjutning. Anropas efter att React
  // har renderat den nya brickan på plats.
  async function visaSpecial(plats) {
    const node = el(plats)
    if (!node) return
    node.style.transition = 'none'
    node.style.transform = 'scale(0.2)'
    node.style.opacity = '1'
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    tr(node, 140, OVER, 'scale(1.55)')
    await vila(150)
    tr(node, 400, OVER, 'scale(1)')
    await vila(420)
    nollstall(node)
  }

  // --------------------------------------------------------------- städning

  function pulsera(i, storlek = 1.25, ms = 400) {
    const node = el(i)
    if (!node) return
    tr(node, ms / 2, SNAP, 'scale(' + storlek + ')')
    senare(() => tr(node, ms / 2, OVER, 'scale(1)'), ms / 2)
  }

  function vagga(celler) {
    celler.forEach((i, k) => {
      const node = el(i)
      if (!node) return
      node.style.animation = 'krossVagga 700ms ease-in-out infinite'
      node.style.animationDelay = k * 90 + 'ms'
    })
  }

  function slutaVagga(celler) {
    celler.forEach((i) => {
      const node = el(i)
      if (!node) return
      node.style.animation = ''
      node.style.animationDelay = ''
    })
  }

  function forstor() {
    levande = false
    timers.forEach(clearTimeout)
    timers.clear()
    container.style.transform = ''
    // partiklar, ringar och strålar som hunnit läggas till
    container.querySelectorAll('[data-lager="strålar"] line').forEach((n) => n.remove())
  }

  function setInstallningar(nya) {
    installningar = nya
  }

  return {
    pop,
    popVag,
    burst,
    flash,
    stral,
    linjeStral,
    ring,
    skaka,
    banner,
    hitstop,
    fall,
    byte,
    skapaSpecial,
    visaSpecial,
    pulsera,
    vagga,
    slutaVagga,
    setInstallningar,
    forstor,
    cellPx,
  }
}
