const API_BASE = '/api';

/**
 * Search for stops by query
 * @param {string} query - Search query
 * @returns {Promise<Object>} Search results
 */
export async function searchStops(query) {
  const response = await fetch(`${API_BASE}/stops/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    throw new Error('Failed to search stops');
  }

  return response.json();
}

/**
 * Get departures for a specific area
 * @param {string} areaId - Area ID
 * @returns {Promise<Object>} Departure information
 */
export async function getDepartures(areaId) {
  const response = await fetch(`${API_BASE}/departures/${areaId}`);

  if (!response.ok) {
    throw new Error('Failed to get departures');
  }

  return response.json();
}

/**
 * Get default stop information
 * @returns {Promise<Object>} Default stop
 */
export async function getDefaultStop() {
  const response = await fetch(`${API_BASE}/default-stop`);

  if (!response.ok) {
    throw new Error('Failed to get default stop');
  }

  return response.json();
}
