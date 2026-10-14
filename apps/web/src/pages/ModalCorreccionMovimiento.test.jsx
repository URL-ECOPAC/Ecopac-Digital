// La correccion de un movimiento muestra el movimiento entero (issue #840, regla B1): tipo, lote y
// bodega de solo lectura, cantidad y motivo editables. Antes solo tenia cantidad y motivo, y quien
// corregia no veia que movimiento estaba corrigiendo.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { OPCIONES_TIPO_MOVIMIENTO } from "@ecopac/shared";

import ModalCorreccionMovimiento from "./ModalCorreccionMovimiento";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const TIPO = OPCIONES_TIPO_MOVIMIENTO[0];

const MOVIMIENTO = {
  id: "mov-1",
  tipo: TIPO.value,
  medicamentoNombre: "Medicamento Inventado",
  numeroLote: "L-1",
  bodegaNombre: "Bodega Inventada",
  cantidad: 5,
  motivo: "Conteo",
  estado: "pendiente",
  puedeEditar: true,
};

function montar(movimiento = MOVIMIENTO, onGuardar = vi.fn(async () => ({ ok: true }))) {
  render(
    <ModalCorreccionMovimiento
      visible
      movimiento={movimiento}
      onClose={vi.fn()}
      onGuardar={onGuardar}
    />,
  );
  return onGuardar;
}

describe("ModalCorreccionMovimiento", () => {
  it("tipo, lote y bodega se ven, legibles y sin poder cambiarse", () => {
    montar();

    expect(screen.getByLabelText("Tipo")).toHaveValue(TIPO.label);
    expect(screen.getByLabelText("Tipo")).toBeDisabled();
    expect(screen.getByLabelText("Lote")).toHaveValue("Medicamento Inventado · Lote L-1");
    expect(screen.getByLabelText("Bodega")).toHaveValue("Bodega Inventada");
    expect(screen.getByLabelText("Bodega")).toBeDisabled();
  });

  it("cantidad y motivo se editan, y solo ellos viajan al guardar", async () => {
    const onGuardar = montar();

    expect(screen.getByLabelText("Motivo")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Recuento" } });
    fireEvent.click(screen.getByText("Guardar cambios"));

    expect(onGuardar).toHaveBeenCalledWith(
      "mov-1",
      expect.objectContaining({ cantidad: 5, motivo: "Recuento" }),
    );
  });

  it("un movimiento que no se puede corregir deja todo deshabilitado", () => {
    montar({ ...MOVIMIENTO, puedeEditar: false });

    expect(screen.getByLabelText("Motivo")).toBeDisabled();
    expect(screen.queryByText("Guardar cambios")).toBeNull();
  });
});
