// Guarda: todo filtro de rango declara de que es (issue #386).
//
// POR QUE EXISTE
//
// Un `TIPOS_DE_FILTRO.RANGO` se dibuja con dos componentes muy distintos segun de que sea:
// `DateField` o `NumberField`. El tipo solo no lo dice.
//
// Antes FilterBar lo adivinaba: si el descriptor traia `min` o `max` numericos lo tomaba por
// numerico, y si no por de fechas. Acertaba con los ocho rangos que existen -por eso el defecto
// no se veia-, pero un rango numerico sin limites declarados, que es perfectamente legitimo,
// habria dibujado selectores de fecha. Y eso no revienta: se ve mal, y solo cuando alguien lo
// usa.
//
// Al retirar la heuristica, un descriptor que olvide `subtipo` deja de funcionar bien. Esta
// prueba es lo que impide que ese olvido llegue a una pantalla: mientras la heuristica existia,
// olvidarlo salia gratis; ahora no.
//
// QUE COMPRUEBA, Y QUE NO
//
// Que cada descriptor de rango declara un subtipo del vocabulario. **No** comprueba que el
// subtipo elegido sea el correcto -que `rangoEdad` sea numerico y no de fechas-: eso es una
// decision de producto que ninguna prueba puede deducir del descriptor, y se ve mirando la
// pantalla.

import { describe, expect, it } from "vitest";

import * as barril from "./index.js";
import { SUBTIPOS_DE_RANGO, TIPOS_DE_FILTRO } from "./descriptores.js";

const SUBTIPOS_VALIDOS = Object.values(SUBTIPOS_DE_RANGO);

/**
 * Todos los descriptores de filtro que el barril publica, con el nombre bajo el que salen.
 *
 * Se leen del barril y no de una lista escrita a mano para que un modulo nuevo entre solo: si
 * manana alguien agrega FILTROS_LOQUESEA con un rango sin subtipo, esta prueba lo ve sin que
 * nadie se acuerde de venir a apuntarlo aqui.
 */
const DESCRIPTORES_DE_FILTRO = Object.entries(barril).filter(
  ([nombre, valor]) => nombre.startsWith("FILTROS_") && Array.isArray(valor),
);

/** Cada rango, aplanado, con el nombre del descriptor que lo contiene para poder nombrarlo. */
const RANGOS = DESCRIPTORES_DE_FILTRO.flatMap(([nombre, campos]) =>
  campos
    .filter((campo) => campo?.tipo === TIPOS_DE_FILTRO.RANGO)
    .map((campo) => [`${nombre}.${campo.id}`, campo]),
);

describe("los filtros de rango declaran su subtipo", () => {
  it("hay rangos que comprobar, para que la prueba no pase por vacia", () => {
    expect(RANGOS.length).toBeGreaterThan(0);
  });

  it.each(RANGOS)("%s declara un subtipo del vocabulario", (nombre, campo) => {
    expect(
      campo.subtipo,
      `${nombre} es TIPOS_DE_FILTRO.RANGO y no declara subtipo. FilterBar ya no lo adivina ` +
        `(issue #386): sin el cae en NumberField, asi que un rango de fechas se dibujaria con ` +
        `campos numericos. Declaralo con SUBTIPOS_DE_RANGO de descriptores.js.`,
    ).toBeDefined();

    expect(
      SUBTIPOS_VALIDOS,
      `${nombre} declara un subtipo que no existe: ${campo.subtipo}`,
    ).toContain(campo.subtipo);
  });
});
