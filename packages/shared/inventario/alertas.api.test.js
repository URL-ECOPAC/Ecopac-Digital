// Pruebas de las consultas de Supabase de las alertas de vencimiento (issue #151).
//
// Mismo patron de mock que lotes.api.test.js/medicamentos.api.test.js: un doble de
// obtenerSupabase() que registra cada paso de la cadena y resuelve con la respuesta que la
// prueba le entregue. No hay Supabase real ni red.
//
// Ningun dato real: medicamentos y lotes son inventados.

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
const { listarAlertas, historialAlertas, atenderAlerta, ACCIONES_DE_ALERTA } =
  await import("./alertas.api.js");

/** Doble de un cliente de Supabase que resuelve con una unica respuesta configurada. */
function crearCliente({ respuesta = { data: [], error: null } } = {}) {
  const llamadas = [];

  function crearEncadenable() {
    const resolver = async () =>
      respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;

    const encadenable = {
      update(valores) {
        llamadas.push({ paso: "update", valores });
        return encadenable;
      },
      select(columnas) {
        llamadas.push({ paso: "select", columnas });
        return encadenable;
      },
      eq(columna, valor) {
        llamadas.push({ paso: "eq", columna, valor });
        return encadenable;
      },
      order(columna, opciones) {
        llamadas.push({ paso: "order", columna, opciones });
        return encadenable;
      },
      single: resolver,
      maybeSingle: resolver,
      then(resolve, reject) {
        return resolver().then(resolve, reject);
      },
    };

    return encadenable;
  }

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return crearEncadenable();
    },
  };
}

function filaDeAlerta(cambios = {}) {
  return {
    id: "alerta-1",
    loteId: "lote-1",
    estado: "pendiente",
    cantidadAfectada: 20,
    accion: null,
    atendidaPor: null,
    atendidaEn: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    lote: {
      numeroLote: "L-001",
      fechaVencimiento: "2026-09-15",
      medicamento: { nombre: "Amoxicilina" },
    },
    ...cambios,
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarAlertas", () => {
  it("devuelve las alertas pendientes con medicamento, lote, cantidad y dias restantes", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: [filaDeAlerta()], error: null },
    });

    const { alertas, error } = await listarAlertas();

    expect(error).toBeNull();
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      medicamento: "Amoxicilina",
      numeroLote: "L-001",
      fechaVencimiento: "2026-09-15",
      cantidadAfectada: 20,
    });
    expect(alertas[0].diasRestantes).not.toBeNull();
  });

  it("solo pide alertas pendientes", async () => {
    const cliente = crearCliente({ respuesta: { data: [], error: null } });
    dobles.cliente = cliente;

    await listarAlertas();

    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "estado", valor: "pendiente" });
  });

  it("ordena por proximidad de vencimiento, la mas urgente primero", async () => {
    dobles.cliente = crearCliente({
      respuesta: {
        data: [
          filaDeAlerta({
            id: "lejos",
            lote: { ...filaDeAlerta().lote, fechaVencimiento: "2027-01-01" },
          }),
          filaDeAlerta({
            id: "vencida",
            lote: { ...filaDeAlerta().lote, fechaVencimiento: "2020-01-01" },
          }),
          filaDeAlerta({
            id: "cerca",
            lote: { ...filaDeAlerta().lote, fechaVencimiento: "2026-01-01" },
          }),
        ],
        error: null,
      },
    });

    const { alertas } = await listarAlertas();

    expect(alertas.map((a) => a.id)).toEqual(["vencida", "cerca", "lejos"]);
  });
});

describe("historialAlertas", () => {
  it("pide las alertas atendidas, la mas reciente primero", async () => {
    const cliente = crearCliente({
      respuesta: {
        data: [filaDeAlerta({ estado: "atendida", accion: "donado", atendidaEn: "2026-02-01" })],
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { alertas, error } = await historialAlertas();

    expect(error).toBeNull();
    expect(alertas[0].estado).toBe("atendida");
    expect(alertas[0].accion).toBe("donado");
    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "estado", valor: "atendida" });
    expect(cliente.llamadas).toContainEqual({
      paso: "order",
      columna: "atendida_en",
      opciones: { ascending: false },
    });
  });
});

describe("atenderAlerta", () => {
  it("solo administracion puede atender, sin llegar a la red", async () => {
    const { alerta, error } = await atenderAlerta("alerta-1", {
      accion: "donado",
      usuarioId: "u-1",
      rolUsuario: "medico",
    });

    expect(alerta).toBeNull();
    expect(error.mensaje).toContain("administracion");
    expect(dobles.cliente).toBeNull();
  });

  it("exige una accion valida (una de ACCIONES_DE_ALERTA)", async () => {
    const { error } = await atenderAlerta("alerta-1", {
      accion: "tirado a la basura",
      usuarioId: "u-1",
      rolUsuario: "administrador",
    });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("exige el usuario que atiende", async () => {
    const { error } = await atenderAlerta("alerta-1", {
      accion: "donado",
      rolUsuario: "administrador",
    });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("cierra la alerta con la accion, quien la atendio y cuando (queda auditada)", async () => {
    const cliente = crearCliente({
      respuesta: {
        data: filaDeAlerta({
          estado: "atendida",
          accion: "reubicado",
          atendidaPor: "u-1",
          atendidaEn: "2026-02-01T00:00:00Z",
        }),
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { alerta, error } = await atenderAlerta("alerta-1", {
      accion: "reubicado",
      usuarioId: "u-1",
      rolUsuario: "administrador",
    });

    expect(error).toBeNull();
    expect(alerta.estado).toBe("atendida");
    expect(alerta.accion).toBe("reubicado");

    const paso = cliente.llamadas.find((l) => l.paso === "update");
    expect(paso.valores).toMatchObject({
      estado: "atendida",
      accion: "reubicado",
      atendida_por: "u-1",
    });
    expect(paso.valores.atendida_en).toBeTruthy();
  });

  it("ACCIONES_DE_ALERTA expone los tres valores del enum accion_alerta (00021)", () => {
    expect(ACCIONES_DE_ALERTA).toEqual(["donado", "reubicado", "descartado"]);
  });
});
