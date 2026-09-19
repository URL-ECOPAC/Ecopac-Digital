// Prueba de los avisos del sistema del telefono (issue #755): cuando sube el contador de no
// leidas, se muestra una notificacion del sistema por cada notificacion nueva, y lo que ya estaba
// al abrir la app no se avisa.

import { render, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";

import AvisosDelSistema from "./AvisosDelSistema";

const mockRespuestas = [];

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  listarNotificaciones: jest.fn(async () => mockRespuestas.shift()),
}));

function n(id, createdAt) {
  return { id, createdAt, leida: false, titulo: `Titulo ${id}`, cuerpo: `Cuerpo ${id}` };
}

const props = { perfilId: "perfil-1", onAbrir: jest.fn(), onVolverAlFrente: jest.fn() };

beforeEach(() => {
  mockRespuestas.length = 0;
  Notifications.scheduleNotificationAsync.mockClear();
});

describe("AvisosDelSistema", () => {
  it("no avisa de lo que ya estaba al abrir la app", async () => {
    mockRespuestas.push({ notificaciones: [n("1", "2026-09-19T08:00:00Z")], error: null });
    render(<AvisosDelSistema {...props} cantidad={1} />);

    await waitFor(() => expect(Notifications.getPermissionsAsync).toHaveBeenCalled());
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("cuando sube el contador, avisa de la notificacion nueva con su titulo", async () => {
    mockRespuestas.push({ notificaciones: [n("1", "2026-09-19T08:00:00Z")], error: null });
    const { rerender } = render(<AvisosDelSistema {...props} cantidad={1} />);
    await waitFor(() => expect(mockRespuestas).toHaveLength(0));

    mockRespuestas.push({
      notificaciones: [n("2", "2026-09-19T09:00:00Z"), n("1", "2026-09-19T08:00:00Z")],
      error: null,
    });
    rerender(<AvisosDelSistema {...props} cantidad={2} />);

    await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1));
    expect(Notifications.scheduleNotificationAsync.mock.calls[0][0].content).toEqual({
      title: "Titulo 2",
      body: "Cuerpo 2",
    });
  });

  it("tocar la notificacion del sistema abre la ventana de notificaciones", async () => {
    mockRespuestas.push({ notificaciones: [], error: null });
    render(<AvisosDelSistema {...props} cantidad={0} />);

    await waitFor(() =>
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled(),
    );
    const alTocar = Notifications.addNotificationResponseReceivedListener.mock.calls.at(-1)[0];
    alTocar();
    expect(props.onAbrir).toHaveBeenCalled();
  });
});
