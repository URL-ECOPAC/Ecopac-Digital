// Pruebas de las consultas de Supabase del triaje.
//
// Mismo patron de mock que packages/shared/pacientes/api.test.js: un doble de obtenerSupabase()
// que registra cada paso de la cadena y resuelve con la respuesta que la prueba le entregue. No
// hay Supabase real ni red.
//
// Lo que estas pruebas NO cubren es el IMC: lo calcula una columna generada de la 00013 y se
// verifica en supabase/tests/database/triaje_imc_generado.sql. Aqui solo se fija que la API nunca
// intente escribirlo.
//
// Ningun dato real: los signos vitales y los identificadores son inventados.

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
const { actualizarTriaje, obtenerTriajes, puedeCorregirTriaje, puedeTomarTriaje, registrarTriaje } =
  await import("./triaje.api.js");

/** Doble minimo de un query builder de supabase-js. */
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

const ATENCION = "atencion-1";
const TOMADO_POR = "perfil-1";

/** Triaje minimo valido: los tres signos que la tabla exige. */
function signos(cambios = {}) {
  return { presionSistolica: 120, presionDiastolica: 80, frecuenciaCardiaca: 70, ...cambios };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("registrarTriaje", () => {
  it("registra los signos y los asocia a la atencion y a quien los tomo", () => {
    // Criterio de aceptacion 1.
    const cliente = crearCliente({ triajes: { data: { id: "triaje-1" }, error: null } });
    dobles.cliente = cliente;

    return registrarTriaje(ATENCION, signos(), { tomadoPor: TOMADO_POR }).then(({ error }) => {
      expect(error).toBeNull();

      const insert = cliente.llamadas.find((l) => l.paso === "insert");
      expect(insert.valores.atencion_id).toBe(ATENCION);
      expect(insert.valores.tomado_por).toBe(TOMADO_POR);
      expect(insert.valores.presion_sistolica).toBe(120);
    });
  });

  it("NUNCA envia el imc: lo calcula la base", async () => {
    // Criterio de aceptacion 4. imc es GENERATED ALWAYS en la 00013 y Postgres rechaza
    // escribirla, asi que mandarla romperia el registro entero.
    const cliente = crearCliente({ triajes: { data: { id: "triaje-1" }, error: null } });
    dobles.cliente = cliente;

    await registrarTriaje(ATENCION, signos({ peso: 70, talla: 170, imc: 99 }), {
      tomadoPor: TOMADO_POR,
    });

    const insert = cliente.llamadas.find((l) => l.paso === "insert");
    expect(insert.valores).not.toHaveProperty("imc");
    expect(Object.keys(insert.valores)).not.toContain("imc");
  });

  it("pide el imc de vuelta en el select", async () => {
    const cliente = crearCliente({ triajes: { data: { id: "triaje-1" }, error: null } });
    dobles.cliente = cliente;

    await registrarTriaje(ATENCION, signos(), { tomadoPor: TOMADO_POR });

    expect(cliente.llamadas.find((l) => l.paso === "select").columnas).toContain("imc");
  });

  it("acepta signos parciales: sin glucosa, peso ni temperatura", async () => {
    // Criterio de aceptacion 2: en algunas comunidades no hay glucometro ni bascula.
    const cliente = crearCliente({ triajes: { data: { id: "triaje-1" }, error: null } });
    dobles.cliente = cliente;

    const { error, errores } = await registrarTriaje(ATENCION, signos(), {
      tomadoPor: TOMADO_POR,
    });

    expect(error).toBeNull();
    expect(errores).toEqual({});
    const insert = cliente.llamadas.find((l) => l.paso === "insert");
    expect(insert.valores).not.toHaveProperty("glucosa");
  });

  it("un opcional en blanco viaja como NULL y no como cadena vacia", async () => {
    // La columna es NUMERIC: PostgREST rechazaria "".
    const cliente = crearCliente({ triajes: { data: { id: "triaje-1" }, error: null } });
    dobles.cliente = cliente;

    await registrarTriaje(ATENCION, signos({ glucosa: "" }), { tomadoPor: TOMADO_POR });

    expect(cliente.llamadas.find((l) => l.paso === "insert").valores.glucosa).toBeNull();
  });

  it("no llama al servidor si faltan los signos obligatorios", async () => {
    dobles.cliente = null; // el mock revienta si alguien llega a obtenerSupabase()

    const { errores, error } = await registrarTriaje(ATENCION, {}, { tomadoPor: TOMADO_POR });

    expect(error).toBeNull();
    expect(Object.keys(errores).sort()).toEqual([
      "frecuenciaCardiaca",
      "presionDiastolica",
      "presionSistolica",
    ]);
  });

  it("traduce el UNIQUE de atencion_id a un mensaje que dice que hacer", async () => {
    // Una atencion tiene un solo triaje (00013). El mensaje manda a corregir, no a reintentar.
    dobles.cliente = crearCliente({
      triajes: { data: null, error: { code: "23505", message: "duplicate key value" } },
    });

    const { error } = await registrarTriaje(ATENCION, signos(), { tomadoPor: TOMADO_POR });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD);
    expect(error.mensaje).toMatch(/ya tiene triaje/i);
    expect(error.mensaje).toMatch(/corregi/i);
  });

  it("sin atencion o sin quien lo tomo no consulta al servidor", async () => {
    dobles.cliente = null;

    expect((await registrarTriaje("", signos(), { tomadoPor: TOMADO_POR })).error.codigo).toBe(
      CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
    );
    expect((await registrarTriaje(ATENCION, signos(), {})).error.codigo).toBe(
      CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO,
    );
  });
});

