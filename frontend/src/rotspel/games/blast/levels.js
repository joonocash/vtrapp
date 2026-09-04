// levels.js — 160 banor i 8 paket.
//
// Så funkar en bana: det finns ingen dragbudget och ingen klocka. Bitarna du får
// bär ibland en figur. Lägger du en sådan bit hamnar figuren på brädet, och du
// samlar in den först när raden eller kolumnen den sitter i rensas. Banan är klar
// när du samlat allt, och slut när ingen av dina tre bitar får plats — precis som
// i klassiskt läge. Pressen kommer från att överleva, inte från en nedräkning.
//
// Stjärnorna belönar effektivitet i stället: klara banan alls ger en stjärna,
// klara den på få utlagda bitar ger två eller tre.

import { makeRng, SIZE, idx } from './engine.js';

export const PACKS = [
  { id: 0, name: 'Lövskogen',    token: '🍁', hint: 'Samla löven som följer med bitarna ner.',    tint: '#ff9f43' },
  { id: 1, name: 'Stenriket',    token: '🌰', hint: 'Sten försvinner aldrig. Bygg runt den.',      tint: '#9aa3b8' },
  { id: 2, name: 'Isvidderna',   token: '❄️', hint: 'Is spricker först, försvinner andra gången.', tint: '#34d3e0' },
  { id: 3, name: 'Svampgrottan', token: '🍄', hint: 'Trängre bräde, samma uppdrag.',               tint: '#ff5d73' },
  { id: 4, name: 'Myren',        token: '🐸', hint: 'Bomber tickar för varje bit du lägger.',      tint: '#6ee06a' },
  { id: 5, name: 'Bärlandet',    token: '🫐', hint: 'Halva brädet är redan upptaget.',             tint: '#7b6cff' },
  { id: 6, name: 'Fjärilsdalen', token: '🦋', hint: 'Två sorters figurer samtidigt.',              tint: '#ff6bd6' },
  { id: 7, name: 'Rötdjupet',    token: '💎', hint: 'Allt på en gång. Ingen nåd.',                 tint: '#ffd93d' },
];

export const LEVELS_PER_PACK = 20;
export const TOTAL_LEVELS = PACKS.length * LEVELS_PER_PACK;

export function goalLabel(g) {
  switch (g.type) {
    case 'collect': return `Samla ${g.count}`;
    case 'score': return `Nå ${g.count.toLocaleString('sv-SE')} poäng`;
    case 'lines': return `Rensa ${g.count} linjer`;
    case 'ice': return 'Krossa all is';
    case 'clean': return 'Rensa bort allt som låg där från början';
    case 'combo': return `${g.count} linjer i ett drag`;
    default: return '';
  }
}

/* ---------- hjälpare för att strö ut hinder ---------- */

// Hinder läggs i små klumpar nära kanterna, aldrig som lösa prickar mitt på
// brädet. Enstaka utspridda rutor fragmenterar ytan så illa att stora bitar
// inte får plats någonstans, och då dör banan efter ett par drag.
function scatter(preset, rng, count, make) {
  if (count <= 0) return preset;
  const rowCount = new Array(SIZE).fill(0);
  const colCount = new Array(SIZE).fill(0);
  for (const [r, c] of preset) { rowCount[r]++; colCount[c]++; }
  const taken = new Set(preset.map(([r, c]) => r * SIZE + c));

  const free = (r, c) =>
    r >= 0 && c >= 0 && r < SIZE && c < SIZE &&
    !taken.has(r * SIZE + c) &&
    rowCount[r] < SIZE - 3 && colCount[c] < SIZE - 3;

  // hur långt från mitten en ruta ligger — kantnära är bättre
  const edginess = (r, c) => Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5));

  const put = (r, c) => {
    preset.push(make(r, c, rng));
    taken.add(r * SIZE + c);
    rowCount[r]++; colCount[c]++;
  };

  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < count * 30) {
    // välj startruta: fyra kandidater, ta den som ligger mest åt kanten
    let seed = null;
    for (let i = 0; i < 4; i++) {
      const r = Math.floor(rng() * SIZE);
      const c = Math.floor(rng() * SIZE);
      if (!free(r, c)) continue;
      if (!seed || edginess(r, c) > edginess(seed[0], seed[1])) seed = [r, c];
    }
    if (!seed) continue;

    const blob = Math.min(count - placed, 2 + Math.floor(rng() * 2)); // 2-3 rutor
    let [r, c] = seed;
    put(r, c); placed++;
    for (let k = 1; k < blob; k++) {
      const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]].sort(() => rng() - 0.5);
      const step = dirs.find(([dr, dc]) => free(r + dr, c + dc));
      if (!step) break;
      r += step[0]; c += step[1];
      put(r, c); placed++;
    }
  }
  return preset;
}

const block = (r, c, rng) => [r, c, 'block', { c: Math.floor(rng() * 7) }];
const stone = (r, c) => [r, c, 'stone', {}];
const ice = (r, c) => [r, c, 'ice', { hp: 2 }];

/* ---------- handbyggda introbanor ---------- */

