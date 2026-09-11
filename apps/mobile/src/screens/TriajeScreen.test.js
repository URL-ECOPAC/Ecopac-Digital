// Prueba de TriajeScreen (Modulo I: triaje, issue #776).

import { fireEvent, render, screen } from "@testing-library/react-native";

import { CAMPOS_TRIAJE } from "@ecopac/shared";

import TriajeScreen from "./TriajeScreen";

const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { pacienteId: "p-1" } }),
}));

const mockSesion = { perfil: { id: "perfil-1" }, rol: "voluntario general" };
jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

jest.mock("../contexto/JornadaActivaProvider", () => ({
  useJornadaActivaCompartida: () => ({
    jornadaId: "jor-1",
    jornada: { estado: "en curso", nombre: "Jornada Vista Hermosa" },
  }),
}));

const mockRegistro = { registrar: jest.fn(), desregistrar: jest.fn() };
jest.mock("../contexto/RegistroSinGuardarProvider", () => ({
  useRegistroSinGuardar: () => mockRegistro,
}));

const mockEstadoTriaje = {
  campos: CAMPOS_TRIAJE,
  valores: {},
  errores: {},
  advertencias: {},
  error: null,
  enviando: false,
  guardado: null,
  imc: null,
  permitido: true,
  hayCambios: false,
  setCampo: jest.fn(),
  reiniciar: jest.fn(),
  guardar: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  usePaciente: jest.fn(() => ({
    paciente: { nombres: "Ana", apellidos: "Perez", fechaNacimiento: "1990-01-01" },
    cargando: false,
  })),
  useRegistroTriaje: jest.fn(() => mockEstadoTriaje),
}));

const { useRegistroTriaje } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<TriajeScreen />);
}

describe("TriajeScreen", () => {
  beforeEach(() => {
    mockEstadoTriaje.valores = {};
    mockEstadoTriaje.errores = {};
    mockEstadoTriaje.advertencias = {};
    mockEstadoTriaje.error = null;
    mockEstadoTriaje.guardado = null;
    mockEstadoTriaje.imc = null;
    mockEstadoTriaje.permitido = true;
    useRegistroTriaje.mockClear();
    mockEstadoTriaje.guardar.mockClear();
    mockEstadoTriaje.setCampo.mockClear();
    mockGoBack.mockClear();
  });

  it("un rol sin permiso de triaje ve el mensaje de permisos, no el formulario", () => {
    mockEstadoTriaje.permitido = false;
    pantalla();

    expect(screen.getByText("Tu rol no puede tomar signos vitales.")).toBeTruthy();
  });

  it("pinta el nombre del paciente y los campos de signos vitales", () => {
    pantalla();

    expect(screen.getByText("Ana Perez")).toBeTruthy();
    // Con un asterisco si el campo es requerido (TriajeScreen.js), por eso el texto exacto no es
    // fijo: se busca por el prefijo de la etiqueta.
    expect(screen.getByText(/^Presion sistolica/)).toBeTruthy();
  });

  it("Guardar y pasar a la cola dispara guardar()", () => {
    pantalla();

    fireEvent.press(screen.getByText("Guardar y pasar a la cola"));

    expect(mockEstadoTriaje.guardar).toHaveBeenCalled();
  });

  it("una advertencia de un campo se muestra sin bloquear el formulario", () => {
    mockEstadoTriaje.advertencias = { peso: "El peso esta fuera del rango esperado." };
    pantalla();

    expect(screen.getByText("El peso esta fuera del rango esperado.")).toBeTruthy();
  });

  it("tras guardar con exito, muestra la confirmacion en vez del formulario", () => {
    mockEstadoTriaje.guardado = { id: "t-1" };
    mockEstadoTriaje.imc = 22.5;
    pantalla();

    expect(screen.getByText("Signos registrados")).toBeTruthy();
    expect(screen.getByText("IMC: 22.5")).toBeTruthy();

    fireEvent.press(screen.getByText("Volver a la ficha"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  // Camino de error (issue #759/#776): si guardar() falla, el formulario tiene que mostrar el
  // error y seguir mostrando los campos para corregir -- no perder lo que el usuario escribio.
  it("camino de error: si la consulta falla, muestra el error y no la confirmacion", () => {
    mockEstadoTriaje.error = { mensaje: "No se pudo registrar el triaje." };
    pantalla();

    expect(screen.getByText("No se pudo registrar el triaje.")).toBeTruthy();
    expect(screen.queryByText("Signos registrados")).toBeNull();
    // El formulario sigue disponible para reintentar.
    expect(screen.getByText("Guardar y pasar a la cola")).toBeTruthy();
  });
});
