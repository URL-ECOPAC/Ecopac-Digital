// La puerta de la app movil para los roles que no entran (issue #866, punto 5).
//
// No es control de acceso -RLS sigue decidiendo que datos ve cada quien-: es lo que la app le
// dice a una persona de junta directiva o socio fundador que inicia sesion en el telefono, en vez
// de dejarla dentro de una app con dos pestanas vacias.

import { fireEvent, render, screen } from "@testing-library/react-native";

import AppSoloParaCampoScreen from "./AppSoloParaCampoScreen";

const mockSesion = {
  perfil: { rol: "junta directiva" },
  logout: jest.fn(),
};

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

describe("AppSoloParaCampoScreen", () => {
  beforeEach(() => {
    mockSesion.logout.mockClear();
  });

  it("explica por que no entra y a donde ir, sin lenguaje tecnico", () => {
    render(<AppSoloParaCampoScreen />);

    expect(screen.getByText("Esta aplicación es para el equipo en jornada")).toBeTruthy();
    expect(screen.getByText(/versión de computadora/)).toBeTruthy();
    expect(screen.queryByText(/RLS|rol_usuario|permiso denegado/i)).toBeNull();
  });

  it("nombra el rol de quien entro", () => {
    render(<AppSoloParaCampoScreen />);

    expect(screen.getByText(/junta directiva/)).toBeTruthy();
  });

  it("deja cerrar sesion sin pasar por ninguna otra pantalla", () => {
    render(<AppSoloParaCampoScreen />);

    fireEvent.press(screen.getByText("Cerrar sesión"));

    expect(mockSesion.logout).toHaveBeenCalled();
  });
});
