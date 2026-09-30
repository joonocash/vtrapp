// Krossen — allt som pratar med servern: framstegen per spelare, var
// kompisarna är på kartan och topplistorna. Går servern inte att nå spelar
// man vidare som vanligt, allt sparas ändå i webbläsaren.

import { submitScore } from '../../useHighscore.js'

const API = '/api/krossen'
const PLAYER_KEY = 'rotspel_player' // samma som usePlayer() i useHighscore.js

export function spelarnamn() {
  try {
    return localStorage.getItem(PLAYER_KEY) || null
  } catch {
    return null
  }
}

async function json(url, opt) {
  const res = await fetch(url, opt)
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

export async function hamtaFramsteg(player) {
  if (!player) return null
  try {
    const { status, data } = await json(`${API}/framsteg?player=${encodeURIComponent(player)}`)
    return status === 200 && data ? data.data : null
  } catch {
    return null
  }
}

// Returnerar { ok: true }, { konflikt: <serverns sparläge> } eller null om
// servern inte gick att nå.
export async function skickaFramsteg(player, save) {
  if (!player) return null
  try {
    const { status, data } = await json(`${API}/framsteg`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player, data: save }),
    })
    if (status === 409 && data) return { konflikt: data.data }
    return status === 200 ? { ok: true } : null
  } catch {
    return null
  }
}

export async function hamtaSpelare() {
  try {
    const { status, data } = await json(`${API}/spelare`)
    return status === 200 && data ? data.spelare || [] : []
  } catch {
    return []
  }
}

// Topplistan för en bana eller för dagens bana.
export const banaId = (nr) => `krossen-bana-${nr}`
export const dagensId = (dag) => `krossen-dag-${dag}`

export async function hamtaTopplista(id) {
  try {
    const { status, data } = await json(`/api/scores/${encodeURIComponent(id)}`)
    return status === 200 && data ? data.entries || [] : []
  } catch {
    return []
  }
}

export async function skickaPoang(id, player, poang) {
  if (!player) return null
  return submitScore(id, player, poang)
}

// En färg per spelarnamn, så kompisarna känns igen på kartan.
const FARGER = ['#f03a5f', '#ff8a1c', '#e0a800', '#34c05a', '#2f8af0', '#a452ec', '#ff6bd6', '#16a3a3']
export function spelarfarg(namn) {
  let h = 0
  for (const ch of String(namn)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return FARGER[h % FARGER.length]
}
