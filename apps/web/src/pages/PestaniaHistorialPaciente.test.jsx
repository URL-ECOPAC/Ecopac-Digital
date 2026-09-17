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

function pantalla({ rol = "medico", perfilId } = {}) {
  return render(<PestaniaHistorialPaciente pacienteId="p-1" rol={rol} perfilId={perfilId} />);
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
      profesionalId: "per-medico",
      diagnosticoPrincipal: { nombre: "Faringitis aguda" },
      diagnosticos: [{ codigo: "J02", nombre: "Faringitis aguda" }],
      motivoConsulta: "Dolor de garganta",
      antecedentes: "Sin antecedentes relevantes",
      sintomas: "Odinofagia, fiebre",
      exploracion: "Faringe eritematosa",
      observaciones: "Se indica reposo",
    },
  ],
};

const GRUPO_CON_TRIAJE = {
  clave: "g-2",
  jornada: "Jornada febrero",
  comunidad: "Santa Cruz",
  fecha: "2026-02-10",
  eventos: [
    {
      id: "triaje-1",
      tipo: "triaje",
      fecha: "2026-02-10T09:00:00Z",
      profesional: "Enf. Rosa",
      signos: { presionSistolica: 120, presionDiastolica: 80 },
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

  // Issue #756: antecedentes/sintomas/exploracion/observaciones se capturaban pero el historial
  // nunca los mostraba.
  it("el detalle de la consulta tambien muestra antecedentes, sintomas, exploracion y observaciones", () => {
    mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
    mockEstadoHook.total = 1;
    pantalla();

    fireEvent.click(screen.getByText("Ver detalle"));

    expect(screen.getByText("Sin antecedentes relevantes")).toBeInTheDocument();
    expect(screen.getByText("Odinofagia, fiebre")).toBeInTheDocument();
    expect(screen.getByText("Faringe eritematosa")).toBeInTheDocument();
    expect(screen.getByText("Se indica reposo")).toBeInTheDocument();
  });

  // Issue #756: actualizarTriaje()/puedeCorregirTriaje() ya existian, probados, sin pantalla.
  describe("correccion de triaje", () => {
    it("un medico ve el boton Editar en un evento de triaje", () => {
      mockEstadoHook.grupos = [GRUPO_CON_TRIAJE];
      mockEstadoHook.total = 1;
      pantalla({ rol: "medico" });

      expect(screen.getByText("Editar")).toBeInTheDocument();
    });

    it("un voluntario general no ve el boton Editar", () => {
      mockEstadoHook.grupos = [GRUPO_CON_TRIAJE];
      mockEstadoHook.total = 1;
      pantalla({ rol: "voluntario general" });

      expect(screen.queryByText("Editar")).not.toBeInTheDocument();
    });

    it("Editar abre el modal de correccion del triaje", () => {
      mockEstadoHook.grupos = [GRUPO_CON_TRIAJE];
      mockEstadoHook.total = 1;
      pantalla({ rol: "medico" });

      fireEvent.click(screen.getByText("Editar"));

      expect(screen.getByText("Editar triaje")).toBeInTheDocument();
    });
  });

  // Issue #756: actualizarConsulta()/puedeCorregirConsulta() ya existian, probados, sin
  // pantalla.
  describe("correccion de consulta", () => {
    it("el medico que registro la consulta ve el boton Editar", () => {
      mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
      mockEstadoHook.total = 1;
      pantalla({ rol: "medico", perfilId: "per-medico" });

      expect(screen.getByText("Editar")).toBeInTheDocument();
    });

    it("un medico que no registro esa consulta no ve el boton Editar", () => {
      mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
      mockEstadoHook.total = 1;
      pantalla({ rol: "medico", perfilId: "otro-medico" });

      expect(screen.queryByText("Editar")).not.toBeInTheDocument();
    });

    it("Editar abre el modal de correccion de la consulta", () => {
      mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
      mockEstadoHook.total = 1;
      pantalla({ rol: "medico", perfilId: "per-medico" });

      fireEvent.click(screen.getByText("Editar"));

      expect(screen.getByText("Editar consulta")).toBeInTheDocument();
    });
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
