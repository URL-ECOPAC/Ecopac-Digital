// Prueba de TablaGastos: con un filtro que no encuentra nada, la barra de filtros y el alta se
// quedan a la vista (antes la pestana entera se cambiaba por "No hay gastos registrados").
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import TablaGastos from "./TablaGastos";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

vi.mock("./ModalGasto", () => ({ default: () => null }));

function pantalla(props = {}) {
  return render(
    <TablaGastos
      gastos={[]}
      catalogos={{}}
      filtroEstado=""
      cambiarFiltroEstado={vi.fn()}
      cargando={false}
      error={null}
      recargar={vi.fn()}
      puedeCrear
      usuarioId="perfil-1"
      rol="administrador"
      {...props}
    />,
  );
}

describe("TablaGastos", () => {
  it("con un filtro de estado sin resultados, conserva los filtros y el alta", () => {
    pantalla({ filtroEstado: "pendiente" });

    expect(screen.getByText("No hay gastos que coincidan con estos filtros.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar gasto/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Limpiar filtros/ })).toBeInTheDocument();
  });

  it("sin gastos y sin filtros, dice que todavia no hay gastos", () => {
    pantalla();

    expect(screen.getByText("Todavía no hay gastos registrados.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Registrar gasto/ })).toBeInTheDocument();
  });

  it("el estado pendiente se ofrece con mayuscula inicial", () => {
    pantalla();

    expect(screen.getByRole("option", { name: "Pendiente" })).toBeInTheDocument();
  });
});
