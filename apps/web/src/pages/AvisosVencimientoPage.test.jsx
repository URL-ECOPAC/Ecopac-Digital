// Prueba de la pantalla de avisos de vencimiento (issue #899).
// @vitest-environment jsdom
//
// Se simula useConfiguracionAlertasVencimiento: sus reglas se prueban en packages/shared. Aqui se
// comprueba que la pantalla dibuja lo que el hook entrega y le devuelve cada accion.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";

expect.extend(matchers);

const mockEstado = {};

function estadoBase() {
  return {
    umbrales: ["90", "30"],
    errores: {},
    errorGeneral: null,
    cargando: false,
    error: null,
    guardando: false,
    errorGuardar: null,
    guardadoEn: null,
    hayCambios: false,
    puedeEditar: true,
    puedeAgregar: true,
    puedeQuitar: true,
    resumen: "90 y 30 días antes, y el día que vence",
    actualizadoPorNombre: "Ana Prueba",
    actualizadoEn: "2026-09-30T12:00:00Z",
    maximoDeUmbrales: 4,
    diaMaximo: 365,
    agregarUmbral: vi.fn(),
    quitarUmbral: vi.fn(),
    cambiarUmbral: vi.fn(),
    guardar: vi.fn(async () => true),
    recargar: vi.fn(),
  };
}

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useConfiguracionAlertasVencimiento: vi.fn(() => mockEstado),
}));

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ rol: "administrador" }),
}));

const { default: AvisosVencimientoPage } = await import("./AvisosVencimientoPage");

function pantalla(cambios = {}) {
  Object.assign(mockEstado, estadoBase(), cambios);
  return render(
    <MemoryRouter>
      <AvisosVencimientoPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe("AvisosVencimientoPage", () => {
  it("muestra cada antelacion y el aviso obligatorio del dia del vencimiento", () => {
    pantalla();

    expect(
      screen.getByText("Hoy se avisa: 90 y 30 días antes, y el día que vence"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Aviso 1")).toHaveValue(90);
    expect(screen.getByLabelText("Aviso 2")).toHaveValue(30);
    expect(screen.getByLabelText("Aviso obligatorio")).toBeDisabled();
  });

  it("agregar, quitar, cambiar y guardar llaman al hook", () => {
    pantalla({ hayCambios: true });

    fireEvent.click(screen.getByText("Agregar aviso"));
    expect(mockEstado.agregarUmbral).toHaveBeenCalled();

    fireEvent.click(screen.getAllByText("Quitar")[1]);
    expect(mockEstado.quitarUmbral).toHaveBeenCalledWith(1);

    fireEvent.change(screen.getByLabelText("Aviso 1"), { target: { value: "60" } });
    expect(mockEstado.cambiarUmbral).toHaveBeenCalledWith(0, 60);

    fireEvent.click(screen.getByText("Guardar"));
    expect(mockEstado.guardar).toHaveBeenCalled();
  });

  // Los avisos previos aparecen segun se necesitan: se pueden quitar todos y queda solo el del
  // dia del vencimiento.
  it("sin avisos previos muestra solo el obligatorio y deja agregar", () => {
    pantalla({ umbrales: [], puedeQuitar: false, resumen: "Solo el día que vence" });

    expect(screen.queryByLabelText("Aviso 1")).not.toBeInTheDocument();
    expect(
      screen.getByText("Sin avisos previos: solo se avisa el día que vence."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Aviso obligatorio")).toBeDisabled();
    expect(screen.getByText("Agregar aviso").closest("button")).not.toBeDisabled();
  });

  it("con cuatro avisos el boton de agregar desaparece", () => {
    pantalla({ umbrales: ["90", "60", "30", "7"], puedeAgregar: false });

    expect(screen.queryByText("Agregar aviso")).not.toBeInTheDocument();
  });

  it("muestra los errores de validacion y de guardado", () => {
    pantalla({
      errores: { 0: "Debe ser un número entero entre 1 y 365." },
      errorGeneral: "Configura al menos una antelación.",
      errorGuardar: { mensaje: "No tienes permiso para esta acción." },
    });

    expect(screen.getByText("Debe ser un número entero entre 1 y 365.")).toBeInTheDocument();
    expect(screen.getByText("Configura al menos una antelación.")).toBeInTheDocument();
    expect(screen.getByText("No tienes permiso para esta acción.")).toBeInTheDocument();
  });

  it("sin permiso no muestra el formulario", () => {
    pantalla({ puedeEditar: false });

    expect(
      screen.getByText("No tienes permiso para configurar los avisos de vencimiento."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Guardar")).not.toBeInTheDocument();
  });
});
