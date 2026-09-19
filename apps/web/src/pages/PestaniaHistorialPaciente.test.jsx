// Prueba de PestaniaHistorialPaciente: el historial como lista de visitas (issue #840, bloque F).
// @vitest-environment jsdom
//
// Antes eran eventos sueltos -triaje, consulta, receta- y los signos y las recetas ademas en
// pestanas hermanas. Lo que se comprueba aqui es que cada visita traiga DENTRO sus tres partes, y
// que editarla abra el mismo formulario que la consulta nueva.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import PestaniaHistorialPaciente from "./PestaniaHistorialPaciente";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const mockVisitas = {
  visitas: [],
  filtros: { desde: "", hasta: "" },
  setFiltro: vi.fn(),
  limpiarFiltros: vi.fn(),
  hayFiltros: false,
  cargando: false,
  error: null,
  recargar: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useVisitasPaciente: vi.fn(() => mockVisitas),
  useRecetasPaciente: vi.fn(() => ({ recetas: [], recargar: vi.fn() })),
}));

vi.mock("./PestaniaSignosPaciente", () => ({ default: () => <div>grafica de signos</div> }));

const VISITA = {
  atencionId: "at-1",
  jornada: "Jornada enero",
  comunidad: "Santa Cruz",
  fecha: "2026-01-10",
  signos: { id: "tri-1", presionSistolica: 120, presionDiastolica: 80 },
  consulta: {
    id: "con-1",
    motivoConsulta: "Dolor de garganta",
    diagnosticos: [{ codigo: "J02", nombre: "Faringitis aguda" }],
    profesional: "Dr. Perez",
  },
  diagnosticoPrincipal: { nombre: "Faringitis aguda" },
  recetas: [],
};

function pantalla(props = {}) {
  return render(
    <PestaniaHistorialPaciente paciente={{ id: "p-1" }} rol="medico" perfilId="per-1" {...props} />,
  );
}

describe("PestaniaHistorialPaciente", () => {
  afterEach(() => {
    mockVisitas.visitas = [];
    mockVisitas.cargando = false;
    mockVisitas.error = null;
    mockVisitas.hayFiltros = false;
    mockVisitas.recargar.mockClear();
    mockVisitas.limpiarFiltros.mockClear();
  });

  it("sin visitas explica que no hay ninguna", () => {
    pantalla();
    expect(
      screen.getByText("Este paciente todavía no tiene visitas registradas."),
    ).toBeInTheDocument();
  });

  it("con filtros activos y sin resultados, ofrece limpiarlos", () => {
    mockVisitas.hayFiltros = true;
    pantalla();

    fireEvent.click(screen.getByText("Limpiar filtros"));
    expect(mockVisitas.limpiarFiltros).toHaveBeenCalled();
  });

  it("la visita trae dentro sus signos, su consulta y su receta", () => {
    mockVisitas.visitas = [VISITA];
    pantalla();

    // La mas reciente se abre sola.
    expect(screen.getByText("Jornada enero")).toBeInTheDocument();
    expect(screen.getByText("Signos vitales")).toBeInTheDocument();
    expect(screen.getByText("120/80 mmHg")).toBeInTheDocument();
    expect(screen.getByText("Dolor de garganta")).toBeInTheDocument();
    expect(screen.getByText("Sin receta.")).toBeInTheDocument();
  });

  it("una visita sin signos lo dice, en vez de esconder la parte", () => {
    mockVisitas.visitas = [{ ...VISITA, signos: null }];
    pantalla();

    expect(screen.getByText("No se tomaron signos en esta visita.")).toBeInTheDocument();
  });

  it("Editar entrega la visita a quien abre el formulario de consulta", () => {
    mockVisitas.visitas = [VISITA];
    const onEditarVisita = vi.fn();
    pantalla({ onEditarVisita });

    fireEvent.click(screen.getByText("Editar"));
    expect(onEditarVisita).toHaveBeenCalledWith(VISITA);
  });

  it("la evolucion de los signos se ve desde el mismo historial", () => {
    pantalla();

    fireEvent.click(screen.getByText("Ver la evolución de los signos"));
    expect(screen.getByText("grafica de signos")).toBeInTheDocument();
  });

  it("camino de error: muestra el error con reintento, no una lista vacia", () => {
    mockVisitas.error = { mensaje: "No se pudo cargar el historial." };
    pantalla();

    expect(screen.getByText("No se pudo cargar el historial.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reintentar"));
    expect(mockVisitas.recargar).toHaveBeenCalled();
  });
});
