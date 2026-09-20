// Prueba de CatalogoCondicionesPage (issue #850).
// @vitest-environment jsdom
//
// Lo que se comprueba aqui es lo que solo se ve montando el componente: que los dos permisos de
// la 00140 -- dar de alta y mantener -- produzcan interfaces distintas, y que un fallo de la
// consulta muestre el error en vez de una lista vacia, que es el hueco que documenta
// docs/PLAN-DE-PRUEBAS.md.
//
// Que el reparto de permisos sea el correcto se prueba en packages/shared
// (catalogoCondiciones.test.js) y contra la base en escritura_catalogo_condiciones.sql. Aqui se
// prueba la pantalla, no la regla.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

const { navegar, sesion, estadoHook } = vi.hoisted(() => ({
  navegar: vi.fn(),
  sesion: { rol: "administrador" },
  estadoHook: {},
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navegar,
}));

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

vi.mock("@ecopac/shared", async (importOriginal) => ({
  ...(await importOriginal()),
  useCatalogoCondiciones: vi.fn(() => estadoHook),
}));

const CatalogoCondicionesPage = (await import("./CatalogoCondicionesPage")).default;

const CONDICIONES = [
  { id: "cc-1", nombre: "Diabetes", esVigente: true },
  { id: "cc-2", nombre: "Epilepsia", esVigente: false },
];

function estado(extra = {}) {
  Object.assign(estadoHook, {
    filas: CONDICIONES,
    total: CONDICIONES.length,
    filtros: { busqueda: "" },
    setFiltro: vi.fn(),
    limpiarFiltros: vi.fn(),
    hayFiltros: false,
    cargando: false,
    error: null,
    enviando: false,
    erroresForm: {},
    recargar: vi.fn(),
    permitido: true,
    puedeCrear: true,
    puedeMantener: true,
    crear: vi.fn(async () => ({ ok: true })),
    editar: vi.fn(async () => ({ ok: true })),
    alternarVigencia: vi.fn(async () => ({ ok: true })),
    catalogos: {
      estadoCondicionCatalogo: [
        { value: true, clave: "activo", label: "Activo" },
        { value: false, clave: "inactivo", label: "Inactivo" },
      ],
    },
    ...extra,
  });
  return estadoHook;
}

afterEach(() => {
  cleanup();
  for (const clave of Object.keys(estadoHook)) delete estadoHook[clave];
  sesion.rol = "administrador";
  navegar.mockClear();
});

describe("CatalogoCondicionesPage", () => {
  it("lista el catalogo con su estado de vigencia", () => {
    estado();
    render(<CatalogoCondicionesPage />);

    expect(screen.getByText("Diabetes")).toBeInTheDocument();
    expect(screen.getByText("Epilepsia")).toBeInTheDocument();
    expect(screen.getByText("2 condiciones")).toBeInTheDocument();
  });

  it("quien atiende puede dar de alta", () => {
    estado({ puedeCrear: true });
    render(<CatalogoCondicionesPage />);

    expect(screen.getByText("Nueva condición")).toBeInTheDocument();
  });

  it("quien no escribe el catalogo no ve el alta", () => {
    estado({ puedeCrear: false, puedeMantener: false });
    render(<CatalogoCondicionesPage />);

    expect(screen.queryByText("Nueva condición")).not.toBeInTheDocument();
  });

  it("el medico da de alta pero no abre una fila para editarla", () => {
    // Las dos politicas de la 00140 no coinciden, y la pantalla tiene que reflejarlo: ofrecer
    // "Editar" a quien el UPDATE filtra seria prometer un cambio que se pierde en silencio.
    estado({ puedeCrear: true, puedeMantener: false });
    render(<CatalogoCondicionesPage />);

    expect(screen.getByText("Nueva condición")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Diabetes"));
    expect(screen.queryByText("Editar condición")).not.toBeInTheDocument();
  });

  it("la administradora abre una fila para renombrarla o retirarla", () => {
    estado({ puedeMantener: true });
    render(<CatalogoCondicionesPage />);

    fireEvent.click(screen.getByText("Diabetes"));

    expect(screen.getByText("Editar condición")).toBeInTheDocument();
    expect(screen.getByText("Retirar")).toBeInTheDocument();
  });

  it("una condicion ya retirada se ofrece reactivar, no retirar de nuevo", () => {
    estado({ puedeMantener: true });
    render(<CatalogoCondicionesPage />);

    fireEvent.click(screen.getByText("Epilepsia"));

    expect(screen.getByText("Reactivar")).toBeInTheDocument();
  });

  it("si la consulta falla muestra el error, no una lista vacia", () => {
    estado({ error: { mensaje: "No hay conexion" }, filas: [], total: 0 });
    render(<CatalogoCondicionesPage />);

    expect(screen.getByText("No hay conexion")).toBeInTheDocument();
    expect(
      screen.queryByText("Todavia no hay condiciones en el catalogo."),
    ).not.toBeInTheDocument();
  });

  it("un rol sin acceso al catalogo ve el aviso, no la tabla", () => {
    estado({ permitido: false });
    render(<CatalogoCondicionesPage />);

    expect(screen.getByText(/No tienes acceso al catalogo/)).toBeInTheDocument();
    expect(screen.queryByText("Diabetes")).not.toBeInTheDocument();
  });

  it("el catalogo vacio lo dice, en vez de dejar la tabla muda", () => {
    estado({ filas: [], total: 0 });
    render(<CatalogoCondicionesPage />);

    expect(screen.getByText("Todavia no hay condiciones en el catalogo.")).toBeInTheDocument();
  });

  it("Volver regresa al modulo de pacientes", () => {
    estado();
    render(<CatalogoCondicionesPage />);

    fireEvent.click(screen.getByText("Volver"));

    expect(navegar).toHaveBeenCalledWith("/pacientes");
  });
});
