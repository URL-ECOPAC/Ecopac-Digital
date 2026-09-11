// Prueba de ModalAsignarPersonal (Modulo III: asignar personal, issue #778).
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

import ModalAsignarPersonal from "./ModalAsignarPersonal";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

const PERSONA_DE_EJEMPLO = {
  id: "perfil-1",
  nombreCompleto: "Ana Perez",
  rolEtiqueta: "Medico",
};

const mockEstadoHook = {
  busqueda: "",
  setBusqueda: vi.fn(),
  rolFiltro: null,
  setRolFiltro: vi.fn(),
  buscando: false,
  resultados: [],
  resultadosTruncados: false,
  errorBusqueda: null,
  personaElegida: null,
  elegirPersona: vi.fn(),
  volverABuscar: vi.fn(),
  valores: {},
  errores: {},
  setCampo: vi.fn(),
  verificandoChoque: false,
  advertenciaChoque: null,
  advertenciaTraslape: null,
  errorVerificacionChoque: null,
  enviando: false,
  error: null,
  advertenciasGuardado: [],
  asignar: vi.fn(async () => ({ ok: true })),
  reiniciar: vi.fn(),
};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useAsignacionPersonal: vi.fn(() => mockEstadoHook),
}));

const { useAsignacionPersonal } = await import("@ecopac/shared");

function pantalla(props = {}) {
  return render(
    <ModalAsignarPersonal
      visible
      jornadaId="jor-1"
      jornadaFecha="2026-03-01"
      personal={[]}
      onClose={vi.fn()}
      onAsignado={vi.fn()}
      {...props}
    />,
  );
}

describe("ModalAsignarPersonal", () => {
  afterEach(() => {
    mockEstadoHook.busqueda = "";
    mockEstadoHook.resultados = [];
    mockEstadoHook.errorBusqueda = null;
    mockEstadoHook.resultadosTruncados = false;
    mockEstadoHook.personaElegida = null;
    mockEstadoHook.verificandoChoque = false;
    mockEstadoHook.advertenciaChoque = null;
    mockEstadoHook.advertenciaTraslape = null;
    mockEstadoHook.errorVerificacionChoque = null;
    mockEstadoHook.error = null;
    mockEstadoHook.advertenciasGuardado = [];
    mockEstadoHook.asignar = vi.fn(async () => ({ ok: true }));
    useAsignacionPersonal.mockClear();
    mockEstadoHook.elegirPersona.mockClear();
  });

  it("sin busqueda ni rol, la lista invita a buscar", () => {
    pantalla();

    expect(
      screen.getByText("Escribe un nombre, un correo o elige un rol para buscar."),
    ).toBeInTheDocument();
  });

  it("elegir una fila de resultados dispara elegirPersona()", () => {
    mockEstadoHook.busqueda = "ana";
    mockEstadoHook.resultados = [PERSONA_DE_EJEMPLO];
    pantalla();

    fireEvent.click(screen.getByText("Ana Perez"));

    expect(mockEstadoHook.elegirPersona).toHaveBeenCalledWith(PERSONA_DE_EJEMPLO);
  });

  it("con resultados truncados, muestra el aviso de afinar la busqueda", () => {
    mockEstadoHook.busqueda = "a";
    mockEstadoHook.resultadosTruncados = true;
    pantalla();

    expect(screen.getByText(/Hay mas resultados de los que se muestran/)).toBeInTheDocument();
  });

  it("con una persona elegida, muestra su nombre y el formulario de rol/horario", () => {
    mockEstadoHook.personaElegida = PERSONA_DE_EJEMPLO;
    pantalla();

    expect(screen.getByText("Ana Perez", { exact: false })).toBeInTheDocument();
  });

  it("una advertencia de choque de horario se muestra sin bloquear el envio", () => {
    mockEstadoHook.personaElegida = PERSONA_DE_EJEMPLO;
    mockEstadoHook.advertenciaChoque = "Esta persona ya esta asignada otra jornada ese dia.";
    pantalla();

    expect(
      screen.getByText("Esta persona ya esta asignada otra jornada ese dia."),
    ).toBeInTheDocument();
    expect(screen.getByText("Asignar")).toBeInTheDocument();
  });

  it("si no se pudo verificar el choque, lo dice explicitamente en vez de callar", () => {
    mockEstadoHook.personaElegida = PERSONA_DE_EJEMPLO;
    mockEstadoHook.errorVerificacionChoque = { mensaje: "fallo de red" };
    pantalla();

    expect(
      screen.getByText(/No se pudo comprobar si esta persona ya esta asignada/),
    ).toBeInTheDocument();
  });

  it("Asignar dispara asignar(), y con exito muestra la confirmacion y llama a onAsignado()", async () => {
    const onAsignado = vi.fn();
    mockEstadoHook.personaElegida = PERSONA_DE_EJEMPLO;
    pantalla({ onAsignado });

    fireEvent.click(screen.getByText("Asignar"));

    expect(await screen.findByText("Ana Perez quedo asignado a esta jornada.")).toBeInTheDocument();
    expect(onAsignado).toHaveBeenCalled();
  });

  // Camino de error (issue #759/#778): si asignar() falla, el formulario se queda visible con
  // el error, no pasa a la confirmacion como si la asignacion se hubiera guardado.
  it("camino de error: si asignar() falla, muestra el error y no la confirmacion", async () => {
    mockEstadoHook.personaElegida = PERSONA_DE_EJEMPLO;
    mockEstadoHook.error = { mensaje: "Esta persona ya esta asignada a esta jornada." };
    mockEstadoHook.asignar = vi.fn(async () => ({ ok: false }));
    pantalla();

    fireEvent.click(screen.getByText("Asignar"));

    expect(
      await screen.findByText("Esta persona ya esta asignada a esta jornada."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/quedo asignado a esta jornada/)).not.toBeInTheDocument();
  });
});
