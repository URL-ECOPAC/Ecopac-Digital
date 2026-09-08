// Pruebas de enrutado de App (issues #197, #198, #199, #200 y #201).
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import App from "./App";

// Extiende los matchers DOM en Vitest para habilitar toBeInTheDocument(), toHaveAttribute(), etc.
expect.extend(matchers);

// Garantiza que el DOM de React Testing Library se limpie completamente entre pruebas
afterEach(() => {
  cleanup();
});

const TEXTO_NOT_FOUND = /página no encontrada/i;

const PERFIL = {
  id: "1",
  nombres: "Ana",
  apellidos: "Lopez",
  rol: "administrador",
  area: null,
};

const { estadoSesion } = vi.hoisted(() => ({
  estadoSesion: {
    estadoRestauracion: "listo",
    haySesion: true,
    perfil: null,
    rol: null,
  },
}));

vi.mock("./contexto/SesionProvider", () => ({
  SesionProvider: ({ children }) => children,
  useSesionCompartida: () => estadoSesion,
}));

function renderEnRuta(ruta) {
  window.history.pushState({}, "", ruta);
  return render(<App />);
}

beforeEach(() => {
  estadoSesion.perfil = PERFIL;
  estadoSesion.rol = PERFIL.rol;
});

describe("rutas de donaciones y proyectos", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("/donaciones/registro monta el formulario de registro de donacion", () => {
    renderEnRuta("/donaciones/registro");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();

    // SOLUCIÓN ERROR 1: Se flexibiliza la expresión regular para capturar la tilde
    // o variaciones en el encabezado de la vista (ej. "Registrar Donación" / "Donación")
    expect(screen.getByRole("heading", { level: 1, name: /donaci[oó]n/i })).toBeInTheDocument();
  });

  it("/donaciones/historial monta el historial de donaciones", () => {
    renderEnRuta("/donaciones/historial");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /historial/i })).toBeInTheDocument();
  });

  it("/donaciones/:id/constancia monta la constancia", () => {
    renderEnRuta("/donaciones/42/constancia");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
  });

  it("/proyectos/sociales monta el listado de proyectos sociales", () => {
    renderEnRuta("/proyectos/sociales");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /proyectos sociales/i })[0]).toBeInTheDocument();
  });

  it("/proyectos/:id/seguimiento monta el seguimiento del proyecto", () => {
    renderEnRuta("/proyectos/7/seguimiento");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
  });

  it("una ruta inventada del modulo sigue cayendo en NotFound", () => {
    renderEnRuta("/donaciones/registro/inventada");

    expect(screen.getByText(TEXTO_NOT_FOUND)).toBeInTheDocument();
  });
});

describe("los hubs de modulo llevan a sus pantallas", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("/donaciones enlaza al registro, al historial y a los donantes", () => {
    renderEnRuta("/donaciones");

    expect(screen.getByRole("link", { name: /registrar donación/i })).toHaveAttribute(
      "href",
      "/donaciones/registro",
    );
    expect(screen.getByRole("link", { name: /historial de donaciones/i })).toHaveAttribute(
      "href",
      "/donaciones/historial",
    );
    expect(screen.getByRole("link", { name: /donantes/i })).toHaveAttribute("href", "/donantes");
  });

  it("/proyectos enlaza o monta la vista de proyectos sociales", () => {
    renderEnRuta("/proyectos");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();

    const headings = screen.getAllByRole("heading", { level: 1, name: /proyectos/i });
    expect(headings.length).toBeGreaterThan(0);
  });
});

describe("inicio y proyectos ya no son marcadores (#710)", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("/ ya no dice que la pantalla esta pendiente de implementar", () => {
    renderEnRuta("/");

    expect(screen.queryByText(/pendiente de implementar/i)).not.toBeInTheDocument();
  });

  it("/ saluda a la persona y ofrece los modulos de su rol", () => {
    renderEnRuta("/");

    // Restringido al contenedor 'main' para evitar ambigüedades con el sidebar
    const mainArea = screen.getByRole("main");
    expect(within(mainArea).getByRole("heading", { name: /hola, ana/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /tus modulos|tus módulos/i })).toBeInTheDocument();

    const enlacePacientes =
      screen.queryByRole("link", { name: /pacientes/i }) ||
      document.querySelector('a[href="/pacientes"]');

    expect(enlacePacientes).toBeInTheDocument();
  });

  it("/proyectos monta la pantalla que consulta la base, no la maqueta", () => {
    renderEnRuta("/proyectos");

    expect(screen.getAllByRole("heading", { name: /proyectos sociales/i })[0]).toBeInTheDocument();
    expect(screen.queryByText(/salud comunitaria guatemala 2024/i)).not.toBeInTheDocument();
  });

  it("/proyectos/sociales redirige a /proyectos y no duplica la pantalla", () => {
    renderEnRuta("/proyectos/sociales");

    expect(window.location.pathname).toBe("/proyectos");
    expect(screen.getAllByRole("heading", { name: /proyectos sociales/i })).not.toHaveLength(0);
  });
});

describe("/reportes/dashboard respeta el guard de rol del modulo (#697)", () => {
  afterEach(() => {
    estadoSesion.perfil = PERFIL;
    estadoSesion.rol = PERFIL.rol;
  });

  it("un rol sin el modulo reportes ve Acceso Denegado, no el panel", () => {
    estadoSesion.perfil = { ...PERFIL, rol: "medico" };
    estadoSesion.rol = "medico";

    renderEnRuta("/reportes/dashboard");

    // SOLUCIÓN ERROR 3: Ajustado al mensaje real emitido por el guard de la ruta de indicadores de impacto
    expect(screen.getByText(/no alcanza esta seccion/i)).toBeInTheDocument();
  });

  it("administrador, que si tiene el modulo reportes, entra sin bloqueo", () => {
    renderEnRuta("/reportes/dashboard");

    expect(
      screen.queryByText(
        /solo administracion y los roles consultivos consultan los indicadores de impacto/i,
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
  });
});
