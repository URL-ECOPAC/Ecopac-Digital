// Pruebas de las consultas de Supabase del modulo de atenciones.
//
// Mismo patron de mock que packages/shared/jornadas/api.test.js: un doble de obtenerSupabase()
// que registra cada paso de la cadena y resuelve con la respuesta que la prueba le entregue. No
// hay Supabase real ni red.
//
// Lo que estas pruebas NO pueden cubrir es lo que decide el diseno de la cola: que un voluntario
// general vea la misma etapa que un medico aunque no pueda leer consultas. Eso depende de que la
// vista sea SECURITY DEFINER y vive en supabase/tests/database/cola_de_jornada.sql.
//
// Ningun dato real: las jornadas, los pacientes y las personas son inventados.

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
const { ESTADOS_JORNADA } = await import("../enums.js");
const { ETAPAS_DE_COLA, ORDEN_DE_ETAPAS } = await import("./etapas.js");
const { cerrarAtencion, contarPacientesDeJornada, iniciarAtencion, obtenerCola } =
  await import("./api.js");

/**
 * Doble minimo de un query builder de supabase-js. Cada metodo registra el paso y devuelve el
 * mismo objeto, para encadenar igual que el cliente real.
 *
 * `respuestasPorTabla` acepta una respuesta unica o un arreglo: iniciarAtencion() puede consultar
 * "jornadas" y despues escribir "atenciones", y cada una necesita la suya.
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
      throw new Error(`La prueba no configuro una respuesta para "${tabla}".`);
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
        is(columna, valor) {
          llamadas.push({ paso: "is", tabla, columna, valor });
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

/** Fila de la cola tal como la devuelve la vista, con los alias en camelCase. */
function filaDeCola(cambios = {}) {
  return {
    atencionId: "atencion-1",
    jornadaId: "jornada-1",
    pacienteId: "paciente-1",
    nombres: "Nombre",
    apellidos: "Inventado",
    etapa: ETAPAS_DE_COLA.ESPERA_TRIAJE,
    esperandoDesde: "2026-08-26T09:00:00Z",
    iniciadaEn: "2026-08-26T09:00:00Z",
    ...cambios,
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("iniciarAtencion", () => {
  it("registra la atencion cuando la jornada esta en curso", async () => {
    const cliente = crearCliente({
      jornadas: { data: { estado: ESTADOS_JORNADA.EN_CURSO }, error: null },
      atenciones: { data: { id: "atencion-1", pacienteId: "paciente-1" }, error: null },
    });
    dobles.cliente = cliente;

    const { atencion, error } = await iniciarAtencion("paciente-1", "jornada-1");

    expect(error).toBeNull();
    expect(atencion.id).toBe("atencion-1");
    expect(cliente.llamadas).toContainEqual({
      paso: "insert",
      tabla: "atenciones",
      valores: { paciente_id: "paciente-1", jornada_id: "jornada-1" },
    });
  });

  it("no escribe nada si la jornada no esta en curso, y explica por que", async () => {
    // El trigger de la 00055 lo rechazaria igual, pero desde aqui el mensaje dice que hacer.
    dobles.cliente = crearCliente({
      jornadas: { data: { estado: ESTADOS_JORNADA.FINALIZADA }, error: null },
    });

    const { atencion, error } = await iniciarAtencion("paciente-1", "jornada-1");

    expect(atencion).toBeNull();
    expect(error.mensaje).toMatch(/finalizada/i);
    expect(dobles.cliente.llamadas.some((l) => l.paso === "insert")).toBe(false);
  });

  it("con el estado ya conocido no vuelve a consultar la jornada", async () => {
    // La pantalla que ya cargo la jornada no tiene por que pagar otra consulta por paciente.
    const cliente = crearCliente({
      atenciones: { data: { id: "atencion-1" }, error: null },
    });
    dobles.cliente = cliente;

    await iniciarAtencion("paciente-1", "jornada-1", {
      estadoDeJornada: ESTADOS_JORNADA.EN_CURSO,
    });

    const tablas = new Set(cliente.llamadas.filter((l) => l.paso === "from").map((l) => l.tabla));
    expect(tablas).toEqual(new Set(["atenciones"]));
  });

  it("traduce el UNIQUE violado a un mensaje que se entiende", async () => {
    // Es el criterio de aceptacion 1: el UNIQUE (paciente_id, jornada_id) de la 00013 ya impide
    // el duplicado; lo unico que falta es no mostrar el error crudo de la base.
    dobles.cliente = crearCliente({
      jornadas: { data: { estado: ESTADOS_JORNADA.EN_CURSO }, error: null },
      atenciones: { data: null, error: { code: "23505", message: "duplicate key value" } },
    });

    const { atencion, error } = await iniciarAtencion("paciente-1", "jornada-1");

    expect(atencion).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD);
    expect(error.mensaje).toMatch(/ya esta registrado/i);
    expect(error.mensaje).toMatch(/cola/i);
  });

  it("una jornada que no existe no crea nada", async () => {
    dobles.cliente = crearCliente({ jornadas: { data: null, error: null } });

    const { atencion, error } = await iniciarAtencion("paciente-1", "jornada-fantasma");

    expect(atencion).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS);
  });

  it("sin paciente o sin jornada no consulta al servidor", async () => {
    dobles.cliente = null; // el mock revienta si alguien llega a obtenerSupabase()

    expect((await iniciarAtencion("", "jornada-1")).error.codigo).toBe(
      CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
    );
    expect((await iniciarAtencion("paciente-1", "")).error.codigo).toBe(
      CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
    );
  });
});

