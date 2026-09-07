import { describe, expect, it } from "vitest";
import {
  normalizarDatosComunidad,
  validarComunidad,
} from "./comunidades.validaciones.js";

describe("normalizarDatosComunidad", () => {
  it("recorta espacios innecesarios en el nombre", () => {
    expect(
      normalizarDatosComunidad({ nombre: "  Aldea El Carmen  " }).nombre
    ).toBe("Aldea El Carmen");
  });
});

describe("validarComunidad", () => {
  it("acepta una comunidad con nombre y municipio", () => {
    const errores = validarComunidad({
      nombre: "San José",
      municipio_id: 12,
    });
    expect(errores).toEqual({});
  });

  it("exige el nombre de la comunidad", () => {
    const errores = validarComunidad({ municipio_id: 12 });
    expect(errores.nombre).toBe("El nombre de la comunidad es requerido.");
  });

  it("exige el municipio id", () => {
    const errores = validarComunidad({ nombre: "San José" });
    expect(errores.municipio_id).toBe("El municipio es requerido.");
  });
});