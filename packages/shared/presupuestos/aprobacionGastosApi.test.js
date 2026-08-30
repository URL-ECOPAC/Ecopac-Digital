import { beforeEach, describe, expect, it, vi } from "vitest";
import { listarGastosPendientes, aprobarGasto, rechazarGasto } from "./aprobacionGastosApi.js";

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

function clienteUpdate(respuesta) {
  const llamadas = [];
  const encadenable = {
    update(valores) {
      llamadas.push({ paso: "update", valores });
      return encadenable;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return encadenable;
    },
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return encadenable;
    },
    order(columna, opciones) {
      llamadas.push({ paso: "order", columna, opciones });
      return encadenable;
    },
    single: async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta),
    then(resolve, reject) {
      const promesa = respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
      return promesa.then(resolve, reject);
    },
  };

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return encadenable;
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarGastosPendientes", () => {
  it("filtra por estado pendiente y devuelve { gastos, error }", async () => {
    const cliente = clienteUpdate({ data: [{ id: "gasto-1" }], error: null });
    dobles.cliente = cliente;

    const { gastos, error } = await listarGastosPendientes();

    expect(error).toBeNull();
    expect(gastos).toEqual([{ id: "gasto-1" }]);
    expect(cliente.llamadas).toContainEqual({ paso: "from", tabla: "gastos" });
    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "estado", valor: "pendiente" });
  });

  it("devuelve arreglo vacio, no null, cuando la consulta no trae filas", async () => {
    dobles.cliente = clienteUpdate({ data: null, error: null });

    const { gastos, error } = await listarGastosPendientes();

    expect(error).toBeNull();
    expect(gastos).toEqual([]);
  });

  it("normaliza el error del servidor en lugar de reenviarlo", async () => {
    dobles.cliente = clienteUpdate({ data: null, error: { code: "42501" } });

    const { gastos, error } = await listarGastosPendientes();

    expect(gastos).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
    expect(error.mensaje).toContain("permiso");
  });
});

describe("aprobarGasto", () => {
  it("retorna error de campo requerido si faltan los IDs, sin tocar el cliente", async () => {
    const { gasto, error } = await aprobarGasto({ gastoId: null, usuarioId: null });

    expect(gasto).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("actualiza estado, aprobado_por y aprobado_en sin llamar a ningun RPC", async () => {
    const cliente = clienteUpdate({ data: { id: "gasto-1", estado: "aprobado" }, error: null });
    dobles.cliente = cliente;

    const { gasto, error } = await aprobarGasto({ gastoId: "gasto-1", usuarioId: "admin-1" });

    expect(error).toBeNull();
    expect(gasto).toEqual({ id: "gasto-1", estado: "aprobado" });

    const pasoUpdate = cliente.llamadas.find((llamada) => llamada.paso === "update");
    expect(pasoUpdate.valores).toEqual(
      expect.objectContaining({ estado: "aprobado", aprobado_por: "admin-1" }),
    );
    expect(pasoUpdate.valores).toHaveProperty("aprobado_en");
    expect(cliente.llamadas.some((llamada) => llamada.paso === "rpc")).toBe(false);
  });
});

describe("rechazarGasto", () => {
  it("retorna error de campo requerido si faltan los IDs, sin tocar el cliente", async () => {
    const { gasto, error } = await rechazarGasto({ gastoId: null, usuarioId: null, motivo: "Fuera de presupuesto" });

    expect(gasto).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("exige motivo, sin tocar el cliente", async () => {
    const { gasto, error } = await rechazarGasto({ gastoId: "gasto-1", usuarioId: "admin-1", motivo: "   " });

    expect(gasto).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
    expect(error.mensaje).not.toBe("");
  });

  it("escribe motivo_rechazo, aprobado_por y aprobado_en; nunca rechazado_por ni fecha_rechazo", async () => {
    const cliente = clienteUpdate({ data: { id: "gasto-1", estado: "rechazado" }, error: null });
    dobles.cliente = cliente;

    const { gasto, error } = await rechazarGasto({
      gastoId: "gasto-1",
      usuarioId: "admin-1",
      motivo: "Fuera de presupuesto",
    });

    expect(error).toBeNull();
    expect(gasto).toEqual({ id: "gasto-1", estado: "rechazado" });

    const pasoUpdate = cliente.llamadas.find((llamada) => llamada.paso === "update");
    expect(pasoUpdate.valores).toEqual({
      estado: "rechazado",
      aprobado_por: "admin-1",
      aprobado_en: expect.any(String),
      motivo_rechazo: "Fuera de presupuesto",
    });
    expect(pasoUpdate.valores).not.toHaveProperty("rechazado_por");
    expect(pasoUpdate.valores).not.toHaveProperty("fecha_rechazo");
  });

  it("normaliza la violacion del CHECK de coherencia del motivo", async () => {
    dobles.cliente = clienteUpdate({ data: null, error: { code: "23514" } });

    const { gasto, error } = await rechazarGasto({
      gastoId: "gasto-1",
      usuarioId: "admin-1",
      motivo: "Fuera de presupuesto",
    });

    expect(gasto).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });
});
