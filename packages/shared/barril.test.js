// Que ningun nombre se exporte desde dos modulos distintos del barril.
//
// EL FALLO QUE FIJA
//
// `index.js` es una cadena de `export * from "./<modulo>/index.js"`. Cuando dos modulos exportan
// el MISMO nombre, el resultado depende de quien compile:
//
//   - ESM lo declara ambiguo y excluye el nombre del barril. `import { X } from "@ecopac/shared"`
//     deja de resolver, en silencio, para las dos X.
//   - Babel en CJS (que es como jest-expo compila el paquete para apps/mobile) traduce cada
//     `export *` a un bucle de Object.defineProperty sobre `exports`, y la segunda definicion
//     revienta con "TypeError: Cannot redefine property: X" AL IMPORTAR EL BARRIL. Se cae la
//     suite entera de movil, no una prueba: veintiocho archivos con "Test suite failed to run".
//
// Paso de verdad: `pacientes/permisos.js` gano un `puedeRegistrarConsulta(rol)` -si el ROL puede
// registrar una consulta- sin que nadie viera que `jornadas/api.js` ya exportaba un
// `puedeRegistrarConsulta(jornadaId)` -si ESA JORNADA acepta consultas-. Dos funciones
// legitimas, distintas, con el mismo nombre. Ni el lint ni el build ni las pruebas de web o
// shared lo detectan: solo la compilacion CJS del movil.
//
// Esta prueba lo detecta en shared, que es donde se comete.

import { describe, expect, it } from "vitest";

import * as barril from "./index.js";

// Los mismos modulos que enumera index.js, en el mismo orden.
const MODULOS = [
  "entorno",
  "formato",
  "pacientes",
  "inventario",
  "jornadas",
  "atenciones",
  "donaciones",
  "proyectos",
  "presupuestos",
  "reportes",
  "territorio",
  "api",
  "hooks",
];

describe("el barril de shared", () => {
  it("no exporta el mismo nombre desde dos modulos", async () => {
    const duenios = new Map();
    const choques = [];

    for (const modulo of MODULOS) {
      const contenido = await import(`./${modulo}/index.js`);

      for (const nombre of Object.keys(contenido)) {
        if (nombre === "default") continue;

        if (duenios.has(nombre)) {
          choques.push(`"${nombre}": ${duenios.get(nombre)} y ${modulo}`);
        } else {
          duenios.set(nombre, modulo);
        }
      }
    }

    expect(
      choques,
      "Dos modulos exportan el mismo nombre. En ESM el barril lo excluye en silencio; " +
        "compilado a CJS (apps/mobile) revienta con 'Cannot redefine property' al importar " +
        "@ecopac/shared. Renombra uno de los dos.\n  " +
        choques.join("\n  "),
    ).toEqual([]);
  });

  it("sigue exportando lo que las apps importan por su nombre", () => {
    // Una muestra de cada modulo: si un choque hiciera desaparecer un nombre del barril, esto
    // falla aunque la comprobacion de arriba se pasara por alto.
    for (const nombre of [
      "useRegistroPaciente",
      "puedeCrearConsulta",
      "puedeRegistrarConsulta",
      "listarJornadas",
      "formatearFechaCorta",
      "MODULOS",
    ]) {
      expect(barril, `"${nombre}" no llega al barril`).toHaveProperty(nombre);
    }
  });
});
