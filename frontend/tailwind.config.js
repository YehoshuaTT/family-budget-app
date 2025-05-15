// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // סורק את הקובץ הראשי
    "./src/**/*.{js,ts,jsx,tsx}", // סורק את כל קבצי ה-JS/TS/JSX/TSX בתוך תיקיית src
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Assistant', 'sans-serif'], // ודא שהפונט Assistant (או אחר) נטען
      },
      colors: {
        primary: {
          light: '#60a5fa', // sky-400
          DEFAULT: '#3b82f6', // sky-500 (כך תוכל להשתמש ב- bg-primary)
          dark: '#2563eb',  // sky-600
        },
        secondary: {
          light: '#94a3b8', // slate-400
          DEFAULT: '#64748b', // slate-500
          dark: '#475569',  // slate-600
        },
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
      }
    },
  },
  plugins: [],
}