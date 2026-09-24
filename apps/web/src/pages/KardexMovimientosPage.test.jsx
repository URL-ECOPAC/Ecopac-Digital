/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import KardexMovimientosPage from "./KardexMovimientosPage";

describe("KardexMovimientosPage", () => {
  it("se renderiza sin fallar y muestra el título", () => {
    render(<KardexMovimientosPage />);
    const titulo = screen.getByRole("heading", { name: /Historial de Movimientos/i });
    expect(titulo).toBeTruthy(); //  Sin jest-dom
  });

  it("muestra los filtros", () => {
    render(<KardexMovimientosPage />);
    const etiquetas = screen.getAllByText(/Tipo de movimiento/i);
    expect(etiquetas.length).toBeGreaterThan(0);
  });
});
