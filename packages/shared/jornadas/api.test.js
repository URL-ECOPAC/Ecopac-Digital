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
const {
  actualizarJornada,
  asignarPersonal,
  cambiarEstadoJornada,
  contarAtencionesIncompletas,
  desasignarPersonal,
  listarJornadas,
  obtenerAsignacionesDelDia,
  obtenerJornada,
  obtenerJornadasDePersona,
  registrarJornada,
} = await import("./api.js");

/**
 * Doble minimo de un query builder de supabase-js: cada metodo de la cadena registra el paso
 * (con la tabla, para poder distinguir "select" de jornadas de "select" de jornada_personal) y
 * devuelve el mismo objeto, para encadenar igual que el cliente real. Sirve tanto para lo que
 * termina en .single()/.maybeSingle() como para lo que se espera directamente, que es como
 * listarJornadas() y las tres consultas paralelas de obtenerJornada() usan el builder.
 *
 * `respuestasPorTabla` acepta una respuesta unica o un arreglo: actualizarJornada() consulta
 * "jornadas" dos veces (lee el estado, despues actualiza), asi que esos casos necesitan una
 * respuesta distinta para cada llamada. Una clave `"rpc:<nombre>"` configura la respuesta de
 * `.rpc(nombre, argumentos)`, que no pasa por `.from()`.
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
        delete() {
          llamadas.push({ paso: "delete", tabla });
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
        neq(columna, valor) {
          llamadas.push({ paso: "neq", tabla, columna, valor });
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
    rpc(nombre, argumentos) {
      llamadas.push({ paso: "rpc", nombre, argumentos });
      const respuesta = siguienteRespuesta(`rpc:${nombre}`);
      return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
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

describe("cambiarEstadoJornada", () => {
  it("solo consulta jornadas: no trae personal ni contadores para leer el estado actual", async () => {
    const cliente = crearCliente({
      jornadas: [
        { data: { estado: ESTADOS_JORNADA.PLANIFICADA }, error: null },
        { data: { id: "jornada-1", estado: ESTADOS_JORNADA.EN_CURSO }, error: null },
      ],
    });
    dobles.cliente = cliente;

    await cambiarEstadoJornada("jornada-1", ESTADOS_JORNADA.EN_CURSO, { rol: ROLES.MEDICO });

    const tablasConsultadas = new Set(
      cliente.llamadas.filter((llamada) => llamada.paso === "from").map((llamada) => llamada.tabla),
    );
    expect(tablasConsultadas).toEqual(new Set(["jornadas"]));
  });

  it("planificada -> en curso tiene exito y actualiza el estado", async () => {
    const cliente = crearCliente({
      jornadas: [
        { data: { estado: ESTADOS_JORNADA.PLANIFICADA }, error: null },
        { data: { id: "jornada-1", estado: ESTADOS_JORNADA.EN_CURSO }, error: null },
      ],
    });
    dobles.cliente = cliente;

    const { jornada, error } = await cambiarEstadoJornada(
      "jornada-1",
      ESTADOS_JORNADA.EN_CURSO,
      { rol: ROLES.MEDICO },
    );

    expect(error).toBeNull();
    expect(jornada).toEqual({ id: "jornada-1", estado: ESTADOS_JORNADA.EN_CURSO });
    expect(cliente.llamadas).toContainEqual({
      paso: "update",
      tabla: "jornadas",
      valores: { estado: ESTADOS_JORNADA.EN_CURSO },
    });
  });

  it("rechaza un salto invalido (planificada -> finalizada) sin llegar a actualizar", async () => {
    const cliente = crearCliente({
      jornadas: { data: { estado: ESTADOS_JORNADA.PLANIFICADA }, error: null },
    });
    dobles.cliente = cliente;

    const { jornada, error } = await cambiarEstadoJornada(
      "jornada-1",
      ESTADOS_JORNADA.FINALIZADA,
      { rol: ROLES.ADMINISTRADOR },
    );

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
    expect(cliente.llamadas.some((llamada) => llamada.paso === "update")).toBe(false);
  });

  it("rechaza la reapertura de una jornada finalizada para quien no es administrador", async () => {
    const cliente = crearCliente({
      jornadas: { data: { estado: ESTADOS_JORNADA.FINALIZADA }, error: null },
    });
    dobles.cliente = cliente;

    const { jornada, error } = await cambiarEstadoJornada(
      "jornada-1",
      ESTADOS_JORNADA.EN_CURSO,
      { rol: ROLES.MEDICO },
    );

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
    expect(error.mensaje).toContain("administrador");
    expect(cliente.llamadas.some((llamada) => llamada.paso === "update")).toBe(false);
  });

  it("permite que la administradora reabra una jornada finalizada", async () => {
    const cliente = crearCliente({
      jornadas: [
        { data: { estado: ESTADOS_JORNADA.FINALIZADA }, error: null },
        { data: { id: "jornada-1", estado: ESTADOS_JORNADA.EN_CURSO }, error: null },
      ],
    });
    dobles.cliente = cliente;

    const { jornada, error } = await cambiarEstadoJornada(
      "jornada-1",
      ESTADOS_JORNADA.EN_CURSO,
      { rol: ROLES.ADMINISTRADOR },
    );

    expect(error).toBeNull();
    expect(jornada).toEqual({ id: "jornada-1", estado: ESTADOS_JORNADA.EN_CURSO });
  });

  it("devuelve sin resultados cuando la jornada no existe", async () => {
    dobles.cliente = crearCliente({ jornadas: { data: null, error: null } });

    const { jornada, error } = await cambiarEstadoJornada("jornada-ajena", ESTADOS_JORNADA.EN_CURSO);

    expect(jornada).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS);
  });
});

describe("contarAtencionesIncompletas", () => {
  it("no toca el cliente si no hay jornadaId", async () => {
    const { cantidad, error } = await contarAtencionesIncompletas(undefined);

    expect(cantidad).toBe(0);
    expect(error).toBeNull();
  });

  it("llama el rpc con el id de la jornada y devuelve la cantidad", async () => {
    const cliente = crearCliente({
      "rpc:fn_contar_atenciones_incompletas": { data: 3, error: null },
    });
    dobles.cliente = cliente;

    const { cantidad, error } = await contarAtencionesIncompletas("jornada-1");

    expect(error).toBeNull();
    expect(cantidad).toBe(3);
    expect(cliente.llamadas).toContainEqual({
      paso: "rpc",
      nombre: "fn_contar_atenciones_incompletas",
      argumentos: { p_jornada_id: "jornada-1" },
    });
  });

  it("normaliza el error del servidor", async () => {
    dobles.cliente = crearCliente({
      "rpc:fn_contar_atenciones_incompletas": { data: null, error: { code: "42501" } },
    });

    const { cantidad, error } = await contarAtencionesIncompletas("jornada-1");

    expect(cantidad).toBe(0);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("asignarPersonal", () => {
  it("inserta la fila mapeada a snake_case, incluido el id de la jornada", async () => {
    const cliente = crearCliente({
      jornada_personal: [
        { data: { id: "asignacion-1", perfilId: "perfil-1", rolEnJornada: "medico" }, error: null },
        { data: [], error: null },
      ],
      jornadas: { data: { fecha: "2026-09-01" }, error: null },
    });
    dobles.cliente = cliente;

    const { asignacion, advertencias, error } = await asignarPersonal("jornada-1", {
      perfil: "perfil-1",
      rolEnJornada: "medico",
      horaInicio: "08:00",
      horaFin: "13:00",
    });

    expect(error).toBeNull();
    expect(advertencias).toEqual([]);
    expect(asignacion).toEqual({
      id: "asignacion-1",
      perfilId: "perfil-1",
      rolEnJornada: "medico",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "insert",
      tabla: "jornada_personal",
      valores: {
        jornada_id: "jornada-1",
        perfil_id: "perfil-1",
        rol_en_jornada: "medico",
        hora_inicio: "08:00",
        hora_fin: "13:00",
      },
    });
  });

  it("advierte, sin bloquear, cuando la persona ya esta asignada a otra jornada el mismo dia", async () => {
    const cliente = crearCliente({
      jornada_personal: [
        { data: { id: "asignacion-1" }, error: null },
        {
          data: [
            {
              perfil: "perfil-1",
              jornadaId: "jornada-2",
              jornada: { nombre: "Jornada en Peten", fecha: "2026-09-01" },
            },
          ],
          error: null,
        },
      ],
      jornadas: { data: { fecha: "2026-09-01" }, error: null },
    });
    dobles.cliente = cliente;

    const { asignacion, advertencias, error } = await asignarPersonal("jornada-1", {
      perfil: "perfil-1",
      rolEnJornada: "medico",
      horaInicio: "08:00",
      horaFin: "13:00",
    });

    expect(error).toBeNull();
    expect(asignacion).toEqual({ id: "asignacion-1" });
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0]).toContain("Jornada en Peten");
  });

  it("no toca el cliente si no hay jornadaId", async () => {
    const { asignacion, advertencias, error } = await asignarPersonal(undefined, {
      perfil: "perfil-1",
    });

    expect(asignacion).toBeNull();
    expect(advertencias).toEqual([]);
    expect(error).toBeNull();
  });

  it("clasifica como unicidad la violacion del UNIQUE(jornada_id, perfil_id): criterio 2", async () => {
    dobles.cliente = crearCliente({
      jornada_personal: { data: null, error: { code: "23505" } },
    });

    const { asignacion, advertencias, error } = await asignarPersonal("jornada-1", {
      perfil: "perfil-1",
    });

    expect(asignacion).toBeNull();
    expect(advertencias).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD);
  });

  it("clasifica como campo requerido omitir horaInicio u horaFin (NOT NULL en la tabla)", async () => {
    dobles.cliente = crearCliente({
      jornada_personal: { data: null, error: { code: "23502" } },
    });

    const { error } = await asignarPersonal("jornada-1", { perfil: "perfil-1" });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });
});

describe("obtenerAsignacionesDelDia", () => {
  it("no toca el cliente si no hay fecha", async () => {
    const { asignaciones, error } = await obtenerAsignacionesDelDia(undefined);

    expect(asignaciones).toEqual([]);
    expect(error).toBeNull();
  });

  it("filtra por la fecha de la jornada embebida y excluye la jornada indicada", async () => {
    const cliente = crearCliente({ jornada_personal: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerAsignacionesDelDia("2026-09-01", { excluirJornada: "jornada-1" });

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "jornada_personal",
      columna: "jornada.fecha",
      valor: "2026-09-01",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "neq",
      tabla: "jornada_personal",
      columna: "jornada_id",
      valor: "jornada-1",
    });
  });

  it("sin excluirJornada no manda ningun neq", async () => {
    const cliente = crearCliente({ jornada_personal: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerAsignacionesDelDia("2026-09-01");

    expect(cliente.llamadas.some((llamada) => llamada.paso === "neq")).toBe(false);
  });

  it("mapea perfil, jornadaId y el nombre de la jornada embebida", async () => {
    dobles.cliente = crearCliente({
      jornada_personal: {
        data: [
          {
            perfil: "perfil-1",
            jornadaId: "jornada-2",
            jornada: { nombre: "Jornada en Peten", fecha: "2026-09-01" },
          },
        ],
        error: null,
      },
    });

    const { asignaciones, error } = await obtenerAsignacionesDelDia("2026-09-01");

    expect(error).toBeNull();
    expect(asignaciones).toEqual([
      { perfil: "perfil-1", jornadaId: "jornada-2", jornadaNombre: "Jornada en Peten" },
    ]);
  });

  it("normaliza el error del servidor", async () => {
    dobles.cliente = crearCliente({
      jornada_personal: { data: null, error: { code: "42501" } },
    });

    const { asignaciones, error } = await obtenerAsignacionesDelDia("2026-09-01");

    expect(asignaciones).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("obtenerJornadasDePersona", () => {
  it("no toca el cliente si no hay perfilId", async () => {
    const { jornadas, error } = await obtenerJornadasDePersona(undefined);

    expect(jornadas).toEqual([]);
    expect(error).toBeNull();
  });

  it("filtra jornada_personal por perfil_id y desenvuelve la jornada embebida", async () => {
    const cliente = crearCliente({
      jornada_personal: {
        data: [
          { jornada: { id: "jornada-1", nombre: "Jornada en Solola" } },
          { jornada: { id: "jornada-2", nombre: "Jornada en Peten" } },
        ],
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { jornadas, error } = await obtenerJornadasDePersona("perfil-1");

    expect(error).toBeNull();
    expect(jornadas).toEqual([
      { id: "jornada-1", nombre: "Jornada en Solola" },
      { id: "jornada-2", nombre: "Jornada en Peten" },
    ]);
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "jornada_personal",
      columna: "perfil_id",
      valor: "perfil-1",
    });
  });

  it("ignora filas sin jornada embebida (la jornada no existe o RLS no la deja ver)", async () => {
    dobles.cliente = crearCliente({
      jornada_personal: { data: [{ jornada: null }], error: null },
    });

    const { jornadas, error } = await obtenerJornadasDePersona("perfil-1");

    expect(error).toBeNull();
    expect(jornadas).toEqual([]);
  });

  it("normaliza el error del servidor", async () => {
    dobles.cliente = crearCliente({
      jornada_personal: { data: null, error: { code: "42501" } },
    });

    const { jornadas, error } = await obtenerJornadasDePersona("perfil-1");

    expect(jornadas).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("desasignarPersonal", () => {
  it("no toca el cliente si falta jornadaId o perfilId", async () => {
    const { desasignado, error } = await desasignarPersonal(undefined, "perfil-1");

    expect(desasignado).toBe(false);
    expect(error).toBeNull();
  });

  it("borra la fila cuando la persona no registro atenciones en la jornada", async () => {
    const cliente = crearCliente({
      "rpc:personal_registro_atenciones": { data: false, error: null },
      jornada_personal: { data: null, error: null },
    });
    dobles.cliente = cliente;

    const { desasignado, error } = await desasignarPersonal("jornada-1", "perfil-1");

    expect(error).toBeNull();
    expect(desasignado).toBe(true);
    expect(cliente.llamadas).toContainEqual({
      paso: "rpc",
      nombre: "personal_registro_atenciones",
      argumentos: { p_jornada_id: "jornada-1", p_perfil_id: "perfil-1" },
    });
    expect(cliente.llamadas).toContainEqual({ paso: "delete", tabla: "jornada_personal" });
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "jornada_personal",
      columna: "jornada_id",
      valor: "jornada-1",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "jornada_personal",
      columna: "perfil_id",
      valor: "perfil-1",
    });
  });

  it("bloquea el borrado, sin llegar al DELETE, cuando la persona ya registro atenciones: criterio 4", async () => {
    const cliente = crearCliente({
      "rpc:personal_registro_atenciones": { data: true, error: null },
    });
    dobles.cliente = cliente;

    const { desasignado, error } = await desasignarPersonal("jornada-1", "perfil-1");

    expect(desasignado).toBe(false);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
    expect(error.mensaje).toContain("atenciones");
    expect(cliente.llamadas.some((llamada) => llamada.paso === "delete")).toBe(false);
  });

  it("normaliza el error si la comprobacion por RPC falla", async () => {
    dobles.cliente = crearCliente({
      "rpc:personal_registro_atenciones": { data: null, error: { code: "42501" } },
    });

    const { desasignado, error } = await desasignarPersonal("jornada-1", "perfil-1");

    expect(desasignado).toBe(false);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });

  it("normaliza el error si RLS impide el DELETE (quien llama no es administrador)", async () => {
    dobles.cliente = crearCliente({
      "rpc:personal_registro_atenciones": { data: false, error: null },
      jornada_personal: { data: null, error: { code: "42501" } },
    });

    const { desasignado, error } = await desasignarPersonal("jornada-1", "perfil-1");

    expect(desasignado).toBe(false);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});
