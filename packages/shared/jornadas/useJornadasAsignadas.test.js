// Pruebas de separarProximasYPasadas(), la funcion pura de useJornadasAsignadas.js. El hook en
// si no se prueba aca: vitest corre con environment "node", mismo motivo documentado en
// useAsignacionPersonal.test.js.

import { describe, expect, it } from "vitest";

import { separarProximasYPasadas } from "./useJornadasAsignadas.js";
import { ESTADOS_JORNADA } from "../enums.js";

const HOY = new Date(2026, 7, 31, 15, 30); // 31 de agosto de 2026, 15:30 (hora incluida a proposito)

function jornada(id, estado, fecha) {
  return { id, estado, fecha };
}

describe("separarProximasYPasadas", () => {
  it("una jornada en curso siempre es proxima, sin importar su fecha", () => {
    const { proximas, pasadas } = separarProximasYPasadas(
      [jornada("j1", ESTADOS_JORNADA.EN_CURSO, "2026-01-01")],
      HOY,
    );

    expect(proximas.map((j) => j.id)).toEqual(["j1"]);
    expect(pasadas).toEqual([]);
  });

  it("la jornada de HOY es proxima, no pasada, aunque `hoy` traiga una hora avanzada", () => {
    const { proximas, pasadas } = separarProximasYPasadas(
      [jornada("j1", ESTADOS_JORNADA.PLANIFICADA, "2026-08-31")],
      HOY,
    );

    expect(proximas.map((j) => j.id)).toEqual(["j1"]);
    expect(pasadas).toEqual([]);
  });

  it("una fecha futura es proxima, una fecha pasada es pasada", () => {
    const { proximas, pasadas } = separarProximasYPasadas(
      [
        jornada("futura", ESTADOS_JORNADA.PLANIFICADA, "2026-09-15"),
        jornada("pasada", ESTADOS_JORNADA.FINALIZADA, "2026-08-01"),
      ],
      HOY,
    );

    expect(proximas.map((j) => j.id)).toEqual(["futura"]);
    expect(pasadas.map((j) => j.id)).toEqual(["pasada"]);
  });

  it("sin jornadas no lanza y devuelve listas vacias", () => {
    expect(separarProximasYPasadas([], HOY)).toEqual({ proximas: [], pasadas: [] });
    expect(separarProximasYPasadas(undefined, HOY)).toEqual({ proximas: [], pasadas: [] });
  });

  it("una fecha invalida no rompe la separacion: queda como proxima por defecto", () => {
    const { proximas, pasadas } = separarProximasYPasadas(
      [jornada("j1", ESTADOS_JORNADA.PLANIFICADA, null)],
      HOY,
    );

    expect(proximas.map((j) => j.id)).toEqual(["j1"]);
    expect(pasadas).toEqual([]);
  });

  // Correccion 4 de PLAN.md: el estado se mira antes que la fecha, no al reves. Una version
  // anterior de esta funcion usaba `EN_CURSO o fecha >= hoy`, que metia en "proximas" una
  // jornada FINALIZADA con fecha de hoy y una CANCELADA con fecha futura.
  it("una jornada FINALIZADA con fecha de HOY es pasada, no proxima", () => {
    const { proximas, pasadas } = separarProximasYPasadas(
      [jornada("j1", ESTADOS_JORNADA.FINALIZADA, "2026-08-31")],
      HOY,
    );

    expect(proximas).toEqual([]);
    expect(pasadas.map((j) => j.id)).toEqual(["j1"]);
  });

  it("una jornada CANCELADA con fecha futura es pasada, no proxima: nunca va a ocurrir", () => {
    const { proximas, pasadas } = separarProximasYPasadas(
      [jornada("j1", ESTADOS_JORNADA.CANCELADA, "2026-12-25")],
      HOY,
    );

    expect(proximas).toEqual([]);
    expect(pasadas.map((j) => j.id)).toEqual(["j1"]);
  });

  it("una CANCELADA no desaparece: sigue apareciendo, solo que en pasadas", () => {
    const { proximas, pasadas } = separarProximasYPasadas(
      [jornada("j1", ESTADOS_JORNADA.CANCELADA, "2026-01-01")],
      HOY,
    );

    expect([...proximas, ...pasadas].map((j) => j.id)).toEqual(["j1"]);
  });

  it("una PLANIFICADA vencida (fecha pasada, nadie actualizo el estado) es pasada", () => {
    const { proximas, pasadas } = separarProximasYPasadas(
      [jornada("j1", ESTADOS_JORNADA.PLANIFICADA, "2026-01-01")],
      HOY,
    );

    expect(proximas).toEqual([]);
    expect(pasadas.map((j) => j.id)).toEqual(["j1"]);
  });
});
