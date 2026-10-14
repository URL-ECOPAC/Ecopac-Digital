// Prueba de CatalogoCondicionesScreen: crear una condicion manda el nombre como texto, que es lo
// que espera useCatalogoCondiciones().crear(nombre). La pantalla le pasaba { nombre } y la
// validacion lo daba por vacio: "El nombre de la condicion es requerido" con el nombre escrito.

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import CatalogoCondicionesScreen from "./CatalogoCondicionesScreen";

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { id: "perfil-1" }, rol: "administrador" }),
}));

const mockEstado = {
  filas: [],
  total: 0,
  filtros: {},
  setFiltro: jest.fn(),
  limpiarFiltros: jest.fn(),
  hayFiltros: false,
  cargando: false,
  error: null,
  enviando: false,
  erroresForm: {},
  recargar: jest.fn(),
  permitido: true,
  puedeCrear: true,
  puedeMantener: true,
  puedeRetirar: true,
  crear: jest.fn(async () => ({ ok: true })),
  editar: jest.fn(async () => ({ ok: true })),
  alternarVigencia: jest.fn(),
  catalogos: {},
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useCatalogoCondiciones: jest.fn(() => mockEstado),
}));

describe("CatalogoCondicionesScreen", () => {
  it("crear una condicion manda el nombre escrito como texto", async () => {
    render(<CatalogoCondicionesScreen />);

    fireEvent.press(screen.getByText("Nueva condición"));
    // El campo del modal es el ultimo vacio: el primero es la busqueda de la barra de filtros.
    const vacios = screen.getAllByDisplayValue("");
    fireEvent.changeText(vacios[vacios.length - 1], "Hipertension arterial");
    fireEvent.press(screen.getByText("Guardar"));

    await waitFor(() => expect(mockEstado.crear).toHaveBeenCalledWith("Hipertension arterial"));
  });
});
