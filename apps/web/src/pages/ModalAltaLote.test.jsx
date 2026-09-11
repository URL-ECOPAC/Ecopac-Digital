// Prueba de ModalAltaLote (Modulo II: alta de lote, issue #777).
//
// Es un componente puro por props (issue #759, hallazgo de la auditoria previa a esta suite): no
// llama a ningun hook, el dueno real de los datos y del guardado es InventarioPage.jsx, que le
// pasa onGuardar/errorValidacion. Esta prueba cubre el contrato de props, no InventarioPage.jsx
// completo -- una prueba de ese contenedor es una pieza aparte, mas grande.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { ModalAltaLote } from "./ModalAltaLote";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const MEDICAMENTOS = [{ id: "med-1", nombre: "Loratadina", concentracion: "10mg" }];
const PROVEEDORES = [{ id: "prov-1", nombre: "Farmacia Central" }];
const BODEGAS = [{ id: "bod-1", nombre: "Bodega Principal" }];

function pantalla(props = {}) {
  return render(
    <ModalAltaLote
      abierto
      onClose={vi.fn()}
      onGuardar={vi.fn()}
      medicamentos={MEDICAMENTOS}
      proveedores={PROVEEDORES}
      bodegas={BODEGAS}
      {...props}
    />,
  );
}

describe("ModalAltaLote", () => {
  it("cerrado (abierto=false) no renderiza nada", () => {
    pantalla({ abierto: false });

    expect(screen.queryByText("Registrar Lote de Medicamento")).not.toBeInTheDocument();
  });

  it("pinta el formulario con los catalogos recibidos por props", () => {
    pantalla();

    expect(screen.getByText("Loratadina (10mg)")).toBeInTheDocument();
    expect(screen.getByText("Farmacia Central")).toBeInTheDocument();
    expect(screen.getByText("Bodega Principal")).toBeInTheDocument();
  });

  it("llenar el formulario y enviarlo llama a onGuardar() con los datos, cantidad como numero", () => {
    const onGuardar = vi.fn();
    const { container } = pantalla({ onGuardar });

    fireEvent.change(screen.getByDisplayValue("Seleccione medicamento..."), {
      target: { value: "med-1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ej. LOT-2026-A"), {
      target: { value: "LOTE-99" },
    });
    fireEvent.change(screen.getByDisplayValue("Seleccione proveedor..."), {
      target: { value: "prov-1" },
    });
    fireEvent.change(screen.getByDisplayValue("Seleccione bodega..."), {
      target: { value: "bod-1" },
    });
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "50" } });

    fireEvent.submit(container.querySelector("form"));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        medicamento_id: "med-1",
        numero_lote: "LOTE-99",
        proveedor_id: "prov-1",
        bodega_id: "bod-1",
        cantidad: 50,
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
  it("camino de error: errorValidacion se muestra sin vaciar el formulario", () => {
    pantalla({ errorValidacion: "Ya existe un lote con ese numero para este medicamento." });

    expect(
      screen.getByText("Ya existe un lote con ese numero para este medicamento."),
    ).toBeInTheDocument();
    expect(screen.getByText("Guardar Lote")).toBeInTheDocument();
  });
});
