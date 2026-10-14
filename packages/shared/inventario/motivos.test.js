// Pruebas de como se muestra el motivo de un movimiento de inventario (kardex).
//
// Se importa campos.js directamente y no el barril: estas pruebas corren sin .env y sin conexion.

import { describe, expect, it } from "vitest";

import { etiquetaDeMotivoDeMovimiento, OPCIONES_MOTIVO_SALIDA } from "./campos.js";

describe("etiquetaDeMotivoDeMovimiento", () => {
  it("un codigo que escribe el sistema se muestra con su etiqueta", () => {
    expect(etiquetaDeMotivoDeMovimiento("entrega")).toBe("Entrega a paciente");
    for (const opcion of OPCIONES_MOTIVO_SALIDA) {
      expect(etiquetaDeMotivoDeMovimiento(opcion.value)).toBe(opcion.label);
    }
  });

  it("el texto libre se muestra tal cual", () => {
    expect(etiquetaDeMotivoDeMovimiento("COMP-56")).toBe("COMP-56");
  });

  it("sin motivo no dice nada", () => {
    expect(etiquetaDeMotivoDeMovimiento(null)).toBe("");
    expect(etiquetaDeMotivoDeMovimiento("")).toBe("");
  });
});
