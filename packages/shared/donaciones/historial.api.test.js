import { describe, it, expect, vi, beforeEach } from "vitest";
import { listarDonaciones } from "./historial.api.js";
import { obtenerSupabase } from "../api/cliente.js";
import { ROLES } from "../usuarios/roles.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

describe("listarDonaciones (#193)", () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    };
    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  /**
   * `mockSupabase` es su propia cadena: eq/neq/gte/lte/order/range devuelven `this`
   * (mockReturnThis), y aqui se le agrega `.then()` para que `await consulta` funcione. Como
   * `listarDonaciones()` hace dos consultas seguidas (el listado y despues los totales),
   * `.select()` recuerda cual de las dos se esta armando -por la forma de las columnas- para que
   * `.then()` resuelva con la respuesta que corresponde.
   */
  function resolverConsultas({ listado, totales }) {
    let modo = "listado";
    mockSupabase.select.mockImplementation((columnas) => {
      modo = typeof columnas === "string" && columnas.startsWith("tipo,") ? "totales" : "listado";
      return mockSupabase;
    });
    mockSupabase.then = (resolve) => resolve(modo === "totales" ? totales : listado);
  }

  it("permite leer a administrador, junta directiva y socio fundador; deniega a los demas", async () => {
    resolverConsultas({
      listado: { data: [], error: null, count: 0 },
      totales: { data: [], error: null },
    });

    const admin = await listarDonaciones({}, { rolUsuario: ROLES.ADMINISTRADOR });
    const junta = await listarDonaciones({}, { rolUsuario: ROLES.JUNTA_DIRECTIVA });
    const socio = await listarDonaciones({}, { rolUsuario: ROLES.SOCIO_FUNDADOR });
    const otro = await listarDonaciones({}, { rolUsuario: ROLES.MEDICO });

    expect(admin.error).toBeNull();
    expect(junta.error).toBeNull();
    expect(socio.error).toBeNull();
    expect(otro.error.mensaje).toContain("permisos de lectura");
  });

  it("aplica cada filtro con el operador correcto", async () => {
    resolverConsultas({
      listado: { data: [], error: null, count: 0 },
      totales: { data: [], error: null },
    });

    await listarDonaciones(
      {
        donanteId: "don-1",
        tipo: "medicamentos",
        proyectoId: "proy-1",
        fechaInicio: "2026-01-01",
        fechaFin: "2026-06-30",
      },
      { rolUsuario: ROLES.ADMINISTRADOR },
    );

    expect(mockSupabase.eq).toHaveBeenCalledWith("donante_id", "don-1");
    expect(mockSupabase.eq).toHaveBeenCalledWith("tipo", "medicamentos");
    expect(mockSupabase.eq).toHaveBeenCalledWith("proyecto_id", "proy-1");
    expect(mockSupabase.gte).toHaveBeenCalledWith("fecha", "2026-01-01");
    expect(mockSupabase.lte).toHaveBeenCalledWith("fecha", "2026-06-30");
  });

  it("sin estado explicito excluye las anuladas por defecto", async () => {
    resolverConsultas({
      listado: { data: [], error: null, count: 0 },
      totales: { data: [], error: null },
    });

    await listarDonaciones({}, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(mockSupabase.neq).toHaveBeenCalledWith("estado", "anulada");
  });

  it("con estado 'anulada' filtra exactamente por ese valor, no excluye", async () => {
    resolverConsultas({
      listado: { data: [], error: null, count: 0 },
      totales: { data: [], error: null },
    });

    await listarDonaciones({ estado: "anulada" }, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(mockSupabase.eq).toHaveBeenCalledWith("estado", "anulada");
    expect(mockSupabase.neq).not.toHaveBeenCalledWith("estado", "anulada");
  });

  it("sin limite no pagina: sin range y sin pedir count", async () => {
    resolverConsultas({
      listado: { data: [{ id: "d1" }], error: null },
      totales: { data: [], error: null },
    });

    const { datos } = await listarDonaciones({}, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(mockSupabase.range).not.toHaveBeenCalled();
    expect(mockSupabase.select.mock.calls[0][1]).toBeUndefined();
    expect(datos.porPagina).toBeNull();
    expect(datos.total).toBe(1);
  });

  it("con limite pide el rango de la pagina y el conteo exacto", async () => {
    resolverConsultas({
      listado: { data: [], error: null, count: 45 },
      totales: { data: [], error: null },
    });

    const { datos } = await listarDonaciones(
      { limite: 20, pagina: 2 },
      { rolUsuario: ROLES.ADMINISTRADOR },
    );

    expect(mockSupabase.select.mock.calls[0][1]).toEqual({ count: "exact" });
    expect(mockSupabase.range).toHaveBeenCalledWith(20, 39);
    expect(datos.total).toBe(45);
    expect(datos.pagina).toBe(2);
  });

  it("ordena por fecha descendente", async () => {
    resolverConsultas({
      listado: { data: [], error: null, count: 0 },
      totales: { data: [], error: null },
    });

    await listarDonaciones({}, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(mockSupabase.order).toHaveBeenCalledWith("fecha", { ascending: false });
  });

  it("aplana el donante embebido a donanteNombre", async () => {
    resolverConsultas({
      listado: {
        data: [{ id: "d1", donante: { nombre: "Fundacion Esperanza" } }],
        error: null,
        count: 1,
      },
      totales: { data: [], error: null },
    });

    const { datos } = await listarDonaciones({}, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(datos.donaciones[0].donanteNombre).toBe("Fundacion Esperanza");
    expect(datos.donaciones[0].donante).toBeUndefined();
  });

  it("calcula los totales por tipo: dinero suma monto, medicamentos/insumos suman cantidad, servicios cuenta donaciones", async () => {
    resolverConsultas({
      listado: { data: [], error: null, count: 0 },
      totales: {
        data: [
          { tipo: "dinero", detalle: [{ monto: 100 }, { monto: 50 }] },
          { tipo: "medicamentos", detalle: [{ cantidad: 30 }] },
          { tipo: "insumos", detalle: [{ cantidad: 5 }, { cantidad: 2 }] },
          { tipo: "servicios", detalle: [] },
          { tipo: "servicios", detalle: [] },
        ],
        error: null,
      },
    });

    const { datos } = await listarDonaciones({}, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(datos.totalesPorTipo).toEqual({
      dinero: 150,
      medicamentos: 30,
      insumos: 7,
      servicios: 2,
    });
  });

  it("sin resultados devuelve listas vacias y totales en cero, sin reventar", async () => {
    resolverConsultas({
      listado: { data: [], error: null, count: 0 },
      totales: { data: [], error: null },
    });

    const { datos, error } = await listarDonaciones({}, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(error).toBeNull();
    expect(datos.donaciones).toEqual([]);
    expect(datos.total).toBe(0);
    expect(datos.totalesPorTipo).toEqual({ dinero: 0, medicamentos: 0, insumos: 0, servicios: 0 });
  });

  it("un rechazo de RLS en el listado se normaliza y no devuelve datos a medias", async () => {
    resolverConsultas({
      listado: { data: null, error: { code: "42501", message: "denegado" } },
      totales: { data: [], error: null },
    });

    const { datos, error } = await listarDonaciones({}, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(datos).toBeNull();
    expect(error).not.toBeNull();
  });

  it("un fallo al calcular los totales tambien se normaliza", async () => {
    resolverConsultas({
      listado: { data: [], error: null, count: 0 },
      totales: { data: null, error: { code: "42501", message: "denegado" } },
    });

    const { datos, error } = await listarDonaciones({}, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(datos).toBeNull();
    expect(error).not.toBeNull();
  });
});
