import { useState, useCallback } from 'react';
import { searchStops } from '../services/api';

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Hook for searching stops with debouncing
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns {Object} Search state and search function
 */
export function useStopSearch(debounceMs = 300) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    try {
      setSearching(true);
      setError(null);
      const data = await searchStops(query);
      setResults(data.results || []);
    } catch (err) {
      console.error('Error searching stops:', err);
      setError(err.message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce(performSearch, debounceMs), [debounceMs]);

  return {
    results,
    searching,
    error,
    search: debouncedSearch
  };
}

export default useStopSearch;
