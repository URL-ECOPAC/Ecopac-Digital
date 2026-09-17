// Prueba de ModalCorreccionTriaje (issue #756: actualizarTriaje()/puedeCorregirTriaje() ya
// existian, probados, sin ninguna pantalla que los llamara).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ModalCorreccionTriaje from "./ModalCorreccionTriaje";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const TRIAJE = {
  id: "triaje-1",
  presionSistolica: 120,
  presionDiastolica: 80,
  frecuenciaCardiaca: 72,
  glucosa: 95,
  peso: 68,
  talla: 165,
  temperatura: 36.5,
};

const mockEstadoHook = {
  valores: { ...TRIAJE },
  errores: {},
  error: null,
  enviando: false,
  setCampo: vi.fn(),
  guardar: vi.fn(async () => ({ ok: true, triaje: TRIAJE })),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useCorreccionTriaje: vi.fn(() => mockEstadoHook),
}));

const { useCorreccionTriaje } = await import("@ecopac/shared");

function pantalla(props = {}) {
  return render(<ModalCorreccionTriaje triaje={TRIAJE} onClose={vi.fn()} {...props} />);
}

describe("ModalCorreccionTriaje", () => {
  afterEach(() => {
    mockEstadoHook.valores = { ...TRIAJE };
    mockEstadoHook.errores = {};
    mockEstadoHook.error = null;
    mockEstadoHook.setCampo = vi.fn();
    useCorreccionTriaje.mockClear();
  });

  it("muestra los siete signos con sus valores actuales", () => {
    pantalla();

    expect(screen.getByLabelText("Presión sistólica")).toHaveValue(120);
    expect(screen.getByLabelText("Presión diastólica")).toHaveValue(80);
    expect(screen.getByLabelText("Frecuencia cardiaca")).toHaveValue(72);
    expect(screen.getByLabelText("Glucosa")).toHaveValue(95);
    expect(screen.getByLabelText("Peso")).toHaveValue(68);
    expect(screen.getByLabelText("Talla")).toHaveValue(165);
    expect(screen.getByLabelText("Temperatura")).toHaveValue(36.5);
  });

  it("corregir un signo llama a setCampo con el numero convertido", () => {
    pantalla();

    fireEvent.change(screen.getByLabelText("Peso"), { target: { value: "70" } });

    expect(mockEstadoHook.setCampo).toHaveBeenCalledWith("peso", 70);
  });

  it("Guardar dispara guardar() y con exito llama a onGuardado()", async () => {
    const onGuardado = vi.fn();
    pantalla({ onGuardado });

    fireEvent.click(screen.getByText("Guardar"));

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalledWith(TRIAJE));
  });

  // Camino de error: RLS puede bloquear en silencio (0 filas) si el rol no puede corregir.
  it("camino de error: si guardar falla, muestra el error y no cierra el modal", async () => {
    const onGuardado = vi.fn();
    mockEstadoHook.error = {
      mensaje:
        "No se pudo corregir el triaje: puede que ya no exista o que tu rol no pueda editarlo.",
    };
    mockEstadoHook.guardar = vi.fn(async () => ({ ok: false }));
    pantalla({ onGuardado });

    fireEvent.click(screen.getByText("Guardar"));

    await vi.waitFor(() => expect(mockEstadoHook.guardar).toHaveBeenCalled());
    expect(onGuardado).not.toHaveBeenCalled();
    expect(screen.getByText(/No se pudo corregir el triaje/)).toBeInTheDocument();
  });

  it("Cancelar llama a onClose()", () => {
    const onClose = vi.fn();
    pantalla({ onClose });

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onClose).toHaveBeenCalled();
  });
});
