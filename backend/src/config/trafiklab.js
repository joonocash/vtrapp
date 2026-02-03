import dotenv from 'dotenv';

dotenv.config();

export const config = {
  apiKey: process.env.TRAFIKLAB_API_KEY,
  baseUrl: 'https://realtime-api.trafiklab.se/v1',
  endpoints: {
    stopSearch: '/stops/name',
    departures: '/departures'
  },
  // Default stop for Ullevi Norra
  defaultStop: {
    areaId: '740025695',
    stopId: '32087',
    name: 'Ullevi Norra'
  }
};

export default config;
