import { describe, it, expect, vi, beforeEach } from "vitest";
import { registrarDonacion, anularDonacion } from "./registro.api.js";
import { obtenerSupabase } from "../api/cliente.js";
import { ROLES } from "../usuarios/roles.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

const HOY = new Date().toISOString().split("T")[0];

function donacionValida(overrides = {}) {
  return {
    donanteId: "DON-1",
    tipo: "dinero",
    fecha: HOY,
    detalles: [
      { id: 1, descripcion: "Efectivo", cantidad: 1, unidad: "", monto: 500, fechaVencimiento: "" },
    ],
    ...overrides,
  };
}

describe("registrarDonacion (#635)", () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    // Sin .single(): fn_registrar_donacion devuelve JSONB (un escalar), que PostgREST no
    // envuelve en arreglo, asi que el rpc() resuelve directo a { data, error }.
    mockSupabase = {
      rpc: vi.fn(),
    };
    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  it("deniega a quien no es administrador, sin llegar a Supabase", async () => {
    const res = await registrarDonacion(donacionValida(), { rolUsuario: ROLES.JUNTA_DIRECTIVA });

    expect(res.datos).toBeNull();
    expect(res.error.mensaje).toContain("Administrador");
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("valida con validarDonacion() antes de escribir: sin donante, no llega a Supabase", async () => {
    const res = await registrarDonacion(donacionValida({ donanteId: "" }), {
      rolUsuario: ROLES.ADMINISTRADOR,
    });

    expect(res.datos).toBeNull();
    expect(res.error.campos.donanteId).toBeTruthy();
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("una donacion en dinero sin monto tambien falla la validacion antes de escribir", async () => {
    const res = await registrarDonacion(
      donacionValida({
        detalles: [{ id: 1, descripcion: "Efectivo", cantidad: 1, unidad: "", monto: 0 }],
      }),
      { rolUsuario: ROLES.ADMINISTRADOR },
    );

    expect(res.datos).toBeNull();
    expect(res.error.campos.monto).toBeTruthy();
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("llama a fn_registrar_donacion con los argumentos correctos, sin fechaVencimiento ni medicamentoId en el detalle", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: {
        donacion: {
          id: "DONAC-1",
          donante_id: "DON-1",
          proyecto_id: "PROY-1",
          tipo: "medicamentos",
          fecha: HOY,
          observaciones: null,
          estado: "registrada",
          motivo_anulacion: null,
          anulada_por: null,
          anulada_en: null,
          registrado_por: "USR-1",
        },
        detalleIds: ["DETALLE-1"],
      },
      error: null,
    });

    const res = await registrarDonacion(
      donacionValida({
        tipo: "medicamentos",
        proyectoId: "PROY-1",
        detalles: [
          {
            id: 1,
            descripcion: "Amoxicilina",
            cantidad: 10,
            unidad: "cajas",
            monto: "",
            fechaVencimiento: "2027-01-01",
            medicamentoId: "MED-1",
          },
        ],
      }),
      { rolUsuario: ROLES.ADMINISTRADOR },
    );

    expect(mockSupabase.rpc).toHaveBeenCalledWith("fn_registrar_donacion", {
      p_donante_id: "DON-1",
      p_tipo: "medicamentos",
      p_fecha: HOY,
      p_detalle: [{ descripcion: "Amoxicilina", cantidad: 10, unidad: "cajas", monto: null }],
      p_proyecto_id: "PROY-1",
      p_observaciones: null,
    });
    // Ni fechaVencimiento ni medicamentoId son columnas de donacion_detalle (00022): no viajan.
    const detalleEnviado = mockSupabase.rpc.mock.calls[0][1].p_detalle[0];
    expect(detalleEnviado.fechaVencimiento).toBeUndefined();
    expect(detalleEnviado.medicamentoId).toBeUndefined();
    // registrado_por no es un parametro que mande el cliente: lo fija auth.uid() en la funcion.
    expect(mockSupabase.rpc.mock.calls[0][1].registrado_por).toBeUndefined();

    expect(res.error).toBeNull();
    expect(res.datos.id).toBe("DONAC-1");
    expect(res.datos.donanteId).toBe("DON-1");
    expect(res.datos.registradoPor).toBe("USR-1");
    // detalleIds: el id real de cada renglon de donacion_detalle, en el mismo orden que se
    // envio p_detalle (criterio 6: lo necesita el paso de generar el ingreso de inventario).
    expect(res.datos.detalleIds).toEqual(["DETALLE-1"]);
  });

  it("propaga el error del rpc sin dar por exitosa la operacion", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "violates check constraint" },
    });

    const res = await registrarDonacion(donacionValida(), { rolUsuario: ROLES.ADMINISTRADOR });

    expect(res.datos).toBeNull();
    expect(res.error).not.toBeNull();
    expect(res.error.codigo).toBe("check");
  });
});

describe("anularDonacion (#635, criterio 7)", () => {
  let mockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      rpc: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    obtenerSupabase.mockReturnValue(mockSupabase);
  });

  it("deniega a quien no es administrador, sin llegar a Supabase", async () => {
    const res = await anularDonacion(
      "DONAC-1",
      { motivo: "Donante se retracto" },
      { rolUsuario: ROLES.SOCIO_FUNDADOR },
    );

    expect(res.datos).toBeNull();
    expect(res.error.mensaje).toContain("Administrador");
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("exige el motivo antes de escribir", async () => {
    const res = await anularDonacion("DONAC-1", {}, { rolUsuario: ROLES.ADMINISTRADOR });

    expect(res.datos).toBeNull();
    expect(res.error.campos.motivo).toBeTruthy();
    expect(obtenerSupabase).not.toHaveBeenCalled();
  });

  it("anula con exito: llama a fn_anular_donacion y devuelve la donacion actualizada", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        id: "DONAC-1",
        donante_id: "DON-1",
        proyecto_id: null,
        tipo: "dinero",
        fecha: HOY,
        observaciones: null,
        estado: "anulada",
        motivo_anulacion: "Donante se retracto",
        anulada_por: "USR-1",
        anulada_en: "2026-03-05T10:00:00Z",
        registrado_por: "USR-1",
      },
      error: null,
    });

    const res = await anularDonacion(
      "DONAC-1",
      { motivo: "Donante se retracto" },
      { rolUsuario: ROLES.ADMINISTRADOR },
    );

    expect(mockSupabase.rpc).toHaveBeenCalledWith("fn_anular_donacion", {
      p_donacion_id: "DONAC-1",
      p_motivo: "Donante se retracto",
    });
    expect(res.error).toBeNull();
    expect(res.datos.estado).toBe("anulada");
    expect(res.datos.anuladaPor).toBe("USR-1");
  });

  it("traduce el error P0001 de fn_anular_donacion a un mensaje especifico, sin el texto crudo de Postgres", async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "La donacion no existe o ya esta anulada." },
    });

    const res = await anularDonacion(
      "DONAC-1",
      { motivo: "Donante se retracto" },
      { rolUsuario: ROLES.ADMINISTRADOR },
    );

    expect(res.datos).toBeNull();
    expect(res.error.mensaje).toBe("La donación no existe o ya fue anulada.");
  });
});
