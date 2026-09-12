// Prueba de JornadasAsignadasScreen (Modulo III: jornadas asignadas, issue #778).

import { fireEvent, render, screen } from "@testing-library/react-native";

import JornadasAsignadasScreen from "./JornadasAsignadasScreen";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { id: "perfil-1" } }),
}));

const mockSeleccionarJornada = jest.fn(async () => {});
jest.mock("../contexto/JornadaActivaProvider", () => ({
  useJornadaActivaCompartida: () => ({ seleccionarJornada: mockSeleccionarJornada }),
}));

const JORNADA_EN_CURSO = {
  id: "jor-1",
  nombre: "Jornada Vista Hermosa",
  fecha: "2026-03-01",
  comunidad: { nombre: "Vista Hermosa" },
  estado: "en curso",
};

const JORNADA_PLANIFICADA = {
  id: "jor-2",
  nombre: "Jornada El Rosario",
  fecha: "2026-04-01",
  comunidad: { nombre: "El Rosario" },
  estado: "planificada",
};

const mockEstadoHook = {
  proximas: [],
  pasadas: [],
  cargando: false,
  error: null,
  recargar: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useJornadasAsignadas: jest.fn(() => mockEstadoHook),
}));

const { useJornadasAsignadas } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<JornadasAsignadasScreen />);
}

describe("JornadasAsignadasScreen", () => {
  beforeEach(() => {
    mockEstadoHook.proximas = [];
    mockEstadoHook.pasadas = [];
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    useJornadasAsignadas.mockClear();
    mockSeleccionarJornada.mockClear();
    mockNavigate.mockClear();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeTruthy();
  });

  it("sin jornadas proximas, muestra el vacio correspondiente", () => {
    pantalla();

    expect(screen.getByText("No tenes jornadas proximas asignadas.")).toBeTruthy();
  });

  it("con una jornada planificada, la pinta sin chip de estado (es lo esperado)", () => {
    mockEstadoHook.proximas = [JORNADA_PLANIFICADA];
    pantalla();

    expect(screen.getByText("Jornada El Rosario")).toBeTruthy();
  });

  it("una jornada en curso invita a tocar para ir al panel de trabajo", () => {
    mockEstadoHook.proximas = [JORNADA_EN_CURSO];
    pantalla();

    expect(screen.getByText("Toca para ir al panel de trabajo")).toBeTruthy();
  });

  it("tocar una jornada en curso selecciona la jornada activa y navega al panel", async () => {
    mockEstadoHook.proximas = [JORNADA_EN_CURSO];
    pantalla();

    fireEvent.press(screen.getByText("Jornada Vista Hermosa"));

    expect(mockSeleccionarJornada).toHaveBeenCalledWith("jor-1");
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(mockNavigate).toHaveBeenCalledWith("JornadaEnCurso");
  });

  it("cambiar a la pestaña Pasadas muestra las jornadas pasadas, no las proximas", () => {
    mockEstadoHook.proximas = [JORNADA_EN_CURSO];
    mockEstadoHook.pasadas = [JORNADA_PLANIFICADA];
    pantalla();

    fireEvent.press(screen.getByText("Pasadas"));

    expect(screen.getByText("Jornada El Rosario")).toBeTruthy();
    expect(screen.queryByText("Jornada Vista Hermosa")).toBeNull();
  });

  // Camino de error (issue #759/#778): si la consulta falla, la pantalla tiene que mostrar el
  // error con boton de reintentar, no una lista vacia (que se veria igual que "sin jornadas").
  it("camino de error: si la consulta falla, muestra el error con boton de reintentar", () => {
    mockEstadoHook.error = { mensaje: "No se pudieron cargar tus jornadas." };
    pantalla();

    expect(screen.getByText("No se pudieron cargar tus jornadas.")).toBeTruthy();
    expect(screen.queryByText("No tenes jornadas proximas asignadas.")).toBeNull();

    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });
});
