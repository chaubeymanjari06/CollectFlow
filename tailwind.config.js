/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d8eeff',
          200: '#b9e0ff',
          300: '#89ceff',
          400: '#52b2ff',
          500: '#2991ff',
          600: '#1270f6',
          700: '#0c57e3',
          800: '#1046b8',
          900: '#133e90',
          950: '#102758',
        }
      }
    },
  },
  plugins: [],
}
