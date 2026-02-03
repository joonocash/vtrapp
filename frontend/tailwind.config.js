/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vasttrafik': {
          blue: '#0071BC',
          yellow: '#FFC500',
          dark: '#003D5C',
        }
      }
    },
  },
  plugins: [],
}
