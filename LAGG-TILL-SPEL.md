# Lägga till ett nytt spel

## Alternativ A — bygga spelet som React-komponent

Bäst för allt som får plats på en canvas: Snake, Tetris, 2048, Breakout,
aim trainer, minröj.

1. Skapa `frontend/src/rotspel/games/MittSpel.jsx`. Kopiera strukturen från
   `Snake.jsx` — den är skriven som mall.

   Kontraktet är litet:
   - komponenten tar propen `onGameOver(score)`
   - den anropas exakt en gång när rundan tar slut
   - allt speltillstånd i en `useRef`, inte i `useState`
   - alla listeners och timers städas i `useEffect`-returen

2. Lägg till en rad i `games/index.js`:

```js
{
  id: 'mittspel',
  name: 'Mitt spel',
  blurb: 'En rad om hur man spelar.',
  category: 'arkad',
  accent: 'text-purple-400',
  scoreLabel: 'poäng',
  scoreFormat: 'number',
  higherIsBetter: true,
  load: () => import('./MittSpel.jsx'),
}
```

Klart. Kortet dyker upp i rutnätet, highscore fungerar, kategorin läggs
till i filterraden automatiskt.

## Alternativ B — spel från GitHub via iframe

Bäst för större spel eller när du inte orkar porta koden.

1. Klona spelet, bygg det om det behöver byggas.
2. Lägg de statiska filerna i `frontend/public/spel/<id>/`.
   `index.html` ska ligga direkt där.
3. Lägg till i registret med `iframe` istället för `load`:

```js
{
  id: '2048',
  name: '2048',
  blurb: 'Slå ihop brickor.',
  category: 'pussel',
  accent: 'text-amber-400',
  scoreFormat: 'none',
  iframe: '/spel/2048/index.html',
}
```

Vite kopierar allt under `public/` rakt in i `dist/` vid bygge, så nginx
serverar det utan extra konfiguration.

**Kolla licensen.** MIT och liknande är helt fria att självhosta. Många
små spel på GitHub har ingen licensfil alls — då har du formellt sett
ingen rätt att distribuera dem, även om sidan bara nås av dig och några
kompisar.

### Poäng från ett iframe-spel

Sätt `scoreFormat: 'none'` från början — enklast. Vill du ha highscore
måste spelet skicka poängen ut ur iframen med `postMessage`, och
`GameShell` måste lyssna. Det kräver att du redigerar spelets källkod, så
det är oftast inte värt det. Porta spelet istället om poängen betyder
något.

## Kategorier

Kategorierna byggs från registret, så du behöver inte deklarera dem.
Skriv en ny sträng i `category` så dyker den upp som filterknapp.

## Regeln som gör det rötigt

Ett spel ska starta direkt vid klick. Ingen startskärm, ingen meny, inget
"tryck space för att börja". Det är hela skillnaden mellan en spelsida man
öppnar och en man inte öppnar.
