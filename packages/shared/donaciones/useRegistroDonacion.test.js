// Pruebas de las funciones puras de useRegistroDonacion.js.
//
// El hook en si no se prueba con renderHook: vitest.config.js de packages/shared corre en
// entorno "node", sin DOM, mismo motivo por el que useEjecucionPresupuestal.test.js solo prueba
// sus funciones puras. La decision no trivial de este archivo -si un guardarDonacion() exitoso
// (o fallido) debe ofrecer el paso de generar el ingreso de inventario, y con que id real por
// renglon- vive en dos funciones exportadas aparte justamente para poder probarla asi.

import { describe, expect, it } from "vitest";

import { TIPOS_DE_DONACION } from "../enums.js";
import { conIdsReales, debeOfrecerIngresoInventario } from "./useRegistroDonacion.js";

describe("debeOfrecerIngresoInventario (#635, criterio 6)", () => {
  it("un error de registrarDonacion() no ofrece el paso de inventario, aunque el tipo sea medicamentos", () => {
    const error = { mensaje: "Revisa los datos del formulario antes de registrar la donación." };

    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.MEDICAMENTOS, error)).toBe(false);
  });

  it("sin error y tipo medicamentos, si ofrece el paso de inventario", () => {
    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.MEDICAMENTOS, null)).toBe(true);
  });

  it("sin error pero de un tipo distinto a medicamentos, no ofrece el paso de inventario", () => {
    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.DINERO, null)).toBe(false);
    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.INSUMOS, null)).toBe(false);
    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.SERVICIOS, null)).toBe(false);
  });
});

describe("conIdsReales", () => {
  it("agrega donacionDetalleId a cada renglon local, por posicion, desde detalleIds", () => {
    const detallesLocales = [
      { id: 1, descripcion: "Amoxicilina", cantidad: 10, medicamentoId: "MED-1" },
      { id: 2, descripcion: "Ibuprofeno", cantidad: 5, medicamentoId: "MED-2" },
    ];

    const resultado = conIdsReales(detallesLocales, ["DETALLE-1", "DETALLE-2"]);

    expect(resultado[0]).toMatchObject({ medicamentoId: "MED-1", donacionDetalleId: "DETALLE-1" });
    expect(resultado[1]).toMatchObject({ medicamentoId: "MED-2", donacionDetalleId: "DETALLE-2" });
  });

  it("no muta los renglones locales originales", () => {
    const detallesLocales = [{ id: 1, descripcion: "Amoxicilina" }];

    conIdsReales(detallesLocales, ["DETALLE-1"]);

    expect(detallesLocales[0].donacionDetalleId).toBeUndefined();
  });

  it("sin detalleIds (p. ej. una respuesta inesperada), cada renglon queda con donacionDetalleId null en vez de romper", () => {
    const detallesLocales = [{ id: 1, descripcion: "Amoxicilina" }];

    expect(conIdsReales(detallesLocales)[0].donacionDetalleId).toBeNull();
  });
});
