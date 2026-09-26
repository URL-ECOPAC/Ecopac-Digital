import { describe, it, expect, vi, beforeEach } from "vitest";
import { obtenerReporteJornada, puedeVerReporteJornada } from "./jornada.api.js";
import { obtenerSupabase } from "../api/cliente.js";
import { ROLES } from "../usuarios/roles.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

// Lo que devuelve fn_reporte_jornada (00148): el reporte ya agregado en la base.
const REPORTE = {
  jornada: {
    id: "JOR-1",
    nombre: "Jornada Central",
    fecha: "2026-08-01",
    estado: "finalizada",
    comunidad: { id: "COM-1", nombre: "El Rosario" },
  },
  resumen: { total_consultas: 3, pacientes_atendidos: 2 },
  diagnosticos_mas_frecuentes: [{ diagnostico: "Gripe", cantidad: 2 }],
  medicamentos_mas_entregados: [{ medicamento: "Paracetamol", cantidad: 10 }],
  personal_participante: [{ usuario_id: "MED-1", nombre: "Ana Inventada", total_atenciones: 2 }],
};

function clienteConRpc(respuesta) {
  return { rpc: vi.fn().mockResolvedValue(respuesta) };
}

describe("Módulo de Reportes - API Resultados por Jornada (#489, 00148)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error si no se proporciona el id de jornada, sin tocar el cliente", async () => {
    const res = await obtenerReporteJornada({ jornadaId: "", rol: ROLES.MEDICO });

    expect(res.datos).toBeNull();
    expect(res.error.mensaje).toContain("obligatorio");
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("lo consultan la administradora, los roles consultivos y el medico; el colaborador no", () => {
    expect(puedeVerReporteJornada(ROLES.ADMINISTRADOR)).toBe(true);
    expect(puedeVerReporteJornada(ROLES.JUNTA_DIRECTIVA)).toBe(true);
    expect(puedeVerReporteJornada(ROLES.SOCIO_FUNDADOR)).toBe(true);
    expect(puedeVerReporteJornada(ROLES.MEDICO)).toBe(true);
    expect(puedeVerReporteJornada(ROLES.VOLUNTARIO)).toBe(false);
  });

  it("voluntario general no puede ver el reporte y no llega a tocar el cliente", async () => {
    const res = await obtenerReporteJornada({ jornadaId: "JOR-1", rol: ROLES.VOLUNTARIO });

    expect(res.datos).toBeNull();
    expect(res.error.codigo).toBe("SIN_PERMISO");
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("pide el reporte ya agregado a fn_reporte_jornada y lo devuelve tal cual", async () => {
    const cliente = clienteConRpc({ data: REPORTE, error: null });
    obtenerSupabase.mockReturnValue(cliente);

    const res = await obtenerReporteJornada({ jornadaId: "JOR-1", rol: ROLES.JUNTA_DIRECTIVA });

    expect(res.error).toBeNull();
    expect(res.datos).toEqual(REPORTE);
    expect(cliente.rpc).toHaveBeenCalledWith("fn_reporte_jornada", { p_jornada_id: "JOR-1" });
  });

  it("una jornada que no existe (la funcion devuelve NULL) es un error, no un reporte vacio", async () => {
    obtenerSupabase.mockReturnValue(clienteConRpc({ data: null, error: null }));

    const res = await obtenerReporteJornada({ jornadaId: "JOR-X", rol: ROLES.ADMINISTRADOR });

    expect(res.datos).toBeNull();
    expect(res.error.codigo).toBe("SIN_RESULTADOS");
  });

  it("normaliza el error del servidor en { datos: null, error } en vez de devolverlo suelto", async () => {
    obtenerSupabase.mockReturnValue(clienteConRpc({ data: null, error: { code: "42501" } }));

    const res = await obtenerReporteJornada({ jornadaId: "JOR-1", rol: ROLES.MEDICO });

    expect(res).toHaveProperty("datos", null);
    expect(res.error.codigo).toBe("permiso_denegado");
  });
});
