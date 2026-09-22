// Happys revir — inställningar som är tänkta att pillas i.

// Revirens färger (samma ordning som revirens index).
export const COLORS = ['#F6D458', '#A7D98A', '#8CC6EA', '#F3A87C', '#D5B7EC', '#F5A1BA', '#E4CE9C', '#7FD2B8', '#C8CBB0', '#EEE07C']

export const MODES = {
  daily: { n: 8, label: 'Dagens revir' },
  easy: { n: 6, label: 'Lätt 6×6' },
  normal: { n: 8, label: 'Normal 8×8' },
  hard: { n: 10, label: 'Svår 10×10' },
}

// Revirnamn. Byt gärna till Happys riktiga favoritställen.
// Undvik namn som slutar på s, de används i genitiv i tipsen.
export const NAMES = ['Soffan', 'Matskålen', 'Hallmattan', 'Parken', 'Sängen', 'Balkongen', 'Hundkorgen', 'Köket', 'Bilen', 'Skogsstigen', 'Fönsterbrädan', 'Trädgården', 'Tvättkorgen', 'Hallen']

export const PENALTY_MS = 15000 // fel Happy
export const HINT_COST_MS = 20000 // tips
export const IDLE_MS = { day: 20000, evening: 12000 } // tills Happy somnar

// Bildtexter till albumet. Nyckeln är filnamnet i revir/album/.
// Nya bilder: lägg filen i revir/album/ med nummer först (04-namn.webp) och lägg gärna till en rad här.
// Saknas raden blir bildtexten filnamnet utan nummer.
export const ALBUM_CAPTIONS = {
  '01-varsol.webp': 'Vårsol och påskliljor',
  '02-toarullen.webp': 'Toarullens beskyddare',
  '03-blicken.webp': 'Den där blicken',
}
