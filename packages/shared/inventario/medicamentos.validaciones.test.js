// Pruebas de validarMedicamentoDelCatalogo() (issue #911): el alta de un medicamento con campos
// vacios marcaba solo "Ocurrio un error inesperado".

import { describe, expect, it } from "vitest";

import { TIPOS_DE_ARTICULO } from "../enums.js";
import { validarMedicamentoDelCatalogo } from "./medicamentos.validaciones.js";

const MEDICAMENTO_COMPLETO = {
  nombre: "Amoxicilina",
  tipoArticulo: TIPOS_DE_ARTICULO.MEDICAMENTO,
  principio_activo_id: "pa-1",
  concentracion: "500 mg",
  presentacionId: "pr-1",
  marca: "Generico",
};

describe("validarMedicamentoDelCatalogo", () => {
  it("un medicamento completo no tiene errores", () => {
    expect(validarMedicamentoDelCatalogo(MEDICAMENTO_COMPLETO)).toEqual({});
  });

  it("marca cada campo obligatorio vacio de un medicamento, debajo del suyo", () => {
    const errores = validarMedicamentoDelCatalogo({
      tipoArticulo: TIPOS_DE_ARTICULO.MEDICAMENTO,
      nombre: "  ",
    });

    expect(Object.keys(errores).sort()).toEqual(
      ["concentracion", "marca", "nombre", "presentacionId", "principio_activo_id"].sort(),
    );
  });

  it("a un insumo no le pide principio activo ni concentracion (00164)", () => {
    const errores = validarMedicamentoDelCatalogo({
      nombre: "Guantes",
      tipoArticulo: TIPOS_DE_ARTICULO.INSUMO,
      presentacionId: "pr-1",
      marca: "Generico",
    });

    expect(errores).toEqual({});
  });

  it("sin tipo de articulo lo pide, y lo trata como medicamento", () => {
    const errores = validarMedicamentoDelCatalogo({ ...MEDICAMENTO_COMPLETO, tipoArticulo: "" });

    expect(errores.tipoArticulo).toBeDefined();
    expect(errores.principio_activo_id).toBeUndefined();
  });
});
