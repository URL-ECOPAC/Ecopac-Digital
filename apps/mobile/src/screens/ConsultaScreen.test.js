// Prueba de ConsultaScreen: la consulta como unidad (issue #840, bloque F). Espejo de
// apps/web/src/pages/ModalConsulta.test.jsx.
//
// Dentro de la consulta van los signos (opcionales), la consulta y la receta (opcional). No hay
// una pantalla de triaje aparte: TriajeScreen se retiro con esta issue.

import { fireEvent, render, screen } from "@testing-library/react-native";

import { CAMPOS_TRIAJE, NIVELES_DE_AVISO, seccionesConCampos } from "@ecopac/shared";

import ConsultaScreen from "./ConsultaScreen";

const mockNavigate = jest.fn();
let mockParams = { pacienteId: "p-1" };
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
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

jest.mock("../contexto/RegistroSinGuardarProvider", () => ({
  useRegistroSinGuardar: () => ({ registrar: jest.fn(), desregistrar: jest.fn() }),
}));

function estado(cambios = {}) {
  return {
    visita: null,
    esNueva: true,
    jornadaId: "jor-1",
    bloqueo: { puede: true, motivo: null },
    permisos: { signos: true, consulta: true, receta: true },
    camposDeSignos: CAMPOS_TRIAJE,
    signos: Object.fromEntries(CAMPOS_TRIAJE.map((campo) => [campo.id, ""])),
    setSigno: jest.fn(),
    avisos: {},
    imc: null,
    signosTomadosPor: null,
    seccionesDeConsulta: seccionesConCampos(),
    consulta: { motivoConsulta: "", diagnosticos: [] },
    setCampoDeConsulta: jest.fn(),
    catalogos: { diagnosticos: [] },
    crearDiagnosticoNuevo: null,
    errorDiagnostico: null,
    errores: { signos: {}, consulta: {} },
    error: null,
    enviando: false,
    guardadaAlMenosUnaVez: false,
    guardar: jest.fn(),
    descartarBorrador: jest.fn(),
    hayCambios: true,
    receta: { existentes: [], consultaId: null, puedeAgregar: false },
    ...cambios,
  };
}

let mockEstado = estado();

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  usePaciente: jest.fn(() => ({
    paciente: { id: "p-1", nombres: "Ana", apellidos: "Perez", expediente: { id: "exp-1" } },
    cargando: false,
  })),
  useConsulta: jest.fn(() => mockEstado),
}));

const { useConsulta } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<ConsultaScreen />);
}

describe("ConsultaScreen", () => {
  beforeEach(() => {
    mockEstado = estado();
    mockParams = { pacienteId: "p-1" };
    useConsulta.mockClear();
    mockNavigate.mockClear();
  });

  it("dentro de la consulta van los signos, la consulta y la receta", () => {
    pantalla();

    expect(screen.getByText("Ana Perez")).toBeTruthy();
    expect(screen.getByText("Signos vitales")).toBeTruthy();
    expect(screen.getByText("Consulta")).toBeTruthy();
    expect(screen.getByText("Receta")).toBeTruthy();
  });

  it("una consulta nueva va en la jornada activa; abrir una del historial, en la suya", () => {
    pantalla();
    expect(useConsulta).toHaveBeenLastCalledWith(expect.objectContaining({ jornadaId: "jor-1" }));

    mockParams = { pacienteId: "p-1", jornadaId: "jor-vieja" };
    pantalla();
    expect(useConsulta).toHaveBeenLastCalledWith(
      expect.objectContaining({ jornadaId: "jor-vieja", estadoDeJornada: undefined }),
    );
  });

  // G2: una sola capa por campo.
  it("un signo imposible se muestra como error y una alarma como aviso, nunca los dos", () => {
    mockEstado = estado({
      avisos: {
        presionSistolica: { nivel: NIVELES_DE_AVISO.IMPOSIBLE, mensaje: "Fuera de lo posible." },
        frecuenciaCardiaca: { nivel: NIVELES_DE_AVISO.ALARMA, mensaje: "Valor de alarma." },
      },
    });
    pantalla();

    expect(screen.getAllByText("Fuera de lo posible.")).toHaveLength(1);
    expect(screen.getByText("Valor de alarma.")).toBeTruthy();
  });

  it("Guardar consulta dispara guardar()", () => {
    pantalla();
    fireEvent.press(screen.getByText("Guardar consulta"));
    expect(mockEstado.guardar).toHaveBeenCalled();
  });

  it("Descartar borrador existe solo para una consulta nueva", () => {
    pantalla();
    fireEvent.press(screen.getByText("Descartar borrador"));
    expect(mockEstado.descartarBorrador).toHaveBeenCalled();
  });

  it("con la consulta guardada, la receta abre su flujo sobre esa consulta", () => {
    mockEstado = estado({
      hayCambios: false,
      receta: { existentes: [], consultaId: "con-1", puedeAgregar: true },
    });
    pantalla();

    fireEvent.press(screen.getByText("Agregar receta"));
    expect(mockNavigate).toHaveBeenCalledWith("Receta", { pacienteId: "p-1", consultaId: "con-1" });
  });

  it("camino de error: muestra el error de guardar", () => {
    mockEstado = estado({ error: { mensaje: "No se pudo guardar la consulta." } });
    pantalla();

    expect(screen.getByText("No se pudo guardar la consulta.")).toBeTruthy();
  });
});
