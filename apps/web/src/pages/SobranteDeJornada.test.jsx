// Prueba de SobranteDeJornada (00160): lo que sobro de cada aporte de una jornada finalizada se
// devuelve o se pasa a otra jornada del proyecto.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import SobranteDeJornada from "./SobranteDeJornada";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const FILA = {
  origenId: "o1",
  origen: "donacion",
  etiqueta: "Donación en dinero",
  detalle: "Donante de prueba",
  monto: 300,
  devuelto: 0,
  usado: 200,
  sobrante: 100,
};

function estado(cambios = {}) {
  return {
    visible: true,
    puedeLiquidar: true,
    cargando: false,
    error: null,
    filas: [FILA],
    liquidados: [],
    totalSobrante: 100,
    hayGastosPendientes: false,
    jornadasDestino: [{ value: "j2", label: "Jornada B · 10/10/2026" }],
    opcionesDeDestino: () => [
      { value: "devolver", label: "Devolver a la donación" },
      { value: "traspasar", label: "Pasar a otra jornada del proyecto" },
    ],
    decisiones: {},
    errores: {},
    setDestino: vi.fn(),
    setJornadaDestino: vi.fn(),
    liquidar: vi.fn(),
    liquidando: false,
    errorAlLiquidar: null,
    recargar: vi.fn(),
    ...cambios,
  };
}

let mockEstado = estado();

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useSobranteDeJornada: vi.fn(() => mockEstado),
}));

function pantalla() {
  return render(
    <SobranteDeJornada jornada={{ id: "j1", estado: "finalizada" }} rol="administrador" />,
  );
}

describe("SobranteDeJornada", () => {
  it("muestra cuanto sobra de cada aporte y por defecto lo devuelve", () => {
    mockEstado = estado();
    pantalla();

    expect(screen.getByText("Donación en dinero")).toBeInTheDocument();
    expect(screen.getByLabelText("Qué hacer")).toHaveValue("devolver");
    expect(screen.queryByLabelText("Jornada que lo recibe")).not.toBeInTheDocument();
  });

  it("al traspasar pide la jornada que lo recibe", () => {
    mockEstado = estado({ decisiones: { o1: { destino: "traspasar", jornadaDestinoId: null } } });
    pantalla();

    fireEvent.change(screen.getByLabelText("Jornada que lo recibe"), { target: { value: "j2" } });

    expect(mockEstado.setJornadaDestino).toHaveBeenCalledWith("o1", "j2");
  });

  it("Liquidar sobrante llama a liquidar()", () => {
    mockEstado = estado();
    pantalla();

    fireEvent.click(screen.getByRole("button", { name: /Liquidar sobrante/ }));

    expect(mockEstado.liquidar).toHaveBeenCalled();
  });

  it("con gastos pendientes avisa y no deja liquidar", () => {
    mockEstado = estado({ hayGastosPendientes: true });
    pantalla();

    expect(screen.getByText(/Hay gastos pendientes de aprobar/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Liquidar sobrante/ })).toBeDisabled();
  });

  it("sin sobrante lo dice en vez de ofrecer liquidar", () => {
    mockEstado = estado({ filas: [], totalSobrante: 0 });
    pantalla();

    expect(screen.getByText(/no hay sobrante/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Liquidar sobrante/ })).not.toBeInTheDocument();
  });

  it("fuera de una jornada finalizada no se muestra", () => {
    mockEstado = estado({ visible: false });
    const { container } = pantalla();

    expect(container).toBeEmptyDOMElement();
  });
});
