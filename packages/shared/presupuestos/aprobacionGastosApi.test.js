import { describe, it, expect } from "vitest";
import {
  listarGastosPendientes,
  aprobarGasto,
  rechazarGasto,
} from "./aprobacionGastosApi.js";

describe("API de Aprobación de Gastos (#299)", () => {
  it("exige motivo al rechazar un gasto", async () => {
    const resSinMotivo = await rechazarGasto(
      {
        gastoId: "123",
        usuarioId: "admin-1",
        motivo: "",
      },
      {}
    );

    expect(resSinMotivo.data).toBeNull();
    expect(resSinMotivo.error).not.toBeNull();
    expect(resSinMotivo.error.message).toContain("motivo de rechazo es obligatorio");
  });

  it("retorna error normalizado si faltan IDs obligatorios en aprobación", async () => {
    const res = await aprobarGasto({ gastoId: null, usuarioId: null }, {});
    expect(res.data).toBeNull();
    expect(res.error).toHaveProperty("message");
    expect(res.error).toHaveProperty("code");
  });

  it("valida la exportación de listarGastosPendientes", () => {
    expect(typeof listarGastosPendientes).toBe("function");
  });
});