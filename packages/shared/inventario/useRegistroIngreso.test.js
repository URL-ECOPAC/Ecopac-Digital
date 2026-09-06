// Prueba de la logica pura del hook de registro de ingreso.
//
// No se monta el hook: packages/shared corre vitest con environment "node", sin DOM (ver
// vitest.config.js). guardarMovimiento() (useRegistroIngreso.js) no hacia ningun llamado real a
// una API antes de la issue #709: armaba un objeto de mentira y lo pasaba directo al callback de
// exito. Esta prueba cubre la traduccion que guardarMovimiento() ahora usa para llamar a
// registrarIngreso() (movimientos.api.js), con exactamente los argumentos que esa funcion
// declara.

import { describe, expect, it } from "vitest";

import { datosIngresoParaRegistrar } from "./useRegistroIngreso.js";

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
});
