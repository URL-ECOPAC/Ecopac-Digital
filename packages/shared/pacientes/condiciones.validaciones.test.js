import { describe, expect, it } from "vitest";
import { ESTADOS_CONDICION_CRONICA } from "../enums.js";
import {
  normalizarDatosCondicion,
  validarCambioDeCondicion,
  validarCondicionCatalogo,
  validarCondicionCronica,
} from "./condiciones.validaciones.js";

const HOY = new Date("2026-06-15T10:00:00.000Z");

const ALTA_VALIDA = {
  condicion: "Diabetes Tipo 2",
  fechaDiagnostico: "2026-01-15",
  estado: ESTADOS_CONDICION_CRONICA.ACTIVA,
};

describe("normalizarDatosCondicion", () => {
  it("recorta las notas", () => {
    expect(normalizarDatosCondicion({ notas: "  con espacios  " }).notas).toBe("con espacios");
  });

  it("deja las notas en null cuando se enviaron vacias", () => {
    expect(normalizarDatosCondicion({ notas: "    " }).notas).toBeNull();
  });

  it("no inventa la clave notas cuando no venia", () => {
    expect(normalizarDatosCondicion({ estado: "resuelta" })).not.toHaveProperty("notas");
    expect(normalizarDatosCondicion({})).not.toHaveProperty("notas");
  });
});

describe("validarCondicionCronica", () => {
  it("acepta un alta completa", () => {
    expect(validarCondicionCronica(ALTA_VALIDA, HOY)).toEqual({});
  });

  it("exige la condicion y la fecha de diagnostico", () => {
    const errores = validarCondicionCronica({}, HOY);
    expect(errores.condicion).toBeDefined();
  });

  it("no exige el estado, porque la columna tiene DEFAULT 'activa'", () => {
    expect(validarCondicionCronica(ALTA_VALIDA, HOY).estado).toBeUndefined();
  });

  it("no exige las notas", () => {
    expect(validarCondicionCronica(ALTA_VALIDA, HOY).notas).toBeUndefined();
  });

  it("rechaza una fecha de diagnostico futura", () => {
    const errores = validarCondicionCronica(
      { ...ALTA_VALIDA, fechaDiagnostico: "2026-12-01" },
      HOY,
    );
    expect(errores.fechaDiagnostico).toBe("La fecha de diagnostico no puede ser futura.");
  });

  it("acepta la fecha de hoy", () => {
    const errores = validarCondicionCronica(
      { ...ALTA_VALIDA, fechaDiagnostico: "2026-06-15" },
      HOY,
    );
    expect(errores.fechaDiagnostico).toBeUndefined();
  });

  it("rechaza una fecha que no es fecha", () => {
    const errores = validarCondicionCronica({ ...ALTA_VALIDA, fechaDiagnostico: "ayer" }, HOY);
    expect(errores.fechaDiagnostico).toContain("no valida");
  });

  it("rechaza un estado que el enum no tiene", () => {
    const errores = validarCondicionCronica({ ...ALTA_VALIDA, estado: "cronica" }, HOY);
    expect(errores.estado).toContain("activa, controlada o resuelta");
  });

  it("acepta los tres estados del enum", () => {
    for (const estado of Object.values(ESTADOS_CONDICION_CRONICA)) {
      expect(validarCondicionCronica({ ...ALTA_VALIDA, estado }, HOY).estado).toBeUndefined();
    }
  });
});

describe("validarCambioDeCondicion", () => {
  it("no exige la condicion ni la fecha, porque el update es parcial", () => {
    expect(validarCambioDeCondicion({ estado: "controlada" }, HOY)).toEqual({});
  });

  it("acepta un cambio vacio: quien decide si hay algo que guardar es la API", () => {
    expect(validarCambioDeCondicion({}, HOY)).toEqual({});
  });

  it("sigue rechazando lo que si viene mal", () => {
    const errores = validarCambioDeCondicion(
      { estado: "inventado", fechaDiagnostico: "2026-12-01" },
      HOY,
    );
    expect(errores.estado).toBeDefined();
    expect(errores.fechaDiagnostico).toBeDefined();
  });
});

describe("validarCondicionCatalogo", () => {
  it("exige el nombre al crear o editar en el catalogo", () => {
    expect(validarCondicionCatalogo({ nombre: "" })).toEqual({
      nombre: "El nombre de la condicion es requerido.",
    });
    expect(validarCondicionCatalogo({ nombre: "Hipertensión" })).toEqual({});
  });
});
