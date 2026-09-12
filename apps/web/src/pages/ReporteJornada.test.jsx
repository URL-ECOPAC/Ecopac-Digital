// Prueba de ReporteJornada (Modulo IV: reporte de resultados de jornada, issue #779).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import {
  COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES,
  COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS,
  COLUMNAS_PERSONAL_PARTICIPANTE,
} from "@ecopac/shared";

import ReporteJornada from "./ReporteJornada";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "jor-1" }),
}));

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

vi.mock("../../../../packages/shared/reportes/useExportarPDF", () => ({
  useExportarPDF: () => ({ exportar: vi.fn(), generando: false }),
}));

const FICHA_DE_EJEMPLO = {
  nombre: "Jornada Vista Hermosa",
  fecha: "2026-03-01",
  comunidad: "Vista Hermosa",
  estado: "finalizada",
  total_consultas: 30,
  pacientes_atendidos: 28,
};

const mockEstadoHook = {
  tieneAcceso: true,
  cargando: false,
  error: null,
  ficha: null,
  diagnosticos: [],
  columnasDeDiagnosticos: COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES,
  medicamentos: [],
  columnasDeMedicamentos: COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS,
  personal: [],
  columnasDePersonal: COLUMNAS_PERSONAL_PARTICIPANTE,
  recargar: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useReporteJornada: vi.fn(() => mockEstadoHook),
}));

const { useReporteJornada } = await import("@ecopac/shared");

function pantalla() {
  return render(
    <MemoryRouter>
      <ReporteJornada />
    </MemoryRouter>,
  );
}

describe("ReporteJornada", () => {
  afterEach(() => {
    mockEstadoHook.tieneAcceso = true;
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.ficha = null;
    mockEstadoHook.diagnosticos = [];
    mockEstadoHook.medicamentos = [];
    mockEstadoHook.personal = [];
    useReporteJornada.mockClear();
    mockEstadoHook.recargar.mockClear();
    mockNavigate.mockClear();
  });

  it("sin acceso, muestra el mensaje de permisos, no el reporte", () => {
    mockEstadoHook.tieneAcceso = false;
    pantalla();

    expect(
      screen.getByText(
        "Solo administración y médico consultan el reporte de resultados de la jornada.",
      ),
    ).toBeInTheDocument();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando los resultados de la jornada...")).toBeInTheDocument();
  });

  // Con la base vacia (issue #759/#779): sin ficha (jornada sin datos agregados todavia), la
  // pantalla no revienta -- simplemente no pinta la seccion de contenido.
  it("sin ficha, la pantalla no revienta y no pinta la seccion de contenido", () => {
    pantalla();

    expect(screen.getByText("Resultados de la jornada")).toBeInTheDocument();
    expect(screen.queryByText("Diagnósticos más frecuentes")).not.toBeInTheDocument();
  });

  it("con ficha pero sin diagnosticos/medicamentos, cada tabla muestra su propio vacio", () => {
    mockEstadoHook.ficha = FICHA_DE_EJEMPLO;
    pantalla();

    expect(
      screen.getByText("No se registró ningún diagnóstico en esta jornada."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No se entregó ningún medicamento en esta jornada."),
    ).toBeInTheDocument();
    expect(screen.getByText("Nadie registró consultas en esta jornada.")).toBeInTheDocument();
  });

  it("con datos, pinta la ficha y los diagnosticos/medicamentos/personal", () => {
    mockEstadoHook.ficha = FICHA_DE_EJEMPLO;
    mockEstadoHook.diagnosticos = [{ diagnostico: "Faringitis aguda", cantidad: 12 }];
    mockEstadoHook.medicamentos = [{ medicamento: "Loratadina", cantidad: 40 }];
    pantalla();

    expect(screen.getByText("Jornada Vista Hermosa")).toBeInTheDocument();
    expect(screen.getByText("Faringitis aguda")).toBeInTheDocument();
    expect(screen.getByText("Loratadina")).toBeInTheDocument();
  });

  it("Volver a reportes navega a /reportes", () => {
    pantalla();

    fireEvent.click(screen.getByText("Volver a reportes"));

    expect(mockNavigate).toHaveBeenCalledWith("/reportes");
  });

  // Camino de error (issue #759/#779): si la consulta falla, se muestra el error con boton de
  // reintentar, no la pantalla en blanco.
  it("camino de error: si la consulta falla, muestra el error con boton de reintentar", () => {
    mockEstadoHook.error = { mensaje: "No se pudo cargar el reporte de la jornada." };
    pantalla();

    expect(screen.getByText("No se pudo cargar el reporte de la jornada.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });
});
