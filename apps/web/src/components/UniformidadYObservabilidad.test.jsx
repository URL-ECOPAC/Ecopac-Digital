// Pruebas del lenguaje comun de cabeceras y botones, del cierre por inactividad y de la
// observabilidad del lado web (issue #762).
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter } from "react-router-dom";
import {
  CLAVE_ULTIMA_ACTIVIDAD,
  configurarDestinoDeErrores,
  crearAlmacenamientoEnMemoria,
  useExpiracionPorInactividad,
} from "@ecopac/shared";

import AvisoDeInactividad from "./AvisoDeInactividad";
import AvisoSinConexion from "./AvisoSinConexion";
import LimiteDeError from "./LimiteDeError";
import PageHeader from "./PageHeader";
import PrimaryButton from "./PrimaryButton";
import SecondaryButton from "./SecondaryButton";

expect.extend(matchers);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  configurarDestinoDeErrores(null);
});

describe("PageHeader", () => {
  it("dibuja el titulo como h1, el subtitulo y el filete de color", () => {
    render(<PageHeader title="Presupuestos" subtitle="Administracion financiera" />);

    const titulo = screen.getByRole("heading", { level: 1, name: "Presupuestos" });
    expect(titulo).toHaveClass("ec-cabecera-titulo");
    expect(screen.getByText("Administracion financiera")).toHaveClass("ec-cabecera-subtitulo");
    expect(screen.getByTestId("cabecera-acento")).toBeInTheDocument();
  });

  it("una accion con `to` es un enlace de verdad", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Donaciones" actions={[{ label: "Historial", to: "/historial" }]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Historial" })).toHaveAttribute("href", "/historial");
  });
});

describe("iconos automaticos de los botones", () => {
  it("un alta lleva el + y pierde el + escrito a mano", () => {
    const { container } = render(<PrimaryButton title="+ Nuevo Proyecto" />);

    expect(screen.getByRole("button")).toHaveTextContent(/^Nuevo Proyecto$/);
    expect(container.querySelector("svg.lucide-plus")).toBeInTheDocument();
  });

  it("un borrado lleva el basurero", () => {
    const { container } = render(<SecondaryButton title="Eliminar" variant="peligro" />);

    expect(container.querySelector("svg.lucide-trash2, svg.lucide-trash-2")).toBeInTheDocument();
  });

  it("volver lleva la flecha, editar el lapiz y ver detalle el ojo", () => {
    const { container: volver } = render(<SecondaryButton title="Volver a donaciones" />);
    expect(volver.querySelector("svg.lucide-arrow-left")).toBeInTheDocument();

    cleanup();
    const { container: editar } = render(<SecondaryButton title="Editar" />);
    expect(editar.querySelector("svg.lucide-pencil")).toBeInTheDocument();

    cleanup();
    const { container: detalle } = render(<SecondaryButton title="Ver detalle" />);
    expect(detalle.querySelector("svg.lucide-eye")).toBeInTheDocument();
  });

  it("una accion sin tipo no lleva icono, e icon={null} lo quita", () => {
    const { container: exportar } = render(<SecondaryButton title="Exportar CSV" />);
    expect(exportar.querySelector("svg")).not.toBeInTheDocument();

    cleanup();
    const { container: sinIcono } = render(<PrimaryButton title="Registrar" icon={null} />);
    expect(sinIcono.querySelector("svg")).not.toBeInTheDocument();
  });
});

