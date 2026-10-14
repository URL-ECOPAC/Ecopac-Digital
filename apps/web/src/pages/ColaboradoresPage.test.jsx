// Pruebas de ColaboradoresPage (issue #864).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ColaboradoresPage from "./ColaboradoresPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const FILTROS_VACIOS = { busqueda: "", rol: null, estado: null, especialidad: null };

const PERSONA = {
  id: "p-1",
  nombres: "Mario",
  apellidos: "Medico",
  nombreCompleto: "Mario Medico",
  email: "mario@ejemplo.test",
  rol: "medico",
  activo: true,
  especialidades: [],
  jornadas: 2,
};

const HISTORIAL = [
  { id: "j-1", nombre: "Jornada El Rosario", fecha: "2026-08-23", estado: "finalizada" },
  { id: "j-2", nombre: "Jornada Vista Hermosa", fecha: "2026-09-22", estado: "en curso" },
];

const estadoListado = {
  filas: [PERSONA],
  filtros: { ...FILTROS_VACIOS },
  setFiltro: vi.fn(),
  limpiarFiltros: vi.fn(),
  hayFiltros: false,
  cargando: false,
  error: null,
  recargar: vi.fn(),
  pagina: 1,
  paginas: 1,
  total: 1,
  hayPaginaAnterior: false,
  hayPaginaSiguiente: false,
  irAPaginaAnterior: vi.fn(),
  irAPaginaSiguiente: vi.fn(),
  catalogos: { roles: [], estadoUsuario: [], especialidades: [] },
};

vi.mock("../../../../packages/shared/usuarios/useUsuariosListado.js", async (original) => {
  const real = await original();
  return { ...real, useUsuariosListado: vi.fn(() => estadoListado) };
});

vi.mock("../../../../packages/shared/usuarios/useHistorialDePersona.js", () => ({
  useHistorialDePersona: vi.fn(() => ({
    historial: HISTORIAL,
    cargando: false,
    error: null,
    recargar: vi.fn(),
  })),
}));

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador", perfil: { id: "admin-1" } }),
}));

function pantalla() {
  return render(<ColaboradoresPage />);
}

function botonLimpiar() {
  return screen.getByRole("button", { name: "Limpiar filtros" });
}

describe("ColaboradoresPage - Limpiar filtros (issue #864)", () => {
  afterEach(() => {
    estadoListado.filtros = { ...FILTROS_VACIOS };
    estadoListado.hayFiltros = false;
    estadoListado.filas = [PERSONA];
    estadoListado.total = 1;
    estadoListado.limpiarFiltros = vi.fn();
  });

  // Mismo criterio que FichaPacientePage.test.jsx para el resto del sistema: el boton no
  // aparece y desaparece, esta siempre y se apaga.
  it("el boton esta siempre, deshabilitado mientras no hay nada que limpiar", () => {
    pantalla();

    expect(botonLimpiar()).toBeDisabled();
  });

  it("se habilita cuando hay un filtro puesto y llama a limpiarFiltros", () => {
    estadoListado.hayFiltros = true;
    estadoListado.filtros = { ...FILTROS_VACIOS, rol: "medico" };
    pantalla();

    const boton = botonLimpiar();
    expect(boton).toBeEnabled();

    fireEvent.click(boton);
    expect(estadoListado.limpiarFiltros).toHaveBeenCalledTimes(1);
  });

  // El defecto original: el unico "Limpiar filtros" vivia debajo de la lista y solo salia con
  // cero resultados. Ahora tambien sale ahi, pero como accion del estado vacio, y el de la
  // barra sigue estando.
  it("con cero resultados el estado vacio ofrece limpiar, y el de la barra sigue ahi", () => {
    estadoListado.hayFiltros = true;
    estadoListado.filtros = { ...FILTROS_VACIOS, busqueda: "zzz" };
    estadoListado.filas = [];
    estadoListado.total = 0;
    pantalla();

    expect(screen.getAllByRole("button", { name: "Limpiar filtros" })).toHaveLength(2);
  });
});

describe("ColaboradoresPage - historial de jornadas (issue #864)", () => {
  it("muestra el estado de cada jornada en mayusculas, con la etiqueta del enum", () => {
    pantalla();

    fireEvent.click(screen.getByText("Mario Medico"));
    fireEvent.click(screen.getByRole("button", { name: "Historial" }));

    // El texto del DOM se conserva -- es lo que lee un lector de pantalla -- y la caja alta la
    // pone text-uppercase, que es lo que se ve en pantalla.
    const chip = screen.getByText("Finalizada");
    expect(chip).toHaveClass("text-uppercase");
    expect(screen.getByText("En curso")).toHaveClass("text-uppercase");
  });
});
