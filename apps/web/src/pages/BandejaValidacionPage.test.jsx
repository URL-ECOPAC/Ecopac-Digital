// Prueba de BandejaValidacionPage (Modulo II: bandeja de validacion, issue #777).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import BandejaValidacionPage from "./BandejaValidacionPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const MOVIMIENTO_DE_EJEMPLO = {
  id: "mov-1",
  tipo: "ingreso",
  cantidad: 40,
  registrado_por: "voluntario-1",
  created_at: "2026-01-10T09:00:00Z",
  lote: { numero_lote: "LOTE-1", medicamento: { nombre: "Loratadina" } },
};

const mockEstadoHook = {
  pendientes: [],
  cargando: false,
  error: null,
  aprobar: vi.fn(async () => ({ error: null })),
  rechazar: vi.fn(async () => ({ error: null })),
};

vi.mock("../../../../packages/shared/inventario/usePendientesValidacion.js", () => ({
  usePendientesValidacion: vi.fn(() => mockEstadoHook),
}));

const { usePendientesValidacion } =
  await import("../../../../packages/shared/inventario/usePendientesValidacion.js");

function pantalla(rolUsuario = "administrador") {
  return render(<BandejaValidacionPage usuarioId="u-1" rolUsuario={rolUsuario} />);
}

describe("BandejaValidacionPage", () => {
  afterEach(() => {
    mockEstadoHook.pendientes = [];
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.aprobar = vi.fn(async () => ({ error: null }));
    mockEstadoHook.rechazar = vi.fn(async () => ({ error: null }));
    usePendientesValidacion.mockClear();
  });

  it("mientras carga, muestra el mensaje de carga en la tabla", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando movimientos pendientes...")).toBeInTheDocument();
  });

  it("sin pendientes, muestra el mensaje de bandeja vacia", () => {
    pantalla();

    expect(screen.getByText("No hay movimientos pendientes de validación")).toBeInTheDocument();
  });

  it("con un pendiente, lo pinta con su medicamento, lote y cantidad", () => {
    mockEstadoHook.pendientes = [MOVIMIENTO_DE_EJEMPLO];
    pantalla();

    expect(screen.getByText("Loratadina")).toBeInTheDocument();
    expect(screen.getByText("Lote: LOTE-1")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
  });

  it("administrador ve los botones de aprobar y rechazar; un rol sin permiso no los ve", () => {
    mockEstadoHook.pendientes = [MOVIMIENTO_DE_EJEMPLO];
    const { rerender } = pantalla("administrador");

    expect(screen.getByText("Aprobar")).toBeInTheDocument();
    expect(screen.getByText("Rechazar")).toBeInTheDocument();

    cleanup();
    render(<BandejaValidacionPage usuarioId="u-1" rolUsuario="voluntario general" />);

    expect(screen.queryByText("Aprobar")).not.toBeInTheDocument();
    expect(screen.queryByText("Rechazar")).not.toBeInTheDocument();
    void rerender;
  });

  it("Aprobar dispara aprobar() con el id del movimiento", async () => {
    mockEstadoHook.pendientes = [MOVIMIENTO_DE_EJEMPLO];
    pantalla();

    fireEvent.click(screen.getByText("Aprobar"));

    expect(mockEstadoHook.aprobar).toHaveBeenCalledWith("mov-1");
  });

  it("Rechazar pide el motivo por prompt y lo envia a rechazar()", () => {
    mockEstadoHook.pendientes = [MOVIMIENTO_DE_EJEMPLO];
    vi.spyOn(window, "prompt").mockReturnValue("Documentacion incompleta");
    pantalla();

    fireEvent.click(screen.getByText("Rechazar"));

    expect(mockEstadoHook.rechazar).toHaveBeenCalledWith("mov-1", "Documentacion incompleta");
  });

  it("cancelar el prompt de rechazo no llama a rechazar()", () => {
    mockEstadoHook.pendientes = [MOVIMIENTO_DE_EJEMPLO];
    vi.spyOn(window, "prompt").mockReturnValue(null);
    pantalla();

    fireEvent.click(screen.getByText("Rechazar"));

    expect(mockEstadoHook.rechazar).not.toHaveBeenCalled();
  });

  // Camino de error (issue #759/#777): si la consulta de pendientes falla, la tabla tiene que
  // mostrar el error, no la lista vacia (que diria "no hay pendientes" cuando en realidad la
  // consulta ni siquiera se pudo completar).
  it("camino de error: si la consulta de pendientes falla, muestra el error y no el vacio", () => {
    mockEstadoHook.error = { mensaje: "No se pudieron cargar los movimientos pendientes." };
    pantalla();

    expect(
      screen.getByText("No se pudieron cargar los movimientos pendientes."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No hay movimientos pendientes de validación"),
    ).not.toBeInTheDocument();
  });

  it("camino de error de accion: si aprobar() falla, muestra el mensaje de error de la accion", async () => {
    mockEstadoHook.pendientes = [MOVIMIENTO_DE_EJEMPLO];
    mockEstadoHook.aprobar = vi.fn(async () => ({
      error: { mensaje: "No tienes permiso para aprobar este movimiento." },
    }));
    pantalla();

    fireEvent.click(screen.getByText("Aprobar"));

    expect(
      await screen.findByText("No tienes permiso para aprobar este movimiento."),
    ).toBeInTheDocument();
  });
});
