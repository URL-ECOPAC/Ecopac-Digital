// Prueba de CAMPOS_FORMULARIO_JORNADA (issue #179) y CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL
// (issue #182).

import { describe, expect, it } from "vitest";

import {
  CAMPOS_ASIGNACION_PERSONAL,
  CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL,
  CAMPOS_FORMULARIO_JORNADA,
  CAMPOS_JORNADA,
} from "./campos.js";

describe("CAMPOS_FORMULARIO_JORNADA", () => {
  it("son exactamente los cinco campos confirmados en la revision del plan", () => {
    expect(CAMPOS_FORMULARIO_JORNADA.map((campo) => campo.id)).toEqual([
      "nombre",
      "fecha",
      "comunidad",
      "responsable",
      "proyecto",
    ]);
  });

  it("no incluye codigo, cupoEstimado, presupuestoAsignado ni botiquinBodega", () => {
    const idsExcluidos = ["codigo", "cupoEstimado", "presupuestoAsignado", "botiquinBodega"];
    for (const id of idsExcluidos) {
      expect(CAMPOS_FORMULARIO_JORNADA.find((campo) => campo.id === id)).toBeUndefined();
    }
  });

  it("no incluye observaciones: la columna no existe en la tabla jornadas", () => {
    expect(CAMPOS_FORMULARIO_JORNADA.find((campo) => campo.id === "observaciones")).toBeUndefined();
  });

  it("cada campo es el mismo objeto de CAMPOS_JORNADA, no una copia", () => {
    for (const campo of CAMPOS_FORMULARIO_JORNADA) {
      const original = CAMPOS_JORNADA.find((c) => c.id === campo.id);
      expect(campo).toBe(original);
    }
  });
});

describe("CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL", () => {
  it("no incluye el campo perfil: se elige por busqueda, no por select (issue #182)", () => {
    expect(CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL.some((campo) => campo.id === "perfil")).toBe(false);
  });

  it("conserva el resto de los campos del formulario, en el mismo orden", () => {
    expect(CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL.map((campo) => campo.id)).toEqual([
      "rolEnJornada",
      "horaInicio",
      "horaFin",
      "responsabilidad",
    ]);
  });

  it("cada campo es el mismo objeto de CAMPOS_ASIGNACION_PERSONAL, no una copia", () => {
    for (const campo of CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL) {
      const original = CAMPOS_ASIGNACION_PERSONAL.find((c) => c.id === campo.id);
      expect(campo).toBe(original);
    }
  });
});
