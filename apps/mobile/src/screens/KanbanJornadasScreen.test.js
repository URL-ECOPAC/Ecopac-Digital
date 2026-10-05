// Prueba de KanbanJornadasScreen (issue #925).
//
// QUE ESTABA MAL. useJornadasKanban(rol) recibe el rol como string -no {rol}-: llamarlo con un
// objeto rompia permisosDeJornadas() por dentro (comparaba el objeto contra un enum). Ademas
// KanbanBoard se reescribio en la #840 (columnas/renderTarjeta/onMover, sin alMoverTarjeta,
// alPresionarTarjeta ni tipoElemento) y esta pantalla se quedo con la API vieja: cada tarjeta se
// dibujaba vacia (sin renderTarjeta no hay nada que pintar) y mover/ver detalle no hacian nada.

import { fireEvent, render, screen } from "@testing-library/react-native";

import KanbanJornadasScreen from "./KanbanJornadasScreen";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

const mockMoverJornada = jest.fn();
const mockDescartarErrorMovimiento = jest.fn();
const JORNADA_EN_CURSO = {
  id: "jor-1",
  nombre: "Jornada Vista Hermosa",
  estado: "en curso",
  comunidad: "Vista Hermosa",
  fecha: "2026-10-04",
  responsable: "Ana Pérez",
  pacientesAtendidos: 12,
  cupoEstimado: 30,
};
const JORNADA_FINALIZADA = {
  id: "jor-2",
  nombre: "Jornada Norte",
  estado: "finalizada",
  comunidad: "Norte",
  fecha: "2026-09-01",
  responsable: "Luis Gómez",
};

const mockEstadoKanban = {
  cargando: false,
  error: null,
  columnas: [
    { id: "en curso", titulo: "En curso", tarjetas: [JORNADA_EN_CURSO] },
    { id: "finalizada", titulo: "Finalizada", tarjetas: [JORNADA_FINALIZADA] },
  ],
  recargar: jest.fn(),
  puedeEditar: true,
  puedeReabrir: true,
  moverJornada: mockMoverJornada,
  moviendo: false,
  errorMovimiento: null,
  descartarErrorMovimiento: mockDescartarErrorMovimiento,
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useJornadasKanban: jest.fn(() => mockEstadoKanban),
}));

const { useJornadasKanban } = jest.requireMock("@ecopac/shared");

function pantalla() {
  return render(<KanbanJornadasScreen />);
}

describe("KanbanJornadasScreen", () => {
  beforeEach(() => {
    mockEstadoKanban.cargando = false;
    mockEstadoKanban.error = null;
    mockEstadoKanban.puedeEditar = true;
    mockEstadoKanban.puedeReabrir = true;
    mockEstadoKanban.moviendo = false;
    mockEstadoKanban.errorMovimiento = null;
    useJornadasKanban.mockClear();
    mockMoverJornada.mockClear();
    mockDescartarErrorMovimiento.mockClear();
    mockNavigate.mockClear();
  });

  it("llama al hook con el rol como string, no como objeto", () => {
    pantalla();
    expect(useJornadasKanban).toHaveBeenCalledWith("administrador");
  });

  it("pinta el contenido real de cada tarjeta, no una tarjeta vacia", () => {
    pantalla();

    expect(screen.getByText("Jornada Vista Hermosa")).toBeTruthy();
    expect(screen.getByText("Vista Hermosa · 04/10/2026")).toBeTruthy();
    expect(screen.getByText("Responsable: Ana Pérez")).toBeTruthy();
    expect(screen.getByText("Pacientes atendidos: 12/30")).toBeTruthy();
  });

  it("tocar Ver detalle navega a DetalleJornada con el id real", () => {
    pantalla();

    const botones = screen.getAllByText("Ver detalle");
    fireEvent.press(botones[0]);

    expect(mockNavigate).toHaveBeenCalledWith("DetalleJornada", {
      jornadaId: "jor-1",
      titulo: "Jornada Vista Hermosa",
    });
  });

  it("una jornada finalizada con permiso de reabrir ofrece el boton Reabrir, con confirmacion", () => {
    pantalla();

    const boton = screen.getByText("Reabrir");
    fireEvent.press(boton);

    expect(screen.getByText("¿Reabrir la jornada? Vuelve a quedar en curso.")).toBeTruthy();

    fireEvent.press(screen.getAllByText("Reabrir")[0]);
    expect(mockMoverJornada).toHaveBeenCalledWith("jor-2", "finalizada", "en curso");
  });

  it("sin permiso de reabrir, la jornada finalizada no ofrece el boton", () => {
    mockEstadoKanban.puedeReabrir = false;
    pantalla();

    expect(screen.queryByText("Reabrir")).toBeNull();
  });

  it("cancelar la reapertura no llama a moverJornada", () => {
    pantalla();

    fireEvent.press(screen.getByText("Reabrir"));
    fireEvent.press(screen.getByText("Cancelar"));

    expect(mockMoverJornada).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Reabrir la jornada? Vuelve a quedar en curso.")).toBeNull();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoKanban.cargando = true;
    pantalla();
    expect(screen.getByText("Cargando tablero...")).toBeTruthy();
  });

  it("camino de error: muestra el mensaje con boton de reintentar", () => {
    mockEstadoKanban.error = { mensaje: "No se pudo cargar el tablero." };
    pantalla();

    expect(screen.getByText("No se pudo cargar el tablero.")).toBeTruthy();
    fireEvent.press(screen.getByText("Reintentar"));
    expect(mockEstadoKanban.recargar).toHaveBeenCalled();
  });

  // Issue #925: si no se puede mover una jornada (su bodega esta en otra jornada en curso), el
  // mensaje tiene que decir cual es esa jornada. Antes nada en pantalla lo mostraba.
  it("si un movimiento falla, muestra el motivo y se puede descartar", () => {
    mockEstadoKanban.errorMovimiento = {
      jornadaId: "jor-1",
      mensaje: "La bodega móvil ya está en la jornada «Jornada Norte», que sigue en curso.",
    };
    pantalla();

    expect(
      screen.getByText(
        "La bodega móvil ya está en la jornada «Jornada Norte», que sigue en curso.",
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText("Descartar"));
    expect(mockDescartarErrorMovimiento).toHaveBeenCalled();
  });

  it("sin error de movimiento, no muestra ningun aviso", () => {
    pantalla();
    expect(screen.queryByText("Descartar")).toBeNull();
  });
});
