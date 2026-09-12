// Prueba de ConsultaScreen (Modulo I: consulta, issue #776).

import { fireEvent, render, screen } from "@testing-library/react-native";

import ConsultaScreen from "./ConsultaScreen";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { pacienteId: "p-1" } }),
}));

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { id: "perfil-1" }, rol: "medico" }),
}));

jest.mock("../contexto/JornadaActivaProvider", () => ({
  useJornadaActivaCompartida: () => ({
    jornadaId: "jor-1",
    jornada: { estado: "en curso", nombre: "Jornada Vista Hermosa" },
  }),
}));

const SECCION_DE_EJEMPLO = {
  id: "motivo",
  titulo: "Motivo y antecedentes",
  campos: [{ id: "motivoConsulta", label: "Motivo de consulta", tipo: "texto" }],
};

const mockEstadoConsulta = {
  secciones: [SECCION_DE_EJEMPLO],
  valores: {},
  error: null,
  enviando: false,
  preparando: false,
  guardada: null,
  signos: null,
  bloqueo: { puede: true, motivo: null },
  setCampo: jest.fn(),
  descartarBorrador: jest.fn(),
  guardar: jest.fn(),
  catalogos: { diagnosticos: [] },
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  usePaciente: jest.fn(() => ({
    paciente: { nombres: "Ana", apellidos: "Perez", expediente: { id: "exp-1" } },
    cargando: false,
  })),
  useRegistroConsulta: jest.fn(() => mockEstadoConsulta),
}));

const { useRegistroConsulta } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<ConsultaScreen />);
}

describe("ConsultaScreen", () => {
  beforeEach(() => {
    mockEstadoConsulta.valores = {};
    mockEstadoConsulta.error = null;
    mockEstadoConsulta.preparando = false;
    mockEstadoConsulta.guardada = null;
    mockEstadoConsulta.bloqueo = { puede: true, motivo: null };
    useRegistroConsulta.mockClear();
    mockEstadoConsulta.guardar.mockClear();
    mockEstadoConsulta.descartarBorrador.mockClear();
    mockNavigate.mockClear();
  });

  it("bloqueada (por ejemplo, sin atencion abierta) muestra el motivo, no el formulario", () => {
    mockEstadoConsulta.bloqueo = { puede: false, motivo: "Este paciente no esta en la cola." };
    pantalla();

    expect(screen.getByText("Este paciente no esta en la cola.")).toBeTruthy();
    expect(screen.queryByText("Guardar consulta")).toBeNull();
  });

  it("pinta el nombre del paciente y la seccion de motivo", () => {
    pantalla();

    expect(screen.getByText("Ana Perez")).toBeTruthy();
    expect(screen.getByText("Motivo y antecedentes")).toBeTruthy();
  });

  it("Guardar consulta dispara guardar()", () => {
    pantalla();

    fireEvent.press(screen.getByText("Guardar consulta"));

    expect(mockEstadoConsulta.guardar).toHaveBeenCalled();
  });

  it("Descartar borrador dispara descartarBorrador()", () => {
    pantalla();

    fireEvent.press(screen.getByText("Descartar borrador"));

    expect(mockEstadoConsulta.descartarBorrador).toHaveBeenCalled();
  });

  it("tras guardar, ofrece generar receta o volver a la ficha", () => {
    mockEstadoConsulta.guardada = { id: "consulta-1" };
    pantalla();

    expect(screen.getByText("Consulta registrada")).toBeTruthy();

    fireEvent.press(screen.getByText("Generar receta"));

    expect(mockNavigate).toHaveBeenCalledWith("Receta", {
      pacienteId: "p-1",
      consultaId: "consulta-1",
    });
  });

  // Camino de error (issue #759/#776): si guardar() falla, el formulario se queda visible con el
  // error, no pasa a la pantalla de "Consulta registrada" como si hubiera funcionado.
  it("camino de error: si la consulta falla, muestra el error y no la confirmacion", () => {
    mockEstadoConsulta.error = { mensaje: "No se pudo guardar la consulta." };
    pantalla();

    expect(screen.getByText("No se pudo guardar la consulta.")).toBeTruthy();
    expect(screen.queryByText("Consulta registrada")).toBeNull();
  });
});
