import { describe, expect, it } from "vitest";

import { CAMPOS_REGISTRO_PACIENTE } from "./campos.js";
import {
  PASOS_REGISTRO_PACIENTE,
  pasosConCampos,
  pasosConError,
} from "./registro.pasos.js";

describe("pasosConCampos", () => {
  it("cubre los once campos del descriptor sin repetir ninguno", () => {
    const ids = pasosConCampos().flatMap((paso) => paso.campos.map((campo) => campo.id));

    expect(ids).toHaveLength(CAMPOS_REGISTRO_PACIENTE.length);
    expect(new Set(ids).size).toBe(CAMPOS_REGISTRO_PACIENTE.length);
  });

  it("cada id declarado en un paso existe en el descriptor", () => {
    for (const paso of PASOS_REGISTRO_PACIENTE) {
      for (const id of paso.campos) {
        expect(CAMPOS_REGISTRO_PACIENTE.some((campo) => campo.id === id)).toBe(true);
      }
    }
  });

  it("abre por la identidad, que es como empieza la ficha de papel", () => {
    expect(PASOS_REGISTRO_PACIENTE[0].campos[0]).toBe("nombres");
  });

  it("agrupa los cuatro obligatorios de identidad en el primer paso", () => {
    const primero = pasosConCampos()[0];
    expect(primero.campos.filter((campo) => campo.validacion?.requerido)).toHaveLength(4);
  });
});

describe("pasosConError", () => {
  it("senala el paso donde esta cada campo con error", () => {
    expect(pasosConError({ nombres: "Requerido" })).toEqual(["identidad"]);
    expect(pasosConError({ comunidad: "Requerido" })).toEqual(["ubicacion"]);
  });

  it("puede senalar varios pasos a la vez", () => {
    expect(pasosConError({ apellidos: "x", telefonoContacto: "y" })).toEqual([
      "identidad",
      "ubicacion",
    ]);
  });

  it("sin errores no senala ninguno", () => {
    expect(pasosConError({})).toEqual([]);
    expect(pasosConError()).toEqual([]);
  });

  it("un campo que no esta en ningun paso no inventa uno", () => {
    expect(pasosConError({ inventado: "x" })).toEqual([]);
  });
});
