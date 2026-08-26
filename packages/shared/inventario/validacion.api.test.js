import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  aprobarMovimiento,
  rechazarMovimiento,
  aprobarMovimientosEnLote,
} from "./validacion.api.js";
import { obtenerSupabase } from "../api/cliente.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

describe("Módulo de Inventario - API Validación y Aprobación", () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  it("bloquea operaciones si el usuario no es Administrador", async () => {
    const res = await aprobarMovimiento("MOV-1", { usuarioId: "U1", rolUsuario: "operador" });
    expect(res.error.mensaje).toContain("Administrador");
  });

  it("impide que el usuario apruebe un movimiento que él mismo registró", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "MOV-1", creado_por: "ADMIN-1", estado: "pendiente" },
      error: null,
    });

    const res = await aprobarMovimiento("MOV-1", { usuarioId: "ADMIN-1", rolUsuario: "administrador" });
    expect(res.error.mensaje).toContain("mismo");
  });

  it("falla al aprobar una salida sin stock suficiente y no deja stock negativo", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: "MOV-1",
        tipo: "salida",
        cantidad: 50,
        creado_por: "USER-1",
        estado: "pendiente",
        lote: { id: "L-1", cantidad_disponible: 10 },
      },
      error: null,
    });

    const res = await aprobarMovimiento("MOV-1", { usuarioId: "ADMIN-1", rolUsuario: "administrador" });
    expect(res.error.mensaje).toContain("Stock insuficiente");
  });

  it("rechazarMovimiento exige un motivo obligatorio", async () => {
    const res = await rechazarMovimiento("MOV-1", { motivo: "", usuarioId: "ADMIN-1", rolUsuario: "administrador" });
    expect(res.error.mensaje).toContain("motivo");
  });

  it("aprobarMovimientosEnLote procesa múltiples y reporta fallidos", async () => {
    // MOV-1 falla (mismo creador), MOV-2 aprueba
    mockSupabase.single
      .mockResolvedValueOnce({
        data: { id: "MOV-1", creado_por: "ADMIN-1", estado: "pendiente" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "MOV-2",
          tipo: "ingreso",
          cantidad: 10,
          creado_por: "USER-2",
          estado: "pendiente",
          lote: { id: "L-2", cantidad_disponible: 5 },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "MOV-2", estado: "aprobado" },
        error: null,
      });

    const res = await aprobarMovimientosEnLote(["MOV-1", "MOV-2"], {
      usuarioId: "ADMIN-1",
      rolUsuario: "administrador",
    });

    expect(res.datos.fallidos).toHaveLength(1);
    expect(res.datos.aprobados).toHaveLength(1);
    expect(res.datos.fallidos[0].id).toBe("MOV-1");
  });
});