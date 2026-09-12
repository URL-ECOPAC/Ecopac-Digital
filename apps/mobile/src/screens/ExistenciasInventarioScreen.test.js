// Prueba de ExistenciasInventarioScreen (Modulo II: existencias por lote, issue #785).
//
// Antes de esta issue la pantalla llamaba a useVistaExistencias({ rol }) -una firma que ese
// hook nunca tuvo- y no traia ningun dato real: cargando/error/existencias eran siempre
// undefined. Esta prueba cubre la version conectada: listarLotes() + listarExistenciasDisponibles(),
// el stock sumado por lote (no por bodega, issue #270) y un lote sin existencia marcado como
// agotado en vez de desaparecer.

import { render, screen, fireEvent } from "@testing-library/react-native";

import ExistenciasInventarioScreen from "./ExistenciasInventarioScreen";

const RESPUESTA_LOTES = {
  lotes: [
    {
      id: "lote-1",
      medicamento: "Loratadina",
      numeroLote: "L-001",
      fechaVencimiento: "2099-01-01",
      vencido: false,
    },
    {
      id: "lote-2",
      medicamento: "Amoxicilina",
      numeroLote: "L-002",
      fechaVencimiento: "2099-06-01",
      vencido: false,
    },
  ],
  error: null,
};

// Solo lote-1 tiene fila de existencia disponible: lote-2 no aparece aqui (agotado o vencido en
// todas las bodegas), y aun asi tiene que verse en la lista, marcado como agotado (criterio de
// aceptacion de la issue #270).
const RESPUESTA_EXISTENCIAS = {
  existencias: [{ loteId: "lote-1", cantidadDisponible: 40 }],
  error: null,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  listarLotes: jest.fn(async () => RESPUESTA_LOTES),
  listarExistenciasDisponibles: jest.fn(async () => RESPUESTA_EXISTENCIAS),
}));

const { listarLotes, listarExistenciasDisponibles } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<ExistenciasInventarioScreen />);
}

describe("ExistenciasInventarioScreen", () => {
  beforeEach(() => {
    listarLotes.mockClear();
    listarExistenciasDisponibles.mockClear();
    listarLotes.mockResolvedValue(RESPUESTA_LOTES);
    listarExistenciasDisponibles.mockResolvedValue(RESPUESTA_EXISTENCIAS);
  });

  it("mientras carga, muestra el estado de carga", () => {
    listarLotes.mockImplementationOnce(() => new Promise(() => {}));
    pantalla();

    expect(screen.getByText("Cargando existencias...")).toBeTruthy();
  });

  it("con datos, muestra cada lote con su stock, y uno sin existencia queda marcado como agotado", async () => {
    pantalla();

    expect(await screen.findByText("Loratadina")).toBeTruthy();
    // "L-001" aparece dos veces en la tarjeta: como codigo (chip) y como dato "Lote" (mismo
    // criterio que StockScreen.js/aItemDeCatalogo, que tambien usa el numero de lote para las dos.
    expect(screen.getAllByText("L-001")).toHaveLength(2);
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText("Disponible")).toBeTruthy();

    expect(screen.getByText("Amoxicilina")).toBeTruthy();
    expect(screen.getAllByText("L-002")).toHaveLength(2);
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("Sin stock")).toBeTruthy();
  });

  it("sin lotes registrados, muestra el mensaje de vacio", async () => {
    listarLotes.mockResolvedValueOnce({ lotes: [], error: null });
    listarExistenciasDisponibles.mockResolvedValueOnce({ existencias: [], error: null });
    pantalla();

    expect(await screen.findByText("No hay lotes registrados.")).toBeTruthy();
  });

  // Camino de error (issue #785): si cualquiera de las dos consultas falla, se muestra el error
  // con boton de reintentar, no una lista vacia indistinguible de "no hay lotes".
  it("camino de error: si la consulta falla, muestra el error con boton de reintentar", async () => {
    listarLotes.mockResolvedValueOnce({
      lotes: [],
      error: { mensaje: "No se pudo cargar los lotes." },
    });
    pantalla();

    expect(await screen.findByText("No se pudo cargar los lotes.")).toBeTruthy();

    listarLotes.mockClear();
    fireEvent.press(screen.getByText("Reintentar"));
    expect(listarLotes).toHaveBeenCalledTimes(1);
  });
});
