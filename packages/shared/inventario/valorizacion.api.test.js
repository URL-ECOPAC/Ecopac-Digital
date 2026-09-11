import { beforeEach, describe, expect, it, vi } from "vitest";

const { dobles } = vi.hoisted(() => ({ dobles: { cliente: null } }));

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: () => {
    if (dobles.cliente === null) {
      throw new Error("Ninguna prueba debia llegar hasta el cliente de Supabase.");
    }
    return dobles.cliente;
  },
}));

const { obtenerValorDeInventario, totalizarValorizacion } = await import("./valorizacion.api.js");

function crearCliente({ respuesta = { data: [], error: null } } = {}) {
  const llamadas = [];

  return {
    llamadas,
    rpc(nombre, parametros) {
      llamadas.push({ paso: "rpc", nombre, parametros });
      return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
    },
  };
}

const FILA_CON_COSTO = {
  bodega_id: "bod-1",
  bodega: "Bodega Principal",
  medicamento_id: "med-1",
  medicamento: "Loratadina",
  origen: "compra",
  cantidad_disponible: 300,
  valor_disponible: 750,
  unidades_sin_costo: 0,
  lotes_sin_costo: 0,
};

const FILA_SIN_COSTO = {
  bodega_id: "bod-1",
  bodega: "Bodega Principal",
  medicamento_id: "med-2",
  medicamento: "Amoxicilina",
  origen: "donacion",
  cantidad_disponible: 80,
  valor_disponible: null,
  unidades_sin_costo: 80,
  lotes_sin_costo: 1,
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("obtenerValorDeInventario", () => {
  it("llama a fn_valor_de_inventario_disponible con p_bodega_id", async () => {
    const cliente = crearCliente({ respuesta: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerValorDeInventario({ bodega: "bod-1" });

    expect(cliente.llamadas).toEqual([
      {
        paso: "rpc",
        nombre: "fn_valor_de_inventario_disponible",
        parametros: { p_bodega_id: "bod-1" },
      },
    ]);
  });

  it("sin bodega manda p_bodega_id en null, para sumar todas", async () => {
    const cliente = crearCliente({ respuesta: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerValorDeInventario();

    expect(cliente.llamadas[0].parametros).toEqual({ p_bodega_id: null });
  });

  it("traduce cada fila a camelCase, sin inventar ceros donde la base dice null", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: [FILA_CON_COSTO, FILA_SIN_COSTO], error: null },
    });

    const { valorizacion, error } = await obtenerValorDeInventario();

    expect(error).toBeNull();
    expect(valorizacion).toEqual([
      {
        bodegaId: "bod-1",
        bodega: "Bodega Principal",
        medicamentoId: "med-1",
        medicamento: "Loratadina",
        origen: "compra",
        cantidadDisponible: 300,
        valorDisponible: 750,
        unidadesSinCosto: 0,
        lotesSinCosto: 0,
      },
      {
        bodegaId: "bod-1",
        bodega: "Bodega Principal",
        medicamentoId: "med-2",
        medicamento: "Amoxicilina",
        origen: "donacion",
        cantidadDisponible: 80,
        valorDisponible: null,
        unidadesSinCosto: 80,
        lotesSinCosto: 1,
      },
    ]);
  });

  it("un error de la funcion se normaliza (incluido el rechazo de rol, 42501)", async () => {
    dobles.cliente = crearCliente({
      respuesta: {
        data: null,
        error: {
          code: "42501",
          message:
            "Solo administracion y los roles consultivos consultan la valorizacion de inventario.",
        },
      },
    });

    const { valorizacion, error } = await obtenerValorDeInventario();

    expect(valorizacion).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe("totalizarValorizacion", () => {
  it("suma el valor solo entre filas con costo conocido", () => {
    const filas = [
      { valorDisponible: 750, unidadesSinCosto: 0, lotesSinCosto: 0 },
      { valorDisponible: null, unidadesSinCosto: 80, lotesSinCosto: 1 },
      { valorDisponible: 140, unidadesSinCosto: 0, lotesSinCosto: 0 },
    ];

    expect(totalizarValorizacion(filas)).toEqual({
      valorDisponible: 890,
      unidadesSinCosto: 80,
      lotesSinCosto: 1,
    });
  });

  it("si ninguna fila tiene costo conocido, el total tambien es null, no cero", () => {
    const filas = [
      { valorDisponible: null, unidadesSinCosto: 80, lotesSinCosto: 1 },
      { valorDisponible: null, unidadesSinCosto: 20, lotesSinCosto: 1 },
    ];

    expect(totalizarValorizacion(filas)).toEqual({
      valorDisponible: null,
      unidadesSinCosto: 100,
      lotesSinCosto: 2,
    });
  });

  it("sin filas no revienta: todo en cero, y valorDisponible en null", () => {
    expect(totalizarValorizacion([])).toEqual({
      valorDisponible: null,
      unidadesSinCosto: 0,
      lotesSinCosto: 0,
    });
    expect(() => totalizarValorizacion()).not.toThrow();
  });
});
