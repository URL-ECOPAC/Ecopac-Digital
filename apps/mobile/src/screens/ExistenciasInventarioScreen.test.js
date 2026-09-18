// Prueba de ExistenciasInventarioScreen (Modulo II: existencias por lote, issues #785 y #838).
//
// Desde la #838 la pantalla no consulta ni calcula: lo hace useExistenciasPorLote()
// (packages/shared/inventario/), que tiene su propia prueba para la suma de existencias y el
// estado de cada lote. Aqui se prueba lo que es de la pantalla: que dibuja la tarjeta compacta,
// que ofrece los filtros, que el vacio distingue "no hay nada" de "nada coincide" y que tocar un
// lote lleva a su detalle.

import { render, screen, fireEvent } from "@testing-library/react-native";

import ExistenciasInventarioScreen from "./ExistenciasInventarioScreen";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockEstado = {
  filas: [],
  total: 0,
  totalSinFiltrar: 0,
  filtros: { busqueda: "", bodega: null, estado: null },
  setFiltro: jest.fn(),
  limpiarFiltros: jest.fn(),
  hayFiltros: false,
  cargando: false,
  error: null,
  recargar: jest.fn(),
  catalogos: { bodegas: [], estadosDeLote: [] },
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useExistenciasPorLote: jest.fn(() => mockEstado),
}));

const FILA_DISPONIBLE = {
  id: "lote-1",
  loteId: "lote-1",
  medicamento: "Loratadina",
  numeroLote: "L-001",
  fechaVencimiento: "2099-01-01",
  cantidadDisponible: 40,
  diasRestantes: 900,
  estado: "disponible",
};

const FILA_AGOTADA = {
  id: "lote-2",
  loteId: "lote-2",
  medicamento: "Amoxicilina",
  numeroLote: "L-002",
  fechaVencimiento: "2099-06-01",
  cantidadDisponible: 0,
  diasRestantes: 1000,
  estado: "agotado",
};

function pantalla() {
  return render(<ExistenciasInventarioScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockEstado, {
    filas: [],
    total: 0,
    totalSinFiltrar: 0,
    hayFiltros: false,
    cargando: false,
    error: null,
  });
});

describe("ExistenciasInventarioScreen", () => {
  it("mientras carga la primera vez, muestra el estado de carga", () => {
    mockEstado.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando existencias...")).toBeTruthy();
  });

  it("dibuja cada lote en una tarjeta con su existencia y su estado", () => {
    Object.assign(mockEstado, {
      filas: [FILA_DISPONIBLE, FILA_AGOTADA],
      total: 2,
      totalSinFiltrar: 2,
    });
    pantalla();

    expect(screen.getByText("Loratadina")).toBeTruthy();
    // La tarjeta compacta escribe el numero de lote una sola vez (antes salia dos veces).
    expect(screen.getAllByText("L-001")).toHaveLength(1);
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("Disponible")).toBeTruthy();

    expect(screen.getByText("Amoxicilina")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("Sin stock")).toBeTruthy();
  });

  it("ofrece los filtros de bodega y de estado (issue #838)", () => {
    Object.assign(mockEstado, { filas: [FILA_DISPONIBLE], total: 1, totalSinFiltrar: 1 });
    pantalla();

    // FilterBar movil es un panel colapsable: hay que abrirlo para ver los controles.
    fireEvent.press(screen.getByText("Filtros"));

    expect(screen.getByText("Bodega")).toBeTruthy();
    expect(screen.getByText("Estado")).toBeTruthy();
  });

  it("sin lotes registrados, muestra el vacio de catalogo", () => {
    pantalla();

    expect(screen.getByText("Todavía no hay lotes registrados.")).toBeTruthy();
  });

  it("con filtros puestos y sin coincidencias, ofrece limpiarlos", () => {
    mockEstado.hayFiltros = true;
    mockEstado.totalSinFiltrar = 5;
    pantalla();

    expect(screen.getByText("Ningún lote coincide con los filtros.")).toBeTruthy();
    fireEvent.press(screen.getByText("Limpiar filtros"));
    expect(mockEstado.limpiarFiltros).toHaveBeenCalled();
  });

  it("tocar un lote navega a su detalle (issue #791)", () => {
    Object.assign(mockEstado, { filas: [FILA_DISPONIBLE], total: 1, totalSinFiltrar: 1 });
    pantalla();

    fireEvent.press(screen.getByText("Loratadina"));

    expect(mockNavigate).toHaveBeenCalledWith("DetalleLote", { loteId: "lote-1" });
  });

  it("camino de error: muestra el error con boton de reintentar", () => {
    mockEstado.error = { mensaje: "No se pudo cargar los lotes." };
    pantalla();

    expect(screen.getByText("No se pudo cargar los lotes.")).toBeTruthy();
    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockEstado.recargar).toHaveBeenCalled();
  });
});
