import { describe, expect, it } from "vitest";

import { CAMPOS_REGISTRO_PACIENTE } from "./campos.js";
import {
  CAMPOS_EDICION_PACIENTE,
  hayCambiosPendientes,
  valoresDesdePaciente,
} from "./useEdicionPaciente.js";

const PACIENTE = {
  id: "p-1",
  nombres: "Maria",
  apellidos: "Chun Tzoc",
  fechaNacimiento: "1990-03-15",
  sexo: "Femenino",
  comunidadId: "com-7",
  comunidad: { nombre: "Chuicutama" },
  telefonoContacto: "50001111",
  idioma: "quiche",
  dpi: "1234567890101",
  tipoSangre: "O+",
  nombreResponsable: "Juana Chun",
  parentescoResponsable: "madre",
};

describe("CAMPOS_EDICION_PACIENTE", () => {
  it("no incluye el numero de ficha", () => {
    expect(CAMPOS_EDICION_PACIENTE.some((campo) => campo.id === "numeroFicha")).toBe(false);
  });

  it("cubre todos los datos personales del registro", () => {
    expect(CAMPOS_EDICION_PACIENTE.map((campo) => campo.id)).toEqual(
      CAMPOS_REGISTRO_PACIENTE.map((campo) => campo.id),
    );
  });

  it("declara sexo como select para no repetir el desajuste de valores de la #534", () => {
    const sexo = CAMPOS_EDICION_PACIENTE.find((campo) => campo.id === "sexo");
    expect(sexo.tipo).toBe("select");
    expect(sexo.opcionesDesde).toBe("sexo");
  });
});

describe("valoresDesdePaciente", () => {
  it("precarga cada campo del descriptor", () => {
    const valores = valoresDesdePaciente(PACIENTE);

    for (const campo of CAMPOS_EDICION_PACIENTE) {
      expect(valores).toHaveProperty(campo.id);
    }
    expect(valores.nombres).toBe("Maria");
    expect(valores.tipoSangre).toBe("O+");
  });

  it("toma el id de la comunidad, no su nombre", () => {
    expect(valoresDesdePaciente(PACIENTE).comunidad).toBe("com-7");
  });

  it("deja cadena vacia donde el paciente no trae dato", () => {
    const valores = valoresDesdePaciente({ id: "p-2", nombres: "Ana" });

    expect(valores.nombres).toBe("Ana");
    expect(valores.dpi).toBe("");
    expect(valores.comunidad).toBe("");
  });

  it("no falla si no hay paciente", () => {
    expect(valoresDesdePaciente(null).nombres).toBe("");
  });
});

describe("hayCambiosPendientes", () => {
  const iniciales = valoresDesdePaciente(PACIENTE);

  it("es falso cuando nada se toco", () => {
    expect(hayCambiosPendientes({ ...iniciales }, iniciales)).toBe(false);
  });

  it("es verdadero al cambiar un campo", () => {
    expect(hayCambiosPendientes({ ...iniciales, nombres: "Maria Jose" }, iniciales)).toBe(true);
  });

  it("detecta que se vacio un campo que tenia valor", () => {
    expect(hayCambiosPendientes({ ...iniciales, dpi: "" }, iniciales)).toBe(true);
  });

  it("vuelve a falso si el valor regresa al original", () => {
    const tocado = { ...iniciales, nombres: "Otro" };
    expect(hayCambiosPendientes(tocado, iniciales)).toBe(true);
    expect(hayCambiosPendientes({ ...tocado, nombres: "Maria" }, iniciales)).toBe(false);
  });
});
