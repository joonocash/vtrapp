// Kulkaos — hjältarna, uppgraderingarna och relikerna. Ingen DOM.
//
// Hjältarna är inspirerade av Ball x Pit och Brotato: varje hjälte ändrar en
// regel i spelet (en spegelkula, kulor som går igenom blå pinnar, studs på
// golvet …), ofta med en nackdel. Tre finns från början. De andra låser man
// upp med utmaningar, eller köper för ben i Hundkojan.
//
// Uppgraderingarna väljs efter varje bana (som nivåerna i Vampire Survivors).
// grad: 1 vanlig, 2 sällsynt, 3 episk, 4 evolution. max saknas = inget tak.
// direkt = tas en gång och är sedan borta. krav = en evolution som går att få
// när de andra har nått sina nivåer. las = låst tills utmaningen är klar.
//
// Relikerna (som i Peglin) får man från elitbanor, bossar och butiken. Var
// och en finns bara en gång och ändrar något i hela rundan.

export const NYA_KULOR = 4

export const HJALTAR = [
  { id: 'happy', namn: 'Happy', ikon: '🐶', kraft: 'spar', start: { sikte: 1, hink: 1 }, nya: 5, text: 'Allrounder. Siktet och större hink från start, och en extra kula efter varje bana' },
  { id: 'konfekt', namn: 'Kaninen Konfekt', ikon: '🐰', kraft: 'multi', perk: { tvilling: 1 }, nya: 2, text: 'Varje skott skjuter en spegelkula åt andra hållet. Bara två nya kulor per bana' },
  { id: 'katten', namn: 'Rymdkatten', ikon: '🐱', kraft: 'small', start: { bomber: 2 }, text: 'Fyra bomber på varje bana från start, och gröna smäller' },
  { id: 'svea', namn: 'Spöket Svea', ikon: '👻', kraft: 'spok', spokAlltid: true, ingenHink: true, text: 'Alla kulor kommer tillbaka uppifrån en gång. Men det finns ingen hink', las: 'akt1' },
  { id: 'glod', namn: 'Draken Glöd', ikon: '🐲', kraft: 'eld', start: { eldkula: 1 }, perk: { eldstor: 1 }, nya: 3, text: 'Första skottet på varje bana är en jättestor eldboll. En kula mindre per bana', las: 'eld40' },
  { id: 'blom', namn: 'Biet Blom', ikon: '🐝', kraft: 'blomma', start: { magnet: 1 }, perk: { honung: 1 }, text: 'Magnet från start, och varje orange pinne ger guld', las: 'guld200' },
  { id: 'taggis', namn: 'Igelkotten Taggis', ikon: '🦔', kraft: 'small', perk: { genom: 1 }, text: 'Kulan går rakt igenom blå pinnar och studsar bara på resten', las: 'traffar60' },
  { id: 'atta', namn: 'Bläckfisken Åtta', ikon: '🐙', kraft: 'multi', perk: { flerskott: 2 }, startKulor: 7, nya: 1, text: 'Skjuter tre kulor åt gången. Börjar med sju kulor och får bara en ny per bana', las: 'kulor30' },
  { id: 'klok', namn: 'Ugglan Klok', ikon: '🦉', kraft: 'spar', start: { sikte: 1 }, perk: { grav: 0.65 }, text: 'Kulan svävar: lägre tyngdkraft och långt siktspår', las: 'langskott' },
  { id: 'hopp', namn: 'Grodan Hopp', ikon: '🐸', kraft: 'small', perk: { golv: 2 }, text: 'Kulan studsar upp från golvet två gånger per skott', las: 'akt2' },
  { id: 'raven', namn: 'Räven Rik', ikon: '🦊', kraft: 'blomma', guldX: 2, rabatt: 0.25, valFarre: 1, text: 'Dubbelt guld och 25 % billigare butik, men ett val färre på korten', las: 'kop8' },
  { id: 'seg', namn: 'Sköldpaddan Seg', ikon: '🐢', kraft: 'spok', start: { jatte: 2 }, startKulor: 18, nya: 2, text: 'Börjar med 18 kulor och en jättekula, men får bara två nya per bana', las: 'rundor10' },
  { id: 'kalle', namn: 'Kaos-Kalle', ikon: '🃏', kraft: 'slump', auto: true, text: 'Ny grön kraft varje bana och två gratis uppgraderingar, men du väljer aldrig själv', las: 'seger' },
]
export const hjalte = (id) => HJALTAR.find((h) => h.id === id) || HJALTAR[0]
export const HJALTE_PRIS = 250 // ben, för den som hellre köper än klarar utmaningen

