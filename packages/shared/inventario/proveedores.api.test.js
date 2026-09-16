// Pruebas de obtenerOCrearProveedorPorNombre() (issue #756).
//
// El resto de proveedores.api.js ya tiene sus pruebas en bodegas.api.test.js (issue #143); esta
// funcion queda aparte porque encadena dos llamadas distintas -una busqueda y, condicionalmente,
// una creacion- y necesita un doble que pueda devolver una respuesta diferente para cada una, no
// solo un mismo doble de obtenerSupabase() de nuevo.

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

const { obtenerOCrearProveedorPorNombre } = await import("./proveedores.api.js");

/** Doble de obtenerSupabase() con una cola de respuestas por tabla, en el orden en que se piden. */
function crearCliente(respuestasPorTabla) {
  const llamadas = [];
  const colas = new Map(
    Object.entries(respuestasPorTabla).map(([tabla, respuesta]) => [
      tabla,
      Array.isArray(respuesta) ? [...respuesta] : [respuesta],
    ]),
  );

  function siguienteRespuesta(tabla) {
    const cola = colas.get(tabla);
    if (!cola || cola.length === 0) {
      throw new Error(`La prueba no configuro una respuesta para la tabla "${tabla}".`);
    }
    return cola.length > 1 ? cola.shift() : cola[0];
  }

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      const respuesta = siguienteRespuesta(tabla);
      const resolver = async () =>
        respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;

      const encadenable = {
        select(columnas) {
          llamadas.push({ paso: "select", tabla, columnas });
          return encadenable;
        },
        insert(datos) {
          llamadas.push({ paso: "insert", tabla, datos });
          return encadenable;
        },
        ilike(columna, valor) {
          llamadas.push({ paso: "ilike", tabla, columna, valor });
          return encadenable;
        },
        order(columna, opciones) {
          llamadas.push({ paso: "order", tabla, columna, opciones });
          return encadenable;
        },
        single: resolver,
        then(resolve, reject) {
          return resolver().then(resolve, reject);
        },
      };

      return encadenable;
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("obtenerOCrearProveedorPorNombre", () => {
  it("sin nombre no consulta nada", async () => {
    const { proveedorId, error } = await obtenerOCrearProveedorPorNombre("", "donante");

    expect(proveedorId).toBeNull();
    expect(error).toBeNull();
  });

  it("reutiliza el proveedor existente si el nombre coincide, sin acentos ni mayusculas", async () => {
    const cliente = crearCliente({
      proveedores: {
        data: [{ id: "prov-1", nombre: "Farmacéuticos Únidos" }],
        error: null,
      },
    });
    dobles.cliente = cliente;

    const { proveedorId, error } = await obtenerOCrearProveedorPorNombre(
      "farmaceuticos unidos",
      "donante",
    );

    expect(error).toBeNull();
    expect(proveedorId).toBe("prov-1");
    expect(cliente.llamadas.some((llamada) => llamada.paso === "insert")).toBe(false);
  });

  it("crea el proveedor si no existe ninguno con ese nombre", async () => {
    const cliente = crearCliente({
      proveedores: [
        { data: [], error: null },
        { data: { id: "prov-nuevo", nombre: "Cruz Roja Guatemalteca" }, error: null },
      ],
    });
    dobles.cliente = cliente;

    const { proveedorId, error } = await obtenerOCrearProveedorPorNombre(
      "Cruz Roja Guatemalteca",
      "donante",
    );

    expect(error).toBeNull();
    expect(proveedorId).toBe("prov-nuevo");
    expect(cliente.llamadas).toContainEqual({
      paso: "insert",
      tabla: "proveedores",
      datos: { nombre: "Cruz Roja Guatemalteca", tipo: "donante" },
    });
  });

  it("normaliza el error si la busqueda falla", async () => {
    dobles.cliente = crearCliente({
      proveedores: { data: null, error: { code: "42501" } },
    });

    const { proveedorId, error } = await obtenerOCrearProveedorPorNombre("Alguien", "donante");

    expect(proveedorId).toBeNull();
    expect(error).not.toBeNull();
  });

  it("normaliza el error si la creacion falla", async () => {
    dobles.cliente = crearCliente({
      proveedores: [
        { data: [], error: null },
        { data: null, error: { code: "23505" } },
      ],
    });

    const { proveedorId, error } = await obtenerOCrearProveedorPorNombre(
      "Alguien Nuevo",
      "donante",
    );

    expect(proveedorId).toBeNull();
    expect(error).not.toBeNull();
  });
});
