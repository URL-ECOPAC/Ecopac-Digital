import { describe, it, expect, vi, beforeEach } from "vitest";
import { registrarIngreso, registrarSalida, editarMovimiento } from "./movimientos.api.js";
import { obtenerSupabase } from "../api/cliente.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

describe("Módulo de Inventario - API Movimientos", () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    };
    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  describe("registrarIngreso", () => {
    it("rechaza orígenes no válidos", async () => {
      const res = await registrarIngreso({ origen: "invalido", cantidad: 10, usuarioId: "U-1" });
      expect(res.error.mensaje).toContain("compra");
    });

    it("exige el usuario que registra", async () => {
      const res = await registrarIngreso({ origen: "compra", cantidad: 10 });
      expect(res.error.mensaje).toContain("usuario");
    });

    it("crea lote nuevo sin cantidad_disponible (columna que ya no existe en lotes)", async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: "LOTE-NUEVO" }, error: null })
        .mockResolvedValueOnce({ data: { id: "MOV-1", tipo: "ingreso" }, error: null });

      const res = await registrarIngreso({
        origen: "donacion",
        bodega_id: "B-1",
        medicamento_id: "M-1",
        numero_lote: "LOT-100",
        fecha_vencimiento: "2027-01-01",
        cantidad: 50,
        usuarioId: "U-1",
      });

      expect(res.datos.id).toBe("MOV-1");
      expect(mockSupabase.insert).toHaveBeenCalledTimes(2);
      // El primer insert es el lote: sin cantidad_disponible, columna que 00047 elimino.
      expect(mockSupabase.insert.mock.calls[0][0]).not.toHaveProperty("cantidad_disponible");
      expect(mockSupabase.insert.mock.calls[0][0]).not.toHaveProperty("cantidad");
    });

    it("no envia origen ni jornada_id al insertar el movimiento (columnas que no existen)", async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "MOV-2" }, error: null });

      await registrarIngreso({
        origen: "compra",
        bodega_id: "B-1",
        lote_id: "LOTE-EXISTENTE",
        cantidad: 20,
        usuarioId: "U-1",
      });

      const payloadMovimiento = mockSupabase.insert.mock.calls[0][0];
      expect(payloadMovimiento).not.toHaveProperty("origen");
      expect(payloadMovimiento).not.toHaveProperty("jornada_id");
      expect(payloadMovimiento.registrado_por).toBe("U-1");
    });
  });

  describe("registrarSalida", () => {
    it("rechaza lotes vencidos", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "LOTE-1", fecha_vencimiento: "2020-01-01" },
        error: null,
      });

      const res = await registrarSalida({
        bodega_id: "B-1",
        lote_id: "LOTE-1",
        cantidad: 10,
        usuarioId: "U-1",
      });

      expect(res.error.mensaje).toContain("vencido");
    });

    it("lee la cantidad disponible de existencias (lote, bodega), no de lotes", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "LOTE-1", fecha_vencimiento: "2099-01-01" },
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { cantidad_disponible: 5 },
        error: null,
      });

      const res = await registrarSalida({
        bodega_id: "B-1",
        lote_id: "LOTE-1",
        cantidad: 10,
        usuarioId: "U-1",
      });

      expect(res.error.mensaje).toContain("supera la existencia disponible");
    });

    it("trata la ausencia de fila en existencias como stock 0", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "LOTE-1", fecha_vencimiento: "2099-01-01" },
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const res = await registrarSalida({
        bodega_id: "B-1",
        lote_id: "LOTE-1",
        cantidad: 1,
        usuarioId: "U-1",
      });

      expect(res.error.mensaje).toContain("supera la existencia disponible");
    });

    it("registra la salida cuando hay existencia suficiente", async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "LOTE-1", fecha_vencimiento: "2099-01-01" },
          error: null,
        })
        .mockResolvedValueOnce({ data: { id: "MOV-3", tipo: "salida" }, error: null });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { cantidad_disponible: 20 },
        error: null,
      });

      const res = await registrarSalida({
        bodega_id: "B-1",
        lote_id: "LOTE-1",
        cantidad: 10,
        usuarioId: "U-1",
      });

      expect(res.error).toBeNull();
      expect(res.datos.id).toBe("MOV-3");
    });
  });

  describe("editarMovimiento", () => {
    it("bloquea la edición de movimientos que ya fueron aprobados", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "MOV-1", estado: "aprobado", registrado_por: "USR-1" },
        error: null,
      });

      const res = await editarMovimiento("MOV-1", { cantidad: 20 }, "USR-1");
      expect(res.error.mensaje).toContain("pendiente");
    });

    it("bloquea la edición por alguien distinto de quien registro el movimiento", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "MOV-1", estado: "pendiente", registrado_por: "USR-1" },
        error: null,
      });

      const res = await editarMovimiento("MOV-1", { cantidad: 20 }, "USR-2");
      expect(res.error.mensaje).toContain("registro");
    });
  });
});
