// Pruebas de la logica pura del panel de indicadores de impacto (issue #695).
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). resolverRangoDeDashboard() y calcularVariacion() son las dos funciones
// exportadas aparte del hook, pura y sin estado, que la issue #695 senalaba: el rango debia
// calcularse como dia de calendario local (sin toISOString(), que usa UTC) y la convencion de
// variacion() cuando el periodo anterior es 0 debia quedar documentada y probada.

import { describe, expect, it } from "vitest";

import { resolverRangoDeDashboard, calcularVariacion } from "./useDashboardMetricas.js";

describe("resolverRangoDeDashboard", () => {
  it("un rango personalizado devuelve las fechas tal cual, sin tocarlas", () => {
    const resultado = resolverRangoDeDashboard(
      "personalizado",
      { fechaInicio: "2026-01-01", fechaFin: "2026-01-31" },
      new Date(2026, 5, 15),
    );

    expect(resultado).toEqual({ fechaInicio: "2026-01-01", fechaFin: "2026-01-31" });
  });

  it("la ultima semana usa el dia de calendario local de hoy, no su version UTC", () => {
    // 23:30 hora local: toISOString() de este instante cae ya en el dia siguiente en UTC.
    // Antes de la #693/#695, un rango calculado con toISOString() habria devuelto fechaFin con
    // un dia de mas a esta hora.
    const hoy = new Date(2026, 5, 15, 23, 30);
    const resultado = resolverRangoDeDashboard("semana", {}, hoy);

    expect(resultado.fechaFin).toBe("2026-06-15");
    expect(resultado.fechaInicio).toBe("2026-06-08");
  });

  it("el ultimo anio retrocede exactamente un anio calendario", () => {
    const hoy = new Date(2026, 0, 10);
    const resultado = resolverRangoDeDashboard("anio", {}, hoy);

    expect(resultado).toEqual({ fechaInicio: "2025-01-10", fechaFin: "2026-01-10" });
  });
});

describe("calcularVariacion", () => {
  it("de un periodo anterior en cero a un actual positivo, la variacion es 100", () => {
    expect(calcularVariacion(5, 0)).toBe(100);
  });

  it("de cero a cero, la variacion es 0, no 100: no hubo cambio real", () => {
    expect(calcularVariacion(0, 0)).toBe(0);
  });

  it("calcula el porcentaje normal cuando el periodo anterior no es cero", () => {
    expect(calcularVariacion(150, 100)).toBe(50);
    expect(calcularVariacion(50, 100)).toBe(-50);
  });
});
