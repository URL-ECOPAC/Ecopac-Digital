// Prueba de la logica pura del hook de gestion de lotes.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). Antes de la issue #709, InventarioPage.jsx nunca llamaba a registrarLote()
// (lotes.api.js): el boton de alta de lote no guardaba nada. Esta prueba cubre la traduccion que
// handleGuardarLote() ahora usa para llamar a registrarLote(), con exactamente los argumentos
// camelCase que esa funcion declara (aColumnasDeTabla() los traduce a columnas snake_case).

import { describe, expect, it } from "vitest";

import { datosLoteParaRegistrar, validarDatosDeLote } from "./useGestionLotes.js";

describe("datosLoteParaRegistrar", () => {
  it("traduce los campos snake_case del formulario a los argumentos camelCase de registrarLote", () => {
    const resultado = datosLoteParaRegistrar({
      medicamento_id: "med-1",
      numero_lote: "L-002",
      proveedor_id: "prov-1",
      origen: "compra",
      cantidad: 50,
      fecha_ingreso: "2026-09-01",
      fecha_vencimiento: "2027-09-01",
    });

    expect(resultado).toEqual({
      medicamento: "med-1",
      numeroLote: "L-002",
      proveedor: "prov-1",
      origen: "compra",
      cantidadIngresada: 50,
      fechaIngreso: "2026-09-01",
      fechaVencimiento: "2027-09-01",
    });
  });
});

describe("validarDatosDeLote", () => {
  const datosValidos = {
    medicamento_id: "med-1",
    numero_lote: "L-002",
    proveedor_id: "prov-1",
    origen: "compra",
    cantidad: 50,
    fecha_ingreso: "2026-09-01",
    fecha_vencimiento: "2027-09-01",
    bodega_id: "bod-1",
  };

  it("acepta datos completos y validos", () => {
    expect(validarDatosDeLote(datosValidos)).toBeNull();
  });

  it("rechaza una cantidad en 'cantidad' igual a 0 -el campo real que manda ModalAltaLote.jsx, no 'cantidad_ingresada'", () => {
    expect(validarDatosDeLote({ ...datosValidos, cantidad: 0 })).toMatch(/cantidad ingresada/i);
  });

  it("acepta una cantidad positiva sin marcarla como invalida por error", () => {
    expect(validarDatosDeLote({ ...datosValidos, cantidad: 40 })).toBeNull();
  });

  it("rechaza si falta un campo obligatorio", () => {
    expect(validarDatosDeLote({ ...datosValidos, proveedor_id: "" })).toMatch(/obligatorios/i);
  });

  it("rechaza una fecha de vencimiento anterior o igual a la de ingreso", () => {
    expect(
      validarDatosDeLote({
        ...datosValidos,
        fecha_ingreso: "2027-09-01",
        fecha_vencimiento: "2027-09-01",
      }),
    ).toMatch(/vencimiento_posterior/i);
  });
});
