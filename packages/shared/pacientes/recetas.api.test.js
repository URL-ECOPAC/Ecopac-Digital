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
const { generarReceta, obtenerReceta, obtenerRecetas, anularReceta, ESTADOS_RECETA } =
  await import("./recetas.api.js");

function crearCliente({ rpc = { data: "rec-1", error: null }, tabla = { data: null, error: null } } = {}) {
  const llamadas = [];

  const cadena = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return cadena;
    },
    update(valores) {
      llamadas.push({ paso: "update", valores });
      return cadena;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return cadena;
    },
    order(columna, opciones) {
      llamadas.push({ paso: "order", columna, opciones });
      return cadena;
    },
    maybeSingle: async () =>
      tabla instanceof Error ? Promise.reject(tabla) : tabla,
    then(resolve, reject) {
      const resultado = tabla instanceof Error ? Promise.reject(tabla) : Promise.resolve(tabla);
      return resultado.then(resolve, reject);
    },
  };

  return {
    llamadas,
    rpc(nombre, parametros) {
      llamadas.push({ paso: "rpc", nombre, parametros });
      return rpc instanceof Error ? Promise.reject(rpc) : Promise.resolve(rpc);
    },
    from(tablaNombre) {
      llamadas.push({ paso: "from", tabla: tablaNombre });
      return cadena;
    },
  };
}

const HOY = new Date("2026-06-15T09:00:00");
const LOTE_VIGENTE = { id: "lot-1", fechaVencimiento: "2027-01-01" };
const LOTE_VENCIDO = { id: "lot-2", fechaVencimiento: "2026-06-14" };

const RENGLON = {
  medicamento: "med-1",
  dosis: "1 capsula",
  frecuencia: "cada 8 horas",
  duracion: "7 dias",
  cantidadEntregada: 21,
};

const DATOS = { consulta: "con-1", medico: "med-perfil-1", detalle: [RENGLON] };

