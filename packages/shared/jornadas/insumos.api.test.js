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
  agregarInsumoAJornada,
  listarBodegasDeLasJornadasDelProyecto,
  listarInsumosDeLasJornadasDelProyecto,
} = await import("./insumos.api.js");
const { resumirInsumosPrevistos } = await import("./useInsumosDeJornada.js");

function doble(respuesta) {
  const llamadas = [];
  const resolver = () => Promise.resolve(respuesta);
  const registrar = (paso) => (valores) => {
    llamadas.push({ paso, valores });
    return cadena;
  };
  const cadena = {
    select: registrar("select"),
    insert: registrar("insert"),
    eq: (columna, valor) => {
      llamadas.push({ paso: "eq", columna, valor });
      return cadena;
    },
    order: () => cadena,
    not: () => cadena,
    single: resolver,
    then: (alCumplir, alFallar) => resolver().then(alCumplir, alFallar),
  };
  return {
    llamadas,
    cliente: {
      from(tabla) {
        llamadas.push({ paso: "from", tabla });
        return cadena;
      },
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarInsumosDeLasJornadasDelProyecto", () => {
  it("filtra por el proyecto de la jornada y trae el nombre y la fecha de cada jornada", async () => {
    const { cliente, llamadas } = doble({
      data: [
        {
          id: "i-1",
          jornadaId: "j-1",
          medicamentoId: "m-1",
          cantidad: 3,
          unidad: "cajas",
          costoUnitarioEstimado: "10.50",
          nota: null,
          articulo: { nombre: "Guantes", concentracion: "talla M" },
          jornada: { nombre: "Jornada 1", fecha: "2026-10-01", proyecto_id: "p-1" },
        },
      ],
      error: null,
    });
    dobles.cliente = cliente;

    const { insumos, error } = await listarInsumosDeLasJornadasDelProyecto("p-1");

    expect(error).toBeNull();
    expect(llamadas).toContainEqual({ paso: "from", tabla: "jornada_insumos" });
    expect(llamadas).toContainEqual({ paso: "eq", columna: "jornada.proyecto_id", valor: "p-1" });
    expect(insumos[0]).toMatchObject({
      articuloNombre: "Guantes (talla M)",
      costoTotalEstimado: 31.5,
      jornadaNombre: "Jornada 1",
      jornadaFecha: "2026-10-01",
    });
    expect(insumos[0]).not.toHaveProperty("jornada");
  });

  it("sin proyecto no sale a la red", async () => {
    expect(await listarInsumosDeLasJornadasDelProyecto(undefined)).toEqual({
      insumos: [],
      error: null,
    });
  });
});

describe("listarBodegasDeLasJornadasDelProyecto", () => {
  it("deja fuera la bodega principal y lista aparte las jornadas que la usan (00181)", async () => {
    const { cliente } = doble({
      data: [
        { id: "j-1", nombre: "Norte", bodegaId: "b-1", bodega: { nombre: "Botiquin A" } },
        { id: "j-2", nombre: "Sur", bodegaId: "b-1", bodega: { nombre: "Botiquin A" } },
        {
          id: "j-3",
          nombre: "Centro",
          bodegaId: "b-p",
          bodega: { nombre: "Bodega Principal", esPrincipal: true },
        },
      ],
      error: null,
    });
    dobles.cliente = cliente;

    const { bodegas, jornadasConBodegaPrincipal, error } =
      await listarBodegasDeLasJornadasDelProyecto("p-1");

    expect(error).toBeNull();
    expect(bodegas).toEqual([
      { bodegaId: "b-1", bodegaNombre: "Botiquin A", jornadas: ["Norte", "Sur"] },
    ]);
    expect(jornadasConBodegaPrincipal).toEqual([{ id: "j-3", nombre: "Centro" }]);
  });

  it("sin proyecto no consulta", async () => {
    expect(await listarBodegasDeLasJornadasDelProyecto()).toEqual({
      bodegas: [],
      jornadasConBodegaPrincipal: [],
      error: null,
    });
  });
});

describe("agregarInsumoAJornada", () => {
  it("inserta en jornada_insumos con la jornada y las columnas en snake_case", async () => {
    const { cliente, llamadas } = doble({ data: { id: "i-1" }, error: null });
    dobles.cliente = cliente;

    await agregarInsumoAJornada("j-1", {
      medicamentoId: "m-1",
      cantidad: "4",
      unidad: " cajas ",
      costoUnitarioEstimado: "",
      nota: "  ",
    });

    expect(llamadas).toContainEqual({
      paso: "insert",
      valores: {
        medicamento_id: "m-1",
        cantidad: 4,
        unidad: "cajas",
        costo_unitario_estimado: null,
        nota: null,
        jornada_id: "j-1",
      },
    });
  });
});

describe("resumirInsumosPrevistos", () => {
  it("suma lo que tiene costo y cuenta aparte lo que no, sin fingir un total", () => {
    expect(
      resumirInsumosPrevistos([
        { costoTotalEstimado: 10.1 },
        { costoTotalEstimado: 0.2 },
        { costoTotalEstimado: null },
      ]),
    ).toEqual({ totalEstimado: 10.3, sinCosto: 1 });
  });
});
