import { afterAll, beforeAll } from "vitest";

/**
 * Fija TZ=America/Guatemala (UTC-6) para el describe() actual, y la restaura al terminar.
 *
 * El bug de la issue #725 (leer/escribir una fecha con new Date(cadena)/toISOString() en vez de
 * aFechaLocal()/aCadenaFechaLocal()) solo se manifiesta cuando el proceso corre en una zona
 * horaria distinta de UTC. Sin esto, una prueba que corra en CI (que corre en UTC) no distingue
 * el codigo roto del corregido: los dos leen el mismo dia.
 */
export function conZonaHorariaDeGuatemala() {
  const original = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "America/Guatemala";
  });

  afterAll(() => {
    process.env.TZ = original;
  });
}
