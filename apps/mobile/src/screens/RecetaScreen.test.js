// Prueba de RecetaScreen (Modulo I: receta, issue #776).

import { fireEvent, render, screen } from "@testing-library/react-native";

import RecetaScreen from "./RecetaScreen";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { pacienteId: "p-1", consultaId: "consulta-1" } }),
}));

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { id: "perfil-1" }, rol: "medico" }),
}));

const MEDICAMENTO_DISPONIBLE = {
  id: "med-1",
  nombre: "Loratadina",
  seleccionable: true,
  cantidadDisponible: 40,
};

const RENGLON_DE_EJEMPLO = {
  clave: "r-1",
  medicamentoId: "med-1",
  medicamento: "Loratadina",
  loteId: null,
  dosis: "1 tableta",
  frecuencia: "cada 12 horas",
  duracion: "5 dias",
  cantidadEntregada: 5,
};

const mockEstadoReceta = {
  busqueda: "",
  setBusqueda: jest.fn(),
  catalogo: [MEDICAMENTO_DISPONIBLE],
  cargandoCatalogo: false,
  lotesPorMedicamento: {},
  renglones: [],
  problemas: {},
  indicacionesGenerales: "",
  setIndicacionesGenerales: jest.fn(),
  error: null,
  enviando: false,
  receta: null,
  agregarMedicamento: jest.fn(),
  editarRenglon: jest.fn(),
  quitarRenglon: jest.fn(),
  guardar: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  usePaciente: jest.fn(() => ({
    paciente: { nombres: "Ana", apellidos: "Perez" },
    cargando: false,
  })),
  useGeneracionReceta: jest.fn(() => mockEstadoReceta),
}));

const { useGeneracionReceta } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<RecetaScreen />);
}

describe("RecetaScreen", () => {
  beforeEach(() => {
    mockEstadoReceta.catalogo = [MEDICAMENTO_DISPONIBLE];
    mockEstadoReceta.renglones = [];
    mockEstadoReceta.problemas = {};
    mockEstadoReceta.error = null;
    mockEstadoReceta.receta = null;
    mockEstadoReceta.cargandoCatalogo = false;
    useGeneracionReceta.mockClear();
    mockEstadoReceta.guardar.mockClear();
    mockEstadoReceta.agregarMedicamento.mockClear();
    mockNavigate.mockClear();
  });

  it("pinta el paciente y el catalogo de medicamentos buscable", () => {
    pantalla();

    expect(screen.getByText("Ana Perez")).toBeTruthy();
    expect(screen.getByText(/Loratadina/)).toBeTruthy();
  });

  it("tocar un medicamento disponible dispara agregarMedicamento()", () => {
    pantalla();

    fireEvent.press(screen.getByText(/Loratadina/));

    expect(mockEstadoReceta.agregarMedicamento).toHaveBeenCalledWith(MEDICAMENTO_DISPONIBLE);
  });

  it("sin renglones agregados, Generar receta esta deshabilitado", () => {
    pantalla();

    const boton = screen.getByRole("button", { name: "Generar receta" });
    expect(boton.props.accessibilityState.disabled).toBe(true);
  });

  it("con un renglon agregado, Generar receta dispara guardar()", () => {
    mockEstadoReceta.renglones = [RENGLON_DE_EJEMPLO];
    pantalla();

    fireEvent.press(screen.getByText("Generar receta"));

    expect(mockEstadoReceta.guardar).toHaveBeenCalled();
  });

  it("un problema en un renglon (por ejemplo, sin lote elegido) se muestra junto a ese renglon", () => {
    mockEstadoReceta.renglones = [RENGLON_DE_EJEMPLO];
    mockEstadoReceta.problemas = { "r-1": "Elige un lote antes de guardar." };
    pantalla();

    expect(screen.getByText("Elige un lote antes de guardar.")).toBeTruthy();
  });

  it("tras generar con exito, muestra el folio y los medicamentos entregados", () => {
    mockEstadoReceta.receta = {
      folio: "REC-0001",
      detalle: [
        {
          id: "d-1",
          medicamento: "Loratadina",
          dosis: "1 tableta",
          frecuencia: "cada 12 horas",
          duracion: "5 dias",
          cantidadEntregada: 5,
        },
      ],
    };
    pantalla();

    expect(screen.getByText("Receta REC-0001")).toBeTruthy();
    expect(screen.getByText(/Loratadina — 1 tableta/)).toBeTruthy();
  });

  // Camino de error (issue #759/#776): si guardar() falla, el formulario se queda visible con el
  // error -- no pasa a la pantalla de confirmacion como si la receta se hubiera emitido.
  it("camino de error: si la consulta falla, muestra el error y no la confirmacion", () => {
    mockEstadoReceta.renglones = [RENGLON_DE_EJEMPLO];
    mockEstadoReceta.error = { mensaje: "No se pudo generar la receta." };
    pantalla();

    expect(screen.getByText("No se pudo generar la receta.")).toBeTruthy();
    expect(screen.queryByText(/^Receta /)).toBeNull();
  });

  it("sin consultaId, muestra el error de que hace falta registrar la consulta primero", () => {
    jest
      .spyOn(require("@react-navigation/native"), "useRoute")
      .mockReturnValueOnce({ params: { pacienteId: "p-1" } });
    pantalla();

    expect(screen.getByText(/Una receta se genera desde una consulta/)).toBeTruthy();
  });
});
