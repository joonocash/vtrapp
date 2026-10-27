// Kulkaos — händelserna bakom ❓-dörren (som i Slay the Spire och Peglin).
// Ingen DOM. Varje val har kan(r) (går det att välja?) och gor(r, slump,
// verktyg) som ger { runda, text }. verktyg = funktioner från runda.js
// (slumpUppg, slumpRelik, geUppg, geRelik), så att filen inte behöver
// importera runda.js.

export const HANDELSER = [
  {
    id: 'automat',
    ikon: '🎰',
    namn: 'Spelautomaten',
    text: 'En gammal spelautomat blinkar i hörnet. Den tar 20 guld.',
    val: [
      {
        text: 'Spela (20 guld)',
        kan: (r) => r.guld >= 20,
        gor(r, slump) {
          const x = slump()
          if (x < 0.45) return { runda: { ...r, guld: r.guld - 20 }, text: 'Tre olika frukter. Inget den här gången.' }
          if (x < 0.85) return { runda: { ...r, guld: r.guld + 40 }, text: 'Tre körsbär! Du vinner 60 guld.' }
          return { runda: { ...r, guld: r.guld + 130 }, text: 'JACKPOTT! 150 guld rasslar ut.' }
        },
      },
      { text: 'Gå vidare', gor: (r) => ({ runda: r, text: 'Du låter automaten vara.' }) },
    ],
  },
  {
    id: 'godis',
    ikon: '🍖',
    namn: 'Hundgodiset',
    text: 'Happy har hittat en hel påse hundgodis. Han delar gärna.',
    val: [
      { text: '+6 kulor', gor: (r) => ({ runda: { ...r, kulor: r.kulor + 6 }, text: 'Sex nya kulor. Happy viftar på svansen.' }) },
      { text: '+45 guld', gor: (r) => ({ runda: { ...r, guld: r.guld + 45 }, text: 'Du säljer godiset vidare för 45 guld.' }) },
    ],
  },
  {
    id: 'brunnen',
    ikon: '⛲',
    namn: 'Önskebrunnen',
    text: 'En brunn full av mynt. Den som önskar något ska släppa i 30 guld.',
    val: [
      {
        text: 'Önska (30 guld)',
        kan: (r) => r.guld >= 30,
        gor(r, slump, v) {
          const id = v.slumpUppg({ ...r, guld: r.guld - 30 }, slump, 3)
          if (!id) return { runda: r, text: 'Brunnen är tyst.' }
          return { runda: v.geUppg({ ...r, guld: r.guld - 30 }, id), text: `Önskan går i uppfyllelse: ${v.namn(id)}!` }
        },
      },
      { text: 'Gå förbi', gor: (r) => ({ runda: r, text: 'Du behåller dina mynt.' }) },
    ],
  },
  {
    id: 'forbannad',
    ikon: '💀',
    namn: 'Den förbannade kistan',
    text: 'En kista med en dödskalle på locket. Den ser full ut, men något känns fel.',
    val: [
      {
        text: 'Öppna (−4 kulor)',
        kan: (r) => r.kulor > 4,
        gor(r, slump, v) {
          let ny = { ...r, kulor: r.kulor - 4 }
          const fick = []
          for (let i = 0; i < 2; i++) {
            const id = v.slumpUppg(ny, slump)
            if (!id) break
            fick.push(v.namn(id))
            ny = v.geUppg(ny, id)
          }
          return { runda: ny, text: fick.length ? `Förbannelsen tar fyra kulor, men du får ${fick.join(' och ')}.` : 'Kistan var tom.' }
        },
      },
      { text: 'Låt den vara', gor: (r) => ({ runda: r, text: 'Säkert är säkert.' }) },
    ],
  },
  {
    id: 'trollkarl',
    ikon: '🧙',
    namn: 'Trollkarlen',
    text: '”Ge mig en av dina krafter, så ger jag dig en bättre”, säger trollkarlen.',
    val: [
      {
        text: 'Byt',
        kan: (r) => Object.values(r.varig).some((n) => n > 0),
        gor(r, slump, v) {
          const har = Object.keys(r.varig).filter((id) => r.varig[id] > 0 && v.grad(id) < 4)
          if (!har.length) return { runda: r, text: 'Trollkarlen hittar inget att ta.' }
          const ut = har[Math.floor(slump() * har.length)]
          const varig = { ...r.varig, [ut]: r.varig[ut] - 1 }
          let ny = { ...r, varig }
          const id = v.slumpUppg(ny, slump, Math.min(3, v.grad(ut) + 1))
          if (id) ny = v.geUppg(ny, id)
          return { runda: ny, text: id ? `${v.namn(ut)} blir ${v.namn(id)}.` : `Trollkarlen tar ${v.namn(ut)} och försvinner i ett rökmoln.` }
        },
      },
      { text: 'Nej tack', gor: (r) => ({ runda: r, text: 'Trollkarlen ser besviken ut.' }) },
    ],
  },
  {
    id: 'ekorre',
    ikon: '🐿️',
    namn: 'Ekorren',
    text: 'En ekorre erbjuder sig att hjälpa dig välja bättre. Den vill ha 15 guld.',
    val: [
      { text: 'Betala 15 guld', kan: (r) => r.guld >= 15, gor: (r) => ({ runda: { ...r, guld: r.guld - 15, omslag: r.omslag + 2, slang: r.slang + 1 }, text: 'Två omslag och en släng till.' }) },
      { text: 'Gå vidare', gor: (r) => ({ runda: r, text: 'Ekorren försvinner upp i ett träd.' }) },
    ],
  },
  {
    id: 'regnbage',
    ikon: '🌈',
    namn: 'Regnbågen',
    text: 'Vid regnbågens fot ligger tre gåvor. Du får ta en.',
    val: [
      { text: '🟢 Grön pinne', gor: (r, s, v) => ({ runda: v.geUppg(r, 'gron'), text: 'En grön pinne till på varje bana.' }) },
      { text: '🪣 Större hink', gor: (r, s, v) => ({ runda: v.geUppg(r, 'hink'), text: 'Hinken växer.' }) },
      { text: '🏦 Kulbanken', gor: (r, s, v) => ({ runda: v.geUppg(r, 'bank'), text: 'En kula till efter varje bana.' }) },
    ],
  },
  {
    id: 'tarning',
    ikon: '🎲',
    namn: 'Tärningsspelet',
    text: 'En räv vill spela tärning med dig. Det kostar inget att kasta.',
    val: [
      {
        text: 'Kasta',
        gor(r, slump, v) {
          const t = 1 + Math.floor(slump() * 6)
          if (t <= 2) return { runda: { ...r, kulor: Math.max(1, r.kulor - 3) }, text: `Du slog ${t}. Räven tar tre kulor.` }
          if (t <= 4) return { runda: { ...r, guld: r.guld + 35 }, text: `Du slog ${t}. 35 guld!` }
          const id = v.slumpRelik(r, slump)
          return id ? { runda: v.geRelik(r, id), text: `Du slog ${t}! Räven ger dig ${v.relikNamn(id)}.` } : { runda: { ...r, guld: r.guld + 60 }, text: `Du slog ${t}! 60 guld.` }
        },
      },
      { text: 'Gå vidare', gor: (r) => ({ runda: r, text: 'Räven ser lite besviken ut.' }) },
    ],
  },
  {
    id: 'hittegods',
    ikon: '📦',
    namn: 'Hittegodset',
    text: 'Någon har tappat ett paket. Det är inte adresserat till någon.',
    val: [
      {
        text: 'Öppna',
        gor(r, slump, v) {
          const id = v.slumpRelik(r, slump)
          return id ? { runda: v.geRelik(r, id), text: `I paketet ligger ${v.relikNamn(id)}!` } : { runda: { ...r, guld: r.guld + 50 }, text: 'Paketet är fullt av guld: 50.' }
        },
      },
    ],
  },
  {
    id: 'smeden',
    ikon: '⚒️',
    namn: 'Smeden',
    text: 'Smeden kan göra en av dina krafter starkare. Det kostar 40 guld.',
    val: [
      {
        text: 'Smid (40 guld)',
        kan: (r) => r.guld >= 40 && Object.values(r.varig).some((n) => n > 0),
        gor(r, slump, v) {
          const har = Object.keys(r.varig).filter((id) => r.varig[id] > 0 && v.kanHoja(r, id))
          if (!har.length) return { runda: r, text: 'Allt du har är redan så starkt det kan bli.' }
          const id = har[Math.floor(slump() * har.length)]
          return { runda: v.geUppg({ ...r, guld: r.guld - 40 }, id), text: `${v.namn(id)} går upp en nivå.` }
        },
      },
      { text: 'Gå vidare', gor: (r) => ({ runda: r, text: 'Smeden fortsätter hamra.' }) },
    ],
  },
]
