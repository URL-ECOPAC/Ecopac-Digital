// Prueba de HistorialPacienteScreen (Modulo I: historial, issue #776).

import { fireEvent, render, screen } from "@testing-library/react-native";

import HistorialPacienteScreen from "./HistorialPacienteScreen";

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: { pacienteId: "p-1" } }),
}));

const mockSesion = { rol: "medico" };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

const mockEstadoHook = {
  grupos: [],
  total: 0,
  hayMas: false,
  verMas: jest.fn(),
  cargando: false,
  error: null,
  recargar: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useHistorialPaciente: jest.fn(() => mockEstadoHook),
}));

const { useHistorialPaciente } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<HistorialPacienteScreen />);
}

const GRUPO_DE_EJEMPLO = {
  clave: "g-1",
  jornada: "Jornada enero",
  comunidad: "Santa Cruz",
  fecha: "2026-01-10",
  eventos: [
    {
      id: "e-1",
      tipo: "consulta",
      profesional: "Dr. Perez",
      diagnosticoPrincipal: { nombre: "Faringitis aguda" },
      diagnosticos: [{ codigo: "J02", nombre: "Faringitis aguda" }],
      motivoConsulta: "Dolor de garganta",
    },
  ],
};

describe("HistorialPacienteScreen", () => {
  beforeEach(() => {
    mockSesion.rol = "medico";
    mockEstadoHook.grupos = [];
    mockEstadoHook.total = 0;
    mockEstadoHook.hayMas = false;
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    useHistorialPaciente.mockClear();
    mockEstadoHook.recargar.mockClear();
    mockEstadoHook.verMas.mockClear();
  });

  it("un rol sin permiso de historial clinico ve el error de permisos, no la pantalla", () => {
    mockSesion.rol = "voluntario general";
    pantalla();

    expect(screen.getByText("Tu rol no puede ver el historial clinico.")).toBeTruthy();
  });

  it("mientras carga (sin datos previos), muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeTruthy();
  });

  it("sin atenciones, muestra el vacio", () => {
    pantalla();

    expect(screen.getByText("Este paciente no tiene atenciones anteriores.")).toBeTruthy();
  });

  it("con datos, pinta la atencion con su diagnostico principal", () => {
    mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
    mockEstadoHook.total = 1;
    pantalla();

    expect(screen.getByText("Faringitis aguda")).toBeTruthy();
  });

  it("tocar la atencion expande el detalle de la consulta", () => {
    mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
    mockEstadoHook.total = 1;
    pantalla();

    fireEvent.press(screen.getByText("Ver"));

    expect(screen.getByText("Motivo: Dolor de garganta")).toBeTruthy();
  });

  it("Ver atenciones anteriores dispara verMas()", () => {
    mockEstadoHook.grupos = [GRUPO_DE_EJEMPLO];
    mockEstadoHook.total = 1;
    mockEstadoHook.hayMas = true;
    pantalla();

    fireEvent.press(screen.getByText("Ver atenciones anteriores"));

    expect(mockEstadoHook.verMas).toHaveBeenCalled();
  });

  // Camino de error (issue #759/#776): si la consulta del historial falla, la pantalla tiene que
  // mostrar el error, no una lista vacia (que se veria igual que "sin atenciones registradas").
  it("camino de error: si la consulta falla, muestra el error y no el vacio", () => {
    mockEstadoHook.error = { mensaje: "No se pudo cargar el historial." };
    pantalla();

    expect(screen.getByText("No se pudo cargar el historial.")).toBeTruthy();
    expect(screen.queryByText("Este paciente no tiene atenciones anteriores.")).toBeNull();

    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });
});
