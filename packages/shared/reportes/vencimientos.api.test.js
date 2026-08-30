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

const { obtenerReporteDeVencimientos, ESTADOS_DE_VENCIMIENTO } =
  await import("./vencimientos.api.js");

function crearCliente({ respuesta = { data: [], error: null } } = {}) {
  const llamadas = [];

  const cadena = {
    select(columnas) {
      llamadas.push({ paso: "select", columnas });
      return cadena;
    },
    eq(columna, valor) {
      llamadas.push({ paso: "eq", columna, valor });
      return cadena;
    },
    then(resolve, reject) {
      const resultado =
        respuesta instanceof Error ? Promise.reject(respuesta) : Promise.resolve(respuesta);
      return resultado.then(resolve, reject);
    },
  };

  return {
    llamadas,
    from(tabla) {
      llamadas.push({ paso: "from", tabla });
      return cadena;
    },
  };
}

const HOY = new Date("2026-06-15T09:00:00");

/** Una fila de existencias tal como la devuelve PostgREST con los embebidos. */
function fila({ cantidad, vence, lote, bodega, medicamentoId = "med-1", nombre = "Amoxicilina" }) {
  return {
    id: `exi-${lote}-${bodega}`,
    cantidadDisponible: cantidad,
    bodegaId: bodega,
    bodega: { nombre: `Bodega ${bodega}` },
    lote: {
      id: lote,
      numeroLote: lote,
      fechaVencimiento: vence,
      medicamentoId,
      medicamento: {
        nombre,
        concentracion: "500 mg",
        presentacion: "capsula",
        marca: "Generico",
      },
    },
  };
}

// Respecto a HOY (2026-06-15): L1 vence en 17 dias, L2 en mucho mas de un horizonte de 30,
// L3 vencio hace 1 dia, L4 vence exactamente en 30 dias (el limite del horizonte por defecto).
const FILAS = [
  fila({ cantidad: 50, vence: "2026-07-02", lote: "L1", bodega: "A" }),
  fila({ cantidad: 30, vence: "2027-01-01", lote: "L2", bodega: "B" }),
  fila({ cantidad: 999, vence: "2026-06-14", lote: "L3", bodega: "A" }),
  fila({
    cantidad: 10,
    vence: "2026-07-15",
    lote: "L4",
    bodega: "A",
    medicamentoId: "med-2",
    nombre: "Ibuprofeno",
  }),
];

beforeEach(() => {
  dobles.cliente = null;
});

describe("obtenerReporteDeVencimientos", () => {
  it("consulta existencias, no una vista que ya excluya vencidos", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReporteDeVencimientos({}, HOY);

    expect(cliente.llamadas[0]).toEqual({ paso: "from", tabla: "existencias" });
  });

  it("el filtro por bodega viaja como columna propia de existencias", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReporteDeVencimientos({ bodega: "bod-1" }, HOY);

    expect(cliente.llamadas).toContainEqual({ paso: "eq", columna: "bodega_id", valor: "bod-1" });
  });

  it("el filtro por medicamento viaja al embebido de lotes", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReporteDeVencimientos({ medicamento: "med-1" }, HOY);

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "lotes.medicamento_id",
      valor: "med-1",
    });
  });

  it("con VIGENTES y el horizonte por defecto, incluye el limite exacto y excluye lo que vence despues y lo ya vencido", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte, error } = await obtenerReporteDeVencimientos({}, HOY);

    expect(error).toBeNull();
    expect(reporte.renglones.map((r) => r.numeroLote)).toEqual(["L1", "L4"]);
  });

  it("con VENCIDOS devuelve solo lo ya vencido, sin importar el horizonte", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte } = await obtenerReporteDeVencimientos(
      { horizonteDias: 1, estadoDeVencimiento: ESTADOS_DE_VENCIMIENTO.VENCIDOS },
      HOY,
    );

    expect(reporte.renglones.map((r) => r.numeroLote)).toEqual(["L3"]);
    expect(reporte.renglones[0].diasRestantes).toBe(-1);
  });

  it("con TODOS combina lo vencido con lo vigente hasta el horizonte", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte } = await obtenerReporteDeVencimientos(
      { estadoDeVencimiento: ESTADOS_DE_VENCIMIENTO.TODOS },
      HOY,
    );

    expect(reporte.renglones.map((r) => r.numeroLote)).toEqual(["L3", "L1", "L4"]);
  });

  it("el resultado sale ordenado ascendente por dias restantes", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte } = await obtenerReporteDeVencimientos(
      { estadoDeVencimiento: ESTADOS_DE_VENCIMIENTO.TODOS },
      HOY,
    );

    const dias = reporte.renglones.map((r) => r.diasRestantes);
    expect(dias).toEqual([...dias].sort((a, b) => a - b));
  });

  it("el total de unidades en riesgo suma solo lo que quedo tras filtrar", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte } = await obtenerReporteDeVencimientos({}, HOY);

    expect(reporte.totalUnidadesEnRiesgo).toBe(60);
  });

  it("cada renglon trae medicamento, lote, cantidad, bodega, fecha de vencimiento y dias restantes", async () => {
    dobles.cliente = crearCliente({
      respuesta: {
        data: [fila({ cantidad: 50, vence: "2026-07-02", lote: "L1", bodega: "A" })],
        error: null,
      },
    });

    const { reporte } = await obtenerReporteDeVencimientos({}, HOY);

    expect(reporte.renglones[0]).toMatchObject({
      medicamento: "Amoxicilina",
      numeroLote: "L1",
      cantidad: 50,
      bodega: "Bodega A",
      fechaVencimiento: "2026-07-02",
      diasRestantes: 17,
    });
  });

  it("sin datos devuelve renglones vacios y total en cero, sin reventar", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    const { reporte, error } = await obtenerReporteDeVencimientos({}, HOY);

    expect(error).toBeNull();
    expect(reporte.renglones).toEqual([]);
    expect(reporte.totalUnidadesEnRiesgo).toBe(0);
  });

  it("un rechazo de RLS se normaliza y no devuelve reporte a medias", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "42501", message: "denegado" } },
    });

    const { reporte, error } = await obtenerReporteDeVencimientos({}, HOY);

    expect(reporte).toBeNull();
    expect(error).not.toBeNull();
  });

  it("un fallo de red llega como excepcion y tambien se normaliza", async () => {
    dobles.cliente = crearCliente({ respuesta: new Error("Failed to fetch") });

    const { reporte, error } = await obtenerReporteDeVencimientos({}, HOY);

    expect(reporte).toBeNull();
    expect(error).not.toBeNull();
  });
});
