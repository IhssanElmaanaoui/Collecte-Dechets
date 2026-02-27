/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f7ff",
          100: "#e4edff",
          200: "#c8d9ff",
          300: "#9db8ff",
          400: "#6b8dff",
          500: "#4765ff",
          600: "#3245db",
          700: "#2835ac",
          800: "#222d85",
          900: "#1f2a6a",
        },
      },
    },
  },
  plugins: [],
};

