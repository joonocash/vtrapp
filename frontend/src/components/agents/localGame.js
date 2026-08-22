/**
 * Lokalt läge — allt körs i webbläsaren, ingen server inblandad utöver
 * att ordlistan hämtas en gång.
 *
 * Tillståndet har medvetet samma form som serverns, så samma UI-komponenter
 * kan rendera båda lägena.
 */

const TEAM_NAME = { red: 'Rött lag', blue: 'Blått lag' };
const ROLE_NAME = { red: 'röd agent', blue: 'blå agent', civil: 'civil', mole: 'mullvaden' };

/* Överlever att komponenten avmonteras när man byter flik i appen. */
let cached = null;
export function readCache() { return cached; }
export function writeCache(state) { cached = state; }
export function clearCache() { cached = null; }

/* Ordlistan hämtas en gång och sparas i modulen. */
let wordsPromise = null;
export function loadWords() {
  if (!wordsPromise) {
    wordsPromise = fetch('/api/agents/words')
      .then(r => {
        if (!r.ok) throw new Error('Kunde inte hämta ordlistan');
        return r.json();
      })
      .then(d => d.words)
      .catch(err => { wordsPromise = null; throw err; });
  }
  return wordsPromise;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const other = t => (t === 'red' ? 'blue' : 'red');

export function newGame(words) {
  const picked = shuffle(words).slice(0, 25);
  const first = Math.random() < 0.5 ? 'red' : 'blue';
  const second = other(first);

  const key = [];
  for (let i = 0; i < 9; i++) key.push(first);
  for (let i = 0; i < 8; i++) key.push(second);
  for (let i = 0; i < 7; i++) key.push('civil');
  key.push('mole');

  return {
    phase: 'playing',
    words: picked,
    key: shuffle(key),
    revealed: new Array(25).fill(false),
    remaining: { red: first === 'red' ? 9 : 8, blue: first === 'blue' ? 9 : 8 },
    turn: first,
    clue: null,
    guessesLeft: 0,
    history: [],
    winner: null,
    winReason: '',
    showKey: false,
    log: `${TEAM_NAME[first]} börjar. Ge en ledtråd.`
  };
}

export function giveClue(state, word, count) {
  const upper = String(word).trim().toUpperCase();
  if (!upper) return state;

  const onBoard = state.words.some((w, i) => !state.revealed[i] && w === upper);
  if (onBoard) {
    return { ...state, log: 'Ledtråden får inte vara ett ord som ligger på brädet.' };
  }

  const n = Math.max(0, Math.min(9, Math.floor(Number(count) || 0)));
  return {
    ...state,
    clue: { word: upper, count: n, team: state.turn },
    guessesLeft: n === 0 ? 99 : n + 1,
    history: [...state.history, { team: state.turn, word: upper, count: n, picks: [] }],
    log: `${TEAM_NAME[state.turn]} fick ledtråden ${upper} ${n}.`
  };
}

function passTurn(state) {
  return { ...state, turn: other(state.turn), clue: null, guessesLeft: 0 };
}

function finish(state, winner, reason) {
  return {
    ...state,
    phase: 'over',
    winner,
    winReason: reason,
    clue: null,
    revealed: state.revealed.map(() => true),
    log: `${TEAM_NAME[winner]} vinner. ${reason}`
  };
}

export function pick(state, index) {
  if (state.phase !== 'playing' || !state.clue || state.revealed[index]) return state;

  const revealed = state.revealed.slice();
  revealed[index] = true;

  const role = state.key[index];
  const team = state.turn;
  const word = state.words[index];

  const history = state.history.slice();
  const last = history[history.length - 1];
  if (last) {
    history[history.length - 1] = { ...last, picks: [...last.picks, { index, word, role }] };
  }

  let next = { ...state, revealed, history };

  if (role === 'mole') {
    return finish(next, other(team), `${TEAM_NAME[team]} avslöjade mullvaden.`);
  }

  if (role === team) {
    const remaining = { ...next.remaining, [team]: next.remaining[team] - 1 };
    next = { ...next, remaining };
    if (remaining[team] === 0) return finish(next, team, 'Alla agenter hittade.');

    const left = next.guessesLeft - 1;
    if (left <= 0) {
      return { ...passTurn(next), log: `${word} var rätt, men gissningarna tog slut.` };
    }
    return { ...next, guessesLeft: left, log: `${word} — rätt agent.` };
  }

  if (role === 'civil') {
    return { ...passTurn(next), log: `${word} — civil. Draget går över.` };
  }

  const remaining = { ...next.remaining, [role]: next.remaining[role] - 1 };
  next = { ...next, remaining };
  if (remaining[role] === 0) {
    return finish(next, role, `${TEAM_NAME[team]} avslöjade motståndarens sista agent.`);
  }
  return { ...passTurn(next), log: `${word} — ${ROLE_NAME[role]}. Draget går över.` };
}

export function endTurn(state) {
  if (state.phase !== 'playing' || !state.clue) return state;
  return { ...passTurn(state), log: `${TEAM_NAME[state.turn]} avslutade draget.` };
}
