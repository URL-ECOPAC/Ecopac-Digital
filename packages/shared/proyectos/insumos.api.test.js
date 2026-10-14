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
  actualizarInsumoDeProyecto,
  agregarInsumoAProyecto,
  listarInsumosDelProyecto,
  quitarInsumoDeProyecto,
} = await import("./insumos.api.js");

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
    update: registrar("update"),
    delete: registrar("delete"),
    eq: (columna, valor) => {
      llamadas.push({ paso: "eq", columna, valor });
      return cadena;
    },
    order: (columna, opciones) => {
      llamadas.push({ paso: "order", columna, opciones });
      return cadena;
    },
    single: resolver,
    maybeSingle: resolver,
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

const pasos = (llamadas, paso) => llamadas.filter((llamada) => llamada.paso === paso);

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarInsumosDelProyecto", () => {
  it("aplana el articulo y calcula el costo total; sin costo el total es null, no 0", async () => {
    const { cliente, llamadas } = doble({
      data: [
        {
          id: "i-1",
          cantidad: 3,
          costoUnitarioEstimado: 0.1,
          articulo: { nombre: "Guantes", concentracion: "talla M", marca: "X" },
        },
        { id: "i-2", cantidad: 5, costoUnitarioEstimado: null, articulo: null },
        { id: "i-3", cantidad: 4, costoUnitarioEstimado: 0, articulo: { nombre: "Gasas" } },
      ],
      error: null,
    });
    dobles.cliente = cliente;

    const { insumos, error } = await listarInsumosDelProyecto("p-1");

    expect(error).toBeNull();
    expect(pasos(llamadas, "from")[0].tabla).toBe("proyecto_insumos");
    expect(pasos(llamadas, "eq")[0]).toMatchObject({ columna: "proyecto_id", valor: "p-1" });
    expect(insumos[0].articuloNombre).toBe("Guantes (talla M)");
    // 3 x 0.1 en binario da 0.30000000000000004: se redondea a centavos.
    expect(insumos[0].costoTotalEstimado).toBe(0.3);
    expect(insumos[1].costoTotalEstimado).toBeNull();
    // Costo cero es un costo estimado de cero, distinto de "no estimado".
    expect(insumos[2].costoTotalEstimado).toBe(0);
    expect(insumos[0]).not.toHaveProperty("articulo");
  });

  it("sin proyecto no sale a la red y devuelve una lista vacia", async () => {
    expect(await listarInsumosDelProyecto(undefined)).toEqual({ insumos: [], error: null });
  });
});

describe("agregarInsumoAProyecto", () => {
  it("traduce a snake_case, convierte los numeros y manda vacios como NULL", async () => {
    const { cliente, llamadas } = doble({ data: { id: "i-1", cantidad: 10 }, error: null });
    dobles.cliente = cliente;

    await agregarInsumoAProyecto("p-1", {
      medicamentoId: "m-1",
      cantidad: "10",
      unidad: " cajas ",
      costoUnitarioEstimado: "",
      nota: "   ",
    });

    expect(pasos(llamadas, "insert")[0].valores).toEqual({
      medicamento_id: "m-1",
      cantidad: 10,
      unidad: "cajas",
      costo_unitario_estimado: null,
      nota: null,
      proyecto_id: "p-1",
    });
  });

  it("un costo escrito como texto viaja como numero", async () => {
    const { cliente, llamadas } = doble({ data: { id: "i-1", cantidad: 1 }, error: null });
    dobles.cliente = cliente;

    await agregarInsumoAProyecto("p-1", {
      medicamentoId: "m-1",
      cantidad: 1,
      unidad: "u",
      costoUnitarioEstimado: "12.50",
    });

    expect(pasos(llamadas, "insert")[0].valores.costo_unitario_estimado).toBe(12.5);
  });

  it("sin proyecto o sin articulo no sale a la red", async () => {
    expect(await agregarInsumoAProyecto(undefined, { medicamentoId: "m-1" })).toEqual({
      insumo: null,
      error: null,
    });
    expect(await agregarInsumoAProyecto("p-1", {})).toEqual({ insumo: null, error: null });
  });

  it("devuelve el error normalizado cuando la base rechaza", async () => {
    dobles.cliente = doble({ data: null, error: { code: "23514", message: "check" } }).cliente;

    const { insumo, error } = await agregarInsumoAProyecto("p-1", {
      medicamentoId: "m-1",
      cantidad: 1,
      unidad: "u",
    });

    expect(insumo).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("actualizarInsumoDeProyecto", () => {
  it("no cambia el articulo aunque venga en los datos", async () => {
    const { cliente, llamadas } = doble({ data: { id: "i-1", cantidad: 7 }, error: null });
    dobles.cliente = cliente;

    await actualizarInsumoDeProyecto("i-1", { medicamentoId: "otro", cantidad: 7 });

    expect(pasos(llamadas, "update")[0].valores).toEqual({ cantidad: 7 });
  });

  it("dejar el costo vacio lo pone en NULL: se puede borrar una estimacion", async () => {
    const { cliente, llamadas } = doble({ data: { id: "i-1", cantidad: 1 }, error: null });
    dobles.cliente = cliente;

    await actualizarInsumoDeProyecto("i-1", { costoUnitarioEstimado: "" });

    expect(pasos(llamadas, "update")[0].valores).toEqual({ costo_unitario_estimado: null });
  });

  it("sin nada que cambiar no sale a la red", async () => {
    expect(await actualizarInsumoDeProyecto("i-1", { medicamentoId: "otro" })).toEqual({
      insumo: null,
      error: null,
    });
  });
});

describe("quitarInsumoDeProyecto", () => {
  it("cuenta como quitado si se borro una fila", async () => {
    dobles.cliente = doble({ data: [{ id: "i-1" }], error: null }).cliente;

    expect(await quitarInsumoDeProyecto("i-1")).toEqual({ quitado: true, error: null });
  });

  it("si RLS no deja borrar (cero filas) NO dice que se quito", async () => {
    dobles.cliente = doble({ data: [], error: null }).cliente;

    expect(await quitarInsumoDeProyecto("i-1")).toEqual({ quitado: false, error: null });
  });
});
