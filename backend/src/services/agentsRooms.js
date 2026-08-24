import { WORDS } from './agentsWords.js';

/**
 * Rumshantering för Agenter.
 *
 * Allt ligger i minnet — startar backend om försvinner pågående spel.
 * Det är medvetet: ett partyspel behöver ingen databas, och rummen
 * lever bara några timmar.
 *
 * Nyckeln (vilket ord som tillhör vilket lag) lämnar ALDRIG servern
 * till någon annan än en spelledare. Se buildState() längst ner.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVXYZ23456789';
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;   // rum städas bort efter 6h utan aktivitet
const ONLINE_MS = 20 * 1000;              // spelare räknas som online i 20s efter senaste anrop
const MAX_ROOMS = 200;

// Personliga spelarfärger — separata från lagfärgerna, används för att visa
// vem som markerat vilket ord under diskussion. Håller sig borta från
// rött/blått så de inte kan förväxlas med lagtillhörighet.
export const PLAYER_COLORS = [
  '#fbbf24', '#34d399', '#a78bfa', '#f472b6',
  '#22d3ee', '#fb923c', '#a3e635', '#e879f9'
];

const rooms = new Map();

/* ── Småfunktioner ────────────────────────────────────────────── */

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  throw fail(503, 'Kunde inte skapa rum, försök igen');
}

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function other(team) {
  return team === 'red' ? 'blue' : 'red';
}

function touch(room) {
  room.version++;
  room.updatedAt = Date.now();
}

function cleanName(name) {
  const trimmed = String(name || '').trim().slice(0, 18);
  return trimmed || 'Spelare';
}

// Första lediga färgen i rummet. Om alla är tagna (fler än 8 spelare)
// får någon dela färg — det är ett hyfsat sällsynt läge för ett partyspel.
function pickColor(room) {
  const used = new Set([...room.players.values()].map(p => p.color));
  const free = PLAYER_COLORS.find(c => !used.has(c));
  return free || PLAYER_COLORS[room.players.size % PLAYER_COLORS.length];
}

/* ── Hämta rum / spelare ──────────────────────────────────────── */

function getRoom(code) {
  const room = rooms.get(String(code || '').toUpperCase());
  if (!room) throw fail(404, 'Rummet finns inte — kolla koden');
  return room;
}

function getPlayer(room, playerId) {
  const player = room.players.get(playerId);
  if (!player) throw fail(403, 'Du är inte med i rummet längre — gå med igen');
  player.lastSeen = Date.now();
  return player;
}

function hostOf(room) {
  return room.hostId;
}

function requireHost(room, player) {
  if (player.id !== hostOf(room)) throw fail(403, 'Bara den som skapade rummet kan göra det');
}

/* ── Skapa och gå med ─────────────────────────────────────────── */

export function createRoom(name) {
  if (rooms.size >= MAX_ROOMS) pruneRooms(true);
  if (rooms.size >= MAX_ROOMS) throw fail(503, 'Servern är full just nu');

  const code = makeCode();
  const playerId = makeId();
  const room = {
    code,
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    phase: 'lobby',
    hostId: playerId,
    players: new Map(),
    words: [],
    key: [],
    revealed: [],
    marks: {},
    remaining: { red: 0, blue: 0 },
    turn: 'red',
    clue: null,
    guessesLeft: 0,
    history: [],
    winner: null,
    winReason: '',
    log: 'Väntar på att alla ska välja lag.'
  };
  room.players.set(playerId, {
    id: playerId,
    name: cleanName(name),
    team: null,
    role: 'operative',
    color: pickColor(room),
    lastSeen: Date.now()
  });
  rooms.set(code, room);
  return { room, playerId };
}

export function joinRoom(code, name, existingId) {
  const room = getRoom(code);

  // Redan med? Då är det en omladdning av sidan, inte en ny spelare.
  if (existingId && room.players.has(existingId)) {
    const player = room.players.get(existingId);
    player.lastSeen = Date.now();
    if (name) player.name = cleanName(name);
    return { room, playerId: existingId };
  }

  if (room.players.size >= 30) throw fail(403, 'Rummet är fullt');

  const playerId = makeId();
  room.players.set(playerId, {
    id: playerId,
    name: cleanName(name),
    team: null,
    role: 'operative',
    color: pickColor(room),
    lastSeen: Date.now()
  });
  room.log = `${cleanName(name)} kom in i rummet.`;
  touch(room);
  return { room, playerId };
}