const HANDMADE = {
  1: { goals: [{ type: 'collect', count: 3 }], preset: [], par: [8, 6] },
  2: { goals: [{ type: 'collect', count: 5 }], preset: [], par: [13, 9] },
  3: { goals: [{ type: 'collect', count: 6 }, { type: 'lines', count: 6 }], preset: [], par: [16, 12] },
  4: {
    goals: [{ type: 'collect', count: 5 }, { type: 'clean' }],
    preset: [
      [7, 0, 'block', { c: 0 }], [7, 1, 'block', { c: 0 }], [7, 2, 'block', { c: 0 }],
      [7, 3, 'block', { c: 0 }], [7, 4, 'block', { c: 0 }],
    ],
    par: [14, 10],
  },
  5: { goals: [{ type: 'collect', count: 8 }, { type: 'combo', count: 2 }], preset: [], par: [20, 15] },
};

/* ---------- generator ---------- */

export function buildLevel(id) {
  if (id < 1 || id > TOTAL_LEVELS) return null;
  const packIndex = Math.floor((id - 1) / LEVELS_PER_PACK);
  const pack = PACKS[packIndex];
  const step = (id - 1) % LEVELS_PER_PACK;
  const t = step / (LEVELS_PER_PACK - 1); // 0 → 1 inom paketet
  const rng = makeRng(id * 7919 + 104729);

  const hand = HANDMADE[id];
  let goals;
  let preset = [];
  let par;
  let tokenTypes = [pack.token];
  let tokenChance = 0.6;
  // Senare paket har fulare bräden, så figurerna kommer lite tätare där.
  let need = 0;

  if (hand) {
    goals = hand.goals;
    preset = hand.preset.map((p) => [...p]);
    par = hand.par;
  } else {
    tokenChance = 0.6 + packIndex * 0.022;
    need = 4 + Math.round(t * 5) + Math.round(packIndex * 0.7); // 4 → 14 figurer
    goals = [{ type: 'collect', count: need }];

    switch (packIndex) {
      case 0:
        scatter(preset, rng, Math.round(t * 4), block);
        break;

      case 1:
        scatter(preset, rng, 2 + Math.round(t * 4), stone);
        break;

      case 2:
        scatter(preset, rng, 2 + Math.round(t * 5), ice);
        scatter(preset, rng, Math.round(t * 3), block);
        break;

      case 3:
        scatter(preset, rng, 4 + Math.round(t * 6), block);
        scatter(preset, rng, 1 + Math.round(t * 3), stone);
        break;

      case 4: {
        const bombs = 1 + Math.round(t);
        for (let i = 0; i < bombs; i++) {
          scatter(preset, rng, 1, (r, c) => [r, c, 'bomb', { n: 26 - Math.round(t * 8) }]);
        }
        scatter(preset, rng, 2 + Math.round(t * 4), block);
        break;
      }

      case 5:
        scatter(preset, rng, 8 + Math.round(t * 8), block);
        scatter(preset, rng, 1 + Math.round(t * 3), stone);
        break;

      case 6:
        tokenTypes = [pack.token, PACKS[3].token];
        scatter(preset, rng, 2 + Math.round(t * 4), ice);
        scatter(preset, rng, 2 + Math.round(t * 3), stone);
        scatter(preset, rng, 3 + Math.round(t * 4), block);
        break;

      default:
        tokenTypes = [pack.token, PACKS[6].token];
        scatter(preset, rng, 2 + Math.round(t * 4), ice);
        scatter(preset, rng, 2 + Math.round(t * 3), stone);
        scatter(preset, rng, 3 + Math.round(t * 5), block);
        scatter(preset, rng, 1, (r, c) => [r, c, 'bomb', { n: 26 - Math.round(t * 8) }]);
        break;
    }

    // Golvet är hur många bitar man måste lägga för att över huvud taget få
    // så många figurer. Under det går inte, hur bra man än spelar.
    const floor = need / tokenChance;
    par = [Math.round(floor * 1.5 + preset.length * 0.1), Math.round(floor * 1.12)];
  }

  return {
    id,
    pack: packIndex,
    packName: pack.name,
    token: pack.token,
    step: step + 1,
    goals,
    preset,
    par,                    // [två stjärnor, tre stjärnor] mätt i antal utlagda bitar
    tokens: { types: tokenTypes, chance: tokenChance },
    seed: id * 2654435761,
  };
}

// Antal stjärnor för ett klarat försök. Att klara banan ger alltid minst en.
export function starsFor(level, movesUsed) {
  if (!level?.par) return 1;
  if (movesUsed <= level.par[1]) return 3;
  if (movesUsed <= level.par[0]) return 2;
  return 1;
}

export function boardFromLevel(level) {
  const board = new Array(SIZE * SIZE).fill(null);
  for (const [r, c, type, extra] of level.preset) {
    board[idx(r, c)] = { c: extra.c ?? 0, t: type, ...extra, preset: true };
  }
  return board;
}

export const allLevels = () =>
  Array.from({ length: TOTAL_LEVELS }, (_, i) => buildLevel(i + 1));
