# Krossen

Hjälp Happy få godis. En match-3 i Candy Crush-stil med 100 banor på Happys
promenad, fem världar à 20 banor och en bossbana sist i varje värld.

## Filerna

| Fil | Vad den gör |
| --- | --- |
| `engine.js` | Reglerna. Ren logik, ingen React. Ett drag körs som en generator som yieldar ett steg i taget (byte, rensning, fall, leverans ...). |
| `levels.js` | Världarna, de 100 banorna, tipsen och `STAMNING` (dragantal och stjärngränser per bana). |
| `pieces.jsx` | All grafik som SVG: godiset, specialpjäserna, hindren och ikonerna. |
| `fx.js` | Effekterna. Pjäsernas rörelser med Web Animations API, partiklar på en canvas. |
| `audio.js` | Allt ljud syntas i webbläsaren, plus bakgrundsmusiken. |
| `store.js` | Det som sparas i webbläsaren: stjärnor, mynt, boosters, sedda tips. |
| `Spelplan.jsx` | En omgång på en bana: brädet, statusraden, boostrarna, vinst- och förlustrutorna. |
| `Karta.jsx` | Kartan med stigen. |
| `KrossenGame.jsx` | Håller ihop allt: vilken bana som spelas, kartan, sparningen. |

Testerna ligger i `frontend/tests/krossen-engine.test.mjs` och körs med
`npm test` från repots rot.

## Pjäserna

| Färg | Sort |
| --- | --- |
| 0 röd | hjärtkex |
| 1 orange | ben |
| 2 gul | ostbit |
| 3 grön | tass |
| 4 blå | fiskkex |
| 5 lila | munk |

Specialpjäser: 4 i rad ger raket, 2×2 ger frisbee, 5 i L/T ger bomb (smäller
två gånger), 5 i rad ger Godisskålen. Alla kombinationer av två specialpjäser
gör något eget.

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
4. **Lager** — `typ:mönster:nivå` där typ är `lera`, `lada`, `koppel`, `ograss` eller `kott`. Mönstren finns i `MONSTER`.
5. **Flaggor** — `boss`, `latt`, `tips:<nyckel>`.

Dragantal och stjärngränser står i `STAMNING` och kommer från provspelning.
Ändrar du en bana: spela den själv och justera dragen och stjärnorna för hand.
Testerna kollar att varje bana går att bygga, har drag från start och att
målen faktiskt finns på kartan.
