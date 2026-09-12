// Prueba de RegistroIngresoScreen (Modulo II: ingreso, issue #777).

import { fireEvent, render, screen } from "@testing-library/react-native";

import RegistroIngresoScreen from "./RegistroIngresoScreen";

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: {} }),
}));

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { id: "perfil-1" }, rol: "voluntario general" }),
}));

jest.mock("../contexto/JornadaActivaProvider", () => ({
  useJornadaActivaCompartida: () => ({ jornada: { botiquinBodegaId: null } }),
}));

const CATALOGO_RESPUESTA = {
  medicamentos: { medicamentos: [{ id: "med-1", nombre: "Loratadina" }], error: null },
  proveedores: { proveedores: [{ id: "prov-1", nombre: "Farmacia Central" }], error: null },
  bodegas: { bodegas: [{ id: "bod-1", nombre: "Bodega Principal" }], error: null },
};

const mockEstadoIngreso = {
  origen: "donacion",
  setOrigen: jest.fn(),
  proveedorId: "",
  setProveedorId: jest.fn(),
  numeroComprobante: "",
  setNumeroComprobante: jest.fn(),
  items: [],
  itemActual: {
    medicamento_id: "",
    numero_lote: "",
    bodega_id: "",
    cantidad: "",
    fecha_vencimiento: "",
  },
  setItemActual: jest.fn(),
  agregarItem: jest.fn(),
  eliminarItem: jest.fn(),
  guardarMovimiento: jest.fn(),
  resumenGuardado: null,
  resetFormulario: jest.fn(),
  error: null,
  guardando: false,
  puedeCrearMedicamento: false,
  crearMedicamentoNuevo: jest.fn(),
  creandoMedicamento: false,
  errorMedicamento: null,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  listarMedicamentos: jest.fn(async () => CATALOGO_RESPUESTA.medicamentos),
  listarProveedores: jest.fn(async () => CATALOGO_RESPUESTA.proveedores),
  listarBodegas: jest.fn(async () => CATALOGO_RESPUESTA.bodegas),
  listarPrincipiosActivos: jest.fn(async () => ({ principiosActivos: [] })),
  useRegistroIngreso: jest.fn(() => mockEstadoIngreso),
}));

const { listarBodegas, listarMedicamentos, listarProveedores, useRegistroIngreso } =
  jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<RegistroIngresoScreen />);
}

describe("RegistroIngresoScreen", () => {
  beforeEach(() => {
    mockEstadoIngreso.items = [];
    mockEstadoIngreso.error = null;
    mockEstadoIngreso.guardando = false;
    mockEstadoIngreso.resumenGuardado = null;
    useRegistroIngreso.mockClear();
    listarMedicamentos.mockClear();
    listarProveedores.mockClear();
    listarBodegas.mockClear();
    mockEstadoIngreso.agregarItem.mockClear();
    mockEstadoIngreso.guardarMovimiento.mockClear();
  });

  it("mientras carga el catalogo, muestra el estado de carga", () => {
    listarMedicamentos.mockImplementationOnce(() => new Promise(() => {}));
    pantalla();

    expect(screen.getByText("Cargando catalogos...")).toBeTruthy();
  });

  it("con el catalogo cargado, pinta el formulario de registro", async () => {
    pantalla();

    expect(await screen.findByText("Registrar ingreso")).toBeTruthy();
  });

  it("Agregar a la lista dispara agregarItem() cuando no hay items todavia", async () => {
    pantalla();
    await screen.findByText("Registrar ingreso");

    fireEvent.press(screen.getByText("Agregar a la lista"));

    expect(mockEstadoIngreso.agregarItem).toHaveBeenCalled();
  });

  it("con un item en la lista, ofrece Guardar ingreso en vez de Agregar a la lista", async () => {
    mockEstadoIngreso.items = [{ id: "item-1", numero_lote: "LOTE-1", cantidad: 40 }];
    pantalla();
    await screen.findByText("Registrar ingreso");

    expect(screen.queryByText("Agregar a la lista")).toBeNull();
    fireEvent.press(screen.getByText("Guardar ingreso"));

    expect(mockEstadoIngreso.guardarMovimiento).toHaveBeenCalled();
  });

  it("tras guardar con exito, muestra el resumen segun quede pendiente o aprobado", async () => {
    mockEstadoIngreso.resumenGuardado = {
      movimientos: [{ estado: "pendiente" }],
    };
    pantalla();

    expect(await screen.findByText("Ingreso registrado")).toBeTruthy();
    expect(screen.getByText(/quedo pendiente/)).toBeTruthy();
  });

  // Camino de error, catalogo (issue #759/#777): si el catalogo no carga, la pantalla tiene que
  // mostrar el error con boton de reintentar, no un formulario con selectores vacios en silencio.
  it("camino de error: si el catalogo falla, muestra el error con boton de reintentar", async () => {
    listarMedicamentos.mockResolvedValueOnce({
      medicamentos: [],
      error: { mensaje: "No se pudo cargar el catalogo de medicamentos." },
    });
    pantalla();

    expect(await screen.findByText("No se pudo cargar el catalogo de medicamentos.")).toBeTruthy();
    expect(screen.queryByText("Registrar ingreso")).toBeNull();
  });

  // Camino de error, guardado (issue #759/#777): si guardarMovimiento() falla, el error del hook
  // se muestra en el formulario, que sigue disponible para reintentar.
  it("camino de error: si guardarMovimiento() falla, muestra el error sin pasar al resumen", async () => {
    mockEstadoIngreso.items = [{ id: "item-1", numero_lote: "LOTE-1", cantidad: 40 }];
    mockEstadoIngreso.error = "Debes seleccionar el proveedor o donante de procedencia.";
    pantalla();

    expect(
      await screen.findByText("Debes seleccionar el proveedor o donante de procedencia."),
    ).toBeTruthy();
    expect(screen.queryByText("Ingreso registrado")).toBeNull();
  });
});
