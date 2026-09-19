// Prueba de ModalAltaLote (Modulo II: alta de lote, issue #777).
//
// Es un componente puro por props (issue #759, hallazgo de la auditoria previa a esta suite): no
// llama a ningun hook de datos, el dueno real de los datos y del guardado es InventarioPage.jsx, que le
// pasa onGuardar/errorValidacion. Esta prueba cubre el contrato de props, no InventarioPage.jsx
// completo -- una prueba de ese contenedor es una pieza aparte, mas grande.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { CAMPOS_LOTE } from "@ecopac/shared";

import { ModalAltaLote } from "./ModalAltaLote";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const MEDICAMENTOS = [{ id: "med-1", nombre: "Loratadina", concentracion: "10mg" }];
const PROVEEDORES = [{ id: "prov-1", nombre: "Farmacia Central" }];

function pantalla(props = {}) {
  return render(
    <ModalAltaLote
      abierto
      onClose={vi.fn()}
      onGuardar={vi.fn()}
      medicamentos={MEDICAMENTOS}
      proveedores={PROVEEDORES}
      {...props}
    />,
  );
}

describe("ModalAltaLote", () => {
  it("cerrado (abierto=false) no renderiza nada", () => {
    pantalla({ abierto: false });

    expect(screen.queryByText("Registrar lote de medicamento")).not.toBeInTheDocument();
  });

  it("pinta el formulario con los catalogos recibidos por props", () => {
    pantalla();

    expect(screen.getByText("Loratadina 10mg")).toBeInTheDocument();
    expect(screen.getByText("Farmacia Central")).toBeInTheDocument();
  });

  // Issue #840 (B1): el modal dibuja CAMPOS_LOTE. La bodega se pedia como obligatoria y
  // registrarLote() nunca la guardaba.
  it("dibuja los campos de CAMPOS_LOTE, sin la bodega que nunca se guardaba", () => {
    pantalla();

    for (const campo of CAMPOS_LOTE) {
      expect(screen.getByLabelText(campo.label)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Bodega/)).not.toBeInTheDocument();
  });

  it("llenar el formulario y guardarlo llama a onGuardar() con los ids de CAMPOS_LOTE", () => {
    const onGuardar = vi.fn();
    pantalla({ onGuardar });

    fireEvent.change(screen.getByLabelText("Medicamento"), { target: { value: "med-1" } });
    fireEvent.change(screen.getByLabelText("Número de lote"), { target: { value: "LOTE-99" } });
    fireEvent.change(screen.getByLabelText("Proveedor"), { target: { value: "prov-1" } });
    fireEvent.change(screen.getByLabelText("Cantidad ingresada"), { target: { value: "50" } });

    fireEvent.click(screen.getByText("Guardar lote"));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        medicamento: "med-1",
        numeroLote: "LOTE-99",
        proveedor: "prov-1",
        cantidadIngresada: 50,
      }),
    );
  });

  it("Cancelar llama a onClose() sin llamar a onGuardar()", () => {
    const onClose = vi.fn();
    const onGuardar = vi.fn();
    pantalla({ onClose, onGuardar });

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onClose).toHaveBeenCalled();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  // Camino de error (issue #759/#777): si el padre (InventarioPage.jsx) rechaza el guardado -por
  // ejemplo, un numero de lote duplicado-, el mensaje llega por props y tiene que mostrarse sin
  // cerrar el formulario ni perder lo que la persona ya escribio.
  it("camino de error: errorValidacion y los errores por campo se muestran", () => {
    pantalla({
      errorValidacion: "Ya existe un lote con ese numero para este medicamento.",
      errores: { numeroLote: "Número de lote es obligatorio." },
    });

    expect(
      screen.getByText("Ya existe un lote con ese numero para este medicamento."),
    ).toBeInTheDocument();
    expect(screen.getByText("Número de lote es obligatorio.")).toBeInTheDocument();
    expect(screen.getByText("Guardar lote")).toBeInTheDocument();
  });
});
