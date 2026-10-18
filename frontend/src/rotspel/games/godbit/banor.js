// Godbiten — banorna. Själva banorna byggs av generatorn
// (frontend/tests/godbit-banor.gen.mjs) ur ritningarna i design.js och
// ligger i banor.json, med den tänkta lösningen (som tipsen visar).

import BANOR from './banor.json'

export { BANOR }
export const PER_VARLD = 10
export const ANTAL_BANOR = BANOR.length
export const ANTAL_VARLDAR = Math.ceil(BANOR.length / PER_VARLD)

// Världar 2–6 kräver så här många stjärnor totalt.
export const LAS_UPP = [0, 14, 34, 58, 86, 116]

export const hamtaBana = (nr) => BANOR[nr - 1]
export const varldFor = (nr) => Math.floor((nr - 1) / PER_VARLD)
export const kortNamn = (nr) => `${varldFor(nr) + 1}-${((nr - 1) % PER_VARLD) + 1}`

export const totalStjarnor = (banor) => Object.values(banor || {}).reduce((s, n) => s + (n || 0), 0)

// Får man spela bana nr? Banorna låses upp i tur och ordning, och varje
// värld kräver dessutom ett visst antal stjärnor.
export function oppen(nr, banor) {
  if (nr === 1) return true
  if (banor?.[nr - 1] == null) return false
  return totalStjarnor(banor) >= (LAS_UPP[varldFor(nr)] || 0)
}
