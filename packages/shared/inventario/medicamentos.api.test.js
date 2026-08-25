// Pruebas de las consultas de Supabase del catalogo de medicamentos.
//
// Mismo patron de mock que packages/shared/inventario/principios-activos.api.test.js: un doble
// de obtenerSupabase() que registra cada paso de la cadena y resuelve con la respuesta que la
// prueba le entregue. No hay Supabase real ni red: cada prueba controla exactamente lo que el
// "servidor" contesta, asi que no hace falta .env ni conexion.
//
// A diferencia del doble de principios-activos.api.test.js (una sola respuesta para todo el
// cliente), medicamentos.api.js hace varias consultas a distintas tablas y funciones dentro de
// una misma llamada (listarMedicamentos con busqueda toca medicamentos, principios_activos y
// medicamento_principio; desactivarMedicamento llama un rpc y despues, condicionalmente, un
// update). Este doble resuelve por tabla/rpc, con una cola de respuestas por tabla para poder
// distinguir la primera consulta a medicamentos de la segunda dentro de la misma prueba.
//
// Ningun dato real: los nombres de medicamentos y principios activos son inventados.

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
  actualizarMedicamento,
  desactivarMedicamento,
  listarMedicamentos,
  registrarMedicamento,
} = await import("./medicamentos.api.js");

/**
 * Doble de un cliente de Supabase que resuelve por tabla y por funcion de rpc.
 *
 * `tablas` mapea nombre de tabla a una respuesta unica (se repite en cada `.from(tabla)`) o a un
 * arreglo de respuestas (se consumen en orden, una por cada `.from(tabla)`; la ultima se repite
 * si se agota). `rpc` mapea nombre de funcion a una respuesta unica.
 */
