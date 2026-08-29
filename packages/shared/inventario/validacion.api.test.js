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
      maybeSingle: vi.fn(),
    };
    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  describe("aprobarMovimiento", () => {
    it("bloquea operaciones si el usuario no es administrador", async () => {
      const res = await aprobarMovimiento("MOV-1", { usuarioId: "U1", rolUsuario: "medico" });
      expect(res.error.mensaje).toContain("Administrador");
    });

    // La 00048 (issue #410) quito a proposito la restriccion "no puedes aprobar lo tuyo": el
    // administrador aprueba lo que registra, igual en INSERT (auto-aprobacion, 00028) que en
    // UPDATE manual. Ya no hay nada que probar aqui -era codigo muerto, mov.creado_por nunca
    // existio en la tabla.

    it("rechaza aprobar un movimiento que no esta pendiente", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "MOV-1", estado: "aprobado" },
        error: null,
      });

      const res = await aprobarMovimiento("MOV-1", { usuarioId: "ADMIN-1", rolUsuario: "administrador" });
      expect(res.error.mensaje).toContain("pendiente");
    });

    it("lee la existencia disponible de existencias (lote, bodega), no de lotes.cantidad_disponible", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "MOV-1",
          tipo: "salida",
          cantidad: 50,
          estado: "pendiente",
          lote_id: "L-1",
          bodega_id: "B-1",
        },
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { cantidad_disponible: 10 },
        error: null,
      });

      const res = await aprobarMovimiento("MOV-1", { usuarioId: "ADMIN-1", rolUsuario: "administrador" });
      expect(res.error.mensaje).toContain("Stock insuficiente");
    });

    it("aprueba sin tocar lotes/existencias: el trigger de la base hace el ajuste", async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "MOV-1", tipo: "ingreso", cantidad: 50, estado: "pendiente", lote_id: "L-1", bodega_id: "B-1" },
          error: null,
        })
        .mockResolvedValueOnce({ data: { id: "MOV-1", estado: "aprobado" }, error: null });

      const res = await aprobarMovimiento("MOV-1", { usuarioId: "ADMIN-1", rolUsuario: "administrador" });

      expect(res.error).toBeNull();
      // Un solo UPDATE (el del movimiento); nunca se llama .from("lotes") ni .from("existencias")
      // para escribir cantidad.
      expect(mockSupabase.update).toHaveBeenCalledTimes(1);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ estado: "aprobado" }),
      );
    });
  });

  describe("rechazarMovimiento", () => {
    it("exige un motivo obligatorio", async () => {
      const res = await rechazarMovimiento("MOV-1", { usuarioId: "ADMIN-1", rolUsuario: "administrador" });
      expect(res.error.mensaje).toContain("motivo");
    });

    it("bloquea operaciones si el usuario no es administrador", async () => {
      const res = await rechazarMovimiento("MOV-1", {
        motivo: "Cantidad no coincide",
        usuarioId: "U1",
        rolUsuario: "voluntario general",
      });
      expect(res.error.mensaje).toContain("Administrador");
    });

    it("escribe motivo_rechazo (issue #491, columna agregada en la 00084)", async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: "MOV-1", estado: "pendiente" }, error: null })
        .mockResolvedValueOnce({ data: { id: "MOV-1", estado: "rechazado" }, error: null });

      await rechazarMovimiento("MOV-1", {
        motivo: "Cantidad no coincide",
        usuarioId: "ADMIN-1",
        rolUsuario: "administrador",
      });

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ estado: "rechazado", motivo_rechazo: "Cantidad no coincide" }),
      );
    });
  });

  describe("aprobarMovimientosEnLote", () => {
    it("reporta por separado los que se aprobaron y los que fallaron", async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "MOV-1", tipo: "ingreso", estado: "pendiente", lote_id: "L-1", bodega_id: "B-1" },
          error: null,
        })
        .mockResolvedValueOnce({ data: { id: "MOV-1", estado: "aprobado" }, error: null })
        .mockResolvedValueOnce({ data: { id: "MOV-2", estado: "aprobado" }, error: null });

      const res = await aprobarMovimientosEnLote(["MOV-1", "MOV-2"], {
        usuarioId: "ADMIN-1",
        rolUsuario: "administrador",
      });

      expect(res.datos.aprobados).toHaveLength(1);
      expect(res.datos.fallidos).toHaveLength(1);
    });
  });
});
