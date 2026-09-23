// Prueba de DashboardMetricasPage (Modulo IV: dashboard de indicadores, issue #779).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import DashboardMetricasPage from "./DashboardMetricasPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

const INDICADORES_EN_CERO = {
  pacientesAtendidos: 0,
  comunidadesBeneficiadas: 0,
  tratamientosEntregados: 0,
  medicamentosUtilizados: 0,
};

const mockEstadoHook = {
  tieneAcceso: true,
  cargando: false,
  error: null,
  indicadores: INDICADORES_EN_CERO,
  seriePrincipal: [],
  serieComparacion: [],
  calcularVariacion: vi.fn(() => 0),
  // ISSUE #862: los catalogos del hook pasaron de { valor, etiqueta } a { value, label }, que es
  // el idioma que hablan Selector y el resto del catalogo de componentes.
  rangosDisponibles: [{ value: "mes", label: "Este mes" }],
  rangoSeleccionado: "mes",
  setRangoSeleccionado: vi.fn(),
  agrupamientosDisponibles: [{ value: "mes", label: "Mes" }],
  agruparPor: "mes",
  setAgruparPor: vi.fn(),
  metricasDisponibles: [
    { value: "pacientes_atendidos", label: "Pacientes atendidos" },
    { value: "consultas_realizadas", label: "Consultas realizadas" },
  ],
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

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useDashboardMetricas: vi.fn(() => mockEstadoHook),
}));

const { useDashboardMetricas } = await import("@ecopac/shared");

function pantalla() {
  return render(<DashboardMetricasPage />);
}

describe("DashboardMetricasPage", () => {
  afterEach(() => {
    mockEstadoHook.tieneAcceso = true;
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.indicadores = INDICADORES_EN_CERO;
    mockEstadoHook.seriePrincipal = [];
    mockEstadoHook.serieComparacion = [];
    useDashboardMetricas.mockClear();
  });

  it("un rol sin acceso ve el mensaje de permisos, no el panel", () => {
    mockEstadoHook.tieneAcceso = false;
    pantalla();

    expect(
      screen.getByText(
        "Solo administración y los roles consultivos consultan los indicadores de impacto.",
      ),
    ).toBeInTheDocument();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // Con la base vacia (issue #759/#779): el periodo sin datos da indicadores en cero y una
  // serie vacia, y la pantalla tiene que dibujarse igual, no romperse ni inventar datos.
  it("con la base vacia, pinta las cinco tarjetas en cero y ninguna barra", () => {
    pantalla();

    // Las cinco tarjetas, todas en 0 -- consultar por "0" a secas seria ambiguo (aparece cinco
    // veces), asi que se confirma que las cinco etiquetas de tarjeta esten presentes.
    // "Consultas realizadas" se agrego en la issue #756: consultas_realizadas ya llegaba en
    // COLUMNAS_DEL_REPORTE/INDICADORES (api.js, issue #693) pero useDashboardMetricas.js no lo
    // traducia a camelCase, asi que nunca llegaba a esta tarjeta.
    // Se acota a las tarjetas: "Pacientes atendidos" tambien es una opcion del selector de
    // metrica, que la issue #862 agrego -el hook exponia cinco metricas y no habia forma de
    // elegirlas-.
    const kpis = within(document.querySelector(".ec-kpis"));
    expect(kpis.getByText("Pacientes atendidos")).toBeInTheDocument();
    expect(kpis.getByText("Consultas realizadas")).toBeInTheDocument();
    expect(kpis.getByText("Comunidades beneficiadas")).toBeInTheDocument();
    expect(kpis.getByText("Tratamientos entregados")).toBeInTheDocument();
    expect(kpis.getByText("Medicamentos utilizados")).toBeInTheDocument();
    expect(kpis.getAllByText("0")).toHaveLength(5);
  });

  it("con datos, pinta los indicadores reales en las tarjetas", () => {
    mockEstadoHook.indicadores = {
      pacientesAtendidos: 120,
      consultasRealizadas: 210,
      comunidadesBeneficiadas: 8,
      tratamientosEntregados: 95,
      medicamentosUtilizados: 340,
    };
    mockEstadoHook.seriePrincipal = [{ etiqueta: "Enero", valor: 120 }];
    pantalla();

    // Las cifras se buscan en su tarjeta y no en toda la pagina: la grafica publica los mismos
    // numeros en su tabla accesible alternativa, asi que "120" sale dos veces (issue #862).
    const kpis = within(document.querySelector(".ec-kpis"));
    expect(kpis.getByText("120")).toBeInTheDocument();
    expect(kpis.getByText("210")).toBeInTheDocument();
    expect(kpis.getByText("8")).toBeInTheDocument();
    expect(kpis.getByText("95")).toBeInTheDocument();
    expect(kpis.getByText("340")).toBeInTheDocument();
  });

  it("con comparacion activa, muestra el panel de variacion porcentual", () => {
    mockEstadoHook.seriePrincipal = [{ etiqueta: "Enero", valor: 100 }];
    mockEstadoHook.serieComparacion = [{ etiqueta: "Enero", valor: 80 }];
    mockEstadoHook.calcularVariacion = vi.fn(() => 25);
    pantalla();

    expect(screen.getByText("Variación porcentual")).toBeInTheDocument();
    expect(screen.getByText("↑ 25.0%")).toBeInTheDocument();
  });

  it("elegir un rango llama a setRangoSeleccionado()", () => {
    pantalla();

    fireEvent.click(screen.getByText("Este mes"));

    expect(mockEstadoHook.setRangoSeleccionado).toHaveBeenCalledWith("mes");
  });

  // Camino de error (issue #759/#779): si la consulta falla, la pantalla tiene que mostrar el
  // error, no un panel con datos inventados o en blanco.
  it("camino de error: si la consulta falla, muestra el error y no el panel", () => {
    mockEstadoHook.error = { mensaje: "No se pudieron cargar los indicadores." };
    pantalla();

    expect(screen.getByText("No se pudieron cargar los indicadores.")).toBeInTheDocument();
    expect(screen.queryByText("Pacientes atendidos")).not.toBeInTheDocument();
  });
});
