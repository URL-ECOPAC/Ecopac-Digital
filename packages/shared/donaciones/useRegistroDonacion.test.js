// Pruebas de las funciones puras de useRegistroDonacion.js.
//
// El hook en si no se prueba con renderHook: vitest.config.js de packages/shared corre en
// entorno "node", sin DOM, mismo motivo por el que useEjecucionPresupuestal.test.js solo prueba
// sus funciones puras. La decision no trivial de este archivo -si un guardarDonacion() exitoso
// (o fallido) debe ofrecer el paso de generar el ingreso de inventario, y con que id real por
// renglon- vive en dos funciones exportadas aparte justamente para poder probarla asi.

import { describe, expect, it } from "vitest";

import { TIPOS_DE_DONACION } from "../enums.js";
import {
  conIdsReales,
  debeOfrecerIngresoInventario,
  opcionesDeArticuloParaDonacion,
} from "./useRegistroDonacion.js";

describe("debeOfrecerIngresoInventario (#635, criterio 6)", () => {
  it("un error de registrarDonacion() no ofrece el paso de inventario, aunque el tipo sea medicamentos", () => {
    const error = { mensaje: "Revisa los datos del formulario antes de registrar la donación." };

    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.MEDICAMENTOS, error)).toBe(false);
  });

  it("sin error y tipo medicamentos, si ofrece el paso de inventario", () => {
    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.MEDICAMENTOS, null)).toBe(true);
  });

  // 00170: un insumo ya tiene articulo del catalogo, asi que tambien entra a inventario.
  it("sin error y de insumos, tambien ofrece el paso de inventario", () => {
    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.INSUMOS, null)).toBe(true);
  });

  it("sin error pero de dinero o servicios, no ofrece el paso de inventario", () => {
    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.DINERO, null)).toBe(false);
    expect(debeOfrecerIngresoInventario(TIPOS_DE_DONACION.SERVICIOS, null)).toBe(false);
  });
});

describe("opcionesDeArticuloParaDonacion", () => {
  const ARTICULOS = [
    { id: "m1", nombre: "Acetaminofen", concentracion: "500 mg", tipoArticulo: "medicamento" },
    { id: "i1", nombre: "Guantes", tipoArticulo: "insumo" },
    { id: "m2", nombre: "Loratadina", concentracion: "10 mg", tipoArticulo: "medicamento" },
  ];
  const valores = (tipo) => opcionesDeArticuloParaDonacion(ARTICULOS, tipo).map((o) => o.value);

  it("una donacion de medicamentos solo ofrece medicamentos", () => {
    expect(valores(TIPOS_DE_DONACION.MEDICAMENTOS)).toEqual(["m1", "m2"]);
  });

  it("una donacion de insumos solo ofrece insumos", () => {
    expect(valores(TIPOS_DE_DONACION.INSUMOS)).toEqual(["i1"]);
  });

  it("dinero y servicios no eligen del catalogo", () => {
    expect(valores(TIPOS_DE_DONACION.DINERO)).toEqual([]);
    expect(valores(TIPOS_DE_DONACION.SERVICIOS)).toEqual([]);
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
