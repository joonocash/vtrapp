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
  '04-kandisen.webp': 'Kändis på hundmässan',
  '05-smakbiten.webp': 'Väntar på en smakbit',
  '06-ogonkontakt.webp': 'Ögonkontakt, hundra procent',
  '07-livvakten.webp': 'Livvakt på jobbet',
  '08-barbesoket.webp': 'Barbesök med tillbehör',
  '09-fiskoga.webp': 'Fisköga, helt seriöst',
  '10-flabbet.webp': 'Flabbet',
  '11-kvallsvila.webp': 'Kvällsvila',
  '12-ihoprullad.webp': 'Ihoprullad',
  '13-morgontrott.webp': 'Morgontrött',
  '14-julvila.webp': 'Julvila',
  '15-rodhalsduk.webp': 'Röd halsduk, redo för äventyr',
  '16-nyarsyra.webp': 'Nyårsyra',
  '17-snopromenad.webp': 'Snöpromenad',
  '18-festbelysning.webp': 'Festbelysning',
  '19-armstod.webp': 'Använder armen som kudde',
  '20-telefonlur.webp': 'Somnade på telefonen',
  '21-uppochner.webp': 'Upp och ner',
  '22-klovern.webp': 'I klövern',
  '23-angsvandring.webp': 'Ängsvandring',
  '24-fettliten.webp': '"Min ena hund är fett liten"',
  '25-gapet.webp': 'Gapet på bussen',
  '26-kontorsstolen.webp': 'Under kontorsstolen',
  '27-liladis.webp': 'I lila dis',
  '28-spokogon.webp': 'Spökögon',
  '29-godnatt.webp': 'Godnatt',
  '30-rosaleksak.webp': 'Rosa leksak, blå blick',
  '31-spelrummet.webp': 'I spelrummet',
  '32-lagupplost.webp': 'Lite suddig, men gullig ändå',
  '33-handflatan.webp': 'I handflatan',
  '34-filten.webp': 'Insvept i filt',
  '35-tennisbollen.webp': 'Tennisbollen är min',
  '36-vilarhakan.webp': 'Vilar hakan',
  '37-solskenet.webp': 'Hela solskenet',
}
