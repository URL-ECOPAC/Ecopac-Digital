// Prueba de la logica pura del hook de registro de ingreso.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). guardarMovimiento() (useRegistroIngreso.js) no hacia ningun llamado real a
// una API antes de la issue #709: armaba un objeto de mentira y lo pasaba directo al callback de
// exito. Esta prueba cubre la traduccion que guardarMovimiento() ahora usa para llamar a
// registrarIngreso() (movimientos.api.js), con exactamente los argumentos que esa funcion
// declara.

import { describe, expect, it } from "vitest";

import { datosIngresoParaRegistrar, itemDesdeRenglonDeDonacion } from "./useRegistroIngreso.js";

describe("datosIngresoParaRegistrar", () => {
  const item = {
    medicamento_id: "med-1",
    numero_lote: "L-001",
    fecha_vencimiento: "2027-01-01",
    cantidad: 10,
    bodega_id: "bod-1",
  };

  it("arma los argumentos de registrarIngreso con el origen, proveedor y usuario comunes al ingreso", () => {
    const resultado = datosIngresoParaRegistrar(item, {
      origen: "compra",
      proveedorId: "prov-1",
      numeroComprobante: "F-100",
      usuarioId: "user-1",
    });

    expect(resultado).toEqual({
      origen: "compra",
      bodega_id: "bod-1",
      medicamento_id: "med-1",
      numero_lote: "L-001",
      fecha_vencimiento: "2027-01-01",
      proveedor_id: "prov-1",
      cantidad: 10,
      motivo: "F-100",
      usuarioId: "user-1",
    });
  });

  it("una donacion usa el mismo proveedor_id -un donante es un proveedor de tipo 'donante'- sin un flujo aparte", () => {
    const resultado = datosIngresoParaRegistrar(item, {
      origen: "donacion",
      proveedorId: "donante-1",
      numeroComprobante: "",
      usuarioId: "user-1",
    });

    expect(resultado.origen).toBe("donacion");
    expect(resultado.proveedor_id).toBe("donante-1");
  });

  it("envia motivo undefined (no un string vacio) cuando no se indica numero de comprobante", () => {
    const resultado = datosIngresoParaRegistrar(item, {
      origen: "compra",
      proveedorId: "prov-1",
      numeroComprobante: "   ",
      usuarioId: "user-1",
    });

    expect(resultado.motivo).toBeUndefined();
  });

  it("envia costo_unitario undefined (no NaN) cuando el item no trae costo (issue #752)", () => {
    const resultado = datosIngresoParaRegistrar(item, {
      origen: "compra",
      proveedorId: "prov-1",
      numeroComprobante: "F-100",
      usuarioId: "user-1",
    });

    expect(resultado.costo_unitario).toBeUndefined();
  });

  it("con costo_unitario en el item, lo manda como numero (issue #752)", () => {
    const resultado = datosIngresoParaRegistrar(
      { ...item, costo_unitario: "7.25" },
      { origen: "compra", proveedorId: "prov-1", numeroComprobante: "F-100", usuarioId: "user-1" },
    );

    expect(resultado.costo_unitario).toBe(7.25);
  });
});

describe("itemDesdeRenglonDeDonacion", () => {
  it("precarga cantidad, medicamento y el id del renglon; deja bodega/lote/vencimiento vacios", () => {
    const item = itemDesdeRenglonDeDonacion({
      donacionDetalleId: "det-1",
      cantidad: 50,
      medicamentoId: "med-2",
      descripcion: "Amoxicilina 500mg",
    });

    expect(item).toEqual({
      medicamento_id: "med-2",
      numero_lote: "",
      fecha_vencimiento: "",
      cantidad: 50,
      bodega_id: "",
      costo_unitario: "",
      donacionDetalleId: "det-1",
      // Issue #840: el medicamento ya se eligio del catalogo al registrar la donacion.
      medicamentoFijo: true,
    });
  });

  it("sin medicamentoId en el renglon (donaciones anteriores a la 00134), lo deja vacio y elegible", () => {
    const item = itemDesdeRenglonDeDonacion({ donacionDetalleId: "det-2", cantidad: 10 });
    expect(item.medicamento_id).toBe("");
    expect(item.medicamentoFijo).toBe(false);
  });
});
