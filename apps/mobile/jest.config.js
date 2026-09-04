// Configuracion de pruebas de apps/mobile (issue #702).
//
// POR QUE JEST Y NO VITEST, que es lo que usa el resto del monorepo.
//
// packages/shared corre en vitest con environment "node" y apps/web en vitest con "jsdom". Para
// React Native ninguno de los dos sirve tal cual: el codigo importa modulos nativos de Expo
// (expo-secure-store, expo-crypto) y componentes de react-native que hay que transformar con el
// preset de Babel de RN. Montar eso a mano sobre vitest significa mantener el mapa de transforms
// y los mocks de cada modulo nativo, y es donde esa configuracion se rompe en cada subida de
// version de Expo.
//
// `jest-expo` es el preset que publica Expo para su propia version del SDK: trae los transforms,
// el resolver de plataformas (.ios/.android/.native) y los mocks de los modulos nativos ya
// resueltos, y sube con el SDK. Tener un segundo runner en el monorepo es el precio; a cambio,
// las pruebas de movil no dependen de que alguien reconstruya la configuracion a mano.
//
// La decision se tomo en la issue #702 y esta escrita tambien en docs/CI-CD.md.
//
// EL ALIAS DE @ecopac/shared apunta al FUENTE y no al symlink de npm workspaces, igual que hacen
// apps/web/vitest.config.js y vite.config.js: sin el, una prueba no veria un cambio recien hecho
// en packages/shared hasta un reinstall.

const path = require("node:path");

module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@ecopac/shared$": path.resolve(__dirname, "../../packages/shared/index.js"),
    "^@ecopac/ui-tokens$": path.resolve(__dirname, "../../packages/ui-tokens/index.js"),
  },
  // jest-expo no transforma node_modules por defecto salvo esta lista: react-native y los
  // paquetes de Expo se publican como ESM sin transpilar.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)",
  ],
  testMatch: ["**/*.test.js", "**/*.test.jsx"],
  testPathIgnorePatterns: ["/node_modules/"],
};
