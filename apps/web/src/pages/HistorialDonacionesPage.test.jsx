// Prueba de HistorialDonacionesPage: el detalle de una donacion (proyectoNombre/anuladaPorNombre,
// issue #756), las cuatro tarjetas de totales y que ya no se ofrece anular (issue #911).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as matchers from "@testing-library/jest-dom/matchers";

import HistorialDonacionesPage from "./HistorialDonacionesPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const DONACION_ACTIVA = {
  id: "d-1",
  donanteNombre: "Fundacion Esperanza",
  tipo: "dinero",
  fecha: "2026-01-10",
  estado: "registrada",
  detalles: [],
};

const DONACION_ANULADA = {
  ...DONACION_ACTIVA,
  id: "d-2",
  estado: "anulada",
  motivoAnulacion: "Registro duplicado",
  anuladaPorNombre: "Ana Lopez",
  anuladaEn: "2026-01-11",
};

const mockEstadoHook = {
  tieneAccesoLectura: true,
  cargando: false,
  error: null,
  donaciones: [],
  totalesPorTipo: { dinero: 1500, medicamentos: 40, insumos: 12, servicios: 3 },
  filtros: {
    filtroDonante: "",
    setFiltroDonante: vi.fn(),
    filtroTipo: "",
    setFiltroTipo: vi.fn(),
    filtroProyecto: "",
    setFiltroProyecto: vi.fn(),
    fechaInicio: "",
    setFechaInicio: vi.fn(),
    fechaFin: "",
    setFechaFin: vi.fn(),
    limpiarFiltros: vi.fn(),
  },
  modalDetalle: {
    donacionSeleccionada: null,
    modalDetalleAbierto: false,
    abrirDetalle: vi.fn(),
    cerrarDetalle: vi.fn(),
  },
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useHistorialDonaciones: vi.fn(() => mockEstadoHook),
}));

const { useHistorialDonaciones } = await import("@ecopac/shared");

function pantalla() {
  // Con router: la cabecera lleva el enlace "Volver a donaciones".
  return render(
    <MemoryRouter>
      <HistorialDonacionesPage usuarioRol="administrador" />
    </MemoryRouter>,
  );
}

describe("HistorialDonacionesPage", () => {
  afterEach(() => {
    mockEstadoHook.donaciones = [];
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: null,
      modalDetalleAbierto: false,
    };
    useHistorialDonaciones.mockClear();
  });

  it("muestra una tarjeta por cada tipo de donacion, servicios incluido", () => {
    const { container } = pantalla();

    const tarjetas = [...container.querySelectorAll(".ec-kpi")].map((t) => t.textContent);
    expect(tarjetas).toHaveLength(4);
    expect(tarjetas[0]).toContain("1,500.00");
    expect(tarjetas[1]).toContain("40");
    expect(tarjetas[2]).toContain("12");
    expect(tarjetas[3]).toContain("3");
    expect(tarjetas[3]).toContain("donaciones");
  });

  it("el detalle de una donacion activa ya no ofrece anularla", () => {
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: DONACION_ACTIVA,
      modalDetalleAbierto: true,
    };
    pantalla();

    expect(screen.queryByText("Anular donación")).not.toBeInTheDocument();
    expect(screen.getByText("Cerrar")).toBeInTheDocument();
  });

  it("una donacion anulada antes de la 00173 sigue mostrando quien la anulo", () => {
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: DONACION_ANULADA,
      modalDetalleAbierto: true,
    };
    pantalla();

    expect(screen.getByText("Ana Lopez")).toBeInTheDocument();
    expect(screen.getByText("Registro duplicado")).toBeInTheDocument();
  });
});
