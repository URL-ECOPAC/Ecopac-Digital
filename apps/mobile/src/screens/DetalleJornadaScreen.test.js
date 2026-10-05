// Prueba de DetalleJornadaScreen (issue #925): version acotada (Resumen/Insumos/Consumo) de
// apps/web/src/pages/DetalleJornadaPage.jsx. Llega desde KanbanJornadasScreen.js, que antes
// navegaba a una ruta "DetalleJornada" que no existia en ningun lado del stack movil.

import { fireEvent, render, screen } from "@testing-library/react-native";

import DetalleJornadaScreen from "./DetalleJornadaScreen";

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: { jornadaId: "jor-1" } }),
}));

const mockSesion = { rol: "administrador" };
jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

jest.mock("./InsumosDeJornada", () => () => {
  const { Text } = require("react-native");
  return <Text>contenido de Insumos</Text>;
});
jest.mock("./ConsumoDeJornada", () => () => {
  const { Text } = require("react-native");
  return <Text>contenido de Consumo</Text>;
});

const mockRecargar = jest.fn();
const mockEstadoDetalle = {
  jornada: null,
  cargando: false,
  error: null,
  recargar: mockRecargar,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useDetalleJornada: jest.fn(() => mockEstadoDetalle),
}));

const { useDetalleJornada } = jest.requireMock("@ecopac/shared");

const JORNADA_DE_EJEMPLO = {
  id: "jor-1",
  nombre: "Jornada Vista Hermosa",
  estado: "en curso",
  proyecto: { nombre: "Salud Rural 2026", estado: "en curso" },
  botiquinBodegaId: "bod-1",
  botiquinBodega: { nombre: "Bodega Móvil 1", esPrincipal: false },
};

function pantalla() {
  return render(<DetalleJornadaScreen />);
}

describe("DetalleJornadaScreen", () => {
  beforeEach(() => {
    mockSesion.rol = "administrador";
    mockEstadoDetalle.jornada = null;
    mockEstadoDetalle.cargando = false;
    mockEstadoDetalle.error = null;
    useDetalleJornada.mockClear();
    mockRecargar.mockClear();
  });

  it("pide el detalle con el jornadaId de los parametros de ruta", () => {
    pantalla();
    expect(useDetalleJornada).toHaveBeenCalledWith({ jornadaId: "jor-1", rol: "administrador" });
  });

  it("mientras carga sin jornada previa, muestra el estado de carga", () => {
    mockEstadoDetalle.cargando = true;
    pantalla();
    expect(screen.getByText("Cargando la jornada...")).toBeTruthy();
  });

  it("camino de error sin jornada: muestra el error con boton de reintentar", () => {
    mockEstadoDetalle.error = { mensaje: "No se pudo cargar." };
    pantalla();

    expect(screen.getByText("No se pudo cargar.")).toBeTruthy();
    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockRecargar).toHaveBeenCalled();
  });

  it("sin jornada y sin error, dice que no se encontro", () => {
    pantalla();
    expect(screen.getByText("No se encontró la jornada.")).toBeTruthy();
  });

  it("muestra el nombre y el proyecto de la jornada (issue #925)", () => {
    mockEstadoDetalle.jornada = JORNADA_DE_EJEMPLO;
    pantalla();

    expect(screen.getByText("Jornada Vista Hermosa")).toBeTruthy();
    expect(screen.getByText("Proyecto: Salud Rural 2026")).toBeTruthy();
  });

  it("administracion ve las tres pestañas y puede cambiar a Insumos y Consumo", () => {
    mockEstadoDetalle.jornada = JORNADA_DE_EJEMPLO;
    pantalla();

    expect(screen.getByText("Resumen")).toBeTruthy();
    expect(screen.getByText("Insumos")).toBeTruthy();
    expect(screen.getByText("Consumo")).toBeTruthy();

    fireEvent.press(screen.getByText("Insumos"));
    expect(screen.getByText("contenido de Insumos")).toBeTruthy();

    fireEvent.press(screen.getByText("Consumo"));
    expect(screen.getByText("contenido de Consumo")).toBeTruthy();
  });

  it("un rol sin acceso a insumos de jornada solo ve la pestaña Resumen", () => {
    mockSesion.rol = "voluntario general";
    mockEstadoDetalle.jornada = JORNADA_DE_EJEMPLO;
    pantalla();

    expect(screen.getByText("Resumen")).toBeTruthy();
    expect(screen.queryByText("Insumos")).toBeNull();
    expect(screen.queryByText("Consumo")).toBeNull();
  });
});
