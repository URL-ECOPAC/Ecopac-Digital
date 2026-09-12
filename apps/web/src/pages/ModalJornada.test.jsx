// Prueba de ModalJornada (Modulo III: crear/editar jornada, issue #778).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ModalJornada from "./ModalJornada";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const CATALOGOS_VACIOS = { departamentos: [], municipios: [], comunidades: [], proyectos: [] };

const mockEstadoHook = {
  valores: {},
  errores: {},
  error: null,
  enviando: false,
  cargando: false,
  esEdicion: false,
  catalogos: CATALOGOS_VACIOS,
  departamentoId: null,
  municipioId: null,
  setDepartamento: vi.fn(),
  setMunicipio: vi.fn(),
  setCampo: vi.fn(),
  advertenciaDuplicado: null,
  enviar: vi.fn(async () => ({ ok: true, jornada: { id: "jor-nuevo" } })),
  cancelar: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useFormularioJornada: vi.fn(() => mockEstadoHook),
}));

const { useFormularioJornada } = await import("@ecopac/shared");

function pantalla(props = {}) {
  return render(
    <ModalJornada rol="administrador" onClose={vi.fn()} onGuardado={vi.fn()} {...props} />,
  );
}

describe("ModalJornada", () => {
  afterEach(() => {
    mockEstadoHook.valores = {};
    mockEstadoHook.errores = {};
    mockEstadoHook.error = null;
    mockEstadoHook.enviando = false;
    mockEstadoHook.cargando = false;
    mockEstadoHook.esEdicion = false;
    mockEstadoHook.advertenciaDuplicado = null;
    mockEstadoHook.enviar = vi.fn(async () => ({ ok: true, jornada: { id: "jor-nuevo" } }));
    useFormularioJornada.mockClear();
    mockEstadoHook.cancelar.mockClear();
  });

  it("sin jornada (alta), el titulo es Nueva jornada y el boton dice Crear", () => {
    pantalla();

    expect(screen.getByText("Nueva jornada")).toBeInTheDocument();
    expect(screen.getByText("Crear")).toBeInTheDocument();
  });

  it("con jornada (edicion), el titulo es Editar jornada y el boton dice Guardar", () => {
    mockEstadoHook.esEdicion = true;
    pantalla({ jornada: { id: "jor-1", nombre: "Jornada Vieja" } });

    expect(screen.getByText("Editar jornada")).toBeInTheDocument();
    expect(screen.getByText("Guardar")).toBeInTheDocument();
  });

  it("Crear/Guardar dispara enviar(), y con exito llama a onGuardado() y onClose()", async () => {
    const onGuardado = vi.fn();
    const onClose = vi.fn();
    pantalla({ onGuardado, onClose });

    fireEvent.click(screen.getByText("Crear"));

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalledWith({ id: "jor-nuevo" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Cancelar llama a cancelar() y a onClose()", () => {
    const onClose = vi.fn();
    pantalla({ onClose });

    fireEvent.click(screen.getByText("Cancelar"));

    expect(mockEstadoHook.cancelar).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("una advertencia de posible duplicado se muestra sin bloquear el formulario", () => {
    mockEstadoHook.advertenciaDuplicado = "Ya existe una jornada con ese nombre en esa fecha.";
    pantalla();

    expect(
      screen.getByText("Ya existe una jornada con ese nombre en esa fecha."),
    ).toBeInTheDocument();
    expect(screen.getByText("Crear")).toBeInTheDocument();
  });

  // Camino de error (issue #759/#778): si enviar() falla, el modal se queda abierto con el
  // error visible, no se cierra ni llama a onGuardado() como si hubiera funcionado.
  it("camino de error: si guardar falla, muestra el error y no cierra el modal", async () => {
    const onGuardado = vi.fn();
    const onClose = vi.fn();
    mockEstadoHook.error = { mensaje: "Ya existe una jornada con ese nombre en esa fecha." };
    mockEstadoHook.enviar = vi.fn(async () => ({ ok: false }));
    pantalla({ onGuardado, onClose });

    fireEvent.click(screen.getByText("Crear"));

    await vi.waitFor(() => expect(mockEstadoHook.enviar).toHaveBeenCalled());
    expect(onGuardado).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByText("Ya existe una jornada con ese nombre en esa fecha."),
    ).toBeInTheDocument();
  });
});
