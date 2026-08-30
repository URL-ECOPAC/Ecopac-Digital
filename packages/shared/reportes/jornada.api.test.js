import { describe, it, expect, vi, beforeEach } from "vitest";
import { obtenerReporteJornada, puedeVerReporteJornada } from "./jornada.api.js";
import { obtenerSupabase } from "../api/cliente.js";
import { ROLES } from "../usuarios/roles.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

function mockSupabaseCon({ consultas, recetas }) {
  return {
    from: vi.fn((tabla) => {
      if (tabla === "jornadas") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "JOR-1",
              nombre: "Jornada Central",
              fecha: "2026-08-01",
              estado: "finalizada",
              comunidad: { id: "COM-1", nombre: "El Rosario" },
            },
            error: null,
          }),
        };
      }
      if (tabla === "consultas") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: consultas, error: null }),
        };
      }
      if (tabla === "recetas") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: recetas, error: null }),
        };
      }
      return {};
    }),
  };
}

describe("Módulo de Reportes - API Resultados por Jornada (#489)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error si no se proporciona el id de jornada, sin tocar el cliente", async () => {
    const res = await obtenerReporteJornada({ jornadaId: "", rol: ROLES.MEDICO });

    expect(res.datos).toBeNull();
    expect(res.error.mensaje).toContain("obligatorio");
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("puedeVerReporteJornada solo admite administrador y medico", () => {
    expect(puedeVerReporteJornada(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerReporteJornada(ROLES.MEDICO)).toBe(true);
    expect(puedeVerReporteJornada(ROLES.VOLUNTARIO)).toBe(false);
    expect(puedeVerReporteJornada(ROLES.JUNTA_DIRECTIVA)).toBe(false);
    expect(puedeVerReporteJornada(ROLES.SOCIO_FUNDADOR)).toBe(false);
  });

  it("junta directiva no puede ver el reporte y no llega a tocar el cliente", async () => {
    const res = await obtenerReporteJornada({ jornadaId: "JOR-1", rol: ROLES.JUNTA_DIRECTIVA });

    expect(res.datos).toBeNull();
    expect(res.error.codigo).toBe("SIN_PERMISO");
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("voluntario general no puede ver el reporte", async () => {
    const res = await obtenerReporteJornada({ jornadaId: "JOR-1", rol: ROLES.VOLUNTARIO });

    expect(res.datos).toBeNull();
    expect(res.error.codigo).toBe("SIN_PERMISO");
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("consolida la información completa de la jornada usando las columnas reales", async () => {
    const mockSupabase = mockSupabaseCon({
      consultas: [
        {
          id: "C1",
          medico_id: "MED-1",
          expedientes: { paciente_id: "P1" },
          consulta_diagnostico: [{ diagnosticos: { nombre: "Gripe" } }],
        },
        {
          id: "C2",
          medico_id: "MED-1",
          expedientes: { paciente_id: "P2" },
          consulta_diagnostico: [{ diagnosticos: { nombre: "Gripe" } }],
        },
        {
          id: "C3",
          medico_id: "MED-2",
          expedientes: { paciente_id: "P1" },
          consulta_diagnostico: [{ diagnosticos: { nombre: "Infección" } }],
        },
      ],
      recetas: [
        {
          id: "R1",
          consulta_id: "C1",
          receta_detalle: [{ cantidad_entregada: 10, medicamentos: { nombre: "Paracetamol" } }],
        },
        {
          id: "R2",
          consulta_id: "C2",
          receta_detalle: [{ cantidad_entregada: 5, medicamentos: { nombre: "Amoxicilina" } }],
        },
      ],
    });

    obtenerSupabase.mockReturnValue(mockSupabase);

    const res = await obtenerReporteJornada({ jornadaId: "JOR-1", rol: ROLES.MEDICO });

    expect(res.error).toBeNull();
    expect(res.datos.jornada.comunidad).toEqual({ id: "COM-1", nombre: "El Rosario" });
    expect(res.datos.resumen.total_consultas).toBe(3);
    expect(res.datos.resumen.pacientes_atendidos).toBe(2);
    expect(res.datos.diagnosticos_mas_frecuentes[0]).toEqual({
      diagnostico: "Gripe",
      cantidad: 2,
    });
    expect(res.datos.personal_participante).toEqual(
      expect.arrayContaining([
        { usuario_id: "MED-1", total_atenciones: 2 },
        { usuario_id: "MED-2", total_atenciones: 1 },
      ]),
    );
    expect(res.datos.medicamentos_mas_entregados).toEqual([
      { medicamento: "Paracetamol", cantidad: 10 },
      { medicamento: "Amoxicilina", cantidad: 5 },
    ]);

    // La tabla real es receta_detalle vía recetas, nunca "recetas_detalle".
    const tablasConsultadas = mockSupabase.from.mock.calls.map(([tabla]) => tabla);
    expect(tablasConsultadas).not.toContain("recetas_detalle");
    expect(tablasConsultadas).toContain("recetas");
  });

  it("no consulta recetas si la jornada no tiene consultas", async () => {
    const mockSupabase = mockSupabaseCon({ consultas: [], recetas: [] });
    obtenerSupabase.mockReturnValue(mockSupabase);

    const res = await obtenerReporteJornada({ jornadaId: "JOR-1", rol: ROLES.MEDICO });

    expect(res.error).toBeNull();
    expect(res.datos.resumen.total_consultas).toBe(0);
    expect(res.datos.medicamentos_mas_entregados).toEqual([]);

    const tablasConsultadas = mockSupabase.from.mock.calls.map(([tabla]) => tabla);
    expect(tablasConsultadas).not.toContain("recetas");
  });

  it("normaliza el error del servidor en { datos: null, error } en vez de devolverlo suelto", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: "42501" } }),
      })),
    };
    obtenerSupabase.mockReturnValue(mockSupabase);

    const res = await obtenerReporteJornada({ jornadaId: "JOR-1", rol: ROLES.MEDICO });

    expect(res).toHaveProperty("datos", null);
    expect(res).toHaveProperty("error");
    expect(res.error.codigo).toBe("permiso_denegado");
  });
});
