// Prueba de la ventana de notificaciones movil (issue #755). Mismo criterio que
// InventarioResumenAlertasScreen.test.js: se mockea el hook completo, no la API que llama por
// dentro; lo que se prueba aqui es a donde lleva cada notificacion en el navegador movil.

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import NotificacionesScreen from "./NotificacionesScreen";
import { ROUTES } from "../navigation/rutas";

const CADUCIDAD = {
  id: "n-1",
  categoria: "caducidad",
  titulo: "Lote vencido: Medicamento de prueba",
  cuerpo: "El lote L-1 vencio.",
  enlace: "/inventario?tab=alertas",
  leida: false,
  createdAt: "2026-09-18T12:00:00Z",
};

const VALIDACION = {
  id: "n-2",
  categoria: "validacion",
  titulo: "Movimiento por validar: salida de Medicamento de prueba",
  cuerpo: "Alguien registro una salida.",
  enlace: "/inventario?tab=validacion",
  leida: true,
  createdAt: "2026-09-18T11:00:00Z",
};

const mockEstado = {};

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { id: "perfil-1" } }),
}));

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useBuzonNotificaciones: () => mockEstado,
}));

beforeEach(() => {
  Object.assign(mockEstado, {
    notificaciones: [CADUCIDAD, VALIDACION],
    grupos: [
      {
        categoria: "caducidad",
        etiqueta: "Caducidad",
        tono: "warning",
        noLeidas: 1,
        notificaciones: [CADUCIDAD],
      },
      {
        categoria: "validacion",
        etiqueta: "Validación",
        tono: "info",
        noLeidas: 0,
        notificaciones: [VALIDACION],
      },
    ],
    total: 2,
    filtros: { busqueda: "", categoria: null, estado: null },
    setFiltro: jest.fn(),
    limpiarFiltros: jest.fn(),
    hayFiltros: false,
    agrupar: false,
    setAgrupar: jest.fn(),
    noLeidas: 1,
    cargando: false,
    error: null,
    errorAccion: null,
    recargar: jest.fn(),
    abrir: jest.fn(async () => true),
    marcarTodas: jest.fn(async () => true),
  });
});

function pantalla() {
  const navigation = { navigate: jest.fn() };
  render(<NotificacionesScreen navigation={navigation} />);
  return navigation;
}

describe("NotificacionesScreen", () => {
  it("una alerta de caducidad lleva al resumen de alertas de inventario", async () => {
    const navigation = pantalla();

    fireEvent.press(screen.getByText("Lote vencido: Medicamento de prueba"));

    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith(ROUTES.TABS, {
        screen: ROUTES.TAB_INVENTARIO,
        params: { screen: ROUTES.RESUMEN_ALERTAS_INVENTARIO },
      }),
    );
    expect(mockEstado.abrir).toHaveBeenCalledWith(CADUCIDAD);
  });

  it("validacion no tiene pantalla movil: no navega y dice que se atiende desde la web", async () => {
    const navigation = pantalla();

    fireEvent.press(screen.getByText(VALIDACION.titulo));

    expect(await screen.findByText(/se atiende desde la versión web/)).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("si no se pudo marcar como leida, no navega", async () => {
    mockEstado.abrir = jest.fn(async () => false);
    const navigation = pantalla();

    fireEvent.press(screen.getByText("Lote vencido: Medicamento de prueba"));

    await waitFor(() => expect(mockEstado.abrir).toHaveBeenCalled());
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("agrupado, muestra un bloque por categoria", () => {
    mockEstado.agrupar = true;
    pantalla();

    expect(screen.getByText(/CADUCIDAD \(1\)/)).toBeTruthy();
    expect(screen.getByText(/VALIDACIÓN \(1\)/)).toBeTruthy();
  });

  it("sin notificaciones lo dice", () => {
    mockEstado.notificaciones = [];
    mockEstado.grupos = [];
    mockEstado.total = 0;
    mockEstado.noLeidas = 0;
    pantalla();

    expect(screen.getByText("No tienes notificaciones.")).toBeTruthy();
  });

  it("si los filtros no dejan nada, lo dice", () => {
    mockEstado.notificaciones = [];
    mockEstado.grupos = [];
    mockEstado.hayFiltros = true;
    pantalla();

    expect(screen.getByText("Ninguna notificación coincide con los filtros.")).toBeTruthy();
  });
});
