import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

const { dobles } = vi.hoisted(() => ({ dobles: { cliente: null } }));

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: () => {
    if (dobles.cliente === null) {
      throw new Error("Ninguna prueba debia llegar hasta el cliente de Supabase.");
    }
    return dobles.cliente;
  },
}));

const { consultarExistencias, consultarExistenciasDeBodega } = await import("./existencias.api.js");

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

const FILA = {
  medicamento_id: "med-1",
  medicamento: "Amoxicilina",
  concentracion: "500 mg",
  presentacion: "capsula",
  marca: "Generico",
  componentes: ["Amoxicilina"],
  cantidad_disponible: 120,
  fecha_vencimiento_proxima: "2027-03-01",
  lotes_disponibles: 3,
  total_medicamentos: 7,
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("consultarExistencias", () => {
  it("llama a fn_existencias_disponibles con los valores por defecto", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await consultarExistencias();

    expect(cliente.llamadas[0]).toEqual({
      paso: "rpc",
      nombre: "fn_existencias_disponibles",
      parametros: {
        p_bodega_id: null,
        p_busqueda: null,
        p_limite: 50,
        p_desplazamiento: 0,
      },
    });
  });

  it("traduce la fila de la base al objeto que consumen las pantallas", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [FILA], error: null } });

    const { existencias, error } = await consultarExistencias();

    expect(error).toBeNull();
    expect(existencias).toEqual([
      {
        medicamentoId: "med-1",
        medicamento: "Amoxicilina",
        concentracion: "500 mg",
        presentacion: "capsula",
        marca: "Generico",
        componentes: ["Amoxicilina"],
        cantidadDisponible: 120,
        fechaVencimientoProxima: "2027-03-01",
        lotesDisponibles: 3,
      },
    ]);
  });

  it("devuelve el total sin paginar que viene repetido en cada fila", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [FILA, FILA], error: null } });

    const { total } = await consultarExistencias();

    expect(total).toBe(7);
  });

  it("convierte el numero de pagina en desplazamiento", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await consultarExistencias({ limite: 20, pagina: 3 });

    expect(cliente.llamadas[0].parametros.p_limite).toBe(20);
    expect(cliente.llamadas[0].parametros.p_desplazamiento).toBe(40);
  });

  it("pasa la bodega y la busqueda cuando vienen", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await consultarExistencias({ bodega: "bod-1", busqueda: "amoxi" });

    expect(cliente.llamadas[0].parametros.p_bodega_id).toBe("bod-1");
    expect(cliente.llamadas[0].parametros.p_busqueda).toBe("amoxi");
  });

  it.each([
    ["bodega vacia", { bodega: "" }, "p_bodega_id"],
    ["busqueda vacia", { busqueda: "" }, "p_busqueda"],
  ])("%s viaja como null y no como cadena vacia", async (_caso, filtros, parametro) => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await consultarExistencias(filtros);

    expect(cliente.llamadas[0].parametros[parametro]).toBeNull();
  });

  it.each([
    ["limite cero", { limite: 0 }, 50, 0],
    ["limite negativo", { limite: -5 }, 1, 0],
    ["pagina cero", { pagina: 0 }, 50, 0],
    ["pagina negativa", { pagina: -2 }, 50, 0],
  ])("%s se normaliza a un rango valido", async (_caso, filtros, limite, desplazamiento) => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await consultarExistencias(filtros);

    expect(cliente.llamadas[0].parametros.p_limite).toBe(limite);
    expect(cliente.llamadas[0].parametros.p_desplazamiento).toBe(desplazamiento);
  });

  it("una lista vacia devuelve total cero y no revienta", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    const { existencias, total, error } = await consultarExistencias();

    expect(existencias).toEqual([]);
    expect(total).toBe(0);
    expect(error).toBeNull();
  });

  it("un error de la base se normaliza y devuelve lista vacia", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "42501", message: "denegado" } },
    });

    const { existencias, total, error } = await consultarExistencias();

    expect(existencias).toEqual([]);
    expect(total).toBe(0);
    expect(error).not.toBeNull();
  });

  it("un fallo de red llega como excepcion y tambien se normaliza", async () => {
    dobles.cliente = crearCliente({ respuesta: new Error("Failed to fetch") });

    const { existencias, error } = await consultarExistencias();

    expect(existencias).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe("consultarExistenciasDeBodega", () => {
  it("sin bodega no llama al cliente", async () => {
    const { existencias, total, error } = await consultarExistenciasDeBodega();

    expect(existencias).toEqual([]);
    expect(total).toBe(0);
    expect(error).toBeNull();
  });

  it("con bodega delega en consultarExistencias con ese filtro", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await consultarExistenciasDeBodega("bod-9", { busqueda: "ibu" });

    expect(cliente.llamadas[0].parametros.p_bodega_id).toBe("bod-9");
    expect(cliente.llamadas[0].parametros.p_busqueda).toBe("ibu");
  });
});
