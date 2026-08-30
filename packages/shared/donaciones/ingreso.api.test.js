import { describe, it, expect, vi, beforeEach } from "vitest";
import { generarIngresoDesdeDonacion, obtenerDonacionDeLote } from "./ingreso.api.js";
import { obtenerSupabase } from "../api/cliente.js";
import { registrarIngreso } from "../inventario/movimientos.api.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

// registrarIngreso ya tiene sus propias pruebas en movimientos.api.test.js; aqui se mockea
// entero para probar solo la logica nueva (el candado y el enlace de vuelta).
vi.mock("../inventario/movimientos.api.js", () => ({
  registrarIngreso: vi.fn(),
}));

describe("Módulo de Donaciones - API Ingreso", () => {
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

  describe("generarIngresoDesdeDonacion", () => {
    it("rechaza un renglon que no existe", async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: "no rows" } });

      const res = await generarIngresoDesdeDonacion("DET-INEXISTENTE", {});

      expect(res.datos).toBeNull();
      expect(res.error.mensaje).toContain("no existe");
      expect(registrarIngreso).not.toHaveBeenCalled();
    });

    it("rechaza un renglon que ya genero su ingreso (criterio 4)", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "DET-1", cantidad: 100, lote_id: "LOTE-YA-EXISTE" },
        error: null,
      });

      const res = await generarIngresoDesdeDonacion("DET-1", {
        medicamentoId: "M-1",
        bodegaId: "B-1",
        numeroLote: "LOT-1",
        fechaVencimiento: "2027-01-01",
      });

      expect(res.datos).toBeNull();
      expect(res.error.mensaje).toContain("ya genero su ingreso");
      expect(registrarIngreso).not.toHaveBeenCalled();
    });

    it("rechaza un renglon sin cantidad valida", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "DET-1", cantidad: 0, lote_id: null },
        error: null,
      });

      const res = await generarIngresoDesdeDonacion("DET-1", {});

      expect(res.error.mensaje).toContain("cantidad valida");
      expect(registrarIngreso).not.toHaveBeenCalled();
    });

    it("genera el ingreso con origen 'donacion' y la cantidad del renglon", async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "DET-1", cantidad: 100, descripcion: "Paracetamol 500mg", lote_id: null },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "DET-1", cantidad: 100, lote_id: "LOTE-NUEVO" },
          error: null,
        });

      registrarIngreso.mockResolvedValueOnce({
        datos: { id: "MOV-1", tipo: "ingreso", lote_id: "LOTE-NUEVO" },
        error: null,
      });

      const res = await generarIngresoDesdeDonacion("DET-1", {
        medicamentoId: "M-1",
        bodegaId: "B-1",
        numeroLote: "LOT-100",
        fechaVencimiento: "2027-06-01",
        proveedorId: "P-1",
        usuarioId: "U-1",
      });

      // La forma EXACTA, no objectContaining: con objectContaining esta prueba pasaba en verde
      // mientras faltaban usuarioId y proveedor_id, que son justo los dos que hacian imposible
      // completar la operacion contra la base real (issue #222). Una asercion que solo mira
      // algunas claves no puede ver una que falta.
      expect(registrarIngreso).toHaveBeenCalledWith({
        origen: "donacion",
        bodega_id: "B-1",
        medicamento_id: "M-1",
        numero_lote: "LOT-100",
        fecha_vencimiento: "2027-06-01",
        proveedor_id: "P-1",
        cantidad: 100,
        motivo: "Donacion: Paracetamol 500mg",
        usuarioId: "U-1",
      });
      expect(res.error).toBeNull();
      expect(res.datos.movimiento.id).toBe("MOV-1");
      expect(res.datos.detalle.lote_id).toBe("LOTE-NUEVO");
    });

    it("enlaza el lote creado de vuelta al renglon (criterio 3)", async () => {
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "DET-1", cantidad: 50, descripcion: "Ibuprofeno", lote_id: null },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "DET-1", lote_id: "LOTE-XYZ" },
          error: null,
        });

      registrarIngreso.mockResolvedValueOnce({
        datos: { id: "MOV-2", lote_id: "LOTE-XYZ" },
        error: null,
      });

      await generarIngresoDesdeDonacion("DET-1", {
        medicamentoId: "M-2",
        bodegaId: "B-1",
        numeroLote: "LOT-200",
        fechaVencimiento: "2027-01-01",
      });

      expect(mockSupabase.update).toHaveBeenCalledWith({ lote_id: "LOTE-XYZ" });
    });

    it("no enlaza nada si registrarIngreso falla", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "DET-1", cantidad: 50, descripcion: "Ibuprofeno", lote_id: null },
        error: null,
      });

      registrarIngreso.mockResolvedValueOnce({
        datos: null,
        error: { mensaje: "La cantidad ingresada debe ser mayor a cero." },
      });

      const res = await generarIngresoDesdeDonacion("DET-1", {
        medicamentoId: "M-2",
        bodegaId: "B-1",
        numeroLote: "LOT-200",
        fechaVencimiento: "2027-01-01",
      });

      expect(res.datos).toBeNull();
      expect(res.error.mensaje).toContain("mayor a cero");
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });
  });

  describe("obtenerDonacionDeLote", () => {
    it("devuelve la donacion y el donante de un lote donado", async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "DET-1",
          lote_id: "LOTE-1",
          donacion: { id: "DON-1", donante: { id: "DTE-1", nombre: "Farmacia Central" } },
        },
        error: null,
      });

      const res = await obtenerDonacionDeLote("LOTE-1");

      expect(res.error).toBeNull();
      expect(res.datos.donacion.donante.nombre).toBe("Farmacia Central");
    });

    it("devuelve null sin error para un lote que no vino de una donacion", async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const res = await obtenerDonacionDeLote("LOTE-COMPRADO");

      expect(res.datos).toBeNull();
      expect(res.error).toBeNull();
    });
  });
});
