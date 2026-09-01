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
const {
  registrarConsulta,
  obtenerConsulta,
  actualizarConsulta,
  listarPacientesAtendidosDeJornada,
  contarConsultasDeJornada,
} = await import("./consultas.api.js");

/**
 * Doble de Supabase que responde distinto segun la tabla. Cada tabla admite una respuesta o una
 * lista de respuestas que se consumen en orden, porque registrarConsulta() toca `consultas` dos
 * veces: primero el insert y luego la relectura con detalle.
 */
function crearCliente(respuestas = {}) {
  const llamadas = [];
  const colas = {};
  for (const [tabla, valor] of Object.entries(respuestas)) {
    colas[tabla] = Array.isArray(valor) ? [...valor] : [valor];
  }

  function siguiente(tabla) {
    const cola = colas[tabla];
    if (!cola || cola.length === 0) return { data: null, error: null };
    return cola.length === 1 ? cola[0] : cola.shift();
  }

  function encadenable(tabla) {
    const resolver = async () => {
      const respuesta = siguiente(tabla);
      return respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;
    };

    const cadena = {
      insert(valores) {
        llamadas.push({ paso: "insert", tabla, valores });
        return cadena;
      },
      update(valores) {
        llamadas.push({ paso: "update", tabla, valores });
        return cadena;
      },
      select(columnas) {
        llamadas.push({ paso: "select", tabla, columnas });
        return cadena;
      },
      eq(columna, valor) {
        llamadas.push({ paso: "eq", tabla, columna, valor });
        return cadena;
      },
      single: resolver,
      maybeSingle: resolver,
      then(resolve, reject) {
        return resolver().then(resolve, reject);
      },
    };

    return cadena;
  }

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return encadenable(tabla);
    },
  };
}

const CONSULTA_VALIDA = {
  expediente: "exp-1",
  atencion: "ate-1",
  medico: "med-1",
  jornada: "jor-1",
  motivoConsulta: "Dolor de cabeza",
};

const FILA_CREADA = { id: "con-1", motivoConsulta: "Dolor de cabeza" };