function crearCliente({ tablas = {}, rpc = {} } = {}) {
  const llamadas = [];
  const colasPorTabla = new Map();

  function siguienteRespuesta(tabla) {
    const configurado = tablas[tabla];
    if (Array.isArray(configurado)) {
      if (!colasPorTabla.has(tabla)) colasPorTabla.set(tabla, [...configurado]);
      const cola = colasPorTabla.get(tabla);
      return cola.length > 1 ? cola.shift() : cola[0];
    }
    return configurado ?? { data: [], error: null };
  }

  function crearEncadenable(tabla) {
    const respuesta = siguienteRespuesta(tabla);
    const resolver = async () =>
      respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;

    const encadenable = {
      insert(valores) {
        llamadas.push({ tabla, paso: "insert", valores });
        return encadenable;
      },
      update(valores) {
        llamadas.push({ tabla, paso: "update", valores });
        return encadenable;
      },
      select(columnas) {
        llamadas.push({ tabla, paso: "select", columnas });
        return encadenable;
      },
      eq(columna, valor) {
        llamadas.push({ tabla, paso: "eq", columna, valor });
        return encadenable;
      },
      in(columna, valores) {
        llamadas.push({ tabla, paso: "in", columna, valores });
        return encadenable;
      },
      ilike(columna, valor) {
        llamadas.push({ tabla, paso: "ilike", columna, valor });
        return encadenable;
      },
      or(expresion) {
        llamadas.push({ tabla, paso: "or", expresion });
        return encadenable;
      },
      order(columna, opciones) {
        llamadas.push({ tabla, paso: "order", columna, opciones });
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
      llamadas.push({ tabla, paso: "from" });
      return crearEncadenable(tabla);
    },
    rpc(nombre, argumentos) {
      llamadas.push({ tabla: null, paso: "rpc", nombre, argumentos });
      const respuesta = rpc[nombre] ?? { data: null, error: null };
      const resolver = async () =>
        respuesta instanceof Error ? Promise.reject(respuesta) : respuesta;

      const encadenable = {
        single: resolver,
        maybeSingle: resolver,
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

describe("listarMedicamentos", () => {
  it("sin busqueda solo ordena por nombre, sin or ni ilike", async () => {
    const cliente = crearCliente({ tablas: { medicamentos: { data: [], error: null } } });
    dobles.cliente = cliente;

    await listarMedicamentos();

    const pasos = cliente.llamadas.filter((l) => l.tabla === "medicamentos").map((l) => l.paso);
    expect(pasos).toEqual(["from", "select", "eq", "order"]);
  });

  it("filtra por presentacion y por poblacion pediatrica", async () => {
    const cliente = crearCliente({ tablas: { medicamentos: { data: [], error: null } } });
    dobles.cliente = cliente;

    await listarMedicamentos({ presentacion: "tableta", esPediatrico: true });

    expect(cliente.llamadas).toContainEqual({
      tabla: "medicamentos",
      paso: "eq",
      columna: "presentacion",
      valor: "tableta",
    });
    expect(cliente.llamadas).toContainEqual({
      tabla: "medicamentos",
      paso: "eq",
      columna: "es_pediatrico",
      valor: true,
    });
  });

  it("fusiona sin duplicar cuando el mismo medicamento aparece por nombre y por principio activo", async () => {
    const amoxicilina = { id: "med-1", nombre: "Amoxicilina" };
    const ibuprofeno = { id: "med-2", nombre: "Ibuprofeno" };

    const cliente = crearCliente({
      tablas: {
        // La primera consulta a medicamentos es la de nombre/marca/concentracion, la segunda
        // (solo ocurre si idsPorPrincipioActivo encontro algo) es la de "in(id, ...)".
        medicamentos: [
          { data: [amoxicilina], error: null },
          { data: [amoxicilina, ibuprofeno], error: null },
        ],
        principios_activos: { data: [{ id: "principio-1" }], error: null },
        medicamento_principio: {
          data: [{ medicamento_id: "med-1" }, { medicamento_id: "med-2" }],
          error: null,
        },
      },
    });
    dobles.cliente = cliente;

    const { medicamentos, error } = await listarMedicamentos({ busqueda: "amox" });

    expect(error).toBeNull();
    expect(medicamentos.map((m) => m.id).sort()).toEqual(["med-1", "med-2"]);
  });

  it("no consulta principios activos cuando la busqueda esta vacia", async () => {
    const cliente = crearCliente({ tablas: { medicamentos: { data: [], error: null } } });
    dobles.cliente = cliente;

    await listarMedicamentos({ busqueda: "" });

    expect(cliente.llamadas.some((l) => l.tabla === "principios_activos")).toBe(false);
  });

  it("nunca devuelve null: una lista vacia se dibuja sola", async () => {
    dobles.cliente = crearCliente({ tablas: { medicamentos: { data: null, error: null } } });

    const { medicamentos, error } = await listarMedicamentos();

    expect(error).toBeNull();
    expect(medicamentos).toEqual([]);
  });

  it("clasifica como fallo de red la excepcion del fetch", async () => {
    dobles.cliente = crearCliente({
      tablas: { medicamentos: new Error("Failed to fetch") },
    });

    const { medicamentos, error } = await listarMedicamentos();

    expect(medicamentos).toEqual([]);
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.FALLO_DE_RED);
  });
});

describe("registrarMedicamento", () => {
  it("sin principiosActivosIds devuelve CAMPO_REQUERIDO sin llamar al cliente", async () => {
    const { medicamento, error } = await registrarMedicamento({ nombre: "Paracetamol" });

    expect(medicamento).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO);
  });

  it("con principios validos llama fn_registrar_medicamento con los argumentos esperados", async () => {
    const cliente = crearCliente({
      rpc: {
        fn_registrar_medicamento: {
          data: {
            id: "med-1",
            nombre: "Paracetamol",
            concentracion: "500 mg",
            presentacion: "tableta",
            marca: "Generico",
            forma_farmaceutica: null,
            es_pediatrico: false,
            activo: true,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          error: null,
        },
      },
    });
    dobles.cliente = cliente;

    const { medicamento, error } = await registrarMedicamento({
      nombre: "Paracetamol",
      concentracion: "500 mg",
      presentacion: "tableta",
      marca: "Generico",
      principiosActivosIds: ["principio-1"],
    });

    expect(error).toBeNull();
    expect(medicamento).toEqual({
      id: "med-1",
      nombre: "Paracetamol",
      concentracion: "500 mg",
      presentacion: "tableta",
      marca: "Generico",
      formaFarmaceutica: null,
      esPediatrico: false,
      activo: true,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
    expect(cliente.llamadas).toContainEqual({
      tabla: null,
      paso: "rpc",
      nombre: "fn_registrar_medicamento",
      argumentos: {
        p_nombre: "Paracetamol",
        p_concentracion: "500 mg",
        p_presentacion: "tableta",
        p_marca: "Generico",
        p_principios_ids: ["principio-1"],
        p_forma_farmaceutica: null,
        p_es_pediatrico: false,
      },
    });
  });

  it("normaliza como unicidad la violacion del combo nombre+concentracion+presentacion+marca", async () => {
    dobles.cliente = crearCliente({
      rpc: { fn_registrar_medicamento: { data: null, error: { code: "23505" } } },
    });

    const { medicamento, error } = await registrarMedicamento({
      nombre: "Paracetamol",
      principiosActivosIds: ["principio-1"],
    });

    expect(medicamento).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.UNICIDAD);
  });
});

describe("actualizarMedicamento", () => {
  it("no toca el cliente cuando no hay campos que actualizar", async () => {
    const { medicamento, error } = await actualizarMedicamento("med-1", {});

    expect(medicamento).toBeNull();
    expect(error).toBeNull();
  });

  it("normaliza como permiso denegado cuando RLS rechaza la edicion", async () => {
    dobles.cliente = crearCliente({
      tablas: { medicamentos: { data: null, error: { code: "42501" } } },
    });

    const { medicamento, error } = await actualizarMedicamento("med-1", { nombre: "Nuevo" });

    expect(medicamento).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.PERMISO_DENEGADO);
  });
});

describe("desactivarMedicamento", () => {
  it("no toca el cliente cuando no hay id", async () => {
    const { medicamento, error } = await desactivarMedicamento(undefined);

    expect(medicamento).toBeNull();
    expect(error).toBeNull();
  });

  it("rechaza con un mensaje propio cuando el medicamento tiene existencias", async () => {
    const cliente = crearCliente({
      rpc: { fn_medicamento_tiene_existencias: { data: true, error: null } },
    });
    dobles.cliente = cliente;

    const { medicamento, error } = await desactivarMedicamento("med-1");

    expect(medicamento).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.LLAVE_FORANEA);
    expect(error.mensaje).toBe(
      "No se puede desactivar un medicamento con existencias disponibles en inventario.",
    );
    expect(cliente.llamadas.some((l) => l.tabla === "medicamentos")).toBe(false);
  });

  it("desactiva cuando el medicamento no tiene existencias", async () => {
    const cliente = crearCliente({
      rpc: { fn_medicamento_tiene_existencias: { data: false, error: null } },
      tablas: {
        medicamentos: { data: { id: "med-1", activo: false }, error: null },
      },
    });
    dobles.cliente = cliente;

    const { medicamento, error } = await desactivarMedicamento("med-1");

    expect(error).toBeNull();
    expect(medicamento).toEqual({ id: "med-1", activo: false });
    expect(cliente.llamadas).toContainEqual({
      tabla: "medicamentos",
      paso: "update",
      valores: { activo: false },
    });
  });
});
