// Prueba de la pantalla de nueva contrasena de la app movil (issue #644).

import { fireEvent, render, screen } from "@testing-library/react-native";

import NuevaContrasenaScreen from "./NuevaContrasenaScreen";

const mockEstadoHook = {
  contrasena: "",
  setContrasena: jest.fn(),
  confirmarContrasena: "",
  setConfirmarContrasena: jest.fn(),
  enviando: false,
  errorGlobal: "",
  erroresDeCampo: {},
  exito: false,
  actualizarContrasena: jest.fn(),
};

jest.mock("@ecopac/shared/usuarios", () => ({
  ...jest.requireActual("@ecopac/shared/usuarios"),
  useNuevaContrasena: jest.fn(() => mockEstadoHook),
}));

function pantalla(alTerminar = jest.fn()) {
  return render(<NuevaContrasenaScreen alTerminar={alTerminar} />);
}

describe("NuevaContrasenaScreen", () => {
  beforeEach(() => {
    mockEstadoHook.errorGlobal = "";
    mockEstadoHook.erroresDeCampo = {};
    mockEstadoHook.enviando = false;
    mockEstadoHook.exito = false;
    mockEstadoHook.actualizarContrasena.mockClear();
  });

  it("pide la contrasena nueva y su confirmacion", () => {
    pantalla();

    expect(screen.getByText("Elige una contraseña para tu cuenta")).toBeTruthy();
    expect(screen.getByText("Confirmar contraseña")).toBeTruthy();
    expect(screen.getByText("Guardar nueva contraseña")).toBeTruthy();
  });

  it("muestra el error global cuando lo hay (por ejemplo, cuenta desactivada)", () => {
    mockEstadoHook.errorGlobal =
      "Tu usuario esta desactivado. Pide a la administradora que lo reactive.";
    pantalla();

    expect(
      screen.getByText("Tu usuario esta desactivado. Pide a la administradora que lo reactive."),
    ).toBeTruthy();
  });

  it("el boton dispara actualizarContrasena", () => {
    pantalla();

    fireEvent.press(screen.getByText("Guardar nueva contraseña"));

    expect(mockEstadoHook.actualizarContrasena).toHaveBeenCalled();
  });

  it("al tener exito, llama alTerminar para que App.js vuelva a Login", () => {
    const alTerminar = jest.fn();
    mockEstadoHook.exito = true;

    pantalla(alTerminar);

    expect(alTerminar).toHaveBeenCalled();
  });

  it("mientras no hay exito, no llama alTerminar", () => {
    const alTerminar = jest.fn();

    pantalla(alTerminar);

    expect(alTerminar).not.toHaveBeenCalled();
  });
});
