// Prueba de JornadaEnCursoScreen (Modulo III: mover la cola de la jornada, issue #778).
//
// ResumenJornadaScreen (reportes, otro modulo) se reemplaza por un doble: esta prueba cubre el
// panel de la jornada en curso, no el resumen de reportes que monta adentro.

import { fireEvent, render, screen } from "@testing-library/react-native";

import JornadaEnCursoScreen from "./JornadaEnCursoScreen";

jest.mock("./ResumenJornadaScreen", () => () => null);

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback) => callback(),
}));

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "medico" }),
}));

const mockRecargarCola = jest.fn();
const mockEstadoJornadaActiva = {
  jornadaId: "jor-1",
  jornada: { nombre: "Jornada Vista Hermosa" },
  cola: {
    "espera triaje": [],
    "espera consulta": [],
    "espera entrega": [],
    "lista para cerrar": [],
  },
  totalEnCola: 0,
  puedeRegistrar: true,
  motivoBloqueo: null,
  cargando: false,
  cargandoCola: false,
  error: null,
  recargar: mockRecargarCola,
};

jest.mock("../contexto/JornadaActivaProvider", () => ({
  useJornadaActivaCompartida: () => mockEstadoJornadaActiva,
}));

const mockCerrar = jest.fn(async () => ({ ok: true }));
const mockEstadoPanel = {
  pacientesRegistrados: 0,
  consultasRealizadas: 0,
  tratamientosEntregados: 0,
  puedeCerrar: true,
  error: null,
  recargar: jest.fn(),
  cerrar: mockCerrar,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  usePanelJornada: jest.fn(() => mockEstadoPanel),
}));

const { usePanelJornada } = jest.requireMock("@ecopac/shared");

const PACIENTE_EN_TRIAJE = {
  atencionId: "at-1",
  pacienteId: "p-1",
  nombres: "Ana",
  apellidos: "Perez",
  esperandoDesde: new Date().toISOString(),
};

function pantalla() {
  return render(<JornadaEnCursoScreen />);
}

describe("JornadaEnCursoScreen", () => {
  beforeEach(() => {
    mockEstadoJornadaActiva.jornadaId = "jor-1";
    mockEstadoJornadaActiva.cargando = false;
    mockEstadoJornadaActiva.error = null;
    mockEstadoJornadaActiva.totalEnCola = 0;
    mockEstadoJornadaActiva.cola = {
      "espera triaje": [],
      "espera consulta": [],
      "espera entrega": [],
      "lista para cerrar": [],
    };
    mockEstadoPanel.error = null;
    mockEstadoPanel.pacientesRegistrados = 0;
    usePanelJornada.mockClear();
    mockCerrar.mockClear();
    mockRecargarCola.mockClear();
    mockNavigate.mockClear();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoJornadaActiva.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeTruthy();
  });

  it("sin jornada activa, muestra el aviso de elegir una en Jornadas", () => {
    mockEstadoJornadaActiva.jornadaId = null;
    pantalla();

    expect(
      screen.getByText("No hay una jornada activa. Elegila en la pantalla de Jornadas."),
    ).toBeTruthy();
  });

  it("con la cola vacia, muestra el mensaje de que no hay pacientes", () => {
    pantalla();

    expect(screen.getByText("No hay pacientes en la cola de esta jornada.")).toBeTruthy();
  });

  it("un paciente en espera de triaje aparece en su grupo, y tocarlo navega a Triaje", () => {
    mockEstadoJornadaActiva.totalEnCola = 1;
    mockEstadoJornadaActiva.cola = {
      ...mockEstadoJornadaActiva.cola,
      "espera triaje": [PACIENTE_EN_TRIAJE],
    };
    pantalla();

    expect(screen.getByText("Espera triaje (1)")).toBeTruthy();
    fireEvent.press(screen.getByText("Ana Perez"));

    expect(mockNavigate).toHaveBeenCalledWith("Pacientes", {
      screen: "Triaje",
      params: { pacienteId: "p-1" },
    });
  });

  it("una fila lista para cerrar, con permiso, dispara cerrar()", () => {
    mockEstadoJornadaActiva.totalEnCola = 1;
    mockEstadoJornadaActiva.cola = {
      ...mockEstadoJornadaActiva.cola,
      "lista para cerrar": [PACIENTE_EN_TRIAJE],
    };
    pantalla();

    fireEvent.press(screen.getByText("Ana Perez"));

    expect(mockCerrar).toHaveBeenCalledWith("at-1", "Entrega completada");
  });

  it("sin permiso de registrar (motivoBloqueo), el boton de registrar paciente esta deshabilitado y el aviso se muestra", () => {
    mockEstadoJornadaActiva.puedeRegistrar = false;
    mockEstadoJornadaActiva.motivoBloqueo = "No estas asignado a esta jornada.";
    pantalla();

    expect(screen.getByText("No estas asignado a esta jornada.")).toBeTruthy();
    const boton = screen.getByRole("button", { name: "Registrar paciente" });
    expect(boton.props.accessibilityState.disabled).toBe(true);
    mockEstadoJornadaActiva.puedeRegistrar = true;
    mockEstadoJornadaActiva.motivoBloqueo = null;
  });

  // Camino de error (issue #759/#778): si la cola o el panel fallan, la pantalla tiene que
  // mostrar el error, no una cola vacia en silencio.
  it("camino de error: si la cola falla, muestra el error con boton de reintentar", () => {
    mockEstadoJornadaActiva.error = { mensaje: "No se pudo cargar la cola de la jornada." };
    pantalla();

    expect(screen.getByText("No se pudo cargar la cola de la jornada.")).toBeTruthy();

    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockRecargarCola).toHaveBeenCalled();
  });
});
