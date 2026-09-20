// Prueba de MatrizPermisosPorRolPage (issue #638).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

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
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
  });

  it("la columna administrador esta deshabilitada", () => {
    pantalla();

    const casillas = screen.getAllByRole("checkbox");
    const administrador = casillas.find((c) =>
      c.getAttribute("aria-label")?.includes("Administradora"),
    );

    expect(administrador).toBeDisabled();
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

    const avisos = screen.getAllByText("Sin acceso al módulo");
    // medico y voluntario general no estan en rolesDelModulo("donaciones"); administrador,
    // junta directiva y socio fundador si.
    expect(avisos).toHaveLength(2);
  });

  it("no avisa para un rol que si puede navegar al modulo del permiso", () => {
    pantalla();

    const casillas = screen.getAllByRole("checkbox");
    const deJuntaDirectiva = casillas.find((c) =>
      c.getAttribute("aria-label")?.includes("Junta directiva"),
    );

    expect(deJuntaDirectiva.closest("td")).not.toHaveTextContent("Sin acceso al módulo");
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
