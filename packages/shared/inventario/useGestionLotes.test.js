// Prueba de la logica pura del hook de gestion de lotes.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). Antes de la issue #709, InventarioPage.jsx nunca llamaba a registrarLote()
// (lotes.api.js): el boton de alta de lote no guardaba nada. Esta prueba cubre la traduccion que
// handleGuardarLote() ahora usa para llamar a registrarLote(), con exactamente los argumentos
// camelCase que esa funcion declara (aColumnasDeTabla() los traduce a columnas snake_case).

import { describe, expect, it } from "vitest";

import { datosLoteParaRegistrar, validarDatosDeLote } from "./useGestionLotes.js";

// Issue #840 (B1): el formulario usa los ids de CAMPOS_LOTE, que son los argumentos de
// registrarLote(). Antes eran snake_case propios del modal y habia que traducirlos.
const VALORES = {
  medicamento: "med-1",
  numeroLote: "L-002",
  proveedor: "prov-1",
  origen: "compra",
  cantidadIngresada: "50",
  fechaIngreso: "2026-09-01",
  fechaVencimiento: "2027-09-01",
  costoUnitario: "",
};

describe("datosLoteParaRegistrar", () => {
  it("entrega los argumentos de registrarLote, con la cantidad como numero", () => {
    expect(datosLoteParaRegistrar(VALORES)).toEqual({
      medicamento: "med-1",
      numeroLote: "L-002",
      proveedor: "prov-1",
      origen: "compra",
      cantidadIngresada: 50,
      fechaIngreso: "2026-09-01",
      fechaVencimiento: "2027-09-01",
    });
  });

  it("sin costo unitario, no incluye costoUnitario (issue #752)", () => {
    expect(datosLoteParaRegistrar(VALORES)).not.toHaveProperty("costoUnitario");
  });

  it("con costo unitario, lo entrega como numero (issue #752)", () => {
    expect(datosLoteParaRegistrar({ ...VALORES, costoUnitario: "8.5" }).costoUnitario).toBe(8.5);
  });

  it("sin fecha de ingreso no la manda: la pone la base (DEFAULT CURRENT_DATE)", () => {
    expect(datosLoteParaRegistrar({ ...VALORES, fechaIngreso: "" })).not.toHaveProperty(
      "fechaIngreso",
    );
  });
});

describe("validarDatosDeLote", () => {
  it("acepta datos completos y validos", () => {
    expect(validarDatosDeLote(VALORES)).toEqual({});
  });

  it("rechaza una cantidad de 0, en el campo de la cantidad", () => {
    expect(validarDatosDeLote({ ...VALORES, cantidadIngresada: "0" })).toHaveProperty(
      "cantidadIngresada",
    );
  });

  it("marca el campo obligatorio que falta, no un mensaje general", () => {
    expect(Object.keys(validarDatosDeLote({ ...VALORES, proveedor: "" }))).toEqual(["proveedor"]);
  });

  it("ya no pide bodega: registrarLote() nunca la guardaba", () => {
    expect(validarDatosDeLote(VALORES)).not.toHaveProperty("bodega");
  });

  it("la fecha de ingreso es opcional", () => {
    expect(validarDatosDeLote({ ...VALORES, fechaIngreso: "" })).toEqual({});
  });

  // 00096: el CHECK es >=. El cliente seguia con la regla estricta y rechazaba lo que la base acepta.
  it("acepta un lote que vence el mismo dia que ingresa", () => {
    expect(
      validarDatosDeLote({
        ...VALORES,
        fechaIngreso: "2027-09-01",
        fechaVencimiento: "2027-09-01",
      }),
    ).toEqual({});
  });

  it("rechaza una fecha de vencimiento anterior a la de ingreso", () => {
    expect(
      validarDatosDeLote({
        ...VALORES,
        fechaIngreso: "2027-09-02",
        fechaVencimiento: "2027-09-01",
      }),
    ).toHaveProperty("fechaVencimiento");
  });
});
