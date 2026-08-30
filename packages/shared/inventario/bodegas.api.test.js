// Pruebas de las consultas de Supabase de bodegas y proveedores (issue #143).
//
// Mismo patron de mock que lotes.api.test.js: un doble de obtenerSupabase() que registra cada paso
// de la cadena y resuelve con la respuesta que la prueba le entregue. No hay Supabase real ni red.
//
// La razon de ser de este archivo: la primera version de esta API (servicios/inventarioServicio.ts)
// no tenia pruebas, y por eso nadie noto que consultaba columnas inexistentes. Varios casos de
// aqui afirman explicitamente que se piden las columnas de 00017_proveedores_bodegas.sql y no las
// que aquel archivo inventaba.
//
// Ningun dato real: los nombres son inventados.

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
const { actualizarBodega, listarBodegas, obtenerBodega, registrarBodega } =
  await import("./bodegas.api.js");
const { listarProveedores, registrarProveedor } = await import("./proveedores.api.js");

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

/** Columnas seleccionadas en la ultima consulta, como una sola cadena. */
function columnasPedidas(cliente) {
  return cliente.llamadas.find((llamada) => llamada.paso === "select")?.columnas ?? "";
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("registrarBodega", () => {
  it("sin nombre devuelve CAMPO_REQUERIDO sin llamar al cliente", async () => {
    const { bodega, error } = await registrarBodega({ ubicacion: "Xela" });

    expect(bodega).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("manda es_movil y no una columna tipo, que no existe en la tabla", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: { id: "b-1", nombre: "Central", esMovil: false }, error: null },
    });

    await registrarBodega({ nombre: "Central", ubicacion: "Xela", esMovil: false });

    const insert = dobles.cliente.llamadas.find((llamada) => llamada.paso === "insert");
    expect(insert.valores).toEqual({ nombre: "Central", ubicacion: "Xela", es_movil: false });
    expect(insert.valores).not.toHaveProperty("tipo");
    expect(insert.valores).not.toHaveProperty("activa");
  });

  it("devuelve el error normalizado si la base rechaza", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "23505", message: "duplicada" } },
    });

    const { bodega, error } = await registrarBodega({ nombre: "Central" });

    expect(bodega).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("actualizarBodega", () => {
  it("sin id o sin cambios devuelve CAMPO_REQUERIDO sin llamar al cliente", async () => {
    expect((await actualizarBodega(null, { nombre: "X" })).error.codigo).toBe(
      CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
    );
    expect((await actualizarBodega("b-1", {})).error.codigo).toBe(
      CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
    );
  });

  it("solo manda las claves presentes", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: { id: "b-1" }, error: null } });

    await actualizarBodega("b-1", { ubicacion: "Solola" });

    const update = dobles.cliente.llamadas.find((llamada) => llamada.paso === "update");
    expect(update.valores).toEqual({ ubicacion: "Solola" });
  });
});

describe("listarBodegas", () => {
  it("no pide existencias si no se le piden", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    await listarBodegas();

    expect(columnasPedidas(dobles.cliente)).not.toContain("existencias");
  });

  it("pide las existencias por la relacion real, no por lotes", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    await listarBodegas({ conExistencias: true });

    const columnas = columnasPedidas(dobles.cliente);
    // La version anterior pedia `existencias:lotes(cantidad_actual)`: lotes no tiene llave
    // foranea a bodegas ni columna cantidad_actual (00020).
    expect(columnas).toContain("existencias(cantidad_disponible)");
    expect(columnas).not.toContain("lotes(");
  });

  it("suma cantidad_disponible de cada existencia", async () => {
    dobles.cliente = crearCliente({
      respuesta: {
        data: [
          {
            id: "b-1",
            nombre: "Central",
            esMovil: false,
            existencias: [{ cantidad_disponible: 40 }, { cantidad_disponible: 60 }],
          },
        ],
        error: null,
      },
    });

    const { bodegas } = await listarBodegas({ conExistencias: true });

    expect(bodegas[0].existenciasTotales).toBe(100);
  });

  it("deja existenciasTotales en null cuando la consulta no las pidio", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: [{ id: "b-1", nombre: "Central", esMovil: true }], error: null },
    });

    const { bodegas } = await listarBodegas();

    expect(bodegas[0].existenciasTotales).toBeNull();
  });

  it("filtra por es_movil, incluso cuando el valor es false", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    await listarBodegas({ esMovil: false });

    const eq = dobles.cliente.llamadas.find((llamada) => llamada.paso === "eq");
    expect(eq).toEqual({ paso: "eq", columna: "es_movil", valor: false });
  });

  it("devuelve un arreglo vacio si la base falla", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "42501", message: "denegado" } },
    });

    const { bodegas, error } = await listarBodegas();

    expect(bodegas).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe("obtenerBodega", () => {
  it("sin id devuelve CAMPO_REQUERIDO sin llamar al cliente", async () => {
    const { error } = await obtenerBodega();

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });
});

describe("registrarProveedor", () => {
  it("exige nombre y tipo, las dos columnas NOT NULL de la 00017", async () => {
    expect((await registrarProveedor({ nombre: "Farmacia Sur" })).error.codigo).toBe(
      CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
    );
    expect((await registrarProveedor({ tipo: "comercial" })).error.codigo).toBe(
      CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
    );
  });

  it("manda contacto y no telefono ni correo, que no existen en la tabla", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: { id: "p-1" }, error: null } });

    await registrarProveedor({
      nombre: "Farmacia Sur",
      tipo: "comercial",
      contacto: "Ana Perez",
    });

    const insert = dobles.cliente.llamadas.find((llamada) => llamada.paso === "insert");
    expect(insert.valores).toEqual({
      nombre: "Farmacia Sur",
      tipo: "comercial",
      contacto: "Ana Perez",
    });
    expect(insert.valores).not.toHaveProperty("activo");
    expect(insert.valores).not.toHaveProperty("telefono");
    expect(insert.valores).not.toHaveProperty("correo");
  });
});

describe("listarProveedores", () => {
  it("no pide una columna activo, que no existe", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    await listarProveedores();

    expect(columnasPedidas(dobles.cliente)).not.toContain("activo");
  });

  it("filtra por tipo y busca por nombre", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    await listarProveedores({ busqueda: "farmacia", tipo: "donante" });

    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "ilike",
      columna: "nombre",
      valor: "%farmacia%",
    });
    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "tipo",
      valor: "donante",
    });
  });
});
