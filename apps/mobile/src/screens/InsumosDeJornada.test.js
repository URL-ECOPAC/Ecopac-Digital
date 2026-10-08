// Prueba de InsumosDeJornada (issue #925): espejo de apps/web/src/pages/InsumosDeJornada.jsx.

import { fireEvent, render, screen } from "@testing-library/react-native";

import InsumosDeJornada from "./InsumosDeJornada";

jest.mock("./ModalCargaABodega", () => (props) => {
  const { Text } = require("react-native");
  return props.visible ? <Text>modal de carga</Text> : null;
});
jest.mock("./ModalDevolucionDeBodega", () => (props) => {
  const { Text } = require("react-native");
  return props.visible ? <Text>modal de devolucion</Text> : null;
});

const mockRecargarBodega = jest.fn();
const mockEstadoInsumos = {
  usaBodegaPrincipal: false,
  columnas: [{ id: "articulo", label: "Artículo", tipo: "texto", principal: true }],
  insumos: [],
  resumen: { totalEstimado: 0, sinCosto: 0 },
  existenciasDeBodega: { contenido: [], cargando: false, error: null },
  valorDeBodega: { valor: 0, lotesSinCosto: 0, unidades: 0 },
  lotesDevolvibles: [],
  unidadesDeOtrasJornadas: 0,
  motivoBodegaOcupada: null,
  cargando: false,
  error: null,
  recargarBodega: mockRecargarBodega,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useInsumosDeJornada: jest.fn(() => mockEstadoInsumos),
}));

const { useInsumosDeJornada } = jest.requireMock("@ecopac/shared");

const BODEGA_MOVIL = { id: "bod-1", nombre: "Bodega Móvil 1", esPrincipal: false };
const BODEGA_PRINCIPAL = { id: "bod-0", nombre: "Bodega Principal", esPrincipal: true };

describe("InsumosDeJornada", () => {
  beforeEach(() => {
    mockEstadoInsumos.usaBodegaPrincipal = false;
    mockEstadoInsumos.insumos = [];
    mockEstadoInsumos.existenciasDeBodega = { contenido: [], cargando: false, error: null };
    mockEstadoInsumos.valorDeBodega = { valor: 0, lotesSinCosto: 0, unidades: 0 };
    mockEstadoInsumos.lotesDevolvibles = [];
    mockEstadoInsumos.unidadesDeOtrasJornadas = 0;
    mockEstadoInsumos.motivoBodegaOcupada = null;
    mockEstadoInsumos.error = null;
    useInsumosDeJornada.mockClear();
    mockRecargarBodega.mockClear();
  });

  it("con bodega principal, explica que no hay nada que cargar ni devolver", () => {
    mockEstadoInsumos.usaBodegaPrincipal = true;
    render(<InsumosDeJornada jornadaId="jor-1" bodega={BODEGA_PRINCIPAL} rol="administrador" />);

    expect(screen.getByText(/Bodega principal: Bodega Principal/)).toBeTruthy();
    expect(screen.queryByText("Cargar a la bodega")).toBeNull();
  });

  it("administracion con bodega movil ve los botones de cargar y devolver", () => {
    render(<InsumosDeJornada jornadaId="jor-1" bodega={BODEGA_MOVIL} rol="administrador" />);

    expect(screen.getByText("Cargar a la bodega")).toBeTruthy();
    expect(screen.getByText("Devolver a otra bodega")).toBeTruthy();
  });

  it("un rol que no administra no ve los botones de cargar ni devolver", () => {
    render(<InsumosDeJornada jornadaId="jor-1" bodega={BODEGA_MOVIL} rol="medico" />);

    expect(screen.queryByText("Cargar a la bodega")).toBeNull();
    expect(screen.queryByText("Devolver a otra bodega")).toBeNull();
  });

  it("devolver esta deshabilitado sin lotes devolvibles", () => {
    render(<InsumosDeJornada jornadaId="jor-1" bodega={BODEGA_MOVIL} rol="administrador" />);

    const boton = screen.getByRole("button", { name: "Devolver a otra bodega" });
    expect(boton.props.accessibilityState.disabled).toBe(true);
  });

  it("tocar Cargar a la bodega abre el modal de carga", () => {
    render(<InsumosDeJornada jornadaId="jor-1" bodega={BODEGA_MOVIL} rol="administrador" />);

    fireEvent.press(screen.getByText("Cargar a la bodega"));
    expect(screen.getByText("modal de carga")).toBeTruthy();
  });

  it("tocar Devolver a otra bodega abre el modal de devolucion cuando hay lotes", () => {
    mockEstadoInsumos.lotesDevolvibles = [{ loteId: "lote-1" }];
    render(<InsumosDeJornada jornadaId="jor-1" bodega={BODEGA_MOVIL} rol="administrador" />);

    fireEvent.press(screen.getByText("Devolver a otra bodega"));
    expect(screen.getByText("modal de devolucion")).toBeTruthy();
  });

  it("cargar esta deshabilitado con soloConsulta, y dice el motivo si lo hay", () => {
    render(
      <InsumosDeJornada
        jornadaId="jor-1"
        bodega={BODEGA_MOVIL}
        rol="administrador"
        soloConsulta
        motivoSinCarga="La jornada ya finalizó."
      />,
    );

    const boton = screen.getByRole("button", { name: "Cargar a la bodega" });
    expect(boton.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("La jornada ya finalizó.")).toBeTruthy();
  });

  it("avisa cuando hay unidades de otras jornadas en la bodega", () => {
    mockEstadoInsumos.unidadesDeOtrasJornadas = 7;
    render(<InsumosDeJornada jornadaId="jor-1" bodega={BODEGA_MOVIL} rol="administrador" />);

    expect(screen.getByText(/7 unidad\(es\) de esta bodega no son de esta jornada/)).toBeTruthy();
  });

  it("sin bodega asignada, lo dice distinto si es consulta o no", () => {
    render(<InsumosDeJornada jornadaId="jor-1" bodega={null} rol="administrador" />);
    expect(screen.getByText(/Esta jornada no tiene bodega/)).toBeTruthy();
  });

  it("con previstos (legado), los muestra de solo lectura", () => {
    mockEstadoInsumos.insumos = [{ id: "ins-1", articulo: "Gasas" }];
    render(<InsumosDeJornada jornadaId="jor-1" bodega={BODEGA_MOVIL} rol="administrador" />);

    expect(screen.getByText("Previstos")).toBeTruthy();
    expect(screen.getByText("Gasas")).toBeTruthy();
  });
});
