import { describe, expect, it } from "vitest";

import { mensajeSinJornada } from "./useSeleccionJornada.js";
import { ESTADOS_JORNADA } from "../enums.js";

function jornada(id, estado) {
  return { id, estado };
}

describe("mensajeSinJornada", () => {
  it("no hay mensaje cuando hay al menos una jornada en curso", () => {
    const enCurso = [jornada("J1", ESTADOS_JORNADA.EN_CURSO)];
    expect(mensajeSinJornada(enCurso, enCurso)).toBeNull();
  });

  it("distingue 'sin ninguna asignacion' de 'asignada pero no en curso'", () => {
    const sinAsignacion = mensajeSinJornada([], []);
    const asignadaSinEnCurso = mensajeSinJornada([jornada("J1", ESTADOS_JORNADA.PLANIFICADA)], []);

    expect(sinAsignacion).toMatch(/no estas asignada/i);
    expect(asignadaSinEnCurso).toMatch(/ninguna esta en curso/i);
    expect(sinAsignacion).not.toBe(asignadaSinEnCurso);
  });

  it("sin argumentos no lanza", () => {
    expect(() => mensajeSinJornada()).not.toThrow();
    expect(mensajeSinJornada()).toMatch(/no estas asignada/i);
  });
});
