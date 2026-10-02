// Pruebas de obtenerProveedorDeDonante() (00175, issue #911).
//
// El resto de proveedores.api.js ya tiene sus pruebas en bodegas.api.test.js (issue #143). Esta
// funcion reemplaza a obtenerOCrearProveedorPorNombre() (issue #756): ya no busca por nombre ni crea
// nada, lee el proveedor que la base enlazo con el donante.

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

const { obtenerProveedorDeDonante } = await import("./proveedores.api.js");

/** Doble de obtenerSupabase() que responde siempre lo mismo y anota cada paso de la consulta. */
function crearCliente(respuesta) {
  const llamadas = [];
  const encadenable = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return encadenable;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return encadenable;
    },
    insert(datos) {
      llamadas.push({ paso: "insert", datos });
      return encadenable;
    },
    maybeSingle: async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta),
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

describe("obtenerProveedorDeDonante", () => {
  it("sin donante no consulta nada", async () => {
    expect(await obtenerProveedorDeDonante("")).toEqual({ proveedorId: null, error: null });
  });

  it("busca el proveedor por su enlace con el donante, no por el nombre", async () => {
    const cliente = crearCliente({ data: { id: "prov-1" }, error: null });
    dobles.cliente = cliente;

    const { proveedorId, error } = await obtenerProveedorDeDonante("don-1");

    expect(error).toBeNull();
    expect(proveedorId).toBe("prov-1");
    expect(cliente.llamadas).toContainEqual({ paso: "from", tabla: "proveedores" });
    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "donante_id", valor: "don-1" });
    expect(cliente.llamadas.some((llamada) => llamada.paso === "insert")).toBe(false);
  });

  it("un donante sin proveedor visible devuelve null sin error", async () => {
    dobles.cliente = crearCliente({ data: null, error: null });

    expect(await obtenerProveedorDeDonante("don-2")).toEqual({ proveedorId: null, error: null });
  });

  it("normaliza el error si la consulta falla", async () => {
    dobles.cliente = crearCliente({ data: null, error: { code: "42501" } });

    const { proveedorId, error } = await obtenerProveedorDeDonante("don-3");

    expect(proveedorId).toBeNull();
    expect(error).not.toBeNull();
  });

  it("un fallo de red tambien vuelve como error, no como excepcion", async () => {
    dobles.cliente = crearCliente(new Error("Failed to fetch"));

    const { proveedorId, error } = await obtenerProveedorDeDonante("don-4");

    expect(proveedorId).toBeNull();
    expect(error).not.toBeNull();
  });
});
