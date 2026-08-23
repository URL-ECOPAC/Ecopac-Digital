// Configuracion de pruebas de packages/shared.
//
// environment "node" y no jsdom a proposito: este paquete no puede tocar document, window,
// localStorage ni AsyncStorage (regla de la frontera en docs/ARQUITECTURA-FRONTEND.md). Si
// una prueba de aqui necesitara un DOM, lo que esta mal es el codigo bajo prueba, no el
// entorno de la prueba.
//
// Sin globals: cada archivo importa describe, it y expect desde "vitest". Con globals el
// linter marcaria describe e it como no definidos y habria que inventar excepciones en
// eslint.config.mjs para algo que un import de una linea ya resuelve.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["**/*.test.js"],
    exclude: ["**/node_modules/**"],
  },
});