export function leaveRoom(code, playerId) {
  const room = getRoom(code);
  const player = room.players.get(playerId);
  if (!player) return { room };

  room.players.delete(playerId);
  for (const i of Object.keys(room.marks)) {
    room.marks[i] = room.marks[i].filter(id => id !== playerId);
    if (!room.marks[i].length) delete room.marks[i];
  }
  if (room.players.size === 0) {
    rooms.delete(room.code);
    return { room: null };
  }
  if (room.hostId === playerId) {
    room.hostId = room.players.keys().next().value;
  }
  room.log = `${player.name} lämnade rummet.`;
  touch(room);
  return { room };
}

/* ── Lobby ────────────────────────────────────────────────────── */

export function setTeam(code, playerId, team, role) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);
  if (room.phase === 'playing') throw fail(409, 'Spelet är redan igång');

  if (team !== 'red' && team !== 'blue' && team !== null) throw fail(400, 'Okänt lag');
  if (role !== 'spymaster' && role !== 'operative') throw fail(400, 'Okänd roll');

  // Bara en spelledare per lag.
  if (team && role === 'spymaster') {
    for (const p of room.players.values()) {
      if (p.id !== playerId && p.team === team && p.role === 'spymaster') {
        p.role = 'operative';
      }
    }
  }

  player.team = team;
  player.role = team ? role : 'operative';
  touch(room);
  return room;
}

export function shuffleTeams(code, playerId) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);
  requireHost(room, player);
  if (room.phase === 'playing') throw fail(409, 'Spelet är redan igång');

  const ids = shuffle([...room.players.keys()]);
  ids.forEach((id, i) => {
    const p = room.players.get(id);
    p.team = i % 2 === 0 ? 'red' : 'blue';
    p.role = 'operative';
  });
  // Första i varje lag blir spelledare.
  for (const team of ['red', 'blue']) {
    const first = ids.map(id => room.players.get(id)).find(p => p.team === team);
    if (first) first.role = 'spymaster';
  }
  room.log = 'Lagen lottades om.';
  touch(room);
  return room;
}

export function setColor(code, playerId, color) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);

  if (!PLAYER_COLORS.includes(color)) throw fail(400, 'Ogiltig färg');
  const taken = [...room.players.values()].some(p => p.id !== playerId && p.color === color);
  if (taken) throw fail(409, 'Färgen är redan tagen');

  player.color = color;
  touch(room);
  return room;
}

function spymasterOf(room, team) {
  for (const p of room.players.values()) {
    if (p.team === team && p.role === 'spymaster') return p;
  }
  return null;
}

export function lobbyProblems(room) {
  const problems = [];
  for (const team of ['red', 'blue']) {
    const label = team === 'red' ? 'Rött lag' : 'Blått lag';
    const members = [...room.players.values()].filter(p => p.team === team);
    if (!members.length) problems.push(`${label} saknar spelare`);
    else if (!spymasterOf(room, team)) problems.push(`${label} saknar spelledare`);
  }
  return problems;
}

/* ── Starta spel ──────────────────────────────────────────────── */

function deal(room) {
  const words = shuffle(WORDS).slice(0, 25);
  const first = Math.random() < 0.5 ? 'red' : 'blue';
  const second = other(first);

  const key = [];
  for (let i = 0; i < 9; i++) key.push(first);
  for (let i = 0; i < 8; i++) key.push(second);
  for (let i = 0; i < 7; i++) key.push('civil');
  key.push('mole');

  room.words = words;
  room.key = shuffle(key);
  room.revealed = new Array(25).fill(false);
  room.marks = {};
  room.remaining = { red: first === 'red' ? 9 : 8, blue: first === 'blue' ? 9 : 8 };
  room.turn = first;
  room.clue = null;
  room.guessesLeft = 0;
  room.history = [];
  room.winner = null;
  room.winReason = '';
  room.phase = 'playing';
  room.log = `${teamName(first)} börjar. Väntar på ledtråd.`;
}

