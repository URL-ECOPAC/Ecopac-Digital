// Prueba de DetalleLoteScreen (issue #791): Existencias y el alertario de vencimiento
// navegaban a una pantalla "DetalleLote" que nunca se habia construido.

import { render, screen, fireEvent } from "@testing-library/react-native";

import DetalleLoteScreen from "./DetalleLoteScreen";

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: { loteId: "lote-1" } }),
}));

const mockSesion = { perfil: { id: "u-1", rol: "medico" } };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
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
  costoUnitario: 12.5,
  registradoPor: "u-1",
  confirmado: false,
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

    expect(screen.getByText("No se encontró el lote.")).toBeTruthy();
  });

  // Issue #866: "al presionar una tarjeta se deben ver sus datos y un boton de editar". Quien
  // puede editar lo decide puedeCorregirLote() -espejo del UPDATE de la 00107-, no un rol fijo:
  // la administradora siempre, o quien registro el lote mientras siga provisional.
  it("el autor de un lote provisional ve el boton de editar", () => {
    mockEstadoDetalle.lote = LOTE_DE_EJEMPLO;
    pantalla();

    expect(screen.getByText("Editar")).toBeTruthy();
  });

  it("alguien ajeno al lote no ve el boton de editar", () => {
    mockSesion.perfil = { id: "otro-usuario", rol: "medico" };
    mockEstadoDetalle.lote = LOTE_DE_EJEMPLO;
    pantalla();

    expect(screen.queryByText("Editar")).toBeNull();

    mockSesion.perfil = { id: "u-1", rol: "medico" };
  });

  it("un lote ya confirmado no lo corrige su autor, solo administracion", () => {
    mockEstadoDetalle.lote = { ...LOTE_DE_EJEMPLO, confirmado: true };
    pantalla();

    expect(screen.queryByText("Editar")).toBeNull();
  });

  // El costo es informacion financiera (issue #752): un medico no lo ve aunque vea el lote.
  it("el costo unitario solo se muestra a quien puede ver la valorizacion", () => {
    mockEstadoDetalle.lote = LOTE_DE_EJEMPLO;
    pantalla();

    expect(screen.queryByText("Costo unitario")).toBeNull();

    mockSesion.perfil = { id: "u-9", rol: "administrador" };
    pantalla();

    expect(screen.getByText("Costo unitario")).toBeTruthy();

    mockSesion.perfil = { id: "u-1", rol: "medico" };
  });
});
