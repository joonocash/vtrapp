import { useEffect, useRef } from 'react';

const CSS = `
#agenter{
  --ag-bg:        #0d1320;
  --ag-panel:     #151d2e;
  --ag-panel-2:   #1c2639;
  --ag-line:      #26324a;
  --ag-text:      #e6ebf5;
  --ag-dim:       #7d8ba6;
  --ag-red:       #e0574f;
  --ag-red-deep:  #8f2f2b;
  --ag-blue:      #4a8cf7;
  --ag-blue-deep: #23508f;
  --ag-civil:     #b9a684;
  --ag-mole:      #05070c;
  --ag-display: "Bahnschrift","DIN Alternate","Oswald","Arial Narrow",
                "Helvetica Neue Condensed",system-ui,sans-serif;
  --ag-mono: ui-monospace,"SF Mono","JetBrains Mono","Roboto Mono",Menlo,monospace;

  max-width: 880px;
  margin: 0 auto;
  padding: 18px;
  background: var(--ag-bg);
  border: 1px solid var(--ag-line);
  border-radius: 16px;
  color: var(--ag-text);
  font-family: system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  box-sizing: border-box;
}
#agenter *,#agenter *::before,#agenter *::after{ box-sizing: border-box; }
#agenter button{ font: inherit; color: inherit; cursor: pointer; }

/* ── Topprad ───────────────────────────────────────────────── */
#agenter .ag-top{
  display:flex; align-items:center; justify-content:space-between;
  gap:12px; flex-wrap:wrap; margin-bottom:14px;
}
#agenter .ag-brand{
  display:flex; align-items:baseline; gap:10px;
  font-family:var(--ag-display); font-size:26px; font-weight:700;
  letter-spacing:.18em; text-transform:uppercase;
}
#agenter .ag-brand small{
  font-family:var(--ag-mono); font-size:10px; font-weight:400;
  letter-spacing:.12em; color:var(--ag-dim); text-transform:uppercase;
}
#agenter .ag-tools{ display:flex; gap:8px; flex-wrap:wrap; }
#agenter .ag-btn{
  background:var(--ag-panel); border:1px solid var(--ag-line);
  border-radius:9px; padding:9px 13px;
  font-family:var(--ag-mono); font-size:11px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--ag-text);
  transition:background .15s,border-color .15s,transform .1s;
}
#agenter .ag-btn:hover{ background:var(--ag-panel-2); border-color:#3a4a6b; }
#agenter .ag-btn:active{ transform:translateY(1px); }
#agenter .ag-btn.is-on{
  background:rgba(224,87,79,.16); border-color:var(--ag-red); color:#ffd9d6;
}
#agenter .ag-btn:focus-visible{ outline:2px solid var(--ag-blue); outline-offset:2px; }

/* ── Ställning ─────────────────────────────────────────────── */
#agenter .ag-score{ display:flex; align-items:stretch; gap:10px; margin-bottom:12px; }
#agenter .ag-team{
  flex:1; background:var(--ag-panel); border:1px solid var(--ag-line);
  border-radius:12px; padding:10px 14px; position:relative; overflow:hidden;
  transition:border-color .2s,background .2s;
}
#agenter .ag-team::before{
  content:""; position:absolute; inset:0 auto 0 0; width:3px; background:var(--ag-line);
  transition:background .2s;
}
#agenter .ag-team.red.active{ background:rgba(224,87,79,.10); border-color:rgba(224,87,79,.55); }
#agenter .ag-team.blue.active{ background:rgba(74,140,247,.10); border-color:rgba(74,140,247,.55); }
#agenter .ag-team.red.active::before{ background:var(--ag-red); }
#agenter .ag-team.blue.active::before{ background:var(--ag-blue); }
#agenter .ag-team .lbl{
  font-family:var(--ag-mono); font-size:10px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--ag-dim);
}
#agenter .ag-team .num{
  font-family:var(--ag-display); font-size:34px; font-weight:700; line-height:1;
}
#agenter .ag-team.red .num{ color:var(--ag-red); }
#agenter .ag-team.blue .num{ color:var(--ag-blue); }
#agenter .ag-turn{
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  min-width:104px; padding:10px; border-radius:12px;
  background:var(--ag-panel); border:1px solid var(--ag-line);
  font-family:var(--ag-mono); font-size:10px; letter-spacing:.1em;
  text-transform:uppercase; color:var(--ag-dim); text-align:center;
}
#agenter .ag-turn b{ display:block; font-size:14px; color:var(--ag-text); margin-top:3px; letter-spacing:.06em; }

/* ── Ledtrådsrad ───────────────────────────────────────────── */
#agenter .ag-clue{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  background:var(--ag-panel); border:1px solid var(--ag-line);
  border-radius:12px; padding:10px 12px; margin-bottom:12px; min-height:56px;
}
#agenter .ag-clue input[type=text]{
  flex:1; min-width:130px; background:var(--ag-bg); color:var(--ag-text);
  border:1px solid var(--ag-line); border-radius:8px; padding:9px 11px;
  font-family:var(--ag-display); font-size:16px; letter-spacing:.08em;
  text-transform:uppercase;
}
#agenter .ag-clue input[type=number]{
  width:64px; background:var(--ag-bg); color:var(--ag-text);
  border:1px solid var(--ag-line); border-radius:8px; padding:9px 8px;
  font-family:var(--ag-display); font-size:16px; text-align:center;
}
#agenter .ag-clue input:focus{ outline:none; border-color:var(--ag-blue); }
#agenter .ag-clue-live{
  display:flex; align-items:center; gap:14px; width:100%; flex-wrap:wrap;
}
#agenter .ag-clue-word{
  font-family:var(--ag-display); font-size:26px; font-weight:700;
  letter-spacing:.14em; text-transform:uppercase;
}
#agenter .ag-clue-num{
  display:inline-flex; align-items:center; justify-content:center;
  width:34px; height:34px; border-radius:50%; font-family:var(--ag-display);
  font-size:17px; font-weight:700; background:var(--ag-panel-2); border:1px solid var(--ag-line);
}
#agenter .ag-left{
  margin-left:auto; font-family:var(--ag-mono); font-size:11px;
  letter-spacing:.08em; text-transform:uppercase; color:var(--ag-dim);
}
#agenter .ag-hint{
  font-family:var(--ag-mono); font-size:11px; letter-spacing:.06em; color:var(--ag-dim);
}

/* ── Brädet ────────────────────────────────────────────────── */
#agenter .ag-board{
  display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:12px;
}
#agenter .ag-card{
  position:relative; aspect-ratio:1/.66;
  display:flex; align-items:center; justify-content:center; padding:6px 4px;
  background:var(--ag-panel); border:1px solid var(--ag-line); border-radius:10px;
  font-family:var(--ag-display); font-weight:700; letter-spacing:.04em;
  font-size:clamp(9px,2.1vw,17px); line-height:1.05; text-transform:uppercase;
  text-align:center; word-break:break-word; hyphens:auto;
  transition:transform .12s,background .2s,border-color .2s,color .2s;
}
#agenter .ag-card:hover:not(.done){ transform:translateY(-2px); border-color:#425576; }
#agenter .ag-card:focus-visible{ outline:2px solid var(--ag-blue); outline-offset:2px; }
#agenter .ag-card .idx{
  position:absolute; top:5px; left:7px;
  font-family:var(--ag-mono); font-size:9px; color:#3d4c6b; letter-spacing:.05em;
}
/* Avslöjade kort */
#agenter .ag-card.done{ cursor:default; }
#agenter .ag-card.done .idx{ display:none; }
#agenter .ag-card.r-red{ background:var(--ag-red-deep); border-color:var(--ag-red); color:#ffe4e2; }
#agenter .ag-card.r-blue{ background:var(--ag-blue-deep); border-color:var(--ag-blue); color:#dbe8ff; }
#agenter .ag-card.r-civil{ background:#4a4436; border-color:var(--ag-civil); color:#efe3cd; }
#agenter .ag-card.r-mole{ background:var(--ag-mole); border-color:#4a1512; color:#ff6b60; }
#agenter .ag-card.done{ opacity:.94; }
/* Spelledarvy: nycklar på oavslöjade kort */
#agenter .ag-card.key::after{
  content:""; position:absolute; inset:0; border-radius:9px; pointer-events:none;
  box-shadow:inset 0 0 0 3px currentColor; opacity:.5;
}
#agenter .ag-card.key-red:not(.done){ color:var(--ag-red); background:rgba(224,87,79,.14); }
#agenter .ag-card.key-blue:not(.done){ color:var(--ag-blue); background:rgba(74,140,247,.14); }
#agenter .ag-card.key-civil:not(.done){ color:var(--ag-civil); background:rgba(185,166,132,.10); }
#agenter .ag-card.key-mole:not(.done){
  color:#ff5f52; background:repeating-linear-gradient(45deg,#0a0d14,#0a0d14 6px,#1b0f10 6px,#1b0f10 12px);
}
#agenter .ag-card.key-red:not(.done),
#agenter .ag-card.key-blue:not(.done),
#agenter .ag-card.key-civil:not(.done){ color:var(--ag-text); }
#agenter .ag-card.key-red:not(.done)::after{ color:var(--ag-red); }
#agenter .ag-card.key-blue:not(.done)::after{ color:var(--ag-blue); }
#agenter .ag-card.key-civil:not(.done)::after{ color:var(--ag-civil); }
#agenter .ag-card.key-mole:not(.done)::after{ color:#ff5f52; opacity:.85; }

/* Signaturen: korten "vänder" som en avgångstavla när de avslöjas */
@keyframes ag-flip{
  0%{ transform:rotateX(0deg); }
  48%{ transform:rotateX(-88deg); }
  100%{ transform:rotateX(0deg); }
}
#agenter .ag-card.flip{ animation:ag-flip .44s cubic-bezier(.4,0,.25,1); }

/* ── Fot ───────────────────────────────────────────────────── */
#agenter .ag-foot{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
#agenter .ag-log{
  flex:1; min-width:180px; font-family:var(--ag-mono); font-size:11px;
  color:var(--ag-dim); letter-spacing:.04em; line-height:1.6;
}
#agenter .ag-log span{ color:var(--ag-text); }
#agenter .ag-end{
  background:var(--ag-panel-2); border:1px solid #3a4a6b; border-radius:9px;
  padding:10px 16px; font-family:var(--ag-mono); font-size:11px;
  letter-spacing:.08em; text-transform:uppercase;
}
#agenter .ag-end:disabled{ opacity:.35; cursor:not-allowed; }

/* ── Modal + slutruta ──────────────────────────────────────── */
#agenter .ag-modal{
  position:fixed; inset:0; z-index:60; display:none;
  align-items:center; justify-content:center; padding:20px;
  background:rgba(4,7,13,.78); backdrop-filter:blur(6px);
}
#agenter .ag-modal.open{ display:flex; }
#agenter .ag-box{
  width:100%; max-width:420px; background:var(--ag-panel);
  border:1px solid var(--ag-line); border-radius:16px; padding:22px;
}
#agenter .ag-box h3{
  margin:0 0 6px; font-family:var(--ag-display); font-size:20px;
  letter-spacing:.14em; text-transform:uppercase; font-weight:700;
}
#agenter .ag-box p{ margin:0 0 16px; font-size:13px; color:var(--ag-dim); line-height:1.6; }
#agenter .ag-code{
  font-family:var(--ag-display); font-size:38px; font-weight:700; letter-spacing:.3em;
  text-align:center; padding:14px; background:var(--ag-bg);
  border:1px solid var(--ag-line); border-radius:12px; margin-bottom:14px;
}
#agenter .ag-row{ display:flex; gap:8px; margin-bottom:10px; }
#agenter .ag-row input{
  flex:1; background:var(--ag-bg); color:var(--ag-text); border:1px solid var(--ag-line);
  border-radius:8px; padding:10px 12px; font-family:var(--ag-display);
  font-size:16px; letter-spacing:.2em; text-transform:uppercase; text-align:center;
}
#agenter .ag-row input:focus{ outline:none; border-color:var(--ag-blue); }
#agenter .ag-win{ text-align:center; }
#agenter .ag-win .who{
  font-family:var(--ag-display); font-size:44px; font-weight:700;
  letter-spacing:.1em; text-transform:uppercase; line-height:1.05; margin-bottom:6px;
}
#agenter .ag-win.red .who{ color:var(--ag-red); }
#agenter .ag-win.blue .who{ color:var(--ag-blue); }

@media (max-width:560px){
  #agenter{ padding:12px; border-radius:12px; }
  #agenter .ag-board{ gap:5px; }
  #agenter .ag-card{ border-radius:7px; aspect-ratio:1/.78; }
  #agenter .ag-brand{ font-size:20px; }
  #agenter .ag-team .num{ font-size:26px; }
  #agenter .ag-turn{ min-width:84px; }
}
@media (prefers-reduced-motion:reduce){
  #agenter *{ animation:none !important; transition:none !important; }
}
`;

