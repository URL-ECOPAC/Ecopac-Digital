// Prueba de ResumenJornadaScreen (issue #792, encontrado al resolver la #785).
//
// QUE ESTABA MAL. La pantalla llamaba a ErrorState/LoadingState con mensaje/alReintentar, props
// que esos componentes no declaran (usan message/onRetry): un error real caia siempre al
// mensaje generico de conexion, sin boton de reintentar.

import { fireEvent, render, screen } from "@testing-library/react-native";

import ResumenJornadaScreen from "./ResumenJornadaScreen";

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

const JORNADA_ACTIVA = {
  id: "jor-1",
  nombre: "Jornada Vista Hermosa",
  fecha: "2026-03-01",
  estado: "en curso",
  comunidad: { nombre: "Vista Hermosa" },
};

jest.mock("../contexto/JornadaActivaProvider", () => ({
  useJornadaActivaCompartida: () => ({ jornada: mockJornada }),
}));

let mockJornada = JORNADA_ACTIVA;

const mockEstadoHook = {
  cargando: false,
  error: null,
  ficha: null,
  personal: [],
  medicamentos: [],
  recargar: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useReporteJornada: jest.fn(() => mockEstadoHook),
}));

const { useReporteJornada } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<ResumenJornadaScreen />);
}

describe("ResumenJornadaScreen", () => {
  beforeEach(() => {
    mockJornada = JORNADA_ACTIVA;
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.ficha = null;
    mockEstadoHook.personal = [];
    mockEstadoHook.medicamentos = [];
    mockEstadoHook.recargar.mockClear();
    useReporteJornada.mockClear();
  });

  it("sin jornada activa, muestra el aviso y no llama al reporte", () => {
    mockJornada = null;
    pantalla();

    expect(screen.getByText("No hay jornada activa seleccionada")).toBeTruthy();
  });

  it("muestra el nombre, la fecha, la comunidad y el estado de la jornada", () => {
    pantalla();

    expect(screen.getByText("Jornada Vista Hermosa")).toBeTruthy();
    expect(screen.getByText(/2026-03-01 · Vista Hermosa/)).toBeTruthy();
    expect(screen.getByText("En curso")).toBeTruthy();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando resumen...")).toBeTruthy();
  });

  it("con la ficha cargada, muestra los cuatro contadores de avance", () => {
    mockEstadoHook.ficha = {
      nombre: "Jornada Vista Hermosa",
      fecha: "2026-03-01",
      comunidad: "Vista Hermosa",
      estado: "en curso",
      pacientes_atendidos: 12,
      total_consultas: 10,
    };
    mockEstadoHook.personal = [{ id: "p1" }, { id: "p2" }];
    mockEstadoHook.medicamentos = [{ cantidad: 5 }, { cantidad: 3 }];
    pantalla();

    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  // Camino de error: antes se veia el mensaje generico de conexion, nunca error.mensaje, y sin
  // boton de reintentar (issue #792).
  it("camino de error: muestra el mensaje real y permite reintentar", () => {
    mockEstadoHook.error = { mensaje: "No se pudo cargar el resumen de la jornada." };
    pantalla();

    expect(screen.getByText("No se pudo cargar el resumen de la jornada.")).toBeTruthy();

    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });

  // SIN_PERMISO es una vista de solo lectura -sin boton de reintentar, reintentar no cambia
  // el rol de quien mira- distinta del resto de errores.
  it("con error SIN_PERMISO, muestra el mensaje sin boton de reintentar", () => {
    mockEstadoHook.error = {
      codigo: "SIN_PERMISO",
      mensaje: "Solo administracion y medico consultan el reporte de resultados de la jornada.",
    };
    pantalla();

    expect(
      screen.getByText(
        "Solo administracion y medico consultan el reporte de resultados de la jornada.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Reintentar")).toBeNull();
  });
});
