import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Krossen — framsteg per spelare, så att samma namn kan spela på flera
// enheter och så att kartan kan visa var kompisarna är.
//
// Sparas i backend/data/krossen.json (samma mapp som highscorelistan):
//   { "<spelare>": { data: <sparläget från spelet>, uppdaterad: <ms> } }
//
// Servern slår inte ihop något själv. Den tar emot ett sparläge om det är
// minst lika nytt som det den har, annars svarar den med sitt eget så att
// klienten kan slå ihop och skicka igen.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'krossen.json');
const MAX_BYTES = 64 * 1024;

let store = {};
let writeTimer = null;

function load() {
  try {
    if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    console.error('[krossen] kunde inte läsa krossen.json, börjar tomt:', err.message);
    store = {};
  }
}

function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(store));
    } catch (err) {
      console.error('[krossen] kunde inte skriva krossen.json:', err.message);
    }
  }, 500);
}

load();

const router = express.Router();

const rensaNamn = (x) => String(x || '').trim().slice(0, 20);

// Högsta klarade banan och antal stjärnor, räknat ur sparläget.
function sammanfattning(data) {
  const stjarnor = (data && data.stjarnor) || {};
  let hogsta = 0;
  let summa = 0;
  for (const [nr, st] of Object.entries(stjarnor)) {
    if (st > 0) hogsta = Math.max(hogsta, Number(nr));
    summa += Number(st) || 0;
  }
  return { hogsta, stjarnor: summa };
}

router.get('/framsteg', (req, res) => {
  const player = rensaNamn(req.query.player);
  if (!player) return res.status(400).json({ error: 'player saknas' });
  const rec = store[player];
  res.json({ player, data: rec ? rec.data : null, uppdaterad: rec ? rec.uppdaterad : 0 });
});

router.put('/framsteg', (req, res) => {
  const { player, data } = req.body || {};
  const namn = rensaNamn(player);
  if (!namn || !data || typeof data !== 'object') {
    return res.status(400).json({ error: 'player och data krävs' });
  }
  if (JSON.stringify(data).length > MAX_BYTES) {
    return res.status(413).json({ error: 'för stort sparläge' });
  }
  const uppdaterad = Number(data.uppdaterad) || 0;
  const nu = store[namn];
  if (nu && nu.uppdaterad > uppdaterad) {
    // en annan enhet har sparat något nyare — låt klienten slå ihop
    return res.status(409).json({ player: namn, data: nu.data, uppdaterad: nu.uppdaterad });
  }
  store[namn] = { data, uppdaterad };
  persist();
  res.json({ ok: true, uppdaterad });
});

// Alla spelare med var de är på kartan. Används för att visa kompisarna.
router.get('/spelare', (req, res) => {
  const spelare = Object.entries(store)
    .map(([player, rec]) => ({ player, ...sammanfattning(rec.data), uppdaterad: rec.uppdaterad }))
    .filter((x) => x.hogsta > 0)
    .sort((a, b) => b.hogsta - a.hogsta);
  res.json({ spelare });
});

export default router;
