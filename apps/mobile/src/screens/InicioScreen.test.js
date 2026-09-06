// Prueba de la pantalla de inicio de la app movil (issue #687).
//
// Hasta esta issue, "METRICAS CLAVE" y "ALERTAS DE CADUCIDAD" eran constantes locales -235
// pacientes, Q 553,800 en donaciones, Amoxicilina y Metformina siempre con el mismo lote- que se
// dibujaban como si vinieran de la base. Esta prueba fija que esos dos paneles ya no existen: si
// alguien los reintroduce, un texto tan especifico como "PACIENTES ATENDIDOS" o "ALERTAS DE
// CADUCIDAD" no deberia volver a aparecer en esta pantalla nunca mas sin que esta prueba lo note.
//
// "Q 553,800" no sirve de sonda para esto: MODULOS_FIGMA (fuera del alcance de esta issue, ver
// el comentario de cabecera de InicioScreen.js) ya lo usa como valor del modulo Donaciones.

import { render, screen } from "@testing-library/react-native";

import InicioScreen from "./InicioScreen";

const sesion = { perfil: { rol: "administrador" } };

jest.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => sesion,
}));

function pantalla() {
  return render(<InicioScreen navigation={{ navigate: jest.fn() }} />);
}

describe("InicioScreen", () => {
  beforeEach(() => {
    sesion.perfil = { rol: "administrador" };
  });

  it("ya no dibuja el panel de metricas inventado", () => {
    pantalla();

    // "Q 553,800" no sirve de sonda: sigue apareciendo, a proposito, como valor del modulo
    // Donaciones en MODULOS_FIGMA (fuera del alcance de esta issue, ver comentario de cabecera).
    expect(screen.queryByText("PACIENTES ATENDIDOS")).toBeNull();
    expect(screen.queryByText("histórico total")).toBeNull();
    expect(screen.queryByText("235")).toBeNull();
  });

  it("ya no dibuja el panel de alertas de caducidad inventado", () => {
    pantalla();

    expect(screen.queryByText(/ALERTAS DE CADUCIDAD/)).toBeNull();
    expect(screen.queryByText("Amoxicilina 500mg Cápsulas")).toBeNull();
  });

  it("sigue mostrando el banner y los modulos del rol, que no son parte del bug", () => {
    pantalla();

    expect(screen.getByText("Salud que llega a cada comunidad.")).toBeTruthy();
    expect(screen.getByText("MÓDULOS DEL SISTEMA")).toBeTruthy();
  });

  it("un rol distinto de administrador tambien renderiza sin los paneles inventados", () => {
    sesion.perfil = { rol: "medico" };
    pantalla();

    expect(screen.queryByText("PACIENTES ATENDIDOS")).toBeNull();
    expect(screen.getByText("MÓDULOS DEL SISTEMA")).toBeTruthy();
  });
});
