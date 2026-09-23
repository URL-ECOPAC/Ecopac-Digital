// Bandeja de movimientos pendientes en movil (issue #866, punto 3).
//
// El estado 'pendiente' y las acciones ya existian en shared desde la #152: usePendientesValidacion
// dice en su propia cabecera que es "compartido por la web (#158, #159) y el movil (#268, #270)",
// pero el movil nunca tuvo la pantalla. Esto prueba lo que la pantalla aporta: que dibuje lo
// pendiente, que aprobar llame al hook, y que rechazar exija un motivo antes de dejar rechazar.

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import ValidacionMovimientosScreen from "./ValidacionMovimientosScreen";

const mockSesion = { perfil: { id: "u-1", rol: "administrador" } };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

const mockEstado = {
  pendientes: [],
  cargando: false,
  error: null,
  aprobar: jest.fn(async () => ({ error: null })),
  rechazar: jest.fn(async () => ({ error: null })),
  recargar: jest.fn(),
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  usePendientesValidacion: () => mockEstado,
}));

const MOVIMIENTO = {
  id: "mov-1",
  tipo: "ingreso",
  cantidad: 40,
  created_at: "2026-09-10T15:00:00Z",
  lote: { numero_lote: "LOTE-INVENTADO-1", medicamento: { nombre: "Medicamento Inventado" } },
  bodega: { nombre: "Bodega Inventada" },
  registradoPor: { nombres: "Ana", apellidos: "Perez" },
};

describe("ValidacionMovimientosScreen", () => {
  beforeEach(() => {
    mockEstado.pendientes = [MOVIMIENTO];
    mockEstado.cargando = false;
    mockEstado.error = null;
    mockEstado.aprobar.mockClear();
    mockEstado.rechazar.mockClear();
  });

  it("muestra el movimiento con su medicamento, lote, bodega y quien lo registro", () => {
    render(<ValidacionMovimientosScreen />);

    expect(screen.getByText("Medicamento Inventado")).toBeTruthy();
    expect(screen.getByText("Lote LOTE-INVENTADO-1 · Bodega Inventada")).toBeTruthy();
    expect(screen.getByText(/Ana Perez/)).toBeTruthy();
    expect(screen.getByText("Ingreso")).toBeTruthy();
  });

  // La cantidad lleva el signo y el color del tipo, como en el kardex del detalle de lote:
  // StatusChip es para estados (statusColors mapea estado_movimiento, no tipo_movimiento), asi
  // que un chip con "Salida" salia sin color y ademas no decia si suma o resta.
  it("una salida se ve con signo negativo y un ingreso con positivo", () => {
    const ingreso = render(<ValidacionMovimientosScreen />);
    expect(ingreso.getByText(/^\+\s*40$/)).toBeTruthy();
    ingreso.unmount();

    mockEstado.pendientes = [{ ...MOVIMIENTO, tipo: "salida" }];
    const salida = render(<ValidacionMovimientosScreen />);
    expect(salida.getByText(/^-\s*40$/)).toBeTruthy();
    expect(salida.getByText("Salida")).toBeTruthy();
  });

  it("sin nada pendiente lo dice, no deja la pantalla en blanco", () => {
    mockEstado.pendientes = [];
    render(<ValidacionMovimientosScreen />);

    expect(screen.getByText("No hay movimientos pendientes de verificación.")).toBeTruthy();
  });

  it("aprobar llama al hook con el id del movimiento", async () => {
    render(<ValidacionMovimientosScreen />);

    fireEvent.press(screen.getByText("Aprobar"));

    await waitFor(() => expect(mockEstado.aprobar).toHaveBeenCalledWith("mov-1"));
  });

  it("rechazar pide un motivo y no rechaza mientras este vacio", () => {
    render(<ValidacionMovimientosScreen />);

    fireEvent.press(screen.getByText("Rechazar"));

    expect(screen.getByText("Rechazar el movimiento")).toBeTruthy();
    expect(mockEstado.rechazar).not.toHaveBeenCalled();
  });

  it("con motivo escrito, rechazar lo manda al hook", async () => {
    render(<ValidacionMovimientosScreen />);

    fireEvent.press(screen.getByText("Rechazar"));
    fireEvent.changeText(screen.getByDisplayValue(""), "Cantidad equivocada");
    fireEvent.press(screen.getAllByText("Rechazar")[1]);

    await waitFor(() =>
      expect(mockEstado.rechazar).toHaveBeenCalledWith("mov-1", "Cantidad equivocada"),
    );
  });

  it("un rol que no aprueba no ve los botones", () => {
    mockSesion.perfil = { id: "u-2", rol: "medico" };
    render(<ValidacionMovimientosScreen />);

    expect(screen.queryByText("Aprobar")).toBeNull();
    expect(screen.queryByText("Rechazar")).toBeNull();

    mockSesion.perfil = { id: "u-1", rol: "administrador" };
  });
});
