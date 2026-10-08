// Prueba de ContenidoDeBodega (issue #925): espejo de
// apps/web/src/components/ContenidoDeBodega.jsx, pero como tarjetas en vez de tabla.

import { render, screen } from "@testing-library/react-native";

import ContenidoDeBodega from "./ContenidoDeBodega";

const LOTE_CON_COSTO = {
  loteId: "lote-1",
  bodegaId: "bod-1",
  articulo: "Amoxicilina 500mg",
  numeroLote: "L-001",
  fechaVencimiento: "2099-01-01",
  vencido: false,
  cantidadDisponible: 40,
  costoUnitario: 2.5,
  valor: 100,
};

const LOTE_SIN_COSTO = {
  loteId: "lote-2",
  bodegaId: "bod-1",
  articulo: "Paracetamol 500mg",
  numeroLote: "L-002",
  fechaVencimiento: null,
  vencido: false,
  cantidadDisponible: 10,
  costoUnitario: null,
  valor: null,
};

describe("ContenidoDeBodega", () => {
  it("mientras carga, muestra el estado de carga", () => {
    render(<ContenidoDeBodega cargando />);
    expect(screen.getByText("Cargando existencias...")).toBeTruthy();
  });

  it("con error, lo muestra", () => {
    render(<ContenidoDeBodega error="No se pudo consultar." />);
    expect(screen.getByText("No se pudo consultar.")).toBeTruthy();
  });

  it("sin contenido, muestra el mensaje de vacio dado", () => {
    render(<ContenidoDeBodega contenido={[]} vacio="No hay nada aqui." />);
    expect(screen.getByText("No hay nada aqui.")).toBeTruthy();
  });

  it("pinta cada lote con su articulo, numero y cantidad", () => {
    render(<ContenidoDeBodega contenido={[LOTE_CON_COSTO]} />);

    expect(screen.getByText("Amoxicilina 500mg")).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
    expect(screen.getByText(/Lote L-001/)).toBeTruthy();
  });

  it("un lote sin fecha de vencimiento dice 'no vence', y uno vencido lo marca", () => {
    render(<ContenidoDeBodega contenido={[{ ...LOTE_SIN_COSTO, vencido: false }]} />);
    expect(screen.getByText(/no vence/)).toBeTruthy();

    render(<ContenidoDeBodega contenido={[{ ...LOTE_CON_COSTO, vencido: true }]} />);
    expect(screen.getByText(/Vencido/)).toBeTruthy();
  });

  it("conValor muestra costo unitario y valor; sin costo lo dice en vez de inventar un cero", () => {
    render(<ContenidoDeBodega contenido={[LOTE_CON_COSTO, LOTE_SIN_COSTO]} conValor />);

    expect(screen.getByText(/c\/u/)).toBeTruthy();
    expect(screen.getByText("Sin costo registrado")).toBeTruthy();
  });

  it("sin conValor no muestra costo ni valor", () => {
    render(<ContenidoDeBodega contenido={[LOTE_CON_COSTO]} />);
    expect(screen.queryByText(/c\/u/)).toBeNull();
  });

  it("el total suma la cantidad de todos los lotes", () => {
    render(<ContenidoDeBodega contenido={[LOTE_CON_COSTO, LOTE_SIN_COSTO]} />);
    expect(screen.getByText("Total: 50")).toBeTruthy();
  });

  it("mostrarBodega y mostrarJornada agregan esos datos a la tarjeta", () => {
    render(
      <ContenidoDeBodega
        contenido={[{ ...LOTE_CON_COSTO, bodega: "Bodega Central", jornada: "Jornada Norte" }]}
        mostrarBodega
        mostrarJornada
      />,
    );

    expect(screen.getByText(/Bodega Central/)).toBeTruthy();
    expect(screen.getByText(/Jornada Norte/)).toBeTruthy();
  });
});
