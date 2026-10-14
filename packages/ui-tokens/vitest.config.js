// Configuracion de pruebas de packages/ui-tokens.
//
// Mismo criterio que packages/shared: entorno "node" porque aqui no hay DOM que tocar -- este
// paquete solo exporta objetos planos -- y sin globals, para que describe, it y expect entren
// por import y el linter no necesite excepciones.
//
// Sin umbral de cobertura: lo que se prueba es la forma del contrato que consumen las dos apps,
// no ramas de logica, porque no hay ninguna.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["**/*.test.js"],
    exclude: ["**/node_modules/**"],
  },
});
