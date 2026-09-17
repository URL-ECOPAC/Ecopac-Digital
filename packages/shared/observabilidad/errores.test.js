// Pruebas del reporte de errores (issue #762).
//
// Lo que importa de verdad es que ningun dato que identifique a una persona salga del equipo. Los
// datos son inventados: ningun DPI, telefono, correo ni nombre de estas pruebas es real.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configurarDestinoDeErrores,
  construirReporteDeError,
  limpiarDatosSensibles,
  reportarError,
} from "./errores.js";

afterEach(() => {
  configurarDestinoDeErrores(null);
  vi.restoreAllMocks();
});

describe("limpiarDatosSensibles", () => {
  it("quita el UUID de una ruta de paciente", () => {
    expect(limpiarDatosSensibles("/pacientes/3f2b8c1e-9a4d-4e21-8b7f-0c6d5e4a3b21")).toBe(
      "/pacientes/[id]",
    );
  });

  it("quita correos", () => {
    expect(limpiarDatosSensibles("No existe persona.inventada@ejemplo.org")).toBe(
      "No existe [correo]",
    );
  });

  it("quita un DPI con y sin espacios", () => {
    expect(limpiarDatosSensibles("dpi 1234567890101 duplicado")).toBe("dpi [numero] duplicado");
    expect(limpiarDatosSensibles("dpi 1234 56789 0101")).toBe("dpi [numero]");
  });

  it("quita telefonos con guion y corridas largas de digitos", () => {
    expect(limpiarDatosSensibles("tel 5555-1234")).toBe("tel [numero]");
    expect(limpiarDatosSensibles("tel 55551234")).toBe("tel [numero]");
  });

  it("quita el valor que Postgres copia en el detail de una violacion de unicidad", () => {
    expect(
      limpiarDatosSensibles("Key (nombres, apellidos)=(Maria Inventada, Perez) already exists."),
    ).toBe("Key (nombres, apellidos)=([valor]) already exists.");
  });

  it("quita tokens", () => {
    expect(limpiarDatosSensibles("Authorization: Bearer abc.def-123")).toBe(
      "Authorization: Bearer [token]",
    );
    expect(limpiarDatosSensibles("jwt eyJhbGciOi.eyJzdWIiOi.firmaFirma")).toBe("jwt [token]");
  });

  it("deja intactos los numeros cortos que sirven para investigar: codigos y lineas", () => {
    expect(limpiarDatosSensibles("22P02 en la linea 42")).toBe("22P02 en la linea 42");
  });

  it("acepta null y undefined sin lanzar", () => {
    expect(limpiarDatosSensibles(null)).toBe("");
    expect(limpiarDatosSensibles(undefined)).toBe("");
  });
});

describe("construirReporteDeError", () => {
  it("lee un Error", () => {
    const reporte = construirReporteDeError(new TypeError("fallo en persona@ejemplo.org"), {
      origen: "pantalla",
      ruta: "/pacientes/3f2b8c1e-9a4d-4e21-8b7f-0c6d5e4a3b21",
    });

    expect(reporte.mensaje).toBe("fallo en [correo]");
    expect(reporte.nombre).toBe("TypeError");
    expect(reporte.origen).toBe("pantalla");
    expect(reporte.ruta).toBe("/pacientes/[id]");
    expect(reporte.pila).not.toContain("persona@ejemplo.org");
  });

  it("lee el error normalizado de las APIs de shared ({ mensaje, codigo })", () => {
    const reporte = construirReporteDeError({ mensaje: "Sin permiso", codigo: "42501" });
    expect(reporte.mensaje).toBe("Sin permiso");
    expect(reporte.codigo).toBe("42501");
  });

  it("lee el error de supabase-js ({ message, code })", () => {
    const reporte = construirReporteDeError({ message: "invalid input", code: "22P02" });
    expect(reporte.mensaje).toBe("invalid input");
    expect(reporte.codigo).toBe("22P02");
  });

  it("el detail de Postgres pasa por sanearDetalle: no viaja el valor de la fila", () => {
    const reporte = construirReporteDeError({
      message: "duplicate key value violates unique constraint",
      code: "23505",
      details: "Key (dpi)=(1234567890101) already exists.",
    });
    expect(reporte.detalle).toBe("Key (...)=([valor]) already exists.");
    expect(reporte.detalle).not.toContain("1234567890101");
  });

  it("acepta un string o nada", () => {
    expect(construirReporteDeError("se cayo").mensaje).toBe("se cayo");
    expect(construirReporteDeError(undefined).mensaje).toBe("Error desconocido");
  });
});

describe("reportarError", () => {
  it("envia el reporte ya limpio al destino configurado", () => {
    const destino = vi.fn();
    configurarDestinoDeErrores(destino);

    reportarError(new Error("dpi 1234567890101"), { origen: "prueba" });

    expect(destino).toHaveBeenCalledTimes(1);
    expect(destino.mock.calls[0][0].mensaje).toBe("dpi [numero]");
  });

  it("si el destino falla, cae a la consola y no lanza", () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    configurarDestinoDeErrores(() => {
      throw new Error("sin red");
    });

    expect(() => reportarError(new Error("original"))).not.toThrow();
    expect(consola).toHaveBeenCalled();
  });
});
