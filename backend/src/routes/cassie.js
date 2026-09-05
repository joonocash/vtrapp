import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/ors.js';

// Sparade Cassie-rutter persisteras till JSON, samma mönster som backend/scores.js.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'cassie-routes.json');

let store = [];
let writeTimer = null;

function load() {
  try {
    if (fs.existsSync(FILE)) {
      store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[cassie] kunde inte läsa cassie-routes.json, börjar tomt:', err.message);
    store = [];
  }
}

function persist() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
    } catch (err) {
      console.error('[cassie] kunde inte skriva cassie-routes.json:', err.message);
    }
  }, 500);
}

load();

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isValidCoord(c) {
  return (
    Array.isArray(c) &&
    c.length === 2 &&
    Number.isFinite(c[0]) &&
    Number.isFinite(c[1])
  );
}

function sanitizeHexList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((h) => typeof h === 'string' && HEX_COLOR_RE.test(h)).slice(0, 50);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

const router = express.Router();

/**
 * GET /api/cassie/geocode?q=query
 * Proxar ORS geocode/autocomplete, begränsat till Sverige och Norden.
 */
router.get('/geocode', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ error: 'Query-parametern "q" krävs' });
    }

    const response = await axios.get(`${config.baseUrl}/geocode/autocomplete`, {
      params: {
        api_key: config.apiKey,
        text: q,
        size: 6,
        'boundary.country': config.nordicCountries.join(','),
        // Uteslut region/county/land-nivå — en bar sökning som "Stockholm"
        // ska matcha staden, inte länets centroid (som kan hamna långt ute
        // i skärgården och göra rutten osnappbar för ORS).
        layers: 'locality,localadmin,neighbourhood,borough,address,street,venue'
      }
    });

    const results = (response.data?.features || []).slice(0, 6).map((f) => ({
      label: f.properties?.label || f.properties?.name || q,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0]
    }));

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/cassie/route  { from: [lng, lat], to: [lng, lat] }
 * Proxar ORS /v2/directions/driving-hgv/geojson. Returnerar geometrin som
 * GeoJSON samt segments[].steps[] (duration + way_points) oförändrade i
 * strukturen — frontend bygger tidslinjen från dem.
 */
router.post('/route', async (req, res, next) => {
  try {
    const { from, to } = req.body || {};

    if (!isValidCoord(from) || !isValidCoord(to)) {
      return res.status(400).json({ error: 'from och to krävs som [lng, lat]' });
    }

    const payload = { coordinates: [from, to] };
    console.log('[cassie] POST till ORS /v2/directions/driving-hgv/geojson:', JSON.stringify(payload));

    const response = await axios.post(
      `${config.baseUrl}/v2/directions/driving-hgv/geojson`,
      payload,
      {
        headers: {
          Authorization: config.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const feature = response.data?.features?.[0];
    if (!feature) {
      return res.status(502).json({ error: 'Inget ruttsvar från ORS' });
    }

    res.json({
      geometry: feature.geometry,
      distance: feature.properties?.summary?.distance ?? 0,
      duration: feature.properties?.summary?.duration ?? 0,
      segments: (feature.properties?.segments || []).map((segment) => ({
        distance: segment.distance,
        duration: segment.duration,
        steps: (segment.steps || []).map((step) => ({
          distance: step.distance,
          duration: step.duration,
          wayPoints: step.way_points
        }))
      }))
    });
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message =
        error.response.data?.error?.message || error.response.data?.error || 'ORS-fel';
      console.error(
        '[cassie] ORS svarade med fel:',
        status,
        JSON.stringify(error.response.data)
      );
      return res.status(status >= 400 && status < 600 ? status : 502).json({ error: message });
    }
    next(error);
  }
});

/**
 * GET /api/cassie/routes
 * Alla sparade rutter.
 */
router.get('/routes', (req, res) => {
  res.json({ routes: store });
});

/**
 * POST /api/cassie/routes
 * Sparar en rutt-konfiguration. Slug genereras från namnet om ingen ges.
 */
router.post('/routes', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 60);

  if (!name) {
    return res.status(400).json({ error: 'name krävs' });
  }
  if (!isValidCoord(body.from) || !isValidCoord(body.to)) {
    return res.status(400).json({ error: 'from och to krävs som [lng, lat]' });
  }

  let slug = slugify(body.slug || name);
  if (!slug) slug = `rutt-${Date.now()}`;
  const existingIndex = store.findIndex((r) => r.slug === slug);
  if (existingIndex !== -1) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const record = {
    slug,
    name,
    from: body.from,
    to: body.to,
    fromLabel: String(body.fromLabel || '').slice(0, 120),
    toLabel: String(body.toLabel || '').slice(0, 120),
    dur: Number.isFinite(Number(body.dur)) ? Number(body.dur) : 25,
    pins: ['always', 'hidden', 'proximity'].includes(body.pins) ? body.pins : 'proximity',
    fmt: ['16x9', '9x16', '1x1'].includes(body.fmt) ? body.fmt : '16x9',
    style: ['roadmap', 'satellite'].includes(body.style) ? body.style : 'roadmap',
    scale: Number.isFinite(Number(body.scale)) && Number(body.scale) > 0 ? Number(body.scale) : 90,
    trail: ['full', 'fade', 'none'].includes(body.trail) ? body.trail : 'full',
    cam: ['follow', 'fixed', 'overview', 'drone'].includes(body.cam) ? body.cam : 'follow',
    droneTilt: clampNumber(body.droneTilt, 0, 67.5, 55),
    droneDistance: clampNumber(body.droneDistance, 0, 100, 50),
    droneSideAngle: clampNumber(body.droneSideAngle, -90, 90, 0),
    droneRotationMode: ['track', 'fixed'].includes(body.droneRotationMode) ? body.droneRotationMode : 'track',
    cabSources: sanitizeHexList(body.cabSources),
    cabColor: HEX_COLOR_RE.test(body.cabColor) ? body.cabColor : null,
    boxSources: sanitizeHexList(body.boxSources),
    boxColor: HEX_COLOR_RE.test(body.boxColor) ? body.boxColor : null,
    createdAt: Date.now()
  };

  store.push(record);
  persist();

  res.json(record);
});

export default router;
