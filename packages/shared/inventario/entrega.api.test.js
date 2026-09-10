// Pruebas de la entrega de medicamentos en campo (issue #164 / #759).
//
// La version anterior (escrita directamente en el hook de la pantalla) pedia columnas que no
// existen en el esquema -recetas.paciente_id, recetas.atencion_id, lotes.vencimiento,
// lotes.cantidad_actual- y fallaba siempre con PGRST108 contra una base real. Un doble de
// Supabase como el de aqui abajo no puede detectar ese error de forma de consulta: solo
// devuelve lo que se le programa, sea o no lo que PostgREST aceptaria. Por eso estas pruebas
// verifican la FORMA de la consulta (que columnas y que filtro se piden) en vez de solo el
// resultado; la prueba que de verdad habria detectado el PGRST108, contra una base real, es la
// nueva del paso 10 de pruebas/e2e/atencion-clinica.e2e.test.js.

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

const { aRenglonDeEntrega, obtenerDetalleDeEntrega } = await import("./entrega.api.js");

function crearCliente(respuesta) {
  const llamadas = [];
  const resolver = async () => (respuesta instanceof Error ? Promise.reject(respuesta) : respuesta);

  const encadenable = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return encadenable;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return encadenable;
    },
    then(resolve, reject) {
      return resolver().then(resolve, reject);
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

describe("aRenglonDeEntrega", () => {
  it("suma la existencia disponible de todas las bodegas del lote", () => {
    const renglon = aRenglonDeEntrega({
      id: "d-1",
      medicamentoId: "med-1",
      cantidadEntregada: 5,
      dosis: "1 tableta",
      frecuencia: "cada 8 horas",
      duracion: "5 dias",
      medicamento: { nombre: "Loratadina" },
      lote: {
        fechaVencimiento: "2030-01-01",
        existencias: [{ cantidadDisponible: 10 }, { cantidadDisponible: 20 }],
      },
    });

    expect(renglon.existencias).toBe(30);
    expect(renglon.medicamento).toBe("Loratadina");
    expect(renglon.cantidad_recetada).toBe(5);
    expect(renglon.vencido).toBe(false);
  });

  it("marca vencido un lote cuya fecha ya paso", () => {
    const renglon = aRenglonDeEntrega({
      id: "d-1",
      lote: { fechaVencimiento: "2000-01-01", existencias: [] },
    });

    expect(renglon.vencido).toBe(true);
    expect(renglon.existencias).toBe(0);
  });

  it("sin lote embebido no revienta: no hay existencia ni fecha, y cuenta como vencido", () => {
    expect(() => aRenglonDeEntrega({ id: "d-1" })).not.toThrow();
    expect(aRenglonDeEntrega({ id: "d-1" }).vencido).toBe(true);
  });
});

describe("obtenerDetalleDeEntrega", () => {
  it("sin atencionId no consulta nada", async () => {
    const { detalle, error } = await obtenerDetalleDeEntrega();

    expect(detalle).toEqual([]);
    expect(error).toBeNull();
    expect(dobles.cliente).toBeNull();
  });

  it("consulta receta_detalle y filtra por el alias que declara el select, no por el nombre de la tabla", async () => {
    dobles.cliente = crearCliente({ data: [], error: null });

    await obtenerDetalleDeEntrega("atencion-1");

    expect(dobles.cliente.llamadas[0]).toEqual({ paso: "from", tabla: "receta_detalle" });

    const columnas = dobles.cliente.llamadas.find((l) => l.paso === "select").columnas;
    // La version anterior pedia recetas.paciente_id y recetas.atencion_id -columnas que no
    // existen: el paciente y la atencion se llegan via consultas y expedientes, no son
    // columnas propias de recetas-, ademas de lotes.vencimiento y lotes.cantidad_actual.
    expect(columnas).toBe(
      "id, medicamentoId:medicamento_id, cantidadEntregada:cantidad_entregada, dosis, " +
        "frecuencia, duracion, medicamento:medicamentos(nombre), " +
        "lote:lotes(numeroLote:numero_lote, fechaVencimiento:fecha_vencimiento, " +
        "existencias(cantidadDisponible:cantidad_disponible)), " +
        "receta:recetas!inner(id, folio, consulta:consultas!inner(atencionId:atencion_id))",
    );

    const filtro = dobles.cliente.llamadas.find((l) => l.paso === "eq");
    expect(filtro).toEqual({
      paso: "eq",
      columna: "receta.consulta.atencion_id",
      valor: "atencion-1",
    });
  });

  it("traduce cada fila con aRenglonDeEntrega", async () => {
    dobles.cliente = crearCliente({
      data: [
        {
          id: "d-1",
          medicamentoId: "med-1",
          cantidadEntregada: 5,
          medicamento: { nombre: "Loratadina" },
          lote: { fechaVencimiento: "2030-01-01", existencias: [{ cantidadDisponible: 10 }] },
        },
      ],
      error: null,
    });

    const { detalle, error } = await obtenerDetalleDeEntrega("atencion-1");

    expect(error).toBeNull();
    expect(detalle).toEqual([
      {
        id: "d-1",
        medicamentoId: "med-1",
        medicamento: "Loratadina",
        dosis: undefined,
        frecuencia: undefined,
        duracion: undefined,
        cantidad_recetada: 5,
        existencias: 10,
        fechaVencimiento: "2030-01-01",
        vencido: false,
      },
    ]);
  });

  it("un error de la consulta se normaliza y no se confunde con una receta vacia", async () => {
    dobles.cliente = crearCliente({
      data: null,
      error: { code: "PGRST108", message: "boom" },
    });

    const { detalle, error } = await obtenerDetalleDeEntrega("atencion-1");

    expect(detalle).toEqual([]);
    expect(error).not.toBeNull();
    expect(error.mensaje).toBeTruthy();
  });
});