export const UPPGRADERINGAR = {
  // direkt
  kulor: { ikon: '➕', namn: '+4 kulor', grad: 1, direkt: true, text: () => 'Fyra kulor till, direkt' },
  guldpase: { ikon: '💰', namn: 'Guldpåse', grad: 1, direkt: true, text: () => '40 guld, direkt' },
  omslag: { ikon: '🎲', namn: 'Omslag', grad: 1, direkt: true, text: () => 'Två omslag till: slå om valen' },
  trippel: { ikon: '3×', namn: 'Trippelpoäng', grad: 2, direkt: true, text: () => 'Tre gånger poängen i två skott på nästa bana' },

  // vanliga, utan tak
  gron: { ikon: '🟢', namn: 'Grön pinne', grad: 1, text: (n) => (n === 1 ? 'En grön pinne till på varje bana' : `${n} gröna pinnar till på varje bana`) },
  hink: { ikon: '🪣', namn: 'Större hink', grad: 1, text: (n) => `Hinken blir bredare (+${14 * n} px)` },
  bank: { ikon: '🏦', namn: 'Kulbanken', grad: 1, text: (n) => `+${n} ${n === 1 ? 'kula' : 'kulor'} extra efter varje bana` },
  poang: { ikon: '✨', namn: 'Poängregn', grad: 1, text: (n) => `+${25 * n} % poäng på allt` },
  guldnos: { ikon: '🪙', namn: 'Guldnosen', grad: 1, text: (n) => `+${25 * n} % guld` },
  guldpinnar: { ikon: '🟡', namn: 'Guldpinnar', grad: 1, text: (n) => `${2 * n} guldpinnar till på varje bana` },

  // sällsynta
  eldkula: { ikon: '🔥', namn: 'Eldkula', grad: 2, max: 5, text: (n) => (n === 1 ? 'Första skottet på varje bana är en stor eldboll' : `De ${n} första skotten på varje bana är eldbollar`) },
  spoke: { ikon: '👻', namn: 'Spökkula', grad: 2, max: 5, text: (n) => (n === 1 ? 'Första skottet på varje bana kommer tillbaka uppifrån' : `De ${n} första skotten på varje bana kommer tillbaka`) },
  jatte: { ikon: '⚪', namn: 'Jättekula', grad: 2, max: 4, text: (n) => `Kulan är ${15 * n} % större och träffar mer` },
  magnet: { ikon: '🧲', namn: 'Magnet', grad: 2, max: 4, text: (n) => (n === 1 ? 'Kulan dras mot orange pinnar' : `Magneten drar starkare (nivå ${n})`) },
  delning: { ikon: '🎱', namn: 'Delning', grad: 2, max: 5, text: (n) => `Första träffen i varje skott delar kulan i ${n + 1}` },
  bomber: { ikon: '💣', namn: 'Bomber', grad: 2, max: 6, text: (n) => `${2 * n} blå pinnar på varje bana är bomber` },
  hinkmagnet: { ikon: '🎯', namn: 'Hinkmagnet', grad: 2, max: 3, text: (n) => (n === 1 ? 'Kulorna dras mot hinken längst ner' : `Hinkmagneten drar starkare (nivå ${n})`) },
  golv: { ikon: '🦘', namn: 'Studsgolv', grad: 2, max: 3, text: (n) => (n === 1 ? 'Kulan studsar upp från golvet en gång per skott' : `Kulan studsar upp från golvet ${n} gånger per skott`) },
  fjader: { ikon: '🪶', namn: 'Fjäderlätt', grad: 2, max: 3, text: (n) => `${12 * n} % lägre tyngdkraft: kulan svävar längre` },
  jagare: { ikon: '🗡️', namn: 'Bossjägaren', grad: 2, max: 5, text: (n) => `+${20 * n} % skada på bossar` },
  lyckoslant: { ikon: '🤞', namn: 'Lyckoslanten', grad: 2, max: 1, text: () => 'Ett skott som inte träffar något ger alltid kulan tillbaka' },

  // episka
  lila: { ikon: '🟣', namn: 'Lila lycka', grad: 3, max: 3, text: (n) => (n === 1 ? 'Lila pinnen ger en extra kula' : `${n} lila pinnar per skott, var och en ger en kula`) },
  smalla: { ikon: '💥', namn: 'Storsmäll', grad: 3, max: 4, text: (n) => (n === 1 ? 'Varje grön pinne smäller och tänder allt runt sig' : `Smällen blir större (nivå ${n})`) },
  sikte: { ikon: '🔮', namn: 'Siktet', grad: 3, max: 1, text: () => 'Långt siktspår hela rundan' },
  tur: { ikon: '🍀', namn: 'Tur', grad: 3, max: 3, text: (n) => (n === 1 ? 'Ett val till på korten, och fler sällsynta' : 'Ännu fler sällsynta val') },
  blixt: { ikon: '⚡', namn: 'Kedjeblixt', grad: 3, max: 3, las: 'akt1', text: (n) => `Varje orange som träffas skickar en blixt till ${n} ${n === 1 ? 'pinne' : 'pinnar'} till` },
  kulfabrik: { ikon: '🏭', namn: 'Kulfabriken', grad: 3, max: 3, las: 'evolution', text: (n) => `Var ${14 - 2 * n}:e träff i ett skott ger en ny kula` },
  flerskott: { ikon: '🔱', namn: 'Extrakanon', grad: 3, max: 2, las: 'miljon', text: (n) => `Varje skott skjuter ${n + 1} kulor` },
  genom: { ikon: '📌', namn: 'Genomborr', grad: 3, max: 1, las: 'rensat5', text: () => 'Kulan går rakt igenom blå pinnar' },

  // evolutioner
  meteor: { ikon: '☄️', namn: 'Meteorregn', grad: 4, max: 1, krav: { eldkula: 2, jatte: 2 }, text: () => 'Eldbollarna blir enorma, och varje orange de bränner smäller' },
  kulregn: { ikon: '🌧️', namn: 'Kulregn', grad: 4, max: 1, krav: { delning: 2, gron: 2 }, text: () => 'Varje grön pinne skjuter ut två nya kulor' },
  guldhink: { ikon: '🏆', namn: 'Guldhinken', grad: 4, max: 1, krav: { hink: 3, bank: 2 }, text: () => 'Hinken ger två kulor och 25 000 poäng' },
  fyrverkeri: { ikon: '🎆', namn: 'Fyrverkeri', grad: 4, max: 1, krav: { bomber: 2, smalla: 1 }, text: () => 'Bomberna smäller större och skjuter ut en kula var' },
  blixtstorm: { ikon: '🌩️', namn: 'Blixtstormen', grad: 4, max: 1, krav: { blixt: 2, magnet: 2 }, text: () => 'Blixtarna når längre och slår ner i tre pinnar till' },
  midas: { ikon: '🏅', namn: 'Kung Midas', grad: 4, max: 1, krav: { guldnos: 2, guldpinnar: 2 }, text: () => 'Orange pinnar ger guld, och guldpinnar smäller' },
  kulkanon: { ikon: '💫', namn: 'Kulkanonen', grad: 4, max: 1, krav: { flerskott: 1, delning: 2 }, text: () => 'Två kulor till i varje skott, och delningen fördubblas' },
}
export const GRADER = { 1: 'Vanlig', 2: 'Sällsynt', 3: 'Episk', 4: 'Evolution' }

