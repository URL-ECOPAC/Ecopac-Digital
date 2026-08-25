// Pruebas de las consultas de Supabase del catalogo de principios activos.
//
// Sigue el mismo patron de mock que packages/shared/presupuestos/api.test.js y
// packages/shared/jornadas/api.test.js: un doble de obtenerSupabase() que registra cada paso
// de la cadena y resuelve con la respuesta que la prueba le entregue. No hay Supabase real ni
// red: cada prueba controla exactamente lo que el "servidor" contesta, asi que no hace falta
// .env ni conexion.
//
// Ningun dato real: los nombres de principios activos son inventados.

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
const {
  actualizarPrincipioActivo,
  eliminarPrincipioActivo,
  listarPrincipiosActivos,
  registrarPrincipioActivo,
} = await import("./principios-activos.api.js");

/**
 * Doble minimo de un query builder de supabase-js: cada metodo de la cadena registra el paso
 * y devuelve el mismo objeto, para encadenar igual que el cliente real. Solo incluye los
 * metodos que principios-activos.api.js realmente usa (insert, update, delete, select, eq,
 * ilike, order, single, maybeSingle, y el propio builder como thenable para listar()).
 */
function crearCliente(respuesta) {
  const llamadas = [];
  const resolver = async () =>
    respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;

  const encadenable = {
    llamadas,
    insert(valores) {
      llamadas.push({ paso: "insert", valores });
      return encadenable;
    },
    update(valores) {
      llamadas.push({ paso: "update", valores });
      return encadenable;
    },
    delete() {
      llamadas.push({ paso: "delete" });
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

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return encadenable;
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarPrincipiosActivos", () => {
  it("sin busqueda solo ordena por nombre, sin ilike", async () => {
    const cliente = crearCliente({ data: [], error: null });
    dobles.cliente = cliente;

    await listarPrincipiosActivos();

    expect(cliente.llamadas.map((llamada) => llamada.paso)).toEqual(["from", "select", "order"]);
  });

  it("compara contra nombre_normalizado quitando los acentos del termino", async () => {
    const cliente = crearCliente({ data: [], error: null });
    dobles.cliente = cliente;

    await listarPrincipiosActivos({ busqueda: "médico" });

    expect(cliente.llamadas).toContainEqual({
      paso: "ilike",
      columna: "nombre_normalizado",
      valor: "%medico%",
    });
  });

  it("escapa los comodines de ILIKE en la busqueda", async () => {
    const cliente = crearCliente({ data: [], error: null });
    dobles.cliente = cliente;

    await listarPrincipiosActivos({ busqueda: "50%_off" });

    const llamadaIlike = cliente.llamadas.find((llamada) => llamada.paso === "ilike");
    expect(llamadaIlike.valor).not.toContain("%_off");
    expect(llamadaIlike.valor.startsWith("%")).toBe(true);
    expect(llamadaIlike.valor.endsWith("%")).toBe(true);
  });

  it("ignora una busqueda vacia", async () => {
    const cliente = crearCliente({ data: [], error: null });
    dobles.cliente = cliente;

    await listarPrincipiosActivos({ busqueda: "" });

    expect(cliente.llamadas.some((llamada) => llamada.paso === "ilike")).toBe(false);
  });

  it("nunca devuelve null: una lista vacia se dibuja sola", async () => {
    dobles.cliente = crearCliente({ data: null, error: null });

    const { principiosActivos, error } = await listarPrincipiosActivos();

    expect(error).toBeNull();
    expect(principiosActivos).toEqual([]);
  });

  it("clasifica como fallo de red la excepcion del fetch", async () => {
    dobles.cliente = crearCliente(new Error("Failed to fetch"));

    const { principiosActivos, error } = await listarPrincipiosActivos();

    expect(principiosActivos).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED);
  });
});

describe("registrarPrincipioActivo", () => {
  it("inserta el nombre y devuelve la fila creada", async () => {
    const cliente = crearCliente({
      data: { id: "principio-1", nombre: "Paracetamol" },
      error: null,
    });
    dobles.cliente = cliente;

    const { principioActivo, error } = await registrarPrincipioActivo({ nombre: "Paracetamol" });

    expect(error).toBeNull();
    expect(principioActivo).toEqual({ id: "principio-1", nombre: "Paracetamol" });
    expect(cliente.llamadas).toContainEqual({ paso: "insert", valores: { nombre: "Paracetamol" } });
  });

  it("normaliza como unicidad la violacion del nombre duplicado (con o sin acentos)", async () => {
    dobles.cliente = crearCliente({ data: null, error: { code: "23505" } });

    const { principioActivo, error } = await registrarPrincipioActivo({ nombre: "Paracetamol" });

    expect(principioActivo).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD);
  });
});

describe("actualizarPrincipioActivo", () => {
  it("no toca el cliente cuando no hay campos que actualizar", async () => {
    const { principioActivo, error } = await actualizarPrincipioActivo("principio-1", {});

    expect(principioActivo).toBeNull();
    expect(error).toBeNull();
  });

  it("actualiza el nombre por id", async () => {
    const cliente = crearCliente({
      data: { id: "principio-1", nombre: "Acetaminofen" },
      error: null,
    });
    dobles.cliente = cliente;

    const { principioActivo, error } = await actualizarPrincipioActivo("principio-1", {
      nombre: "Acetaminofen",
    });

    expect(error).toBeNull();
    expect(principioActivo).toEqual({ id: "principio-1", nombre: "Acetaminofen" });
    expect(cliente.llamadas).toContainEqual({
      paso: "update",
      valores: { nombre: "Acetaminofen" },
    });
    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "id", valor: "principio-1" });
  });

  it("normaliza como permiso denegado cuando RLS rechaza la edicion", async () => {
    dobles.cliente = crearCliente({ data: null, error: { code: "42501" } });

    const { principioActivo, error } = await actualizarPrincipioActivo("principio-1", {
      nombre: "Acetaminofen",
    });

    expect(principioActivo).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("eliminarPrincipioActivo", () => {
  it("no toca el cliente cuando no hay id", async () => {
    const { principioActivo, error } = await eliminarPrincipioActivo(undefined);

    expect(principioActivo).toBeNull();
    expect(error).toBeNull();
  });

  it("elimina y devuelve la fila eliminada", async () => {
    const cliente = crearCliente({
      data: { id: "principio-1", nombre: "Paracetamol" },
      error: null,
    });
    dobles.cliente = cliente;

    const { principioActivo, error } = await eliminarPrincipioActivo("principio-1");

    expect(error).toBeNull();
    expect(principioActivo).toEqual({ id: "principio-1", nombre: "Paracetamol" });
    expect(cliente.llamadas).toContainEqual({ paso: "delete" });
  });

  it("normaliza como llave foranea el intento de borrar uno asociado a medicamentos", async () => {
    dobles.cliente = crearCliente({ data: null, error: { code: "23503" } });

    const { principioActivo, error } = await eliminarPrincipioActivo("principio-1");

    expect(principioActivo).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.LLAVE_FORANEA);
  });
});
