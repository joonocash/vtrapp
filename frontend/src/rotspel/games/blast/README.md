# Rötblast

Block Blast-liknande pusselspel för rötspel-sidan. 8×8, tre bitar åt gången, ingen rotation.

**Klassiskt** — lägg bitar tills ingen får plats. Då räknas poängen.

**Äventyr** — 160 banor. Ingen dragbudget och ingen klocka: bitarna du får bär ibland en
figur, figuren följer med ner på brädet, och du samlar in den först när raden eller kolumnen
den ligger i rensas. Banan är klar när du samlat allt, och slut när brädet är fullt — samma
förlustvillkor som klassiskt. Pressen kommer från att överleva, inte från en nedräkning.

Stjärnorna belönar effektivitet i stället för poäng: klara banan alls ger en stjärna, klara
den på få utlagda bitar ger två eller tre.

## Filer

| Fil | Vad |
|---|---|
| `engine.js` | All spellogik. Ingen React, inget DOM. |
| `pieces.js` | 37 bitformer och färgpaletten. |
| `levels.js` | 8 paket × 20 banor. De fem första handbyggda, resten genereras från bannumret. |
| `audio.js` | Web Audio. Alla ljud genereras, inga ljudfiler. |
| `particles.js` | Canvaslager för partiklar. |
| `BlastGame.jsx` | Meny, bankarta, spelplan, drag & drop, animationer. |
| `blast.css` | Allt utseende. Alla klasser är prefixade `bb-`. |
| `engine.test.mjs` | Röktest: 60 partier + alla 160 banor. `node engine.test.mjs` |
| `levels.sim.mjs` | Spelar igenom alla banor med en bot och rapporterar svårighetsgrad. |

Inga nya beroenden. React 18 och en bundler som klarar `import './blast.css'` räcker.

## Lägg in det

```bash
cd ~/vtrapp/frontend/src/rotspel/games
mkdir blast && cp /din/nedladdning/blast/* blast/
rm blast/engine.test.mjs blast/levels.sim.mjs   # eller flytta till en test-mapp
```

Sen en post i din registry:

```js
import BlastGame from './blast/BlastGame.jsx';

{
  id: 'blast',
  name: 'Rötblast',
  description: '8×8-pussel med 160 banor',
  component: BlastGame,
}
```

Fältnamnen ovan är gissade utifrån hur Snake ligger — kolla din befintliga post och matcha den.

### Highscore

`BlastGame` tar en valfri prop `onScore(poäng)` som anropas när ett klassiskt parti tar slut.
Äventyrsbanor rapporterar inte in — stjärnorna sparas i `localStorage` under
`rotspel-blast-v1`.

```jsx
const { submit } = useHighscore('blast');
<BlastGame onScore={submit} />
```

### Deploy

```bash
git pull
cd frontend && npm install && npm run build
cd ../backend && npm install --production
pm2 restart vtrapp-backend
sudo systemctl restart nginx
```

## Balansen, och hur du ändrar den

`node levels.sim.mjs` spelar igenom alla 160 banor tre gånger med en medelmåttig bot och
skriver ut hur ofta den klarar dem. Kör den efter varje ändring i `levels.js`. Så här ser det
ut nu:

```
Lövskogen      klarade  90%  bitar 17   Myren          klarade  77%  bitar 19
Stenriket      klarade  92%  bitar 17   Bärlandet      klarade  78%  bitar 21
Isvidderna     klarade  88%  bitar 17   Fjärilsdalen   klarade  77%  bitar 20
Svampgrottan   klarade  85%  bitar 19   Rötdjupet      klarade  58%  bitar 21
```

Boten har ingen framförhållning, så en människa ligger klart över de siffrorna. Snittet
landar på knappt två stjärnor, vilket betyder att tre stjärnor är en riktig utmaning.

**Fler eller färre figurer per bana:** `need` i `buildLevel`. **Hur ofta en bit bär en figur:**
`tokenChance`. De två tillsammans avgör hur många bitar man minst måste lägga, och `par`
räknas ut från just det — sänk inte `par[1]` under `need / tokenChance`, då blir tre stjärnor
matematiskt omöjligt. `engine.test.mjs` kollar det åt dig.

**Hinder** läggs av `scatter()` i klumpar om två eller tre rutor, med dragning mot kanterna.
Det är avsiktligt: lösa enstaka rutor mitt på brädet fragmenterar ytan så illa att stora bitar
inte får plats någonstans, och då dör banan efter ett par drag. Om du lägger till egna hinder,
gör det i klumpar.

**Svårighetsgraden i bitutdelningen:** `bias` i `weightedPiece()` i `engine.js` styr hur mycket
mindre bitarna blir när brädet fylls. Höj till `0.2` för snällare spel, sänk till `0.05` för
brutalt.

**Poäng:** `COMBO_MULT` och `streakMult` i `engine.js`.

**Ljud:** `audio.js`. Den viktiga effekten är `sfx.clear()` — varje rensning i rad ligger ett
halvtonssteg högre.

## Två mål jag tog bort efter att ha testat dem

"Krossa all is" och "rensa bort allt som låg där från början" ser rimliga ut men kräver att du
fyller exakt den rad en enstaka kvarvarande ruta ligger i. Boten klarade under 20% av de
banorna. De finns kvar som måltyper i koden och används i handbyggda bana 4, där det
förplacerade ligger som en sammanhängande rad och därför går att rensa.

Samma sak med combo som obligatoriskt mål: eftersom banan inte kan ta slut på tid kan man
fastna hur länge som helst utan att råka få en dubbelrensning. Det används bara i bana 5 som
introduktion.

## Saker jag medvetet lät bli

- Powerups. Passar dåligt ihop med highscore om de är gratis.
- Onlinerankning per bana. Flytta stjärnorna till `scores.js` om du vill kunna tävla.
- Rotation av bitar. Originalet har det inte, och det är därför spelet är svårt.
