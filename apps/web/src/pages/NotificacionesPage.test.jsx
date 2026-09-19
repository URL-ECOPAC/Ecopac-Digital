// Prueba de la ventana dedicada de notificaciones (issue #755).
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import NotificacionesPage from "./NotificacionesPage";

expect.extend(matchers);

const SIN_LEER = {
  id: "n-1",
  categoria: "caducidad",
  titulo: "Lote vencido: Medicamento de prueba",
  cuerpo: "El lote L-1 vencio.",
  enlace: "/inventario?tab=alertas",
  leida: false,
  createdAt: "2026-09-18T12:00:00Z",
};

const LEIDA = {
  id: "n-2",
  categoria: "validacion",
  titulo: "Movimiento por validar: salida de Medicamento de prueba",
  cuerpo: "Alguien registro una salida.",
  enlace: "/inventario?tab=validacion",
  leida: true,
  createdAt: "2026-09-18T11:00:00Z",
};

const mockEstadoHook = {};

vi.mock("@ecopac/shared", async (importarOriginal) => ({
  ...(await importarOriginal()),
  useBuzonNotificaciones: vi.fn(() => mockEstadoHook),
}));

vi.mock("../contexto/SesionProvider", () => ({
  useSesionCompartida: () => ({ perfil: { id: "perfil-1" } }),
}));

function Ubicacion() {
  const { pathname, search } = useLocation();
  return <p data-testid="ubicacion">{`${pathname}${search}`}</p>;
}

function pantalla() {
  return render(
    <MemoryRouter initialEntries={["/notificaciones"]}>
      <Routes>
        <Route path="/notificaciones" element={<NotificacionesPage />} />
        <Route path="*" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.assign(mockEstadoHook, {
    notificaciones: [SIN_LEER, LEIDA],
    total: 2,
    grupos: [
      {
        categoria: "caducidad",
        etiqueta: "Caducidad",
        tono: "warning",
        noLeidas: 1,
        notificaciones: [SIN_LEER],
      },
      {
        categoria: "validacion",
        etiqueta: "Validación",
        tono: "info",
        noLeidas: 0,
        notificaciones: [LEIDA],
      },
    ],
    filtros: { busqueda: "", categoria: null, estado: null },
    setFiltro: vi.fn(),
    limpiarFiltros: vi.fn(),
    hayFiltros: false,
    agrupar: false,
    setAgrupar: vi.fn(),
    noLeidas: 1,
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

describe("NotificacionesPage", () => {
  it("lista en orden de llegada y dice cuantas faltan por leer", () => {
    pantalla();

    expect(screen.getByText("1 sin leer")).toBeInTheDocument();
    const textos = screen.getAllByRole("button").map((b) => b.textContent);
    expect(textos.findIndex((t) => t.includes("Lote vencido"))).toBeLessThan(
      textos.findIndex((t) => t.includes("Movimiento por validar")),
    );
    expect(screen.getByLabelText("Sin leer")).toBeInTheDocument();
  });

  it("filtra por una categoria en especial con el filtro de categoria", () => {
    pantalla();

    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "stock" } });

    expect(mockEstadoHook.setFiltro).toHaveBeenCalledWith("categoria", "stock");
  });

  it("filtra por estado de lectura", () => {
    pantalla();

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "sin-leer" } });

    expect(mockEstadoHook.setFiltro).toHaveBeenCalledWith("estado", "sin-leer");
  });

  it("si los filtros no dejan nada, lo dice", () => {
    mockEstadoHook.notificaciones = [];
    mockEstadoHook.grupos = [];
    mockEstadoHook.hayFiltros = true;
    pantalla();

    expect(screen.getByText("Ninguna notificación coincide con los filtros.")).toBeInTheDocument();
  });

  it("abrir una notificacion la marca como leida y lleva a su enlace", async () => {
    pantalla();

    fireEvent.click(screen.getByText("Lote vencido: Medicamento de prueba"));

    expect(mockEstadoHook.abrir).toHaveBeenCalledWith(SIN_LEER);
    await waitFor(() =>
      expect(screen.getByTestId("ubicacion")).toHaveTextContent("/inventario?tab=alertas"),
    );
  });

  it("si no se pudo marcar como leida, no navega y muestra el error", async () => {
    mockEstadoHook.abrir = vi.fn(async () => false);
    mockEstadoHook.errorAccion = { mensaje: "No se pudo marcar la notificacion." };
    pantalla();

    fireEvent.click(screen.getByText("Lote vencido: Medicamento de prueba"));

    await waitFor(() => expect(mockEstadoHook.abrir).toHaveBeenCalled());
    expect(screen.queryByTestId("ubicacion")).not.toBeInTheDocument();
    expect(screen.getByText("No se pudo marcar la notificacion.")).toBeInTheDocument();
  });

  it("agrupado por categoria, pinta un bloque por grupo con su conteo", () => {
    mockEstadoHook.agrupar = true;
    pantalla();

    expect(screen.getByText(/Caducidad \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Validación \(1\)/)).toBeInTheDocument();
  });

  it("la pestana Por categoria activa el agrupado", () => {
    pantalla();

    fireEvent.click(screen.getByText("Por categoría"));

    expect(mockEstadoHook.setAgrupar).toHaveBeenCalledWith(true);
  });

  it("Marcar todas como leidas llama al hook", () => {
    pantalla();

    fireEvent.click(screen.getByText("Marcar todas como leídas"));

    expect(mockEstadoHook.marcarTodas).toHaveBeenCalled();
  });

  it("sin notificaciones lo dice, sin boton de marcar todas", () => {
    mockEstadoHook.notificaciones = [];
    mockEstadoHook.grupos = [];
    mockEstadoHook.total = 0;
    mockEstadoHook.noLeidas = 0;
    pantalla();

    expect(screen.getByText("No tienes notificaciones.")).toBeInTheDocument();
    expect(screen.queryByText("Marcar todas como leídas")).not.toBeInTheDocument();
  });
});