const FILA_RECETA = {
  id: "rec-1",
  folio: "REC-ABC123",
  estado: "emitida",
  medicoId: "med-perfil-1",
  indicacionesGenerales: "Tomar con alimentos",
  medico: { nombres: "Ana", apellidos: "Lopez" },
  consulta: {
    id: "con-1",
    jornadaId: "jor-1",
    expedienteId: "exp-1",
    jornada: { nombre: "Jornada Quetzaltenango", fecha: "2026-06-15" },
  },
  detalle: [
    {
      id: "det-1",
      medicamentoId: "med-1",
      loteId: "lot-1",
      dosis: "1 capsula",
      frecuencia: "cada 8 horas",
      duracion: "7 dias",
      cantidadEntregada: 21,
      medicamento: { nombre: "Amoxicilina", concentracion: "500 mg", presentacion: "capsula" },
    },
  ],
  createdAt: "2026-06-15T10:00:00Z",
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("generarReceta", () => {
  it.each([
    ["consulta", { ...DATOS, consulta: undefined }],
    ["medico", { ...DATOS, medico: "" }],
  ])("sin %s devuelve CAMPO_REQUERIDO sin tocar la red", async (_campo, datos) => {
    const { receta, error } = await generarReceta(datos, HOY);

    expect(receta).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("una receta sin medicamentos se rechaza", async () => {
    const { error } = await generarReceta({ ...DATOS, detalle: [] }, HOY);

    expect(error.mensaje).toContain("al menos un medicamento");
  });

  it.each(["dosis", "frecuencia", "duracion", "cantidadEntregada"])(
    "un renglon sin %s se rechaza nombrando el campo",
    async (campo) => {
      const { error } = await generarReceta(
        { ...DATOS, detalle: [{ ...RENGLON, [campo]: "" }] },
        HOY,
      );

      expect(error.mensaje).toContain(campo);
    },
  );

  it("crea la receta en UNA sola llamada a la funcion, no en dos inserts", async () => {
    const cliente = crearCliente({ tabla: { data: FILA_RECETA, error: null } });
    dobles.cliente = cliente;

    await generarReceta(DATOS, HOY);

    const rpc = cliente.llamadas.find((l) => l.paso === "rpc");
    expect(rpc.nombre).toBe("fn_generar_receta");
    expect(cliente.llamadas.some((l) => l.paso === "insert")).toBe(false);
  });

  it("traduce los renglones a las columnas de la base", async () => {
    const cliente = crearCliente({ tabla: { data: FILA_RECETA, error: null } });
    dobles.cliente = cliente;

    await generarReceta({ ...DATOS, detalle: [{ ...RENGLON, lote: LOTE_VIGENTE }] }, HOY);

    const rpc = cliente.llamadas.find((l) => l.paso === "rpc");
    expect(rpc.parametros.p_detalle).toEqual([
      {
        medicamento_id: "med-1",
        lote_id: "lot-1",
        dosis: "1 capsula",
        frecuencia: "cada 8 horas",
        duracion: "7 dias",
        cantidad_entregada: 21,
      },
    ]);
  });

  it("un lote vencido se rechaza antes de gastar la llamada", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    const { error } = await generarReceta(
      { ...DATOS, detalle: [{ ...RENGLON, lote: LOTE_VENCIDO, cantidadDisponible: 999 }] },
      HOY,
    );

    expect(error.mensaje).toContain("vencio");
    expect(cliente.llamadas.some((l) => l.paso === "rpc")).toBe(false);
  });

  it("existencia insuficiente se rechaza diciendo cuanto hay", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    const { error } = await generarReceta(
      { ...DATOS, detalle: [{ ...RENGLON, lote: LOTE_VIGENTE, cantidadDisponible: 5 }] },
      HOY,
    );

    expect(error.mensaje).toContain("5");
    expect(cliente.llamadas.some((l) => l.paso === "rpc")).toBe(false);
  });

  it("sin datos de existencia deja que decida la base", async () => {
    const cliente = crearCliente({ tabla: { data: FILA_RECETA, error: null } });
    dobles.cliente = cliente;

    const { error } = await generarReceta(
      { ...DATOS, detalle: [{ ...RENGLON, lote: LOTE_VIGENTE }] },
      HOY,
    );

    expect(error).toBeNull();
    expect(cliente.llamadas.some((l) => l.paso === "rpc")).toBe(true);
  });

  it("un rechazo de la funcion se normaliza", async () => {
    dobles.cliente = crearCliente({
      rpc: { data: null, error: { code: "42501", message: "denegado" } },
    });

    const { receta, error } = await generarReceta(DATOS, HOY);

    expect(receta).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("obtenerReceta", () => {
  it("sin id no llama al cliente", async () => {
    const { error } = await obtenerReceta();

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("incluye el medico, la jornada y el folio", async () => {
    dobles.cliente = crearCliente({ tabla: { data: FILA_RECETA, error: null } });

    const { receta } = await obtenerReceta("rec-1");

    expect(receta.folio).toBe("REC-ABC123");
    expect(receta.medico).toBe("Ana Lopez");
    expect(receta.jornada).toBe("Jornada Quetzaltenango");
    expect(receta.jornadaId).toBe("jor-1");
  });

  it("trae el detalle con el nombre del medicamento", async () => {
    dobles.cliente = crearCliente({ tabla: { data: FILA_RECETA, error: null } });

    const { receta } = await obtenerReceta("rec-1");

    expect(receta.detalle).toHaveLength(1);
    expect(receta.detalle[0].medicamento).toBe("Amoxicilina");
  });

  it("una receta que no existe devuelve SIN_RESULTADOS", async () => {
    dobles.cliente = crearCliente({ tabla: { data: null, error: null } });

    const { error } = await obtenerReceta("rec-fantasma");

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.SIN_RESULTADOS);
  });
});

describe("obtenerRecetas", () => {
  it("sin paciente devuelve lista vacia sin llamar al cliente", async () => {
    const { recetas, error } = await obtenerRecetas();

    expect(recetas).toEqual([]);
    expect(error).toBeNull();
  });

  it("ordena de la mas reciente a la mas antigua", async () => {
    const cliente = crearCliente({ tabla: { data: [FILA_RECETA], error: null } });
    dobles.cliente = cliente;

    await obtenerRecetas("pac-1");

    expect(cliente.llamadas).toContainEqual({
      paso: "order",
      columna: "created_at",
      opciones: { ascending: false },
    });
  });

  it("filtra por el paciente a traves de consultas y expedientes", async () => {
    const cliente = crearCliente({ tabla: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerRecetas("pac-1");

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "consultas.expedientes.paciente_id",
      valor: "pac-1",
    });
  });

  it("por defecto incluye las anuladas: el historial no las pierde", async () => {
    const cliente = crearCliente({ tabla: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerRecetas("pac-1");

    expect(cliente.llamadas.some((l) => l.paso === "eq" && l.columna === "estado")).toBe(false);
  });

  it("con soloEmitidas si filtra por estado", async () => {
    const cliente = crearCliente({ tabla: { data: [], error: null } });
    dobles.cliente = cliente;

    await obtenerRecetas("pac-1", { soloEmitidas: true });

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "estado",
      valor: ESTADOS_RECETA.EMITIDA,
    });
  });
});

describe("anularReceta", () => {
  it("sin motivo se rechaza: una anulacion sin motivo no sirve de nada", async () => {
    const { error } = await anularReceta("rec-1", { motivo: "   ", anuladaPor: "per-1" });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
    expect(error.mensaje).toContain("motivo");
  });

  it("sin quien anula se rechaza", async () => {
    const { error } = await anularReceta("rec-1", { motivo: "Error de dosis" });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("manda el estado, el motivo y el responsable juntos", async () => {
    const cliente = crearCliente({ tabla: { data: FILA_RECETA, error: null } });
    dobles.cliente = cliente;

    await anularReceta("rec-1", { motivo: "  Error de dosis  ", anuladaPor: "per-1" });

    const update = cliente.llamadas.find((l) => l.paso === "update");
    expect(update.valores.estado).toBe(ESTADOS_RECETA.ANULADA);
    expect(update.valores.motivo_anulacion).toBe("Error de dosis");
    expect(update.valores.anulada_por).toBe("per-1");
    expect(update.valores.anulada_en).toBeTruthy();
  });

  it("no existe forma de editar el contenido de una receta emitida", async () => {
    const modulo = await import("./recetas.api.js");

    expect(Object.keys(modulo)).not.toContain("actualizarReceta");
    expect(Object.keys(modulo)).not.toContain("editarReceta");
  });
});
