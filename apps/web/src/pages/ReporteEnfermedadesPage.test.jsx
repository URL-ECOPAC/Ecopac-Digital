// Prueba de ReporteEnfermedadesPage (issue #916). Conteos inventados y agregados: ninguna fila
// identifica a una persona.
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import {
  CIFRA_PROTEGIDA,
  COLUMNAS_RANKING_ENFERMEDADES,
  FILTROS_ENFERMEDADES,
  FILTROS_ENFERMEDADES_VACIOS,
  OPCIONES_DE_COMUNIDAD_DE,
  OPCIONES_DE_CONTEO_DE_DIAGNOSTICOS,
  OPCIONES_DE_VISTA_ENFERMEDADES,
  VISTAS_DE_ENFERMEDADES,
} from "@ecopac/shared";

import ReporteEnfermedadesPage from "./ReporteEnfermedadesPage";

expect.extend(matchers);

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "junta directiva" }),
}));

const FILAS = [
  {
    id: "dx-1",
    diagnostico: "Infección respiratoria aguda",
    codigo: "J06.9",
    casos: 12,
    hombres: 5,
    mujeres: 7,
    menores: 6,
    adultos: 6,
    adultosMayores: 0,
  },
  {
    id: "dx-2",
    diagnostico: "Diarrea",
    codigo: "A09",
    casos: CIFRA_PROTEGIDA,
    hombres: CIFRA_PROTEGIDA,
    mujeres: 0,
    menores: CIFRA_PROTEGIDA,
    adultos: 0,
    adultosMayores: 0,
  },
];

function estadoBase() {
  return {
    tieneAcceso: true,
    cargando: false,
    error: null,
    recargar: vi.fn(),
    vista: VISTAS_DE_ENFERMEDADES.RANKING,
    setVista: vi.fn(),
    opcionesDeVista: OPCIONES_DE_VISTA_ENFERMEDADES,
    comunidadDe: "jornada",
    setComunidadDe: vi.fn(),
    opcionesDeComunidadDe: OPCIONES_DE_COMUNIDAD_DE,
    rotuloDeComunidad: "Comunidad de la jornada",
    conteo: "principales",
    setConteo: vi.fn(),
    opcionesDeConteo: OPCIONES_DE_CONTEO_DE_DIAGNOSTICOS,
    rotuloDeConteo: "Solo diagnósticos principales",
    definicionDeFiltros: FILTROS_ENFERMEDADES,
    valores: FILTROS_ENFERMEDADES_VACIOS,
    setFiltro: vi.fn(),
    limpiarFiltros: vi.fn(),
    hayFiltros: false,
    presets: [],
    presetActivo: null,
    setPreset: vi.fn(),
    catalogos: {
      departamentos: [],
      municipios: [],
      comunidades: [],
      jornadas: [{ value: "jor-1", label: "Jornada 1 (07/03/2026)" }],
      proyectos: [],
      diagnosticos: [],
    },
    jornadasAComparar: [],
    setJornadasAComparar: vi.fn(),
    comunidadesAComparar: [],
    setComunidadesAComparar: vi.fn(),
    diagnosticoEvolucion: null,
    setDiagnosticoEvolucion: vi.fn(),
    nombreDeEnfermedad: null,
    columnas: COLUMNAS_RANKING_ENFERMEDADES,
    filas: FILAS,
    filasCompletas: FILAS,
    total: FILAS.length,
    orden: null,
    alternarOrden: vi.fn(),
    numeroDePagina: 1,
    totalPaginas: 1,
    irAPagina: vi.fn(),
    grafica: {
      tipo: "barras",
      etiquetas: ["Infección respiratoria aguda", "Diarrea"],
      series: [{ nombre: "Casos", valores: [12, null] }],
    },
    gruposFueraDeGrafica: 0,
    haySuprimidos: true,
    umbral: 5,
    cifraProtegida: CIFRA_PROTEGIDA,
  };
}

let mockEstado = estadoBase();

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useReporteEnfermedades: vi.fn(() => mockEstado),
}));

function pantalla() {
  return render(
    <MemoryRouter initialEntries={["/reportes/enfermedades"]}>
      <ReporteEnfermedadesPage incrustado />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  mockEstado = estadoBase();
});

describe("ReporteEnfermedadesPage", () => {
  it("sin acceso muestra el mensaje de permisos, no el reporte", () => {
    mockEstado = { ...estadoBase(), tieneAcceso: false };
    pantalla();

    expect(
      screen.getByText(
        "Solo administración y los roles consultivos consultan el reporte de enfermedades.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("dice que esta contando: el tipo de diagnostico y la comunidad", () => {
    pantalla();

    expect(
      screen.getByText("Solo diagnósticos principales · Comunidad de la jornada"),
    ).toBeInTheDocument();
  });

  it("explica la regla de privacidad y muestra la cifra protegida en la tabla", () => {
    pantalla();

    expect(screen.getByText(/las cifras de 1 a 4 casos se muestran como/)).toBeInTheDocument();

    const filaDeDiarrea = screen
      .getAllByRole("row")
      .find((fila) => /Diarrea/.test(fila.textContent));
    expect(within(filaDeDiarrea).getAllByText(CIFRA_PROTEGIDA).length).toBeGreaterThan(0);
  });

  it("dibuja la grafica con el titulo de la vista y la tabla debajo", () => {
    pantalla();

    expect(
      screen.getByText("Enfermedades más frecuentes", { selector: "figcaption" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Infección respiratoria aguda").length).toBeGreaterThan(0);
  });

  it("cambiar de vista llama al hook con la vista elegida", () => {
    pantalla();

    fireEvent.click(screen.getByRole("button", { name: "Comparar jornadas" }));

    expect(mockEstado.setVista).toHaveBeenCalledWith(VISTAS_DE_ENFERMEDADES.JORNADAS);
  });

  it("en la comparacion de jornadas ofrece elegir cuales comparar", () => {
    mockEstado = { ...estadoBase(), vista: VISTAS_DE_ENFERMEDADES.JORNADAS };
    pantalla();

    expect(screen.getByText("Jornadas a comparar")).toBeInTheDocument();
  });

  it("en la evolucion usa la grafica de lineas y ofrece elegir la enfermedad", () => {
    mockEstado = {
      ...estadoBase(),
      vista: VISTAS_DE_ENFERMEDADES.EVOLUCION,
      nombreDeEnfermedad: "Diarrea",
      grafica: {
        tipo: "lineas",
        etiquetas: ["ene 2026", "feb 2026"],
        series: [{ nombre: "Diarrea", valores: [6, null] }],
      },
    };
    pantalla();

    expect(
      screen.getByText("Evolución en el tiempo: Diarrea", { selector: "figcaption" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Enfermedad")).toBeInTheDocument();
  });

  it("si la consulta falla, muestra el error con reintento", () => {
    mockEstado = { ...estadoBase(), error: { mensaje: "No se pudo calcular el reporte." } };
    pantalla();

    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(mockEstado.recargar).toHaveBeenCalled();
  });

  it("sin datos, deshabilita exportar e imprimir", () => {
    mockEstado = { ...estadoBase(), filas: [], filasCompletas: [], total: 0 };
    pantalla();

    expect(screen.getByRole("button", { name: /csv/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /imprimir/i })).toBeDisabled();
  });
});
