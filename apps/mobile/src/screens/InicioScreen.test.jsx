// Prueba de la pantalla de inicio de la app movil (issues #687 y #838).
//
// La #687 quito de aqui dos paneles con datos inventados ("METRICAS CLAVE" y "ALERTAS DE
// CADUCIDAD"). La #838 quito lo que habia quedado del mismo defecto -- un valor fijo por tarjeta
// de modulo, "9" pacientes y "Q 553,800" en donaciones, escrito en el archivo -- y alineo la
// pantalla con la del navegador: saludo, jornadas en curso y accesos, todo desde usePanelDeInicio.
//
// Por eso las sondas de abajo son los textos concretos que NO deben volver: son los que estaban
// escritos a mano.

import { render, screen } from "@testing-library/react-native";

import InicioScreen from "./InicioScreen";

const sesion = { perfil: { rol: "administrador" } };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

// usePanelDeInicio consulta jornadas en curso contra Supabase. Aqui interesa lo que la pantalla
// dibuja con lo que el hook devuelve, no la consulta: el resto de @ecopac/shared pasa tal cual.
jest.mock("@ecopac/shared", () => {
  const real = jest.requireActual("@ecopac/shared");
  return {
    ...real,
    usePanelDeInicio: ({ rol, plataforma }) => ({
      accesos: real.modulosVisibles(rol, { plataforma }).filter((modulo) => modulo.ruta !== "/"),
      jornadasEnCurso: [],
      puedeVerJornadaEnCurso: real.puedeVerJornadas(rol),
      cargando: false,
      error: null,
      recargar: jest.fn(),
    }),
  };
});

function pantalla() {
  return render(<InicioScreen navigation={{ navigate: jest.fn() }} />);
}

describe("InicioScreen", () => {
  beforeEach(() => {
    sesion.perfil = { rol: "administrador" };
  });

  it("ya no dibuja el panel de metricas inventado", () => {
    pantalla();

    expect(screen.queryByText("PACIENTES ATENDIDOS")).toBeNull();
    expect(screen.queryByText("histórico total")).toBeNull();
    expect(screen.queryByText("235")).toBeNull();
  });

  it("ya no dibuja el panel de alertas de caducidad inventado", () => {
    pantalla();

    expect(screen.queryByText(/ALERTAS DE CADUCIDAD/)).toBeNull();
    expect(screen.queryByText("Amoxicilina 500mg Cápsulas")).toBeNull();
  });

  it("no queda ningun valor inventado en las tarjetas de modulo (issue #838)", () => {
    pantalla();

    expect(screen.queryByText("Q 553,800")).toBeNull();
    expect(screen.queryByText("47%")).toBeNull();
    expect(screen.queryByText("Ingresos registrados")).toBeNull();
  });

  it("no queda el texto de folleto del banner: saluda a la persona, como la web", () => {
    sesion.perfil = { rol: "administrador", nombres: "Ana" };
    pantalla();

    expect(screen.queryByText("Salud que llega a cada comunidad.")).toBeNull();
    expect(screen.getByText("Hola, Ana")).toBeTruthy();
  });

  it("dibuja los modulos del rol con su descripcion real", () => {
    pantalla();

    expect(screen.getByText("Tus módulos")).toBeTruthy();
    expect(screen.getByText("Pacientes")).toBeTruthy();
    expect(screen.getByText("Expedientes clinicos, triaje, consultas y recetas.")).toBeTruthy();
  });

  it("no ofrece un modulo que la app movil no tiene", () => {
    pantalla();

    expect(screen.queryByText("Reportes")).toBeNull();
    expect(screen.queryByText("Colaboradores")).toBeNull();
  });

  it("un rol sin acceso a presupuestos no ve esa tarjeta", () => {
    sesion.perfil = { rol: "medico" };
    pantalla();

    expect(screen.queryByText("Presupuestos")).toBeNull();
    expect(screen.getByText("Inventario")).toBeTruthy();
  });

  it("sin perfil no asume ningun rol: saluda, pero no ofrece modulos (issue #692)", () => {
    sesion.perfil = null;
    pantalla();

    expect(screen.queryByText("Donaciones")).toBeNull();
    expect(screen.queryByText("Inventario")).toBeNull();
    expect(screen.getByText("Hola")).toBeTruthy();
  });
});
