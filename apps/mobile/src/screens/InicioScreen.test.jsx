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
      // Lo que el rol abre en web y no aqui (issue #864). Se calcula igual que el hook real para
      // que el doble no invente una lista mas amable que la de verdad.
      accesosEnOtraPlataforma: real
        .modulosVisibles(rol, { plataforma: "web" })
        .filter(
          (modulo) =>
            modulo.ruta !== "/" &&
            !real.modulosVisibles(rol, { plataforma }).some((suyo) => suyo.id === modulo.id),
        ),
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

  // ISSUE #864. Los dos roles consultivos quedaron con Reportes como unico modulo, y Reportes no
  // tiene pantalla en movil. Antes eso se veia como un hueco debajo de "Tus modulos", que se lee
  // como una app rota y no como un limite del rol.
  it.each(["junta directiva", "socio fundador"])(
    "a %s le dice que su trabajo esta en la web, en vez de dejar el hueco",
    (rol) => {
      sesion.perfil = { rol };
      pantalla();

      expect(screen.getByText("Tu trabajo está en la versión web")).toBeTruthy();
      expect(screen.getByText(/Entra por la web para Reportes/)).toBeTruthy();
    },
  );

  it("a un rol que si tiene modulos no le aparece ese aviso", () => {
    sesion.perfil = { rol: "medico" };
    pantalla();

    expect(screen.queryByText("Tu trabajo está en la versión web")).toBeNull();
  });

  it("sin perfil el aviso no promete una web que tampoco va a servir", () => {
    sesion.perfil = null;
    pantalla();

    expect(screen.queryByText("Tu trabajo está en la versión web")).toBeNull();
    expect(screen.getByText("Tu rol no abre ningún módulo desde el teléfono")).toBeTruthy();
  });
});
