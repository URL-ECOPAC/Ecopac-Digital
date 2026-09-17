// Prueba de la ficha del paciente en movil (issue #834).
//
// Lo que fija: que la pantalla PIDE el paciente completo con usePaciente() en vez de conformarse
// con la fila del listado de busqueda, y que pinta los datos que esa fila no trae -- DPI, idioma,
// telefono, responsable --, que era justo lo que faltaba.

import { render, screen } from "@testing-library/react-native";

import FichaPacienteScreen from "./FichaPacienteScreen";

const estado = { paciente: null, cargando: false, error: null };
const mockUsePaciente = jest.fn(() => ({ ...estado, recargar: jest.fn() }));

jest.mock("@ecopac/shared", () => {
  const real = jest.requireActual("@ecopac/shared");
  return {
    ...real,
    usePaciente: (...argumentos) => mockUsePaciente(...argumentos),
    useCondicionesPaciente: () => ({
      condiciones: [],
      cargando: false,
      error: null,
      recargar: jest.fn(),
    }),
    useEvolucionSignos: () => ({ signos: [], cargando: false, error: null, recargar: jest.fn() }),
    useRecetasPaciente: () => ({ recetas: [], cargando: false, error: null, recargar: jest.fn() }),
  };
});

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { rol: "medico" } }),
}));

const PACIENTE_COMPLETO = {
  id: "paciente-123",
  nombres: "Juana",
  apellidos: "Inventada",
  fechaNacimiento: "1990-05-10",
  sexo: "Femenino",
  dpi: "1234567890101",
  tipoSangre: "O+",
  telefonoContacto: "55551234",
  nombreResponsable: "Persona Inventada",
  parentescoResponsable: "Madre",
  catalogoIdioma: { nombre: "Español" },
  comunidad: { nombre: "Comunidad Inventada", municipio: { nombre: "Municipio Inventado" } },
  expediente: { numeroFicha: "000123" },
  condicionesCronicas: [],
};

const navegacion = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  estado.paciente = PACIENTE_COMPLETO;
  estado.cargando = false;
  estado.error = null;
});

describe("FichaPacienteScreen", () => {
  it("pide el paciente completo por id, no se conforma con la fila del listado", () => {
    render(
      <FichaPacienteScreen
        route={{ params: { paciente: { id: "paciente-123", nombres: "Juana" } } }}
        navigation={navegacion}
      />,
    );

    expect(mockUsePaciente).toHaveBeenCalledWith("paciente-123", { rol: "medico" });
  });

  it("muestra los datos que la fila del listado no trae", () => {
    render(
      <FichaPacienteScreen
        route={{ params: { pacienteId: "paciente-123" } }}
        navigation={navegacion}
      />,
    );

    expect(screen.getByText("Juana Inventada")).toBeTruthy();
    expect(screen.getByText("Expediente 000123")).toBeTruthy();
    expect(screen.getByText("DPI: 1234567890101")).toBeTruthy();
    // La pestana de datos generales arranca abierta y lleva el resto del expediente.
    expect(screen.getByText("Español")).toBeTruthy();
    expect(screen.getByText("Persona Inventada")).toBeTruthy();
    expect(screen.getByText("Madre")).toBeTruthy();
  });

  it("sin id no inventa una ficha vacia", () => {
    render(<FichaPacienteScreen route={{}} navigation={navegacion} />);

    expect(screen.getByText("No se indicó de qué paciente es esta ficha.")).toBeTruthy();
  });

  it("mientras carga no pinta una ficha a medias", () => {
    estado.paciente = null;
    estado.cargando = true;

    render(
      <FichaPacienteScreen
        route={{ params: { pacienteId: "paciente-123" } }}
        navigation={navegacion}
      />,
    );

    expect(screen.getByText("Cargando la ficha del paciente...")).toBeTruthy();
  });
});
