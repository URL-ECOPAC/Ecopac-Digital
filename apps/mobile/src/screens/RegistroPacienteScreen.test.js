// Prueba de RegistroPacienteScreen (Modulo I: registrar paciente, issue #776).

import { fireEvent, render, screen } from "@testing-library/react-native";

import RegistroPacienteScreen from "./RegistroPacienteScreen";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: {} }),
}));

jest.mock("../contexto/JornadaActivaProvider", () => ({
  useJornadaActivaCompartida: () => ({ jornada: { comunidadId: "com-1" } }),
}));

const mockEstadoHook = {
  valores: {},
  errores: {},
  error: null,
  enviando: false,
  edad: null,
  advertenciaDuplicado: null,
  registrado: null,
  departamentoId: null,
  municipioId: null,
  setCampo: jest.fn(),
  setDepartamento: jest.fn(),
  setMunicipio: jest.fn(),
  registrar: jest.fn(async () => ({ ok: true })),
  reiniciar: jest.fn(),
  catalogos: { departamentos: [], municipios: [], comunidades: [], idiomas: [], sexo: [] },
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useRegistroPaciente: jest.fn(() => mockEstadoHook),
}));

const { useRegistroPaciente } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<RegistroPacienteScreen />);
}

describe("RegistroPacienteScreen", () => {
  beforeEach(() => {
    mockEstadoHook.valores = {};
    mockEstadoHook.errores = {};
    mockEstadoHook.error = null;
    mockEstadoHook.advertenciaDuplicado = null;
    mockEstadoHook.registrado = null;
    mockEstadoHook.enviando = false;
    mockEstadoHook.registrar = jest.fn(async () => ({ ok: true }));
    useRegistroPaciente.mockClear();
    mockNavigate.mockClear();
    mockEstadoHook.setCampo.mockClear();
    mockEstadoHook.reiniciar.mockClear();
  });

  it("empieza en el primer paso (Identidad)", () => {
    pantalla();

    expect(screen.getByText(/Identidad · paso 1 de 4/)).toBeTruthy();
    expect(screen.getByText("Nombres")).toBeTruthy();
  });

  it("Siguiente avanza al segundo paso sin llamar a registrar()", () => {
    pantalla();

    fireEvent.press(screen.getByText("Siguiente"));

    expect(screen.getByText(/Ubicacion y contacto · paso 2 de 4/)).toBeTruthy();
    expect(mockEstadoHook.registrar).not.toHaveBeenCalled();
  });

  it("Atras no aparece en el primer paso, pero si a partir del segundo", () => {
    pantalla();

    expect(screen.queryByText("Atras")).toBeNull();

    fireEvent.press(screen.getByText("Siguiente"));

    expect(screen.getByText("Atras")).toBeTruthy();
  });

  it("en el ultimo paso, el boton dice Registrar paciente y llama a registrar()", () => {
    pantalla();

    fireEvent.press(screen.getByText("Siguiente"));
    fireEvent.press(screen.getByText("Siguiente"));
    fireEvent.press(screen.getByText("Siguiente"));

    expect(screen.getByText(/Persona responsable · paso 4 de 4/)).toBeTruthy();

    fireEvent.press(screen.getByText("Registrar paciente"));

    expect(mockEstadoHook.registrar).toHaveBeenCalled();
  });

  // Camino de error (issue #759/#776): si registrar() falla, la pantalla tiene que mostrar el
  // error y, ademas, volver al paso donde esta el campo que fallo -- no quedarse en el ultimo
  // paso mostrando un error sin contexto de que campo corregir.
  it("camino de error: si la consulta falla, muestra el error y vuelve al paso con el campo invalido", async () => {
    mockEstadoHook.error = { mensaje: "No se pudo registrar el paciente." };
    mockEstadoHook.errores = { comunidad: "Selecciona una comunidad." };
    mockEstadoHook.registrar = jest.fn(async () => ({ ok: false }));
    pantalla();

    fireEvent.press(screen.getByText("Siguiente"));
    fireEvent.press(screen.getByText("Siguiente"));
    fireEvent.press(screen.getByText("Siguiente"));
    fireEvent.press(screen.getByText("Registrar paciente"));

    expect(mockEstadoHook.registrar).toHaveBeenCalled();
    expect(screen.getByText("No se pudo registrar el paciente.")).toBeTruthy();
    // comunidad esta en el paso "ubicacion" (paso 2): guardar() tiene que haber saltado ahi.
    // findByText espera a que se resuelva el registrar() async antes de mirar el paso: el cambio
    // de indice ocurre en el .then(), no en el mismo tick que el press().
    expect(await screen.findByText(/Ubicacion y contacto · paso 2 de 4/)).toBeTruthy();
  });

  it("una advertencia de posible duplicado se muestra sin bloquear el formulario", () => {
    mockEstadoHook.advertenciaDuplicado = "Ya existe un paciente con datos parecidos.";
    pantalla();

    expect(screen.getByText("Ya existe un paciente con datos parecidos.")).toBeTruthy();
  });

  it("tras registrar con exito, muestra el numero de ficha y permite ir a la ficha del paciente", () => {
    mockEstadoHook.registrado = {
      id: "p-1",
      nombres: "Ana",
      apellidos: "Perez",
      expediente: { numeroFicha: "0001-2026" },
    };
    pantalla();

    expect(screen.getByText("0001-2026")).toBeTruthy();

    fireEvent.press(screen.getByText("Ir a la ficha del paciente"));

    expect(mockNavigate).toHaveBeenCalledWith("FichaPaciente", { pacienteId: "p-1" });
  });
});
