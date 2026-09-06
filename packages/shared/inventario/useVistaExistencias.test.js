// Prueba de la logica pura de estados de vencimiento de useVistaExistencias.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). Antes calcularDiasRestantes() calculaba con new Date(fechaCaducidad) y
// new Date(), normalizadas con setHours(0,0,0,0): new Date("AAAA-MM-DD") interpreta la cadena
// como medianoche UTC, que en Guatemala (UTC-6) cae en la tarde del dia anterior, asi que
// setHours(0,0,0,0) la llevaba a la medianoche local de un dia antes. Un lote que vencia hoy
// salia con diasRestantes = -1 y estado VENCIDO, aunque la cabecera del archivo prometiera que
// vencer hoy es DISPONIBLE.

import { describe, expect, it } from "vitest";

import {
  calcularDiasRestantes,
  calcularEstadoVencimiento,
  ESTADO_EXISTENCIA,
} from "./useVistaExistencias.js";

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

  it("sin fecha de caducidad no calcula nada", () => {
    expect(calcularDiasRestantes(null)).toBeNull();
  });
});

describe("calcularEstadoVencimiento", () => {
  it("un lote que vence exactamente hoy, con stock, es DISPONIBLE (no VENCIDO)", () => {
    expect(calcularEstadoVencimiento(hoyComoTexto(), 10)).toBe(ESTADO_EXISTENCIA.DISPONIBLE);
  });

  it("sin stock es SIN_STOCK sin importar la fecha", () => {
    expect(calcularEstadoVencimiento(hoyComoTexto(), 0)).toBe(ESTADO_EXISTENCIA.SIN_STOCK);
  });
});
