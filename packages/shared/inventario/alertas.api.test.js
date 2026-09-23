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
const {
  listarAlertas,
  historialAlertas,
  atenderAlerta,
  sincronizarAlertas,
  accionesPermitidasParaAlerta,
  efectoDeAccionSobreElStock,
} = await import("./alertas.api.js");
const { ACCIONES_DE_ALERTA } = await import("../enums.js");

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
      limit(cantidad) {
        llamadas.push({ paso: "limit", cantidad });
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
    async rpc(nombre, argumentos) {
      llamadas.push({ paso: "rpc", nombre, argumentos });
      return respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;
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
      existencias: [{ cantidadDisponible: 20 }],
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

  // Issue #859: cantidadAfectada queda congelada al generar la alerta y no baja si despues se
  // registra una salida del lote por fuera de "Atender" -entrega, traslado, baja manual-, asi
  // que la pantalla seguia mostrando (y ofreciendo repartir) un total que ya no existia.
  // cantidadDisponible suma las existencias embebidas, la misma cuenta que hace el servidor en
  // fn_atender_alerta_caducidad (00143).
  it("cantidadDisponible suma las existencias vivas del lote, no cantidadAfectada", async () => {
    dobles.cliente = crearCliente({
      respuesta: {
        data: [
          filaDeAlerta({
            cantidadAfectada: 20,
            lote: {
              ...filaDeAlerta().lote,
              existencias: [{ cantidadDisponible: 5 }, { cantidadDisponible: 3 }],
            },
          }),
        ],
        error: null,
      },
    });

    const { alertas } = await listarAlertas();

    expect(alertas[0].cantidadAfectada).toBe(20);
    expect(alertas[0].cantidadDisponible).toBe(8);
  });

  it("cantidadDisponible es 0 sin existencias vivas (lote ya agotado por una salida aparte)", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: [filaDeAlerta({ lote: { ...filaDeAlerta().lote, existencias: [] } })], error: null },
    });

    const { alertas } = await listarAlertas();

    expect(alertas[0].cantidadDisponible).toBe(0);
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

  it("acota a las recientes y trae quien la atendio por nombre (issue #755)", async () => {
    const cliente = crearCliente({
      respuesta: {
        data: [
          filaDeAlerta({
            estado: "atendida",
            accion: "descartado",
            atendidaPor: "perfil-1",
            atendidaEn: "2026-02-01",
            atendidaPorPerfil: { nombres: "Ana", apellidos: "Prueba" },
          }),
          filaDeAlerta({ id: "sin-perfil", estado: "atendida", atendidaPorPerfil: null }),
        ],
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { alertas } = await historialAlertas({ limite: 5 });

    expect(alertas.map((a) => a.atendidaPorNombre)).toEqual(["Ana Prueba", null]);
    expect(cliente.llamadas).toContainEqual({ paso: "limit", cantidad: 5 });
  });
});

describe("atenderAlerta", () => {
  it("solo administracion puede atender, sin llegar a la red", async () => {
    const { alerta, error } = await atenderAlerta("alerta-1", {
      acciones: [{ accion: "donado", cantidad: 5 }],
      rolUsuario: "medico",
      totalDisponible: 5,
    });

    expect(alerta).toBeNull();
    expect(error.mensaje).toContain("administración");
    expect(dobles.cliente).toBeNull();
  });

  it("exige una accion valida (una de ACCIONES_DE_ALERTA)", async () => {
    const { error } = await atenderAlerta("alerta-1", {
      acciones: [{ accion: "tirado a la basura", cantidad: 5 }],
      rolUsuario: "administrador",
      totalDisponible: 5,
    });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("reubicar exige la bodega destino, sin llegar a la red", async () => {
    const { error } = await atenderAlerta("alerta-1", {
      acciones: [{ accion: "reubicado", cantidad: 5 }],
      rolUsuario: "administrador",
      totalDisponible: 5,
    });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
    expect(dobles.cliente).toBeNull();
  });

  it("exige que la suma de las acciones sea exactamente el disponible, sin llegar a la red", async () => {
    const { error } = await atenderAlerta("alerta-1", {
      acciones: [{ accion: "descartado", cantidad: 4 }],
      rolUsuario: "administrador",
      totalDisponible: 5,
    });

    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
    expect(error.detalle).toContain("exactamente");
    expect(dobles.cliente).toBeNull();
  });

  // Issue #755: atender era un UPDATE de la alerta y nada mas; el stock quedaba igual y el
  // generador la volvia a crear. Ahora pasa por fn_atender_alerta_caducidad, que da de baja o
  // traslada el stock en la misma transaccion. PLAN.md punto 5 (00143): p_acciones es una lista,
  // no una sola accion sobre el total.
  it("atiende por fn_atender_alerta_caducidad y devuelve la alerta cerrada", async () => {
    const cliente = crearCliente({
      respuesta: {
        data: filaDeAlerta({ estado: "atendida", accion: "descartado", atendidaPor: "u-1" }),
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { alerta, error } = await atenderAlerta("alerta-1", {
      acciones: [{ accion: "descartado", cantidad: 10 }],
      rolUsuario: "administrador",
      totalDisponible: 10,
    });

    expect(error).toBeNull();
    expect(alerta.estado).toBe("atendida");
    expect(cliente.llamadas).toContainEqual({
      paso: "rpc",
      nombre: "fn_atender_alerta_caducidad",
      argumentos: {
        p_alerta_id: "alerta-1",
        p_acciones: [{ accion: "descartado", cantidad: 10, bodegaDestinoId: null }],
      },
    });
    expect(cliente.llamadas.some((l) => l.paso === "update")).toBe(false);
  });

  it("varias acciones que suman el disponible se mandan todas en la lista", async () => {
    const cliente = crearCliente({
      respuesta: { data: filaDeAlerta({ estado: "atendida", accion: null }), error: null },
    });
    dobles.cliente = cliente;

    await atenderAlerta("alerta-1", {
      acciones: [
        { accion: "donado", cantidad: 6 },
        { accion: "descartado", cantidad: 4 },
      ],
      rolUsuario: "administrador",
      totalDisponible: 10,
    });

    const rpc = cliente.llamadas.find((l) => l.paso === "rpc");
    expect(rpc.argumentos.p_acciones).toEqual([
      { accion: "donado", cantidad: 6, bodegaDestinoId: null },
      { accion: "descartado", cantidad: 4, bodegaDestinoId: null },
    ]);
  });

  it("reubicar manda la bodega destino de esa accion a la funcion", async () => {
    const cliente = crearCliente({
      respuesta: { data: filaDeAlerta({ estado: "atendida", accion: "reubicado" }), error: null },
    });
    dobles.cliente = cliente;

    await atenderAlerta("alerta-1", {
      acciones: [{ accion: "reubicado", cantidad: 10, bodegaDestinoId: "bodega-9" }],
      rolUsuario: "administrador",
      totalDisponible: 10,
    });

    const rpc = cliente.llamadas.find((l) => l.paso === "rpc");
    expect(rpc.argumentos.p_acciones[0].bodegaDestinoId).toBe("bodega-9");
  });

  it("si la base lo rechaza, devuelve el error", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "23514", message: "Un lote vencido no se reubica" } },
    });

    const { alerta, error } = await atenderAlerta("alerta-1", {
      acciones: [{ accion: "reubicado", cantidad: 10, bodegaDestinoId: "bodega-9" }],
      rolUsuario: "administrador",
      totalDisponible: 10,
    });

    expect(alerta).toBeNull();
    expect(error).not.toBeNull();
  });

  it("ACCIONES_DE_ALERTA expone los tres valores del enum accion_alerta (00021)", () => {
    expect(Object.values(ACCIONES_DE_ALERTA)).toEqual(["donado", "reubicado", "descartado"]);
  });
});

describe("accionesPermitidasParaAlerta", () => {
  const opciones = [
    { value: "donado", label: "Donado" },
    { value: "reubicado", label: "Reubicado" },
    { value: "descartado", label: "Descartado" },
  ];

  it("un lote por vencer admite las tres acciones", () => {
    expect(accionesPermitidasParaAlerta({ diasRestantes: 5 }, opciones)).toHaveLength(3);
  });

  it("un lote vencido no se reubica", () => {
    expect(
      accionesPermitidasParaAlerta({ diasRestantes: -1 }, opciones).map((o) => o.value),
    ).toEqual(["donado", "descartado"]);
  });
});

describe("efectoDeAccionSobreElStock", () => {
  it("dice cuantas unidades se dan de baja o se trasladan", () => {
    expect(efectoDeAccionSobreElStock("descartado", 12)).toContain("dan de baja 12 unidades");
    expect(efectoDeAccionSobreElStock("reubicado", 12)).toContain("trasladan");
    expect(efectoDeAccionSobreElStock("", 12)).toBeNull();
  });
});

describe("sincronizarAlertas", () => {
  // Issue #838: un lote ya vencido no tenia alerta, asi que "Vencidos - Para dar de baja" salia
  // vacio con el lote a la vista en el inventario. La 00129 lo arregla en la funcion que genera
  // las alertas; esto es la puerta para no tener que esperar a la rutina de la noche.
  it("llama a fn_sincronizar_alertas_caducidad y devuelve cuantas creo", async () => {
    const cliente = crearCliente({ respuesta: { data: 3, error: null } });
    dobles.cliente = cliente;

    const { creadas, error } = await sincronizarAlertas();

    expect(error).toBeNull();
    expect(creadas).toBe(3);
    expect(cliente.llamadas).toContainEqual({
      paso: "rpc",
      nombre: "fn_sincronizar_alertas_caducidad",
      argumentos: undefined,
    });
  });

  it("normaliza el 42501 que devuelve la funcion a quien no es administracion", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: null, error: { code: "42501" } } });

    const { creadas, error } = await sincronizarAlertas();

    expect(creadas).toBe(0);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});
