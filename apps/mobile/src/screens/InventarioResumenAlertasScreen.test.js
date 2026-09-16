// Prueba de InventarioResumenAlertasScreen (Modulo II: resumen y alertario de inventario,
// issue #785, actualizada por la issue #756).
//
// Antes de la #785 la pantalla llamaba a useAlertasVencimiento({ rol }) -una firma que ese hook
// nunca tuvo- y leia campos snake_case que el hook real nunca devuelve. La #785 la conecto
// pasandole lotes/bodegas derivados de listarLotes()/listarBodegas() al hook, que en ese momento
// calculaba sus propias alertas a partir de esa lista. La #756 encontro que ese calculo nunca
// leia alertas_caducidad (la tabla real), y "Atender" nunca actualizaba una fila real;
// useAlertasVencimiento() ahora consulta listarAlertas() internamente (mismo cambio que
// PanelAlertasVencimiento.jsx en la web), sin recibir lotes/bodegas por props. Por eso aqui se
// mockea el HOOK completo -igual que PanelAlertasVencimiento.test.jsx en la web-, no la funcion
// de API que llama por dentro: esta pantalla ya no controla esa llamada, el hook si.

import { render, screen, fireEvent } from "@testing-library/react-native";

import InventarioResumenAlertasScreen from "./InventarioResumenAlertasScreen";

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { id: "perfil-1" }, rol: "administrador" }),
}));

const mockRespuestaLotes = {
  lotes: [
    { id: "lote-1", vencido: false },
    { id: "lote-2", vencido: true },
    { id: "lote-3", vencido: false },
  ],
  error: null,
};

const mockRespuestaMedicamentos = {
  medicamentos: [{ id: "m-1" }, { id: "m-2" }, { id: "m-3" }, { id: "m-4" }],
  error: null,
};

const ALERTA_POR_VENCER = {
  id: "alerta-1",
  medicamento: "Loratadina",
  numeroLote: "L-100",
  fechaVencimiento: "2026-02-05",
  diasRestantes: 5,
};

const ALERTA_VENCIDA = {
  id: "alerta-2",
  medicamento: "Amoxicilina",
  numeroLote: "L-200",
  fechaVencimiento: "2026-01-28",
  diasRestantes: -3,
};

const mockEstadoAlertas = {
  porVencer: [],
  vencidas: [],
  cantidadPendientes: 0,
  cargando: false,
  error: null,
  recargar: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  listarLotes: jest.fn(async () => mockRespuestaLotes),
  listarMedicamentos: jest.fn(async () => mockRespuestaMedicamentos),
  useAlertasVencimiento: jest.fn(() => mockEstadoAlertas),
}));

const { listarLotes, listarMedicamentos, useAlertasVencimiento } =
  jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<InventarioResumenAlertasScreen />);
}

describe("InventarioResumenAlertasScreen", () => {
  beforeEach(() => {
    listarLotes.mockClear();
    listarMedicamentos.mockClear();
    listarLotes.mockResolvedValue(mockRespuestaLotes);
    listarMedicamentos.mockResolvedValue(mockRespuestaMedicamentos);
    mockEstadoAlertas.porVencer = [];
    mockEstadoAlertas.vencidas = [];
    mockEstadoAlertas.cantidadPendientes = 0;
    mockEstadoAlertas.cargando = false;
    mockEstadoAlertas.error = null;
    mockEstadoAlertas.recargar.mockClear();
    useAlertasVencimiento.mockClear();
  });

  it("mientras carga el resumen, muestra el estado de carga", () => {
    listarLotes.mockImplementationOnce(() => new Promise(() => {}));
    pantalla();

    expect(screen.getByText("Cargando inventario...")).toBeTruthy();
  });

  it("con datos, arma el resumen y separa las alertas en por vencer y vencidas", async () => {
    mockEstadoAlertas.porVencer = [ALERTA_POR_VENCER];
    mockEstadoAlertas.vencidas = [ALERTA_VENCIDA];
    mockEstadoAlertas.cantidadPendientes = 2;
    pantalla();

    expect(await screen.findByText("Loratadina")).toBeTruthy();

    // Resumen: 4 medicamentos en catalogo, 2 lotes no vencidos (lote-1 y lote-3), 2 en riesgo.
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getAllByText("2")).toHaveLength(2);

    expect(screen.getByText("Por vencer (1)")).toBeTruthy();
    expect(screen.getByText(/Lote L-100/)).toBeTruthy();

    expect(screen.getByText("Vencidos (1)")).toBeTruthy();
    expect(screen.getByText("Amoxicilina")).toBeTruthy();
    expect(screen.getByText("Vencido hace 3 días")).toBeTruthy();
  });

  it("sin alertas pendientes, cada seccion muestra su propio mensaje de vacio", async () => {
    pantalla();

    expect(await screen.findByText("Ningún lote vence en los próximos 30 días.")).toBeTruthy();
    expect(screen.getByText("No hay lotes vencidos.")).toBeTruthy();
  });

  // Camino de error (issue #785/#756): si alguna consulta falla, se muestra el error con boton
  // de reintentar, no un resumen en cero indistinguible de un inventario real sin alertas.
  it("camino de error: si listarLotes falla, muestra el error con boton de reintentar", async () => {
    listarLotes.mockResolvedValueOnce({
      lotes: [],
      error: { mensaje: "No se pudo cargar el inventario." },
    });
    pantalla();

    expect(await screen.findByText("No se pudo cargar el inventario.")).toBeTruthy();

    listarLotes.mockClear();
    fireEvent.press(screen.getByText("Reintentar"));
    expect(listarLotes).toHaveBeenCalledTimes(1);
  });

  it("camino de error: si useAlertasVencimiento() falla, tambien muestra el error", async () => {
    mockEstadoAlertas.error = { mensaje: "No se pudieron cargar las alertas." };
    pantalla();

    expect(await screen.findByText("No se pudieron cargar las alertas.")).toBeTruthy();
  });

  it("reintentar con error de alertas llama a recargar() del hook", async () => {
    mockEstadoAlertas.error = { mensaje: "No se pudieron cargar las alertas." };
    pantalla();

    await screen.findByText("No se pudieron cargar las alertas.");
    fireEvent.press(screen.getByText("Reintentar"));

    expect(mockEstadoAlertas.recargar).toHaveBeenCalled();
  });
});
