// Prueba de MatrizPermisosPorRolPage: la matriz de acceso a modulos por rol (migracion 00148).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

import { ETIQUETAS_ROL, ROLES } from "@ecopac/shared";

import MatrizPermisosPorRolPage from "./MatrizPermisosPorRolPage";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const ROLES_EN_ORDEN = [
  ROLES.ADMINISTRADOR,
  ROLES.JUNTA_DIRECTIVA,
  ROLES.SOCIO_FUNDADOR,
  ROLES.MEDICO,
  ROLES.VOLUNTARIO,
];

// Dos filas: Donaciones -solo de la administradora, con Pacientes abierto a junta en la otra
// fila- y Pacientes -por defecto del personal de campo-.
function filas() {
  return [
    {
      id: "donaciones",
      modulo: "donaciones",
      nombre: "Donaciones",
      descripcion: "Donantes, aportes recibidos y constancias.",
      icono: "HeartHandshake",
      celdas: [
        { rol: ROLES.ADMINISTRADOR, estado: "siempre" },
        { rol: ROLES.JUNTA_DIRECTIVA, estado: "cerrado" },
        { rol: ROLES.SOCIO_FUNDADOR, estado: "cerrado" },
        { rol: ROLES.MEDICO, estado: "cerrado" },
        { rol: ROLES.VOLUNTARIO, estado: "cerrado" },
      ],
    },
    {
      id: "pacientes",
      modulo: "pacientes",
      nombre: "Pacientes",
      descripcion: "Expedientes clinicos, triaje, consultas y recetas.",
      icono: "Users",
      celdas: [
        { rol: ROLES.ADMINISTRADOR, estado: "siempre" },
        { rol: ROLES.JUNTA_DIRECTIVA, estado: "abierto" },
        { rol: ROLES.SOCIO_FUNDADOR, estado: "cerrado" },
        { rol: ROLES.MEDICO, estado: "por-defecto" },
        { rol: ROLES.VOLUNTARIO, estado: "por-defecto" },
      ],
    },
  ];
}

const mockEstadoHook = {
  filas: filas(),
  modulosPorRol: {
    [ROLES.ADMINISTRADOR]: 2,
    [ROLES.JUNTA_DIRECTIVA]: 1,
    [ROLES.SOCIO_FUNDADOR]: 0,
    [ROLES.MEDICO]: 1,
    [ROLES.VOLUNTARIO]: 1,
  },
  totalDeModulos: 2,
  cargando: false,
  error: null,
  celdaEnProceso: null,
  avisoSinEfecto: null,
  alternar: vi.fn(),
};

vi.mock("../../../../packages/shared/usuarios/useMatrizDeAccesoPorRol.js", async (original) => ({
  ...(await original()),
  useMatrizDeAccesoPorRol: vi.fn(() => mockEstadoHook),
}));

function pantalla() {
  return render(
    <MemoryRouter>
      <MatrizPermisosPorRolPage />
    </MemoryRouter>,
  );
}

describe("MatrizPermisosPorRolPage", () => {
  afterEach(() => {
    mockEstadoHook.filas = filas();
    mockEstadoHook.cargando = false;
    mockEstadoHook.error = null;
    mockEstadoHook.avisoSinEfecto = null;
    mockEstadoHook.alternar = vi.fn();
  });

  it("dice que abrir un modulo es solo ver, y donde se delegan las funciones", () => {
    pantalla();

    expect(screen.getByText("Acceso a módulos por rol")).toBeInTheDocument();
    expect(screen.getByText(/sin registrar, aprobar ni eliminar/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Colaboradores" })).toHaveAttribute(
      "href",
      "/colaboradores",
    );
  });

  it("si hay error, lo muestra", () => {
    mockEstadoHook.error = { mensaje: "No se pudo cargar la matriz." };
    pantalla();

    expect(screen.getByText("No se pudo cargar la matriz.")).toBeInTheDocument();
  });

  it("una fila por modulo y una columna por cada rol, con su etiqueta", () => {
    pantalla();

    expect(screen.getByText("Donaciones")).toBeInTheDocument();
    expect(screen.getByText("Pacientes")).toBeInTheDocument();
    for (const rol of ROLES_EN_ORDEN) {
      expect(
        screen.getByRole("columnheader", { name: new RegExp(ETIQUETAS_ROL[rol]) }),
      ).toBeInTheDocument();
    }
  });

  it("la administradora y los modulos por defecto no son casillas", () => {
    pantalla();

    // Donaciones: cuatro cerrados. Pacientes: junta abierta y socio cerrado. Seis interruptores;
    // "Siempre" y "Por defecto" no lo son.
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.getAllByText("Siempre")).toHaveLength(2);
    expect(screen.getAllByText("Por defecto")).toHaveLength(2);
  });

  it("lo abierto por la matriz se marca como solo ver", () => {
    pantalla();

    expect(screen.getByText("Solo ver")).toBeInTheDocument();
  });

  it("resume cuantos modulos ve cada rol", () => {
    pantalla();

    expect(screen.getAllByText("de 2 módulos")).toHaveLength(5);
  });

  it("encender una casilla llama a alternar con el rol, el modulo y su estado actual", () => {
    pantalla();

    const deMedico = screen
      .getAllByRole("checkbox")
      .find((casilla) => casilla.getAttribute("aria-label") === "Donaciones para Medico");
    fireEvent.click(deMedico);

    expect(mockEstadoHook.alternar).toHaveBeenCalledWith(ROLES.MEDICO, "donaciones", false);
  });

  it("muestra el aviso de sin efecto bajo la celda correcta", () => {
    mockEstadoHook.avisoSinEfecto = {
      rol: ROLES.MEDICO,
      modulo: "donaciones",
      mensaje: "El cambio no se aplico.",
    };
    pantalla();

    expect(screen.getByText("El cambio no se aplico.")).toBeInTheDocument();
  });
});
