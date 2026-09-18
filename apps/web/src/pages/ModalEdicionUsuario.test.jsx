// Prueba de ModalEdicionUsuario (issue #756: fechaIngreso/direccion/notas no tenian ningun
// campo en el formulario, pese a que actualizarUsuario() ya las aceptaba).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import { ROLES } from "@ecopac/shared";

import ModalEdicionUsuario from "./ModalEdicionUsuario";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const PERFIL = {
  id: "u1",
  nombres: "Carlos",
  apellidos: "Ruiz",
  telefono: "5512-3456",
  rol: ROLES.VOLUNTARIO,
  activo: true,
  fechaIngreso: "2026-01-15",
  direccion: "Zona 10, Guatemala",
  notas: "Disponible fines de semana",
};

const mockEstadoHook = {
  valores: { ...PERFIL },
  errores: {},
  error: null,
  enviando: false,
  setCampo: vi.fn(),
  guardar: vi.fn(async () => ({ ok: true, perfil: PERFIL })),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useEdicionUsuario: vi.fn(() => mockEstadoHook),
}));

const mockRefrescarPerfil = vi.fn(async () => {});

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ refrescarPerfil: mockRefrescarPerfil }),
}));

const { useEdicionUsuario } = await import("@ecopac/shared");

function pantalla() {
  return render(<ModalEdicionUsuario perfil={PERFIL} idSesionActual="otro-id" onClose={vi.fn()} />);
}

describe("ModalEdicionUsuario", () => {
  afterEach(() => {
    mockEstadoHook.valores = { ...PERFIL };
    mockEstadoHook.errores = {};
    mockEstadoHook.setCampo = vi.fn();
    useEdicionUsuario.mockClear();
  });

  it("muestra fecha de ingreso, direccion y notas con sus valores actuales", () => {
    pantalla();

    expect(screen.getByLabelText("Fecha de ingreso")).toHaveValue("2026-01-15");
    expect(screen.getByLabelText("Dirección")).toHaveValue("Zona 10, Guatemala");
    expect(screen.getByLabelText("Notas")).toHaveValue("Disponible fines de semana");
  });

  it("direccion y notas se editan como area de texto, no como input de una linea", () => {
    pantalla();

    expect(screen.getByLabelText("Dirección").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Notas").tagName).toBe("TEXTAREA");
  });

  it("cambiar la fecha de ingreso llama a setCampo con el id correcto", () => {
    pantalla();

    fireEvent.change(screen.getByLabelText("Fecha de ingreso"), {
      target: { value: "2026-03-01" },
    });

    expect(mockEstadoHook.setCampo).toHaveBeenCalledWith("fechaIngreso", "2026-03-01");
  });

  it("escribir en notas llama a setCampo con el texto escrito", () => {
    pantalla();

    fireEvent.change(screen.getByLabelText("Notas"), {
      target: { value: "Nueva nota" },
    });

    expect(mockEstadoHook.setCampo).toHaveBeenCalledWith("notas", "Nueva nota");
  });

  // Issue #840: editarse a uno mismo desde Colaboradores no llegaba a Mi perfil ni a la cabecera.
  it("le pasa al hook quien tiene la sesion y como refrescar su perfil", () => {
    pantalla();

    expect(useEdicionUsuario).toHaveBeenCalledWith(PERFIL, {
      idSesionActual: "otro-id",
      refrescarPerfilPropio: mockRefrescarPerfil,
    });
  });
});
