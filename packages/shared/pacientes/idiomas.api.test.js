// Pruebas del catalogo de idiomas (issue #663).
//
// Mismo patron de mock que condiciones.api.test.js: un doble de obtenerSupabase() que registra
// la cadena y resuelve con lo que la prueba le entregue. No hay Supabase real ni red.
//
// Lo que estas pruebas NO cubren, porque no se puede desde aqui: que la clave foranea contra
// idiomas(codigo) impida guardar un idioma inexistente, y que la politica RLS deje leer el
// catalogo a cualquier sesion. Eso vive en la migracion 00110 y se comprueba contra la base.

import { describe, expect, it, vi } from "vitest";

const { dobles } = vi.hoisted(() => ({ dobles: { cliente: null } }));

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: () => {
    if (dobles.cliente === null) {
      throw new Error("Ninguna prueba debia llegar hasta el cliente de Supabase.");
    }
    return dobles.cliente;
  },
}));

const { listarIdiomas } = await import("./idiomas.api.js");

function crearCliente(respuesta) {
  const llamadas = [];
  const encadenable = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return encadenable;
    },
    order(columna, opciones) {
      llamadas.push({ paso: "order", columna, opciones });
      return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
    },
  };
  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return encadenable;
    },
  };
}

describe("listarIdiomas", () => {
  it("devuelve las opciones con la forma que espera un desplegable", async () => {
    dobles.cliente = crearCliente({
      data: [
        { codigo: "espanol", nombre: "Español" },
        { codigo: "quiche", nombre: "K'iche'" },
      ],
      error: null,
    });

    const { idiomas, error } = await listarIdiomas();

    expect(error).toBeNull();
    expect(idiomas).toEqual([
      { value: "espanol", label: "Español" },
      { value: "quiche", label: "K'iche'" },
    ]);
  });

  // pacientes.idioma referencia idiomas(codigo), no idiomas(id): mandar el id al registrar
  // violaria la clave foranea de la 00110.
  it("el value es el codigo, que es lo que guarda la columna", async () => {
    dobles.cliente = crearCliente({
      data: [{ codigo: "mam", nombre: "Mam", id: "no-deberia-usarse" }],
      error: null,
    });

    const { idiomas } = await listarIdiomas();

    expect(idiomas[0].value).toBe("mam");
  });

  it("pide el catalogo ordenado por nombre", async () => {
    const cliente = crearCliente({ data: [], error: null });
    dobles.cliente = cliente;

    await listarIdiomas();

    expect(cliente.llamadas).toContainEqual({ paso: "from", tabla: "idiomas" });
    expect(cliente.llamadas).toContainEqual({
      paso: "order",
      columna: "nombre",
      opciones: { ascending: true },
    });
  });

  it("falla cerrado: un error del servidor no devuelve un catalogo a medias", async () => {
    dobles.cliente = crearCliente({ data: null, error: { code: "42501" } });

    const { idiomas, error } = await listarIdiomas();

    expect(idiomas).toEqual([]);
    expect(error).not.toBeNull();
  });

  it("una excepcion tampoco revienta la pantalla", async () => {
    dobles.cliente = crearCliente(new Error("se cayo la red"));

    const { idiomas, error } = await listarIdiomas();

    expect(idiomas).toEqual([]);
    expect(error).not.toBeNull();
  });

  it("sin filas devuelve una lista vacia y ningun error", async () => {
    dobles.cliente = crearCliente({ data: null, error: null });

    const { idiomas, error } = await listarIdiomas();

    expect(idiomas).toEqual([]);
    expect(error).toBeNull();
  });
});
