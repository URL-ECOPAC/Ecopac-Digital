// Prueba de la logica pura del hook de alertas de vencimiento.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). calcularDiasRestantes() se exporta aparte del hook (issue #694) porque
// antes calculaba con new Date(fechaVencimiento) - new Date() en milisegundos: interpretaba una
// cadena AAAA-MM-DD como medianoche UTC (un dia adelantado en Guatemala, UTC-6) y comparaba
// contra el instante actual en vez del dia de calendario. Un lote que vence exactamente hoy
// salia con dias negativos, es decir VENCIDO.

import { describe, expect, it } from "vitest";

import { calcularDiasRestantes } from "./useAlertasVencimiento.js";

/** "AAAA-MM-DD" del dia de calendario LOCAL de hoy (no UTC: toISOString() se corre de dia). */
function hoyComoTexto() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

describe("calcularDiasRestantes", () => {
  it("un lote que vence exactamente hoy da 0 dias, no negativo", () => {
    expect(calcularDiasRestantes(hoyComoTexto())).toBe(0);
  });

  it("un lote sin fecha de vencimiento no calcula nada", () => {
    expect(calcularDiasRestantes(null)).toBeNull();
    expect(calcularDiasRestantes("")).toBeNull();
  });

  it("invalida un lote cuya fecha de vencimiento es anterior a su fecha de ingreso", () => {
    expect(calcularDiasRestantes("2026-01-01", "2026-06-01")).toBeNull();
  });

  it("acepta un lote cuya fecha de vencimiento coincide con la de ingreso", () => {
    expect(calcularDiasRestantes("2026-06-01", "2026-06-01")).not.toBeNull();
  });
});
