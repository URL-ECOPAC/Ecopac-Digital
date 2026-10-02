import { describe, it, expect, vi, beforeEach } from "vitest";
import { registrarDonacion } from "./registro.api.js";
import { obtenerSupabase } from "../api/cliente.js";
import { ROLES } from "../usuarios/roles.js";

vi.mock("../api/cliente.js", () => ({
  obtenerSupabase: vi.fn(),
}));

// Genera la fecha actual en zona horaria local (YYYY-MM-DD) para evitar desfase UTC
const HOY = new Date().toLocaleDateString("sv-SE");

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

  // Desde la #840 medicamentoId SI viaja: es donacion_detalle.medicamento_id (00135), y con el la
  // funcion arma la descripcion y la unidad desde el catalogo.
  it("llama a fn_registrar_donacion con los argumentos correctos, con medicamentoId y sin fechaVencimiento", async () => {
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
      {
        donanteId: "DON-1",
        tipo: "medicamentos",
        fecha: HOY,
        proyectoId: "PROY-1",
        observaciones: "",
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
      },
      { rolUsuario: ROLES.ADMINISTRADOR },
    );

    expect(mockSupabase.rpc).toHaveBeenCalledWith("fn_registrar_donacion", {
      p_donante_id: "DON-1",
      p_tipo: "medicamentos",
      p_fecha: HOY,
      p_detalle: [
        {
          descripcion: "Amoxicilina",
          cantidad: 10,
          unidad: "cajas",
          monto: null,
          medicamentoId: "MED-1",
        },
      ],
      p_proyecto_id: "PROY-1",
      p_observaciones: null,
      p_jornada_id: null,
    });

    const detalleEnviado = mockSupabase.rpc.mock.calls[0][1].p_detalle[0];
    expect(detalleEnviado.fechaVencimiento).toBeUndefined();
    expect(mockSupabase.rpc.mock.calls[0][1].registrado_por).toBeUndefined();

    expect(res.error).toBeNull();
    expect(res.datos.id).toBe("DONAC-1");
    expect(res.datos.donanteId).toBe("DON-1");
    expect(res.datos.registradoPor).toBe("USR-1");
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
    expect(res.error.mensaje).toBeDefined();
  });
});
