// Guarda de los tipos del dominio (issue #48).
//
// POR QUE EXISTE
//
// Los `@typedef` de index.js son comentarios: no existen en tiempo de ejecucion, ningun import
// los resuelve y ninguna prueba los ejecuta. Si una migracion agrega una columna, renombra otra o
// crea una tabla, este archivo no se entera y el tipo empieza a mentir en silencio. Eso ya paso
// con el propio archivo que esta prueba protege: hasta la issue #396 declaraba un `RolUsuario`
// con roles capitalizados que el enum rol_usuario nunca tuvo.
//
// Es texto contra texto, sin base de datos: extrae los `@typedef` de index.js, arma el inventario
// del esquema leyendo supabase/migrations/ en orden, y los compara.
//
// COMO LEE EL ESQUEMA
//
// Con leerEsquema() de scripts/verificar-shared-vs-esquema.mjs, que ya existe y ya resuelve lo
// dificil: aplica las migraciones en orden y respeta ADD COLUMN, DROP COLUMN, RENAME y DROP
// TABLE, ademas de descartar los CREATE TABLE que viven dentro del cuerpo de una funcion. Se
// comprobo contra la base local -supabase db reset y un volcado del information_schema- y da las
// mismas 41 tablas con las mismas columnas. Reimplementarlo aqui seria una segunda respuesta a la
// misma pregunta, que es justo lo que la issue #397 desmonto en los enums.
//
// LAS TRES DIRECCIONES
//
// Son tres comprobaciones y ninguna sustituye a las otras:
//
//   1. Falta un typedef. Es lo que hace que la proxima migracion que cree una tabla no pase sin
//      tipo.
//   2. Sobra una propiedad. Atrapa el renombrado: cuando la 00092 cambio gastos.encargado_id por
//      responsable_id, un typedef con `encargadoId` se pondria en rojo aqui.
//   3. Falta una columna. Es la direccion que verificar-shared-vs-esquema.mjs no cubre: aquella
//      guarda comprueba que shared no PIDA columnas inexistentes; esta, que el tipo no se quede
//      corto cuando el esquema crece.
//
// QUE NO COMPRUEBA, A PROPOSITO
//
// Que el tipo JSDoc de cada propiedad sea el tipo SQL de la columna: `string` contra `uuid` no es
// una comparacion que se pueda hacer sin decidir a mano como viaja cada tipo por JSON. Eso se
// verifico con el information_schema al escribir los typedefs, y quien lo puede volver a
// comprobar es `tsc --checkJs` contra un objeto real, no esta prueba. Tampoco comprueba las
// vistas: sus columnas salen del SELECT que las define y vista_reporte_impacto se redefine tres
// veces, la misma omision declarada que hace la guarda de esquema.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { leerEsquema } from "../../../scripts/verificar-shared-vs-esquema.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..", "..");
const DIR_MIGRACIONES = join(RAIZ, "supabase", "migrations");

const FUENTE = readFileSync(join(AQUI, "index.js"), "utf8");

const { tablas } = leerEsquema(
  readdirSync(DIR_MIGRACIONES)
    .filter((nombre) => nombre.endsWith(".sql"))
    .sort()
    .map((nombre) => readFileSync(join(DIR_MIGRACIONES, nombre), "utf8")),
);

const camel = (columna) => columna.replace(/_([a-z0-9])/g, (_, letra) => letra.toUpperCase());

/**
 * Los typedefs de tabla que declara index.js, indexados por la tabla que cita.
 *
 * Un bloque cuenta como typedef de tabla cuando es `@typedef {object} Nombre` -los alias de enum
 * son `@typedef {union}` y no entran- y su texto nombra una tabla del esquema entre acentos
 * graves. Se busca la tabla en el texto y no se deriva del nombre del tipo a proposito: Perfil es
 * `perfiles`, RecetaDetalle es `receta_detalle` y CondicionCronica es `condiciones_cronicas`, asi
 * que cualquier regla de pluralizacion seria una tercera cosa que mantener.
 */
function typedefsDeTabla() {
  const encontrados = new Map();
  for (const bloque of FUENTE.match(/\/\*\*[\s\S]*?\*\//g) ?? []) {
    const tipo = bloque.match(/@typedef\s+\{object\}\s+(\w+)/);
    if (!tipo) continue;
    const tabla = [...bloque.matchAll(/`(\w+)`/g)].map((m) => m[1]).find((n) => tablas.has(n));
    if (!tabla) continue;
    const propiedades = [...bloque.matchAll(/@property\s+\{[^}]*\}\s+(\w+)/g)].map((m) => m[1]);
    encontrados.set(tabla, { tipo: tipo[1], propiedades });
  }
  return encontrados;
}

const declarados = typedefsDeTabla();

describe("los tipos del dominio siguen al esquema", () => {
  it("lee un esquema con tablas y un archivo con typedefs", () => {
    // Si cualquiera de los dos lados llega vacio, las tres pruebas de abajo pasan sin comparar
    // nada. Es el modo de fallo silencioso de una guarda que compara dos listas.
    expect(tablas.size).toBeGreaterThan(0);
    expect(declarados.size).toBeGreaterThan(0);
  });

  it("declara un typedef por cada tabla del esquema", () => {
    const sinTipo = [...tablas.keys()].filter((tabla) => !declarados.has(tabla)).sort();

    expect(
      sinTipo,
      `Estas tablas de supabase/migrations/ no tienen @typedef en types/index.js: ` +
        `${sinTipo.join(", ")}. Agregalo, con las columnas en camelCase y citando la migracion ` +
        `que crea la tabla.`,
    ).toEqual([]);
  });

  it("no declara ninguna propiedad que la tabla no tenga", () => {
    const sobran = [];
    for (const [tabla, { tipo, propiedades }] of declarados) {
      const columnas = new Set([...tablas.get(tabla)].map(camel));
      for (const propiedad of propiedades) {
        if (!columnas.has(propiedad)) sobran.push(`${tipo}.${propiedad} (tabla ${tabla})`);
      }
    }

    expect(
      sobran.sort(),
      `Estas propiedades no corresponden a ninguna columna de su tabla: ${sobran.join(", ")}. ` +
        `Suele ser una columna renombrada por una migracion posterior.`,
    ).toEqual([]);
  });

  it("no se salta ninguna columna de la tabla", () => {
    const faltan = [];
    for (const [tabla, { tipo, propiedades }] of declarados) {
      const declaradas = new Set(propiedades);
      for (const columna of tablas.get(tabla)) {
        if (!declaradas.has(camel(columna))) faltan.push(`${tipo}.${camel(columna)} (${tabla})`);
      }
    }

    expect(
      faltan.sort(),
      `Estas columnas existen en el esquema y no estan en su @typedef: ${faltan.join(", ")}.`,
    ).toEqual([]);
  });
});
