// Prueba de ModalPermisosUsuario (issue #756: motivo/otorgadoPorNombre de una excepcion
// individual no tenian ningun campo que los pidiera ni los mostrara).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { ORIGEN_PERMISO } from "@ecopac/shared";

import ModalPermisosUsuario from "./ModalPermisosUsuario";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const PERMISO_DEL_ROL = {
  clave: "pacientes.editar",
  modulo: "pacientes",
  descripcion: "Editar pacientes",
  concedido: true,
  origen: ORIGEN_PERMISO.ROL,
  motivo: null,
  otorgadoPorNombre: null,
};

const PERMISO_INDIVIDUAL = {
  clave: "jornadas.gestionar",
  modulo: "jornadas",
  descripcion: "Gestionar jornadas",
  concedido: true,
  origen: ORIGEN_PERMISO.INDIVIDUAL,
  motivo: "Cobertura de fin de semana",
  otorgadoPorNombre: "Ana Lopez",
};

const mockEstadoHook = {
  modulos: [],
  cargando: false,
  error: null,
  claveEnProceso: null,
  avisoSinEfecto: null,
  conceder: vi.fn(),
  revocar: vi.fn(),
  restablecer: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useGestionPermisos: vi.fn(() => mockEstadoHook),
}));

const { useGestionPermisos } = await import("@ecopac/shared");

function pantalla() {
  return render(
    <ModalPermisosUsuario
      perfil={{ id: "u1", nombres: "Carlos", apellidos: "Ruiz" }}
      onClose={vi.fn()}
    />,
  );
}

describe("ModalPermisosUsuario", () => {
  afterEach(() => {
    mockEstadoHook.modulos = [];
    mockEstadoHook.claveEnProceso = null;
    mockEstadoHook.avisoSinEfecto = null;
    mockEstadoHook.conceder = vi.fn();
    mockEstadoHook.revocar = vi.fn();
    useGestionPermisos.mockClear();
  });

  it("un permiso individual muestra quien lo otorgo y el motivo", () => {
    mockEstadoHook.modulos = [{ modulo: "jornadas", permisos: [PERMISO_INDIVIDUAL] }];
    pantalla();

    expect(screen.getByText(/Por Ana Lopez: Cobertura de fin de semana/)).toBeInTheDocument();
  });

  it("un permiso individual sin motivo registrado lo dice explicitamente", () => {
    mockEstadoHook.modulos = [
      { modulo: "jornadas", permisos: [{ ...PERMISO_INDIVIDUAL, motivo: null }] },
    ];
    pantalla();

    expect(screen.getByText(/Por Ana Lopez\. Sin motivo registrado\./)).toBeInTheDocument();
  });

  it("un permiso heredado del rol no muestra ninguna linea de motivo", () => {
    mockEstadoHook.modulos = [{ modulo: "pacientes", permisos: [PERMISO_DEL_ROL] }];
    pantalla();

    expect(screen.queryByText(/Por /)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin motivo registrado/)).not.toBeInTheDocument();
  });

  it("escribir un motivo y revocar lo pasa junto con la clave", () => {
    mockEstadoHook.modulos = [{ modulo: "jornadas", permisos: [PERMISO_INDIVIDUAL] }];
    pantalla();

    fireEvent.change(screen.getByPlaceholderText("Motivo (opcional)"), {
      target: { value: "Termino la cobertura" },
    });
    fireEvent.click(screen.getByText("Revocar"));

    expect(mockEstadoHook.revocar).toHaveBeenCalledWith(
      "jornadas.gestionar",
      "Termino la cobertura",
    );
  });

  it("conceder sin escribir motivo lo pasa como undefined, sin inventar un valor", () => {
    mockEstadoHook.modulos = [
      { modulo: "pacientes", permisos: [{ ...PERMISO_DEL_ROL, concedido: false }] },
    ];
    pantalla();

    fireEvent.click(screen.getByText("Conceder"));

    expect(mockEstadoHook.conceder).toHaveBeenCalledWith("pacientes.editar", undefined);
  });
});
