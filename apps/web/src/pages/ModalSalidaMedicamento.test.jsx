// Prueba de ModalSalidaMedicamento (Modulo II: salida, issue #777).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { ModalSalidaMedicamento } from "./ModalSalidaMedicamento";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const MEDICAMENTOS = [{ id: "med-1", nombre: "Loratadina", concentracion: "10mg" }];

const LOTE_DE_EJEMPLO = {
  loteId: "lote-1",
  numeroLote: "LOTE-1",
  bodega: "Bodega Principal",
  fechaVencimiento: "2027-01-01",
  cantidadDisponible: 40,
};

const mockEstadoHook = {
  motivo: "",
  setMotivo: vi.fn(),
  medicamentoId: "",
  setMedicamentoId: vi.fn(),
  loteSeleccionado: null,
  seleccionarLote: vi.fn(),
  cantidad: "",
  setCantidad: vi.fn(),
  lotesDisponibles: [],
  error: null,
  cargando: false,
  guardarSalida: vi.fn((evento) => evento?.preventDefault?.()),
};

vi.mock("../../../../packages/shared/inventario/useRegistroSalida", () => ({
  useRegistroSalida: vi.fn(() => mockEstadoHook),
}));

const { useRegistroSalida } =
  await import("../../../../packages/shared/inventario/useRegistroSalida");

function pantalla(props = {}) {
  return render(
    <ModalSalidaMedicamento
      abierto
      onClose={vi.fn()}
      medicamentos={MEDICAMENTOS}
      usuarioId="u-1"
      {...props}
    />,
  );
}

describe("ModalSalidaMedicamento", () => {
  afterEach(() => {
    mockEstadoHook.lotesDisponibles = [];
    mockEstadoHook.loteSeleccionado = null;
    mockEstadoHook.error = null;
    mockEstadoHook.cargando = false;
    useRegistroSalida.mockClear();
    mockEstadoHook.guardarSalida.mockClear();
  });

  it("cerrado (abierto=false) no renderiza nada", () => {
    pantalla({ abierto: false });

    expect(screen.queryByText("Registro de Salida de Medicamentos")).not.toBeInTheDocument();
  });

  it("pinta el formulario con los motivos y los medicamentos del catalogo", () => {
    pantalla();

    expect(screen.getByText("Entrega a paciente")).toBeInTheDocument();
    expect(screen.getByText("Loratadina (10mg)")).toBeInTheDocument();
  });

  it("con lotes disponibles, el selector de lote FEFO los lista", () => {
    mockEstadoHook.lotesDisponibles = [LOTE_DE_EJEMPLO];
    pantalla();

    expect(screen.getByText(/Lote: LOTE-1/)).toBeInTheDocument();
  });

  it("enviar el formulario dispara guardarSalida()", () => {
    const { container } = pantalla();

    fireEvent.submit(container.querySelector("form"));

    expect(mockEstadoHook.guardarSalida).toHaveBeenCalled();
  });

  it("mientras carga, Registrar Salida esta deshabilitado y dice Registrando...", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    const boton = screen.getByText("Registrando...");
    expect(boton).toBeDisabled();
  });

  // Camino de error (issue #759/#777): si guardarSalida() falla, el modal se queda abierto con
  // el error visible, no se cierra como si hubiera funcionado.
  it("camino de error: si la consulta falla, muestra el error y el modal sigue abierto", () => {
    mockEstadoHook.error = "La cantidad solicitada supera la existencia disponible.";
    pantalla();

    expect(
      screen.getByText("La cantidad solicitada supera la existencia disponible."),
    ).toBeInTheDocument();
    expect(screen.getByText("Registro de Salida de Medicamentos")).toBeInTheDocument();
  });
});
