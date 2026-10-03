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

const {
  aConsumoDeLote,
  cargarInsumoABodegaDeJornada,
  jornadaUsaBodegaPrincipal,
  listarConsumoDeInsumosDeJornada,
  mensajeDeInventarioCargado,
  resumirConsumoDeJornada,
  tieneInventarioCargado,
} = await import("./bodega.api.js");

function dobleRpc(respuesta) {
  const llamadas = [];
  return {
    llamadas,
    cliente: {
      rpc(funcion, parametros) {
        llamadas.push({ funcion, parametros });
        return Promise.resolve(respuesta);
      },
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

const FILA = {
  lote_id: "l-1",
  medicamento_id: "m-1",
  articulo: "Acetaminofen",
  concentracion: "500 mg",
  numero_lote: "L-1",
  fecha_vencimiento: "2027-01-31",
  costo_unitario: "0.50",
  cargado: 200,
  entregado: 35,
  devuelto: 15,
  en_bodega: 150,
};

describe("aConsumoDeLote", () => {
  it("valoriza lo cargado, lo entregado y lo que queda con el costo del lote", () => {
    expect(aConsumoDeLote(FILA)).toEqual({
      loteId: "l-1",
      medicamentoId: "m-1",
      articulo: "Acetaminofen (500 mg)",
      numeroLote: "L-1",
      fechaVencimiento: "2027-01-31",
      costoUnitario: 0.5,
      cargado: 200,
      entregado: 35,
      devuelto: 15,
      enBodega: 150,
      valorCargado: 100,
      valorEntregado: 17.5,
      valorDevuelto: 7.5,
      valorEnBodega: 75,
    });
  });

  it("sin costo conocido, los valores quedan en null y no en cero", () => {
    const fila = aConsumoDeLote({ ...FILA, costo_unitario: null });
    expect(fila.valorCargado).toBeNull();
    expect(fila.valorEntregado).toBeNull();
    expect(fila.valorEnBodega).toBeNull();
  });
});

describe("resumirConsumoDeJornada", () => {
  it("suma solo lo que tiene costo y cuenta los lotes sin costo", () => {
    const consumo = [aConsumoDeLote(FILA), aConsumoDeLote({ ...FILA, costo_unitario: null })];
    expect(resumirConsumoDeJornada(consumo)).toEqual({
      valorCargado: 100,
      valorEntregado: 17.5,
      valorDevuelto: 7.5,
      valorEnBodega: 75,
      unidadesEntregadas: 70,
      lotesSinCosto: 1,
    });
  });
});

describe("cargarInsumoABodegaDeJornada", () => {
  it("llama a la funcion de la 00178 con la cantidad como numero", async () => {
    const { cliente, llamadas } = dobleRpc({ data: "mov-1", error: null });
    dobles.cliente = cliente;

    const resultado = await cargarInsumoABodegaDeJornada({
      jornadaId: "j-1",
      loteId: "l-1",
      bodegaOrigenId: "b-1",
      cantidad: "20",
    });

    expect(resultado).toEqual({ ingresoId: "mov-1", error: null });
    expect(llamadas).toEqual([
      {
        funcion: "fn_cargar_insumo_a_bodega_de_jornada",
        parametros: {
          p_jornada_id: "j-1",
          p_lote_id: "l-1",
          p_bodega_origen_id: "b-1",
          p_cantidad: 20,
        },
      },
    ]);
  });

  it("sin jornada, lote u origen no llama a la base", async () => {
    expect(await cargarInsumoABodegaDeJornada({ jornadaId: "j-1" })).toEqual({
      ingresoId: null,
      error: null,
    });
  });

  it("un rechazo de la base llega normalizado", async () => {
    dobles.cliente = dobleRpc({ data: null, error: { code: "42501", message: "x" } }).cliente;
    const { ingresoId, error } = await cargarInsumoABodegaDeJornada({
      jornadaId: "j-1",
      loteId: "l-1",
      bodegaOrigenId: "b-1",
      cantidad: 1,
    });
    expect(ingresoId).toBeNull();
    expect(error.codigo).toBe("permiso_denegado");
  });
});

describe("listarConsumoDeInsumosDeJornada", () => {
  it("devuelve las filas de la funcion ya valorizadas", async () => {
    dobles.cliente = dobleRpc({ data: [FILA], error: null }).cliente;
    const { consumo, error } = await listarConsumoDeInsumosDeJornada("j-1");
    expect(error).toBeNull();
    expect(consumo).toHaveLength(1);
    expect(consumo[0].valorEntregado).toBe(17.5);
  });
});

describe("bodega principal en la jornada (00181)", () => {
  it("la jornada usa la principal solo si su bodega lo es", () => {
    expect(
      jornadaUsaBodegaPrincipal({ botiquinBodegaId: "b-1", botiquinBodega: { esPrincipal: true } }),
    ).toBe(true);
    expect(
      jornadaUsaBodegaPrincipal({
        botiquinBodegaId: "b-2",
        botiquinBodega: { esPrincipal: false },
      }),
    ).toBe(false);
    expect(jornadaUsaBodegaPrincipal({ botiquinBodegaId: null })).toBe(false);
    expect(jornadaUsaBodegaPrincipal(null)).toBe(false);
  });

  it("hay inventario cargado si algun lote se cargo y sigue en la bodega", () => {
    expect(tieneInventarioCargado([{ cargado: 10, enBodega: 4 }])).toBe(true);
    expect(tieneInventarioCargado([{ cargado: 10, enBodega: 0 }])).toBe(false);
    // Lo que la bodega trae de otra jornada no es de esta.
    expect(tieneInventarioCargado([{ cargado: 0, enBodega: 30 }])).toBe(false);
    expect(tieneInventarioCargado()).toBe(false);
  });

  it("el mensaje nombra la bodega cuando se conoce", () => {
    expect(mensajeDeInventarioCargado("Botiquin A")).toMatch(/«Botiquin A»/);
    expect(mensajeDeInventarioCargado()).toMatch(/^La bodega todavía tiene inventario cargado/);
  });
});
