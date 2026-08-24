const BASE = '/api/agents';
const SESSION_KEY = 'agenter.session';

/** Fel från backend kommer som { error }. Vi lyfter ut meddelandet och statuskoden. */
async function request(path, options) {
  let res;
  try {
    res = await fetch(BASE + path, options);
  } catch {
    const err = new Error('Ingen kontakt med servern');
    err.status = 0;
    throw err;
  }

  let data = null;
  try { data = await res.json(); } catch { /* tomt svar */ }

  if (!res.ok) {
    const err = new Error(data?.error || 'Något gick fel');
    err.status = res.status;
    throw err;
  }
  return data;
}

function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
}

export const api = {
  createRoom: name => post('/rooms', { name }),
  joinRoom: (code, name, playerId) => post(`/rooms/${code}/join`, { name, playerId }),
  getState: (code, playerId) =>
    request(`/rooms/${code}?playerId=${encodeURIComponent(playerId)}`).then(d => d.state),
  getColors: () => request('/colors').then(d => d.colors),
  setTeam: (code, playerId, team, role) => post(`/rooms/${code}/team`, { playerId, team, role }),
  setColor: (code, playerId, color) => post(`/rooms/${code}/color`, { playerId, color }),
  shuffleTeams: (code, playerId) => post(`/rooms/${code}/shuffle`, { playerId }),
  start: (code, playerId) => post(`/rooms/${code}/start`, { playerId }),
  newRound: (code, playerId) => post(`/rooms/${code}/round`, { playerId }),
  toLobby: (code, playerId) => post(`/rooms/${code}/lobby`, { playerId }),
  clue: (code, playerId, word, count) => post(`/rooms/${code}/clue`, { playerId, word, count }),
  guess: (code, playerId, index) => post(`/rooms/${code}/guess`, { playerId, index }),
  mark: (code, playerId, index) => post(`/rooms/${code}/mark`, { playerId, index }),
  endTurn: (code, playerId) => post(`/rooms/${code}/endturn`, { playerId }),
  leave: (code, playerId) => post(`/rooms/${code}/leave`, { playerId })
};

/* ── Session: håller kvar rum och identitet över omladdningar ──── */

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* privat läge */ }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* privat läge */ }
}

/** Plockar upp ?rum=KOD ur adressfältet så en delad länk kan förifylla koden. */
export function codeFromUrl() {
  try {
    const value = new URLSearchParams(window.location.search).get('rum');
    return value ? value.toUpperCase().slice(0, 4) : '';
  } catch {
    return '';
  }
}
