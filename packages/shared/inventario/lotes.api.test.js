// Pruebas de las consultas de Supabase de los lotes de medicamentos.
//
// Mismo patron de mock que packages/shared/inventario/medicamentos.api.test.js: un doble de
// obtenerSupabase() que registra cada paso de la cadena y resuelve con la respuesta que la
// prueba le entregue. No hay Supabase real ni red: cada prueba controla exactamente lo que el
// "servidor" contesta, asi que no hace falta .env ni conexion.
//
// Ningun dato real: los numeros de lote y nombres son inventados.

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

const { CODIGOS_DE_ERROR_DE_SUPABASE } = await import("../api/errores-de-supabase.js");
const { actualizarLote, listarLotes, listarLotesDeMedicamento, obtenerLote } =
  await import("./lotes.api.js");

/** Doble de un cliente de Supabase que resuelve con una unica respuesta configurada para "lotes". */
function crearCliente({ respuesta = { data: [], error: null } } = {}) {
  const llamadas = [];

  function crearEncadenable() {
    const resolver = async () =>
      respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;

    const encadenable = {
      insert(valores) {
        llamadas.push({ paso: "insert", valores });
        return encadenable;
      },
      update(valores) {
        llamadas.push({ paso: "update", valores });
        return encadenable;
      },
      select(columnas) {
        llamadas.push({ paso: "select", columnas });
        return encadenable;
      },
      eq(columna, valor) {
        llamadas.push({ paso: "eq", columna, valor });
        return encadenable;
      },
      ilike(columna, valor) {
        llamadas.push({ paso: "ilike", columna, valor });
        return encadenable;
      },
      gte(columna, valor) {
        llamadas.push({ paso: "gte", columna, valor });
        return encadenable;
      },
      lte(columna, valor) {
        llamadas.push({ paso: "lte", columna, valor });
        return encadenable;
      },
      order(columna, opciones) {
        llamadas.push({ paso: "order", columna, opciones });
        return encadenable;
      },
      single: resolver,
      maybeSingle: resolver,
      then(resolve, reject) {
        return resolver().then(resolve, reject);
      },
    };

    return encadenable;
  }

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return crearEncadenable();
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("actualizarLote", () => {
  it("sin id no llama al cliente", async () => {
    const { lote, error } = await actualizarLote();

    expect(lote).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("sin ningun campo reconocido no llama al cliente y no reporta error", async () => {
    const { lote, error } = await actualizarLote("lote-1", { algoQueNoExiste: 1 });

    expect(lote).toBeNull();
    expect(error).toBeNull();
  });

  it("corrige el costo unitario de un lote existente", async () => {
    const cliente = crearCliente({
      respuesta: { data: { id: "lote-1", costoUnitario: "9.99" }, error: null },
    });
    dobles.cliente = cliente;

    const { lote, error } = await actualizarLote("lote-1", { costoUnitario: 9.99 });

    expect(error).toBeNull();
    expect(lote.costoUnitario).toBe(9.99);
    expect(cliente.llamadas).toContainEqual({
      paso: "update",
      valores: { costo_unitario: 9.99 },
    });
    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "id", valor: "lote-1" });
  });

  it("normaliza como permiso denegado el intento de quien no puede corregir el lote (00107)", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: null, error: { code: "42501" } } });

    const { lote, error } = await actualizarLote("lote-1", { costoUnitario: 5 });

    expect(lote).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("obtenerLote (issue #791)", () => {
  it("sin id no llama al cliente", async () => {
    const { lote, error } = await obtenerLote();

    expect(lote).toBeNull();
    expect(error).toBeNull();
  });

  it("consulta por id y traduce la fila a lote", async () => {
    const cliente = crearCliente({
      respuesta: { data: { id: "lote-1", numeroLote: "L-001" }, error: null },
    });
    dobles.cliente = cliente;

    const { lote, error } = await obtenerLote("lote-1");

    expect(error).toBeNull();
    expect(lote.id).toBe("lote-1");
    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "id", valor: "lote-1" });
  });

  it("un id que no existe devuelve lote null sin error (maybeSingle)", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: null, error: null } });

    const { lote, error } = await obtenerLote("no-existe");

    expect(lote).toBeNull();
    expect(error).toBeNull();
  });

  it("un error del cliente se normaliza", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: null, error: { code: "500" } } });

    const { lote, error } = await obtenerLote("lote-1");

    expect(lote).toBeNull();
    expect(error).not.toBeNull();
  });

  // Las dos que siguen cubrian aLote() a traves de registrarLote(), que se retiro con la issue
  // #846. La traduccion de la fila sigue importando por los caminos de lectura, asi que se
  // conservan aqui: un costo desconocido no es un costo de cero (issue #752).
  it("un lote sin costo conocido llega con costoUnitario null, no 0 (issue #752)", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: { id: "lote-1", costoUnitario: null }, error: null },
    });

    const { lote } = await obtenerLote("lote-1");

    expect(lote.costoUnitario).toBeNull();
  });

  it("un lote con costo conocido lo devuelve como numero (issue #752)", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: { id: "lote-1", costoUnitario: "12.50" }, error: null },
    });

    const { lote } = await obtenerLote("lote-1");

    expect(lote.costoUnitario).toBe(12.5);
  });
});