export function startGame(code, playerId) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);
  requireHost(room, player);

  const problems = lobbyProblems(room);
  if (problems.length) throw fail(400, problems.join(' · '));

  deal(room);
  touch(room);
  return room;
}

export function backToLobby(code, playerId) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);
  requireHost(room, player);

  room.phase = 'lobby';
  room.words = [];
  room.key = [];
  room.revealed = [];
  room.marks = {};
  room.history = [];
  room.clue = null;
  room.winner = null;
  room.log = 'Tillbaka i lobbyn — byt lag om ni vill.';
  touch(room);
  return room;
}

export function newRound(code, playerId) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);
  requireHost(room, player);

  const problems = lobbyProblems(room);
  if (problems.length) throw fail(400, problems.join(' · '));

  deal(room);
  touch(room);
  return room;
}

/* ── Spelet ───────────────────────────────────────────────────── */

function teamName(team) {
  return team === 'red' ? 'Rött lag' : 'Blått lag';
}

const ROLE_LABEL = { red: 'röd agent', blue: 'blå agent', civil: 'civil', mole: 'mullvaden' };

export function giveClue(code, playerId, word, count) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);

  if (room.phase !== 'playing') throw fail(409, 'Spelet är inte igång');
  if (player.team !== room.turn) throw fail(403, 'Det är inte ditt lags tur');
  if (player.role !== 'spymaster') throw fail(403, 'Bara spelledaren ger ledtrådar');
  if (room.clue) throw fail(409, 'Ledtråden är redan given');

  const clean = String(word || '').trim();
  if (!clean) throw fail(400, 'Skriv en ledtråd');
  if (clean.length > 24) throw fail(400, 'Ledtråden är för lång');

  const upper = clean.toUpperCase();
  const onBoard = room.words.some((w, i) => !room.revealed[i] && w === upper);
  if (onBoard) throw fail(400, 'Ledtråden får inte vara ett ord som ligger på brädet');

  const n = Number.isFinite(+count) ? Math.max(0, Math.min(9, Math.floor(+count))) : 1;

  room.clue = { word: upper, count: n, team: player.team, by: player.name };
  room.guessesLeft = n === 0 ? 99 : n + 1;
  room.marks = {};
  room.history.push({ team: player.team, word: upper, count: n, by: player.name, picks: [] });
  room.log = `${teamName(player.team)} fick ledtråden ${upper} ${n}.`;
  touch(room);
  return room;
}

/** Markera/avmarkera ett ord under diskussion — påverkar inte gissningar. */
export function toggleMark(code, playerId, index) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);

  if (room.phase !== 'playing') throw fail(409, 'Spelet är inte igång');
  if (player.team !== room.turn) throw fail(403, 'Det är inte ditt lags tur');
  if (player.role === 'spymaster') throw fail(403, 'Spelledaren markerar inte ord');
  if (!room.clue) throw fail(409, 'Vänta på ledtråden');

  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i > 24) throw fail(400, 'Ogiltigt kort');
  if (room.revealed[i]) throw fail(409, 'Kortet är redan vänt');

  const marked = room.marks[i] || [];
  const next = marked.includes(playerId) ? marked.filter(id => id !== playerId) : [...marked, playerId];
  if (next.length) room.marks[i] = next;
  else delete room.marks[i];

  touch(room);
  return room;
}

function endTurnInternal(room) {
  room.turn = other(room.turn);
  room.clue = null;
  room.guessesLeft = 0;
  room.marks = {};
}

function finish(room, winner, reason) {
  room.phase = 'over';
  room.winner = winner;
  room.winReason = reason;
  room.clue = null;
  room.revealed = room.revealed.map(() => true);
  room.log = `${teamName(winner)} vinner. ${reason}`;
}

