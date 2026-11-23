import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

// WoW-fliken: skickar vidare till WoW-assistentens API (Discord-boten) på samma server.
// Token stannar här på servern och syns aldrig i webbläsaren.
//
// Inget behöver ställas in: token och port läses från WoW-assistentens egen .env
// (~/wow-assistent/.env, API_TOKEN eller NOTIFY_TOKEN och WEB_PORT). Vill du styra
// det själv går det med WOW_API_URL, WOW_API_TOKEN och WOW_ENV_FILE i backend/.env.

const router = express.Router();

const ENV_FIL = process.env.WOW_ENV_FILE || path.join(os.homedir(), 'wow-assistent', '.env');
const TIMEOUT_MS = 25000;

// Vägar som får skickas vidare. Allt annat svarar 404 här.
const VAGAR = [
  ['GET', /^overview$/],
  ['GET', /^search$/],
  ['GET', /^item\/\d+$/],
  ['GET', /^item\/\d+\/heatmap$/],
  ['GET', /^deals$/],
  ['GET', /^arbitrage$/],
  ['GET', /^gear$/],
  ['GET', /^craft$/],
  ['GET', /^watch$/],
  ['POST', /^watch$/],
  ['DELETE', /^watch\/\d+$/],
];

let cache = { tid: 0, konfig: null };

export function lasEnv(text) {
  const ut = {};
  for (const rad of String(text).split(/\r?\n/)) {
    const m = rad.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let varde = m[2];
    if ((varde.startsWith('"') && varde.endsWith('"')) || (varde.startsWith("'") && varde.endsWith("'"))) {
      varde = varde.slice(1, -1);
    } else {
      varde = varde.replace(/\s+#.*$/, '');
    }
    ut[m[1]] = varde;
  }
  return ut;
}

function konfig() {
  // Läses om varje minut, så en ny token i boten fungerar utan omstart här.
  if (cache.konfig && Date.now() - cache.tid < 60000) return cache.konfig;
  let fil = {};
  try {
    fil = lasEnv(fs.readFileSync(ENV_FIL, 'utf8'));
  } catch {
    // filen finns inte (t.ex. lokalt): då gäller bara miljövariablerna
  }
  const port = fil.WEB_PORT || '8080';
  cache = {
    tid: Date.now(),
    konfig: {
      url: (process.env.WOW_API_URL || `http://127.0.0.1:${port}`).replace(/\/+$/, ''),
      token: process.env.WOW_API_TOKEN || fil.API_TOKEN || fil.NOTIFY_TOKEN || '',
    },
  };
  return cache.konfig;
}

router.all('/*', async (req, res) => {
  const sokvag = req.params[0] || '';
  if (!VAGAR.some(([metod, monster]) => metod === req.method && monster.test(sokvag))) {
    return res.status(404).json({ error: 'Okänd väg i WoW-API:t' });
  }
  const { url, token } = konfig();
  if (!token) {
    return res.status(503).json({
      error: 'Hittar ingen token till WoW-assistenten',
      tips: `Backenden letar i ${ENV_FIL}. Ligger WoW-assistenten någon annanstans, sätt WOW_ENV_FILE eller WOW_API_TOKEN i backend/.env och starta om backend.`,
    });
  }
  const fraga = new URLSearchParams();
  for (const [nyckel, varde] of Object.entries(req.query)) {
    if (typeof varde === 'string') fraga.set(nyckel, varde);
  }
  const qs = fraga.toString();
  try {
    const svar = await fetch(`${url}/api/wow/${sokvag}${qs ? `?${qs}` : ''}`, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(req.body || {}) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await svar.text();
    if (svar.status === 401) {
      return res.status(503).json({
        error: 'WoW-assistenten godtog inte token',
        tips: 'Token i WoW-assistentens .env har ändrats. Den läses om inom en minut, prova igen då.',
      });
    }
    res.status(svar.status).type('application/json').send(text);
  } catch (err) {
    res.status(502).json({ error: 'WoW-assistenten svarar inte', detalj: err.message });
  }
});

export default router;
