import express from 'express';
import { WORDS } from '../services/agentsWords.js';
import {
  createRoom, joinRoom, leaveRoom, setTeam, shuffleTeams,
  startGame, newRound, backToLobby,
  giveClue, guess, endTurn,
  buildState, stateOf, roomCount
} from '../services/agentsRooms.js';

const router = express.Router();

/** Skickar tillbaka rummets tillstånd sett från en viss spelare. */
function sendState(res, room, playerId, extra = {}) {
  res.json({ ...extra, state: buildState(room, playerId) });
}

/** Fångar fel från spellogiken och gör om dem till vettiga HTTP-svar. */
function handle(fn) {
  return (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'Något gick fel' });
    }
  };
}

/* Ordlistan — används av lokalt läge i frontend. */
router.get('/words', (req, res) => {
  res.json({ words: WORDS, count: WORDS.length });
});

router.get('/status', (req, res) => {
  res.json({ rooms: roomCount() });
});

/* Skapa rum */
router.post('/rooms', handle((req, res) => {
  const { room, playerId } = createRoom(req.body?.name);
  sendState(res, room, playerId, { playerId, code: room.code });
}));

/* Gå med i rum (eller återansluta med samma playerId efter omladdning) */
router.post('/rooms/:code/join', handle((req, res) => {
  const { room, playerId } = joinRoom(req.params.code, req.body?.name, req.body?.playerId);
  sendState(res, room, playerId, { playerId, code: room.code });
}));

/* Hämta tillstånd — det här är anropet som pollas varje sekund */
router.get('/rooms/:code', handle((req, res) => {
  res.json({ state: stateOf(req.params.code, req.query.playerId) });
}));

/* Lobby */
router.post('/rooms/:code/team', handle((req, res) => {
  const { playerId, team, role } = req.body || {};
  const room = setTeam(req.params.code, playerId, team ?? null, role || 'operative');
  sendState(res, room, playerId);
}));

router.post('/rooms/:code/shuffle', handle((req, res) => {
  const { playerId } = req.body || {};
  const room = shuffleTeams(req.params.code, playerId);
  sendState(res, room, playerId);
}));

router.post('/rooms/:code/start', handle((req, res) => {
  const { playerId } = req.body || {};
  const room = startGame(req.params.code, playerId);
  sendState(res, room, playerId);
}));

router.post('/rooms/:code/round', handle((req, res) => {
  const { playerId } = req.body || {};
  const room = newRound(req.params.code, playerId);
  sendState(res, room, playerId);
}));

router.post('/rooms/:code/lobby', handle((req, res) => {
  const { playerId } = req.body || {};
  const room = backToLobby(req.params.code, playerId);
  sendState(res, room, playerId);
}));

/* Spelet */
router.post('/rooms/:code/clue', handle((req, res) => {
  const { playerId, word, count } = req.body || {};
  const room = giveClue(req.params.code, playerId, word, count);
  sendState(res, room, playerId);
}));

router.post('/rooms/:code/guess', handle((req, res) => {
  const { playerId, index } = req.body || {};
  const room = guess(req.params.code, playerId, index);
  sendState(res, room, playerId);
}));

router.post('/rooms/:code/endturn', handle((req, res) => {
  const { playerId } = req.body || {};
  const room = endTurn(req.params.code, playerId);
  sendState(res, room, playerId);
}));

router.post('/rooms/:code/leave', handle((req, res) => {
  const { playerId } = req.body || {};
  const { room } = leaveRoom(req.params.code, playerId);
  if (!room) return res.json({ left: true, state: null });
  sendState(res, room, playerId, { left: true });
}));

export default router;
