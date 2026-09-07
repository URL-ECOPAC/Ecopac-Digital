// Prueba de la pantalla de donaciones de la app movil (issue #688).
//
// Hasta esta issue, el rol se recibia como prop con default "administrador"
// (`{ usuarioRol = "administrador" }`), pero React Navigation solo entrega {navigation, route} a
// un `component`: nadie pasaba ese prop nunca, asi que cualquier persona se evaluaba como
// administrador para puedeVerDonaciones(), sin importar su rol real. Esta prueba fija que el rol
// sale de la sesion compartida.

import { render, screen } from "@testing-library/react-native";

import DonacionesScreen from "./DonacionesScreen";

const sesion = { rol: "administrador" };
const mockEstadoHook = { tieneAccesoLectura: true, cargando: false, donaciones: [] };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

jest.mock("@ecopac/shared/donaciones", () => ({
  ...jest.requireActual("@ecopac/shared/donaciones"),
  useHistorialDonaciones: jest.fn(() => mockEstadoHook),
}));

const { useHistorialDonaciones } = jest.requireMock("@ecopac/shared/donaciones");

describe("DonacionesScreen", () => {
  beforeEach(() => {
    sesion.rol = "administrador";
    mockEstadoHook.tieneAccesoLectura = true;
    useHistorialDonaciones.mockClear();
  });

  it("pasa el rol real de la sesion al hook, no un default fijo", () => {
    sesion.rol = "medico";
    render(<DonacionesScreen />);

    expect(useHistorialDonaciones).toHaveBeenCalledWith({ usuarioRol: "medico" });
  });

  it("un rol sin lectura de donaciones ve Acceso denegado", () => {
    sesion.rol = "medico";
    mockEstadoHook.tieneAccesoLectura = false;
    render(<DonacionesScreen />);

    expect(screen.getByText("Acceso denegado")).toBeTruthy();
  });
});
