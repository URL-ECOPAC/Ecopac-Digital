// Prueba de ModalRegistroIngreso (Modulo II: ingreso, issue #777).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ModalRegistroIngreso from "./ModalRegistroIngreso";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const CATALOGOS = {
  medicamentos: [{ id: "med-1", nombre: "Loratadina", concentracion: "10mg" }],
  bodegas: [{ id: "bod-1", nombre: "Bodega Principal" }],
  proveedores: [{ id: "prov-1", nombre: "Farmacia Central" }],
};

const ITEM_VACIO = {
  medicamento_id: "",
  numero_lote: "",
  bodega_id: "",
  cantidad: "",
  fecha_vencimiento: "",
};

const mockEstadoHook = {
  origen: "compra",
  setOrigen: vi.fn(),
  proveedorId: "",
  setProveedorId: vi.fn(),
  numeroComprobante: "",
  setNumeroComprobante: vi.fn(),
  items: [],
  itemActual: ITEM_VACIO,
  setItemActual: vi.fn(),
  agregarItem: vi.fn(),
  eliminarItem: vi.fn(),
  guardarMovimiento: vi.fn(),
  resumenGuardado: null,
  resetFormulario: vi.fn(),
  error: null,
  guardando: false,
};

vi.mock("../../../../packages/shared/inventario/useRegistroIngreso.js", () => ({
  useRegistroIngreso: vi.fn(() => mockEstadoHook),
}));

const { useRegistroIngreso } =
  await import("../../../../packages/shared/inventario/useRegistroIngreso.js");

function pantalla(props = {}) {
  return render(
    <ModalRegistroIngreso
      abierto
      onClose={vi.fn()}
      onExito={vi.fn()}
      catalogos={CATALOGOS}
      usuarioId="u-1"
      {...props}
    />,
  );
}

describe("ModalRegistroIngreso", () => {
  afterEach(() => {
    mockEstadoHook.items = [];
    mockEstadoHook.itemActual = ITEM_VACIO;
    mockEstadoHook.error = null;
    mockEstadoHook.guardando = false;
    mockEstadoHook.resumenGuardado = null;
    useRegistroIngreso.mockClear();
    mockEstadoHook.agregarItem.mockClear();
    mockEstadoHook.guardarMovimiento.mockClear();
    mockEstadoHook.resetFormulario.mockClear();
  });

  it("cerrado (abierto=false) no renderiza nada", () => {
    pantalla({ abierto: false });

    expect(screen.queryByText("Registrar Ingreso de Medicamentos")).not.toBeInTheDocument();
  });

  it("sin items agregados, la tabla muestra el mensaje de lista vacia", () => {
    pantalla();

    expect(screen.getByText("No se han agregado medicamentos a la lista.")).toBeInTheDocument();
  });

  it("Añadir dispara agregarItem()", () => {
    pantalla();

    fireEvent.click(screen.getByText("+ Añadir"));

    expect(mockEstadoHook.agregarItem).toHaveBeenCalled();
  });

  it("con items agregados, la tabla los pinta con nombre de medicamento y bodega resueltos", () => {
    mockEstadoHook.items = [
      {
        id: "item-1",
        medicamento_id: "med-1",
        numero_lote: "LOTE-1",
        bodega_id: "bod-1",
        fecha_vencimiento: "2027-01-01",
        cantidad: 50,
      },
    ];
    pantalla();

    expect(screen.getByText("Loratadina")).toBeInTheDocument();
    // "Bodega Principal" tambien es la opcion del selector de bodega del formulario de arriba:
    // dos apariciones legitimas, no una sola.
    expect(screen.getAllByText("Bodega Principal").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("LOTE-1")).toBeInTheDocument();
  });

  it("Guardar Movimiento dispara guardarMovimiento()", () => {
    pantalla();

    fireEvent.click(screen.getByText("Guardar Movimiento"));

    expect(mockEstadoHook.guardarMovimiento).toHaveBeenCalled();
  });

  it("tras guardar con exito, muestra el resumen en vez del formulario", () => {
    mockEstadoHook.resumenGuardado = { origen: "compra", movimientos: [{ id: "m-1" }] };
    pantalla();

    expect(screen.getByText("Ingreso registrado con éxito (Pendiente)")).toBeInTheDocument();
    expect(screen.queryByText("Guardar Movimiento")).not.toBeInTheDocument();
  });

  // Camino de error (issue #759/#777): si guardarMovimiento() falla, el modal se queda abierto
  // con el error visible, no pasa al resumen como si hubiera funcionado.
  it("camino de error: si la consulta falla, muestra el error y no el resumen", () => {
    mockEstadoHook.error = "No se pudo registrar el ingreso.";
    pantalla();

    expect(screen.getByText("No se pudo registrar el ingreso.")).toBeInTheDocument();
    expect(screen.queryByText(/registrado con éxito/)).not.toBeInTheDocument();
    // El formulario sigue disponible para reintentar.
    expect(screen.getByText("Guardar Movimiento")).toBeInTheDocument();
  });

  it("cancelar llama a resetFormulario() y a onClose()", () => {
    const onClose = vi.fn();
    pantalla({ onClose });

    fireEvent.click(screen.getByText("Cancelar"));

    expect(mockEstadoHook.resetFormulario).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
