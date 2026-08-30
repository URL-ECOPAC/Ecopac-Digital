// Prueba de la logica pura del hook de la bandeja de validacion.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). El resguardo contra respuestas fuera de orden ya lo prueba
// hooks/useBusquedaPacientes.test.js (esRespuestaVigente, reusada aqui sin reimplementar);
// esta prueba cubre lo unico propio de este hook que tiene logica de decision.

import { describe, expect, it } from "vitest";

import { debeRecargarTrasAccion } from "./usePendientesValidacion.js";

describe("debeRecargarTrasAccion", () => {
  it("recarga la bandeja cuando la accion salio bien", () => {
    expect(debeRecargarTrasAccion({ datos: { id: "mov-1" }, error: null })).toBe(true);
  });

  it("no recarga si la accion fallo, para no pisar el error en pantalla", () => {
    expect(debeRecargarTrasAccion({ datos: null, error: { mensaje: "Stock insuficiente" } })).toBe(
      false,
    );
  });

  it("no revienta si la respuesta viene vacia (no deberia pasar nunca en la practica)", () => {
    // Sin objeto no hay .error que mirar: el optional chaining no explota, y el resultado es
    // "recargar" por defecto -inofensivo, a diferencia de fallar abierto en una comprobacion
    // de seguridad- en vez de tirar una excepcion.
    expect(() => debeRecargarTrasAccion(undefined)).not.toThrow();
    expect(() => debeRecargarTrasAccion(null)).not.toThrow();
  });
});
