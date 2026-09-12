// Prueba de EntregaMedicamentosScreen (Modulo II: entrega/salida, issue #777).

import { fireEvent, render, screen } from "@testing-library/react-native";

import EntregaMedicamentosScreen from "./EntregaMedicamentosScreen";

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { atencionId: "at-1" } }),
}));

const mockEstadoEntrega = {
  cargando: false,
  error: null,
  receta: null,
  detalles: [],
  recargar: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useEntregaMedicamentos: jest.fn(() => mockEstadoEntrega),
}));

const { useEntregaMedicamentos } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<EntregaMedicamentosScreen />);
}

const DETALLE_DE_EJEMPLO = {
  id: "d-1",
  medicamento: "Loratadina",
  cantidadEntregada: 5,
  cantidadDisponible: 35,
  vencido: false,
};

describe("EntregaMedicamentosScreen", () => {
  beforeEach(() => {
    mockEstadoEntrega.cargando = false;
    mockEstadoEntrega.error = null;
    mockEstadoEntrega.receta = null;
    mockEstadoEntrega.detalles = [];
    useEntregaMedicamentos.mockClear();
    mockEstadoEntrega.recargar.mockClear();
    mockGoBack.mockClear();
  });

  it("mientras carga sin datos previos, muestra el estado de carga", () => {
    mockEstadoEntrega.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando receta...")).toBeTruthy();
  });

  it("sin medicamentos en la receta, muestra el mensaje de vacio", () => {
    mockEstadoEntrega.receta = { pacienteNombre: "Ana Perez", numeroFicha: "0001-2026" };
    pantalla();

    expect(screen.getByText("Ana Perez")).toBeTruthy();
    expect(screen.getByText("No hay medicamentos en la receta")).toBeTruthy();
  });

  it("con detalles, pinta cada medicamento con lo entregado y lo disponible", () => {
    mockEstadoEntrega.receta = { pacienteNombre: "Ana Perez", numeroFicha: "0001-2026" };
    mockEstadoEntrega.detalles = [DETALLE_DE_EJEMPLO];
    pantalla();

    expect(screen.getByText("Loratadina")).toBeTruthy();
    expect(screen.getByText("Entregado: 5 · Disponible: 35")).toBeTruthy();
  });

  it("un medicamento vencido se marca como tal", () => {
    mockEstadoEntrega.detalles = [{ ...DETALLE_DE_EJEMPLO, vencido: true }];
    pantalla();

    expect(screen.getByText("VENCIDO — No se puede entregar")).toBeTruthy();
  });

  it("el boton de accion esta siempre deshabilitado: la entrega no es un mecanismo disponible aun", () => {
    pantalla();

    const boton = screen.getByRole("button", { name: "Entrega no disponible aun" });
    expect(boton.props.accessibilityState.disabled).toBe(true);
  });

  it("Volver navega hacia atras", () => {
    pantalla();

    fireEvent.press(screen.getByText("Volver"));

    expect(mockGoBack).toHaveBeenCalled();
  });

  // Camino de error (issue #759/#777): si la consulta falla, la pantalla tiene que mostrar el
  // error con boton de reintentar, no una receta vacia (que se veria igual que "sin medicamentos").
  it("camino de error: si la consulta falla, muestra el error con boton de reintentar", () => {
    mockEstadoEntrega.error = { mensaje: "No se pudo cargar la receta." };
    pantalla();

    expect(screen.getByText("No se pudo cargar la receta.")).toBeTruthy();
    expect(screen.queryByText("No hay medicamentos en la receta")).toBeNull();

    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockEstadoEntrega.recargar).toHaveBeenCalled();
  });
});
