/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#e3a616",
        "primary-dark": "#c28e12",
        "primary-light": "#fefce8",
        "background-light": "#fcfbf8",
        "background-dark": "#1b170e",
        "surface-light": "#ffffff",
        "surface-dark": "#26221a",
        "text-main": "#1b170e",
        "text-muted": "#99824d",
        "border-light": "#e7e0d0",
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
      },
    },
  },
  plugins: [],
}
