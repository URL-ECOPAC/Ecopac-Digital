#!/usr/bin/env node
// Publica la cobertura de las validaciones en el resumen de la corrida (issue #223).
//
// POR QUE EXISTE, Y POR QUE SOLO LA COBERTURA
//
// La DoD de la #223 pide que "el resultado de las pruebas sea visible en el PR". La mitad de eso
// ya la resuelve vitest solo: cuando detecta que corre en Actions agrega su reporter
// `github-actions`, que escribe un "Vitest Test Report" en el resumen con cuantos archivos y
// cuantas pruebas pasaron. **No se ve al correr las pruebas en local**, porque ese reporter solo
// se activa con GITHUB_ACTIONS, y por eso es facil creer que no existe.
//
// Lo que vitest no publica es la cobertura. Y es justo el numero que hace falta vigilar aqui,
// porque desde la issue #219 la cobertura de las validaciones es una guarda con umbral, no una
// estadistica: si baja, el CI se pone en rojo. Ver cuanto margen queda -y que el umbral es un
// suelo real y no una aspiracion- es lo que este resumen agrega.
//
// De ahi que no intente republicar el conteo de pruebas: seria duplicar lo que ya esta unas
// lineas mas arriba en la misma pagina.
//
// LOS UMBRALES NO SE COPIAN
//
// Se leen de packages/shared/vitest.config.js, que es donde los declara la guarda de la #219.
// Copiarlos aqui crearia una segunda fuente que puede divergir en silencio, que es justo el tipo
// de defecto que este repositorio ya arrastro con los descriptores.
//
// POR QUE UN RESUMEN Y NO UN COMENTARIO EN EL PR
//
// Escribir en $GITHUB_STEP_SUMMARY no pide permisos: el workflow sigue con `contents: read`.
// Comentar en el PR obligaria a darle `pull-requests: write` y a ensuciar el hilo en cada push.
//
// NUNCA FALLA
//
// Corre con `if: always()`, o sea tambien despues de una corrida en rojo, y ahi el informe de
// cobertura no existe: vitest limpia su directorio al arrancar y no lo reescribe si las pruebas
// fallan. Un reporte que revienta convertiria un fallo de pruebas legible en un segundo fallo que
// no dice nada, asi que cada lectura degrada a una nota y sale con 0. No es una guarda: quien
// decide si el CI pasa es `npm test`.
//
// Uso:
//   node scripts/resumen-de-pruebas.mjs >> "$GITHUB_STEP_SUMMARY"

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const RESUMEN_DE_COBERTURA = "packages/shared/coverage/coverage-summary.json";
const CONFIG_DE_VITEST = "packages/shared/vitest.config.js";

/** Las cuatro metricas que declara la guarda de cobertura, con el nombre que se muestra. */
const METRICAS = [
  ["statements", "Sentencias"],
  ["branches", "Ramas"],
  ["functions", "Funciones"],
  ["lines", "Lineas"],
];

async function leerUmbrales() {
  try {
    const modulo = await import(pathToFileURL(resolve(CONFIG_DE_VITEST)).href);
    return modulo.default?.test?.coverage?.thresholds ?? null;
  } catch {
    return null;
  }
}

function leerCobertura() {
  try {
    return JSON.parse(readFileSync(resolve(RESUMEN_DE_COBERTURA), "utf8")).total;
  } catch {
    return null;
  }
}

const cobertura = leerCobertura();
const umbrales = await leerUmbrales();

const lineas = ["## Cobertura de las validaciones", ""];

if (cobertura && umbrales) {
  lineas.push(
    "Guarda de la issue #219. El umbral es un suelo medido, no una aspiracion, y solo sube:",
    "",
    "| Metrica | Medido | Umbral |",
    "| --- | ---: | ---: |",
    ...METRICAS.map(
      ([clave, nombre]) => `| ${nombre} | ${cobertura[clave].pct} % | ${umbrales[clave]} % |`,
    ),
  );
} else {
  lineas.push(
    "No se genero el informe de cobertura en esta corrida. Pasa cuando las pruebas fallan:",
    "vitest limpia su directorio al arrancar y no lo reescribe. El detalle de que fallo esta en",
    "el reporte de vitest, mas arriba en esta misma pagina.",
  );
}

console.log(lineas.join("\n"));
