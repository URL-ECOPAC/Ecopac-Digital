import { describe, expect, it } from "vitest";

import {
  CLAVE_ULTIMA_ACTIVIDAD,
  actividadMasReciente,
  haVencidoPorInactividad,
  olvidarUltimaActividad,
  segundosHastaElCierre,
} from "./useExpiracionPorInactividad.js";

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

describe("segundosHastaElCierre", () => {
  it("al registrar actividad quedan los minutos completos", () => {
    expect(segundosHastaElCierre(INICIO, INICIO, MINUTOS)).toBe(MINUTOS * 60);
  });

  it("a un minuto del limite quedan 60 segundos, que es cuando aparece el aviso", () => {
    const ahora = INICIO + (MINUTOS - 1) * MS_POR_MINUTO;
    expect(segundosHastaElCierre(INICIO, ahora, MINUTOS)).toBe(60);
  });

  it("redondea hacia arriba: a medio segundo del cierre todavia queda 1, no 0", () => {
    const ahora = INICIO + MINUTOS * MS_POR_MINUTO - 500;
    expect(segundosHastaElCierre(INICIO, ahora, MINUTOS)).toBe(1);
  });

  it("nunca es negativo", () => {
    const ahora = INICIO + (MINUTOS + 10) * MS_POR_MINUTO;
    expect(segundosHastaElCierre(INICIO, ahora, MINUTOS)).toBe(0);
  });
});

describe("actividadMasReciente", () => {
  const ahora = INICIO + 10 * MS_POR_MINUTO;

  it("la actividad de otra pestana, mas reciente, gana", () => {
    const otraPestana = INICIO + 5 * MS_POR_MINUTO;
    expect(actividadMasReciente(INICIO, String(otraPestana), ahora)).toBe(otraPestana);
  });

  it("una marca guardada mas vieja no hace retroceder la de esta pestana", () => {
    const vieja = INICIO - MS_POR_MINUTO;
    expect(actividadMasReciente(INICIO, String(vieja), ahora)).toBe(INICIO);
  });

  it("sin marca, o con una ilegible, queda la que ya habia", () => {
    expect(actividadMasReciente(INICIO, null, ahora)).toBe(INICIO);
    expect(actividadMasReciente(INICIO, "", ahora)).toBe(INICIO);
    expect(actividadMasReciente(INICIO, "no-es-un-numero", ahora)).toBe(INICIO);
  });

  it("una marca del futuro (un reloj movido) no cuenta: mantendria la sesion abierta para siempre", () => {
    expect(actividadMasReciente(INICIO, String(ahora + MS_POR_MINUTO), ahora)).toBe(INICIO);
  });
});

describe("olvidarUltimaActividad", () => {
  it("borra la marca guardada", () => {
    const guardado = new Map([[CLAVE_ULTIMA_ACTIVIDAD, "123"]]);
    olvidarUltimaActividad({ removeItem: (clave) => guardado.delete(clave) });
    expect(guardado.has(CLAVE_ULTIMA_ACTIVIDAD)).toBe(false);
  });

  it("un almacenamiento que lanza no rompe el inicio de sesion", () => {
    expect(() =>
      olvidarUltimaActividad({
        removeItem: () => {
          throw new Error("bloqueado");
        },
      }),
    ).not.toThrow();
    expect(() => olvidarUltimaActividad(undefined)).not.toThrow();
  });
});
