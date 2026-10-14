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
const {
  crearComunidad,
  actualizarComunidad,
  listarComunidades,
  listarComunidadesCatalogo,
  listarDepartamentos,
  listarMunicipios,
  obtenerComunidad,
} = await import("./api.js");

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
        insert(datos) {
          llamadas.push({ paso: "insert", tabla, datos });
          return encadenable;
        },
        update(datos) {
          llamadas.push({ paso: "update", tabla, datos });
          return encadenable;
        },
        eq(columna, valor) {
          llamadas.push({ paso: "eq", tabla, columna, valor });
          return encadenable;
        },
        ilike(columna, valor) {
          llamadas.push({ paso: "ilike", tabla, columna, valor });
          return encadenable;
        },
        order(columna, opciones) {
          llamadas.push({ paso: "order", tabla, columna, opciones });
          return encadenable;
        },
        maybeSingle: resolver,
        single: resolver,
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
          esVigente: true,
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
      esVigente: true,
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

describe("crearComunidad", () => {
  it("inserta una nueva comunidad correctamente", async () => {
    const mockCreada = {
      id: "comunidad-2",
      nombre: "Nueva Comunidad",
      municipioId: 701,
      esVigente: true,
    };

    const cliente = crearCliente({
      comunidades: { data: mockCreada, error: null },
    });
    dobles.cliente = cliente;

    const { comunidad, error } = await crearComunidad({
      nombre: "Nueva Comunidad",
      municipioId: 701,
    });

    expect(error).toBeNull();
    expect(comunidad).toEqual(mockCreada);
    expect(cliente.llamadas).toContainEqual({
      paso: "insert",
      tabla: "comunidades",
      datos: [
        {
          nombre: "Nueva Comunidad",
          municipio_id: 701,
          es_vigente: true,
          latitud: null,
          longitud: null,
          referencia_acceso: null,
        },
      ],
    });
  });

  it("acepta latitud, longitud y referencia de acceso", async () => {
    const cliente = crearCliente({
      comunidades: { data: { id: "comunidad-3" }, error: null },
    });
    dobles.cliente = cliente;

    await crearComunidad({
      nombre: "Aldea El Mirador",
      municipioId: 701,
      latitud: 14.6349,
      longitud: -90.5069,
      referenciaAcceso: "Desvio a mano derecha pasando el puente",
    });

    expect(cliente.llamadas).toContainEqual({
      paso: "insert",
      tabla: "comunidades",
      datos: [
        {
          nombre: "Aldea El Mirador",
          municipio_id: 701,
          es_vigente: true,
          latitud: 14.6349,
          longitud: -90.5069,
          referencia_acceso: "Desvio a mano derecha pasando el puente",
        },
      ],
    });
  });
});

describe("actualizarComunidad", () => {
  it("actualiza el nombre y estado de vigencia de una comunidad", async () => {
    const mockActualizada = {
      id: "comunidad-1",
      nombre: "San Juan Modificado",
      municipio_id: 701,
      es_vigente: false,
    };

    const cliente = crearCliente({
      comunidades: { data: mockActualizada, error: null },
    });
    dobles.cliente = cliente;

    const { comunidad, error } = await actualizarComunidad("comunidad-1", {
      nombre: "San Juan Modificado",
      esVigente: false,
    });

    expect(error).toBeNull();
    expect(comunidad).toEqual(mockActualizada);
    expect(cliente.llamadas).toContainEqual({
      paso: "update",
      tabla: "comunidades",
      datos: {
        nombre: "San Juan Modificado",
        es_vigente: false,
      },
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "comunidades",
      columna: "id",
      valor: "comunidad-1",
    });
  });

  it("actualiza latitud y longitud sin tocar los demas campos", async () => {
    const cliente = crearCliente({
      comunidades: { data: { id: "comunidad-1" }, error: null },
    });
    dobles.cliente = cliente;

    await actualizarComunidad("comunidad-1", { latitud: 14.5, longitud: -90.3 });

    expect(cliente.llamadas).toContainEqual({
      paso: "update",
      tabla: "comunidades",
      datos: { latitud: 14.5, longitud: -90.3 },
    });
  });

  it("sin id no consulta al servidor", async () => {
    const { comunidad, error } = await actualizarComunidad(undefined, { nombre: "x" });

    expect(comunidad).toBeNull();
    expect(error).toBeNull();
  });
});

describe("listarComunidadesCatalogo", () => {
  it("resuelve el nombre del municipio y del departamento", async () => {
    dobles.cliente = crearCliente({
      comunidades: {
        data: [
          {
            id: "comunidad-1",
            nombre: "San Juan",
            municipioId: 701,
            esVigente: true,
            latitud: 14.5,
            longitud: -90.3,
            referenciaAcceso: null,
            municipio: { nombre: "Antigua Guatemala", departamento: { nombre: "Sacatepequez" } },
          },
        ],
        error: null,
      },
    });

    const { comunidades, error } = await listarComunidadesCatalogo();

    expect(error).toBeNull();
    expect(comunidades).toEqual([
      {
        id: "comunidad-1",
        nombre: "San Juan",
        municipioId: 701,
        esVigente: true,
        latitud: 14.5,
        longitud: -90.3,
        referenciaAcceso: null,
        municipioNombre: "Antigua Guatemala",
        departamentoNombre: "Sacatepequez",
      },
    ]);
  });

  it("con busqueda filtra por ilike sobre el nombre", async () => {
    const cliente = crearCliente({ comunidades: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarComunidadesCatalogo({ busqueda: "san" });

    expect(cliente.llamadas).toContainEqual({
      paso: "ilike",
      tabla: "comunidades",
      columna: "nombre",
      valor: "%san%",
    });
  });

  it("con esVigente false filtra por es_vigente", async () => {
    const cliente = crearCliente({ comunidades: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarComunidadesCatalogo({ esVigente: false });

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "comunidades",
      columna: "es_vigente",
      valor: false,
    });
  });
});
