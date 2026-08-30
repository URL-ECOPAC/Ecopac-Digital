import { describe, expect, it } from "vitest";

import { CAMPOS_CONSULTA } from "./campos.js";
import { SECCIONES_CONSULTA, seccionesConCampos } from "./consultas.secciones.js";
import { aDatosDeConsulta, claveDeBorrador, hayBorradorConDatos } from "./useRegistroConsulta.js";

describe("seccionesConCampos", () => {
  it("cubre los ocho campos de CAMPOS_CONSULTA sin repetir ninguno", () => {
    const ids = seccionesConCampos().flatMap((seccion) => seccion.campos.map((campo) => campo.id));

    expect(ids).toHaveLength(CAMPOS_CONSULTA.length);
    expect(new Set(ids).size).toBe(CAMPOS_CONSULTA.length);
  });

  it("abre por el motivo de consulta, que es el unico obligatorio", () => {
    expect(SECCIONES_CONSULTA[0].campos[0]).toBe("motivoConsulta");
  });

  it("cada id declarado en una seccion existe en el descriptor", () => {
    for (const seccion of SECCIONES_CONSULTA) {
      for (const id of seccion.campos) {
        expect(CAMPOS_CONSULTA.some((campo) => campo.id === id)).toBe(true);
      }
    }
  });
});

describe("claveDeBorrador", () => {
  it("separa el borrador por atencion, no por paciente", () => {
    expect(claveDeBorrador("at-1")).not.toBe(claveDeBorrador("at-2"));
    expect(claveDeBorrador("at-1")).toContain("at-1");
  });
});

describe("hayBorradorConDatos", () => {
  it("un formulario recien abierto no genera borrador", () => {
    expect(hayBorradorConDatos({ motivoConsulta: "", antecedentes: "", diagnosticos: [] })).toBe(
      false,
    );
    expect(hayBorradorConDatos({})).toBe(false);
  });

  it("solo espacios tampoco cuenta como borrador", () => {
    expect(hayBorradorConDatos({ motivoConsulta: "   " })).toBe(false);
  });

  it("cualquier campo con texto o un diagnostico elegido si cuenta", () => {
    expect(hayBorradorConDatos({ motivoConsulta: "Dolor" })).toBe(true);
    expect(hayBorradorConDatos({ diagnosticos: ["d-1"] })).toBe(true);
  });
});

describe("aDatosDeConsulta", () => {
  const contexto = {
    expedienteId: "exp-1",
    atencionId: "at-1",
    medicoId: "perf-1",
    jornadaId: "jor-1",
  };

  it("traduce el formulario a lo que espera registrarConsulta", () => {
    const datos = aDatosDeConsulta({ motivoConsulta: "Dolor de cabeza" }, contexto);

    expect(datos.expediente).toBe("exp-1");
    expect(datos.atencion).toBe("at-1");
    expect(datos.medico).toBe("perf-1");
    expect(datos.jornada).toBe("jor-1");
    expect(datos.motivoConsulta).toBe("Dolor de cabeza");
  });

  it("manda null en vez de cadena vacia en los campos opcionales", () => {
    const datos = aDatosDeConsulta({ motivoConsulta: "X", antecedentes: "" }, contexto);

    expect(datos.antecedentes).toBeNull();
    expect(datos.planSeguimiento).toBeNull();
  });

  it("marca como principal el primer diagnostico elegido y solo ese", () => {
    const datos = aDatosDeConsulta(
      { motivoConsulta: "X", diagnosticos: ["d-1", "d-2", "d-3"] },
      contexto,
    );

    expect(datos.diagnosticos.map((uno) => uno.esPrincipal)).toEqual([true, false, false]);
    expect(datos.diagnosticos[0].diagnosticoId).toBe("d-1");
  });

  it("sin diagnosticos manda una lista vacia, no undefined", () => {
    expect(aDatosDeConsulta({ motivoConsulta: "X" }, contexto).diagnosticos).toEqual([]);
  });
});
