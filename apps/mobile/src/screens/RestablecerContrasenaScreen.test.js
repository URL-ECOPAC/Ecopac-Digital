// Prueba de la pantalla "olvide mi contrasena" de la app movil (issue #644).

import { fireEvent, render, screen } from "@testing-library/react-native";

import RestablecerContrasenaScreen from "./RestablecerContrasenaScreen";

jest.mock("expo-linking", () => ({
  createURL: jest.fn(() => "ecopac://recuperar"),
}));

const mockEstadoHook = {
  correo: "",
  setCorreo: jest.fn(),
  enviando: false,
  mensajeExito: false,
  errorCampo: "",
  solicitarRestablecimiento: jest.fn(),
};

jest.mock("@ecopac/shared/usuarios", () => ({
  ...jest.requireActual("@ecopac/shared/usuarios"),
  useRestablecerContrasena: jest.fn(() => mockEstadoHook),
}));

const { useRestablecerContrasena } = jest.requireMock("@ecopac/shared/usuarios");

function pantalla() {
  return render(<RestablecerContrasenaScreen navigation={{ goBack: jest.fn() }} />);
}

describe("RestablecerContrasenaScreen", () => {
  beforeEach(() => {
    mockEstadoHook.correo = "";
    mockEstadoHook.mensajeExito = false;
    mockEstadoHook.errorCampo = "";
    mockEstadoHook.enviando = false;
    mockEstadoHook.solicitarRestablecimiento.mockClear();
    mockEstadoHook.setCorreo.mockClear();
    useRestablecerContrasena.mockClear();
  });

  it("pide el correo y ofrece enviar el enlace", () => {
    pantalla();

    expect(screen.getByText("Restablecer contraseña")).toBeTruthy();
    expect(screen.getByText("Enviar enlace")).toBeTruthy();
  });

  it("arma la URL de retorno con el deep link de la app, no a mano", () => {
    pantalla();

    expect(useRestablecerContrasena).toHaveBeenCalledWith({ urlDeRetorno: "ecopac://recuperar" });
  });

  it("al enviar, muestra el mensaje generico de exito", () => {
    mockEstadoHook.mensajeExito = true;
    pantalla();

    expect(screen.getByText(/recibirás un enlace con las/i)).toBeTruthy();
    expect(screen.queryByText("Enviar enlace")).toBeNull();
  });

  it("el boton dispara solicitarRestablecimiento", () => {
    pantalla();

    fireEvent.press(screen.getByText("Enviar enlace"));

    expect(mockEstadoHook.solicitarRestablecimiento).toHaveBeenCalled();
  });
});
