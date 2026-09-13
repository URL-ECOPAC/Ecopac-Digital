// Prueba de InventarioResumenAlertasScreen (Modulo II: resumen y alertario de inventario,
// issue #785).
//
// Antes de esta issue la pantalla llamaba a useAlertasVencimiento({ rol }) -una firma que ese
// hook nunca tuvo- y leia campos snake_case (dias_restantes, nivel_alerta, resumen.*) que el
// hook real nunca devuelve: cargando/error/resumen/alertas eran siempre undefined. Esta prueba
// cubre la version conectada: listarLotes()/listarBodegas()/listarMedicamentos() alimentando el
// hook real, separado en "por vencer" y "vencidos" (issue #268).

import { render, screen, fireEvent } from "@testing-library/react-native";

import InventarioResumenAlertasScreen from "./InventarioResumenAlertasScreen";

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { id: "perfil-1" }, rol: "administrador" }),
}));

/** "AAAA-MM-DD" del dia de calendario local, desplazado `dias` desde hoy. */
function fechaDesdeHoy(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const mockRespuestaLotes = {
  lotes: [
    {
      id: "lote-1",
      medicamento: "Loratadina",
      numeroLote: "L-100",
      fechaVencimiento: fechaDesdeHoy(5),
      vencido: false,
    },
    {
      id: "lote-2",
      medicamento: "Amoxicilina",
      numeroLote: "L-200",
      fechaVencimiento: fechaDesdeHoy(-3),
      vencido: true,
    },
    {
      id: "lote-3",
      medicamento: "Paracetamol",
      numeroLote: "L-300",
      fechaVencimiento: fechaDesdeHoy(60),
      vencido: false,
    },
  ],
  error: null,
};

const mockRespuestaBodegas = { bodegas: [{ id: "bod-1", nombre: "Central" }], error: null };
const mockRespuestaMedicamentos = {
  medicamentos: [{ id: "m-1" }, { id: "m-2" }, { id: "m-3" }, { id: "m-4" }],
  error: null,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  listarLotes: jest.fn(async () => mockRespuestaLotes),
  listarBodegas: jest.fn(async () => mockRespuestaBodegas),
  listarMedicamentos: jest.fn(async () => mockRespuestaMedicamentos),
}));

const { listarLotes, listarBodegas, listarMedicamentos } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<InventarioResumenAlertasScreen />);
}

describe("InventarioResumenAlertasScreen", () => {
  beforeEach(() => {
    listarLotes.mockClear();
    listarBodegas.mockClear();
    listarMedicamentos.mockClear();
    listarLotes.mockResolvedValue(mockRespuestaLotes);
    listarBodegas.mockResolvedValue(mockRespuestaBodegas);
    listarMedicamentos.mockResolvedValue(mockRespuestaMedicamentos);
  });

  it("mientras carga, muestra el estado de carga", () => {
    listarLotes.mockImplementationOnce(() => new Promise(() => {}));
    pantalla();

    expect(screen.getByText("Cargando inventario...")).toBeTruthy();
  });

  it("con datos, arma el resumen y separa las alertas en por vencer y vencidas", async () => {
    pantalla();

    expect(await screen.findByText("Loratadina")).toBeTruthy();

    // Resumen: 4 medicamentos en catalogo, 2 lotes no vencidos (lote-1 y lote-3) y 2 alertas
    // pendientes (lote-1 por vencer + lote-2 vencido, dentro de los 30 dias de anticipacion) --
    // "lotes activos" y "en riesgo" coinciden en el mismo valor, de ahi las dos apariciones.
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getAllByText("2")).toHaveLength(2);

    expect(screen.getByText("Por vencer (1)")).toBeTruthy();
    expect(screen.getByText(/Lote L-100/)).toBeTruthy();

    expect(screen.getByText("Vencidos (1)")).toBeTruthy();
    expect(screen.getByText("Amoxicilina")).toBeTruthy();
    expect(screen.getByText("Vencido hace 3 días")).toBeTruthy();

    // El lote-3 vence en 60 dias: fuera de la ventana de 30 dias, no aparece en ninguna seccion.
    expect(screen.queryByText("Paracetamol")).toBeNull();
  });

  it("sin lotes por vencer ni vencidos, cada seccion muestra su propio mensaje de vacio", async () => {
    listarLotes.mockResolvedValueOnce({ lotes: [], error: null });
    pantalla();

    expect(await screen.findByText("Ningún lote vence en los próximos 30 días.")).toBeTruthy();
    expect(screen.getByText("No hay lotes vencidos.")).toBeTruthy();
  });

  // Camino de error (issue #785): si alguna consulta falla, se muestra el error con boton de
  // reintentar, no un resumen en cero indistinguible de un inventario real sin alertas.
  it("camino de error: si la consulta falla, muestra el error con boton de reintentar", async () => {
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
});
