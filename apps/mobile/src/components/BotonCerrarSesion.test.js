// Prueba del boton de cerrar sesion de la cabecera (issue #866, punto 9).
//
// Las dos afirmaciones venian de AjustesScreen.test.js, donde vivia el boton hasta esta issue:
// el aviso de cambios sin guardar de la #110 tiene que seguir funcionando ahora que el boton
// esta en la cabecera, a la par de la campana, y no dentro de Ajustes.

import { fireEvent, render, screen } from "@testing-library/react-native";

import BotonCerrarSesion from "./BotonCerrarSesion";

const mockSesion = {
  logout: jest.fn(),
};

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

const mockRegistro = {
  hayAlgoSinGuardar: jest.fn(() => false),
};

jest.mock("../contexto/RegistroSinGuardarProvider", () => ({
  useRegistroSinGuardar: () => mockRegistro,
}));

describe("BotonCerrarSesion", () => {
  beforeEach(() => {
    mockSesion.logout.mockClear();
    mockRegistro.hayAlgoSinGuardar.mockReturnValue(false);
  });

  it("sin cambios pendientes cierra la sesion directo, sin modal", () => {
    render(<BotonCerrarSesion />);

    fireEvent.press(screen.getByLabelText("Cerrar sesión"));

    expect(mockSesion.logout).toHaveBeenCalled();
    expect(screen.queryByText("Hay cambios sin guardar")).toBeNull();
  });

  it("con algo sin guardar en otra pantalla avisa antes de cerrar (issue #110)", () => {
    mockRegistro.hayAlgoSinGuardar.mockReturnValue(true);
    render(<BotonCerrarSesion />);

    fireEvent.press(screen.getByLabelText("Cerrar sesión"));

    expect(mockSesion.logout).not.toHaveBeenCalled();
    expect(screen.getByText("Hay cambios sin guardar")).toBeTruthy();
  });

  it("y desde ese aviso se puede cerrar sesion perdiendo los cambios", () => {
    mockRegistro.hayAlgoSinGuardar.mockReturnValue(true);
    render(<BotonCerrarSesion />);

    fireEvent.press(screen.getByLabelText("Cerrar sesión"));
    fireEvent.press(screen.getByText("Cerrar sesión sin guardar"));

    expect(mockSesion.logout).toHaveBeenCalled();
  });

  it("o seguir editando, que no cierra nada", () => {
    mockRegistro.hayAlgoSinGuardar.mockReturnValue(true);
    render(<BotonCerrarSesion />);

    fireEvent.press(screen.getByLabelText("Cerrar sesión"));
    fireEvent.press(screen.getByText("Seguir editando"));

    expect(mockSesion.logout).not.toHaveBeenCalled();
    expect(screen.queryByText("Hay cambios sin guardar")).toBeNull();
  });
});
