// frontend/babel.config.js
module.exports = {
  presets: [
    '@babel/preset-env', // מאפשר להשתמש בתכונות JavaScript מודרניות (כמו async/await, spread operator, וכו')
                         // Babel ידאג להמיר אותן לגרסה ש-Node.js (שמריץ את Jest) מבין, אם צריך.
    ['@babel/preset-react', { runtime: 'automatic' }] // מאפשר ל-Babel להבין JSX
                                                     // ולהוסיף ייבואי React אוטומטית עבור React 17+
  ],
};