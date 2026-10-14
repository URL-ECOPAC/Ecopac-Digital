import { describe, expect, it } from "vitest";

import { hayDisponibilidad, motivoSinDisponibilidad } from "./existencias.validaciones.js";

const HOY = new Date("2026-06-15T10:30:00");
const VIGENTE = { fechaVencimiento: "2027-01-01" };
const VENCIDO = { fechaVencimiento: "2026-06-14" };

function entrada(cantidadDisponible, cantidadSolicitada, lote = VIGENTE) {
  return { lote, cantidadDisponible, cantidadSolicitada };
}

describe("hayDisponibilidad", () => {
  it("pedir menos de lo que hay es valido", () => {
    expect(hayDisponibilidad(entrada(100, 30), HOY)).toBe(true);
  });

  it("pedir exactamente lo que hay es valido: el lote queda en cero, no negativo", () => {
    expect(hayDisponibilidad(entrada(50, 50), HOY)).toBe(true);
  });

  it("pedir uno mas de lo que hay no es valido", () => {
    expect(hayDisponibilidad(entrada(50, 51), HOY)).toBe(false);
  });

  it("un lote vencido no es entregable aunque sobre existencia", () => {
    expect(hayDisponibilidad(entrada(999, 1, VENCIDO), HOY)).toBe(false);
  });

  it("no se puede sacar de un lote sin existencia", () => {
    expect(hayDisponibilidad(entrada(0, 1), HOY)).toBe(false);
  });

  it.each([
    ["cero", 0],
    ["negativa", -5],
    ["no numerica", "muchas"],
    ["ausente", undefined],
  ])("una cantidad solicitada %s no es valida", (_caso, solicitada) => {
    expect(hayDisponibilidad(entrada(100, solicitada), HOY)).toBe(false);
  });

  it.each([
    ["negativa", -1],
    ["no numerica", null],
  ])("una existencia %s no permite entregar", (_caso, disponible) => {
    expect(hayDisponibilidad(entrada(disponible, 1), HOY)).toBe(false);
  });

  it("sin argumentos no revienta y devuelve false", () => {
    expect(hayDisponibilidad()).toBe(false);
  });
});

describe("motivoSinDisponibilidad", () => {
  it("cuando alcanza, no hay motivo", () => {
    expect(motivoSinDisponibilidad(entrada(50, 50), HOY)).toBeNull();
  });

  it("cuando no alcanza, el mensaje dice cuanto hay realmente", () => {
    const motivo = motivoSinDisponibilidad(entrada(12, 30), HOY);

    expect(motivo).toContain("12");
    expect(motivo).toContain("30");
  });

  it("el vencimiento manda sobre la existencia", () => {
    const motivo = motivoSinDisponibilidad(entrada(999, 1, VENCIDO), HOY);

    expect(motivo).toContain("vencio");
  });

  it("una cantidad invalida se explica sin hablar de existencia", () => {
    const motivo = motivoSinDisponibilidad(entrada(100, 0), HOY);

    expect(motivo).toContain("mayor que cero");
  });

  it("coincide siempre con hayDisponibilidad", () => {
    const casos = [
      entrada(100, 30),
      entrada(50, 50),
      entrada(50, 51),
      entrada(0, 1),
      entrada(100, 0),
      entrada(999, 1, VENCIDO),
    ];

    for (const caso of casos) {
      expect(hayDisponibilidad(caso, HOY)).toBe(motivoSinDisponibilidad(caso, HOY) === null);
    }
  });
});
