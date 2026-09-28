#!/usr/bin/env node
/* global console, process */
// Guarda de CI: toda funcion exportada de packages/shared lleva JSDoc completo (issue #233).
//
// POR QUE EXISTE
//
// La #233 pide que "toda funcion exportada de packages/shared tenga JSDoc con parametros y valor
// de retorno", porque ese paquete es la API que consumen las dos apps y lo que permite que otro
// equipo retome el proyecto sin leer cada implementacion. Al medirlo por primera vez (24 de
// septiembre de 2026) 85 de 712 no tenian ningun bloque, 183 no nombraban sus parametros y unas
// 240 no decian que devolvian. Se completaron todos, y la guarda corre en CI con --estricto para
// que el numero no vuelva a crecer.
//
// QUE COMPRUEBA
//
// Por cada funcion exportada (`export function`, `export async function`,
// `export const x = (...) => ...` y `export const x = function ...`):
//
//   - que tenga un bloque /** ... */ inmediatamente encima;
//   - si recibe parametros, que el bloque nombre al menos un @param;
//   - si devuelve un valor, que el bloque tenga @returns (o @return).
//
// "Devuelve un valor" se decide leyendo el arbol de sintaxis, no el texto: una flecha de cuerpo
// expresion devuelve siempre; una funcion con llaves, si tiene algun `return <algo>` propio -no de
// una funcion anidada, como el callback de un .map() o de un useEffect-. Una funcion que solo hace
// efectos no necesita @returns. El arbol lo arma espree, el parser de ESLint, que ya es dependencia
// del monorepo.
//
// Sin --estricto, solo falla la falta de bloque e informa del resto; con --estricto (lo que corre
// el CI) falla todo.
//
// Quedan fuera las pruebas (*.test.js), la configuracion de vitest y packages/shared/pruebas/,
// que son apoyos de prueba y no API.
//
// Uso:
//   npm run verificar:jsdoc
//   npm run verificar:jsdoc -- --estricto
//   npm run verificar:jsdoc -- --lista      (imprime tambien los bloques incompletos)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const espree = require("espree");

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

const ES_FUNCION = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

/** Las funciones exportadas de un modulo: `{ nombre, nodoExport, funcion }`. */
function funcionesExportadas(programa) {
  const salida = [];
  for (const nodo of programa.body) {
    if (nodo.type !== "ExportNamedDeclaration" || !nodo.declaration) continue;
    const declaracion = nodo.declaration;
    if (declaracion.type === "FunctionDeclaration") {
      salida.push({ nombre: declaracion.id.name, nodoExport: nodo, funcion: declaracion });
    } else if (declaracion.type === "VariableDeclaration") {
      for (const variable of declaracion.declarations) {
        if (variable.init && ES_FUNCION.has(variable.init.type)) {
          salida.push({ nombre: variable.id.name, nodoExport: nodo, funcion: variable.init });
        }
      }
    }
  }
  return salida;
}

/** Recorre un nodo buscando un `return <valor>` propio, sin entrar en funciones anidadas. */
function tieneReturnConValor(nodo) {
  if (!nodo || typeof nodo.type !== "string") return false;
  if (nodo.type === "ReturnStatement") return nodo.argument !== null;
  for (const [clave, hijo] of Object.entries(nodo)) {
    if (clave === "parent" || !hijo || typeof hijo !== "object") continue;
    const hijos = Array.isArray(hijo) ? hijo : [hijo];
    for (const h of hijos) {
      if (!h || typeof h.type !== "string" || ES_FUNCION.has(h.type)) continue;
      if (tieneReturnConValor(h)) return true;
    }
  }
  return false;
}

/** Si la funcion devuelve un valor: flecha de expresion, o algun return propio con valor. */
function devuelveValor(funcion) {
  if (funcion.type === "ArrowFunctionExpression" && funcion.expression) return true;
  return tieneReturnConValor(funcion.body);
}

/** El bloque /** ... *\/ que termina justo antes del export (solo espacio en medio), o null. */
function bloqueJSDoc(fuente, comentarios, nodoExport) {
  const previo = comentarios
    .filter((c) => c.type === "Block" && c.range[1] <= nodoExport.range[0])
    .at(-1);
  if (!previo || !previo.value.startsWith("*")) return null;
  if (fuente.slice(previo.range[1], nodoExport.range[0]).trim() !== "") return null;
  return previo.value;
}

const sinBloque = [];
const sinParam = [];
const sinReturns = [];
let total = 0;

for (const archivo of archivosDe(SHARED)) {
  const fuente = readFileSync(archivo, "utf8");
  const programa = espree.parse(fuente, {
    ecmaVersion: "latest",
    sourceType: "module",
    comment: true,
    range: true,
    loc: true,
  });

  for (const { nombre, nodoExport, funcion } of funcionesExportadas(programa)) {
    total++;
    const donde = `${relative(RAIZ, archivo).split(sep).join("/")}:${nodoExport.loc.start.line} ${nombre}`;
    const bloque = bloqueJSDoc(fuente, programa.comments, nodoExport);

    if (bloque === null) {
      sinBloque.push(donde);
      continue;
    }
    if (funcion.params.length > 0 && !/@param\b/.test(bloque)) sinParam.push(donde);
    if (devuelveValor(funcion) && !/@returns?\b/.test(bloque)) sinReturns.push(donde);
  }
}

console.log(
  `packages/shared: ${total} funciones exportadas, ${total - sinBloque.length} con JSDoc, ` +
    `${sinParam.length} sin @param y ${sinReturns.length} sin @returns.`,
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
  if (sinReturns.length > 0) {
    console.log(`\nCon JSDoc pero sin @returns (${sinReturns.length}):`);
    for (const donde of sinReturns) console.log(`  ${donde}`);
  }
}

const incompletos = sinParam.length + sinReturns.length;
if (sinBloque.length > 0 || (estricto && incompletos > 0)) {
  console.error(
    "\nCada funcion exportada de packages/shared lleva un bloque /** ... */ encima, con sus " +
      "@param y, si devuelve algo, su @returns (issue #233, docs/API-SHARED.md).",
  );
  process.exit(1);
}
