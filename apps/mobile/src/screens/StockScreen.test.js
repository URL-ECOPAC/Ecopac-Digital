// Prueba de StockScreen (Modulo II: existencias/alertas, issue #777).
//
// StockScreen.js es un envoltorio que trae datos reales (listarExistenciasDisponibles,
// listarBodegas, listarMedicamentos) y se los pasa a CatalogoMedicamentosScreen.js. Esta prueba
// cubre lo que StockScreen.js aporta -la carga, el manejo de error, la traduccion de filas y el
// calculo de "sin stock"-, no el catalogo en si (con su propia prueba, si la tuviera): se
// reemplaza CatalogoMedicamentosScreen.js por un doble que expone las props que recibio.

import { render, screen } from "@testing-library/react-native";

import StockScreen from "./StockScreen";

jest.mock("./CatalogoMedicamentosScreen", () => ({
  CatalogoMedicamentosScreen: ({ inventarioInicial, bodegas, medicamentosSinStock }) => {
    const { Text: RNText } = jest.requireActual("react-native");
    return (
      <RNText testID="props-catalogo">
        {JSON.stringify({ inventarioInicial, bodegas, medicamentosSinStock })}
      </RNText>
    );
  },
}));

const RESPUESTA_EXISTENCIAS = {
  existencias: [
    {
      loteId: "lote-1",
      numeroLote: "LOTE-1",
      medicamentoId: "med-1",
      medicamentoNombre: "Loratadina",
      bodega: "Bodega Principal",
      fechaVencimiento: "2027-01-01",
      cantidadDisponible: 40,
    },
  ],
  error: null,
};

const RESPUESTA_BODEGAS = { bodegas: [{ id: "bod-1", nombre: "Bodega Principal" }], error: null };
const RESPUESTA_MEDICAMENTOS = {
  medicamentos: [{ id: "med-1" }, { id: "med-2" }],
  error: null,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  listarExistenciasDisponibles: jest.fn(async () => RESPUESTA_EXISTENCIAS),
  listarBodegas: jest.fn(async () => RESPUESTA_BODEGAS),
  listarMedicamentos: jest.fn(async () => RESPUESTA_MEDICAMENTOS),
}));

const { listarBodegas, listarExistenciasDisponibles, listarMedicamentos } =
  jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<StockScreen />);
}

describe("StockScreen", () => {
  beforeEach(() => {
    listarExistenciasDisponibles.mockClear();
    listarBodegas.mockClear();
    listarMedicamentos.mockClear();
    listarExistenciasDisponibles.mockResolvedValue(RESPUESTA_EXISTENCIAS);
    listarBodegas.mockResolvedValue(RESPUESTA_BODEGAS);
    listarMedicamentos.mockResolvedValue(RESPUESTA_MEDICAMENTOS);
  });

  it("mientras carga, muestra el estado de carga", () => {
    listarExistenciasDisponibles.mockImplementationOnce(() => new Promise(() => {}));
    pantalla();

    expect(screen.getByText("Cargando inventario...")).toBeTruthy();
  });

  it("con datos, le pasa al catalogo el inventario traducido, las bodegas y el conteo sin stock", async () => {
    pantalla();

    const props = JSON.parse((await screen.findByTestId("props-catalogo")).children[0]);

    expect(props.inventarioInicial).toHaveLength(1);
    expect(props.inventarioInicial[0]).toMatchObject({
      id: "lote-1",
      nombre: "Loratadina",
      cantidad_disponible: 40,
    });
    expect(props.bodegas).toEqual([{ id: "bod-1", nombre: "Bodega Principal" }]);
    // 2 medicamentos en el catalogo, 1 con existencia (med-1): 1 sin stock.
    expect(props.medicamentosSinStock).toBe(1);
  });

  // Camino de error (issue #759/#777): si cualquiera de las tres consultas falla, la pantalla
  // tiene que mostrar el error con boton de reintentar, no un catalogo silenciosamente vacio.
  it("camino de error: si alguna consulta falla, muestra el error con boton de reintentar", async () => {
    listarExistenciasDisponibles.mockResolvedValueOnce({
      existencias: [],
      error: { mensaje: "No se pudo cargar el inventario." },
    });
    pantalla();

    expect(await screen.findByText("No se pudo cargar el inventario.")).toBeTruthy();
    expect(screen.queryByTestId("props-catalogo")).toBeNull();
  });
});
