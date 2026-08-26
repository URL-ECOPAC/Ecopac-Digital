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