function setupStyles() {
  if (document.getElementById('ag-styles')) return;
  const style = document.createElement('style');
  style.id = 'ag-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

/* ── Ordlista (egen, svensk) ───────────────────────────────── */
const ORD = [
  // Djur
  "HUND","KATT","HÄST","ELEFANT","ORM","ÖRN","VARG","BJÖRN","RÄV","ÄLG",
  "MYRA","SPINDEL","HAJ","VAL","DELFIN","KRÅKA","UGGLA","GRODA","IGELKOTT","KANIN",
  "MUS","RÅTTA","FLADDERMUS","KROKODIL","KAMEL","LEJON","TIGER","PINGVIN","SÄL","MYGGA",
  "FJÄRIL","SNIGEL","KRABBA","BLÄCKFISK","PAPEGOJA","DUVA","SVAN","TUPP","GRIS","GET",
  "HÖNA","LAX","GÄDDA","MÅS","APA","GIRAFF","NOSHÖRNING","EKORRE","BÄVER","MYRSLOK",
  // Mat och dryck
  "BRÖD","OST","SMÖR","ÄGG","MJÖLK","KAFFE","SOCKER","SALT","PEPPAR","CHOKLAD",
  "GLASS","KAKA","TÅRTA","KORV","SOPPA","SALLAD","PIZZA","PASTA","POTATIS","MOROT",
  "LÖK","TOMAT","GURKA","ÄPPLE","BANAN","APELSIN","CITRON","DRUVA","JORDGUBBE","HALLON",
  "BLÅBÄR","SVAMP","HONUNG","SENAP","VIN","JUICE","MJÖL","KANEL","SILL","RÄKA",
  "KÖTTBULLE","PANNKAKA","KNÄCKEBRÖD","GRÖT","SYLT","PEPPARKAKA","MUSSLA","NÖT","KRYDDA","DEG",
  // Platser
  "SKOLA","SJUKHUS","KYRKA","SLOTT","FYR","HAMN","STATION","FLYGPLATS","BIBLIOTEK","MUSEUM",
  "TEATER","BIOGRAF","RESTAURANG","HOTELL","MARKNAD","TORG","PARK","STRAND","ÖKEN","DJUNGEL",
  "BERG","DAL","GROTTA","SKOG","ÄNG","SJÖ","FLOD","VATTENFALL","VULKAN","GLACIÄR",
  "RYMDEN","MÅNEN","PLANET","STJÄRNA","HIMMEL","NORDPOLEN","EGYPTEN","PARIS","LONDON","ROM",
  "TOKYO","KINA","INDIEN","ISLAND","GÖTEBORG","STOCKHOLM","ALPERNA","LAPPLAND","VENEDIG","PYRAMID",
  // Roller och figurer
  "LÄKARE","POLIS","BRANDMAN","LÄRARE","PILOT","KOCK","BAGARE","SNICKARE","MÅLARE","MUSIKER",
  "SÅNGARE","DANSARE","SKÅDESPELARE","FÖRFATTARE","DOMARE","ADVOKAT","PRÄST","SOLDAT","SPION","TJUV",
  "PIRAT","RIDDARE","KUNG","DROTTNING","PRINSESSA","JÄTTE","TROLL","HÄXA","VAMPYR","SPÖKE",
  "ROBOT","ÄNGEL","CLOWN","TROLLKARL","ASTRONAUT","DYKARE","JÄGARE","FISKARE","BONDE","VAKT",
  "MEKANIKER","FRISÖR","TANDLÄKARE","BREVBÄRARE","VIKING","NINJA","DETEKTIV","GRANNE","TVILLING","KOMPIS",
  // Saker i hemmet
  "BORD","STOL","SÄNG","SOFFA","LAMPA","SPEGEL","KLOCKA","NYCKEL","LÅS","DÖRR",
  "FÖNSTER","TAK","GOLV","TRAPPA","STEGE","HAMMARE","SPIK","SÅG","SKRUV","YXA",
  "KNIV","GAFFEL","SKED","TALLRIK","GLAS","FLASKA","BURK","KORG","PÅSE","VÄSKA",
  "PLÅNBOK","MYNT","SEDEL","RING","HALSBAND","KRONA","KAMERA","TELEFON","DATOR","SKÄRM",
  "RADIO","GITARR","PIANO","TRUMMA","FIOL","FLÖJT","BOK","PENNA","PAPPER","SAX",
  "LIM","BOLL","BALLONG","DRAKE","TÄRNING","PUSSEL","DOCKA","NALLE","PARAPLY","HATT",
  "SKO","STRUMPA","HANDSKE","HALSDUK","JACKA","KJOL","SLIPS","KNAPP","NÅL","TRÅD",
  "TVÅL","TANDBORSTE","HANDDUK","KUDDE","FILT","MATTA","GARDIN","HYLLA","LÅDA","KISTA",
  "TUNNA","HINK","SPADE","KRATTA","SLANG","REP","KEDJA","ANKARE","SEGEL","ÅRA",
  "FALLSKÄRM","KIKARE","MIKROSKOP","TELESKOP","KOMPASS","KARTA","GLOB","TERMOMETER","LINJAL","BATTERI",
  "MAGNET","FJÄDER","KAM","BORSTE","LJUS","STÄMPEL","FRIMÄRKE","PORTFÖLJ","MIKROFON","HÖRLURAR",
  // Fordon
  "BIL","BUSS","TÅG","SPÅRVAGN","CYKEL","MOTORCYKEL","LASTBIL","TRAKTOR","BÅT","FÄRJA",
  "UBÅT","FLYGPLAN","HELIKOPTER","RAKET","SKATEBOARD","SKIDOR","SKRIDSKO","SLÄDE","VAGN","TAXI",
  "AMBULANS","KANOT","SEGELBÅT","HISS","RULLTRAPPA",
  // Natur och väder
  "REGN","SNÖ","IS","DIMMA","STORM","ÅSKA","BLIXT","VIND","SOL","MOLN",
  "REGNBÅGE","HAGEL","FROST","VÅG","ELD","RÖK","ASKA","SAND","STEN","LERA",
  "TRÄD","BLAD","BLOMMA","ROS","GRÄS","MOSSA","ROT","FRÖ","KOTTE","EK",
  "TALL","BJÖRK","KAKTUS","PALM","SKUGGA","HAV","VIK","KLIPPA","GRUS","LAVA",
  // Kropp
  "HJÄRTA","HJÄRNA","ÖGA","ÖRA","NÄSA","MUN","TAND","TUNGA","HAND","FOT",
  "FINGER","ARM","RYGG","AXEL","HÅR","SKÄGG","BLOD","SKELETT","PULS","ANDNING",
  // Sport och spel
  "FOTBOLL","HOCKEY","TENNIS","GOLF","BOXNING","SCHACK","POKER","BOWLING","HANDBOLL","BASKET",
  "LÖPNING","SIMNING","BÅGSKYTTE","RIDNING","KLÄTTRING","MÅL","MEDALJ","POKAL","LAG","MATCH",
  // Byggt och samhälle
  "BRO","TUNNEL","VÄG","GATA","TORN","MUR","STAKET","GRIND","BRUNN","KÄLLARE",
  "GARAGE","STUGA","TÄLT","IGLOO","KVARN","FABRIK","GRUVA","BANK","APOTEK","LADA",
  "PLATTFORM","PERRONG","BALKONG","SKORSTEN","VINDSKUPA",
  // Abstrakt och övrigt
  "TID","DRÖM","MINNE","LJUD","TYSTNAD","HEMLIGHET","LÖGN","SANNING","KÄRLEK","TUR",
  "ÖDE","MAGI","KRAFT","ENERGI","VIRUS","FEBER","PLÅSTER","MEDICIN","GIPS","MÖRKER",
  "JULGRAN","TOMTE","PÅSK","MIDSOMMAR","FEST","BRÖLLOP","FÖDELSEDAG","PRESENT","KALAS","SEMESTER",
  "KÖ","BILJETT","KVITTO","ALARM","LÖSENORD","SIGNAL","KOD","BEVIS","SPÅR","UPPDRAG"
];

export default function AgentsGame() {
  setupStyles();
  const rootRef = useRef(null);

  useEffect(() => {
    /* ── Slumpgenerator med frö (samma kod = samma bräde) ──────── */
    function hashSeed(str) {
      var h = 1779033703 ^ str.length;
      for (var i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function () {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
      };
    }
    function makeRng(seed) {
      var next = hashSeed(seed);
      var a = next();
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function shuffle(arr, rnd) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    var ALFA = "ABCDEFGHJKLMNPQRSTUVXYZ23456789";
    function slumpKod() {
      var s = "";
      for (var i = 0; i < 6; i++) s += ALFA[Math.floor(Math.random() * ALFA.length)];
      return s;
    }

    /* ── Element ───────────────────────────────────────────────── */
    var $ = function (id) { return document.getElementById(id); };
    var elBoard = $("ag-board"), elLog = $("ag-log"), elClue = $("ag-cluebar"),
        elNRed = $("ag-n-red"), elNBlue = $("ag-n-blue"),
        elTRed = $("ag-t-red"), elTBlue = $("ag-t-blue"), elTurn = $("ag-turn"),
        elEnd = $("ag-endturn"), elSpy = $("ag-spy"), elBadge = $("ag-code-badge");

    /* ── Speltillstånd ─────────────────────────────────────────── */
    var S = null;
    var winTimeout = null;

    function nyttSpel(kod) {
      var code = (kod || slumpKod()).toUpperCase();
      var rnd = makeRng("agenter-v1-" + code);
      var ord = shuffle(ORD, rnd).slice(0, 25);
      var start = rnd() < 0.5 ? "red" : "blue";
      var andra = start === "red" ? "blue" : "red";

      var roller = [];
      var i;
      for (i = 0; i < 9; i++) roller.push(start);
      for (i = 0; i < 8; i++) roller.push(andra);
      for (i = 0; i < 7; i++) roller.push("civil");
      roller.push("mole");
      roller = shuffle(roller, rnd);

      S = {
        code: code, ord: ord, roller: roller,
        oppen: new Array(25).fill(false),
        kvar: { red: start === "red" ? 9 : 8, blue: start === "blue" ? 9 : 8 },
        tur: start, ledtrad: null, gissningar: 0,
        spy: false, slut: false, flip: -1, logg: "Ge en ledtråd för att börja."
      };

      elBadge.textContent = "kod " + code;
      $("ag-code-big").textContent = code;
      elSpy.classList.remove("is-on");
      ritaBrade();
      rita();
    }

    function ritaBrade() {
      elBoard.innerHTML = "";
      for (var i = 0; i < 25; i++) {
        var b = document.createElement("button");
        b.className = "ag-card";
        b.dataset.i = String(i);
        b.innerHTML = '<span class="idx">' + String(i + 1).padStart(2, "0") + "</span>" + S.ord[i];
        elBoard.appendChild(b);
      }
    }

    var NAMN = { red: "Rött lag", blue: "Blått lag" };
    var ROLLNAMN = { red: "röd agent", blue: "blå agent", civil: "civil", mole: "mullvaden" };

    function rita() {
      // Kort
      var kort = elBoard.children;
      for (var i = 0; i < 25; i++) {
        var k = kort[i], roll = S.roller[i];
        k.className = "ag-card";
        if (S.oppen[i]) {
          k.classList.add("done", "r-" + roll);
          if (i === S.flip) { void k.offsetWidth; k.classList.add("flip"); }
        } else if (S.spy) {
          k.classList.add("key", "key-" + roll);
        }
      }
      S.flip = -1;
      // Ställning
      elNRed.textContent = S.kvar.red;
      elNBlue.textContent = S.kvar.blue;
      elTRed.classList.toggle("active", S.tur === "red" && !S.slut);
      elTBlue.classList.toggle("active", S.tur === "blue" && !S.slut);
      elTurn.innerHTML = "Tur<b>" + (S.slut ? "Slut" : NAMN[S.tur]) + "</b>";
      // Ledtrådsrad
      ritaLedtrad();
      // Fot
      elLog.innerHTML = S.logg;
      elEnd.disabled = S.slut || !S.ledtrad;
    }

    function ritaLedtrad() {
      if (S.slut) {
        elClue.innerHTML = '<span class="ag-hint">Spelet är slut. Starta ett nytt spel.</span>';
        return;
      }
      if (S.ledtrad) {
        var kvar = S.gissningar === Infinity
          ? "obegränsat"
          : S.gissningar + (S.gissningar === 1 ? " gissning kvar" : " gissningar kvar");
        elClue.innerHTML =
          '<div class="ag-clue-live">' +
          '<span class="ag-clue-word">' + S.ledtrad.ord + "</span>" +
          '<span class="ag-clue-num">' + (S.ledtrad.antal === Infinity ? "∞" : S.ledtrad.antal) + "</span>" +
          '<span class="ag-left">' + kvar + "</span>" +
          "</div>";
        return;
      }
      elClue.innerHTML =
        '<span class="ag-hint">' + NAMN[S.tur] + "s ledtråd:</span>" +
        '<input type="text" id="ag-cw" placeholder="ord" autocomplete="off" spellcheck="false">' +
        '<input type="number" id="ag-cn" min="0" max="9" value="1">' +
        '<button class="ag-btn" id="ag-cgo">Ge ledtråd</button>';

      var w = $("ag-cw"), n = $("ag-cn");
      $("ag-cgo").addEventListener("click", geLedtrad);
      w.addEventListener("keydown", function (e) { if (e.key === "Enter") geLedtrad(); });
      n.addEventListener("keydown", function (e) { if (e.key === "Enter") geLedtrad(); });
      if (window.innerWidth > 700) w.focus({ preventScroll: true });
    }

    function geLedtrad() {
      var ord = ($("ag-cw").value || "").trim();
      var antal = parseInt($("ag-cn").value, 10);
      if (!ord) { $("ag-cw").focus(); return; }
      if (isNaN(antal) || antal < 0) antal = 1;
      S.ledtrad = { ord: ord.toUpperCase(), antal: antal };
      S.gissningar = antal === 0 ? Infinity : antal + 1;
      S.logg = NAMN[S.tur] + " gav ledtråden <span>" + S.ledtrad.ord + " " + antal + "</span>.";
      rita();
    }

    /* ── Klick på kort ─────────────────────────────────────────── */
    function onBoardClick(e) {
      var k = e.target.closest(".ag-card");
      if (!k || S.slut || S.spy || !S.ledtrad) {
        if (k && S.spy) S.logg = "Spelledarvyn är på — stäng av den för att gissa.";
        else if (k && !S.ledtrad) S.logg = "Ge en ledtråd först.";
        if (k) elLog.innerHTML = S.logg;   // rör inte ledtrådsfältet, texten kan vara halvskriven
        return;
      }
      var i = Number(k.dataset.i);
      if (S.oppen[i]) return;

      S.oppen[i] = true;
      S.flip = i;
      var roll = S.roller[i];
      var lag = S.tur, motst = lag === "red" ? "blue" : "red";
      var ordet = "<span>" + S.ord[i] + "</span>";

      if (roll === "mole") {
        S.logg = NAMN[lag] + " tog " + ordet + " — mullvaden.";
        slut(motst, NAMN[lag] + " avslöjade mullvaden.");
        rita(); return;
      }
      if (roll === "civil") {
        S.logg = NAMN[lag] + " tog " + ordet + " — civil. Draget går över.";
        bytTur();
      } else if (roll === lag) {
        S.kvar[lag]--;
        if (S.kvar[lag] === 0) {
          S.logg = NAMN[lag] + " tog " + ordet + " — sista agenten!";
          slut(lag, "Alla agenter hittade.");
          rita(); return;
        }
        S.gissningar--;
        if (S.gissningar <= 0) {
          S.logg = NAMN[lag] + " tog " + ordet + " — rätt, men gissningarna tog slut.";
          bytTur();
        } else {
          S.logg = NAMN[lag] + " tog " + ordet + " — rätt agent.";
        }
      } else {
        S.kvar[motst]--;
        if (S.kvar[motst] === 0) {
          S.logg = NAMN[lag] + " tog " + ordet + " — motståndarens sista agent.";
          slut(motst, NAMN[lag] + " avslöjade motståndarens sista agent.");
          rita(); return;
        }
        S.logg = NAMN[lag] + " tog " + ordet + " — " + ROLLNAMN[roll] + ". Draget går över.";
        bytTur();
      }
      rita();
    }
    elBoard.addEventListener("click", onBoardClick);

    function bytTur() {
      S.tur = S.tur === "red" ? "blue" : "red";
      S.ledtrad = null;
      S.gissningar = 0;
    }

    function slut(vinnare, varfor) {
      S.slut = true;
      S.ledtrad = null;
      for (var i = 0; i < 25; i++) S.oppen[i] = true;
      var box = $("ag-win");
      box.className = "ag-box ag-win " + vinnare;
      $("ag-win-who").textContent = NAMN[vinnare] + " vinner";
      $("ag-win-why").textContent = varfor;
      winTimeout = setTimeout(function () { $("ag-modal-win").classList.add("open"); }, 700);
    }

    /* ── Knappar ───────────────────────────────────────────────── */
    function onEndTurn() {
      if (S.slut || !S.ledtrad) return;
      S.logg = NAMN[S.tur] + " avslutade draget.";
      bytTur();
      rita();
    }
    elEnd.addEventListener("click", onEndTurn);

    function onNew() {
      $("ag-modal-win").classList.remove("open");
      nyttSpel();
    }
    $("ag-new").addEventListener("click", onNew);
    $("ag-again").addEventListener("click", onNew);

    function onSpy() {
      if (S.spy) { S.spy = false; elSpy.classList.remove("is-on"); rita(); return; }
      $("ag-modal-spy").classList.add("open");
    }
    elSpy.addEventListener("click", onSpy);

    function onSpyYes() {
      $("ag-modal-spy").classList.remove("open");
      S.spy = true; elSpy.classList.add("is-on"); rita();
    }
    function onSpyNo() {
      $("ag-modal-spy").classList.remove("open");
    }
    $("ag-spy-yes").addEventListener("click", onSpyYes);
    $("ag-spy-no").addEventListener("click", onSpyNo);

    function onShare() { $("ag-modal-code").classList.add("open"); }
    function onCloseCode() { $("ag-modal-code").classList.remove("open"); }
    $("ag-share").addEventListener("click", onShare);
    $("ag-close-code").addEventListener("click", onCloseCode);

    function onCopy() {
      var btn = $("ag-copy");
      var done = function () { btn.textContent = "Kopierad"; setTimeout(function () { btn.textContent = "Kopiera kod"; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(S.code).then(done, done);
      else done();
    }
    $("ag-copy").addEventListener("click", onCopy);

    function anslut() {
      var v = ($("ag-join").value || "").trim().toUpperCase();
      if (v.length !== 6) { $("ag-join").focus(); return; }
      $("ag-join").value = "";
      $("ag-modal-code").classList.remove("open");
      nyttSpel(v);
    }
    $("ag-join-go").addEventListener("click", anslut);
    $("ag-join").addEventListener("keydown", function (e) { if (e.key === "Enter") anslut(); });

    function onKeydown(e) {
      if (e.key !== "Escape") return;
      ["ag-modal-code", "ag-modal-spy"].forEach(function (id) { $(id).classList.remove("open"); });
    }
    document.addEventListener("keydown", onKeydown);

    nyttSpel();

    return () => {
      document.removeEventListener("keydown", onKeydown);
      clearTimeout(winTimeout);
    };
  }, []);

  return (
    <section id="agenter" ref={rootRef}>
      <div className="ag-top">
        <div className="ag-brand">Agenter <small id="ag-code-badge">kod —</small></div>
        <div className="ag-tools">
          <button className="ag-btn" id="ag-new">Nytt spel</button>
          <button className="ag-btn" id="ag-share">Dela kod</button>
          <button className="ag-btn" id="ag-spy">Spelledarvy</button>
        </div>
      </div>

      <div className="ag-score">
        <div className="ag-team red" id="ag-t-red">
          <div className="lbl">Rött lag</div>
          <div className="num" id="ag-n-red">9</div>
        </div>
        <div className="ag-turn" id="ag-turn">Tur<b>Rött lag</b></div>
        <div className="ag-team blue" id="ag-t-blue">
          <div className="lbl">Blått lag</div>
          <div className="num" id="ag-n-blue">8</div>
        </div>
      </div>

      <div className="ag-clue" id="ag-cluebar"></div>

      <div className="ag-board" id="ag-board"></div>

      <div className="ag-foot">
        <div className="ag-log" id="ag-log">Ge en ledtråd för att börja.</div>
        <button className="ag-end" id="ag-endturn" disabled>Avsluta draget</button>
      </div>

      {/* Modal: dela/anslut kod */}
      <div className="ag-modal" id="ag-modal-code">
        <div className="ag-box">
          <h3>Samma bräde, flera enheter</h3>
          <p>Skriv in koden på en annan telefon så får den exakt samma bräde och samma nyckel. Bra när båda spelledarna behöver se nyckeln på varsin skärm.</p>
          <div className="ag-code" id="ag-code-big">——————</div>
          <div className="ag-row">
            <input type="text" id="ag-join" maxLength={6} placeholder="ANGE KOD" autoComplete="off" spellCheck={false} />
            <button className="ag-btn" id="ag-join-go">Öppna</button>
          </div>
          <div className="ag-row">
            <button className="ag-btn" id="ag-copy" style={{ flex: 1 }}>Kopiera kod</button>
            <button className="ag-btn" id="ag-close-code" style={{ flex: 1 }}>Stäng</button>
          </div>
        </div>
      </div>

      {/* Modal: varning innan spelledarvy */}
      <div className="ag-modal" id="ag-modal-spy">
        <div className="ag-box">
          <h3>Visa nyckeln?</h3>
          <p>Nyckeln avslöjar vilka ord som tillhör vilket lag. Se till att bara spelledarna ser skärmen.</p>
          <div className="ag-row">
            <button className="ag-btn" id="ag-spy-yes" style={{ flex: 1 }}>Visa nyckeln</button>
            <button className="ag-btn" id="ag-spy-no" style={{ flex: 1 }}>Avbryt</button>
          </div>
        </div>
      </div>

      {/* Modal: slut */}
      <div className="ag-modal" id="ag-modal-win">
        <div className="ag-box ag-win" id="ag-win">
          <div className="who" id="ag-win-who">Rött lag vinner</div>
          <p id="ag-win-why">Alla agenter hittade.</p>
          <button className="ag-btn" id="ag-again" style={{ width: '100%' }}>Nytt spel</button>
        </div>
      </div>
    </section>
  );
}
