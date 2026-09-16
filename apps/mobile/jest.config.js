const path = require("node:path");

// Build CJS de lucide-react-native (issue #756), para los dos mapeos de abajo. require.resolve()
// y no path.resolve(__dirname): npm workspaces puede izar el paquete al node_modules de la raiz
// del monorepo en vez de dejarlo en apps/mobile/node_modules.
const LUCIDE_CJS_PRINCIPAL = require.resolve("lucide-react-native");
const LUCIDE_CJS_ICONOS = path.join(path.dirname(LUCIDE_CJS_PRINCIPAL), "icons");

module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^react$": path.resolve(__dirname, "node_modules/react"),
    "^@ecopac/shared/(.*)$": path.resolve(__dirname, "../../packages/shared/$1"),
    "^@ecopac/shared$": path.resolve(__dirname, "../../packages/shared/index.js"),
    "^@ecopac/ui-tokens$": path.resolve(__dirname, "../../packages/ui-tokens/index.js"),
    // react-native-webview envuelve un modulo nativo que no existe fuera de un binario real
    // (issue #756): ver src/__mocks__/react-native-webview.js.
    "^react-native-webview$": path.resolve(__dirname, "src/__mocks__/react-native-webview.js"),
    // lucide-react-native (issue #756) declara la condicion "react-native" de package.json
    // exports apuntando a su build ESM (.mjs); jest-expo respeta esa condicion igual que Metro,
    // pero Jest corre en CommonJS y no puede cargar ESM sin --experimental-vm-modules. Se fuerza
    // la resolucion a su build CJS, la misma que "require" ya declara para cualquier otro
    // consumidor que no sea un bundler de RN.
    "^lucide-react-native$": LUCIDE_CJS_PRINCIPAL,
    // IconoModulo.js importa cada icono de su propio archivo (lucide-react-native/icons/<...>)
    // y no del paquete completo -ese barril re-exporta mas de 1500 iconos, y construirlo entero
    // en cada archivo de prueba (jest no comparte el registro de modulos entre test files) hizo
    // que la suite pasara de unos segundos a mas de un minuto por archivo. Mismo problema de
    // condicion "react-native" que el mapeo de arriba, asi que mismo arreglo.
    "^lucide-react-native/icons/(.*)$": path.join(LUCIDE_CJS_ICONOS, "$1.js"),
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|lucide-react-native)",
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