describe("actualizarTriaje", () => {
  it("corrige solo lo que se envia, sin borrar el resto", async () => {
    const cliente = crearCliente({ triajes: { data: { id: "triaje-1" }, error: null } });
    dobles.cliente = cliente;

    await actualizarTriaje("triaje-1", { glucosa: 110 });

    const update = cliente.llamadas.find((l) => l.paso === "update");
    expect(update.valores).toEqual({ glucosa: 110 });
  });

  it("no exige los obligatorios que no vienen en la correccion", async () => {
    // Ya estan en la fila: pedirlos obligaria a reenviar una presion que nadie quiso tocar.
    const cliente = crearCliente({ triajes: { data: { id: "triaje-1" }, error: null } });
    dobles.cliente = cliente;

    const { errores, error } = await actualizarTriaje("triaje-1", { peso: 72 });

    expect(errores).toEqual({});
    expect(error).toBeNull();
  });

  it("pero rechaza vaciar un obligatorio", async () => {
    dobles.cliente = null;

    const { errores } = await actualizarTriaje("triaje-1", { presionSistolica: "" });

    expect(errores).toHaveProperty("presionSistolica");
  });

  it("tampoco envia el imc", async () => {
    const cliente = crearCliente({ triajes: { data: { id: "triaje-1" }, error: null } });
    dobles.cliente = cliente;

    await actualizarTriaje("triaje-1", { peso: 80, imc: 99 });

    expect(cliente.llamadas.find((l) => l.paso === "update").valores).not.toHaveProperty("imc");
  });

  it("si RLS filtra la fila, avisa en vez de fingir que guardo", async () => {
    // Comprobado contra PostgREST: cuando la politica de UPDATE deja fuera la fila -- un
    // voluntario general corrigiendo -- la respuesta es 204 con CERO filas, NO un 42501. Sin
    // esta comprobacion la pantalla creeria que el cambio se guardo.
    dobles.cliente = crearCliente({ triajes: { data: null, error: null } });

    const { triaje, error } = await actualizarTriaje("triaje-1", { peso: 80 });

    expect(triaje).toBeNull();
    expect(error).not.toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(error.mensaje).toMatch(/no se pudo corregir/i);
  });

  it("sin id o sin cambios no consulta al servidor", async () => {
    dobles.cliente = null;

    expect(await actualizarTriaje("")).toEqual({ triaje: null, errores: {}, error: null });
    expect(await actualizarTriaje("triaje-1", {})).toEqual({
      triaje: null,
      errores: {},
      error: null,
    });
  });
});

describe("obtenerTriajes", () => {
  it("trae el historico en UNA sola consulta, con la jornada embebida", async () => {
    // Es un requisito de la issue #129: "los datos salen de la API de triaje, sin consultas
    // adicionales por punto". Si esto se rompe, la grafica dispara una peticion por medicion.
    const cliente = crearCliente({ triajes: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerTriajes("paciente-1");

    const tablas = cliente.llamadas.filter((l) => l.paso === "from");
    expect(tablas).toHaveLength(1);
    expect(tablas[0].tabla).toBe("triajes");

    const select = cliente.llamadas.find((l) => l.paso === "select");
    expect(select.columnas).toContain("atenciones!inner");
    expect(select.columnas).toContain("jornada");
  });

  it("ordena del mas antiguo al mas reciente: una grafica se lee hacia la derecha", async () => {
    const cliente = crearCliente({ triajes: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerTriajes("paciente-1");

    expect(cliente.llamadas).toContainEqual({
      paso: "order",
      tabla: "triajes",
      columna: "tomado_en",
      opciones: { ascending: true },
    });
  });

  it("filtra por el paciente a traves de la atencion", async () => {
    const cliente = crearCliente({ triajes: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerTriajes("paciente-1");

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "triajes",
      columna: "atenciones.paciente_id",
      valor: "paciente-1",
    });
  });

  it("ante un fallo devuelve una lista vacia, no undefined", async () => {
    dobles.cliente = crearCliente({
      triajes: { data: null, error: { message: "network error" } },
    });

    const { triajes, error } = await obtenerTriajes("paciente-1");

    expect(triajes).toEqual([]);
    expect(error).not.toBeNull();
  });

  it("sin paciente no consulta al servidor", async () => {
    dobles.cliente = null;

    expect(await obtenerTriajes("")).toEqual({ triajes: [], error: null });
  });
});

describe("permisos del triaje", () => {
  it("en campo el triaje lo toma quien este disponible, voluntariado incluido", () => {
    // Espejo de la politica de INSERT de la 00033.
    expect(puedeTomarTriaje(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeTomarTriaje(ROLES.MEDICO)).toBe(true);
    expect(puedeTomarTriaje(ROLES.VOLUNTARIO)).toBe(true);
    expect(puedeTomarTriaje(ROLES.JUNTA_DIRECTIVA)).toBe(false);
  });

  it("corregirlo es mas estrecho: solo administrador y medico", () => {
    // Espejo de la politica de UPDATE. Es la razon de que registrar y corregir sean dos
    // funciones: el voluntario que tomo el triaje no puede arreglar su propio error de dedo.
    expect(puedeCorregirTriaje(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeCorregirTriaje(ROLES.MEDICO)).toBe(true);
    expect(puedeCorregirTriaje(ROLES.VOLUNTARIO)).toBe(false);
  });
});
