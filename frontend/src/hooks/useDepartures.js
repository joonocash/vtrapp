import { useState, useEffect, useCallback } from 'react';
import { getDepartures } from '../services/api';

/**
 * Hook for managing departure data with auto-refresh
 * @param {string} areaId - Stop area ID
 * @param {number} refreshInterval - Refresh interval in milliseconds (default: 45000)
 * @returns {Object} Departure state
 */
export function useDepartures(areaId, refreshInterval = 45000) {
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDepartures = useCallback(async () => {
    if (!areaId) return;

    try {
      setError(null);
      const data = await getDepartures(areaId);
      setDepartures(data.departures || []);
      setLastUpdated(data.timestamp || new Date().toISOString());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching departures:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [areaId]);

  useEffect(() => {
    // Initial fetch
    fetchDepartures();

    // Set up auto-refresh
    const interval = setInterval(fetchDepartures, refreshInterval);

    // Cleanup
    return () => clearInterval(interval);
  }, [fetchDepartures, refreshInterval]);

  return {
    departures,
    loading,
    error,
    lastUpdated,
    refresh: fetchDepartures
  };
}

export default useDepartures;
