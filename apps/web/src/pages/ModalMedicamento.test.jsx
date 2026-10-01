// Prueba de ModalMedicamento: un insumo no pide principio activo, concentracion, forma
// farmaceutica ni uso pediatrico (00164).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ModalMedicamento from "./ModalMedicamento";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

function pantalla(tipoArticulo) {
  return render(
    <ModalMedicamento
      isOpen
      onClose={vi.fn()}
      modoEdicion={false}
      formData={{ tipoArticulo }}
      setFormData={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );
}

describe("ModalMedicamento", () => {
  it("un medicamento pide principio activo y concentracion", () => {
    pantalla("medicamento");

    expect(screen.getByText("Nuevo medicamento")).toBeInTheDocument();
    expect(screen.getByLabelText("Principio activo *")).toBeInTheDocument();
    expect(screen.getByLabelText("Concentración *")).toBeInTheDocument();
    expect(screen.getByLabelText("Es de uso pediatrico")).toBeInTheDocument();
  });

  it("un insumo no pide datos farmacologicos", () => {
    pantalla("insumo");

    expect(screen.getByText("Nuevo insumo")).toBeInTheDocument();
    expect(screen.queryByLabelText("Principio activo *")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Concentración *")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Forma farmacéutica")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Es de uso pediatrico")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Marca / laboratorio *")).toBeInTheDocument();
  });
});
