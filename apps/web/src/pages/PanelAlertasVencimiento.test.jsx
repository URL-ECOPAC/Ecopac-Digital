// Prueba de PanelAlertasVencimiento (Modulo II: alertas de vencimiento, issue #777).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import PanelAlertasVencimiento from "./PanelAlertasVencimiento";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const ALERTA_POR_VENCER = {
  id: "a-1",
  medicamento: "Loratadina",
  numeroLote: "LOTE-1",
  cantidadAfectada: 40,
  // cantidadDisponible es lo que de verdad queda hoy en el lote (issue #859): la pantalla arma
  // el total a repartir sobre este campo, no sobre cantidadAfectada (la instantanea congelada al
  // generar la alerta). En estas pruebas coinciden porque no hay ninguna salida de por medio.
  cantidadDisponible: 40,
  fechaVencimiento: "2026-02-01",
  diasRestantes: 15,
};

const ALERTA_VENCIDA = {
  id: "a-2",
  medicamento: "Acetaminofen",
  numeroLote: "LOTE-2",
  cantidadAfectada: 20,
  cantidadDisponible: 20,
  fechaVencimiento: "2026-01-01",
  diasRestantes: -5,
};

const mockEstadoHook = {
  porVencer: [],
  vencidas: [],
  cantidadPendientes: 0,
  atendidas: [],
  errorAtendidas: null,
  bodegas: [{ id: "b-1", nombre: "Bodega Central" }],
  errorBodegas: null,
  cargando: false,
  error: null,
  recargar: vi.fn(),
  busqueda: "",
  setBusqueda: vi.fn(),
  marcarComoAtendida: vi.fn(async () => {}),
};

vi.mock("../../../../packages/shared/inventario/useAlertasVencimiento.js", () => ({
  useAlertasVencimiento: vi.fn(() => mockEstadoHook),
}));

const { useAlertasVencimiento } =
  await import("../../../../packages/shared/inventario/useAlertasVencimiento.js");

function pantalla(props = {}) {
  return render(<PanelAlertasVencimiento usuarioId="u-1" rolUsuario="administrador" {...props} />);
}

