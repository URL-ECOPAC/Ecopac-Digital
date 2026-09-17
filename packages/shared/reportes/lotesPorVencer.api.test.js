// Prueba de listarLotesPorVencer (reporte de medicamentos por vencer).
//
// Lo que se fija: la cantidad sale de las existencias (no la cadena "—" de antes), el rango se
// arma con el dia LOCAL y no con toISOString(), y el filtro de bodega de verdad filtra. Datos
// inventados.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { dobles } = vi.hoisted(() => ({ dobles: { cliente: null } }));

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: () => dobles.cliente,
}));

const { listarLotesPorVencer } = await import("./api.js");

function crearCliente(respuesta) {
  const llamadas = [];
  const encadenable = {
    select(columnas) {
      llamadas.push(["select", columnas]);
      return encadenable;
    },
    gte(columna, valor) {
      llamadas.push(["gte", columna, valor]);
      return encadenable;
    },
    lte(columna, valor) {
      llamadas.push(["lte", columna, valor]);
      return encadenable;
    },
    order() {
      return encadenable;
    },
    then(resolver, rechazar) {
      return Promise.resolve(respuesta).then(resolver, rechazar);
    },
  };
  return { llamadas, from: () => encadenable };
}

const FILAS = [
  {
    id: "l-1",
    numero_lote: "IBU-01",
    fecha_vencimiento: "2026-09-21",
    medicamentos: { nombre: "Ibuprofeno" },
    existencias: [
      { cantidad_disponible: 80, bodega_id: "b-1", bodega: { nombre: "Central" } },
      { cantidad_disponible: 30, bodega_id: "b-2", bodega: { nombre: "Botiquin" } },
    ],
  },
  {
    id: "l-2",
    numero_lote: "LOR-02",
    fecha_vencimiento: "2026-10-01",
    medicamentos: { nombre: "Loratadina" },
    existencias: [{ cantidad_disponible: 5, bodega_id: "b-2", bodega: { nombre: "Botiquin" } }],
  },
];

describe("listarLotesPorVencer", () => {
  beforeEach(() => {
    dobles.cliente = crearCliente({ data: FILAS, error: null });
  });

  it("suma las existencias de cada lote y calcula los dias con el dia local", async () => {
    const hoy = new Date(2026, 8, 16, 23, 30); // 16 de septiembre a las 23:30, hora local
    const { lotes, error } = await listarLotesPorVencer({ horizonteDias: 30, hoy });

    expect(error).toBeNull();
    expect(lotes[0]).toMatchObject({
      medicamento: "Ibuprofeno",
      cantidad: 110,
      bodega: "Central, Botiquin",
      dias_restantes: 5,
    });
    // El rango empieza HOY en la zona local, aunque en UTC ya sea el dia 17.
    expect(dobles.cliente.llamadas).toContainEqual(["gte", "fecha_vencimiento", "2026-09-16"]);
    expect(dobles.cliente.llamadas).toContainEqual(["lte", "fecha_vencimiento", "2026-10-16"]);
  });

  it("con una bodega, cuenta solo lo de esa bodega y descarta los lotes que no tienen nada ahi", async () => {
    const { lotes } = await listarLotesPorVencer({
      horizonteDias: 30,
      bodega: "b-1",
      hoy: new Date(2026, 8, 16),
    });

    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toMatchObject({ lote: "IBU-01", cantidad: 80, bodega: "Central" });
  });

  it("un fallo de la consulta llega como error, no como lista vacia", async () => {
    dobles.cliente = crearCliente({ data: null, error: { code: "42501" } });

    const { lotes, error } = await listarLotesPorVencer({ horizonteDias: 30 });

    expect(lotes).toEqual([]);
    expect(error).not.toBeNull();
  });
});
