// Prueba de ReporteInventarioPage (Modulo IV: reporte de inventario, issue #779).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { COLUMNAS_INVENTARIO_REPORTE, CAMPOS_FICHA_LOTE_INVENTARIO } from "@ecopac/shared";

import ReporteInventarioPage from "./ReporteInventarioPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

const TOTALES_VACIOS = {
  unidadesDisponibles: 0,
  unidadesVencidas: 0,
  medicamentosDistintos: 0,
  renglonesDeInventario: 0,
};

const MEDICAMENTO_DE_EJEMPLO = {
  medicamentoId: "med-1",
  medicamento: "Loratadina",
  lotes: [{ id: "lote-1", numeroLote: "LOTE-1", bodega: "Bodega Principal", cantidad: 40 }],
};

const mockEstadoHook = {
  tieneAcceso: true,
  cargando: false,
  error: null,
  medicamentos: [],
  medicamentosCompletos: [],
  total: 0,
  totales: TOTALES_VACIOS,
  columnas: COLUMNAS_INVENTARIO_REPORTE,
  camposDeLote: CAMPOS_FICHA_LOTE_INVENTARIO,
  filtros: {},
  setFiltro: vi.fn(),
  limpiarFiltros: vi.fn(),
  hayFiltros: false,
  catalogos: {},
  orden: null,
  alternarOrden: vi.fn(),
  numeroDePagina: 1,
  totalPaginas: 1,
  irAPagina: vi.fn(),
  recargar: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useReporteInventario: vi.fn(() => mockEstadoHook),
}));

const { useReporteInventario } = await import("@ecopac/shared");

function pantalla() {
  return render(<ReporteInventarioPage />);
}

describe("ReporteInventarioPage", () => {
  afterEach(() => {
    mockEstadoHook.tieneAcceso = true;
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.medicamentos = [];
    mockEstadoHook.totales = TOTALES_VACIOS;
    mockEstadoHook.hayFiltros = false;
    useReporteInventario.mockClear();
    mockEstadoHook.recargar.mockClear();
  });

  it("sin acceso, muestra el mensaje de sesion requerida, no el reporte", () => {
    mockEstadoHook.tieneAcceso = false;
    pantalla();

    expect(
      screen.getByText("Se necesita una sesión activa para consultar el inventario."),
    ).toBeInTheDocument();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Consultando el inventario...")).toBeInTheDocument();
  });

  // Con la base vacia (issue #759/#779): los totales en cero y la lista vacia se dibujan sin
  // reventar, con el mensaje de "no hay existencias" en la tabla.
  it("con la base vacia, los totales quedan en cero y la lista muestra su mensaje vacio", () => {
    pantalla();

    expect(screen.getByText("Unidades disponibles")).toBeInTheDocument();
    expect(screen.getByText("No hay existencias registradas.")).toBeInTheDocument();
  });

  it("con datos, pinta el medicamento, sus totales y el desglose de lotes", () => {
    mockEstadoHook.medicamentos = [MEDICAMENTO_DE_EJEMPLO];
    mockEstadoHook.totales = {
      unidadesDisponibles: 40,
      unidadesVencidas: 0,
      medicamentosDistintos: 1,
      renglonesDeInventario: 1,
    };
    pantalla();

    expect(screen.getByText("Loratadina")).toBeInTheDocument();

    // ISSUE #862: antes habia una seccion con su propia tabla POR CADA medicamento, apiladas
    // todas en la pagina. Ahora el desglose se abre por fila.
    expect(screen.queryByText("LOTE-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver lotes" }));

    expect(screen.getByText("Loratadina · 1 lotes")).toBeInTheDocument();
    expect(screen.getByText("LOTE-1")).toBeInTheDocument();
  });

  it("con filtros activos, Limpiar filtros dispara limpiarFiltros()", () => {
    mockEstadoHook.hayFiltros = true;
    pantalla();

    // Con la tabla vacia, "Limpiar filtros" sale dos veces: en FilterBar y en el vacio
    // contextual. Las dos llaman a lo mismo; se pulsa la primera.
    fireEvent.click(screen.getAllByRole("button", { name: "Limpiar filtros" })[0]);

    expect(mockEstadoHook.limpiarFiltros).toHaveBeenCalled();
  });

  // Camino de error (issue #759/#779): si la consulta falla, se muestra el error con boton de
  // reintentar, no una tabla vacia (que se veria igual que "sin existencias").
  it("camino de error: si la consulta falla, muestra el error con boton de reintentar", () => {
    mockEstadoHook.error = { mensaje: "No se pudo cargar el inventario." };
    pantalla();

    expect(screen.getByText("No se pudo cargar el inventario.")).toBeInTheDocument();
    expect(screen.queryByText("No hay existencias registradas.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });
});
