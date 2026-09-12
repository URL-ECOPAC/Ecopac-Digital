// Prueba de ReportesPage (Modulo IV: hub de reportes / medicamentos por vencer, issue #779).
//
// La pestaña "Dashboard de Impacto" monta DashboardMetricasPage.jsx de verdad, que ya tiene su
// propia prueba; aqui se mockea su hook solo para que la pestaña por defecto no reviente, y el
// grueso de esta prueba se concentra en la pestaña "Medicamentos por Vencer".
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import ReportesPage from "./ReportesPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

vi.mock("../../../../packages/shared/reportes/useExportarPDF", () => ({
  useExportarPDF: () => ({ exportar: vi.fn(), generando: false }),
}));

const mockEstadoDashboard = {
  tieneAcceso: true,
  cargando: false,
  error: null,
  indicadores: {},
  seriePrincipal: [],
  serieComparacion: [],
  calcularVariacion: vi.fn(),
  rangosDisponibles: [],
  rangoSeleccionado: "mes",
  setRangoSeleccionado: vi.fn(),
  agrupamientosDisponibles: [],
  agruparPor: "mes",
  setAgruparPor: vi.fn(),
  metrica: "pacientesAtendidos",
  setMetrica: vi.fn(),
  comunidadId: "__todas__",
  setComunidadId: vi.fn(),
  modoComparacion: false,
  setModoComparacion: vi.fn(),
  comunidadCompararId: "__ninguna__",
  setComunidadCompararId: vi.fn(),
  listaComunidades: [],
  valoresEspeciales: { TODAS: "__todas__", NINGUNA: "__ninguna__" },
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useDashboardMetricas: vi.fn(() => mockEstadoDashboard),
}));

const mockEstadoVencimientos = {
  cargando: false,
  error: null,
  filas: [],
  totalUnidadesEnRiesgo: 0,
  horizonteDias: 30,
  setHorizonteDias: vi.fn(),
  comunidadId: "__todas__",
  setComunidadId: vi.fn(),
  bodegaId: "__todas__",
  setBodegaId: vi.fn(),
  horizontesDisponibles: [{ valor: 30, etiqueta: "30 dias" }],
  listaComunidades: [],
  listaBodegas: [],
  valoresEspeciales: { TODAS: "__todas__" },
  recargar: vi.fn(),
};

vi.mock("../../../../packages/shared/reportes/useReporteMedicamentosPorVencer.js", () => ({
  useReporteMedicamentosPorVencer: vi.fn(() => mockEstadoVencimientos),
}));

const { useReporteMedicamentosPorVencer } =
  await import("../../../../packages/shared/reportes/useReporteMedicamentosPorVencer.js");

function pantalla() {
  return render(
    <MemoryRouter>
      <ReportesPage />
    </MemoryRouter>,
  );
}

function irAVencimientos() {
  fireEvent.click(screen.getByText("Medicamentos por Vencer"));
}

describe("ReportesPage", () => {
  afterEach(() => {
    mockEstadoVencimientos.cargando = false;
    mockEstadoVencimientos.error = null;
    mockEstadoVencimientos.filas = [];
    mockEstadoVencimientos.totalUnidadesEnRiesgo = 0;
    useReporteMedicamentosPorVencer.mockClear();
    mockEstadoVencimientos.recargar.mockClear();
  });

  it("por defecto, muestra la pestaña de Dashboard de Impacto", () => {
    pantalla();

    expect(screen.getByText("Reportes e Impacto")).toBeInTheDocument();
  });

  it("mientras carga los vencimientos, muestra el estado de carga", () => {
    mockEstadoVencimientos.cargando = true;
    pantalla();
    irAVencimientos();

    expect(screen.getByText("Cargando lotes próximos a vencer...")).toBeInTheDocument();
  });

  // Con la base vacia (issue #759/#779): sin lotes por vencer, el mensaje lo dice
  // explicitamente, y el total en riesgo se muestra en cero, no se oculta.
  it("con la base vacia, muestra el mensaje de que ningun lote vence y el total en cero", () => {
    pantalla();
    irAVencimientos();

    expect(screen.getByText("Ningún lote vence en los próximos 30 días")).toBeInTheDocument();
    expect(screen.getByText("unidades en riesgo de vencimiento").parentElement).toHaveTextContent(
      "0 unidades en riesgo",
    );
  });

  it("con datos, pinta el medicamento y el total en riesgo", () => {
    mockEstadoVencimientos.filas = [
      { id: "f-1", alerta: "critico", medicamento: "Loratadina", cantidad: 10 },
    ];
    mockEstadoVencimientos.totalUnidadesEnRiesgo = 10;
    pantalla();
    irAVencimientos();

    expect(screen.getByText("Loratadina")).toBeInTheDocument();
    expect(screen.getByText("unidades en riesgo de vencimiento").parentElement).toHaveTextContent(
      "10 unidades en riesgo",
    );
  });

  it("Actualizar dispara recargar()", () => {
    pantalla();
    irAVencimientos();

    fireEvent.click(screen.getByText("Actualizar"));

    expect(mockEstadoVencimientos.recargar).toHaveBeenCalled();
  });

  // Camino de error (issue #759/#779): si la consulta falla, se muestra el error, no una tabla
  // vacia que se confundiria con "ningun lote por vencer".
  it("camino de error: si la consulta falla, muestra el error y no el mensaje de vacio", () => {
    mockEstadoVencimientos.error = { mensaje: "No se pudo cargar el reporte de vencimientos." };
    pantalla();
    irAVencimientos();

    expect(
      screen.getByText("Error al cargar: No se pudo cargar el reporte de vencimientos."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ningún lote vence en los próximos 30 días")).not.toBeInTheDocument();
  });
});
