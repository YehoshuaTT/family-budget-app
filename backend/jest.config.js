// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./jest.setup.js'], // (אופציונלי) קובץ להגדרות גלובליות לפני כל בדיקה
  moduleNameMapper: { // אם אתה משתמש ב-paths ב-tsconfig.json
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [ // איפה לחפש קבצי בדיקות
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  // הגדרות כיסוי קוד
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["json", "lcov", "text", "clover"],
  collectCoverageFrom: [
    "src/**/*.{ts,js}", // מה לכלול בכיסוי
    "!src/migration/**", // לא לכלול מיגרציות
    "!src/entity/**",    // אלא אם יש לוגיקה ספציפית ב-Entities
    "!src/index.ts",     // לא לכלול קובץ כניסה ראשי
    "!src/data-source.ts",
    "!src/seed*.ts"
  ]
};