export function guess(code, playerId, index) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);

  if (room.phase !== 'playing') throw fail(409, 'Spelet är inte igång');
  if (player.team !== room.turn) throw fail(403, 'Det är inte ditt lags tur');
  if (player.role === 'spymaster') throw fail(403, 'Spelledaren får inte gissa');
  if (!room.clue) throw fail(409, 'Vänta på ledtråden');

  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i > 24) throw fail(400, 'Ogiltigt kort');
  if (room.revealed[i]) throw fail(409, 'Kortet är redan vänt');

  room.revealed[i] = true;
  delete room.marks[i];
  const role = room.key[i];
  const team = player.team;
  const word = room.words[i];

  const entry = room.history[room.history.length - 1];
  if (entry) entry.picks.push({ index: i, word, role, by: player.name });

  if (role === 'mole') {
    finish(room, other(team), `${teamName(team)} avslöjade mullvaden.`);
    touch(room);
    return room;
  }

  if (role === team) {
    room.remaining[team]--;
    if (room.remaining[team] === 0) {
      finish(room, team, 'Alla agenter hittade.');
      touch(room);
      return room;
    }
    room.guessesLeft--;
    if (room.guessesLeft <= 0) {
      room.log = `${word} var rätt, men gissningarna tog slut.`;
      endTurnInternal(room);
    } else {
      room.log = `${word} — rätt agent.`;
    }
  } else if (role === 'civil') {
    room.log = `${word} — civil. Draget går över.`;
    endTurnInternal(room);
  } else {
    room.remaining[role]--;
    if (room.remaining[role] === 0) {
      finish(room, role, `${teamName(team)} avslöjade motståndarens sista agent.`);
      touch(room);
      return room;
    }
    room.log = `${word} — ${ROLE_LABEL[role]}. Draget går över.`;
    endTurnInternal(room);
  }

  touch(room);
  return room;
}

export function endTurn(code, playerId) {
  const room = getRoom(code);
  const player = getPlayer(room, playerId);

  if (room.phase !== 'playing') throw fail(409, 'Spelet är inte igång');
  if (player.team !== room.turn) throw fail(403, 'Det är inte ditt lags tur');
  if (player.role === 'spymaster') throw fail(403, 'Spelledaren avslutar inte draget');
  if (!room.clue) throw fail(409, 'Ingen ledtråd att avsluta');

  room.log = `${teamName(player.team)} avslutade draget.`;
  endTurnInternal(room);
  touch(room);
  return room;
}

/* ── Städning ─────────────────────────────────────────────────── */

export function pruneRooms(aggressive = false) {
  const now = Date.now();
  const limit = aggressive ? 30 * 60 * 1000 : ROOM_TTL_MS;
  for (const [code, room] of rooms) {
    if (now - room.updatedAt > limit) rooms.delete(code);
  }
}

const pruneTimer = setInterval(() => pruneRooms(), 10 * 60 * 1000);
if (typeof pruneTimer.unref === 'function') pruneTimer.unref();

export function roomCount() {
  return rooms.size;
}

/* ── Vy per spelare ───────────────────────────────────────────── */

export function buildState(room, playerId) {
  const me = room.players.get(playerId) || null;
  const now = Date.now();
  const isSpymaster = !!me && me.role === 'spymaster' && !!me.team;
  const revealKey = isSpymaster || room.phase === 'over';

  return {
    code: room.code,
    version: room.version,
    phase: room.phase,
    log: room.log,
    you: me
      ? { id: me.id, name: me.name, team: me.team, role: me.role, color: me.color, isHost: me.id === room.hostId }
      : null,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      color: p.color,
      isHost: p.id === room.hostId,
      online: now - p.lastSeen < ONLINE_MS
    })),
    problems: room.phase === 'lobby' ? lobbyProblems(room) : [],
    words: room.words,
    revealed: room.revealed,
    // Markeringar är inte hemliga — båda lagen ser vem som pekat på vad.
    marks: room.marks,
    // Nyckeln skickas bara till spelledare, eller när spelet är slut.
    key: revealKey ? room.key : null,
    remaining: room.remaining,
    turn: room.turn,
    clue: room.clue,
    guessesLeft: room.guessesLeft,
    history: room.history,
    winner: room.winner,
    winReason: room.winReason
  };
}

export function stateOf(code, playerId) {
  const room = getRoom(code);
  const player = room.players.get(playerId);
  if (player) player.lastSeen = Date.now();
  return buildState(room, playerId);
}
