// Las dos pantallas que abren su menu lateral (Pacientes e Inventario), montadas con un rol para
// que el menu se dibuje, y abriendolo.

import { fireEvent, render, screen } from "@testing-library/react-native";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador", perfil: { rol: "administrador" } }),
}));

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  usePacientesListado: () => ({
    filas: [],
    filtros: { busqueda: "" },
    setFiltro: jest.fn(),
    limpiarFiltros: jest.fn(),
    cargando: false,
    error: null,
    hayMas: false,
    cargarMas: jest.fn(),
    catalogos: {},
  }),
}));

import BusquedaPacienteScreen from "./BusquedaPacienteScreen";
import { CatalogoMedicamentosScreen } from "./CatalogoMedicamentosScreen";

describe("menu lateral en las pantallas", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("Pacientes: abre el menu y navega a crónicos", () => {
    render(<BusquedaPacienteScreen />);
    fireEvent.press(screen.getByLabelText("Opciones"));
    fireEvent.press(screen.getByText("Pacientes crónicos"));
    expect(mockNavigate).toHaveBeenCalledWith("PacientesCronicos");
  });

  it("Inventario: abre el menu y navega a registrar ingreso", () => {
    const navigation = { navigate: jest.fn() };
    render(<CatalogoMedicamentosScreen rol="administrador" navigation={navigation} />);
    fireEvent.press(screen.getByLabelText("Opciones"));
    fireEvent.press(screen.getByText("Registrar ingreso"));
    expect(navigation.navigate).toHaveBeenCalledWith("RegistroIngreso");
  });
});
