// levels.js — 160 banor i 8 paket. De första är handbyggda för att lära ut
// mekanikerna, resten genereras deterministiskt från bannumret.
// Samma bannummer ger alltid exakt samma bana, på alla enheter.

import { makeRng, SIZE, idx } from './engine.js';

export const PACKS = [
  { id: 0, name: 'Grunderna', hint: 'Rensa rader och kolumner.', tint: '#6ee06a' },
  { id: 1, name: 'Stenriket', hint: 'Sten försvinner aldrig. Bygg runt den.', tint: '#9aa3b8' },
  { id: 2, name: 'Isvidderna', hint: 'Is spricker först, försvinner andra gången.', tint: '#34d3e0' },
  { id: 3, name: 'Gruvan', hint: 'Ädelstenar samlas när linjen de sitter i rensas.', tint: '#ffd93d' },
  { id: 4, name: 'Krutdurken', hint: 'Bomber tickar varje drag. Rensa dem i tid.', tint: '#ff5d73' },
  { id: 5, name: 'Trängseln', hint: 'Fullt bräde, få drag.', tint: '#ff9f43' },
  { id: 6, name: 'Kaoslabbet', hint: 'Allt på en gång.', tint: '#ff6bd6' },
  { id: 7, name: 'Rötdjupet', hint: 'Ingen nåd.', tint: '#7b6cff' },
];

export const LEVELS_PER_PACK = 20;
export const TOTAL_LEVELS = PACKS.length * LEVELS_PER_PACK;

export const GOAL_LABELS = {
  score: (n) => `Nå ${n.toLocaleString('sv-SE')} poäng`,
  lines: (n) => `Rensa ${n} linjer`,
  gems: (n) => `Samla ${n} ädelstenar`,
  ice: () => 'Krossa all is',
  clean: () => 'Rensa bort allt som låg på brädet',
  combo: (n) => `Rensa ${n} linjer i ett enda drag`,
};

/* ---------- hjälpare för att strö ut hinder ---------- */

// Lägger celler slumpvis men vägrar fylla en hel rad eller kolumn från start.
function scatter(preset, rng, count, make) {
  const rowCount = new Array(SIZE).fill(0);
  const colCount = new Array(SIZE).fill(0);
  for (const [r, c] of preset) {
    rowCount[r]++;
    colCount[c]++;
  }
  let guard = 0;
  let placed = 0;
  while (placed < count && guard++ < count * 40) {
    const r = Math.floor(rng() * SIZE);
    const c = Math.floor(rng() * SIZE);
    if (preset.some(([pr, pc]) => pr === r && pc === c)) continue;
    if (rowCount[r] >= SIZE - 2 || colCount[c] >= SIZE - 2) continue;
    preset.push(make(r, c, rng));
    rowCount[r]++;
    colCount[c]++;
    placed++;
  }
  return preset;
}

const block = (r, c, rng) => [r, c, 'block', { c: Math.floor(rng() * 7) }];
const stone = (r, c) => [r, c, 'stone', {}];
const ice = (r, c) => [r, c, 'ice', { hp: 2 }];
const gem = (r, c) => [r, c, 'gem', {}];

/* ---------- handbyggda introbanor ---------- */

