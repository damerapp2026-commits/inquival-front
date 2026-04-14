/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#f4f7fb', 100: '#e8eff6', 200: '#cbdcec', 300: '#9dbfdc', 400: '#699ec7', 500: '#4681b1', 600: '#346795', 700: '#305c86', 800: '#274765', 900: '#253d55', 950: '#192738' },
      },
    },
  },
  plugins: [],
};
