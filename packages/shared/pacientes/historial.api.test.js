// Pruebas del historial medico. Ningun dato real de pacientes: nombres, folios y valores son
// inventados (regla de confidencialidad de AGENTS.md).

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

const { ROLES } = await import("../usuarios/roles.js");
const {
  obtenerHistorialMedico,
  obtenerUltimaAtencion,
  aEventos,
  ordenarCronologicamente,
  puedeVerHistorial,
  TIPOS_DE_EVENTO,
} = await import("./historial.api.js");

function crearCliente({ respuesta = { data: [], error: null } } = {}) {
  const llamadas = [];

  const cadena = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return cadena;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return cadena;
    },
    gte(columna, valor) {
      llamadas.push({ paso: "gte", columna, valor });
      return cadena;
    },
    lte(columna, valor) {
      llamadas.push({ paso: "lte", columna, valor });
      return cadena;
    },
    order(columna, opciones) {
      llamadas.push({ paso: "order", columna, opciones });
      return cadena;
    },
    limit(cantidad) {
      llamadas.push({ paso: "limit", cantidad });
      return cadena;
    },
    then(resolve, reject) {
      const r = respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
      return r.then(resolve, reject);
    },
  };

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return cadena;
    },
  };
}

const ATENCION = {
  id: "ate-1",
  jornadaId: "jor-1",
  createdAt: "2026-06-15T09:00:00Z",
  jornada: { nombre: "Jornada Quetzaltenango", fecha: "2026-06-15" },
  // triajes_atencion_id_key (00013) hace de esta una relacion 1:1: PostgREST la embebe como un
  // objeto, no como arreglo.
  triajes: {
    id: "tri-1",
    tomadoEn: "2026-06-15T09:10:00Z",
    tomadoPor: "per-enf",
    presionSistolica: 120,
    presionDiastolica: 80,
    glucosa: 95,
    peso: 70,
    talla: 1.7,
    temperatura: 36.5,
    frecuenciaCardiaca: 72,
    imc: 24.2,
    profesional: { nombres: "Rosa", apellidos: "Gomez" },
  },
  consultas: [
    {
      id: "con-1",
      createdAt: "2026-06-15T10:00:00Z",
      motivoConsulta: "Dolor de cabeza",
      tratamiento: "Analgesico",
      planSeguimiento: "Control en un mes",
      medicoId: "per-med",
      profesional: { nombres: "Ana", apellidos: "Lopez" },
      diagnosticos: [
        { esPrincipal: true, diagnostico: { id: "dx-1", codigo: "R51", nombre: "Cefalea" } },
        { esPrincipal: false, diagnostico: { id: "dx-2", codigo: "J00", nombre: "Resfriado" } },
      ],
      recetas: [
        {
          id: "rec-1",
          folio: "REC-ABC123",
          estado: "emitida",
          createdAt: "2026-06-15T10:30:00Z",
          detalle: [
            {
              cantidadEntregada: 21,
              dosis: "1 capsula",
              frecuencia: "cada 8 horas",
              duracion: "7 dias",
              medicamento: {
                nombre: "Amoxicilina",
                concentracion: "500 mg",
                presentacion: "capsula",
              },
            },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("puedeVerHistorial", () => {
  it.each([
    [ROLES.ADMINISTRADOR, true],
    [ROLES.MEDICO, true],
    [ROLES.VOLUNTARIO, false],
    [ROLES.JUNTA_DIRECTIVA, false],
    [ROLES.SOCIO_FUNDADOR, false],
  ])("%s -> %s", (rol, esperado) => {
    expect(puedeVerHistorial(rol)).toBe(esperado);
  });
});

describe("aEventos", () => {
  it("desglosa una atencion en triaje, consulta y receta", () => {
    const eventos = aEventos(ATENCION);

    expect(eventos.map((evento) => evento.tipo)).toEqual([
      TIPOS_DE_EVENTO.TRIAJE,
      TIPOS_DE_EVENTO.CONSULTA,
      TIPOS_DE_EVENTO.RECETA,
    ]);
  });

  it("cada evento lleva su jornada y quien lo registro", () => {
    const eventos = aEventos(ATENCION);

    for (const evento of eventos) {
      expect(evento.jornada).toBe("Jornada Quetzaltenango");
      expect(evento.jornadaId).toBe("jor-1");
      expect(evento.profesional).toBeTruthy();
    }
  });

  it("el triaje trae los signos vitales agrupados", () => {
    const [triaje] = aEventos(ATENCION);

    expect(triaje.signos.presionSistolica).toBe(120);
    expect(triaje.signos.imc).toBe(24.2);
    expect(triaje.profesional).toBe("Rosa Gomez");
  });

  it("la consulta expone el diagnostico principal ya resuelto", () => {
    const consulta = aEventos(ATENCION).find((e) => e.tipo === TIPOS_DE_EVENTO.CONSULTA);

    expect(consulta.diagnosticos).toHaveLength(2);
    expect(consulta.diagnosticoPrincipal.nombre).toBe("Cefalea");
  });

  it("la receta es un evento propio con lo que se entrego", () => {
    const receta = aEventos(ATENCION).find((e) => e.tipo === TIPOS_DE_EVENTO.RECETA);

    expect(receta.folio).toBe("REC-ABC123");
    expect(receta.anulada).toBe(false);
    expect(receta.medicamentos[0].medicamento).toBe("Amoxicilina");
    expect(receta.medicamentos[0].cantidadEntregada).toBe(21);
  });

  it("una receta anulada se marca como tal, no desaparece del historial", () => {
    const anulada = {
      ...ATENCION,
      consultas: [
        {
          ...ATENCION.consultas[0],
          recetas: [{ ...ATENCION.consultas[0].recetas[0], estado: "anulada" }],
        },
      ],
    };

    const receta = aEventos(anulada).find((e) => e.tipo === TIPOS_DE_EVENTO.RECETA);
    expect(receta.anulada).toBe(true);
  });

  it("una atencion sin triaje ni consulta no produce eventos", () => {
    expect(aEventos({ id: "ate-2", triajes: null, consultas: [] })).toEqual([]);
    expect(aEventos(null)).toEqual([]);
  });
});

describe("ordenarCronologicamente", () => {
  it("deja primero el mas reciente", () => {
    const ordenados = ordenarCronologicamente([
      { id: "viejo", fecha: "2024-01-01T00:00:00Z" },
      { id: "nuevo", fecha: "2026-06-15T00:00:00Z" },
      { id: "medio", fecha: "2025-03-01T00:00:00Z" },
    ]);

    expect(ordenados.map((e) => e.id)).toEqual(["nuevo", "medio", "viejo"]);
  });

  it("un evento sin fecha legible se va al final y no rompe el orden", () => {
    const ordenados = ordenarCronologicamente([
      { id: "sinFecha" },
      { id: "nuevo", fecha: "2026-06-15T00:00:00Z" },
      { id: "viejo", fecha: "2024-01-01T00:00:00Z" },
    ]);

    expect(ordenados.map((e) => e.id)).toEqual(["nuevo", "viejo", "sinFecha"]);
  });

  it("no muta el arreglo que recibe", () => {
    const original = [
      { id: "a", fecha: "2024-01-01T00:00:00Z" },
      { id: "b", fecha: "2026-01-01T00:00:00Z" },
    ];
    ordenarCronologicamente(original);

    expect(original.map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("obtenerHistorialMedico", () => {
  it("sin paciente devuelve vacio sin llamar al cliente", async () => {
    const { eventos, error } = await obtenerHistorialMedico();

    expect(eventos).toEqual([]);
    expect(error).toBeNull();
  });

  it.each([ROLES.VOLUNTARIO, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR])(
    "%s no puede consultarlo y ni siquiera gasta la llamada",
    async (rol) => {
      const cliente = crearCliente();
      dobles.cliente = cliente;

      const { eventos, error } = await obtenerHistorialMedico("pac-1", { rol });

      expect(eventos).toEqual([]);
      expect(error.codigo).toBeTruthy();
      expect(cliente.llamadas).toHaveLength(0);
    },
  );

  it("resuelve el historial en UNA sola consulta a atenciones", async () => {
    const cliente = crearCliente({ respuesta: { data: [ATENCION], error: null } });
    dobles.cliente = cliente;

    await obtenerHistorialMedico("pac-1", { rol: ROLES.MEDICO });

    expect(cliente.llamadas.filter((l) => l.paso === "from")).toHaveLength(1);
    expect(cliente.llamadas[0]).toEqual({ paso: "from", tabla: "atenciones" });
  });

  it("devuelve la linea de tiempo aplanada y ordenada", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [ATENCION], error: null } });

    const { eventos, error } = await obtenerHistorialMedico("pac-1", { rol: ROLES.MEDICO });

    expect(error).toBeNull();
    expect(eventos).toHaveLength(3);
    // El mas reciente es la receta (10:30), despues la consulta (10:00) y al final el triaje.
    expect(eventos.map((e) => e.tipo)).toEqual([
      TIPOS_DE_EVENTO.RECETA,
      TIPOS_DE_EVENTO.CONSULTA,
      TIPOS_DE_EVENTO.TRIAJE,
    ]);
  });

  it("acota por periodo cuando se le pasan las fechas", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerHistorialMedico("pac-1", {
      rol: ROLES.MEDICO,
      desde: "2026-01-01",
      hasta: "2026-12-31",
    });

    expect(cliente.llamadas).toContainEqual({
      paso: "gte",
      columna: "created_at",
      valor: "2026-01-01",
    });
    expect(cliente.llamadas).toContainEqual({
      paso: "lte",
      columna: "created_at",
      valor: "2026-12-31",
    });
  });

  it("sin periodo no acota", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerHistorialMedico("pac-1", { rol: ROLES.MEDICO });

    expect(cliente.llamadas.some((l) => l.paso === "gte" || l.paso === "lte")).toBe(false);
  });

  it("sin rol no bloquea: deja que decida RLS", async () => {
    const cliente = crearCliente({ respuesta: { data: [ATENCION], error: null } });
    dobles.cliente = cliente;

    const { eventos } = await obtenerHistorialMedico("pac-1");

    expect(eventos).toHaveLength(3);
  });

  it("un paciente sin atenciones devuelve una linea de tiempo vacia", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    const { eventos, error } = await obtenerHistorialMedico("pac-1", { rol: ROLES.MEDICO });

    expect(eventos).toEqual([]);
    expect(error).toBeNull();
  });

  it("un rechazo de RLS se normaliza", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "42501", message: "denegado" } },
    });

    const { eventos, error } = await obtenerHistorialMedico("pac-1", { rol: ROLES.MEDICO });

    expect(eventos).toEqual([]);
    expect(error).not.toBeNull();
  });

  it("un fallo de red llega como excepcion y tambien se normaliza", async () => {
    dobles.cliente = crearCliente({ respuesta: new Error("Failed to fetch") });

    const { eventos, error } = await obtenerHistorialMedico("pac-1", { rol: ROLES.MEDICO });

    expect(eventos).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe("obtenerUltimaAtencion", () => {
  it("sin paciente devuelve vacio sin llamar al cliente", async () => {
    const { ultimaAtencion, error } = await obtenerUltimaAtencion();

    expect(ultimaAtencion).toBeNull();
    expect(error).toBeNull();
  });

  it.each([ROLES.VOLUNTARIO, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR])(
    "%s no puede consultarla y ni siquiera gasta la llamada",
    async (rol) => {
      const cliente = crearCliente();
      dobles.cliente = cliente;

      const { ultimaAtencion, error } = await obtenerUltimaAtencion("pac-1", { rol });

      expect(ultimaAtencion).toBeNull();
      expect(error).toBeNull();
      expect(cliente.llamadas).toHaveLength(0);
    },
  );

  it("limita la consulta a la atencion mas reciente", async () => {
    const cliente = crearCliente({ respuesta: { data: [ATENCION], error: null } });
    dobles.cliente = cliente;

    await obtenerUltimaAtencion("pac-1", { rol: ROLES.MEDICO });

    expect(cliente.llamadas.filter((l) => l.paso === "from")).toHaveLength(1);
    expect(cliente.llamadas[0]).toEqual({ paso: "from", tabla: "atenciones" });
    expect(cliente.llamadas).toContainEqual({ paso: "limit", cantidad: 1 });
  });

  it("devuelve el evento mas reciente de esa atencion", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [ATENCION], error: null } });

    const { ultimaAtencion, error } = await obtenerUltimaAtencion("pac-1", { rol: ROLES.MEDICO });

    expect(error).toBeNull();
    // El mas reciente dentro de la atencion es la receta (10:30), igual que en el historial.
    expect(ultimaAtencion.tipo).toBe(TIPOS_DE_EVENTO.RECETA);
  });

  it("sin rol no bloquea: deja que decida RLS", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [ATENCION], error: null } });

    const { ultimaAtencion } = await obtenerUltimaAtencion("pac-1");

    expect(ultimaAtencion).not.toBeNull();
  });

  it("un paciente sin atenciones devuelve null", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    const { ultimaAtencion, error } = await obtenerUltimaAtencion("pac-1", { rol: ROLES.MEDICO });

    expect(ultimaAtencion).toBeNull();
    expect(error).toBeNull();
  });

  it("un rechazo de RLS se normaliza", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "42501", message: "denegado" } },
    });

    const { ultimaAtencion, error } = await obtenerUltimaAtencion("pac-1", { rol: ROLES.MEDICO });

    expect(ultimaAtencion).toBeNull();
    expect(error).not.toBeNull();
  });

  it("un fallo de red llega como excepcion y tambien se normaliza", async () => {
    dobles.cliente = crearCliente({ respuesta: new Error("Failed to fetch") });

    const { ultimaAtencion, error } = await obtenerUltimaAtencion("pac-1", { rol: ROLES.MEDICO });

    expect(ultimaAtencion).toBeNull();
    expect(error).not.toBeNull();
  });
});
