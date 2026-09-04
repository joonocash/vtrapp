import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.ORS_API_KEY;

if (!apiKey) {
  throw new Error(
    'ORS_API_KEY saknas. Sätt den i backend/.env (se .env.production.example) innan servern startar.'
  );
}

export const config = {
  apiKey,
  baseUrl: 'https://api.openrouteservice.org',
  // Sverige och Norden, ISO 3166-1 alpha-2
  nordicCountries: ['SE', 'NO', 'DK', 'FI', 'IS']
};

export default config;
