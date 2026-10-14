// Pruebas de advertenciasDeCuadroTurnos(), la funcion pura de useCuadroTurnos.js. El hook en si
// no se prueba aca: vitest corre con environment "node", sin DOM, mismo motivo documentado en
// useAsignacionPersonal.test.js.
//
// Ningun dato real: las jornadas, comunidades y personas son inventadas.

import { describe, expect, it } from "vitest";

import { advertenciasDeCuadroTurnos } from "./useCuadroTurnos.js";

describe("advertenciasDeCuadroTurnos", () => {
  it("sin personal, no hay advertencias", () => {
    expect(advertenciasDeCuadroTurnos([], [], "j1")).toEqual({});
  });

  it("ignora filas sin perfilId", () => {
    expect(advertenciasDeCuadroTurnos([{ id: "fila-1" }], [], "j1")).toEqual({});
  });

  it("una persona sin choque ni traslape queda en {choque: null, traslape: null}", () => {
    const advertencias = advertenciasDeCuadroTurnos(
      [{ id: "fila-1", perfilId: "p1", horaInicio: "08:00:00", horaFin: "10:00:00" }],
      [],
      "j1",
    );

    expect(advertencias).toEqual({ p1: { choque: null, traslape: null } });
  });

  it("detecta el choque de dia completo (#182) sin traslape real de horas", () => {
    const advertencias = advertenciasDeCuadroTurnos(
      [{ id: "fila-1", perfilId: "p1", horaInicio: "08:00:00", horaFin: "10:00:00" }],
      [
        {
          jornadaId: "j2",
          jornadaNombre: "Jornada en Peten",
          perfil: "p1",
          horaInicio: "14:00:00",
          horaFin: "16:00:00",
        },
      ],
      "j1",
    );

    expect(advertencias.p1.choque).toContain("Jornada en Peten");
    expect(advertencias.p1.traslape).toBeNull();
  });

  it("detecta el traslape real de horas (#185) ademas del choque de dia completo", () => {
    const advertencias = advertenciasDeCuadroTurnos(
      [{ id: "fila-1", perfilId: "p1", horaInicio: "08:00:00", horaFin: "10:00:00" }],
      [
        {
          jornadaId: "j2",
          jornadaNombre: "Jornada en Peten",
          perfil: "p1",
          horaInicio: "09:00:00",
          horaFin: "11:00:00",
        },
      ],
      "j1",
    );

    expect(advertencias.p1.choque).toContain("Jornada en Peten");
    expect(advertencias.p1.traslape).toContain("se traslapa");
  });

  it("cada persona tiene su propia entrada, independiente de las demas", () => {
    const advertencias = advertenciasDeCuadroTurnos(
      [
        { id: "fila-1", perfilId: "p1", horaInicio: "08:00:00", horaFin: "10:00:00" },
        { id: "fila-2", perfilId: "p2", horaInicio: "08:00:00", horaFin: "10:00:00" },
      ],
      [
        {
          jornadaId: "j2",
          jornadaNombre: "Jornada en Peten",
          perfil: "p1",
          horaInicio: "09:00:00",
          horaFin: "11:00:00",
        },
      ],
      "j1",
    );

    expect(advertencias.p1.traslape).not.toBeNull();
    expect(advertencias.p2.choque).toBeNull();
    expect(advertencias.p2.traslape).toBeNull();
  });
});
