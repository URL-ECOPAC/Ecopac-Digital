import { describe, expect, it } from "vitest";

import { haVencidoPorInactividad } from "./useExpiracionPorInactividad.js";

const MINUTOS = 30;
const MS_POR_MINUTO = 60 * 1000;
const INICIO = Date.parse("2026-01-01T00:00:00Z");

describe("haVencidoPorInactividad", () => {
  it("no vence si no ha pasado el limite", () => {
    const ahora = INICIO + (MINUTOS - 1) * MS_POR_MINUTO;
    expect(haVencidoPorInactividad(INICIO, ahora, MINUTOS)).toBe(false);
  });

  it("vence justo al cumplirse el limite", () => {
    const ahora = INICIO + MINUTOS * MS_POR_MINUTO;
    expect(haVencidoPorInactividad(INICIO, ahora, MINUTOS)).toBe(true);
  });

  it("vence si ya paso mas tiempo que el limite", () => {
    const ahora = INICIO + (MINUTOS + 5) * MS_POR_MINUTO;
    expect(haVencidoPorInactividad(INICIO, ahora, MINUTOS)).toBe(true);
  });

  it("no vence en el instante mismo de la actividad", () => {
    expect(haVencidoPorInactividad(INICIO, INICIO, MINUTOS)).toBe(false);
  });
});
