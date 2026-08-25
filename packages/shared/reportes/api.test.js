import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerIndicadoresImpacto } from "./api.js";
import { obtenerSupabase } from "../api/cliente.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

describe("Módulo de Reportes - Indicadores de Impacto", () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn(),
    };

    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  const crearQueryMock = (data, error = null) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve) => resolve({ data, error }),
    };
    return query;
  };

  it("bloquea el acceso a usuarios que no son Administrador o Junta Directiva", async () => {
    const respuesta = await obtenerIndicadoresImpacto({ rol: "voluntario" });

    expect(respuesta.datos).toBeNull();
    expect(respuesta.error).toBeDefined();
    expect(respuesta.error.mensaje).toContain("No tienes permisos");
  });

  it("calcula los cuatro indicadores totales del periodo correctamente", async () => {
    const mockData = [
      {
        pacientes_atendidos: 10,
        comunidades_beneficiadas: 1,
        tratamientos_entregados: 15,
        medicamentos_utilizados: 20,
        mes: "2026-05",
      },
      {
        pacientes_atendidos: 5,
        comunidades_beneficiadas: 1,
        tratamientos_entregados: 5,
        medicamentos_utilizados: 10,
        mes: "2026-05",
      },
    ];

    mockSupabase.from.mockReturnValue(crearQueryMock(mockData));

    const { datos, error } = await obtenerIndicadoresImpacto({
      rol: "administrador",
    });

    expect(error).toBeNull();
    expect(datos.totales).toEqual({
      pacientes_atendidos: 15,
      comunidades_beneficiadas: 2,
      tratamientos_entregados: 20,
      medicamentos_utilizados: 30,
    });
  });

  it("permite agrupar los indicadores por dimensión (ej. comunidad)", async () => {
    const mockData = [
      {
        pacientes_atendidos: 10,
        comunidades_beneficiadas: 1,
        tratamientos_entregados: 5,
        medicamentos_utilizados: 8,
        comunidad_id: "com-1",
      },
      {
        pacientes_atendidos: 20,
        comunidades_beneficiadas: 1,
        tratamientos_entregados: 12,
        medicamentos_utilizados: 15,
        comunidad_id: "com-2",
      },
    ];

    mockSupabase.from.mockReturnValue(crearQueryMock(mockData));

    const { datos } = await obtenerIndicadoresImpacto({
      rol: "junta_directiva",
      agruparPor: "comunidad_id",
    });

    expect(datos.agrupados).toHaveLength(2);
    expect(datos.agrupados[0].grupo).toBe("com-1");
    expect(datos.agrupados[0].pacientes_atendidos).toBe(10);
  });

  it("compara dos periodos y calcula la variación porcentual y absoluta", async () => {
    const mockPeriodoActual = [
      { pacientes_atendidos: 100, comunidades_beneficiadas: 5, tratamientos_entregados: 50, medicamentos_utilizados: 80 },
    ];
    const mockPeriodoAnterior = [
      { pacientes_atendidos: 50, comunidades_beneficiadas: 5, tratamientos_entregados: 50, medicamentos_utilizados: 40 },
    ];

    mockSupabase.from
      .mockReturnValueOnce(crearQueryMock(mockPeriodoActual))
      .mockReturnValueOnce(crearQueryMock(mockPeriodoAnterior));

    const { datos } = await obtenerIndicadoresImpacto({
      rol: "administrador",
      periodo: { fecha_inicio: "2026-05-01", fecha_fin: "2026-05-31" },
      periodoComparacion: { fecha_inicio: "2026-04-01", fecha_fin: "2026-04-30" },
    });

    expect(datos.comparacion).toBeDefined();
    expect(datos.comparacion.variacion.pacientes_atendidos).toEqual({
      actual: 100,
      anterior: 50,
      diferencia: 50,
      porcentaje: 100,
    });
  });
});