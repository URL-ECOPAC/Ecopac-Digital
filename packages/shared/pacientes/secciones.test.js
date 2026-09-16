// Que el agrupamiento del formulario de paciente cubra TODOS los campos, exactamente una vez.
//
// Es lo unico que puede salir mal aqui y no se ve: un campo que se cae de la lista desaparece
// del formulario sin ningun error -la pantalla dibuja las secciones, no CAMPOS_REGISTRO_PACIENTE-
// y quien registra se queda sin poder capturar un dato, igual que pasaba con los cuatro signos
// vitales que SERIES_DE_SIGNOS no declaraba.

import { describe, expect, it } from "vitest";

import { CAMPOS_REGISTRO_PACIENTE, SECCIONES_PACIENTE, seccionesDePaciente } from "./campos.js";

const IDS_AGRUPADOS = SECCIONES_PACIENTE.flatMap((seccion) => seccion.campos);

describe("SECCIONES_PACIENTE", () => {
  it("cubre todos los campos del formulario de registro", () => {
    for (const campo of CAMPOS_REGISTRO_PACIENTE) {
      expect(IDS_AGRUPADOS, `"${campo.id}" no esta en ninguna seccion`).toContain(campo.id);
    }
  });

  it("no repite ningun campo en dos secciones", () => {
    expect(new Set(IDS_AGRUPADOS).size).toBe(IDS_AGRUPADOS.length);
  });

  it("no nombra ningun campo que no exista", () => {
    const existentes = new Set(CAMPOS_REGISTRO_PACIENTE.map((campo) => campo.id));
    for (const id of IDS_AGRUPADOS) {
      expect(existentes, `"${id}" no existe en CAMPOS_REGISTRO_PACIENTE`).toContain(id);
    }
  });
});

describe("seccionesDePaciente", () => {
  it("resuelve cada id a su descriptor completo, sin repetir etiqueta ni tipo", () => {
    const secciones = seccionesDePaciente();
    const identificacion = secciones.find((seccion) => seccion.id === "identificacion");

    expect(identificacion.campos[0]).toMatchObject({ id: "nombres", label: "Nombres" });
    expect(identificacion.campos[1]).toMatchObject({ id: "apellidos", label: "Apellidos" });
  });

  it("entrega tantos campos como declara el agrupamiento", () => {
    const total = seccionesDePaciente().reduce((suma, seccion) => suma + seccion.campos.length, 0);
    expect(total).toBe(CAMPOS_REGISTRO_PACIENTE.length);
  });
});
