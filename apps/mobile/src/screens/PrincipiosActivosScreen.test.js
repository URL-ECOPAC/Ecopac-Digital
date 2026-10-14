// Catalogo de principios activos en movil (issue #866, punto 2).
//
// Hasta esta issue el principio activo solo aparecia como lista desplegable dentro del registro
// de ingreso: no habia pantalla donde verlos ni mantenerlos. El hook y los permisos ya existian
// (useCatalogoPrincipiosActivos, issue #640), asi que lo que se prueba aqui es la pantalla.

import { fireEvent, render, screen } from "@testing-library/react-native";

import PrincipiosActivosScreen from "./PrincipiosActivosScreen";

const mockSesion = { perfil: { id: "u-1", rol: "administrador" } };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => mockSesion,
}));

const mockEstado = {
  filas: [],
  total: 0,
  filtros: { busqueda: "" },
  setFiltro: jest.fn(),
  limpiarFiltros: jest.fn(),
  hayFiltros: false,
  cargando: false,
  error: null,
  recargar: jest.fn(),
  guardar: jest.fn(async () => ({ ok: true })),
  eliminar: jest.fn(async () => ({ ok: true })),
  permisos: { puedeVer: true, puedeCrear: true, puedeEditar: true, puedeEliminar: true },
};

jest.mock("@ecopac/shared", () => ({
  ...jest.requireActual("@ecopac/shared"),
  useCatalogoPrincipiosActivos: () => mockEstado,
}));

describe("PrincipiosActivosScreen", () => {
  beforeEach(() => {
    mockEstado.filas = [{ id: "pa-1", nombre: "Principio Inventado" }];
    mockEstado.total = 1;
    mockEstado.error = null;
    mockEstado.permisos = {
      puedeVer: true,
      puedeCrear: true,
      puedeEditar: true,
      puedeEliminar: true,
    };
    mockEstado.guardar.mockClear();
  });

  it("lista los principios activos del catalogo", () => {
    render(<PrincipiosActivosScreen />);

    expect(screen.getByText("Principios activos")).toBeTruthy();
    expect(screen.getByText("1 principio activo")).toBeTruthy();
    expect(screen.getByText("Principio Inventado")).toBeTruthy();
  });

  it("quien puede crear abre el formulario de alta desde el boton", () => {
    render(<PrincipiosActivosScreen />);

    fireEvent.press(screen.getByText("Nuevo principio activo"));

    expect(screen.getByText("Crear")).toBeTruthy();
    expect(screen.getByText("Cancelar")).toBeTruthy();
  });

  it("quien no administra no ve el boton de crear", () => {
    mockEstado.permisos = {
      puedeVer: true,
      puedeCrear: false,
      puedeEditar: false,
      puedeEliminar: false,
    };
    render(<PrincipiosActivosScreen />);

    expect(screen.queryByText("Nuevo principio activo")).toBeNull();
  });

  it("sin permiso de ver, lo dice en vez de dibujar una lista vacia", () => {
    mockEstado.permisos = {
      puedeVer: false,
      puedeCrear: false,
      puedeEditar: false,
      puedeEliminar: false,
    };
    render(<PrincipiosActivosScreen />);

    expect(screen.getByText("No tienes acceso al catálogo de principios activos.")).toBeTruthy();
  });

  it("un error de la consulta se muestra con reintentar, no como catalogo vacio", () => {
    mockEstado.error = { mensaje: "No se pudo leer el catálogo." };
    render(<PrincipiosActivosScreen />);

    expect(screen.getByText("No se pudo leer el catálogo.")).toBeTruthy();
  });
});
