// Prueba de PestaniaRecetasPaciente (Modulo I: receta, viendo en web, issue #776).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { contarRecetas } from "@ecopac/shared";

import PestaniaRecetasPaciente from "./PestaniaRecetasPaciente";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const RECETA_DE_EJEMPLO = {
  id: "r-1",
  folio: "REC-0001",
  estado: "emitida",
  createdAt: "2026-01-10T09:00:00Z",
  jornada: "Jornada enero",
  medico: "Perez",
  anulada: false,
  detalle: [
    {
      id: "d-1",
      medicamento: "Loratadina",
      concentracion: "10mg",
      dosis: "1 tableta",
      frecuencia: "cada 12 horas",
      cantidadEntregada: 5,
    },
  ],
};

const mockEstadoHook = {
  recetas: [],
  conteo: contarRecetas([]),
  cargando: false,
  error: null,
  recargar: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useRecetasPaciente: vi.fn(() => mockEstadoHook),
}));

const { useRecetasPaciente } = await import("@ecopac/shared");

function pantalla() {
  return render(<PestaniaRecetasPaciente paciente={{ id: "p-1", nombres: "Ana" }} rol="medico" />);
}

describe("PestaniaRecetasPaciente", () => {
  afterEach(() => {
    mockEstadoHook.recetas = [];
    mockEstadoHook.conteo = contarRecetas([]);
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    useRecetasPaciente.mockClear();
    mockEstadoHook.recargar.mockClear();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("sin recetas, muestra el vacio", () => {
    pantalla();

    expect(
      screen.getByText("Este paciente todavia no tiene recetas emitidas."),
    ).toBeInTheDocument();
  });

  it("con una receta, pinta el folio, el conteo y el detalle al expandir", () => {
    mockEstadoHook.recetas = [RECETA_DE_EJEMPLO];
    mockEstadoHook.conteo = contarRecetas([RECETA_DE_EJEMPLO]);
    pantalla();

    expect(screen.getByText("REC-0001")).toBeInTheDocument();
    expect(screen.getByText("1 receta")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ver detalle"));
    expect(screen.getByText(/Loratadina/)).toBeInTheDocument();
  });

  it("una receta anulada se marca y muestra el motivo", () => {
    const anulada = {
      ...RECETA_DE_EJEMPLO,
      id: "r-2",
      folio: "REC-0002",
      anulada: true,
      anuladaEn: "2026-01-12",
      motivoAnulacion: "Error de digitacion",
    };
    mockEstadoHook.recetas = [anulada];
    mockEstadoHook.conteo = contarRecetas([anulada]);
    pantalla();

    expect(screen.getByText("Receta anulada")).toBeInTheDocument();
    expect(screen.getByText(/Error de digitacion/)).toBeInTheDocument();
  });

  // Camino de error (issue #759/#776): si la consulta de recetas falla, la pantalla tiene que
  // mostrar el error, no el mensaje de "no tiene recetas emitidas" (que diria algo falso).
  it("camino de error: si la consulta falla, muestra el error y no el vacio", () => {
    mockEstadoHook.error = { mensaje: "No se pudieron cargar las recetas." };
    pantalla();

    expect(screen.getByText("No se pudieron cargar las recetas.")).toBeInTheDocument();
    expect(
      screen.queryByText("Este paciente todavia no tiene recetas emitidas."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockEstadoHook.recargar).toHaveBeenCalled();
  });
});
