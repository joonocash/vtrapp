/** @type {import('tailwindcss').Config} */

// Grått är omdefinierat till en kall, lite blåare skala som matchar sajtens
// mörka tema. Stegen motsvarar Tailwinds egna (samma kontrast mellan dem), så
// komponenter som redan använder gray-800/700 osv. (Cassies panel,
// Pinnbollen) följer med i det nya utseendet utan att ändras. 750 finns inte
// i Tailwind från början men används som hover-steg.
const gray = {
  50: '#f6f8fc',
  100: '#eceff6',
  200: '#d5dbe7',
  300: '#b4bdd0',
  400: '#8e99b1',
  500: '#6b768e',
  600: '#4d5770',
  700: '#2d3549',
  750: '#232b3c',
  800: '#1a2131',
  850: '#151b29',
  900: '#10151f',
  950: '#0a0e17',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray,
        // Sajtens egna tokens. Håll dem få: bakgrund, ytor, linjer, accent.
        ink: {
          DEFAULT: '#0a0e17', // sidbakgrund
          raised: '#131927', // kort/paneler
          high: '#182032', // hover, aktiva ytor
          line: 'rgba(148, 163, 196, 0.12)',
          'line-strong': 'rgba(148, 163, 196, 0.22)',
        },
        accent: {
          DEFAULT: '#5b8dff',
          soft: 'rgba(91, 141, 255, 0.14)',
          strong: '#3f74f0',
        },
        vasttrafik: {
          blue: '#0071BC',
          yellow: '#FFC500',
          dark: '#003D5C',
        },
      },
      fontFamily: {
        sans: [
          '"Inter Variable"',
          'Inter',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        display: ['"Outfit Variable"', 'Outfit', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 32px -16px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'live-ping': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '80%, 100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'live-ping': 'live-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'fade-up': 'fade-up 280ms ease-out both',
      },
    },
  },
  plugins: [],
};