// Vilka evolutioner en uppgradering ingår i (för tipset på kortet).
export function ingarI(id) {
  return Object.entries(UPPGRADERINGAR)
    .filter(([, u]) => u.krav && u.krav[id] != null)
    .map(([eid, u]) => ({ id: eid, ...u }))
}

export const RELIKER = {
  kottben: { ikon: '🍖', namn: 'Köttbenet', grad: 1, text: 'Två kulor till efter varje bana' },
  klockan: { ikon: '🔔', namn: 'Feberklockan', grad: 1, text: 'Varje Extreme Fever ger fyra kulor' },
  spegel: { ikon: '🪞', namn: 'Spegeln', grad: 1, text: 'Första skottet på varje bana skjuter en spegelkula' },
  diamant: { ikon: '💎', namn: 'Diamanten', grad: 1, text: 'Orange pinnar ger dubbla poäng' },
  benbit: { ikon: '🦴', namn: 'Benbiten', grad: 1, text: '50 % fler ben när rundan är slut' },
  hinkskydd: { ikon: '🛡️', namn: 'Hinkkanten', grad: 1, text: 'Hinken är 40 % bredare' },
  tarning: { ikon: '🎲', namn: 'Tärningen', grad: 1, text: 'Tre omslag nu, och ett till i början av varje akt' },
  snigel: { ikon: '🐌', namn: 'Snigelslemmet', grad: 1, text: 'Allt som rör sig går hälften så fort' },
  guldtand: { ikon: '🦷', namn: 'Guldtanden', grad: 1, text: '50 % mer guld' },
  spelautomat: { ikon: '🎰', namn: 'Spelautomaten', grad: 2, text: 'Ibland kostar ett skott ingen kula alls' },
  karamell: { ikon: '🍬', namn: 'Smällkaramellen', grad: 2, text: 'Den första gröna i varje skott smäller stort' },
  fyrklover: { ikon: '☘️', namn: 'Fyrklövern', grad: 2, text: 'Ett val till på uppgraderingskorten' },
  spargris: { ikon: '🐷', namn: 'Spargrisen', grad: 2, text: '10 % ränta på guldet efter varje bana (högst 15)' },
  present: { ikon: '🎁', namn: 'Presentsnöret', grad: 2, text: 'Skattkistor ger alltid minst två saker' },
  glodkol: { ikon: '🪵', namn: 'Glödkolet', grad: 2, text: 'Var femte skott är en eldboll' },
  stjarnfall: { ikon: '🌠', namn: 'Stjärnfallet', grad: 3, text: 'Varje grön pinne skjuter en stjärna som tänder en orange' },
  kronan: { ikon: '👑', namn: 'Kronan', grad: 3, text: 'Bossar tar dubbel skada' },
  trolldryck: { ikon: '🧪', namn: 'Trolldrycken', grad: 3, text: 'Uppgraderingar med tak får ett steg till' },
}
