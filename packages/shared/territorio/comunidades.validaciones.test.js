import { describe, expect, it } from "vitest";
import { normalizarDatosComunidad, validarComunidad } from "./comunidades.validaciones.js";

describe("normalizarDatosComunidad", () => {
  it("recorta espacios innecesarios en el nombre", () => {
    expect(normalizarDatosComunidad({ nombre: "  Aldea El Carmen  " }).nombre).toBe(
      "Aldea El Carmen",
    );
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

  it("acepta una comunidad sin coordenadas", () => {
    const errores = validarComunidad({ nombre: "San José", municipio_id: 12 });
    expect(errores.ubicacion).toBeUndefined();
  });

  it("acepta una comunidad con latitud y longitud validas", () => {
    const errores = validarComunidad({
      nombre: "San José",
      municipio_id: 12,
      latitud: 14.5,
      longitud: -90.3,
    });
    expect(errores).toEqual({});
  });

  it("exige la longitud si solo llega la latitud", () => {
    const errores = validarComunidad({ nombre: "San José", municipio_id: 12, latitud: 14.5 });
    expect(errores.ubicacion).toBe(
      "Selecciona un punto completo en el mapa: falta la latitud o la longitud.",
    );
  });

  it("exige la latitud si solo llega la longitud", () => {
    const errores = validarComunidad({ nombre: "San José", municipio_id: 12, longitud: -90.3 });
    expect(errores.ubicacion).toBe(
      "Selecciona un punto completo en el mapa: falta la latitud o la longitud.",
    );
  });

  it("rechaza una latitud fuera de rango", () => {
    const errores = validarComunidad({
      nombre: "San José",
      municipio_id: 12,
      latitud: 200,
      longitud: -90.3,
    });
    expect(errores.latitud).toBe("La latitud debe estar entre -90 y 90.");
  });

  it("rechaza una longitud fuera de rango", () => {
    const errores = validarComunidad({
      nombre: "San José",
      municipio_id: 12,
      latitud: 14.5,
      longitud: -200,
    });
    expect(errores.longitud).toBe("La longitud debe estar entre -180 y 180.");
  });
});
