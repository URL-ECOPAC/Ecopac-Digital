import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registrarIngreso,
  registrarSalida,
  editarMovimiento,
} from "./movimientos.api.js";
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
    };
    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  it("registrarIngreso rechaza orígenes no válidos", async () => {
    const res = await registrarIngreso({ origen: "invalido", cantidad: 10 });
    expect(res.error.mensaje).toContain("compra");
  });

  it("registrarIngreso crea lote nuevo si no se proporciona lote_id", async () => {
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
    });

    expect(res.datos.id).toBe("MOV-1");
    expect(mockSupabase.insert).toHaveBeenCalledTimes(2);
  });

  it("registrarSalida rechaza lotes vencidos o sin existencia suficiente", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "LOTE-1", fecha_vencimiento: "2020-01-01", cantidad_disponible: 100 },
      error: null,
    });

    const res = await registrarSalida({ bodega_id: "B-1", lote_id: "LOTE-1", cantidad: 10 });
    expect(res.error.mensaje).toContain("vencido");
  });

  it("bloquea la edición de movimientos que ya fueron aprobados", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "MOV-1", estado: "aprobado", creado_por: "USR-1" },
      error: null,
    });

    const res = await editarMovimiento("MOV-1", { cantidad: 20 }, "USR-1");
    expect(res.error.mensaje).toContain("pendiente");
  });
});