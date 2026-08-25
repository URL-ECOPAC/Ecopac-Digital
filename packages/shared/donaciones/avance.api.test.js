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
  actualizarAvance,
  esPorcentajeDeAvanceValido,
  listarHitos,
  listarSeguimiento,
  marcarHitoCumplido,
  obtenerAdvertenciaDeCierre,
  reabrirHito,
  registrarHito,
  registrarNota,
} = await import("./avance.api.js");

function doble(respuesta) {
  const llamadas = [];

  function resolver() {
    return respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
  }

  const cadena = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return cadena;
    },
    insert(valores) {
      llamadas.push({ paso: "insert", valores });
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
    is(columna, valor) {
      llamadas.push({ paso: "is", columna, valor });
      return cadena;
    },
    order(columna, opciones) {
      llamadas.push({ paso: "order", columna, opciones });
      return cadena;
    },
    single: resolver,
    maybeSingle: resolver,
    then(alCumplir, alFallar) {
      return resolver().then(alCumplir, alFallar);
    },
  };

  return {
    llamadas,
    cliente: {
      from(tabla) {
        llamadas.push({ paso: "from", tabla });
        return cadena;
      },
    },
  };
}

function pasos(llamadas, paso) {
  return llamadas.filter((llamada) => llamada.paso === paso);
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("esPorcentajeDeAvanceValido", () => {
  it("acepta los extremos del rango", () => {
    expect(esPorcentajeDeAvanceValido(0)).toBe(true);
    expect(esPorcentajeDeAvanceValido(100)).toBe(true);
  });

  it("rechaza fuera de rango, decimales y texto", () => {
    expect(esPorcentajeDeAvanceValido(-1)).toBe(false);
    expect(esPorcentajeDeAvanceValido(101)).toBe(false);
    expect(esPorcentajeDeAvanceValido(50.5)).toBe(false);
    expect(esPorcentajeDeAvanceValido("50")).toBe(false);
  });
});

describe("registrarHito", () => {
  it("traduce los campos a snake_case e incluye el proyecto", async () => {
    const { cliente, llamadas } = doble({ data: { id: "hito-1" }, error: null });
    dobles.cliente = cliente;

    const { hito, error } = await registrarHito("proyecto-1", {
      nombre: "Entrega de medicamentos",
      fechaPrevista: "2026-09-01",
    });

    expect(error).toBeNull();
    expect(hito).toEqual({ id: "hito-1" });
    expect(pasos(llamadas, "from")[0].tabla).toBe("proyecto_hitos");
    expect(pasos(llamadas, "insert")[0].valores).toEqual({
      proyecto_id: "proyecto-1",
      nombre: "Entrega de medicamentos",
      fecha_prevista: "2026-09-01",
    });
  });

  it("no toca el servidor si no hay proyecto", async () => {
    const { hito, error } = await registrarHito(undefined, { nombre: "Sin proyecto" });

    expect(hito).toBeNull();
    expect(error).toBeNull();
  });
});

describe("listarHitos", () => {
  it("ordena por fecha prevista y devuelve siempre un arreglo", async () => {
    const { cliente, llamadas } = doble({ data: [{ id: "hito-1" }], error: null });
    dobles.cliente = cliente;

    const { hitos, error } = await listarHitos("proyecto-1");

    expect(error).toBeNull();
    expect(hitos).toHaveLength(1);
    expect(pasos(llamadas, "order")[0]).toEqual({
      paso: "order",
      columna: "fecha_prevista",
      opciones: { ascending: true },
    });
    expect(pasos(llamadas, "is")).toHaveLength(0);
  });

  it("filtra por fecha real nula cuando se piden solo los pendientes", async () => {
    const { cliente, llamadas } = doble({ data: [], error: null });
    dobles.cliente = cliente;

    await listarHitos("proyecto-1", { soloPendientes: true });

    expect(pasos(llamadas, "is")[0]).toEqual({
      paso: "is",
      columna: "fecha_real",
      valor: null,
    });
  });

  it("ante un error devuelve arreglo vacio y el error normalizado", async () => {
    dobles.cliente = doble({ data: null, error: { code: "42501" } }).cliente;

    const { hitos, error } = await listarHitos("proyecto-1");

    expect(hitos).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("marcarHitoCumplido y reabrirHito", () => {
  it("guarda la fecha real indicada", async () => {
    const { cliente, llamadas } = doble({ data: { id: "hito-1" }, error: null });
    dobles.cliente = cliente;

    await marcarHitoCumplido("hito-1", "2026-09-15");

    expect(pasos(llamadas, "update")[0].valores).toEqual({ fecha_real: "2026-09-15" });
  });

  it("sin fecha usa la de hoy en formato de fecha suelta", async () => {
    const { cliente, llamadas } = doble({ data: { id: "hito-1" }, error: null });
    dobles.cliente = cliente;

    await marcarHitoCumplido("hito-1");

    const { fecha_real: fechaReal } = pasos(llamadas, "update")[0].valores;
    expect(fechaReal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reabrir deja la fecha real en nulo", async () => {
    const { cliente, llamadas } = doble({ data: { id: "hito-1" }, error: null });
    dobles.cliente = cliente;

    await reabrirHito("hito-1");

    expect(pasos(llamadas, "update")[0].valores).toEqual({ fecha_real: null });
  });
});

describe("actualizarAvance", () => {
  it("guarda un porcentaje valido", async () => {
    const { cliente, llamadas } = doble({
      data: { id: "proyecto-1", porcentajeAvance: 40 },
      error: null,
    });
    dobles.cliente = cliente;

    const { proyecto, error } = await actualizarAvance("proyecto-1", 40);

    expect(error).toBeNull();
    expect(proyecto.porcentajeAvance).toBe(40);
    expect(pasos(llamadas, "update")[0].valores).toEqual({ porcentaje_avance: 40 });
  });

  it("acepta los extremos cero y cien", async () => {
    for (const porcentaje of [0, 100]) {
      const { cliente } = doble({ data: { id: "proyecto-1" }, error: null });
      dobles.cliente = cliente;
      const { error } = await actualizarAvance("proyecto-1", porcentaje);
      expect(error).toBeNull();
    }
  });

  it("rechaza fuera de rango sin gastar una ida y vuelta al servidor", async () => {
    for (const porcentaje of [-1, 101, 12.5, "40"]) {
      const { proyecto, error } = await actualizarAvance("proyecto-1", porcentaje);
      expect(proyecto).toBeNull();
      expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
      expect(error.mensaje).toContain("entre 0 y 100");
    }
  });
});

describe("registrarNota", () => {
  it("recorta los espacios sobrantes antes de guardar", async () => {
    const { cliente, llamadas } = doble({ data: { id: "entrada-1" }, error: null });
    dobles.cliente = cliente;

    await registrarNota("proyecto-1", "   Se entrego el lote  ");

    expect(pasos(llamadas, "insert")[0].valores).toEqual({
      proyecto_id: "proyecto-1",
      nota: "Se entrego el lote",
    });
  });

  it("rechaza una nota vacia o de solo espacios", async () => {
    for (const nota of ["", "   ", null]) {
      const { entrada, error } = await registrarNota("proyecto-1", nota);
      expect(entrada).toBeNull();
      expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
    }
  });
});

describe("listarSeguimiento", () => {
  it("devuelve la bitacora de la mas reciente a la mas antigua", async () => {
    const { cliente, llamadas } = doble({ data: [{ id: "entrada-1" }], error: null });
    dobles.cliente = cliente;

    const { bitacora, error } = await listarSeguimiento("proyecto-1");

    expect(error).toBeNull();
    expect(bitacora).toHaveLength(1);
    expect(pasos(llamadas, "order")[0]).toEqual({
      paso: "order",
      columna: "created_at",
      opciones: { ascending: false },
    });
  });
});

describe("obtenerAdvertenciaDeCierre", () => {
  it("no advierte nada si no quedan hitos pendientes", async () => {
    dobles.cliente = doble({ data: [], error: null }).cliente;

    const { advertencia, error } = await obtenerAdvertenciaDeCierre("proyecto-1");

    expect(error).toBeNull();
    expect(advertencia).toBeNull();
  });

  it("advierte en singular con un solo hito pendiente", async () => {
    dobles.cliente = doble({ data: [{ id: "hito-1" }], error: null }).cliente;

    const { advertencia } = await obtenerAdvertenciaDeCierre("proyecto-1");

    expect(advertencia.cantidad).toBe(1);
    expect(advertencia.mensaje).toContain("1 hito sin cumplir");
  });

  it("advierte en plural y devuelve cuales son", async () => {
    dobles.cliente = doble({
      data: [{ id: "hito-1" }, { id: "hito-2" }, { id: "hito-3" }],
      error: null,
    }).cliente;

    const { advertencia } = await obtenerAdvertenciaDeCierre("proyecto-1");

    expect(advertencia.cantidad).toBe(3);
    expect(advertencia.mensaje).toContain("3 hitos sin cumplir");
    expect(advertencia.hitosPendientes).toHaveLength(3);
  });

  it("advierte sin bloquear: el mensaje deja claro que se puede cerrar igual", async () => {
    dobles.cliente = doble({ data: [{ id: "hito-1" }], error: null }).cliente;

    const { advertencia } = await obtenerAdvertenciaDeCierre("proyecto-1");

    expect(advertencia.mensaje).toContain("Puedes cerrarlo de todas formas");
  });

  it("propaga el error de la consulta en vez de inventar una advertencia", async () => {
    dobles.cliente = doble(new Error("Network request failed")).cliente;

    const { advertencia, error } = await obtenerAdvertenciaDeCierre("proyecto-1");

    expect(advertencia).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED);
  });
});
