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

  it("tocar un lote abre el ingreso de ese medicamento", () => {
    const navigation = pantalla();

    fireEvent.press(screen.getByText("Medicamento Inventado"));
    expect(navigation.navigate).toHaveBeenCalledWith("RegistroIngreso", {
      medicamentoId: "med-1",
      medicamentoNombre: "Medicamento Inventado",
    });
  });
});
