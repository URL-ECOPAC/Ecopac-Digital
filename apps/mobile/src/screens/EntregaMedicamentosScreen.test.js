// Prueba de EntregaMedicamentosScreen (Modulo II: entrega/salida, issue #777, extendida por el
// ajuste de cantidad entregada de la issue #764).

import { fireEvent, render, screen } from "@testing-library/react-native";

import EntregaMedicamentosScreen from "./EntregaMedicamentosScreen";

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { atencionId: "at-1" } }),
}));

const mockSesion = { perfil: { id: "perfil-1" }, rol: "medico" };
jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

const mockEstadoEntrega = {
  cargando: false,
  error: null,
  receta: null,
  detalles: [],
  recargar: jest.fn(),
  ajustarEntrega: jest.fn(),
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
  loteId: "lote-1",
  bodegaId: "bod-1",
  dosis: "1 tableta",
  frecuencia: "cada 8 horas",
  duracion: "5 dias",
  cantidadEntregada: 5,
  cantidadAjustada: null,
  cantidadRealEntregada: 5,
  cantidadDisponible: 35,
  vencido: false,
};

describe("EntregaMedicamentosScreen", () => {
  beforeEach(() => {
    mockEstadoEntrega.cargando = false;
    mockEstadoEntrega.error = null;
    mockEstadoEntrega.receta = null;
    mockEstadoEntrega.detalles = [];
    mockSesion.rol = "medico";
    useEntregaMedicamentos.mockClear();
    mockEstadoEntrega.recargar.mockClear();
    mockEstadoEntrega.ajustarEntrega.mockClear();
    mockEstadoEntrega.ajustarEntrega.mockResolvedValue(undefined);
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

  it("un renglon ya ajustado muestra el indicador de ajuste (issue #764)", () => {
    mockEstadoEntrega.detalles = [
      { ...DETALLE_DE_EJEMPLO, cantidadAjustada: 7, cantidadRealEntregada: 7 },
    ];
    pantalla();

    expect(screen.getByText("Entregado: 7 · Disponible: 35 · Ajustado")).toBeTruthy();
  });

  it("medico o administracion ven el boton Ajustar y pueden corregir la cantidad (issue #764)", async () => {
    mockEstadoEntrega.detalles = [DETALLE_DE_EJEMPLO];
    pantalla();

    fireEvent.press(screen.getByText("Ajustar"));
    fireEvent.changeText(screen.getByDisplayValue("5"), "7");
    await fireEvent.press(screen.getByText("Guardar ajuste"));

    expect(mockEstadoEntrega.ajustarEntrega).toHaveBeenCalledWith("d-1", 7);
  });

  it("voluntario ve la receta pero no el boton Ajustar: fn_ajustar_entrega_receta lo rechaza (00128)", () => {
    mockSesion.rol = "voluntario general";
    mockEstadoEntrega.detalles = [DETALLE_DE_EJEMPLO];
    pantalla();

    expect(screen.queryByText("Ajustar")).toBeNull();
  });

  it("un renglon sin lote ni bodega no ofrece Ajustar, aunque el rol pueda: no hay movimiento que corregir", () => {
    mockEstadoEntrega.detalles = [{ ...DETALLE_DE_EJEMPLO, loteId: null, bodegaId: null }];
    pantalla();

    expect(screen.queryByText("Ajustar")).toBeNull();
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
