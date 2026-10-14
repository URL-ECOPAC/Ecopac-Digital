// Prueba de ModalEdicionTurno (issue #185, ampliado por la issue #756: asistio no tenia ningun
// campo pese a que se guardaba y se mostraba).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ModalEdicionTurno from "./ModalEdicionTurno";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const FILA = {
  id: "asignacion-1",
  perfilId: "perfil-1",
  perfil: "Ana Perez",
  horaInicio: "08:00",
  horaFin: "12:00",
  responsabilidad: "triaje",
  asistio: false,
};

const mockEstadoHook = {
  valores: { ...FILA },
  errores: {},
  error: null,
  enviando: false,
  setCampo: vi.fn(),
  guardar: vi.fn(async () => ({ ok: true, asignacion: FILA })),
  advertenciaChoque: null,
  advertenciaTraslape: null,
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useEdicionTurno: vi.fn(() => mockEstadoHook),
}));

const { useEdicionTurno } = await import("@ecopac/shared");

function pantalla(props = {}) {
  return render(
    <ModalEdicionTurno jornadaId="jornada-1" fila={FILA} onClose={vi.fn()} {...props} />,
  );
}

describe("ModalEdicionTurno", () => {
  afterEach(() => {
    mockEstadoHook.valores = { ...FILA };
    mockEstadoHook.errores = {};
    mockEstadoHook.error = null;
    mockEstadoHook.setCampo = vi.fn();
    mockEstadoHook.advertenciaChoque = null;
    mockEstadoHook.advertenciaTraslape = null;
    useEdicionTurno.mockClear();
  });

  it("muestra el checkbox de asistio, sin marcar cuando la persona no ha asistido", () => {
    pantalla();

    expect(screen.getByLabelText("Asistio")).not.toBeChecked();
  });

  it("con asistio true, el checkbox aparece marcado", () => {
    mockEstadoHook.valores = { ...FILA, asistio: true };
    pantalla();

    expect(screen.getByLabelText("Asistio")).toBeChecked();
  });

  it("marcar el checkbox llama a setCampo con el booleano, no con el evento", () => {
    pantalla();

    fireEvent.click(screen.getByLabelText("Asistio"));

    expect(mockEstadoHook.setCampo).toHaveBeenCalledWith("asistio", true);
  });

  it("Guardar dispara guardar() y con exito llama a onGuardado()", async () => {
    const onGuardado = vi.fn();
    pantalla({ onGuardado });

    fireEvent.click(screen.getByText("Guardar"));

    await vi.waitFor(() => expect(onGuardado).toHaveBeenCalledWith(FILA));
  });
});
