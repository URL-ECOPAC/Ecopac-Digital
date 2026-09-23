// Stock movil (issue #840, G5): filtros de la web, sin chips que se corten ni categorias
// inventadas, y una tarjeta que no trunca el lote ni la bodega.

import { fireEvent, render, screen } from "@testing-library/react-native";

import { CatalogoMedicamentosScreen } from "./CatalogoMedicamentosScreen";

const FILAS = [
  {
    loteId: "lote-1",
    medicamentoId: "med-1",
    medicamentoNombre: "Medicamento Inventado",
    numeroLote: "LOTE-DEMO-PRINCIPAL-1",
    fechaVencimiento: "2030-01-01",
    cantidadDisponible: 40,
    bodegaId: "bod-1",
    bodega: "Bodega Movil Inventada",
  },
];

function pantalla(navigation = { navigate: jest.fn() }) {
  render(
    <CatalogoMedicamentosScreen
      inventarioInicial={FILAS}
      bodegas={[{ id: "bod-1", nombre: "Bodega Movil Inventada" }]}
      medicamentosSinStock={2}
      navigation={navigation}
    />,
  );
  return navigation;
}

describe("CatalogoMedicamentosScreen", () => {
  it("el lote y la bodega se leen completos, sin mayusculas forzadas", () => {
    pantalla();

    expect(screen.getByText("Lote LOTE-DEMO-PRINCIPAL-1 · Bodega Movil Inventada")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
  });

  it("los filtros son el panel de la web, sin categorias", () => {
    pantalla();

    expect(screen.getByText("Filtros")).toBeTruthy();
    expect(screen.queryByText("Biológicos")).toBeNull();
    expect(screen.queryByText("EPP")).toBeNull();
  });

  it("tocar un lote abre su detalle, donde estan sus datos y el boton de editar", () => {
    const navigation = pantalla();

    fireEvent.press(screen.getByText("Medicamento Inventado"));
    expect(navigation.navigate).toHaveBeenCalledWith("DetalleLote", { loteId: "lote-1" });
  });

  it("los tres indicadores son productos, por vencer y sin stock", () => {
    pantalla();

    expect(screen.getByText("Productos")).toBeTruthy();
    expect(screen.getByText("Por vencer")).toBeTruthy();
    expect(screen.getByText("Sin stock")).toBeTruthy();
    expect(screen.queryByText("Lotes")).toBeNull();
  });

  it("dos lotes del mismo medicamento cuentan como un solo producto", () => {
    render(
      <CatalogoMedicamentosScreen
        inventarioInicial={[
          FILAS[0],
          { ...FILAS[0], loteId: "lote-2", numeroLote: "LOTE-DEMO-PRINCIPAL-2" },
        ]}
        bodegas={[{ id: "bod-1", nombre: "Bodega Movil Inventada" }]}
        medicamentosSinStock={2}
        navigation={{ navigate: jest.fn() }}
      />,
    );

    expect(screen.getByText("2 lotes en bodega")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });
});
