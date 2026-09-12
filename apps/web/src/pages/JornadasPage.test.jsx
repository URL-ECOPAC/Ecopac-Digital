// Prueba de JornadasPage (Modulo III: mover el kanban, issue #778).
//
// ModalJornada.jsx (crear/editar) se reemplaza por un doble: tiene su propia prueba
// (ModalJornada.test.jsx) y aqui solo importa que JornadasPage lo monte con las props correctas.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import { agruparJornadasPorEstado } from "@ecopac/shared";

import JornadasPage from "./JornadasPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useNavigate: () => mockNavigate,
}));

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

vi.mock("./ModalJornada", () => ({
  default: ({ jornada, onClose, onGuardado }) => (
    <div data-testid="modal-jornada">
      <span>{jornada ? `Editar ${jornada.nombre}` : "Nueva jornada"}</span>
      <button onClick={onClose}>cerrar-modal</button>
      <button onClick={onGuardado}>guardar-modal</button>
    </div>
  ),
}));

const JORNADA_EN_CURSO = {
  id: "jor-1",
  nombre: "Jornada Vista Hermosa",
  fecha: "2026-03-01",
  comunidad: { nombre: "Vista Hermosa" },
  responsable: { nombres: "Ana", apellidos: "Perez" },
  estado: "en curso",
  cupoEstimado: null,
};

const mockEstadoHook = {
  columnas: agruparJornadasPorEstado([]),
  filtros: {},
  setFiltro: vi.fn(),
  cargando: false,
  error: null,
  recargar: vi.fn(),
  total: 0,
  catalogos: { comunidades: [] },
  puedeCrear: true,
  puedeEditar: true,
  puedeReabrir: true,
  moverJornada: vi.fn(),
  moviendo: false,
  errorMovimiento: null,
  descartarErrorMovimiento: vi.fn(),
  pedirCierreEnDetalle: null,
  descartarPedidoCierre: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useJornadasKanban: vi.fn(() => mockEstadoHook),
}));

const { useJornadasKanban } = await import("@ecopac/shared");

function pantalla() {
  return render(
    <MemoryRouter>
      <JornadasPage />
    </MemoryRouter>,
  );
}

describe("JornadasPage", () => {
  afterEach(() => {
    mockEstadoHook.columnas = agruparJornadasPorEstado([]);
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.errorMovimiento = null;
    mockEstadoHook.pedirCierreEnDetalle = null;
    useJornadasKanban.mockClear();
    mockEstadoHook.moverJornada.mockClear();
    mockEstadoHook.recargar.mockClear();
    mockNavigate.mockClear();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("sin jornadas, cada columna muestra su mensaje vacio", () => {
    pantalla();

    expect(screen.getAllByText("Sin jornadas").length).toBeGreaterThan(0);
  });

  it("con una jornada, la pinta en su columna con nombre, comunidad y responsable", () => {
    mockEstadoHook.columnas = agruparJornadasPorEstado([JORNADA_EN_CURSO]);
    mockEstadoHook.total = 1;
    pantalla();

    expect(screen.getByText("Jornada Vista Hermosa")).toBeInTheDocument();
    expect(screen.getByText(/Vista Hermosa · 01\/03\/2026/)).toBeInTheDocument();
  });

  it("Ver detalle navega a /jornadas/:id, sin depender del permiso de editar", () => {
    mockEstadoHook.columnas = agruparJornadasPorEstado([JORNADA_EN_CURSO]);
    pantalla();

    fireEvent.click(screen.getByText("Ver detalle"));

    expect(mockNavigate).toHaveBeenCalledWith("/jornadas/jor-1");
  });

  it("Avanzar dispara moverJornada() hacia el siguiente estado", () => {
    mockEstadoHook.columnas = agruparJornadasPorEstado([JORNADA_EN_CURSO]);
    pantalla();

    fireEvent.click(screen.getByText("Avanzar →"));

    expect(mockEstadoHook.moverJornada).toHaveBeenCalledWith("jor-1", "en curso", "finalizada");
  });

  it("Nueva jornada abre el modal en modo alta", () => {
    pantalla();

    fireEvent.click(screen.getByText("Nueva jornada"));

    expect(screen.getByTestId("modal-jornada")).toBeInTheDocument();
  });

  // Camino de error (issue #759/#778): si la consulta de jornadas falla, la pantalla tiene que
  // mostrar el error, no un tablero con columnas vacias en silencio.
  it("camino de error: si la consulta falla, muestra el error y no el tablero", () => {
    mockEstadoHook.error = { mensaje: "No se pudieron cargar las jornadas." };
    pantalla();

    expect(screen.getByText("No se pudieron cargar las jornadas.")).toBeInTheDocument();
    expect(screen.queryByText("Sin jornadas")).not.toBeInTheDocument();
  });

  it("camino de error de movimiento: un error al mover se muestra y se puede descartar", () => {
    mockEstadoHook.errorMovimiento = { mensaje: "Esa jornada ya no se puede mover a ese estado." };
    pantalla();

    expect(screen.getByText("Esa jornada ya no se puede mover a ese estado.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Cerrar"));
    expect(mockEstadoHook.descartarErrorMovimiento).toHaveBeenCalled();
  });
});
