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

const DIAGNOSTICOS = [{ id: "dx-1", vinculoId: "vinculo-1", nombre: "Cefalea", esPrincipal: true }];

const mockEstadoHook = {
  valores: { ...CONSULTA },
  error: null,
  enviando: false,
  setCampo: vi.fn(),
  guardar: vi.fn(async () => ({ ok: true, consulta: CONSULTA })),
  diagnosticos: DIAGNOSTICOS,
  catalogoDiagnosticos: [
    { value: "dx-2", label: "Resfriado" },
    { value: "dx-3", label: "Migrana" },
  ],
  diagnosticoNuevo: "",
  setDiagnosticoNuevo: vi.fn(),
  errorDiagnostico: null,
  quitarDiagnostico: vi.fn(async () => ({ ok: true })),
  agregarDiagnostico: vi.fn(async () => ({ ok: true })),
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
    mockEstadoHook.diagnosticos = DIAGNOSTICOS;
    mockEstadoHook.diagnosticoNuevo = "";
    mockEstadoHook.errorDiagnostico = null;
    mockEstadoHook.quitarDiagnostico = vi.fn(async () => ({ ok: true }));
    mockEstadoHook.agregarDiagnostico = vi.fn(async () => ({ ok: true }));
    useCorreccionConsulta.mockClear();
  });

  it("muestra los siete campos con sus valores actuales", () => {
    pantalla();

    expect(screen.getByLabelText("Motivo de consulta")).toHaveValue("Dolor de cabeza");
    expect(screen.getByLabelText("Antecedentes")).toHaveValue("Migrana previa");
    expect(screen.getByLabelText("Síntomas")).toHaveValue("Dolor pulsatil");
    expect(screen.getByLabelText("Exploración")).toHaveValue("Sin hallazgos");
    expect(screen.getByLabelText("Tratamiento")).toHaveValue("Analgesico");
    expect(screen.getByLabelText("Observaciones")).toHaveValue("Control en una semana");
    expect(screen.getByLabelText("Plan de seguimiento")).toHaveValue("Reevaluar");
  });

  it("muestra los diagnosticos actuales de la consulta, con el principal marcado", () => {
    pantalla();

    expect(screen.getByText("Cefalea (principal)")).toBeInTheDocument();
  });

  it("Quitar llama a quitarDiagnostico() con el id del vinculo, no el del diagnostico", () => {
    pantalla();

    fireEvent.click(screen.getByText("Quitar"));

    expect(mockEstadoHook.quitarDiagnostico).toHaveBeenCalledWith("vinculo-1");
  });

  it("sin diagnosticos registrados, lo dice en vez de una lista vacia", () => {
    mockEstadoHook.diagnosticos = [];
    pantalla();

    expect(screen.getByText("Sin diagnosticos registrados.")).toBeInTheDocument();
  });

  it("Agregar esta deshabilitado sin un diagnostico elegido", () => {
    pantalla();

    expect(screen.getByText("Agregar")).toBeDisabled();
  });

  it("con un diagnostico elegido, Agregar llama a agregarDiagnostico()", () => {
    mockEstadoHook.diagnosticoNuevo = "dx-2";
    pantalla();

    fireEvent.click(screen.getByText("Agregar"));

    expect(mockEstadoHook.agregarDiagnostico).toHaveBeenCalled();
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
