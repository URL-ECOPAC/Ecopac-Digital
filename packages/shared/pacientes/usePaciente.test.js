// Pruebas de usePaciente. No se monta el hook: packages/shared corre vitest con environment
// "node", sin DOM. Por eso lo que se prueba es combinarPaciente(), la funcion exportada que
// arma el objeto final -- mismo criterio que usePacientesListado.test.js.

import { describe, expect, it } from "vitest";

import { combinarPaciente } from "./usePaciente.js";

describe("combinarPaciente", () => {
  it("agrega la ultima atencion al paciente encontrado", () => {
    const respuestaPaciente = {
      paciente: { id: "pac-1", nombres: "Juana", expediente: { numeroFicha: "F-001" } },
      error: null,
    };
    const respuestaUltimaAtencion = {
      ultimaAtencion: { tipo: "consulta", fecha: "2026-06-15T10:00:00Z" },
      error: null,
    };

    const { paciente, error } = combinarPaciente(respuestaPaciente, respuestaUltimaAtencion);

    expect(error).toBeNull();
    expect(paciente.id).toBe("pac-1");
    expect(paciente.expediente.numeroFicha).toBe("F-001");
    expect(paciente.ultimaAtencion).toEqual({ tipo: "consulta", fecha: "2026-06-15T10:00:00Z" });
  });

  it("un paciente sin atenciones queda con ultimaAtencion en null", () => {
    const respuestaPaciente = { paciente: { id: "pac-1" }, error: null };
    const respuestaUltimaAtencion = { ultimaAtencion: null, error: null };

    const { paciente } = combinarPaciente(respuestaPaciente, respuestaUltimaAtencion);

    expect(paciente.ultimaAtencion).toBeNull();
  });

  it("un paciente no encontrado propaga el error sin tocar la ultima atencion", () => {
    const respuestaPaciente = { paciente: null, error: { codigo: "no_encontrado" } };
    const respuestaUltimaAtencion = { ultimaAtencion: null, error: null };

    const { paciente, error } = combinarPaciente(respuestaPaciente, respuestaUltimaAtencion);

    expect(paciente).toBeNull();
    expect(error).toEqual({ codigo: "no_encontrado" });
  });
});
