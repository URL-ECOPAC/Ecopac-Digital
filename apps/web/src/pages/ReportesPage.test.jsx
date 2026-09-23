// Prueba de ReportesPage (Modulo IV: hub de reportes / medicamentos por vencer, issue #779).
//
// La pestaña "Dashboard de impacto" monta DashboardMetricasPage.jsx de verdad, que ya tiene su
// propia prueba; aqui se mockea su hook solo para que la pestaña por defecto no reviente, y el
// grueso de esta prueba se concentra en la pestaña "Medicamentos por vencer".
//
// ISSUE #862: los hooks se mockean por el BARRIL "@ecopac/shared" y no por su ruta relativa
// ("../../../../packages/shared/reportes/useX.js"), que es como estaban. Esa forma dejo de
// interceptar en cuanto las paginas empezaron a importar del barril -- y es el mismo import por
// ruta relativa que el comentario de reportes/index.js señala como parte de por que los defectos
// de este modulo no los detectaba nadie.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import ReportesPage from "./ReportesPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

const mockEstadoDashboard = {
  tieneAcceso: true,
  cargando: false,
  error: null,
  indicadores: {},
  seriePrincipal: [],
  serieComparacion: [],
  calcularVariacion: vi.fn(),
  rangosDisponibles: [],
  rangoSeleccionado: "mes",
  setRangoSeleccionado: vi.fn(),
  agrupamientosDisponibles: [],
  agruparPor: "mes",
  setAgruparPor: vi.fn(),
  metricasDisponibles: [{ value: "pacientes_atendidos", label: "Pacientes atendidos" }],
  metrica: "pacientes_atendidos",
  setMetrica: vi.fn(),
  comunidadId: "__todas__",
  setComunidadId: vi.fn(),
  modoComparacion: false,
  setModoComparacion: vi.fn(),
  comunidadCompararId: "__ninguna__",
  setComunidadCompararId: vi.fn(),
  listaComunidades: [],
  valoresEspeciales: { TODAS: "__todas__", NINGUNA: "__ninguna__" },
  recargar: vi.fn(),
};

const mockEstadoVencimientos = {
  tieneAcceso: true,
  cargando: false,
  error: null,
  renglones: [],
  total: 0,
  totalUnidadesEnRiesgo: 0,
  columnas: [
    { id: "medicamento", label: "Medicamento", principal: true, ordenable: true },
    { id: "cantidad", label: "Cantidad", tipo: "numero", ordenable: true },
  ],
  definicionDeFiltros: [],
  filtros: { horizonteDias: 30, bodega: null, medicamento: null, estadoVencimiento: null },
  setFiltro: vi.fn(),
  limpiarFiltros: vi.fn(),
  hayFiltros: false,
  catalogos: {},
  orden: null,
  alternarOrden: vi.fn(),
  numeroDePagina: 1,
  totalPaginas: 1,
  irAPagina: vi.fn(),
  recargar: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useDashboardMetricas: vi.fn(() => mockEstadoDashboard),
  useReporteMedicamentosPorVencer: vi.fn(() => mockEstadoVencimientos),
  // Solo para que la pestana de pacientes atendidos se pueda montar: su contenido tiene su propia
  // prueba (ReportePacientesPage.test.jsx). Aqui interesa que las pestanas sigan ahi.
  useReportePacientes: vi.fn(() => ({ tieneAcceso: false })),
}));

function pantalla(ruta = "/reportes") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ReportesPage />
    </MemoryRouter>,
  );
}

function irAVencimientos() {
  fireEvent.click(screen.getByText("Medicamentos por vencer"));
}

