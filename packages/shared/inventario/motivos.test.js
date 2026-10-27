// Pruebas de como se muestra el motivo de un movimiento de inventario (kardex).
//
// Se importa campos.js directamente y no el barril: estas pruebas corren sin .env y sin conexion.

import { describe, expect, it } from "vitest";

import { etiquetaDeMotivoDeMovimiento, OPCIONES_MOTIVO_SALIDA } from "./campos.js";

describe("etiquetaDeMotivoDeMovimiento", () => {
  it("un codigo que escribe el sistema se muestra con su etiqueta", () => {
    expect(etiquetaDeMotivoDeMovimiento("entrega")).toBe(
      "Entrega o venta a paciente (sin consulta)",
    );
    for (const opcion of OPCIONES_MOTIVO_SALIDA) {
      expect(etiquetaDeMotivoDeMovimiento(opcion.value)).toBe(opcion.label);
    }
  });

  // Issue #964 (00191): la entrega o venta sin consulta dice a quien.
  it("con paciente agrega su nombre, venga como texto o como el embed de la consulta", () => {
    expect(etiquetaDeMotivoDeMovimiento("entrega", "Maria Lopez")).toBe(
      "Entrega o venta a paciente (sin consulta) · Maria Lopez",
    );
    expect(etiquetaDeMotivoDeMovimiento("entrega", { nombres: "Maria", apellidos: "Lopez" })).toBe(
      "Entrega o venta a paciente (sin consulta) · Maria Lopez",
    );
  });

  it("sin paciente, o con el embed en null por RLS, no agrega nada", () => {
    expect(etiquetaDeMotivoDeMovimiento("baja", null)).toBe("Baja por vencimiento");
    expect(etiquetaDeMotivoDeMovimiento("entrega", {})).toBe(
      "Entrega o venta a paciente (sin consulta)",
    );
  });

  it("el texto libre se muestra tal cual", () => {
    expect(etiquetaDeMotivoDeMovimiento("COMP-56")).toBe("COMP-56");
  });

  it("sin motivo no dice nada", () => {
    expect(etiquetaDeMotivoDeMovimiento(null)).toBe("");
    expect(etiquetaDeMotivoDeMovimiento("")).toBe("");
  });
});
