#!/usr/bin/env node
// Resumen de las pruebas para la pagina del PR (issue #223).
//
// POR QUE EXISTE
//
// La DoD de la #223 pide que "el resultado de las pruebas sea visible en el PR". Hoy lo unico
// que se ve es el check en rojo o en verde: para saber cuantas pruebas corrieron, o si la
// cobertura quedo pegada al umbral, hay que abrir la corrida y leer el log crudo del paso.
//
// Este script convierte esa informacion en el resumen que GitHub muestra en la pagina de la
// corrida, a un clic del PR. No es un paso de validacion: no decide si el CI pasa. Eso ya lo
// hace `npm test`, que devuelve distinto de cero si una prueba falla o si la cobertura cae por
// debajo del umbral.
//
// POR QUE UN RESUMEN Y NO UN COMENTARIO EN EL PR
//
// Escribir en $GITHUB_STEP_SUMMARY no pide permisos: el workflow sigue con `contents: read`.
// Comentar en el PR obligaria a darle `pull-requests: write` y a ensuciar el hilo en cada push.
//
// LOS UMBRALES NO SE COPIAN
//
// Se leen de packages/shared/vitest.config.js, que es donde los declara la guarda de la #219.
// Copiarlos aqui crearia una segunda fuente que puede divergir en silencio, que es justo el
// tipo de defecto que este repositorio ya arrastro con los descriptores.
//
// NUNCA FALLA
//
// Corre con `if: always()`, o sea tambien despues de una corrida en rojo, y ahi los archivos
// que lee pueden no existir. Un reporte que revienta convertiria un fallo de pruebas legible en
// un segundo fallo que no dice nada, asi que cada lectura degrada a una nota y sale con 0.
//
// Uso:
//   node scripts/resumen-de-pruebas.mjs [ruta-del-log] >> "$GITHUB_STEP_SUMMARY"

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

/**
 * Lineas de cierre que imprime vitest: cuantos archivos, cuantas pruebas y cuanto tardo.
 *
 * Se sacan del log y no de un reporter de maquina porque el script del paquete es
 * `vitest run --coverage` y no declara `test.reporters`. Agregar uno cambiaria tambien lo que
 * ve quien corre las pruebas en su maquina, y esto no lo necesita.
 */
const LINEAS_DE_CIERRE = /^\s*(Test Files|Tests|Duration)\s+\S/;

function leerCierreDelLog(ruta) {
  if (!ruta) return null;
  try {
    return readFileSync(resolve(ruta), "utf8")
      .split("\n")
      .filter((linea) => LINEAS_DE_CIERRE.test(linea))
      .map((linea) => linea.trim());
  } catch {
    return null;
  }
}

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

const [, , rutaDelLog] = process.argv;
const cierre = leerCierreDelLog(rutaDelLog);
const cobertura = leerCobertura();
const umbrales = await leerUmbrales();

const lineas = ["## Pruebas", ""];

if (cierre && cierre.length > 0) {
  lineas.push("```", ...cierre, "```", "");
} else {
  lineas.push("No se pudo leer la salida de las pruebas. El detalle esta en el log del paso.", "");
}

if (cobertura && umbrales) {
  lineas.push(
    "Cobertura de las validaciones, la guarda de la issue #219. El umbral solo sube:",
    "",
    "| Metrica | Medido | Umbral |",
    "| --- | ---: | ---: |",
    ...METRICAS.map(
      ([clave, nombre]) => `| ${nombre} | ${cobertura[clave].pct} % | ${umbrales[clave]} % |`,
    ),
  );
} else {
  lineas.push("No se genero el informe de cobertura en esta corrida.");
}

console.log(lineas.join("\n"));
