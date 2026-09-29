# Trassel

Flow-liknande pusselspel för Rötspel. Dra en linje mellan prickarna i samma
färg, linjerna får inte korsa varandra och hela brädet ska fyllas.

Alla banor har **exakt en lösning** — generatorn bevisar det med en lösare
innan banan sparas.

## Lägen

**Banor** — sju paket, 170 banor: Nybörjare, Klassiskt, Stenar & staket,
Broar, Portaler, Blandat och Jumbo (upp till 11×11). 1–3 stjärnor per bana:
en för klar, två utan tips, tre för perfekt (lika många drag som färger).
En bana är öppen så länge högst två tidigare banor i paketet är olösta.

**Dagens** — samma bräde för alla i dag, tid mot topplistan. Veckodagen styr
temat: klassisk måndag, stenig tisdag, bro-onsdag, portaltorsdag, fredagsmix,
jumbolördag, söndagsknut. Första lösningen räknas, tips kostar 20 s. Klockan
sparas i webbläsaren, så en omladdning nollställer den inte. Dagar i rad visas
som 🔥.

**Tidsjakt** — 60 sekunder. Varje löst bräde ger poäng (rutor, dubbelt om
perfekt) och tid tillbaka. Bräden växer från 5×5 till 8×8. "Hoppa" kostar 5 s.
Lämnar man läget mitt i pausas klockan.

## Mekaniker

| | |
|---|---|
| Sten | Ruta som inte går att använda |
| Staket | Tunn vägg mellan två rutor |
| Bro | Två färger får korsa varandra, en vågrätt och en lodrätt. Båda filerna ska fyllas. |
| Portal | Lila markering i kanten. Linjen går ut på ena sidan och in på den andra. Man drar ut över kanten, släpper och fortsätter från andra sidan. |

## Filer

| Fil | Vad |
|---|---|
| `board.js` | Brädet som graf. Broar blir två noder, portaler blir kanter. Banformatet. |
| `solver.js` | Lösaren: räknar lösningar och mäter svårighet. |
| `generator.js` | Gör banor med exakt en lösning. Körs bara av skriptet nedan. |
| `game.js` | Spelmotorn: dra, klipp, ångra, tips, vinst. Ingen DOM. |
| `render.js` | Canvasritning och effekter. |
| `Board.jsx` | Canvas, pekare och ritloop. |
| `TrasselGame.jsx` | Lägen, statusrad, resultatrutor, topplistor, banväljare. |
| `audio.js` | Web Audio, inga ljudfiler. |
| `store.js` | localStorage (`trassel-v1`), Dagens Trassel, topplistor. |
| `banor/*.json` | De genererade banorna. En bana per rad. |

Topplistorna ligger i den vanliga `/api/scores`:
`trassel-dag-ÅÅÅÅ-MM-DD` (tid i ms, lägst först) och `trassel-tidsjakt` (poäng).

## Generera om banorna

```bash
cd ~/vtrapp/frontend
node tests/trassel-banor.gen.mjs            # allt (tar en stund, 10×10 och 11×11 är dyra)
node tests/trassel-banor.gen.mjs dagliga    # bara Dagens
```

Samma frön ger samma banor. Paketen, veckodagsteman och antal ändras i
listorna högst upp i skriptet. Dagens har 26 banor per veckodag, alltså ett
halvår innan de börjar om — höj `DAGLIGA_PER_VECKODAG` för fler.

## Tester

```bash
node frontend/tests/trassel.test.mjs
```

Kör lösaren över varje skeppad bana (exakt en lösning, den sparade), kollar
att generatorn är deterministisk och att spelmotorn följer Flow-reglerna.