describe("ReportesPage", () => {
  afterEach(() => {
    mockEstadoVencimientos.cargando = false;
    mockEstadoVencimientos.error = null;
    mockEstadoVencimientos.renglones = [];
    mockEstadoVencimientos.total = 0;
    mockEstadoVencimientos.totalUnidadesEnRiesgo = 0;
    mockEstadoVencimientos.hayFiltros = false;
    mockEstadoVencimientos.recargar.mockClear();
    mockEstadoVencimientos.alternarOrden.mockClear();
  });

  it("por defecto, muestra la pestaña de Dashboard de Impacto", () => {
    pantalla();

    expect(
      screen.getByRole("heading", { level: 1, name: "Reportes e impacto" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dashboard de impacto").closest("a")).toHaveClass("active");
  });

  // "Pacientes atendidos" navegaba a una pagina suelta, sin las pestanas, y desde ahi no habia
  // forma de volver a las demas. Ahora es una pestana mas: las otras siguen a la vista.
  it("desde pacientes atendidos se puede volver al panel de impacto", () => {
    pantalla("/reportes/pacientes-atendidos");

    expect(screen.getByText("Pacientes atendidos").closest("a")).toHaveClass("active");

    fireEvent.click(screen.getByText("Dashboard de impacto"));

    expect(screen.getByText("Dashboard de impacto").closest("a")).toHaveClass("active");
  });

  it("el inventario actual tiene su pestana, que antes no enlazaba nadie", () => {
    pantalla();

    expect(screen.getByText("Inventario actual")).toBeInTheDocument();
  });

  it("mientras carga los vencimientos, muestra el estado de carga", () => {
    mockEstadoVencimientos.cargando = true;
    pantalla();
    irAVencimientos();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // Con la base vacia (issue #759/#779): sin lotes por vencer, el mensaje lo dice
  // explicitamente, y el total en riesgo se muestra en cero, no se oculta.
  it("con la base vacia, muestra el mensaje de que ningun lote vence y el total en cero", () => {
    pantalla();
    irAVencimientos();

    expect(screen.getByText("Ningún lote vence dentro del horizonte elegido.")).toBeInTheDocument();
    expect(screen.getByText("Unidades en riesgo")).toBeInTheDocument();
  });

  // ISSUE #862: el vacio ahora es contextual. Con filtros puestos, el mensaje dice que el recorte
  // no encontro nada -no que no exista el dato- y ofrece limpiarlos.
  it("con filtros puestos, el vacio ofrece limpiarlos", () => {
    mockEstadoVencimientos.hayFiltros = true;
    pantalla();
    irAVencimientos();

    const vacio = screen.getByText("Ningún lote coincide con los filtros aplicados.");
    expect(vacio).toBeInTheDocument();

    // "Limpiar filtros" existe dos veces en pantalla -en FilterBar y en el vacio contextual-, asi
    // que se busca dentro del estado vacio y no en toda la pagina.
    const dentroDelVacio = within(vacio.closest("div"));
    fireEvent.click(dentroDelVacio.getByRole("button", { name: "Limpiar filtros" }));
    expect(mockEstadoVencimientos.limpiarFiltros).toHaveBeenCalled();
  });

  it("con datos, pinta el medicamento y el total en riesgo", () => {
    mockEstadoVencimientos.renglones = [{ id: "f-1", medicamento: "Loratadina", cantidad: 10 }];
    mockEstadoVencimientos.total = 1;
    mockEstadoVencimientos.totalUnidadesEnRiesgo = 10;
    pantalla();
    irAVencimientos();

    expect(screen.getByText("Loratadina")).toBeInTheDocument();
    // "10" sale dos veces: en la tarjeta de unidades en riesgo y en la celda de cantidad. Se
    // comprueba la celda, que es la que demuestra que la fila se pinto.
    expect(screen.getByRole("cell", { name: "10" })).toBeInTheDocument();
  });

  // ISSUE #862: la tabla se dibujaba a mano y no se podia ordenar por ninguna columna.
  it("el encabezado de una columna ordenable es un boton que avisa al hook", () => {
    mockEstadoVencimientos.renglones = [{ id: "f-1", medicamento: "Loratadina", cantidad: 10 }];
    mockEstadoVencimientos.total = 1;
    pantalla();
    irAVencimientos();

    const encabezado = screen.getByRole("button", { name: /Cantidad/ });
    fireEvent.click(encabezado);

    expect(mockEstadoVencimientos.alternarOrden).toHaveBeenCalledWith("cantidad");
  });

  // Camino de error (issue #759/#779): si la consulta falla, se muestra el error, no una tabla
  // vacia que se confundiria con "ningun lote por vencer".
  it("camino de error: si la consulta falla, muestra el error y no el mensaje de vacio", () => {
    mockEstadoVencimientos.error = { mensaje: "No se pudo cargar el reporte de vencimientos." };
    pantalla();
    irAVencimientos();

    expect(screen.getByText("No se pudo cargar el reporte de vencimientos.")).toBeInTheDocument();
    expect(
      screen.queryByText("Ningún lote vence dentro del horizonte elegido."),
    ).not.toBeInTheDocument();
  });

  it("reintentar desde el error dispara recargar()", () => {
    mockEstadoVencimientos.error = { mensaje: "Falló la consulta." };
    pantalla();
    irAVencimientos();

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }));

    expect(mockEstadoVencimientos.recargar).toHaveBeenCalled();
  });
});
