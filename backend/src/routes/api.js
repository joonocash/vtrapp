import express from 'express';
import { searchStops, getDepartures } from '../services/departureService.js';
import config from '../config/trafiklab.js';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api', timestamp: new Date().toISOString() });
});

/**
 * GET /api/stops/search?q=query
 * Search for stops by name
 */
router.get('/stops/search', async (req, res, next) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const stops = await searchStops(query);

    res.json({
      query,
      results: stops,
      count: stops.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/departures/:areaId
 * Get departures for a specific stop area
 */
router.get('/departures/:areaId', async (req, res, next) => {
  try {
    const { areaId } = req.params;
    const { time } = req.query;

    const data = await getDepartures(areaId, time);

    res.json({
      areaId,
      ...data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/default-stop
 * Get the default stop information
 */
router.get('/default-stop', (req, res) => {
  res.json(config.defaultStop);
});

export default router;
