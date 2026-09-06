import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registrarDonante,
  listarDonantes,
  darDeBajaDonante,
  obtenerHistoricoDonante,
} from "./donantes.api.js";
import { obtenerSupabase } from "../api/cliente.js";
import { ROLES } from "../usuarios/roles.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

describe("Módulo de Donaciones - Catálogo de Donantes (#190)", () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  it("permite registrar donante solo al Administrador", async () => {
    const resDenegado = await registrarDonante(
      { tipo: "persona", nombre: "Juan" },
      { rolUsuario: ROLES.JUNTA_DIRECTIVA },
    );
    expect(resDenegado.error.mensaje).toContain("Administrador");

    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "DON-1", tipo: "persona", nombre: "Juan", activo: true },
      error: null,
    });

    const resExito = await registrarDonante(
      { tipo: "persona", nombre: "Juan" },
      { rolUsuario: ROLES.ADMINISTRADOR },
    );
    expect(resExito.datos.id).toBe("DON-1");
  });

  it("permite lecturas a Administrador, Junta Directiva y Socio Fundador", async () => {
    mockSupabase.order.mockResolvedValue({ data: [], error: null });

    const resJunta = await listarDonantes({}, { rolUsuario: ROLES.JUNTA_DIRECTIVA });
    const resSocio = await listarDonantes({}, { rolUsuario: ROLES.SOCIO_FUNDADOR });
    const resOtro = await listarDonantes({}, { rolUsuario: ROLES.MEDICO });

    expect(resJunta.error).toBeNull();
    expect(resSocio.error).toBeNull();
    expect(resOtro.error.mensaje).toContain("permisos de lectura");
  });

  it("filtra por nombre al buscar donantes", async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: "DON-1", nombre: "Fundación Esperanza" }],
      error: null,
    });

    const res = await listarDonantes(
      { busqueda: "Esperanza" },
      { rolUsuario: ROLES.ADMINISTRADOR },
    );

    expect(mockSupabase.ilike).toHaveBeenCalledWith("nombre", "%Esperanza%");
    expect(res.datos).toHaveLength(1);
  });

  it("realiza borrado lógico al dar de baja a un donante", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: "DON-1", activo: false },
      error: null,
    });

    const res = await darDeBajaDonante("DON-1", { rolUsuario: ROLES.ADMINISTRADOR });

    expect(mockSupabase.update).toHaveBeenCalledWith({ activo: false });
    expect(res.datos.activo).toBe(false);
  });

  it("calcula el total acumulado e histórico excluyendo donaciones anuladas", async () => {
    // El importe vive por renglon en donacion_detalle.monto (00022), no en una columna de
    // donaciones: `monto_total` nunca existio. Mockear la forma real (detalle embebido) es lo
    // que hace que este test falle contra la implementacion vieja que sumaba `d.monto_total`
    // (issue #636, criterio 4) y pase contra la que agrega sobre `donacion_detalle`.
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        { id: "DONAC-1", tipo: "dinero", detalle: [{ monto: 100 }] },
        { id: "DONAC-2", tipo: "dinero", detalle: [{ monto: 150 }, { monto: 100 }] },
      ],
      error: null,
    });

    const res = await obtenerHistoricoDonante("DON-1", { rolUsuario: ROLES.SOCIO_FUNDADOR });

    expect(mockSupabase.neq).toHaveBeenCalledWith("estado", "anulada");
    expect(res.datos.totalAcumulado).toBe(350);
    expect(res.datos.totalesPorTipo).toEqual({
      dinero: 350,
      medicamentos: 0,
      insumos: 0,
      servicios: 0,
    });
    expect(res.datos.donaciones).toHaveLength(2);
  });

  it("agrega cantidades de medicamentos e insumos sobre donacion_detalle.cantidad", async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        { id: "DONAC-3", tipo: "medicamentos", detalle: [{ cantidad: 30 }] },
        { id: "DONAC-4", tipo: "insumos", detalle: [{ cantidad: 5 }, { cantidad: 2 }] },
      ],
      error: null,
    });

    const res = await obtenerHistoricoDonante("DON-1", { rolUsuario: ROLES.ADMINISTRADOR });

    expect(res.datos.totalesPorTipo).toEqual({
      dinero: 0,
      medicamentos: 30,
      insumos: 7,
      servicios: 0,
    });
    // El alias de compatibilidad sigue siendo el total en dinero, no una mezcla de tipos.
    expect(res.datos.totalAcumulado).toBe(0);
  });
});
