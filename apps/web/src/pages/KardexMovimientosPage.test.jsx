// Prueba de KardexMovimientosPage (issue #756: dangerouslySetInnerHTML interpolaba tipo/estado
// sin escapar, y aprobacion_automatica -columna real- nunca llegaba a pantalla).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import KardexMovimientosPage from "./KardexMovimientosPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const MOVIMIENTO_AUTOMATICO = {
  id: "mov-1",
  created_at: "2026-01-10T09:00:00Z",
  tipo: "ingreso",
  cantidad: 20,
  motivo: "Compra mensual",
  bodega_nombre: "Bodega Central",
  registrado_por_nombre: "Ana Lopez",
  aprobado_por_nombre: "Ana Lopez",
  aprobado_en: "2026-01-10T09:01:00Z",
  aprobacion_automatica: true,
  estado: "aprobado",
  saldoAcumulado: 20,
};

const MOVIMIENTO_PENDIENTE = {
  id: "mov-2",
  created_at: "2026-01-11T09:00:00Z",
  tipo: "salida",
  cantidad: 5,
  motivo: "Entrega en jornada",
  bodega_nombre: "Bodega Central",
  registrado_por_nombre: "Carlos Ruiz",
  aprobado_por_nombre: null,
  aprobado_en: null,
  aprobacion_automatica: false,
  estado: "pendiente",
  saldoAcumulado: 15,
};

const mockEstadoHook = {
  movimientos: [],
  cargando: false,
  error: null,
  filtros: { fechaDesde: "", fechaHasta: "", tipoMovimiento: "todos" },
  setFiltros: vi.fn(),
};

vi.mock("../../../../packages/shared/inventario/useKardexMovimientos", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useKardexMovimientos: vi.fn(() => mockEstadoHook),
}));

const { useKardexMovimientos } = await import(
  "../../../../packages/shared/inventario/useKardexMovimientos"
);

function pantalla() {
  return render(<KardexMovimientosPage loteId="lote-1" />);
}

describe("KardexMovimientosPage", () => {
  afterEach(() => {
    mockEstadoHook.movimientos = [];
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    useKardexMovimientos.mockClear();
  });

  it("pinta el tipo y el estado como texto, no como HTML crudo inyectado", () => {
    mockEstadoHook.movimientos = [MOVIMIENTO_AUTOMATICO];
    pantalla();

    expect(screen.getByText("Ingreso")).toBeInTheDocument();
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
  });

  it("un tipo o estado desconocido se muestra tal cual, sin romper el render", () => {
    mockEstadoHook.movimientos = [{ ...MOVIMIENTO_AUTOMATICO, tipo: "ajuste", estado: "revision" }];
    pantalla();

    expect(screen.getByText("ajuste")).toBeInTheDocument();
    expect(screen.getByText("revision")).toBeInTheDocument();
  });

  // Issue #756: aprobacion_automatica ya era una columna real (00028), pero ninguna pantalla la
  // mostraba.
  it("un movimiento autoaprobado muestra la marca (automático)", () => {
    mockEstadoHook.movimientos = [MOVIMIENTO_AUTOMATICO];
    pantalla();

    expect(screen.getByText("(automático)")).toBeInTheDocument();
  });

  it("un movimiento pendiente de aprobar no muestra la marca automatica", () => {
    mockEstadoHook.movimientos = [MOVIMIENTO_PENDIENTE];
    pantalla();

    expect(screen.queryByText("(automático)")).not.toBeInTheDocument();
    // "Pendiente" aparece dos veces: la columna "Aprobado por" (sin aprobar todavia) y la
    // etiqueta de estado -son dos datos distintos que coinciden en texto por casualidad.
    expect(screen.getAllByText("Pendiente")).toHaveLength(2);
  });
});
