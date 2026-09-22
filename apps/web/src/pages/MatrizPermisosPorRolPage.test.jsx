// Prueba de MatrizPermisosPorRolPage (issue #638).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { ETIQUETAS_ROL, TODOS_LOS_ROLES } from "@ecopac/shared";

import MatrizPermisosPorRolPage from "./MatrizPermisosPorRolPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const PERMISO_DE_EJEMPLO = {
  id: "p-donaciones",
  clave: "donaciones.registrar",
  modulo: "donaciones",
  descripcion: "Registrar donaciones y donantes.",
  rolesConcedidos: new Set(["administrador"]),
};

const mockEstadoHook = {
  modulos: [{ modulo: "donaciones", permisos: [PERMISO_DE_EJEMPLO] }],
  cargando: false,
  error: null,
  celdaEnProceso: null,
  avisoSinEfecto: null,
  alternar: vi.fn(),
};

vi.mock("../../../../packages/shared/usuarios/useMatrizPermisosPorRol.js", () => ({
  useMatrizPermisosPorRol: vi.fn(() => mockEstadoHook),
}));

const { useMatrizPermisosPorRol } =
  await import("../../../../packages/shared/usuarios/useMatrizPermisosPorRol.js");

function pantalla() {
  return render(<MatrizPermisosPorRolPage />);
}

describe("MatrizPermisosPorRolPage", () => {
  afterEach(() => {
    mockEstadoHook.modulos = [{ modulo: "donaciones", permisos: [PERMISO_DE_EJEMPLO] }];
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.celdaEnProceso = null;
    mockEstadoHook.avisoSinEfecto = null;
    mockEstadoHook.alternar = vi.fn();
    useMatrizPermisosPorRol.mockClear();
  });

  it("pinta el titulo y el aviso de que la proteccion real es del servidor", () => {
    pantalla();

    expect(screen.getByText("Matriz de permisos por rol")).toBeInTheDocument();
    expect(screen.getByText(/no da ni quita acceso por sí sola/)).toBeInTheDocument();
  });

  it("mientras carga, muestra el estado de carga", () => {
    mockEstadoHook.cargando = true;
    pantalla();

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("si hay error, lo muestra", () => {
    mockEstadoHook.error = { mensaje: "No se pudo cargar la matriz." };
    pantalla();

    expect(screen.getByText("No se pudo cargar la matriz.")).toBeInTheDocument();
  });

  it("pinta una fila por permiso y una columna por cada uno de los cinco roles", () => {
    pantalla();

    expect(screen.getByText("Registrar donaciones y donantes.")).toBeInTheDocument();
    // Cuatro interruptores y no cinco: la administradora no lleva casilla (ver la prueba de
    // abajo). Las cinco columnas siguen estando, una por rol.
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
    // Las etiquetas salen de ETIQUETAS_ROL y no escritas a mano: un literal de rol en apps/ lo
    // caza roles.test.js (issues #598, #689).
    for (const rol of TODOS_LOS_ROLES) {
      expect(
        screen.getByRole("columnheader", { name: new RegExp(ETIQUETAS_ROL[rol]) }),
      ).toBeInTheDocument();
    }
  });

  // ISSUE #864: era un interruptor marcado y deshabilitado, que se lee como "esto se podria
  // cambiar y alguien lo bloqueo". Es un hecho del sistema, no una casilla apagada.
  it("la columna de la administradora no es una casilla, es un hecho", () => {
    pantalla();

    const casillas = screen.getAllByRole("checkbox");
    expect(casillas.some((c) => c.getAttribute("aria-label")?.includes("Administradora"))).toBe(
      false,
    );

    const siempre = screen.getByText("Siempre");
    expect(siempre).toBeInTheDocument();
    expect(siempre.getAttribute("title")).toMatch(/siempre tiene acceso completo/);
  });

  // ISSUE #864: la pregunta con la que se entra a esta pantalla es cuanto puede hacer cada rol,
  // y antes habia que contar interruptores en nueve tablas.
  it("resume cuantos permisos tiene cada rol", () => {
    pantalla();

    expect(screen.getAllByText("de 1 permisos")).toHaveLength(5);
  });

  it("la clave del permiso se muestra, porque es lo que aparece en la bitacora", () => {
    pantalla();

    expect(screen.getByText("donaciones.registrar")).toBeInTheDocument();
  });

  it("marcar la casilla de un rol no-administrador llama a alternar con los argumentos correctos", () => {
    pantalla();

    const casillas = screen.getAllByRole("checkbox");
    const deVoluntario = casillas.find((c) =>
      c.getAttribute("aria-label")?.includes("Colaborador"),
    );
    fireEvent.click(deVoluntario);

    expect(mockEstadoHook.alternar).toHaveBeenCalledWith(
      "voluntario general",
      "donaciones.registrar",
      false,
    );
  });

  // Issue #638: conceder donaciones.registrar a medico o voluntario no tiene efecto porque
  // ninguno de los dos ve el modulo Donaciones en el menu (navegacion.js). Se advierte, no se
  // bloquea: encontrado probando en vivo.
  it("avisa cuando el rol de la columna no puede navegar al modulo del permiso", () => {
    pantalla();

    // medico y voluntario general no estan en rolesDelModulo("donaciones"); administrador,
    // junta directiva y socio fundador si.
    //
    // ISSUE #864: en escritorio el aviso vive en la CABECERA de la columna, una sola vez, y no
    // en cada celda: es una propiedad del par (rol, modulo) y repetirlo por fila hacia ruido.
    // La copia que si esta en la celda la esconde el CSS y solo aparece por debajo de 900px,
    // donde la cabecera de la tabla no se dibuja; en jsdom no hay media queries, asi que aqui
    // se cuentan las dos.
    const enCabecera = screen
      .getAllByText("Sin acceso")
      .filter((aviso) => aviso.closest("thead") !== null);
    expect(enCabecera).toHaveLength(2);
    for (const aviso of enCabecera) {
      expect(aviso.closest("th")).toHaveAttribute("scope", "col");
    }

    const enCelda = screen
      .getAllByText("Sin acceso")
      .filter((aviso) => aviso.closest("tbody") !== null);
    expect(enCelda).toHaveLength(2);
    for (const aviso of enCelda) {
      expect(aviso).toHaveClass("matriz-sin-acceso-celda");
    }
  });

  it("no avisa para un rol que si puede navegar al modulo del permiso", () => {
    pantalla();

    const casillas = screen.getAllByRole("checkbox");
    const deJuntaDirectiva = casillas.find((c) =>
      c.getAttribute("aria-label")?.includes("Junta directiva"),
    );

    expect(deJuntaDirectiva.closest("td")).not.toHaveTextContent("Sin acceso");
  });

  it("muestra el aviso de sin efecto bajo la celda correcta", () => {
    mockEstadoHook.avisoSinEfecto = {
      rol: "medico",
      clave: "donaciones.registrar",
      mensaje: "El cambio no se aplico.",
    };
    pantalla();

    expect(screen.getByText("El cambio no se aplico.")).toBeInTheDocument();
  });
});
