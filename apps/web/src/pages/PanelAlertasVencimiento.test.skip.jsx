import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

//  1. Importamos la función real
import { useAlertasVencimiento } from "@ecopac/shared";

//  2. La convertimos en mock con la función oficial de Vitest
const mockHook = vi.mocked(useAlertasVencimiento);

describe("PanelAlertasVencimiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("muestra lista de alertas cuando hay datos", async () => {
    //  3. Definimos el valor exacto ANTES de renderizar
    mockHook.mockReturnValue({
      alertas: [{ id: 1, mensaje: "Alerta de vencimiento próximo", fecha: "2026-09-24" }],
      cargando: false,
      error: null,
    });

    //  4. Importamos y renderizamos
    const { default: PanelAlertasVencimiento } = await import("./PanelAlertasVencimiento.jsx");
    render(<PanelAlertasVencimiento />);

    // Esperamos que cambie el contenido
    await vi.waitFor(() => {
      expect(screen.queryByText(/No se encontraron resultados/i)).not.toBeInTheDocument();
    });

    expect(await screen.findByText(/Alerta de vencimiento próximo/i)).toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay alertas", async () => {
    mockHook.mockReturnValue({
      alertas: [],
      cargando: false,
      error: null,
    });

    const { default: PanelAlertasVencimiento } = await import("./PanelAlertasVencimiento.jsx");
    render(<PanelAlertasVencimiento />);

    expect(await screen.findByText(/No se encontraron resultados/i)).toBeInTheDocument();
  });

  it("muestra estado de carga", async () => {
    mockHook.mockReturnValue({
      alertas: [],
      cargando: true,
      error: null,
    });

    const { default: PanelAlertasVencimiento } = await import("./PanelAlertasVencimiento.jsx");
    render(<PanelAlertasVencimiento />);

    expect(await screen.findByText(/cargando/i)).toBeInTheDocument();
  });
});
