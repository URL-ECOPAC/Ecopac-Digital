// Pruebas de RutaProtegida (issue #515): primera prueba real de un componente de apps/web.
// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RutaProtegida from "./RutaProtegida";
import { useSesionCompartida } from "../contexto/SesionProvider";

// Extiende los matchers de DOM en el expect de Vitest
expect.extend(matchers);

// Garatiza que el DOM se limpie entre pruebas
afterEach(() => {
  cleanup();
});

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: vi.fn(),
}));

function renderConRuta({ modulo = null } = {}) {
  return render(
    <MemoryRouter initialEntries={["/protegida"]}>
      <Routes>
        <Route element={<RutaProtegida modulo={modulo} />}>
          <Route path="/protegida" element={<div>Contenido protegido</div>} />
        </Route>
        <Route path="/login" element={<div>Pantalla de login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RutaProtegida", () => {
  it("muestra el estado de carga mientras se restaura la sesion", () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: "cargando",
      haySesion: false,
      perfil: null,
      rol: null,
    });

    renderConRuta();

    expect(screen.getByText(/comprobando tu sesión/i)).toBeInTheDocument();
  });

  it("redirige a /login cuando no hay sesion", () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: "listo",
      haySesion: false,
      perfil: null,
      rol: null,
    });

    renderConRuta();

    expect(screen.getByText(/pantalla de login/i)).toBeInTheDocument();
  });

  // Issue #840: esta prueba afirmaba lo contrario, y era el error que se veia un instante en cada
  // inicio de sesion. Justo despues de SIGNED_IN hay usuario y todavia no hay perfil: se esta
  // leyendo, no fallo.
  it("mientras el perfil se esta leyendo espera, no niega el acceso", () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: "listo",
      haySesion: true,
      perfil: null,
      rol: null,
      cargando: true,
    });

    renderConRuta({ modulo: "matriz-permisos" });

    expect(screen.getByText(/comprobando tu sesión/i)).toBeInTheDocument();
    expect(screen.queryByText(/no se pudo confirmar tu rol/i)).not.toBeInTheDocument();
  });

  it("muestra acceso denegado sin rol si hay sesion y el perfil no se pudo leer", () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: "listo",
      haySesion: true,
      perfil: null,
      rol: null,
      cargando: false,
    });

    renderConRuta({ modulo: "matriz-permisos" });

    expect(screen.getByText(/no se pudo confirmar tu rol/i)).toBeInTheDocument();
  });

  it("muestra acceso denegado cuando el rol no llega al modulo", () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: "listo",
      haySesion: true,
      perfil: { id: "1" },
      rol: "voluntario general",
    });

    renderConRuta({ modulo: "matriz-permisos" });

    expect(screen.getByText(/tu usuario tiene el rol de/i)).toBeInTheDocument();
  });

  it("deja pasar cuando el rol llega al modulo", () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: "listo",
      haySesion: true,
      perfil: { id: "1" },
      rol: "administrador",
    });

    renderConRuta({ modulo: "matriz-permisos" });

    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });

  it("sin modulo (modulo=null), cualquier sesion valida pasa", () => {
    useSesionCompartida.mockReturnValue({
      estadoRestauracion: "listo",
      haySesion: true,
      perfil: { id: "1" },
      rol: "voluntario general",
    });

    renderConRuta({ modulo: null });

    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });
});
