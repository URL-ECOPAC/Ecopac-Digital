// Prueba de ModalDevolucionDeBodega (issue #925): espejo de
// apps/web/src/pages/ModalDevolucionDeBodega.jsx.

import { fireEvent, render, screen } from "@testing-library/react-native";

import ModalDevolucionDeBodega from "./ModalDevolucionDeBodega";

const mockGuardar = jest.fn();
const mockEstadoDevolucion = {
  lotes: [
    {
      loteId: "lote-1",
      articulo: "Amoxicilina 500mg",
      numeroLote: "L-001",
      fechaVencimiento: "2099-01-01",
      cantidadDisponible: 12,
    },
  ],
  claveLote: "",
  seleccionarLote: jest.fn(),
  bodegasDestino: [{ value: "bod-fija-1", label: "Bodega Central" }],
  bodegaDestinoId: "",
  setBodegaDestinoId: jest.fn(),
  cantidad: "",
  setCantidad: jest.fn(),
  avisoCantidad: null,
  puedeGuardar: true,
  guardando: false,
  error: null,
  guardar: mockGuardar,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useDevolucionDeBodegaDeJornada: jest.fn(() => mockEstadoDevolucion),
}));

const { useDevolucionDeBodegaDeJornada } = jest.requireMock("@ecopac/shared");

function modal(props = {}) {
  return render(
    <ModalDevolucionDeBodega
      visible
      jornadaId="jor-1"
      bodega={{ id: "bod-1", nombre: "Bodega Móvil 1" }}
      contenido={[]}
      rol="administrador"
      onClose={jest.fn()}
      onDevuelto={jest.fn()}
      {...props}
    />,
  );
}

describe("ModalDevolucionDeBodega", () => {
  beforeEach(() => {
    mockEstadoDevolucion.error = null;
    mockEstadoDevolucion.puedeGuardar = true;
    mockEstadoDevolucion.guardando = false;
    useDevolucionDeBodegaDeJornada.mockClear();
    mockGuardar.mockClear();
    mockGuardar.mockResolvedValue({ ok: true });
  });

  it("muestra el titulo con el nombre de la bodega", () => {
    modal();
    expect(screen.getByText("Devolver de la bodega Bodega Móvil 1")).toBeTruthy();
  });

  it("al guardar con exito, cierra el modal", async () => {
    const onClose = jest.fn();
    modal({ onClose });

    await fireEvent.press(screen.getByText("Devolver"));

    expect(mockGuardar).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("si guardar falla, no cierra el modal", async () => {
    mockGuardar.mockResolvedValue({ ok: false });
    const onClose = jest.fn();
    modal({ onClose });

    await fireEvent.press(screen.getByText("Devolver"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("sin poder guardar, el boton Devolver esta deshabilitado", () => {
    mockEstadoDevolucion.puedeGuardar = false;
    modal();

    const boton = screen.getByRole("button", { name: "Devolver" });
    expect(boton.props.accessibilityState.disabled).toBe(true);
  });

  it("camino de error: muestra el mensaje del hook", () => {
    mockEstadoDevolucion.error = { mensaje: "No se pudo devolver." };
    modal();

    expect(screen.getByText(/No se pudo devolver\./)).toBeTruthy();
  });
});
