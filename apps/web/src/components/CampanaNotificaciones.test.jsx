// Prueba de la campana de la cabecera y su ventana emergente (issue #755).
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import CampanaNotificaciones from "./CampanaNotificaciones";

expect.extend(matchers);

function notificacion(n) {
  return {
    id: `n-${n}`,
    categoria: "validacion",
    titulo: `Movimiento por validar ${n}`,
    cuerpo: "Alguien registro un movimiento.",
    enlace: "/inventario?tab=validacion",
    leida: false,
    createdAt: "2026-09-18T12:00:00Z",
  };
}

const mockBuzon = {};
const mockContador = { cantidad: 0 };

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useBuzonNotificaciones: vi.fn(() => mockBuzon),
  useContadorNotificaciones: vi.fn(() => mockContador),
}));

function Ubicacion() {
  const { pathname, search } = useLocation();
  return <p data-testid="ubicacion">{`${pathname}${search}`}</p>;
}

function pantalla() {
  return render(
    <MemoryRouter initialEntries={["/pacientes"]}>
      <CampanaNotificaciones perfilId="perfil-1" />
      <Routes>
        <Route path="*" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockContador.cantidad = 8;
  Object.assign(mockBuzon, {
    notificaciones: Array.from({ length: 8 }, (_, i) => notificacion(i + 1)),
    noLeidas: 8,
    cargando: false,
    error: null,
    errorAccion: null,
    recargar: vi.fn(),
    abrir: vi.fn(async () => true),
    marcarTodas: vi.fn(async () => true),
  });
});

afterEach(() => {
  cleanup();
});

describe("CampanaNotificaciones", () => {
  it("muestra el contador de no leidas", () => {
    pantalla();
    expect(screen.getByLabelText("Notificaciones: 8 sin leer")).toHaveTextContent("8");
  });

  it("al pulsarla abre la ventana con las recientes, sin salir de la pantalla actual", () => {
    pantalla();

    fireEvent.click(screen.getByLabelText("Notificaciones: 8 sin leer"));

    expect(screen.getByText("Movimiento por validar 1")).toBeInTheDocument();
    expect(screen.getByText("Movimiento por validar 6")).toBeInTheDocument();
    expect(screen.queryByText("Movimiento por validar 7")).not.toBeInTheDocument();
    expect(screen.getByTestId("ubicacion")).toHaveTextContent("/pacientes");
  });

  it("desde la ventana se pasa a la ventana dedicada de notificaciones", async () => {
    pantalla();

    fireEvent.click(screen.getByLabelText("Notificaciones: 8 sin leer"));
    fireEvent.click(screen.getByText("Ver todas las notificaciones"));

    await waitFor(() =>
      expect(screen.getByTestId("ubicacion")).toHaveTextContent("/notificaciones"),
    );
  });

  it("abrir una notificacion la marca como leida y lleva a su pantalla", async () => {
    pantalla();

    fireEvent.click(screen.getByLabelText("Notificaciones: 8 sin leer"));
    fireEvent.click(screen.getByText("Movimiento por validar 1"));

    await waitFor(() =>
      expect(screen.getByTestId("ubicacion")).toHaveTextContent("/inventario?tab=validacion"),
    );
    expect(mockBuzon.abrir).toHaveBeenCalled();
  });

  it("sin notificaciones sin leer, la campana no muestra numero", () => {
    mockContador.cantidad = 0;
    pantalla();
    expect(
      screen.getByLabelText("Notificaciones: sin notificaciones nuevas"),
    ).not.toHaveTextContent(/\d/);
  });
});
