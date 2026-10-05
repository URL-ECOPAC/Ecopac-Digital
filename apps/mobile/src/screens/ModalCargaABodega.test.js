// Prueba de ModalCargaABodega (issue #925): espejo de apps/web/src/pages/ModalCargaABodega.jsx.

import { fireEvent, render, screen } from "@testing-library/react-native";

import ModalCargaABodega from "./ModalCargaABodega";

const mockGuardar = jest.fn();
const mockSeleccionarLotePorClave = jest.fn();
const mockEstadoCarga = {
  articulos: [{ value: "med-1", label: "Amoxicilina 500mg" }],
  medicamentoId: "",
  setMedicamentoId: jest.fn(),
  lotesDeOrigen: [
    {
      loteId: "lote-1",
      bodegaId: "bod-origen",
      numeroLote: "L-001",
      bodega: "Bodega Central",
      fechaVencimiento: "2099-01-01",
      cantidadDisponible: 30,
    },
  ],
  claveLote: "",
  seleccionarLotePorClave: mockSeleccionarLotePorClave,
  cantidad: "",
  setCantidad: jest.fn(),
  sinExistencia: false,
  mensajeSinExistencia: null,
  avisoCantidad: null,
  avisoOrigen: null,
  puedeGuardar: true,
  cargando: false,
  guardando: false,
  error: null,
  guardar: mockGuardar,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useCargaDeBodegaDeJornada: jest.fn(() => mockEstadoCarga),
}));

const { useCargaDeBodegaDeJornada } = jest.requireMock("@ecopac/shared");

function modal(props = {}) {
  return render(
    <ModalCargaABodega
      visible
      jornadaId="jor-1"
      bodega={{ id: "bod-1", nombre: "Bodega Móvil 1" }}
      rol="administrador"
      onClose={jest.fn()}
      onCargado={jest.fn()}
      {...props}
    />,
  );
}

describe("ModalCargaABodega", () => {
  beforeEach(() => {
    mockEstadoCarga.error = null;
    mockEstadoCarga.puedeGuardar = true;
    mockEstadoCarga.guardando = false;
    mockEstadoCarga.sinExistencia = false;
    useCargaDeBodegaDeJornada.mockClear();
    mockGuardar.mockClear();
    mockGuardar.mockResolvedValue({ ok: true });
  });

  it("pide la carga con jornadaId, bodegaId y rol", () => {
    modal();

    expect(useCargaDeBodegaDeJornada).toHaveBeenCalledWith(
      expect.objectContaining({ jornadaId: "jor-1", bodegaId: "bod-1", rol: "administrador" }),
    );
  });

  it("muestra el titulo con el nombre de la bodega", () => {
    modal();
    expect(screen.getByText("Cargar a la bodega Bodega Móvil 1")).toBeTruthy();
  });

  it("al guardar con exito, cierra el modal", async () => {
    const onClose = jest.fn();
    modal({ onClose });

    await fireEvent.press(screen.getByText("Cargar"));

    expect(mockGuardar).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("si guardar falla, no cierra el modal", async () => {
    mockGuardar.mockResolvedValue({ ok: false });
    const onClose = jest.fn();
    modal({ onClose });

    await fireEvent.press(screen.getByText("Cargar"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("sin poder guardar, el boton Cargar esta deshabilitado", () => {
    mockEstadoCarga.puedeGuardar = false;
    modal();

    const boton = screen.getByRole("button", { name: "Cargar" });
    expect(boton.props.accessibilityState.disabled).toBe(true);
  });

  it("camino de error: muestra el mensaje del hook", () => {
    mockEstadoCarga.error = { mensaje: "Existencia insuficiente." };
    modal();

    expect(screen.getByText(/Existencia insuficiente\./)).toBeTruthy();
  });

  it("sin existencia en el lote elegido, muestra el mensaje junto al selector", () => {
    mockEstadoCarga.sinExistencia = true;
    mockEstadoCarga.mensajeSinExistencia = "No hay existencia de este lote.";
    modal();

    expect(screen.getByText("No hay existencia de este lote.")).toBeTruthy();
  });
});
