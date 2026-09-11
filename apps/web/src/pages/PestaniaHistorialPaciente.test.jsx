// Prueba de PestaniaHistorialPaciente (Modulo I: historial, issue #776).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import PestaniaHistorialPaciente from "./PestaniaHistorialPaciente";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const mockEstadoHook = {
  grupos: [],
  total: 0,
  filtros: {},
  setFiltro: vi.fn(),
  limpiarFiltros: vi.fn(),
  hayFiltros: false,
  cargando: false,
  error: null,
  recargar: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useHistorialPaciente: vi.fn(() => mockEstadoHook),
}));

const { useHistorialPaciente } = await import("@ecopac/shared");

function pantalla() {
  return render(<PestaniaHistorialPaciente pacienteId="p-1" rol="medico" />);
}

const GRUPO_DE_EJEMPLO = {
  clave: "g-1",
  jornada: "Jornada enero",
  comunidad: "Santa Cruz",
  fecha: "2026-01-10",
  eventos: [
    {
      id: "e-1",
      tipo: "consulta",
      fecha: "2026-01-10T09:00:00Z",
      profesional: "Dr. Perez",
      diagnosticoPrincipal: { nombre: "Faringitis aguda" },
      diagnosticos: [{ codigo: "J02", nombre: "Faringitis aguda" }],
      motivoConsulta: "Dolor de garganta",
    },
  ],
};

describe("PestaniaHistorialPaciente", () => {
  afterEach(() => {
    mockEstadoHook.grupos = [];
    mockEstadoHook.total = 0;
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.hayFiltros = false;
    useHistorialPaciente.mockClear();
    mockEstadoHook.recargar.mockClear();
    mockEstadoHook.limpiarFiltros.mockClear();
  });

  it("mientras carga, muestra el estado de carga y no la lista ni el vacio", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
    expect(screen.queryByText(/todavia no tiene atenciones/)).not.toBeInTheDocument();
  });

  it("sin eventos y sin filtros, muestra el vacio explicando que no hay atenciones", () => {
    pantalla();

    expect(
      screen.getByText("Este paciente todavia no tiene atenciones registradas."),
    ).toBeInTheDocument();
  });

  it("sin eventos pero CON filtros activos, el vacio explica que fue el filtro y ofrece limpiarlo", () => {
    mockEstadoHook.hayFiltros = true;
    pantalla();

    expect(
      screen.getByText("Ningun evento del historial coincide con los filtros."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Limpiar filtros"));
    expect(mockEstadoHook.limpiarFiltros).toHaveBeenCalled();
  });

  it("con datos, pinta el grupo y su evento de consulta", () => {
    mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
    mockEstadoHook.total = 1;
    pantalla();

    expect(screen.getByText("Jornada enero")).toBeInTheDocument();
    expect(screen.getByText("Faringitis aguda")).toBeInTheDocument();
  });

  it("Ver detalle expande el detalle de la consulta", () => {
    mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
    mockEstadoHook.total = 1;
    pantalla();

    fireEvent.click(screen.getByText("Ver detalle"));

    expect(screen.getByText("Dolor de garganta")).toBeInTheDocument();
    expect(screen.getByText("Ocultar detalle")).toBeInTheDocument();
  });

  // Camino de error (issue #759/#776): si la consulta del historial falla, la pantalla tiene que
  // mostrar el error con boton de reintento -- no una lista vacia, que es indistinguible de "este
  // paciente no tiene historial".
  it("camino de error: si la consulta falla, muestra el error con boton de reintentar, no una lista vacia", () => {
    mockEstadoHook.error = { mensaje: "No se pudo cargar el historial." };
    pantalla();

    expect(screen.getByText("No se pudo cargar el historial.")).toBeInTheDocument();
    expect(
      screen.queryByText("Este paciente todavia no tiene atenciones registradas."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });
});
