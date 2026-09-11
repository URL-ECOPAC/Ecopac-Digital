// Prueba de la funcion pura de useAdministracionBodegasProveedores.js.
//
// El hook en si no se monta: vitest.config.js de packages/shared corre en entorno "node", sin
// DOM, por la regla de la frontera de docs/ARQUITECTURA-FRONTEND.md. La decision no trivial de
// este hook -que un fallo de carga NO se puede confundir con un listado vacio- vive en
// resultadoDeListado() justamente para poder probarla asi.
//
// Es la guarda de regresion de la issue #762. El hook leia `respuesta.bodegas` y descartaba
// `respuesta.error`, asi que cuando listarBodegas() fallaba la pantalla pintaba "No hay bodegas
// registradas": la misma forma del fallo de la entrega de medicamentos, donde algo no funciona
// y el sistema dice que si.

import { describe, expect, it } from "vitest";

import { resultadoDeListado } from "./useAdministracionBodegasProveedores.js";

describe("resultadoDeListado (#762)", () => {
  it("un error de carga devuelve el mensaje, y NO un listado vacio que se lea como 'no hay nada'", () => {
    const respuesta = {
      bodegas: [],
      error: { mensaje: "Revisa tu conexion e intenta de nuevo.", codigo: "fallo_de_red" },
    };

    expect(resultadoDeListado(respuesta, "bodegas")).toEqual({
      items: [],
      error: "Revisa tu conexion e intenta de nuevo.",
    });
  });

  it("un error sin mensaje sigue siendo un error: nunca devuelve error null por quedarse sin texto", () => {
    const respuesta = { proveedores: [], error: { codigo: "desconocido" } };
    const resultado = resultadoDeListado(respuesta, "proveedores");

    expect(resultado.error).toBeTruthy();
    expect(resultado.items).toEqual([]);
  });

  it("una carga exitosa devuelve la coleccion y ningun error", () => {
    const respuesta = {
      bodegas: [{ id: "bod-1", nombre: "Bodega Norte" }],
      error: null,
    };

    expect(resultadoDeListado(respuesta, "bodegas")).toEqual({
      items: [{ id: "bod-1", nombre: "Bodega Norte" }],
      error: null,
    });
  });

  it("una coleccion vacia sin error es un listado vacio de verdad, no un fallo", () => {
    expect(resultadoDeListado({ proveedores: [], error: null }, "proveedores")).toEqual({
      items: [],
      error: null,
    });
  });

  it("si la respuesta no trae la coleccion, devuelve un arreglo y no undefined", () => {
    // Quien recibe esto hace .map() y .length sin comprobar: devolver undefined lo reventaria.
    expect(resultadoDeListado({ error: null }, "bodegas")).toEqual({ items: [], error: null });
    expect(resultadoDeListado(undefined, "bodegas")).toEqual({ items: [], error: null });
  });
});
