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
  // Solo para que la pestana de pacientes atendidos se pueda montar: su contenido tiene su propia
  // prueba (ReportePacientesPage.test.jsx). Aqui interesa que las pestanas sigan ahi.
  useReportePacientes: vi.fn(() => ({ tieneAcceso: false })),
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

function pantalla(ruta = "/reportes") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ReportesPage />
    </MemoryRouter>,
  );
}

function irAVencimientos() {
  fireEvent.click(screen.getByText("Medicamentos por vencer"));
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

    expect(
      screen.getByRole("heading", { level: 1, name: "Reportes e impacto" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dashboard de impacto").closest("a")).toHaveClass("active");
  });

  // "Pacientes atendidos" navegaba a una pagina suelta, sin las pestanas, y desde ahi no habia
  // forma de volver a las demas. Ahora es una pestana mas: las otras siguen a la vista.
  it("desde pacientes atendidos se puede volver al panel de impacto", () => {
    pantalla("/reportes/pacientes-atendidos");

    expect(screen.getByText("Pacientes atendidos").closest("a")).toHaveClass("active");
    expect(
      screen.getByText("Solo administración y junta directiva consultan el reporte de pacientes."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Dashboard de impacto"));

    expect(screen.getByText("Dashboard de impacto").closest("a")).toHaveClass("active");
    expect(screen.getByText("Pacientes Atendidos")).toBeInTheDocument();
  });

  it("el inventario actual tiene su pestana, que antes no enlazaba nadie", () => {
    pantalla();

    expect(screen.getByText("Inventario actual")).toBeInTheDocument();
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
