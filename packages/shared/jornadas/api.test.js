// Pruebas de las consultas de Supabase del modulo de jornadas.
//
// Sigue el mismo patron de mock que packages/shared/presupuestos/api.test.js: un doble de
// obtenerSupabase() que registra cada paso de la cadena y resuelve con la respuesta que la
// prueba le entregue. No hay Supabase real ni red: cada prueba controla exactamente lo que el
// "servidor" contesta, asi que no hace falta .env ni conexion.
//
// Ningun dato real: las jornadas, comunidades y personas son inventadas.

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
const { ROLES } = await import("../usuarios/roles.js");
const { ESTADOS_JORNADA } = await import("./permisos.js");
const { actualizarJornada, listarJornadas, obtenerJornada, registrarJornada } = await import(
  "./api.js"
);

/**
 * Doble minimo de un query builder de supabase-js: cada metodo de la cadena registra el paso
 * (con la tabla, para poder distinguir "select" de jornadas de "select" de jornada_personal) y
 * devuelve el mismo objeto, para encadenar igual que el cliente real. Sirve tanto para lo que
 * termina en .single()/.maybeSingle() como para lo que se espera directamente, que es como
 * listarJornadas() y las tres consultas paralelas de obtenerJornada() usan el builder.
 *
 * `respuestasPorTabla` acepta una respuesta unica o un arreglo: actualizarJornada() consulta
 * "jornadas" dos veces (lee el estado, despues actualiza), asi que esos casos necesitan una
 * respuesta distinta para cada llamada.
 */
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
        insert(valores) {
          llamadas.push({ paso: "insert", tabla, valores });
          return encadenable;
        },
        update(valores) {
          llamadas.push({ paso: "update", tabla, valores });
          return encadenable;
        },
        select(columnas) {
          llamadas.push({ paso: "select", tabla, columnas });
          return encadenable;
        },
        eq(columna, valor) {
          llamadas.push({ paso: "eq", tabla, columna, valor });
          return encadenable;
        },
        gte(columna, valor) {
          llamadas.push({ paso: "gte", tabla, columna, valor });
          return encadenable;
        },
        lte(columna, valor) {
          llamadas.push({ paso: "lte", tabla, columna, valor });
          return encadenable;
        },
        order(columna, opciones) {
          llamadas.push({ paso: "order", tabla, columna, opciones });
          return encadenable;
        },
        single: resolver,
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

