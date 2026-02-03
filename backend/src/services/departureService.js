import axios from 'axios';
import config from '../config/trafiklab.js';

/**
 * Search for stops by name
 * @param {string} query - Search query
 * @returns {Promise<Array>} List of matching stop groups
 */
export async function searchStops(query) {
  try {
    const url = `${config.baseUrl}${config.endpoints.stopSearch}/${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      params: { key: config.apiKey }
    });

    if (!response.data || !response.data.stop_groups) {
      return [];
    }

    // Transform the data to a simpler format for frontend
    return response.data.stop_groups.map(group => ({
      areaId: group.id,
      name: group.name,
      transportModes: group.transport_modes,
      averageDailyStopTimes: group.average_daily_stop_times,
      stops: group.stops.map(stop => ({
        id: stop.id,
        name: stop.name,
        lat: stop.lat,
        lon: stop.lon
      }))
    }));
  } catch (error) {
    console.error('Error searching stops:', error.message);
    throw new Error(`Failed to search stops: ${error.message}`);
  }
}

/**
 * Get departures for a specific stop area
 * @param {string} areaId - Stop area ID
 * @param {string} time - Optional time in ISO format
 * @returns {Promise<Object>} Departure information
 */
export async function getDepartures(areaId, time = null) {
  try {
    let url = `${config.baseUrl}${config.endpoints.departures}/${areaId}`;

    if (time) {
      // Format: YYYY-MM-DDTHH:mm
      url += `/${time}`;
    }

    const response = await axios.get(url, {
      params: { key: config.apiKey }
    });

    if (!response.data) {
      throw new Error('No data returned from API');
    }

    // Transform the data to a simpler format
    return {
      timestamp: response.data.timestamp,
      stops: response.data.stops || [],
      departures: (response.data.departures || []).map(dep => ({
        scheduledTime: dep.scheduled,
        realtimeTime: dep.realtime,
        delay: dep.delay,
        canceled: dep.canceled,
        line: dep.route.designation,
        transportMode: dep.route.transport_mode,
        direction: dep.route.direction,
        platform: dep.realtime_platform?.designation || dep.scheduled_platform?.designation,
        isRealtime: dep.is_realtime,
        agency: dep.agency?.name,
        alerts: dep.alerts || []
      }))
    };
  } catch (error) {
    console.error('Error getting departures:', error.message);
    throw new Error(`Failed to get departures: ${error.message}`);
  }
}

export default { searchStops, getDepartures };
