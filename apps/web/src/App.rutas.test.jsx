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
