import { describe, it, expect, vi, beforeEach } from "vitest";
import { obtenerReporteJornada } from "./jornada.api.js";
import { obtenerSupabase } from "../api/cliente.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

describe("Módulo de Reportes - API Resultados por Jornada (#206)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error si no se proporciona el id de jornada", async () => {
    const res = await obtenerReporteJornada("");
    expect(res.error.mensaje).toContain("obligatorio");
  });

  it("consolida la información completa de la jornada en una sola llamada", async () => {
    const mockSupabase = {
      from: vi.fn((tabla) => {
        if (tabla === "jornadas") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "JOR-1", nombre: "Jornada Central", fecha: "2026-08-01" },
              error: null,
            }),
          };
        }
        if (tabla === "consultas") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "C1", atendido_por: "MED-1", diagnostico: "Gripe", pacientes_id: "P1" },
                { id: "C2", atendido_por: "MED-1", diagnostico: "Gripe", pacientes_id: "P2" },
                { id: "C3", atendido_por: "MED-2", diagnostico: "Infección", pacientes_id: "P1" },
              ],
              error: null,
            }),
          };
        }
        if (tabla === "recetas_detalle") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { medicamento_nombre: "Paracetamol", cantidad: 10 },
                { medicamento_nombre: "Amoxicilina", cantidad: 5 },
              ],
              error: null,
            }),
          };
        }
        return {};
      }),
    };

    obtenerSupabase.mockReturnValue(mockSupabase);

    const res = await obtenerReporteJornada("JOR-1");

    expect(res.error).toBeNull();
    expect(res.datos.resumen.total_consultas).toBe(3);
    expect(res.datos.resumen.pacientes_atendidos).toBe(2);
    expect(res.datos.diagnosticos_mas_frecuentes[0]).toEqual({
      diagnostico: "Gripe",
      cantidad: 2,
    });
    expect(res.datos.personal_participante).toHaveLength(2);
  });
});