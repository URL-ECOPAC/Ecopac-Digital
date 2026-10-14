// Configuracion de vitest para prueba-de-carga-jornada-50-pacientes.mjs (issue #774).
//
// El script importa @ecopac/shared, que resuelve packages/shared/entorno/fuente SIN extension a
// proposito (packages/shared/entorno/index.js documenta por que: es lo que permite a Metro
// resolver fuente.native.js en movil mientras Vite resuelve fuente.js en web). Node puro no
// resuelve un import sin extension y el script revienta con ERR_MODULE_NOT_FOUND antes de
// arrancar. vitest si lo resuelve (usa el mismo motor que Vite), que es por lo que
// pruebas/e2e/*.e2e.test.js ya corre con vitest y no con node a secas.
//
// Config separada de pruebas/e2e/vitest.config.mjs (y no reutilizada con un `include` extra) para
// que el script no quede alcanzable por accidente desde `npm run test:e2e`: es una herramienta
// manual de 50 pacientes reales, no algo que deba correr en cada validacion.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["**/prueba-de-carga-jornada-50-pacientes.mjs"],
    fileParallelism: false,
    // 150 pacientes-paso (registro + triaje + consulta + receta) x latencia real de red: el
    // timeout de las suites e2e normales (30s) se queda corto para un archivo que hace ~250
    // viajes reales a PostgREST/GoTrue.
    testTimeout: 10 * 60 * 1000,
    hookTimeout: 60000,
  },
});