describe("listarLotes", () => {
  it("sin filtros solo ordena por fecha de vencimiento, sin eq/ilike/gte/lte", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await listarLotes();

    const pasos = cliente.llamadas.map((l) => l.paso);
    expect(pasos).toEqual(["from", "select", "order"]);
    expect(cliente.llamadas).toContainEqual({
      paso: "order",
      columna: "fecha_vencimiento",
      opciones: { ascending: true },
    });
  });

  it("filtra los lotes de un medicamento, siempre ordenados por fecha de vencimiento", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await listarLotes({ medicamento: "med-1" });

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "medicamento_id",
      valor: "med-1",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "order",
      columna: "fecha_vencimiento",
      opciones: { ascending: true },
    });
  });

  it("filtra los lotes que vencen dentro de un rango de fechas", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await listarLotes({ fechaDesde: "2026-01-01", fechaHasta: "2026-03-31" });

    expect(cliente.llamadas).toContainEqual({
      paso: "gte",
      columna: "fecha_vencimiento",
      valor: "2026-01-01",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "lte",
      columna: "fecha_vencimiento",
      valor: "2026-03-31",
    });
  });

  it("un extremo del rango puede venir solo", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await listarLotes({ fechaDesde: "2026-01-01" });

    expect(cliente.llamadas.some((l) => l.paso === "gte")).toBe(true);
    expect(cliente.llamadas.some((l) => l.paso === "lte")).toBe(false);
  });

  it("busca por numero de lote y filtra por proveedor", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await listarLotes({ busqueda: "L-00", proveedor: "prov-1" });

    expect(cliente.llamadas).toContainEqual({
      paso: "ilike",
      columna: "numero_lote",
      valor: "%L-00%",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "proveedor_id",
      valor: "prov-1",
    });
  });

  it("marca vencido un lote cuya fecha de vencimiento ya paso, sin que lo calcule quien llama", async () => {
    dobles.cliente = crearCliente({
      respuesta: {
        data: [
          { id: "lote-vencido", fechaVencimiento: "2000-01-01" },
          { id: "lote-vigente", fechaVencimiento: "2999-01-01" },
        ],
        error: null,
      },
    });

    const { lotes, error } = await listarLotes();

    expect(error).toBeNull();
    expect(lotes.find((l) => l.id === "lote-vencido").vencido).toBe(true);
    expect(lotes.find((l) => l.id === "lote-vigente").vencido).toBe(false);
  });

  it("nunca devuelve null: una lista vacia se dibuja sola", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: null, error: null } });

    const { lotes, error } = await listarLotes();

    expect(error).toBeNull();
    expect(lotes).toEqual([]);
  });

  it("clasifica como fallo de red la excepcion del fetch", async () => {
    dobles.cliente = crearCliente({ respuesta: new Error("Failed to fetch") });

    const { lotes, error } = await listarLotes();

    expect(lotes).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED);
  });
});

describe("listarLotesDeMedicamento", () => {
  it("sin id no toca el cliente", async () => {
    const { lotes, error } = await listarLotesDeMedicamento(undefined);

    expect(lotes).toEqual([]);
    expect(error).toBeNull();
  });

  it("delega en listarLotes filtrando por el medicamento", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await listarLotesDeMedicamento("med-1");

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "medicamento_id",
      valor: "med-1",
    });
  });
});