describe("registrarJornada", () => {
  it("inserta las columnas mapeadas a snake_case y devuelve la fila creada", async () => {
    const cliente = crearCliente({
      jornadas: { data: { id: "jornada-1", nombre: "Jornada en Solola" }, error: null },
    });
    dobles.cliente = cliente;

    const { jornada, error } = await registrarJornada({
      nombre: "Jornada en Solola",
      fecha: "2026-09-01",
      comunidad: "comunidad-1",
      responsable: "perfil-1",
    });

    expect(error).toBeNull();
    expect(jornada).toEqual({ id: "jornada-1", nombre: "Jornada en Solola" });
    expect(cliente.llamadas).toContainEqual({
      paso: "insert",
      tabla: "jornadas",
      valores: {
        nombre: "Jornada en Solola",
        fecha: "2026-09-01",
        comunidad_id: "comunidad-1",
        responsable_id: "perfil-1",
      },
    });
  });

  it("normaliza como campo obligatorio la violacion de NOT NULL de la base de datos", async () => {
    dobles.cliente = crearCliente({ jornadas: { data: null, error: { code: "23502" } } });

    const { jornada, error } = await registrarJornada({ nombre: "Jornada sin fecha" });

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("clasifica como fallo de red la excepcion del fetch", async () => {
    dobles.cliente = crearCliente({ jornadas: new Error("Failed to fetch") });

    const { jornada, error } = await registrarJornada({ nombre: "Jornada" });

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED);
  });
});

describe("listarJornadas", () => {
  it("sin filtros solo ordena, sin ningun eq, gte o lte", async () => {
    const cliente = crearCliente({ jornadas: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarJornadas();

    expect(cliente.llamadas.map((llamada) => llamada.paso)).toEqual([
      "from",
      "select",
      "order",
      "order",
    ]);
  });

  it("aplica los filtros de estado, comunidad, proyecto y rango de fechas", async () => {
    const cliente = crearCliente({ jornadas: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarJornadas({
      estado: ESTADOS_JORNADA.PLANIFICADA,
      comunidad: "comunidad-1",
      proyecto: "proyecto-1",
      fechaInicio: "2026-01-01",
      fechaFin: "2026-12-31",
    });

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "jornadas",
      columna: "estado",
      valor: ESTADOS_JORNADA.PLANIFICADA,
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "jornadas",
      columna: "comunidad_id",
      valor: "comunidad-1",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "jornadas",
      columna: "proyecto_id",
      valor: "proyecto-1",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "gte",
      tabla: "jornadas",
      columna: "fecha",
      valor: "2026-01-01",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "lte",
      tabla: "jornadas",
      columna: "fecha",
      valor: "2026-12-31",
    });
  });

  it("ignora un filtro vacio en lugar de mandarlo como eq", async () => {
    const cliente = crearCliente({ jornadas: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarJornadas({ estado: "", comunidad: null });

    expect(cliente.llamadas.some((llamada) => llamada.paso === "eq")).toBe(false);
  });

  it("nunca devuelve null: una lista vacia se dibuja sola", async () => {
    dobles.cliente = crearCliente({ jornadas: { data: null, error: null } });

    const { jornadas, error } = await listarJornadas();

    expect(error).toBeNull();
    expect(jornadas).toEqual([]);
  });
});

describe("obtenerJornada", () => {
  it("combina la jornada, su personal y sus contadores en un solo objeto", async () => {
    dobles.cliente = crearCliente({
      jornadas: {
        data: { id: "jornada-1", nombre: "Jornada en Solola", estado: ESTADOS_JORNADA.PLANIFICADA },
        error: null,
      },
      jornada_personal: {
        data: [{ id: "asignacion-1", perfilId: "perfil-1" }],
        error: null,
      },
      vista_reporte_impacto: {
        data: { pacientesAtendidos: 12, consultasRealizadas: 15 },
        error: null,
      },
    });

    const { jornada, error } = await obtenerJornada("jornada-1");

    expect(error).toBeNull();
    expect(jornada).toEqual({
      id: "jornada-1",
      nombre: "Jornada en Solola",
      estado: ESTADOS_JORNADA.PLANIFICADA,
      personal: [{ id: "asignacion-1", perfilId: "perfil-1" }],
      contadores: { pacientesAtendidos: 12, consultasRealizadas: 15 },
    });
  });

  it("no toca el cliente si no hay id", async () => {
    const { jornada, error } = await obtenerJornada(undefined);

    expect(jornada).toBeNull();
    expect(error).toBeNull();
  });

  it("devuelve null sin error cuando la jornada no existe o RLS no la deja ver", async () => {
    dobles.cliente = crearCliente({
      jornadas: { data: null, error: null },
      jornada_personal: { data: [], error: null },
      vista_reporte_impacto: { data: null, error: null },
    });

    const { jornada, error } = await obtenerJornada("jornada-ajena");

    expect(jornada).toBeNull();
    expect(error).toBeNull();
  });

  it("propaga el error si cualquiera de las tres consultas falla", async () => {
    dobles.cliente = crearCliente({
      jornadas: { data: { id: "jornada-1" }, error: null },
      jornada_personal: { data: null, error: { code: "42501" } },
      vista_reporte_impacto: { data: null, error: null },
    });

    const { jornada, error } = await obtenerJornada("jornada-1");

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("actualizarJornada", () => {
  it("no toca el cliente cuando no hay campos que actualizar", async () => {
    const { jornada, error } = await actualizarJornada(
      "jornada-1",
      {},
      { rol: ROLES.ADMINISTRADOR },
    );

    expect(jornada).toBeNull();
    expect(error).toBeNull();
  });

  it("solo consulta jornadas: no trae personal ni contadores para leer el estado", async () => {
    const cliente = crearCliente({
      jornadas: [
        { data: { estado: ESTADOS_JORNADA.PLANIFICADA }, error: null },
        { data: { id: "jornada-1", nombre: "Nuevo nombre" }, error: null },
      ],
    });
    dobles.cliente = cliente;

    await actualizarJornada("jornada-1", { nombre: "Nuevo nombre" }, { rol: ROLES.ADMINISTRADOR });

    const tablasConsultadas = new Set(
      cliente.llamadas.filter((llamada) => llamada.paso === "from").map((llamada) => llamada.tabla),
    );
    expect(tablasConsultadas).toEqual(new Set(["jornadas"]));
  });

  it("bloquea la edicion de una jornada finalizada para quien no es administrador", async () => {
    dobles.cliente = crearCliente({
      jornadas: { data: { estado: ESTADOS_JORNADA.FINALIZADA }, error: null },
    });

    const { jornada, error } = await actualizarJornada(
      "jornada-1",
      { nombre: "Nuevo nombre" },
      { rol: ROLES.MEDICO },
    );

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(error.mensaje).toContain("finalizada");
  });

  it("no llega a actualizar cuando bloquea por jornada finalizada", async () => {
    const cliente = crearCliente({
      jornadas: { data: { estado: ESTADOS_JORNADA.FINALIZADA }, error: null },
    });
    dobles.cliente = cliente;

    await actualizarJornada("jornada-1", { nombre: "Nuevo nombre" }, { rol: ROLES.VOLUNTARIO });

    expect(cliente.llamadas.some((llamada) => llamada.paso === "update")).toBe(false);
  });

  it("permite que la administradora edite una jornada finalizada", async () => {
    dobles.cliente = crearCliente({
      jornadas: [
        { data: { estado: ESTADOS_JORNADA.FINALIZADA }, error: null },
        { data: { id: "jornada-1", nombre: "Nuevo nombre" }, error: null },
      ],
    });

    const { jornada, error } = await actualizarJornada(
      "jornada-1",
      { nombre: "Nuevo nombre" },
      { rol: ROLES.ADMINISTRADOR },
    );

    expect(error).toBeNull();
    expect(jornada).toEqual({ id: "jornada-1", nombre: "Nuevo nombre" });
  });

  it("una jornada no finalizada no se bloquea por rol aqui: RLS es quien decide", async () => {
    dobles.cliente = crearCliente({
      jornadas: [
        { data: { estado: ESTADOS_JORNADA.EN_CURSO }, error: null },
        { data: null, error: { code: "42501" } },
      ],
    });

    const { jornada, error } = await actualizarJornada(
      "jornada-1",
      { nombre: "Nuevo nombre" },
      { rol: ROLES.MEDICO },
    );

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });

  it("no cambia el estado aunque venga en los datos: no esta en el mapa de columnas", async () => {
    const cliente = crearCliente({
      jornadas: [
        { data: { estado: ESTADOS_JORNADA.PLANIFICADA }, error: null },
        { data: { id: "jornada-1" }, error: null },
      ],
    });
    dobles.cliente = cliente;

    await actualizarJornada(
      "jornada-1",
      { nombre: "Nuevo nombre", estado: ESTADOS_JORNADA.CANCELADA },
      { rol: ROLES.ADMINISTRADOR },
    );

    const actualizacion = cliente.llamadas.find((llamada) => llamada.paso === "update");
    expect(actualizacion.valores).toEqual({ nombre: "Nuevo nombre" });
  });
});
