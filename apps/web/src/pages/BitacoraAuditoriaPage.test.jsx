// Prueba de BitacoraAuditoriaPage (issue #643).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import BitacoraAuditoriaPage from "./BitacoraAuditoriaPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const EVENTO_DE_EJEMPLO = {
  id: 1,
  tablaAfectada: "pacientes",
  filaId: "pac-1",
  operacion: "actualizacion",
  realizadoPor: "u1",
  realizadoPorNombre: "Ana López",
  realizadoEn: "2026-09-19T10:00:00Z",
  valoresAnteriores: { nombres: "Juan" },
  valoresNuevos: { nombres: "Juan Carlos" },
};

const mockEstadoHook = {
  filas: [EVENTO_DE_EJEMPLO],
  total: 1,
  filtros: { usuarioId: null, tablaAfectada: null, fecha: { min: null, max: null } },
  setFiltro: vi.fn(),
  limpiarFiltros: vi.fn(),
  cargando: false,
  error: null,
  recargar: vi.fn(),
  pagina: 1,
  paginas: 1,
  hayPaginaAnterior: false,
  hayPaginaSiguiente: false,
  irAPaginaAnterior: vi.fn(),
  irAPaginaSiguiente: vi.fn(),
  catalogos: {
    perfiles: [{ value: "u1", label: "Ana López" }],
    operaciones: [{ value: "actualizacion", clave: "actualizacion", label: "Actualización" }],
    tablas: [{ value: "pacientes", label: "Pacientes" }],
  },
};

vi.mock("../../../../packages/shared/auditoria/useBitacoraAuditoria.js", () => ({
  useBitacoraAuditoria: vi.fn(() => mockEstadoHook),
}));

const { useBitacoraAuditoria } =
  await import("../../../../packages/shared/auditoria/useBitacoraAuditoria.js");

function pantalla() {
  return render(<BitacoraAuditoriaPage />);
}

describe("BitacoraAuditoriaPage", () => {
  afterEach(() => {
    mockEstadoHook.filas = [EVENTO_DE_EJEMPLO];
    mockEstadoHook.total = 1;
    mockEstadoHook.filtros = {
      usuarioId: null,
      tablaAfectada: null,
      fecha: { min: null, max: null },
    };
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.pagina = 1;
    mockEstadoHook.paginas = 1;
    mockEstadoHook.hayPaginaAnterior = false;
    mockEstadoHook.hayPaginaSiguiente = false;
    mockEstadoHook.setFiltro = vi.fn();
    mockEstadoHook.irAPaginaAnterior = vi.fn();
    mockEstadoHook.irAPaginaSiguiente = vi.fn();
    useBitacoraAuditoria.mockClear();
  });

  it("pinta el titulo de la pantalla", () => {
    pantalla();

    expect(screen.getByText("Bitácora de auditoría")).toBeInTheDocument();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("si hay error, lo muestra en vez de la tabla", () => {
    mockEstadoHook.error = { mensaje: "No se pudo cargar la bitácora." };
    pantalla();

    expect(screen.getByText("No se pudo cargar la bitácora.")).toBeInTheDocument();
  });

  it("pinta una fila con el usuario y la tabla afectada", () => {
    pantalla();

    expect(screen.getByRole("cell", { name: "Ana López" })).toBeInTheDocument();
    // ISSUE #864: la columna Tabla muestra la etiqueta de TABLAS_AUDITADAS, no el nombre de la
    // tabla de Postgres.
    expect(screen.getByRole("cell", { name: "Pacientes" })).toBeInTheDocument();
  });

  // ISSUE #864. La caja alta la pone `text-uppercase` sobre la celda, no `.toUpperCase()` sobre
  // el dato: el texto del DOM -- lo que lee un lector de pantalla y lo que sale en una
  // exportacion -- sigue siendo el original.
  it("usuario, tabla y operacion se ven en mayusculas; la fecha no", () => {
    pantalla();

    expect(screen.getByRole("cell", { name: "Ana López" })).toHaveClass("text-uppercase");
    expect(screen.getByRole("cell", { name: "Pacientes" })).toHaveClass("text-uppercase");
    expect(screen.getByText("Actualización").closest("td")).toHaveClass("text-uppercase");

    const celdaDeFecha = screen.getAllByRole("cell")[0];
    expect(celdaDeFecha).not.toHaveClass("text-uppercase");
  });

  it("un evento sin eventos muestra el vacio, no un error", () => {
    mockEstadoHook.filas = [];
    mockEstadoHook.total = 0;
    pantalla();

    expect(screen.getByText("Todavía no hay eventos registrados.")).toBeInTheDocument();
  });

  it("Ver detalle abre el modal con el diff de antes y despues", () => {
    pantalla();

    fireEvent.click(screen.getByText("Ver detalle"));

    expect(screen.getByText("Detalle del evento")).toBeInTheDocument();
    expect(screen.getByText(/pac-1/)).toBeInTheDocument();
    expect(screen.getByText("Nombres")).toBeInTheDocument();
    expect(screen.getByText("Juan")).toBeInTheDocument();
    expect(screen.getByText("Juan Carlos")).toBeInTheDocument();
  });

  it("con una sola pagina no muestra el pie de paginacion", () => {
    pantalla();

    expect(screen.queryByText(/Pagina 1 de/)).not.toBeInTheDocument();
  });

  it("con varias paginas, Siguiente llama a irAPaginaSiguiente", () => {
    mockEstadoHook.paginas = 3;
    mockEstadoHook.hayPaginaSiguiente = true;
    pantalla();

    expect(screen.getByText("Pagina 1 de 3")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Siguiente"));

    expect(mockEstadoHook.irAPaginaSiguiente).toHaveBeenCalled();
  });
});
