// Prueba de ModalCorreccionConsulta (issue #756: actualizarConsulta()/puedeCorregirConsulta()
// ya existian, probados, sin ninguna pantalla que los llamara).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ModalCorreccionConsulta from "./ModalCorreccionConsulta";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const CONSULTA = {
  id: "con-1",
  motivoConsulta: "Dolor de cabeza",
  antecedentes: "Migrana previa",
  sintomas: "Dolor pulsatil",
  exploracion: "Sin hallazgos",
  tratamiento: "Analgesico",
  observaciones: "Control en una semana",
  planSeguimiento: "Reevaluar",
};

const mockEstadoHook = {
  valores: { ...CONSULTA },
  error: null,
  enviando: false,
  setCampo: vi.fn(),
  guardar: vi.fn(async () => ({ ok: true, consulta: CONSULTA })),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useCorreccionConsulta: vi.fn(() => mockEstadoHook),
}));

const { useCorreccionConsulta } = await import("@ecopac/shared");

function pantalla(props = {}) {
  return render(<ModalCorreccionConsulta consulta={CONSULTA} onClose={vi.fn()} {...props} />);
}

describe("ModalCorreccionConsulta", () => {
  afterEach(() => {
    mockEstadoHook.valores = { ...CONSULTA };
    mockEstadoHook.error = null;
    mockEstadoHook.setCampo = vi.fn();
    useCorreccionConsulta.mockClear();
  });

  it("muestra los siete campos con sus valores actuales", () => {
    pantalla();

    expect(screen.getByLabelText("Motivo de consulta")).toHaveValue("Dolor de cabeza");
    expect(screen.getByLabelText("Antecedentes")).toHaveValue("Migrana previa");
    expect(screen.getByLabelText("Sintomas")).toHaveValue("Dolor pulsatil");
    expect(screen.getByLabelText("Exploracion")).toHaveValue("Sin hallazgos");
    expect(screen.getByLabelText("Tratamiento")).toHaveValue("Analgesico");
    expect(screen.getByLabelText("Observaciones")).toHaveValue("Control en una semana");
    expect(screen.getByLabelText("Plan de seguimiento")).toHaveValue("Reevaluar");
  });

  it("no ofrece ningun campo de diagnosticos", () => {
    pantalla();

    expect(screen.queryByLabelText("Diagnosticos")).not.toBeInTheDocument();
  });

  it("corregir un campo llama a setCampo con el texto escrito", () => {
    pantalla();

    fireEvent.change(screen.getByLabelText("Tratamiento"), {
      target: { value: "Ibuprofeno" },
    });

    expect(mockEstadoHook.setCampo).toHaveBeenCalledWith("tratamiento", "Ibuprofeno");
  });

  it("Guardar dispara guardar() y con exito llama a onGuardado()", async () => {
    const onGuardado = vi.fn();
    pantalla({ onGuardado });

    fireEvent.click(screen.getByText("Guardar"));

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalledWith(CONSULTA));
  });

  it("camino de error: si guardar falla, muestra el error y no cierra el modal", async () => {
    const onGuardado = vi.fn();
    mockEstadoHook.error = { mensaje: "El motivo de consulta es obligatorio." };
    mockEstadoHook.guardar = vi.fn(async () => ({ ok: false }));
    pantalla({ onGuardado });

    fireEvent.click(screen.getByText("Guardar"));

    await vi.waitFor(() => expect(mockEstadoHook.guardar).toHaveBeenCalled());
    expect(onGuardado).not.toHaveBeenCalled();
    expect(screen.getByText("El motivo de consulta es obligatorio.")).toBeInTheDocument();
  });

  it("Cancelar llama a onClose()", () => {
    const onClose = vi.fn();
    pantalla({ onClose });

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onClose).toHaveBeenCalled();
  });
});