describe("obtenerCola", () => {
  it("agrupa por etapa y devuelve SIEMPRE las cuatro claves", async () => {
    // Un grupo que desaparece cuando se queda sin pacientes hace saltar la pantalla mientras
    // alguien la esta mirando.
    dobles.cliente = crearCliente({
      vista_cola_jornada: {
        data: [
          filaDeCola({ atencionId: "a1", etapa: ETAPAS_DE_COLA.ESPERA_TRIAJE }),
          filaDeCola({ atencionId: "a2", etapa: ETAPAS_DE_COLA.ESPERA_TRIAJE }),
          filaDeCola({ atencionId: "a3", etapa: ETAPAS_DE_COLA.ESPERA_ENTREGA }),
        ],
        error: null,
      },
    });

    const { cola, total, error } = await obtenerCola("jornada-1");

    expect(error).toBeNull();
    expect(total).toBe(3);
    expect(Object.keys(cola)).toEqual([...ORDEN_DE_ETAPAS]);
    expect(cola[ETAPAS_DE_COLA.ESPERA_TRIAJE]).toHaveLength(2);
    expect(cola[ETAPAS_DE_COLA.ESPERA_ENTREGA]).toHaveLength(1);
    expect(cola[ETAPAS_DE_COLA.ESPERA_CONSULTA]).toEqual([]);
    expect(cola[ETAPAS_DE_COLA.LISTA_PARA_CERRAR]).toEqual([]);
  });

  it("pide el orden por tiempo de espera: primero quien lleva mas", async () => {
    const cliente = crearCliente({ vista_cola_jornada: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerCola("jornada-1");

    expect(cliente.llamadas).toContainEqual({
      paso: "order",
      tabla: "vista_cola_jornada",
      columna: "esperando_desde",
      opciones: { ascending: true },
    });
  });

  it("lee la vista y no cruza las tablas del flujo por su cuenta", async () => {
    // La frontera de propiedad: triajes, consultas y recetas son de las issues #117 y #119.
    const cliente = crearCliente({ vista_cola_jornada: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerCola("jornada-1");

    const tablas = new Set(cliente.llamadas.filter((l) => l.paso === "from").map((l) => l.tabla));
    expect(tablas).toEqual(new Set(["vista_cola_jornada"]));
  });

  it("una etapa desconocida se ignora en vez de romper la pantalla", async () => {
    // Si la vista gana un valor nuevo, la cola sigue mostrando lo que si entiende.
    dobles.cliente = crearCliente({
      vista_cola_jornada: {
        data: [filaDeCola({ etapa: "etapa que este archivo no conoce" })],
        error: null,
      },
    });

    const { cola, total, error } = await obtenerCola("jornada-1");

    expect(error).toBeNull();
    expect(total).toBe(1);
    expect(Object.values(cola).every((grupo) => grupo.length === 0)).toBe(true);
  });

  it("ante un fallo devuelve la cola vacia con las cuatro claves, no undefined", async () => {
    dobles.cliente = crearCliente({
      vista_cola_jornada: { data: null, error: { message: "network error" } },
    });

    const { cola, total, error } = await obtenerCola("jornada-1");

    expect(error).not.toBeNull();
    expect(total).toBe(0);
    expect(Object.keys(cola)).toEqual([...ORDEN_DE_ETAPAS]);
  });

  it("sin jornada no consulta al servidor", async () => {
    dobles.cliente = null;

    const { cola, error } = await obtenerCola("");

    expect(error).toBeNull();
    expect(Object.keys(cola)).toEqual([...ORDEN_DE_ETAPAS]);
  });
});

describe("cerrarAtencion", () => {
  it("marca cerrada_en y no borra la fila", async () => {
    // El historial clinico de la jornada tiene que seguir ahi.
    const cliente = crearCliente({
      atenciones: { data: { id: "atencion-1", cerradaEn: "2026-08-26T10:00:00Z" }, error: null },
    });
    dobles.cliente = cliente;

    const { atencion, error } = await cerrarAtencion("atencion-1", "el paciente se retiro");

    expect(error).toBeNull();
    expect(atencion.cerradaEn).toBeTruthy();

    const update = cliente.llamadas.find((l) => l.paso === "update");
    expect(update.valores.cerrada_en).toBeTruthy();
    expect(update.valores.motivo_cierre).toBe("el paciente se retiro");
    expect(cliente.llamadas.some((l) => l.paso === "delete")).toBe(false);
  });

  it("no pisa la marca de un cierre anterior", async () => {
    // El WHERE exige que siga abierta, asi que la primera hora de cierre es la que queda.
    const cliente = crearCliente({ atenciones: { data: null, error: null } });
    dobles.cliente = cliente;

    await cerrarAtencion("atencion-1");

    expect(cliente.llamadas).toContainEqual({
      paso: "is",
      tabla: "atenciones",
      columna: "cerrada_en",
      valor: null,
    });
  });

  it("cerrar algo que ya no esta en la cola no es un error", async () => {
    // Sin fila: o no existe, o RLS la esconde, o ya estaba cerrada. En los tres casos la
    // atencion no esta en la cola, que es lo que queria quien llamo.
    dobles.cliente = crearCliente({ atenciones: { data: null, error: null } });

    const { atencion, error } = await cerrarAtencion("atencion-1");

    expect(atencion).toBeNull();
    expect(error).toBeNull();
  });

  it("sin motivo guarda null y no una cadena vacia", async () => {
    const cliente = crearCliente({ atenciones: { data: { id: "atencion-1" }, error: null } });
    dobles.cliente = cliente;

    await cerrarAtencion("atencion-1");

    expect(cliente.llamadas.find((l) => l.paso === "update").valores.motivo_cierre).toBeNull();
  });

  it("sin id no consulta al servidor", async () => {
    dobles.cliente = null;

    expect(await cerrarAtencion("")).toEqual({ atencion: null, error: null });
  });
});

describe("contarPacientesDeJornada", () => {
  it("cuenta filas de atenciones por jornada, sin traerlas", async () => {
    const cliente = crearCliente({ atenciones: { data: null, error: null, count: 5 } });
    dobles.cliente = cliente;

    const { cantidad, error } = await contarPacientesDeJornada("jornada-1");

    expect(error).toBeNull();
    expect(cantidad).toBe(5);
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "atenciones",
      columna: "jornada_id",
      valor: "jornada-1",
    });
  });

  it("sin conteo (null) devuelve cero, no null ni undefined", async () => {
    dobles.cliente = crearCliente({ atenciones: { data: null, error: null, count: null } });

    const { cantidad, error } = await contarPacientesDeJornada("jornada-1");

    expect(error).toBeNull();
    expect(cantidad).toBe(0);
  });

  it("un fallo del servidor se normaliza igual que el resto del modulo", async () => {
    dobles.cliente = crearCliente({
      atenciones: { data: null, error: { code: "42501" }, count: null },
    });

    const { cantidad, error } = await contarPacientesDeJornada("jornada-1");

    expect(cantidad).toBe(0);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });

  it("sin jornadaId no consulta al servidor", async () => {
    dobles.cliente = null;

    expect(await contarPacientesDeJornada("")).toEqual({ cantidad: 0, error: null });
  });
});
