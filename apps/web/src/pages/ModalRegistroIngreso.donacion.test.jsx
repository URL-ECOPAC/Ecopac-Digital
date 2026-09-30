// Prueba de ModalRegistroIngreso con el hook real: el ingreso de una donacion de varios renglones.
// Antes solo se veia el primer renglon, la bodega se borraba en cada uno y se podia guardar con
// los demas fuera del inventario.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ModalRegistroIngreso from "./ModalRegistroIngreso";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

const CATALOGOS = {
  medicamentos: [
    { id: "m1", nombre: "Paracetamol" },
    { id: "m2", nombre: "Ibuprofeno" },
    { id: "m3", nombre: "Amoxicilina" },
  ],
  insumos: [],
  bodegas: [{ id: "b1", nombre: "Principal" }],
  proveedores: [{ id: "p1", nombre: "Donante de prueba" }],
};

const RENGLONES = [
  { donacionDetalleId: "d1", medicamentoId: "m1", cantidad: 10 },
  { donacionDetalleId: "d2", medicamentoId: "m2", cantidad: 20 },
  { donacionDetalleId: "d3", medicamentoId: "m3", cantidad: 30 },
];

function pantalla() {
  return render(
    <ModalRegistroIngreso
      abierto
      catalogos={CATALOGOS}
      detallesDonacion={RENGLONES}
      proveedorIdInicial="p1"
    />,
  );
}

function selectorDeBodega(container) {
  return [...container.querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.value === "b1"),
  );
}

function capturarYAnadir(container, lote, { conBodega = false } = {}) {
  fireEvent.change(container.querySelector('input[placeholder="LOT-123"]'), {
    target: { value: lote },
  });
  if (conBodega) fireEvent.change(selectorDeBodega(container), { target: { value: "b1" } });
  fireEvent.click(screen.getByRole("button", { name: /Añadir/ }));
}

describe("ModalRegistroIngreso con una donacion de varios renglones", () => {
  it("muestra todos los renglones de la donacion y cuantos van agregados", () => {
    const { container } = pantalla();

    expect(screen.getByText(/Renglones de la donación \(0 de 3 agregados\)/)).toBeInTheDocument();
    expect(screen.getByText("En captura")).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente")).toHaveLength(2);

    capturarYAnadir(container, "L1", { conBodega: true });

    expect(screen.getByText(/\(1 de 3 agregados\)/)).toBeInTheDocument();
  });

  it("conserva la bodega de un renglon al siguiente", () => {
    const { container } = pantalla();

    capturarYAnadir(container, "L1", { conBodega: true });

    expect(selectorDeBodega(container)).toHaveValue("b1");
  });

  it("no deja guardar mientras falten renglones", () => {
    const { container } = pantalla();

    capturarYAnadir(container, "L1", { conBodega: true });
    fireEvent.click(screen.getByRole("button", { name: /Guardar Movimiento/ }));

    expect(screen.getByText(/Faltan 2 renglones de la donacion/)).toBeInTheDocument();
  });
});