const FILA_CON_DETALLE = {
  id: "con-1",
  expedienteId: "exp-1",
  atencionId: "ate-1",
  medicoId: "med-1",
  jornadaId: "jor-1",
  motivoConsulta: "Dolor de cabeza",
  antecedentes: null,
  diagnosticos: [
    { esPrincipal: true, diagnostico: { id: "dx-1", codigo: "R51", nombre: "Cefalea" } },
    { esPrincipal: false, diagnostico: { id: "dx-2", codigo: "J00", nombre: "Resfriado" } },
  ],
  receta: { id: "rec-1", folio: "REC-ABC123", indicacionesGenerales: "Reposo" },
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("registrarConsulta", () => {
  it.each([
    ["expediente", { ...CONSULTA_VALIDA, expediente: undefined }],
    ["atencion", { ...CONSULTA_VALIDA, atencion: "" }],
    ["medico", { ...CONSULTA_VALIDA, medico: null }],
    ["jornada", { ...CONSULTA_VALIDA, jornada: undefined }],
  ])("sin %s devuelve CAMPO_REQUERIDO sin tocar la red", async (_campo, datos) => {
    const { consulta, error } = await registrarConsulta(datos);

    expect(consulta).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it.each([
    ["ausente", undefined],
    ["vacio", ""],
    ["solo espacios", "   "],
  ])("un motivo de consulta %s se rechaza", async (_caso, motivoConsulta) => {
    const { error } = await registrarConsulta({ ...CONSULTA_VALIDA, motivoConsulta });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
    expect(error.mensaje).toContain("motivo de consulta");
  });

  it("el resto de campos clinicos son opcionales: con solo el motivo se registra", async () => {
    dobles.cliente = crearCliente({
      consultas: [
        { data: FILA_CREADA, error: null },
        { data: FILA_CON_DETALLE, error: null },
      ],
    });

    const { consulta, error } = await registrarConsulta(CONSULTA_VALIDA, {
      estadoDeJornada: "en curso",
    });

    expect(error).toBeNull();
    expect(consulta.id).toBe("con-1");
  });

  it.each([["planificada"], ["finalizada"], ["cancelada"]])(
    "con la jornada %s se rechaza con un mensaje que explica que pasa",
    async (estado) => {
      const cliente = crearCliente({});
      dobles.cliente = cliente;

      const { consulta, error } = await registrarConsulta(CONSULTA_VALIDA, {
        estadoDeJornada: estado,
      });

      expect(consulta).toBeNull();
      expect(error.mensaje).toBeTruthy();
      expect(error.mensaje.length).toBeGreaterThan(10);
      expect(cliente.llamadas.some((l) => l.tabla === "consultas")).toBe(false);
    },
  );

  it("si no le pasan el estado, lo consulta antes de insertar", async () => {
    const cliente = crearCliente({
      jornadas: { data: { estado: "en curso" }, error: null },
      consultas: [
        { data: FILA_CREADA, error: null },
        { data: FILA_CON_DETALLE, error: null },
      ],
    });
    dobles.cliente = cliente;

    await registrarConsulta(CONSULTA_VALIDA);

    expect(cliente.llamadas[0]).toEqual({ paso: "from", tabla: "jornadas" });
  });

  it("una jornada inexistente devuelve SIN_RESULTADOS", async () => {
    dobles.cliente = crearCliente({ jornadas: { data: null, error: null } });

    const { error } = await registrarConsulta(CONSULTA_VALIDA);

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS);
  });

  it("inserta los diagnosticos marcando cual es el principal", async () => {
    const cliente = crearCliente({
      consultas: [
        { data: FILA_CREADA, error: null },
        { data: FILA_CON_DETALLE, error: null },
      ],
      consulta_diagnostico: { data: null, error: null },
    });
    dobles.cliente = cliente;

    await registrarConsulta(
      {
        ...CONSULTA_VALIDA,
        diagnosticos: [{ diagnosticoId: "dx-1", esPrincipal: true }, { diagnosticoId: "dx-2" }],
      },
      { estadoDeJornada: "en curso" },
    );

    const insert = cliente.llamadas.find(
      (l) => l.paso === "insert" && l.tabla === "consulta_diagnostico",
    );

    expect(insert.valores).toEqual([
      { consulta_id: "con-1", diagnostico_id: "dx-1", es_principal: true },
      { consulta_id: "con-1", diagnostico_id: "dx-2", es_principal: false },
    ]);
  });

  it("sin diagnosticos no toca la tabla de union", async () => {
    const cliente = crearCliente({
      consultas: [
        { data: FILA_CREADA, error: null },
        { data: FILA_CON_DETALLE, error: null },
      ],
    });
    dobles.cliente = cliente;

    await registrarConsulta(CONSULTA_VALIDA, { estadoDeJornada: "en curso" });

    expect(cliente.llamadas.some((l) => l.tabla === "consulta_diagnostico")).toBe(false);
  });

  it("si fallan los diagnosticos devuelve el error pero no pierde la consulta creada", async () => {
    dobles.cliente = crearCliente({
      consultas: { data: FILA_CREADA, error: null },
      consulta_diagnostico: { data: null, error: { code: "23503", message: "fk" } },
    });

    const { consulta, error } = await registrarConsulta(
      { ...CONSULTA_VALIDA, diagnosticos: [{ diagnosticoId: "dx-inexistente" }] },
      { estadoDeJornada: "en curso" },
    );

    expect(error).not.toBeNull();
    expect(consulta.id).toBe("con-1");
  });

  it("un rechazo de RLS llega como permiso denegado", async () => {
    dobles.cliente = crearCliente({
      consultas: { data: null, error: { code: "42501", message: "denegado" } },
    });

    const { consulta, error } = await registrarConsulta(CONSULTA_VALIDA, {
      estadoDeJornada: "en curso",
    });

    expect(consulta).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("obtenerConsulta", () => {
  it("sin id no llama al cliente", async () => {
    const { consulta, error } = await obtenerConsulta();

    expect(consulta).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("devuelve la consulta con sus diagnosticos y su receta", async () => {
    dobles.cliente = crearCliente({ consultas: { data: FILA_CON_DETALLE, error: null } });

    const { consulta, error } = await obtenerConsulta("con-1");

    expect(error).toBeNull();
    expect(consulta.diagnosticos).toHaveLength(2);
    expect(consulta.receta.folio).toBe("REC-ABC123");
  });

  it("expone cual es el diagnostico principal sin que la pantalla lo busque", async () => {
    dobles.cliente = crearCliente({ consultas: { data: FILA_CON_DETALLE, error: null } });

    const { consulta } = await obtenerConsulta("con-1");

    expect(consulta.diagnosticoPrincipal.nombre).toBe("Cefalea");
  });

  it("una consulta sin diagnosticos ni receta no revienta", async () => {
    dobles.cliente = crearCliente({
      consultas: { data: { id: "con-2", motivoConsulta: "Control" }, error: null },
    });

    const { consulta } = await obtenerConsulta("con-2");

    expect(consulta.diagnosticos).toEqual([]);
    expect(consulta.diagnosticoPrincipal).toBeNull();
    expect(consulta.receta).toBeNull();
  });

  it("un id que no existe devuelve SIN_RESULTADOS", async () => {
    dobles.cliente = crearCliente({ consultas: { data: null, error: null } });

    const { error } = await obtenerConsulta("con-fantasma");

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS);
  });
});

describe("actualizarConsulta", () => {
  it("sin id no llama al cliente", async () => {
    const { error } = await actualizarConsulta();

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("solo manda los campos editables, nunca la atencion ni la jornada", async () => {
    const cliente = crearCliente({ consultas: { data: FILA_CON_DETALLE, error: null } });
    dobles.cliente = cliente;

    await actualizarConsulta("con-1", {
      sintomas: "Fiebre",
      jornada: "otra-jornada",
      medico: "otro-medico",
    });

    const update = cliente.llamadas.find((l) => l.paso === "update");

    expect(update.valores).toEqual({ sintomas: "Fiebre" });
  });

  it("no se puede dejar el motivo de consulta vacio al editar", async () => {
    const { error } = await actualizarConsulta("con-1", { motivoConsulta: "  " });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("sin cambios reales devuelve la consulta tal como esta", async () => {
    const cliente = crearCliente({ consultas: { data: FILA_CON_DETALLE, error: null } });
    dobles.cliente = cliente;

    const { consulta, error } = await actualizarConsulta("con-1", { algoQueNoExiste: 1 });

    expect(error).toBeNull();
    expect(consulta.id).toBe("con-1");
    expect(cliente.llamadas.some((l) => l.paso === "update")).toBe(false);
  });
});

describe("listarPacientesAtendidosDeJornada", () => {
  const FILA_DE_PACIENTE_ATENDIDO = {
    id: "con-1",
    atencion: { pacienteId: "pac-1", paciente: { nombres: "Maria", apellidos: "Lopez" } },
    diagnosticos: [
      { esPrincipal: false, diagnostico: { id: "dx-2", codigo: "J00", nombre: "Resfriado" } },
      { esPrincipal: true, diagnostico: { id: "dx-1", codigo: "R51", nombre: "Cefalea" } },
    ],
  };

  it("sin jornadaId no llama al cliente", async () => {
    const { pacientes, error } = await listarPacientesAtendidosDeJornada();

    expect(pacientes).toEqual([]);
    expect(error).toBeNull();
  });

  it("arma el nombre del paciente y el diagnostico principal desde la atencion", async () => {
    dobles.cliente = crearCliente({
      consultas: { data: [FILA_DE_PACIENTE_ATENDIDO], error: null },
    });

    const { pacientes, error } = await listarPacientesAtendidosDeJornada("jor-1", {
      rol: ROLES.MEDICO,
    });

    expect(error).toBeNull();
    expect(pacientes).toHaveLength(1);
    expect(pacientes[0].paciente).toBe("Maria Lopez");
    expect(pacientes[0].pacienteId).toBe("pac-1");
    expect(pacientes[0].diagnosticoPrincipal.nombre).toBe("Cefalea");
  });

  it("filtra por jornada_id, no por otra columna", async () => {
    const cliente = crearCliente({ consultas: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarPacientesAtendidosDeJornada("jor-1", { rol: ROLES.ADMINISTRADOR });

    const filtro = cliente.llamadas.find((l) => l.paso === "eq");
    expect(filtro.columna).toBe("jornada_id");
    expect(filtro.valor).toBe("jor-1");
  });

  it("un rol sin permiso no llega a llamar al cliente y recibe el motivo", async () => {
    const { pacientes, error } = await listarPacientesAtendidosDeJornada("jor-1", {
      rol: ROLES.VOLUNTARIO,
    });

    expect(pacientes).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });

  it("junta directiva tampoco puede verlos", async () => {
    const { pacientes, error } = await listarPacientesAtendidosDeJornada("jor-1", {
      rol: ROLES.JUNTA_DIRECTIVA,
    });

    expect(pacientes).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });

  it("sin rol no bloquea: deja que RLS decida", async () => {
    dobles.cliente = crearCliente({ consultas: { data: [], error: null } });

    const { error } = await listarPacientesAtendidosDeJornada("jor-1");

    expect(error).toBeNull();
  });
});

describe("contarConsultasDeJornada", () => {
  it("sin jornadaId no toca el cliente", async () => {
    const { cantidad, error } = await contarConsultasDeJornada();

    expect(cantidad).toBeNull();
    expect(error).toBeNull();
  });

  it("cuenta filas de consultas filtradas por jornada_id, real para medico", async () => {
    const cliente = crearCliente({ consultas: { data: null, error: null, count: 9 } });
    dobles.cliente = cliente;

    const { cantidad, error } = await contarConsultasDeJornada("jor-1", { rol: ROLES.MEDICO });

    expect(error).toBeNull();
    expect(cantidad).toBe(9);
    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      tabla: "consultas",
      columna: "jornada_id",
      valor: "jor-1",
    });
  });

  it("real tambien para administrador", async () => {
    dobles.cliente = crearCliente({ consultas: { data: null, error: null, count: 3 } });

    const { cantidad } = await contarConsultasDeJornada("jor-1", { rol: ROLES.ADMINISTRADOR });

    expect(cantidad).toBe(3);
  });

  it("voluntario general no tiene SELECT sobre consultas (00033): cantidad null, sin llamar al cliente", async () => {
    const { cantidad, error } = await contarConsultasDeJornada("jor-1", {
      rol: ROLES.VOLUNTARIO,
    });

    expect(cantidad).toBeNull();
    expect(error).toBeNull();
  });

  it("sin rol no bloquea: deja que RLS decida", async () => {
    dobles.cliente = crearCliente({ consultas: { data: null, error: null, count: 0 } });

    const { cantidad, error } = await contarConsultasDeJornada("jor-1");

    expect(cantidad).toBe(0);
    expect(error).toBeNull();
  });

  it("normaliza el error del servidor", async () => {
    dobles.cliente = crearCliente({
      consultas: { data: null, error: { code: "42501" }, count: null },
    });

    const { cantidad, error } = await contarConsultasDeJornada("jor-1", { rol: ROLES.MEDICO });

    expect(cantidad).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });

  it("una consulta sin atencion embebida (RLS la esconde) no revienta", async () => {
    dobles.cliente = crearCliente({
      consultas: { data: [{ id: "con-1", atencion: null, diagnosticos: [] }], error: null },
    });

    const { pacientes } = await listarPacientesAtendidosDeJornada("jor-1", {
      rol: ROLES.ADMINISTRADOR,
    });

    expect(pacientes[0].paciente).toBeNull();
    expect(pacientes[0].diagnosticoPrincipal).toBeNull();
  });
});
