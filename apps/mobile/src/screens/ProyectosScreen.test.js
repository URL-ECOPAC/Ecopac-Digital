// Pruebas de la pantalla de proyectos de la app movil (issue #688).
//
// Hasta esta issue, useProyectosSociales() se llamaba sin { usuarioRol }: puedeVerProyectos()
// siempre devolvia false, la lista siempre llegaba vacia, y la pantalla caia a PROYECTOS_DEMO
// (tres proyectos inventados) para cualquier rol, incluida la administradora. Ademas
// ETAPAS_KANBAN usaba valores ("en_ejecucion", "completado"...) que no existen en el enum
// estado_proyecto.
//
// Estas pruebas mockean useProyectosSociales() (no la red): lo que se fija es que la pantalla
// pase el rol real, no invente datos cuando la lista viene vacia de verdad, y use las etapas del
// enum real.

import { render, screen } from "@testing-library/react-native";

import { ESTADOS_PROYECTO } from "@ecopac/shared";

import ProyectosScreen from "./ProyectosScreen";

const sesion = { rol: "administrador" };
const mockEstadoHook = {
  proyectos: [],
  cargando: false,
  tieneAccesoLectura: true,
  cambiarEtapaProyecto: jest.fn(),
};

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

jest.mock("@ecopac/shared/proyectos", () => {
  const real = jest.requireActual("@ecopac/shared/proyectos");
  return {
    ...real,
    useProyectosSociales: jest.fn(() => mockEstadoHook),
  };
});

jest.mock("@ecopac/shared/presupuestos", () => ({
  obtenerPresupuestoProyecto: jest.fn(async () => ({
    presupuesto: { asignado: 1000, gastado: 0, disponible: 1000, pendiente: 0 },
    error: null,
  })),
}));

const { useProyectosSociales } = jest.requireMock("@ecopac/shared/proyectos");

describe("ProyectosScreen", () => {
  beforeEach(() => {
    sesion.rol = "administrador";
    mockEstadoHook.proyectos = [];
    mockEstadoHook.cargando = false;
    mockEstadoHook.tieneAccesoLectura = true;
    useProyectosSociales.mockClear();
  });

  it("pasa el rol real de la sesion al hook, no una llamada sin argumentos", () => {
    sesion.rol = "medico";
    render(<ProyectosScreen />);

    expect(useProyectosSociales).toHaveBeenCalledWith({ usuarioRol: "medico" });
  });

  it("sin permiso de lectura muestra Acceso denegado, no el kanban", () => {
    mockEstadoHook.tieneAccesoLectura = false;
    render(<ProyectosScreen />);

    expect(screen.getByText("Acceso denegado")).toBeTruthy();
  });

  it("con la lista vacia de verdad no cae a datos inventados", () => {
    mockEstadoHook.proyectos = [];
    render(<ProyectosScreen />);

    expect(screen.queryByText("Jornada Odontológica Escolar")).toBeNull();
    expect(screen.queryByText("Entrega de Kits Odontológicos")).toBeNull();
    expect(screen.getByText("Todavía no hay proyectos registrados.")).toBeTruthy();
  });

  it("un proyecto real se pinta con las etapas del enum, no con datos demo", async () => {
    mockEstadoHook.proyectos = [
      {
        id: "proy-1",
        nombre: "Agua potable Comunidad Norte",
        descripcion: "Perforacion de pozo",
        estado: ESTADOS_PROYECTO.EN_CURSO,
      },
    ];
    render(<ProyectosScreen />);

    // findByText espera a que el efecto que completa el presupuesto (obtenerPresupuestoProyecto,
    // mockeado arriba) resuelva antes de afirmar, en vez de dejar la promesa pendiente fuera de
    // act().
    expect(await screen.findByText("Agua potable Comunidad Norte")).toBeTruthy();
    expect(screen.queryByText("Jornada Odontológica Escolar")).toBeNull();
  });
});
