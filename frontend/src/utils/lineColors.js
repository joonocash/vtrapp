/**
 * Official line colors for Gothenburg trams, Stockholm metro, and transport modes
 * Based on Västtrafik's and SL's color systems
 */

// Göteborg Spårvagn (Tram)
export const TRAM_LINE_COLORS = {
  '1': { bg: '#E8E8E8', text: '#000000', name: 'Vit' },      // White
  '2': { bg: '#FFD800', text: '#000000', name: 'Gul' },      // Yellow
  '3': { bg: '#0089CA', text: '#FFFFFF', name: 'Blå' },      // Blue
  '4': { bg: '#009B3A', text: '#FFFFFF', name: 'Grön' },     // Green
  '5': { bg: '#E30613', text: '#FFFFFF', name: 'Röd' },      // Red
  '6': { bg: '#FF8C00', text: '#000000', name: 'Orange' },   // Orange
  '7': { bg: '#8B4513', text: '#FFFFFF', name: 'Brun' },     // Brown
  '8': { bg: '#800080', text: '#FFFFFF', name: 'Lila' },     // Purple
  '9': { bg: '#90EE90', text: '#000000', name: 'Lime' },     // Lime
  '10': { bg: '#003366', text: '#FFFFFF', name: 'Mörkblå' }, // Dark Blue
  '11': { bg: '#000000', text: '#FFFFFF', name: 'Svart' },   // Black
  '12': { bg: '#00CED1', text: '#000000', name: 'Turkos' },  // Turquoise
  '13': { bg: '#E91E63', text: '#FFFFFF', name: 'Rosa' },    // Pink/Magenta
};

// Stockholm Tunnelbana (Metro)
export const METRO_LINE_COLORS = {
  // Gröna linjen (Green line)
  '17': { bg: '#009B3A', text: '#FFFFFF', name: 'Grön' },    // Green
  '18': { bg: '#009B3A', text: '#FFFFFF', name: 'Grön' },    // Green
  '19': { bg: '#009B3A', text: '#FFFFFF', name: 'Grön' },    // Green
  'T17': { bg: '#009B3A', text: '#FFFFFF', name: 'Grön' },   // Green (with T prefix)
  'T18': { bg: '#009B3A', text: '#FFFFFF', name: 'Grön' },   // Green (with T prefix)
  'T19': { bg: '#009B3A', text: '#FFFFFF', name: 'Grön' },   // Green (with T prefix)

  // Röda linjen (Red line)
  '13': { bg: '#E30613', text: '#FFFFFF', name: 'Röd' },     // Red
  '14': { bg: '#E30613', text: '#FFFFFF', name: 'Röd' },     // Red
  'T13': { bg: '#E30613', text: '#FFFFFF', name: 'Röd' },    // Red (with T prefix)
  'T14': { bg: '#E30613', text: '#FFFFFF', name: 'Röd' },    // Red (with T prefix)

  // Blå linjen (Blue line)
  '10': { bg: '#0089CA', text: '#FFFFFF', name: 'Blå' },     // Blue
  '11': { bg: '#0089CA', text: '#FFFFFF', name: 'Blå' },     // Blue
  'T10': { bg: '#0089CA', text: '#FFFFFF', name: 'Blå' },    // Blue (with T prefix)
  'T11': { bg: '#0089CA', text: '#FFFFFF', name: 'Blå' },    // Blue (with T prefix)
};

export const TRANSPORT_MODE_COLORS = {
  'BUS': { bg: '#0066CC', text: '#FFFFFF', name: 'Buss' },   // Blue for buses
  'TRAIN': { bg: '#FF6600', text: '#FFFFFF', name: 'Tåg' },  // Orange for trains
  'FERRY': { bg: '#008080', text: '#FFFFFF', name: 'Färja' }, // Teal for ferries
  'METRO': { bg: '#999999', text: '#FFFFFF', name: 'Metro' }, // Default gray for metro (if no line match)
  'SUBWAY': { bg: '#999999', text: '#FFFFFF', name: 'Tunnelbana' }, // Same as METRO
};

/**
 * Get color for a transport line
 * @param {string} line - Line number/designation
 * @param {string} transportMode - Transport mode (TRAM, BUS, TRAIN, METRO, SUBWAY, etc.)
 * @returns {Object} Color object with bg, text, and name
 */
export function getLineColor(line, transportMode) {
  // Göteborg Spårvagn (Tram)
  if (transportMode === 'TRAM') {
    return TRAM_LINE_COLORS[line] || { bg: '#666666', text: '#FFFFFF', name: 'Okänd' };
  }

  // Stockholm Tunnelbana (Metro/Subway)
  if (transportMode === 'METRO' || transportMode === 'SUBWAY') {
    return METRO_LINE_COLORS[line] || TRANSPORT_MODE_COLORS[transportMode] || { bg: '#666666', text: '#FFFFFF', name: 'Okänd' };
  }

  // Other transport modes (Bus, Train, Ferry)
  return TRANSPORT_MODE_COLORS[transportMode] || { bg: '#666666', text: '#FFFFFF', name: 'Okänd' };
}

export default { TRAM_LINE_COLORS, METRO_LINE_COLORS, TRANSPORT_MODE_COLORS, getLineColor };