describe("PanelAlertasVencimiento", () => {
  afterEach(() => {
    mockEstadoHook.porVencer = [];
    mockEstadoHook.vencidas = [];
    mockEstadoHook.cantidadPendientes = 0;
    mockEstadoHook.atendidas = [];
    mockEstadoHook.errorAtendidas = null;
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.marcarComoAtendida = vi.fn(async () => {});
    mockEstadoHook.recargar.mockClear();
    useAlertasVencimiento.mockClear();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  // Camino de error (issue #759): si listarAlertas() falla, la pantalla tiene que mostrar el
  // error, no una tabla vacia que diria "no hay lotes por vencer" siendo falso.
  it("camino de error: si la consulta falla, muestra el error y permite reintentar", () => {
    mockEstadoHook.error = { mensaje: "No se pudieron cargar las alertas." };
    pantalla();

    expect(screen.getByText("No se pudieron cargar las alertas.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });

  it("sin alertas, muestra los dos mensajes de vacio", () => {
    pantalla();

    expect(screen.getByText("No hay lotes por vencer en los próximos 30 días")).toBeInTheDocument();
    expect(screen.getByText("No hay lotes vencidos")).toBeInTheDocument();
  });

  it("con datos, pinta las alertas por vencer y las vencidas en sus propias tablas", () => {
    mockEstadoHook.porVencer = [ALERTA_POR_VENCER];
    mockEstadoHook.vencidas = [ALERTA_VENCIDA];
    mockEstadoHook.cantidadPendientes = 2;
    pantalla();

    expect(screen.getByText("Próximos a vencer (1)")).toBeInTheDocument();
    expect(screen.getByText("Vencidos — Para dar de baja (1)")).toBeInTheDocument();
    expect(screen.getByText("Loratadina")).toBeInTheDocument();
    expect(screen.getByText("Acetaminofen")).toBeInTheDocument();
    expect(screen.getByText("15d")).toBeInTheDocument();
    // Vencido: se muestra el valor absoluto de dias, no negativo.
    expect(screen.getByText("5d")).toBeInTheDocument();
  });

  it("escribir en el buscador llama a setBusqueda()", () => {
    pantalla();

    fireEvent.change(screen.getByPlaceholderText("Buscar medicamento o lote..."), {
      target: { value: "loratadina" },
    });

    expect(mockEstadoHook.setBusqueda).toHaveBeenCalledWith("loratadina");
  });

  it("Atender abre el modal, y Confirmar exige elegir una accion antes de habilitarse", () => {
    mockEstadoHook.porVencer = [ALERTA_POR_VENCER];
    pantalla();

    fireEvent.click(screen.getByText("Atender"));

    expect(screen.getByText("Registrar Acción Tomada")).toBeInTheDocument();
    expect(screen.getByText("Confirmar")).toBeDisabled();
  });

  it("con una accion que cubre todo lo disponible, llama a marcarComoAtendida() y cierra el modal", async () => {
    mockEstadoHook.porVencer = [ALERTA_POR_VENCER];
    pantalla();

    fireEvent.click(screen.getByText("Atender"));
    fireEvent.change(screen.getAllByRole("combobox").at(-1), {
      target: { value: "descartado" },
    });
    fireEvent.change(screen.getByLabelText("Cantidad *"), { target: { value: "40" } });
    fireEvent.click(screen.getByText("Agregar acción"));
    fireEvent.click(screen.getByText("Confirmar"));

    expect(mockEstadoHook.marcarComoAtendida).toHaveBeenCalledWith(
      "a-1",
      [expect.objectContaining({ accion: "descartado", cantidad: 40 })],
      40,
    );
    // El hook decide si la alerta desaparece de porVencer; esta pantalla solo cierra su modal.
    await waitFor(() =>
      expect(screen.queryByText("Registrar Acción Tomada")).not.toBeInTheDocument(),
    );
  });

  // PLAN.md punto 5 (00143): una alerta se puede repartir en varias acciones que sumen el total.
  it("dos acciones que juntas cubren el total tambien se pueden confirmar", async () => {
    mockEstadoHook.porVencer = [ALERTA_POR_VENCER];
    pantalla();

    fireEvent.click(screen.getByText("Atender"));

    fireEvent.change(screen.getAllByRole("combobox").at(-1), { target: { value: "donado" } });
    fireEvent.change(screen.getByLabelText("Cantidad *"), { target: { value: "10" } });
    fireEvent.click(screen.getByText("Agregar acción"));

    expect(screen.getByText("Faltan 30 de 40 unidades por asignar.")).toBeInTheDocument();
    expect(screen.getByText("Confirmar")).toBeDisabled();

    fireEvent.change(screen.getAllByRole("combobox").at(-1), { target: { value: "descartado" } });
    fireEvent.change(screen.getByLabelText("Cantidad *"), { target: { value: "30" } });
    fireEvent.click(screen.getByText("Agregar acción"));

    expect(screen.getByText("Todas las unidades quedaron asignadas.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Confirmar"));

    expect(mockEstadoHook.marcarComoAtendida).toHaveBeenCalledWith(
      "a-1",
      [
        expect.objectContaining({ accion: "donado", cantidad: 10 }),
        expect.objectContaining({ accion: "descartado", cantidad: 30 }),
      ],
      40,
    );
  });

  // Camino de error (issue #759/#777): si marcarComoAtendida() falla, el modal se queda abierto
  // con el error visible -- no se cierra en silencio como si la accion se hubiera registrado.
  it("camino de error: si marcarComoAtendida() falla, muestra el error y el modal sigue abierto", async () => {
    mockEstadoHook.porVencer = [ALERTA_POR_VENCER];
    mockEstadoHook.marcarComoAtendida = vi.fn(async () => {
      throw new Error("No se pudo registrar la accion.");
    });
    pantalla();

    fireEvent.click(screen.getByText("Atender"));
    fireEvent.change(screen.getAllByRole("combobox").at(-1), { target: { value: "descartado" } });
    fireEvent.change(screen.getByLabelText("Cantidad *"), { target: { value: "40" } });
    fireEvent.click(screen.getByText("Agregar acción"));
    fireEvent.click(screen.getByText("Confirmar"));

    expect(await screen.findByText("No se pudo registrar la accion.")).toBeInTheDocument();
    expect(screen.getByText("Registrar Acción Tomada")).toBeInTheDocument();
  });

  // Issue #755: lo atendido queda a la vista, con la accion, quien y cuando.
  it("muestra las alertas atendidas con la accion tomada y quien la atendio", () => {
    mockEstadoHook.atendidas = [
      {
        id: "a-3",
        medicamento: "Ibuprofeno",
        numeroLote: "LOTE-3",
        accion: "donado",
        atendidaPorNombre: "Ana Prueba",
        atendidaEn: "2026-09-10T15:00:00Z",
      },
    ];
    pantalla();

    expect(screen.getByText("Atendidas recientemente (1)")).toBeInTheDocument();
    expect(screen.getByText("Donado")).toBeInTheDocument();
    expect(screen.getByText("Ana Prueba")).toBeInTheDocument();
  });

  it("si el historial falla lo dice en su bloque, sin tapar las pendientes", () => {
    mockEstadoHook.porVencer = [ALERTA_POR_VENCER];
    mockEstadoHook.errorAtendidas = { mensaje: "No se pudo cargar el historial." };
    pantalla();

    expect(screen.getByText("No se pudo cargar el historial.")).toBeInTheDocument();
    expect(screen.getByText("Loratadina")).toBeInTheDocument();
  });

  // Issue #755: atender mueve o da de baja el stock, y se dice antes de confirmar.
  it("al elegir descartado y una cantidad, avisa que se dan de baja las unidades", () => {
    mockEstadoHook.porVencer = [ALERTA_POR_VENCER];
    pantalla();

    fireEvent.click(screen.getByText("Atender"));
    fireEvent.change(screen.getAllByRole("combobox").at(-1), { target: { value: "descartado" } });
    fireEvent.change(screen.getByLabelText("Cantidad *"), { target: { value: "40" } });

    expect(screen.getByText(/Se dan de baja 40 unidades del lote/)).toBeInTheDocument();
  });

  it("reubicar exige elegir la bodega destino y la manda al hook", async () => {
    mockEstadoHook.porVencer = [ALERTA_POR_VENCER];
    pantalla();

    fireEvent.click(screen.getByText("Atender"));
    fireEvent.change(screen.getAllByRole("combobox").at(-1), { target: { value: "reubicado" } });
    fireEvent.change(screen.getByLabelText("Cantidad *"), { target: { value: "40" } });

    expect(screen.getByText("Agregar acción")).toBeDisabled();

    fireEvent.change(screen.getAllByRole("combobox").at(-1), { target: { value: "b-1" } });
    fireEvent.click(screen.getByText("Agregar acción"));
    fireEvent.click(screen.getByText("Confirmar"));

    expect(mockEstadoHook.marcarComoAtendida).toHaveBeenCalledWith(
      "a-1",
      [expect.objectContaining({ accion: "reubicado", cantidad: 40, bodegaDestinoId: "b-1" })],
      40,
    );
  });

  it("un lote vencido no ofrece reubicar", () => {
    mockEstadoHook.vencidas = [ALERTA_VENCIDA];
    pantalla();

    fireEvent.click(screen.getByText("Registrar baja"));

    const opciones = [...screen.getAllByRole("combobox").at(-1).querySelectorAll("option")].map(
      (o) => o.value,
    );
    expect(opciones).not.toContain("reubicado");
    expect(opciones).toContain("descartado");
  });
});
