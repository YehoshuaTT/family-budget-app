// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {}, // השתמש בחבילה החדשה
    // tailwindcss: {}, // <<< הסר או החלף את השורה הישנה הזו אם הייתה
    autoprefixer: {},
  },
}