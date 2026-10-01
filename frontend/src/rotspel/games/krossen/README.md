# Krossen

Hjälp Happy få godis. En match-3 i Candy Crush-stil med 200 banor på Happys
promenad, tio världar à 20 banor och en bossbana sist i varje värld. Efter
sista banan fortsätter den oändliga promenaden.

## Filerna

| Fil | Vad den gör |
| --- | --- |
| `engine.js` | Reglerna. Ren logik, ingen React. Ett drag körs som en generator som yieldar ett steg i taget (byte, rensning, fall, leverans ...). |
| `levels.js` | Världarna, de 200 banorna, den oändliga promenaden, tipsen och `STAMNING` (dragantal och stjärngränser per bana). |
| `pieces.jsx` | All grafik som SVG: godiset, specialpjäserna, hindren, paketen och ikonerna. |
| `happy.jsx` | Happy själv (fotot i ram) och kläderna i garderoben. |
| `fx.js` | Effekterna. Pjäsernas rörelser med Web Animations API, partiklar på en canvas. |
| `audio.js` | Allt ljud syntas i webbläsaren, plus bakgrundsmusiken. |
| `store.js` | Sparläget: stjärnor, mynt, boosters, sedda tips, dagliga belöningar, vinstsvit, stjärnkistor, albumet, garderoben, godisskålen, statistiken, och sammanslagningen när två enheter möts. Rena funktioner. |
| `synk.js` | Pratar med servern: framsteg per spelare, kompisar på kartan, topplistor. |
| `Dagligt.jsx` | Dagens godis (inloggningsserien, lyckohjulet, dagens bana), stjärnkistan och notisen. |
| `Spelplan.jsx` | En omgång på en bana: brädet, statusraden, boostrarna, vinst- och förlustrutorna. |
| `Karta.jsx` | Kartan med stigen och knapparna till samlingen. |
| `Samling.jsx` | Happys album, garderoben, godisskålen och statistiken. |
| `KrossenGame.jsx` | Håller ihop allt: vilken bana som spelas, kartan, sparningen. |

Backend: `backend/src/routes/krossen.js` sparar framstegen i
`backend/data/krossen.json`. Topplistorna per bana (`krossen-bana-<nr>`) och
för dagens bana (`krossen-dag-<datum>`) går genom den vanliga
`/api/scores`.

Testerna ligger i `frontend/tests/krossen-engine.test.mjs` och
`krossen-store.test.mjs` och körs med `npm test` från repots rot.

`frontend/tests/krossen.browser.mjs` spelar spelet i en riktig webbläsare och
kollar efter varje drag att brädet på skärmen stämmer med motorn (inga
osynliga eller snedställda pjäser, koppel där de ska vara). Kör med
`npm run test:browser` (första gången `npx playwright install chromium`).
GitHub kör båda på varje pull request.

## Det som får en att komma tillbaka

- **Inloggningsserien** — sju dagar med allt bättre belöningar. Missar man en dag börjar den om.
- **Lyckohjulet** — ett snurr per dag.
- **Dagens bana** — samma bräde för alla (datumet är slumpfröet), egen topplista. Första vinsten ger mynt.
- **Vinstsvit** — vinner man i rad börjar nästa bana med en raket, sedan även en bomb, sedan en godisskål. Förlust eller att lämna banan nollställer.
- **Stjärnkistan** — var tjugonde stjärna.
- **Kompisar på kartan** och **topplista per bana** — hämtas från servern.
- **Svåra banor** — märkta Svår eller Supersvår (alla bossar) på kartan, ger extra mynt första vinsten.
- **Happys album** — riktiga foton från Happys revir. Första vinsten på en bossbana och varje stjärnkista låser upp ett nytt.
- **Garderoben** — hattar, halsgrejer och glasögon som köps för mynt. Happy har dem på sig på kartan och i spelet.
- **Godisskålen** — allt godis man samlar fyller den. Full skål går upp en nivå och ger en belöning.
- **Statistik** — godis per sort, specialpjäser, längsta kedja, hopp, paket och rekord.
- **Oändliga promenaden** — när bana 200 är klar kommer nya banor i all oändlighet, byggda av de gamla med lite färre drag för varje promenad.

Framstegen synkas per spelarnamn. Stjärnor och bästa poäng tas från båda
enheterna. Allt annat tas från den som sparade senast, men datum, öppnade
kistor, foton, godisskålen och oändliga promenaden går aldrig bakåt och köpta
kläder slås ihop, så inget kan hämtas två gånger eller försvinna.

## Pjäserna

| Färg | Sort |
| --- | --- |
| 0 röd | hjärtkex |
| 1 orange | ben |
| 2 gul | ostbit |
| 3 grön | tass |
| 4 blå | fiskkex |
| 5 lila | munk |

Hinder: lera, lådor (1–3 lager), koppel, ogräs som växer, köttben som ska
ner till botten, tennisbollar (faller, går inte att matcha, stoppar raketer)
och väckarklockor (godis som räknar ner — når en noll är banan förlorad).

Specialpjäser: 4 i rad ger raket, 2×2 ger frisbee, 5 i L/T ger bomb (smäller
två gånger), 5 i rad ger Godisskålen. Alla kombinationer av två specialpjäser
gör något eget.

**Happy** sitter på brädet på vissa banor. Han matchas som sin färg men äter
godiset i stället för att försvinna, och byter färg efter varje tugga. Godis
som smäller bredvid honom äter han också. När magen är full (10) lyser han:
tryck på honom och sedan på en ruta, så hoppar han dit och smäller 3×3. Hoppet
kostar inget drag.

**Överraskningspaket** ser ut som godis med rosett. När paketet smäller får
man något: en raket, bomb, frisbee eller godisskål på brädet, extra drag,
mynt eller en tennisboll.

## Lägga till eller ändra en bana

En bana är en rad i `SPEC` i `levels.js`:

```js
['hjarta', 5, 'l b', 'lada:mitt:2 lera:allt', 'boss'],
```

1. **Form** — en nyckel i `FORMER`.
2. **Antal sorter** — 4 till 6.
3. **Mål**:
   - `p` poäng
   - `l` all lera
   - `b` alla lådor
   - `o` allt ogräs
   - `k` alla koppel
   - `e3` tre köttben
   - `f2:25` 25 ostbitar
   - `raket3` tre raketer
   - `boll10` tio tennisbollar
   - `klocka5` fem klockor
   - `hopp2` Happy ska hoppa två gånger
   - `paket8` öppna åtta paket
4. **Lager** — `typ:mönster:nivå` där typ är `lera`, `lada`, `koppel`, `ograss`, `kott`, `boll`, `klocka` eller `paket`. Mönstren finns i `MONSTER`.
5. **Flaggor** — `boss`, `latt`, `svar`, `supersvar`, `tips:<nyckel>`, `happy` (Happy på brädet), `paket` eller `paket:0.08` (paket ramlar in, med den chansen), `bollar` eller `bollar:0.04` (tennisbollar ramlar in), `klockor:<tid>` (godis med klocka kommer in, med `<tid>` drag på sig).

Dragantal och stjärngränser står i `STAMNING` och kommer från provspelning.
Ändrar du en bana: spela den själv och justera dragen och stjärnorna för hand.
Testerna kollar att varje bana går att bygga, har drag från start och att
målen faktiskt finns på kartan.
