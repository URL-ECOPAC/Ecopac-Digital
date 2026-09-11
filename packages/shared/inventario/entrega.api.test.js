// Pruebas de obtenerRecetaPorAtencion() (issue #749).
//
// El hook useEntregaMedicamentos.js no se monta aqui: packages/shared corre vitest con
// environment "node", sin DOM (ver vitest.config.js), y el patron del paquete es probar la
// funcion de *.api.js que toca Supabase, no el hook (ver existencias.api.test.js,
// recetas.api.test.js). El caso que importa para el criterio 7 es el camino de error: antes,
// useEntregaMedicamentos.js comprobaba `err` en vez de `error` (el campo real de supabase-js),
// asi que un fallo de la consulta nunca se propagaba.

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

const { obtenerRecetaPorAtencion } = await import("./entrega.api.js");

/**
 * Doble del cliente: enruta por nombre de tabla, porque obtenerRecetaPorAtencion() consulta
 * "recetas" y, si hay lotes en el detalle, tambien "existencias".
 */
function crearCliente({ recetas, existencias = { data: [], error: null } } = {}) {
  const llamadas = [];

  function cadena(resultado) {
    return {
      select(columnas) {
        llamadas.push({ paso: "select", columnas });
        return this;
      },
      eq(columna, valor) {
        llamadas.push({ paso: "eq", columna, valor });
        return this;
      },
      in(columna, valores) {
        llamadas.push({ paso: "in", columna, valores });
        return this;
      },
      order(columna, opciones) {
        llamadas.push({ paso: "order", columna, opciones });
        return this;
      },
      then(resolve, reject) {
        const promesa =
          resultado instanceof Error ? Promise.reject(resultado) : Promise.resolve(resultado);
        return promesa.then(resolve, reject);
      },
    };
  }

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      if (tabla === "recetas") return cadena(recetas);
      if (tabla === "existencias") return cadena(existencias);
      throw new Error(`Tabla no esperada en la prueba: ${tabla}`);
    },
  };
}

const RENGLON_CON_LOTE = {
  id: "det-1",
  medicamentoId: "med-1",
  loteId: "lot-1",
  dosis: "1 capsula",
  frecuencia: "cada 8 horas",
  duracion: "7 dias",
  cantidadEntregada: 21,
  medicamento: { nombre: "Amoxicilina" },
  lote: { numeroLote: "L-100", fechaVencimiento: "2027-01-01" },
};

const RENGLON_SIN_LOTE = {
  id: "det-2",
  medicamentoId: "med-2",
  loteId: null,
  dosis: "10 ml",
  frecuencia: "cada 12 horas",
  duracion: "5 dias",
  cantidadEntregada: 2,
  medicamento: { nombre: "Paracetamol" },
  lote: null,
};

const FILA_RECETA = {
  id: "rec-1",
  folio: "REC-ABC123",
  consultas: {
    atencionId: "aten-1",
    expediente: {
      numeroFicha: "000123",
      paciente: { nombres: "Maria", apellidos: "Perez" },
    },
  },
  detalle: [RENGLON_CON_LOTE, RENGLON_SIN_LOTE],
};

beforeEach(() => {
  dobles.cliente = null;
});

describe("obtenerRecetaPorAtencion", () => {
  it("sin atencionId no toca la red", async () => {
    const resultado = await obtenerRecetaPorAtencion(undefined);

    expect(resultado).toEqual({ receta: null, detalles: [], error: null });
  });

  it("camino feliz: arma receta y detalles, con la existencia sumada por lote", async () => {
    dobles.cliente = crearCliente({
      recetas: { data: [FILA_RECETA], error: null },
      existencias: {
        data: [
          { loteId: "lot-1", cantidadDisponible: 30 },
          { loteId: "lot-1", cantidadDisponible: 5 },
        ],
        error: null,
      },
    });

    const { receta, detalles, error } = await obtenerRecetaPorAtencion("aten-1");

    expect(error).toBeNull();
    expect(receta).toEqual({
      id: "rec-1",
      folio: "REC-ABC123",
      pacienteNombre: "Maria Perez",
      numeroFicha: "000123",
    });
    expect(detalles).toHaveLength(2);
    expect(detalles[0]).toMatchObject({
      id: "det-1",
      medicamento: "Amoxicilina",
      cantidadEntregada: 21,
      cantidadDisponible: 35,
    });
  });

  it("un renglon sin lote_id muestra cantidadDisponible null, nunca 0", async () => {
    dobles.cliente = crearCliente({
      recetas: { data: [FILA_RECETA], error: null },
      existencias: { data: [{ loteId: "lot-1", cantidadDisponible: 10 }], error: null },
    });

    const { detalles } = await obtenerRecetaPorAtencion("aten-1");

    const sinLote = detalles.find((detalle) => detalle.id === "det-2");
    expect(sinLote.cantidadDisponible).toBeNull();
  });

  it("sin receta emitida para la atencion devuelve un estado vacio, no un error", async () => {
    dobles.cliente = crearCliente({ recetas: { data: [], error: null } });

    const resultado = await obtenerRecetaPorAtencion("aten-sin-receta");

    expect(resultado).toEqual({ receta: null, detalles: [], error: null });
  });

  it("si la consulta de recetas falla, propaga el error y no una lista vacia (issue #749, criterio 7)", async () => {
    dobles.cliente = crearCliente({
      recetas: { data: null, error: { code: "PGRST301", message: "JWT expired" } },
    });

    const { receta, detalles, error } = await obtenerRecetaPorAtencion("aten-1");

    expect(receta).toBeNull();
    expect(detalles).toEqual([]);
    expect(error).not.toBeNull();
    expect(typeof error.mensaje).toBe("string");
    expect(error.mensaje.length).toBeGreaterThan(0);
  });

  it("si la consulta de existencias falla, tambien propaga el error (no se ignora)", async () => {
    dobles.cliente = crearCliente({
      recetas: { data: [FILA_RECETA], error: null },
      existencias: { data: null, error: { code: "42501", message: "permission denied" } },
    });

    const { receta, detalles, error } = await obtenerRecetaPorAtencion("aten-1");

    expect(receta).toBeNull();
    expect(detalles).toEqual([]);
    expect(error).not.toBeNull();
    expect(typeof error.mensaje).toBe("string");
  });

  it("una excepcion inesperada (por ejemplo, fallo de red) tambien se propaga como error, no se traga", async () => {
    dobles.cliente = crearCliente({ recetas: new Error("Failed to fetch") });

    const { receta, error } = await obtenerRecetaPorAtencion("aten-1");

    expect(receta).toBeNull();
    expect(error).not.toBeNull();
    expect(typeof error.mensaje).toBe("string");
  });
});
