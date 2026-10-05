// Prueba de ConsumoDeJornada (issue #925): espejo de apps/web/src/pages/ConsumoDeJornada.jsx.

import { render, screen } from "@testing-library/react-native";

import ConsumoDeJornada from "./ConsumoDeJornada";

const mockEstadoConsumo = {
  columnas: [
    { id: "articulo", label: "Artículo", tipo: "texto", principal: true },
    { id: "cargado", label: "Cargado", tipo: "numero" },
    { id: "entregado", label: "Entregado", tipo: "numero" },
    { id: "devuelto", label: "Devuelto", tipo: "numero" },
    { id: "queda", label: "Queda", tipo: "numero" },
  ],
  consumo: [],
  resumen: {
    valorCargado: 0,
    valorEntregado: 0,
    unidadesEntregadas: 0,
    valorDevuelto: 0,
    valorQueda: 0,
    unidadesPendientes: 0,
    unidadesDeOtros: 0,
    lotesSinCosto: 0,
  },
  cargando: false,
  error: null,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useConsumoDeJornada: jest.fn(() => mockEstadoConsumo),
}));

const { useConsumoDeJornada } = jest.requireMock("@ecopac/shared");

describe("ConsumoDeJornada", () => {
  beforeEach(() => {
    mockEstadoConsumo.consumo = [];
    mockEstadoConsumo.resumen = {
      valorCargado: 0,
      valorEntregado: 0,
      unidadesEntregadas: 0,
      valorDevuelto: 0,
      valorQueda: 0,
      unidadesPendientes: 0,
      unidadesDeOtros: 0,
      lotesSinCosto: 0,
    };
    mockEstadoConsumo.error = null;
    useConsumoDeJornada.mockClear();
  });

  it("pide el consumo con jornadaId, rol y usaBodegaPrincipal", () => {
    render(<ConsumoDeJornada jornadaId="jor-1" rol="administrador" usaBodegaPrincipal={false} />);

    expect(useConsumoDeJornada).toHaveBeenCalledWith({
      jornadaId: "jor-1",
      rol: "administrador",
      usaBodegaPrincipal: false,
    });
  });

  it("con bodega movil, muestra las cuatro tarjetas", () => {
    mockEstadoConsumo.resumen.valorCargado = 500;
    mockEstadoConsumo.resumen.valorEntregado = 200;
    mockEstadoConsumo.resumen.unidadesEntregadas = 20;
    mockEstadoConsumo.resumen.valorDevuelto = 50;
    mockEstadoConsumo.resumen.valorQueda = 250;
    render(<ConsumoDeJornada jornadaId="jor-1" rol="administrador" />);

    expect(screen.getByText("Cargado a la bodega")).toBeTruthy();
    expect(screen.getByText("Entregado")).toBeTruthy();
    expect(screen.getByText("Devuelto")).toBeTruthy();
    expect(screen.getByText("Le queda a la jornada")).toBeTruthy();
    expect(screen.getByText("20 unidades en recetas")).toBeTruthy();
  });

  it("con bodega principal, solo muestra Entregado: no hay carga ni devolucion", () => {
    render(<ConsumoDeJornada jornadaId="jor-1" rol="administrador" usaBodegaPrincipal />);

    expect(screen.queryByText("Cargado a la bodega")).toBeNull();
    expect(screen.queryByText("Devuelto")).toBeNull();
    expect(screen.queryByText("Le queda a la jornada")).toBeNull();
    expect(screen.getByText("Entregado")).toBeTruthy();
    expect(screen.getByText(/entrega de la bodega principal/)).toBeTruthy();
  });

  it("avisa cuando hay unidades pendientes de aprobacion", () => {
    mockEstadoConsumo.resumen.unidadesPendientes = 5;
    render(<ConsumoDeJornada jornadaId="jor-1" rol="administrador" />);

    expect(screen.getByText(/5 unidad\(es\) entregadas esperan/)).toBeTruthy();
  });

  it("camino de error: muestra el mensaje", () => {
    mockEstadoConsumo.error = { mensaje: "No se pudo calcular." };
    render(<ConsumoDeJornada jornadaId="jor-1" rol="administrador" />);

    expect(screen.getByText(/No se pudo calcular\./)).toBeTruthy();
  });

  it("sin consumo todavia, el vacio cambia segun si usa bodega principal", () => {
    render(<ConsumoDeJornada jornadaId="jor-1" rol="administrador" usaBodegaPrincipal />);
    expect(
      screen.getByText("Esta jornada todavía no ha entregado insumos en sus recetas."),
    ).toBeTruthy();
  });
});
