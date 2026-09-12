// Prueba de ReportePacientesPage (Modulo IV: reporte de pacientes atendidos, issue #779).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { COLUMNAS_PACIENTES_ATENDIDOS, FILTROS_REPORTES } from "@ecopac/shared";

import ReportePacientesPage from "./ReportePacientesPage";

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

const GRUPO_DE_EJEMPLO = {
  id: "g-1",
  nombre: "Jornada enero",
  pacientes: 40,
  nuevos: 10,
  recurrentes: 30,
};

const mockEstadoHook = {
  tieneAcceso: true,
  cargando: false,
  error: null,
  grupos: [],
  totales: { pacientes: 0, nuevos: 0, recurrentes: 0 },
  columnas: COLUMNAS_PACIENTES_ATENDIDOS,
  definicionDeFiltros: FILTROS_REPORTES,
  valores: {},
  setFiltro: vi.fn(),
  limpiarFiltros: vi.fn(),
  catalogos: {},
  agruparPor: "jornada",
  setAgruparPor: vi.fn(),
  recargar: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useReportePacientes: vi.fn(() => mockEstadoHook),
}));

const { useReportePacientes } = await import("@ecopac/shared");

function pantalla() {
  return render(<ReportePacientesPage />);
}

describe("ReportePacientesPage", () => {
  afterEach(() => {
    mockEstadoHook.tieneAcceso = true;
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.grupos = [];
    mockEstadoHook.totales = { pacientes: 0, nuevos: 0, recurrentes: 0 };
    useReportePacientes.mockClear();
    mockEstadoHook.recargar.mockClear();
    mockEstadoHook.setAgruparPor.mockClear();
  });

  it("sin acceso, muestra el mensaje de permisos, no el reporte", () => {
    mockEstadoHook.tieneAcceso = false;
    pantalla();

    expect(
      screen.getByText("Solo administración y junta directiva consultan el reporte de pacientes."),
    ).toBeInTheDocument();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Calculando el reporte...")).toBeInTheDocument();
  });

  // Con la base vacia (issue #759/#779): totales en cero y la lista vacia se dibujan sin
  // reventar.
  it("con la base vacia, los totales quedan en cero y la lista muestra su mensaje vacio", () => {
    const { container } = pantalla();

    expect(container.querySelector(".reporte-cifras")).toHaveTextContent("Pacientes atendidos");
    expect(
      screen.getByText("No hay atenciones registradas con estos filtros."),
    ).toBeInTheDocument();
  });

  it("con datos, pinta los totales y el grupo", () => {
    mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
    mockEstadoHook.totales = { pacientes: 40, nuevos: 10, recurrentes: 30 };
    const { container } = pantalla();

    expect(container.querySelector(".reporte-cifras")).toHaveTextContent("40");
    expect(screen.getByText("Jornada enero")).toBeInTheDocument();
  });

  it("cambiar la agrupacion llama a setAgruparPor()", () => {
    pantalla();

    fireEvent.change(screen.getByLabelText("Agrupar por"), { target: { value: "comunidad" } });

    expect(mockEstadoHook.setAgruparPor).toHaveBeenCalledWith("comunidad");
  });

  // Camino de error (issue #759/#779): si totales llega en null (calcularTotalesPorTipo() y
  // useReportePacientes.js lo hacen en el camino de error), la seccion de cifras no se pinta,
  // pero el error se muestra -- no una tabla en blanco sin explicacion.
  it("camino de error: si la consulta falla, muestra el error y no las cifras", () => {
    mockEstadoHook.error = { mensaje: "No se pudo calcular el reporte de pacientes." };
    mockEstadoHook.totales = null;
    pantalla();

    expect(screen.getByText("No se pudo calcular el reporte de pacientes.")).toBeInTheDocument();
    expect(document.querySelector(".reporte-cifras")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });
});
