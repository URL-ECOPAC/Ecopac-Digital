// Pruebas de las reglas de negocio de las condiciones cronicas (issue #122).
//
// La fecha se inyecta en todas las pruebas que la miran: una prueba que dependa del reloj del CI
// falla sola el dia que el huso cambie de dia antes que el de la maquina de quien la escribio.
//
// Ningun dato real: identificadores y notas son inventados.

import { describe, expect, it } from "vitest";

import { ESTADOS_CONDICION_CRONICA, OPCIONES_ESTADO_CONDICION } from "./condiciones.campos.js";
import {
  normalizarDatosCondicion,
  validarCambioDeCondicion,
  validarCondicionCronica,
} from "./condiciones.validaciones.js";

const HOY = new Date("2026-06-15T12:00:00Z");
const CONDICION = "71000000-0000-0000-0000-000000122001";

const ALTA_VALIDA = {
  condicion: CONDICION,
  fechaDiagnostico: "2026-01-15",
};

describe("ESTADOS_CONDICION_CRONICA", () => {
  it("tiene los tres valores del enum estado_condicion_cronica de la 00010", () => {
    expect(Object.values(ESTADOS_CONDICION_CRONICA)).toEqual(["activa", "controlada", "resuelta"]);
  });

  it("cada estado tiene su etiqueta para la pantalla", () => {
    expect(OPCIONES_ESTADO_CONDICION.map((opcion) => opcion.value)).toEqual(
      Object.values(ESTADOS_CONDICION_CRONICA),
    );
    for (const opcion of OPCIONES_ESTADO_CONDICION) {
      expect(opcion.label).toBeTruthy();
    }
  });
});

describe("normalizarDatosCondicion", () => {
  it("recorta las notas", () => {
    expect(normalizarDatosCondicion({ notas: "  con espacios  " }).notas).toBe("con espacios");
  });

  it("deja las notas en null cuando se enviaron vacias", () => {
    // La columna es nullable: una cadena vacia guardaria un dato que no existe.
    expect(normalizarDatosCondicion({ notas: "   " }).notas).toBeNull();
  });

  it("no inventa la clave notas cuando no venia", () => {
    // Si la inventara, actualizarCondicion() la incluiria en el UPDATE y borraria las notas
    // clinicas del paciente en cualquier cambio de estado.
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
    expect(errores.fechaDiagnostico).toBeDefined();
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

    expect(errores.fechaDiagnostico).toContain("futura");
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
    // Sin esta regla el INSERT falla en la base con un error que no dice que estados existen.
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
