// Pruebas de enrutado de App (issues #197, #198, #199, #200 y #201).
//
// Las cinco pantallas de donaciones y proyectos quedaron escritas y portadas a react-bootstrap
// en el PR #606, pero sin un solo import que las alcanzara: no habia forma de abrirlas ni de
// notar que se rompian. Esta prueba existe para que eso no vuelva a pasar en silencio -- si
// alguien borra una de estas rutas de App.jsx, la prueba se cae aca y no en la ronda de
// verificacion manual.
//
// Se monta <App/> entero, no un router de mentira: lo que se prueba es que la ruta real esta
// declarada dentro del guard del modulo que le toca. Solo se mockea SesionProvider, con el
// mismo criterio que RutaProtegida.test.jsx -- el hook de sesion ya se prueba por su cuenta en
// packages/shared/hooks/useSesion.test.js.
//
// El rol es administrador porque tanto /donaciones como /proyectos son ADMIN_Y_CONSULTIVOS
// (packages/shared/navegacion.js). Que cada rol vea lo que le corresponde no se comprueba aca:
// eso es RutaProtegida.test.jsx, y quien protege de verdad es RLS.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

// Con acento, tal como lo escribe NotFoundPage. Sin el, el matcher no encuentra nada y las
// aserciones negativas de abajo pasarian aunque la ruta no existiera.
const TEXTO_NOT_FOUND = /página no encontrada/i;

const PERFIL = {
  id: "1",
  nombres: "Ana",
  apellidos: "Lopez",
  rol: "administrador",
  area: null,
};

vi.mock("./contexto/SesionProvider", () => ({
  SesionProvider: ({ children }) => children,
  useSesionCompartida: () => ({
    estadoRestauracion: "listo",
    haySesion: true,
    perfil: PERFIL,
    rol: PERFIL.rol,
  }),
}));

function renderEnRuta(ruta) {
  window.history.pushState({}, "", ruta);
  return render(<App />);
}

describe("rutas de donaciones y proyectos", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("/donaciones/registro monta el formulario de registro de donacion", () => {
    renderEnRuta("/donaciones/registro");

    expect(screen.queryByText(TEXTO_NOT_FOUND)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /donacion/i })).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: /proyectos sociales/i })).toBeInTheDocument();
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

// Enrutar las pantallas no basta: el sidebar solo enlaza /donaciones y /proyectos, asi que si el
// hub no lleva a ellas siguen sin poder alcanzarse desde la interfaz. Estas dos pruebas fijan
// esos enlaces.
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

// Issue #710. Las dos pantallas que veia primero cualquier persona eran las dos que no estaban
// conectadas. Estas pruebas fijan las dos decisiones que tomo esa issue para que no se deshagan
// sin que nadie se entere.
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

    expect(screen.getByRole("heading", { name: /hola, ana/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /tus modulos/i })).toBeInTheDocument();

    // Administrador: el acceso a Pacientes tiene que estar. Que la lista salga de
    // modulosVisibles() y no de una lista escrita a mano se prueba en packages/shared.
    expect(screen.getByRole("button", { name: /pacientes/i })).toBeInTheDocument();
  });

  it("/proyectos monta la pantalla que consulta la base, no la maqueta", () => {
    renderEnRuta("/proyectos");

    // El titulo de la pantalla conectada. La maqueta borrada decia solo "Proyectos".
    expect(screen.getByRole("heading", { name: /proyectos sociales/i })).toBeInTheDocument();

    // La maqueta traia estos tres proyectos escritos a mano en un useState.
    expect(screen.queryByText(/salud comunitaria guatemala 2024/i)).not.toBeInTheDocument();
  });

  it("/proyectos/sociales redirige a /proyectos y no duplica la pantalla", () => {
    renderEnRuta("/proyectos/sociales");

    expect(window.location.pathname).toBe("/proyectos");
    expect(screen.getAllByRole("heading", { name: /proyectos sociales/i })).toHaveLength(1);
  });
});
