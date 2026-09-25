#!/usr/bin/env node
/* global console, process */
// Guarda de CI: toda funcion exportada de packages/shared lleva JSDoc (issue #233).
//
// POR QUE EXISTE
//
// La #233 pide que "toda funcion exportada de packages/shared tenga JSDoc con parametros y valor
// de retorno", porque ese paquete es la API que consumen las dos apps y lo que permite que otro
// equipo retome el proyecto sin leer cada implementacion. Al medirlo por primera vez (24 de
// septiembre de 2026) 85 de 712 no tenian ningun bloque; se documentaron en el mismo PR que
// agrego esta guarda, para que el numero no vuelva a crecer.
//
// QUE COMPRUEBA
//
//   - Falla si un `export function`, `export async function` o `export const x = (...) =>` no
//     tiene un bloque /** ... */ inmediatamente encima.
//   - Informa, sin fallar, de los bloques que existen pero no nombran ningun @param teniendo la
//     funcion parametros. Eran 183 al escribir esta guarda: bloques anteriores que explican el
//     porque en prosa. Con --estricto tambien fallan; es el criterio completo de la #233 y el
//     paso siguiente cuando esos bloques se completen.
//
// Quedan fuera las pruebas (*.test.js), la configuracion de vitest y packages/shared/pruebas/,
// que son apoyos de prueba y no API.
//
// Uso:
//   npm run verificar:jsdoc
//   npm run verificar:jsdoc -- --estricto
//   npm run verificar:jsdoc -- --lista      (imprime tambien los bloques sin @param)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = join(RAIZ, "packages", "shared");
const IGNORADAS = new Set(["node_modules", "coverage", "pruebas"]);

const estricto = process.argv.includes("--estricto");
const lista = process.argv.includes("--lista");

function archivosDe(dir) {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    if (IGNORADAS.has(nombre)) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta));
    else if (/\.js$/.test(nombre) && !/\.test\.js$/.test(nombre) && !/^vitest\./.test(nombre)) {
      salida.push(ruta);
    }
  }
  return salida;
}

const EXPORT =
  /^export\s+(?:async\s+)?function\s*\*?\s*(\w+)\s*\(([^)]*)\)|^export\s+const\s+(\w+)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|(\w+))\s*=>/gm;

const sinBloque = [];
const sinParam = [];
let total = 0;

for (const archivo of archivosDe(SHARED)) {
  const fuente = readFileSync(archivo, "utf8");
  for (const m of fuente.matchAll(EXPORT)) {
    total++;
    const nombre = m[1] ?? m[3];
    const parametros = (m[2] ?? m[4] ?? m[5] ?? "").trim();
    const linea = fuente.slice(0, m.index).split("\n").length;
    const donde = `${relative(RAIZ, archivo).split(sep).join("/")}:${linea} ${nombre}`;
    const antes = fuente.slice(0, m.index).trimEnd();

    if (
      !antes.endsWith("*/") ||
      antes.lastIndexOf("/**") < antes.lastIndexOf("*/", antes.length - 3)
    ) {
      sinBloque.push(donde);
      continue;
    }
    const bloque = antes.slice(antes.lastIndexOf("/**"));
    if (parametros && !/@param\b/.test(bloque)) sinParam.push(donde);
  }
}

console.log(
  `packages/shared: ${total} funciones exportadas, ${total - sinBloque.length} con JSDoc, ` +
    `${sinParam.length} con JSDoc pero sin @param.`,
);

if (sinBloque.length > 0) {
  console.error(`\nSin JSDoc (${sinBloque.length}):`);
  for (const donde of sinBloque) console.error(`  ${donde}`);
}
if (lista || estricto) {
  if (sinParam.length > 0) {
    console.log(`\nCon JSDoc pero sin @param (${sinParam.length}):`);
    for (const donde of sinParam) console.log(`  ${donde}`);
  }
}

if (sinBloque.length > 0 || (estricto && sinParam.length > 0)) {
  console.error(
    "\nCada funcion exportada de packages/shared lleva un bloque /** ... */ encima, con sus " +
      "@param y su @returns (issue #233, docs/API-SHARED.md).",
  );
  process.exit(1);
}
