# Rötblast

Block Blast-liknande pusselspel för rötspel-sidan. 8×8, tre bitar åt gången, ingen rotation.
Klassiskt läge med rekord och äventyrsläge med 160 banor.

## Filer

| Fil | Vad |
|---|---|
| `engine.js` | All spellogik. Ingen React, inget DOM — går att testa i node. |
| `pieces.js` | 37 bitformer och färgpaletten. |
| `levels.js` | 8 paket × 20 banor. De första handbyggda, resten genereras från bannumret. |
| `audio.js` | Web Audio. Alla ljud genereras, inga ljudfiler. |
| `particles.js` | Canvaslager för partiklar. |
| `BlastGame.jsx` | Meny, bankarta, spelplan, drag & drop, animationer. |
| `blast.css` | Allt utseende. Alla klasser är prefixade `bb-`. |
| `engine.test.mjs` | Röktest: 60 partier + alla 160 banor. `node engine.test.mjs` |

Inga nya beroenden. React 18 och en bundler som klarar `import './blast.css'` räcker, vilket Vite gör.

## Lägg in det

```bash
cd ~/vtrapp/frontend/src/rotspel/games
mkdir blast && cp /din/nedladdning/blast/* blast/
```

Sen en rad i din registry i `games/`:

```js
import BlastGame from './blast/BlastGame.jsx';

// ...i listan över spel
{
  id: 'blast',
  name: 'Rötblast',
  description: '8×8-pussel med 160 banor',
  component: BlastGame,
}
```

Fältnamnen ovan är gissade från hur Snake ligger — kolla din befintliga post och matcha den.

### Highscore

Komponenten tar en valfri prop `onScore`, som anropas med slutpoängen när ett klassiskt parti
tar slut. Äventyrsbanor rapporterar inte in, de sparar stjärnor lokalt.

```jsx
const { submit } = useHighscore('blast');
<BlastGame onScore={submit} />
```

Matcha mot vad din `useHighscore` faktiskt returnerar. Rekord och stjärnor sparas dessutom
alltid i `localStorage` under nyckeln `rotspel-blast-v1`.

### Deploy

Vanliga vägen:

```bash
git pull
cd frontend && npm install && npm run build
cd ../backend && npm install --production
pm2 restart vtrapp-backend
sudo systemctl restart nginx
```

## Skruva på det

**Svårighetsgrad.** `generateTray()` i `engine.js` väljer tre bitar som garanterat går att
spela ut i någon ordning. `bias` i `weightedPiece()` styr hur mycket mindre bitarna blir när
brädet fylls — höj till `0.2` för snällare spel, sänk till `0.05` för brutalt.

**Poäng.** `COMBO_MULT` och `streakMult` i `engine.js`. Just nu ger fyra linjer i ett drag
med fem rensningar i rad 4 160 poäng.

**Banor.** `buildLevel(id)` i `levels.js`. Lägg till en post i `HANDMADE` för att bygga en bana
för hand, annars genereras den. Vill du ha fler banor: höj `LEVELS_PER_PACK` eller lägg till
ett paket i `PACKS` och en `case` i switchen.

**Nya hindertyper.** Lägg till typen i `resolveClears()` i `engine.js`, en `.bb-t-dintyp`-regel
i `blast.css`, och strö ut den från `buildLevel`.

**Ljud.** `audio.js`. Den viktiga effekten är `sfx.clear()` — varje rensning i rad ligger ett
halvtonssteg högre. Ändra `base` där om du vill ha en annan tonart.

**Färger.** `COLORS` i `pieces.js` för blocken, CSS-variablerna högst upp i `blast.css` för resten.

## Saker jag medvetet lät bli

- Powerups (bomb, hammare, blanda om). Passar dåligt ihop med highscore om de är gratis.
- Onlinerankning per bana. Stjärnorna ligger i `localStorage` — flytta till `scores.js` om du
  vill kunna tävla mot andra.
- Rotation av bitar. Originalet har det inte, och det är därför spelet är svårt.
