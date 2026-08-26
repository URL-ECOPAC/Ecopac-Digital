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

const { obtenerReporteDeInventario, ESTADOS_DE_VENCIMIENTO } = await import(
  "./inventario.api.js"
);

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

const FILAS = [
  fila({ cantidad: 50, vence: "2026-09-01", lote: "L1", bodega: "A" }),
  fila({ cantidad: 30, vence: "2027-01-01", lote: "L2", bodega: "B" }),
  fila({ cantidad: 999, vence: "2026-06-14", lote: "L3", bodega: "A" }),
  fila({
    cantidad: 10,
    vence: "2026-12-01",
    lote: "L4",
    bodega: "A",
    medicamentoId: "med-2",
    nombre: "Ibuprofeno",
  }),
];

beforeEach(() => {
  dobles.cliente = null;
});

describe("obtenerReporteDeInventario", () => {
  it("consulta existencias, no una vista que excluya vencidos", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReporteDeInventario({}, HOY);

    expect(cliente.llamadas[0]).toEqual({ paso: "from", tabla: "existencias" });
  });

  it("agrupa por medicamento y conserva el desglose por lote y bodega", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte, error } = await obtenerReporteDeInventario({}, HOY);

    expect(error).toBeNull();
    expect(reporte.medicamentos).toHaveLength(2);

    const amoxicilina = reporte.medicamentos.find((m) => m.medicamentoId === "med-1");
    expect(amoxicilina.lotes).toHaveLength(3);
    expect(amoxicilina.lotes.map((l) => l.bodega)).toEqual([
      "Bodega A",
      "Bodega B",
      "Bodega A",
    ]);
  });

  it("lo vencido se reporta aparte y NO engrosa lo disponible", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte } = await obtenerReporteDeInventario({}, HOY);
    const amoxicilina = reporte.medicamentos.find((m) => m.medicamentoId === "med-1");

    expect(amoxicilina.disponible).toBe(80);
    expect(amoxicilina.vencido).toBe(999);
  });

  it("los totales separan disponible de vencido y cuentan medicamentos distintos", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte } = await obtenerReporteDeInventario({}, HOY);

    expect(reporte.totales).toEqual({
      unidadesDisponibles: 90,
      unidadesVencidas: 999,
      medicamentosDistintos: 2,
      renglonesDeInventario: 4,
    });
  });

  it("un lote que vence hoy cuenta como disponible", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: [fila({ cantidad: 7, vence: "2026-06-15", lote: "L9", bodega: "A" })], error: null },
    });

    const { reporte } = await obtenerReporteDeInventario({}, HOY);

    expect(reporte.totales.unidadesDisponibles).toBe(7);
    expect(reporte.totales.unidadesVencidas).toBe(0);
  });

  it("filtrando vigentes desaparece el lote vencido del desglose", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte } = await obtenerReporteDeInventario(
      { estadoDeVencimiento: ESTADOS_DE_VENCIMIENTO.VIGENTES },
      HOY,
    );

    expect(reporte.totales.unidadesVencidas).toBe(0);
    expect(reporte.totales.unidadesDisponibles).toBe(90);
    expect(reporte.totales.renglonesDeInventario).toBe(3);
  });

  it("filtrando vencidos solo queda ese lote", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: FILAS, error: null } });

    const { reporte } = await obtenerReporteDeInventario(
      { estadoDeVencimiento: ESTADOS_DE_VENCIMIENTO.VENCIDOS },
      HOY,
    );

    expect(reporte.medicamentos).toHaveLength(1);
    expect(reporte.totales.unidadesVencidas).toBe(999);
    expect(reporte.totales.unidadesDisponibles).toBe(0);
  });

  it("el filtro por bodega viaja como columna propia de existencias", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReporteDeInventario({ bodega: "bod-1" }, HOY);

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "bodega_id",
      valor: "bod-1",
    });
  });

  it("el filtro por medicamento viaja al embebido de lotes", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReporteDeInventario({ medicamento: "med-1" }, HOY);

    expect(cliente.llamadas).toContainEqual({
      paso: "eq",
      columna: "lotes.medicamento_id",
      valor: "med-1",
    });
  });

  it("sin filtros no manda ningun eq", async () => {
    const cliente = crearCliente();
    dobles.cliente = cliente;

    await obtenerReporteDeInventario({}, HOY);

    expect(cliente.llamadas.filter((l) => l.paso === "eq")).toHaveLength(0);
  });

  it("un inventario vacio devuelve totales en cero y no revienta", async () => {
    dobles.cliente = crearCliente({ respuesta: { data: [], error: null } });

    const { reporte, error } = await obtenerReporteDeInventario({}, HOY);

    expect(error).toBeNull();
    expect(reporte.medicamentos).toEqual([]);
    expect(reporte.totales.unidadesDisponibles).toBe(0);
    expect(reporte.totales.medicamentosDistintos).toBe(0);
  });

  it("un rechazo de RLS se normaliza y no devuelve reporte a medias", async () => {
    dobles.cliente = crearCliente({
      respuesta: { data: null, error: { code: "42501", message: "denegado" } },
    });

    const { reporte, error } = await obtenerReporteDeInventario({}, HOY);

    expect(reporte).toBeNull();
    expect(error).not.toBeNull();
  });

  it("un fallo de red llega como excepcion y tambien se normaliza", async () => {
    dobles.cliente = crearCliente({ respuesta: new Error("Failed to fetch") });

    const { reporte, error } = await obtenerReporteDeInventario({}, HOY);

    expect(reporte).toBeNull();
    expect(error).not.toBeNull();
  });
});