describe("useExpiracionPorInactividad", () => {
  const MINUTO = 60 * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T10:00:00Z"));
  });

  it("avisa un minuto antes y cierra al cumplirse el limite", () => {
    const alVencer = vi.fn();
    const { result } = renderHook(() =>
      useExpiracionPorInactividad({ minutos: 2, segundosDeAviso: 60, alVencer }),
    );

    act(() => vi.advanceTimersByTime(59 * 1000));
    expect(result.current.avisoVisible).toBe(false);

    act(() => vi.advanceTimersByTime(2 * 1000));
    expect(result.current.avisoVisible).toBe(true);
    expect(result.current.segundosRestantes).toBeLessThanOrEqual(60);

    act(() => vi.advanceTimersByTime(MINUTO));
    expect(alVencer).toHaveBeenCalledTimes(1);
  });

  it("seguir conectado apaga el aviso y reinicia la cuenta", () => {
    const alVencer = vi.fn();
    const { result } = renderHook(() =>
      useExpiracionPorInactividad({ minutos: 2, segundosDeAviso: 60, alVencer }),
    );

    act(() => vi.advanceTimersByTime(70 * 1000));
    expect(result.current.avisoVisible).toBe(true);

    act(() => result.current.seguirConectado());
    expect(result.current.avisoVisible).toBe(false);

    act(() => vi.advanceTimersByTime(MINUTO));
    expect(alVencer).not.toHaveBeenCalled();
  });

  it("mientras el aviso esta a la vista, mover el raton no lo apaga", () => {
    const { result } = renderHook(() =>
      useExpiracionPorInactividad({ minutos: 2, segundosDeAviso: 60, alVencer: vi.fn() }),
    );

    act(() => vi.advanceTimersByTime(70 * 1000));
    act(() => result.current.registrarActividad());
    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.avisoVisible).toBe(true);
  });

  // El fallo por el que parecia que no existia: al recargar, la cuenta volvia a empezar.
  it("una sesion que lleva mas del limite quieta se cierra al abrir la pagina", () => {
    const almacenamiento = crearAlmacenamientoEnMemoria();
    almacenamiento.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(Date.now() - 45 * MINUTO));
    const alVencer = vi.fn();

    renderHook(() => useExpiracionPorInactividad({ minutos: 30, alVencer, almacenamiento }));

    expect(alVencer).toHaveBeenCalledTimes(1);
  });

  it("la actividad de otra pestana cuenta", () => {
    const almacenamiento = crearAlmacenamientoEnMemoria();
    const alVencer = vi.fn();
    renderHook(() =>
      useExpiracionPorInactividad({ minutos: 2, segundosDeAviso: 0, alVencer, almacenamiento }),
    );

    act(() => vi.advanceTimersByTime(90 * 1000));
    // Otra pestana escribe su actividad.
    almacenamiento.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(Date.now()));
    act(() => vi.advanceTimersByTime(90 * 1000));

    expect(alVencer).not.toHaveBeenCalled();
  });
});

describe("AvisoDeInactividad", () => {
  it("muestra la cuenta regresiva y las dos salidas", () => {
    const onSeguir = vi.fn();
    const onSalir = vi.fn();
    render(
      <AvisoDeInactividad visible segundosRestantes={45} onSeguir={onSeguir} onSalir={onSalir} />,
    );

    expect(screen.getByRole("timer")).toHaveTextContent("0:45");
    fireEvent.click(screen.getByText("Seguir conectado"));
    fireEvent.click(screen.getByText("Cerrar sesión ahora"));
    expect(onSeguir).toHaveBeenCalled();
    expect(onSalir).toHaveBeenCalled();
  });
});

describe("AvisoSinConexion", () => {
  it("no dibuja nada con red y avisa sin ella", () => {
    const { rerender } = render(<AvisoSinConexion enLinea />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<AvisoSinConexion enLinea={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Sin conexión");
  });
});

describe("LimiteDeError", () => {
  function Rompe() {
    throw new Error("fallo al pintar la ficha de persona@ejemplo.org");
  }

  it("en vez de la pagina en blanco, muestra que paso y reporta el error ya limpio", () => {
    const destino = vi.fn();
    configurarDestinoDeErrores(destino);
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <LimiteDeError ruta="/pacientes/3f2b8c1e-9a4d-4e21-8b7f-0c6d5e4a3b21">
        <Rompe />
      </LimiteDeError>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal en esta pantalla");
    expect(destino).toHaveBeenCalled();
    const reporte = destino.mock.calls[0][0];
    expect(reporte.mensaje).toBe("fallo al pintar la ficha de [correo]");
    expect(reporte.ruta).toBe("/pacientes/[id]");
  });
});
