/**
 * Format a date string to relative time (e.g., "2 min", "14:35")
 * @param {string} isoString - ISO 8601 date string
 * @returns {string} Formatted time
 */
export function formatDepartureTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date - now;
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 0) {
    return 'Nu';
  } else if (diffMins === 0) {
    return 'Nu';
  } else if (diffMins === 1) {
    return '1 min';
  } else if (diffMins < 60) {
    return `${diffMins} min`;
  } else {
    // Show actual time for departures more than 1 hour away
    return date.toLocaleTimeString('sv-SE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

/**
 * Format last updated timestamp
 * @param {string} isoString - ISO 8601 date string
 * @returns {string} Formatted timestamp
 */
export function formatLastUpdated(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
