// Prueba de suscribirACambios (00163): una suscripcion por tabla, una recarga por racha de avisos.

import { afterEach, describe, expect, it, vi } from "vitest";

import { suscribirACambios } from "./useCambiosEnTiempoReal.js";

function clienteDeMentira() {
  const escuchas = [];
  const canal = {
    on: vi.fn((tipo, filtro, fn) => {
      escuchas.push({ tipo, filtro, fn });
      return canal;
    }),
    subscribe: vi.fn(() => canal),
  };
  return {
    escuchas,
    canal,
    channel: vi.fn(() => canal),
    removeChannel: vi.fn(),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("suscribirACambios", () => {
  it("escucha cada tabla del esquema public", () => {
    const cliente = clienteDeMentira();
    suscribirACambios(cliente, ["gastos", "jornadas"], vi.fn());

    expect(cliente.escuchas.map((e) => e.filtro)).toEqual([
      { event: "*", schema: "public", table: "gastos" },
      { event: "*", schema: "public", table: "jornadas" },
    ]);
    expect(cliente.canal.subscribe).toHaveBeenCalledTimes(1);
  });

  it("junta varios avisos seguidos en una sola recarga", () => {
    vi.useFakeTimers();
    const cliente = clienteDeMentira();
    const alCambiar = vi.fn();
    suscribirACambios(cliente, ["gastos", "notificaciones"], alCambiar, { espera: 100 });

    cliente.escuchas[0].fn();
    cliente.escuchas[1].fn();
    vi.advanceTimersByTime(50);
    cliente.escuchas[0].fn();
    vi.advanceTimersByTime(99);
    expect(alCambiar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  it("al cancelar quita el canal y no recarga lo que estaba por salir", () => {
    vi.useFakeTimers();
    const cliente = clienteDeMentira();
    const alCambiar = vi.fn();
    const cancelar = suscribirACambios(cliente, ["gastos"], alCambiar, { espera: 100 });

    cliente.escuchas[0].fn();
    cancelar();
    vi.advanceTimersByTime(200);

    expect(alCambiar).not.toHaveBeenCalled();
    expect(cliente.removeChannel).toHaveBeenCalledWith(cliente.canal);
  });
});
