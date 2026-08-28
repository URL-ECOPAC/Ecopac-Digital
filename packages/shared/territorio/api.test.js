// Pruebas de las consultas de Supabase del modulo de territorio.
//
// Mismo patron de mock que packages/shared/jornadas/api.test.js: un doble de obtenerSupabase()
// que registra cada paso de la cadena y resuelve con la respuesta que la prueba le entregue. No
// hay Supabase real ni red.
//
// Ningun dato real: departamentos, municipios y comunidades de prueba son inventados.

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
const { listarComunidades, listarDepartamentos, listarMunicipios, obtenerComunidad } =
  await import("./api.js");

/** Doble minimo de un query builder de supabase-js, igual que jornadas/api.test.js. */
function crearCliente(respuestasPorTabla) {
  const llamadas = [];
  const colas = new Map(
    Object.entries(respuestasPorTabla).map(([tabla, respuesta]) => [
      tabla,
      Array.isArray(respuesta) ? [...respuesta] : [respuesta],
    ]),
  );

  function siguienteRespuesta(tabla) {
    const cola = colas.get(tabla);
    if (!cola || cola.length === 0) {
      throw new Error(`La prueba no configuro una respuesta para la tabla "${tabla}".`);
    }
    return cola.length > 1 ? cola.shift() : cola[0];
  }

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      const respuesta = siguienteRespuesta(tabla);
      const resolver = async () =>
        respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;

      const encadenable = {
        select(columnas) {
          llamadas.push({ paso: "select", tabla, columnas });
          return encadenable;
        },
        eq(columna, valor) {
          llamadas.push({ paso: "eq", tabla, columna, valor });
          return encadenable;
        },
        order(columna, opciones) {
          llamadas.push({ paso: "order", tabla, columna, opciones });
          return encadenable;
        },
        maybeSingle: resolver,
        then(resolve, reject) {
          return resolver().then(resolve, reject);
        },
      };

      return encadenable;
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarDepartamentos", () => {
  it("devuelve las filas ordenadas por nombre", async () => {
    const filas = [{ id: 1, nombre: "Guatemala" }];
    dobles.cliente = crearCliente({ departamentos: { data: filas, error: null } });

    const { departamentos, error } = await listarDepartamentos();

    expect(error).toBeNull();
    expect(departamentos).toEqual(filas);
  });

  it("normaliza el error y devuelve una lista vacia si falla", async () => {
    dobles.cliente = crearCliente({ departamentos: { data: null, error: { code: "42501" } } });

    const { departamentos, error } = await listarDepartamentos();

    expect(departamentos).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("listarMunicipios", () => {
  it("sin departamentoId no filtra por eq", async () => {
    const cliente = crearCliente({ municipios: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarMunicipios();

    expect(cliente.llamadas.some((llamada) => llamada.paso === "eq")).toBe(false);
  });

  it("con departamentoId filtra por departamento_id", async () => {
    const cliente = crearCliente({ municipios: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarMunicipios({ departamentoId: 7 });

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "municipios",
      columna: "departamento_id",
      valor: 7,
    });
  });
});

describe("listarComunidades", () => {
  it("con municipioId filtra por municipio_id", async () => {
    const cliente = crearCliente({ comunidades: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarComunidades({ municipioId: 701 });

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "comunidades",
      columna: "municipio_id",
      valor: 701,
    });
  });
});

describe("obtenerComunidad", () => {
  it("resuelve municipioId y departamentoId desde el embed", async () => {
    dobles.cliente = crearCliente({
      comunidades: {
        data: {
          id: "comunidad-1",
          nombre: "San Juan",
          municipioId: 701,
          municipio: { departamentoId: 7 },
        },
        error: null,
      },
    });

    const { comunidad, error } = await obtenerComunidad("comunidad-1");

    expect(error).toBeNull();
    expect(comunidad).toEqual({
      id: "comunidad-1",
      nombre: "San Juan",
      municipioId: 701,
      departamentoId: 7,
    });
  });

  it("sin id no consulta al servidor", async () => {
    const { comunidad, error } = await obtenerComunidad();

    expect(comunidad).toBeNull();
    expect(error).toBeNull();
  });

  it("fila inexistente devuelve null sin error", async () => {
    dobles.cliente = crearCliente({ comunidades: { data: null, error: null } });

    const { comunidad, error } = await obtenerComunidad("no-existe");

    expect(comunidad).toBeNull();
    expect(error).toBeNull();
  });
});
