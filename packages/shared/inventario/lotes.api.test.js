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
const { listarLotes, listarLotesDeMedicamento, registrarLote } = await import("./lotes.api.js");

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

const LOTE_VALIDO = {
  medicamento: "med-1",
  numeroLote: "L-001",
  proveedor: "prov-1",
  origen: "compra",
  cantidadIngresada: 100,
  fechaIngreso: "2026-01-01",
  fechaVencimiento: "2026-12-31",
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("registrarLote", () => {
  it.each([
    ["medicamento", { ...LOTE_VALIDO, medicamento: undefined }],
    ["numeroLote", { ...LOTE_VALIDO, numeroLote: "" }],
    ["cantidadIngresada", { ...LOTE_VALIDO, cantidadIngresada: null }],
    ["fechaIngreso", { ...LOTE_VALIDO, fechaIngreso: undefined }],
    ["fechaVencimiento", { ...LOTE_VALIDO, fechaVencimiento: "" }],
  ])("sin %s devuelve CAMPO_REQUERIDO sin llamar al cliente", async (_campo, datos) => {
    const { lote, error } = await registrarLote(datos);

    expect(lote).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("fechaIngreso es obligatoria aunque la columna tenga DEFAULT en la base", async () => {
    const { error } = await registrarLote({ ...LOTE_VALIDO, fechaIngreso: undefined });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("con datos validos inserta las columnas mapeadas a snake_case", async () => {
    const cliente = crearCliente({
      respuesta: {
        data: {
          id: "lote-1",
          medicamentoId: "med-1",
          numeroLote: "L-001",
          proveedorId: "prov-1",
          origen: "compra",
          cantidadIngresada: 100,
          fechaIngreso: "2026-01-01",
          fechaVencimiento: "2026-12-31",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          medicamento: { nombre: "Amoxicilina" },
          proveedor: { nombre: "Farmacéutica ACME" },
        },
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { lote, error } = await registrarLote(LOTE_VALIDO);

    expect(error).toBeNull();
    expect(cliente.llamadas).toContainEqual({
      paso: "insert",
      valores: {
        medicamento_id: "med-1",
        numero_lote: "L-001",
        proveedor_id: "prov-1",
        origen: "compra",
        cantidad_ingresada: 100,
        fecha_ingreso: "2026-01-01",
        fecha_vencimiento: "2026-12-31",
      },
    });
    expect(lote).toMatchObject({
      id: "lote-1",
      medicamento: "Amoxicilina",
      proveedor: "Farmacéutica ACME",
      numeroLote: "L-001",
    });
  });

  it("normaliza como error CHECK cuando la fecha de vencimiento no es posterior a la de ingreso", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: null, error: { code: "23514" } } });

    const { lote, error } = await registrarLote({
      ...LOTE_VALIDO,
      fechaIngreso: "2026-12-31",
      fechaVencimiento: "2026-01-01",
    });

    expect(lote).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });

  it("normaliza como unicidad la repeticion de numero de lote para el mismo medicamento y proveedor", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: null, error: { code: "23505" } } });

    const { lote, error } = await registrarLote(LOTE_VALIDO);

    expect(lote).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD);
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
