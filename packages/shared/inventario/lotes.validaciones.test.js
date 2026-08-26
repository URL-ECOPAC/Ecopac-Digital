import { describe, expect, it } from "vitest";

import { esLoteEntregable, motivoLoteNoEntregable } from "./lotes.validaciones.js";

const HOY = new Date("2026-06-15T10:30:00");

function lote(fechaVencimiento) {
  return { fechaVencimiento };
}

describe("esLoteEntregable", () => {
  it("un lote que vence hoy si es entregable", () => {
    expect(esLoteEntregable(lote("2026-06-15"), HOY)).toBe(true);
  });

  it("un lote que vencio ayer no es entregable", () => {
    expect(esLoteEntregable(lote("2026-06-14"), HOY)).toBe(false);
  });

  it("un lote que vence manana es entregable", () => {
    expect(esLoteEntregable(lote("2026-06-16"), HOY)).toBe(true);
  });

  it("la hora del dia no mueve el corte", () => {
    const casiMedianoche = new Date("2026-06-15T23:59:59");
    expect(esLoteEntregable(lote("2026-06-15"), casiMedianoche)).toBe(true);
  });

  it.each([
    ["un ano por delante", "2027-06-15", true],
    ["un ano atras", "2025-06-15", false],
  ])("%s -> %s", (_caso, fecha, esperado) => {
    expect(esLoteEntregable(lote(fecha), HOY)).toBe(esperado);
  });

  it.each([
    ["sin lote", undefined],
    ["lote nulo", null],
    ["sin fecha", {}],
    ["fecha vacia", { fechaVencimiento: "" }],
    ["fecha invalida", { fechaVencimiento: "no es fecha" }],
  ])("%s no es entregable: ante la duda no se entrega", (_caso, valor) => {
    expect(esLoteEntregable(valor, HOY)).toBe(false);
  });

  it("acepta tambien la fila cruda de la base, en snake_case", () => {
    expect(esLoteEntregable({ fecha_vencimiento: "2026-06-16" }, HOY)).toBe(true);
    expect(esLoteEntregable({ fecha_vencimiento: "2026-06-14" }, HOY)).toBe(false);
  });
});

describe("motivoLoteNoEntregable", () => {
  it("un lote vigente no tiene motivo", () => {
    expect(motivoLoteNoEntregable(lote("2026-06-15"), HOY)).toBeNull();
  });

  it("un lote vencido explica la fecha en que vencio", () => {
    const motivo = motivoLoteNoEntregable(lote("2026-06-14"), HOY);

    expect(motivo).toContain("vencio");
    expect(motivo).toMatch(/14/);
  });

  it("un lote sin fecha legible lo dice sin inventarse una fecha", () => {
    const motivo = motivoLoteNoEntregable({}, HOY);

    expect(motivo).toContain("fecha de vencimiento");
    expect(motivo).not.toMatch(/\d{4}/);
  });

  it("coincide siempre con esLoteEntregable", () => {
    for (const fecha of ["2026-06-13", "2026-06-14", "2026-06-15", "2026-06-16"]) {
      const entregable = esLoteEntregable(lote(fecha), HOY);
      const motivo = motivoLoteNoEntregable(lote(fecha), HOY);

      expect(entregable).toBe(motivo === null);
    }
  });
});

import { describe, it, expect } from "vitest";
import { sugerirLote } from "./lotes.validaciones.js";

describe("sugerirLote (Criterio FEFO)", () => {
  const lotesEjemplo = [
    { id: "LOTE-C", fecha_vencimiento: "2026-12-01", cantidad_disponible: 50 },
    { id: "LOTE-A", fecha_vencimiento: "2026-09-15", cantidad_disponible: 20 },
    { id: "LOTE-B", fecha_vencimiento: "2026-10-20", cantidad_disponible: 30 },
    { id: "LOTE-VENCIDO", fecha_vencimiento: "2026-01-01", cantidad_disponible: 100 },
  ];

  it("devuelve el lote no vencido con la fecha de vencimiento más próxima y existencia suficiente", () => {
    const resultado = sugerirLote(lotesEjemplo, 15, "2026-08-26");

    expect(resultado.suficiente).toBe(true);
    expect(resultado.lotesSugeridos).toHaveLength(1);
    expect(resultado.lotesSugeridos[0].lote_id).toBe("LOTE-A");
    expect(resultado.lotesSugeridos[0].cantidad).toBe(15);
  });

  it("sugiere la combinación de lotes necesaria si ningún lote individual alcanza", () => {
    const resultado = sugerirLote(lotesEjemplo, 40, "2026-08-26");

    expect(resultado.suficiente).toBe(true);
    expect(resultado.lotesSugeridos).toHaveLength(2);
    expect(resultado.lotesSugeridos[0]).toEqual({
      lote_id: "LOTE-A",
      cantidad: 20,
      fecha_vencimiento: "2026-09-15",
    });
    expect(resultado.lotesSugeridos[1]).toEqual({
      lote_id: "LOTE-B",
      cantidad: 20,
      fecha_vencimiento: "2026-10-20",
    });
  });

  it("ignora los lotes vencidos", () => {
    const resultado = sugerirLote(lotesEjemplo, 10, "2026-08-26");

    const contieneVencido = resultado.lotesSugeridos.some((l) => l.lote_id === "LOTE-VENCIDO");
    expect(contieneVencido).toBe(false);
  });

  it("indica falta de stock si la demanda supera la suma de lotes válidos", () => {
    const resultado = sugerirLote(lotesEjemplo, 200, "2026-08-26");

    expect(resultado.suficiente).toBe(false);
    expect(resultado.cantidadFaltante).toBe(100);
  });
});