// Pruebas del origen del presupuesto (issue #840, bloque D; migracion 00134).

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
const { registrarOrigenDePresupuesto, saldoDeDonacion, listarDonacionesConSaldo } =
  await import("./origenes.api.js");

function clienteInsert(respuesta) {
  const llamadas = [];
  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return {
        insert(valores) {
          llamadas.push({ paso: "insert", valores });
          return { select: () => ({ single: async () => respuesta }) };
        },
      };
    },
  };
}

beforeEach(() => {
  dobles.cliente = null;
});

describe("registrarOrigenDePresupuesto", () => {
  it("inserta el aporte en la tabla de origenes, no en jornadas", async () => {
    const cliente = clienteInsert({
      data: { id: "o1", origen: "fondos_propios", monto: "300.00" },
      error: null,
    });
    dobles.cliente = cliente;

    const { origen, error } = await registrarOrigenDePresupuesto({
      jornadaId: "j1",
      origen: "fondos_propios",
      donacionId: "d1",
      monto: "300",
      descripcion: "  Fondos  ",
    });

    expect(error).toBeNull();
    expect(origen.monto).toBe(300);
    expect(cliente.llamadas).toContainEqual({ paso: "from", tabla: "jornada_presupuesto_origen" });
    // La donacion solo viaja cuando el origen es una donacion: la base exige la coherencia.
    expect(cliente.llamadas).toContainEqual({
      paso: "insert",
      valores: {
        jornada_id: "j1",
        origen: "fondos_propios",
        donacion_id: null,
        monto: 300,
        descripcion: "Fondos",
      },
    });
  });

  // Issue #597, heredado de asignarPresupuestoJornada(): un campo de formulario vacio no puede
  // pasar como un aporte de cero.
  it.each([
    ["una cadena que no es numero", "abc"],
    ["undefined", undefined],
    ["null", null],
    ["la cadena vacia", ""],
    ["una cadena de espacios", "   "],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["cero", 0],
    ["un negativo", -5],
  ])("rechaza %s sin llegar al servidor", async (_descripcion, monto) => {
    const { origen, error } = await registrarOrigenDePresupuesto({
      jornadaId: "j1",
      origen: "fondos_propios",
      monto,
    });

    expect(origen).toBeNull();
    expect(error.codigo).toBe(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK);
  });
});

describe("saldoDeDonacion", () => {
  it("resta lo ya asignado en cualquier jornada, con los NUMERIC que llegan como cadena", () => {
    expect(
      saldoDeDonacion({
        donacion_detalle: [{ monto: "600.00" }, { monto: "400.00" }],
        jornada_presupuesto_origen: [{ monto: "700.10" }],
      }),
    ).toEqual({ total: 1000, asignado: 700.1, disponible: 299.9 });
  });

  it("una donacion sin asignar tiene todo disponible", () => {
    expect(saldoDeDonacion({ donacion_detalle: [{ monto: 50 }] }).disponible).toBe(50);
  });
});

describe("listarDonacionesConSaldo", () => {
  it("deja fuera las agotadas y pone primero las del proyecto de la jornada", async () => {
    const filas = [
      {
        id: "sin-proyecto",
        fecha: "2026-09-01",
        proyecto_id: null,
        donante: { nombre: "A" },
        donacion_detalle: [{ monto: "100" }],
        jornada_presupuesto_origen: [],
      },
      {
        id: "agotada",
        fecha: "2026-09-02",
        proyecto_id: "p1",
        donante: { nombre: "B" },
        donacion_detalle: [{ monto: "100" }],
        jornada_presupuesto_origen: [{ monto: "100" }],
      },
      {
        id: "del-proyecto",
        fecha: "2026-08-01",
        proyecto_id: "p1",
        donante: { nombre: "C" },
        donacion_detalle: [{ monto: "500" }],
        jornada_presupuesto_origen: [{ monto: "200" }],
      },
    ];
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      order: async () => ({ data: filas, error: null }),
    };
    dobles.cliente = { from: () => consulta };

    const { donaciones } = await listarDonacionesConSaldo({ proyectoId: "p1" });

    expect(donaciones.map((donacion) => donacion.id)).toEqual(["del-proyecto", "sin-proyecto"]);
    expect(donaciones[0].disponible).toBe(300);
  });
});
