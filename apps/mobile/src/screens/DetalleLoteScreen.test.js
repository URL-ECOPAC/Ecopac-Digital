// Prueba de DetalleLoteScreen (issue #791): Existencias y el alertario de vencimiento
// navegaban a una pantalla "DetalleLote" que nunca se habia construido.

import { render, screen, fireEvent } from "@testing-library/react-native";

import DetalleLoteScreen from "./DetalleLoteScreen";

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: { loteId: "lote-1" } }),
}));

const mockEstadoDetalle = {
  lote: null,
  movimientos: [],
  cargando: false,
  error: null,
  recargar: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useDetalleLote: jest.fn(() => mockEstadoDetalle),
}));

const { useDetalleLote } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<DetalleLoteScreen />);
}

const LOTE_DE_EJEMPLO = {
  id: "lote-1",
  medicamento: "Loratadina",
  numeroLote: "L-001",
  proveedor: "Farmacia Central",
  origen: "compra",
  cantidadIngresada: 100,
  fechaIngreso: "2026-01-01",
  fechaVencimiento: "2027-01-01",
  vencido: false,
};

const MOVIMIENTO_DE_EJEMPLO = {
  id: "mov-1",
  tipo: "salida",
  cantidad: 10,
  estado: "aprobado",
  created_at: "2026-02-01",
  bodega_nombre: "Bodega Central",
  registrado_por_nombre: "Ana Perez",
};

describe("DetalleLoteScreen", () => {
  beforeEach(() => {
    mockEstadoDetalle.lote = null;
    mockEstadoDetalle.movimientos = [];
    mockEstadoDetalle.cargando = false;
    mockEstadoDetalle.error = null;
    useDetalleLote.mockClear();
    mockEstadoDetalle.recargar.mockClear();
  });

  it("pide el detalle con el loteId de los parametros de ruta", () => {
    pantalla();

    expect(useDetalleLote).toHaveBeenCalledWith("lote-1");
  });

  it("mientras carga sin datos previos, muestra el estado de carga", () => {
    mockEstadoDetalle.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando el lote...")).toBeTruthy();
  });

  it("muestra los datos del lote: medicamento, numero, proveedor, origen y fechas", () => {
    mockEstadoDetalle.lote = LOTE_DE_EJEMPLO;
    pantalla();

    expect(screen.getByText("Loratadina")).toBeTruthy();
    expect(screen.getByText("L-001")).toBeTruthy();
    expect(screen.getByText("Farmacia Central")).toBeTruthy();
    expect(screen.getByText("Compra")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("un lote vencido muestra la advertencia", () => {
    mockEstadoDetalle.lote = { ...LOTE_DE_EJEMPLO, vencido: true };
    pantalla();

    expect(screen.getByText("Este lote esta vencido")).toBeTruthy();
  });

  it("sin movimientos, muestra el mensaje de vacio", () => {
    mockEstadoDetalle.lote = LOTE_DE_EJEMPLO;
    pantalla();

    expect(screen.getByText("Movimientos (0)")).toBeTruthy();
    expect(screen.getByText("Este lote todavia no tiene movimientos registrados.")).toBeTruthy();
  });

  it("con movimientos, pinta el kardex con tipo, cantidad, bodega y quien lo registro", () => {
    mockEstadoDetalle.lote = LOTE_DE_EJEMPLO;
    mockEstadoDetalle.movimientos = [MOVIMIENTO_DE_EJEMPLO];
    pantalla();

    expect(screen.getByText("Movimientos (1)")).toBeTruthy();
    expect(screen.getByText("Salida")).toBeTruthy();
    expect(screen.getByText("-10")).toBeTruthy();
    expect(screen.getByText(/Bodega Central/)).toBeTruthy();
    expect(screen.getByText("Ana Perez")).toBeTruthy();
  });

  it("camino de error: si la consulta falla, muestra el error con boton de reintentar", async () => {
    mockEstadoDetalle.error = { mensaje: "No se pudo cargar el lote." };
    pantalla();

    expect(screen.getByText("No se pudo cargar el lote.")).toBeTruthy();

    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockEstadoDetalle.recargar).toHaveBeenCalled();
  });

  it("sin lote y sin error (id inexistente), muestra el mensaje de vacio", () => {
    pantalla();

    expect(screen.getByText("No se encontro el lote.")).toBeTruthy();
  });
});
