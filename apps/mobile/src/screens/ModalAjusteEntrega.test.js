// Prueba de ModalAjusteEntrega (issue #764): corregir la cantidad realmente entregada de un
// renglon de receta desde EntregaMedicamentosScreen.

import { fireEvent, render, screen } from "@testing-library/react-native";

import ModalAjusteEntrega from "./ModalAjusteEntrega";

const DETALLE_DE_EJEMPLO = {
  id: "d-1",
  medicamento: "Loratadina",
  dosis: "1 tableta",
  frecuencia: "cada 8 horas",
  duracion: "5 dias",
  cantidadEntregada: 5,
  cantidadRealEntregada: 5,
  cantidadDisponible: 35,
  vencido: false,
};

function modal({ detalle = DETALLE_DE_EJEMPLO, onGuardar = jest.fn(), onClose = jest.fn() } = {}) {
  render(<ModalAjusteEntrega visible detalle={detalle} onGuardar={onGuardar} onClose={onClose} />);
  return { onGuardar, onClose };
}

describe("ModalAjusteEntrega", () => {
  it("muestra el medicamento, la dosis y lo recetado/disponible", () => {
    modal();

    expect(screen.getByText("Loratadina")).toBeTruthy();
    expect(screen.getByText("1 tableta · cada 8 horas · 5 dias")).toBeTruthy();
    expect(screen.getByText("Recetado: 5 · Disponible: 35")).toBeTruthy();
  });

  it("un lote vencido muestra la advertencia", () => {
    modal({ detalle: { ...DETALLE_DE_EJEMPLO, vencido: true } });

    expect(screen.getByText("El lote de este renglon esta vencido.")).toBeTruthy();
  });

  it("guardar con una cantidad nueva llama a onGuardar y cierra el modal", async () => {
    const onGuardar = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    modal({ onGuardar, onClose });

    fireEvent.changeText(screen.getByDisplayValue("5"), "7");
    await fireEvent.press(screen.getByText("Guardar ajuste"));

    expect(onGuardar).toHaveBeenCalledWith("d-1", 7);
    expect(onClose).toHaveBeenCalled();
  });

  it("una cantidad en cero no llama a onGuardar: muestra el error de validacion", async () => {
    const onGuardar = jest.fn();
    modal({ onGuardar });

    fireEvent.changeText(screen.getByDisplayValue("5"), "0");
    await fireEvent.press(screen.getByText("Guardar ajuste"));

    expect(screen.getByText("La cantidad debe ser mayor que cero.")).toBeTruthy();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it("si onGuardar rechaza (por ejemplo, existencia insuficiente), muestra el mensaje y no cierra", async () => {
    const onGuardar = jest.fn().mockRejectedValue(new Error("Existencia insuficiente."));
    const onClose = jest.fn();
    modal({ onGuardar, onClose });

    fireEvent.changeText(screen.getByDisplayValue("5"), "50");
    fireEvent.press(screen.getByText("Guardar ajuste"));

    expect(await screen.findByText("Existencia insuficiente.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancelar cierra el modal sin llamar a onGuardar", () => {
    const onGuardar = jest.fn();
    const onClose = jest.fn();
    modal({ onGuardar, onClose });

    fireEvent.press(screen.getByText("Cancelar"));

    expect(onClose).toHaveBeenCalled();
    expect(onGuardar).not.toHaveBeenCalled();
  });
});
