// Prueba de CAMPOS_FORMULARIO_JORNADA (issue #179) y CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL
// (issue #182).

import { describe, expect, it } from "vitest";

import {
  CAMPOS_ASIGNACION_PERSONAL,
  CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL,
  CAMPOS_EDICION_TURNO,
  CAMPOS_FORMULARIO_JORNADA,
  CAMPOS_JORNADA,
  CAMPOS_MARCAR_ASISTENCIA,
} from "./campos.js";

describe("CAMPOS_FORMULARIO_JORNADA", () => {
  it("son los cinco campos confirmados en la revision del plan mas cupoEstimado y botiquinBodega (issue #756)", () => {
    expect(CAMPOS_FORMULARIO_JORNADA.map((campo) => campo.id)).toEqual([
      "nombre",
      "fecha",
      "comunidad",
      "responsable",
      "proyecto",
      "cupoEstimado",
      "botiquinBodega",
    ]);
  });

  it("no incluye codigo ni presupuestoAsignado", () => {
    const idsExcluidos = ["codigo", "presupuestoAsignado"];
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

// Issue #756: asistio se marcaba y se mostraba, pero ninguna pantalla lo escribia.
// CAMPOS_EDICION_TURNO ahora lo agrega, en el mismo modal que horario y responsabilidad.
describe("CAMPOS_EDICION_TURNO", () => {
  // Issue #840 (B1): los campos de la asignacion, mas asistio.
  it("son los de la asignacion, en su orden, mas asistio", () => {
    expect(CAMPOS_EDICION_TURNO.map((campo) => campo.id)).toEqual([
      "perfil",
      "rolEnJornada",
      "horaInicio",
      "horaFin",
      "responsabilidad",
      "asistio",
    ]);
  });

  it("asistio es el mismo objeto de CAMPOS_MARCAR_ASISTENCIA, no una copia", () => {
    const asistio = CAMPOS_EDICION_TURNO.find((campo) => campo.id === "asistio");
    expect(asistio).toBe(CAMPOS_MARCAR_ASISTENCIA[0]);
  });

  it("perfil y rolEnJornada se ven, pero de solo lectura", () => {
    expect(
      CAMPOS_EDICION_TURNO.filter((campo) => campo.soloLectura).map((campo) => campo.id),
    ).toEqual(["perfil", "rolEnJornada"]);
  });
});

describe("CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL", () => {
  it("no incluye el campo perfil: se elige por busqueda, no por select (issue #182)", () => {
    expect(CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL.some((campo) => campo.id === "perfil")).toBe(
      false,
    );
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
