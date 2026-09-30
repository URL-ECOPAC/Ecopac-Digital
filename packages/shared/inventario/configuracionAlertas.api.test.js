// Pruebas de las consultas de la configuracion de los avisos de vencimiento (issue #899).
//
// Mismo patron de mock que alertas.api.test.js: un doble de obtenerSupabase() que registra cada
// paso de la cadena. No hay Supabase real ni red.

import { describe, expect, it, vi } from "vitest";

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
const { guardarConfiguracionAlertas, obtenerConfiguracionAlertas } =
  await import("./configuracionAlertas.api.js");

function crearCliente(respuesta) {
  const llamadas = [];
  const encadenable = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return encadenable;
    },
    update(valores) {
      llamadas.push({ paso: "update", valores });
      return encadenable;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return encadenable;
    },
    single: async () => respuesta,
  };
  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return encadenable;
    },
  };
}

const FILA = {
  id: "cfg-1",
  umbralesDias: [90, 30],
  actualizadoPor: "perfil-1",
  updatedAt: "2026-09-30T12:00:00Z",
  actualizadoPorPerfil: { nombres: "Ana", apellidos: "Prueba" },
};

describe("obtenerConfiguracionAlertas", () => {
  it("lee la fila unica y la devuelve en `configuracion`", async () => {
    dobles.cliente = crearCliente({ data: FILA, error: null });

    const { configuracion, error } = await obtenerConfiguracionAlertas();

    expect(error).toBeNull();
    expect(configuracion).toEqual({
      id: "cfg-1",
      umbralesDias: [90, 30],
      actualizadoPor: "perfil-1",
      actualizadoPorNombre: "Ana Prueba",
      updatedAt: "2026-09-30T12:00:00Z",
    });
    expect(dobles.cliente.llamadas[0]).toEqual({
      paso: "from",
      tabla: "configuracion_alertas_caducidad",
    });
  });

  it("si la consulta falla, devuelve el error normalizado y configuracion null", async () => {
    dobles.cliente = crearCliente({ data: null, error: { code: "42501", message: "denegado" } });

    const { configuracion, error } = await obtenerConfiguracionAlertas();

    expect(configuracion).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("guardarConfiguracionAlertas", () => {
  it("una lista vacia es valida: solo se avisa el dia que vence", async () => {
    dobles.cliente = crearCliente({ data: { ...FILA, umbralesDias: [] }, error: null });

    const { configuracion, error } = await guardarConfiguracionAlertas("cfg-1", {
      umbralesDias: [],
      rolUsuario: "administrador",
    });

    expect(error).toBeNull();
    expect(configuracion.umbralesDias).toEqual([]);
    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "update",
      valores: { umbrales_dias: [] },
    });
  });

  it("un rol que no es administracion no llega al servidor", async () => {
    dobles.cliente = null;

    const { configuracion, error } = await guardarConfiguracionAlertas("cfg-1", {
      umbralesDias: [30],
      rolUsuario: "medico",
    });

    expect(configuracion).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });

  it("una lista invalida no llega al servidor", async () => {
    dobles.cliente = null;

    const { error } = await guardarConfiguracionAlertas("cfg-1", {
      umbralesDias: [90, 60, 30, 15, 7],
      rolUsuario: "administrador",
    });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("manda las antelaciones como enteros de mayor a menor y devuelve lo guardado", async () => {
    dobles.cliente = crearCliente({ data: { ...FILA, umbralesDias: [60, 7] }, error: null });

    const { configuracion, error } = await guardarConfiguracionAlertas("cfg-1", {
      umbralesDias: ["7", "60"],
      rolUsuario: "administrador",
    });

    expect(error).toBeNull();
    expect(configuracion.umbralesDias).toEqual([60, 7]);
    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "update",
      valores: { umbrales_dias: [60, 7] },
    });
    expect(dobles.cliente.llamadas).toContainEqual({ paso: "eq", columna: "id", valor: "cfg-1" });
  });
});