const HANDMADE = {
  1: { moves: 18, goals: [{ type: 'lines', count: 3 }], preset: [] },
  2: { moves: 20, goals: [{ type: 'lines', count: 5 }], preset: [] },
  3: { moves: 18, goals: [{ type: 'score', count: 800 }], preset: [] },
  4: {
    moves: 18,
    goals: [{ type: 'clean' }],
    preset: [
      [7, 0, 'block', { c: 0 }], [7, 1, 'block', { c: 0 }], [7, 2, 'block', { c: 0 }],
      [7, 3, 'block', { c: 0 }], [7, 4, 'block', { c: 0 }],
    ],
  },
  5: { moves: 20, goals: [{ type: 'combo', count: 2 }], preset: [] },
  6: {
    moves: 20,
    goals: [{ type: 'lines', count: 6 }],
    preset: [[3, 3, 'stone', {}], [3, 4, 'stone', {}], [4, 3, 'stone', {}], [4, 4, 'stone', {}]],
  },
  7: {
    moves: 22,
    goals: [{ type: 'ice' }],
    preset: [[2, 2, 'ice', { hp: 2 }], [2, 5, 'ice', { hp: 2 }], [5, 2, 'ice', { hp: 2 }], [5, 5, 'ice', { hp: 2 }]],
  },
  8: {
    moves: 22,
    goals: [{ type: 'gems', count: 5 }],
    preset: [[0, 1, 'gem', {}], [1, 6, 'gem', {}], [4, 2, 'gem', {}], [6, 5, 'gem', {}], [7, 3, 'gem', {}]],
  },
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
  let moves;
  let goals;
  let preset = [];

  if (hand) {
    moves = hand.moves;
    goals = hand.goals;
    preset = hand.preset.map((p) => [...p]);
  } else {
    const hard = packIndex / (PACKS.length - 1); // 0 → 1 över hela spelet
    moves = Math.round(28 - t * 7 + (1 - hard) * 4);

    switch (packIndex) {
      case 0:
        goals = rng() < 0.5
          ? [{ type: 'lines', count: 4 + Math.round(t * 10) }]
          : [{ type: 'score', count: 800 + Math.round(t * 5200) }];
        scatter(preset, rng, Math.round(t * 8), block);
        break;

      case 1:
        scatter(preset, rng, 2 + Math.round(t * 7), stone);
        goals = [{ type: 'lines', count: 5 + Math.round(t * 9) }];
        break;

      case 2: {
        const n = 3 + Math.round(t * 8);
        scatter(preset, rng, n, ice);
        scatter(preset, rng, Math.round(t * 5), block);
        goals = [{ type: 'ice' }];
        break;
      }

      case 3: {
        const n = 4 + Math.round(t * 10);
        scatter(preset, rng, n, gem);
        scatter(preset, rng, 2 + Math.round(t * 8), stone);
        goals = [{ type: 'gems', count: n }];
        break;
      }

      case 4: {
        const bombs = 1 + Math.round(t * 2);
        for (let i = 0; i < bombs; i++) {
          scatter(preset, rng, 1, (r, c) => [r, c, 'bomb', { n: 12 - Math.round(t * 5) }]);
        }
        scatter(preset, rng, 4 + Math.round(t * 10), block);
        goals = [{ type: 'lines', count: 6 + Math.round(t * 8) }];
        break;
      }

      case 5:
        scatter(preset, rng, 12 + Math.round(t * 16), block);
        scatter(preset, rng, Math.round(t * 4), stone);
        goals = rng() < 0.5
          ? [{ type: 'clean' }]
          : [{ type: 'lines', count: 8 + Math.round(t * 8) }];
        moves = Math.round(24 - t * 6);
        break;

      case 6: {
        const gems = 4 + Math.round(t * 8);
        scatter(preset, rng, gems, gem);
        scatter(preset, rng, 3 + Math.round(t * 6), ice);
        scatter(preset, rng, 2 + Math.round(t * 5), stone);
        goals = [
          { type: 'gems', count: gems },
          { type: 'combo', count: 2 + Math.round(t) },
        ];
        break;
      }

      default: {
        const gems = 6 + Math.round(t * 10);
        scatter(preset, rng, gems, gem);
        scatter(preset, rng, 4 + Math.round(t * 8), ice);
        scatter(preset, rng, 3 + Math.round(t * 7), stone);
        scatter(preset, rng, 1, (r, c) => [r, c, 'bomb', { n: 14 - Math.round(t * 6) }]);
        goals = [
          { type: 'gems', count: gems },
          { type: 'score', count: 4000 + Math.round(t * 9000) },
        ];
        moves = Math.round(30 - t * 8);
      }
    }
  }

  // Uppskattad poäng för att precis klara banan. Första stjärnan får man
  // alltid för att klara den, de två andra kräver att man spelar bra.
  const estimate = Math.max(
    ...goals.map((g) => {
      if (g.type === 'score') return g.count;
      if (g.type === 'lines') return 170 * g.count;
      if (g.type === 'gems') return 190 * g.count;
      if (g.type === 'combo') return 900;
      return 1100; // ice, clean
    })
  );

  return {
    id,
    pack: packIndex,
    packName: pack.name,
    step: step + 1,
    moves,
    goals,
    preset,
    stars: [0, Math.round(estimate * 1.35), Math.round(estimate * 2.2)],
    seed: id * 2654435761,
  };
}

// Bygger startbrädet för en bana.
export function boardFromLevel(level) {
  const board = new Array(SIZE * SIZE).fill(null);
  for (const [r, c, type, extra] of level.preset) {
    board[idx(r, c)] = { c: extra.c ?? 0, t: type, ...extra, preset: true };
  }
  return board;
}

export const allLevels = () =>
  Array.from({ length: TOTAL_LEVELS }, (_, i) => buildLevel(i + 1));
