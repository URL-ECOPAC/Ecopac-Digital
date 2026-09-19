// Pruebas de las consultas del buzon de notificaciones (issue #755).
//
// Mismo patron de mock que inventario/alertas.api.test.js: un doble de obtenerSupabase() que
// registra cada paso de la cadena y resuelve con la respuesta que la prueba le entregue. Sin
// Supabase real ni red. Las columnas se contrastan contra la migracion 00138 en
// verificar:shared-esquema, no aqui.

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

const { contarNoLeidas, listarNotificaciones, marcarLeida, marcarTodasLeidas } =
  await import("./api.js");

function crearCliente({ respuesta = { data: [], error: null } } = {}) {
  const llamadas = [];

  function crearEncadenable() {
    const resolver = async () =>
      respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;

    const encadenable = {};
    for (const paso of ["select", "update", "eq", "is", "order", "limit"]) {
      encadenable[paso] = (...argumentos) => {
        llamadas.push({ paso, argumentos });
        return encadenable;
      };
    }
    encadenable.maybeSingle = resolver;
    encadenable.then = (resolve, reject) => resolver().then(resolve, reject);
    return encadenable;
  }

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", argumentos: [tabla] });
      return crearEncadenable();
    },
  };
}

function fila(cambios = {}) {
  return {
    id: "n-1",
    categoria: "caducidad",
    titulo: "Lote vencido: Medicamento de prueba",
    cuerpo: "El lote L-1 vencio.",
    enlace: "/inventario?tab=alertas",
    origenTabla: "alertas_caducidad",
    origenId: "a-1",
    leidaEn: null,
    createdAt: "2026-09-18T12:00:00Z",
    ...cambios,
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("listarNotificaciones", () => {
  it("devuelve { notificaciones } del perfil, la mas reciente primero, con `leida` derivada", async () => {
    dobles.cliente = crearCliente({
      respuesta: {
        data: [fila(), fila({ id: "n-2", leidaEn: "2026-09-18T13:00:00Z" })],
        error: null,
      },
    });

    const { notificaciones, error } = await listarNotificaciones("perfil-1");

    expect(error).toBeNull();
    expect(notificaciones.map((n) => [n.id, n.leida])).toEqual([
      ["n-1", false],
      ["n-2", true],
    ]);
    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "from",
      argumentos: ["notificaciones"],
    });
    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "eq",
      argumentos: ["perfil_id", "perfil-1"],
    });
    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "order",
      argumentos: ["created_at", { ascending: false }],
    });
  });

  it("un error de Supabase llega normalizado y con la lista vacia", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "42501", message: "permission denied" } },
    });

    const { notificaciones, error } = await listarNotificaciones("perfil-1");

    expect(notificaciones).toEqual([]);
    expect(error).not.toBeNull();
    expect(error.mensaje).toEqual(expect.any(String));
  });

  it("una excepcion de red no se propaga: vuelve como error", async () => {
    dobles.cliente = crearCliente({ respuesta: new TypeError("Failed to fetch") });

    const { notificaciones, error } = await listarNotificaciones("perfil-1");

    expect(notificaciones).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe("contarNoLeidas", () => {
  it("cuenta solo las no leidas del perfil, sin traer filas", async () => {
    dobles.cliente = crearCliente({ respuesta: { count: 3, error: null } });

    const { cantidad, error } = await contarNoLeidas("perfil-1");

    expect(error).toBeNull();
    expect(cantidad).toBe(3);
    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "select",
      argumentos: ["id", { count: "exact", head: true }],
    });
    expect(dobles.cliente.llamadas).toContainEqual({ paso: "is", argumentos: ["leida_en", null] });
  });
});

describe("marcarLeida", () => {
  it("escribe leida_en solo si todavia estaba en NULL y devuelve { notificacion }", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: fila({ leidaEn: "2026-09-18T14:00:00Z" }), error: null },
    });

    const { notificacion, error } = await marcarLeida("n-1");

    expect(error).toBeNull();
    expect(notificacion.leida).toBe(true);
    const actualizacion = dobles.cliente.llamadas.find((l) => l.paso === "update");
    expect(Object.keys(actualizacion.argumentos[0])).toEqual(["leida_en"]);
    expect(dobles.cliente.llamadas).toContainEqual({ paso: "is", argumentos: ["leida_en", null] });
  });

  it("si la base lo rechaza, devuelve el error y no una notificacion", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "42501", message: "permission denied" } },
    });

    const { notificacion, error } = await marcarLeida("n-1");

    expect(notificacion).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("marcarTodasLeidas", () => {
  it("marca las pendientes del perfil y devuelve { actualizadas }", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: [{ id: "n-1" }, { id: "n-2" }], error: null },
    });

    const { actualizadas, error } = await marcarTodasLeidas("perfil-1");

    expect(error).toBeNull();
    expect(actualizadas).toBe(2);
    expect(dobles.cliente.llamadas).toContainEqual({
      paso: "eq",
      argumentos: ["perfil_id", "perfil-1"],
    });
  });
});
