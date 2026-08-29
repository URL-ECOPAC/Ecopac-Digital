import { describe, expect, it } from "vitest";

import { CAMPOS_REGISTRO_PACIENTE } from "./campos.js";
import { advertirPacienteDuplicado } from "./validaciones.js";

const EXISTENTE = {
  id: "p-1",
  nombres: "María",
  apellidos: "Chun Tzoc",
  fechaNacimiento: "1990-03-15",
  numeroFicha: "EXP-000042",
};

describe("advertirPacienteDuplicado", () => {
  it("avisa cuando coinciden nombre y fecha de nacimiento", () => {
    const aviso = advertirPacienteDuplicado({
      pacientes: [EXISTENTE],
      nombres: "María",
      apellidos: "Chun Tzoc",
      fechaNacimiento: "1990-03-15",
    });

    expect(aviso).toContain("EXP-000042");
  });

  it("ignora acentos, mayusculas y espacios de mas", () => {
    const aviso = advertirPacienteDuplicado({
      pacientes: [EXISTENTE],
      nombres: "  maria ",
      apellidos: "CHUN   TZOC",
      fechaNacimiento: "1990-03-15",
    });

    expect(aviso).toBeTruthy();
  });

  it("no avisa si la fecha de nacimiento difiere", () => {
    expect(
      advertirPacienteDuplicado({
        pacientes: [EXISTENTE],
        nombres: "María",
        apellidos: "Chun Tzoc",
        fechaNacimiento: "1991-03-15",
      }),
    ).toBeNull();
  });

  it("no avisa si el nombre difiere", () => {
    expect(
      advertirPacienteDuplicado({
        pacientes: [EXISTENTE],
        nombres: "Ana",
        apellidos: "Chun Tzoc",
        fechaNacimiento: "1990-03-15",
      }),
    ).toBeNull();
  });

  it("no avisa mientras falte la fecha de nacimiento o el nombre", () => {
    expect(
      advertirPacienteDuplicado({ pacientes: [EXISTENTE], nombres: "María", apellidos: "Chun Tzoc" }),
    ).toBeNull();
    expect(
      advertirPacienteDuplicado({ pacientes: [EXISTENTE], fechaNacimiento: "1990-03-15" }),
    ).toBeNull();
  });

  it("tolera una lista vacia o ausente", () => {
    const argumentos = { nombres: "María", apellidos: "Chun Tzoc", fechaNacimiento: "1990-03-15" };
    expect(advertirPacienteDuplicado({ ...argumentos, pacientes: [] })).toBeNull();
    expect(advertirPacienteDuplicado(argumentos)).toBeNull();
  });

  it("nombra las fichas de varias coincidencias", () => {
    const aviso = advertirPacienteDuplicado({
      pacientes: [EXISTENTE, { ...EXISTENTE, id: "p-2", numeroFicha: "EXP-000077" }],
      nombres: "María",
      apellidos: "Chun Tzoc",
      fechaNacimiento: "1990-03-15",
    });

    expect(aviso).toContain("EXP-000042");
    expect(aviso).toContain("EXP-000077");
  });

  it("resuelve la ficha tambien cuando viene embebida en el expediente", () => {
    const aviso = advertirPacienteDuplicado({
      pacientes: [
        {
          nombres: "María",
          apellidos: "Chun Tzoc",
          fechaNacimiento: "1990-03-15",
          expediente: { numeroFicha: "EXP-000099" },
        },
      ],
      nombres: "María",
      apellidos: "Chun Tzoc",
      fechaNacimiento: "1990-03-15",
    });

    expect(aviso).toContain("EXP-000099");
  });
});

describe("CAMPOS_REGISTRO_PACIENTE", () => {
  it("no pide el numero de ficha: lo genera fn_registrar_paciente", () => {
    expect(CAMPOS_REGISTRO_PACIENTE.some((campo) => campo.id === "numeroFicha")).toBe(false);
  });

  it("abre por la identidad del paciente, como la ficha de papel", () => {
    expect(CAMPOS_REGISTRO_PACIENTE.slice(0, 4).map((campo) => campo.id)).toEqual([
      "nombres",
      "apellidos",
      "fechaNacimiento",
      "sexo",
    ]);
  });

  it("declara comunidad con catalogo, que es lo que alimenta la cascada", () => {
    const comunidad = CAMPOS_REGISTRO_PACIENTE.find((campo) => campo.id === "comunidad");
    expect(comunidad.opcionesDesde).toBe("comunidades");
  });
});
