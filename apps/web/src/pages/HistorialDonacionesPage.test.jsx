// Prueba de HistorialDonacionesPage: correccion del bug de proyectoNombre/anuladaPorNombre y
// del boton de anular donacion (issue #756). anularDonacion() y CAMPOS_ANULACION_DONACION ya
// existian (issue #635) sin ningun boton que los llamara.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  totalesPorTipo: { dinero: 0, medicamentos: 0, insumos: 0, servicios: 0 },
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
  anulacion: {
    puedeAnular: true,
    anulando: false,
    errorAnular: null,
    anular: vi.fn(async () => ({ ok: true })),
  },
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useHistorialDonaciones: vi.fn(() => mockEstadoHook),
}));

const { useHistorialDonaciones } = await import("@ecopac/shared");

function pantalla() {
  return render(<HistorialDonacionesPage usuarioRol="administrador" />);
}

describe("HistorialDonacionesPage", () => {
  afterEach(() => {
    mockEstadoHook.donaciones = [];
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: null,
      modalDetalleAbierto: false,
    };
    mockEstadoHook.anulacion = {
      puedeAnular: true,
      anulando: false,
      errorAnular: null,
      anular: vi.fn(async () => ({ ok: true })),
    };
    useHistorialDonaciones.mockClear();
  });

  it("una donacion activa muestra el boton Anular donacion en el detalle", () => {
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: DONACION_ACTIVA,
      modalDetalleAbierto: true,
    };
    pantalla();

    expect(screen.getByText("Anular donación")).toBeInTheDocument();
  });

  it("una donacion ya anulada no ofrece el boton Anular, y muestra quien la anulo", () => {
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: DONACION_ANULADA,
      modalDetalleAbierto: true,
    };
    pantalla();

    expect(screen.queryByText("Anular donación")).not.toBeInTheDocument();
    expect(screen.getByText("Ana Lopez")).toBeInTheDocument();
  });

  it("sin permiso de escritura, no se ofrece anular", () => {
    mockEstadoHook.anulacion = { ...mockEstadoHook.anulacion, puedeAnular: false };
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: DONACION_ACTIVA,
      modalDetalleAbierto: true,
    };
    pantalla();

    expect(screen.queryByText("Anular donación")).not.toBeInTheDocument();
  });

  it("Anular donacion pide el motivo, y Confirmar exige que no este vacio", () => {
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: DONACION_ACTIVA,
      modalDetalleAbierto: true,
    };
    pantalla();

    fireEvent.click(screen.getByText("Anular donación"));

    expect(screen.getByText("Confirmar anulación")).toBeDisabled();
  });

  it("con motivo escrito, Confirmar llama a anular() con el id y el motivo", async () => {
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: DONACION_ACTIVA,
      modalDetalleAbierto: true,
    };
    pantalla();

    fireEvent.click(screen.getByText("Anular donación"));
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), {
      target: { value: "Registro duplicado" },
    });
    fireEvent.click(screen.getByText("Confirmar anulación"));

    expect(mockEstadoHook.anulacion.anular).toHaveBeenCalledWith("d-1", "Registro duplicado");
  });

  // Camino de error: si anular() falla, el motivo se queda visible con el error, no se cierra.
  it("camino de error: si anular falla, muestra el error y no vuelve al boton inicial", async () => {
    mockEstadoHook.anulacion = {
      ...mockEstadoHook.anulacion,
      anular: vi.fn(async () => ({ ok: false, error: { mensaje: "42501" } })),
      errorAnular: { mensaje: "Operación exclusiva para el rol Administrador." },
    };
    mockEstadoHook.modalDetalle = {
      ...mockEstadoHook.modalDetalle,
      donacionSeleccionada: DONACION_ACTIVA,
      modalDetalleAbierto: true,
    };
    pantalla();

    fireEvent.click(screen.getByText("Anular donación"));
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByText("Confirmar anulación"));

    expect(
      screen.getByText("Operación exclusiva para el rol Administrador."),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirmar anulación")).toBeInTheDocument();
  });
});
