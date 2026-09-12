const path = require("node:path");

module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^react$": path.resolve(__dirname, "node_modules/react"),
    "^@ecopac/shared/(.*)$": path.resolve(__dirname, "../../packages/shared/$1"),
    "^@ecopac/shared$": path.resolve(__dirname, "../../packages/shared/index.js"),
    "^@ecopac/ui-tokens$": path.resolve(__dirname, "../../packages/ui-tokens/index.js"),
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)",
  ],
  testMatch: ["**/*.test.js", "**/*.test.jsx"],
  testPathIgnorePatterns: ["/node_modules/"],

  // Cobertura medida por defecto (issue #775): hasta ahora apps/mobile corria sus pruebas sin
  // recoleccion de cobertura, a diferencia de packages/shared (que si reporta en cada corrida,
  // vitest.config.js). No habia ningun numero que dijera que tan cubierta esta la app movil.
  // Solo src/: app.config.js, metro.config.js y el propio jest.config.js no son codigo de la
  // app. Los .test.js quedan fuera de su propio numerador via testPathIgnorePatterns arriba, pero
  // hay que excluirlos aqui tambien porque collectCoverageFrom no comparte ese filtro.
  collectCoverage: true,
  collectCoverageFrom: ["src/**/*.{js,jsx}", "!src/**/*.test.{js,jsx}"],
  coverageDirectory: "<rootDir>/coverage",
};
